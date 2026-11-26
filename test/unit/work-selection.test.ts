import assert from 'node:assert/strict';
import test from 'node:test';
import { WorkSelectionController, selectWorkView, workRows, workRunOverview, workTitle } from '../../packages/theia-extension/lib/browser/work-selection-controller.js';
import type { AgentRuntimeService } from '../../packages/contracts/src/agent-runtime-service.ts';
import { createDefaultExecutionGrant } from '../../packages/agent-core/lib/authority.js';
import { WorkToolPreferences } from '../../packages/theia-extension/lib/browser/work-tool-preferences.js';

const head = 'a'.repeat(40);
const entries = [{ number: 1, title: 'First implementation', execution: 'agent-task' },
    { number: 2, title: 'Browser closeout', execution: 'manual-gate' }];
const sequence: any = { id: 'stored-sequence', status: 'completed', currentEntryNumber: 3,
    stack: { folderName: 'c4-dope-phase-stack-smoke', mode: 'correction', phase: 4, entries },
    checkpoints: [], basis: { head, packageVersion: '0.8.20' }, runIds: ['historic-run'] };
const task: any = { id: 'historic-task', objective: 'First implementation', origin: { kind: 'phase-stack' }, completion: { validation: [] } };
const run: any = { id: 'historic-run', taskId: task.id, status: 'completed' };

test('Work display names stay short while the saved objective remains available', () => {
    const objective = 'Build the first playable Meteor Dodge game in this repository. Add player controls and collision tests.';
    const directTask = { ...task, id: 'meteor-task', objective, origin: { kind: 'direct' } };
    const directRun = { ...run, id: 'meteor-run', taskId: directTask.id, createdAt: '2026-11-24T12:00:00Z' };
    const title = 'Build the first playable Meteor Dodge…';
    assert.equal(workTitle({ kind: 'run', id: directRun.id }, directRun, directTask), title);
    const row = workRows([directTask], [directRun], []).history[0];
    assert.equal(row.title, title);
    assert.equal(row.fullTitle, objective);
    assert.equal(directTask.objective, objective);
});

test('pure Work view keeps direct, WorkItem and Prompt Stack origins and eligibility separate', () => {
    const direct: any = { id: 'direct-task', objective: 'Repair parser', origin: { kind: 'direct' },
        completion: { requireValidationPass: true, validation: [{ kind: 'test', label: 'check' }] } };
    const selected = { kind: 'task' as const, id: direct.id };
    const ready = selectWorkView({ selection: selected, task: direct, eligible: { start: true } });
    assert.equal(ready.title, 'Repair parser');
    assert.equal(ready.origin, 'direct');
    assert.equal(ready.status, 'Ready to start');
    assert.deepEqual(ready.actions, ['start']);
    assert.equal(ready.qualification, 'unknown');
    const workItem = { ...direct, origin: { kind: 'work-item', projectId: 'project', planningMapId: 'map',
        workItemId: 'item' }, projectId: 'project' } as any;
    assert.equal(selectWorkView({ selection: selected, task: workItem, projectId: 'project' }).origin, 'work-item');
    assert.deepEqual(selectWorkView({ selection: selected, task: workItem, projectId: 'other',
        eligible: { start: true } }).actions, []);
    const stack: any = { ...sequence, status: 'running', currentEntryNumber: 1, taskId: direct.id,
        runIds: ['active'], checkpoints: [{ entryNumber: 2, sha: head }] };
    const active: any = { id: 'active', taskId: direct.id, status: 'running', validationResults: [] };
    const view = selectWorkView({ selection: { kind: 'sequence', id: stack.id }, sequence: stack,
        task: direct, run: active, eligible: { stop: true } });
    assert.equal(view.origin, 'prompt-stack');
    assert.equal(view.title, stack.stack.folderName);
    assert.equal(view.status, 'Running P1 of 2');
    assert.deepEqual(view.steps.map(step => step.checkpoint), ['pending', 'verified']);
    assert.deepEqual(view.actions, ['stop']);
    assert.equal(view.validation, 'not-run');
    assert.equal(selectWorkView({ selection: { kind: 'sequence', id: stack.id }, sequence: stack }).status,
        'Status needs review');
});

