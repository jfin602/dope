import { createHash, randomUUID } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { RoadmapStore } from './roadmap-store';
import type { RoadmapCheckpoint, RoadmapGateMutation, RoadmapIndex, RoadmapLink } from './roadmap-store';
import type { RoadmapGateIndex } from './roadmap-gate-domain';
import { RoadmapOwnerLinks } from './roadmap-owner-links';
import type { RoadmapOwnerRecord } from './roadmap-owner-links';
import type { RoadmapDocumentPatch } from './roadmap-document-patch';

export interface RoadmapPlanningRecord { owner: 'planning-map' | 'transformation' | 'work-item' }
export interface RoadmapPlanningLinks {
    resolve(root: string, link: RoadmapLink): Promise<RoadmapPlanningRecord | undefined>;
}
export type GatePlanningAction = Extract<RoadmapGateMutation, { type:
    'phase.create' | 'phase.edit' | 'phase.reorder' | 'phase.dependencies' |
    'gate.create' | 'gate.edit' | 'gate.reorder' | 'gate.dependencies' |
    'criterion.add' | 'criterion.edit' | 'criterion.reorder' }> & { id?: string };
type RuntimeSnapshot = RoadmapIndex & Pick<RoadmapGateIndex, 'phases' | 'gates' | 'corrections'>;
/** Legacy compile seam for consumers migrated in P8–P17. Runtime rejects these operations. */
type RetiredAction =
    | { type: 'create'; id: string; kind: RoadmapCheckpoint['kind']; title: string; objective: string; order: number }
    | { type: 'edit'; id: string; title?: string; objective?: string }
    | { type: 'document-edit'; id: string; title?: string; objective?: string; order?: number; prose?: string }
    | { type: 'link' | 'unlink'; id: string; link: RoadmapLink }
    | { type: 'depend' | 'undepend'; id: string; dependencyId: string }
    | { type: 'reorder'; id: string; order: number }
    | { type: 'status'; id: string; status: 'unknown' | 'active' | 'not-implemented' | 'not-green' };
export type PlanningAction = GatePlanningAction | RetiredAction;
export interface PlanningActionRequest {
    projectHandle: string;
    ownerId: string;
    expectedRevision: number;
    /** The current linked source fingerprint, keyed by the edited stable entity ID. */
    sourceHashes?: Record<string, string>;
    actions: PlanningAction[];
}
export interface PlanningActionPreview {
    token: string;
    ownerId: string;
    revision: number;
    changedIds: string[];
    requiresApproval: boolean;
    /** Schema-two runtime; intersection keeps retired consumers compiling until P17. */
    next: RuntimeSnapshot;
    documentDiff?: Pick<RoadmapDocumentPatch, 'path' | 'changedLines' | 'beforeHash' | 'afterHash'>;
}
export interface PlanningUndoRequest { projectHandle: string; ownerId: string; expectedRevision: number; token: string }
export type PlanningLinkResolver = (root: string, link: RoadmapLink) => Promise<boolean>;

const specification: Record<GatePlanningAction['type'], readonly string[]> = {
    'phase.create': ['type', 'id', 'title', 'objective'],
    'phase.edit': ['type', 'id', 'title', 'objective'],
    'phase.reorder': ['type', 'ids'],
    'phase.dependencies': ['type', 'id', 'dependencies'],
    'gate.create': ['type', 'id', 'parentPhaseId', 'designation', 'title', 'purpose', 'criteria'],
    'gate.edit': ['type', 'id', 'title', 'purpose'],
    'gate.reorder': ['type', 'parentPhaseId', 'ids'],
    'gate.dependencies': ['type', 'id', 'dependencies'],
    'criterion.add': ['type', 'gateId', 'id', 'title', 'expectedResult'],
    'criterion.edit': ['type', 'gateId', 'id', 'title', 'expectedResult'],
    'criterion.reorder': ['type', 'gateId', 'ids']
};
const digest = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const copy = <T>(value: T): T => structuredClone(value);
const record = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === 'object' && !Array.isArray(value);
const validId = (value: unknown): value is string => typeof value === 'string' &&
    value.length > 0 && value.length <= 256 && value.trim() === value && !/[\x00-\x1f\x7f]/.test(value);

