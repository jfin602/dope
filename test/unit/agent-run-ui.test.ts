import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { AgentRunController } from '../../packages/theia-extension/lib/browser/agent-run-controller.js';
import { WorkSelectionController, workReviewCanAccept, workReviewState } from '../../packages/theia-extension/lib/browser/work-selection-controller.js';
import type { AgentRun } from '../../packages/agent-core/src/contracts.ts';
import type { AgentRuntimeService } from '../../packages/contracts/src/agent-runtime-service.ts';
import type { AIRegistryService } from '../../packages/contracts/src/ai-registry-service.ts';
import type { AIRolePolicyService } from '../../packages/contracts/src/ai-role-policy-service.ts';
import { WorkToolPreferences } from '../../packages/theia-extension/lib/browser/work-tool-preferences.js';

function harness(tools?: WorkToolPreferences) {
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
    let oneShotStarts = 0, sessionStarts = 0;
    let gate: any; let reconciliations = 0; let mcpOffer: any;
    let pendingMCP: any[] = []; const mcpDecisions: unknown[][] = [];
    let worktree = { clean: true, fingerprint: 'clean', paths: [] as string[] };
    let acceptedDirty: unknown; let commits = 0;
    const runtime = { async attach() { return { projectHandle: 'handle' }; },
        async previewWorktree() { return worktree; },
        async commitWorktree(_handle: string, fingerprint: string) {
            assert.equal(fingerprint, worktree.fingerprint); commits++; worktree = { clean: true, fingerprint: 'clean', paths: [] }; },
        async workMCPObservationOffer() { return mcpOffer; },
        async pendingWorkMCPObservations() { return pendingMCP; },
        async decideWorkMCPObservation(...args: unknown[]) { mcpDecisions.push(args); pendingMCP = []; },
        async listRuns() { return run ? [run] : []; }, async listSequences() { return gate ? [gate] : []; },
        async reconcileManualGate() { reconciliations++; return gate; }, async readRun() { return run; },
        async readTask() { return task; }, async createTask(_handle: string, value: unknown) { task = value; return value; },
        async start(_handle: string, _uri: string, taskId: string, accepted: unknown, hosted: boolean, dirty?: string) {
            oneShotStarts++;
            grant = accepted; authorized = hosted; acceptedDirty = dirty;
            run = { version: 1, id: 'run', taskId, status: 'running', grantId: 'grant', grantRevision: 1,
                requestedPolicy: { kind: 'follow-coding-agent' }, projectRoot: '.', createdAt: now,
                changedFiles: [], validationResults: [] }; return run;
        }, async startWorkSession(handle: string, uri: string, taskId: string, accepted: unknown, hosted: boolean, dirty?: string) {
            sessionStarts++;
            return this.start(handle, uri, taskId, accepted, hosted, dirty);
        }, async stop() { stopped = true; run = { ...run!, status: 'cancelling' }; return run; },
        async readEvents() { return { events: [], nextSequence: 0, hasMore: false }; } };
    const controller = new AgentRunController(runtime as unknown as AgentRuntimeService,
        { inventory: async () => inventory } as unknown as AIRegistryService,
        { list: async () => policy } as unknown as AIRolePolicyService, () => {}, tools);
    return { controller, runtime, inventory, policy, get task() { return task; }, get grant() { return grant; },
        get authorized() { return authorized; }, get stopped() { return stopped; },
        get oneShotStarts() { return oneShotStarts - sessionStarts; }, get sessionStarts() { return sessionStarts; },
        get acceptedDirty() { return acceptedDirty; }, get commits() { return commits; },
        setWorktree(value: { clean: boolean; fingerprint: string; paths: string[] }) { worktree = value; },
        get reconciliations() { return reconciliations; }, setGate(value: unknown) { gate = value; },
        setMCPOffer(value: unknown) { mcpOffer = value; }, setPendingMCP(value: unknown[]) { pendingMCP = value; },
        get mcpDecisions() { return mcpDecisions; },
        finish(status: AgentRun['status']) { run = { ...run!, status, changedFiles: ['src/a.ts'],
            validationResults: [{ version: 1, kind: 'test', label: 'unit', status: 'passed' }],
            changeSummary: { version: 1, filesChanged: 1, insertions: 2, deletions: 1, summary: 'Updated source', truncated: false } }; } };
}

