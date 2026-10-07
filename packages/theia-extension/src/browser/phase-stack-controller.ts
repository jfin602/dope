import { createDefaultExecutionGrant, sequenceNeedsDirtyAcceptance } from '@dope/agent-core';
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
    validationCommand = '';
    acceptedGrant = false;
    acceptedDirty = false;
    private acceptedDirtyFingerprint?: string;
    message = '';
    busy = false;
    pendingDirtyImport?: { folderName: string; input: string };
    private serial = 0;
    private refreshing = false;
    private lastView = '';
    private validationTaskId?: string;

    constructor(private readonly runtime: AgentRuntimeService, private readonly changed: () => void) {}
    async attach(project?: string): Promise<void> {
        const serial = ++this.serial;
        this.project = project; this.handle = undefined; this.sequences = []; this.selected = undefined;
        this.evidence = undefined; this.run = undefined; this.acceptedGrant = false;
        this.acceptedDirty = false; this.acceptedDirtyFingerprint = undefined;
        this.validationCommand = ''; this.validationTaskId = undefined;
        this.message = ''; this.pendingDirtyImport = undefined; this.lastView = ''; this.changed();
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
            if (this.acceptedDirty && this.acceptedDirtyFingerprint !== evidence.worktreeFingerprint) {
                this.acceptedDirty = false; this.acceptedDirtyFingerprint = undefined;
                this.message = 'Worktree changed after acceptance. Review and accept the current dirty basis again.';
            }
            this.selected = sequences.find(item => item.id === this.selected?.id) ?? sequences[0];
            const taskId = this.selected?.taskId;
            if (taskId && taskId !== this.validationTaskId) {
                const task = await this.runtime.readTask(handle, taskId);
                this.validationCommand = task?.completion.validation[0]?.command ?? '';
                this.validationTaskId = taskId;
            } else if (!taskId && this.validationTaskId) this.validationTaskId = undefined;
            const runId = this.selected?.runIds?.at(-1);
            this.run = runId ? await this.runtime.readRun(handle, runId) : undefined;
            const view = JSON.stringify([this.sequences, this.evidence, this.run, this.message]);
            if (view !== this.lastView) { this.lastView = view; this.changed(); }
        } catch { this.message = 'Sequence evidence could not be read. Execution is unavailable.'; this.evidence = undefined; this.changed(); }
        finally { this.refreshing = false; }
    }
    select(id: string): void {
        this.selected = this.sequences.find(item => item.id === id);
        this.acceptedGrant = false; this.acceptedDirty = false; this.acceptedDirtyFingerprint = undefined;
        this.run = undefined;
        this.validationCommand = ''; this.validationTaskId = undefined;
        void this.refresh(); this.changed();
    }
    setFolderName(value: string): void {
        this.folderName = value;
        if (this.pendingDirtyImport && value !== this.pendingDirtyImport.input) {
            this.pendingDirtyImport = undefined; this.message = ''; this.changed();
        }
    }
    cancelDirtyImport(): void {
        if (this.busy) return;
        this.pendingDirtyImport = undefined; this.message = ''; this.changed();
    }
    async continueDirtyImport(): Promise<void> {
        const pending = this.pendingDirtyImport;
        if (!pending || this.folderName !== pending.input || this.busy) return;
        await this.importFolder(pending.folderName, true);
    }
    async importStack(): Promise<void> {
        if (!this.handle || this.busy) return;
        const match = /^(?:docs\/tasks\/)?((?:p\d+[a-z]?|p[12]-\d+|c\d+-[a-z0-9]+(?:-[a-z0-9]+)*))\/?$/u.exec(this.folderName.trim());
        if (!match) { this.message = 'Enter a project-local docs/tasks/<stack> folder.'; this.changed(); return; }
        this.pendingDirtyImport = undefined;
        await this.importFolder(match[1], false);
    }
    private async importFolder(folderName: string, allowDirtyImport: boolean): Promise<void> {
        if (!this.handle || this.busy) return;
        const handle = this.handle, input = this.folderName;
        this.busy = true; this.message = ''; this.changed();
        try {
            const result = await this.runtime.importSequence(handle, folderName, { allowDirtyImport });
            if (this.handle !== handle || this.folderName !== input) return;
            if (result.kind === 'dirty-confirmation-required') {
                this.pendingDirtyImport = { folderName, input };
            } else if (result.kind === 'imported') {
                this.pendingDirtyImport = undefined;
                await this.refresh(); this.select(result.sequence.id);
                this.message = 'Stack imported. Review its basis and grant before starting.';
            } else {
                this.pendingDirtyImport = undefined;
                this.message = ({ 'invalid-stack': 'Stack import failed: invalid prompt grammar. Check TASK, model, version, numbering, and closeout fields.',
                    'version-mismatch': 'Stack import failed: version mismatch.',
                    'unsafe-source': 'Stack import failed: invalid or unsafe stack source.',
                    'source-changed': 'Stack import failed: stack source changed during import.',
                    'checkpoint-mismatch': 'Stack import failed: repository checkpoint mismatch.' } as const)[result.kind];
            }
        } catch { this.message = 'Phase Stack operation failed. Inspect repository, stack, and grant state, then retry.'; }
        finally { this.busy = false; await this.refresh(); this.changed(); }
    }
    get current() { return this.selected?.stack.entries[this.selected.currentEntryNumber - 1]; }
    get needsDirtyAcceptance(): boolean {
        return sequenceNeedsDirtyAcceptance(this.selected, this.evidence);
    }
    setDirtyAcceptance(accepted: boolean): void {
        this.acceptedDirty = accepted;
        this.acceptedDirtyFingerprint = accepted ? this.evidence?.worktreeFingerprint : undefined;
        this.changed();
    }
    get dirtyAcceptanceReady(): boolean {
        return this.needsDirtyAcceptance && this.acceptedDirty &&
            this.acceptedDirtyFingerprint === this.evidence?.worktreeFingerprint;
    }
    get readinessMessage(): string {
        if (!this.selected || this.current?.execution !== 'agent-task' || this.selected.status === 'running') return '';
        if (this.selected.status === 'blocked' && !this.needsDirtyAcceptance &&
            !retryable.includes(this.selected.blockedReason ?? ''))
            return `Resolve repository blocker: ${this.selected.blockedReason ?? 'unknown'}.`;
        if (this.evidence && this.evidence.head !== (this.selected.checkpoints.at(-1)?.sha ?? this.selected.basis.head))
            return 'Repository HEAD changed. Reconcile the sequence before continuing.';
        if (this.needsDirtyAcceptance && !this.dirtyAcceptanceReady)
            return 'Worktree is dirty: accept it as this task\'s starting basis to continue.';
        if (!this.acceptedGrant) return 'Accept the project execution grant to continue.';
        if (!this.validationCommand.trim()) return 'Enter a required validation command to continue.';
        if (this.validationCommand.trim().length > 160) return 'Validation command is too long.';
        return '';
    }
    get canStart(): boolean {
        const s = this.selected;
        const acceptedBasisRetry = Boolean(s?.acceptedDirty && s.status === 'blocked' &&
            retryable.includes(s.blockedReason ?? ''));
        return Boolean(this.handle && this.project && this.evidence && s &&
            this.evidence.head === (s.checkpoints.at(-1)?.sha ?? s.basis.head) &&
            (this.evidence.clean || this.dirtyAcceptanceReady || acceptedBasisRetry) &&
            this.current?.execution === 'agent-task' &&
            (s.status === 'ready' || s.status === 'blocked' && retryable.includes(s.blockedReason ?? '') ||
                this.dirtyAcceptanceReady) &&
            (!this.needsDirtyAcceptance || this.dirtyAcceptanceReady) && this.acceptedGrant &&
            this.validationCommand.trim().length > 0 && this.validationCommand.trim().length <= 160 && !this.busy);
    }
    async start(): Promise<void> {
        if (!this.canStart || !this.handle || !this.project || !this.selected) return;
        const id = this.selected.id;
        await this.perform(async () => {
            const command = this.validationCommand.trim();
            const task = await this.runtime.prepareSequenceTask(this.handle!, id, { kind: 'follow-coding-agent' },
                { validation: [{ kind: 'test', label: 'phase-stack', command }], requireValidationPass: true },
                this.dirtyAcceptanceReady ? { worktreeFingerprint: this.acceptedDirtyFingerprint! } : undefined);
            const grant = createDefaultExecutionGrant({ id: crypto.randomUUID(), revision: 1, taskId: task.id,
                acceptedAt: new Date().toISOString() });
            this.acceptedGrant = false; this.acceptedDirty = false; this.acceptedDirtyFingerprint = undefined;
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
        catch (error) {
            if (error instanceof Error && /Dirty worktree changed since acceptance/u.test(error.message)) {
                this.setDirtyAcceptance(false);
                this.message = 'Worktree changed after acceptance. Review and accept the current dirty basis again.';
            } else this.message = 'Phase Stack operation failed. Inspect repository, stack, and grant state, then retry.';
        }
        finally { this.busy = false; await this.refresh(); this.changed(); }
    }
}
