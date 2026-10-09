import type { AgentMapImpact, AgentRun, AgentSteeringRequest, AgentSteeringState, AgentTask,
    AgentTranscriptEntry, AgentTaskSequence, ProposedAction } from '@dope/agent-core';
import type { AgentRuntimeService } from '@dope/contracts/lib/agent-runtime-service';
import { createDefaultExecutionGrant } from '@dope/agent-core';
import { PhaseStackController } from './phase-stack-controller';
import type { WorkSelection } from './shared-panel-state';

export function workTitle(selection: WorkSelection, run?: AgentRun, task?: AgentTask,
    sequence?: AgentTaskSequence): string {
    if (selection.kind === 'sequence') return sequence?.stack.entries[Math.min(sequence.currentEntryNumber,
        sequence.stack.entries.length) - 1]?.title ??
        sequence?.stack.folderName ?? 'Prompt Stack';
    if (run) return task?.objective ?? `Work - ${run.id.slice(0, 8)}`;
    return task?.objective ?? `Work - ${selection.id.slice(0, 8)}`;
}

export interface WorkRow {
    selection: WorkSelection;
    title: string;
    status: string;
    activity: string;
    updatedAt: string;
    running: boolean;
    stack?: string;
    elapsedMs?: number;
}

export function workReviewState(run?: AgentRun, task?: AgentTask, busy = false):
    'pending' | 'busy' | 'stale' | 'accepted' | 'rejected' | 'unavailable' {
    if (!run?.candidateReview || task?.origin.kind !== 'work-item' || task.reviewPolicy?.kind !== 'required' ||
        task.id !== run.taskId || task.projectId !== run.projectId) return 'unavailable';
    if (run.reviewDecision) return run.reviewDecision.kind === 'accept' ? 'accepted' : 'rejected';
    if (busy) return 'busy';
    if (run.status !== 'blocked' || run.candidateReview.state !== 'ready' || !run.basis?.head ||
        run.candidateReview.candidateFingerprint !== run.candidateFingerprint || !run.candidateDelta ||
        run.candidateReview.changedPaths.some((path, index) => path !== run.candidateDelta?.effects[index]?.path) ||
        run.candidateReview.changedPaths.length !== run.candidateDelta.effects.length) return 'stale';
    return 'pending';
}

export function workReviewCanAccept(run?: AgentRun, task?: AgentTask): boolean {
    if (workReviewState(run, task) !== 'pending' || !run?.candidateReview || !task?.completion.validation.length) return false;
    return task.completion.validation.every(target => run.candidateReview!.validation.some(result =>
        result.owner === 'dope' && result.kind === target.kind && result.label === target.label &&
        result.status === 'passed' && result.candidateFingerprint === run.candidateReview!.candidateFingerprint));
}

