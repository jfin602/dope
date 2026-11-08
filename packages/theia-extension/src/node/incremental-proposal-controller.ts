import { createHash, randomUUID } from 'node:crypto';
import { ChatRepository } from '@dope/chat/lib/node';

export type ProposalDomain = 'document' | 'prompt';
export interface ProposalIdentity {
    root: string; chatId: string; messageId: string; leaseToken: string; ownerId: string;
    worktreeId: string; sourceBasis: string; domain: ProposalDomain;
}
export interface ProposalLimits {
    payloadBytes: number; chunkBytes: number; fileBytes: number; totalBytes: number;
    files: number; stages: number; calls: number; elapsedMs: number;
}
/** Explicit server limits; later adapters may lower these, never expand them through model arguments. */
export const DEFAULT_PROPOSAL_LIMITS: ProposalLimits = {
    payloadBytes: 20_000, chunkBytes: 16_000, fileBytes: 128_000, totalBytes: 1_000_000,
    files: 64, stages: 256, calls: 512, elapsedMs: 30 * 60_000
};
export interface ProposalStage {
    version: 1; sequence: number; expectedRevision: number; idempotencyKey: string;
    target: string; chunkIndex: number; content: string; digest: string; complete: boolean;
}
interface StoredStage extends ProposalStage { byteLength: number }
interface Snapshot {
    schemaVersion: 1; id: string; identity: ProposalIdentity; createdAt: number;
    revision: number; calls: number; state: 'staging' | 'ready-for-review' | 'cancelled' | 'stale' | 'blocked';
    stages: StoredStage[]; finalMessage?: string;
}
export interface ProposalReceipt {
    proposalId: string; revision: number; nextSequence: number; state: Snapshot['state'];
    targets: { target: string; chunks: number; bytes: number; complete: boolean }[];
    remaining: { stages: number; calls: number; bytes: number; elapsedMs: number };
}
export interface ProposalHandoff<T> { domain: ProposalDomain; proposalId: string; revision: number;
    finalMessage: string; candidate: T }
export interface ProposalDomainHandler<T> {
    /** Validate one bounded stage before it enters durable, noncanonical state. */
    validateStage(snapshot: Readonly<Snapshot>, stage: Readonly<ProposalStage>): Promise<void>;
    /** Return exact proposal-owner input; this method must not publish canonical files. */
    validateComplete(snapshot: Readonly<Snapshot>): Promise<T>;
}
const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
const fail = (code: string): never => { throw new Error(`PROPOSAL_${code}`); };
const exact = (value: unknown, keys: string[]) => !!value && typeof value === 'object' &&
    !Array.isArray(value) && Object.keys(value).sort().join(',') === keys.sort().join(',');
