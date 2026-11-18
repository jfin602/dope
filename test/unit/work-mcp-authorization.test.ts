import assert from 'node:assert/strict';
import test from 'node:test';
import { checkWorkMCPObservationApproval, createDefaultExecutionGrant,
    createMCPObservationExecutionGrant, parseExecutionGrant, reviseExecutionGrant } from
    '../../packages/agent-core/lib/authority.js';
import { parseWorkMCPObservationReceipt } from '../../packages/agent-core/lib/authority.js';

const acceptedAt = '2026-11-17T12:00:00.000Z';
const now = '2026-11-17T12:02:00.000Z';
const scope = { projectKey: 'a'.repeat(64), serverId: 'godot', registrationRevision: 4, catalogRevision: 9,
    toolName: 'godot_get_server_info', connectionId: 'desk', modelId: 'exact-model',
    maxCalls: 1 as const, expiresAt: '2026-11-17T12:10:00.000Z' };
const grant = createMCPObservationExecutionGrant({ id: 'grant-1', revision: 1, taskId: 'task-1',
    acceptedAt, mcpObservation: scope });
const current = { grantId: grant.id, grantRevision: grant.revision, taskId: grant.taskId,
    projectKey: scope.projectKey, serverId: scope.serverId,
    registrationRevision: scope.registrationRevision, catalogRevision: scope.catalogRevision,
    toolName: scope.toolName,
    connectionId: scope.connectionId, modelId: scope.modelId, workspaceId: 'candidate-1',
    candidateFingerprint: 'b'.repeat(64), callId: 'pi-1' };
const approval = { ...current, approvedAt: '2026-11-17T12:01:00.000Z', approvedBy: 'developer' as const };

test('default Work grant has no external observation authority; one reviewed call is exact', () => {
    const ordinary = createDefaultExecutionGrant({ id: 'grant-1', revision: 1, taskId: 'task-1', acceptedAt });
    assert.equal(ordinary.mcpObservation, undefined);
    assert.equal(checkWorkMCPObservationApproval(ordinary, approval, current, 0, now), false);
    assert.deepEqual(parseExecutionGrant(grant).mcpObservation, scope);
    assert.equal(checkWorkMCPObservationApproval(grant, approval, current, 0, now), true);
    assert.equal(checkWorkMCPObservationApproval(grant, approval, current, 1, now), false);
    assert.equal(checkWorkMCPObservationApproval(grant, approval, current, 0,
        '2026-11-17T12:11:00.000Z'), false);
    assert.equal(reviseExecutionGrant(grant, '2026-11-17T12:03:00.000Z').mcpObservation, undefined);
});

test('Work observation approval rejects project, task, model, server, method and candidate drift', () => {
    for (const [key, value] of Object.entries({ taskId: 'other-task', projectKey: 'c'.repeat(64),
        serverId: 'other', registrationRevision: 5, catalogRevision: 10, toolName: 'godot_scene_write',
        connectionId: 'other', modelId: 'other-model', workspaceId: 'other-candidate',
        candidateFingerprint: 'd'.repeat(64), callId: 'pi-2', grantRevision: 2 })) {
        assert.equal(checkWorkMCPObservationApproval(grant, approval,
            { ...current, [key]: value }, 0, now), false, key);
    }
    assert.equal(checkWorkMCPObservationApproval(grant,
        { ...approval, approvedBy: 'model' } as never, current, 0, now), false);
    assert.equal(checkWorkMCPObservationApproval(grant,
        { ...approval, approvedAt: '2026-11-17T12:12:00.000Z' }, current, 0, now), false);
    assert.equal(checkWorkMCPObservationApproval(grant,
        { ...approval, approvedAt: 'invalid' }, current, 0, now), false);
    assert.equal(checkWorkMCPObservationApproval(grant,
        { ...approval, command: '/bin/sh' } as never, current, 0, now), false);
});

test('Work grant rejects blanket or malformed MCP permissions', () => {
    for (const mcpObservation of [
        { ...scope, toolName: 'godot_scene_write', maxCalls: 20 },
        { ...scope, projectKey: 'wrong' },
        { ...scope, serverId: '../outside' },
        { ...scope, registrationRevision: 0 },
        { ...scope, catalogRevision: 0 },
        { ...scope, expiresAt: '2026-11-17T13:00:00.000Z' },
        { ...scope, command: '/bin/sh' }
    ]) assert.throws(() => parseExecutionGrant({ ...grant, mcpObservation }));
});

test('Work observation receipt preserves outcome identity without external content', () => {
    const receipt = { approval, status: 'completed', dispatched: true,
        endedAt: '2026-11-17T12:02:00.000Z', outputSha256: 'e'.repeat(64) };
    assert.deepEqual(parseWorkMCPObservationReceipt(receipt), receipt);
    for (const bad of [
        { ...receipt, status: 'denied' },
        { ...receipt, dispatched: false },
        { ...receipt, output: 'secret external response' },
        { ...receipt, outputSha256: 'bad' },
        { ...receipt, endedAt: '2026-11-17T12:00:00.000Z' }
    ]) assert.throws(() => parseWorkMCPObservationReceipt(bad));
});