/** A sequence is one Work session; its child tasks and runs are details of that session. */
export function workRows(tasks: AgentTask[], runs: AgentRun[], sequences: AgentTaskSequence[], now = Date.now()):
    { running: WorkRow[]; history: WorkRow[] } {
    const tasksById = new Map(tasks.map(task => [task.id, task]));
    const runsById = new Map(runs.map(run => [run.id, run]));
    const childTasks = new Set<string>();
    const childRuns = new Set<string>();
    const rows: WorkRow[] = [];
    for (const sequence of sequences) {
        if (sequence.taskId) childTasks.add(sequence.taskId);
        for (const checkpoint of sequence.checkpoints) {
            if (checkpoint.taskId) childTasks.add(checkpoint.taskId);
            if (checkpoint.runId) childRuns.add(checkpoint.runId);
        }
        for (const id of sequence.runIds ?? []) childRuns.add(id);
        const current = sequence.stack.entries[sequence.currentEntryNumber - 1];
        const currentRunId = sequence.runIds?.at(-1);
        const run = currentRunId ? runsById.get(currentRunId) : undefined;
        const running = sequence.status === 'running' && run?.status === 'running';
        rows.push({ selection: { kind: 'sequence', id: sequence.id },
            title: sequence.stack.folderName,
            status: sequence.status === 'running' && !running ? run?.status ?? 'pending' : sequence.status,
            activity: current ? `P${current.number} · ${current.title}` :
                sequence.status === 'completed' ? 'All prompt entries complete' : 'Prompt Stack',
            updatedAt: sequence.updatedAt, running, stack: `${sequence.stack.folderName} · P${Math.min(sequence.currentEntryNumber,
                sequence.stack.entries.length)} of ${sequence.stack.entries.length}`,
            elapsedMs: running && run?.startedAt ? Math.max(0, now - Date.parse(run.startedAt)) : undefined });
    }
    for (const run of runs) {
        if (childRuns.has(run.id)) continue;
        const task = tasksById.get(run.taskId);
        rows.push({ selection: { kind: 'run', id: run.id },
            title: workTitle({ kind: 'run', id: run.id }, run, task), status: run.status,
            activity: run.outcome?.summary ?? run.commandEvidence?.at(-1)?.commandSummary ??
                run.changeSummary?.summary ?? (run.status === 'running' ? 'Agent working' : `Run ${run.status}`),
            updatedAt: run.endedAt ?? run.startedAt ?? run.createdAt, running: run.status === 'running',
            elapsedMs: run.status === 'running' && run.startedAt ? Math.max(0, now - Date.parse(run.startedAt)) : undefined });
    }
    for (const task of tasks) {
        if (childTasks.has(task.id) || task.origin.kind === 'phase-stack' || runs.some(run => run.taskId === task.id)) continue;
        rows.push({ selection: { kind: 'task', id: task.id }, title: task.objective, status: 'pending',
            activity: 'Awaiting execution', updatedAt: task.createdAt, running: false });
    }
    rows.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.title.localeCompare(b.title));
    return { running: rows.filter(row => row.running), history: rows.filter(row => !row.running) };
}

export class WorkSelectionController {
    readonly phase: PhaseStackController;
    project?: string;
    handle?: string;
    tasks: AgentTask[] = [];
    runs: AgentRun[] = [];
    selectedRun?: AgentRun;
    selectedTask?: AgentTask;
    transcript: AgentTranscriptEntry[] = [];
    transcriptState: 'recorded' | 'not-recorded' = 'not-recorded';
    transcriptIncomplete = false;
    message = '';
    reviewBusy = false;
    steering?: AgentSteeringState;
    steeringKind: AgentSteeringRequest['kind'] = 'instruction';
    steeringText = '';
    steeringBusy = false;
    actions: ProposedAction[] = [];
    actionBusy = false;
    mapImpact?: AgentMapImpact;
    startBusy = false;
    acceptedStartGrant = false;
    hostedProjectDataAuthorized = false;
    private selectedTaskId?: string;
    private startEpoch = 0;
    private serial = 0;

