/** Adapter-internal Local tool protocol. Provider-native envelopes must be translated before
 * this parser; these requests are untrusted data and confer no ExecutionGrant authority. */
export type LocalToolRequest =
    | { id: string; name: 'read'; arguments: { path: string; maxBytes: number;
        offset?: number; expectedSourceHash?: string } }
    | { id: string; name: 'list'; arguments: { path: string; maxEntries: number } }
    | { id: string; name: 'edit'; arguments: { operation: 'create' | 'modify'; path: string; content: string } }
    | { id: string; name: 'process'; arguments: { kind: 'test' | 'build'; commandId: string } }
    | { id: string; name: 'output'; arguments: { handle: string; offset: number; maxBytes: number } };

export interface LocalToolResult {
    id: string;
    name: LocalToolRequest['name'];
    status: 'completed' | 'denied' | 'failed' | 'cancelled';
    output: string;
    truncated: boolean;
}

export const LOCAL_TOOL_LIMITS = Object.freeze({
    jsonBytes: 131_072, calls: 8, pathBytes: 512, readBytes: 32_768,
    listEntries: 100, editBytes: 65_536, resultBytes: 32_768
});

/** Only these parser failures are harmless input errors. Path and identity failures
 * remain authority denials even when they occur before the broker is called. */
export function recoverableLocalReadError(error: unknown): string | undefined {
    if (!(error instanceof Error)) return undefined;
    switch (error.message) {
        case 'Invalid Local tool fields': return 'INVALID_ARGUMENTS: Use path, optional maxBytes, offset and expectedSourceHash.';
        case 'Invalid Local read offset': return 'INVALID_OFFSET: Use a nonnegative UTF-8 byte offset.';
        case 'Invalid Local source identity': return 'INVALID_SOURCE_IDENTITY: Use the 64-character sourceHash returned by the first page.';
        case 'Local read continuation requires source identity':
            return 'SOURCE_IDENTITY_REQUIRED: Start with offset 0 to obtain sourceHash, then retry the later range.';
        case 'Invalid Local tool limit': return 'INVALID_PAGE_SIZE: Use 1–4096 bytes for a page.';
        default: return undefined;
    }
}

/** Only errors that cannot grant access to a path, command, or output handle are
 * returned to Pi for correction. The original arguments and parser exception are
 * deliberately not included in the feedback or saved transcript. */
export function recoverableLocalWorkError(name: string, value: unknown, error: unknown): string | undefined {
    if (!['read_file', 'list_files', 'edit_file', 'run_command', 'read_command_output'].includes(name) ||
        !(error instanceof Error)) return undefined;
    const args = value && typeof value === 'object' && !Array.isArray(value) ?
        value as Record<string, unknown> : undefined;
    if (!args) return 'INVALID_ARGUMENTS: Send an object with the fields in this tool schema.';
    if (['read_file', 'list_files', 'edit_file'].includes(name)) {
        if (args.path === undefined || args.path === '')
            return name === 'list_files' ? 'INVALID_PATH: Use path "." for the project root, or a relative directory path.' :
                'INVALID_PATH: Supply a nonempty relative file path.';
        if (typeof args.path !== 'string') return 'INVALID_PATH: Supply a relative path as a string.';
        try { relativePath(args.path, name === 'list_files'); }
        catch { return undefined; } // Escape, private paths, and other unsafe path strings stop the run.
    }
    if (name === 'read_file') return recoverableLocalReadError(error);
    if (name === 'list_files') {
        if (!Number.isSafeInteger(args.maxEntries) || (args.maxEntries as number) < 1 ||
            (args.maxEntries as number) > LOCAL_TOOL_LIMITS.listEntries)
            return 'INVALID_ENTRY_LIMIT: maxEntries must be an integer from 1 to 100.';
        return error.message === 'Invalid Local tool fields' ?
            'INVALID_ARGUMENTS: Use only path and maxEntries.' : undefined;
    }
    if (name === 'edit_file') {
        if (args.operation === undefined || typeof args.operation !== 'string')
            return 'INVALID_OPERATION: operation must be "create" or "modify".';
        if (args.operation !== 'create' && args.operation !== 'modify') return undefined;
        if (typeof args.content !== 'string' || Buffer.byteLength(args.content, 'utf8') > LOCAL_TOOL_LIMITS.editBytes)
            return 'INVALID_CONTENT: content must be a string of at most 65536 UTF-8 bytes.';
        return error.message === 'Invalid Local tool fields' ?
            'INVALID_ARGUMENTS: Use only operation, path and content.' : undefined;
    }
    if (name === 'run_command') {
        if (args.kind === undefined || typeof args.kind !== 'string')
            return 'INVALID_KIND: kind must be "test" or "build".';
        if (args.kind !== 'test' && args.kind !== 'build') return undefined;
        if (args.commandId === undefined || typeof args.commandId !== 'string')
            return 'INVALID_COMMAND_ID: Supply an approved commandId string.';
        return error.message === 'Invalid Local tool fields' ?
            'INVALID_ARGUMENTS: Use only kind and commandId.' : undefined;
    }
    if (typeof args.handle !== 'string' || !/^[a-f0-9]{32}$/u.test(args.handle))
        return 'INVALID_OUTPUT_HANDLE: Supply the handle returned by an approved command.';
    if (!Number.isSafeInteger(args.offset) || (args.offset as number) < 0)
        return 'INVALID_OFFSET: offset must be a nonnegative UTF-8 byte offset.';
    if (!Number.isSafeInteger(args.maxBytes) || (args.maxBytes as number) < 1 ||
        (args.maxBytes as number) > 4096)
        return 'INVALID_PAGE_SIZE: maxBytes must be an integer from 1 to 4096.';
    return error.message === 'Invalid Local tool fields' ?
        'INVALID_ARGUMENTS: Use only handle, offset and maxBytes.' : undefined;
}