test('Work view requires Dope validation proof and keeps drift, dirty consent and manual gate distinct', () => {
    const required: any = { id: 'task', objective: 'Implement', origin: { kind: 'phase-stack' },
        completion: { requireValidationPass: true, validation: [{ kind: 'test', label: 'required' }] } };
    const basis: any = { id: 'run', taskId: 'task', status: 'completed', validationResults: [],
        outcome: { summary: 'all checks passed' } };
    const selected = { kind: 'run' as const, id: basis.id };
    assert.equal(selectWorkView({ selection: selected, task: required, run: basis }).validation, 'not-run');
    const failed = { ...basis, validationResults: [{ owner: 'dope', kind: 'test', label: 'required', status: 'failed' }] };
    assert.equal(selectWorkView({ selection: selected, task: required, run: failed }).validation, 'failed');
    const unavailable = { ...basis, validationResults: [{ owner: 'dope', kind: 'test', label: 'required',
        status: 'skipped', reason: 'compiler unavailable' }] };
    assert.equal(selectWorkView({ selection: selected, task: required, run: unavailable }).validation, 'unavailable');
    const passed = { ...basis, validationResults: [{ owner: 'dope', kind: 'test', label: 'required', status: 'passed' }] };
    const passedView = selectWorkView({ selection: selected, task: required, run: passed });
    assert.equal(passedView.validation, 'passed');
    assert.equal(passedView.status, 'Completed with evidence');
    assert.equal(passedView.qualification, 'unknown');
    const stack: any = { ...sequence, taskId: 'task', runIds: ['run'], currentEntryNumber: 1,
        status: 'blocked', blockedReason: 'worktree-drift', checkpoints: [] };
    const drift = selectWorkView({ selection: { kind: 'sequence', id: stack.id }, sequence: stack,
        task: required, run: unavailable, eligible: { 'continue-dirty': true, reconcile: true } });
    assert.equal(drift.status, 'Project changed—review');
    assert.equal(drift.validation, 'unavailable');
    assert.deepEqual(drift.actions, ['continue-dirty', 'reconcile']);
    const dirty = selectWorkView({ selection: { kind: 'sequence', id: stack.id },
        sequence: { ...stack, blockedReason: 'dirty-acceptance-required' }, task: required });
    assert.equal(dirty.status, 'Needs authorization');
    const checkpoint = selectWorkView({ selection: { kind: 'sequence', id: stack.id },
        sequence: { ...stack, blockedReason: 'checkpoint-pending' }, task: required, run: passed,
        eligible: { 'verify-checkpoint': true } });
    assert.equal(checkpoint.status, 'Checkpoint needs verification');
    assert.deepEqual(checkpoint.actions, ['verify-checkpoint']);
    const manual = selectWorkView({ selection: { kind: 'sequence', id: stack.id },
        sequence: { ...stack, status: 'waiting-manual', blockedReason: undefined, currentEntryNumber: 2 },
        eligible: { 'verify-manual-gate': true } });
    assert.equal(manual.status, 'Manual review needed');
    assert.deepEqual(manual.actions, ['verify-manual-gate']);
    assert.equal(manual.qualification, 'unknown');
});

test('Direct Work keeps Finish separate from failed validation and counts only unreverted files', () => {
    const direct: any = { id: 'direct', objective: 'Edit', origin: { kind: 'direct' },
        completion: { requireValidationPass: true, validation: [{ kind: 'test', label: 'required' }] } };
    const failed: any = { id: 'direct-run', taskId: direct.id, executionMode: 'direct', status: 'completed',
        directApplied: [{ path: 'src/a.ts', result: 'applied' }],
        validationResults: [{ owner: 'dope', kind: 'test', label: 'required', status: 'failed' }] };
    assert.equal(selectWorkView({ selection: { kind: 'run', id: failed.id }, task: direct, run: failed }).status, 'Finished');
    assert.match(workRunOverview(failed, direct).state, /1 agent file applied/);
    const reverted = { ...failed, directReverts: [{ path: 'src/a.ts', result: 'reverted' }] };
    assert.match(workRunOverview(reverted, direct).state, /0 agent files applied/);
});

