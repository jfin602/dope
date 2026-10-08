import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PhaseStackController } from '../../packages/theia-extension/lib/browser/phase-stack-controller.js';
import type { AgentRuntimeService } from '../../packages/contracts/src/agent-runtime-service.ts';

const sha = 'a'.repeat(40);
function harness(status: string = 'ready', reason?: string, manual = false) {
    let starts = 0, opens = 0, scans = 0, accepts = 0, gates = 0, checkpoints = 0;
    let dirty = false, agentReady = true, fingerprint = 'c'.repeat(64);
    const entry = { number: 1, execution: manual ? 'manual-gate' : 'agent-task', title: 'Work',
        promptText: 'Exact snapshotted prompt', recommendation: { label: 'GPT-6 Sol Medium', reasoning: 'medium' },
        versionPolicy: { kind: 'target', version: '0.8.19' }, browserRequired: manual };
    const sequence: any = { id: 'sequence', status, blockedReason: reason, currentEntryNumber: 1,
        basis: { head: sha, packageVersion: '0.8.18' }, checkpoints: [],
        stack: { folderName: 'c4-dope-phase-stack-smoke', fingerprint: 'b'.repeat(64),
            mode: 'correction', phase: 4, entries: [entry] } };
    const runtime = { async attach() { return { projectHandle: 'handle' }; },
        async listTaskStacks(_h: string, root: string) {
            scans++; assert.equal(root, 'docs/tasks/');
            return [{ folderName: sequence.stack.folderName, path: 'docs/tasks/c4-dope-phase-stack-smoke',
                mode: 'correction', phase: 4, valid: true, sequenceId: sequence.id, sequenceStatus: sequence.status }];
        },
        async openTaskStack(_h: string, _root: string, folder: string) {
            assert.equal(folder, sequence.stack.folderName); opens++; return { kind: 'opened', sequence };
        },
        async listSequences() { return [sequence]; },
        async sequenceEvidence() { return { head: sha, packageVersion: '0.8.18', clean: !dirty,
            worktreeFingerprint: fingerprint }; },
        async codingAgentReady() { return agentReady; },
        async acceptSequenceDirtyBasis(_h: string, _id: string, accepted: string) {
            if (accepted !== fingerprint) throw new Error('Dirty worktree changed since acceptance');
            accepts++; sequence.status = 'ready'; sequence.blockedReason = undefined;
            sequence.acceptedDirty = { head: sha, paths: [{ path: 'existing.txt', code: ' M',
                hash: 'b'.repeat(64), size: 1, mode: 0o644 }] }; return sequence;
        },
        async readRun() { return undefined; }, async readTask() { return undefined; },
        async prepareSequenceTask(_h: string, _id: string, _policy: unknown, completion: any,
            dirtyAcceptance?: { worktreeFingerprint: string }) {
            assert.equal(dirtyAcceptance, undefined);
            assert.deepEqual(completion, { validation: [{ kind: 'test', label: 'phase-stack', command: './validate.sh' }],
                requireValidationPass: true }); return { id: 'task' };
        },
        async startSequence() { starts++; sequence.status = 'running';
            return { id: 'run', status: 'running', validationResults: [] }; },
        async stopSequence() { sequence.status = 'blocked'; return sequence; },
        async reconcileManualGate() { gates++; return sequence; }, async reconcileSequence() { return sequence; },
        async checkpointSequence() { checkpoints++; sequence.status = 'ready'; return sequence; } };
    const controller = new PhaseStackController(runtime as unknown as AgentRuntimeService, () => {});
    return { controller, sequence, setDirty(value: boolean) { dirty = value; },
        setAgentReady(value: boolean) { agentReady = value; },
        changeFingerprint(value: string) { fingerprint = value; },
        get starts() { return starts; }, get opens() { return opens; }, get scans() { return scans; },
        get accepts() { return accepts; }, get gates() { return gates; }, get checkpoints() { return checkpoints; } };
}

test('Start stays disabled without an eligible Coding Agent and recovers when one is ready', async () => {
    const h = harness(); h.setAgentReady(false);
    await h.controller.attach('file:///project'); await h.controller.select('c4-dope-phase-stack-smoke');
    h.controller.acceptedGrant = true; h.controller.validationCommand = './validate.sh';
    assert.equal(h.controller.canStart, false);
    assert.match(h.controller.readinessMessage, /eligible Coding Agent/);
    await h.controller.start(); assert.equal(h.starts, 0);
    h.setAgentReady(true); await h.controller.refresh();
    assert.equal(h.controller.canStart, true);
});

