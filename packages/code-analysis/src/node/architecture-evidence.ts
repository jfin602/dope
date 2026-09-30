import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, readdir, realpath, stat } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { projectPath, validateArchitectureEvidencePacket } from '@dope/software-map';
import type { ArchitectureEvidenceItem, ArchitectureEvidencePacket, ArchitectureEvidenceRequest, CodeEntityNode, DocumentSupport } from '@dope/software-map';
import type { CodeAnalysisResult } from '../index';
import type { IndexAnalyzer } from './software-map-index';

const ignored = new Set(['.dope', '.git', '.theia', 'node_modules', 'plugins', 'dist', 'build', 'out', 'coverage', 'generated', 'vendor']);
const digest = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
const sorted = (values: Iterable<string>): string[] => [...new Set(values)].sort();
const local = (root: string, file: string): string => {
    const path = relative(root, resolve(file)).replaceAll('\\', '/');
    return projectPath(path);
};

async function safeRead(root: string, path: string): Promise<Buffer> {
    const absolute = join(root, projectPath(path));
    const canonical = await realpath(absolute);
    if (canonical !== absolute || !canonical.startsWith(`${root}${sep}`) || !(await lstat(absolute)).isFile()) {
        throw new Error(`Unsafe architecture evidence input: ${path}`);
    }
    const handle = await open(absolute, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
        if (!(await handle.stat()).isFile() || await realpath(absolute) !== absolute) throw new Error(`Unsafe architecture evidence input: ${path}`);
        return await handle.readFile();
    } finally { await handle.close(); }
}

const DOCUMENT_POLICY_VERSION = 1;
const documentBudget = { 'modules-seed': 20000, 'readme-orientation': 12000 } as const;
const excludedDocument = (path: string): boolean =>
    /(^|\/)(docs\/tasks|test|tests|fixtures|benchmarks?|generated|dist|build|node_modules|\.dope)(\/|$)/i.test(path) ||
    /(?:^|\/)(?:AGENTS|BOOT|SKILL|PROMPT|(?:.*[-_.])?(?:evidence|validation|qualification|closeout|expected|reference|answer[-_]key))\.(?:md|mdx|txt)$/i.test(path);
function documentClass(path: string): DocumentSupport['class'] | undefined {
    if (path === 'MODULES.md') return 'modules-seed';
    if (path === 'README.md') return 'readme-orientation';
    if (excludedDocument(path)) return undefined;
    if (/(^|\/)README\.md$/i.test(path)) return 'package-readme';
    if (/(^|\/)(?:decisions?|adr)(\/|$)/i.test(path)) return 'decision';
    if (/(^|\/)(?:architecture|system-design)(\/|\.|$)/i.test(path)) return 'architecture';
    if (/(^|\/)(?:contracts?|protocols?|api|config)(\/|$|[-_.])/i.test(path)) return 'contract';
    if (/(^|\/)(?:deployment|runbooks?|operations|ops)(\/|$|[-_.])/i.test(path)) return 'operations';
    if (/(^|\/)(?:roadmap|planning|design)(\/|$|[-_.])/i.test(path)) return 'planning';
    if (/(^|\/)(?:CONTRIBUTING|DEVELOPMENT|GUIDE)\.md$/i.test(path)) return 'developer-guidance';
    return undefined;
}
export async function collectArchitectureDocuments(rootPath: string): Promise<DocumentSupport[]> {
    const root = await realpath(rootPath);
    const paths: string[] = [];
    const walk = async (directory: string): Promise<void> => {
        for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
            const path = local(root, join(directory, entry.name));
            if (entry.isDirectory() && !ignored.has(entry.name) && !excludedDocument(`${path}/`)) await walk(join(directory, entry.name));
            else if (entry.isFile() && /\.(?:md|mdx|txt)$/i.test(entry.name) && documentClass(path)) paths.push(path);
            else if (directory === root && entry.isSymbolicLink() && ['MODULES.md', 'README.md'].includes(entry.name))
                paths.push(path); // safeRead rejects links, including links outside the project.
        }
    };
    await walk(root);
    const selected = [...paths.filter(path => path === 'MODULES.md' || path === 'README.md'),
        ...paths.filter(path => path !== 'MODULES.md' && path !== 'README.md').slice(0, 24)];
    const documents: DocumentSupport[] = [];
    for (const path of selected) {
        const bytes = await safeRead(root, path);
        const classification = documentClass(path)!;
        const budget = classification === 'modules-seed' || classification === 'readme-orientation' ?
            documentBudget[classification] : 2000;
        const content = bytes.toString('utf8');
        documents.push({ path, class: classification, authority: 'Documented',
            status: classification === 'decision' && /\bStatus:\s*Accepted\b/i.test(content) ? 'accepted' : 'unknown',
            sha256: digest(bytes), bytes: bytes.length, truncated: content.length > budget,
            content: content.slice(0, budget) });
    }
    return documents;
}

