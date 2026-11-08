import { createHash } from 'node:crypto';
import type { ChatDocumentationProposal } from '@dope/chat';
import { RoadmapStore } from '@dope/project-intelligence/lib/node/roadmap-store';
import type { DocumentationDiscovery } from './documentation-discovery';
import { eligibleDocumentationPath, prepareDocumentationReview, readDocumentationBasis,
    documentationReviewApplicability } from './documentation-review';
import { requireCompleteDocumentationReview, type DocumentationReadPage } from './documentation-skill-review';
import type { ProposalDomainHandler, ProposalSnapshot, ProposalStage } from './incremental-proposal-controller';

const hash = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
type Operation = { operation: 'create'; chunk: string } |
    { operation: 'replace'; before: string; after: string; sourceHash: string } |
    { operation: 'remove' };
function operation(stage: ProposalStage): Operation {
    let value: unknown;
    try { value = JSON.parse(stage.content); } catch { throw new Error('Invalid document stage content'); }
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid document stage content');
    const entry = value as Record<string, unknown>;
    if (Object.keys(entry).join(',') === 'operation' && entry.operation === 'remove') return entry as Operation;
    if (Object.keys(entry).sort().join(',') === 'chunk,operation' && entry.operation === 'create' &&
        typeof entry.chunk === 'string' && entry.chunk.length) return entry as Operation;
    if (Object.keys(entry).sort().join(',') === 'after,before,operation,sourceHash' &&
        entry.operation === 'replace' && typeof entry.before === 'string' && entry.before.length &&
        typeof entry.after === 'string' && entry.after.length && typeof entry.sourceHash === 'string' &&
        /^[a-f0-9]{64}$/u.test(entry.sourceHash)) return entry as Operation;
    throw new Error('Invalid document stage content');
}
function safeText(value: string): void {
    if (!value || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/u.test(value) ||
        Buffer.from(value, 'utf8').toString('utf8') !== value) throw new Error('Invalid document text');
}
export interface DocumentStageContext {
    root: string; chatId: string; messageId: string; ownerId: string; leaseToken: string;
    objective: string; reviewIntent?: string; discovery: DocumentationDiscovery; pages: readonly DocumentationReadPage[];
    prior?: ChatDocumentationProposal;
    /** An explicit review has to inspect at least one source before creating files. */
    readPaths: () => readonly string[];
}
/** Validates the entire cumulative candidate on every stage. It never writes project files. */
export class IncrementalDocumentReview implements ProposalDomainHandler<ChatDocumentationProposal> {
    constructor(private readonly store: RoadmapStore, private readonly context: DocumentStageContext) {}

    readyForFinish(snapshot: Readonly<ProposalSnapshot>): { ready: boolean; nextAction?: string } {
        const targets = new Set(this.context.prior?.targets.map(target => target.path) ?? []);
        for (const stage of snapshot.stages) {
            if (operation(stage).operation === 'remove') targets.delete(stage.target);
            else targets.add(stage.target);
        }
        const priorReads: DocumentationReadPage[] = this.context.prior?.targets
            .filter(target => target.operation === 'update').map(target => ({ path: target.path,
                offset: 0, endOffset: 0, fileBytes: Buffer.byteLength(target.before ?? '', 'utf8'),
                sourceHash: target.beforeHash!, text: '' })) ?? [];
        try {
            requireCompleteDocumentationReview(this.context.objective, this.context.discovery,
                [...targets].map(path => ({ path })), [...this.context.pages, ...priorReads]);
            return { ready: true };
        } catch {
            return { ready: false, nextAction: 'Stage missing requested targets or inspect required source, then finish.' };
        }
    }