test('held candidate and stale or foreign identities never earn acceptance or completion', () => {
    const candidateTask: any = { id: 'task', projectId: 'project', objective: 'Change file',
        origin: { kind: 'work-item' }, reviewPolicy: { kind: 'required' },
        completion: { requireValidationPass: true, validation: [{ kind: 'test', label: 'required' }] } };
    const candidateRun: any = { id: 'run', taskId: 'task', projectId: 'project', status: 'blocked',
        basis: { head }, candidateFingerprint: 'fingerprint', candidateDelta: { effects: [{ path: 'src/a.ts' }] },
        candidateReview: { state: 'ready', candidateFingerprint: 'fingerprint', changedPaths: ['src/a.ts'],
            validation: [] }, validationResults: [] };
    const selected = { kind: 'run' as const, id: 'run' };
    const held = selectWorkView({ selection: selected, task: candidateTask, run: candidateRun,
        eligible: { 'review-candidate': true, 'accept-candidate': true, 'reject-candidate': true } });
    assert.equal(held.status, 'Candidate ready for review');
    assert.equal(held.promotion, 'held');
    const directHeld = selectWorkView({ selection: selected,
        task: { ...candidateTask, projectId: undefined, origin: { kind: 'direct' } },
        run: { ...candidateRun, projectId: undefined },
        eligible: { 'review-candidate': true, 'reject-candidate': true } });
    assert.equal(directHeld.status, 'Candidate ready for review');
    assert.deepEqual(directHeld.actions, ['review-candidate', 'reject-candidate']);
    assert.deepEqual(held.actions, ['review-candidate', 'reject-candidate']);
    const stale = selectWorkView({ selection: selected, task: candidateTask,
        run: { ...candidateRun, candidateFingerprint: 'other' }, eligible: { 'accept-candidate': true } });
    assert.equal(stale.candidate, 'stale');
    assert.deepEqual(stale.actions, []);
    const foreign = selectWorkView({ selection: selected, task: candidateTask,
        run: { ...candidateRun, projectId: 'foreign' }, eligible: { 'accept-candidate': true } });
    assert.deepEqual(foreign.actions, []);
    assert.equal(foreign.qualification, 'unknown');
    const acceptedWithoutPromotion = selectWorkView({ selection: selected, task: candidateTask,
        run: { ...candidateRun, status: 'completed', reviewDecision: { kind: 'accept' },
            validationResults: [{ owner: 'dope', kind: 'test', label: 'required', status: 'passed',
                candidateFingerprint: 'fingerprint' }] } });
    assert.equal(acceptedWithoutPromotion.candidate, 'accepted');
    assert.equal(acceptedWithoutPromotion.promotion, 'unknown');
    assert.notEqual(acceptedWithoutPromotion.status, 'Completed with evidence');
    const stack: any = { ...sequence, status: 'completed', taskId: 'task', runIds: ['run'],
        checkpoints: [] };
    const incomplete = selectWorkView({ selection: { kind: 'sequence', id: stack.id }, sequence: stack,
        task: candidateTask, run: { ...candidateRun, status: 'completed' } });
    assert.notEqual(incomplete.status, 'Completed with evidence');
});

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
        async readEvents() { return { events: [], nextSequence: 0, hasMore: false }; },
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
        sequence.stack.folderName);
    await controller.select({ kind: 'run', id: run.id });
    assert.equal(controller.selectedRun?.taskId, task.id);
    assert.equal(controller.selectedTask?.id, task.id);
    assert.equal(controller.transcript[0].kind, 'message');
    assert.equal(workTitle({ kind: 'run', id: run.id }, controller.selectedRun, controller.selectedTask),
        'First implementation');
    sequence.currentEntryNumber = 1;
    assert.equal(workTitle({ kind: 'sequence', id: sequence.id }, undefined, undefined, sequence),
        sequence.stack.folderName);
    sequence.currentEntryNumber = 2;
    assert.equal(workTitle({ kind: 'sequence', id: sequence.id }, undefined, undefined, sequence),
        sequence.stack.folderName);
    assert.equal(workTitle({ kind: 'run', id: run.id }, controller.selectedRun, controller.selectedTask),
        'First implementation');
    assert.equal(workTitle({ kind: 'run', id: run.id }, run), 'Work - historic');
    await controller.scan();
    assert.equal(scans, 2);
    assert.equal(opens, 0);
    assert.equal(creates, 0);
});

test('refreshing the selected run keeps its transcript visible until the new snapshot arrives', async () => {
    let reads = 0;
    let release!: (value: any) => void;
    let changes = 0;
    const runtime = {
        async readRun() { return { id: 'live', taskId: 'task', status: 'running' }; },
        async readTask() { return { id: 'task', objective: 'Build', origin: { kind: 'direct' } }; },
        async readWorkSessionForRun() { return undefined; },
        async readSteering() { return undefined; }, async listActions() { return []; },
        async readMapImpact() { return undefined; },
        readTranscript() {
            reads++;
            return reads === 1 ? Promise.resolve({ state: 'recorded',
                entries: [{ kind: 'message', text: 'First' }], nextSequence: 1,
                hasMore: false, incomplete: false }) : new Promise(resolve => { release = resolve; });
        },
        async readEvents() { return { events: [], nextSequence: 0, hasMore: false }; }
    } as unknown as AgentRuntimeService;
    const controller = new WorkSelectionController(runtime, () => { changes++; });
    controller.project = 'file:///project'; controller.handle = 'handle';
    await controller.select({ kind: 'run', id: 'live' });
    const before = changes;
    const pending = controller.select({ kind: 'run', id: 'live' });
    while (reads < 2) await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(controller.selectionState, 'attached');
    assert.equal(controller.transcript[0]?.kind, 'message');
    assert.equal(changes, before);
    release({ state: 'recorded', entries: [{ kind: 'message', text: 'Second' }],
        nextSequence: 1, hasMore: false, incomplete: false });
    await pending;
    assert.equal((controller.transcript[0] as any).text, 'Second');
    assert.equal(changes, before + 1);
});

