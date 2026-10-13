import { createHash, randomUUID } from 'node:crypto';
import { realpath, stat } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { roadmapSectionKey } from './roadmap-import';
import { RoadmapStore } from './roadmap-store';
import type { RoadmapIndex } from './roadmap-store';

export interface GreenfieldCheckpoint { id: string; title: string; objective: string }
export interface GreenfieldPhase { id: string; title: string; objective: string; checkpoints: GreenfieldCheckpoint[] }
export interface GreenfieldDraft { revision: number; phases: GreenfieldPhase[] }
export type GreenfieldEdit =
    | { type: 'create-phase'; title: string; objective?: string }
    | { type: 'create-checkpoint'; phaseId: string; title: string; objective?: string }
    | { type: 'edit-phase'; phaseId: string; title?: string; objective?: string }
    | { type: 'edit-checkpoint'; phaseId: string; checkpointId: string; title?: string; objective?: string }
    | { type: 'reorder-phase'; phaseId: string; order: number }
    | { type: 'reorder-checkpoint'; phaseId: string; checkpointId: string; order: number };
export interface GreenfieldPreview { token: string; draftRevision: number; path: string; markdown: string;
    phases: GreenfieldPhase[]; requiresApproval: true }

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const line = (value: unknown, max: number): value is string => typeof value === 'string' &&
    value.length <= max && !/[\r\n\0\x00-\x08\x0b-\x1f]/.test(value);
const title = (value: unknown): value is string => line(value, 200) && !!value.trim() &&
    !/^#{1,6}\s/.test(value) && !/^\s/.test(value) && !/\s$/.test(value);
const objective = (value: unknown): value is string => line(value, 8192);
const hash = (value: string): string => createHash('sha256').update(value).digest('hex');

/** A local, disposable draft. Only an approved preview crosses into the Roadmap owner. */
export class RoadmapGreenfield {
    private readonly drafts = new Map<string, { root: string; value: GreenfieldDraft }>();
    constructor(private readonly store: RoadmapStore) {}

    async begin(root: string): Promise<{ handle: string; draft: GreenfieldDraft }> {
        if (!isAbsolute(root) || resolve(root) !== root || await realpath(root) !== root || !(await stat(root)).isDirectory())
            throw new Error('Invalid greenfield project root');
        const current = await this.store.read(root);
        if (current.revision || current.linkedDocument || current.pendingCreation)
            throw new Error('Roadmap already initialized or creation pending');
        const handle = randomUUID();
        const value = { revision: 0, phases: [] };
        this.drafts.set(handle, { root, value });
        return { handle, draft: copy(value) };
    }

    cancel(handle: string): void { this.drafts.delete(handle); }

    read(handle: string): GreenfieldDraft {
        const entry = this.drafts.get(handle);
        if (!entry) throw new Error('Unknown greenfield draft');
        return copy(entry.value);
    }