    private async materialize(stages: readonly ProposalStage[]): Promise<{ path: string; after: string }[]> {
        const { root, pages, prior } = this.context;
        const candidates = new Map(prior?.targets.map(target => [target.path, target.after]) ?? []);
        const original = new Map<string, string | null>();
        const occupied = new Map<string, [number, number][]>();
        const kind = new Map<string, Operation['operation']>();
        for (const stage of stages) {
            const path = stage.target;
            eligibleDocumentationPath(path);
            const edit = operation(stage);
            const earlier = kind.get(path);
            if (earlier && earlier !== edit.operation) throw new Error(`Mixed document stages: ${path}`);
            kind.set(path, edit.operation);
            let basis = original.get(path);
            if (basis === undefined && !original.has(path)) {
                const read = await readDocumentationBasis(root, path);
                basis = read.before;
                original.set(path, basis);
                const priorTarget = prior?.targets.find(target => target.path === path);
                if (priorTarget && read.beforeHash !== priorTarget.beforeHash)
                    throw new Error(`Selected proposal source changed: ${path}`);
            }
            if (edit.operation === 'create') {
                if (basis !== null || prior?.targets.some(target => target.path === path))
                    throw new Error(`Create target already exists: ${path}`);
                const next = (candidates.get(path) ?? '') + edit.chunk;
                safeText(next);
                if (Buffer.byteLength(next, 'utf8') > 128_000) throw new Error('Document exceeds review file limit');
                candidates.set(path, next);
                continue;
            }
            if (edit.operation === 'remove') {
                if (!prior?.targets.some(target => target.path === path) || earlier || stage.chunkIndex !== 0)
                    throw new Error(`Cannot remove a file outside the selected proposal: ${path}`);
                candidates.delete(path);
                continue;
            }
            const priorTarget = prior?.targets.find(target => target.path === path);
            const anchorBasis = priorTarget?.after ?? basis;
            if (anchorBasis === null || anchorBasis === undefined) throw new Error(`Update source missing: ${path}`);
            if (edit.sourceHash !== hash(anchorBasis)) {
                if (pages.some(page => page.path === path && page.sourceHash === edit.sourceHash))
                    throw new Error('PROPOSAL_DOCUMENT_USE_FULL_HASH');
                throw new Error(`Update source changed: ${path}`);
            }
            if (!priorTarget && !pages.some(page => page.path === path && page.fullHash === edit.sourceHash &&
                page.text.includes(edit.before))) throw new Error(`Exact replacement was not broker-read: ${path}`);
            const start = anchorBasis.indexOf(edit.before);
            if (start < 0 || anchorBasis.indexOf(edit.before, start + 1) >= 0)
                throw new Error(`Exact replacement is missing or ambiguous: ${path}`);
            const range: [number, number] = [start, start + edit.before.length];
            if ((occupied.get(path) ?? []).some(([left, right]) => range[0] < right && left < range[1]))
                throw new Error(`Overlapping document replacement: ${path}`);
            occupied.set(path, [...occupied.get(path) ?? [], range]);
            const current = candidates.get(path) ?? basis;
            if (current === null || current === undefined || current.split(edit.before).length !== 2)
                throw new Error(`Exact replacement is missing or ambiguous in candidate: ${path}`);
            safeText(edit.after);
            const next = current.replace(edit.before, edit.after);
            if (Buffer.byteLength(next, 'utf8') > 128_000) throw new Error('Document exceeds review file limit');
            candidates.set(path, next);
        }
        if (!stages.length) throw new Error('No document stages');
        if (!candidates.size) throw new Error('Revision must retain at least one proposed file');
        if (!this.context.readPaths().length && !prior) throw new Error('Review needs an actual brokered document read');
        return [...candidates].map(([path, after]) => ({ path, after }));
    }
    async validateStage(snapshot: Readonly<ProposalSnapshot>, stage: Readonly<ProposalStage>): Promise<void> {
        if (snapshot.stages.some(item => item.target === stage.target && item.complete &&
            operation(item).operation === 'create')) throw new Error('Created document is already complete');
        await this.materialize([...snapshot.stages, stage]);
    }
    async preview(snapshot: Readonly<ProposalSnapshot>): Promise<{ target: string; path: string;
        original: string | null; proposed: string }[]> {
        if (!snapshot.stages.length) return [];
        const changes = await this.materialize(snapshot.stages);
        return Promise.all(changes.map(async change => ({ target: change.path, path: change.path,
            original: (await readDocumentationBasis(this.context.root, change.path)).before,
            proposed: change.after })));
    }
    async validateComplete(snapshot: Readonly<ProposalSnapshot>): Promise<ChatDocumentationProposal> {
        const { root, prior, pages, discovery, objective } = this.context;
        const changes = await this.materialize(snapshot.stages);
        const previousReads: DocumentationReadPage[] = prior?.targets.filter(target => target.operation === 'update')
            .map(target => ({ path: target.path, offset: 0, endOffset: 0,
                fileBytes: Buffer.byteLength(target.before ?? '', 'utf8'),
                sourceHash: target.beforeHash!, text: '' })) ?? [];
        requireCompleteDocumentationReview(objective, discovery, changes, [...pages, ...previousReads]);
        if (prior && changes.length === prior.targets.length && changes.every(change =>
            prior.targets.some(target => target.path === change.path && target.after === change.after)))
            throw new Error('Revision made no change to the selected proposal');
        const dependencies = [...new Map(pages.map(page => [page.path,
            { path: page.path, contentHash: page.fullHash }])).values()];
        if (dependencies.some(item => !item.contentHash)) throw new Error('Brokered source hash missing');
        const proposal = await prepareDocumentationReview(this.store, {
            root, chatId: this.context.chatId, messageId: prior?.messageId ?? this.context.messageId,
            ownerId: this.context.ownerId, leaseToken: this.context.leaseToken, changes,
            ...(dependencies.length ? { dependencies: dependencies as { path: string; contentHash: string }[] } : {}),
            ...(prior ? { revisionOf: prior } : { reviewIntent: this.context.reviewIntent ?? objective }) });
        if (await documentationReviewApplicability(this.store, proposal, root) !== 'applicable')
            throw new Error('Documentation source changed during review');
        return proposal;
    }
}
