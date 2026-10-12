import { createHash, randomUUID } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { parseRoadmapIndex, RoadmapStore } from './roadmap-store';
import type { RoadmapCheckpoint, RoadmapIndex, RoadmapLink } from './roadmap-store';
import { RoadmapOwnerLinks } from './roadmap-owner-links';
import type { RoadmapOwnerRecord } from './roadmap-owner-links';
export interface RoadmapPlanningRecord { owner: 'planning-map' | 'transformation' | 'work-item' }
export interface RoadmapPlanningLinks {
    resolve(root: string, link: RoadmapLink): Promise<RoadmapPlanningRecord | undefined>;
}

export type PlanningAction =
    | { type: 'create'; id: string; kind: RoadmapCheckpoint['kind']; title: string; objective: string; order: number }
    | { type: 'edit'; id: string; title?: string; objective?: string }
    | { type: 'link'; id: string; link: RoadmapLink }
    | { type: 'unlink'; id: string; link: RoadmapLink }
    | { type: 'depend'; id: string; dependencyId: string }
    | { type: 'undepend'; id: string; dependencyId: string }
    | { type: 'reorder'; id: string; order: number }
    | { type: 'status'; id: string; status: 'unknown' | 'active' | 'not-implemented' | 'not-green' };

export interface PlanningActionRequest {
    projectHandle: string;
    ownerId: string;
    expectedRevision: number;
    /** Required for each source-backed checkpoint touched by the batch. */
    sourceHashes?: Record<string, string>;
    actions: PlanningAction[];
}
export interface PlanningActionPreview {
    token: string;
    ownerId: string;
    revision: number;
    changedIds: string[];
    requiresApproval: boolean;
    next: RoadmapIndex;
}
export interface PlanningUndoRequest { projectHandle: string; ownerId: string; expectedRevision: number; token: string }
export type PlanningLinkResolver = (root: string, link: RoadmapLink) => Promise<boolean>;

const keys = (value: Record<string, unknown>, required: string[], optional: string[] = []): void => {
    if (required.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key)))
        throw new Error('Invalid planning action fields');
};
const object = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid planning action');
    return value as Record<string, unknown>;
};
const validId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\x00-\x1f]/.test(value);
const validText = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max && !value.includes('\0');
const validOrder = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const linkKey = (link: RoadmapLink): string => `${link.owner}\0${link.targetId}`;
const digest = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Provider-neutral authority for Roadmap-owned planning changes. External owners remain read-only here. */
export class ProjectPlanningActions {
    private readonly handles = new Map<string, { root: string; ownerId: string }>();
    private readonly undo = new Map<string, { ownerId: string; revision: number; before: RoadmapCheckpoint; after: RoadmapCheckpoint }>();

    private readonly owners = new RoadmapOwnerLinks();

    constructor(private readonly store: RoadmapStore, private readonly resolveLink?: PlanningLinkResolver,
        private readonly planningLinks?: RoadmapPlanningLinks) {}

    async attach(root: string): Promise<{ projectHandle: string; snapshot: RoadmapIndex }> {
        if (!isAbsolute(root) || resolve(root) !== root || await realpath(root) !== root) throw new Error('Invalid planning root');
        const snapshot = await this.store.read(root);
        if (!snapshot.revision) throw new Error('Roadmap must be initialized before planning actions');
        const projectHandle = randomUUID();
        this.handles.set(projectHandle, { root, ownerId: snapshot.projectId });
        return { projectHandle, snapshot: copy(snapshot) };
    }

    detach(projectHandle: string): void { this.handles.delete(projectHandle); this.undo.delete(projectHandle); }

    private binding(projectHandle: string, ownerId: string): { root: string; ownerId: string } {
        const binding = this.handles.get(projectHandle);
        if (!binding || binding.ownerId !== ownerId) throw new Error('Foreign or disposed planning handle');
        return binding;
    }

    async read(projectHandle: string, ownerId: string, selectedId?: string): Promise<RoadmapIndex | { selected: RoadmapCheckpoint; neighbors: RoadmapCheckpoint[]; revision: number }> {
        const { root } = this.binding(projectHandle, ownerId);
        const snapshot = await this.store.read(root);
        if (snapshot.projectId !== ownerId) throw new Error('Planning owner changed');
        if (selectedId === undefined) return copy(snapshot);
        const selected = snapshot.checkpoints.find(item => item.id === selectedId);
        if (!selected) throw new Error('Unknown Roadmap checkpoint');
        const neighbors = snapshot.checkpoints.filter(item => selected.dependencies.includes(item.id) || item.dependencies.includes(selectedId));
        return copy({ selected, neighbors, revision: snapshot.revision });
    }

    async readOwner(projectHandle: string, ownerId: string, link: RoadmapLink): Promise<RoadmapOwnerRecord | RoadmapPlanningRecord | undefined> {
        const { root } = this.binding(projectHandle, ownerId);
        if ((await this.store.read(root)).projectId !== ownerId) throw new Error('Planning owner changed');
        return ['planning-map', 'transformation', 'work-item'].includes(link.owner)
            ? this.planningLinks?.resolve(root, link) : this.owners.resolve(root, link);
    }