test('Prepare Work shows the Direct default and both mode consequences immediately before tools', async () => {
    const source = await readFile(new URL('../../packages/theia-extension/src/browser/chat-panel-widget.ts', import.meta.url), 'utf8');
    assert.match(source, /new Option\('Direct Work — Default', 'direct'\)/);
    assert.match(source, /The agent edits your open project as it works\. Changes appear in the editor immediately\. You can review changes and safely revert agent-owned edits\./);
    assert.match(source, /The agent edits a separate copy\. Your project stays unchanged until you review and accept the candidate\./);
    assert.match(source, /modeLabel, modeDetail, directUnavailable, toolSection/);
});

test('hosted Work requires explicit Isolated selection and consent, then creates a bounded internal grant', async () => {
    const h = harness();
    h.inventory.registry.models[0].limits.contextWindowTokens = { source: 'unknown' } as typeof h.inventory.registry.models[0]['limits']['contextWindowTokens'];
    await h.controller.attach('file:///project');
    assert.equal(h.controller.executionMode, 'direct');
    assert.equal(h.controller.canStart, false);
    h.controller.setExecutionMode('isolated');
    assert.match(h.controller.targetMessage, /Coding · GPT/);
    assert.equal(h.controller.exactTargets.length, 1);
    h.controller.setPolicy({ kind: 'exact', connectionId: 'codex', modelId: 'gpt' });
    await h.controller.resolveTarget(); assert.match(h.controller.targetMessage, /Coding · GPT/);
    h.controller.setPolicy({ kind: 'follow-coding-agent' }); await h.controller.resolveTarget();
    h.controller.edit('Objective', 'Instructions'); assert.equal(h.controller.canStart, false);
    assert.equal(h.controller.canStart, false);
    h.controller.authorizeHostedProjectData(true); assert.equal(h.controller.canStart, true);
    assert.equal(h.oneShotStarts, 0);
    await h.controller.start(); assert.equal((h.task as { completion: { validation: unknown[] } }).completion.validation.length, 0);
    assert.equal((h.grant as { acceptedBy: string }).acceptedBy, 'developer');
    assert.equal(h.oneShotStarts, 1); assert.equal(h.sessionStarts, 0);
    h.finish('completed');
    await h.controller.attach('file:///project');
    h.controller.setExecutionMode('isolated');
    h.controller.edit('Objective', 'Instructions');
    h.controller.authorizeHostedProjectData(true);
    h.controller.setValidation('npm test'); h.controller.acceptGrant(true);
    assert.equal(h.controller.canStart, true);
    await h.controller.start(); assert.equal((h.task as { origin: { kind: string } }).origin.kind, 'direct');
    assert.deepEqual((h.task as { reviewPolicy?: unknown }).reviewPolicy, { kind: 'required' });
    assert.equal((h.task as { modelPolicy: { kind: string } }).modelPolicy.kind, 'follow-coding-agent');
    assert.equal((h.grant as { permissions: { network: boolean; 'project-modify': boolean } }).permissions.network, false);
    assert.equal((h.grant as { permissions: { network: boolean; 'project-modify': boolean } }).permissions['project-modify'], true);
    assert.equal(h.authorized, true); assert.equal(h.controller.selected?.status, 'running');
    await h.controller.stop(); assert.equal(h.stopped, true); assert.equal(h.controller.selected?.status, 'cancelling');
});

test('Isolated hosted task keeps validation bounded and requires a fresh grant after edits', async () => {
    const h = harness(); await h.controller.attach('file:///project');
    h.controller.setExecutionMode('isolated');
    h.controller.edit('One task', 'Implement and verify');
    h.controller.acceptGrant(true);
    h.controller.setValidation('npm test');
    assert.equal(h.controller.canStart, false);
    h.controller.acceptGrant(true); h.controller.authorizeHostedProjectData(true); await h.controller.start();
    assert.deepEqual((h.task as { completion: unknown }).completion, { validation: [
        { kind: 'test', label: 'Required validation', command: 'npm test' }], requireValidationPass: true });
    assert.deepEqual((h.task as { reviewPolicy: unknown }).reviewPolicy, { kind: 'required' });
});

