import { randomUUID } from 'node:crypto';
import { AGENT_SCHEMA_VERSION, checkEffect, createBlockedProposedAction, isModelCapacityFailure, parseAgentTask, parseExecutionGrant, projectPath } from '@dope/agent-core';
import type { AgentExecutionAdapter, AgentExecutionEvent, AgentExecutionHandle, AgentModelPolicy, AgentRun,
    AgentRunEvent, AgentTask, ExecutionGrant, ExecutionProvenance, AgentExecutionRequest, AgentTranscriptInput } from '@dope/agent-core';
import { AgentStore } from '@dope/agent-core/lib/node/agent-store';
import { captureGitBasis, captureGitFinal } from '@dope/agent-core/lib/node/git-evidence';
import { ExecutionWorkspace, PromotionFailure } from '@dope/agent-core/lib/node/execution-workspace';
import { preflightLocalToolSandbox } from '@dope/agent-core/lib/node/local-tool-sandbox';
import type { LocalSandboxPreflight } from '@dope/agent-core/lib/node/local-tool-sandbox';
import type { LocalProcessCommand } from '@dope/agent-core/lib/node/local-tool-broker';
import { CandidateValidationRunner } from '@dope/agent-core/lib/node/candidate-validation';
import { AcceptedDirtyBasis, assertDirtyBasis } from '@dope/agent-core/lib/node/dirty-basis';
import type { AIInventoryController } from './ai-registry-backend';
import type { AIRoleRoutingService } from './ai-role-routing';
import { futureFeatureRoleRequest } from '@dope/ai';
import type { SoftwareMapIndex } from '@dope/code-analysis/lib/node/software-map-index';
import { appliedMapImpact } from './agent-map-impact';
import { providerSetup } from './provider-setup';
import { projectWorkTaskContract } from './work-task-contract';
import type { PlanningStore } from '@dope/visual-planning/lib/node/planning-store';
import type { RoadmapStore } from '@dope/project-intelligence/lib/node/roadmap-store';
import { createHash } from 'node:crypto';

interface Active {
    root: string; run?: AgentRun; task?: AgentTask; handle?: AgentExecutionHandle; workspace?: ExecutionWorkspace; grant?: ExecutionGrant;
    interrupting?: Promise<void>;
    ready: Promise<void>; releaseReady(): void;
    finished: Promise<void>; releaseFinished(): void;
    tail: Promise<unknown>; sequence: number; observations: number;
    stopping: boolean; denied: boolean; interruptionFailed: boolean;
    toolRequested?: boolean; initialCandidateFingerprint?: string;
    validationAbort?: AbortController;
    wakeWait?: () => void;
    commands: Map<string, { command: string; started: number }>;
    transcriptCommands: Set<string>; lastMessage?: string; transcriptAt?: string; transcriptIncomplete?: boolean;
}

/** Codex reports the shell invocation, not only its argument. Keep the match exact so a
 * compound or extended command cannot satisfy a required validation target. */
function matchesValidationCommand(observed: string, target: string): boolean {
    const command = observed.trim();
    return command === target || command === `/bin/bash -lc ${target}` ||
        (!target.includes("'") && command === `/bin/bash -lc '${target}'`);
}

function phaseStackReviewScope(instructions: string): { delegablePaths: string[]; humanReservedPaths: string[] } | undefined {
    const lines = instructions.split('\n');
    const paths = (heading: string): string[] | undefined => {
        const start = lines.indexOf(heading);
        if (start < 0) return undefined;
        const values: string[] = [];
        for (let index = start + 1; lines[index]?.startsWith('- '); index++) values.push(lines[index].slice(2));
        return values;
    };
    const delegated = paths('Delegable paths:');
    const reserved = paths('Human reserved paths:');
    if (!delegated && !reserved) return undefined; // Historical authored stacks had no structured scope.
    if (!delegated?.length || !reserved?.length) throw new Error('Incomplete phase-stack delegation scope');
    const delegablePaths = delegated.map(path => projectPath(path));
    const humanReservedPaths = reserved.length === 1 && reserved[0] === 'none' ? [] :
        reserved.map(path => projectPath(path));
    if (new Set([...delegablePaths, ...humanReservedPaths]).size !==
        delegablePaths.length + humanReservedPaths.length)
        throw new Error('Duplicate phase-stack delegation scope');
    return { delegablePaths, humanReservedPaths };
}

/** Owns mutation lifecycle and restart reconciliation across RPC connections. */
export class AgentExecutionRuntime {
    private readonly active = new Map<string, Active>();
    private readonly reviewDecisions = new Set<string>();
    private disposed = false;

    constructor(private readonly store: AgentStore,
        private readonly routing: Pick<AIRoleRoutingService, 'resolve'>,
        private readonly inventory: Pick<AIInventoryController, 'inventory'>,
        private readonly adapters: ReadonlyMap<string, AgentExecutionAdapter>,
        private readonly capacityRetryDelayMs = 20_000,
        private readonly validationRunner = new CandidateValidationRunner(),
        private readonly mapIndex?: Pick<SoftwareMapIndex, 'status' | 'snapshot'>,
        private readonly localSandboxPreflight: () => Promise<LocalSandboxPreflight> = preflightLocalToolSandbox,
        private readonly planning?: Pick<PlanningStore, 'read'>,
        private readonly roadmap?: Pick<RoadmapStore, 'read'>) {}

    localWorkspace(request: AgentExecutionRequest): ExecutionWorkspace {
        const active = this.active.get(request.projectRoot);
        if (!active?.workspace || active.workspace.root !== request.executionRoot ||
            active.task?.id !== request.taskId || active.grant?.id !== request.grant.id ||
            active.grant.revision !== request.grant.revision || active.stopping || active.denied ||
            active.run?.status !== 'running')
            throw new Error('Active Local execution workspace unavailable');
        return active.workspace;
    }

    localCommands(request: AgentExecutionRequest): readonly LocalProcessCommand[] {
        const active = this.active.get(request.projectRoot);
        if (!active?.task || active.task.id !== request.taskId || !active.workspace ||
            active.workspace.root !== request.executionRoot) return [];
        return active.task.completion.validation.flatMap((target, index) => {
            const words = target.command?.split(' ');
            if (!words || words[0] !== 'node' || words.length < 2 || words.some(word => !word)) return [];
            const kind = target.kind === 'test' ? 'test' : target.kind === 'build' ? 'build' : undefined;
            return kind ? [{ id: `validation-${index + 1}`, kind, executable: 'node' as const,
                argv: words.slice(1) }] : [];
        });
    }

