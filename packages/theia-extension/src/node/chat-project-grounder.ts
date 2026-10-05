import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, readdir, realpath, stat } from 'node:fs/promises';
import { isAbsolute, join, relative } from 'node:path';
import type { ChatContextKind, ChatContextRef } from '@dope/chat';
import { queryStaticFlow } from '@dope/software-map';
import { readArchitecture } from '@dope/code-analysis/lib/node/architecture-file';
import { readInitialization } from '@dope/code-analysis/lib/node/smap-initialization-file';
import { SoftwareMapIndex } from '@dope/code-analysis/lib/node/software-map-index';

/** Limits apply to each primitive. Search counts examined entries, including skipped entries. */
export const GROUNDING_LIMITS = { entries: 60, visited: 2000, depth: 6, results: 24,
    fileBytes: 64 * 1024, scannedBytes: 8 * 1024 * 1024, totalBytes: 128 * 1024, matchesPerFile: 3 } as const;
const skip = new Set(['.git', '.dope', '.theia', 'node_modules', 'dist', 'build', 'out', 'coverage',
    'generated', 'vendor', '.next', '.cache', 'target']);
const cmp = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT';

export interface GroundingDiagnostic { kind: 'unavailable' | 'omitted' | 'truncated' | 'rejected'; source: string; message: string }
export interface GroundingBlock { text: string; ref: ChatContextRef }
export interface GroundingResult { blocks: GroundingBlock[]; diagnostics: GroundingDiagnostic[] }

/** Public path syntax is deliberately narrower than the host filesystem's syntax. */
function safePath(value: string): string {
    if (typeof value !== 'string' || value.length > 512 || value !== value.trim() ||
        value.startsWith('/') || isAbsolute(value) || value.includes('\\') || value.includes(':') ||
        /[\p{Cc}\p{Cf}]/u.test(value) ||
        (value !== '' && value.split('/').some(part => !part || part === '.' || part === '..')) ||
        value.split('/').includes('.dope')) throw new Error('Unsafe project-relative path');
    return value;
}
function safeQuery(value: string): string {
    if (typeof value !== 'string' || !value.trim() || value.length > 120 || /[\p{Cc}\p{Cf}]/u.test(value))
        throw new Error('Invalid grounding query');
    return value.trim();
}

export class ChatProjectGrounder {
    constructor(private readonly index: SoftwareMapIndex) {}

