import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { AgentRunController } from '../../packages/theia-extension/lib/browser/agent-run-controller.js';
import type { AgentRun } from '../../packages/agent-core/src/contracts.ts';
import type { AgentRuntimeService } from '../../packages/contracts/src/agent-runtime-service.ts';
import type { AIRegistryService } from '../../packages/contracts/src/ai-registry-service.ts';
import type { AIRolePolicyService } from '../../packages/contracts/src/ai-role-policy-service.ts';

function harness() {
    const now = new Date().toISOString();
    const model = { version: 1, connectionId: 'codex', providerModelKey: 'gpt', label: 'GPT', locality: 'hosted',
        enabled: true, state: 'ready', capabilities: { conversationalText: { value: true, source: 'adapter-known' },
            streaming: { value: true, source: 'adapter-known' }, structuredOutput: { source: 'unknown' },
            toolCalling: { source: 'unknown' }, agentExecution: { value: true, source: 'adapter-known' } },
        limits: { contextWindowTokens: { value: 10000, source: 'adapter-known' },
            maxInputTokens: { source: 'unknown' }, maxOutputTokens: { source: 'unknown' } } };
    const registry = { version: 1, revision: 1, connections: [{ version: 1, id: 'codex', alias: 'Coding',
        lifecycle: 'enabled', config: { type: 'codex', runtime: 'app-server' },
        codexAccount: { accountId: 'account', status: 'signed-in', planUsage: 'available' } }], models: [model] };
    const inventory = { registry, observations: [{ connectionId: 'codex', health: 'ready' }], tests: [] };
    const policy = { version: 1, revision: 1, policies: ['interactive', 'deep-reasoning', 'background', 'software-map', 'coding-agent'].map(roleId => ({ roleId,
        ...(roleId === 'coding-agent' ? { preferred: { type: 'exact', target: { connectionId: 'codex', modelId: 'gpt' } } } : {}),
        fallbacks: [], hard: { requiredCapabilities: [], locality: 'any', enabledOnly: true, usableOnly: true,
            hostedProjectData: 'requires-feature-authorization' }, preferences: [], allowFallback: false })) };
    let run: AgentRun | undefined; let task: unknown; let grant: unknown; let authorized: unknown; let stopped = false;
    let gate: any; let reconciliations = 0;
    const runtime = { async attach() { return { projectHandle: 'handle' }; },
        async listRuns() { return run ? [run] : []; }, async listSequences() { return gate ? [gate] : []; },
        async reconcileManualGate() { reconciliations++; return gate; }, async readRun() { return run; },
        async readTask() { return task; }, async createTask(_handle: string, value: unknown) { task = value; return value; },
        async start(_handle: string, _uri: string, taskId: string, accepted: unknown, hosted: boolean) {
            grant = accepted; authorized = hosted;
            run = { version: 1, id: 'run', taskId, status: 'running', grantId: 'grant', grantRevision: 1,
                requestedPolicy: { kind: 'follow-coding-agent' }, projectRoot: '.', createdAt: now,
                changedFiles: [], validationResults: [] }; return run;
        }, async stop() { stopped = true; run = { ...run!, status: 'cancelling' }; return run; },
        async readEvents() { return { events: [], nextSequence: 0, hasMore: false }; } };
    const controller = new AgentRunController(runtime as unknown as AgentRuntimeService,
        { inventory: async () => inventory } as unknown as AIRegistryService,
        { list: async () => policy } as unknown as AIRolePolicyService, () => {});
    return { controller, runtime, get task() { return task; }, get grant() { return grant; },
        get authorized() { return authorized; }, get stopped() { return stopped; },
        get reconciliations() { return reconciliations; }, setGate(value: unknown) { gate = value; },
        finish(status: AgentRun['status']) { run = { ...run!, status, changedFiles: ['src/a.ts'],
            validationResults: [{ version: 1, kind: 'test', label: 'unit', status: 'passed' }],
            changeSummary: { version: 1, filesChanged: 1, insertions: 2, deletions: 1, summary: 'Updated source', truncated: false } }; } };
}

