import assert from 'node:assert/strict';
import test from 'node:test';
import { WorkSelectionController, workTitle } from '../../packages/theia-extension/lib/browser/work-selection-controller.js';
import type { AgentRuntimeService } from '../../packages/contracts/src/agent-runtime-service.ts';

const head = 'a'.repeat(40);
const entries = [{ number: 1, title: 'First implementation', execution: 'agent-task' },
    { number: 2, title: 'Browser closeout', execution: 'manual-gate' }];
const sequence: any = { id: 'stored-sequence', status: 'completed', currentEntryNumber: 3,
    stack: { folderName: 'c4-dope-phase-stack-smoke', mode: 'correction', phase: 4, entries },
    checkpoints: [], basis: { head, packageVersion: '0.8.20' }, runIds: ['historic-run'] };
const task: any = { id: 'historic-task', objective: 'First implementation', completion: { validation: [] } };
const run: any = { id: 'historic-run', taskId: task.id, status: 'completed' };

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