    constructor(private readonly runtime: AgentRuntimeService, private readonly changed: () => void) {
        this.phase = new PhaseStackController(runtime, changed);
    }
    async attach(project?: string): Promise<void> {
        const serial = ++this.serial;
        ++this.startEpoch;
        this.project = project; this.handle = undefined; this.tasks = []; this.runs = [];
        this.startBusy = false; this.acceptedStartGrant = false; this.hostedProjectDataAuthorized = false;
        this.selectedTaskId = undefined;
        this.selectedRun = undefined; this.selectedTask = undefined; this.transcript = []; this.message = '';
        this.steering = undefined; this.actions = []; this.mapImpact = undefined; this.steeringText = '';
        this.changed();
        await this.phase.attach(project);
        if (serial !== this.serial || !project) return;
        this.handle = this.phase.handle;
        if (!this.handle) {
            this.message = this.phase.message || 'Work could not attach to this project.';
            this.changed();
            return;
        }
        await this.refresh();
    }
    async refresh(): Promise<void> {
        const handle = this.handle, serial = this.serial;
        if (!handle) return;
        try {
            const [tasks, runs] = await Promise.all([this.runtime.listTasks(handle), this.runtime.listRuns(handle)]);
            if (serial !== this.serial || handle !== this.handle) return;
            this.tasks = tasks; this.runs = runs;
            if (this.selectedRun) this.selectedRun = runs.find(run => run.id === this.selectedRun?.id) ?? this.selectedRun;
            this.changed();
        } catch { if (serial === this.serial) { this.message = 'Work history could not be read.'; this.changed(); } }
    }
    async scan(): Promise<void> {
        await Promise.all([this.phase.scan(), this.refresh()]);
    }
    async select(selection: WorkSelection | undefined): Promise<void> {
        const handle = this.handle, serial = ++this.serial;
        this.selectedTaskId = selection?.kind === 'task' ? selection.id : undefined;
        this.acceptedStartGrant = false; this.hostedProjectDataAuthorized = false;
        this.selectedRun = undefined; this.selectedTask = undefined; this.transcript = []; this.transcriptIncomplete = false;
        this.steering = undefined; this.actions = []; this.mapImpact = undefined; this.steeringText = '';
        this.message = ''; this.phase.message = ''; this.phase.selected = undefined; this.phase.run = undefined;
        if (!handle || !selection) { this.changed(); return; }
        if (selection.kind === 'sequence') {
            if (this.phase.sequences.some(item => item.id === selection.id)) await this.phase.selectStored(selection.id);
            else {
                const candidate = this.phase.stacks.find(item => item.folderName === selection.id);
                if (candidate) await this.phase.select(candidate.folderName);
            }
            if (serial === this.serial) this.changed();
            return;
        }
        try {
            const run = selection.kind === 'run' ? await this.runtime.readRun(handle, selection.id) : undefined;
            const task = run ? await this.runtime.readTask(handle, run.taskId) :
                selection.kind === 'task' ? await this.runtime.readTask(handle, selection.id) : undefined;
            if (serial !== this.serial || handle !== this.handle) return;
            this.selectedRun = run; this.selectedTask = task;
            if (run) {
                const [steering, actions, impact] = await Promise.all([
                    this.runtime.readSteering(handle, run.id), this.runtime.listActions(handle, run.taskId),
                    this.runtime.readMapImpact(handle, run.id)
                ]);
                if (serial !== this.serial || handle !== this.handle) return;
                this.steering = steering;
                this.actions = actions.filter(action => action.runId === run.id);
                this.mapImpact = impact;
                let cursor = 0;
                while (true) {
                    const result = await this.runtime.readTranscript(handle, run.id, cursor, 100);
                    if (serial !== this.serial || handle !== this.handle) return;
                    this.transcriptState = result.state;
                    this.transcriptIncomplete ||= result.incomplete;
                    this.transcript.push(...result.entries);
                    if (!result.hasMore) break;
                    if (result.nextSequence <= cursor) throw new Error('Transcript pagination did not advance');
                    cursor = result.nextSequence;
                }
            }
            this.changed();
        } catch {
            if (serial === this.serial) { this.message = 'Work detail could not be read.'; this.changed(); }
        }
    }
    acceptStartGrant(accepted: boolean): void { this.acceptedStartGrant = accepted; this.changed(); }
    authorizeHostedProjectData(authorized: boolean): void {
        this.hostedProjectDataAuthorized = authorized; this.changed();
    }
    acceptStartApproval(accepted: boolean): void {
        this.acceptedStartGrant = accepted;
        this.hostedProjectDataAuthorized = accepted;
        this.changed();
    }
    get startBlockReason(): string {
        const task = this.selectedTask;
        if (!this.handle || !this.project || !this.selectedTaskId || !task || task.id !== this.selectedTaskId)
            return 'Select a saved pending WorkItem task in the attached project.';
        if (task.origin.kind !== 'work-item' || !task.projectId || task.projectId !== task.origin.projectId ||
            task.planningMapId !== task.origin.planningMapId || task.reviewPolicy?.kind !== 'required' ||
            task.authority.profile !== 'phase-8b-project' || task.projectRoot !== '.')
            return 'This task is not a valid saved WorkItem task for the attached project.';
        if (this.startBusy) return 'This WorkItem task is already starting.';
        if (this.runs.some(run => run.taskId === task.id))
            return 'This WorkItem task already has a run. Select its run to inspect it.';
        if (this.runs.some(run => ['pending', 'running', 'blocked', 'cancelling'].includes(run.status)))
            return 'Another AgentRun is active. Stop or resolve it before starting this task.';
        if (!task.completion.requireValidationPass || !task.completion.validation.length ||
            task.completion.validation.some(target => !target.command?.trim()))
            return 'This saved task has no required Dope validation. Return to its Planning Map and launch a new task with an approved validation command.';
        if (!this.phase.codingAgentReady)
            return 'Configure and test an eligible Coding Agent in AI Center.';
        if (!this.acceptedStartGrant)
            return 'Review and accept the fixed project execution grant for this task.';
        if (!this.hostedProjectDataAuthorized)
            return 'Authorize sending this project data to the hosted Coding Agent for this start.';
        return '';
    }
    async startSelectedWorkItemTask(): Promise<AgentRun | undefined> {
        const reason = this.startBlockReason;
        if (reason) { this.message = reason; this.changed(); return; }
        const handle = this.handle!, project = this.project!, shown = this.selectedTask!;
        const serial = this.serial;
        const startEpoch = ++this.startEpoch;
        this.startBusy = true; this.message = ''; this.changed();
        try {
            const [task, runs, ready] = await Promise.all([
                this.runtime.readTask(handle, shown.id), this.runtime.listRuns(handle),
                this.runtime.codingAgentReady(handle)
            ]);
            if (serial !== this.serial || handle !== this.handle || project !== this.project ||
                this.selectedTaskId !== shown.id || !this.acceptedStartGrant || !this.hostedProjectDataAuthorized)
                throw new Error('Selection or project changed. Review and accept Start again.');
            if (!task || JSON.stringify(task) !== JSON.stringify(shown))
                throw new Error('Saved task changed. Refresh Work and select the task again.');
            if (runs.some(run => run.taskId === task.id))
                throw new Error('This WorkItem task already has a run. Select its run to inspect it.');
            if (runs.some(run => ['pending', 'running', 'blocked', 'cancelling'].includes(run.status)))
                throw new Error('Another AgentRun is active. Stop or resolve it before starting this task.');
            if (!ready) throw new Error('Configure and test an eligible Coding Agent in AI Center.');
            // Recheck the fresh persisted snapshot, including its immutable validation policy.
            if (task.origin.kind !== 'work-item' || task.projectId !== task.origin.projectId ||
                task.planningMapId !== task.origin.planningMapId || task.reviewPolicy?.kind !== 'required' ||
                !task.completion.requireValidationPass || !task.completion.validation.length ||
                task.completion.validation.some(target => !target.command?.trim()))
                throw new Error('Saved WorkItem task lacks required Dope validation. Launch a new validated task from its Planning Map.');
            const grant = createDefaultExecutionGrant({ id: crypto.randomUUID(), revision: 1, taskId: task.id,
                acceptedAt: new Date().toISOString() });
            // Consume acceptance before the RPC; a failed attempt requires a fresh review.
            this.acceptedStartGrant = false; this.hostedProjectDataAuthorized = false;
            const run = await this.runtime.start(handle, project, task.id, grant, true);
            if (run.taskId !== task.id || run.projectId !== task.projectId)
                throw new Error('AgentRun identity did not match the selected saved task. Refresh Work.');
            if (serial !== this.serial || handle !== this.handle || project !== this.project) return run;
            await this.refresh();
            await this.select({ kind: 'run', id: run.id });
            return run;
        } catch (error) {
            if (serial === this.serial && handle === this.handle)
                this.message = `WorkItem task could not start: ${error instanceof Error ? error.message : 'State could not be verified'}`;
            if (handle === this.handle) await this.refresh();
        } finally {
            if (startEpoch === this.startEpoch) {
                this.startBusy = false; this.acceptedStartGrant = false; this.hostedProjectDataAuthorized = false;
                this.changed();
            }
        }
    }
    async requestSteering(): Promise<void> {
        const handle = this.handle, run = this.selectedRun, task = this.selectedTask;
        const text = this.steeringText.trim();
        if (!handle || !run || !task || run.taskId !== task.id || run.status !== 'running' ||
            run.candidateReview || run.candidateDelta || !text || this.steeringBusy) return;
        this.steeringBusy = true; this.message = ''; this.changed();
        try {
            const state = await this.runtime.requestSteering(handle, task.id, run.id,
                this.steering?.revision ?? 0, { kind: this.steeringKind, text });
            if (handle === this.handle && this.selectedRun?.id === run.id) {
                this.steering = state; this.steeringText = '';
            }
        } catch (error) {
            if (handle === this.handle && this.selectedRun?.id === run.id) {
                this.message = `Steering request failed: ${error instanceof Error ? error.message : 'State could not be verified'}`;
                this.steering = await this.runtime.readSteering(handle, run.id).catch(() => this.steering);
            }
        } finally { this.steeringBusy = false; this.changed(); }
    }
    async decideAction(actionId: string, decision: 'acknowledged' | 'rejected'): Promise<void> {
        const handle = this.handle, run = this.selectedRun, shown = this.actions.find(item => item.id === actionId);
        if (!handle || !run || !shown || shown.runId !== run.id || shown.decision || this.actionBusy) return;
        this.actionBusy = true; this.message = ''; this.changed();
        try {
            const current = await this.runtime.readAction(handle, actionId);
            if (handle !== this.handle || this.selectedRun?.id !== run.id) return;
            if (!current || current.revision !== shown.revision || current.decision || current.runId !== run.id) {
                this.message = 'Blocked action changed. Refresh Work before deciding.';
                return;
            }
            const next = await this.runtime.decideAction(handle, actionId, current.revision, decision);
            if (handle === this.handle && this.selectedRun?.id === run.id)
                this.actions = this.actions.map(item => item.id === actionId ? next : item);
        } catch (error) {
            if (handle === this.handle && this.selectedRun?.id === run.id)
                this.message = `Action decision failed: ${error instanceof Error ? error.message : 'State could not be verified'}`;
        } finally { this.actionBusy = false; this.changed(); }
    }
    async decideCandidate(decision: 'accept' | 'reject'): Promise<void> {
        const handle = this.handle, shown = this.selectedRun, task = this.selectedTask;
        if (!handle || !shown?.candidateReview || workReviewState(shown, task, this.reviewBusy) !== 'pending') return;
        if (decision === 'accept' && !workReviewCanAccept(shown, task)) return;
        this.reviewBusy = true; this.message = ''; this.changed();
        try {
            const current = await this.runtime.readRun(handle, shown.id);
            if (handle !== this.handle || this.selectedRun?.id !== shown.id) return;
            if (!current?.candidateReview || workReviewState(current, task) !== 'pending' ||
                current.candidateReview.revision !== shown.candidateReview.revision ||
                current.candidateReview.candidateFingerprint !== shown.candidateReview.candidateFingerprint) {
                this.message = 'Candidate review changed. Refresh Work before deciding.';
                this.selectedRun = current;
                return;
            }
            if (decision === 'accept' && !workReviewCanAccept(current, task)) {
                this.message = 'Required Dope validation is missing or stale. Candidate cannot be accepted.';
                this.selectedRun = current;
                return;
            }
            const review = current.candidateReview;
            const grant = decision === 'accept' ? createDefaultExecutionGrant({ id: current.grantId,
                revision: current.grantRevision, taskId: current.taskId, acceptedAt: new Date().toISOString() }) : undefined;
            this.selectedRun = await this.runtime.decideCandidate(handle, current.id, review.revision,
                review.candidateFingerprint, decision, grant);
            await this.refresh();
        } catch (error) {
            this.message = `Candidate ${decision} failed: ${error instanceof Error ? error.message : 'Review state could not be verified'}`;
            const current = await this.runtime.readRun(handle, shown.id).catch(() => undefined);
            if (handle === this.handle && this.selectedRun?.id === shown.id && current) this.selectedRun = current;
        } finally { this.reviewBusy = false; this.changed(); }
    }
}
