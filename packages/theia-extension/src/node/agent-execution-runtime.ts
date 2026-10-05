import { randomUUID } from 'node:crypto';
import { AGENT_SCHEMA_VERSION, parseExecutionGrant, projectPath } from '@dope/agent-core';
import type { AgentExecutionAdapter, AgentExecutionEvent, AgentExecutionHandle, AgentRun,
    AgentRunEvent, AgentTask, ExecutionGrant, ExecutionProvenance } from '@dope/agent-core';
import { AgentStore } from '@dope/agent-core/lib/node/agent-store';
import type { AIInventoryController } from './ai-registry-backend';
import type { AIRoleRoutingService } from './ai-role-routing';
import { futureFeatureRoleRequest } from '@dope/ai';

interface Active {
    root: string; run?: AgentRun; handle?: AgentExecutionHandle;
    interrupting?: Promise<void>;
    ready: Promise<void>; releaseReady(): void;
    finished: Promise<void>; releaseFinished(): void;
    tail: Promise<unknown>; sequence: number; observations: number;
    stopping: boolean; denied: boolean; interruptionFailed: boolean;
}

/** Owns mutation lifecycle across RPC connections. P5 will reconcile interrupted runs on restart. */
export class AgentExecutionRuntime {
    private readonly active = new Map<string, Active>();
    private disposed = false;

    constructor(private readonly store: AgentStore,
        private readonly routing: Pick<AIRoleRoutingService, 'resolve'>,
        private readonly inventory: Pick<AIInventoryController, 'inventory'>,
        private readonly adapters: ReadonlyMap<string, AgentExecutionAdapter>) {}

    private serial<T>(active: Active, action: () => Promise<T>): Promise<T> {
        const next = active.tail.then(action);
        active.tail = next.catch(() => {});
        return next;
    }

    private async update(active: Active, change: (run: AgentRun) => AgentRun): Promise<AgentRun> {
        if (!active.run) throw new Error('Agent run has not started');
        const next = await this.store.updateRun(active.root, active.run, change(active.run));
        active.run = next;
        return next;
    }

    private async event(active: Active, kind: AgentRunEvent['kind'], summary: string,
        details: { path?: string; status?: AgentRun['status'] } = {}): Promise<void> {
        if (!active.run) return;
        const event: AgentRunEvent = { version: AGENT_SCHEMA_VERSION, runId: active.run.id,
            sequence: active.sequence + 1, at: new Date().toISOString(), kind, summary, ...details };
        await this.store.appendEvent(active.root, event);
        active.sequence = event.sequence;
    }

    private interrupt(active: Active): Promise<void> {
        if (!active.handle) return Promise.resolve();
        if (!active.interrupting) {
            const handle = active.handle;
            active.interrupting = Promise.resolve().then(() => handle.cancel()).catch(() => {
                active.interruptionFailed = true;
                handle.terminate?.();
            });
        }
        return active.interrupting;
    }

    private observed(active: Active, observation: AgentExecutionEvent): void {
        if (active.stopping || active.denied || !active.run ||
            ['completed', 'cancelled', 'failed', 'interrupted'].includes(active.run.status)) return;
        if (!observation || !['agent-message', 'command-started', 'command-completed',
            'file-changed', 'status', 'warning', 'authority-denied', 'provider-event'].includes(observation.kind)) {
            active.denied = true;
            void this.serial(active, () => this.event(active, 'authority', 'Invalid adapter observation')).catch(() => {});
            void this.interrupt(active);
            return;
        }
        if (++active.observations > 1000) {
            active.denied = true;
            void this.serial(active, () => this.event(active, 'authority', 'Agent event limit exceeded')).catch(() => {});
            void this.interrupt(active);
            return;
        }
        if (observation.kind === 'authority-denied') active.denied = true;
        const kind: AgentRunEvent['kind'] = observation.kind === 'file-changed' ? 'file' :
            observation.kind.startsWith('command-') ? 'process' : observation.kind === 'authority-denied' ?
                'authority' : 'message';
        const summary = observation.kind === 'agent-message' ? 'Agent message received' :
            observation.kind === 'command-started' ? 'Project command started' :
            observation.kind === 'command-completed' ? 'Project command completed' :
            observation.kind === 'file-changed' ? 'Project file changed' :
            observation.kind === 'authority-denied' ? 'Execution authority denied' :
            observation.kind === 'warning' ? 'Execution warning' : 'Provider status received';
        let path: string | undefined;
        try { path = observation.kind === 'file-changed' ? projectPath(observation.path) : undefined; }
        catch {
            active.denied = true;
            void this.serial(active, () => this.event(active, 'authority', 'Execution authority denied')).catch(() => {});
            void this.interrupt(active);
            return;
        }
        void this.serial(active, async () => {
            await this.event(active, kind, summary, path ? { path } : {});
            if (path && active.run && !active.run.changedFiles.includes(path))
                await this.update(active, run => ({ ...run, changedFiles: [...run.changedFiles, path] }));
        }).catch(() => { active.denied = true; void this.interrupt(active); });
        if (observation.kind === 'authority-denied') void this.interrupt(active);
    }

