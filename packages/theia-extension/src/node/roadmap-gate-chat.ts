import { randomUUID } from 'node:crypto';
import type { RoadmapGateIndex } from '@dope/project-intelligence/lib/node/roadmap-gate-domain';
import type { GatePlanningAction } from '@dope/project-intelligence/lib/node/project-planning-actions';

const ACTIONS = new Set([
    'phase.create', 'phase.edit', 'phase.delete', 'phase.reorder', 'phase.dependencies',
    'gate.create', 'gate.edit', 'gate.delete', 'gate.reparent', 'gate.reorder', 'gate.dependencies',
    'criterion.add', 'criterion.edit', 'criterion.remove', 'criterion.reorder',
    'correction.attach', 'correction.edit', 'correction.reparent', 'correction.delete'
]);
const record = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === 'object' && !Array.isArray(value);
const temporary = (value: string): boolean => /^new:[a-z0-9-]{1,32}$/i.test(value);

/** A partial Gate name cannot authorize a model-selected target when several Gates share it. */
export function ambiguousGateReferences(index: RoadmapGateIndex, request: string): string[] {
    const mentions = (value: string): boolean => !!value && new RegExp(
        `(^|[^a-z0-9])${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^a-z0-9])`, 'i').test(request);
    if (index.gates.some(gate => mentions(gate.id) || mentions(gate.designation))) return [];
    const words = new Set((request.toLowerCase().match(/[a-z0-9]{4,}/g) ?? [])
        .filter(word => !['roadmap', 'gate', 'gates', 'change', 'purpose', 'title', 'field', 'other',
            'unchanged', 'verify', 'verification'].includes(word)));
    return index.gates.filter(gate => gate.title.toLowerCase().match(/[a-z0-9]{4,}/g)?.some(word => words.has(word)))
        .map(gate => `${gate.designation} (${gate.title}; ${gate.id})`).slice(0, 3);
}

export function validGateChatEnvelope(value: unknown): value is { type: 'roadmap-gate-proposal';
    projectId: string; ownerRevision: number; summary: string; actions: GatePlanningAction[] } {
    if (!record(value) || Object.keys(value).sort().join(',') !== 'actions,ownerRevision,projectId,summary,type' ||
        value.type !== 'roadmap-gate-proposal' || typeof value.projectId !== 'string' ||
        !Number.isSafeInteger(value.ownerRevision) || (value.ownerRevision as number) < 1 ||
        typeof value.summary !== 'string' || !value.summary.trim() || value.summary.length > 200 ||
        /[\x00-\x1f\x7f]/.test(value.summary) ||
        !Array.isArray(value.actions) || value.actions.length < 1 || value.actions.length > 3 ||
        Buffer.byteLength(JSON.stringify(value), 'utf8') > 16000) return false;
    return value.actions.every(action => record(action) && typeof action.type === 'string' &&
        ACTIONS.has(action.type) && Object.keys(action).length <= 8);
}

/** A linked section may only enter the dedicated single-field Markdown review path. */
export function touchesLinkedSource(actions: GatePlanningAction[], sectionIds: readonly string[]): boolean {
    const owned = new Set(sectionIds);
    const containsOwnedId = (value: unknown): boolean => {
        if (typeof value === 'string') return owned.has(value);
        if (Array.isArray(value)) return value.some(containsOwnedId);
        if (record(value)) return Object.entries(value).some(([key, entry]) =>
            key !== 'title' && key !== 'objective' && key !== 'purpose' &&
            key !== 'expectedResult' && key !== 'designation' && containsOwnedId(entry));
        return false;
    };
    return actions.some(containsOwnedId);
}

/** Temporary IDs have meaning only inside this one model output; the owner assigns durable IDs. */
export function bindGateChatActions(actions: GatePlanningAction[]): GatePlanningAction[] {
    const ids = new Map<string, string>();
    for (const action of actions) {
        const creating = action.type === 'phase.create' || action.type === 'gate.create' ||
            action.type === 'criterion.add' || action.type === 'correction.attach';
        if (!creating) continue;
        if (!action.id || !temporary(action.id) || ids.has(action.id))
            throw new Error('New Roadmap entities need distinct temporary IDs');
        ids.set(action.id, randomUUID());
        if (action.type === 'gate.create') for (const criterion of action.criteria) {
            if (!temporary(criterion.id) || ids.has(criterion.id))
                throw new Error('New Gate criteria need distinct temporary IDs');
            ids.set(criterion.id, randomUUID());
        }
    }
    const replace = (value: unknown): unknown => {
        if (typeof value === 'string') {
            if (temporary(value) && !ids.has(value)) throw new Error('Unknown temporary Roadmap identity');
            return ids.get(value) ?? value;
        }
        if (Array.isArray(value)) return value.map(replace);
        if (record(value)) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, replace(entry)]));
        return value;
    };
    return replace(actions) as GatePlanningAction[];
}

export function gateChatDiff(before: RoadmapGateIndex, after: RoadmapGateIndex,
    changedIds: string[]): string {
    const entity = (index: RoadmapGateIndex, id: string): unknown =>
        index.phases.find(item => item.id === id) ?? index.gates.find(item => item.id === id) ??
        index.corrections.find(item => item.id === id) ??
        index.gates.flatMap(gate => gate.criteria).find(item => item.id === id);
    return changedIds.map(id => {
        const old = entity(before, id), next = entity(after, id);
        return `${id}\n  Before: ${old ? JSON.stringify(old) : '(absent)'}\n  After: ${next ? JSON.stringify(next) : '(removed)'}`;
    }).join('\n\n');
}
