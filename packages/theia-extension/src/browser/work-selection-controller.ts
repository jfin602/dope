import type { AgentMapImpact, AgentRun, AgentSteeringRequest, AgentSteeringState, AgentTask,
    AgentTranscriptEntry, AgentTaskSequence, ProposedAction } from '@dope/agent-core';
import type { AgentRuntimeService } from '@dope/contracts/lib/agent-runtime-service';
import { createDefaultExecutionGrant } from '@dope/agent-core';
import { PhaseStackController } from './phase-stack-controller';
import type { WorkSelection } from './shared-panel-state';
import type { AgentTarget } from './agent-run-controller';

export function workTitle(selection: WorkSelection, run?: AgentRun, task?: AgentTask,
    sequence?: AgentTaskSequence): string {
    if (selection.kind === 'sequence') return sequence?.stack.folderName ?? 'Prompt Stack';
    if (run) return task?.objective ?? `Work - ${run.id.slice(0, 8)}`;
    return task?.objective ?? `Work - ${selection.id.slice(0, 8)}`;
}

/** Only saved owner state supplies these claims; agent prose is never validation evidence. */
export function workRunOverview(run: AgentRun, task?: AgentTask): { state: string; validation: string; next: string } {
    const review = workReviewState(run, task);
    const required = task?.completion.validation ?? [];
    const results = run.candidateReview && !run.reviewDecision ? run.candidateReview.validation : run.validationResults;
    const matching = required.map(target => results.find(result =>
        result.owner === 'dope' && result.kind === target.kind && result.label === target.label &&
        (!run.candidateReview || result.candidateFingerprint === run.candidateReview.candidateFingerprint)));
    const passed = required.length > 0 && matching.every(result => result?.status === 'passed');
    const failed = matching.some(result => result?.status === 'failed');
    const validation = failed ? 'Required validation failed' : passed ? 'Required validation passed' :
        required.length ? 'Required validation has not passed' : 'No required validation recorded';
    const state = review === 'pending' ? 'Candidate held for review; no changes applied' :
        review === 'accepted' ? `Candidate accepted; ${run.appliedFiles?.length ?? 0} ` +
            `file${run.appliedFiles?.length === 1 ? '' : 's'} applied` :
        review === 'rejected' ? 'Candidate rejected; no changes applied' :
        run.status === 'completed' ? 'Agent run completed; review and qualification remain separate' :
        `Agent run ${run.status}`;
    const next = review === 'pending' ? workReviewCanAccept(run, task) ?
        'Review the candidate diff, then accept or reject it.' :
        'Inspect required validation before deciding; acceptance is unavailable.' :
        review === 'stale' ? 'Refresh Work and inspect the changed source before another decision.' :
        review === 'accepted' ? 'Inspect the checkpoint and Planning Map; qualification is a separate decision.' :
        review === 'rejected' ? 'Return to the Prompt Stack to revise or continue safely.' :
        run.status === 'failed' || run.status === 'blocked' ? 'Inspect run diagnostics and the transcript before retrying.' :
        run.status === 'running' ? 'Wait for the run or use Stop Work if available.' :
        'Inspect the transcript and validation before continuing.';
    return { state, validation, next };
}

export function workManualGateReady(sequence: AgentTaskSequence): boolean {
    return sequence.status === 'waiting-manual' &&
        sequence.stack.entries[sequence.currentEntryNumber - 1]?.execution === 'manual-gate';
}

/** Read-only projection. Action flags must come from the existing controller eligibility checks;
 * this model never grants permission or dispatches an operation. */
export interface WorkViewInput {
    selection: WorkSelection;
    task?: AgentTask;
    run?: AgentRun;
    sequence?: AgentTaskSequence;
    projectId?: string;
    eligible?: Partial<Record<WorkViewAction, boolean>>;
}
export type WorkViewAction = 'start' | 'stop' | 'review-candidate' | 'accept-candidate' |
    'reject-candidate' | 'continue-dirty' | 'verify-checkpoint' | 'verify-manual-gate' | 'reconcile';
