import { createHash } from 'node:crypto';
import type { ChatPromptDraftIdentity } from '@dope/chat';
import { ChatRepository } from '@dope/chat/lib/node';
import type { ChatProjectGrounder } from './chat-project-grounder';
import { renderAssessment, verifyPromptDraftSourceBasis, verifyPromptSourceRefs,
    type AssessmentRecord } from './prompt-authoring-stage';
import { capturePromptSourceEvidence } from './prompt-stack-proposal';

export type PromptDraftStage = 'assessment' | 'plan';
export interface StoredPromptDraftStage {
    revision: number;
    contentHash: string;
    record: Record<string, unknown>;
    /** Broker-read file identities are pinned apart from the structured model record. */
    sourceRefs: { id: string; sourceHash: string; contentHash?: string; projectId: string;
        start?: number; end?: number }[];
    sourceRefsHash: string;
    dependencyHash?: string;
}
export interface StoredPromptDraft {
    schemaVersion: 1;
    identity: ChatPromptDraftIdentity;
    revision: number;
    state: 'active' | 'aborted';
    assessment?: StoredPromptDraftStage;
    plan?: StoredPromptDraftStage;
    history: { stage: PromptDraftStage; value: StoredPromptDraftStage }[];
    integrityHash: string;
}

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const hex = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
function canonical(value: unknown): string {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
    if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype)
        return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
    throw new Error('Prompt draft record must contain only JSON values');
}
function sealed(value: Omit<StoredPromptDraft, 'integrityHash'>): StoredPromptDraft {
    return { ...value, integrityHash: sha256(canonical(value)) };
}
function checked(raw: unknown, identity: ChatPromptDraftIdentity): StoredPromptDraft {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Corrupt named prompt draft');
    const value = raw as StoredPromptDraft;
    const { integrityHash, ...body } = value;
    if (value.schemaVersion !== 1 || canonical(value.identity) !== canonical(identity) ||
        !Number.isSafeInteger(value.revision) || value.revision < 0 ||
        !['active', 'aborted'].includes(value.state) || !Array.isArray(value.history) ||
        value.history.length > 8 || !hex(integrityHash) || integrityHash !== sha256(canonical(body)))
        throw new Error('Corrupt or foreign named prompt draft');
    for (const stage of [value.assessment, value.plan, ...value.history.map(item => item.value)]) {
        if (!stage) continue;
        if (!Number.isSafeInteger(stage.revision) || stage.revision < 1 ||
            !hex(stage.contentHash) || stage.contentHash !== sha256(canonical(stage.record)) ||
            !Array.isArray(stage.sourceRefs) || !stage.sourceRefs.length || stage.sourceRefs.length > 32 ||
            !hex(stage.sourceRefsHash) || stage.sourceRefsHash !== sha256(canonical(stage.sourceRefs)) ||
            stage.sourceRefs.some(ref => !hex(ref.sourceHash) || ref.projectId !== identity.projectId) ||
            stage.dependencyHash !== undefined && !hex(stage.dependencyHash))
            throw new Error('Corrupt named prompt draft stage');
    }
    if (value.plan && (!value.assessment || value.plan.dependencyHash !== value.assessment.contentHash))
        throw new Error('Stale named prompt plan dependency');
    return value;
}

/** Durable stages share Chat's project lock and lease. The slug maps only to the future canonical task path. */
export class PromptDraftStore {
    constructor(private readonly repository: ChatRepository, private readonly grounder: ChatProjectGrounder,
        private readonly sourceEvidence = capturePromptSourceEvidence) {}

    private async transact<T>(root: string, identity: ChatPromptDraftIdentity, leaseToken: string,
        update: (current: StoredPromptDraft | undefined) => Promise<{ snapshot?: StoredPromptDraft; result: T }>): Promise<T> {
        verifyPromptDraftSourceBasis(identity, await this.sourceEvidence(root));
        return this.repository.transactPromptDraft(root, identity, leaseToken, async raw => {
            verifyPromptDraftSourceBasis(identity, await this.sourceEvidence(root));
            return update(raw === undefined ? undefined : checked(raw, identity));
        });
    }

