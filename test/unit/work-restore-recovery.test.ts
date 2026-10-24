import assert from 'node:assert/strict';
import test from 'node:test';
import { SharedPanelState, WorkOpenOwners } from '../../packages/theia-extension/lib/browser/shared-panel-state.js';
import { WorkSelectionController } from '../../packages/theia-extension/lib/browser/work-selection-controller.js';
import { WorkSelectionNavigator } from '../../packages/theia-extension/lib/browser/work-selection-navigator.js';
import type { AgentRuntimeService } from '../../packages/contracts/src/agent-runtime-service.ts';

const project = 'file:///restored-project';
const otherProject = 'file:///other-project';
const runSelection = { kind: 'run' as const, id: 'saved-run' };
const sequenceSelection = { kind: 'sequence' as const, id: 'saved-sequence' };
const savedTask = { id: 'saved-task', projectId: project, objective: 'Read only Work',
    origin: { kind: 'direct' }, completion: { validation: [] } };
const savedRun = { id: 'saved-run', projectId: project, taskId: savedTask.id,
    status: 'completed', validationResults: [] };
const savedSequence = { id: 'saved-sequence', taskId: savedTask.id, status: 'completed',
    stack: { folderName: 'c11-saved', entries: [] }, currentEntryNumber: 1,
    runIds: [], checkpoints: [] };

function fixture() {
    const effects: string[] = [];
    let attachFailure = false;
    let releaseAttach: (() => void) | undefined;
    let releaseTranscript: (() => void) | undefined;
    const runtime = {
        async attach(root: string) {
            if (releaseAttach) await new Promise<void>(resolve => {
                const release = releaseAttach!; releaseAttach = () => { releaseAttach = undefined; release(); resolve(); };
            });
            if (attachFailure) throw new Error('backend unavailable');
            return { projectHandle: root };
        },
        async listTaskStacks() { return []; },
        async listSequences() { return [savedSequence]; },
        async sequenceEvidence() { return { head: 'a'.repeat(40), packageVersion: '0.11.8', clean: true }; },
        async codingAgentReady() { return false; },
        async readSequence(_handle: string, id: string) { return id === savedSequence.id ? savedSequence : undefined; },
        async listTasks() { return [savedTask]; },
        async listRuns() { return [savedRun]; },
        async readTask(_handle: string, id: string) { return id === savedTask.id ? savedTask : undefined; },
        async readRun(_handle: string, id: string) { return id === savedRun.id ? savedRun : undefined; },
        async readSteering() { return undefined; },
        async listActions() { return []; },
        async readMapImpact() { return undefined; },
        async readTranscript() {
            if (releaseTranscript) await new Promise<void>(resolve => {
                const release = releaseTranscript!;
                releaseTranscript = () => { releaseTranscript = undefined; release(); resolve(); };
            });
            return { state: 'recorded', incomplete: false, entries: [{ sequence: 1, text: 'Saved transcript' }],
                hasMore: false, nextSequence: 1 };
        },
        async startSequence() { effects.push('start'); },
        async prepareSequenceTask() { effects.push('grant'); },
        async acceptSequenceDirtyBasis() { effects.push('dirty'); },
        async decideCandidate() { effects.push('candidate'); }
    } as unknown as AgentRuntimeService;
    const owners = new WorkOpenOwners();
    const controller = new WorkSelectionController(runtime, () => {}, undefined, 20);
    return { controller, owners, effects,
        failAttach(value: boolean) { attachFailure = value; },
        delayAttach() { releaseAttach = () => {}; return () => releaseAttach?.(); },
        delayTranscript() { releaseTranscript = () => {}; return () => releaseTranscript?.(); } };
}

test('restored saved run and sequence retain exact owner and read-only transcript after reattach', async () => {
    const h = fixture();
    const first = new SharedPanelState(h.owners, 'work-a', () => {}, () => {});
    first.restore({ version: 2, workspace: project, panelMode: 'work', work: runSelection });
    first.attach(project);
    await h.controller.attach(project);
    assert.deepEqual(await h.controller.select(first.work, true), runSelection);
    assert.equal(h.controller.attachState, 'attached');
    assert.equal(h.controller.selectionState, 'attached');
    assert.equal(h.controller.transcript.length, 1);
    let focused = 0;
    const history = new SharedPanelState(h.owners, 'history-work', () => { focused++; }, () => {});
    history.attach(project);
    assert.equal(history.selectWork(runSelection), false);
    assert.equal(h.owners.focus(project, runSelection), true);
    assert.equal(focused, 0);
    assert.deepEqual(first.work, runSelection);
    first.selectWork(undefined);
    assert.equal(history.selectWork(runSelection), true);
    history.dispose();
    const stack = new SharedPanelState(h.owners, 'work-stack', () => {}, () => {});
    stack.restore({ version: 2, workspace: project, panelMode: 'work', work: sequenceSelection });
    stack.attach(project);
    assert.deepEqual(await h.controller.select(stack.work, true), sequenceSelection);
    assert.equal(h.controller.phase.selected?.id, savedSequence.id);
    assert.deepEqual(h.effects, []);
    stack.dispose(); first.dispose();
});