    async readDetached(projectHandle: string, ownerId: string): Promise<RoadmapOwnerRecord[]> {
        const { root } = this.binding(projectHandle, ownerId);
        const roadmap = await this.store.read(root);
        if (roadmap.projectId !== ownerId) throw new Error('Planning owner changed');
        return this.owners.detached(root, roadmap);
    }

    private validateRequest(request: PlanningActionRequest): { root: string; ownerId: string } {
        const value = object(request);
        keys(value, ['projectHandle', 'ownerId', 'expectedRevision', 'actions'], ['sourceHashes']);
        const binding = this.binding(request.projectHandle, request.ownerId);
        if (!validOrder(request.expectedRevision) || request.expectedRevision === 0 || !Array.isArray(request.actions) ||
            request.actions.length < 1 || request.actions.length > 32) throw new Error('Invalid planning action request');
        if (request.sourceHashes !== undefined) {
            const hashes = object(request.sourceHashes);
            if (Object.keys(hashes).some(key => !validId(key) || typeof hashes[key] !== 'string' || !/^[a-f0-9]{64}$/.test(hashes[key] as string)))
                throw new Error('Invalid planning source hashes');
        }
        return binding;
    }

    private async project(current: RoadmapIndex, request: PlanningActionRequest, root: string): Promise<PlanningActionPreview> {
        if (current.projectId !== request.ownerId || current.revision !== request.expectedRevision)
            throw new Error('Stale or foreign planning owner revision');
        const checkpoints = copy(current.checkpoints);
        let requiresApproval = false;
        for (const raw of request.actions) {
            const action = object(raw) as PlanningAction;
            if (!validId(action.id)) throw new Error('Invalid checkpoint identity');
            if (action.type === 'create') {
                keys(action, ['type', 'id', 'kind', 'title', 'objective', 'order']);
                if (!['phase', 'correction', 'milestone'].includes(action.kind) || !validText(action.title, 512) ||
                    !action.title.trim() || !validText(action.objective, 8192) || !validOrder(action.order) ||
                    checkpoints.some(item => item.id === action.id)) throw new Error('Invalid checkpoint creation');
                checkpoints.push({ id: action.id, kind: action.kind, title: action.title, objective: action.objective,
                    order: action.order, dependencies: [], links: [], status: 'unknown', readOnly: false, evidence: [] });
                continue;
            }
            const item = checkpoints.find(entry => entry.id === action.id);
            if (!item || item.readOnly) throw new Error('Unknown or read-only Roadmap checkpoint');
            if (item.source && request.sourceHashes?.[item.id] !== item.source.sha256) throw new Error('Stale Roadmap source hash');
            switch (action.type) {
                case 'edit':
                    keys(action, ['type', 'id'], ['title', 'objective']);
                    if (action.title === undefined && action.objective === undefined ||
                        action.title !== undefined && (!validText(action.title, 512) || !action.title.trim()) ||
                        action.objective !== undefined && !validText(action.objective, 8192) ||
                        item.source && action.title !== undefined && action.title !== item.title) throw new Error('Invalid Roadmap edit');
                    if (action.title !== undefined) item.title = action.title;
                    if (action.objective !== undefined) item.objective = action.objective;
                    break;
                case 'link': case 'unlink': {
                    keys(action, ['type', 'id', 'link']);
                    const link = object(action.link) as unknown as RoadmapLink;
                    keys(link as unknown as Record<string, unknown>, ['owner', 'targetId'], ['ownerRevision', 'sourceHash', 'ownerProjectId', 'basis']);
                    if (!['document', 'project-mind', 'issue', 'planning-map', 'transformation', 'work-item', 'evidence'].includes(link.owner) ||
                        !validId(link.targetId) || link.ownerRevision !== undefined && !validOrder(link.ownerRevision) ||
                        link.sourceHash !== undefined && !/^[a-f0-9]{64}$/.test(link.sourceHash) ||
                        (link.owner === 'document' || link.owner === 'evidence' ? !link.sourceHash :
                            link.owner === 'issue' ? link.sourceHash === undefined && link.ownerRevision === undefined :
                                link.ownerRevision === undefined))
                        throw new Error('Invalid Roadmap link');
                    if (['planning-map', 'transformation', 'work-item'].includes(link.owner) &&
                        (!this.planningLinks || !link.ownerProjectId || !link.basis || link.sourceHash !== undefined))
                        throw new Error('Planning Map link requires exact owner and basis');
                    const index = item.links.findIndex(existing => linkKey(existing) === linkKey(link));
                    if (action.type === 'link') {
                        if (index >= 0 || !(['planning-map', 'transformation', 'work-item'].includes(link.owner)
                            ? await this.planningLinks?.resolve(root, link) :
                            this.resolveLink ? await this.resolveLink(root, link) : await this.owners.resolve(root, link)))
                            throw new Error('Foreign or unresolved Roadmap link');
                        item.links.push(link);
                    } else {
                        if (index < 0 || JSON.stringify(item.links[index]) !== JSON.stringify(link)) throw new Error('Unknown or changed Roadmap link');
                        item.links.splice(index, 1);
                        requiresApproval = true;
                    }
                    break;
                }
                case 'depend': case 'undepend':
                    keys(action, ['type', 'id', 'dependencyId']);
                    if (!validId(action.dependencyId) || !checkpoints.some(entry => entry.id === action.dependencyId) || action.dependencyId === item.id)
                        throw new Error('Foreign or invalid Roadmap dependency');
                    if (action.type === 'depend') {
                        if (item.dependencies.includes(action.dependencyId)) throw new Error('Duplicate Roadmap dependency');
                        item.dependencies.push(action.dependencyId);
                    } else {
                        if (!item.dependencies.includes(action.dependencyId)) throw new Error('Unknown Roadmap dependency');
                        item.dependencies = item.dependencies.filter(id => id !== action.dependencyId);
                        requiresApproval = true;
                    }
                    break;
                case 'reorder':
                    keys(action, ['type', 'id', 'order']);
                    if (!validOrder(action.order)) throw new Error('Invalid Roadmap order');
                    item.order = action.order;
                    break;
                case 'status':
                    keys(action, ['type', 'id', 'status']);
                    if (!['unknown', 'active', 'not-implemented', 'not-green'].includes(action.status) || item.source ||
                        item.status === 'green' || item.status === 'waived') throw new Error('Roadmap gate promotion requires evidence authority');
                    item.status = action.status;
                    requiresApproval = true;
                    break;
                default: throw new Error('Unknown planning action type');
            }
        }
        const next = parseRoadmapIndex({ ...current, revision: current.revision + 1, checkpoints }, root);
        const before = new Map(current.checkpoints.map(item => [item.id, item]));
        const changedIds = checkpoints.filter(item => JSON.stringify(item) !== JSON.stringify(before.get(item.id))).map(item => item.id);
        if (!changedIds.length) throw new Error('Planning action makes no change');
        return { token: digest({ ownerId: current.projectId, revision: current.revision, actions: request.actions,
            sourceHashes: request.sourceHashes, next }), ownerId: current.projectId, revision: current.revision,
            changedIds, requiresApproval, next };
    }