function checkedStage(value: unknown, limits: ProposalLimits): ProposalStage {
    if (!exact(value, ['version', 'sequence', 'expectedRevision', 'idempotencyKey', 'target',
        'chunkIndex', 'content', 'digest', 'complete'])) return fail('STAGE_ARGUMENTS');
    const v = value as Record<string, unknown>;
    if (v.version !== 1 || !Number.isSafeInteger(v.sequence) || (v.sequence as number) < 1 ||
        !Number.isSafeInteger(v.expectedRevision) || (v.expectedRevision as number) < 0 ||
        !Number.isSafeInteger(v.chunkIndex) || (v.chunkIndex as number) < 0 ||
        typeof v.idempotencyKey !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(v.idempotencyKey) ||
        typeof v.target !== 'string' || v.target.length > 240 ||
        !/^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*$/.test(v.target) ||
        v.target.split('/').some(part => part === '.' || part === '..') ||
        typeof v.content !== 'string' || !v.content || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(v.content) ||
        v.content.includes('\0') || Buffer.byteLength(v.content, 'utf8') > limits.chunkBytes ||
        typeof v.digest !== 'string' || v.digest !== sha256(v.content) || typeof v.complete !== 'boolean' ||
        Buffer.byteLength(JSON.stringify(value), 'utf8') > limits.payloadBytes)
        return fail('STAGE_ARGUMENTS');
    return value as ProposalStage;
}
function receipt(snapshot: Snapshot, limits: ProposalLimits): ProposalReceipt {
    const targets = new Map<string, { target: string; chunks: number; bytes: number; complete: boolean }>();
    for (const stage of snapshot.stages) {
        const value = targets.get(stage.target) ?? { target: stage.target, chunks: 0, bytes: 0, complete: false };
        value.chunks++; value.bytes += stage.byteLength; value.complete = stage.complete;
        targets.set(stage.target, value);
    }
    return { proposalId: snapshot.id, revision: snapshot.revision,
        nextSequence: snapshot.stages.length + 1, state: snapshot.state, targets: [...targets.values()],
        remaining: { stages: limits.stages - snapshot.stages.length, calls: limits.calls - snapshot.calls,
            bytes: limits.totalBytes - snapshot.stages.reduce((sum, stage) => sum + stage.byteLength, 0),
            elapsedMs: Math.max(0, snapshot.createdAt + limits.elapsedMs - Date.now()) } };
}
/** A turn-scoped broker owns the identity; model tools never receive a begin or approval token. */
export class IncrementalProposalController<T = unknown> {
    constructor(private readonly repository: ChatRepository, private readonly identity: ProposalIdentity,
        private readonly authority: () => Promise<{ worktreeId: string; sourceBasis: string }>,
        private readonly handler?: ProposalDomainHandler<T>,
        private readonly limits: ProposalLimits = DEFAULT_PROPOSAL_LIMITS) {
        for (const key of Object.keys(DEFAULT_PROPOSAL_LIMITS) as (keyof ProposalLimits)[])
            if (!Number.isSafeInteger(limits[key]) || limits[key] < 1 ||
                limits[key] > DEFAULT_PROPOSAL_LIMITS[key]) throw new Error('Invalid proposal resource limit');
    }