export type WorkValidationState = 'passed' | 'failed' | 'not-run' | 'unavailable' | 'unknown';
export interface WorkViewModel {
    title: string;
    origin: 'direct' | 'work-item' | 'prompt-stack' | 'unknown';
    status: string;
    next: string;
    current?: { number: number; total: number; execution: 'agent-task' | 'manual-gate' };
    steps: { number: number; title: string; execution: 'agent-task' | 'manual-gate';
        checkpoint: 'verified' | 'pending'; sha?: string }[];
    runState: AgentRun['status'] | 'not-started' | 'unknown';
    validation: WorkValidationState;
    candidate: 'none' | 'held' | 'accepted' | 'rejected' | 'stale' | 'unknown';
    promotion: 'applied' | 'held' | 'not-applicable' | 'unknown';
    checkpoint: 'verified' | 'pending' | 'not-applicable';
    qualification: 'unknown';
    blockedReason?: AgentTaskSequence['blockedReason'];
    gateMessage?: string;
    actions: WorkViewAction[];
}

function requiredValidation(task?: AgentTask, run?: AgentRun): WorkValidationState {
    if (!task || !run || !task.completion.requireValidationPass || !task.completion.validation.length)
        return 'unknown';
    const results = run.candidateReview && !run.reviewDecision ? run.candidateReview.validation : run.validationResults;
    const relevant = task.completion.validation.map(target => results.find(result =>
        result.owner === 'dope' && result.kind === target.kind && result.label === target.label &&
        (!run.candidateReview || result.candidateFingerprint === run.candidateReview.candidateFingerprint)));
    if (relevant.some(result => result?.status === 'failed')) return 'failed';
    if (relevant.every(result => result?.status === 'passed')) return 'passed';
    if (relevant.some(result => result && ['skipped', 'cancelled', 'not-started'].includes(result.status) && result.reason))
        return 'unavailable';
    return 'not-run';
}

