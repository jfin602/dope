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
        this.selectedRun = undefined; this.selectedTask = undefined; this.transcript = [];
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
                for (let page = 0; page < 25; page++) {
                    const result = await this.runtime.readTranscript(handle, run.id, cursor, 100);
                    if (serial !== this.serial || handle !== this.handle) return;
                    this.transcriptState = result.state;
                    this.transcript.push(...result.entries);
                    cursor = result.nextSequence;
                    if (!result.hasMore) break;
                }
            }
            this.changed();
        } catch {
            if (serial === this.serial) { this.message = 'Work detail could not be read.'; this.changed(); }
        }
    }
}
