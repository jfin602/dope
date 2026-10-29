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
const privateName = (name: string) => name.startsWith('.') || /^(?:secrets?|credentials?|private)(?:[._-]|$)/i.test(name) ||
    /(?:\.pem|\.key|\.p12|\.pfx)$/i.test(name);
const cmp = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT';

export interface GroundingDiagnostic { kind: 'unavailable' | 'omitted' | 'truncated' | 'rejected'; source: string; message: string }
export interface GroundingBlock { text: string; ref: ChatContextRef }
export interface GroundingResult { blocks: GroundingBlock[]; diagnostics: GroundingDiagnostic[] }
export type InvestigationQuery = { kind: 'paths' | 'text'; query: string } |
    { kind: 'read' | 'directory'; path: string } | { kind: 'architecture' | 'physical-map'; query: string };
export interface InvestigationRequest { queries: InvestigationQuery[]; projectId?: string; signal?: AbortSignal }

/** Public path syntax is deliberately narrower than the host filesystem's syntax. */
function safePath(value: string): string {
    if (typeof value !== 'string' || value.length > 512 || value !== value.trim() ||
        value.startsWith('/') || isAbsolute(value) || value.includes('\\') || value.includes(':') ||
        /[\p{Cc}\p{Cf}]/u.test(value) ||
        (value !== '' && value.split('/').some(part => !part || part === '.' || part === '..')) ||
        value.split('/').some(part => skip.has(part) || privateName(part))) throw new Error('Unsafe project-relative path');
    return value;
}
function safeQuery(value: string): string {
    if (typeof value !== 'string' || !value.trim() || value.length > 120 || /[\p{Cc}\p{Cf}]/u.test(value))
        throw new Error('Invalid grounding query');
    return value.trim();
}
/** Extract only user-written project paths. Sentence punctuation is outside the path. */
function explicitPaths(question: string): { path: string; directorySyntax: boolean; before: string }[] {
    return [...question.matchAll(/(?:^|[\s'"`([{])([^\s'"`()\[\]{}]+)/gu)].flatMap(match => {
        const raw = match[1];
        const path = raw.replace(/[;,:!?]+$/u, '').replace(/\.$/u, '');
        if (!path || !(path.includes('/') || /\.[a-z\d]{1,8}$/i.test(path))) return [];
        const before = question.slice(Math.max(0, match.index! - 48), match.index!);
        const after = question.slice(match.index! + match[0].length, match.index! + match[0].length + 32);
        // A dotted package name is not a request to inspect a same-named project file.
        // Explicit relative paths retain their existing behavior; bare filenames need file intent.
        if (!path.includes('/') &&
            !/\b(?:read|inspect|open|check|view|show|find|locate|edit|examine)(?:\s+(?:the|this|my|project|workspace|source|file|named|called)){0,3}$/i.test(before) &&
            !/^[\s'"`)]*(?:file|exists?|present)\b/i.test(after)) return [];
        return [{ path: path.replace(/\/$/u, ''), directorySyntax: path.endsWith('/'),
            before }];
    });
}
const implementationSource = (path: string) =>
    /^(?:(?:packages|apps)\/.+\/src\/|src\/|test\/).+\.[cm]?[jt]sx?$/.test(path);
const structureChanged = (question: string) =>
    /\b(?:i|we|i've|we've)\s+(?:just\s+)?(?:created|added|made|set\s+up|put\s+in|started|changed|updated)\b/i.test(question) &&
    /\b(?:structure|scaffold|files?|folders?|directories|source|src|project|setup|manifest|tests?)\b/i.test(question);

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
        let cursor = canonical;
        for (const part of path.split('/').filter(Boolean)) {
            cursor = join(cursor, part);
            if ((await lstat(cursor)).isSymbolicLink()) throw new Error('Project path escapes via symlink');
        }
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
            const block = this.block(canonical, 'file', path, path, text);
            if (!truncated) block.ref.sourceHash = block.ref.contentHash;
            return { blocks: [block], diagnostics: truncated ?
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
        const visible = entries.filter(entry => !privateName(entry.name) && !skip.has(entry.name) &&
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
    /** Fresh, small snapshot for ordinary Chat after the developer changes the workspace. */
    private async currentStructure(root: string): Promise<GroundingResult> {
        const blocks: GroundingBlock[] = [], diagnostics: GroundingDiagnostic[] = [];
        const add = (result: GroundingResult) => { blocks.push(...result.blocks); diagnostics.push(...result.diagnostics); };
        add(await this.listDirectory(root));
        const entries = (await readdir(root, { withFileTypes: true })).sort((a, b) => cmp(a.name, b.name))
            .filter(entry => !privateName(entry.name) && !skip.has(entry.name) &&
                !/[\p{Cc}\p{Cf}]/u.test(entry.name) && !entry.isSymbolicLink())
            .slice(0, GROUNDING_LIMITS.entries);
        const files: string[] = [];
        for (const name of ['package.json', 'index.html', 'tsconfig.json', 'vite.config.ts'])
            if (entries.some(entry => entry.name === name && entry.isFile())) files.push(name);
        const directories = ['src', 'test', 'tests', 'app'].filter(name =>
            entries.some(entry => entry.name === name && entry.isDirectory())).slice(0, 2);
        let nestedListed = false;
        for (const directory of directories) {
            try {
                add(await this.listDirectory(root, directory));
                const children = (await readdir(await this.target(root, directory), { withFileTypes: true }))
                    .sort((a, b) => cmp(a.name, b.name)).slice(0, GROUNDING_LIMITS.entries);
                for (const child of children) {
                    if (directory === 'src' && !nestedListed && child.isDirectory() &&
                        !privateName(child.name) && !skip.has(child.name)) {
                        const nested = `${directory}/${child.name}`;
                        add(await this.listDirectory(root, nested));
                        nestedListed = true;
                        const nestedFiles = (await readdir(await this.target(root, nested), { withFileTypes: true }))
                            .sort((a, b) => cmp(a.name, b.name)).slice(0, GROUNDING_LIMITS.entries);
                        for (const file of nestedFiles) {
                            if (file.isFile() && !privateName(file.name) &&
                                /\.(?:[cm]?[jt]sx?|html|css|json)$/i.test(file.name)) {
                                files.push(`${nested}/${file.name}`);
                                break;
                            }
                        }
                    }
                    if (!child.isFile() || privateName(child.name) || skip.has(child.name) ||
                        !/\.(?:[cm]?[jt]sx?|html|css|json)$/i.test(child.name)) continue;
                    files.push(`${directory}/${child.name}`);
                    if (files.length >= 4) break;
                }
            } catch {
                diagnostics.push({ kind: 'unavailable', source: directory,
                    message: `Current ${directory} directory could not be inspected` });
            }
        }
        for (const path of [...new Set(files)].slice(0, 4)) {
            try {
                const result = await this.readFile(root, path);
                const file = result.blocks[0];
                if (file.text === `Project file ${path}: absent`) {
                    diagnostics.push({ kind: 'unavailable', source: path,
                        message: 'File changed or disappeared during current workspace inspection' });
                    continue;
                }
                const excerpt = Buffer.from(file.text, 'utf8').subarray(0, 2048).toString('utf8').replace(/\uFFFD+$/, '');
                const block = this.block(root, 'file', path, path, excerpt);
                if (file.ref.sourceHash && excerpt === file.text) block.ref.sourceHash = file.ref.sourceHash;
                blocks.push(block);
                diagnostics.push(...result.diagnostics);
                if (excerpt !== file.text) diagnostics.push({ kind: 'truncated', source: path,
                    message: 'Current file excerpt limited to 2048 bytes' });
            } catch {
                diagnostics.push({ kind: 'unavailable', source: path,
                    message: 'Current file read blocked or changed during inspection' });
            }
        }
        return { blocks, diagnostics };
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
                if (skip.has(entry.name) || privateName(entry.name) || entry.isSymbolicLink() ||
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
    async searchPaths(root: string, query: string, hint = ''): Promise<GroundingResult & { matchedPaths: string[] }> {
        const canonical = await this.root(root), needle = safeQuery(query).toLowerCase();
        const paths: string[] = [];
        const diagnostics = await this.walk(canonical, async path => {
            if (path.toLowerCase().includes(needle)) paths.push(path);
            return true;
        });
        const rank = (path: string) => {
            if (hint === 'persistence' && /(?:repository|store|persistence)/i.test(path) &&
                /^packages\/.+\/src\/.+\.[cm]?[jt]sx?$/.test(path)) return 0;
            if (/^src\/.+\.[cm]?[jt]sx?$/.test(path)) return 1;
            if (/^(?:packages|apps)\/.+\/src\/.+\.[cm]?[jt]sx?$/.test(path)) return 1;
            if (/^(?:packages|apps)\//.test(path)) return 2;
            if (/^test\//.test(path)) return 3;
            return 4;
        };
        paths.sort((a, b) => rank(a) - rank(b) || cmp(a, b));
        if (paths.length > GROUNDING_LIMITS.results) diagnostics.push({ kind: 'truncated', source: '.',
            message: `${paths.length - GROUNDING_LIMITS.results} matching paths omitted` });
        const matchedPaths = paths.slice(0, GROUNDING_LIMITS.results);
        return { blocks: [this.block(canonical, 'path-search', needle, `Paths matching ${needle}`,
            `Project path search ${JSON.stringify(needle)}: ${matchedPaths.length ? matchedPaths.join('\n') : '(no matches within search bounds)'}`)],
            diagnostics, matchedPaths };
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
    /** A bounded, app-owned read interface. No model-supplied command or absolute path is accepted. */
    async investigate(root: string, request: InvestigationRequest): Promise<GroundingResult> {
        const canonical = await this.root(root);
        if (request.projectId !== undefined && request.projectId !== digest(canonical))
            throw new Error('Foreign investigation project');
        if (!Array.isArray(request.queries) || request.queries.length > 6)
            throw new Error('Investigation query limit exceeded');
        const blocks: GroundingBlock[] = [], diagnostics: GroundingDiagnostic[] = [];
        let reads = 0, searches = 0, remaining = 32 * 1024;
        for (const query of request.queries) {
            if (request.signal?.aborted) throw new Error('Investigation cancelled');
            if (!query || typeof query !== 'object') throw new Error('Invalid investigation query');
            if (query.kind === 'read') {
                if (++reads > 5) throw new Error('Investigation read limit exceeded');
                safePath(query.path);
            } else if (query.kind === 'directory') safePath(query.path);
            else if (query.kind === 'paths' || query.kind === 'text') {
                if (++searches > 2) throw new Error('Investigation search limit exceeded');
                safeQuery(query.query);
            } else if (query.kind === 'architecture' || query.kind === 'physical-map') safeQuery(query.query);
            else throw new Error('Invalid investigation query');
            try {
                const result = query.kind === 'read' ? await this.readFile(canonical, query.path) :
                    query.kind === 'directory' ? await this.listDirectory(canonical, query.path) :
                    query.kind === 'paths' ? await this.searchPaths(canonical, query.query) :
                    query.kind === 'text' ? await this.searchText(canonical, query.query) :
                    query.kind === 'architecture' ? await this.architecture(canonical, query.query) :
                    query.kind === 'physical-map' ? await this.map(canonical, query.query, false) :
                    { blocks: [], diagnostics: [{ kind: 'rejected' as const, source: 'query', message: 'Unsupported query' }] };
                if (request.signal?.aborted) throw new Error('Investigation cancelled');
                diagnostics.push(...result.diagnostics);
                for (const block of result.blocks) {
                    if (query.kind === 'read' && block.text === `Project file ${query.path}: absent`) {
                        diagnostics.push({ kind: 'unavailable', source: query.path, message: 'Requested project file absent' });
                        continue;
                    }
                    const maximum = Math.min(remaining, query.kind === 'read' ? 12 * 1024 : remaining);
                    const excerpt = Buffer.from(block.text, 'utf8').subarray(0, maximum).toString('utf8').replace(/\uFFFD+$/, '');
                    if (excerpt !== block.text) diagnostics.push({ kind: 'truncated', source: block.ref.id,
                        message: `Only ${Buffer.byteLength(excerpt)} evidence bytes included in investigation packet` });
                    if (!excerpt) continue;
                    remaining -= Buffer.byteLength(excerpt);
                    const included = this.block(canonical, block.ref.kind, block.ref.id, block.ref.label, excerpt,
                        block.ref.generation === undefined ? undefined :
                            { projectId: block.ref.projectId!, generation: block.ref.generation });
                    if (query.kind === 'read' && block.ref.sourceHash)
                        included.ref.sourceHash = block.ref.sourceHash;
                    blocks.push(included);
                }
            } catch (error) {
                if (request.signal?.aborted) throw new Error('Investigation cancelled');
                diagnostics.push({ kind: 'unavailable', source: query.kind,
                    message: `Verified ${query.kind} evidence unavailable; revise the query or inspect manually` });
            }
        }
        for (const diagnostic of diagnostics.filter(item => item.kind === 'unavailable' || item.kind === 'truncated')) {
            const status = `Investigation ${diagnostic.kind}: ${diagnostic.source}: ${diagnostic.message}`;
            if (Buffer.byteLength(status) <= remaining) {
                blocks.push(this.block(canonical, 'grounding-status', `investigation:${blocks.length}`, 'Investigation status', status));
                remaining -= Buffer.byteLength(status);
            }
        }
        return { blocks, diagnostics };
    }

    /** Deterministic first pass for idea-first planning; named files lead, related source follows. */
    async investigateIdea(root: string, idea: string, signal?: AbortSignal): Promise<GroundingResult> {
        const named = [...new Set(explicitPaths(idea).filter(item => !item.directorySyntax).map(item => item.path))].slice(0, 3);
        const withoutPaths = explicitPaths(idea).reduce((text, item) => text.replace(item.path, ' '), idea);
        const words = withoutPaths.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
            .match(/[\p{L}\p{N}_-]{4,}/gu)?.map(word => word.endsWith('s') ? word.slice(0, -1) : word)
            .filter(word => !['with', 'from', 'that', 'this', 'should', 'would', 'could', 'have', 'make',
                'using', 'existing', 'implement', 'implementation', 'feature', 'please', 'project', 'plan',
                'complete', 'ordered', 'before', 'changing', 'anything', 'relevant', 'file', 'explicit',
                'read-only', 'reuse'].includes(word)) ?? [];
        const candidates = [...new Set(words)].slice(0, 12);
        if (!named.length && !candidates.length) {
            const canonical = await this.root(root);
            const message = 'No focused source query could be derived; provide a module or feature term';
            return { blocks: [this.block(canonical, 'grounding-status', 'investigation:unverified',
                'Investigation status', message)], diagnostics: [{ kind: 'unavailable', source: 'idea', message }] };
        }
        if (signal?.aborted) throw new Error('Investigation cancelled');
        const discovered = new Set<string>(), diagnostics: GroundingDiagnostic[] = [];
        for (const query of candidates) {
            if (signal?.aborted) throw new Error('Investigation cancelled');
            try {
                const paths = await this.searchPaths(root, query);
                for (const path of paths.matchedPaths.filter(implementationSource)) discovered.add(path);
                diagnostics.push(...paths.diagnostics);
            } catch {
                diagnostics.push({ kind: 'unavailable', source: 'search', message: 'Project search unavailable' });
            }
        }
        if (signal?.aborted) throw new Error('Investigation cancelled');
        const rank = (path: string) => /^src\//.test(path) ? 0 : /^test\//.test(path) ? 2 : 1;
        const reads = [...named, ...[...discovered].filter(path => !named.includes(path))
            .sort((a, b) => rank(a) - rank(b) || cmp(a, b))].slice(0, 5);
        const detail = await this.investigate(root, { signal, queries: reads.map(path => ({ kind: 'read', path })) });
        const result = { blocks: detail.blocks, diagnostics: [...diagnostics, ...detail.diagnostics] };
        if (!reads.length) {
            const message = 'No relevant implementation source was verified; narrow the idea or inspect manually';
            result.diagnostics.push({ kind: 'unavailable', source: 'idea', message });
            const canonical = await this.root(root);
            result.blocks.push(this.block(canonical, 'grounding-status', 'investigation:unverified',
                'Investigation status', message));
        }
        return result;
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
        const requestedId = /\b(?:node|identity)\s+id\s*[:=]?\s*([\w:.-]+)/i.exec(question)?.[1];
        const selected = requestedId ? snapshot.nodes.find(node => node.id === requestedId) :
            snapshot.nodes.find(node => question.toLowerCase().includes(node.name.toLowerCase()) && node.name.length > 2);
        if (requestedId && !selected) return { blocks: [], diagnostics: [{ kind: 'unavailable', source: kind,
            message: 'Requested map identity unavailable in the current generation' }] };
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
        blocks.push(this.block(canonical, 'project-orientation', 'project:orientation', 'Project orientation',
            'Attached project. Project-relative evidence appears below when inspected for this turn.'));
        const finish = (): GroundingResult => {
            // Rejection and unavailability are themselves turn evidence. Never put the
            // rejected path (which may be an absolute host path) in a model ref or label.
            for (const [index, diagnostic] of diagnostics.entries()) {
                if (diagnostic.kind !== 'rejected' && diagnostic.kind !== 'unavailable') continue;
                const label = diagnostic.kind === 'rejected' ? 'Rejected project request' : 'Unavailable project evidence';
                blocks.push(this.block(canonical, 'grounding-status', `${diagnostic.kind}:${index}`, label,
                    `${label}: ${diagnostic.message}`));
            }
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
        const named = explicitPaths(q)[0];
        const explicit = named?.path;
        if (explicit) {
            try {
                safePath(explicit);
                const listing = named.directorySyntax || /\b(?:list|show|browse|contents|files|directory|folder)\b(?:\s+\w+){0,4}\s+(?:in|of|under|inside)\s*$/i.test(named.before) ||
                    /\bwhat\s+is\s+in\s*$/i.test(named.before);
                let directory = named.directorySyntax;
                try { directory = (await stat(await this.target(canonical, explicit))).isDirectory(); }
                catch (error) { if (!missing(error)) throw error; directory = listing; }
                add(directory ? await this.listDirectory(canonical, explicit) : await this.readFile(canonical, explicit));
            } catch { diagnostics.push({ kind: 'rejected', source: 'project path', message: 'Requested project path is unsafe or unavailable' }); }
        } else if (structureChanged(q)) add(await this.currentStructure(canonical));
        else if (/\b(?:repository root|project root|root directory|root folder)\b/i.test(q)) add(await this.listDirectory(canonical));
        if (/\b(?:canonical|dope|project|chat)\s+architecture\b|\barchitecture\s+(?:subsystem|component|system|map)\b|\b(?:show|describe|inspect|query)\s+(?:the\s+)?architecture\b|^(?:the\s+)?architecture\??$/i.test(q)) {
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
                const paths = await this.searchPaths(canonical, terms[0], terms.includes('persistence') ? 'persistence' : '');
                add(paths);
                const source = paths.matchedPaths.find(implementationSource);
                if (source) {
                    try {
                        const read = await this.read(canonical, source);
                        const excerpt = Buffer.from(read.text, 'utf8').subarray(0, 12 * 1024).toString('utf8').replace(/\uFFFD+$/, '');
                        add({ blocks: [this.block(canonical, 'file', source, source, excerpt)], diagnostics:
                            read.truncated || excerpt.length < read.text.length ? [
                                { kind: 'truncated', source, message: 'Implementation source excerpt limited to 12 KiB' }] : [] });
                    } catch { diagnostics.push({ kind: 'unavailable', source: 'source excerpt', message: 'Implementation source unavailable' }); }
                }
                add(await this.searchText(canonical, terms[0]));
            }
        }
        return finish();
    }
}