test('direct task displays eligible target and requires explicit grant before starting; Stop requests backend cancellation', async () => {
    const h = harness(); await h.controller.attach('file:///project');
    assert.match(h.controller.targetMessage, /Coding · GPT/);
    assert.equal(h.controller.exactTargets.length, 1);
    h.controller.setPolicy({ kind: 'exact', connectionId: 'codex', modelId: 'gpt' });
    await h.controller.resolveTarget(); assert.match(h.controller.targetMessage, /Coding · GPT/);
    h.controller.setPolicy({ kind: 'follow-coding-agent' }); await h.controller.resolveTarget();
    h.controller.edit('Objective', 'Instructions'); assert.equal(h.controller.canStart, false);
    h.controller.acceptGrant(true); assert.equal(h.controller.canStart, true);
    await h.controller.start(); assert.equal((h.task as { origin: { kind: string } }).origin.kind, 'direct');
    assert.equal((h.task as { modelPolicy: { kind: string } }).modelPolicy.kind, 'follow-coding-agent');
    assert.equal((h.grant as { permissions: { network: boolean; 'project-modify': boolean } }).permissions.network, false);
    assert.equal((h.grant as { permissions: { network: boolean; 'project-modify': boolean } }).permissions['project-modify'], true);
    assert.equal(h.authorized, true); assert.equal(h.controller.selected?.status, 'running');
    await h.controller.stop(); assert.equal(h.stopped, true); assert.equal(h.controller.selected?.status, 'cancelling');
});

test('direct task keeps validation bounded and requires a fresh grant after edits', async () => {
    const h = harness(); await h.controller.attach('file:///project');
    h.controller.edit('One task', 'Implement and verify');
    h.controller.acceptGrant(true);
    h.controller.setValidation('npm test');
    assert.equal(h.controller.canStart, false);
    h.controller.acceptGrant(true); await h.controller.start();
    assert.deepEqual((h.task as { completion: unknown }).completion, { validation: [
        { kind: 'test', label: 'Required validation', command: 'npm test' }], requireValidationPass: true });
});

test('Resume requests backend gate reconciliation and restart keeps the same pending prompt', async () => {
    const h = harness();
    const gate = { id: 'sequence', status: 'waiting-manual', currentEntryNumber: 1,
        stack: { entries: [{ number: 1, execution: 'manual-gate', promptText: 'Exact prompt' }] },
        basis: { head: 'a'.repeat(40), packageVersion: '0.8.0' } };
    h.setGate(gate);
    await h.controller.attach('file:///project');
    assert.equal(h.controller.sequences[0].stack.entries[0].promptText, 'Exact prompt');
    await h.controller.resumeManualGate('sequence');
    assert.equal(h.reconciliations, 1);
    assert.equal(h.controller.sequences[0].status, 'waiting-manual');
    const reopened = new AgentRunController(h.runtime as unknown as AgentRuntimeService,
        { inventory: async () => { throw new Error('offline'); } } as unknown as AIRegistryService,
        { list: async () => { throw new Error('offline'); } } as unknown as AIRolePolicyService, () => {});
    await reopened.attach('file:///project');
    assert.equal(reopened.sequences[0].id, 'sequence');
    assert.equal(reopened.sequences[0].stack.entries[0].promptText, 'Exact prompt');
});

test('persisted terminal run is inspectable after attach with change and validation evidence', async () => {
    const h = harness(); await h.controller.attach('file:///project'); h.controller.edit('Objective', 'Instructions');
    h.controller.acceptGrant(true); await h.controller.start(); h.finish('interrupted');
    const reopened = new AgentRunController(h.runtime as unknown as AgentRuntimeService,
        { inventory: async () => { throw new Error('offline'); } } as unknown as AIRegistryService,
        { list: async () => { throw new Error('offline'); } } as unknown as AIRolePolicyService, () => {});
    await reopened.attach('file:///project');
    assert.equal(reopened.selected?.status, 'interrupted');
    assert.deepEqual(reopened.selected?.changedFiles, ['src/a.ts']);
    assert.equal(reopened.selected?.validationResults[0].status, 'passed');
    assert.equal(reopened.selected?.changeSummary?.summary, 'Updated source');
});

test('Work uses the direct authority controller and aliases without a standalone Agent Run view', async () => {
    const base = new URL('../../packages/theia-extension/src/browser/', import.meta.url);
    const [widget, controller, module] = await Promise.all([
        'chat-panel-widget.ts', 'agent-run-controller.ts', 'frontend-module.ts'
    ].map(name => readFile(new URL(name, base), 'utf8')));
    assert.match(module, /id: 'dope\.agentRun\.open'/); assert.doesNotMatch(module, /AgentRunWidget/);
    for (const label of ['Work instructions', 'Coding Agent model', 'Accept project execution grant', 'Stop Work'])
        assert.ok(widget.includes(label));
    assert.match(widget, /this\.directController\.select\(run\.id\)/);
    assert.match(controller, /runtime\.stop\(/); assert.match(controller, /createDefaultExecutionGrant/);
    assert.doesNotMatch(widget.slice(widget.indexOf('private renderWorkComposer'), widget.indexOf('private async name')),
        /hiddenReasoning|rawPayload|process\.env/i);
});
