import { makeWorkToolSelection, resolveWorkTools, WORK_TOOL_CATALOG, type WorkToolChoice, type WorkToolCustomGroup } from '@dope/agent-core/lib/work-tool-selection';

export const WORK_TOOL_PREFERENCES_KEY = 'dope.work-tool-selection.v1';
const key = WORK_TOOL_PREFERENCES_KEY;
const initial: WorkToolChoice = { groups: ['Inspect', 'Edit'], allow: [], deny: [] };
interface Saved { revision: number; groups: WorkToolCustomGroup[];
    defaults: Record<string, WorkToolChoice>; drafts: Record<string, WorkToolChoice>;
    reviewed?: string[] }
const blank = (): Saved => ({ revision: 2, groups: [], defaults: {}, drafts: {} });
const validChoice = (value: unknown): value is WorkToolChoice => !!value && typeof value === 'object' &&
    ['groups', 'allow', 'deny'].every(field => Array.isArray((value as Record<string, unknown>)[field]) &&
        ((value as Record<string, unknown>)[field] as unknown[]).every(item => typeof item === 'string'));
export const hasApprovedWorkCommand = (command?: string, kind: 'test' | 'build' | 'typecheck' = 'test'): boolean => {
    if (kind === 'typecheck') return false;
    const words = command?.split(' ');
    if (!words || words[0] !== 'node' || words.length < 2 || words.length > 4 ||
        words.some(word => !word || /[;&|`$<>*?{}()[\]\\\s\u0000-\u001f]/u.test(word) ||
            new TextEncoder().encode(word).length > 512)) return false;
    const privatePart = (part: string) => {
        const p = part.toLowerCase();
        return ['.git', '.dope', '.codex', '.agents', '.ssh', '.aws', '.config', '.gnupg', '.kube',
            '.docker', '.azure', '.npmrc', '.yarnrc', '.yarnrc.yml', '.netrc', '.pypirc',
            '.gitconfig', '.git-credentials', 'id_rsa', 'id_ed25519', 'credentials.json',
            'secrets', 'secret', 'credentials', 'private', 'node_modules'].includes(p) ||
            p === '.env' || p.startsWith('.env.') ||
            ['.pem', '.key', '.p12', '.pfx'].some(suffix => p.endsWith(suffix)) ||
            ['secret.', 'token.', 'credential.'].some(prefix => p.startsWith(prefix));
    };
    const path = (value: string, extension: 'js' | 'json') =>
        /^(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/u.test(value) &&
        value.split('/').every(part => part !== '.' && part !== '..' && !privatePart(part)) &&
        (extension === 'json' ? value.endsWith('.json') : /\.(?:c|m)?js$/u.test(value));
    const args = words.slice(1);
    if (kind === 'test') {
        const testArgs = args[0] === '--experimental-strip-types' ? args.slice(1) : args;
        return testArgs.length === 2 && testArgs[0] === '--test' &&
            path(testArgs[1], 'js') && /\.test\.(?:c|m)?js$/u.test(testArgs[1]);
    }
    return args.length === 1 && path(args[0], 'js') ||
        args.length === 3 && args[0] === 'node_modules/typescript/bin/tsc' &&
        args[1] === '-p' && path(args[2], 'json');
};
export class WorkToolPreferences {
    constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'>) {}
    private read(): Saved {
        try {
            const parsed = JSON.parse(this.storage.getItem(key) ?? 'null') as Saved;
            if ([1, 2].includes(parsed?.revision) && Array.isArray(parsed.groups) &&
                parsed.defaults && parsed.drafts)
                return parsed;
        } catch { /* Invalid local preference is inert. */ }
        return blank();
    }
    private write(saved: Saved): void { this.storage.setItem(key, JSON.stringify(saved)); }
    private needsLegacyReview(saved: Saved, project: string, task: string): boolean {
        if (saved.revision !== 1) return false;
        const draft = `${project}\u0000${task}`;
        return (Object.hasOwn(saved.drafts, draft) || Object.hasOwn(saved.defaults, project)) &&
            !saved.reviewed?.includes(draft);
    }
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
        const saved = this.read(); const draft = `${project}\u0000${task}`;
        saved.drafts[draft] = choice;
        saved.reviewed = [...new Set([...(saved.reviewed ?? []), draft])]; this.write(saved);
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
    resolve(project: string, task: string, commandsAvailable: boolean, externalAvailable = false) {
        const saved = this.read();
        const choice = this.choice(project, task);
        const resolved = resolveWorkTools(choice, this.groups(), commandsAvailable, externalAvailable);
        if (this.needsLegacyReview(saved, project, task))
            resolved.unavailable.push('Saved Work group/default preference requires fresh tool review');
        return resolved;
    }
    snapshot(project: string, task: string, taskId: string, grantRevision: number,
        target: { connectionId: string; modelId: string }, commandsAvailable: boolean,
        externalAvailable = false, grantId?: string, executionMode?: 'direct' | 'isolated') {
        const resolved = this.resolve(project, task, commandsAvailable, externalAvailable);
        if (resolved.unavailable.length) throw new Error(`Review unavailable Work tools: ${resolved.unavailable.join('; ')}`);
        return makeWorkToolSelection({ projectUri: project, taskId, grantRevision, grantId, executionMode,
            connectionId: target.connectionId, modelId: target.modelId }, resolved.tools);
    }
}