export function selectWorkView(input: WorkViewInput): WorkViewModel {
    const { selection, sequence } = input;
    const sequenceIdentity = selection.kind === 'sequence' && sequence?.id === selection.id;
    const runIdentity = input.run && (selection.kind === 'run' ? input.run.id === selection.id :
        sequenceIdentity ? sequence.runIds?.includes(input.run.id) && sequence.taskId === input.run.taskId : false);
    const run = runIdentity ? input.run : undefined;
    const task = input.task && (selection.kind === 'task' ? input.task.id === selection.id :
        run ? input.task.id === run.taskId : sequenceIdentity && sequence.taskId === input.task.id) &&
        (!input.projectId || !input.task.projectId || input.task.projectId === input.projectId) &&
        (!run || !run.projectId || run.projectId === input.task.projectId) ? input.task : undefined;
    const saved = sequenceIdentity ? sequence : undefined;
    const identityValid = selection.kind === 'sequence' ? !!saved : selection.kind === 'run' ? !!run && !!task : !!task;
    const steps = saved?.stack.entries.map(entry => {
        const proof = saved.checkpoints.find(checkpoint => checkpoint.entryNumber === entry.number && !!checkpoint.sha);
        return { number: entry.number, title: entry.title, execution: entry.execution,
            checkpoint: proof ? 'verified' as const : 'pending' as const, sha: proof?.sha };
    }) ?? [];
    const entry = saved?.stack.entries[saved.currentEntryNumber - 1];
    const current = entry ? { number: entry.number, total: steps.length, execution: entry.execution } : undefined;
    const origin = saved ? 'prompt-stack' : task?.origin.kind === 'work-item' ? 'work-item' :
        task?.origin.kind === 'direct' ? 'direct' : 'unknown';
    const title = saved?.stack.folderName ?? task?.objective ?? 'Work unavailable';
    const validation = requiredValidation(task, run);
    const review = workReviewState(run, task);
    const candidate = review === 'pending' ? 'held' : review === 'accepted' || review === 'rejected' || review === 'stale' ? review :
        run?.candidateDelta ? 'unknown' : 'none';
    const promotion = candidate === 'held' || candidate === 'stale' || candidate === 'rejected' ? 'held' :
        candidate === 'accepted' ? run?.status === 'completed' && Array.isArray(run.appliedFiles) ? 'applied' : 'unknown' :
        'not-applicable';
    const checkpoint = saved ? saved.checkpoints.some(proof => proof.entryNumber === saved.currentEntryNumber && !!proof.sha) ?
        'verified' : 'pending' : 'not-applicable';
    const actions: WorkViewAction[] = [];
    const add = (action: WorkViewAction, allowed: boolean) => {
        if (identityValid && allowed && input.eligible?.[action] === true) actions.push(action);
    };
    add('start', !!task && !run && (!saved || saved.status === 'ready' || saved.status === 'blocked'));
    add('stop', !!run && run.status === 'running' && (!saved || saved.status === 'running'));
    add('review-candidate', candidate === 'held');
    add('accept-candidate', candidate === 'held' && workReviewCanAccept(run, task));
    add('reject-candidate', candidate === 'held');
    add('continue-dirty', !!saved && ['dirty-acceptance-required', 'worktree-drift'].includes(saved.blockedReason ?? ''));
    add('verify-checkpoint', !!saved && ['checkpoint-pending', 'checkpoint-failed'].includes(saved.blockedReason ?? ''));
    add('verify-manual-gate', !!saved && workManualGateReady(saved));
    add('reconcile', !!saved && saved.status !== 'running' && saved.status !== 'completed');
    let status = 'Ready to start';
    let next = 'Review Work before starting.';
    if (!identityValid) { status = 'Work unavailable'; next = 'Refresh Work and check the selected project.'; }
    else if (saved?.blockedReason && ['source-drift', 'head-drift', 'worktree-drift', 'git-history',
        'checkpoint-mismatch'].includes(saved.blockedReason)) {
        status = 'Project changed—review'; next = 'Inspect the source and reconcile before continuing.';
    } else if (saved?.blockedReason === 'dirty-acceptance-required') {
        status = 'Needs authorization'; next = 'Review the changed files before continuing.';
    } else if (candidate === 'held') {
        status = 'Candidate ready for review'; next = 'Inspect the candidate and required validation before deciding.';
    } else if (saved && ['checkpoint-pending', 'checkpoint-failed'].includes(saved.blockedReason ?? '')) {
        status = 'Checkpoint needs verification'; next = 'Inspect the Git checkpoint evidence.';
    } else if (validation === 'failed') {
        status = 'Validation failed'; next = 'Inspect the failed check and preserve its evidence.';
    } else if (run && ['blocked', 'failed', 'interrupted', 'cancelled'].includes(run.status)) {
        status = 'Work needs review'; next = 'Inspect the run diagnostics.';
    } else if (validation === 'unavailable' || validation === 'not-run' && run && run.status !== 'running') {
        status = validation === 'unavailable' ? 'Validation unavailable' : 'Validation not run';
        next = 'Inspect the required check before continuing.';
    } else if (saved?.status === 'waiting-manual') {
        status = 'Manual review needed'; next = 'Review the manual gate and its source evidence.';
    } else if (run?.status === 'running' && (!saved || saved.status === 'running')) {
        status = current ? `Running P${current.number} of ${current.total}` : 'Running';
        next = 'Inspect current activity.';
    } else if (run?.status === 'running' || saved?.status === 'running') {
        status = 'Status needs review'; next = 'Refresh Work to reconcile run and sequence state.';
    } else if (saved?.status === 'completed' && saved.stack.entries.every(step =>
        step.execution === 'manual-gate' || steps.find(item => item.number === step.number)?.checkpoint === 'verified') &&
        validation === 'passed') {
        status = 'Completed with evidence'; next = 'Inspect the saved checkpoints and qualification record.';
    } else if (!saved && run?.status === 'completed' && validation === 'passed' &&
        (task?.reviewPolicy?.kind !== 'required' || promotion === 'applied')) {
        status = 'Completed with evidence'; next = 'Inspect the saved validation and decision.';
    } else if (saved?.status === 'blocked' || saved?.status === 'interrupted') {
        status = 'Work needs review'; next = 'Inspect the saved blocker and reconcile if available.';
    } else if (run?.status === 'completed' || saved?.status === 'completed') {
        status = 'Agent finished'; next = 'Inspect validation, checkpoint and manual qualification separately.';
    }
    return { title, origin, status, next, current, steps, runState: run?.status ??
        (saved?.status === 'running' ? 'unknown' : 'not-started'), validation, candidate, checkpoint,
        promotion, qualification: 'unknown', blockedReason: saved?.blockedReason, gateMessage: saved?.gateMessage, actions };
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
    if (!run?.candidateReview || !task || !['work-item', 'phase-stack'].includes(task.origin.kind) ||
        task.reviewPolicy?.kind !== 'required' || task.id !== run.taskId || task.projectId !== run.projectId) return 'unavailable';
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
    startTarget?: AgentTarget;
    startTargetReason = 'Coding Agent target is loading.';
    private selectedTaskId?: string;
    private startEpoch = 0;
    private serial = 0;

    constructor(private readonly runtime: AgentRuntimeService, private readonly changed: () => void,
        private readonly resolveTarget?: (policy: AgentTask['modelPolicy']) => Promise<{ target?: AgentTarget; reason: string }>) {
        this.phase = new PhaseStackController(runtime, changed);
    }
    /** Adapter for the UI: capture only existing controller eligibility, then project it without effects. */
    view(selection: WorkSelection): WorkViewModel {
        const sequence = selection.kind === 'sequence' && this.phase.selected?.id === selection.id ?
            this.phase.selected : undefined;
        const run = sequence ? this.phase.run : selection.kind === 'run' && this.selectedRun?.id === selection.id ?
            this.selectedRun : undefined;
        const task = sequence ? this.tasks.find(item => item.id === sequence.taskId) :
            this.selectedTask;
        const reviewPending = workReviewState(run, task, this.reviewBusy) === 'pending';
        const phase = this.phase;
        return selectWorkView({ selection, sequence, run, task,
            eligible: sequence ? {
                start: phase.canStart,
                stop: sequence.status === 'running' && !phase.busy,
                'review-candidate': sequence.blockedReason === 'candidate-review-pending' &&
                    !!run?.candidateReview && !phase.busy,
                'continue-dirty': phase.needsDirtyAcceptance && !phase.dirtyPromptDismissed && !phase.busy,
                'verify-checkpoint': ['checkpoint-pending', 'checkpoint-failed'].includes(sequence.blockedReason ?? '') && !phase.busy,
                'verify-manual-gate': workManualGateReady(sequence) && !phase.busy,
                reconcile: sequence.status !== 'running' && sequence.status !== 'completed' && !phase.busy
            } : {
                start: selection.kind === 'task' && this.startBlockReason === '',
                'review-candidate': reviewPending,
                'accept-candidate': reviewPending && workReviewCanAccept(run, task),
                'reject-candidate': reviewPending
            } });
    }
    async attach(project?: string): Promise<void> {
        const serial = ++this.serial;
        ++this.startEpoch;
        this.project = project; this.handle = undefined; this.tasks = []; this.runs = [];
        this.startBusy = false; this.acceptedStartGrant = false; this.hostedProjectDataAuthorized = false;
        this.selectedTaskId = undefined; this.startTarget = undefined;
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
    async select(selection: WorkSelection | undefined, navigationOnly = false): Promise<WorkSelection | undefined> {
        const handle = this.handle, serial = ++this.serial;
        this.selectedTaskId = selection?.kind === 'task' ? selection.id : undefined;
        this.acceptedStartGrant = false; this.hostedProjectDataAuthorized = false; this.startTarget = undefined;
        this.selectedRun = undefined; this.selectedTask = undefined; this.transcript = []; this.transcriptIncomplete = false;
        this.steering = undefined; this.actions = []; this.mapImpact = undefined; this.steeringText = '';
        this.message = ''; this.phase.message = ''; this.phase.selected = undefined; this.phase.run = undefined;
        if (!handle || !selection) { this.changed(); return; }
        if (selection.kind === 'sequence') {
            let sequence: AgentTaskSequence | undefined;
            const candidate = this.phase.stacks.find(item =>
                item.folderName === selection.id || item.sequenceId === selection.id);
            if (this.phase.sequences.some(item => item.id === selection.id) ||
                candidate?.sequenceId === selection.id || !candidate)
                sequence = await this.phase.selectStored(selection.id, !navigationOnly);
            else if (!navigationOnly) sequence = await this.phase.select(candidate.folderName);
            if (serial !== this.serial || handle !== this.handle) return;
            if (!sequence) {
                if (!this.phase.message) this.phase.message = 'Prompt Stack could not be opened. Refresh and try again.';
                this.changed();
                return;
            }
            this.changed();
            return { kind: 'sequence', id: sequence.id };
        }
        try {
            const run = selection.kind === 'run' ? await this.runtime.readRun(handle, selection.id) : undefined;
            const task = run ? await this.runtime.readTask(handle, run.taskId) :
                selection.kind === 'task' ? await this.runtime.readTask(handle, selection.id) : undefined;
            if (serial !== this.serial || handle !== this.handle) return;
            this.selectedRun = run; this.selectedTask = task;
            if (!navigationOnly && selection.kind === 'task' && task?.origin.kind === 'work-item' && this.resolveTarget) {
                try {
                    const result = await this.resolveTarget(task.modelPolicy);
                    if (serial !== this.serial || handle !== this.handle) return;
                    this.startTarget = result.target; this.startTargetReason = result.reason;
                } catch { this.startTargetReason = 'Coding Agent target could not be resolved.'; }
            }
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
            if (task && (selection.kind === 'task' || run?.taskId === task.id)) return selection;
            this.message = 'Work detail could not be opened in this project.';
            this.changed();
        } catch {
            if (serial === this.serial) { this.message = 'Work detail could not be read.'; this.changed(); }
        }
    }
    acceptStartGrant(accepted: boolean): void { this.acceptedStartGrant = accepted; this.changed(); }
    authorizeHostedProjectData(authorized: boolean): void {
        this.hostedProjectDataAuthorized = authorized; this.changed();
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
        if (!this.startTarget) return this.startTargetReason;
        if (!this.acceptedStartGrant)
            return 'Review and accept the fixed project execution grant for this task.';
        if (this.startTarget?.locality === 'hosted' && !this.hostedProjectDataAuthorized)
            return 'Authorize sending this project data to the hosted Coding Agent for this start.';
        return '';
    }
    async startSelectedWorkItemTask(): Promise<AgentRun | undefined> {
        const reason = this.startBlockReason;
        if (reason) { this.message = reason; this.changed(); return; }
        const handle = this.handle!, project = this.project!, shown = this.selectedTask!;
        const serial = this.serial, shownTarget = this.startTarget!;
        const startEpoch = ++this.startEpoch;
        this.startBusy = true; this.message = ''; this.changed();
        try {
            const [task, runs, ready, freshTarget] = await Promise.all([
                this.runtime.readTask(handle, shown.id), this.runtime.listRuns(handle),
                this.runtime.codingAgentReady(handle),
                this.resolveTarget?.(shown.modelPolicy)
            ]);
            if (serial !== this.serial || handle !== this.handle || project !== this.project ||
                this.selectedTaskId !== shown.id || !this.acceptedStartGrant ||
                (shownTarget.locality === 'hosted' && !this.hostedProjectDataAuthorized))
                throw new Error('Selection or project changed. Review and accept Start again.');
            if (!task || JSON.stringify(task) !== JSON.stringify(shown))
                throw new Error('Saved task changed. Refresh Work and select the task again.');
            if (runs.some(run => run.taskId === task.id))
                throw new Error('This WorkItem task already has a run. Select its run to inspect it.');
            if (runs.some(run => ['pending', 'running', 'blocked', 'cancelling'].includes(run.status)))
                throw new Error('Another AgentRun is active. Stop or resolve it before starting this task.');
            if ((task.modelPolicy.kind === 'follow-coding-agent' && !ready) || !freshTarget?.target || freshTarget.target.connectionId !== shownTarget.connectionId ||
                freshTarget.target.modelId !== shownTarget.modelId || freshTarget.target.locality !== shownTarget.locality)
                throw new Error('Coding Agent selection changed or became unavailable. Review Start again.');
            // Recheck the fresh persisted snapshot, including its immutable validation policy.
            if (task.origin.kind !== 'work-item' || task.projectId !== task.origin.projectId ||
                task.planningMapId !== task.origin.planningMapId || task.reviewPolicy?.kind !== 'required' ||
                !task.completion.requireValidationPass || !task.completion.validation.length ||
                task.completion.validation.some(target => !target.command?.trim()))
                throw new Error('Saved WorkItem task lacks required Dope validation. Launch a new validated task from its Planning Map.');
            const grant = createDefaultExecutionGrant({ id: crypto.randomUUID(), revision: 1, taskId: task.id,
                acceptedAt: new Date().toISOString() });
            // Consume acceptance before the RPC; a failed attempt requires a fresh review.
            const hostedAuthorized = shownTarget.locality === 'hosted' && this.hostedProjectDataAuthorized;
            this.acceptedStartGrant = false; this.hostedProjectDataAuthorized = false;
            const run = await this.runtime.start(handle, project, task.id, grant, hostedAuthorized);
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
            await this.phase.refresh();
        } catch (error) {
            this.message = `Candidate ${decision} failed: ${error instanceof Error ? error.message : 'Review state could not be verified'}`;
            const current = await this.runtime.readRun(handle, shown.id).catch(() => undefined);
            if (handle === this.handle && this.selectedRun?.id === shown.id && current) this.selectedRun = current;
        } finally { this.reviewBusy = false; this.changed(); }
    }
}