    edit(handle: string, expectedRevision: number, action: GreenfieldEdit): GreenfieldDraft {
        const entry = this.drafts.get(handle);
        if (!entry || entry.value.revision !== expectedRevision) throw new Error('Stale greenfield draft');
        const next = copy(entry.value);
        const raw = action as unknown as Record<string, unknown>;
        const required: Record<GreenfieldEdit['type'], string[]> = {
            'create-phase': ['type', 'title'], 'create-checkpoint': ['type', 'phaseId', 'title'],
            'edit-phase': ['type', 'phaseId'], 'edit-checkpoint': ['type', 'phaseId', 'checkpointId'],
            'reorder-phase': ['type', 'phaseId', 'order'],
            'reorder-checkpoint': ['type', 'phaseId', 'checkpointId', 'order']
        };
        if (!action || !Object.hasOwn(required, action.type) ||
            required[action.type].some(key => !Object.hasOwn(raw, key)) ||
            Object.keys(raw).some(key => !required[action.type].includes(key) &&
                !(key === 'objective' && ['create-phase', 'create-checkpoint', 'edit-phase', 'edit-checkpoint'].includes(action.type)) &&
                !(key === 'title' && ['edit-phase', 'edit-checkpoint'].includes(action.type))))
            throw new Error('Invalid greenfield edit fields');
        const phase = 'phaseId' in action ? next.phases.find(item => item.id === action.phaseId) : undefined;
        if ('phaseId' in action && !phase) throw new Error('Unknown greenfield phase');
        if ('title' in action && action.title !== undefined && !title(action.title) ||
            'objective' in action && action.objective !== undefined && !objective(action.objective))
            throw new Error('Invalid greenfield text');
        switch (action.type) {
            case 'create-phase':
                if (next.phases.length >= 32) throw new Error('Greenfield phase limit');
                next.phases.push({ id: randomUUID(), title: action.title, objective: action.objective ?? '', checkpoints: [] });
                break;
            case 'create-checkpoint':
                if (next.phases.reduce((count, item) => count + item.checkpoints.length, 0) >= 256)
                    throw new Error('Greenfield checkpoint limit');
                phase!.checkpoints.push({ id: randomUUID(), title: action.title, objective: action.objective ?? '' });
                break;
            case 'edit-phase':
                if (action.title === undefined && action.objective === undefined) throw new Error('Empty greenfield edit');
                if (action.title !== undefined) phase!.title = action.title;
                if (action.objective !== undefined) phase!.objective = action.objective;
                break;
            case 'edit-checkpoint': {
                if (action.title === undefined && action.objective === undefined) throw new Error('Empty greenfield edit');
                const checkpoint = phase!.checkpoints.find(item => item.id === action.checkpointId);
                if (!checkpoint) throw new Error('Unknown greenfield checkpoint');
                if (action.title !== undefined) checkpoint.title = action.title;
                if (action.objective !== undefined) checkpoint.objective = action.objective;
                break;
            }
            case 'reorder-phase': {
                if (!Number.isSafeInteger(action.order) || action.order < 0 || action.order >= next.phases.length)
                    throw new Error('Invalid greenfield order');
                next.phases.splice(action.order, 0, next.phases.splice(next.phases.indexOf(phase!), 1)[0]);
                break;
            }
            case 'reorder-checkpoint': {
                const index = phase!.checkpoints.findIndex(item => item.id === action.checkpointId);
                if (index < 0 || !Number.isSafeInteger(action.order) || action.order < 0 || action.order >= phase!.checkpoints.length)
                    throw new Error('Invalid greenfield order');
                phase!.checkpoints.splice(action.order, 0, phase!.checkpoints.splice(index, 1)[0]);
                break;
            }
        }
        const keys = next.phases.flatMap((item, index) => [roadmapSectionKey(`Phase ${index + 1} — ${item.title}`, true),
            ...item.checkpoints.map(checkpoint => roadmapSectionKey(`Milestone ${checkpoint.title}`, true))]);
        if (keys.some(key => !key) || new Set(keys).size !== keys.length) throw new Error('Duplicate greenfield checkpoint heading');
        next.revision++;
        entry.value = next;
        return copy(next);
    }

    preview(handle: string, path: string): GreenfieldPreview {
        const entry = this.drafts.get(handle);
        if (!entry || !entry.value.phases.length) throw new Error('Empty greenfield draft');
        if (!path || path.length > 512 || isAbsolute(path) || !/\.md$/i.test(path) ||
            path.includes('\\') || path.includes(':') || path.split('/')[0] === '.dope' ||
            path.split('/').some(part => !part || part === '.' || part === '..'))
            throw new Error('Unsafe greenfield Roadmap path');
        const lines = ['# Roadmap', ''];
        let order = 0;
        for (const [index, phase] of entry.value.phases.entries()) {
            lines.push(`## Phase ${index + 1} — ${phase.title}`, 'Status: NOT IMPLEMENTED',
                `Objective: ${phase.objective}`, `Order: ${order++}`, 'Prose: ', '');
            for (const checkpoint of phase.checkpoints)
                lines.push(`### Milestone ${checkpoint.title}`, 'Status: NOT IMPLEMENTED',
                    `Objective: ${checkpoint.objective}`, `Order: ${order++}`, 'Prose: ', '');
        }
        const markdown = `${lines.join('\n')}\n`;
        if (Buffer.byteLength(markdown) > 2 * 1024 * 1024) throw new Error('Greenfield Roadmap size limit');
        const token = hash(JSON.stringify({ handle, root: entry.root, path, revision: entry.value.revision, markdown }));
        return { token, draftRevision: entry.value.revision, path, markdown,
            phases: copy(entry.value.phases), requiresApproval: true };
    }

    async accept(handle: string, preview: GreenfieldPreview, approved: boolean): Promise<RoadmapIndex> {
        const entry = this.drafts.get(handle);
        if (!entry || !approved || !preview ||
            JSON.stringify(this.preview(handle, preview.path)) !== JSON.stringify(preview))
            throw new Error('Greenfield preview and approval required');
        const result = await this.store.acceptGreenfield(entry.root, 0, preview.path, preview.markdown);
        this.drafts.delete(handle);
        return result;
    }
}