test('dirty Isolated Work waits for an explicit continue or commit choice', async () => {
    const h = harness(); await h.controller.attach('file:///project');
    h.controller.setExecutionMode('isolated');
    h.controller.edit('Inspect', 'Inspect this project');
    h.controller.acceptGrant(true);
    h.controller.authorizeHostedProjectData(true);
    h.setWorktree({ clean: false, fingerprint: 'snapshot-1', paths: ['src/a.ts'] });
    await h.controller.start();
    assert.equal(h.task, undefined);
    assert.deepEqual(h.controller.worktreeReview?.paths, ['src/a.ts']);
    await h.controller.start(true);
    assert.equal(h.acceptedDirty, 'snapshot-1');

    const committed = harness(); await committed.controller.attach('file:///project');
    committed.controller.setExecutionMode('isolated');
    committed.controller.edit('Inspect', 'Inspect this project');
    committed.controller.acceptGrant(true);
    committed.controller.authorizeHostedProjectData(true);
    committed.setWorktree({ clean: false, fingerprint: 'snapshot-2', paths: ['src/b.ts'] });
    await committed.controller.start();
    await committed.controller.commitWorktree();
    assert.equal(committed.commits, 1);
    assert.equal(committed.acceptedDirty, undefined);
    assert.equal(committed.controller.selected?.status, 'running');
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
    h.controller.setValidation('npm test'); h.controller.acceptGrant(true); h.controller.authorizeHostedProjectData(true); await h.controller.start(); h.finish('interrupted');
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
    for (const label of ['Work instructions', 'Coding Agent model', 'Tools for this Work', 'Stop Work'])
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
    assert.equal(workReviewState(run as AgentRun, { ...task, origin: { kind: 'direct' } } as any), 'pending');
    assert.equal(workReviewCanAccept({ ...run, reviewDecision: undefined } as AgentRun,
        { ...task, completion: { validation: [], requireValidationPass: false } } as any), true);
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
    h.controller.edit('Local change', 'Modify the candidate'); h.controller.setValidation('npm test'); h.controller.acceptGrant(true);
    assert.equal(h.controller.canStart, true);
    await h.controller.start();
    assert.equal(h.authorized, false);
    assert.equal(h.sessionStarts, 1); assert.equal(h.oneShotStarts, 0);
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

test('direct Local Work requires separate MCP grant acceptance and decides only a pending call', async () => {
    const stored = new Map<string, string>();
    const tools = new WorkToolPreferences({ getItem: key => stored.get(key) ?? null,
        setItem: (key, value) => { stored.set(key, value); } });
    tools.saveChoice('file:///project', 'direct', { groups: ['Inspect'],
        allow: ['mcp_godot_server_info'], deny: [] });
    const h = harness(tools);
    const local = { ...h.inventory.registry.models[0], connectionId: 'local', providerModelKey: 'qwen',
        label: 'Qwen', locality: 'local', capabilities: { ...h.inventory.registry.models[0].capabilities,
            toolCalling: { source: 'adapter-known', value: true } } };
    h.inventory.registry.connections.push({ version: 1, id: 'local', alias: 'LM Studio', lifecycle: 'enabled',
        config: { type: 'local', runtime: 'lm-studio', endpoint: 'http://127.0.0.1:1234' } } as any);
    h.inventory.registry.models.push(local as any);
    h.inventory.observations.push({ connectionId: 'local', health: 'ready' });
    (h.inventory as any).loadedLocalModels = [{ connectionId: 'local', providerModelKey: 'qwen', contextWindowTokens: 4096 }];
    h.policy.policies.find(item => item.roleId === 'coding-agent')!.preferred =
        { type: 'exact', target: { connectionId: 'local', modelId: 'qwen' } };
    const offer = { projectKey: 'a'.repeat(64), serverId: 'godot', registrationRevision: 3,
        catalogRevision: 5, toolName: 'godot_get_server_info', connectionId: 'local', modelId: 'qwen',
        maxCalls: 1, expiresAt: new Date(Date.now() + 600_000).toISOString() };
    h.setMCPOffer(offer);
    await h.controller.attach('file:///project');
    assert.equal(h.controller.mcpOffer?.serverId, 'godot');
    h.controller.edit('Observe', 'Use only the reviewed observation');
    h.controller.setValidation('npm test');
    h.controller.acceptMCPObservation(true);
    assert.equal(h.controller.canStart, true);
    await h.controller.start();
    assert.deepEqual((h.grant as any).mcpObservation, offer);
    h.setPendingMCP([{ id: 'pending', runId: 'run', taskId: (h.task as any).id,
        projectKey: offer.projectKey, serverId: 'godot', toolName: offer.toolName,
        expiresAt: new Date(Date.now() + 60_000).toISOString() }]);
    await h.controller.refresh();
    assert.equal(h.controller.pendingMCP.length, 1);
    await h.controller.decideMCPObservation('run', 'pending', true);
    assert.deepEqual(h.mcpDecisions, [['handle', 'run', 'pending', true]]);
    assert.equal(h.controller.pendingMCP.length, 0);
});