    private async transact<R>(update: (snapshot: Snapshot) => Promise<{ snapshot: Snapshot; result: R }>): Promise<R> {
        const current = await this.authority();
        const outcome = await this.repository.transactProposalStage<R | { error: string }>(this.identity.root, this.identity.chatId,
            this.identity.messageId, this.identity.leaseToken, async raw => {
                const snapshot = raw as Snapshot | undefined;
                if (!snapshot || snapshot.schemaVersion !== 1 ||
                    JSON.stringify(snapshot.identity) !== JSON.stringify(this.identity)) return fail('FOREIGN_SESSION');
                if (snapshot.state === 'cancelled' || snapshot.state === 'stale') return fail('TERMINAL');
                if (current.worktreeId !== snapshot.identity.worktreeId ||
                    current.sourceBasis !== snapshot.identity.sourceBasis)
                    return { snapshot: { ...snapshot, state: 'stale' as const },
                        result: { error: 'STALE_SOURCE' } as const };
                if (Date.now() - snapshot.createdAt > this.limits.elapsedMs)
                    return { snapshot: { ...snapshot, state: 'blocked' as const },
                        result: { error: 'ELAPSED_LIMIT' } as const };
                if (snapshot.calls >= this.limits.calls) return fail('CALL_LIMIT');
                return update({ ...snapshot, calls: snapshot.calls + 1 });
            });
        if (outcome && typeof outcome === 'object' && 'error' in outcome)
            return fail(String(outcome.error));
        return outcome as R;
    }
    async begin(): Promise<ProposalReceipt> {
        const current = await this.authority();
        if (current.worktreeId !== this.identity.worktreeId || current.sourceBasis !== this.identity.sourceBasis)
            return fail('STALE_SOURCE');
        return this.repository.transactProposalStage(this.identity.root, this.identity.chatId,
            this.identity.messageId, this.identity.leaseToken, async raw => {
                if (raw) return fail('ALREADY_STARTED');
                const snapshot: Snapshot = { schemaVersion: 1, id: randomUUID(), identity: this.identity,
                    createdAt: Date.now(), revision: 0, calls: 0, state: 'staging', stages: [] };
                return { snapshot, result: receipt(snapshot, this.limits) };
            });
    }
    status(): Promise<ProposalReceipt> {
        return this.transact(async snapshot => ({ snapshot, result: receipt(snapshot, this.limits) }));
    }
    stage(value: unknown, domain: ProposalDomain): Promise<ProposalReceipt> {
        return this.transact(async snapshot => {
            if (snapshot.state !== 'staging' || domain !== snapshot.identity.domain) return fail('DOMAIN');
            const stage = checkedStage(value, this.limits);
            const old = snapshot.stages.find(item => item.idempotencyKey === stage.idempotencyKey ||
                item.sequence === stage.sequence);
            if (old) {
                const { byteLength: _byteLength, ...original } = old;
                if (Object.keys(stage).some(key => original[key as keyof ProposalStage] !== stage[key as keyof ProposalStage]))
                    return fail('REPLAY_CONFLICT');
                return { snapshot, result: receipt(snapshot, this.limits) };
            }
            if (!this.handler) return fail('DOMAIN_NOT_SUPPORTED');
            if (stage.sequence !== snapshot.stages.length + 1 || stage.expectedRevision !== snapshot.revision)
                return fail('SEQUENCE');
            if (snapshot.stages.length >= this.limits.stages) return fail('STAGE_LIMIT');
            const targetStages = snapshot.stages.filter(item => item.target === stage.target);
            if (targetStages.length >= 256 || stage.chunkIndex !== targetStages.length ||
                targetStages.at(-1)?.complete) return fail('CHUNK_ORDER');
            const bytes = Buffer.byteLength(stage.content, 'utf8');
            if (targetStages.reduce((sum, item) => sum + item.byteLength, 0) + bytes > this.limits.fileBytes ||
                snapshot.stages.reduce((sum, item) => sum + item.byteLength, 0) + bytes > this.limits.totalBytes ||
                !targetStages.length && new Set(snapshot.stages.map(item => item.target)).size >= this.limits.files)
                return fail('BYTE_OR_FILE_LIMIT');
            await this.handler.validateStage(snapshot, stage);
            const next: Snapshot = { ...snapshot, revision: snapshot.revision + 1,
                stages: [...snapshot.stages, { ...stage, byteLength: bytes }] };
            return { snapshot: next, result: receipt(next, this.limits) };
        });
    }
    async finish(value: unknown): Promise<ProposalHandoff<T>> {
        if (!exact(value, ['finalMessage']) || typeof (value as { finalMessage?: unknown }).finalMessage !== 'string')
            return fail('FINISH_ARGUMENTS');
        const finalMessage = (value as { finalMessage: string }).finalMessage.trim();
        if (!finalMessage || finalMessage.length > 2_000 || /[\u0000-\u001f\u007f]/u.test(finalMessage))
            return fail('FINISH_ARGUMENTS');
        return this.transact(async snapshot => {
            if (snapshot.state !== 'staging') return fail('ALREADY_FINISHED');
            if (!snapshot.stages.length || receipt(snapshot, this.limits).targets.some(item => !item.complete))
                return fail('INCOMPLETE');
            if (!this.handler) return fail('DOMAIN_NOT_SUPPORTED');
            const candidate = await this.handler.validateComplete(snapshot);
            const next: Snapshot = { ...snapshot, revision: snapshot.revision + 1,
                state: 'ready-for-review', finalMessage };
            return { snapshot: next, result: { domain: snapshot.identity.domain, proposalId: snapshot.id,
                revision: next.revision, finalMessage, candidate } };
        });
    }
    cancel(): Promise<ProposalReceipt> {
        return this.transact(async snapshot => {
            const next: Snapshot = { ...snapshot, state: 'cancelled', revision: snapshot.revision + 1 };
            return { snapshot: next, result: receipt(next, this.limits) };
        });
    }
    /** Terminal turn cleanup may run after abort; the repository still checks the owner lease. */
    async stop(): Promise<void> {
        await this.repository.transactProposalStage(this.identity.root, this.identity.chatId,
            this.identity.messageId, this.identity.leaseToken, async raw => {
                const snapshot = raw as Snapshot | undefined;
                if (!snapshot || JSON.stringify(snapshot.identity) !== JSON.stringify(this.identity))
                    return fail('FOREIGN_SESSION');
                return { snapshot: snapshot.state === 'staging' ?
                    { ...snapshot, state: 'cancelled' as const, revision: snapshot.revision + 1 } : snapshot,
                    result: undefined };
            });
    }
}