    async begin(root: string, identity: ChatPromptDraftIdentity, leaseToken: string): Promise<StoredPromptDraft> {
        return this.transact(root, identity, leaseToken, async current => {
            if (current) throw new Error('Named prompt draft already started');
            const snapshot = sealed({ schemaVersion: 1, identity, revision: 0, state: 'active', history: [] });
            return { snapshot, result: snapshot };
        });
    }

    async read(root: string, identity: ChatPromptDraftIdentity, leaseToken: string): Promise<StoredPromptDraft> {
        return this.transact(root, identity, leaseToken, async current => {
            if (!current || current.state !== 'active') throw new Error('Named prompt draft is unavailable or aborted');
            for (const stage of [current.assessment, current.plan]) if (stage)
                await verifyPromptSourceRefs(root, stage.sourceRefs.map(ref => ({ ...ref, schemaVersion: 1,
                    kind: 'file', label: ref.id, estimatedTokens: 0 })), this.grounder);
            return { result: current };
        });
    }

    /** Derive the inspectable view from saved structured data; no model call or canonical write. */
    async assessmentView(root: string, identity: ChatPromptDraftIdentity, leaseToken: string): Promise<string> {
        const saved = await this.read(root, identity, leaseToken);
        if (!saved.assessment) throw new Error('Named prompt assessment has not been staged');
        return renderAssessment(saved.assessment.record as unknown as AssessmentRecord);
    }

    async stage(root: string, identity: ChatPromptDraftIdentity, leaseToken: string,
        kind: PromptDraftStage, expectedRevision: number, record: Record<string, unknown>,
        sourceRefs: StoredPromptDraftStage['sourceRefs']): Promise<StoredPromptDraft> {
        if (!['assessment', 'plan'].includes(kind) || !record || Array.isArray(record) ||
            Buffer.byteLength(canonical(record), 'utf8') > 32_000 ||
            !Array.isArray(sourceRefs) || !sourceRefs.length || sourceRefs.length > 32 ||
            sourceRefs.some(ref => !hex(ref.sourceHash) || ref.projectId !== identity.projectId ||
                !ref.id || ref.id.startsWith('/') || ref.id.split('/').includes('..')))
            throw new Error('Invalid or oversized named prompt draft stage');
        await verifyPromptSourceRefs(root, sourceRefs.map(ref => ({ ...ref, schemaVersion: 1,
            kind: 'file', label: ref.id, estimatedTokens: 0 })), this.grounder);
        return this.transact(root, identity, leaseToken, async current => {
            if (!current || current.state !== 'active') throw new Error('Named prompt draft is unavailable or aborted');
            if (current.revision !== expectedRevision) throw new Error('Stale named prompt draft revision');
            if (kind === 'plan' && !current.assessment) throw new Error('Assessment required before plan');
            const old = current[kind];
            const value: StoredPromptDraftStage = {
                revision: (old?.revision ?? 0) + 1, contentHash: sha256(canonical(record)), record,
                sourceRefs, sourceRefsHash: sha256(canonical(sourceRefs)),
                ...(kind === 'plan' ? { dependencyHash: current.assessment!.contentHash } : {})
            };
            const history = [...current.history, ...(old ? [{ stage: kind, value: old }] : []),
                ...(kind === 'assessment' && current.plan ? [{ stage: 'plan' as const, value: current.plan }] : [])].slice(-8);
            const { integrityHash: _integrityHash, ...body } = current;
            const { assessment: _assessment, plan: _plan, ...base } = body;
            const snapshot = sealed({ ...base, revision: current.revision + 1,
                ...(kind === 'assessment' ? { assessment: value } : { assessment: current.assessment!, plan: value }),
                history });
            return { snapshot, result: snapshot };
        });
    }

    async abort(root: string, identity: ChatPromptDraftIdentity, leaseToken: string,
        expectedRevision: number): Promise<StoredPromptDraft> {
        return this.transact(root, identity, leaseToken, async current => {
            if (!current || current.state !== 'active' || current.revision !== expectedRevision)
                throw new Error('Stale or unavailable named prompt draft');
            const { integrityHash: _integrityHash, ...body } = current;
            const snapshot = sealed({ ...body, state: 'aborted', revision: current.revision + 1 });
            return { snapshot, result: snapshot };
        });
    }
}
