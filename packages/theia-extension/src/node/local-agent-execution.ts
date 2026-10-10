import { realpath } from 'node:fs/promises';
import { isAbsolute, sep } from 'node:path';
import type { AgentExecutionAdapter, AgentExecutionHandle, AgentExecutionRequest } from '@dope/agent-core/lib/execution';
import { parseExecutionGrant } from '@dope/agent-core/lib/authority';
import { ExecutionWorkspace } from '@dope/agent-core/lib/node/execution-workspace';
import type { LocalProcessCommand } from '@dope/agent-core/lib/node/local-tool-broker';
import { preflightLocalToolSandbox } from '@dope/agent-core/lib/node/local-tool-sandbox';
import type { LocalSandboxPreflight } from '@dope/agent-core/lib/node/local-tool-sandbox';
import type { AIInventoryState } from '@dope/contracts/lib/ai-registry-service';
import { ModelRuntimeFailure } from '@dope/contracts/lib/model-runtime';
import { LocalContextBudget } from './local-context-budget';
import { LocalAgentTurnLoop, localWorkspaceBroker } from './local-agent-turn-loop';
import type { LocalTurnLoopBroker } from './local-agent-turn-loop';
import { LocalToolTurnTransport } from './local-tool-turn';
import { providerSetup } from './provider-setup';

const fail = (message: string, kind: ModelRuntimeFailure['failureClass'] = 'nonretryable-provider') =>
    new ModelRuntimeFailure(message, kind);

/** Inputs supplied by Dope's trusted runtime. P11 will supply the active workspace and
 * approved process commands; neither is taken from model output or the AI registry. */
export interface LocalAgentExecutionDependencies {
    inventory(): Promise<AIInventoryState>;
    workspace(request: AgentExecutionRequest): Promise<ExecutionWorkspace>;
    commands(request: AgentExecutionRequest): readonly LocalProcessCommand[];
    credential?(connectionId: string): Promise<string | undefined>;
    transport?: Pick<LocalToolTurnTransport, 'turn'>;
    sandboxPreflight?(): Promise<LocalSandboxPreflight>;
    broker?(request: AgentExecutionRequest, workspace: ExecutionWorkspace,
        commands: readonly LocalProcessCommand[]): LocalTurnLoopBroker;
    timeoutMs?: number;
}

interface ActiveLocalRun { abort: AbortController; loop: LocalAgentTurnLoop }

/** Local LM Studio execution seam. */
export class LocalAgentExecutionAdapter implements AgentExecutionAdapter {
    readonly id = 'local-lm-studio';
    private readonly active = new Set<ActiveLocalRun>();
    private disposed = false;

    constructor(private readonly dependencies: LocalAgentExecutionDependencies) {}