test('failed and timed-out attach become unavailable, Retry recovers, Select Work releases ownership', async () => {
    const h = fixture();
    const panel = new SharedPanelState(h.owners, 'work-a', () => {}, () => {});
    panel.restore({ version: 2, workspace: project, panelMode: 'work', work: runSelection });
    panel.attach(project);
    h.failAttach(true);
    await h.controller.attach(project);
    assert.equal(h.controller.attachState, 'unavailable');
    assert.match(h.controller.message, /could not attach/);
    h.failAttach(false);
    const release = h.delayAttach();
    await h.controller.attach(project);
    assert.equal(h.controller.attachState, 'unavailable');
    assert.match(h.controller.message, /did not respond/);
    release(); await Promise.resolve();
    assert.equal(h.controller.handle, undefined);
    await h.controller.attach(project);
    assert.equal(h.controller.attachState, 'attached');
    assert.deepEqual(await h.controller.select(panel.work, true), runSelection);
    panel.selectWork(undefined);
    assert.equal(h.owners.focus(project, runSelection), false);
    assert.equal(h.controller.selectionState, 'attached');
    await h.controller.select(undefined);
    assert.equal(h.controller.selectionState, 'idle');
    assert.deepEqual(h.effects, []);
    panel.dispose();
});

test('Back during a pending attach does not strand Select Work in loading', async () => {
    const h = fixture();
    const panel = new SharedPanelState(h.owners, 'work-a', () => {}, () => {});
    panel.restore({ version: 2, workspace: project, panelMode: 'work', work: runSelection });
    panel.attach(project);
    const release = h.delayAttach();
    const attaching = h.controller.attach(project);
    const navigator = new WorkSelectionNavigator(panel, h.controller);
    await navigator.select(undefined);
    assert.equal(panel.work, undefined);
    assert.equal(h.controller.attachState, 'loading');
    release(); await attaching;
    assert.equal(h.controller.attachState, 'attached');
    assert.deepEqual(h.effects, []);
    panel.dispose();
});

test('late saved transcript is discarded when the workspace changes; missing Work stays distinct', async () => {
    const h = fixture();
    await h.controller.attach(project);
    const release = h.delayTranscript();
    const opening = h.controller.select(runSelection, true);
    await new Promise(resolve => setTimeout(resolve, 0));
    await h.controller.attach(otherProject);
    release(); await opening;
    assert.equal(h.controller.project, otherProject);
    assert.equal(h.controller.selectedRun, undefined);
    assert.deepEqual(h.controller.transcript, []);
    assert.equal(await h.controller.select({ kind: 'run', id: 'missing' }, true), undefined);
    assert.equal(h.controller.selectionState, 'not-found');
    assert.deepEqual(h.effects, []);
});

test('Back and a new History selection work while an old detail read is unresolved', async () => {
    const h = fixture();
    const panel = new SharedPanelState(h.owners, 'work-a', () => {}, () => {});
    panel.attach(project);
    await h.controller.attach(project);
    const navigator = new WorkSelectionNavigator(panel, h.controller);
    const release = h.delayTranscript();
    const opening = navigator.select(runSelection, true);
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(h.controller.selectionState, 'loading');
    await navigator.select(undefined);
    assert.equal(panel.work, undefined);
    assert.equal(h.controller.selectionState, 'idle');
    assert.deepEqual(await navigator.select(sequenceSelection, true), sequenceSelection);
    assert.equal(panel.work?.id, savedSequence.id);
    release(); await opening;
    assert.equal(panel.work?.id, savedSequence.id);
    assert.equal(h.controller.phase.selected?.id, savedSequence.id);
    assert.deepEqual(h.effects, []);
    panel.dispose();
});

test('refreshing the exact saved owner keeps History from opening a duplicate', async () => {
    const h = fixture();
    const panel = new SharedPanelState(h.owners, 'work-a', () => {}, () => {});
    panel.attach(project);
    await h.controller.attach(project);
    const navigator = new WorkSelectionNavigator(panel, h.controller);
    assert.deepEqual(await navigator.select(runSelection, true), runSelection);
    const release = h.delayTranscript();
    const reread = navigator.select(runSelection, true);
    await new Promise(resolve => setTimeout(resolve, 0));
    const history = new SharedPanelState(h.owners, 'history-work', () => {}, () => {});
    history.attach(project);
    assert.equal(history.selectWork(runSelection), false);
    release(); await reread;
    assert.deepEqual(panel.work, runSelection);
    assert.equal(history.work, undefined);
    assert.deepEqual(h.effects, []);
    history.dispose(); panel.dispose();
});