function object(value: unknown, fields: readonly string[], required = fields): Record<string, unknown> {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Invalid Local tool object');
    const keys = Object.keys(value);
    if (keys.some(key => !fields.includes(key)) || required.some(key => !keys.includes(key)))
        throw new Error('Invalid Local tool fields');
    return value as Record<string, unknown>;
}

function boundedText(value: unknown, maxBytes: number): string {
    if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > maxBytes ||
        value.includes('\0')) throw new Error('Invalid Local tool text');
    return value;
}

function identifier(value: unknown): string {
    const text = boundedText(value, 64);
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/u.test(text))
        throw new Error('Invalid Local tool ID');
    return text;
}

function relativePath(value: unknown, allowRoot = false): string {
    const path = boundedText(value, LOCAL_TOOL_LIMITS.pathBytes);
    if (allowRoot && path === '.') return path;
    const segments = path.split('/');
    if (!path || path.startsWith('/') || path.startsWith('~') || path.includes('\\') ||
        path.includes(':') || /[\u0000-\u001f\u007f]/u.test(path) ||
        segments.some(part => !part || part === '.' || part === '..' ||
            privateLocalPathPart(part)))
        throw new Error('Invalid Local tool path');
    return path;
}

export function privateLocalPathPart(part: string): boolean {
    const p = part.toLowerCase();
    return ['.git', '.dope', '.codex', '.agents', '.ssh', '.aws', '.config', '.gnupg', '.kube',
        '.docker', '.azure', '.npmrc', '.yarnrc', '.yarnrc.yml', '.netrc', '.pypirc', '.gitconfig',
        '.git-credentials', 'id_rsa', 'id_ed25519', 'credentials.json', 'secrets', 'secret',
        'credentials', 'private', 'node_modules'].includes(p) || p === '.env' ||
        p.startsWith('.env.') || ['.pem', '.key', '.p12', '.pfx'].some(s => p.endsWith(s)) ||
        ['secret.', 'token.', 'credential.'].some(s => p.startsWith(s));
}

function boundedInteger(value: unknown, max: number): number {
    if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > max)
        throw new Error('Invalid Local tool limit');
    return value as number;
}

