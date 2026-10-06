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
        async readRun() { return run; }, async importSequence() { imports++; return sequence; },
        async prepareSequenceTask(_h: string, _id: string, _policy: unknown, _completion: unknown, acceptDirty: boolean) {
            assert.equal(acceptDirty, dirty); return { id: 'task' }; },
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
    assert.equal(h.controller.canStart, false); h.controller.acceptedGrant = true;
    assert.equal(h.controller.canStart, true); await h.controller.start(); assert.equal(h.starts, 1);
    await h.controller.stop(); assert.equal(h.stops, 1);
});

test('dirty worktree needs explicit acceptance; ambiguous blocker cannot resume', async () => {
    const h = harness('blocked', 'worktree-drift'); h.setDirty(true); await h.controller.attach('file:///project');
    h.controller.acceptedGrant = true; assert.equal(h.controller.canStart, false);
    h.controller.acceptedDirty = true; assert.equal(h.controller.canStart, true);
    await h.controller.start(); assert.equal(h.starts, 1);
    const ambiguous = harness('blocked', 'checkpoint-mismatch'); await ambiguous.controller.attach('file:///project');
    ambiguous.controller.acceptedGrant = true; assert.equal(ambiguous.controller.canStart, false);
});

test('manual gate only reconciles; checkpoint pending uses backend checkpoint operation', async () => {
    const manual = harness('waiting-manual', undefined, true); await manual.controller.attach('file:///project');
    assert.equal(manual.controller.canStart, false); await manual.controller.reconcile();
    assert.equal(manual.gates, 1); assert.equal(manual.starts, 0);
    const pending = harness('blocked', 'checkpoint-pending'); await pending.controller.attach('file:///project');
    assert.equal(pending.controller.canStart, false); await pending.controller.checkpoint(); assert.equal(pending.checkpoints, 1);
});

test('Phase Stack command, service, safe rendering, labels and Agent Run focus are wired', async () => {
    const base = new URL('../../packages/theia-extension/src/browser/', import.meta.url);
    const [contribution, widget, module, backend, contracts] = await Promise.all([
        'phase-stack-contribution.ts', 'phase-stack-widget.ts', 'frontend-module.ts',
        '../node/agent-runtime-backend.ts', '../../../contracts/src/agent-runtime-service.ts'
    ].map(name => readFile(new URL(name, base), 'utf8')));
    assert.match(contribution, /Dope: Open Phase Stack/); assert.match(module, /PhaseStackContribution/);
    assert.match(module, /widget\.focusRun\(runId\)/);
    for (const label of ['Project-local stack folder', 'Phase Stack entries', 'Accept current dirty worktree',
        'External completion: reconcile gate', 'Checkpoint:', 'Blocked:', 'Validation:', 'Open Agent Run detail'])
        assert.ok(widget.includes(label), label);
    assert.match(widget, /textContent = content/); assert.match(backend, /sequenceEvidence\(/);
    assert.match(contracts, /sequenceEvidence\(/);
    assert.doesNotMatch(widget, /rawPayload|hiddenReasoning|process\.env/);
});