    private async root(root: string): Promise<string> {
        const canonical = await realpath(root);
        if (!(await stat(canonical)).isDirectory()) throw new Error('Project root unavailable');
        return canonical;
    }
    private async target(root: string, path: string): Promise<string> {
        safePath(path);
        const canonical = await this.root(root);
        const actual = await realpath(join(canonical, path));
        const within = relative(canonical, actual);
        if (within === '..' || within.startsWith('../') || isAbsolute(within) ||
            within.split('/').includes('.dope')) throw new Error('Project path escapes or enters protected state');
        return actual;
    }
    private ref(root: string, kind: ChatContextKind, id: string, label: string, text: string,
        map?: { projectId: string; generation: number }): ChatContextRef {
        return { schemaVersion: 1, kind, id, label, origin: 'automatic',
            estimatedTokens: Math.ceil(Buffer.byteLength(text, 'utf8') / 3) + 4,
            includedBytes: Buffer.byteLength(text, 'utf8'), contentHash: digest(text),
            projectId: map?.projectId ?? digest(root), ...(map ? { generation: map.generation } : {}) };
    }
    private block(root: string, kind: ChatContextKind, id: string, label: string, text: string,
        map?: { projectId: string; generation: number }): GroundingBlock {
        return { text, ref: this.ref(root, kind, id, label, text, map) };
    }
    private limitedBlock(root: string, kind: ChatContextKind, id: string, label: string, text: string,
        diagnostics: GroundingDiagnostic[], map?: { projectId: string; generation: number }): GroundingBlock {
        if (Buffer.byteLength(text, 'utf8') > GROUNDING_LIMITS.totalBytes) {
            text = Buffer.from(text, 'utf8').subarray(0, GROUNDING_LIMITS.totalBytes).toString('utf8').replace(/\uFFFD+$/, '');
            diagnostics.push({ kind: 'truncated', source: kind, message: `Evidence limited to ${GROUNDING_LIMITS.totalBytes} bytes` });
        }
        return this.block(root, kind, id, label, text, map);
    }
    private async read(root: string, path: string): Promise<{ text: string; truncated: boolean }> {
        const actual = await this.target(root, path);
        const info = await stat(actual);
        if (!info.isFile()) throw new Error('Project path is not a file');
        const handle = await open(actual, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
            const opened = await handle.stat();
            if (!opened.isFile() || opened.dev !== info.dev || opened.ino !== info.ino) throw new Error('Project file changed during read');
            const bytes = Buffer.alloc(Math.min(info.size, GROUNDING_LIMITS.fileBytes + 1));
            const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
            const data = bytes.subarray(0, bytesRead);
            if (data.includes(0)) throw new Error('Binary project file unavailable');
            const after = await handle.stat();
            if (await realpath(actual) !== actual || after.ino !== opened.ino ||
                after.size !== opened.size || after.mtimeMs !== opened.mtimeMs)
                throw new Error('Project file changed during read');
            return { text: data.subarray(0, GROUNDING_LIMITS.fileBytes).toString('utf8').replace(/\uFFFD+$/, ''),
                truncated: info.size > GROUNDING_LIMITS.fileBytes };
        } finally { await handle.close(); }
    }
    async readFile(root: string, path: string): Promise<GroundingResult> {
        const canonical = await this.root(root);
        safePath(path);
        try {
            const { text, truncated } = await this.read(canonical, path);
            return { blocks: [this.block(canonical, 'file', path, path, text)], diagnostics: truncated ?
                [{ kind: 'truncated', source: path, message: `File limited to ${GROUNDING_LIMITS.fileBytes} bytes` }] : [] };
        } catch (error) {
            if (!missing(error)) throw error;
            return { blocks: [this.block(canonical, 'file', path, path, `Project file ${path}: absent`)], diagnostics: [] };
        }
    }
    async listDirectory(root: string, path = ''): Promise<GroundingResult> {
        const canonical = await this.root(root);
        safePath(path);
        let actual: string;
        try { actual = await this.target(canonical, path); }
        catch (error) {
            if (!missing(error)) throw error;
            return { blocks: [this.block(canonical, 'directory', path || '.', path || '.', `Project directory ${path || '.'}: absent`)], diagnostics: [] };
        }
        if (!(await stat(actual)).isDirectory()) throw new Error('Project path is not a directory');
        const entries = (await readdir(actual, { withFileTypes: true })).sort((a, b) => cmp(a.name, b.name));
        const visible = entries.filter(entry => entry.name !== '.dope' &&
            !/[\p{Cc}\p{Cf}]/u.test(entry.name)).slice(0, GROUNDING_LIMITS.entries);
        const lines = await Promise.all(visible.map(async entry => {
            if (entry.isSymbolicLink()) {
                try { await this.target(canonical, path ? `${path}/${entry.name}` : entry.name); }
                catch { return `${entry.name} [symlink unavailable]`; }
            }
            return `${entry.name}${entry.isDirectory() ? '/' : ''}${skip.has(entry.name) ? ' [generic search skipped]' : ''}`;
        }));
        const omitted = entries.length - visible.length;
        return { blocks: [this.block(canonical, 'directory', path || '.', path || '.',
            `Project directory ${path || '.'}: ${lines.length ? lines.join('\n') : '(empty)'}${omitted ? `\n${omitted} entries omitted` : ''}`)],
            diagnostics: omitted ? [{ kind: 'truncated', source: path || '.', message: `${omitted} directory entries omitted` }] : [] };
    }
    private async walk(root: string, visit: (path: string, isFile: boolean) => Promise<boolean>): Promise<GroundingDiagnostic[]> {
        const queue: { path: string; depth: number }[] = [{ path: '', depth: 0 }];
        let visited = 0, omitted = 0, stopped = false;
        while (queue.length && !stopped) {
            const current = queue.shift()!;
            const entries = (await readdir(join(root, current.path), { withFileTypes: true })).sort((a, b) => cmp(a.name, b.name));
            for (const entry of entries) {
                if (++visited > GROUNDING_LIMITS.visited) { stopped = true; break; }
                const path = current.path ? `${current.path}/${entry.name}` : entry.name;
                if (skip.has(entry.name) || entry.isSymbolicLink() ||
                    /[\p{Cc}\p{Cf}]/u.test(entry.name)) { omitted++; continue; }
                if (entry.isDirectory()) {
                    if (!await visit(path, false)) { stopped = true; break; }
                    if (current.depth < GROUNDING_LIMITS.depth) queue.push({ path, depth: current.depth + 1 });
                    else omitted++;
                } else if (entry.isFile() && !await visit(path, true)) { stopped = true; break; }
            }
        }
        return stopped || omitted ? [{ kind: stopped ? 'truncated' : 'omitted', source: '.',
            message: `Generic search examined ${Math.min(visited, GROUNDING_LIMITS.visited)} entries; ${omitted} skipped; ${queue.length} directories or remaining entries omitted` }] : [];
    }
    async searchPaths(root: string, query: string): Promise<GroundingResult> {
        const canonical = await this.root(root), needle = safeQuery(query).toLowerCase();
        const paths: string[] = [];
        const diagnostics = await this.walk(canonical, async path => {
            if (path.toLowerCase().includes(needle)) paths.push(path);
            return paths.length < GROUNDING_LIMITS.results;
        });
        paths.sort(cmp);
        return { blocks: [this.block(canonical, 'path-search', needle, `Paths matching ${needle}`,
            `Project path search ${JSON.stringify(needle)}: ${paths.length ? paths.join('\n') : '(no matches within search bounds)'}`)], diagnostics };
    }
    async searchText(root: string, query: string): Promise<GroundingResult> {
        const canonical = await this.root(root), needle = safeQuery(query).toLowerCase();
        const matches: string[] = [];
        let returnedBytes = 0, scannedBytes = 0, unreadable = 0, clipped = 0;
        const diagnostics = await this.walk(canonical, async (path, isFile) => {
            if (!isFile) return true;
            try {
                const { text, truncated } = await this.read(canonical, path);
                scannedBytes += Buffer.byteLength(text);
                if (truncated) clipped++;
                const lines = text.split(/\r?\n/);
                let perFile = 0;
                for (let i = 0; i < lines.length && perFile < GROUNDING_LIMITS.matchesPerFile; i++) {
                    if (!lines[i].toLowerCase().includes(needle)) continue;
                    const match = `${path}:${i + 1}: ${lines[i].slice(0, 240)}`;
                    if (returnedBytes + Buffer.byteLength(match) > GROUNDING_LIMITS.totalBytes) return false;
                    matches.push(match); returnedBytes += Buffer.byteLength(match); perFile++;
                    if (matches.length >= GROUNDING_LIMITS.results) return false;
                }
            } catch { unreadable++; }
            return scannedBytes < GROUNDING_LIMITS.scannedBytes;
        });
        if (clipped || unreadable) diagnostics.push({ kind: 'omitted', source: '.',
            message: `${clipped} files limited to ${GROUNDING_LIMITS.fileBytes} bytes; ${unreadable} unreadable files skipped` });
        matches.sort(cmp);
        return { blocks: [this.block(canonical, 'text-search', needle, `Text matching ${needle}`,
            `Project text search ${JSON.stringify(needle)}: ${matches.length ? matches.join('\n') : '(no matches within search bounds)'}`)], diagnostics };
    }
    private async currentMap(root: string) {
        const snapshot = this.index.snapshot(root), status = this.index.status(root);
        if (!snapshot || status.state !== 'ready' || status.generation !== snapshot.metadata.generation ||
            status.inputFingerprint !== snapshot.metadata.inputFingerprint || !await this.index.inputsCurrent(root) ||
            this.index.status(root).generation !== status.generation) return undefined;
        return snapshot;
    }
    private async architecture(root: string, question: string): Promise<GroundingResult> {
        const state = await readInitialization(root);
        if (!state.initialized) return { blocks: [], diagnostics: [{ kind: 'unavailable', source: 'architecture', message: 'Canonical Architecture unavailable' }] };
        const { architecture } = await readArchitecture(root);
        const all = architecture.systems.flatMap(system => [system, ...system.subsystems.flatMap(subsystem =>
            [subsystem, ...(subsystem.components ?? [])])]);
        const words = question.toLowerCase();
        const named = all.filter(item => words.includes(item.name.toLowerCase()));
        const chosen = (named.length ? named : all).slice(0, 12);
        const text = JSON.stringify(chosen.map(item => ({ id: item.id, name: item.name, purpose: item.purpose })));
        const diagnostics: GroundingDiagnostic[] = all.length > chosen.length ?
            [{ kind: 'truncated', source: 'architecture', message: `${all.length - chosen.length} Architecture entities omitted` }] : [];
        return { blocks: [this.limitedBlock(root, 'architecture', named[0]?.id ?? 'architecture:overview',
            'Canonical Architecture', text, diagnostics)], diagnostics };
    }
    private async map(root: string, question: string, flow: boolean): Promise<GroundingResult> {
        const kind = flow ? 'flow' : 'physical-map';
        let snapshot;
        try { snapshot = await this.currentMap(root); }
        catch { /* A changing or unreadable input makes the index unavailable for this turn. */ }
        if (!snapshot) return { blocks: [], diagnostics: [{ kind: 'unavailable', source: kind, message: 'Current Physical Map unavailable; analyze again' }] };
        const metadata = { projectId: snapshot.metadata.projectId, generation: snapshot.metadata.generation };
        const selected = snapshot.nodes.find(node => question.toLowerCase().includes(node.name.toLowerCase()) && node.name.length > 2);
        if (flow) {
            const result = queryStaticFlow(snapshot, { ...metadata, selectedId: selected?.id, maxNodes: 16, maxFacts: 12, maxHops: 8 });
            const ids = new Set(result.facts.flatMap(fact => fact.evidenceIds));
            const evidence = snapshot.evidence.filter(item => ids.has(item.id)).slice(0, 20);
            const text = JSON.stringify({ ...result, evidence });
            const diagnostics: GroundingDiagnostic[] = result.truncated || ids.size > evidence.length ?
                [{ kind: 'truncated', source: kind, message: 'Flow query or evidence truncated' }] : [];
            return { blocks: [this.limitedBlock(root, kind, selected?.id ?? 'flow:overview',
                'Current static Flow', text, diagnostics, metadata)], diagnostics };
        }
        const nodes = (selected ? [selected] : snapshot.nodes.slice().sort((a, b) => cmp(a.id, b.id)).slice(0, 12));
        const ids = new Set(nodes.flatMap(node => node.evidenceIds));
        const evidence = snapshot.evidence.filter(item => ids.has(item.id)).slice(0, 20);
        const diagnostics: GroundingDiagnostic[] = snapshot.nodes.length > nodes.length || ids.size > evidence.length ?
            [{ kind: 'truncated', source: kind, message: 'Physical Map nodes or evidence truncated' }] : [];
        return { blocks: [this.limitedBlock(root, kind, selected?.id ?? 'physical-map:overview', 'Current Physical Map',
            JSON.stringify({ generation: metadata.generation, completeness: snapshot.metadata.analysis.completeness,
                nodes, evidence, nodeCount: snapshot.nodes.length }), diagnostics, metadata)], diagnostics };
    }
    /** Selection is lexical and deterministic; no model or manual allowedSources list participates. */
    async ground(root: string, question: string): Promise<GroundingResult> {
        const canonical = await this.root(root);
        const blocks: GroundingBlock[] = [], diagnostics: GroundingDiagnostic[] = [];
        const add = (result: GroundingResult) => { blocks.push(...result.blocks); diagnostics.push(...result.diagnostics); };
        let architecture = false, map = false;
        try { architecture = (await readInitialization(canonical)).initialized; }
        catch { diagnostics.push({ kind: 'unavailable', source: 'architecture', message: 'Canonical Architecture unavailable' }); }
        try { map = !!await this.currentMap(canonical); }
        catch { diagnostics.push({ kind: 'unavailable', source: 'physical-map', message: 'Current Physical Map unavailable' }); }
        const status = this.index.status(canonical);
        blocks.push(this.block(canonical, 'project-orientation', 'project:orientation', 'Project orientation',
            `Attached project. Architecture: ${architecture ? 'available' : 'unavailable'}. Physical Map: ${map ? `current generation ${status.generation}` : 'unavailable'}.`));
        const finish = (): GroundingResult => {
            let remaining = GROUNDING_LIMITS.totalBytes;
            const included = blocks.filter(block => {
                const bytes = block.ref.includedBytes ?? Buffer.byteLength(block.text);
                if (bytes > remaining) {
                    diagnostics.push({ kind: 'omitted', source: `${block.ref.kind}:${block.ref.id}`,
                        message: 'Automatic grounding total byte bound reached' });
                    return false;
                }
                remaining -= bytes;
                return true;
            });
            return { blocks: included, diagnostics };
        };
        const q = question.trim();
        if (!q) return finish();
        const candidates = [...q.matchAll(/(?:^|[\s'"`(])([^\s'"`),?!]+)/gu)].map(match => match[1]);
        const path = candidates.find(value => value.includes('/') || /\.[a-z\d]{1,8}$/i.test(value));
        const explicit = path?.replace(/\/$/, '');
        if (explicit) {
            try {
                safePath(explicit);
                if (/\b(?:list|inside|contents|in|under|directory|folder)\b/i.test(q) || path?.endsWith('/'))
                    add(await this.listDirectory(canonical, explicit));
                else if (/\b(?:exist|there)\b/i.test(q)) {
                    try { const target = await this.target(canonical, explicit); add((await stat(target)).isDirectory() ?
                        await this.listDirectory(canonical, explicit) : await this.readFile(canonical, explicit)); }
                    catch (error) { if (!missing(error)) throw error; add(await this.readFile(canonical, explicit)); }
                } else add(await this.readFile(canonical, explicit));
            } catch { diagnostics.push({ kind: 'rejected', source: explicit, message: 'Requested project path is unsafe or unavailable' }); }
        } else if (/\b(?:repository root|project root|root directory|root folder)\b/i.test(q)) add(await this.listDirectory(canonical));
        if (/\b(?:architecture|subsystem|component|system)\b/i.test(q)) {
            try { add(await this.architecture(canonical, q)); }
            catch { diagnostics.push({ kind: 'unavailable', source: 'architecture', message: 'Canonical Architecture unavailable' }); }
        }
        if (/\b(?:physical map|software map|smap)\b/i.test(q)) add(await this.map(canonical, q, false));
        if (/\b(?:flow|trace|execution path)\b/i.test(q)) add(await this.map(canonical, q, true));
        if (/\b(?:where|find|locate|implemented|implementation|search)\b/i.test(q) && !explicit) {
            const terms = q.toLowerCase().replace(/[^\p{L}\p{N}_ -]/gu, ' ').split(/\s+/).filter(word =>
                word.length > 2 && !new Set(['where', 'find', 'locate', 'implemented', 'implementation', 'search',
                    'the', 'for', 'is', 'are', 'code', 'that', 'does', 'this', 'please']).has(word));
            if (terms.length) {
                add(await this.searchPaths(canonical, terms[0]));
                add(await this.searchText(canonical, terms[0]));
            }
        }
        return finish();
    }
}
