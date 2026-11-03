import { createHash, randomUUID } from 'node:crypto';
import type { RoadmapGateIndex } from '@dope/project-intelligence/lib/node/roadmap-gate-domain';
import type { GatePlanningAction } from '@dope/project-intelligence/lib/node/project-planning-actions';
import type { RoadmapStore } from '@dope/project-intelligence/lib/node/roadmap-store';
import { checkedRoadmapDocumentFile } from '@dope/project-intelligence/lib/node/roadmap-document-patch';

type Context = { root: string; projectId: string; chatId: string; turnId: string; lease: string };
export type NativeOperationStatus = 'Pending' | 'Applied' | 'Rejected' | 'Stale' | 'Conflict' | 'Denied' | 'Failed' | 'Superseded';
type Operation = { id: string; action: GatePlanningAction; batch: number; status: NativeOperationStatus };
export type NativeRoadmapStage = { id: string; context: Context; revision: number;
    sourceHash: string | null; ownerId: string; expires: number; operations: Operation[]; entityIds: Map<string, string>;
    done: boolean; strategy: 'full' | 'phase-only'; review?: { token: string; ids: string[];
        decision: 'apply' | 'reject'; revision: number; indexHash: string | null } };
export const NATIVE_ROADMAP_ACTION_FIELDS: Record<string, readonly string[]> = {
    'phase.create': ['id', 'title', 'objective'], 'phase.edit': ['id', 'title', 'objective'],
    'phase.delete': ['id'], 'phase.reorder': ['ids'], 'phase.dependencies': ['id', 'dependencies'],
    'gate.create': ['id', 'parentPhaseId', 'designation', 'title', 'purpose', 'criteria'],
    'gate.edit': ['id', 'title', 'purpose'], 'gate.delete': ['id'],
    'gate.reparent': ['id', 'parentPhaseId', 'order'], 'gate.reorder': ['parentPhaseId', 'ids'],
    'gate.dependencies': ['id', 'dependencies'], 'criterion.add': ['gateId', 'id', 'title', 'expectedResult'],
    'criterion.edit': ['gateId', 'id', 'title', 'expectedResult'], 'criterion.remove': ['gateId', 'id'],
    'criterion.reorder': ['gateId', 'ids'], 'correction.attach': ['id', 'parent', 'title', 'objective'],
    'correction.edit': ['id', 'title', 'objective'], 'correction.reparent': ['id', 'parent'],
    'correction.delete': ['id']
};
const object = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === 'object' && !Array.isArray(value);
const id = (value: unknown): value is string => typeof value === 'string' &&
    value.length > 0 && value.length <= 128 && value.trim() === value && !/[\p{Cc}\p{Cf}]/u.test(value);