    private async recordMapImpact(root: string, run: AgentRun): Promise<void> {
        if (run.authorityDecision?.allowed && run.appliedFiles?.length && !await this.store.readMapImpact(root, run.id))
            await this.store.writeMapImpact(root, appliedMapImpact(run, this.mapIndex, root));
    }

    activeRunId(root: string): string | undefined { return this.active.get(root)?.run?.id; }
    private async recordBlockedEffects(active: Active, effects: { kind: 'create' | 'modify' | 'delete' | 'rename'; path: string }[],
        scopeBlock?: 'delegation-scope' | 'human-reserved-scope'): Promise<void> {
        if (!active.run || !active.grant) return;
        for (const effect of effects) {
            const proposed = { kind: `project-${effect.kind}` as const, scope: 'project' as const, path: effect.path };
            if (checkEffect(active.grant, proposed).allowed && !scopeBlock) continue;
            const action = createBlockedProposedAction({ id: `action-${randomUUID()}`,
                taskId: active.run.taskId, runId: active.run.id, createdAt: new Date().toISOString(),
                effect: proposed, grant: active.grant, scopeBlock,
                rationale: scopeBlock ? 'Candidate exceeds delegated or human-reserved scope' :
                    'Candidate effect is denied by the fixed execution grant' });
            await this.store.createAction(active.root, action);
        }
    }
    async waitForRun(root: string, runId: string): Promise<AgentRun> {
        const active = this.active.get(root);
        if (active?.run?.id === runId) await active.finished;
        const run = await this.store.readRun(root, runId);
        if (!run || !(['completed', 'cancelled', 'failed', 'interrupted'].includes(run.status) ||
            run.status === 'blocked' && run.candidateReview?.state === 'ready'))
            throw new Error('Agent run did not reach a durable terminal state or review hold');
        return run;
    }

    async decideCandidate(root: string, runId: string, expectedRevision: number,
        candidateFingerprint: string, decision: 'accept' | 'reject', offeredGrant?: ExecutionGrant): Promise<AgentRun> {
        if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== 0 ||
            !/^[a-f0-9]{64}$/u.test(candidateFingerprint) || !['accept', 'reject'].includes(decision))
            throw new Error('Invalid candidate review decision');
        if (this.active.has(root) || this.reviewDecisions.has(root)) throw new Error('Project execution or review is active');
        this.reviewDecisions.add(root);
        let workspace: ExecutionWorkspace | undefined;
        try {
            const run = await this.store.readRun(root, runId);
            if (!run?.candidateReview || run.candidateReview.revision !== expectedRevision ||
                run.candidateReview.candidateFingerprint !== candidateFingerprint)
                throw new Error('Stale candidate review revision or fingerprint');
            if (run.reviewDecision) {
                if (run.reviewDecision.kind !== decision) throw new Error('Candidate review already decided');
                return run;
            }
            if (run.status !== 'blocked' || !run.basis?.head || !run.candidateDelta ||
                !run.executionWorkspace || run.executionWorkspace.basisHead !== run.basis.head)
                throw new Error('Candidate review is not ready');
            const task = await this.store.readTask(root, run.taskId);
            if (!task || !['direct', 'work-item', 'phase-stack'].includes(task.origin.kind) ||
                task.reviewPolicy?.kind !== 'required' || task.projectId !== run.projectId ||
                task.origin.kind === 'work-item' && task.origin.projectId !== run.projectId)
                throw new Error('Review task identity changed');
            const at = new Date().toISOString();
            const reviewDecision = { kind: decision, revision: expectedRevision + 1, at,
                candidateFingerprint } as const;
            if (decision === 'reject') return this.store.updateRun(root, run, { ...run,
                reviewDecision, status: 'cancelled', endedAt: at < run.startedAt! ? run.startedAt : at,
                outcome: { code: 'cancelled', summary: 'Developer rejected candidate' } });

            const grant = parseExecutionGrant(offeredGrant);
            if (grant.id !== run.grantId || grant.revision !== run.grantRevision ||
                grant.taskId !== task.id || grant.projectRoot !== task.projectRoot ||
                grant.acceptedAt < task.createdAt)
                throw new Error('Execution grant changed since candidate review');
            if (!task.completion.validation.length || task.completion.validation.some(target =>
                !run.candidateReview!.validation.some(result => result.owner === 'dope' &&
                    result.kind === target.kind && result.label === target.label &&
                    result.status === 'passed' && result.candidateFingerprint === candidateFingerprint)))
                throw new Error('Required candidate validation is missing or stale');
            const authoritative = await captureGitBasis(root);
            const acceptedDirty = task.origin.kind === 'phase-stack' ?
                (await this.store.listSequences(root)).find(sequence => sequence.taskId === task.id &&
                    sequence.runIds?.includes(run.id))?.acceptedDirty : undefined;
            if (authoritative.head !== run.basis.head ||
                (acceptedDirty ? acceptedDirty.head !== run.basis.head : !authoritative.clean))
                throw new Error('Authoritative Git basis changed before review decision');
            if (acceptedDirty) await assertDirtyBasis(root, acceptedDirty);
            const savedRoot = await this.store.reviewCandidateRoot(root, run.id);
            if (!savedRoot) throw new Error('Frozen review candidate missing');
            workspace = await ExecutionWorkspace.restoreReview(root, savedRoot, run.candidateDelta,
                candidateFingerprint, acceptedDirty);
            const within = (parent: string, child: string): boolean => child === parent || child.startsWith(`${parent}/`);
            const scope = task.origin.kind === 'work-item' ? task.origin.scope :
                task.origin.kind === 'phase-stack' ? phaseStackReviewScope(task.instructions) : undefined;
            if (run.candidateDelta.effects.some(effect => !['create', 'modify'].includes(effect.kind) ||
                scope && !scope.delegablePaths.some(path => within(path, effect.path)) ||
                scope?.humanReservedPaths.some(path => within(path, effect.path) || within(effect.path, path)) ||
                !checkEffect(grant, { kind: `project-${effect.kind}`, scope: 'project', path: effect.path }).allowed))
                throw new Error('Review candidate exceeds delegation or execution authority');
            // The durable decision claim prevents a retry after a crash from applying twice.
            const claimed = await this.store.updateRun(root, run, { ...run, reviewDecision });
            let status: AgentRun['status'] = 'completed';
            let outcome: AgentRun['outcome'];
            let authorityDecision: AgentRun['authorityDecision'];
            let appliedFiles: string[] | undefined;
            try {
                const promoted = await workspace.promote(grant, run.candidateDelta);
                authorityDecision = promoted.decision;
                appliedFiles = promoted.applied;
                if (!promoted.decision.allowed) {
                    status = 'failed';
                    outcome = { code: 'authority-denied', summary: 'Candidate promotion denied by execution grant' };
                }
            } catch (error) {
                status = 'failed';
                if (error instanceof PromotionFailure) {
                    authorityDecision = { allowed: true, blocked: [] };
                    appliedFiles = error.appliedFiles;
                }
                outcome = { code: 'other', summary: 'Candidate promotion failed; inspect applied files' };
            }
            const evidence = await captureGitFinal(root, run.basis).catch(() => undefined);
            if (!evidence || evidence.final.headChanged) {
                status = 'failed';
                outcome = { code: 'other', summary: 'Git evidence changed or could not be captured after review' };
            }
            const endedAt = new Date().toISOString();
            const decided = await this.store.updateRun(root, claimed, { ...claimed, status,
                endedAt: endedAt < run.startedAt! ? run.startedAt : endedAt,
                ...(authorityDecision ? { authorityDecision } : {}),
                ...(appliedFiles ? { appliedFiles } : {}),
                ...(evidence ? { finalGit: evidence.final, changedFiles: evidence.changedFiles,
                    changeSummary: evidence.changeSummary } : {}),
                ...(outcome ? { outcome } : {}) });
            await this.recordMapImpact(root, decided);
            return decided;
        } finally {
            await workspace?.dispose();
            this.reviewDecisions.delete(root);
        }
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

