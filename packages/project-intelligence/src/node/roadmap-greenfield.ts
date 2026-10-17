import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { closeSync, fsyncSync, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
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
export interface GreenfieldEditPreview { token: string; draftRevision: number; before: GreenfieldDraft;
    after: GreenfieldDraft; action: GreenfieldEdit; requiresApproval: true }

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const line = (value: unknown, max: number): value is string => typeof value === 'string' &&
    value.length <= max && !/[\r\n\0\x00-\x08\x0b-\x1f]/.test(value);
const title = (value: unknown): value is string => line(value, 200) && !!value.trim() &&
    !/^#{1,6}\s/.test(value) && !/^\s/.test(value) && !/\s$/.test(value);
const objective = (value: unknown): value is string => line(value, 8192);
const hash = (value: string): string => createHash('sha256').update(value).digest('hex');
const MAX_DRAFT_BYTES = 512 * 1024;
const uuid = (value: unknown): value is string => typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const fields = (value: object, required: string[], optional: string[] = []): boolean =>
    required.every(key => Object.hasOwn(value, key)) &&
    Object.keys(value).every(key => required.includes(key) || optional.includes(key));
type StoredDraft = { handle: string; projectId: string; value: GreenfieldDraft; chatId?: string };
type DraftFile = { schemaVersion: 1; revision: number; drafts: StoredDraft[] };

function validDraft(value: unknown): value is GreenfieldDraft {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const draft = value as GreenfieldDraft;
    if (!fields(draft, ['revision', 'phases']) || !Number.isSafeInteger(draft.revision) || draft.revision < 0 ||
        !Array.isArray(draft.phases) || draft.phases.length > 32) return false;
    let checkpoints = 0;
    const ids = new Set<string>();
    const keys = new Set<string>();
    for (const [index, phase] of draft.phases.entries()) {
        if (!phase || !fields(phase, ['id', 'title', 'objective', 'checkpoints']) || !uuid(phase.id) ||
            ids.has(phase.id) || !title(phase.title) || !objective(phase.objective) ||
            !Array.isArray(phase.checkpoints)) return false;
        ids.add(phase.id);
        const phaseKey = roadmapSectionKey(`Phase ${index + 1} — ${phase.title}`, true);
        if (!phaseKey || keys.has(phaseKey)) return false;
        keys.add(phaseKey);
        for (const checkpoint of phase.checkpoints) {
            checkpoints++;
            if (!checkpoint || !fields(checkpoint, ['id', 'title', 'objective']) || !uuid(checkpoint.id) ||
                ids.has(checkpoint.id) || !title(checkpoint.title) ||
                !objective(checkpoint.objective)) return false;
            ids.add(checkpoint.id);
            const key = roadmapSectionKey(`Milestone ${checkpoint.title}`, true);
            if (!key || keys.has(key)) return false;
            keys.add(key);
        }
    }
    return checkpoints <= 256;
}

/** A local, disposable draft. Only an approved preview crosses into the Roadmap owner. */
export class RoadmapGreenfield {
    private readonly drafts = new Map<string, { root: string; projectId: string; value: GreenfieldDraft }>();
    private readonly chats = new Map<string, { root: string; handle: string }>();
    private readonly generations = new Map<string, number>();
    private readonly editPreviews = new Map<string, GreenfieldEditPreview>();
    private readonly creationPreviews = new Map<string, string>();
    private readonly accepting = new Set<string>();
    constructor(private readonly store: RoadmapStore) {}

    private paths(root: string, create = false): { directory: string; file: string } {
        if (!isAbsolute(root) || resolve(root) !== root || !lstatSync(root).isDirectory())
            throw new Error('Invalid greenfield project root');
        const directory = join(root, '.dope');
        let info: ReturnType<typeof lstatSync> | undefined;
        try { info = lstatSync(directory); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
        if (create && !info) {
            mkdirSync(directory, { mode: 0o700 });
            info = lstatSync(directory);
            const parent = openSync(root, constants.O_RDONLY | constants.O_DIRECTORY);
            try { fsyncSync(parent); } finally { closeSync(parent); }
        }
        if (info) {
            if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Unsafe greenfield draft directory');
        }
        return { directory, file: join(directory, 'roadmap-drafts.json') };
    }

    private file(root: string): DraftFile {
        const { file } = this.paths(root);
        let info: ReturnType<typeof lstatSync>;
        try { info = lstatSync(file); }
        catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { schemaVersion: 1, revision: 0, drafts: [] };
            throw error;
        }
        if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_DRAFT_BYTES)
            throw new Error('Unsafe or oversized greenfield draft file');
        let parsed: unknown;
        const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
            if (!fstatSync(fd).isFile() || fstatSync(fd).size > MAX_DRAFT_BYTES) throw new Error('Unsafe greenfield draft file');
            parsed = JSON.parse(readFileSync(fd, 'utf8'));
        } catch { throw new Error('Corrupt or unsafe greenfield draft file'); }
        finally { closeSync(fd); }
        const value = parsed as DraftFile;
        if (!value || !fields(value, ['schemaVersion', 'revision', 'drafts']) ||
            value.schemaVersion !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 0 ||
            !Array.isArray(value.drafts) || value.drafts.length > 8 ||
            value.drafts.some(item => !item || !fields(item, ['handle', 'projectId', 'value'], ['chatId']) ||
                !uuid(item.handle) || !line(item.projectId, 256) || !item.projectId ||
                item.chatId !== undefined && !uuid(item.chatId) || !validDraft(item.value)) ||
            new Set(value.drafts.map(item => item.handle)).size !== value.drafts.length ||
            new Set(value.drafts.map(item => item.chatId).filter(Boolean)).size !== value.drafts.filter(item => item.chatId).length)
            throw new Error('Corrupt or unsupported greenfield draft file');
        return value;
    }

    private assertUninitialized(root: string): void {
        const file = join(this.paths(root).directory, 'roadmap.json');
        try { lstatSync(file); throw new Error('Stale greenfield Roadmap owner'); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }

    /** Restore only accepted draft state. Approval previews are never serialized. */
    async restore(root: string): Promise<{ handle: string; draft: GreenfieldDraft; chatId?: string }[]> {
        if ([...this.accepting].some(handle => this.drafts.get(handle)?.root === root))
            throw new Error('Greenfield draft acceptance in progress');
        const owner = await this.store.read(root);
        const file = this.file(root);
        if (file.drafts.length && (owner.revision || owner.linkedDocument || owner.pendingCreation ||
            file.drafts.some(item => item.projectId !== owner.projectId)))
            throw new Error('Stale greenfield draft owner');
        for (const [handle, entry] of this.drafts) if (entry.root === root) {
            this.drafts.delete(handle);
            this.editPreviews.delete(handle);
            this.creationPreviews.delete(handle);
        }
        for (const [id, binding] of this.chats) if (binding.root === root) this.chats.delete(id);
        for (const item of file.drafts) {
            this.drafts.set(item.handle, { root, projectId: item.projectId, value: copy(item.value) });
            if (item.chatId) this.chats.set(item.chatId, { root, handle: item.handle });
        }
        this.generations.set(root, file.revision);
        return file.drafts.map(item => ({ handle: item.handle, draft: copy(item.value), ...(item.chatId ? { chatId: item.chatId } : {}) }));
    }

    async ensureRestored(root: string): Promise<void> {
        if (!this.generations.has(root)) await this.restore(root);
    }

    private persist(root: string, entries: StoredDraft[]): void {
        const { directory, file } = this.paths(root, true);
        const lock = join(directory, 'roadmap-drafts.lock');
        let lockFd: number | undefined;
        for (let attempt = 0; attempt < 2 && lockFd === undefined; attempt++) {
            try { lockFd = openSync(lock, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600); }
            catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
                const info = lstatSync(lock);
                if (!info.isFile() || info.isSymbolicLink() || info.size > 32) throw new Error('Unsafe greenfield draft lock');
                const reader = openSync(lock, constants.O_RDONLY | constants.O_NOFOLLOW);
                let owner: string;
                try { owner = readFileSync(reader, 'utf8').trim(); } finally { closeSync(reader); }
                if (!/^[1-9]\d*$/.test(owner)) throw new Error('Greenfield draft locked; inspect lock');
                try { process.kill(Number(owner), 0); throw new Error('Greenfield draft locked; retry'); }
                catch (probe) { if ((probe as NodeJS.ErrnoException).code !== 'ESRCH') throw probe; }
                if (lstatSync(lock).ino !== info.ino) throw new Error('Greenfield draft lock changed');
                rmSync(lock);
            }
        }
        if (lockFd === undefined) throw new Error('Greenfield draft locked; retry');
        try {
            writeFileSync(lockFd, `${process.pid}\n`); fsyncSync(lockFd);
            const current = this.file(root);
            if (current.revision !== this.generations.get(root)) throw new Error('Concurrent greenfield draft change; restore and retry');
            const next: DraftFile = { schemaVersion: 1, revision: current.revision + 1, drafts: entries };
            const bytes = Buffer.from(`${JSON.stringify(next)}\n`);
            if (entries.length > 8 || bytes.length > MAX_DRAFT_BYTES) throw new Error('Greenfield draft size limit');
            const temporary = join(directory, `roadmap-drafts.${randomUUID()}.tmp`);
            try {
                const fd = openSync(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
                try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
                renameSync(temporary, file);
                const parent = openSync(directory, constants.O_RDONLY | constants.O_DIRECTORY);
                try { fsyncSync(parent); } finally { closeSync(parent); }
                this.generations.set(root, next.revision);
            } finally { rmSync(temporary, { force: true }); }
        } finally { closeSync(lockFd); rmSync(lock, { force: true }); }
    }

    private entries(root: string): StoredDraft[] {
        return [...this.drafts].filter(([, entry]) => entry.root === root).map(([handle, entry]) => {
            const chatId = [...this.chats].find(([, binding]) => binding.root === root && binding.handle === handle)?.[0];
            return { handle, projectId: entry.projectId, value: entry.value, ...(chatId ? { chatId } : {}) };
        });
    }

    async begin(root: string): Promise<{ handle: string; draft: GreenfieldDraft }> {
        if (!isAbsolute(root) || resolve(root) !== root || await realpath(root) !== root || !(await stat(root)).isDirectory())
            throw new Error('Invalid greenfield project root');
        const current = await this.store.read(root);
        if (current.revision || current.linkedDocument || current.pendingCreation)
            throw new Error('Roadmap already initialized or creation pending');
        await this.ensureRestored(root);
        const fresh = await this.store.read(root);
        if (fresh.projectId !== current.projectId || fresh.revision || fresh.linkedDocument || fresh.pendingCreation)
            throw new Error('Stale greenfield project identity');
        const handle = randomUUID();
        const value = { revision: 0, phases: [] };
        this.persist(root, [...this.entries(root), { handle, projectId: current.projectId, value }]);
        this.drafts.set(handle, { root, projectId: current.projectId, value });
        return { handle, draft: copy(value) };
    }

    cancel(handle: string): void {
        if (this.accepting.has(handle)) throw new Error('Greenfield draft acceptance in progress');
        const entry = this.drafts.get(handle);
        if (entry) this.persist(entry.root, this.entries(entry.root).filter(item => item.handle !== handle));
        this.drafts.delete(handle);
        this.editPreviews.delete(handle);
        this.creationPreviews.delete(handle);
        for (const [chatId, binding] of this.chats) if (binding.handle === handle) this.chats.delete(chatId);
    }

    bindChat(root: string, handle: string, chatId: string): void {
        if (this.accepting.has(handle)) throw new Error('Greenfield draft acceptance in progress');
        if (!uuid(chatId) || this.drafts.get(handle)?.root !== root) throw new Error('Foreign greenfield draft');
        this.assertUninitialized(root);
        const entries = this.entries(root).map(item => ({ ...item, ...(item.handle === handle ? { chatId } : {} ) }));
        for (const item of entries) if (item.handle !== handle && item.chatId === chatId) delete item.chatId;
        this.persist(root, entries);
        this.editPreviews.delete(handle);
        for (const [id, binding] of this.chats) if (binding.handle === handle || id === chatId) this.chats.delete(id);
        this.chats.set(chatId, { root, handle });
    }

    unbindChat(root: string, handle: string): void {
        if (this.accepting.has(handle)) throw new Error('Greenfield draft acceptance in progress');
        if (this.drafts.get(handle)?.root !== root) throw new Error('Foreign greenfield draft');
        this.assertUninitialized(root);
        const entries = this.entries(root).map(item => ({ ...item }));
        for (const item of entries) if (item.handle === handle) delete item.chatId;
        this.persist(root, entries);
        this.editPreviews.delete(handle);
        for (const [chatId, binding] of this.chats) if (binding.handle === handle) this.chats.delete(chatId);
    }

    chatDraft(root: string, chatId: string): { handle: string; draft: GreenfieldDraft } | undefined {
        const binding = this.chats.get(chatId);
        if (!binding || binding.root !== root) return undefined;
        const entry = this.drafts.get(binding.handle);
        return entry?.root === root ? { handle: binding.handle, draft: copy(entry.value) } : undefined;
    }

    owner(root: string): Promise<RoadmapIndex> { return this.store.read(root); }

    draftProjectId(handle: string): string {
        const entry = this.drafts.get(handle);
        if (!entry) throw new Error('Unknown greenfield draft');
        return entry.projectId;
    }

    read(handle: string): GreenfieldDraft {
        const entry = this.drafts.get(handle);
        if (!entry) throw new Error('Unknown greenfield draft');
        return copy(entry.value);
    }

    private project(handle: string, expectedRevision: number, action: GreenfieldEdit): GreenfieldDraft {
        const entry = this.drafts.get(handle);
        if (this.accepting.has(handle)) throw new Error('Greenfield draft acceptance in progress');
        if (!entry || entry.value.revision !== expectedRevision) throw new Error('Stale greenfield draft');
        this.assertUninitialized(entry.root);
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
        return copy(next);
    }

    edit(handle: string, expectedRevision: number, action: GreenfieldEdit): GreenfieldDraft {
        const next = this.project(handle, expectedRevision, action);
        const entry = this.drafts.get(handle)!;
        this.persist(entry.root, this.entries(entry.root).map(item => item.handle === handle ? { ...item, value: next } : item));
        this.drafts.get(handle)!.value = next;
        this.editPreviews.delete(handle);
        this.creationPreviews.delete(handle);
        return copy(next);
    }

    previewEdit(handle: string, expectedRevision: number, action: GreenfieldEdit): GreenfieldEditPreview {
        const before = this.read(handle);
        const after = this.project(handle, expectedRevision, action);
        const token = hash(JSON.stringify({ nonce: randomUUID(), handle, before, after, action }));
        const preview: GreenfieldEditPreview = { token, draftRevision: expectedRevision,
            before, after, action: copy(action), requiresApproval: true };
        this.editPreviews.set(handle, preview);
        return copy(preview);
    }

    async applyEdit(handle: string, preview: GreenfieldEditPreview, approved: boolean): Promise<GreenfieldDraft> {
        const entry = this.drafts.get(handle);
        if (!entry || !approved || !preview ||
            JSON.stringify(this.editPreviews.get(handle)) !== JSON.stringify(preview) ||
            entry.value.revision !== preview.draftRevision ||
            JSON.stringify(entry.value) !== JSON.stringify(preview.before) ||
            preview.after.revision !== preview.draftRevision + 1)
            throw new Error('Stale greenfield preview or approval required');
        const current = await this.store.read(entry.root);
        if (current.projectId !== entry.projectId || current.revision || current.linkedDocument || current.pendingCreation)
            throw new Error('Roadmap already initialized or creation pending');
        if (entry.value.revision !== preview.draftRevision ||
            JSON.stringify(entry.value) !== JSON.stringify(preview.before) ||
            JSON.stringify(this.editPreviews.get(handle)) !== JSON.stringify(preview))
            throw new Error('Stale greenfield draft');
        this.persist(entry.root, this.entries(entry.root).map(item => item.handle === handle ? { ...item, value: preview.after } : item));
        entry.value = copy(preview.after);
        this.editPreviews.delete(handle);
        this.creationPreviews.delete(handle);
        return copy(entry.value);
    }

    preview(handle: string, path: string): GreenfieldPreview {
        const entry = this.drafts.get(handle);
        if (!entry) throw new Error('Unknown greenfield draft');
        this.assertUninitialized(entry.root);
        if (!entry.value.phases.length || !entry.value.phases.some(phase => phase.checkpoints.length))
            throw new Error('Greenfield draft needs a phase and checkpoint');
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
        const token = hash(JSON.stringify({ nonce: randomUUID(), handle, root: entry.root, path, revision: entry.value.revision, markdown }));
        this.creationPreviews.set(handle, token);
        return { token, draftRevision: entry.value.revision, path, markdown,
            phases: copy(entry.value.phases), requiresApproval: true };
    }

    async accept(handle: string, preview: GreenfieldPreview, approved: boolean): Promise<RoadmapIndex> {
        const entry = this.drafts.get(handle);
        if (!entry || !approved || !preview || this.accepting.has(handle) ||
            this.creationPreviews.get(handle) !== preview.token ||
            JSON.stringify({ ...this.preview(handle, preview.path), token: preview.token }) !== JSON.stringify(preview))
            throw new Error('Greenfield preview and approval required');
        this.accepting.add(handle);
        try {
            const current = await this.store.read(entry.root);
            if (current.revision) throw new Error('Stale Roadmap revision');
            if (current.projectId !== entry.projectId) throw new Error('Stale greenfield project identity');
            const result = await this.store.acceptGreenfield(entry.root, 0, preview.path, preview.markdown);
            this.accepting.delete(handle);
            this.cancel(handle);
            return result;
        } finally { this.accepting.delete(handle); }
    }
}
