import { randomUUID } from 'node:crypto';
import { parseImportedStack } from '@dope/agent-core';
import type { AgentRun, AgentTask, AgentTaskSequence, ExecutionGrant, ImportedStack } from '@dope/agent-core';
import { AgentStore } from '@dope/agent-core/lib/node/agent-store';
import { captureSequenceEvidence, importSequenceSnapshot, sequenceBlockReason,
    stackSourceDrift } from '@dope/agent-core/lib/node/sequence-reconciliation';
import type { AgentRuntimeClient, AgentRuntimeService } from '@dope/contracts/lib/agent-runtime-service';
import type { AgentExecutionRuntime } from './agent-execution-runtime';

/** One RPC connection attaches one canonical project root. The handle never enters durable state. */
export class AgentRuntimeBackend implements AgentRuntimeService {
    private root: string | undefined;
    private readonly handle = randomUUID();
    private disposed = false;
    private readonly unlisten: () => void;

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
        const [evidence, drift] = await Promise.all([
            captureSequenceEvidence(root), stackSourceDrift(root, sequence.stack)]);
        const reason = sequenceBlockReason(sequence, evidence, drift);
        if (!reason) return sequence;
        const status = reason === 'interrupted' ? 'interrupted' : 'blocked';
        if (sequence.status === status && sequence.blockedReason === reason) return sequence;
        const next: AgentTaskSequence = { ...sequence, status, blockedReason: reason,
            currentEntryNumber: sequence.status === 'completed' ? sequence.stack.entries.length : sequence.currentEntryNumber,
            updatedAt: new Date(Math.max(Date.now(), Date.parse(sequence.updatedAt) + 1)).toISOString() };
        return this.store.updateSequence(root, sequence, next);
    }
    readEvents(handle: string, runId: string, afterSequence: number, limit: number) {
        return this.store.readEvents(this.active(handle), runId, afterSequence, limit);
    }
    start(handle: string, folderUri: string, taskId: string, grant: ExecutionGrant,
        hostedProjectDataAuthorized: boolean): Promise<AgentRun> {
        if (!this.execution) throw new Error('Agent execution unavailable');
        return this.execution.start(this.active(handle), folderUri, taskId, grant, hostedProjectDataAuthorized);
    }
    stop(handle: string, runId: string): Promise<AgentRun> {
        if (!this.execution) throw new Error('Agent execution unavailable');
        return this.execution.stop(this.active(handle), runId);
    }
    dispose(): void { if (!this.disposed) { this.disposed = true; this.unlisten(); } }
}
