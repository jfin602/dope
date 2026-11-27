/** Fixed Dope-owned Pi Work catalog. Bump a schema revision whenever the worker's
 * corresponding argument contract or effect changes. Saved approvals then fail closed. */
export const WORK_TOOL_CATALOG_REVISION = 3;
export const WORK_TOOL_CATALOG = [
    { id: 'read_file', group: 'Inspect', name: 'Read file', description: 'Read a candidate file in the isolated Work workspace.', effect: 'workspace-read', schemaRevision: 1 },
    { id: 'list_files', group: 'Inspect', name: 'List files', description: 'List a candidate directory in the isolated Work workspace.', effect: 'workspace-read', schemaRevision: 1 },
    { id: 'edit_file', group: 'Edit', name: 'Edit file', description: 'Create or modify a file under the selected Work execution mode.', effect: 'workspace-write', schemaRevision: 1 },
    { id: 'read', group: 'Inspect', name: 'Read', description: 'Read a text file through the Dope broker using the Pi file schema.', effect: 'workspace-read', schemaRevision: 1 },
    { id: 'ls', group: 'Inspect', name: 'List', description: 'List a directory through the Dope broker using the Pi list schema.', effect: 'workspace-read', schemaRevision: 1 },
    { id: 'write', group: 'Edit', name: 'Write', description: 'Create or overwrite a file through a whole Dope operation.', effect: 'workspace-write', schemaRevision: 1 },
    { id: 'edit', group: 'Edit', name: 'Exact edit', description: 'Apply unique exact replacements through a whole Dope operation.', effect: 'workspace-write', schemaRevision: 1 },
    { id: 'run_command', group: 'Commands', name: 'Run approved command', description: 'Run an approved test or build command in the isolated Work workspace.', effect: 'workspace-process', schemaRevision: 1 },
    { id: 'read_command_output', group: 'Commands', name: 'Read command output', description: 'Read output from a completed approved command.', effect: 'workspace-process', schemaRevision: 1, requires: 'run_command' },
    { id: 'mcp_godot_server_info', group: 'External', name: 'Godot server information', description: 'Observe the reviewed Godot server method after project activation and per-call approval.', effect: 'workspace-read', schemaRevision: 1, serverId: 'godot', toolName: 'godot_get_server_info' }
] as const;
export type WorkToolId = typeof WORK_TOOL_CATALOG[number]['id'];
export type WorkToolGroup = 'Inspect' | 'Edit' | 'Commands' | 'External';
export interface WorkToolCatalogContext {
    locality: 'local' | 'hosted' | undefined;
    commandsAvailable: boolean;
    externalOffered: boolean;
    externalConsent: boolean;
}
/** Only registrations with an explicit Dope Work broker mapping appear here. */
export function workToolCatalogFor(context: WorkToolCatalogContext) {
    return WORK_TOOL_CATALOG.filter(tool => !['read_file', 'list_files', 'edit_file'].includes(tool.id)).map(tool => {
        const unavailableReason = context.locality !== 'local' ?
            'Individual tools are enforceable only for the local Pi provider' :
            tool.group === 'Commands' && !context.commandsAvailable ?
                'No approved task command' :
            tool.group === 'External' && !context.externalOffered ?
                'Reviewed server is unavailable or inactive for this project and model' :
            tool.group === 'External' && !context.externalConsent ?
                'Project observation consent is required' : undefined;
        return { ...tool, catalogRevision: WORK_TOOL_CATALOG_REVISION,
            provider: 'local-pi' as const, projectScope: tool.group === 'External' ?
                'activated-project' as const : 'isolated-candidate' as const,
            available: unavailableReason === undefined, unavailableReason };
    });
}
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
    commandsAvailable: boolean, externalAvailable = false): { tools: WorkToolId[]; unavailable: string[] } {
    const selected = new Set<string>(choice.allow);
    const requested = new Set<string>(choice.allow);
    for (const group of choice.groups) {
        const members = ['Inspect', 'Edit', 'Commands'].includes(group) ?
            WORK_TOOL_CATALOG.filter(tool => tool.group === group &&
                !['read_file', 'list_files', 'edit_file'].includes(tool.id)).map(tool => tool.id) :
            customGroups.find(item => item.id === group)?.tools;
        if (!members) { requested.add(group); continue; }
        for (const id of members) { selected.add(id); requested.add(id); }
    }
    for (const id of choice.deny) { selected.delete(id); requested.delete(id); }
    const unavailable: string[] = [];
    for (const id of unique([...requested, ...selected])) {
        if (!ids.has(id)) unavailable.push(`${id}: unknown or changed tool`);
        else if (['read_file', 'list_files', 'edit_file'].includes(id))
            unavailable.push(`${id}: previous Work file tool requires new review`);
        else if (!commandsAvailable && (id === 'run_command' || id === 'read_command_output'))
            unavailable.push(`${id}: no approved task command`);
        else if (id === 'mcp_godot_server_info' && !externalAvailable)
            unavailable.push(`${id}: reviewed server unavailable or project observation consent missing`);
    }
    if (!selected.has('run_command') && selected.has('read_command_output'))
        unavailable.push('read_command_output: requires run_command');
    return { tools: WORK_TOOL_CATALOG.filter(tool => selected.has(tool.id) &&
        !['read_file', 'list_files', 'edit_file'].includes(tool.id) &&
        (commandsAvailable || tool.group !== 'Commands') &&
        (externalAvailable || tool.group !== 'External') &&
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
        ![1, 2, WORK_TOOL_CATALOG_REVISION].includes(x.catalogRevision as number) ||
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
            entry.schemaRevision !== current.schemaRevision || tools.some(tool => tool.id === entry.id) ||
            (x.catalogRevision !== 3 && ['read', 'ls', 'write', 'edit'].includes(current.id)))
            throw new Error('Unknown or changed Work tool');
        tools.push({ id: current.id, schemaRevision: current.schemaRevision });
    }
    if (x.catalogRevision === 1 && tools.some(tool => tool.id === 'mcp_godot_server_info'))
        throw new Error('External Work tool requires current catalog');
    if (tools.some(tool => tool.id === 'read_command_output') && !tools.some(tool => tool.id === 'run_command'))
        throw new Error('Work command output requires run_command');
    return { catalogRevision: x.catalogRevision as number, projectUri: x.projectUri,
        taskId: x.taskId, grantRevision: x.grantRevision as number,
        connectionId: x.connectionId, modelId: x.modelId, tools };
}
