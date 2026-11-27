/** Trusted Work registration. Each eligible definition has a broker implementation;
 * the hashes are independently checked against the pinned Pi/adapter schemas by
 * the worker and again on every broker call. Historical IDs remain parseable
 * only through the archived selection reader below. */
export const WORK_TOOL_CATALOG_REVISION = 4;
export const WORK_PI_VERSION = '1.4.0';
const HISTORICAL_WORK_FILE_TOOLS = [
    { id: 'read_file', schemaRevision: 1 },
    { id: 'list_files', schemaRevision: 1 },
    { id: 'edit_file', schemaRevision: 1 }
] as const;
export const WORK_TOOL_CATALOG = [
    { id: 'read', group: 'Inspect', name: 'Read', description: 'Read a text file through the Dope broker using the Pi file schema.', effect: 'workspace-read', schemaRevision: 1 },
    { id: 'ls', group: 'Inspect', name: 'List', description: 'List a directory through the Dope broker using the Pi list schema.', effect: 'workspace-read', schemaRevision: 1 },
    { id: 'write', group: 'Edit', name: 'Write', description: 'Create or overwrite a file through a whole Dope operation.', effect: 'workspace-write', schemaRevision: 1 },
    { id: 'edit', group: 'Edit', name: 'Exact edit', description: 'Apply unique exact replacements through a whole Dope operation.', effect: 'workspace-write', schemaRevision: 1 },
    { id: 'run_command', group: 'Commands', name: 'Run approved command', description: 'Run an approved test or build command in the selected Work mode.', effect: 'workspace-process', schemaRevision: 1 },
    { id: 'read_command_output', group: 'Commands', name: 'Read command output', description: 'Read output from a completed approved command.', effect: 'workspace-process', schemaRevision: 1, requires: 'run_command' },
    { id: 'mcp_godot_server_info', group: 'External', name: 'Godot server information', description: 'Observe the reviewed Godot server method after project activation and per-call approval.', effect: 'workspace-read', schemaRevision: 1, serverId: 'godot', toolName: 'godot_get_server_info' }
] as const;
export const WORK_TOOL_REGISTRY = [
    { id: 'read', schemaHash: '134f19bcabe3e29d63c5cebb38f1d2556759fd08adad6bc90a4b4d3cd1fb8441', origin: 'pi', broker: 'file-read' },
    { id: 'ls', schemaHash: 'ad4ee18683e9c3d6bfa7969709a0683bc9f896099ed6a74db0b6c49444718a0c', origin: 'pi', broker: 'directory-list' },
    { id: 'write', schemaHash: 'e98a2484f667cf7c22d76ca103bf2022bf9113dc63fe38b899e71c328cb1e833', origin: 'pi', broker: 'whole-write' },
    { id: 'edit', schemaHash: '55866598f02c5e00ddfcbcae3df78081e3712de09a622bac7a6bc02ef2acc1bc', origin: 'pi', broker: 'whole-exact-edit' },
    { id: 'run_command', schemaHash: '1899c5839e68fff80875e8fac665418167014806c11b9d01b175985ae3f917f7', origin: 'bounded-adapter', broker: 'approved-test-build' },
    { id: 'read_command_output', schemaHash: 'e348a67f7d8edb7f5559b125ff141746efac1299b9dd6d3cd83ce2cb4afce07c', origin: 'bounded-adapter', broker: 'retained-output' }
] as const;
export const WORK_TOOL_UNAVAILABLE = [
    { id: 'find', name: 'Find', description: 'Pi path glob search', unavailableReason: 'No qualified bounded Dope glob operation' },
    { id: 'grep', name: 'Grep', description: 'Pi content search', unavailableReason: 'Pi implementation can spawn rg outside the Work broker' },
    { id: 'bash', name: 'Bash', description: 'Pi shell command', unavailableReason: 'Unrestricted shell cannot meet the fixed Work effect ceiling' },
    { id: 'powershell', name: 'PowerShell', description: 'Pi shell command', unavailableReason: 'Unrestricted shell cannot meet the fixed Work effect ceiling' }
] as const;
export const workToolRegistration = (id: string) => WORK_TOOL_REGISTRY.find(tool => tool.id === id);
export type WorkToolId = typeof WORK_TOOL_CATALOG[number]['id'] | typeof HISTORICAL_WORK_FILE_TOOLS[number]['id'];
export type WorkToolGroup = 'Inspect' | 'Edit' | 'Commands' | 'External';
export interface WorkToolCatalogContext {
    locality: 'local' | 'hosted' | undefined;
    commandsAvailable: boolean;
    externalOffered: boolean;
    externalConsent: boolean;
}
/** Only registrations with an explicit Dope Work broker mapping appear here. */
export function workToolCatalogFor(context: WorkToolCatalogContext) {
    const eligible = WORK_TOOL_CATALOG.map(tool => {
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
                'activated-project' as const : 'selected-work-mode' as const,
            available: unavailableReason === undefined, unavailableReason };
    });
    return [...eligible, ...WORK_TOOL_UNAVAILABLE.map(tool => ({ ...tool, group: 'Unavailable' as const,
        effect: 'unavailable' as const, schemaRevision: 0, catalogRevision: WORK_TOOL_CATALOG_REVISION,
        provider: 'local-pi' as const, projectScope: 'selected-work-mode' as const,
        available: false }))];
}
export interface WorkToolChoice { groups: string[]; allow: string[]; deny: string[] }
export interface WorkToolCustomGroup { id: string; name: string; tools: string[] }
export interface WorkToolSelection {
    catalogRevision: number; projectUri: string; taskId: string; grantRevision: number;
    connectionId: string; modelId: string;
    /** Revision 4 binds a new Start Work decision to its exact grant and mode. */
    piVersion?: string; executionMode?: 'direct' | 'isolated'; grantId?: string;
    tools: { id: WorkToolId; schemaRevision: number; schemaHash?: string }[];
}
const ids = new Set<string>(WORK_TOOL_CATALOG.map(tool => tool.id));
const unique = (items: readonly string[]) => [...new Set(items)];
export function resolveWorkTools(choice: WorkToolChoice, customGroups: readonly WorkToolCustomGroup[],
    commandsAvailable: boolean, externalAvailable = false): { tools: WorkToolId[]; unavailable: string[] } {
    const selected = new Set<string>(choice.allow);
    const requested = new Set<string>(choice.allow);
    for (const group of choice.groups) {
        const members = ['Inspect', 'Edit', 'Commands'].includes(group) ?
            WORK_TOOL_CATALOG.filter(tool => tool.group === group).map(tool => tool.id) :
            customGroups.find(item => item.id === group)?.tools;
        if (!members) { requested.add(group); continue; }
        for (const id of members) { selected.add(id); requested.add(id); }
    }
    for (const id of choice.deny) { selected.delete(id); requested.delete(id); }
    const unavailable: string[] = [];
    for (const id of unique([...requested, ...selected])) {
        if (HISTORICAL_WORK_FILE_TOOLS.some(tool => tool.id === id))
            unavailable.push(`${id}: previous Work file tool requires new review`);
        else if (!ids.has(id)) unavailable.push(`${id}: unknown or changed tool`);
        else if (!commandsAvailable && (id === 'run_command' || id === 'read_command_output'))
            unavailable.push(`${id}: no approved task command`);
        else if (id === 'mcp_godot_server_info' && !externalAvailable)
            unavailable.push(`${id}: reviewed server unavailable or project observation consent missing`);
    }
    if (!selected.has('run_command') && selected.has('read_command_output'))
        unavailable.push('read_command_output: requires run_command');
    return { tools: WORK_TOOL_CATALOG.filter(tool => selected.has(tool.id) &&
        (commandsAvailable || tool.group !== 'Commands') &&
        (externalAvailable || tool.group !== 'External') &&
        (tool.id !== 'read_command_output' || selected.has('run_command'))).map(tool => tool.id), unavailable };
}
export function makeWorkToolSelection(input: Omit<WorkToolSelection, 'catalogRevision' | 'tools' | 'piVersion'>,
    toolIds: readonly WorkToolId[]): WorkToolSelection {
    if (!input.grantId || !['direct', 'isolated'].includes(input.executionMode ?? ''))
        throw new Error('New Work tool selection requires grant and execution mode');
    if (toolIds.some(id => !WORK_TOOL_CATALOG.some(tool => tool.id === id)))
        throw new Error('Historical Work tool requires new review');
    return parseWorkToolSelection({ ...input, catalogRevision: WORK_TOOL_CATALOG_REVISION,
        piVersion: WORK_PI_VERSION,
        tools: WORK_TOOL_CATALOG.filter(tool => toolIds.includes(tool.id)).map(tool =>
            ({ id: tool.id, schemaRevision: tool.schemaRevision,
                ...(workToolRegistration(tool.id) ? { schemaHash: workToolRegistration(tool.id)!.schemaHash } : {}) })) });
}
export function parseWorkToolSelection(value: unknown): WorkToolSelection {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Work tool selection');
    const x = value as Record<string, unknown>;
    const current = x.catalogRevision === WORK_TOOL_CATALOG_REVISION;
    if (Object.keys(x).sort().join(',') !== (current ?
        'catalogRevision,connectionId,executionMode,grantId,grantRevision,modelId,piVersion,projectUri,taskId,tools' :
        'catalogRevision,connectionId,grantRevision,modelId,projectUri,taskId,tools') ||
        ![1, 2, 3, WORK_TOOL_CATALOG_REVISION].includes(x.catalogRevision as number) ||
        current && (x.piVersion !== WORK_PI_VERSION ||
            !['direct', 'isolated'].includes(x.executionMode as string) ||
            typeof x.grantId !== 'string' || !x.grantId) ||
        typeof x.projectUri !== 'string' || !x.projectUri.startsWith('file:///') ||
        typeof x.taskId !== 'string' || !x.taskId ||
        !Number.isSafeInteger(x.grantRevision) || (x.grantRevision as number) < 0 ||
        typeof x.connectionId !== 'string' || !x.connectionId ||
        typeof x.modelId !== 'string' || !x.modelId || !Array.isArray(x.tools) ||
        x.tools.length > (current ? WORK_TOOL_CATALOG.length : WORK_TOOL_CATALOG.length + HISTORICAL_WORK_FILE_TOOLS.length))
        throw new Error('Invalid Work tool selection');
    const tools: WorkToolSelection['tools'] = [];
    for (const item of x.tools) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid Work tool identity');
        const entry = item as Record<string, unknown>;
        const definition = WORK_TOOL_CATALOG.find(tool => tool.id === entry.id) ??
            (!current ? HISTORICAL_WORK_FILE_TOOLS.find(tool => tool.id === entry.id) : undefined);
        const registration = workToolRegistration(entry.id as string);
        if (!definition || Object.keys(entry).sort().join(',') !== (current && registration ?
            'id,schemaHash,schemaRevision' : 'id,schemaRevision') ||
            entry.schemaRevision !== definition.schemaRevision ||
            current && (!registration && 'group' in definition && definition.group !== 'External' ||
                registration && entry.schemaHash !== registration.schemaHash ||
                HISTORICAL_WORK_FILE_TOOLS.some(tool => tool.id === definition.id)) ||
            tools.some(tool => tool.id === entry.id) ||
            (x.catalogRevision !== 3 && !current && ['read', 'ls', 'write', 'edit'].includes(definition.id)))
            throw new Error('Unknown or changed Work tool');
        tools.push({ id: definition.id, schemaRevision: definition.schemaRevision,
            ...(current && registration ? { schemaHash: registration.schemaHash } : {}) });
    }
    if (x.catalogRevision === 1 && tools.some(tool => tool.id === 'mcp_godot_server_info'))
        throw new Error('External Work tool requires current catalog');
    if (tools.some(tool => tool.id === 'read_command_output') && !tools.some(tool => tool.id === 'run_command'))
        throw new Error('Work command output requires run_command');
    return { catalogRevision: x.catalogRevision as number, projectUri: x.projectUri,
        taskId: x.taskId, grantRevision: x.grantRevision as number,
        connectionId: x.connectionId, modelId: x.modelId,
        ...(current ? { piVersion: WORK_PI_VERSION, executionMode: x.executionMode as 'direct' | 'isolated',
            grantId: x.grantId as string } : {}), tools };
}
