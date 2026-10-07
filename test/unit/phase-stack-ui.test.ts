import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PhaseStackController } from '../../packages/theia-extension/lib/browser/phase-stack-controller.js';
import type { AgentRuntimeService } from '../../packages/contracts/src/agent-runtime-service.ts';

const sha = 'a'.repeat(40);
function harness(status: string = 'ready', reason?: string, manual = false) {
    let starts = 0, stops = 0, imports = 0, gates = 0, dirty = false, checkpoints = 0;
    let run: any;
    const entry = { number: 1, execution: manual ? 'manual-gate' : 'agent-task', title: 'Work',
        promptText: 'Exact snapshotted prompt', recommendation: { label: 'GPT-6 Sol Medium', reasoning: 'medium' },
        versionPolicy: { kind: 'target', version: '0.8.19' }, browserRequired: manual };
    const sequence: any = { id: 'sequence', status, blockedReason: reason, currentEntryNumber: 1,
        basis: { head: sha, packageVersion: '0.8.18' }, checkpoints: [],
        stack: { folderName: 'p8c', fingerprint: 'b'.repeat(64), mode: 'phase', phase: 8, entries: [entry] } };
    const runtime = { async attach() { return { projectHandle: 'handle' }; },
        async listSequences() { return [sequence]; }, async sequenceEvidence() { return { head: sha,
            packageVersion: '0.8.18', clean: !dirty, worktreeFingerprint: 'c'.repeat(64) }; },
        async readRun() { return run; }, async importSequence() { imports++; return { kind: 'imported', sequence }; },
        async prepareSequenceTask(_h: string, _id: string, _policy: unknown, completion: any,
            dirtyAcceptance?: { worktreeFingerprint: string }) {
            assert.deepEqual(dirtyAcceptance, dirty ? { worktreeFingerprint: 'c'.repeat(64) } : undefined);
            assert.deepEqual(completion, { validation: [{ kind: 'test', label: 'phase-stack', command: './validate.sh' }],
                requireValidationPass: true });
            return { id: 'task' }; },
        async readTask() { return undefined; },
        async startSequence() { starts++; sequence.status = 'running'; run = { id: 'run', status: 'running', validationResults: [] }; return run; },
        async stopSequence() { stops++; sequence.status = 'blocked'; return sequence; },
        async reconcileManualGate() { gates++; return sequence; }, async reconcileSequence() { return sequence; },
        async checkpointSequence() { checkpoints++; sequence.status = 'ready'; return sequence; } };
    const controller = new PhaseStackController(runtime as unknown as AgentRuntimeService, () => {});
    return { controller, sequence, setDirty(value: boolean) { dirty = value; },
        get starts() { return starts; }, get stops() { return stops; }, get imports() { return imports; },
        get gates() { return gates; }, get checkpoints() { return checkpoints; } };
}

test('reopen loads sequence without auto-running; import and explicit grant start use coordinator', async () => {
    const h = harness(); await h.controller.attach('file:///project');
    assert.equal(h.starts, 0); assert.equal(h.controller.selected?.stack.entries[0].promptText, 'Exact snapshotted prompt');
    h.controller.folderName = 'docs/tasks/p8c'; await h.controller.importStack(); assert.equal(h.imports, 1);
    assert.equal(h.controller.pendingDirtyImport, undefined);
    assert.equal(h.controller.canStart, false); h.controller.acceptedGrant = true;
    assert.equal(h.controller.canStart, false); h.controller.validationCommand = './validate.sh';
    assert.equal(h.controller.canStart, true); await h.controller.start(); assert.equal(h.starts, 1);
    await h.controller.stop(); assert.equal(h.stops, 1);
});

test('dirty worktree needs explicit acceptance; ambiguous blocker cannot resume', async () => {
    const h = harness('blocked', 'worktree-drift'); h.setDirty(true); await h.controller.attach('file:///project');
    h.controller.acceptedGrant = true; assert.equal(h.controller.canStart, false);
    h.controller.setDirtyAcceptance(true); h.controller.validationCommand = './validate.sh';
    assert.equal(h.controller.canStart, true);
    await h.controller.start(); assert.equal(h.starts, 1);
    const ambiguous = harness('blocked', 'checkpoint-mismatch'); await ambiguous.controller.attach('file:///project');
    ambiguous.controller.acceptedGrant = true; assert.equal(ambiguous.controller.canStart, false);
});

test('dirty import acceptance enables Resume only after grant and validation, and stale evidence revokes it', async () => {
    const h = harness('blocked', 'dirty-acceptance-required'); h.setDirty(true);
    await h.controller.attach('file:///project');
    assert.equal(h.controller.needsDirtyAcceptance, true);
    assert.equal(h.controller.readinessMessage,
        "Worktree is dirty: accept it as this task's starting basis to continue.");
    h.controller.setDirtyAcceptance(true);
    assert.equal(h.controller.canStart, false);
    assert.equal(h.controller.readinessMessage, 'Accept the project execution grant to continue.');
    h.controller.acceptedGrant = true;
    assert.equal(h.controller.readinessMessage, 'Enter a required validation command to continue.');
    h.controller.validationCommand = './validate.sh';
    assert.equal(h.controller.canStart, true);
    await h.controller.start();
    assert.equal(h.starts, 1);

    const changed = harness('blocked', 'dirty-acceptance-required'); changed.setDirty(true);
    await changed.controller.attach('file:///project');
    changed.controller.setDirtyAcceptance(true);
    changed.controller.acceptedGrant = true; changed.controller.validationCommand = './validate.sh';
    changed.controller.evidence = { ...changed.controller.evidence!, worktreeFingerprint: 'd'.repeat(64) };
    assert.equal(changed.controller.canStart, false);
});

