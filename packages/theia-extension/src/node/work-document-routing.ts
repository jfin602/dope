import type { LocalToolRequest } from '@dope/agent-core/lib/node/local-tool-contracts';
import { parseLocalToolRequests } from '@dope/agent-core/lib/node/local-tool-contracts';
import type { WorkDocumentRead } from '@dope/agent-core';

export interface DocumentPointer { path: string; section?: string; question: string; role: 'task' | 'instructions' }
export interface DocumentRead { path: string; section?: string; question: string; sourceHash: string | null;
    contentHash?: string;
    offset: number; endOffset: number; fileBytes: number | null; offered: boolean;
    role: DocumentPointer['role'] | 'agent-selected'; repeated: boolean; circular: boolean; clipped: boolean }

const words = (text: string): string[] => (text.toLowerCase().match(/[a-z][a-z0-9]{3,}/gu) ?? [])
    .filter(word => !['this', 'that', 'with', 'from', 'read', 'file', 'docs', 'documentation', 'please',
        'when', 'then', 'your', 'project', 'work', 'task', 'refer', 'following', 'about'].includes(word));
const privatePart = (part: string): boolean => {
    const name = part.toLowerCase();
    return ['.git', '.dope', '.codex', '.agents', '.ssh', '.aws', '.config', '.gnupg', '.kube',
        '.docker', '.azure', '.npmrc', '.yarnrc', '.yarnrc.yml', '.netrc', '.pypirc', '.gitconfig',
        '.git-credentials', 'id_rsa', 'id_ed25519', 'credentials.json', 'secrets', 'secret',
        'credentials', 'private', 'node_modules'].includes(name) || name === '.env' ||
        name.startsWith('.env.') || name.endsWith('.pem') || name.endsWith('.key') ||
        name.endsWith('.p12') || name.endsWith('.pfx') ||
        ['secret.', 'token.', 'credential.'].some(prefix => name.startsWith(prefix));
};

/** Only links already supplied by the accepted task or applicable instructions are candidates.
 * There is no directory walk, content search, or speculative document read. */
export function selectDocumentPointers(task: string, instructions: string, workingPaths: readonly string[] = [],
    allowed: (path: string) => boolean = () => true): DocumentPointer[] {
    const relevant = new Set(words(`${task} ${workingPaths.join(' ')}`));
    const selected: DocumentPointer[] = [];
    for (const [source, role] of [[task, 'task'], [instructions, 'instructions']] as const) {
        for (const line of source.split(/\r?\n/u)) {
            const candidates = [
                ...Array.from(line.matchAll(/\[([^\]]{1,120})\]\(([^)\s]{1,1024})\)/gu), match =>
                    ({ path: match[2], label: match[1], index: match.index })),
                ...Array.from(line.matchAll(/`((?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\.(?:md|txt)(?:#[A-Za-z0-9._-]+)?)`/giu), match =>
                    ({ path: match[1], label: line.slice(0, match.index).trim().slice(-100) || match[1], index: match.index }))
            ];
            for (const candidate of candidates) {
                const [rawPath, anchor] = candidate.path.split('#', 2);
                if (!/\.(?:md|txt)$/iu.test(rawPath) || !/^[A-Za-z0-9._/-]+$/u.test(rawPath)) continue;
                const path = rawPath.replace(/^\.\//u, '');
                if (path.split('/').some(privatePart)) continue;
                try { parseLocalToolRequests(JSON.stringify([{ id: 'doc-pointer', name: 'read',
                    arguments: { path, offset: 0, maxBytes: 4096 } }])); }
                catch { continue; }
                if (!allowed(path)) continue;
                // A matching filename alone is not evidence that an instruction applies to this task.
                const context = `${candidate.label} ${line.slice(0, candidate.index)}`;
                if (role === 'instructions' && !words(context).some(word => relevant.has(word))) continue;
                if (selected.some(item => item.path === path && item.section === anchor)) continue;
                selected.push({ path, ...(anchor ? { section: anchor.slice(0, 100) } : {}),
                    question: candidate.label.slice(0, 100), role });
                if (selected.length === 4) return selected;
            }
        }
    }
    return selected;
}

/** Per-run navigation evidence. It never blocks an authorized read or claims a requirement was followed. */
export class WorkDocumentRouting {
    readonly pointers: DocumentPointer[];
    private readonly trail: DocumentRead[] = [];
    private readonly unresolved = new Map<string, Set<string>>();

    constructor(private readonly task: string, instructions: string,
        private readonly workingPaths: readonly string[] = [],
        private readonly allowed: (path: string) => boolean = () => true,
        private readonly priorReads: readonly WorkDocumentRead[] = []) {
        this.pointers = selectDocumentPointers(task, instructions, workingPaths, allowed);
    }