test('linked Work follow-up reopens the complete saved conversation in segment order', async () => {
    const selected: any = { id: 'second-run', taskId: 'second-task', status: 'running' };
    const session: any = { id: 'first-run', runId: 'first-run', status: 'awaiting-input',
        messages: [{ id: 'follow-up', text: 'Continue', queuedAt: '2026-11-24T00:00:01Z', status: 'delivered' }],
        segments: [{ runId: 'first-run' }, { runId: 'second-run' }] };
    const reads: string[] = [];
    const runtime = { async readRun() { return selected; }, async readTask() { return {
        id: 'second-task', objective: 'Continue', origin: { kind: 'direct' }, completion: { validation: [] } }; },
        async readWorkSessionForRun(_handle: string, runId: string) {
            assert.equal(runId, 'second-run'); return session; },
        async readSteering() { return undefined; }, async listActions() { return []; },
        async readMapImpact() { return undefined; },
        async readTranscript(_handle: string, runId: string) { reads.push(runId); return {
            state: 'recorded', entries: [{ kind: 'message', runId, text: runId }],
            nextSequence: 1, hasMore: false, incomplete: false }; },
        async readEvents() { return { events: [], nextSequence: 0, hasMore: false }; }
    } as unknown as AgentRuntimeService;
    const controller = new WorkSelectionController(runtime, () => {});
    controller.project = 'file:///project'; controller.handle = 'handle';
    await controller.select({ kind: 'run', id: 'second-run' });
    assert.equal(controller.session?.id, 'first-run');
    assert.deepEqual(reads, ['first-run', 'second-run']);
    assert.deepEqual(controller.transcript.map(entry => entry.runId), reads);
    assert.equal(controller.transcriptState, 'recorded');
});

test('linked Work records identify a missing historical segment without inventing turns', async () => {
    const runtime = { async readRun() { return { id: 'new-run', taskId: 'task', status: 'completed' }; },
        async readTask() { return { id: 'task', objective: 'Follow-up', origin: { kind: 'direct' } }; },
        async readWorkSessionForRun() { return { id: 'old-run', segments: [
            { runId: 'old-run' }, { runId: 'new-run' }] }; },
        async readSteering() { return undefined; }, async listActions() { return []; },
        async readMapImpact() { return undefined; },
        async readTranscript(_handle: string, runId: string) { return runId === 'old-run' ?
            { state: 'not-recorded', entries: [], nextSequence: 0, hasMore: false, incomplete: false } :
            { state: 'recorded', entries: [{ kind: 'message', runId, text: 'Actual turn' }],
                nextSequence: 1, hasMore: false, incomplete: false }; },
        async readEvents() { return { events: [], nextSequence: 0, hasMore: false }; }
    } as unknown as AgentRuntimeService;
    const controller = new WorkSelectionController(runtime, () => {});
    controller.project = 'file:///project'; controller.handle = 'handle';
    await controller.select({ kind: 'run', id: 'new-run' });
    assert.deepEqual(controller.transcriptUnavailableSegments, ['old-run']);
    assert.deepEqual(controller.transcript.map(entry => entry.runId), ['new-run']);
});

