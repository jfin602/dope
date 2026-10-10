/** Adapter-internal Local tool protocol. Provider-native envelopes must be translated before
 * this parser; these requests are untrusted data and confer no ExecutionGrant authority. */
export type LocalToolRequest =
    | { id: string; name: 'read'; arguments: { path: string; maxBytes: number } }
    | { id: string; name: 'list'; arguments: { path: string; maxEntries: number } }
    | { id: string; name: 'edit'; arguments: { operation: 'create' | 'modify'; path: string; content: string } }
    | { id: string; name: 'process'; arguments: { kind: 'test' | 'build'; commandId: string } };

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
            ['.git', '.dope', '.ssh', '.aws', '.config', '.npmrc', '.netrc', '.pypirc',
                '.git-credentials', 'id_rsa', 'id_ed25519', 'credentials.json'].includes(part.toLowerCase()) ||
            part.toLowerCase() === '.env' || part.toLowerCase().startsWith('.env.')))
        throw new Error('Invalid Local tool path');
    return path;
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
        const args = object(call.arguments, ['path', 'maxBytes']);
        return { id, name: 'read', arguments: { path: relativePath(args.path),
            maxBytes: boundedInteger(args.maxBytes, LOCAL_TOOL_LIMITS.readBytes) } };
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
    if (!['read', 'list', 'edit', 'process'].includes(result.name as string) ||
        !['completed', 'denied', 'failed', 'cancelled'].includes(result.status as string) ||
        typeof result.truncated !== 'boolean') throw new Error('Invalid Local tool result');
    return Object.freeze({ id: identifier(result.id), name: result.name as LocalToolResult['name'],
        status: result.status as LocalToolResult['status'],
        output: boundedText(result.output, LOCAL_TOOL_LIMITS.resultBytes), truncated: result.truncated });
}
