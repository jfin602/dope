import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { AgentRunController } from '../../packages/theia-extension/lib/browser/agent-run-controller.js';
import { WorkSelectionController, workReviewCanAccept, workReviewState } from '../../packages/theia-extension/lib/browser/work-selection-controller.js';
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
    return { controller, runtime, inventory, policy, get task() { return task; }, get grant() { return grant; },
        get authorized() { return authorized; }, get stopped() { return stopped; },
        get reconciliations() { return reconciliations; }, setGate(value: unknown) { gate = value; },
        finish(status: AgentRun['status']) { run = { ...run!, status, changedFiles: ['src/a.ts'],
            validationResults: [{ version: 1, kind: 'test', label: 'unit', status: 'passed' }],
            changeSummary: { version: 1, filesChanged: 1, insertions: 2, deletions: 1, summary: 'Updated source', truncated: false } }; } };
}

test('direct task displays eligible target and requires explicit grant before starting; Stop requests backend cancellation', async () => {
    const h = harness();
    h.inventory.registry.models[0].limits.contextWindowTokens = { source: 'unknown' } as typeof h.inventory.registry.models[0]['limits']['contextWindowTokens'];
    await h.controller.attach('file:///project');
    assert.match(h.controller.targetMessage, /Coding · GPT/);
    assert.equal(h.controller.exactTargets.length, 1);
    h.controller.setPolicy({ kind: 'exact', connectionId: 'codex', modelId: 'gpt' });
    await h.controller.resolveTarget(); assert.match(h.controller.targetMessage, /Coding · GPT/);
    h.controller.setPolicy({ kind: 'follow-coding-agent' }); await h.controller.resolveTarget();
    h.controller.edit('Objective', 'Instructions'); assert.equal(h.controller.canStart, false);
    h.controller.acceptGrant(true); assert.equal(h.controller.canStart, false);
    h.controller.authorizeHostedProjectData(true); assert.equal(h.controller.canStart, true);
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
    h.controller.acceptGrant(true); h.controller.authorizeHostedProjectData(true); await h.controller.start();
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
    h.controller.acceptGrant(true); h.controller.authorizeHostedProjectData(true); await h.controller.start(); h.finish('interrupted');
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
    for (const label of ['Candidate diff', 'Accept candidate', 'Reject candidate', 'Changed paths:'])
        assert.ok(widget.includes(label));
    assert.match(widget, /this\.directController\.select\(run\.id\)/);
    assert.match(controller, /runtime\.stop\(/); assert.match(controller, /createDefaultExecutionGrant/);
    assert.doesNotMatch(widget.slice(widget.indexOf('private renderWorkComposer'), widget.indexOf('private async name')),
        /hiddenReasoning|rawPayload|process\.env/i);
});

test('Work candidate review preserves held evidence and submits only a fresh explicit decision', async () => {
    const fingerprint = 'b'.repeat(64);
    const task = { id: 'task', projectId: 'project', origin: { kind: 'work-item', projectId: 'project',
        scope: { delegablePaths: ['src'], humanReservedPaths: [] } }, reviewPolicy: { kind: 'required' },
        completion: { validation: [{ kind: 'test', label: 'Unit' }] } };
    let run = { id: 'run', taskId: 'task', projectId: 'project', status: 'blocked', grantId: 'grant',
        grantRevision: 1, basis: { head: 'a'.repeat(40) }, candidateFingerprint: fingerprint,
        candidateDelta: { effects: [{ kind: 'modify', path: 'src/a.ts' }] },
        candidateReview: { state: 'ready', revision: 0, candidateFingerprint: fingerprint,
            diff: 'diff --git a/src/a.ts b/src/a.ts', diffTruncated: false, changedPaths: ['src/a.ts'],
            validation: [{ owner: 'dope', kind: 'test', label: 'Unit', status: 'passed', candidateFingerprint: fingerprint }] } } as any;
    const calls: unknown[][] = [];
    const runtime = { async readRun() { return run; }, async readTask() { return task; },
        async readTranscript() { return { state: 'recorded', entries: [], hasMore: false, incomplete: false }; },
        async listTasks() { return [task]; }, async listRuns() { return [run]; },
        async decideCandidate(...args: unknown[]) { calls.push(args); const decision = args[4];
            run = { ...run, status: decision === 'reject' ? 'cancelled' : 'completed',
                reviewDecision: { kind: decision } } as any; return run; } };
    const controller = new WorkSelectionController(runtime as unknown as AgentRuntimeService, () => {});
    controller.handle = 'handle'; await controller.select({ kind: 'run', id: 'run' });
    assert.equal(workReviewState(controller.selectedRun, controller.selectedTask), 'pending');
    assert.equal(workReviewCanAccept(controller.selectedRun, controller.selectedTask), true);
    await controller.decideCandidate('accept');
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0]?.slice(0, 5), ['handle', 'run', 0, fingerprint, 'accept']);
    assert.equal((calls[0]?.[5] as { id: string }).id, 'grant');
    assert.equal(workReviewState(controller.selectedRun, controller.selectedTask), 'accepted');
    await controller.decideCandidate('accept'); assert.equal(calls.length, 1);
    run = { ...run, status: 'blocked', reviewDecision: undefined } as any;
    await controller.select({ kind: 'run', id: 'run' });
    const shown = controller.selectedRun;
    run = { ...run, candidateReview: { ...run.candidateReview, revision: 1 } };
    await controller.decideCandidate('reject');
    assert.equal(calls.length, 1);
    assert.match(controller.message, /changed/);
    assert.notEqual(controller.selectedRun, shown);
    assert.equal(workReviewState({ ...run, status: 'completed' } as AgentRun, task as any), 'stale');
    assert.equal(workReviewState({ ...run, reviewDecision: { kind: 'reject' } } as AgentRun, task as any), 'rejected');
    assert.equal(workReviewState(run as AgentRun, { ...task, origin: { kind: 'direct' } } as any), 'unavailable');
    assert.equal(workReviewCanAccept({ ...run, reviewDecision: undefined } as AgentRun,
        { ...task, completion: { validation: [] } } as any), false);
    run = { ...run, status: 'blocked', reviewDecision: undefined,
        candidateReview: { ...run.candidateReview, revision: 0 } } as any;
    await controller.select({ kind: 'run', id: 'run' });
    await controller.decideCandidate('reject');
    assert.deepEqual(calls[1]?.slice(0, 5), ['handle', 'run', 0, fingerprint, 'reject']);
    assert.equal(calls[1]?.[5], undefined);
    assert.equal(workReviewState(controller.selectedRun, controller.selectedTask), 'rejected');
});

