import { randomUUID } from 'node:crypto';
import { AGENT_SCHEMA_VERSION, isModelCapacityFailure, parseExecutionGrant, projectPath } from '@dope/agent-core';
import type { AgentExecutionAdapter, AgentExecutionEvent, AgentExecutionHandle, AgentRun,
    AgentRunEvent, AgentTask, ExecutionGrant, ExecutionProvenance, AgentExecutionRequest } from '@dope/agent-core';
import { AgentStore } from '@dope/agent-core/lib/node/agent-store';
import { captureGitBasis, captureGitFinal } from '@dope/agent-core/lib/node/git-evidence';
import { ExecutionWorkspace, PromotionFailure } from '@dope/agent-core/lib/node/execution-workspace';
import { AcceptedDirtyBasis, assertDirtyBasis } from '@dope/agent-core/lib/node/dirty-basis';
import type { AIInventoryController } from './ai-registry-backend';
import type { AIRoleRoutingService } from './ai-role-routing';
import { futureFeatureRoleRequest } from '@dope/ai';

interface Active {
    root: string; run?: AgentRun; handle?: AgentExecutionHandle; workspace?: ExecutionWorkspace; grant?: ExecutionGrant;
    interrupting?: Promise<void>;
    ready: Promise<void>; releaseReady(): void;
    finished: Promise<void>; releaseFinished(): void;
    tail: Promise<unknown>; sequence: number; observations: number;
    stopping: boolean; denied: boolean; interruptionFailed: boolean;
    wakeWait?: () => void;
    commands: Map<string, { command: string; started: number }>;
}

/** Codex reports the shell invocation, not only its argument. Keep the match exact so a
 * compound or extended command cannot satisfy a required validation target. */
function matchesValidationCommand(observed: string, target: string): boolean {
    const command = observed.trim();
    return command === target || command === `/bin/bash -lc ${target}`;
}

/** Owns mutation lifecycle and restart reconciliation across RPC connections. */
export class AgentExecutionRuntime {
    private readonly active = new Map<string, Active>();
    private disposed = false;

    constructor(private readonly store: AgentStore,
        private readonly routing: Pick<AIRoleRoutingService, 'resolve'>,
        private readonly inventory: Pick<AIInventoryController, 'inventory'>,
        private readonly adapters: ReadonlyMap<string, AgentExecutionAdapter>,
        private readonly capacityRetryDelayMs = 20_000) {}

