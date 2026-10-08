import type { AgentRun, AgentTask, AgentTranscriptEntry, AgentTaskSequence } from '@dope/agent-core';
import type { AgentRuntimeService } from '@dope/contracts/lib/agent-runtime-service';
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
    private serial = 0;

    constructor(private readonly runtime: AgentRuntimeService, private readonly changed: () => void) {
        this.phase = new PhaseStackController(runtime, changed);
    }
    async attach(project?: string): Promise<void> {
        const serial = ++this.serial;
        this.project = project; this.handle = undefined; this.tasks = []; this.runs = [];
        this.selectedRun = undefined; this.selectedTask = undefined; this.transcript = []; this.message = '';
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
        this.selectedRun = undefined; this.selectedTask = undefined; this.transcript = []; this.transcriptIncomplete = false;
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
}
