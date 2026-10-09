import { createHash, randomUUID } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { AGENT_SCHEMA_VERSION, decideProposedAction, parseAgentTask, parseExecutionGrant, projectPath,
    phaseStackFolder, phaseStackTaskMetadata, sequenceNeedsDirtyAcceptance, importPhaseStack } from '@dope/agent-core';
import type { AgentModelPolicy, AgentRun, AgentTask, AgentTaskSequence, ProposedAction, CompletionPolicy,
    AgentSteeringRequest, AgentSteeringState,
    ExecutionGrant, SequenceBlockReason } from '@dope/agent-core';
import { AgentStore } from '@dope/agent-core/lib/node/agent-store';
import { captureSequenceEvidence, checkedTasksRoot, snapshotTaskStack, readStackSources,
    TaskStackSnapshotError, sequenceBlockReason, stackSourceDrift, verifyManualGate } from '@dope/agent-core/lib/node/sequence-reconciliation';
import type { ManualGateReconciliation } from '@dope/agent-core/lib/node/sequence-reconciliation';
import { assertDirtyBasis, captureDirtyBasis, safeGit } from '@dope/agent-core/lib/node/dirty-basis';
import { checkpointSequence as commitCheckpoint, verifyCommittedCheckpoint } from '@dope/agent-core/lib/node/sequence-checkpoint';
import type { AgentRuntimeClient, AgentRuntimeService, DiscoveredTaskStack, OpenTaskStackResult } from '@dope/contracts/lib/agent-runtime-service';
import type { WorkItemLaunchRequest } from '@dope/contracts/lib/agent-runtime-service';
import { PlanningStore } from '@dope/visual-planning/lib/node/planning-store';
import type { AgentExecutionRuntime } from './agent-execution-runtime';

// Shared by RPC backend instances in this process; persisted HEAD/checkpoint evidence owns restart safety.
const checkpointProjects = new Set<string>();
const openingTaskStacks = new Map<string, Promise<OpenTaskStackResult>>();

/** One RPC connection attaches one canonical project root. The handle never enters durable state. */
export class AgentRuntimeBackend implements AgentRuntimeService {
    private root: string | undefined;
    private handle = randomUUID();
    private attaching?: { root: string; promise: Promise<{ projectHandle: string }> };
    private disposed = false;
    private readonly unlisten: () => void;
    private readonly pendingStarts = new Map<string, Promise<AgentRun>>();
    private readonly sequenceObservers = new Map<string, Promise<void>>();

    constructor(private readonly store: AgentStore, client: AgentRuntimeClient,
        private readonly execution?: AgentExecutionRuntime, private readonly planning?: PlanningStore) {
        this.unlisten = store.onChange((root, change) => {
            if (!this.disposed && root === this.root) client.notifyAgentStateChanged(change);
        });
    }

    async attach(folderUri: string): Promise<{ projectHandle: string }> {
        if (this.disposed) throw new Error('Disposed Agent Runtime connection');
        const root = await this.store.root(folderUri);
        while (this.attaching) {
            if (this.attaching.root === root) return this.attaching.promise;
            await this.attaching.promise.catch(() => undefined);
        }
        if (this.disposed) throw new Error('Disposed Agent Runtime connection');
        if (this.root === root) return { projectHandle: this.handle };
        // A renderer has one channel, but its project can change. Retire the old
        // handle before attaching the next root so delayed calls cannot cross it.
        this.root = undefined;
        this.handle = randomUUID();
        const handle = this.handle;
        const promise = (async () => {
            await this.execution?.reconcile(root);
            this.root = root;
            try {
                for (const sequence of await this.store.listSequences(root)) await this.reconcileStoredSequence(root, sequence);
            } catch (error) {
                this.root = undefined;
                throw error;
            }
            return { projectHandle: handle };
        })();
        this.attaching = { root, promise };
        try { return await promise; }
        finally { if (this.attaching?.promise === promise) this.attaching = undefined; }
    }

    private active(handle: string): string {
        if (this.disposed || !this.root || handle !== this.handle) throw new Error('Invalid or detached Agent Runtime project handle');
        return this.root;
    }