    activeRunId(root: string): string | undefined { return this.active.get(root)?.run?.id; }
    async waitForRun(root: string, runId: string): Promise<AgentRun> {
        const active = this.active.get(root);
        if (active?.run?.id === runId) await active.finished;
        const run = await this.store.readRun(root, runId);
        if (!run || !['completed', 'cancelled', 'failed', 'interrupted'].includes(run.status))
            throw new Error('Agent run did not reach a durable terminal state');
        return run;
    }

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
        if (observation.kind === 'command-started' && observation.commandId && observation.commandId.length <= 120)
            active.commands.set(observation.commandId, { command: observation.command && observation.command.length <= 160 ?
                observation.command : '', started: Date.now() });
        void this.serial(active, async () => {
            await this.event(active, kind, summary, path ? { path } : {});
            if (observation.kind === 'command-completed' && active.run) {
                const started = observation.commandId ? active.commands.get(observation.commandId) : undefined;
                if (observation.commandId) active.commands.delete(observation.commandId);
                if (started && Number.isSafeInteger(observation.exitCode) && observation.exitCode! >= 0) {
                    const task = await this.store.readTask(active.root, active.run.taskId);
                    const matched = task?.completion.validation.filter(target =>
                        matchesValidationCommand(started.command, target.command ?? target.label)) ?? [];
                    const durationMs = Math.min(86_400_000, Math.max(0, Date.now() - started.started));
                    if ((active.run.commandEvidence?.length ?? 0) < 24) {
                        await this.update(active, run => ({ ...run, commandEvidence: [...(run.commandEvidence ?? []),
                            { version: AGENT_SCHEMA_VERSION, commandSummary: matched.length ?
                                (matched[0].command ?? matched[0].label) : 'Other project command',
                                durationMs, exitCode: observation.exitCode!, result: observation.exitCode === 0 ? 'passed' : 'failed',
                                matchedTargets: matched.map(target => target.label) }] }));
                    }
                    for (const target of matched) {
                        if (active.run.validationResults.length >= 24) break;
                        await this.update(active, run => ({ ...run, validationResults: [...run.validationResults,
                            { version: AGENT_SCHEMA_VERSION, kind: target.kind, label: target.label,
                                status: observation.exitCode === 0 ? 'passed' : 'failed', durationMs,
                                summary: `Observed command exited ${observation.exitCode}` }] }));
                        await this.event(active, 'validation', `Observed ${target.kind} command ${observation.exitCode === 0 ? 'passed' : 'failed'}`);
                    }
                }
            }
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
        return this.startInternal(root, folderUri, taskId, offeredGrant, hostedAuthorized, false);
    }

    async startSequence(root: string, folderUri: string, taskId: string, offeredGrant: ExecutionGrant,
        hostedAuthorized: boolean, acceptedDirty?: AcceptedDirtyBasis): Promise<AgentRun> {
        return this.startInternal(root, folderUri, taskId, offeredGrant, hostedAuthorized, true, acceptedDirty);
    }

    private async startInternal(root: string, folderUri: string, taskId: string, offeredGrant: ExecutionGrant,
        hostedAuthorized: boolean, sequence: boolean, acceptedDirty?: AcceptedDirtyBasis): Promise<AgentRun> {
        if (this.disposed) throw new Error('Agent Runtime disposed');
        if (await this.store.root(folderUri) !== root) throw new Error('Accepted project root does not match attached project');
        const prior = this.active.get(root);
        if (prior && prior.run && ['completed', 'cancelled', 'failed', 'interrupted'].includes(prior.run.status))
            await prior.finished;
        if (this.active.has(root)) throw new Error('A mutation run is already active for this project');
        let releaseReady!: () => void;
        let releaseFinished!: () => void;
        const active: Active = { root, ready: new Promise(resolve => { releaseReady = resolve; }), releaseReady: () => releaseReady(),
            finished: new Promise(resolve => { releaseFinished = resolve; }), releaseFinished: () => releaseFinished(),
            tail: Promise.resolve(), sequence: 0, observations: 0,
            stopping: false, denied: false, interruptionFailed: false, commands: new Map() };
        this.active.set(root, active);
        try {
            const existing = await this.store.listRuns(root);
            if (existing.some(run => ['running', 'cancelling', 'blocked'].includes(run.status)))
                throw new Error('A mutation run requires restart reconciliation before another start');
            const task = await this.store.readTask(root, taskId);
            if (!task) throw new Error('Persisted AgentTask required');
            if (task.origin.kind !== (sequence ? 'phase-stack' : 'direct') || task.authority.profile !== 'phase-8b-project')
                throw new Error('AgentTask origin does not match execution path');
            const grant = parseExecutionGrant(offeredGrant);
            if (grant.taskId !== task.id || grant.projectRoot !== task.projectRoot ||
                grant.acceptedAt < task.createdAt)
                throw new Error('Accepted ExecutionGrant does not match the task/project');
            const selected = await this.select(task, hostedAuthorized);
            if (this.disposed || active.stopping) throw new Error('Agent Runtime stopped before execution');
            const basis = await captureGitBasis(root);
            if (!basis.head) throw new Error('Phase 8B requires a committed Git HEAD');
            if (acceptedDirty) {
                if (!sequence || acceptedDirty.head !== basis.head) throw new Error('Dirty basis requires matching sequence HEAD');
                await assertDirtyBasis(root, acceptedDirty);
            } else if (!basis.clean) throw new Error('Phase 8B requires a clean project worktree');
            active.workspace = await ExecutionWorkspace.create(root, acceptedDirty);
            active.grant = grant;
            const now = new Date().toISOString();
            const pending: AgentRun = { version: AGENT_SCHEMA_VERSION, id: randomUUID(), taskId: task.id,
                status: 'pending', grantId: grant.id, grantRevision: grant.revision,
                requestedPolicy: task.modelPolicy, projectRoot: '.', ...(task.projectId ? { projectId: task.projectId } : {}),
                createdAt: now, basis, executionWorkspace: { id: active.workspace.id, basisHead: active.workspace.head },
                changedFiles: [], validationResults: [] };
            active.run = await this.store.createRun(root, pending);
            await this.update(active, run => ({ ...run, status: 'running', startedAt: now,
                provenance: selected.provenance }));
            await this.event(active, 'status', 'Agent run started', { status: 'running' });
            if (this.disposed || active.stopping) throw new Error('Agent Runtime stopped before execution');
            const request: AgentExecutionRequest = { projectRoot: root, executionRoot: active.workspace.root,
                grant, taskId: task.id,
                connectionId: selected.provenance.connectionId, registrationId: selected.registrationId,
                modelId: selected.provenance.modelId,
                prompt: `${task.objective}\n\n${task.instructions}`,
                ...(task.controls.reasoningEffort ? { reasoningEffort: task.controls.reasoningEffort } : {}),
                onEvent: observation => this.observed(active, observation) };
            const handle = await selected.adapter.start(request);
            active.handle = handle;
            if (handle.recovery) await this.serial(active, () => this.update(active, run => ({ ...run, recovery: handle.recovery })));
            active.releaseReady();
            if (active.stopping || active.denied || this.disposed) void this.interrupt(active);
            void this.settle(active, handle.result, sequence ? selected.adapter : undefined, request).catch(async () => {
                // A failed evidence write must not leave a live workspace or a held mutation slot.
                await this.finish(active, 'interrupted', 'interrupted',
                    'Agent execution could not record completion').catch(() => {});
            });
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
            else { if (this.active.get(root) === active) this.active.delete(root);
                await active.workspace?.dispose(); active.releaseFinished(); }
            throw error;
        }
    }

    private async settle(active: Active, result: Promise<void>, retryAdapter?: AgentExecutionAdapter,
        request?: AgentExecutionRequest): Promise<void> {
        let failed = false;
        let capacityExhausted = false;
        for (let retry = 0; ; ) {
            let error: unknown;
            try { await result; } catch (caught) { error = caught; }
            if (!error) break;
            failed = true;
            if (!retryAdapter || !request || active.stopping || active.denied ||
                active.interruptionFailed || !isModelCapacityFailure(error)) break;
            if (retry >= 3) { capacityExhausted = true; break; }
            retry++;
            active.handle = undefined;
            await this.serial(active, async () => {
                await this.update(active, run => ({ ...run, capacityRetries: retry }));
                await this.event(active, 'status', `Model at capacity; retry ${retry}/3 after 20 seconds`,
                    { status: 'running' });
            });
            await new Promise<void>(resolveWait => {
                const timer = setTimeout(() => { active.wakeWait = undefined; resolveWait(); }, this.capacityRetryDelayMs);
                active.wakeWait = () => { clearTimeout(timer); active.wakeWait = undefined; resolveWait(); };
                if (active.stopping || this.disposed) active.wakeWait();
            });
            if (active.stopping || this.disposed) break;
            try {
                const handle = await retryAdapter.start({ ...request,
                    prompt: `CAPACITY RETRY CONTINUATION\nA previous attempt of this same AgentTask stopped because the model was at capacity. ` +
                        `Inspect the current ExecutionWorkspace and continue from its partial candidate state.\n\n${request.prompt}` });
                active.handle = handle;
                if (active.stopping) void this.interrupt(active);
                result = handle.result;
                failed = false;
                active.interrupting = undefined;
            } catch (caught) { result = Promise.reject(caught); result.catch(() => {}); }
        }
        if (active.interrupting) await active.interrupting;
        await active.tail;
        const task = active.run ? await this.store.readTask(active.root, active.run.taskId) : undefined;
        const validationMissing = Boolean(!failed && !active.stopping && !active.denied &&
            task?.completion.requireValidationPass &&
            task.completion.validation.some(target => active.run?.validationResults.slice().reverse().find(result =>
                result.kind === target.kind && result.label === target.label)?.status !== 'passed') ||
            !failed && task?.origin.kind === 'phase-stack' && active.run?.validationResults.some(result =>
                result.status === 'failed' && active.run?.validationResults.slice().reverse().find(last =>
                    last.kind === result.kind && last.label === result.label)?.status === 'failed'));
        let promotionBlocked = false;
        let promotionError = false;
        let promotionSucceeded = false;
        if (active.workspace && active.run) {
            try {
                const delta = await active.workspace.delta();
                await this.serial(active, () => this.update(active, run => ({ ...run,
                    validationBasis: 'execution-workspace', candidateDelta: delta })));
                if (!failed && !active.stopping && !active.denied && !validationMissing && active.grant) {
                    const result = await active.workspace.promote(active.grant, delta);
                    await this.serial(active, () => this.update(active, run => ({ ...run,
                        authorityDecision: result.decision, appliedFiles: result.applied })));
                    promotionBlocked = !result.decision.allowed;
                    promotionSucceeded = result.decision.allowed;
                    if (promotionBlocked) await this.event(active, 'authority', 'Candidate changes blocked by execution grant');
                }
            } catch (error) {
                promotionBlocked = true;
                promotionError = true;
                if (error instanceof PromotionFailure) await this.serial(active, () => this.update(active, run => ({ ...run,
                    authorityDecision: { allowed: true, blocked: [] }, appliedFiles: error.appliedFiles })));
                await this.event(active, 'authority', 'Candidate classification or promotion failed');
            }
        }
        const status = active.denied || validationMissing || promotionBlocked ? 'failed' : promotionSucceeded ? 'completed' : active.stopping ?
            active.interruptionFailed ? 'interrupted' : 'cancelled' : failed ? 'failed' : 'completed';
        const code = promotionError ? 'other' : active.denied || promotionBlocked ? 'authority-denied' : validationMissing ? 'validation-failed' : promotionSucceeded ? undefined : active.stopping ?
            active.interruptionFailed ? 'interrupted' : 'cancelled' : capacityExhausted ? 'capacity-exhausted' : failed ? 'provider-error' : undefined;
        await this.finish(active, status, code, promotionError ? 'Candidate promotion failed; inspect applied files' :
            active.denied || promotionBlocked ? 'Execution authority denied' :
            validationMissing ? 'Required validation did not pass' :
            status === 'completed' ? 'Agent run completed' : active.stopping ? 'Agent run stopped' :
                capacityExhausted ? 'Model capacity retries exhausted' :
                'Agent execution failed');
    }

    private async finish(active: Active, status: 'completed' | 'cancelled' | 'failed' | 'interrupted',
        code: NonNullable<AgentRun['outcome']>['code'] | undefined, summary: string): Promise<void> {
        try {
            await this.serial(active, async () => {
                if (!active.run || ['completed', 'cancelled', 'failed', 'interrupted'].includes(active.run.status)) return;
                let finalStatus = status, finalCode = code, finalSummary = summary;
                let evidence: Awaited<ReturnType<typeof captureGitFinal>> | undefined;
                try {
                    if (!active.run.basis) throw new Error('Missing starting Git basis');
                    evidence = await captureGitFinal(active.root, active.run.basis);
                    if (evidence.final.headChanged) {
                        finalStatus = 'failed'; finalCode = 'other'; finalSummary = 'Git HEAD changed during AgentRun';
                    }
                } catch (error) {
                    finalStatus = 'failed'; finalCode = 'other'; finalSummary =
                        error instanceof Error && error.message.includes('Git HEAD changed') ?
                            'Git HEAD changed during AgentRun evidence capture' : 'Git evidence could not be captured';
                }
                await this.update(active, run => ({ ...run, status: finalStatus, endedAt: new Date().toISOString(),
                    ...(evidence ? { finalGit: evidence.final, changedFiles: evidence.changedFiles,
                        changeSummary: evidence.changeSummary } : {}),
                    ...(finalCode ? { outcome: { code: finalCode, summary: finalSummary } } : {}) }));
                if (this.active.get(active.root) === active) this.active.delete(active.root);
                await this.event(active, 'status', finalSummary, { status: finalStatus });
            });
        } finally {
            if (this.active.get(active.root) === active) this.active.delete(active.root);
            await active.workspace?.dispose();
            active.releaseFinished();
        }
    }

    async stop(root: string, runId: string): Promise<AgentRun> {
        const active = this.active.get(root);
        if (!active || active.run?.id !== runId) throw new Error('Agent run is not active');
        let transitionFailed = false;
        if (!active.stopping) {
            active.stopping = true;
            active.wakeWait?.();
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

    /** Fresh backend attachment records abandoned executions; it never starts an adapter. */
    async reconcile(root: string): Promise<void> {
        if (this.active.has(root)) return;
        for (const run of await this.store.listRuns(root)) {
            if (!['running', 'cancelling', 'blocked'].includes(run.status)) continue;
            const evidence = run.basis ? await captureGitFinal(root, run.basis).catch(() => undefined) : undefined;
            const reconciledAt = new Date().toISOString();
            const next = await this.store.updateRun(root, run, { ...run, status: 'interrupted',
                endedAt: reconciledAt < run.startedAt! ? run.startedAt : reconciledAt,
                ...(evidence ? { finalGit: evidence.final, changedFiles: evidence.changedFiles,
                    changeSummary: evidence.changeSummary } : {}),
                outcome: { code: 'interrupted', summary: evidence?.final.headChanged ?
                    'Execution abandoned; Git HEAD changed' : 'Execution abandoned after backend restart' } });
            let cursor = 0;
            let lastAt = run.startedAt ?? run.createdAt;
            for (;;) {
                const page = await this.store.readEvents(root, run.id, cursor, 100);
                cursor = page.nextSequence;
                lastAt = page.events.at(-1)?.at ?? lastAt;
                if (!page.hasMore) break;
            }
            await this.store.appendEvent(root, { version: AGENT_SCHEMA_VERSION, runId: next.id,
                sequence: cursor + 1, at: reconciledAt < lastAt ? lastAt : reconciledAt,
                kind: 'status', status: 'interrupted',
                summary: 'Agent run interrupted after backend restart' });
        }
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