    async preview(request: PlanningActionRequest): Promise<PlanningActionPreview> {
        const { root } = this.validateRequest(request);
        return this.project(await this.store.read(root), request, root);
    }

    async apply(request: PlanningActionRequest, token: string, approved = false): Promise<RoadmapIndex> {
        const { root } = this.validateRequest(request);
        if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new Error('Invalid planning preview token');
        let undo: { before: RoadmapCheckpoint; after: RoadmapCheckpoint } | undefined;
        const result = await this.store.transact(root, request.expectedRevision, request.ownerId, async current => {
            const preview = await this.project(current, request, root);
            if (preview.token !== token || preview.requiresApproval && !approved) throw new Error('Planning preview or approval required');
            if (request.actions.length === 1 && preview.changedIds.length === 1 &&
                ['edit', 'link', 'depend', 'reorder'].includes(request.actions[0].type)) {
                const before = current.checkpoints.find(item => item.id === preview.changedIds[0]);
                const after = preview.next.checkpoints.find(item => item.id === preview.changedIds[0]);
                if (before && after) undo = { before: copy(before), after: copy(after) };
            }
            return preview.next.checkpoints;
        });
        if (undo) this.undo.set(request.projectHandle, { ownerId: request.ownerId, revision: result.revision, ...undo });
        else this.undo.delete(request.projectHandle);
        return copy(result);
    }

    async undoEligible(request: PlanningUndoRequest): Promise<RoadmapIndex> {
        const { root } = this.binding(request.projectHandle, request.ownerId);
        const entry = this.undo.get(request.projectHandle);
        if (!entry || entry.ownerId !== request.ownerId || entry.revision !== request.expectedRevision ||
            request.token !== digest(entry)) throw new Error('Undo conflict or unavailable');
        const result = await this.store.transact(root, request.expectedRevision, request.ownerId, async current => {
            const present = current.checkpoints.find(item => item.id === entry.after.id);
            if (JSON.stringify(present) !== JSON.stringify(entry.after)) throw new Error('Undo conflict');
            return current.checkpoints.map(item => item.id === entry.before.id ? copy(entry.before) : item);
        });
        this.undo.delete(request.projectHandle);
        return copy(result);
    }

    undoToken(projectHandle: string, ownerId: string): string | undefined {
        this.binding(projectHandle, ownerId);
        const entry = this.undo.get(projectHandle);
        return entry ? digest(entry) : undefined;
    }
}