test('Local exact and role targets require observed readiness and never grant hosted egress', async () => {
    const h = harness();
    const local = { ...h.inventory.registry.models[0], connectionId: 'local', providerModelKey: 'qwen',
        label: 'Qwen', locality: 'local' };
    h.inventory.registry.connections.push({ version: 1, id: 'local', alias: 'LM Studio', lifecycle: 'enabled',
        config: { type: 'local', runtime: 'lm-studio', endpoint: 'http://127.0.0.1:1234' } } as any);
    h.inventory.registry.models.push(local as any);
    h.inventory.observations.push({ connectionId: 'local', health: 'ready' });
    const role = h.policy.policies.find(item => item.roleId === 'coding-agent')!;
    role.preferred = { type: 'exact', target: { connectionId: 'local', modelId: 'qwen' } };
    await h.controller.attach('file:///project');
    assert.equal(h.controller.resolved, undefined);
    assert.match(h.controller.targetMessage, /unavailable|context/);
    (h.inventory as any).loadedLocalModels = [{ connectionId: 'local', providerModelKey: 'qwen', contextWindowTokens: 4096 }];
    await h.controller.resolveTarget();
    assert.equal(h.controller.resolved?.locality, 'local');
    assert.match(h.controller.targetMessage, /observed context 4096/);
    h.controller.setPolicy({ kind: 'exact', connectionId: 'local', modelId: 'qwen' });
    await h.controller.resolveTarget();
    h.controller.edit('Local change', 'Modify the candidate'); h.controller.acceptGrant(true);
    assert.equal(h.controller.canStart, true);
    await h.controller.start();
    assert.equal(h.authorized, false);
    assert.deepEqual((h.task as any).modelPolicy, { kind: 'exact', connectionId: 'local', modelId: 'qwen' });
    h.controller.acceptGrant(true);
    h.controller.setPolicy({ kind: 'exact', connectionId: 'codex', modelId: 'gpt' });
    await h.controller.resolveTarget();
    assert.equal(h.controller.accepted, false);
    h.controller.acceptGrant(true);
    assert.equal(h.controller.canStart, false);
    h.controller.authorizeHostedProjectData(true);
    assert.equal(h.controller.canStart, false); // the prior run is still active
    h.controller.setPolicy({ kind: 'exact', connectionId: 'local', modelId: 'qwen' });
    await h.controller.resolveTarget();
    local.capabilities.agentExecution = { source: 'unknown' } as any;
    await h.controller.resolveTarget();
    assert.equal(h.controller.resolved, undefined);
    assert.equal(h.controller.canStart, false);
});