    async start(request: AgentExecutionRequest): Promise<AgentExecutionHandle> {
        if (this.disposed) throw fail('Local execution adapter disposed', 'connection-unavailable');
        const grant = parseExecutionGrant(request.grant);
        if (grant.taskId !== request.taskId || !request.connectionId || !request.registrationId ||
            !request.modelId || !request.prompt?.trim() || Buffer.byteLength(request.prompt, 'utf8') > 32_000 ||
            typeof request.onEvent !== 'function' || request.reasoningEffort !== undefined)
            throw fail('Invalid or unsupported Local execution request');
        if (!isAbsolute(request.projectRoot) || !isAbsolute(request.executionRoot) ||
            request.projectRoot === request.executionRoot ||
            request.executionRoot.startsWith(request.projectRoot + sep) ||
            request.projectRoot.startsWith(request.executionRoot + sep) ||
            await realpath(request.projectRoot).catch(() => '') !== request.projectRoot ||
            await realpath(request.executionRoot).catch(() => '') !== request.executionRoot)
            throw fail('Local execution requires separate canonical project and candidate roots');
        const workspace = await this.dependencies.workspace(request);
        if (!(workspace instanceof ExecutionWorkspace) || workspace.projectRoot !== request.projectRoot ||
            workspace.root !== request.executionRoot) throw fail('Active candidate workspace unavailable');
        await workspace.assertActiveBasis(request.projectRoot, request.executionRoot)
            .catch(() => { throw fail('Active candidate workspace unavailable'); });
        const preflight = await (this.dependencies.sandboxPreflight ?? preflightLocalToolSandbox)();
        if (!preflight.available) throw fail('Local OS sandbox unavailable', 'unsupported-capability');
        if (this.disposed) throw fail('Local execution adapter disposed', 'cancelled');
        const inventory = await this.dependencies.inventory();
        const connection = inventory.registry.connections.find(item => item.id === request.connectionId);
        if (!connection || connection.lifecycle !== 'enabled' || connection.config.type !== 'local' ||
            connection.config.runtime !== 'lm-studio' || request.registrationId !== connection.id)
            throw fail('Selected Local connection unavailable', 'connection-unavailable');
        try { providerSetup(connection); }
        catch { throw fail('Selected Local endpoint is not localhost LM Studio', 'connection-unavailable'); }
        const model = inventory.registry.models.find(item => item.connectionId === connection.id &&
            item.providerModelKey === request.modelId);
        if (!model || !model.enabled || model.state !== 'ready' || model.locality !== 'local' ||
            model.capabilities.agentExecution?.source !== 'adapter-known' ||
            model.capabilities.agentExecution.value !== true ||
            inventory.observations.find(item => item.connectionId === connection.id)?.health !== 'ready')
            throw fail('Selected Local model is no longer eligible', 'model-unavailable');
        const budget = new LocalContextBudget(connection.id, request.modelId, inventory);
        const loadedModelIds = inventory.loadedLocalModels?.filter(item => item.connectionId === connection.id &&
            item.contextWindowTokens > 0).map(item => item.providerModelKey) ?? [];
        if (!loadedModelIds.includes(request.modelId)) throw fail('Selected local model is not loaded', 'model-unavailable');
        const loadedContext = inventory.loadedLocalModels?.find(item => item.connectionId === connection.id &&
            item.providerModelKey === request.modelId)?.contextWindowTokens;
        if (request.selectedLoadedContextTokens !== undefined &&
            (loadedContext !== request.selectedLoadedContextTokens ||
                inventory.registry.revision !== request.selectedRegistryRevision))
            throw fail('Selected Local model or loaded context changed before start', 'model-unavailable');
        const credential = await this.dependencies.credential?.(connection.id);
        if (connection.credential && !credential) throw fail('Local connection credential unavailable', 'connection-unavailable');
        const commands = this.dependencies.commands(request);
        if (!Array.isArray(commands)) throw fail('Local process policy unavailable');
        if (this.disposed) throw fail('Local execution adapter disposed', 'cancelled');
        const abort = new AbortController();
        const broker = (this.dependencies.broker ?? localWorkspaceBroker)(request, workspace, commands);
        const loop = new LocalAgentTurnLoop(this.dependencies.transport ?? new LocalToolTurnTransport(), broker);
        const active = { abort, loop };
        this.active.add(active);
        const timeoutMs = this.dependencies.timeoutMs ?? 120_000;
        if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 600_000) {
            this.active.delete(active); loop.dispose(); throw fail('Invalid Local execution timeout');
        }
        let timedOut = false;
        const timer = setTimeout(() => { timedOut = true; abort.abort(); }, timeoutMs);
        const result = Promise.resolve().then(async () => {
            try {
                await loop.run({ request, connection, ...(credential === undefined ? {} : { credential }),
                    loadedModelIds, inventory: () => this.dependencies.inventory(), budget, signal: abort.signal });
            } catch (error) {
                if (timedOut) throw fail('Local execution timed out', 'nonretryable-provider');
                if (abort.signal.aborted) throw fail('Local execution cancelled', 'cancelled');
                throw error;
            } finally {
                clearTimeout(timer); loop.dispose(); this.active.delete(active);
            }
        });
        result.catch(() => {});
        const terminate = () => { abort.abort(); loop.dispose(); };
        return { result, cancel: async () => {
            terminate();
            let timer: ReturnType<typeof setTimeout> | undefined;
            try { await Promise.race([result.catch(() => {}), new Promise<void>(resolve => {
                timer = setTimeout(resolve, 5000);
            })]); }
            finally { if (timer) clearTimeout(timer); }
        }, terminate };
    }

    dispose(): void {
        this.disposed = true;
        for (const run of this.active) { run.abort.abort(); run.loop.dispose(); }
    }
}
