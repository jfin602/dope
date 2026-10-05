import { randomUUID } from 'node:crypto';
import type { AgentRun, AgentTask, ExecutionGrant } from '@dope/agent-core';
import { AgentStore } from '@dope/agent-core/lib/node/agent-store';
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
        this.root = root;
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