test('completed local Work follow-up creates a new exact-model task and fresh ceiling-bound grant', async () => {
    const task: any = { version: 1, id: 'task-one', createdAt: '2026-11-24T00:00:00Z',
        objective: 'Original Work', instructions: 'Original instructions', projectRoot: '.',
        modelPolicy: { kind: 'follow-coding-agent' }, controls: {},
        authority: { profile: 'phase-8b-project' }, origin: { kind: 'direct' },
        completion: { validation: [], requireValidationPass: false }, reviewPolicy: { kind: 'required' } };
    const toolSelection: any = { catalogRevision: 1, projectUri: 'file:///project', taskId: task.id,
        grantRevision: 1, connectionId: 'local', modelId: 'model',
        tools: [{ id: 'read_file', schemaRevision: 1 }] };
    const run: any = { id: 'run-one', taskId: task.id, status: 'cancelled',
        reviewDecision: { kind: 'reject' }, basis: { head: 'a'.repeat(40) }, toolSelection };
    const permissions = createDefaultExecutionGrant({ id: 'preview', revision: 1, taskId: task.id,
        acceptedAt: '2026-11-24T00:00:00Z' }).permissions;
    const session: any = { id: run.id, runId: run.id, status: 'completed',
        connectionId: 'local', modelId: 'model', permissionCeiling: permissions,
        segments: [{ runId: run.id }] };
    let created: any;
    let continuation: any[] = [];
    const runtime = { async readWorkSession() { return session; },
        async readRun() { return run; }, async readTask() { return task; },
        async previewWorktree() { return { clean: true, fingerprint: 'f'.repeat(64), paths: [],
            head: 'a'.repeat(40) }; },
        async createTask(_handle: string, next: any) { created = next; return next; },
        async continueWorkSession(...args: any[]) { continuation = args; return { id: 'run-two', taskId: created.id }; },
        async listTasks() { return [task, created]; }, async listRuns() { return [run]; }
    } as unknown as AgentRuntimeService;
    const controller = new WorkSelectionController(runtime, () => {}, async policy => ({
        target: { connectionId: 'local', modelId: policy.kind === 'exact' ? policy.modelId : 'model',
            locality: 'local', label: 'Local' },
        targets: ['model', 'other-model'].map(modelId => ({ connectionId: 'local', modelId,
            locality: 'local' as const, label: modelId })), reason: '' }));
    controller.handle = 'handle'; controller.project = 'file:///project';
    controller.selectedTask = task; controller.selectedRun = run; controller.session = session;
    (controller as any).select = async () => undefined;
    controller.openFollowUp(); controller.followUpInstructions = 'Next bounded turn';
    await Promise.resolve();
    controller.followUpTarget = controller.followUpTargets.find(target => target.modelId === 'other-model');
    controller.followUpToolIds = ['read_file', 'list_files'];
    controller.followUpPermissions = { ...permissions, network: true };
    const result = await controller.continueSession();
    assert.equal(result?.id, 'run-two');
    assert.equal(created.instructions, 'Next bounded turn');
    assert.deepEqual(created.modelPolicy, { kind: 'exact', connectionId: 'local', modelId: 'other-model' });
    assert.equal(continuation[2], session.id);
    assert.equal(continuation[3], run.id);
    assert.equal(continuation[4], created.id);
    assert.equal(continuation[5].taskId, created.id);
    assert.deepEqual(continuation[5].toolSelection.tools.map((tool: any) => tool.id), ['read_file', 'list_files']);
    assert.equal(continuation[5].permissions.network, false, 'the new grant retains the saved ceiling');
    assert.equal(continuation[6], false);
    assert.equal(continuation[7], run.basis.head);
    session.status = 'recovery-required'; run.status = 'interrupted'; run.reviewDecision = undefined;
    controller.session = session; controller.selectedRun = run; controller.selectedTask = task;
    controller.openFollowUp(); controller.followUpInstructions = 'Inspect recovered source';
    await Promise.resolve();
    controller.followUpAccepted = true;
    assert.equal(await controller.continueSession(), undefined, 'uncertain effects need an explicit decision');
    controller.followUpRecoveryDiscardAccepted = true;
    assert.equal((await controller.continueSession())?.id, 'run-two');
    assert.equal(continuation[8], true, 'recovery discards uncertain delivery and candidate effects');
});

test('inline Work review refreshes eligible models without silently substituting a target', async () => {
    const task: any = { id: 'task', objective: 'Inspect', completion: { validation: [] } };
    const run: any = { id: 'run', taskId: task.id, status: 'failed',
        toolSelection: { tools: [{ id: 'read_file' }] } };
    const session: any = { id: 'run', status: 'recovery-required', connectionId: 'local',
        modelId: 'original', permissionCeiling: createDefaultExecutionGrant({ id: 'grant', revision: 1,
            taskId: task.id, acceptedAt: '2026-11-25T00:00:00Z' }).permissions,
        segments: [{ runId: run.id, connectionId: 'local', modelId: 'original' }] };
    let eligible: any[] = [];
    const controller = new WorkSelectionController({} as AgentRuntimeService, () => {}, async () => ({
        target: eligible[0], targets: eligible, reason: 'No eligible Coding Agent target' }));
    controller.selectedTask = task; controller.selectedRun = run; controller.session = session;
    controller.openFollowUp();
    await Promise.resolve();
    assert.equal(controller.followUpTarget, undefined);
    assert.match(controller.followUpTargetReason, /No eligible/);
    eligible = [{ connectionId: 'local', modelId: 'replacement', locality: 'local', label: 'Replacement' }];
    await controller.refreshFollowUpTargets();
    assert.equal(controller.followUpTargets.length, 1);
    assert.equal(controller.followUpTarget, undefined, 'a different model requires explicit selection');
    controller.followUpTarget = eligible[0];
    controller.followUpAccepted = true;
    await controller.refreshFollowUpTargets();
    assert.equal(controller.followUpTarget?.modelId, 'replacement');
    assert.equal(controller.followUpAccepted, false, 'refresh invalidates the earlier model review');
});