function parseRequest(value: unknown): LocalToolRequest {
    const call = object(value, ['id', 'name', 'arguments']);
    const id = identifier(call.id);
    if (call.name === 'read') {
        const args = object(call.arguments, ['path', 'maxBytes', 'offset', 'expectedSourceHash'], ['path']);
        const range = args.offset !== undefined || args.expectedSourceHash !== undefined;
        if (args.offset !== undefined && (!Number.isSafeInteger(args.offset) || (args.offset as number) < 0))
            throw new Error('Invalid Local read offset');
        if (args.expectedSourceHash !== undefined &&
            (typeof args.expectedSourceHash !== 'string' || !/^[a-f0-9]{64}$/u.test(args.expectedSourceHash)))
            throw new Error('Invalid Local source identity');
        if ((args.offset as number | undefined ?? 0) > 0 && args.expectedSourceHash === undefined)
            throw new Error('Local read continuation requires source identity');
        return { id, name: 'read', arguments: { path: relativePath(args.path),
            maxBytes: boundedInteger(args.maxBytes ?? (range ? 4096 : 8192),
                range ? 4096 : LOCAL_TOOL_LIMITS.readBytes),
            ...(range ? { offset: (args.offset as number | undefined) ?? 0 } : {}),
            ...(args.expectedSourceHash === undefined ? {} : { expectedSourceHash: args.expectedSourceHash as string }) } };
    }
    if (call.name === 'list') {
        const args = object(call.arguments, ['path', 'maxEntries']);
        return { id, name: 'list', arguments: { path: relativePath(args.path, true),
            maxEntries: boundedInteger(args.maxEntries, LOCAL_TOOL_LIMITS.listEntries) } };
    }
    if (call.name === 'edit') {
        const args = object(call.arguments, ['operation', 'path', 'content']);
        if (args.operation !== 'create' && args.operation !== 'modify')
            throw new Error('Unsupported Local edit operation');
        return { id, name: 'edit', arguments: { operation: args.operation,
            path: relativePath(args.path), content: boundedText(args.content, LOCAL_TOOL_LIMITS.editBytes) } };
    }
    if (call.name === 'process') {
        const args = object(call.arguments, ['kind', 'commandId']);
        if (args.kind !== 'test' && args.kind !== 'build')
            throw new Error('Unsupported Local process kind');
        return { id, name: 'process', arguments: { kind: args.kind,
            commandId: identifier(args.commandId) } };
    }
    if (call.name === 'output') {
        const args = object(call.arguments, ['handle', 'offset', 'maxBytes']);
        if (typeof args.handle !== 'string' || !/^[a-f0-9]{32}$/u.test(args.handle) ||
            !Number.isSafeInteger(args.offset) || (args.offset as number) < 0)
            throw new Error('Invalid Local output handle');
        return { id, name: 'output', arguments: { handle: args.handle,
            offset: args.offset as number, maxBytes: boundedInteger(args.maxBytes, 4096) } };
    }
    throw new Error('Unsupported Local tool name');
}

/** Parse one complete normalized JSON batch. The caller retains IDs across turns and the broker
 * independently maps command IDs and checks grant, workspace, paths, and OS containment. */
export function parseLocalToolRequests(json: string, usedIds: ReadonlySet<string> = new Set()): readonly LocalToolRequest[] {
    if (typeof json !== 'string' || Buffer.byteLength(json, 'utf8') > LOCAL_TOOL_LIMITS.jsonBytes)
        throw new Error('Invalid Local tool JSON size');
    let value: unknown;
    try { value = JSON.parse(json); }
    catch { throw new Error('Invalid Local tool JSON'); }
    if (!Array.isArray(value) || value.length < 1 || value.length > LOCAL_TOOL_LIMITS.calls)
        throw new Error('Invalid Local tool batch');
    const calls = value.map(parseRequest);
    const ids = calls.map(call => call.id);
    if (new Set(ids).size !== ids.length || ids.some(id => usedIds.has(id)))
        throw new Error('Duplicate Local tool ID');
    for (const call of calls) {
        Object.freeze(call.arguments);
        Object.freeze(call);
    }
    return Object.freeze(calls);
}

/** Broker output boundary; never persist provider-native tool results as canonical AgentRun data. */
export function parseLocalToolResult(value: unknown): LocalToolResult {
    const result = object(value, ['id', 'name', 'status', 'output', 'truncated']);
    if (!['read', 'list', 'edit', 'process', 'output'].includes(result.name as string) ||
        !['completed', 'denied', 'failed', 'cancelled'].includes(result.status as string) ||
        typeof result.truncated !== 'boolean') throw new Error('Invalid Local tool result');
    return Object.freeze({ id: identifier(result.id), name: result.name as LocalToolResult['name'],
        status: result.status as LocalToolResult['status'],
        output: boundedText(result.output, LOCAL_TOOL_LIMITS.resultBytes), truncated: result.truncated });
}