    private format(pointers: readonly DocumentPointer[]): string {
        if (!pointers.length) return '';
        return `Optional task documentation pointers (offered, not read or adopted):\n${pointers.map(pointer =>
            `- ${pointer.path}${pointer.section ? `#${pointer.section}` : ''} — ${pointer.question} (${pointer.role}; source unknown until read)`)
            .join('\n')}\nUse read_file with offset 0 for a first page; continue with nextOffset and expectedSourceHash to reach late sections. Read only what the active implementation question needs. A read does not complete the task.`;
    }

    notice(): string { return this.format(this.pointers.filter(pointer => !this.priorReads.some(read =>
        read.path === pointer.path && read.section === pointer.section && read.question === pointer.question))); }

    additionalInstructions(instructions: string, path: string): string {
        const candidates = selectDocumentPointers(this.task, instructions, [...this.workingPaths, path], this.allowed);
        const added = candidates.filter(candidate => !this.pointers.some(existing =>
            existing.path === candidate.path && existing.section === candidate.section))
            .slice(0, Math.max(0, 4 - this.pointers.length));
        this.pointers.push(...added);
        return this.format(added);
    }

    activeStepActivity(): void { this.unresolved.clear(); }

    observe(call: LocalToolRequest & { name: 'read' }, output: string): { record?: DocumentRead; signal?: string } {
        if (!/\.(?:md|txt)$/iu.test(call.arguments.path) || call.arguments.path.endsWith('/AGENTS.md') ||
            call.arguments.path === 'AGENTS.md') return {};
        const ranged = call.arguments.offset !== undefined;
        let page: { path: string; sourceHash: string; contentHash?: string; offset: number; endOffset: number; fileBytes: number;
            nextOffset: number | null; truncated: boolean } | undefined;
        if (ranged) {
            try { page = JSON.parse(output); } catch { return {}; }
            if (!page || page.path !== call.arguments.path || !/^[a-f0-9]{64}$/u.test(page.sourceHash) ||
                page.contentHash !== undefined && !/^[a-f0-9]{64}$/u.test(page.contentHash) ||
                !Number.isSafeInteger(page.offset) || !Number.isSafeInteger(page.endOffset) ||
                !Number.isSafeInteger(page.fileBytes) || page.offset !== call.arguments.offset ||
                page.endOffset < page.offset || page.endOffset > page.fileBytes ||
                typeof page.truncated !== 'boolean' ||
                (page.truncated ? page.nextOffset !== page.endOffset : page.nextOffset !== null)) return {};
        }
        const pointer = this.pointers.find(item => item.path === call.arguments.path);
        const sourceHash = page?.sourceHash ?? null;
        const offset = page?.offset ?? 0;
        const endOffset = page?.endOffset ?? Buffer.byteLength(output, 'utf8');
        const question = pointer?.question ?? 'agent requested section';
        const repeated = sourceHash !== null && this.trail.some(item => item.path === call.arguments.path &&
            item.sourceHash === sourceHash && item.offset === offset && item.endOffset === endOffset &&
            item.question === question);
        const circular = sourceHash !== null && this.trail.length >= 2 &&
            this.trail.at(-2)?.path === call.arguments.path && this.trail.at(-2)?.sourceHash === sourceHash &&
            this.trail.at(-2)?.question === question && this.trail.at(-1)?.path !== call.arguments.path;
        const record: DocumentRead = { path: call.arguments.path, section: pointer?.section,
            question, sourceHash, ...(page?.contentHash ? { contentHash: page.contentHash } : {}),
            offset, endOffset, fileBytes: page?.fileBytes ?? null,
            offered: Boolean(pointer), role: pointer?.role ?? 'agent-selected', repeated, circular, clipped: !ranged };
        this.trail.push(record);
        if (this.trail.length > 16) this.trail.shift();
        // Consecutive pages of one large document are productive navigation, not a research loop.
        if (!repeated && !circular) {
            const paths = this.unresolved.get(question) ?? new Set<string>();
            paths.add(record.path);
            this.unresolved.set(question, paths);
        }
        const signal = circular ? 'Circular document reference' : repeated ?
            'Unchanged document range read again' : [...this.unresolved.values()].some(paths => paths.size >= 4) ?
                'Documentation-only activity without an implementation effect' : undefined;
        return { record, ...(signal ? { signal: `${signal}. Return to the active implementation step, choose a justified new section or report a concrete blocker. Changed content and new questions remain readable.` } : {}) };
    }
}