export async function bootstrapDocumentPresence(rootPath: string): Promise<{ modules: boolean; readme: boolean }> {
    const root = await realpath(rootPath);
    const present = async (name: string): Promise<boolean> => {
        try { const entry = await lstat(join(root, name)); return entry.isFile() || entry.isSymbolicLink(); }
        catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
    };
    return { modules: await present('MODULES.md'), readme: await present('README.md') };
}

async function manifests(root: string): Promise<string[]> {
    const paths: string[] = [];
    const walk = async (directory: string): Promise<void> => {
        for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
            const path = join(directory, entry.name);
            if (entry.isDirectory() && !ignored.has(entry.name)) await walk(path);
            else if (entry.isFile() && entry.name === 'package.json') paths.push(local(root, path));
        }
    };
    await walk(root);
    return paths.sort();
}

function makeItem<T extends Omit<ArchitectureEvidenceItem, 'id'>>(item: T): ArchitectureEvidenceItem {
    return { id: digest(JSON.stringify(item)), ...item } as unknown as ArchitectureEvidenceItem;
}

function manifestFacts(path: string, data: unknown): ArchitectureEvidenceItem[] {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`Invalid package manifest: ${path}`);
    const manifest = data as Record<string, unknown>;
    const name = typeof manifest.name === 'string' && manifest.name.trim() ? manifest.name : path;
    const facts: ArchitectureEvidenceItem[] = [];
    const base = { path, sourceEvidenceIds: [] as string[] };
    facts.push(makeItem({ ...base, kind: 'topology', scope: 'package', name,
        ...(typeof manifest.version === 'string' ? { version: manifest.version } : {}) }));
    if (Array.isArray(manifest.workspaces) && manifest.workspaces.every(value => typeof value === 'string')) {
        facts.push(makeItem({ ...base, kind: 'topology', scope: 'workspace', name, workspaces: sorted(manifest.workspaces) }));
    }
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const) {
        const entries = manifest[field];
        if (!entries || typeof entries !== 'object' || Array.isArray(entries)) continue;
        for (const [dependency, version] of Object.entries(entries).sort(([a], [b]) => a.localeCompare(b))) {
            if (typeof version === 'string') facts.push(makeItem({ ...base, kind: 'configuration', signal: `${field}:${dependency}@${version}` }));
        }
    }
    for (const field of ['main', 'module', 'browser', 'types', 'bin', 'exports'] as const) {
        const value = manifest[field];
        if (typeof value === 'string') facts.push(makeItem({ ...base, kind: 'entrypoint', role: `${field}:${value}` }));
        else if (field === 'bin' && value && typeof value === 'object' && !Array.isArray(value)) {
            for (const [name, target] of Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) {
                if (typeof target === 'string') facts.push(makeItem({ ...base, kind: 'entrypoint', role: `bin:${name}:${target}` }));
            }
        }
    }
    const scripts = manifest.scripts;
    if (scripts && typeof scripts === 'object' && !Array.isArray(scripts)) {
        for (const [name, command] of Object.entries(scripts).sort(([a], [b]) => a.localeCompare(b))) {
            if (/^(start|serve|dev|build|package|test)(:|$)/.test(name) && typeof command === 'string') {
                facts.push(makeItem({ ...base, kind: 'entrypoint', role: `script:${name}:${command}` }));
            }
        }
    }
    if (typeof manifest.dependencies === 'object' && manifest.dependencies && '@theia/core' in manifest.dependencies &&
        Array.isArray(manifest.theiaExtensions)) {
        for (const extension of manifest.theiaExtensions) {
            if (!extension || typeof extension !== 'object' || Array.isArray(extension)) continue;
            for (const role of ['frontend', 'backend'] as const) {
                const target = (extension as Record<string, unknown>)[role];
                if (typeof target === 'string' && target.trim()) facts.push(makeItem({ ...base, kind: 'framework',
                    framework: 'theia/inversify', producer: '@dope/code-analysis/theia-manifest', producerVersion: '1',
                    concept: 'manifest-extension', name: `${role}:${target}`, role, target }));
            }
        }
    }
    return facts;
}