test('Work composer retry keeps one message ID after an uncertain response', async () => {
    const calls: Array<{ id: string; text: string }> = [];
    const runtime = { async submitWorkMessage(_handle: string, _sessionId: string, id: string, text: string) {
        calls.push({ id, text });
        if (calls.length === 1) throw new Error('Response lost');
        return {};
    } } as unknown as AgentRuntimeService;
    const controller = new WorkSelectionController(runtime, () => {});
    controller.handle = 'handle'; controller.project = 'file:///project';
    controller.selectedRun = { id: 'run-1', status: 'running' } as any;
    controller.session = { id: 'run-1', status: 'awaiting-input',
        segments: [{ runId: 'run-1' }] } as any;
    (controller as any).select = async () => undefined;
    await controller.submitSessionMessage('Continue');
    assert.match(controller.sessionError, /Response lost/);
    assert.equal(controller.sessionRetryId, calls[0].id);
    await controller.submitSessionMessage('Changed text');
    assert.match(controller.sessionError, /unchanged/);
    assert.equal(calls.length, 1);
    await controller.submitSessionMessage('Continue');
    assert.equal(controller.sessionError, '');
    assert.equal(controller.sessionRetryId, '');
    assert.deepEqual(calls[1], calls[0]);
});

test('switching saved runs hides another session retry and preserves its exact message ID', async () => {
    const calls: Array<{ session: string; id: string; text: string }> = [];
    let rejectFirst!: (error: Error) => void;
    const runtime = { async submitWorkMessage(_handle: string, session: string, id: string, text: string) {
        calls.push({ session, id, text });
        if (calls.length === 1) await new Promise<never>((_resolve, reject) => { rejectFirst = reject; });
        return {};
    } } as unknown as AgentRuntimeService;
    const controller = new WorkSelectionController(runtime, () => {});
    controller.handle = 'handle'; controller.project = 'file:///project';
    controller.selectedRun = { id: 'local-run', status: 'running' } as any;
    controller.session = { id: 'local-session', status: 'awaiting-input', segments: [{ runId: 'local-run' }] } as any;
    (controller as any).select = async () => undefined;
    const first = controller.submitSessionMessage('Continue local work');
    assert.equal(calls.length, 1);
    controller.selectedRun = { id: 'hosted-run', status: 'running' } as any;
    controller.session = undefined;
    rejectFirst(new Error('Response lost'));
    await first;
    assert.equal(controller.sessionError, '');
    assert.equal(controller.sessionRetryText, '');
    controller.selectedRun = { id: 'local-run', status: 'running' } as any;
    controller.session = { id: 'local-session', status: 'awaiting-input', segments: [{ runId: 'local-run' }] } as any;
    assert.equal(controller.sessionRetryText, 'Continue local work');
    assert.equal(controller.sessionRetryId, calls[0].id);
    await controller.submitSessionMessage(controller.sessionRetryText);
    assert.deepEqual(calls[1], calls[0]);
});

test('one-shot WorkItem Stop uses its saved run and has no session controls', async () => {
    const stopped: string[] = [];
    const runtime = { async stop(_handle: string, id: string) { stopped.push(id); return {}; } } as unknown as AgentRuntimeService;
    const controller = new WorkSelectionController(runtime, () => {});
    controller.handle = 'handle'; controller.selectedRun = { id: 'hosted-run', taskId: 'work-item', status: 'running' } as any;
    controller.selectedTask = { id: 'work-item', origin: { kind: 'work-item' } } as any;
    (controller as any).select = async () => undefined;
    await controller.stopOneShot();
    assert.deepEqual(stopped, ['hosted-run']);
    controller.session = { id: 'local-session' } as any;
    await controller.stopOneShot();
    assert.deepEqual(stopped, ['hosted-run']);
});

