import { randomUUID } from 'node:crypto';
import { AGENT_SCHEMA_VERSION, parseAgentTask, parseExecutionGrant, parseImportedStack,
    phaseStackTaskMetadata } from '@dope/agent-core';
import type { AgentModelPolicy, AgentRun, AgentTask, AgentTaskSequence, CompletionPolicy,
    ExecutionGrant, ImportedStack, SequenceBlockReason } from '@dope/agent-core';
import { AgentStore } from '@dope/agent-core/lib/node/agent-store';
import { captureSequenceEvidence, importSequenceSnapshot, sequenceBlockReason,
    stackSourceDrift } from '@dope/agent-core/lib/node/sequence-reconciliation';
import { assertDirtyBasis, captureDirtyBasis, safeGit } from '@dope/agent-core/lib/node/dirty-basis';
import { checkpointSequence as commitCheckpoint } from '@dope/agent-core/lib/node/sequence-checkpoint';
import type { AgentRuntimeClient, AgentRuntimeService } from '@dope/contracts/lib/agent-runtime-service';
import type { AgentExecutionRuntime } from './agent-execution-runtime';

// Shared by RPC backend instances in this process; persisted HEAD/checkpoint evidence owns restart safety.
const checkpointProjects = new Set<string>();

/** One RPC connection attaches one canonical project root. The handle never enters durable state. */
export class AgentRuntimeBackend implements AgentRuntimeService {
    private root: string | undefined;
    private readonly handle = randomUUID();
    private disposed = false;
    private readonly unlisten: () => void;
    private readonly pendingStarts = new Map<string, Promise<AgentRun>>();
    private readonly sequenceObservers = new Map<string, Promise<void>>();

    constructor(private readonly store: AgentStore, client: AgentRuntimeClient,
        private readonly execution?: AgentExecutionRuntime) {
        this.unlisten = store.onChange((root, change) => {
            if (!this.disposed && root === this.root) client.notifyAgentStateChanged(change);
        });
    }

    async attach(folderUri: string): Promise<{ projectHandle: string }> {
        if (this.disposed) throw new Error('Disposed Agent Runtime connection');
        const root = await this.store.root(folderUri);
        if (this.root && this.root !== root) throw new Error('A different Agent Runtime project is already attached');
        await this.execution?.reconcile(root);
        this.root = root;
        try {
            for (const sequence of await this.store.listSequences(root)) await this.reconcileStoredSequence(root, sequence);
        } catch (error) {
            this.root = undefined;
            throw error;
        }
        return { projectHandle: this.handle };
    }

    private active(handle: string): string {
        if (this.disposed || !this.root || handle !== this.handle) throw new Error('Invalid or detached Agent Runtime project handle');
        return this.root;
    }

    createTask(handle: string, task: AgentTask): Promise<AgentTask> { return this.store.createTask(this.active(handle), task); }
    readTask(handle: string, taskId: string): Promise<AgentTask | undefined> { return this.store.readTask(this.active(handle), taskId); }
    listTasks(handle: string): Promise<AgentTask[]> { return this.store.listTasks(this.active(handle)); }
    readRun(handle: string, runId: string): Promise<AgentRun | undefined> { return this.store.readRun(this.active(handle), runId); }
    listRuns(handle: string): Promise<AgentRun[]> { return this.store.listRuns(this.active(handle)); }
    async importSequence(handle: string, folderName: string): Promise<AgentTaskSequence> {
        const root = this.active(handle);
        return this.store.createSequence(root, await importSequenceSnapshot(root, folderName));
    }
    async createSequence(handle: string, stack: ImportedStack): Promise<AgentTaskSequence> {
        const parsed = await parseImportedStack(stack);
        const root = this.active(handle);
        const snapshot = await importSequenceSnapshot(root, parsed.folderName);
        if (snapshot.stack.fingerprint !== parsed.fingerprint) throw new Error('Source-stack drift during sequence creation');
        return this.store.createSequence(root, snapshot);
    }
    readSequence(handle: string, sequenceId: string): Promise<AgentTaskSequence | undefined> {
        return this.store.readSequence(this.active(handle), sequenceId);
    }
    listSequences(handle: string): Promise<AgentTaskSequence[]> { return this.store.listSequences(this.active(handle)); }
    async reconcileSequence(handle: string, sequenceId: string): Promise<AgentTaskSequence> {
        const root = this.active(handle), sequence = await this.store.readSequence(root, sequenceId);
        if (!sequence) throw new Error('Agent sequence missing');
        return this.reconcileStoredSequence(root, sequence);
    }
    private async reconcileStoredSequence(root: string, sequence: AgentTaskSequence): Promise<AgentTaskSequence> {
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
        const reason = sequenceBlockReason(sequence, acceptedEvidence, drift);
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
    async prepareSequenceTask(handle: string, sequenceId: string, modelPolicy: AgentModelPolicy,
        completion: CompletionPolicy, acceptDirty = false): Promise<AgentTask> {
        const root = this.active(handle);
        let sequence = await this.sequenceState(root, sequenceId);
        if (acceptDirty && sequence.status === 'blocked' && sequence.blockedReason === 'worktree-drift') {
            const dirty = await captureDirtyBasis(root);
            if (!dirty.paths.length || dirty.head !== (sequence.checkpoints.at(-1)?.sha ?? sequence.basis.head))
                throw new Error('No eligible dirty worktree to accept');
            const evidence = await captureSequenceEvidence(root);
            if (sequenceBlockReason(sequence, { ...evidence, clean: true,
                worktreeFingerprint: sequence.basis.worktreeFingerprint }, await stackSourceDrift(root, sequence.stack)))
                throw new Error('Sequence has another reconciliation blocker');
            sequence = await this.setSequence(root, sequence, { status: 'ready', blockedReason: undefined,
                acceptedDirty: dirty });
        }
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
            if (current?.status === 'running') await this.setSequence(root, current,
                { status: 'blocked', blockedReason: 'run-failed' });
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
            if (sequence.status !== 'blocked' || sequence.blockedReason !== 'checkpoint-pending' ||
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
            const nextNumber = sequence.currentEntryNumber + 1;
            const next = sequence.stack.entries[nextNumber - 1];
            return this.setSequence(root, sequence, { checkpoints: [...sequence.checkpoints,
                { entryNumber: sequence.currentEntryNumber, sha, taskId: task.id, runId: run.id }],
                currentEntryNumber: nextNumber, status: next?.execution === 'manual-gate' ? 'waiting-manual' : 'ready',
                blockedReason: undefined, taskId: undefined, runIds: undefined, acceptedDirty: undefined,
                basis: { head: sha,
                    packageVersion: sequence.stack.entries[sequence.currentEntryNumber - 1].versionPolicy.version,
                    worktreeFingerprint: sequence.basis.worktreeFingerprint } });
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
