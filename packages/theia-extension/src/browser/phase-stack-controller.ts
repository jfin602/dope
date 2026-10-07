import { createDefaultExecutionGrant, sequenceNeedsDirtyAcceptance } from '@dope/agent-core';
import type { AgentRun, AgentTaskSequence } from '@dope/agent-core';
import type { AgentRuntimeService, DiscoveredTaskStack, OpenTaskStackResult } from '@dope/contracts/lib/agent-runtime-service';

export type StackEvidence = Awaited<ReturnType<AgentRuntimeService['sequenceEvidence']>>;
const retryable = ['run-failed', 'run-cancelled', 'authority-denied', 'validation-failed', 'capacity-exhausted'];

export class PhaseStackController {
    project?: string;
    handle?: string;
    sequences: AgentTaskSequence[] = [];
    stacks: DiscoveredTaskStack[] = [];
    selected?: AgentTaskSequence;
    evidence?: StackEvidence;
    run?: AgentRun;
    tasksRoot = 'docs/tasks/';
    validationCommand = '';
    acceptedGrant = false;
    dirtyPromptDismissed = false;
    message = '';
    busy = false;
    private serial = 0;
    private refreshing = false;
    private lastView = '';
    private validationTaskId?: string;

    constructor(private readonly runtime: AgentRuntimeService, private readonly changed: () => void) {}
    async attach(project?: string): Promise<void> {
        const serial = ++this.serial;
        this.project = project; this.handle = undefined; this.sequences = []; this.stacks = []; this.selected = undefined;
        this.evidence = undefined; this.run = undefined; this.acceptedGrant = false;
        this.dirtyPromptDismissed = false;
        this.validationCommand = ''; this.validationTaskId = undefined;
        this.message = ''; this.lastView = ''; this.changed();
        if (!project) return;
        try {
            const { projectHandle } = await this.runtime.attach(project);
            if (serial !== this.serial) return;
            this.handle = projectHandle;
            await this.scan();
        } catch { if (serial === this.serial) { this.message = 'Phase Stack could not attach to this project.'; this.changed(); } }
    }
    setTasksRoot(value: string): void {
        this.tasksRoot = value; this.stacks = []; this.selected = undefined;
        this.acceptedGrant = false; this.message = '';
    }
    async scan(): Promise<void> {
        if (!this.handle || this.busy) return;
        const handle = this.handle, tasksRoot = this.tasksRoot;
        this.busy = true; this.message = ''; this.changed();
        try {
            const stacks = await this.runtime.listTaskStacks(handle, tasksRoot.trim());
            if (this.handle !== handle || this.tasksRoot !== tasksRoot) return;
            this.stacks = stacks;
            if (!stacks.length) this.message = `No Phase Stacks found in ${tasksRoot.trim() || 'the tasks folder'}.`;
            await this.refresh();
        } catch (error) {
            if (this.handle === handle) { this.stacks = []; this.message = this.errorMessage(error); }
        } finally { this.busy = false; this.changed(); }
    }
    async refresh(): Promise<void> {
        if (!this.handle || this.refreshing) return;
        this.refreshing = true;
        const handle = this.handle;
        try {
            const [stored, evidence] = await Promise.all([
                this.runtime.listSequences(handle), this.runtime.sequenceEvidence(handle)]);
            if (this.handle !== handle) return;
            const previous = this.evidence;
            const evidenceChanged = previous && (previous.head !== evidence.head ||
                previous.packageVersion !== evidence.packageVersion ||
                previous.worktreeFingerprint !== evidence.worktreeFingerprint);
            const selectedId = this.selected?.id;
            const reconciled = selectedId && evidenceChanged ?
                await this.runtime.reconcileSequence(handle, selectedId) : undefined;
            const sequences = reconciled ? stored.map(item => item.id === selectedId ? reconciled : item) : stored;
            this.sequences = sequences;
            this.evidence = evidence;
            this.selected = sequences.find(item => item.id === this.selected?.id);
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
    async select(folderName: string): Promise<void> {
        if (!this.handle || this.busy) return;
        const candidate = this.stacks.find(stack => stack.folderName === folderName);
        if (!candidate) return;
        if (!candidate.valid && !candidate.sequenceId) {
            this.message = `${folderName} is not a valid Phase Stack: ${candidate.error ?? 'check its prompt files.'}`;
            this.changed(); return;
        }
        const handle = this.handle, tasksRoot = this.tasksRoot;
        this.busy = true; this.message = ''; this.changed();
        try {
            const result = await this.runtime.openTaskStack(handle, tasksRoot.trim(), folderName);
            if (this.handle !== handle || this.tasksRoot !== tasksRoot) return;
            if (result.kind === 'opened') {
                this.selected = result.sequence;
                this.acceptedGrant = false; this.dirtyPromptDismissed = false;
                this.validationCommand = ''; this.validationTaskId = undefined; this.run = undefined;
                await this.refresh();
            } else this.message = this.selectionError(folderName, result);
        } catch (error) { this.message = this.errorMessage(error); }
        finally { this.busy = false; this.changed(); }
    }
    private selectionError(folder: string, result: Exclude<OpenTaskStackResult, { kind: 'opened' }>): string {
        return ({ 'invalid-stack': `${folder} is not a valid Phase Stack. Check its prompt files.`,
            'version-mismatch': 'Stack version does not match the current project version.',
            'unsafe-source': `Stack source is missing or unsafe: ${folder}.`,
            'source-changed': 'Stack files changed while opening. Refresh and try again.',
            'checkpoint-mismatch': 'Repository checkpoints do not match this stack. Reconcile Git history first.' } as const)[result.kind];
    }
    private errorMessage(error: unknown): string {
        if (error instanceof Error && /^(Tasks folder|Dirty worktree|Sequence has another reconciliation blocker)/u.test(error.message))
            return error.message;
        return 'Phase Stack operation failed. Inspect repository and sequence state, then retry.';
    }
    cancelDirty(): void { this.dirtyPromptDismissed = true; this.changed(); }
    async continueDirty(): Promise<void> {
        if (!this.handle || !this.selected || !this.evidence || this.busy || !this.needsDirtyAcceptance) return;
        const id = this.selected.id, fingerprint = this.evidence.worktreeFingerprint;
        await this.perform(async () => {
            this.selected = await this.runtime.acceptSequenceDirtyBasis(this.handle!, id, fingerprint);
            this.dirtyPromptDismissed = false;
            this.message = 'Dirty worktree basis accepted. Review the grant and validation command.';
        });
    }
    get current() { return this.selected?.stack.entries[this.selected.currentEntryNumber - 1]; }
    get needsDirtyAcceptance(): boolean {
        return sequenceNeedsDirtyAcceptance(this.selected, this.evidence);
    }
    get readinessMessage(): string {
        if (!this.selected || this.current?.execution !== 'agent-task' || this.selected.status === 'running') return '';
        if (this.selected.status === 'blocked' && !this.needsDirtyAcceptance &&
            !retryable.includes(this.selected.blockedReason ?? ''))
            return this.selected.blockedReason === 'source-drift' ?
                'Stack files changed after this sequence started.' :
                this.selected.blockedReason === 'version-mismatch' ?
                    'Stack version does not match the current project version.' :
                    `Resolve repository blocker: ${this.selected.blockedReason ?? 'unknown'}.`;
        if (this.evidence && this.evidence.head !== (this.selected.checkpoints.at(-1)?.sha ?? this.selected.basis.head))
            return 'Repository HEAD changed. Reconcile the sequence before continuing.';
        if (this.needsDirtyAcceptance) return 'Worktree is dirty: continue?';
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
            (this.evidence.clean || Boolean(s.acceptedDirty) && !this.needsDirtyAcceptance || acceptedBasisRetry) &&
            this.current?.execution === 'agent-task' &&
            (s.status === 'ready' || s.status === 'blocked' && retryable.includes(s.blockedReason ?? '')) &&
            !this.needsDirtyAcceptance && this.acceptedGrant &&
            this.validationCommand.trim().length > 0 && this.validationCommand.trim().length <= 160 && !this.busy);
    }
    async start(): Promise<void> {
        if (!this.canStart || !this.handle || !this.project || !this.selected) return;
        const id = this.selected.id;
        await this.perform(async () => {
            const command = this.validationCommand.trim();
            const task = await this.runtime.prepareSequenceTask(this.handle!, id, { kind: 'follow-coding-agent' },
                { validation: [{ kind: 'test', label: 'phase-stack', command }], requireValidationPass: true });
            const grant = createDefaultExecutionGrant({ id: crypto.randomUUID(), revision: 1, taskId: task.id,
                acceptedAt: new Date().toISOString() });
            this.acceptedGrant = false;
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
                this.message = 'Worktree changed after acceptance. Review and accept the current dirty basis again.';
            } else this.message = this.errorMessage(error);
        }
        finally { this.busy = false; await this.refresh(); this.changed(); }
    }
}
