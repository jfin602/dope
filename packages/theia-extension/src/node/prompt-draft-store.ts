import { createHash } from 'node:crypto';
import type { ChatPromptDraftIdentity } from '@dope/chat';
import { ChatRepository } from '@dope/chat/lib/node';
import type { ChatProjectGrounder } from './chat-project-grounder';
import { renderAssessment, renderPlan, validateAssessmentTiers, verifyPromptDraftSourceBasis, verifyPromptSourceRefs,
    type AssessmentRecord, type LegacyAssessmentRecord, type AssessmentWireframe,
    type AssessmentFinding, type AssessmentCategory, type PlanRecord } from './prompt-authoring-stage';
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
    partialAssessment?: {
        requested: string[];
        pages: { path: string; start: number; end: number; fileBytes: number; sourceHash: string }[];
        blocked: Record<string, string>;
        wireframe?: AssessmentWireframe;
        scope?: string;
        findings: Record<AssessmentCategory, AssessmentFinding[]>;
        emptyReasons: Partial<Record<AssessmentCategory, string>>;
        tiers?: LegacyAssessmentRecord['tiers'];
        tierCorrection?: { revision: number; original: LegacyAssessmentRecord['tiers'];
            replacement: LegacyAssessmentRecord['tiers'] };
    };
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
function validPartial(value: StoredPromptDraft['partialAssessment']): boolean {
    if (!value || !Array.isArray(value.requested) || value.requested.length > 16 ||
        value.requested.some(path => typeof path !== 'string' || !/^[A-Za-z0-9_./-]{1,200}$/u.test(path) ||
            path.startsWith('/') || path.split('/').includes('..')) ||
        !Array.isArray(value.pages) || value.pages.length > 32 ||
        !value.blocked || typeof value.blocked !== 'object' || Array.isArray(value.blocked) ||
        !value.findings || typeof value.findings !== 'object' || Array.isArray(value.findings) ||
        !value.emptyReasons || typeof value.emptyReasons !== 'object' || Array.isArray(value.emptyReasons) ||
        Buffer.byteLength(canonical(value), 'utf8') > 32_000) return false;
    if (value.pages.some(page => !page || typeof page.path !== 'string' || !hex(page.sourceHash) ||
        !Number.isSafeInteger(page.start) || !Number.isSafeInteger(page.end) ||
        !Number.isSafeInteger(page.fileBytes) || page.start < 0 ||
        (page.fileBytes === 0 ? page.start !== 0 || page.end !== 0 : page.end <= page.start) ||
        page.end > page.fileBytes)) return false;
    if (value.wireframe && (value.wireframe.kind !== 'wireframe' ||
        value.wireframe.count !== value.wireframe.work.length ||
        value.wireframe.sourceClaims.some(claim => !value.pages.some(page =>
            page.path === claim.path && page.sourceHash === claim.sourceHash &&
            page.start <= claim.start && page.end >= claim.end)))) return false;
    for (const category of ['observations', 'preservation', 'dependencies', 'risks'] as const) {
        const items = value.findings[category];
        if (!Array.isArray(items) || items.length > 12 || items.some(item => !item ||
            typeof item.claim !== 'string' || typeof item.path !== 'string' ||
            typeof item.quote !== 'string' || !hex(item.sourceHash) ||
            !Number.isSafeInteger(item.start) || !Number.isSafeInteger(item.end) ||
            item.start < 0 || item.end <= item.start ||
            !value.pages.some(page => page.path === item.path && page.sourceHash === item.sourceHash &&
                page.start <= item.start && page.end >= item.end))) return false;
        if (value.emptyReasons[category] !== undefined &&
            (typeof value.emptyReasons[category] !== 'string' ||
            (value.emptyReasons[category]?.length ?? 0) > 500)) return false;
    }
    if (value.tierCorrection) {
        const audit = value.tierCorrection;
        if (!Number.isSafeInteger(audit.revision) || audit.revision < 1 ||
            !audit.original || !audit.replacement ||
            canonical(audit.replacement) !== canonical(value.tiers)) return false;
        try { validateAssessmentTiers(audit.replacement); }
        catch { return false; }
        try { validateAssessmentTiers(audit.original); return false; }
        catch { /* Only previously invalid tiers can be corrected. */ }
    }
    return Object.entries(value.blocked).every(([path, reason]) => value.requested.includes(path) &&
        typeof reason === 'string' && reason.length <= 80);
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
            !Array.isArray(stage.sourceRefs) || stage.sourceRefs.length > 32 ||
            !stage.sourceRefs.length && !(
                (stage.record as { kind?: unknown; sourceClaims?: unknown[] }).kind === 'wireframe' &&
                (stage.record as { sourceClaims?: unknown[] }).sourceClaims?.length === 0) ||
            !hex(stage.sourceRefsHash) || stage.sourceRefsHash !== sha256(canonical(stage.sourceRefs)) ||
            stage.sourceRefs.some(ref => !hex(ref.sourceHash) || ref.projectId !== identity.projectId) ||
            stage.dependencyHash !== undefined && !hex(stage.dependencyHash))
            throw new Error('Corrupt named prompt draft stage');
    }
    if (value.plan && (!value.assessment || value.plan.dependencyHash !== value.assessment.contentHash))
        throw new Error('Stale named prompt plan dependency');
    if (value.partialAssessment && !validPartial(value.partialAssessment))
        throw new Error('Corrupt partial prompt assessment');
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
            for (const stage of [current.assessment, current.plan]) if (stage && stage.sourceRefs.length)
                await verifyPromptSourceRefs(root, stage.sourceRefs.map(ref => ({ ...ref, schemaVersion: 1,
                    kind: 'file', label: ref.id, estimatedTokens: 0 })), this.grounder);
            for (const page of current.partialAssessment?.pages ?? []) {
                const currentPage = await this.grounder.readFileRange(root, page.path, 0, 1)
                    .catch(() => { throw new Error('ASSESSMENT_SOURCE_DRIFT: Partial assessment source unavailable'); });
                if (currentPage.sourceHash !== page.sourceHash)
                    throw new Error('ASSESSMENT_SOURCE_DRIFT: Partial assessment source changed');
            }
            return { result: current };
        });
    }

    /** Atomic noncanonical progress; a failed call never changes a previously sealed assessment. */
    async updatePartialAssessment(root: string, identity: ChatPromptDraftIdentity, leaseToken: string,
        expectedRevision: number, partial: NonNullable<StoredPromptDraft['partialAssessment']>): Promise<StoredPromptDraft> {
        if (!validPartial(partial))
            throw new Error('ASSESSMENT_STAGE_LIMIT: Reduce the staged assessment');
        return this.transact(root, identity, leaseToken, async current => {
            if (!current || current.state !== 'active' || current.revision !== expectedRevision || current.assessment)
                throw new Error('ASSESSMENT_STAGE_STALE: Assessment authority changed');
            for (const page of partial.pages) {
                const actual = await this.grounder.readFileRange(root, page.path, 0, 1)
                    .catch(() => { throw new Error('ASSESSMENT_SOURCE_DRIFT: Source unavailable during staging'); });
                if (actual.sourceHash !== page.sourceHash || actual.fileBytes !== page.fileBytes)
                    throw new Error('ASSESSMENT_SOURCE_DRIFT: Source changed during staging');
            }
            const { integrityHash: _integrityHash, ...body } = current;
            const snapshot = sealed({ ...body, revision: current.revision + 1, partialAssessment: partial });
            return { snapshot, result: snapshot };
        });
    }

    /** A single auditable repair for legacy invalid unsealed tiers, bound to the current draft revision. */
    async correctInvalidTiers(root: string, identity: ChatPromptDraftIdentity, leaseToken: string,
        expectedRevision: number, replacement: LegacyAssessmentRecord['tiers']): Promise<StoredPromptDraft> {
        validateAssessmentTiers(replacement);
        return this.transact(root, identity, leaseToken, async current => {
            if (!current || current.state !== 'active' || current.revision !== expectedRevision ||
                current.assessment || !current.partialAssessment?.tiers)
                throw new Error('ASSESSMENT_STAGE_STALE: Tier correction requires the current active unsealed draft revision');
            const original = current.partialAssessment.tiers;
            let originalValid = true;
            try { validateAssessmentTiers(original); }
            catch { originalValid = false; }
            if (current.partialAssessment.tierCorrection || originalValid)
                throw new Error('ASSESSMENT_CONFLICTING_REPLAY: Valid accepted tiers cannot be replaced');
            const partial = { ...current.partialAssessment, tiers: replacement,
                tierCorrection: { revision: current.revision + 1, original, replacement } };
            if (!validPartial(partial)) throw new Error('ASSESSMENT_STAGE_LIMIT: Tier correction exceeds draft limits');
            for (const page of partial.pages) {
                const actual = await this.grounder.readFileRange(root, page.path, 0, 1)
                    .catch(() => { throw new Error('ASSESSMENT_SOURCE_DRIFT: Source unavailable during correction'); });
                if (actual.sourceHash !== page.sourceHash || actual.fileBytes !== page.fileBytes)
                    throw new Error('ASSESSMENT_SOURCE_DRIFT: Source changed during correction');
            }
            const { integrityHash: _integrityHash, ...body } = current;
            const snapshot = sealed({ ...body, revision: current.revision + 1, partialAssessment: partial });
            return { snapshot, result: snapshot };
        });
    }

    /** Derive the inspectable view from saved structured data; no model call or canonical write. */
    async assessmentView(root: string, identity: ChatPromptDraftIdentity, leaseToken: string): Promise<string> {
        const saved = await this.read(root, identity, leaseToken);
        if (!saved.assessment) throw new Error('Named prompt assessment has not been staged');
        return renderAssessment(saved.assessment.record as unknown as AssessmentRecord);
    }

    async planView(root: string, identity: ChatPromptDraftIdentity, leaseToken: string): Promise<string> {
        const saved = await this.read(root, identity, leaseToken);
        if (!saved.plan) throw new Error('Named prompt plan has not been staged');
        return renderPlan(saved.plan.record as unknown as PlanRecord);
    }

    async stage(root: string, identity: ChatPromptDraftIdentity, leaseToken: string,
        kind: PromptDraftStage, expectedRevision: number, record: Record<string, unknown>,
        sourceRefs: StoredPromptDraftStage['sourceRefs']): Promise<StoredPromptDraft> {
        if (!['assessment', 'plan'].includes(kind) || !record || Array.isArray(record) ||
            Buffer.byteLength(canonical(record), 'utf8') > 32_000 ||
            !Array.isArray(sourceRefs) || sourceRefs.length > 32 ||
            !sourceRefs.length && !(kind === 'assessment' &&
                (record as { kind?: unknown; sourceClaims?: unknown[] }).kind === 'wireframe' &&
                (record as { sourceClaims?: unknown[] }).sourceClaims?.length === 0) ||
            sourceRefs.some(ref => !hex(ref.sourceHash) || ref.projectId !== identity.projectId ||
                !ref.id || ref.id.startsWith('/') || ref.id.split('/').includes('..')))
            throw new Error('Invalid or oversized named prompt draft stage');
        if (sourceRefs.length) await verifyPromptSourceRefs(root, sourceRefs.map(ref => ({ ...ref, schemaVersion: 1,
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
            const { assessment: _assessment, plan: _plan, partialAssessment: _partialAssessment, ...base } = body;
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
