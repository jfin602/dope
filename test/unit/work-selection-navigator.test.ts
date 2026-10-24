import assert from 'node:assert/strict';
import test from 'node:test';
import { SharedPanelState, WorkOpenOwners } from '../../packages/theia-extension/lib/browser/shared-panel-state.js';
import { WorkSelectionController } from '../../packages/theia-extension/lib/browser/work-selection-controller.js';
import { WorkSelectionNavigator } from '../../packages/theia-extension/lib/browser/work-selection-navigator.js';
import type { AgentRuntimeService } from '../../packages/contracts/src/agent-runtime-service.ts';

const project = 'file:///disposable-work';
const stack = (name: string) => ({ folderName: name, mode: 'correction', phase: 11,
    entries: [{ number: 1, title: 'Implement', execution: 'agent-task', promptText: 'Exact prompt' }] });
const sequence = (name: string) => ({ id: `saved-${name}`, stack: stack(name), status: 'ready',
    currentEntryNumber: 1, checkpoints: [], runIds: [], basis: { head: 'a'.repeat(40),
        packageVersion: '0.11.8', worktreeFingerprint: 'b'.repeat(64) } });

function fixture() {
    const saved = new Map<string, ReturnType<typeof sequence>>();
    const calls: string[] = [];
    const effects: string[] = [];
    let denied: 'source-changed' | 'version-mismatch' | undefined;
    let releaseOpen: (() => void) | undefined;
    const runtime = {
        async attach(root: string) { return { projectHandle: root }; },
        async listTaskStacks() { return ['a', 'b', 'invalid'].map(folderName => ({ folderName,
            sequenceId: saved.get(folderName)?.id, valid: folderName !== 'invalid',
            error: folderName === 'invalid' ? 'Invalid prompt' : undefined })); },
        async listSequences() { return [...saved.values()]; },
        async readSequence(_handle: string, id: string) {
            return [...saved.values()].find(item => item.id === id);
        },
        async listTasks() { return []; }, async listRuns() { return []; },
        async sequenceEvidence() { return { head: 'a'.repeat(40), packageVersion: '0.11.8',
            clean: true, worktreeFingerprint: 'b'.repeat(64) }; },
        async codingAgentReady() { return false; },
        async openTaskStack(_handle: string, _root: string, name: string) {
            calls.push(`open:${name}`);
            if (releaseOpen) await new Promise<void>(resolve => { const release = releaseOpen!;
                releaseOpen = () => { releaseOpen = undefined; release(); resolve(); }; });
            if (denied) return { kind: denied };
            const record = saved.get(name) ?? sequence(name);
            saved.set(name, record);
            return { kind: 'opened', sequence: record };
        },
        async startSequence() { effects.push('start'); },
        async acceptSequenceDirtyBasis() { effects.push('dirty'); },
        async checkpointSequence() { effects.push('checkpoint'); },
        async prepareSequenceTask() { effects.push('grant'); }
    } as unknown as AgentRuntimeService;
    const owners = new WorkOpenOwners();
    const views: string[] = [];
    let controller!: WorkSelectionController;
    const panel = new SharedPanelState(owners, 'work-panel', () => {}, () => {
        if (panel.work && controller) views.push(controller.view(panel.work).status);
    });
    controller = new WorkSelectionController(runtime, () => {
        if (panel.work) views.push(controller.view(panel.work).status);
    });
    panel.attach(project);
    const navigator = new WorkSelectionNavigator(panel, controller);
    return { panel, controller, navigator, saved, calls, effects, views, owners,
        deny(value?: 'source-changed' | 'version-mismatch') { denied = value; },
        delayNextOpen() { releaseOpen = () => {}; return () => releaseOpen?.(); } };
}

test('discovery actions reserve persisted IDs for two stacks and History reopens the same owner', async () => {
    const h = fixture(); await h.controller.attach(project);
    const clickA = () => h.navigator.select({ kind: 'sequence', id: 'a' });
    const clickB = () => h.navigator.select({ kind: 'sequence', id: 'b' });
    assert.deepEqual(await clickA(), { kind: 'sequence', id: 'saved-a' });
    assert.equal(h.panel.work?.id, 'saved-a');
    assert.equal(h.controller.phase.selected?.id, 'saved-a');
    assert.deepEqual(await clickB(), { kind: 'sequence', id: 'saved-b' });
    assert.equal(h.panel.work?.id, 'saved-b');
    assert.equal(h.controller.phase.selected?.id, 'saved-b');
    assert.deepEqual(await h.navigator.select({ kind: 'sequence', id: 'saved-a' }, true),
        { kind: 'sequence', id: 'saved-a' });
    await h.controller.phase.scan();
    h.controller.phase.sequences = [];
    assert.deepEqual(await h.navigator.select({ kind: 'sequence', id: 'saved-b' }, true),
        { kind: 'sequence', id: 'saved-b' });
    assert.deepEqual(h.calls, ['open:a', 'open:b']);
    assert.ok(h.views.every(status => status !== 'Work unavailable'));
    assert.deepEqual(h.effects, []);
});

test('rapid opens settle on the latest saved identity without duplicate creation or authority effects', async () => {
    const h = fixture(); await h.controller.attach(project);
    const release = h.delayNextOpen();
    const first = h.navigator.select({ kind: 'sequence', id: 'a' });
    await Promise.resolve();
    assert.deepEqual(h.calls, ['open:a']);
    const second = h.navigator.select({ kind: 'sequence', id: 'b' });
    release();
    await Promise.all([first, second]);
    assert.equal(h.panel.work?.id, 'saved-b');
    assert.equal(h.controller.phase.selected?.id, 'saved-b');
    assert.deepEqual(h.effects, []);
    assert.deepEqual(h.calls, ['open:a', 'open:b']);
    assert.equal(h.saved.size, 2);
});

test('invalid, changed-source, version and foreign IDs leave a truthful recoverable selection', async () => {
    const h = fixture(); await h.controller.attach(project);
    assert.equal(await h.navigator.select({ kind: 'sequence', id: 'invalid' }), undefined);
    assert.match(h.controller.phase.message, /not a valid Phase Stack/);
    for (const [kind, message] of [['source-changed', /changed while opening/],
        ['version-mismatch', /version does not match/]] as const) {
        h.deny(kind);
        assert.equal(await h.navigator.select({ kind: 'sequence', id: 'a' }), undefined);
        assert.match(h.controller.phase.message, message);
        assert.equal(h.panel.work, undefined);
    }
    h.deny();
    assert.equal(await h.navigator.select({ kind: 'sequence', id: 'foreign-id' }, true), undefined);
    assert.match(h.controller.phase.message, /could not be opened/);
    assert.deepEqual(await h.navigator.select({ kind: 'sequence', id: 'a' }),
        { kind: 'sequence', id: 'saved-a' });
    assert.deepEqual(h.effects, []);
});

test('an existing Work owner keeps the canonical saved ID and receives focus on a second open', async () => {
    const h = fixture(); await h.controller.attach(project);
    await h.navigator.select({ kind: 'sequence', id: 'a' });
    h.panel.selectWork(undefined);
    let focused = 0;
    const other = new SharedPanelState(h.owners, 'other-work-panel', () => { focused++; }, () => {});
    other.attach(project);
    assert.equal(other.selectWork({ kind: 'sequence', id: 'saved-a' }), true);
    assert.equal(await h.navigator.select({ kind: 'sequence', id: 'saved-a' }, true), undefined);
    assert.equal(focused, 1);
    assert.equal(h.panel.work, undefined);
    assert.deepEqual(h.effects, []);
    other.dispose();
});
