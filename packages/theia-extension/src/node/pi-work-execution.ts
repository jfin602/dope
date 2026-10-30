import type { AgentExecutionAdapter, AgentExecutionHandle, AgentExecutionRequest } from '@dope/agent-core/lib/execution';
import { parseExecutionGrant } from '@dope/agent-core/lib/authority';
import { parseLocalToolRequests } from '@dope/agent-core/lib/node/local-tool-contracts';
import type { LocalProcessCommand } from '@dope/agent-core/lib/node/local-tool-broker';
import { preflightLocalToolSandbox } from '@dope/agent-core/lib/node/local-tool-sandbox';
import { ExecutionWorkspace } from '@dope/agent-core/lib/node/execution-workspace';
import { localWorkspaceBroker } from './local-agent-turn-loop';
import type { PiModelBridge } from './pi-model-bridge';
import type { PiRuntimeFactory, PiRuntimeHost, PiWorkEvent } from './pi-runtime-host';

const expectedTools = ['dope_edit', 'dope_list', 'dope_process', 'dope_read'];
const secret = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{16,}|AKIA[A-Z0-9]{16})\b|\b(?:access[_-]?token|api[_-]?key|password|secret|token|authorization)\s*[:=]\s*\S+|\bBearer\s+\S+|(?:^|[\s"'(])(?:\/[A-Za-z0-9._~-]+\/[^\s"')]+|[A-Za-z]:\\Users\\[^\s"')]+)/giu;
const safe = (text: string, max = 4000) => text
    .replace(/<think(?:\s[^>]*)?>[\s\S]*?<\/think>/gimu, '[reasoning omitted]')
    .replace(/^.*(?:\bdebug\b|\btraceback\b|\bchain of thought\b|<think\b).*$/gimu, '[diagnostic omitted]')
    .replace(secret, '[redacted]').replace(/[\u0000-\u001f\u007f]/gu, ' ').slice(0, max);

/** Pi's structured lifecycle is advisory. Dope's run, validation and review remain authoritative. */
export function piWorkObservation(event: PiWorkEvent):
    { kind: 'status' | 'warning' | 'provider-event'; summary: string } {
    switch (event.kind) {
        case 'agent_start': return { kind: 'status', summary: 'Pi session started' };
        case 'turn_start': return { kind: 'status', summary: 'Pi model turn running' };
        case 'turn_end': return { kind: 'status', summary: 'Pi model turn ended' };
        case 'agent_end': return { kind: 'status', summary: 'Pi session ended' };
        case 'agent_settled': return event.aborted ? { kind: 'warning', summary: 'Pi session aborted' } :
            { kind: 'status', summary: 'Pi session settled' };
        case 'tool_execution_start': return { kind: 'provider-event', summary: `Pi ${event.toolName} started` };
        case 'tool_execution_end': return event.isError ?
            { kind: 'warning', summary: `Pi ${event.toolName} failed` } :
            { kind: 'provider-event', summary: `Pi ${event.toolName} ended` };
    }
}

/** Pi owns only the model turn. Dope owns the grant, candidate, tool broker and promotion. */
export class PiWorkExecutionAdapter implements AgentExecutionAdapter {
    readonly id = 'pi-local-work';
    private readonly active = new Set<PiRuntimeHost>();
    private disposed = false;

    constructor(private readonly bridge: PiModelBridge, private readonly factory: PiRuntimeFactory,
        private readonly workspace: (request: AgentExecutionRequest) => ExecutionWorkspace,
        private readonly commands: (request: AgentExecutionRequest) => readonly LocalProcessCommand[]) {}