test('active Work session Stop uses the selected run and keeps saved evidence selectable', async () => {
    const stopped: string[] = [];
    const runtime = { async stop(_handle: string, runId: string) { stopped.push(runId); return {}; } } as unknown as AgentRuntimeService;
    const controller = new WorkSelectionController(runtime, () => {});
    controller.handle = 'handle'; controller.project = 'file:///project';
    controller.selectedRun = { id: 'live-run', status: 'running' } as any;
    controller.session = { id: 'session', status: 'awaiting-input', segments: [{ runId: 'live-run' }] } as any;
    let reopened = 0;
    (controller as any).select = async () => { reopened++; return undefined; };
    await controller.stopSession();
    assert.deepEqual(stopped, ['live-run']);
    assert.equal(reopened, 1);
    assert.equal(controller.sessionBusy, false);
    controller.selectedRun = { id: 'old-run', status: 'completed' } as any;
    await controller.stopSession();
    assert.deepEqual(stopped, ['live-run']);
});

test('selected saved WorkItem task starts once with its exact ID, accepted grant and hosted consent', async () => {
    const saved: any = { id: 'saved-work', createdAt: '2026-10-09T12:00:00Z', objective: 'Implement',
        projectId: 'planning-project', planningMapId: 'map', projectRoot: '.',
        authority: { profile: 'phase-8b-project' }, reviewPolicy: { kind: 'required' },
        origin: { kind: 'work-item', projectId: 'planning-project', planningMapId: 'map' },
        modelPolicy: { kind: 'follow-coding-agent' },
        completion: { validation: [{ kind: 'test', label: 'Required', command: 'npm test' }], requireValidationPass: true } };
    const runs: any[] = [];
    const starts: unknown[][] = [];
    let creates = 0;
    let resolveStart!: (run: any) => void;
    const runtime = { async readTask(_handle: string, id: string) { return id === saved.id ? saved : undefined; },
        async listRuns() { return [...runs]; }, async listTasks() { return [saved]; },
        async previewWorktree() { return { clean: true, paths: [] }; },
        async codingAgentReady() { return true; },
        async createTask() { creates++; },
        async start(...args: unknown[]) { starts.push(args);
            const run = await new Promise<any>(resolve => { resolveStart = resolve; });
            runs.push(run); return run; },
        async readRun(_handle: string, id: string) { return runs.find(run => run.id === id); },
        async readSteering() { return undefined; }, async listActions() { return []; },
        async readMapImpact() { return undefined; },
        async readTranscript() { return { state: 'not-recorded', entries: [], nextSequence: 0,
            hasMore: false, incomplete: false }; } } as unknown as AgentRuntimeService;
    const controller = new WorkSelectionController(runtime, () => {}, async () => ({
        target: { connectionId: 'codex', modelId: 'gpt', label: 'Coding · GPT', locality: 'hosted' }, reason: '' }));
    controller.project = 'file:///project'; controller.handle = 'handle'; controller.phase.codingAgentReady = true;
    await controller.select({ kind: 'task', id: saved.id });
    assert.match(controller.startBlockReason, /Authorize sending/);
    controller.authorizeHostedProjectData(true);
    assert.equal(controller.startBlockReason, '');
    controller.acceptStartGrant(false);
    controller.authorizeHostedProjectData(false);
    assert.equal(controller.acceptedStartGrant, false);
    assert.equal(controller.hostedProjectDataAuthorized, false);
    controller.acceptStartGrant(true);
    assert.match(controller.startBlockReason, /Authorize sending this project data/);
    controller.authorizeHostedProjectData(true);
    assert.equal(controller.startBlockReason, '');
    const starting = controller.startSelectedWorkItemTask();
    for (let attempt = 0; attempt < 20 && starts.length === 0; attempt++) await Promise.resolve();
    assert.equal(controller.startBusy, true);
    await controller.startSelectedWorkItemTask();
    assert.equal(starts.length, 1);
    const run = { id: 'run', taskId: saved.id, projectId: saved.projectId, status: 'running' };
    resolveStart(run);
    assert.equal((await starting)?.id, run.id);
    assert.deepEqual(starts[0]?.slice(0, 3), ['handle', 'file:///project', saved.id]);
    const grant = starts[0]?.[3] as { taskId: string; acceptedBy: string; permissions: Record<string, boolean> };
    assert.equal(grant.taskId, saved.id); assert.equal(grant.acceptedBy, 'developer');
    assert.equal(grant.permissions['project-modify'], true);
    for (const denied of ['network', 'secrets', 'outside-root', 'git-write', 'project-delete', 'project-rename'])
        assert.equal(grant.permissions[denied], false);
    assert.equal(starts[0]?.[4], true); assert.equal(creates, 0);
    assert.equal(controller.selectedRun?.id, run.id);
    assert.equal(controller.selectedTask?.id, saved.id);
    assert.equal(controller.acceptedStartGrant, false);
    await controller.refresh();
    await controller.select({ kind: 'task', id: saved.id });
    controller.acceptStartGrant(true); controller.authorizeHostedProjectData(true);
    assert.match(controller.startBlockReason, /already has a run/);
    await controller.startSelectedWorkItemTask();
    assert.equal(starts.length, 1);
    runs.length = 0;
    saved.completion = { validation: [], requireValidationPass: false };
    await controller.refresh();
    await controller.select({ kind: 'task', id: saved.id });
    controller.acceptStartGrant(true); controller.authorizeHostedProjectData(true);
    assert.match(controller.startBlockReason, /launch a new task with an approved validation command/);
    await controller.startSelectedWorkItemTask();
    assert.equal(starts.length, 1);
});

