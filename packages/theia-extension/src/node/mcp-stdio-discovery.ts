import { createHash } from 'node:crypto';
import type { ChildProcess } from 'node:child_process';
import type { MCPContainedSession } from './mcp-contained-launch';

const MAX_LINE = 256 * 1024;
const MAX_TOOLS = 128;
const MAX_PAGES = 4;
const TIMEOUT_MS = 5000;
const PROTOCOL_VERSION = '2025-06-18';

export interface MCPDiscoveredTool {
    name: string;
    description?: string;
    inputSchema: Record<string, unknown>;
}
export interface MCPDiscovery {
    transport: 'stdio';
    serverId: string;
    registrationRevision: number;
    projectKey: string;
    protocolVersion: string;
    tools: MCPDiscoveredTool[];
    manifestRevision: string;
}
export interface MCPConnectionStatus {
    transport: 'stdio';
    serverId?: string;
    registrationRevision?: number;
    projectKey?: string;
    manifestRevision?: string;
    state: 'connecting' | 'discovered' | 'unavailable';
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    error?: string;
}

const record = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === 'object' && !Array.isArray(value);
const boundedString = (value: unknown, max: number): value is string =>
    typeof value === 'string' && value.length > 0 && value.length <= max && !/[\x00-\x1f\x7f]/u.test(value);

