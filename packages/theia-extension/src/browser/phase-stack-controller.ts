import { createDefaultExecutionGrant } from '@dope/agent-core';
import type { AgentRun, AgentTaskSequence } from '@dope/agent-core';
import type { AgentRuntimeService } from '@dope/contracts/lib/agent-runtime-service';

export type StackEvidence = Awaited<ReturnType<AgentRuntimeService['sequenceEvidence']>>;
const retryable = ['run-failed', 'run-cancelled', 'authority-denied', 'validation-failed', 'capacity-exhausted'];

export class PhaseStackController {
    project?: string;
    handle?: string;
    sequences: AgentTaskSequence[] = [];
    selected?: AgentTaskSequence;
    evidence?: StackEvidence;
    run?: AgentRun;
    folderName = '';
    acceptedGrant = false;
    acceptedDirty = false;
    message = '';
    busy = false;
    private serial = 0;
    private refreshing = false;
    private lastView = '';

    constructor(private readonly runtime: AgentRuntimeService, private readonly changed: () => void) {}
    async attach(project?: string): Promise<void> {
        const serial = ++this.serial;
        this.project = project; this.handle = undefined; this.sequences = []; this.selected = undefined;
        this.evidence = undefined; this.run = undefined; this.acceptedGrant = false; this.acceptedDirty = false;
        this.message = ''; this.lastView = ''; this.changed();
        if (!project) return;
        try {
            const { projectHandle } = await this.runtime.attach(project);
            if (serial !== this.serial) return;
            this.handle = projectHandle;
            await this.refresh();
        } catch { if (serial === this.serial) { this.message = 'Phase Stack could not attach to this project.'; this.changed(); } }
    }
    async refresh(): Promise<void> {
        if (!this.handle || this.refreshing) return;
        this.refreshing = true;
        const handle = this.handle;
        try {
            const [sequences, evidence] = await Promise.all([
                this.runtime.listSequences(handle), this.runtime.sequenceEvidence(handle)]);
            if (this.handle !== handle) return;
            this.sequences = sequences;
            this.evidence = evidence;
            this.selected = sequences.find(item => item.id === this.selected?.id) ?? sequences[0];
            const runId = this.selected?.runIds?.at(-1);
            this.run = runId ? await this.runtime.readRun(handle, runId) : undefined;
            const view = JSON.stringify([this.sequences, this.evidence, this.run, this.message]);
            if (view !== this.lastView) { this.lastView = view; this.changed(); }
        } catch { this.message = 'Sequence evidence could not be read. Execution is unavailable.'; this.evidence = undefined; this.changed(); }
        finally { this.refreshing = false; }
    }
    select(id: string): void {
        this.selected = this.sequences.find(item => item.id === id);
        this.acceptedGrant = false; this.acceptedDirty = false; this.run = undefined;
        void this.refresh(); this.changed();
    }
    async importStack(): Promise<void> {
        if (!this.handle || this.busy) return;
        const match = /^(?:docs\/tasks\/)?((?:p\d+[a-z]?|p[12]-\d+|c\d+-[a-z0-9]+(?:-[a-z0-9]+)*))\/?$/u.exec(this.folderName.trim());
        if (!match) { this.message = 'Enter a project-local docs/tasks/<stack> folder.'; this.changed(); return; }
        await this.perform(async () => {
            const sequence = await this.runtime.importSequence(this.handle!, match[1]);
            await this.refresh(); this.select(sequence.id); this.message = 'Stack imported. Review its basis and grant before starting.';
        });
    }
    get current() { return this.selected?.stack.entries[this.selected.currentEntryNumber - 1]; }
    get needsDirtyAcceptance(): boolean {
        return Boolean(this.selected?.blockedReason === 'worktree-drift' && this.evidence && !this.evidence.clean);
    }
    get canStart(): boolean {
        const s = this.selected;
        return Boolean(this.handle && this.project && this.evidence && s &&
            this.evidence.head === (s.checkpoints.at(-1)?.sha ?? s.basis.head) &&
            (this.evidence.clean || this.needsDirtyAcceptance && this.acceptedDirty) &&
            this.current?.execution === 'agent-task' &&
            (s.status === 'ready' || s.status === 'blocked' && retryable.includes(s.blockedReason ?? '') ||
                this.needsDirtyAcceptance && this.acceptedDirty) &&
            (!this.needsDirtyAcceptance || this.acceptedDirty) && this.acceptedGrant && !this.busy);
    }
    async start(): Promise<void> {
        if (!this.canStart || !this.handle || !this.project || !this.selected) return;
        const id = this.selected.id;
        await this.perform(async () => {
            const task = await this.runtime.prepareSequenceTask(this.handle!, id, { kind: 'follow-coding-agent' },
                { validation: [], requireValidationPass: false }, this.needsDirtyAcceptance && this.acceptedDirty);
            const grant = createDefaultExecutionGrant({ id: crypto.randomUUID(), revision: 1, taskId: task.id,
                acceptedAt: new Date().toISOString() });
            this.acceptedGrant = false; this.acceptedDirty = false;
            this.run = await this.runtime.startSequence(this.handle!, this.project!, id, grant, true);
            this.message = 'Sequence task started.';
        });
    }
    async stop(): Promise<void> {
        if (!this.handle || this.selected?.status !== 'running' || this.busy) return;
        const id = this.selected.id;
        await this.perform(async () => { await this.runtime.stopSequence(this.handle!, id); this.message = 'Stop requested.'; });
    }
    async reconcile(): Promise<void> {
        if (!this.handle || !this.selected || this.busy) return;
        const id = this.selected.id;
        await this.perform(async () => {
            const current = this.current;
            const result = current?.execution === 'manual-gate' ?
                await this.runtime.reconcileManualGate(this.handle!, id) :
                await this.runtime.reconcileSequence(this.handle!, id);
            this.message = result.gateMessage ?? (result.blockedReason ? `Blocked: ${result.blockedReason}` :
                `Reconciled: ${result.status}.`);
        });
    }
    async checkpoint(): Promise<void> {
        if (!this.handle || this.selected?.blockedReason !== 'checkpoint-pending' || this.busy) return;
        const id = this.selected.id;
        await this.perform(async () => { await this.runtime.checkpointSequence(this.handle!, id);
            this.message = 'Checkpoint verified.'; });
    }
    private async perform(action: () => Promise<void>): Promise<void> {
        this.busy = true; this.message = ''; this.changed();
        try { await action(); }
        catch { this.message = 'Phase Stack operation failed. Inspect repository, stack, and grant state, then retry.'; }
        finally { this.busy = false; await this.refresh(); this.changed(); }
    }
}