    private async select(task: AgentTask, hostedAuthorized: boolean): Promise<{
        provenance: ExecutionProvenance; registrationId: string; adapter: AgentExecutionAdapter }> {
        if (typeof hostedAuthorized !== 'boolean') throw new Error('Explicit hosted project-data authorization required');
        let connectionId: string;
        let modelId: string;
        let policyRevision: number | undefined;
        if (task.modelPolicy.kind === 'follow-coding-agent') {
            const request = futureFeatureRoleRequest('coding-agent', hostedAuthorized);
            const { resolution } = await this.routing.resolve('coding-agent', request.requestHard, hostedAuthorized);
            const target = resolution.candidates[0]?.target;
            if (!target) throw new Error('No eligible Coding Agent target');
            connectionId = target.connectionId; modelId = target.modelId;
            policyRevision = resolution.policyRevision;
        } else {
            connectionId = task.modelPolicy.connectionId;
            modelId = task.modelPolicy.modelId;
        }
        const state = await this.inventory.inventory();
        const registry = state.registry;
        const connection = registry.connections.find(item => item.id === connectionId);
        const model = registry.models.find(item => item.connectionId === connectionId &&
            item.providerModelKey === modelId);
        if (!connection || !model || connection.lifecycle !== 'enabled' || !model.enabled ||
            model.state !== 'ready' || state.observations.find(item => item.connectionId === connectionId)?.health !== 'ready' ||
            model.capabilities.agentExecution?.value !== true ||
            model.capabilities.agentExecution.source !== 'adapter-known')
            throw new Error('Selected Coding Agent connection/model is unavailable or ineligible');
        if (connection.config.type === 'codex' && (model.locality !== 'hosted' || !hostedAuthorized))
            throw new Error('Hosted project-data authorization required');
        // The only 8B adapter is the independently authorized ChatGPT-plan Codex connection.
        if (connection.config.type !== 'codex' || connection.config.runtime !== 'app-server' ||
            !connection.codexAccount?.accountId || connection.codexAccount.status !== 'signed-in' ||
            connection.codexAccount.planUsage !== 'available')
            throw new Error('Selected Coding Agent execution adapter unavailable');
        const adapter = this.adapters.get(connection.config.type);
        if (!adapter) throw new Error('Selected Coding Agent execution adapter unavailable');
        return { adapter, registrationId: connection.codexAccount.accountId,
            provenance: { version: AGENT_SCHEMA_VERSION, connectionId, modelId,
                providerId: connection.config.type, runtimeKind: model.locality, adapterId: adapter.id,
                ...(policyRevision === undefined ? {} : { policyRevision }) } };
    }

    async start(root: string, folderUri: string, taskId: string, offeredGrant: ExecutionGrant,
        hostedAuthorized: boolean): Promise<AgentRun> {
        if (this.disposed) throw new Error('Agent Runtime disposed');
        if (await this.store.root(folderUri) !== root) throw new Error('Accepted project root does not match attached project');
        if (this.active.has(root)) throw new Error('A mutation run is already active for this project');
        let releaseReady!: () => void;
        let releaseFinished!: () => void;
        const active: Active = { root, ready: new Promise(resolve => { releaseReady = resolve; }), releaseReady: () => releaseReady(),
            finished: new Promise(resolve => { releaseFinished = resolve; }), releaseFinished: () => releaseFinished(),
            tail: Promise.resolve(), sequence: 0, observations: 0,
            stopping: false, denied: false, interruptionFailed: false };
        this.active.set(root, active);
        try {
            const existing = await this.store.listRuns(root);
            if (existing.some(run => ['running', 'cancelling', 'blocked'].includes(run.status)))
                throw new Error('A mutation run requires restart reconciliation before another start');
            const task = await this.store.readTask(root, taskId);
            if (!task) throw new Error('Persisted AgentTask required');
            if (task.origin.kind !== 'direct' || task.authority.profile !== 'phase-8b-project')
                throw new Error('Only a direct Phase 8B AgentTask can start');
            const grant = parseExecutionGrant(offeredGrant);
            if (grant.taskId !== task.id || grant.projectRoot !== task.projectRoot ||
                grant.acceptedAt < task.createdAt)
                throw new Error('Accepted ExecutionGrant does not match the task/project');
            const selected = await this.select(task, hostedAuthorized);
            if (this.disposed || active.stopping) throw new Error('Agent Runtime stopped before execution');
            const now = new Date().toISOString();
            const pending: AgentRun = { version: AGENT_SCHEMA_VERSION, id: randomUUID(), taskId: task.id,
                status: 'pending', grantId: grant.id, grantRevision: grant.revision,
                requestedPolicy: task.modelPolicy, projectRoot: '.', ...(task.projectId ? { projectId: task.projectId } : {}),
                createdAt: now, changedFiles: [], validationResults: [] };
            active.run = await this.store.createRun(root, pending);
            await this.update(active, run => ({ ...run, status: 'running', startedAt: now,
                provenance: selected.provenance }));
            await this.event(active, 'status', 'Agent run started', { status: 'running' });
            if (this.disposed || active.stopping) throw new Error('Agent Runtime stopped before execution');
            const handle = await selected.adapter.start({ projectRoot: root, grant, taskId: task.id,
                connectionId: selected.provenance.connectionId, registrationId: selected.registrationId,
                modelId: selected.provenance.modelId,
                prompt: `${task.objective}\n\n${task.instructions}`,
                ...(task.controls.reasoningEffort ? { reasoningEffort: task.controls.reasoningEffort } : {}),
                onEvent: observation => this.observed(active, observation) });
            active.handle = handle;
            if (handle.recovery) await this.serial(active, () => this.update(active, run => ({ ...run, recovery: handle.recovery })));
            active.releaseReady();
            if (active.stopping || active.denied || this.disposed) void this.interrupt(active);
            void this.settle(active, handle.result).catch(() => {});
            return active.run!;
        } catch (error) {
            active.releaseReady();
            if (active.handle) {
                active.handle.result.catch(() => {});
                await this.interrupt(active);
            }
            if (active.run && ['running', 'cancelling'].includes(active.run.status))
                await this.finish(active, active.stopping && !active.interruptionFailed ? 'cancelled' :
                    active.interruptionFailed ? 'interrupted' : 'failed',
                active.stopping && !active.interruptionFailed ? 'cancelled' :
                    active.interruptionFailed ? 'interrupted' : 'provider-error',
                active.stopping ? 'Agent run stopped' : 'Agent start failed');
            else { if (this.active.get(root) === active) this.active.delete(root); active.releaseFinished(); }
            throw error;
        }
    }

