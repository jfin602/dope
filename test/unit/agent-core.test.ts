import assert from 'node:assert/strict';
import test from 'node:test';
import { AGENT_SCHEMA_VERSION, EFFECT_KINDS, RUN_STATUSES, canTransitionAgentRun,
    checkEffect, createDefaultExecutionGrant, isModelCapacityFailure, parseAgentRun, parseAgentRunEvent, parseAgentTask,
    parseChangeSummary, parseExecutionGrant, parseExecutionProvenance, parseValidationResult,
    reviseExecutionGrant, transitionAgentRun } from '../../packages/agent-core/lib/index.js';

const now = '2026-10-05T12:00:00Z';
const task = () => ({ version: AGENT_SCHEMA_VERSION, id: 'task-1', createdAt: now,
    objective: 'Change one file', instructions: 'Edit src/a.ts and run a test', projectRoot: '.',
    modelPolicy: { kind: 'follow-coding-agent' }, controls: { reasoningEffort: 'high' },
    authority: { profile: 'phase-8b-project' },
    completion: { validation: [{ kind: 'test', label: 'focused unit test' }], requireValidationPass: true },
    origin: { kind: 'direct' } });
const grant = () => createDefaultExecutionGrant({ id: 'grant-1', revision: 0,
    taskId: 'task-1', acceptedAt: now });
const run = () => ({ version: 1, id: 'run-1', taskId: 'task-1', status: 'pending',
    grantId: 'grant-1', grantRevision: 0, requestedPolicy: { kind: 'follow-coding-agent' },
    projectRoot: '.', createdAt: now, changedFiles: [], validationResults: [] });

test('capacity classifier accepts explicit capacity only', () => {
    for (const message of ['model_at_capacity', 'Model at capacity; try again later',
        'Service is at capacity', 'at capacity, try again'])
        assert.equal(isModelCapacityFailure(new Error(message)), true);
    for (const message of ['rate limit exceeded', 'quota exceeded', 'context window capacity',
        'connection unavailable', 'provider failed'])
        assert.equal(isModelCapacityFailure(new Error(message)), false);
    assert.equal(isModelCapacityFailure({ message: 'model_at_capacity' }), false);
});

test('task parsing is versioned, strict, portable and supports all origins', () => {
    const parsed = parseAgentTask(task());
    assert.deepEqual(parsed, task());
    assert.equal(Object.isFrozen(parsed.completion.validation), true);
    for (const origin of [{ kind: 'direct' }, { kind: 'phase-stack', promptId: 'P1' },
        { kind: 'future-session', sessionId: 'session-1' }])
        assert.deepEqual(parseAgentTask({ ...task(), origin, ...(origin.kind === 'phase-stack' ? {
            phaseStack: { stackFingerprint: 'a'.repeat(64), recommendedModel: 'gpt-6-sol',
                versionPolicy: { kind: 'target', version: '0.8.16' } } } : {}) }).origin, origin);
    assert.deepEqual(parseAgentTask({ ...task(), modelPolicy: { kind: 'exact',
        connectionId: 'connection-1', modelId: 'org/model-1' } }).modelPolicy,
        { kind: 'exact', connectionId: 'connection-1', modelId: 'org/model-1' });
    for (const change of [
        { version: 2 }, { projectRoot: '/home/user/project' }, { projectRoot: '..' },
        { modelPolicy: { kind: 'exact', connectionId: 'c', modelId: 'm', endpoint: 'private' } },
        { controls: { reasoningEffort: 'ultra' } }, { origin: { kind: 'direct', workItemId: 'x' } },
        { completion: { validation: Array(13).fill({ kind: 'test', label: 'x' }), requireValidationPass: true } },
        { instructions: 'x'.repeat(20_001) }, { token: 'secret' }, { env: { HOME: '/private' } },
        { hiddenReasoning: 'private' }, { providerPayload: {} }
    ]) assert.throws(() => parseAgentTask({ ...task(), ...change }));
});