    private async transcript(active: Active, input: AgentTranscriptInput): Promise<void> {
        if (!active.run || active.transcriptIncomplete) return;
        const at = new Date().toISOString();
        const orderedAt = active.transcriptAt && at < active.transcriptAt ? active.transcriptAt : at;
        const result = await this.store.appendTranscript(active.root, active.run.id, { ...input, at: orderedAt });
        active.transcriptAt = orderedAt;
        active.transcriptIncomplete = result.incomplete;
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
        if (!observation || !['reasoning', 'observation-gap', 'work-observation', 'agent-message', 'command-started', 'command-completed',
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
        if (observation.kind === 'work-observation' && observation.phase === 'requested' ||
            observation.kind === 'command-started' || observation.kind === 'file-changed')
            active.toolRequested = true;
        const kind: AgentRunEvent['kind'] = observation.kind === 'file-changed' ? 'file' :
            observation.kind.startsWith('command-') ? 'process' : observation.kind === 'authority-denied' ?
                'authority' : 'message';
        const observedSummary = 'summary' in observation ? observation.summary : '';
        const piSummary = (/^Pi (?:session (?:started|ended|settled|aborted)|model turn (?:running|ended)|(?:read_file|list_files|edit_file|run_command|dope_(?:read|list|edit|process)) (?:started|ended|failed)|Work tool stopped at (?:request-check|request-parse|workspace-check|model-check|candidate-check|broker-execute))$/u
            .test(observedSummary) ||
            /^Context compacted \((?:threshold|overflow|manual) trigger; estimated context \d+ → (?:\d+|unavailable) tokens; \d+ summary bytes; \d+ ms(?:; \d+ provider reported summarization tokens)?\)$/u
                .test(observedSummary) ||
            /^Context compaction failed \((?:threshold|overflow|manual)\)$/u.test(observedSummary) ||
            /^Optional document pointers offered: [1-4]; \d{1,5} bytes; no document body read$/u.test(observedSummary)) ?
            observedSummary : undefined;
        const summary = piSummary ?? (observation.kind === 'agent-message' ? 'Agent message received' :
            observation.kind === 'command-started' ? 'Project command started' :
            observation.kind === 'command-completed' ? 'Project command completed' :
            observation.kind === 'file-changed' ? 'Project file changed' :
            observation.kind === 'authority-denied' ? 'Execution authority denied' :
            observation.kind === 'warning' ? 'Execution warning' :
            'Provider status received');
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
            if (observation.kind !== 'reasoning' && observation.kind !== 'work-observation' && observation.kind !== 'observation-gap')
                await this.event(active, kind, summary, path ? { path } : {});
            if (observation.kind === 'observation-gap') {
                await this.transcript(active, { kind: 'marker', at: '', code: 'observation-omitted' });
            } else if (observation.kind === 'reasoning' && observation.text) {
                await this.transcript(active, { kind: 'reasoning', at: '', text: observation.text });
            } else if (observation.kind === 'work-observation') {
                await this.transcript(active, { kind: 'work', at: '', toolId: observation.toolId,
                    toolName: observation.toolName, phase: observation.phase,
                    ...(observation.detail === undefined ? {} : { detail: observation.detail }),
                    ...(observation.stage === undefined ? {} : { stage: observation.stage }),
                    ...(observation.code === undefined ? {} : { code: observation.code }),
                    ...(observation.brokerInvoked === undefined ? {} : { brokerInvoked: observation.brokerInvoked }),
                    ...(observation.effectExecuted === undefined ? {} : { effectExecuted: observation.effectExecuted }) });
            } else if (observation.kind === 'agent-message' && observation.text && observation.text !== active.lastMessage) {
                await this.transcript(active, { kind: 'message', at: '', text: observation.text,
                    truncated: observation.truncated });
                active.lastMessage = observation.text;
            } else if (observation.kind === 'command-started' && observation.commandId && observation.command &&
                !active.transcriptCommands.has(observation.commandId)) {
                await this.transcript(active, { kind: 'command-start', at: '', commandId: observation.commandId,
                    command: observation.command, ...(observation.cwd === undefined ? {} : { cwd: observation.cwd }) });
                active.transcriptCommands.add(observation.commandId);
                active.lastMessage = undefined;
            } else if (observation.kind === 'command-completed' && observation.commandId &&
                active.transcriptCommands.has(observation.commandId)) {
                const started = active.commands.get(observation.commandId);
                await this.transcript(active, { kind: 'command-finish', at: '', commandId: observation.commandId,
                    status: observation.status && observation.status !== 'running' ? observation.status :
                        observation.exitCode === 0 ? 'completed' : observation.exitCode === undefined ? 'interrupted' : 'failed',
                    ...(observation.exitCode === undefined ? {} : { exitCode: observation.exitCode }),
                    ...(started ? { durationMs: Math.min(86_400_000, Math.max(0, Date.now() - started.started)) } : {}),
                    ...(observation.stdout === undefined ? {} : { stdout: observation.stdout,
                        stdoutTruncated: observation.stdoutTruncated ?? false }),
                    ...(observation.stderr === undefined ? {} : { stderr: observation.stderr,
                        stderrTruncated: observation.stderrTruncated ?? false }),
                    ...(observation.output === undefined ? {} : { output: observation.output,
                        outputTruncated: observation.outputTruncated ?? false }) });
                active.transcriptCommands.delete(observation.commandId);
                active.lastMessage = undefined;
            }
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
                }
            }
        }).catch(() => { active.denied = true; void this.interrupt(active); });
        if (observation.kind === 'authority-denied') void this.interrupt(active);
    }

    async codingAgentReady(): Promise<boolean> {
        try { await this.select({ kind: 'follow-coding-agent' }, true); return true; }
        catch { return false; }
    }

    private async select(modelPolicy: AgentModelPolicy, hostedAuthorized: boolean): Promise<{
        provenance: ExecutionProvenance; registrationId: string; adapter: AgentExecutionAdapter;
        loadedContext?: number; registryRevision?: number; configuration?: string }> {
        if (typeof hostedAuthorized !== 'boolean') throw new Error('Explicit hosted project-data authorization required');
        let connectionId: string;
        let modelId: string;
        let policyRevision: number | undefined;
        if (modelPolicy.kind === 'follow-coding-agent') {
            const request = futureFeatureRoleRequest('coding-agent', hostedAuthorized);
            const { resolution } = await this.routing.resolve('coding-agent', request.requestHard, hostedAuthorized);
            const target = resolution.candidates[0]?.target;
            if (!target) throw new Error('No eligible Coding Agent target');
            connectionId = target.connectionId; modelId = target.modelId;
            policyRevision = resolution.policyRevision;
        } else {
            connectionId = modelPolicy.connectionId;
            modelId = modelPolicy.modelId;
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
        let registrationId: string;
        let loadedContext: number | undefined;
        let configuration: string | undefined;
        if (connection.config.type === 'codex') {
            if (model.locality !== 'hosted' || !hostedAuthorized)
                throw new Error('Hosted project-data authorization required');
            if (connection.config.runtime !== 'app-server' || !connection.codexAccount?.accountId ||
                connection.codexAccount.status !== 'signed-in' || connection.codexAccount.planUsage !== 'available')
                throw new Error('Selected Coding Agent execution adapter unavailable');
            registrationId = connection.codexAccount.accountId;
        } else if (connection.config.type === 'local') {
            if (connection.config.runtime !== 'lm-studio' || model.locality !== 'local')
                throw new Error('Selected Local execution adapter unavailable');
            try { providerSetup(connection); }
            catch { throw new Error('Selected Local endpoint must be localhost LM Studio'); }
            loadedContext = state.loadedLocalModels?.find(item => item.connectionId === connectionId &&
                item.providerModelKey === modelId)?.contextWindowTokens;
            if (!Number.isSafeInteger(loadedContext) || loadedContext! < 2304)
                throw new Error('Selected Local model has insufficient observed loaded context');
            if (!(await this.localSandboxPreflight()).available)
                throw new Error('Local OS sandbox unavailable');
            registrationId = connection.id;
            configuration = JSON.stringify(connection.config);
        } else throw new Error('Selected Coding Agent execution adapter unavailable');
        const adapter = this.adapters.get(connection.config.type);
        if (!adapter) throw new Error('Selected Coding Agent execution adapter unavailable');
        return { adapter, registrationId, loadedContext, configuration,
            ...(loadedContext === undefined ? {} : { registryRevision: state.registry.revision }),
            provenance: { version: AGENT_SCHEMA_VERSION, connectionId, modelId,
                providerId: connection.config.type, runtimeKind: model.locality, adapterId: adapter.id,
                ...(policyRevision === undefined ? {} : { policyRevision }) } };
    }

    async start(root: string, folderUri: string, taskId: string, offeredGrant: ExecutionGrant,
        hostedAuthorized: boolean): Promise<AgentRun> {
        return this.startInternal(root, folderUri, taskId, offeredGrant, hostedAuthorized, false);
    }

    async previewCandidateResume(root: string, runId: string): Promise<{
        eligible: boolean; reason?: string; sourceRunId: string; task?: AgentTask;
        candidateFingerprint?: string; effects?: AgentRun['candidateDelta']; outcome?: AgentRun['outcome'];
        uncertainCommands?: string[]; transcriptIncomplete?: boolean;
    }> {
        const unavailable = (reason: string) => ({ eligible: false, reason, sourceRunId: runId });
        const run = await this.store.readRun(root, runId);
        if (!run || !['failed', 'cancelled', 'interrupted'].includes(run.status) ||
            this.active.has(root) && this.active.get(root)?.run?.id === runId || run.candidateReview || run.reviewDecision ||
            run.authorityDecision || run.appliedFiles?.length)
            return unavailable('Run is not a stopped, unpromoted candidate');
        const task = await this.store.readTask(root, run.taskId);
        if (run.taskContract && (!task || run.taskContract.taskHash !==
            createHash('sha256').update(JSON.stringify(task)).digest('hex') ||
            run.taskContract.objective !== task.objective ||
            run.taskContract.instructionsHash !== createHash('sha256').update(task.instructions).digest('hex')))
            return unavailable('Stored Task Contract no longer matches accepted task');
        if (!task || !['direct', 'work-item'].includes(task.origin.kind) ||
            !run.basis?.head || !run.basis.clean || !run.executionWorkspace ||
            !run.candidateDelta?.effects.length || !run.candidateFingerprint || !run.provenance)
            return unavailable('Original task, source, or candidate evidence is incomplete');
        if (run.candidateDelta.effects.some(effect => !['create', 'modify'].includes(effect.kind)))
            return unavailable('Archive contains unsupported deletion or rename effects');
        if ((await this.store.listRuns(root)).some(other => other.resumedFrom?.runId === runId))
            return unavailable('This archive already has a continuation run');
        if (this.active.has(root) && this.active.get(root)?.run)
            return unavailable('Another Work run is active');
        let saved: string | undefined;
        try { saved = await this.store.partialCandidateRoot(root, runId); }
        catch { return unavailable('Archived candidate directory is unsafe'); }
        if (!saved) return unavailable('Archived candidate bytes are missing');
        try {
            const basis = await captureGitBasis(root);
            if (!basis.clean || basis.head !== run.basis.head)
                return unavailable('Authoritative source basis changed');
            const workspace = await ExecutionWorkspace.restorePartial(root, saved, run.candidateDelta, run.candidateFingerprint);
            await workspace.dispose();
            const uncertainCommands: string[] = [];
            let transcriptIncomplete = false;
            let cursor = 0;
            for (let page = 0; page < 20; page++) {
                const batch = await this.store.readTranscript(root, runId, cursor, 100);
                transcriptIncomplete ||= batch.incomplete || batch.state === 'not-recorded';
                for (const entry of batch.entries) if (entry.kind === 'command' &&
                    ['running', 'interrupted'].includes(entry.status) && uncertainCommands.length < 10)
                    uncertainCommands.push(entry.command.slice(0, 160));
                cursor = batch.nextSequence;
                if (!batch.hasMore) break;
                if (page === 19) transcriptIncomplete = true;
            }
            return { eligible: true, sourceRunId: run.id, task,
                candidateFingerprint: run.candidateFingerprint, effects: run.candidateDelta,
                outcome: run.outcome, uncertainCommands, transcriptIncomplete };
        } catch { return unavailable('Archived candidate failed integrity or source verification'); }
    }

    async resumeCandidate(root: string, folderUri: string, runId: string, expectedFingerprint: string,
        newTask: AgentTask, grant: ExecutionGrant, hostedAuthorized: boolean): Promise<AgentRun> {
        return this.startInternal(root, folderUri, newTask.id, grant, hostedAuthorized, false, undefined,
            { runId, expectedFingerprint, newTask });
    }

    async startSequence(root: string, folderUri: string, taskId: string, offeredGrant: ExecutionGrant,
        hostedAuthorized: boolean, acceptedDirty?: AcceptedDirtyBasis): Promise<AgentRun> {
        return this.startInternal(root, folderUri, taskId, offeredGrant, hostedAuthorized, true, acceptedDirty);
    }

    private async startInternal(root: string, folderUri: string, taskId: string, offeredGrant: ExecutionGrant,
        hostedAuthorized: boolean, sequence: boolean, acceptedDirty?: AcceptedDirtyBasis,
        resume?: { runId: string; expectedFingerprint: string; newTask: AgentTask }): Promise<AgentRun> {
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
            stopping: false, denied: false, interruptionFailed: false, commands: new Map(), transcriptCommands: new Set() };
        this.active.set(root, active);
        try {
            const existing = await this.store.listRuns(root);
            if (existing.some(run => ['running', 'cancelling', 'blocked'].includes(run.status)))
                throw new Error('A mutation run requires restart reconciliation before another start');
            let sourceRun: AgentRun | undefined;
            let resumeEvidence: Awaited<ReturnType<AgentExecutionRuntime['previewCandidateResume']>> | undefined;
            let task = await this.store.readTask(root, taskId);
            if (resume) {
                const preview = await this.previewCandidateResume(root, resume.runId);
                if (!preview.eligible || preview.candidateFingerprint !== resume.expectedFingerprint || !preview.task)
                    throw new Error(preview.reason ?? 'Candidate resume evidence changed');
                resumeEvidence = preview;
                sourceRun = await this.store.readRun(root, resume.runId);
                const proposed = parseAgentTask(resume.newTask);
                const original = preview.task;
                if (task || proposed.id !== taskId || proposed.id === original.id ||
                    !sourceRun?.endedAt || proposed.createdAt < sourceRun.endedAt ||
                    JSON.stringify({ ...proposed, id: original.id, createdAt: original.createdAt }) !== JSON.stringify(original))
                    throw new Error('Continuation task differs from original task or already exists');
                task = proposed;
            }
            if (!task) throw new Error('Persisted AgentTask required');
            active.task = task;
            if (!resume && task.origin.kind === 'work-item' && existing.some(run => run.taskId === task.id))
                throw new Error('WorkItem AgentTask already has an AgentRun; launch a new task for another attempt');
            if (!(sequence ? task.origin.kind === 'phase-stack' :
                task.origin.kind === 'direct' || task.origin.kind === 'work-item') ||
                task.authority.profile !== 'phase-8b-project')
                throw new Error('AgentTask origin does not match execution path');
            if (task.origin.kind === 'work-item' &&
                (!task.completion.requireValidationPass || !task.completion.validation.length ||
                    task.completion.validation.some(target => !target.command)))
                throw new Error('WorkItem task requires approved Dope validation before Start');
            if (task.origin.kind === 'direct' &&
                (task.reviewPolicy?.kind !== 'required' || !task.completion.requireValidationPass ||
                    !task.completion.validation.length || task.completion.validation.some(target => !target.command?.trim())))
                throw new Error('Direct Work requires a validation command and candidate review before Start');
            const grant = parseExecutionGrant(offeredGrant);
            if (grant.taskId !== task.id || grant.projectRoot !== task.projectRoot ||
                grant.acceptedAt < task.createdAt || resume && sourceRun &&
                    (grant.id === sourceRun.grantId || grant.acceptedAt < sourceRun.endedAt!))
                throw new Error('Accepted ExecutionGrant does not match the task/project');
            const selected = await this.select(task.modelPolicy, hostedAuthorized);
            if (resume && JSON.stringify(selected.provenance) !== JSON.stringify(sourceRun?.provenance))
                throw new Error('Original model binding changed; choose and authorize a new Work task');
            if (selected.provenance.runtimeKind === 'local' && task.controls.reasoningEffort)
                throw new Error('Local Coding Agent does not support reasoning effort controls');
            if (this.disposed || active.stopping) throw new Error('Agent Runtime stopped before execution');
            const basis = await captureGitBasis(root);
            if (!basis.head) throw new Error('Phase 8B requires a committed Git HEAD');
            if (acceptedDirty) {
                if (!sequence || acceptedDirty.head !== basis.head) throw new Error('Dirty basis requires matching sequence HEAD');
                await assertDirtyBasis(root, acceptedDirty);
            } else if (!basis.clean) throw new Error('Phase 8B requires a clean project worktree');
            const taskContract = await projectWorkTaskContract(root, task, grant, basis.head,
                this.planning, this.roadmap);
            if (resume) {
                if (!sourceRun?.candidateDelta || !sourceRun.candidateFingerprint)
                    throw new Error('Original candidate evidence missing');
                for (const effect of sourceRun.candidateDelta.effects) {
                    if (!checkEffect(grant, { kind: `project-${effect.kind}`, scope: 'project', path: effect.path }).allowed ||
                        task.origin.kind === 'work-item' && (
                            !task.origin.scope.delegablePaths.some(path => effect.path === path || effect.path.startsWith(`${path}/`)) ||
                            task.origin.scope.humanReservedPaths.some(path => effect.path === path || effect.path.startsWith(`${path}/`))))
                        throw new Error('Restored candidate exceeds fresh grant or delegated scope');
                }
                const saved = await this.store.partialCandidateRoot(root, resume.runId);
                if (!saved) throw new Error('Archived candidate bytes missing');
                active.workspace = await ExecutionWorkspace.restorePartial(root, saved,
                    sourceRun.candidateDelta, sourceRun.candidateFingerprint);
                await active.workspace.assertActiveBasis(root, active.workspace.root);
                if ((await captureGitBasis(root)).head !== sourceRun.basis?.head)
                    throw new Error('Original source HEAD changed');
                await this.store.createTask(root, task);
            } else active.workspace = await ExecutionWorkspace.create(root, acceptedDirty);
            active.initialCandidateFingerprint = await active.workspace.fingerprint();
            active.grant = grant;
            const now = new Date().toISOString();
            const pending: AgentRun = { version: AGENT_SCHEMA_VERSION, id: randomUUID(), taskId: task.id,
                status: 'pending', grantId: grant.id, grantRevision: grant.revision,
                requestedPolicy: task.modelPolicy, projectRoot: '.', ...(task.projectId ? { projectId: task.projectId } : {}),
                createdAt: now, basis, executionWorkspace: { id: active.workspace.id, basisHead: active.workspace.head },
                taskContract,
                changedFiles: [], validationResults: [],
                ...(resume ? { resumedFrom: { runId: resume.runId, candidateFingerprint: resume.expectedFingerprint } } : {}) };
            active.run = await this.store.createRun(root, pending);
            await this.update(active, run => ({ ...run, status: 'running', startedAt: now,
                provenance: selected.provenance }));
            await this.event(active, 'status', resume ? 'Resumed from verified saved candidate' : 'Agent run started', { status: 'running' });
            await this.transcript(active, { kind: 'marker', at: '', code: 'run-started' });
            if (this.disposed || active.stopping) throw new Error('Agent Runtime stopped before execution');
            if (selected.provenance.runtimeKind === 'local') {
                const current = await this.select(task.modelPolicy, hostedAuthorized);
                if (JSON.stringify(current.provenance) !== JSON.stringify(selected.provenance) ||
                    current.loadedContext !== selected.loadedContext || current.configuration !== selected.configuration ||
                    current.registryRevision !== selected.registryRevision ||
                    current.adapter !== selected.adapter)
                    throw new Error('Selected Local Coding Agent target, role or capacity changed before start');
            }
            const continuation = resume && sourceRun && active.run ?
                `\n\nEarlier Work run ${sourceRun.id} stopped (${sourceRun.status}). ` +
                `This new run is ${active.run.id}; its isolated workspace contains verified saved candidate ` +
                `${sourceRun.candidateFingerprint}. Changed files: ` +
                `${sourceRun.candidateDelta?.effects.slice(0, 20).map(effect => `${effect.kind} ${effect.path}`).join(', ') ?? 'none'}` +
                `${(sourceRun.candidateDelta?.effects.length ?? 0) > 20 ? ' (additional paths omitted)' : ''}. ` +
                `Prior failure: ${sourceRun.outcome?.summary ?? 'inspect original run'}. ` +
                `Prior successful commands: ${sourceRun.commandEvidence?.filter(item => item.result === 'passed')
                    .slice(0, 5).map(item => item.commandSummary).join(', ') || 'none recorded'}. ` +
                `Uncertain commands: ${resumeEvidence?.uncertainCommands?.slice(0, 5).join(', ') || 'none recorded'}` +
                `${resumeEvidence?.transcriptIncomplete ? ' (prior transcript incomplete)' : ''}. ` +
                `No old tool request was replayed. Inspect restored files before editing; complete the original task ` +
                `under this run's grant, required validation, and human review.` : '';
            const request: AgentExecutionRequest = { projectRoot: root, executionRoot: active.workspace.root,
                grant, taskId: task.id,
                workingPaths: task.origin.kind === 'work-item' ? task.origin.scope.workingSet :
                    task.origin.kind === 'phase-stack' ? phaseStackReviewScope(task.instructions)?.delegablePaths : undefined,
                connectionId: selected.provenance.connectionId, registrationId: selected.registrationId,
                modelId: selected.provenance.modelId,
                ...(selected.loadedContext === undefined ? {} : {
                    selectedLoadedContextTokens: selected.loadedContext,
                    selectedRegistryRevision: selected.registryRevision }),
                prompt: `${task.objective}\n\n${task.instructions}${continuation}`,
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
            if (active.run?.status === 'pending') {
                await this.update(active, run => ({ ...run, status: 'failed', endedAt: new Date().toISOString(),
                    outcome: { code: 'provider-error', summary: 'Agent start failed before execution' } }))
                    .catch(() => {});
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
        let capacityFailure = false;
        let compactionFailed = false;
        for (let retry = 0; ; ) {
            let error: unknown;
            try { await result; } catch (caught) { error = caught; }
            if (!error) break;
            failed = true;
            capacityFailure = isModelCapacityFailure(error);
            compactionFailed = /cannot be compacted safely|cannot be compacted/u.test(String(error));
            if (!retryAdapter || retryAdapter.id !== 'pi-local-work' || !request ||
                active.stopping || active.denied || active.interruptionFailed || active.toolRequested ||
                !isModelCapacityFailure(error)) break;
            // Pi reports a tool request before broker dispatch. A fresh Pi session is safe
            // only when no tool was requested and the candidate/source are unchanged.
            try {
                if (!active.workspace || !active.initialCandidateFingerprint ||
                    await active.workspace.fingerprint() !== active.initialCandidateFingerprint) break;
                await active.workspace.assertActiveBasis(active.root, active.workspace.root);
            } catch { break; }
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
        let validationMissing = false;
        let promotionBlocked = false;
        let promotionError = false;
        let promotionSucceeded = false;
        let candidateChanged = false;
        let reviewHoldError = false;
        let reviewScopeDenied = false;
        let reviewStage = 'candidate-check';
        const reviewRequired = task?.reviewPolicy?.kind === 'required' &&
            ['direct', 'work-item', 'phase-stack'].includes(task.origin.kind);
        if (active.workspace && active.run) {
            try {
                const { delta, fingerprint } = await active.workspace.freezeCandidate();
                await this.serial(active, () => this.update(active, run => ({ ...run,
                    validationBasis: 'execution-workspace', candidateDelta: delta, candidateFingerprint: fingerprint })));
                if ((failed || active.stopping || active.denied) && delta.effects.length) {
                    try {
                        await this.store.savePartialCandidate(active.root, active.run.id, active.workspace.root, delta);
                    } catch {
                        await this.event(active, 'message', 'Partial candidate bytes could not be retained; inspect recorded hashes');
                    }
                }
                if (!failed && !active.stopping && !active.denied &&
                    (task?.completion.requireValidationPass || reviewRequired)) {
                    active.validationAbort = new AbortController();
                    for (const target of task.completion.validation) {
                        if (active.stopping || active.validationAbort.signal.aborted) break;
                        const result = await this.validationRunner.run({ candidateRoot: active.workspace.root,
                            candidateFingerprint: fingerprint, target, signal: active.validationAbort.signal },
                        async evidence => {
                            await this.serial(active, async () => {
                                await this.update(active, run => ({ ...run, validationResults: [...run.validationResults, evidence] }));
                                await this.event(active, 'validation', `Dope validation ${evidence.status}`);
                            });
                        });
                        if (result.status !== 'passed') break;
                    }
                    active.validationAbort = undefined;
                }
                validationMissing = !failed && !active.stopping && !active.denied && Boolean((task?.completion.requireValidationPass || reviewRequired) && task?.completion.validation.some(target =>
                    active.run?.validationResults.find(result => result.owner === 'dope' &&
                        result.kind === target.kind && result.label === target.label)?.status !== 'passed'));
                if (!failed && !active.stopping && !active.denied && !validationMissing && active.grant) {
                    if (await active.workspace.fingerprint() !== fingerprint)
                        throw new Error('Frozen candidate changed after validation');
                    if (reviewRequired) {
                        await active.workspace.assertActiveBasis(active.root, active.workspace.root);
                        const scope = task.origin.kind === 'work-item' ? task.origin.scope :
                            task.origin.kind === 'phase-stack' ? phaseStackReviewScope(task.instructions) : undefined;
                        const within = (parent: string, child: string): boolean =>
                            child === parent || child.startsWith(`${parent}/`);
                        const scopeBlocked = delta.effects.filter(effect =>
                            !['create', 'modify'].includes(effect.kind) ||
                            effect.path.split('/').some(part => ['.git', '.dope', '.codex', '.ssh', '.aws', '.npmrc', '.yarnrc', '.env'].includes(part) ||
                                part.startsWith('.env.') || part.endsWith('.pem') || part.endsWith('.key')) ||
                            scope && !scope.delegablePaths.some(path => within(path, effect.path)) ||
                            scope?.humanReservedPaths.some(path => within(path, effect.path) || within(effect.path, path)) ||
                            !checkEffect(active.grant!, { kind: `project-${effect.kind}`, scope: 'project', path: effect.path }).allowed);
                        if (scopeBlocked.length) {
                            for (const effect of scopeBlocked) await this.recordBlockedEffects(active, [effect],
                                scope?.humanReservedPaths.some(path => within(path, effect.path) || within(effect.path, path)) ?
                                    'human-reserved-scope' : 'delegation-scope');
                            throw new Error('Review candidate exceeds delegation or execution authority');
                        }
                        reviewStage = 'diff-preview';
                        const preview = await active.workspace.reviewDiff(delta);
                        reviewStage = 'candidate-save';
                        await this.store.saveReviewCandidate(active.root, active.run.id, active.workspace.root, delta);
                        reviewStage = 'post-save-check';
                        if (await active.workspace.fingerprint() !== fingerprint)
                            throw new Error('Frozen candidate changed after validation');
                        await active.workspace.assertActiveBasis(active.root, active.workspace.root);
                        reviewStage = 'review-record';
                        await this.serial(active, async () => {
                            await this.update(active, run => ({ ...run, status: 'blocked',
                                candidateReview: { state: 'ready', revision: 0, candidateFingerprint: fingerprint,
                                    ...preview, changedPaths: delta.effects.map(effect => effect.path),
                                    validation: run.validationResults.filter(result => result.owner === 'dope') } }));
                            await this.event(active, 'status', 'Candidate ready for developer review', { status: 'blocked' });
                            await this.transcript(active, { kind: 'marker', at: '', code: 'run-ended' });
                        });
                        if (this.active.get(active.root) === active) this.active.delete(active.root);
                        await active.workspace.dispose();
                        active.releaseFinished();
                        return;
                    }
                    const result = await active.workspace.promote(active.grant, delta);
                    await this.serial(active, () => this.update(active, run => ({ ...run,
                        authorityDecision: result.decision, appliedFiles: result.applied })));
                    promotionBlocked = !result.decision.allowed;
                    promotionSucceeded = result.decision.allowed;
                    if (promotionBlocked) {
                        await this.recordBlockedEffects(active, delta.effects.filter(effect =>
                            result.decision.blocked.some(blocked => blocked.kind === effect.kind && blocked.path === effect.path)));
                        await this.event(active, 'authority', 'Candidate changes blocked by execution grant');
                    }
                }
            } catch (error) {
                promotionBlocked = true;
                reviewHoldError = reviewRequired;
                reviewScopeDenied = reviewHoldError && error instanceof Error &&
                    error.message.includes('delegation or execution authority');
                promotionError = !reviewScopeDenied;
                if (error instanceof Error && error.message.includes('Frozen candidate')) {
                    validationMissing = true;
                    candidateChanged = true;
                }
                if (error instanceof PromotionFailure) await this.serial(active, () => this.update(active, run => ({ ...run,
                    authorityDecision: { allowed: true, blocked: [] }, appliedFiles: error.appliedFiles })));
                await this.event(active, 'authority', reviewHoldError ? `Candidate review hold failed at ${reviewStage}` :
                    'Candidate classification or promotion failed');
            }
        }
        const status = active.denied || validationMissing || promotionBlocked ? 'failed' : promotionSucceeded ? 'completed' : active.stopping ?
            active.interruptionFailed ? 'interrupted' : 'cancelled' : failed ? 'failed' : 'completed';
        const code = active.denied || reviewScopeDenied ? 'authority-denied' : candidateChanged || validationMissing ? 'validation-failed' : promotionError ? 'other' : promotionBlocked ? 'authority-denied' : promotionSucceeded ? undefined : active.stopping ?
            active.interruptionFailed ? 'interrupted' : 'cancelled' : capacityExhausted ? 'capacity-exhausted' : failed ? 'provider-error' : undefined;
        await this.finish(active, status, code, candidateChanged ? 'Frozen candidate changed after validation' :
            reviewHoldError ? reviewScopeDenied ? 'Candidate exceeds delegation or execution authority' :
                'Candidate review hold failed; inspect run evidence' :
            promotionError ? 'Candidate promotion failed; inspect applied files' :
            active.denied || promotionBlocked ? 'Execution authority denied' :
            validationMissing ? 'Required validation did not pass' :
            status === 'completed' ? 'Agent run completed' : active.stopping ? 'Agent run stopped' :
                capacityExhausted ? 'Model capacity retries exhausted' :
                compactionFailed ? 'Context could not be compacted; inspect candidate and tool evidence before another run' :
                capacityFailure ? 'Model capacity stopped execution; inspect candidate and tool evidence before another run' :
                'Agent execution failed');
    }

    private async finish(active: Active, status: 'completed' | 'cancelled' | 'failed' | 'interrupted',
        code: NonNullable<AgentRun['outcome']>['code'] | undefined, summary: string): Promise<void> {
        try {
            await this.serial(active, async () => {
                if (!active.run || ['completed', 'cancelled', 'failed', 'interrupted'].includes(active.run.status)) return;
                const task = await this.store.readTask(active.root, active.run.taskId);
                if (task?.completion.requireValidationPass) for (const target of task.completion.validation) {
                    if (active.run.validationResults.some(result => result.owner === 'dope' &&
                        result.kind === target.kind && result.label === target.label)) continue;
                    await this.update(active, run => ({ ...run, validationResults: [...run.validationResults,
                        { version: AGENT_SCHEMA_VERSION, kind: target.kind, label: target.label,
                            command: target.command ?? target.label, owner: 'dope',
                            status: active.stopping ? 'cancelled' : 'not-started',
                            reason: active.stopping ? 'Validation cancelled' : 'Provider or candidate did not reach validation' }] }));
                }
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
                for (const commandId of active.transcriptCommands) {
                    await this.transcript(active, { kind: 'command-finish', at: '', commandId, status: 'interrupted' });
                }
                active.transcriptCommands.clear();
                await this.transcript(active, { kind: 'marker', at: '', code: 'run-ended' });
                await this.update(active, run => ({ ...run, status: finalStatus, endedAt: new Date().toISOString(),
                    ...(evidence ? { finalGit: evidence.final, changedFiles: evidence.changedFiles,
                        changeSummary: evidence.changeSummary } : {}),
                    ...(finalCode ? { outcome: { code: finalCode, summary: finalSummary } } : {}) }));
                await this.recordMapImpact(active.root, active.run!);
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
            active.validationAbort?.abort();
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
            if (run.status === 'pending') {
                const endedAt = new Date().toISOString();
                await this.store.updateRun(root, run, { ...run, status: 'interrupted', endedAt,
                    outcome: { code: 'interrupted', summary: 'Agent start abandoned before execution' } });
                await this.store.appendEvent(root, { version: AGENT_SCHEMA_VERSION, runId: run.id,
                    sequence: 1, at: endedAt, kind: 'status', status: 'interrupted',
                    summary: 'Agent run interrupted before execution after backend restart' });
                continue;
            }
            if (!['running', 'cancelling', 'blocked'].includes(run.status) ||
                run.status === 'blocked' && !run.reviewDecision && run.candidateReview?.state === 'ready' &&
                await this.store.reviewCandidateRoot(root, run.id)) continue;
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
            let transcriptCursor = 0;
            let transcriptAt = run.startedAt ?? run.createdAt;
            const unfinished: string[] = [];
            for (;;) {
                const page = await this.store.readTranscript(root, run.id, transcriptCursor, 100);
                for (const entry of page.entries) {
                    if (entry.kind === 'command' && entry.status === 'running') unfinished.push(entry.commandId);
                    if (entry.at > transcriptAt) transcriptAt = entry.at;
                }
                transcriptCursor = page.nextSequence;
                if (!page.hasMore) {
                    if (page.state === 'recorded' && !page.incomplete) {
                        const at = reconciledAt < transcriptAt ? transcriptAt : reconciledAt;
                        for (const commandId of unfinished) await this.store.appendTranscript(root, run.id,
                            { kind: 'command-finish', at, commandId, status: 'interrupted' });
                        await this.store.appendTranscript(root, run.id, { kind: 'marker', at, code: 'run-ended' });
                    }
                    break;
                }
            }
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