    async start(request: AgentExecutionRequest): Promise<AgentExecutionHandle> {
        if (this.disposed || request.reasoningEffort || !request.prompt?.trim() ||
            request.connectionId !== request.registrationId) throw new Error('Invalid Pi Work request');
        const grant = parseExecutionGrant(request.grant);
        if (grant.taskId !== request.taskId || grant.acceptedAt > new Date().toISOString())
            throw new Error('Pi Work grant unavailable');
        const workspace = this.workspace(request);
        if (!(workspace instanceof ExecutionWorkspace) || workspace.root !== request.executionRoot ||
            workspace.projectRoot !== request.projectRoot) throw new Error('Pi Work candidate unavailable');
        await workspace.assertActiveBasis(request.projectRoot, request.executionRoot);
        if (!(await preflightLocalToolSandbox()).available) throw new Error('Local OS sandbox unavailable');
        const commands = this.commands(request);
        const broker = localWorkspaceBroker(request, workspace, commands);
        const host = this.factory.create();
        this.active.add(host);
        let endpoint: string;
        try {
            await host.start();
            const binding = await this.bridge.bind({ connectionId: request.connectionId,
                modelId: request.modelId, registryRevision: request.selectedRegistryRevision,
                loadedContextTokens: request.selectedLoadedContextTokens }, host, workspace.root, { tools: true });
            endpoint = binding.endpoint;
        } catch (error) {
            this.factory.release(host); this.active.delete(host); throw error;
        }
        let cancelled = false;
        let denied = false;
        const abort = new AbortController();
        let count = 0;
        const seenTools = new Set<number>();
        let lastPiSequence = 0;
        const result = (async () => {
            try {
                request.onEvent({ kind: 'status', summary: 'Pi Work started' });
                const answer = await host.runWork(request.prompt, async raw => {
                  try {
                    if (cancelled || this.disposed) throw new Error('Pi Work stopped');
                    if (!Number.isSafeInteger(raw.id) || raw.id < 1 || seenTools.has(raw.id) || ++count > 32)
                        throw new Error('Invalid Pi Work tool event');
                    seenTools.add(raw.id);
                    if (!expectedTools.includes(raw.name)) throw new Error('Unsupported Pi Work tool');
                    const name = raw.name.slice(5);
                    const [call] = parseLocalToolRequests(JSON.stringify([{
                        id: `pi-${raw.id}`, name, arguments: raw.arguments }]));
                    this.workspace(request); // Revocation, run status and ownership are checked on every invocation.
                    await this.bridge.assertWorkSelection({ connectionId: request.connectionId,
                        modelId: request.modelId, registryRevision: request.selectedRegistryRevision,
                        loadedContextTokens: request.selectedLoadedContextTokens }, endpoint);
                    await broker.assertActive();
                    this.workspace(request);
                    if (call.name === 'process') request.onEvent({ kind: 'command-started', summary: 'Approved candidate command started',
                        commandId: call.id, command: call.arguments.commandId, status: 'running' });
                    const response = await broker.execute(call, abort.signal);
                    if (cancelled || this.disposed) throw new Error('Pi Work stopped');
                    if (call.name === 'process') request.onEvent({ kind: 'command-completed',
                        summary: 'Approved candidate command finished', commandId: call.id,
                        command: call.arguments.commandId, status: response.status === 'completed' ? 'completed' :
                            response.status === 'cancelled' ? 'cancelled' : 'failed',
                        output: safe(response.output), outputTruncated: response.truncated || safe(response.output) !== response.output });
                    if (response.status === 'denied') {
                        denied = true;
                        request.onEvent({ kind: 'authority-denied',
                            summary: 'Pi Work tool denied by execution authority' });
                    } else if (response.status === 'failed') {
                        request.onEvent({ kind: 'warning', summary: 'Approved candidate tool failed' });
                    }
                    if (response.status === 'completed' && call.name === 'edit') request.onEvent({ kind: 'file-changed',
                        summary: 'Candidate file changed', path: call.arguments.path });
                    return { status: response.status, output: safe(response.output) };
                  } catch {
                    if (cancelled || this.disposed) throw new Error('Pi Work stopped');
                    denied = true;
                    request.onEvent({ kind: 'authority-denied', summary: 'Pi Work tool denied by execution authority' });
                    throw new Error('Pi Work tool denied');
                  }
                }, event => {
                    if (cancelled || this.disposed) return;
                    if (event.sequence !== lastPiSequence + 1 || event.sequence > 512)
                        throw new Error('Pi Work event order changed');
                    lastPiSequence = event.sequence;
                    request.onEvent(piWorkObservation(event));
                });
                if (cancelled || denied || answer.modelId !== request.modelId) throw new Error('Pi Work denied or model changed');
                const text = safe(answer.text, 512);
                if (text.trim()) request.onEvent({ kind: 'agent-message', summary: 'Pi Work response', text,
                    truncated: answer.text.length > 512, redacted: text !== answer.text });
            } finally { this.factory.release(host); this.active.delete(host); }
        })();
        result.catch(() => {});
        return { result, terminate: () => { cancelled = true; abort.abort(); host.dispose(); },
            cancel: async () => { cancelled = true; abort.abort(); host.dispose(); await result.catch(() => {}); } };
    }

    dispose(): void {
        this.disposed = true;
        for (const host of this.active) this.factory.release(host);
        this.active.clear();
    }
}