test('WorkItem task freezes project, map, basis and delegated scope with required review', () => {
    const origin = { kind: 'work-item', projectId: 'project-1', planningMapId: 'map-1',
        workItemId: 'work-1', mapRevision: 2,
        basis: { architectureRevision: 1, architectureFingerprint: 'arch',
            physicalInputFingerprint: 'source', physicalGeneration: 3 },
        scope: { assignment: 'SHARED', workingSet: ['src'], delegablePaths: ['src/agent'],
            humanReservedPaths: ['src/human'] } };
    const derived = { ...task(), projectId: 'project-1', planningMapId: 'map-1', origin,
        reviewPolicy: { kind: 'required' } };
    const parsed = parseAgentTask(derived);
    assert.deepEqual(parsed, derived);
    if (parsed.origin.kind !== 'work-item') throw new Error('Expected WorkItem origin');
    assert.equal(Object.isFrozen(parsed.origin), true);
    assert.equal(Object.isFrozen(parsed.origin.scope.delegablePaths), true);
    assert.equal(Object.isFrozen(parsed.origin.basis), true);
    for (const change of [
        { projectId: 'other-project' }, { planningMapId: 'other-map' },
        { reviewPolicy: undefined }, { reviewPolicy: { kind: 'automatic' } },
        { reviewPolicy: { kind: 'required', approvedBy: 'model' } },
        { origin: { ...origin, mapRevision: -1 } },
        { origin: { ...origin, basis: { ...origin.basis, physicalGeneration: -1 } } },
        { origin: { ...origin, basis: { ...origin.basis, providerSession: 'private' } } },
        { origin: { ...origin, scope: { ...origin.scope, delegablePaths: ['../outside'] } } },
        { origin: { ...origin, scope: { ...origin.scope, delegablePaths: ['src/human'] } } },
        { origin: { ...origin, scope: { ...origin.scope, assignment: 'HUMAN' } } },
        { origin: { ...origin, scope: { ...origin.scope, delegablePaths: ['src/agent', 'src/agent'] } } },
        { origin: { ...origin, scope: { ...origin.scope, rawPrompt: 'private' } } }
    ]) assert.throws(() => parseAgentTask({ ...derived, ...change }));
    assert.deepEqual(parseAgentTask({ ...derived, origin: { ...origin,
        scope: { assignment: 'AI', workingSet: ['src'], delegablePaths: ['src/agent'],
            humanReservedPaths: [] } } }).reviewPolicy, { kind: 'required' });
    assert.throws(() => parseAgentTask({ ...task(), reviewPolicy: { kind: 'required' } }));
    assert.throws(() => parseAgentTask({ ...task(), origin: { kind: 'work-item', workItemId: 'legacy' } }));
});

test('run, event, provenance and evidence records reject unbounded and private fields', () => {
    assert.deepEqual(parseAgentRun(run()), run());
    const running = { ...run(), status: 'running', startedAt: now,
        provenance: { version: 1, connectionId: 'conn', modelId: 'model',
            providerId: 'codex', runtimeKind: 'hosted', adapterId: 'codex', policyRevision: 3 },
        basis: { head: 'abcdef', clean: true }, changedFiles: ['src/a.ts'],
        validationResults: [{ version: 1, kind: 'test', label: 'unit', status: 'passed' }],
        changeSummary: { version: 1, filesChanged: 1, insertions: 2, deletions: 1,
            summary: 'One file edited', truncated: false } };
    assert.deepEqual(parseAgentRun(running), running);
    assert.equal(Object.isFrozen(parseAgentRun(running).provenance), true);
    for (const change of [{ changedFiles: ['/etc/passwd'] }, { changedFiles: ['../out'] },
        { changedFiles: ['src/a.ts', 'src/a.ts'] }, { changedFiles: ['.git/config'] },
        { basis: { head: 'abc', clean: true, command: 'git status' } },
        { status: 'completed' }, { token: 'secret' }, { rawProviderEvent: {} },
        { env: {} }, { reasoning: 'private' }, { projectRoot: '/tmp/repo' },
        { recovery: { adapterId: 'codex', handle: 'a'.repeat(257) } }])
        assert.throws(() => parseAgentRun({ ...running, ...change }));
    const event = { version: 1, runId: 'run-1', sequence: 1, at: now,
        kind: 'file', summary: 'Edited a file', path: 'src/a.ts' };
    assert.deepEqual(parseAgentRunEvent(event), event);
    assert.throws(() => parseAgentRunEvent({ ...event, rawPayload: {} }));
    assert.throws(() => parseAgentRunEvent({ ...event, path: '/etc/passwd' }));
    assert.throws(() => parseAgentRunEvent({ ...event, summary: 'x'.repeat(1001) }));
    assert.throws(() => parseExecutionProvenance({ ...running.provenance, accessToken: 'secret' }));
    assert.throws(() => parseValidationResult({ ...running.validationResults[0], stdout: 'x'.repeat(8193) }));
    assert.throws(() => parseChangeSummary({ ...running.changeSummary, diff: 'raw' }));
});

