import { makeWorkToolSelection, resolveWorkTools, WORK_TOOL_CATALOG, type WorkToolChoice, type WorkToolCustomGroup } from '@dope/agent-core/lib/work-tool-selection';

export const WORK_TOOL_PREFERENCES_KEY = 'dope.work-tool-selection.v1';
const key = WORK_TOOL_PREFERENCES_KEY;
const initial: WorkToolChoice = { groups: ['Inspect', 'Edit'], allow: [], deny: [] };
interface Saved { revision: number; groups: WorkToolCustomGroup[];
    defaults: Record<string, WorkToolChoice>; drafts: Record<string, WorkToolChoice> }
const blank = (): Saved => ({ revision: 1, groups: [], defaults: {}, drafts: {} });
const validChoice = (value: unknown): value is WorkToolChoice => !!value && typeof value === 'object' &&
    ['groups', 'allow', 'deny'].every(field => Array.isArray((value as Record<string, unknown>)[field]) &&
        ((value as Record<string, unknown>)[field] as unknown[]).every(item => typeof item === 'string'));
export const hasApprovedWorkCommand = (command?: string): boolean => {
    const words = command?.split(' ');
    return !!words && words[0] === 'node' && words.length >= 2 && words.every(Boolean);
};
export class WorkToolPreferences {
    constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'>) {}
    private read(): Saved {
        try {
            const parsed = JSON.parse(this.storage.getItem(key) ?? 'null') as Saved;
            if (parsed?.revision === 1 && Array.isArray(parsed.groups) && parsed.defaults && parsed.drafts)
                return parsed;
        } catch { /* Invalid local preference is inert. */ }
        return blank();
    }
    private write(saved: Saved): void { this.storage.setItem(key, JSON.stringify(saved)); }
    groups(): WorkToolCustomGroup[] {
        return this.read().groups.filter(group => typeof group.id === 'string' && typeof group.name === 'string' &&
            Array.isArray(group.tools) && group.tools.every(id => typeof id === 'string'));
    }
    choice(project: string, task: string): WorkToolChoice {
        const saved = this.read();
        const value = saved.drafts[`${project}\u0000${task}`] ?? saved.defaults[project];
        return validChoice(value) ? { groups: [...value.groups], allow: [...value.allow], deny: [...value.deny] } :
            { groups: [...initial.groups], allow: [], deny: [] };
    }
    saveChoice(project: string, task: string, choice: WorkToolChoice): void {
        if (!validChoice(choice)) throw new Error('Invalid Work tool choices');
        const saved = this.read(); saved.drafts[`${project}\u0000${task}`] = choice; this.write(saved);
    }
    saveDefault(project: string, choice: WorkToolChoice): void {
        const saved = this.read(); saved.defaults[project] = choice; this.write(saved);
    }
    upsertGroup(group: WorkToolCustomGroup): void {
        if (!/^[a-z0-9-]{1,64}$/u.test(group.id) || !group.name.trim() || group.name.length > 80 ||
            !group.tools.length || group.tools.some(id => !WORK_TOOL_CATALOG.some(tool => tool.id === id)))
            throw new Error('Choose a name and known tools for the group');
        const saved = this.read(); const index = saved.groups.findIndex(item => item.id === group.id);
        if (index >= 0) saved.groups[index] = { ...group, tools: [...new Set(group.tools)] };
        else saved.groups.push({ ...group, tools: [...new Set(group.tools)] });
        this.write(saved);
    }
    deleteGroup(id: string): void {
        const saved = this.read(); saved.groups = saved.groups.filter(group => group.id !== id);
        this.write(saved);
    }
    resolve(project: string, task: string, commandsAvailable: boolean) {
        const choice = this.choice(project, task);
        const available = commandsAvailable ? choice : { ...choice,
            groups: choice.groups.filter(group => group !== 'Commands'),
            allow: choice.allow.filter(id => id !== 'run_command' && id !== 'read_command_output') };
        return resolveWorkTools(available, this.groups(), commandsAvailable);
    }
    snapshot(project: string, task: string, taskId: string, grantRevision: number,
        target: { connectionId: string; modelId: string }, commandsAvailable: boolean) {
        const resolved = this.resolve(project, task, commandsAvailable);
        if (resolved.unavailable.length) throw new Error(`Review unavailable Work tools: ${resolved.unavailable.join('; ')}`);
        return makeWorkToolSelection({ projectUri: project, taskId, grantRevision,
            connectionId: target.connectionId, modelId: target.modelId }, resolved.tools);
    }
}