function frameworkFacts(result: CodeAnalysisResult, detail = false): ArchitectureEvidenceItem[] {
    const evidence = new Map(result.evidence.map(item => [item.id, item]));
    return (result.frameworkFacts ?? []).filter(fact => !!fact.detail === detail).map(({ detail: _detail, ...fact }) => {
        projectPath(fact.path);
        if (!fact.sourceEvidenceIds.length || fact.sourceEvidenceIds.some(id => {
            const source = evidence.get(id);
            return source?.class !== 'framework' || source.path !== fact.path || source.producer !== fact.producer ||
                source.producerVersion !== fact.producerVersion || !source.span;
        })) throw new Error(`Invalid framework provenance: ${fact.path}`);
        return makeItem(fact);
    });
}

function semanticFacts(result: CodeAnalysisResult, all = false): ArchitectureEvidenceItem[] {
    const nodes = new Map(result.nodes.map(node => [node.id, node]));
    const facts: ArchitectureEvidenceItem[] = [];
    const exports = new Map<string, string[]>();
    for (const edge of result.relationships) if (edge.kind === 'exports') {
        exports.set(edge.targetId, [...(exports.get(edge.targetId) ?? []), ...edge.evidenceIds]);
    }
    const publicIds = new Set(exports.keys());
    for (const node of result.nodes) {
        if (node.codeKind !== 'symbol' || !node.analyzerKind || (!all && !publicIds.has(node.id))) continue;
        facts.push(makeItem({ kind: 'semantic', path: node.path, sourceEvidenceIds: sorted([...node.evidenceIds, ...(exports.get(node.id) ?? [])]),
            symbol: node.name, relation: `${node.analyzerKind}${publicIds.has(node.id) ? ':exported' : ''}` }));
    }
    for (const edge of result.relationships) {
        if (edge.kind === 'contains' || edge.kind === 'owns') continue;
        const source = nodes.get(edge.sourceId) as CodeEntityNode | undefined;
        const target = nodes.get(edge.targetId) as CodeEntityNode | undefined;
        if (!source || !target || !all && edge.kind === 'references') continue;
        if (edge.kind === 'exports' && target.codeKind === 'symbol') continue; // represented by exported semantic facts
        facts.push(makeItem({ kind: 'dependency', path: source.path, targetPath: target.path, relation: edge.kind,
            sourceEvidenceIds: sorted(edge.evidenceIds), relationshipIds: [edge.id] }));
    }
    return facts;
}

