import assert from 'node:assert/strict';
import test from 'node:test';
import { WorkSelectionController, workRows, workTitle } from '../../packages/theia-extension/lib/browser/work-selection-controller.js';
import type { AgentRuntimeService } from '../../packages/contracts/src/agent-runtime-service.ts';

const head = 'a'.repeat(40);
const entries = [{ number: 1, title: 'First implementation', execution: 'agent-task' },
    { number: 2, title: 'Browser closeout', execution: 'manual-gate' }];
const sequence: any = { id: 'stored-sequence', status: 'completed', currentEntryNumber: 3,
    stack: { folderName: 'c4-dope-phase-stack-smoke', mode: 'correction', phase: 4, entries },
    checkpoints: [], basis: { head, packageVersion: '0.8.20' }, runIds: ['historic-run'] };
const task: any = { id: 'historic-task', objective: 'First implementation', origin: { kind: 'phase-stack' }, completion: { validation: [] } };
const run: any = { id: 'historic-run', taskId: task.id, status: 'completed' };

test('Running contains only active execution, groups stack children, and History sorts by latest activity', () => {
    const at = (minute: number) => `2026-10-08T12:${String(minute).padStart(2, '0')}:00Z`;
    const stack = { ...sequence, status: 'running', currentEntryNumber: 1, updatedAt: at(10),
        taskId: 'stack-task', runIds: ['stack-run'], checkpoints: [] } as any;
    const tasks = [{ ...task, origin: { kind: 'direct' } },
        { id: 'stack-task', objective: 'First implementation', origin: { kind: 'phase-stack' },
        createdAt: at(0) }, { id: 'cancel-task', objective: 'Cancelled direct', origin: { kind: 'direct' },
        createdAt: at(1) } ] as any;
    const runs = [{ id: 'stack-run', taskId: 'stack-task', status: 'running', startedAt: at(8), createdAt: at(5) },
        { id: 'historic-run', taskId: task.id, status: 'completed', endedAt: at(9), createdAt: at(0) },
        { id: 'cancel-run', taskId: 'cancel-task', status: 'cancelled', endedAt: at(11), createdAt: at(1) },
        { id: 'earlier-stack-attempt', taskId: 'stack-task', status: 'failed', endedAt: at(7), createdAt: at(4) }] as any;
    const active = workRows(tasks, runs, [stack], Date.parse(at(12)));
    assert.deepEqual(active.running.map(item => item.selection.id), ['stored-sequence']);
    assert.deepEqual(active.history.map(item => item.selection.id), ['cancel-run', 'historic-run', 'earlier-stack-attempt']);
    assert.equal(active.running[0].elapsedMs, 4 * 60_000);
    assert.equal(active.running[0].stack, 'c4-dope-phase-stack-smoke · P1 of 2');
    runs[0].status = 'blocked'; stack.status = 'blocked';
    const blocked = workRows(tasks, runs, [stack]);
    assert.equal(blocked.running.length, 0);
    assert.equal(blocked.history.filter(item => item.selection.id === 'stored-sequence').length, 1);
});

test('Work discovers default Prompt Stacks and reopens completed history without creating records', async () => {
    let scans = 0, opens = 0, creates = 0;
    const runtime = {
        async attach() { return { projectHandle: 'handle' }; },
        async listTaskStacks(_handle: string, root: string) {
            scans++; assert.equal(root, 'docs/tasks/');
            return [{ folderName: sequence.stack.folderName, sequenceId: sequence.id, valid: true,
                sequenceStatus: 'completed', mode: 'correction', phase: 4 }];
        },
        async listSequences() { return [sequence]; },
        async listTasks() { return [task]; }, async listRuns() { return [run]; },
        async readTask(_handle: string, id: string) { return id === task.id ? task : undefined; },
        async readRun(_handle: string, id: string) { return id === run.id ? run : undefined; },
        async readSteering() { return undefined; }, async listActions() { return []; }, async readMapImpact() { return undefined; },
        async readTranscript() { return { state: 'recorded', entries: [{ kind: 'message', text: 'Done' }],
            nextSequence: 1, hasMore: false, incomplete: false }; },
        async sequenceEvidence() { return { head, packageVersion: '0.8.20', clean: true, worktreeFingerprint: 'basis' }; },
        async codingAgentReady() { return false; },
        async openTaskStack() { opens++; return { kind: 'opened', sequence }; },
        async createTask() { creates++; }, async start() { creates++; },
        async prepareSequenceTask() { creates++; }, async startSequence() { creates++; }
    } as unknown as AgentRuntimeService;
    const controller = new WorkSelectionController(runtime, () => {});
    await controller.attach('file:///project');
    assert.equal(controller.phase.tasksRoot, 'docs/tasks/');
    assert.equal(scans, 1);
    assert.deepEqual(controller.phase.stacks.map(item => item.folderName), ['c4-dope-phase-stack-smoke']);
    await controller.select({ kind: 'sequence', id: sequence.id });
    assert.equal(controller.phase.selected?.id, sequence.id);
    assert.equal(workTitle({ kind: 'sequence', id: sequence.id }, undefined, undefined, controller.phase.selected),
        'Browser closeout');
    await controller.select({ kind: 'run', id: run.id });
    assert.equal(controller.selectedRun?.taskId, task.id);
    assert.equal(controller.selectedTask?.id, task.id);
    assert.equal(controller.transcript[0].kind, 'message');
    assert.equal(workTitle({ kind: 'run', id: run.id }, controller.selectedRun, controller.selectedTask),
        'First implementation');
    sequence.currentEntryNumber = 1;
    assert.equal(workTitle({ kind: 'sequence', id: sequence.id }, undefined, undefined, sequence),
        'First implementation');
    sequence.currentEntryNumber = 2;
    assert.equal(workTitle({ kind: 'sequence', id: sequence.id }, undefined, undefined, sequence),
        'Browser closeout');
    assert.equal(workTitle({ kind: 'run', id: run.id }, controller.selectedRun, controller.selectedTask),
        'First implementation');
    assert.equal(workTitle({ kind: 'run', id: run.id }, run), 'Work - historic');
    await controller.scan();
    assert.equal(scans, 2);
    assert.equal(opens, 0);
    assert.equal(creates, 0);
});