test('dirty acceptance does not bypass unrelated blockers', async () => {
    for (const reason of ['source-drift', 'head-drift', 'version-mismatch', 'git-history',
        'checkpoint-mismatch', 'checkpoint-failed', 'interrupted']) {
        const h = harness('blocked', reason); h.setDirty(true); await h.controller.attach('file:///project');
        assert.equal(h.controller.needsDirtyAcceptance, false, reason);
        h.controller.setDirtyAcceptance(true);
        h.controller.acceptedGrant = true; h.controller.validationCommand = './validate.sh';
        assert.equal(h.controller.canStart, false, reason);
    }
});

test('retry with an already accepted dirty basis still requires a fresh execution grant', async () => {
    const h = harness('blocked', 'run-failed'); h.setDirty(true);
    h.sequence.acceptedDirty = { head: sha, paths: [{ path: 'existing.txt', code: ' M',
        hash: 'b'.repeat(64), size: 1, mode: 0o644 }] };
    await h.controller.attach('file:///project');
    assert.equal(h.controller.needsDirtyAcceptance, false);
    h.controller.validationCommand = './validate.sh';
    assert.equal(h.controller.canStart, false);
    h.controller.acceptedGrant = true;
    assert.equal(h.controller.canStart, true);
});

test('manual gate only reconciles; checkpoint pending uses backend checkpoint operation', async () => {
    const manual = harness('waiting-manual', undefined, true); await manual.controller.attach('file:///project');
    assert.equal(manual.controller.canStart, false); await manual.controller.reconcile();
    assert.equal(manual.gates, 1); assert.equal(manual.starts, 0);
    const pending = harness('blocked', 'checkpoint-pending'); await pending.controller.attach('file:///project');
    assert.equal(pending.controller.canStart, false); await pending.controller.checkpoint(); assert.equal(pending.checkpoints, 1);
});

test('dirty import confirmation keeps path, cancels, retries exact folder, and clears on edit', async () => {
    const calls: { folder: string; allow: boolean }[] = [];
    const sequence: any = { id: 'imported', status: 'blocked', blockedReason: 'dirty-acceptance-required',
        currentEntryNumber: 1, basis: { head: sha, packageVersion: '0.8.18', clean: false },
        checkpoints: [], stack: { folderName: 'p8c', entries: [] } };
    let imported = false;
    const runtime = { async attach() { return { projectHandle: 'handle' }; },
        async listSequences() { return imported ? [sequence] : []; },
        async sequenceEvidence() { return { head: sha, packageVersion: '0.8.18', clean: false,
            worktreeFingerprint: 'b'.repeat(64) }; },
        async importSequence(_handle: string, folder: string, options: { allowDirtyImport: boolean }) {
            calls.push({ folder, allow: options.allowDirtyImport });
            if (!options.allowDirtyImport) return { kind: 'dirty-confirmation-required' };
            imported = true; return { kind: 'imported', sequence };
        } };
    const controller = new PhaseStackController(runtime as unknown as AgentRuntimeService, () => {});
    await controller.attach('file:///project');
    controller.setFolderName('docs/tasks/p8c'); await controller.importStack();
    assert.deepEqual(controller.pendingDirtyImport, { folderName: 'p8c', input: 'docs/tasks/p8c' });
    assert.equal(controller.folderName, 'docs/tasks/p8c');
    assert.doesNotMatch(controller.message, /operation failed/);
    controller.cancelDirtyImport(); assert.equal(controller.pendingDirtyImport, undefined);
    assert.equal(imported, false); assert.equal(controller.folderName, 'docs/tasks/p8c');
    await controller.importStack(); controller.setFolderName('docs/tasks/p8d');
    assert.equal(controller.pendingDirtyImport, undefined);
    controller.setFolderName('docs/tasks/p8c'); await controller.importStack();
    await controller.continueDirtyImport();
    assert.deepEqual(calls, [{ folder: 'p8c', allow: false }, { folder: 'p8c', allow: false },
        { folder: 'p8c', allow: false }, { folder: 'p8c', allow: true }]);
    assert.equal(controller.pendingDirtyImport, undefined);
    assert.equal(controller.selected?.id, 'imported');
    assert.equal(controller.folderName, 'docs/tasks/p8c');
});

test('Phase Stack command, service, safe rendering, labels and Agent Run focus are wired', async () => {
    const base = new URL('../../packages/theia-extension/src/browser/', import.meta.url);
    const [contribution, widget, module, backend, contracts] = await Promise.all([
        'phase-stack-contribution.ts', 'phase-stack-widget.ts', 'frontend-module.ts',
        '../node/agent-runtime-backend.ts', '../../../contracts/src/agent-runtime-service.ts'
    ].map(name => readFile(new URL(name, base), 'utf8')));
    assert.match(contribution, /Dope: Open Phase Stack/); assert.match(module, /PhaseStackContribution/);
    assert.match(module, /widget\.focusRun\(runId\)/);
    for (const label of ['Project-local stack folder', 'Phase Stack entries', 'Required validation command', 'Accept current dirty worktree',
        'Worktree is dirty: continue?', 'Continue', 'Cancel',
        'External completion: reconcile gate', 'Checkpoint:', 'Blocked:', 'Validation:', 'Open Agent Run detail'])
        assert.ok(widget.includes(label), label);
    assert.match(widget, /textContent = content/); assert.match(backend, /sequenceEvidence\(/);
    assert.match(widget, /c\.needsDirtyAcceptance/);
    assert.match(widget, /c\.setDirtyAcceptance\(check\.checked\)/);
    assert.match(contracts, /sequenceEvidence\(/);
    assert.doesNotMatch(widget, /rawPayload|hiddenReasoning|process\.env/);
});