    private async settle(active: Active, result: Promise<void>): Promise<void> {
        let failed = false;
        try { await result; } catch { failed = true; }
        if (active.interrupting) await active.interrupting;
        const status = active.denied ? 'failed' : !failed ? 'completed' : active.stopping ?
            active.interruptionFailed ? 'interrupted' : 'cancelled' : 'failed';
        const code = active.denied ? 'authority-denied' : !failed ? undefined : active.stopping ?
            active.interruptionFailed ? 'interrupted' : 'cancelled' : 'provider-error';
        await this.finish(active, status, code, active.denied ? 'Execution authority denied' :
            status === 'completed' ? 'Agent run completed' : active.stopping ? 'Agent run stopped' :
                'Agent execution failed');
    }

    private async finish(active: Active, status: 'completed' | 'cancelled' | 'failed' | 'interrupted',
        code: NonNullable<AgentRun['outcome']>['code'] | undefined, summary: string): Promise<void> {
        try {
            await this.serial(active, async () => {
                if (!active.run || ['completed', 'cancelled', 'failed', 'interrupted'].includes(active.run.status)) return;
                await this.update(active, run => ({ ...run, status, endedAt: new Date().toISOString(),
                    ...(code ? { outcome: { code, summary } } : {}) }));
                if (this.active.get(active.root) === active) this.active.delete(active.root);
                await this.event(active, 'status', summary, { status });
            });
        } finally {
            if (this.active.get(active.root) === active) this.active.delete(active.root);
            active.releaseFinished();
        }
    }

    async stop(root: string, runId: string): Promise<AgentRun> {
        const active = this.active.get(root);
        if (!active || active.run?.id !== runId) throw new Error('Agent run is not active');
        let transitionFailed = false;
        if (!active.stopping) {
            active.stopping = true;
            try {
                await this.serial(active, async () => {
                    if (active.run?.status === 'running') {
                        await this.update(active, run => ({ ...run, status: 'cancelling' }));
                        await this.event(active, 'status', 'Agent run cancelling', { status: 'cancelling' });
                    }
                });
            } catch { transitionFailed = true; active.interruptionFailed = true; }
        }
        await active.ready;
        await this.interrupt(active);
        await active.finished;
        const run = await this.store.readRun(root, runId);
        if (!run || !['completed', 'cancelled', 'failed', 'interrupted'].includes(run.status))
            throw new Error('Agent process stopped, but terminal state could not be persisted');
        if (transitionFailed) throw new Error('Agent process stopped, but cancelling state could not be persisted');
        return run;
    }

    async dispose(): Promise<void> {
        if (this.disposed) return;
        this.disposed = true;
        // Adapter disposal synchronously kills its owned process group, including during startup.
        for (const adapter of this.adapters.values()) adapter.dispose();
        await Promise.all([...this.active.values()].map(active => active.run ?
            this.stop(active.root, active.run.id).catch(() => {}) : active.ready));
    }
}