/** One project-bound, reviewable schema-two action through the RoadmapStore writer. */
export class ProjectPlanningActions {
    private readonly handles = new Map<string, { root: string; ownerId: string }>();
    private readonly undo = new Map<string, { ownerId: string; revision: number; before: RoadmapGateIndex; after: RoadmapGateIndex; token: string }>();
    private readonly owners = new RoadmapOwnerLinks();

    constructor(private readonly store: RoadmapStore, private readonly resolveLink?: PlanningLinkResolver,
        private readonly planningLinks?: RoadmapPlanningLinks) {}

    async attach(root: string): Promise<{ projectHandle: string; snapshot: RuntimeSnapshot }> {
        if (!isAbsolute(root) || resolve(root) !== root || await realpath(root) !== root) throw new Error('Invalid planning root');
        const snapshot = await this.store.read<RoadmapGateIndex>(root);
        if (!snapshot.revision) throw new Error('Roadmap must be initialized before planning actions');
        const projectHandle = randomUUID();
        this.handles.set(projectHandle, { root, ownerId: snapshot.projectId });
        return { projectHandle, snapshot: copy(snapshot) as unknown as RuntimeSnapshot };
    }
    detach(projectHandle: string): void { this.handles.delete(projectHandle); this.undo.delete(projectHandle); }
    private binding(handle: string, ownerId: string): { root: string; ownerId: string } {
        const value = this.handles.get(handle);
        if (!value || value.ownerId !== ownerId) throw new Error('Foreign or disposed planning handle');
        return value;
    }
    async read(projectHandle: string, ownerId: string, selectedId?: string): Promise<RoadmapGateIndex | {
        selected: RoadmapGateIndex['gates'][number] | RoadmapGateIndex['phases'][number];
        neighbors: RoadmapGateIndex['gates']; revision: number }> {
        const { root } = this.binding(projectHandle, ownerId);
        const snapshot = await this.store.read<RoadmapGateIndex>(root);
        if (snapshot.projectId !== ownerId) throw new Error('Planning owner changed');
        if (selectedId === undefined) return copy(snapshot);
        const selected = snapshot.gates.find(item => item.id === selectedId) ?? snapshot.phases.find(item => item.id === selectedId);
        if (!selected) throw new Error('Unknown Roadmap Gate or Phase');
        const neighbors = snapshot.gates.filter(item => item.dependencies.includes(selectedId) ||
            selected.dependencies.includes(item.id));
        return copy({ selected, neighbors, revision: snapshot.revision });
    }
    async readOwner(projectHandle: string, ownerId: string, link: RoadmapLink): Promise<RoadmapOwnerRecord | RoadmapPlanningRecord | undefined> {
        const { root } = this.binding(projectHandle, ownerId);
        if ((await this.store.read<RoadmapGateIndex>(root)).projectId !== ownerId) throw new Error('Planning owner changed');
        return ['planning-map', 'transformation', 'work-item'].includes(link.owner)
            ? this.planningLinks?.resolve(root, link) : this.owners.resolve(root, link);
    }
    async readDetached(projectHandle: string, ownerId: string): Promise<RoadmapOwnerRecord[]> {
        const { root } = this.binding(projectHandle, ownerId);
        const snapshot = await this.store.read<RoadmapGateIndex>(root);
        if (snapshot.projectId !== ownerId) throw new Error('Planning owner changed');
        // Schema-two Gates do not carry the retired checkpoint link array. Keep the
        // original owner inventory available while its Gate attachment moves in P9.
        return (await this.owners.list(root)).filter(record =>
            record.owner === 'issue' || record.artifact.type === 'idea');
    }
    private checked(request: PlanningActionRequest): { root: string; operation: GatePlanningAction } {
        if (!record(request) || Object.keys(request).some(key => !['projectHandle', 'ownerId', 'expectedRevision', 'sourceHashes', 'actions'].includes(key)) ||
            !validId(request.ownerId) || !Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 1 ||
            !Array.isArray(request.actions) || request.actions.length !== 1)
            throw new Error('Invalid planning action request');
        const { root } = this.binding(request.projectHandle, request.ownerId);
        const action = request.actions[0];
        if (!record(action) || typeof action.type !== 'string' || !Object.hasOwn(specification, action.type))
            throw new Error('Unknown or retired planning action type');
        const fields = specification[action.type as GatePlanningAction['type']];
        if (Object.keys(action).length !== fields.length || fields.some(key => !Object.hasOwn(action, key)))
            throw new Error('Invalid Gate planning action fields');
        if (request.sourceHashes !== undefined && (!record(request.sourceHashes) ||
            Object.entries(request.sourceHashes).some(([key, hash]) => !validId(key) || typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash))))
            throw new Error('Invalid planning source hashes');
        return { root, operation: action as GatePlanningAction };
    }
    private sourceCheck(current: RoadmapGateIndex, request: PlanningActionRequest, operation: GatePlanningAction): void {
        if (!current.linkedDocument) return;
        const targets = [operation.type === 'criterion.add' || operation.type === 'criterion.edit' || operation.type === 'criterion.reorder'
            ? operation.gateId : operation.type === 'gate.reorder' ? operation.parentPhaseId :
                'id' in operation ? operation.id : undefined].filter((id): id is string => !!id);
        if (targets.some(id => current.linkedDocument!.sections.some(section => section.id === id) &&
            request.sourceHashes?.[id] !== current.linkedDocument!.sourceHash))
            throw new Error('Stale or missing linked Roadmap source hash');
    }
    async preview(request: PlanningActionRequest): Promise<PlanningActionPreview> {
        const { root, operation } = this.checked(request);
        const current = await this.store.read<RoadmapGateIndex>(root);
        if (current.projectId !== request.ownerId || current.revision !== request.expectedRevision)
            throw new Error('Stale or foreign planning owner revision');
        this.sourceCheck(current, request, operation);
        const next = await this.store.mutateGateIndex(root, current.revision, current.projectId, operation, true);
        const changedIds = [...next.phases, ...next.gates, ...next.corrections]
            .filter(item => JSON.stringify(item) !== JSON.stringify([...current.phases, ...current.gates, ...current.corrections]
                .find(previous => previous.id === item.id))).map(item => item.id);
        const token = digest({ ownerId: current.projectId, revision: current.revision, operation,
            sourceHashes: request.sourceHashes, current, next });
        return { token, ownerId: current.projectId, revision: current.revision,
            changedIds, requiresApproval: true, next: next as unknown as RuntimeSnapshot };
    }
    async apply(request: PlanningActionRequest, token: string, approved = false): Promise<RuntimeSnapshot> {
        if (!approved) throw new Error('Planning action approval required');
        const { root, operation } = this.checked(request);
        const current = await this.store.read<RoadmapGateIndex>(root);
        const preview = await this.preview(request);
        if (preview.token !== token) throw new Error('Stale or foreign planning preview token');
        this.sourceCheck(current, request, operation);
        const next = await this.store.mutateGateIndex(root, request.expectedRevision, request.ownerId, operation);
        const undoToken = randomUUID();
        this.undo.set(request.projectHandle, { ownerId: request.ownerId, revision: next.revision,
            before: current, after: next, token: undoToken });
        return next as unknown as RuntimeSnapshot;
    }
    undoToken(projectHandle: string, ownerId: string): string | undefined {
        this.binding(projectHandle, ownerId);
        return this.undo.get(projectHandle)?.token;
    }
    async undoEligible(request: PlanningUndoRequest): Promise<RuntimeSnapshot> {
        const { root } = this.binding(request.projectHandle, request.ownerId);
        const entry = this.undo.get(request.projectHandle);
        if (!entry || entry.ownerId !== request.ownerId || entry.token !== request.token)
            throw new Error('Undo conflict');
        const current = await this.store.read<RoadmapGateIndex>(root);
        if (current.revision !== request.expectedRevision || current.revision !== entry.revision ||
            JSON.stringify(current) !== JSON.stringify(entry.after)) throw new Error('Stale Roadmap revision');
        const restored = { ...copy(entry.before), revision: current.revision + 1 };
        const result = await this.store.saveGateIndex(root, current.revision, request.ownerId, restored);
        this.undo.delete(request.projectHandle);
        return result as unknown as RuntimeSnapshot;
    }
}