test('saved WorkItem Local start uses its persisted task ID and separate grant without hosted consent', async () => {
    const saved: any = { id: 'local-work', objective: 'Local edit', projectId: 'project', planningMapId: 'map',
        projectRoot: '.', authority: { profile: 'phase-8b-project' }, reviewPolicy: { kind: 'required' },
        executionMode: 'direct',
        origin: { kind: 'work-item', projectId: 'project', planningMapId: 'map' },
        modelPolicy: { kind: 'exact', connectionId: 'local', modelId: 'qwen' },
        completion: { validation: [{ kind: 'test', label: 'Required', command: 'npm test' }], requireValidationPass: true } };
    const mcpScope = { projectKey: 'a'.repeat(64), serverId: 'godot', registrationRevision: 1,
        catalogRevision: 3, toolName: 'godot_get_server_info', connectionId: 'local', modelId: 'qwen',
        maxCalls: 1 as const, expiresAt: new Date(Date.now() + 600_000).toISOString() };
    let acceptedGrant: any;
    let starts = 0, authorized: boolean | undefined, target = { connectionId: 'local', modelId: 'qwen',
        label: 'LM Studio · Qwen', locality: 'local' as const, context: 4096 };
    const runtime = { async readTask() { return saved; }, async listTasks() { return [saved]; }, async listRuns() { return []; },
        async previewWorktree() { return { clean: true, paths: [] }; },
        async workMCPObservationOffer() { return mcpScope; },
        async codingAgentReady() { return true; }, async start() {
            throw new Error('Local WorkItem must not use one-shot Work');
        }, async startWorkSession(_handle: string, _project: string, taskId: string,
            grant: unknown, hosted: boolean) {
            assert.equal(taskId, saved.id); starts++; authorized = hosted; acceptedGrant = grant;
            return { id: 'local-run', taskId, projectId: saved.projectId, status: 'running' };
        }, async readRun() { return { id: 'local-run', taskId: saved.id, projectId: saved.projectId, status: 'running' }; },
        async readSteering() { return undefined; }, async listActions() { return []; }, async readMapImpact() { return undefined; },
        async readTranscript() { return { state: 'not-recorded', entries: [], nextSequence: 0, hasMore: false, incomplete: false }; }
    } as unknown as AgentRuntimeService;
    const savedChoices = new Map<string, string>();
    const tools = new WorkToolPreferences({ getItem: key => savedChoices.get(key) ?? null,
        setItem: (key, value) => { savedChoices.set(key, value); } });
    tools.saveChoice('file:///project', `task:${saved.id}`, { groups: ['Inspect'],
        allow: ['mcp_godot_server_info'], deny: [] });
    const controller = new WorkSelectionController(runtime, () => {}, async () => ({ target, reason: '' }),
        10000, tools);
    controller.project = 'file:///project'; controller.handle = 'handle'; controller.phase.codingAgentReady = true;
    await controller.select({ kind: 'task', id: saved.id });
    assert.deepEqual(controller.startMCPOffer, mcpScope);
    controller.acceptStartMCPObservation(true);
    assert.equal(controller.acceptedStartGrant, false);
    controller.acceptStartGrant(true);
    assert.equal(controller.startBlockReason, '');
    await controller.startSelectedWorkItemTask();
    assert.equal(starts, 1); assert.equal(authorized, false);
    assert.equal(controller.selectedTask?.executionMode, 'direct');
    assert.deepEqual(acceptedGrant.mcpObservation, mcpScope);
    await controller.select({ kind: 'task', id: saved.id });
    controller.acceptStartMCPObservation(true);
    controller.acceptStartGrant(true);
    target = { ...target, connectionId: 'codex', locality: 'hosted' as any };
    await controller.startSelectedWorkItemTask();
    assert.equal(starts, 1);
    assert.match(controller.message, /selection changed/);
});