const text = (value: unknown): value is string => typeof value === 'string' &&
    !!value.trim() && value.length <= 2048 && !/[\p{Cc}\p{Cf}]/u.test(value) &&
    !/<\/?[a-z][^>]*>|javascript:|!\[[^\]]*\]\(https?:/iu.test(value);
const newId = (value: unknown): value is string => typeof value === 'string' && /^new:[a-z0-9-]{1,32}$/i.test(value);
const source = (index: RoadmapGateIndex): string | null => index.linkedDocument?.sourceHash ?? null;

/** Noncanonical in-memory owner. P2 may validate/project these operations; P3 alone may apply them. */
export class RoadmapNativeStageOwner {
    private readonly stages = new Map<string, NativeRoadmapStage>();
    private readonly staleRetries = new Map<string, string>();
    constructor(private readonly store: RoadmapStore) {}
    private async current(context: Context): Promise<RoadmapGateIndex> {
        const index = await this.store.read<RoadmapGateIndex>(context.root);
        const stage = this.stages.get(context.chatId);
        if (index.projectRoot !== context.root ||
            index.projectId !== context.projectId && !(context.projectId === 'uninitialized' &&
                stage?.context.projectId === 'uninitialized' && index.projectId === stage.ownerId))
            throw new Error('ROADMAP_OWNER_CHANGED');
        return index;
    }
    private async checkedSource(index: RoadmapGateIndex): Promise<void> {
        if (!index.linkedDocument) return;
        if (index.linkedDocument.syncState !== 'synced') throw new Error('ROADMAP_SOURCE_NOT_SYNCED');
        const file = await checkedRoadmapDocumentFile(index.projectRoot, index.linkedDocument.path);
        if (createHash('sha256').update(file.bytes).digest('hex') !== index.linkedDocument.sourceHash)
            throw new Error('ROADMAP_SOURCE_CHANGED');
    }
    private assert(stage: NativeRoadmapStage, context: Context, index: RoadmapGateIndex): void {
        // A selected apply can advance the canonical revision before its checked Markdown
        // projection finishes. Its verified sync changes the source hash without another
        // Roadmap revision; keep the remaining reviewed operations bound to that revision.
        if (stage.revision === index.revision && stage.sourceHash !== source(index) &&
            stage.operations.some(item => item.status === 'Applied') &&
            index.linkedDocument?.syncState === 'synced' &&
            index.linkedDocument.lastSynced?.sourceHash === index.linkedDocument.sourceHash)
            stage.sourceHash = index.linkedDocument.sourceHash;
        if (stage.context.root !== context.root || stage.context.projectId !== context.projectId ||
            stage.context.chatId !== context.chatId || stage.context.turnId !== context.turnId ||
            stage.context.lease !== context.lease || Date.now() >= stage.expires ||
            stage.revision !== index.revision || stage.sourceHash !== source(index))
            throw new Error('ROADMAP_STAGE_STALE');
    }
    async read(context: Context, args: unknown): Promise<unknown> {
        if (!object(args) || args.version !== 1 || Object.keys(args).some(k => !['version', 'ids', 'offset', 'limit', 'stageOffset'].includes(k)))
            throw new Error('ROADMAP_READ_ARGUMENTS');
        const ids = args.ids === undefined ? undefined : Array.isArray(args.ids) && args.ids.length <= 20 &&
            args.ids.every(id) ? new Set(args.ids as string[]) : undefined;
        if (args.ids !== undefined && !ids) throw new Error('ROADMAP_READ_IDS');
        const offset = args.offset ?? 0, limit = args.limit ?? 20;
        const stageOffset = args.stageOffset ?? 0;
        if (!Number.isSafeInteger(offset) || (offset as number) < 0 || !Number.isSafeInteger(limit) ||
            (limit as number) < 1 || (limit as number) > 20 || !Number.isSafeInteger(stageOffset) ||
            (stageOffset as number) < 0 || (stageOffset as number) > 48) throw new Error('ROADMAP_READ_PAGE');
        const index = await this.current(context);
        let syncState = index.linkedDocument?.syncState;
        if (syncState === 'synced') try { await this.checkedSource(index); }
        catch { syncState = 'source-changed'; }
        const entities = [
            ...index.phases.map(item => ({ kind: 'phase', value: { id: item.id, title: item.title,
                objective: item.objective, order: item.order, dependencies: item.dependencies,
                implementationStatus: item.implementationStatus, qualificationStatus: item.qualificationStatus } })),
            ...index.gates.map(item => ({ kind: 'gate', value: { id: item.id, parentPhaseId: item.parentPhaseId,
                designation: item.designation, title: item.title, purpose: item.purpose, order: item.order,
                dependencies: item.dependencies, implementationStatus: item.implementationStatus,
                qualificationStatus: item.qualificationStatus, criterionIds: item.criteria.map(c => c.id) } })),
            ...index.gates.flatMap(gate => gate.criteria.map(item => ({ kind: 'criterion',
                value: { id: item.id, gateId: gate.id, title: item.title, expectedResult: item.expectedResult,
                    order: item.order } }))),
            ...index.corrections.map(item => ({ kind: 'correction', value: { id: item.id, parent: item.parent,
                criterionId: item.criterionId, title: item.title, objective: item.objective, order: item.order,
                implementationStatus: item.implementationStatus, qualificationStatus: item.qualificationStatus } }))
        ].filter(entry => !ids || ids.has(entry.value.id));
        const page = entities.slice(offset as number, (offset as number) + (limit as number));
        const stage = this.stages.get(context.chatId);
        if (stage) this.assert(stage, context, index);
        return { version: 1, projectId: index.projectId, revision: index.revision,
            stageBasis: { expectedRevision: index.revision, expectedSourceHash: source(index) },
            link: index.linkedDocument ? { path: index.linkedDocument.path,
                sourceHash: index.linkedDocument.sourceHash, syncState } : null,
            entries: page, nextOffset: (offset as number) + page.length < entities.length ? (offset as number) + page.length : null,
            stage: stage ? { proposalId: stage.id, totalOperations: stage.operations.length,
                nextStage: (stage.operations.at(-1)?.batch ?? 0) + 1, done: stage.done,
                strategy: stage.strategy, operations: stage.operations.slice(stageOffset as number,
                    (stageOffset as number) + 8).map(item => ({ id: item.id, batch: item.batch,
                    action: item.action })), nextOperationOffset: (stageOffset as number) + 8 < stage.operations.length ?
                        (stageOffset as number) + 8 : null } : null };
    }
    async stage(context: Context, args: unknown): Promise<unknown> {
        if (!object(args) || args.version !== 1) throw new Error('ROADMAP_STAGE_ARGUMENTS: version must be 1');
        const allowed = ['version', 'expectedRevision', 'expectedSourceHash', 'expectedStage', 'done', 'strategy', 'actions'];
        if (Object.keys(args).some(k => !allowed.includes(k)))
            throw new Error('ROADMAP_STAGE_ARGUMENTS: unexpected top-level field');
        if (!Number.isSafeInteger(args.expectedRevision) || (args.expectedRevision as number) < 0)
            throw new Error('ROADMAP_STAGE_ARGUMENTS: expectedRevision must be a nonnegative integer from roadmap_read.stageBasis');
        if (args.expectedSourceHash !== null &&
            (typeof args.expectedSourceHash !== 'string' || !/^[a-f0-9]{64}$/.test(args.expectedSourceHash)))
            throw new Error('ROADMAP_STAGE_ARGUMENTS: expectedSourceHash must be the hash or JSON null from roadmap_read.stageBasis');
        if (!Number.isSafeInteger(args.expectedStage) || (args.expectedStage as number) < 1)
            throw new Error('ROADMAP_STAGE_ARGUMENTS: expectedStage must be a positive integer');
        if (!Array.isArray(args.actions) || !args.actions.length || args.actions.length > 8)
            throw new Error('ROADMAP_STAGE_ARGUMENTS: actions must contain 1-8 operations');
        if (Buffer.byteLength(JSON.stringify(args), 'utf8') > 16_000)
            throw new Error('ROADMAP_STAGE_ARGUMENTS: request exceeds 16KB');
        const index = await this.current(context);
        await this.checkedSource(index);
        const prior = this.stages.get(context.chatId);
        if (args.expectedRevision !== index.revision || args.expectedSourceHash !== source(index)) {
            if (prior || this.staleRetries.get(context.chatId) === context.turnId)
                throw new Error('ROADMAP_STAGE_STALE_SOURCE: stop; staged owner or source changed');
            this.staleRetries.set(context.chatId, context.turnId);
            throw new Error('ROADMAP_STAGE_STALE_SOURCE: read current Roadmap once and retry with stageBasis');
        }
        this.staleRetries.delete(context.chatId);
        if (prior) this.assert(prior, context, index);
        const priorAliases = new Map(prior?.entityIds ?? []);
        if (prior?.done) throw new Error('ROADMAP_STAGE_ALREADY_DONE');
        const expectedStage = (prior?.operations.at(-1)?.batch ?? 0) + 1;
        if (args.expectedStage !== expectedStage) throw new Error(`ROADMAP_STAGE_EXPECTED_${expectedStage}`);
        if (args.done !== undefined && typeof args.done !== 'boolean')
            throw new Error('ROADMAP_STAGE_MANIFEST: done must be boolean');
        if (args.strategy !== undefined && args.strategy !== 'full' && args.strategy !== 'phase-only')
            throw new Error('ROADMAP_STAGE_MANIFEST: strategy must be full or phase-only');
        if (prior && args.strategy !== undefined && args.strategy !== prior.strategy)
            throw new Error('ROADMAP_STAGE_MANIFEST: strategy cannot change within a stage');
        if ((prior?.operations.length ?? 0) + args.actions.length > 48) throw new Error('ROADMAP_STAGE_LIMIT');
        const kinds = new Map<string, string>([
            ...index.phases.map(item => [item.id, 'phase']), ...index.gates.map(item => [item.id, 'gate']),
            ...index.corrections.map(item => [item.id, 'correction']),
            ...index.gates.flatMap(gate => gate.criteria.map(item => [item.id, 'criterion']))
        ] as [string, string][]);
        const aliases = new Map(prior?.entityIds ?? []);
        for (const operation of prior?.operations ?? []) {
            const action = operation.action;
            if ('id' in action && typeof action.id === 'string' &&
                ['phase.create', 'gate.create', 'criterion.add', 'correction.attach'].includes(action.type))
                kinds.set(action.id, action.type.split('.')[0] === 'criterion' ? 'criterion' : action.type.split('.')[0]);
            if (action.type === 'gate.create') for (const criterion of action.criteria) kinds.set(criterion.id, 'criterion');
        }
        const accepted: Operation[] = [];
        const created: Record<string, string> = {};
        for (const [at, raw] of args.actions.entries()) {
            if (!object(raw) || typeof raw.type !== 'string' || !Object.hasOwn(NATIVE_ROADMAP_ACTION_FIELDS, raw.type))
                throw new Error(`ROADMAP_STAGE_ACTION_${at}: unsupported type; use a kind in roadmap_stage schema`);
            const actionType = raw.type;
            const required = NATIVE_ROADMAP_ACTION_FIELDS[actionType];
            const optional = raw.type === 'correction.attach' || raw.type === 'correction.reparent' ? ['criterionId'] : [];
            const missing = required.filter(field => !(field in raw));
            if (missing.length) throw new Error(`ROADMAP_STAGE_ACTION_${at}: missing ${missing.join(', ')}`);
            if (Object.keys(raw).some(field => field !== 'type' && !required.includes(field) && !optional.includes(field)))
                throw new Error(`ROADMAP_STAGE_ACTION_${at}: unexpected field for ${actionType}`);
            const create = ['phase.create', 'gate.create', 'criterion.add', 'correction.attach'].includes(raw.type);
            if (create && (!newId(raw.id) || aliases.has(raw.id)))
                throw new Error(`ROADMAP_STAGE_ACTION_${at}: distinct new: ID required`);
            if (create) { const durable = randomUUID(); aliases.set(raw.id as string, durable); created[raw.id as string] = durable;
                kinds.set(durable, raw.type.split('.')[0] === 'criterion' ? 'criterion' : raw.type.split('.')[0]); }
            if (raw.type === 'gate.create') {
                if (!Array.isArray(raw.criteria) || raw.criteria.length > 12)
                    throw new Error(`ROADMAP_STAGE_ACTION_${at}: criteria must be an array of at most 12`);
                for (const [criterionAt, criterion] of raw.criteria.entries()) {
                    const path = `ROADMAP_STAGE_ACTION_${at}.criteria[${criterionAt}]`;
                    if (!object(criterion) || Object.keys(criterion).sort().join(',') !== 'expectedResult,id,title')
                        throw new Error(`${path}: requires only id, title, expectedResult`);
                    if (!newId(criterion.id) || aliases.has(criterion.id))
                        throw new Error(`${path}.id: distinct new: ID required`);
                    if (!text(criterion.title)) throw new Error(`${path}.title: invalid text`);
                    if (!text(criterion.expectedResult)) throw new Error(`${path}.expectedResult: invalid text`);
                    const durable = randomUUID(); aliases.set(criterion.id, durable); created[criterion.id] = durable; kinds.set(durable, 'criterion');
                }
            }
            const replace = (value: unknown): unknown => {
                if (typeof value === 'string') return aliases.get(value) ?? value;
                if (Array.isArray(value)) return value.map(replace);
                if (object(value)) return Object.fromEntries(Object.entries(value).map(([key, part]) => [key, replace(part)]));
                return value;
            };
            const action = replace(raw) as GatePlanningAction;
            for (const [field, value] of Object.entries(action as unknown as Record<string, unknown>)) {
                if (field === 'type') continue;
                if (['title', 'objective', 'purpose', 'expectedResult', 'designation'].includes(field) && !text(value))
                    throw new Error(`ROADMAP_STAGE_ACTION_${at}: invalid ${field}`);
                if (['id', 'gateId', 'parentPhaseId', 'criterionId'].includes(field) && (!id(value) || !kinds.has(value)))
                    throw new Error(`ROADMAP_STAGE_ACTION_${at}: unknown ${field}`);
                if (field === 'id' && kinds.get(value as string) !== actionType.split('.')[0] ||
                    field === 'gateId' && kinds.get(value as string) !== 'gate' ||
                    field === 'parentPhaseId' && kinds.get(value as string) !== 'phase' ||
                    field === 'criterionId' && kinds.get(value as string) !== 'criterion')
                    throw new Error(`ROADMAP_STAGE_ACTION_${at}: wrong ${field} kind`);
                if (field === 'parent' && (!object(value) || !['phase', 'gate'].includes(value.kind as string) ||
                    Object.keys(value).sort().join(',') !== 'id,kind' || !id(value.id) ||
                    kinds.get(value.id) !== value.kind)) throw new Error(`ROADMAP_STAGE_ACTION_${at}: invalid parent`);
                if (['ids', 'dependencies'].includes(field) && (!Array.isArray(value) || value.length > 32 ||
                    value.some(part => !id(part) || kinds.get(part) !== (field === 'dependencies' ? actionType.split('.')[0] :
                        actionType === 'criterion.reorder' ? 'criterion' : actionType.split('.')[0])) ||
                    new Set(value).size !== value.length))
                    throw new Error(`ROADMAP_STAGE_ACTION_${at}: invalid ${field}`);
                if (field === 'order' && (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > 4096))
                    throw new Error(`ROADMAP_STAGE_ACTION_${at}: invalid order`);
            }
            accepted.push({ id: randomUUID(), action, batch: expectedStage, status: 'Pending' });
        }
        const stage: NativeRoadmapStage = prior ?? { id: randomUUID(), context, revision: index.revision,
            ownerId: index.revision === 0 ? randomUUID() : index.projectId,
            sourceHash: source(index), expires: Date.now() + 10 * 60_000, operations: [], entityIds: new Map(),
            done: false, strategy: args.strategy === 'phase-only' ? 'phase-only' : 'full' };
        if (stage.strategy === 'phase-only' && accepted.some(item => !item.action.type.startsWith('phase.')))
            throw new Error('ROADMAP_STAGE_PHASE_ONLY_HAS_NON_PHASE');
        stage.operations.push(...accepted); stage.entityIds = aliases;
        this.stages.set(context.chatId, stage);
        if (args.done === true) {
            try { await this.complete(context); }
            catch (error) {
                stage.operations.splice(stage.operations.length - accepted.length);
                stage.entityIds = priorAliases;
                throw error;
            }
            stage.done = true;
        }
        return { version: 1, proposalId: stage.id, acceptedOperationIds: accepted.map(item => item.id),
            createdEntityIds: created, totalOperations: stage.operations.length, nextStage: expectedStage + 1,
            complete: stage.done, strategy: stage.strategy };
    }
    async complete(context: Context): Promise<{ before: RoadmapGateIndex; after: RoadmapGateIndex; stage: NativeRoadmapStage }> {
        const before = await this.current(context);
        await this.checkedSource(before);
        const stage = this.stages.get(context.chatId);
        if (!stage) throw new Error('ROADMAP_STAGE_MISSING');
        this.assert(stage, context, before);
        if (!stage.operations.length) throw new Error('ROADMAP_STAGE_EMPTY');
        const actions = stage.operations.map(item => item.action);
        let after: RoadmapGateIndex;
        try { after = await this.store.mutateGateIndex(context.root, before.revision, stage.ownerId, actions, true); }
        catch (error) {
            // Find the first failing operation against the same unchanged owner. Never report a vague aggregate error.
            for (let at = 0; at < actions.length; at++) {
                try { await this.store.mutateGateIndex(context.root, before.revision, stage.ownerId,
                    actions.slice(0, at + 1), true); }
                catch (cause) { throw new Error(`ROADMAP_STAGE_OPERATION_${stage.operations[at].id}: ${String(cause)}`); }
            }
            throw error;
        }
        if (stage.strategy === 'full' && after.phases.length && !after.gates.length)
            throw new Error('ROADMAP_STAGE_FULL_MISSING_GATE: choose phase-only strategy for an intentional phase-only draft');
        if (stage.strategy === 'full' && stage.revision === 0 && after.phases.some(phase =>
            !after.gates.some(gate => gate.parentPhaseId === phase.id)))
            throw new Error('ROADMAP_STAGE_FULL_INCOMPLETE_PHASE: each proposed Phase needs a Gate');
        if (after.phases.length + after.gates.length + after.corrections.length +
            after.gates.reduce((sum, gate) => sum + gate.criteria.length, 0) > 64)
            throw new Error('ROADMAP_STAGE_PROJECTION_LIMIT: reduce the draft to 64 entities');
        return { before, after, stage };
    }

    /** Review binds the exact subset to one fresh canonical basis; selection alone has no effect. */
    async review(context: Context, ids: readonly string[], decision: 'apply' | 'reject'):
        Promise<{ token: string; before: RoadmapGateIndex; after?: RoadmapGateIndex; indexHash: string | null }> {
        const before = await this.current(context);
        await this.checkedSource(before);
        const stage = this.stages.get(context.chatId);
        if (!stage || !stage.done) throw new Error('ROADMAP_REVIEW_MISSING');
        this.assert(stage, context, before);
        if (!ids.length || ids.length > 48 || new Set(ids).size !== ids.length ||
            ids.some(opId => !stage.operations.some(item => item.id === opId && item.status === 'Pending')))
            throw new Error('ROADMAP_REVIEW_SELECTION_CHANGED');
        const selected = new Set(ids);
        const operations = stage.operations.filter(item => selected.has(item.id));
        // A rejected creator cannot leave a pending operation referring to its identity.
        if (decision === 'reject') for (const item of operations) {
            const action = item.action;
            if (!['phase.create', 'gate.create', 'criterion.add', 'correction.attach'].includes(action.type)) continue;
            const created = new Set<string>(['id' in action ? action.id ?? '' : '',
                ...(action.type === 'gate.create' ? action.criteria.map(criterion => criterion.id) : [])]);
            const dependent = stage.operations.find(other => other.status === 'Pending' && !selected.has(other.id) &&
                [...created].some(entityId => entityId && JSON.stringify(other.action).includes(`"${entityId}"`)));
            if (dependent) throw new Error(`ROADMAP_REVIEW_DEPENDENT_${dependent.id}: select the dependent operation too`);
        }
        let after: RoadmapGateIndex | undefined;
        if (decision === 'apply') {
            // The domain validator checks parents, dependency closure, cycles, ordering and no-op.
            after = await this.store.mutateGateIndex(context.root, before.revision, stage.ownerId,
                operations.map(item => item.action), true);
        }
        const indexHash = await this.store.gateIndexHash(context.root);
        if (!indexHash && before.revision !== 0) throw new Error('ROADMAP_REVIEW_INDEX_MISSING');
        const token = randomUUID();
        stage.review = { token, ids: [...ids], decision, revision: before.revision, indexHash };
        return { token, before, after, indexHash };
    }

    async decide(context: Context, token: string, ids: readonly string[], decision: 'apply' | 'reject'):
        Promise<{ revision?: number; changedIds: string[]; statuses: { id: string; status: NativeOperationStatus }[] }> {
        const stage = this.stages.get(context.chatId);
        const review = stage?.review;
        if (!stage || !review || review.token !== token || review.decision !== decision ||
            JSON.stringify(review.ids) !== JSON.stringify(ids)) throw new Error('ROADMAP_APPROVAL_UNAVAILABLE');
        stage.review = undefined; // one use, including failed and duplicate clicks
        const before = await this.current(context);
        await this.checkedSource(before);
        this.assert(stage, context, before);
        if (review.revision !== before.revision || review.indexHash !== await this.store.gateIndexHash(context.root))
            throw new Error('ROADMAP_APPROVAL_STALE_INDEX');
        const selected = new Set(ids);
        const operations = stage.operations.filter(item => selected.has(item.id) && item.status === 'Pending');
        if (operations.length !== ids.length) throw new Error('ROADMAP_APPROVAL_SELECTION_CHANGED');
        let revision: number | undefined;
        let changedIds: string[] = [];
        if (decision === 'apply') {
            const after = await this.store.mutateGateIndex(context.root, before.revision, stage.ownerId,
                operations.map(item => item.action), false, { indexHash: review.indexHash, operationIds: [...ids] });
            revision = after.revision;
            const entities = (index: RoadmapGateIndex) => [...index.phases, ...index.gates,
                ...index.corrections, ...index.gates.flatMap(gate => gate.criteria)];
            const old = new Map(entities(before).map(item => [item.id, item]));
            const next = new Map(entities(after).map(item => [item.id, item]));
            changedIds = [...new Set([...old.keys(), ...next.keys()])].filter(entityId =>
                JSON.stringify(old.get(entityId)) !== JSON.stringify(next.get(entityId)));
            stage.revision = revision;
            stage.sourceHash = source(after);
        }
        for (const item of operations) item.status = decision === 'apply' ? 'Applied' : 'Rejected';
        return { revision, changedIds, statuses: stage.operations.map(item => ({ id: item.id, status: item.status })) };
    }
    async cancel(context: Context, args: unknown): Promise<unknown> {
        if (!object(args) || args.version !== 1 || Object.keys(args).join(',') !== 'version') throw new Error('ROADMAP_CANCEL_ARGUMENTS');
        const index = await this.current(context);
        await this.checkedSource(index);
        const stage = this.stages.get(context.chatId);
        if (!stage) return { version: 1, cancelled: false };
        this.assert(stage, context, index);
        this.stages.delete(context.chatId);
        return { version: 1, cancelled: true, proposalId: stage.id, cancelledOperationIds: stage.operations.map(item => item.id) };
    }
    forget(chatId: string): void { this.stages.delete(chatId); }
    get(chatId: string): NativeRoadmapStage | undefined { return this.stages.get(chatId); }
}
