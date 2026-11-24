/** Fixed Dope-owned Pi Work catalog. Bump a schema revision whenever the worker's
 * corresponding argument contract or effect changes. Saved approvals then fail closed. */
export const WORK_TOOL_CATALOG_REVISION = 1;
export const WORK_TOOL_CATALOG = [
    { id: 'read_file', group: 'Inspect', effect: 'workspace-read', schemaRevision: 1 },
    { id: 'list_files', group: 'Inspect', effect: 'workspace-read', schemaRevision: 1 },
    { id: 'edit_file', group: 'Edit', effect: 'workspace-write', schemaRevision: 1 },
    { id: 'run_command', group: 'Commands', effect: 'workspace-process', schemaRevision: 1 },
    { id: 'read_command_output', group: 'Commands', effect: 'workspace-process', schemaRevision: 1 }
] as const;
export type WorkToolId = typeof WORK_TOOL_CATALOG[number]['id'];
export type WorkToolGroup = 'Inspect' | 'Edit' | 'Commands';
export interface WorkToolChoice { groups: string[]; allow: string[]; deny: string[] }
export interface WorkToolCustomGroup { id: string; name: string; tools: string[] }
export interface WorkToolSelection {
    catalogRevision: number; projectUri: string; taskId: string; grantRevision: number;
    connectionId: string; modelId: string;
    tools: { id: WorkToolId; schemaRevision: number }[];
}
const ids = new Set<string>(WORK_TOOL_CATALOG.map(tool => tool.id));
const unique = (items: readonly string[]) => [...new Set(items)];
export function resolveWorkTools(choice: WorkToolChoice, customGroups: readonly WorkToolCustomGroup[],
    commandsAvailable: boolean): { tools: WorkToolId[]; unavailable: string[] } {
    const selected = new Set<string>(choice.allow);
    const requested = new Set<string>([...choice.allow, ...choice.deny]);
    for (const group of choice.groups) {
        const members = ['Inspect', 'Edit', 'Commands'].includes(group) ?
            WORK_TOOL_CATALOG.filter(tool => tool.group === group).map(tool => tool.id) :
            customGroups.find(item => item.id === group)?.tools;
        if (!members) { requested.add(group); continue; }
        for (const id of members) { selected.add(id); requested.add(id); }
    }
    for (const id of choice.deny) selected.delete(id);
    const unavailable: string[] = [];
    for (const id of unique([...requested, ...selected])) {
        if (!ids.has(id)) unavailable.push(`${id}: unknown or changed tool`);
        else if (!commandsAvailable && (id === 'run_command' || id === 'read_command_output'))
            unavailable.push(`${id}: no approved task command`);
    }
    if (!selected.has('run_command') && selected.has('read_command_output'))
        unavailable.push('read_command_output: requires run_command');
    return { tools: WORK_TOOL_CATALOG.filter(tool => selected.has(tool.id) &&
        (commandsAvailable || tool.group !== 'Commands') &&
        (tool.id !== 'read_command_output' || selected.has('run_command'))).map(tool => tool.id), unavailable };
}
export function makeWorkToolSelection(input: Omit<WorkToolSelection, 'catalogRevision' | 'tools'>,
    toolIds: readonly WorkToolId[]): WorkToolSelection {
    return parseWorkToolSelection({ ...input, catalogRevision: WORK_TOOL_CATALOG_REVISION,
        tools: WORK_TOOL_CATALOG.filter(tool => toolIds.includes(tool.id)).map(tool =>
            ({ id: tool.id, schemaRevision: tool.schemaRevision })) });
}
export function parseWorkToolSelection(value: unknown): WorkToolSelection {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Work tool selection');
    const x = value as Record<string, unknown>;
    if (Object.keys(x).sort().join(',') !==
        'catalogRevision,connectionId,grantRevision,modelId,projectUri,taskId,tools' ||
        x.catalogRevision !== WORK_TOOL_CATALOG_REVISION ||
        typeof x.projectUri !== 'string' || !x.projectUri.startsWith('file:///') ||
        typeof x.taskId !== 'string' || !x.taskId ||
        !Number.isSafeInteger(x.grantRevision) || (x.grantRevision as number) < 0 ||
        typeof x.connectionId !== 'string' || !x.connectionId ||
        typeof x.modelId !== 'string' || !x.modelId || !Array.isArray(x.tools) ||
        x.tools.length > WORK_TOOL_CATALOG.length)
        throw new Error('Invalid Work tool selection');
    const tools: WorkToolSelection['tools'] = [];
    for (const item of x.tools) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid Work tool identity');
        const entry = item as Record<string, unknown>;
        const current = WORK_TOOL_CATALOG.find(tool => tool.id === entry.id);
        if (!current || Object.keys(entry).sort().join(',') !== 'id,schemaRevision' ||
            entry.schemaRevision !== current.schemaRevision || tools.some(tool => tool.id === entry.id))
            throw new Error('Unknown or changed Work tool');
        tools.push({ id: current.id, schemaRevision: current.schemaRevision });
    }
    if (tools.some(tool => tool.id === 'read_command_output') && !tools.some(tool => tool.id === 'run_command'))
        throw new Error('Work command output requires run_command');
    return { catalogRevision: WORK_TOOL_CATALOG_REVISION, projectUri: x.projectUri,
        taskId: x.taskId, grantRevision: x.grantRevision as number,
        connectionId: x.connectionId, modelId: x.modelId, tools };
}