    createTask(handle: string, task: AgentTask): Promise<AgentTask> {
        if (task.origin.kind === 'work-item') throw new Error('WorkItem tasks require revision-checked launch');
        return this.store.createTask(this.active(handle), task);
    }
    async launchWorkItem(handle: string, request: WorkItemLaunchRequest): Promise<AgentTask> {
        const root = this.active(handle);
        if (!this.planning) throw new Error('Planning service unavailable');
        if (typeof request.requestKey !== 'string' || !/^[A-Za-z0-9._-]{1,128}$/.test(request.requestKey) ||
            !Number.isSafeInteger(request.expectedProjectRevision) || request.expectedProjectRevision < 1 ||
            !Number.isSafeInteger(request.expectedMapRevision) || request.expectedMapRevision < 0 ||
            typeof request.planningMapId !== 'string' || typeof request.workItemId !== 'string' ||
            !Array.isArray(request.delegablePaths) || !request.delegablePaths.length || request.delegablePaths.length > 100)
            throw new Error('Invalid WorkItem launch request');
        const paths = request.delegablePaths.map(path => projectPath(path));
        if (new Set(paths).size !== paths.length) throw new Error('Duplicate delegated path');
        const id = `work-${createHash('sha256').update(request.requestKey).digest('hex').slice(0, 32)}`;
        const snapshot = await this.planning.read(root);
        const sameRequest = (task: AgentTask): boolean => task.origin.kind === 'work-item' &&
            task.projectId === snapshot.projectId &&
            task.origin.planningMapId === request.planningMapId && task.origin.workItemId === request.workItemId &&
            task.origin.mapRevision === request.expectedMapRevision &&
            JSON.stringify(task.origin.scope.delegablePaths) === JSON.stringify(paths) &&
            JSON.stringify(task.modelPolicy) === JSON.stringify(request.modelPolicy) &&
            JSON.stringify(task.controls) === JSON.stringify(request.controls) &&
            JSON.stringify(task.completion) === JSON.stringify(request.completion);
        const existing = await this.store.readTask(root, id);
        if (existing) {
            if (!sameRequest(existing)) throw new Error('WorkItem request key already used for a different launch');
            return existing;
        }
        if (snapshot.revision !== request.expectedProjectRevision) throw new Error('Stale Planning project revision');
        const map = snapshot.maps.find(item => item.id === request.planningMapId);
        if (!map || map.revision !== request.expectedMapRevision) throw new Error('Stale or missing Planning map revision');
        if (map.status !== 'active') throw new Error('Planning map is not active');
        const work = map.workItems.find(item => item.id === request.workItemId);
        if (!work || !['ready', 'in-progress'].includes(work.status)) throw new Error('WorkItem is not ready for delegation');
        if (work.assignment === 'HUMAN' || !work.assignment) throw new Error('Human-owned WorkItem cannot be delegated');
        const contains = (parent: string, child: string): boolean => child === parent || child.startsWith(`${parent}/`);
        if (paths.some(path => !work.delegablePaths?.some(allowed => contains(allowed, path)) ||
            work.humanReservedPaths?.some(reserved => contains(path, reserved) || contains(reserved, path))))
            throw new Error('Requested path is human-reserved or outside delegable scope');
        const task = parseAgentTask({ version: AGENT_SCHEMA_VERSION, id, createdAt: new Date().toISOString(),
            objective: work.objective, instructions: JSON.stringify({ title: work.title, requirements: work.requirements,
                constraints: work.constraints, acceptanceCriteria: work.acceptanceCriteria,
                validationTargets: work.validationTargets, transformationIds: work.transformationIds,
                delegatedPaths: paths, humanReservedPaths: work.humanReservedPaths ?? [] }),
            projectRoot: '.', projectId: snapshot.projectId,
            modelPolicy: request.modelPolicy, controls: request.controls,
            authority: { profile: 'phase-8b-project' }, completion: request.completion,
            planningMapId: map.id, reviewPolicy: { kind: 'required' },
            origin: { kind: 'work-item', projectId: snapshot.projectId, planningMapId: map.id,
                workItemId: work.id, mapRevision: map.revision, basis: map.basis,
                scope: { assignment: work.assignment, workingSet: work.workingSet,
                    delegablePaths: paths, humanReservedPaths: work.humanReservedPaths ?? [] } } });
        if ((await this.planning.read(root)).revision !== request.expectedProjectRevision)
            throw new Error('Stale Planning project revision');
        for (let attempt = 0; attempt < 8; attempt++) {
            try { return await this.store.createTask(root, task); }
            catch (error) {
                const raced = await this.store.readTask(root, id);
                if (raced) {
                    if (!sameRequest(raced)) throw new Error('WorkItem request key already used for a different launch');
                    return raced;
                }
                if (!(error instanceof Error) || !error.message.includes('Agent state locked by another writer') || attempt === 7)
                    throw error;
                await new Promise(resolve => setTimeout(resolve, 20));
            }
        }
        throw new Error('WorkItem launch could not acquire AgentStore');
    }
    async listWorkItemTasks(handle: string, planningMapId: string, workItemId: string): Promise<AgentTask[]> {
        return (await this.store.listTasks(this.active(handle))).filter(task => task.origin.kind === 'work-item' &&
            task.origin.planningMapId === planningMapId && task.origin.workItemId === workItemId);
    }
    readTask(handle: string, taskId: string): Promise<AgentTask | undefined> { return this.store.readTask(this.active(handle), taskId); }
    listTasks(handle: string): Promise<AgentTask[]> { return this.store.listTasks(this.active(handle)); }
    readRun(handle: string, runId: string): Promise<AgentRun | undefined> { return this.store.readRun(this.active(handle), runId); }
    readMapImpact(handle: string, runId: string) { return this.store.readMapImpact(this.active(handle), runId); }
    readSteering(handle: string, runId: string): Promise<AgentSteeringState | undefined> {
        return this.store.readSteering(this.active(handle), runId);
    }
    requestSteering(handle: string, taskId: string, runId: string, expectedRevision: number,
        request: AgentSteeringRequest): Promise<AgentSteeringState> {
        const root = this.active(handle);
        if (this.execution?.activeRunId(root) !== runId) throw new Error('Agent run has no active turn');
        return this.store.requestSteering(root, taskId, runId, expectedRevision, request);
    }
    decideCandidate(handle: string, runId: string, expectedRevision: number,
        candidateFingerprint: string, decision: 'accept' | 'reject', grant?: ExecutionGrant): Promise<AgentRun> {
        if (!this.execution) throw new Error('Agent execution unavailable');
        const root = this.active(handle);
        if (checkpointProjects.has(root)) throw new Error('Project checkpoint in progress');
        return this.execution.decideCandidate(root, runId, expectedRevision, candidateFingerprint, decision, grant);
    }
    listRuns(handle: string): Promise<AgentRun[]> { return this.store.listRuns(this.active(handle)); }
    listActions(handle: string, taskId?: string): Promise<ProposedAction[]> {
        return this.store.listActions(this.active(handle), taskId);
    }
    readAction(handle: string, actionId: string): Promise<ProposedAction | undefined> {
        return this.store.readAction(this.active(handle), actionId);
    }
    async decideAction(handle: string, actionId: string, expectedRevision: number,
        decision: 'acknowledged' | 'rejected'): Promise<ProposedAction> {
        const root = this.active(handle);
        const current = await this.store.readAction(root, actionId);
        if (!current) throw new Error('ProposedAction missing');
        // Acknowledgement is inspection only; it never feeds the promotion path or grant.
        return this.store.decideAction(root, current,
            decideProposedAction(current, decision, new Date().toISOString(), expectedRevision));
    }
    async listTaskStacks(handle: string, tasksRoot: string): Promise<DiscoveredTaskStack[]> {
        const root = this.active(handle);
        const directory = await checkedTasksRoot(root, tasksRoot);
        const children = (await readdir(directory.absolute, { withFileTypes: true }))
            .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
            .sort((a, b) => a.name.localeCompare(b.name, 'en'));
        if (children.length > 256) throw new Error('Tasks folder has too many child folders.');
        const candidates = children.flatMap(entry => {
            try { return [{ name: entry.name, info: phaseStackFolder(entry.name) }]; }
            catch { return []; }
        });
        if (candidates.length > 64) throw new Error('Tasks folder has too many Phase Stacks.');
        const stored = await this.store.listSequences(root);
        const result: DiscoveredTaskStack[] = [];
        for (const { name, info } of candidates) {
            const path = `${directory.relative}/${name}`;
            const existing = stored.find(sequence =>
                (sequence.stack.sourcePath ?? `docs/tasks/${sequence.stack.folderName}`) === path);
            const summary: DiscoveredTaskStack = { folderName: name, path, mode: info.mode, phase: info.phase,
                valid: false, ...(existing ? { sequenceId: existing.id, sequenceStatus: existing.status } : {}) };
            try {
                const stack = await importPhaseStack(name, await readStackSources(root, name, directory.relative),
                    directory.relative === 'docs/tasks' ? undefined : path);
                summary.valid = true; summary.fingerprint = stack.fingerprint;
                if (existing && existing.stack.fingerprint !== stack.fingerprint) {
                    const reconciled = await this.reconcileStoredSequence(root, existing);
                    summary.sequenceStatus = reconciled.status;
                }
            } catch (error) {
                summary.error = error instanceof Error ? error.message.slice(0, 180) : 'Invalid prompt stack.';
            }
            result.push(summary);
        }
        return result;
    }
    async openTaskStack(handle: string, tasksRoot: string, folderName: string): Promise<OpenTaskStackResult> {
        const root = this.active(handle);
        const directory = await checkedTasksRoot(root, tasksRoot);
        try { phaseStackFolder(folderName); }
        catch { return { kind: 'invalid-stack' }; }
        const path = `${directory.relative}/${folderName}`;
        const key = `${root}\0${path}`;
        const pending = openingTaskStacks.get(key);
        if (pending) return pending;
        const opening = (async (): Promise<OpenTaskStackResult> => {
            const existing = (await this.store.listSequences(root)).find(sequence =>
                (sequence.stack.sourcePath ?? `docs/tasks/${sequence.stack.folderName}`) === path);
            if (existing) return { kind: 'opened', sequence: await this.reconcileStoredSequence(root, existing) };
            try {
                const snapshot = await snapshotTaskStack(root, folderName, directory.relative);
                return { kind: 'opened', sequence: await this.store.createSequence(root, snapshot) };
            } catch (error) {
                if (error instanceof TaskStackSnapshotError) return { kind: error.code };
                throw error;
            }
        })();
        openingTaskStacks.set(key, opening);
        try { return await opening; }
        finally { if (openingTaskStacks.get(key) === opening) openingTaskStacks.delete(key); }
    }
    async acceptSequenceDirtyBasis(handle: string, sequenceId: string,
        worktreeFingerprint: string): Promise<AgentTaskSequence> {
        const root = this.active(handle);
        if (checkpointProjects.has(root) || this.execution?.activeRunId(root))
            throw new Error('Project execution or checkpoint is active');
        const sequence = await this.sequenceState(root, sequenceId);
        const before = await captureSequenceEvidence(root);
        if (!sequenceNeedsDirtyAcceptance(sequence, before) || before.worktreeFingerprint !== worktreeFingerprint)
            throw new Error('Dirty worktree changed since acceptance; review and accept it again');
        const dirty = await captureDirtyBasis(root);
        if (!dirty.paths.length || dirty.head !== (sequence.checkpoints.at(-1)?.sha ?? sequence.basis.head))
            throw new Error('No eligible dirty worktree to accept');
        const evidence = await captureSequenceEvidence(root);
        if (evidence.worktreeFingerprint !== worktreeFingerprint || evidence.head !== before.head ||
            evidence.packageVersion !== before.packageVersion || evidence.clean !== before.clean)
            throw new Error('Dirty worktree changed since acceptance; review and accept it again');
        await assertDirtyBasis(root, dirty);
        if (sequenceBlockReason({ ...sequence, acceptedDirty: dirty }, { ...evidence, clean: true,
            worktreeFingerprint: sequence.basis.worktreeFingerprint }, await stackSourceDrift(root, sequence.stack)))
            throw new Error('Sequence has another reconciliation blocker');
        return this.setSequence(root, sequence, { status: 'ready', blockedReason: undefined, acceptedDirty: dirty });
    }
    readSequence(handle: string, sequenceId: string): Promise<AgentTaskSequence | undefined> {
        return this.store.readSequence(this.active(handle), sequenceId);
    }
    listSequences(handle: string): Promise<AgentTaskSequence[]> { return this.store.listSequences(this.active(handle)); }
    async sequenceEvidence(handle: string): Promise<{ head: string; packageVersion: string; clean: boolean; worktreeFingerprint: string }> {
        const { head, packageVersion, clean, worktreeFingerprint } = await captureSequenceEvidence(this.active(handle));
        return { head, packageVersion, clean, worktreeFingerprint };
    }
    async codingAgentReady(handle: string): Promise<boolean> {
        this.active(handle);
        return this.execution?.codingAgentReady() ?? false;
    }
    async reconcileSequence(handle: string, sequenceId: string): Promise<AgentTaskSequence> {
        const root = this.active(handle), sequence = await this.store.readSequence(root, sequenceId);
        if (!sequence) throw new Error('Agent sequence missing');
        return this.reconcileStoredSequence(root, sequence);
    }
    async reconcileManualGate(handle: string, sequenceId: string): Promise<AgentTaskSequence> {
        const root = this.active(handle);
        if (checkpointProjects.has(root) || this.execution?.activeRunId(root))
            throw new Error('Project execution or checkpoint is active');
        checkpointProjects.add(root);
        try {
            const sequence = await this.store.readSequence(root, sequenceId);
            if (!sequence) throw new Error('Agent sequence missing');
            const entry = sequence.stack.entries[sequence.currentEntryNumber - 1];
            if (!entry || entry.execution !== 'manual-gate' ||
                !['waiting-manual', 'blocked'].includes(sequence.status))
                throw new Error('Sequence has no pending manual gate');
            const result: ManualGateReconciliation = await verifyManualGate(root, sequence).catch(() => ({
                reason: 'git-history' as const,
                message: 'Repository evidence could not be read consistently. Inspect Git history and retry.'
            }));
            if (!result.sha) {
                const status = result.reason ? 'blocked' : 'waiting-manual';
                if (sequence.status === status && sequence.blockedReason === result.reason &&
                    sequence.gateMessage === result.message) return sequence;
                return this.setSequence(root, sequence, { status, blockedReason: result.reason,
                    gateMessage: result.message });
            }
            const nextNumber = sequence.currentEntryNumber + 1;
            const next = sequence.stack.entries[nextNumber - 1];
            const cleanBasis = await captureSequenceEvidence(root);
            return this.setSequence(root, sequence, {
                checkpoints: [...sequence.checkpoints, { entryNumber: sequence.currentEntryNumber,
                    sha: result.sha, preGateBasis: sequence.basis }],
                currentEntryNumber: nextNumber, status: next ?
                    next.execution === 'manual-gate' ? 'waiting-manual' : 'ready' : 'completed',
                blockedReason: undefined, gateMessage: undefined,
                basis: { head: result.sha, packageVersion: entry.versionPolicy.version,
                    worktreeFingerprint: cleanBasis.worktreeFingerprint, clean: true }
            });
        } finally { checkpointProjects.delete(root); }
    }
    private async reconcileStoredSequence(root: string, sequence: AgentTaskSequence): Promise<AgentTaskSequence> {
        if (checkpointProjects.has(root)) return sequence;
        if (sequence.status === 'blocked' && sequence.taskId && sequence.runIds?.length &&
            ['checkpoint-pending', 'checkpoint-failed', 'checkpoint-mismatch'].includes(sequence.blockedReason ?? '')) {
            const [task, run] = await Promise.all([this.store.readTask(root, sequence.taskId),
                this.store.readRun(root, sequence.runIds.at(-1)!)]);
            if (task && run) {
                const sha = await verifyCommittedCheckpoint(root, sequence, task, run).catch(() => undefined);
                if (sha) return this.advanceCommittedCheckpoint(root, sequence, task, run, sha);
            }
        }
        const activeRunId = this.execution?.activeRunId(root);
        if (sequence.status === 'running' && activeRunId &&
            (sequence.runIds?.at(-1) === activeRunId ||
                !sequence.runIds?.length && (await this.store.readRun(root, activeRunId))?.taskId === sequence.taskId))
            return sequence;
        if (sequence.status === 'running' && sequence.runIds?.length) {
            const run = await this.store.readRun(root, sequence.runIds.at(-1)!);
            if (run && ['completed', 'cancelled', 'failed', 'interrupted'].includes(run.status)) {
                await (this.sequenceObservers.get(sequence.id) ?? this.observeSequence(root, sequence.id, run.id));
                return (await this.store.readSequence(root, sequence.id))!;
            }
        }
        const [evidence, drift] = await Promise.all([
            captureSequenceEvidence(root), stackSourceDrift(root, sequence.stack)]);
        let acceptedValid = false;
        if (sequence.acceptedDirty && sequence.blockedReason !== 'checkpoint-pending') {
            acceptedValid = await assertDirtyBasis(root, sequence.acceptedDirty).then(() => true, () => false);
        }
        const acceptedEvidence = acceptedValid ? { ...evidence, clean: true,
            worktreeFingerprint: sequence.basis.worktreeFingerprint } : evidence;
        const reason = sequenceBlockReason(sequence, acceptedEvidence, drift) ??
            (sequence.status !== 'completed' && sequence.acceptedDirty && !acceptedValid &&
                !['checkpoint-pending', 'checkpoint-failed'].includes(sequence.blockedReason ?? '') ?
                'worktree-drift' : undefined);
        if (!reason) return sequence;
        const status = reason === 'interrupted' ? 'interrupted' : 'blocked';
        if (sequence.status === status && sequence.blockedReason === reason) return sequence;
        const next: AgentTaskSequence = { ...sequence, status, blockedReason: reason,
            currentEntryNumber: sequence.status === 'completed' ? sequence.stack.entries.length : sequence.currentEntryNumber,
            updatedAt: new Date(Math.max(Date.now(), Date.parse(sequence.updatedAt) + 1)).toISOString() };
        return this.store.updateSequence(root, sequence, next);
    }
    private async sequenceState(root: string, sequenceId: string): Promise<AgentTaskSequence> {
        const sequence = await this.store.readSequence(root, sequenceId);
        if (!sequence) throw new Error('Agent sequence missing');
        return this.reconcileStoredSequence(root, sequence);
    }
    private async setSequence(root: string, sequence: AgentTaskSequence,
        changes: Partial<AgentTaskSequence>): Promise<AgentTaskSequence> {
        return this.store.updateSequence(root, sequence, { ...sequence, ...changes,
            updatedAt: new Date(Math.max(Date.now(), Date.parse(sequence.updatedAt) + 1)).toISOString() });
    }
    private async advanceCommittedCheckpoint(root: string, sequence: AgentTaskSequence,
        task: AgentTask, run: AgentRun, sha: string): Promise<AgentTaskSequence> {
        const nextNumber = sequence.currentEntryNumber + 1;
        const next = sequence.stack.entries[nextNumber - 1];
        const cleanBasis = await captureSequenceEvidence(root);
        if (cleanBasis.head !== sha || !cleanBasis.clean)
            throw new Error('Checkpoint changed before durable sequence advancement');
        return this.setSequence(root, sequence, { checkpoints: [...sequence.checkpoints,
            { entryNumber: sequence.currentEntryNumber, sha, taskId: task.id, runId: run.id }],
            currentEntryNumber: nextNumber, status: next?.execution === 'manual-gate' ? 'waiting-manual' : 'ready',
            blockedReason: undefined, taskId: undefined, runIds: undefined, acceptedDirty: undefined,
            basis: { head: sha, clean: true,
                packageVersion: sequence.stack.entries[sequence.currentEntryNumber - 1].versionPolicy.version,
                worktreeFingerprint: cleanBasis.worktreeFingerprint } });
    }
    async prepareSequenceTask(handle: string, sequenceId: string, modelPolicy: AgentModelPolicy,
        completion: CompletionPolicy): Promise<AgentTask> {
        const root = this.active(handle);
        if (checkpointProjects.has(root) || this.execution?.activeRunId(root))
            throw new Error('Project execution or checkpoint is active');
        const sequence = await this.sequenceState(root, sequenceId);
        if (sequence.status !== 'ready' && !(sequence.status === 'blocked' &&
            ['run-failed', 'run-cancelled', 'authority-denied', 'validation-failed', 'capacity-exhausted'].includes(sequence.blockedReason ?? '')))
            throw new Error('Sequence is not ready for an executable task');
        const metadata = phaseStackTaskMetadata(sequence.stack, sequence.currentEntryNumber);
        const taskId = `${sequence.id}-P${sequence.currentEntryNumber}`;
        const candidate = parseAgentTask({ version: AGENT_SCHEMA_VERSION, id: taskId, createdAt: sequence.createdAt,
            objective: metadata.objective, instructions: metadata.instructions, projectRoot: '.',
            modelPolicy, controls: metadata.controls, authority: { profile: 'phase-8b-project' }, completion,
            origin: metadata.origin, phaseStack: { stackFingerprint: metadata.stackFingerprint,
                recommendedModel: metadata.recommendedModel, versionPolicy: metadata.versionPolicy } });
        const existing = await this.store.readTask(root, taskId);
        if (existing) {
            if (JSON.stringify(existing) !== JSON.stringify(candidate)) throw new Error('Prepared sequence task differs from immutable snapshot');
            if (!sequence.taskId) await this.setSequence(root, sequence, { taskId: existing.id });
            return existing;
        }
        const task = await this.store.createTask(root, candidate);
        await this.setSequence(root, sequence, { taskId: task.id });
        return task;
    }
    async startSequence(handle: string, folderUri: string, sequenceId: string, grant: ExecutionGrant,
        hostedProjectDataAuthorized: boolean): Promise<AgentRun> {
        if (!this.execution) throw new Error('Agent execution unavailable');
        const root = this.active(handle);
        if (checkpointProjects.has(root)) throw new Error('Project checkpoint in progress');
        let sequence = await this.sequenceState(root, sequenceId);
        if (sequence.status === 'blocked' && ['run-failed', 'run-cancelled', 'authority-denied',
            'validation-failed', 'capacity-exhausted'].includes(sequence.blockedReason ?? ''))
            sequence = await this.setSequence(root, sequence, { status: 'ready', blockedReason: undefined });
        if (sequence.status !== 'ready' || !sequence.taskId ||
            sequence.stack.entries[sequence.currentEntryNumber - 1]?.execution !== 'agent-task')
            throw new Error('Sequence is not ready for its current executable entry');
        const task = await this.store.readTask(root, sequence.taskId);
        const metadata = phaseStackTaskMetadata(sequence.stack, sequence.currentEntryNumber);
        if (!task || task.origin.kind !== 'phase-stack' || task.origin.promptId !== metadata.origin.promptId ||
            task.instructions !== metadata.instructions || task.objective !== metadata.objective ||
            task.controls.reasoningEffort !== metadata.controls.reasoningEffort ||
            JSON.stringify(task.phaseStack) !== JSON.stringify({ stackFingerprint: metadata.stackFingerprint,
                recommendedModel: metadata.recommendedModel, versionPolicy: metadata.versionPolicy }))
            throw new Error('Prepared sequence task no longer matches snapshot');
        if (await this.store.root(folderUri) !== root) throw new Error('Accepted project root does not match attached project');
        const accepted = parseExecutionGrant(grant);
        if (accepted.taskId !== task.id || accepted.projectRoot !== task.projectRoot || accepted.acceptedAt < task.createdAt)
            throw new Error('Accepted ExecutionGrant does not match sequence task/project');
        if (this.execution.activeRunId(root)) throw new Error('A mutation run is already active for this project');
        const knownRunIds = new Set((await this.store.listRuns(root)).filter(run => run.taskId === task.id)
            .map(run => run.id));
        sequence = await this.setSequence(root, sequence, { status: 'running', blockedReason: undefined });
        const start = this.execution.startSequence(root, folderUri, task.id, grant, hostedProjectDataAuthorized,
            sequence.acceptedDirty);
        this.pendingStarts.set(sequence.id, start);
        try {
            const run = await start;
            const current = await this.store.readSequence(root, sequence.id);
            if (!current || current.status !== 'running') throw new Error('Sequence changed during AgentRun start');
            await this.setSequence(root, current, { runIds: [...(current.runIds ?? []), run.id] });
            const observing = this.observeSequence(root, sequence.id, run.id);
            this.sequenceObservers.set(sequence.id, observing);
            void observing.finally(() => {
                if (this.sequenceObservers.get(sequence.id) === observing) this.sequenceObservers.delete(sequence.id);
            }).catch(() => {});
            return run;
        } catch (error) {
            const current = await this.store.readSequence(root, sequence.id);
            if (current?.status === 'running') {
                const failedRuns = (await this.store.listRuns(root)).filter(run =>
                    run.taskId === task.id && !knownRunIds.has(run.id));
                await this.setSequence(root, current, { status: 'blocked', blockedReason: 'run-failed',
                    ...(failedRuns.length === 1 ? { runIds: [...(current.runIds ?? []), failedRuns[0].id] } : {}) });
            }
            throw error;
        } finally { this.pendingStarts.delete(sequence.id); }
    }
    private async observeSequence(root: string, sequenceId: string, runId: string): Promise<void> {
        const run = await this.execution!.waitForRun(root, runId);
        const sequence = await this.store.readSequence(root, sequenceId);
        if (!sequence || sequence.status !== 'running' || sequence.runIds?.at(-1) !== runId) return;
        const reason: SequenceBlockReason = run.status === 'completed' ? 'checkpoint-pending' :
            run.status === 'cancelled' ? 'run-cancelled' : run.status === 'interrupted' ? 'interrupted' :
                run.outcome?.code === 'authority-denied' ? 'authority-denied' :
                    run.outcome?.code === 'validation-failed' ? 'validation-failed' :
                        run.outcome?.code === 'capacity-exhausted' ? 'capacity-exhausted' : 'run-failed';
        await this.setSequence(root, sequence, { status: run.status === 'interrupted' ? 'interrupted' : 'blocked',
            blockedReason: reason });
    }
    async stopSequence(handle: string, sequenceId: string): Promise<AgentTaskSequence> {
        if (!this.execution) throw new Error('Agent execution unavailable');
        const root = this.active(handle);
        let sequence = await this.store.readSequence(root, sequenceId);
        if (!sequence || sequence.status !== 'running') throw new Error('Sequence is not running');
        const pending = this.pendingStarts.get(sequenceId);
        if (pending) await pending.catch(() => {});
        sequence = await this.store.readSequence(root, sequenceId);
        const runId = sequence?.runIds?.at(-1);
        if (runId && this.execution.activeRunId(root) === runId) await this.execution.stop(root, runId);
        if (runId) await (this.sequenceObservers.get(sequenceId) ?? this.observeSequence(root, sequenceId, runId));
        const final = await this.store.readSequence(root, sequenceId);
        if (!final) throw new Error('Agent sequence missing after stop');
        return final;
    }
    async checkpointSequence(handle: string, sequenceId: string): Promise<AgentTaskSequence> {
        const root = this.active(handle);
        if (checkpointProjects.has(root)) throw new Error('Project checkpoint already in progress');
        checkpointProjects.add(root);
        try {
            const sequence = await this.sequenceState(root, sequenceId);
            if (sequence.status !== 'blocked' ||
                !['checkpoint-pending', 'checkpoint-failed'].includes(sequence.blockedReason ?? '') ||
                !sequence.taskId || !sequence.runIds?.length || this.execution?.activeRunId(root))
                throw new Error('Sequence has no pending checkpoint');
            const [task, run] = await Promise.all([this.store.readTask(root, sequence.taskId),
                this.store.readRun(root, sequence.runIds.at(-1)!)]);
            if (!task || !run) throw new Error('Checkpoint task/run evidence missing');
            const sha = await commitCheckpoint(root, sequence, task, run);
            if ((await safeGit(root, ['rev-parse', '--verify', 'HEAD'])).trim() !== sha ||
                (await safeGit(root, ['diff', '--cached', '--name-only', '-z'])).length ||
                (await captureDirtyBasis(root)).paths.length)
                throw new Error('Checkpoint changed before durable sequence advancement');
            return this.advanceCommittedCheckpoint(root, sequence, task, run, sha);
        } catch (error) {
            const sequence = await this.store.readSequence(root, sequenceId);
            if (sequence?.status === 'blocked' && sequence.blockedReason === 'checkpoint-pending')
                await this.setSequence(root, sequence, { blockedReason: 'checkpoint-failed' });
            throw error;
        } finally { checkpointProjects.delete(root); }
    }
    readEvents(handle: string, runId: string, afterSequence: number, limit: number) {
        return this.store.readEvents(this.active(handle), runId, afterSequence, limit);
    }
    readTranscript(handle: string, runId: string, afterSequence: number, limit: number) {
        return this.store.readTranscript(this.active(handle), runId, afterSequence, limit);
    }
    start(handle: string, folderUri: string, taskId: string, grant: ExecutionGrant,
        hostedProjectDataAuthorized: boolean): Promise<AgentRun> {
        if (!this.execution) throw new Error('Agent execution unavailable');
        const root = this.active(handle);
        if (checkpointProjects.has(root)) throw new Error('Project checkpoint in progress');
        return this.execution.start(root, folderUri, taskId, grant, hostedProjectDataAuthorized);
    }
    stop(handle: string, runId: string): Promise<AgentRun> {
        if (!this.execution) throw new Error('Agent execution unavailable');
        return this.execution.stop(this.active(handle), runId);
    }
    dispose(): void { if (!this.disposed) { this.disposed = true; this.unlisten(); } }
}
