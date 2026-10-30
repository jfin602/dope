import type { AgentExecutionAdapter, AgentExecutionHandle, AgentExecutionRequest } from '@dope/agent-core/lib/execution';
import { parseExecutionGrant } from '@dope/agent-core/lib/authority';
import { parseLocalToolRequests } from '@dope/agent-core/lib/node/local-tool-contracts';
import type { LocalProcessCommand } from '@dope/agent-core/lib/node/local-tool-broker';
import { preflightLocalToolSandbox } from '@dope/agent-core/lib/node/local-tool-sandbox';
import { ExecutionWorkspace } from '@dope/agent-core/lib/node/execution-workspace';
import { localWorkspaceBroker } from './local-agent-turn-loop';
import type { PiModelBridge } from './pi-model-bridge';
import type { PiRuntimeFactory, PiRuntimeHost } from './pi-runtime-host';

const expectedTools = ['dope_edit', 'dope_list', 'dope_process', 'dope_read'];
const secret = /\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{16,}|AKIA[A-Z0-9]{16})\b|\b(?:access[_-]?token|api[_-]?key|password|secret|token|authorization)\s*[:=]\s*\S+|\bBearer\s+\S+/giu;
const safe = (text: string, max = 8192) => text.replace(secret, '[redacted]').slice(0, max);

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
        const result = (async () => {
            try {
                request.onEvent({ kind: 'status', summary: 'Pi Work started' });
                const answer = await host.runWork(request.prompt, async raw => {
                  try {
                    if (cancelled || this.disposed || ++count > 32) throw new Error('Pi Work stopped');
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
                    if (call.name === 'process') request.onEvent({ kind: 'command-completed',
                        summary: 'Approved candidate command finished', commandId: call.id,
                        command: call.arguments.commandId, status: response.status === 'completed' ? 'completed' : 'failed',
                        output: safe(response.output), outputTruncated: response.truncated });
                    if (response.status !== 'completed') {
                        denied = true;
                        request.onEvent({ kind: 'authority-denied',
                            summary: 'Pi Work tool denied by execution authority' });
                    }
                    if (response.status === 'completed' && call.name === 'edit') request.onEvent({ kind: 'file-changed',
                        summary: 'Candidate file changed', path: call.arguments.path });
                    return { status: response.status, output: safe(response.output) };
                  } catch {
                    denied = true;
                    request.onEvent({ kind: 'authority-denied', summary: 'Pi Work tool denied by execution authority' });
                    throw new Error('Pi Work tool denied');
                  }
                });
                if (cancelled || denied || answer.modelId !== request.modelId) throw new Error('Pi Work denied or model changed');
                request.onEvent({ kind: 'agent-message', summary: 'Pi Work response', text: safe(answer.text, 512),
                    truncated: answer.text.length > 512, redacted: safe(answer.text) !== answer.text });
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