/** Collect source-backed facts without reading declarations or publishing a Physical Map. */
export async function collectArchitectureEvidence(rootPath: string, analyzer: IndexAnalyzer): Promise<ArchitectureEvidencePacket> {
    const root = await realpath(rootPath);
    if (!(await stat(root)).isDirectory()) throw new Error('Architecture evidence requires a folder');
    const inputPaths = analyzer.inputPaths?.(root);
    const manifestPaths = await manifests(root);
    const inputs = sorted([
        ...manifestPaths,
        ...(inputPaths?.sources ?? []).map(path => local(root, path)),
        ...(inputPaths?.configs ?? []).map(path => local(root, path)).filter(path => !path.startsWith('.dope/')),
    ]);
    const inputBytes = new Map<string, Buffer>();
    for (const path of inputs) inputBytes.set(path, await safeRead(root, path));
    const result = await analyzer.analyze(root);
    // The analyzer's result is the final list of semantic inputs, including analyzers without inputPaths().
    for (const path of sorted([
        ...result.projects.flatMap(project => [project.configPath, ...project.sourcePaths]),
        ...result.evidence.flatMap(item => item.path ? [item.path] : []),
    ])) {
        if (!inputBytes.has(path)) inputBytes.set(path, await safeRead(root, path));
    }
    const items: ArchitectureEvidenceItem[] = [];
    for (const path of manifestPaths) items.push(...manifestFacts(path, JSON.parse(inputBytes.get(path)!.toString('utf8'))));
    for (const project of result.projects) {
        projectPath(project.configPath);
        for (const path of project.sourcePaths) projectPath(path);
        items.push(makeItem({ kind: 'configuration', path: project.configPath, sourceEvidenceIds: [],
            signal: 'configured-ts-js-project', sourcePaths: sorted(project.sourcePaths) }));
    }
    items.push(...semanticFacts(result));
    items.push(...frameworkFacts(result));
    const documents = await collectArchitectureDocuments(root);
    const sourceFingerprint = digest(JSON.stringify([...inputBytes].sort(([a], [b]) => a.localeCompare(b)).map(([path, bytes]) => [path, digest(bytes)])));
    const ordered = [...new Map(items.map(item => [item.id, item])).values()].sort((a, b) => a.id.localeCompare(b.id));
    const packet: ArchitectureEvidencePacket = { schemaVersion: 1, sourceFingerprint,
        inputFingerprint: digest(JSON.stringify([sourceFingerprint, ordered, DOCUMENT_POLICY_VERSION, documents])), items: ordered, documents };
    validateArchitectureEvidencePacket(packet);
    return packet;
}

/** Bounded refinement over packet references; it cannot address arbitrary filesystem paths. */
export async function refineArchitectureEvidence(root: string, analyzer: IndexAnalyzer, packet: ArchitectureEvidencePacket,
    requests: ArchitectureEvidenceRequest[]): Promise<ArchitectureEvidencePacket> {
    validateArchitectureEvidencePacket(packet);
    if (!Array.isArray(requests) || requests.length > 5) throw new Error('Invalid architecture evidence requests');
    const current = await collectArchitectureEvidence(root, analyzer);
    if (!packet.sourceFingerprint || current.sourceFingerprint !== packet.sourceFingerprint) throw new Error('Stale architecture evidence packet');
    const byId = new Map(packet.items.map(item => [item.id, item]));
    const paths = new Set<string>();
    for (const request of requests) {
        if (!request || !['topology', 'configuration', 'entrypoint', 'dependency', 'semantic', 'framework'].includes(request.kind) ||
            !Array.isArray(request.targets) || !request.targets.length || request.targets.length > 5 ||
            typeof request.reason !== 'string' || !request.reason.trim()) throw new Error('Invalid architecture evidence request');
        for (const target of request.targets) {
            const item = byId.get(target) ?? packet.items.find(item => item.path === target ||
                item.kind === 'configuration' && item.sourcePaths?.includes(target));
            if (!item) throw new Error('Unknown architecture evidence target');
            paths.add(item.kind === 'configuration' && item.sourcePaths?.includes(target) ? target : item.path);
        }
    }
    if (paths.size > 20) throw new Error('Too many architecture evidence targets');
    const result = await analyzer.analyze(await realpath(root));
    const kinds = new Set(requests.map(request => request.kind));
    const candidates = [...semanticFacts(result, true), ...frameworkFacts(result, true)].filter(item => kinds.has(item.kind) &&
        (paths.has(item.path) || item.kind === 'dependency' && paths.has(item.targetPath)));
    const additions = candidates.filter(item => !byId.has(item.id)).slice(0, 100);
    const items = [...new Map([...packet.items, ...additions].map(item => [item.id, item])).values()].sort((a, b) => a.id.localeCompare(b.id));
    const expanded: ArchitectureEvidencePacket = { schemaVersion: 1, sourceFingerprint: current.sourceFingerprint,
        inputFingerprint: digest(JSON.stringify([current.sourceFingerprint, items, DOCUMENT_POLICY_VERSION, current.documents])),
        items, documents: current.documents };
    validateArchitectureEvidencePacket(expanded);
    return expanded;
}
