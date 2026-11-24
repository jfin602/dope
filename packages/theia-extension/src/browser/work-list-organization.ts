import type { WorkRow } from './work-selection-controller';
import { CHAT_COLORS } from '@dope/chat';

export interface WorkFolder { path: string; color: string }
export interface WorkPlacement { folderPath: string; color?: string; title?: string }
interface SavedWorkList {
    version: 1;
    folders: WorkFolder[];
    items: Record<string, WorkPlacement>;
    order: Record<string, string[]>;
}
export interface WorkTree { path: string; folders: Array<WorkTree & { color: string }>; rows: WorkRow[] }

export const workRowKey = (row: WorkRow): string => `${row.selection.kind}:${row.selection.id}`;
const folderToken = (path: string) => `folder:${path}`;
const itemToken = (key: string) => `item:${key}`;
const validColor = (color: unknown): color is string => typeof color === 'string' && CHAT_COLORS.includes(color as typeof CHAT_COLORS[number]);

/** Presentation-only Work organization. Execution records are never written here. */
export class WorkListOrganization {
    private state: SavedWorkList = { version: 1, folders: [], items: {}, order: {} };
    private project = '';
    constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'>) {}
    attach(project: string): void {
        if (project === this.project) return;
        this.project = project;
        this.state = { version: 1, folders: [], items: {}, order: {} };
        if (!project) return;
        try {
            const parsed = JSON.parse(this.storage.getItem(this.storageKey()) ?? 'null') as Partial<SavedWorkList> | null;
            if (parsed?.version !== 1 || !Array.isArray(parsed.folders) || !parsed.items || !parsed.order) return;
            const folders = parsed.folders.filter((entry): entry is WorkFolder =>
                !!entry && typeof entry.path === 'string' && !!entry.path && !entry.path.split('/').some(part => !part));
            const known = new Set(folders.map(entry => entry.path));
            this.state.folders = folders.filter(entry => !entry.path.includes('/') || known.has(entry.path.slice(0, entry.path.lastIndexOf('/'))))
                .map(entry => ({ path: entry.path, color: validColor(entry.color) ? entry.color : 'blue' }));
            for (const [key, placement] of Object.entries(parsed.items)) {
                if (!placement || typeof placement.folderPath !== 'string') continue;
                this.state.items[key] = { folderPath: known.has(placement.folderPath) ? placement.folderPath : '',
                    ...(validColor(placement.color) ? { color: placement.color } : {}),
                    ...(typeof placement.title === 'string' && placement.title.trim() && placement.title.length <= 200 ?
                        { title: placement.title.trim() } : {}) };
            }
            for (const [path, order] of Object.entries(parsed.order))
                if (Array.isArray(order)) this.state.order[path] = order.filter((token): token is string => typeof token === 'string');
        } catch { /* An unavailable or old browser store starts with an empty layout. */ }
    }
    private storageKey(): string { return `dope.work.list.v1:${this.project}`; }
    private save(): void {
        if (!this.project) return;
        try { this.storage.setItem(this.storageKey(), JSON.stringify(this.state)); } catch { /* Work remains usable without storage. */ }
    }
    folders(): readonly WorkFolder[] { return this.state.folders; }
    placement(key: string): WorkPlacement { return this.state.items[key] ?? { folderPath: '' }; }
    title(key: string): string | undefined { return this.placement(key).title; }
    setItemTitle(key: string, title: string): boolean {
        const trimmed = title.trim();
        if (!trimmed || trimmed.length > 200) return false;
        this.state.items[key] = { ...this.placement(key), title: trimmed }; this.save(); return true;
    }
    color(key: string): string {
        const place = this.placement(key);
        return place.color ?? this.state.folders.find(folder => folder.path === place.folderPath)?.color ?? 'blue';
    }
    createFolder(parentPath: string, name: string): string | undefined {
        const trimmed = name.trim();
        if (!trimmed || trimmed.includes('/') || !this.hasParent(parentPath)) return;
        const path = [parentPath, trimmed].filter(Boolean).join('/');
        if (this.state.folders.some(folder => folder.path === path)) return;
        this.state.folders.push({ path, color: this.state.folders.find(folder => folder.path === parentPath)?.color ?? 'blue' });
        this.push(parentPath, folderToken(path)); this.save(); return path;
    }
    setFolderColor(path: string, color: string): void {
        const folder = this.state.folders.find(entry => entry.path === path);
        if (!folder || !validColor(color)) return;
        folder.color = color; this.save();
    }
    setItemColor(key: string, color: string): void {
        if (!validColor(color)) return;
        this.state.items[key] = { ...this.placement(key), color }; this.save();
    }
    placeItem(key: string, parentPath: string, beforeKey?: string): boolean {
        if (!this.hasParent(parentPath)) return false;
        this.removeToken(itemToken(key));
        this.state.items[key] = { ...this.placement(key), folderPath: parentPath };
        this.insert(parentPath, itemToken(key), beforeKey ? itemToken(beforeKey) : undefined);
        this.save(); return true;
    }
    placeFolder(path: string, parentPath: string, beforePath?: string): string | undefined {
        if (!this.hasParent(parentPath) || path === parentPath || parentPath.startsWith(`${path}/`)) return;
        const name = path.split('/').at(-1)!;
        const next = [parentPath, name].filter(Boolean).join('/');
        if (next !== path && this.state.folders.some(folder => folder.path === next)) return;
        this.removeToken(folderToken(path));
        const renamed = (value: string) => value === path || value.startsWith(`${path}/`) ? next + value.slice(path.length) : value;
        for (const folder of this.state.folders) folder.path = renamed(folder.path);
        for (const place of Object.values(this.state.items)) place.folderPath = renamed(place.folderPath);
        const order: Record<string, string[]> = {};
        for (const [key, tokens] of Object.entries(this.state.order))
            order[renamed(key)] = tokens.map(token => token.startsWith('folder:') ? folderToken(renamed(token.slice(7))) : token);
        this.state.order = order;
        this.insert(parentPath, folderToken(next), beforePath ? folderToken(beforePath) : undefined);
        this.save(); return next;
    }
    deleteFolder(path: string): number {
        if (!this.state.folders.some(folder => folder.path === path)) return 0;
        const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
        const affected = (value: string) => value === path || value.startsWith(`${path}/`);
        const count = Object.values(this.state.items).filter(item => affected(item.folderPath)).length;
        for (const item of Object.values(this.state.items)) if (affected(item.folderPath)) item.folderPath = parent;
        this.state.folders = this.state.folders.filter(folder => !affected(folder.path));
        for (const key of Object.keys(this.state.order)) if (affected(key)) delete this.state.order[key];
        for (const tokens of Object.values(this.state.order))
            for (let i = tokens.length - 1; i >= 0; i--) if (tokens[i].startsWith('folder:') && affected(tokens[i].slice(7))) tokens.splice(i, 1);
        this.save(); return count;
    }
    tree(rows: WorkRow[]): WorkTree {
        const build = (path: string): WorkTree => {
            const folders = this.state.folders.filter(folder => (folder.path.includes('/') ? folder.path.slice(0, folder.path.lastIndexOf('/')) : '') === path);
            const work = rows.filter(row => this.placement(workRowKey(row)).folderPath === path);
            const order = this.state.order[path] ??= [];
            for (const folder of folders) if (!order.includes(folderToken(folder.path))) order.push(folderToken(folder.path));
            for (const row of work) if (!order.includes(itemToken(workRowKey(row)))) order.push(itemToken(workRowKey(row)));
            const rank = (token: string) => { const index = order.indexOf(token); return index < 0 ? Number.MAX_SAFE_INTEGER : index; };
            folders.sort((a, b) => rank(folderToken(a.path)) - rank(folderToken(b.path)) || a.path.localeCompare(b.path));
            work.sort((a, b) => rank(itemToken(workRowKey(a))) - rank(itemToken(workRowKey(b))));
            return { path, folders: folders.map(folder => ({ ...build(folder.path), color: folder.color })), rows: work };
        };
        return build('');
    }
    private hasParent(path: string): boolean { return !path || this.state.folders.some(folder => folder.path === path); }
    private removeToken(token: string): void {
        for (const tokens of Object.values(this.state.order)) {
            const index = tokens.indexOf(token); if (index >= 0) tokens.splice(index, 1);
        }
    }
    private push(path: string, token: string): void { (this.state.order[path] ??= []).push(token); }
    private insert(path: string, token: string, before?: string): void {
        const tokens = this.state.order[path] ??= [];
        const index = before ? tokens.indexOf(before) : -1;
        if (index < 0) tokens.push(token); else tokens.splice(index, 0, token);
    }
}