test('default tasks folder scans on attach; selecting an existing stack opens details without running', async () => {
    const h = harness(); await h.controller.attach('file:///project');
    assert.equal(h.controller.tasksRoot, 'docs/tasks/'); assert.equal(h.scans, 1);
    assert.equal(h.controller.stacks[0].folderName, 'c4-dope-phase-stack-smoke');
    assert.equal(h.controller.selected, undefined); assert.equal(h.starts, 0);
    await h.controller.select('c4-dope-phase-stack-smoke');
    assert.equal(h.controller.selected?.stack.entries[0].promptText, 'Exact snapshotted prompt');
    await h.controller.select('c4-dope-phase-stack-smoke'); assert.equal(h.opens, 2);
    h.controller.acceptedGrant = true; h.controller.validationCommand = './validate.sh';
    assert.equal(h.controller.canStart, true); await h.controller.start(); assert.equal(h.starts, 1);
});

test('one dirty Continue captures basis; Cancel starts nothing; grant and validation remain required', async () => {
    const h = harness('blocked', 'dirty-acceptance-required'); h.setDirty(true);
    await h.controller.attach('file:///project'); await h.controller.select('c4-dope-phase-stack-smoke');
    assert.equal(h.controller.needsDirtyAcceptance, true);
    h.controller.cancelDirty(); assert.equal(h.controller.dirtyPromptDismissed, true);
    assert.equal(h.starts, 0); assert.equal(h.accepts, 0);
    await h.controller.select('c4-dope-phase-stack-smoke'); await h.controller.continueDirty();
    assert.equal(h.accepts, 1); assert.equal(h.controller.needsDirtyAcceptance, false);
    assert.equal(h.controller.canStart, false);
    h.controller.acceptedGrant = true; h.controller.validationCommand = './validate.sh';
    assert.equal(h.controller.canStart, true); await h.controller.start(); assert.equal(h.starts, 1);
});

test('changed dirty basis blocks execution and asks for renewed acceptance', async () => {
    const h = harness('blocked', 'dirty-acceptance-required'); h.setDirty(true);
    await h.controller.attach('file:///project'); await h.controller.select('c4-dope-phase-stack-smoke');
    h.controller.evidence = { ...h.controller.evidence!, worktreeFingerprint: 'd'.repeat(64) };
    await h.controller.continueDirty(); assert.equal(h.accepts, 0);
    assert.match(h.controller.message, /changed after acceptance/);
    h.sequence.blockedReason = 'worktree-drift'; h.changeFingerprint('d'.repeat(64));
    await h.controller.refresh(); assert.equal(h.controller.needsDirtyAcceptance, true);
    assert.equal(h.controller.canStart, false);
});

test('manual gate only reconciles and pending checkpoint uses backend operation', async () => {
    const manual = harness('waiting-manual', undefined, true);
    await manual.controller.attach('file:///project'); await manual.controller.select('c4-dope-phase-stack-smoke');
    assert.equal(manual.controller.canStart, false); await manual.controller.reconcile();
    assert.equal(manual.gates, 1); assert.equal(manual.starts, 0);
    const pending = harness('blocked', 'checkpoint-pending');
    await pending.controller.attach('file:///project'); await pending.controller.select('c4-dope-phase-stack-smoke');
    await pending.controller.checkpoint(); assert.equal(pending.checkpoints, 1);
});

test('Phase Stack view has discovery controls and no import UI', async () => {
    const base = new URL('../../packages/theia-extension/src/browser/', import.meta.url);
    const [widget, backend, contracts] = await Promise.all([
        'phase-stack-widget.ts', '../node/agent-runtime-backend.ts',
        '../../../contracts/src/agent-runtime-service.ts'].map(name => readFile(new URL(name, base), 'utf8')));
    for (const label of ['Tasks folder', 'Available task stacks', 'Phase Stack entries',
        'Required validation command', 'Worktree is dirty: continue?', 'Continue', 'Cancel',
        'External completion: reconcile gate', 'Checkpoint:', 'Open Agent Run detail'])
        assert.ok(widget.includes(label), label);
    assert.doesNotMatch(widget, /Import Stack|Imported stacks|Project-local stack folder|Accept current dirty worktree/);
    assert.match(widget, /textContent = content/);
    assert.match(backend, /listTaskStacks\(/); assert.match(backend, /openTaskStack\(/);
    assert.match(contracts, /acceptSequenceDirtyBasis\(/);
});