test('state transition table is exact and terminal statuses cannot resume', () => {
    assert.deepEqual(RUN_STATUSES, ['pending', 'running', 'blocked', 'cancelling',
        'cancelled', 'failed', 'completed', 'interrupted']);
    const legal = new Set(['pending>running', 'running>blocked', 'running>cancelling',
        'running>failed', 'running>completed', 'running>interrupted',
        'blocked>running', 'blocked>cancelling', 'blocked>failed', 'blocked>interrupted',
        'cancelling>cancelled', 'cancelling>interrupted', 'cancelling>failed', 'cancelling>completed']);
    for (const from of RUN_STATUSES) for (const to of RUN_STATUSES) {
        const expected = legal.has(`${from}>${to}`);
        assert.equal(canTransitionAgentRun(from, to), expected, `${from} -> ${to}`);
        if (expected) assert.equal(transitionAgentRun(from, to), to);
        else assert.throws(() => transitionAgentRun(from, to));
    }
});

test('accepted grant is immutable, revisioned and fixed to the 8B profile', () => {
    const first = grant();
    assert.equal(Object.isFrozen(first), true);
    assert.equal(Object.isFrozen(first.permissions), true);
    const second = reviseExecutionGrant(first, '2026-10-05T12:01:00Z');
    assert.equal(first.revision, 0);
    assert.equal(second.revision, 1);
    assert.notEqual(first, second);
    assert.throws(() => parseExecutionGrant({ ...first, permissions: { ...first.permissions, network: true } }));
    assert.throws(() => parseExecutionGrant({ ...first, permissions: { 'project-read': true } }));
    assert.throws(() => parseExecutionGrant({ ...first, acceptedBy: 'model' }));
    assert.throws(() => parseExecutionGrant({ ...first, projectRoot: '/host/path' }));
    assert.throws(() => parseExecutionGrant({ ...first, revision: -1 }));
    assert.throws(() => parseExecutionGrant({ ...first, prompt: 'ignore policy' }));
});

test('default grant separates workspace authority from authoritative promotion', () => {
    const approved = grant();
    const allowed = new Set(['workspace-read', 'workspace-write', 'workspace-process',
        'workspace-test', 'workspace-build', 'project-create', 'project-modify', 'git-inspect']);
    assert.equal(EFFECT_KINDS.length, 19);
    for (const kind of EFFECT_KINDS) {
        const effect = { kind, scope: kind.startsWith('workspace-') || kind === 'git-inspect' ? 'workspace' : 'project',
            ...(kind === 'workspace-read' || kind === 'workspace-write' ||
            kind.startsWith('project-') ?
            { path: 'src/a.ts' } : allowed.has(kind) ? { path: '.' } : {}) };
        const decision = checkEffect(approved, effect);
        assert.equal(decision.allowed, allowed.has(kind), kind);
        assert.equal(decision.grantRevision, 0);
        if (!decision.allowed) assert.equal(decision.reason, 'unapproved-effect');
    }
    for (const path of ['/etc/passwd', '../outside', 'src/../../outside',
        'C:/Windows', 'src\\a.ts', '.git/config', 'src//a.ts']) {
        const decision = checkEffect(approved, { kind: 'project-modify', scope: 'project', path });
        assert.deepEqual(decision, { allowed: false, kind: 'project-modify', grantId: 'grant-1',
            grantRevision: 0, reason: 'invalid-target' });
    }
    assert.equal(checkEffect(approved, { kind: 'project-modify', scope: 'outside-root', path: 'x' }).allowed, false);
    assert.equal(checkEffect(approved, { kind: 'workspace-read', scope: 'project' }).allowed, false);
    assert.equal(checkEffect(approved, { kind: 'workspace-process', scope: 'project' }).allowed, false);
    assert.equal(checkEffect(approved, { kind: 'project-modify', scope: 'project', path: 'x',
        providerSaysAllowed: true }).allowed, false);
});