/** Only reads server metadata. No tool call, resource read, or prompt request is exposed. */
export class MCPStdioDiscovery {
    private nextId = 1;
    private buffer = Buffer.alloc(0);
    private pending?: { id: number; resolve: (value: unknown) => void; reject: (error: Error) => void;
        timer: NodeJS.Timeout };
    private stopped = false;
    private manifestItems?: unknown[];
    private statusValue: MCPConnectionStatus = { transport: 'stdio', state: 'connecting',
        exitCode: null, signal: null };
    private readonly child: ChildProcess;
    constructor(private readonly session: MCPContainedSession) {
        this.child = session.stdio;
        this.child.stdout?.on('data', this.onData);
        this.child.stdout?.on('end', this.onExit);
        this.child.on('close', this.onExit);
        this.child.on('error', this.onExit);
    }
    private readonly onExit = (): void => { this.fail('MCP server exited'); };
    status(): MCPConnectionStatus { return { ...this.statusValue }; }
    private readonly onData = (chunk: Buffer): void => {
        if (this.stopped) return;
        this.buffer = Buffer.concat([this.buffer, chunk]);
        if (this.buffer.length > MAX_LINE * 2) { this.fail('MCP output limit exceeded'); return; }
        for (;;) {
            const newline = this.buffer.indexOf(10);
            if (newline < 0) break;
            if (newline > MAX_LINE) { this.fail('MCP message limit exceeded'); return; }
            const line = this.buffer.subarray(0, newline);
            this.buffer = this.buffer.subarray(newline + 1);
            if (!line.length) { this.fail('Empty MCP message'); return; }
            let message: unknown;
            try { message = JSON.parse(line.toString('utf8')); }
            catch { this.fail('Invalid MCP JSON'); return; }
            const pending = this.pending;
            if (!pending || !record(message) || message.jsonrpc !== '2.0' ||
                message.id !== pending.id || ('method' in message) ||
                (('result' in message) === ('error' in message))) {
                this.fail('Unexpected MCP response'); return;
            }
            clearTimeout(pending.timer);
            this.pending = undefined;
            if ('error' in message) pending.reject(new Error('MCP server returned an error'));
            else pending.resolve(message.result);
        }
        if (this.buffer.length > MAX_LINE) this.fail('MCP message limit exceeded');
    };
    private fail(reason: string): void {
        if (this.stopped) return;
        this.stopped = true;
        this.statusValue = { ...this.statusValue, state: 'unavailable',
            exitCode: this.child.exitCode, signal: this.child.signalCode, error: reason };
        const pending = this.pending;
        this.pending = undefined;
        if (pending) { clearTimeout(pending.timer); pending.reject(new Error(reason)); }
        void this.session.close();
    }
    private request(method: 'initialize' | 'tools/list' | 'tools/call', params: Record<string, unknown>,
        signal?: AbortSignal, onSend?: () => void): Promise<unknown> {
        if (this.stopped || this.pending || signal?.aborted || !this.child.stdin?.writable)
            return Promise.reject(new Error('MCP discovery unavailable'));
        const id = this.nextId++;
        return new Promise<unknown>((resolve, reject) => {
            const abort = () => { this.fail('MCP discovery cancelled'); };
            const timer = setTimeout(() => this.fail('MCP discovery timed out'), TIMEOUT_MS);
            const done = (value: unknown) => { signal?.removeEventListener('abort', abort); resolve(value); };
            const failed = (error: Error) => { signal?.removeEventListener('abort', abort); reject(error); };
            this.pending = { id, resolve: done, reject: failed, timer };
            signal?.addEventListener('abort', abort, { once: true });
            const wire = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
            onSend?.();
            this.child.stdin!.write(wire, error => { if (error) this.fail('MCP request write failed'); });
        });
    }
    private notifyInitialized(): void {
        if (this.stopped || !this.child.stdin?.writable) throw new Error('MCP discovery unavailable');
        this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    }
    async discover(identity: { serverId: string; registrationRevision: number; projectKey: string },
        signal?: AbortSignal, approvedManifestRevision?: string): Promise<MCPDiscovery> {
        try {
            if (!boundedString(identity.serverId, 80) || !Number.isSafeInteger(identity.registrationRevision) ||
                !/^[a-f0-9]{64}$/u.test(identity.projectKey)) throw new Error('Invalid MCP discovery identity');
            this.statusValue = { ...this.statusValue, ...identity };
            const initialized = await this.request('initialize', { protocolVersion: PROTOCOL_VERSION,
                capabilities: {}, clientInfo: { name: 'dope', version: '0.13.11' } }, signal);
            if (!record(initialized) || initialized.protocolVersion !== PROTOCOL_VERSION ||
                !record(initialized.capabilities) || !record(initialized.serverInfo) ||
                !boundedString(initialized.serverInfo.name, 120) ||
                !boundedString(initialized.serverInfo.version, 120)) throw new Error('Invalid MCP initialize result');
            this.notifyInitialized();
            const tools: MCPDiscoveredTool[] = [];
            const manifestItems: unknown[] = [];
            const seenCursors = new Set<string>();
            let cursor: string | undefined;
            for (let page = 0; page < MAX_PAGES; page++) {
                const listed = await this.request('tools/list', cursor ? { cursor } : {}, signal);
                if (!record(listed) || !Array.isArray(listed.tools) || listed.tools.length > MAX_TOOLS ||
                    (listed.nextCursor !== undefined && !boundedString(listed.nextCursor, 512)))
                    throw new Error('Invalid MCP tools list');
                for (const raw of listed.tools) {
                    if (!record(raw) || !boundedString(raw.name, 128) ||
                        !/^[a-zA-Z][a-zA-Z0-9_.-]*$/u.test(raw.name) ||
                        (raw.description !== undefined && (typeof raw.description !== 'string' ||
                            raw.description.length > 4096)) || !record(raw.inputSchema) ||
                        raw.inputSchema.type !== 'object' || JSON.stringify(raw.inputSchema).length > 32 * 1024 ||
                        tools.some(tool => tool.name === raw.name)) throw new Error('Invalid MCP tool metadata');
                    tools.push({ name: raw.name, ...(raw.description ? { description: raw.description } : {}),
                        inputSchema: raw.inputSchema });
                    manifestItems.push(raw);
                    if (tools.length > MAX_TOOLS) throw new Error('MCP tool count limit exceeded');
                }
                cursor = listed.nextCursor as string | undefined;
                if (!cursor) break;
                if (seenCursors.has(cursor) || page === MAX_PAGES - 1) throw new Error('MCP cursor limit exceeded');
                seenCursors.add(cursor);
            }
            const manifestRevision = createHash('sha256')
                .update(JSON.stringify({ protocolVersion: initialized.protocolVersion,
                    serverInfo: initialized.serverInfo, tools: manifestItems })).digest('hex');
            if (approvedManifestRevision && manifestRevision !== approvedManifestRevision)
                throw new Error('MCP tool manifest changed; renewed approval required');
            this.manifestItems = manifestItems;
            this.statusValue = { ...this.statusValue, state: 'discovered', manifestRevision };
            return { transport: 'stdio', ...identity, protocolVersion: initialized.protocolVersion,
                tools, manifestRevision };
        } catch (error) {
            this.fail('MCP discovery failed');
            throw error;
        }
    }
    /** One checked zero-argument observation. Re-list before the call; a changed manifest closes the session. */
    async observe(discovery: MCPDiscovery, toolName: string, signal?: AbortSignal,
        onDispatch?: () => void): Promise<string> {
        if (this.stopped || this.statusValue.state !== 'discovered' ||
            this.statusValue.manifestRevision !== discovery.manifestRevision ||
            this.statusValue.serverId !== discovery.serverId ||
            this.statusValue.projectKey !== discovery.projectKey ||
            this.statusValue.registrationRevision !== discovery.registrationRevision ||
            !discovery.tools.some(tool => tool.name === toolName))
            throw new Error('MCP observation unavailable');
        try {
            const listed = await this.request('tools/list', {}, signal);
            if (!record(listed) || !Array.isArray(listed.tools) || listed.nextCursor !== undefined ||
                !this.manifestItems ||
                JSON.stringify(listed.tools) !== JSON.stringify(this.manifestItems))
                throw new Error('MCP tool manifest changed');
            const result = await this.request('tools/call', { name: toolName, arguments: {} }, signal, onDispatch);
            if (!record(result) || result.isError === true || !Array.isArray(result.content) ||
                result.content.length > 8 || result.content.some(item => !record(item) ||
                    item.type !== 'text' || typeof item.text !== 'string'))
                throw new Error('Invalid MCP observation result');
            const output = JSON.stringify({ serverId: discovery.serverId,
                manifestRevision: discovery.manifestRevision,
                content: result.content.map(item => (item as { text: string }).text) });
            if (Buffer.byteLength(output, 'utf8') > 8192) throw new Error('MCP observation output limit');
            return output;
        } catch (error) {
            this.fail('MCP observation failed');
            throw error;
        }
    }
    async close(): Promise<void> { this.fail('MCP discovery closed'); await this.session.close(); }
}
