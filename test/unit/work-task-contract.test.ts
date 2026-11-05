import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDefaultExecutionGrant } from '../../packages/agent-core/lib/index.js';
import { projectWorkTaskContract } from '../../packages/theia-extension/lib/node/work-task-contract.js';

const basis = { architectureRevision: 1, architectureFingerprint: 'architecture',
    physicalInputFingerprint: 'physical', physicalGeneration: 1 };
const work = { id: 'work', title: 'Build', objective: 'Keep the accepted objective',
    requirements: ['exact requirement'], constraints: [], acceptanceCriteria: ['first check', 'second check'],
    validationTargets: ['run focused'], transformationIds: [], status: 'ready', assignment: 'AI',
    workingSet: ['src'], delegablePaths: ['src'], humanReservedPaths: [] };
const task = { version: 1, id: 'task', createdAt: '2026-11-05T12:00:00Z',
    objective: work.objective, instructions: JSON.stringify({ title: work.title, requirements: work.requirements,
        constraints: work.constraints, acceptanceCriteria: work.acceptanceCriteria,
        validationTargets: work.validationTargets, transformationIds: work.transformationIds,
        delegatedPaths: ['src'], humanReservedPaths: [] }),
    projectRoot: '.', projectId: 'planning', modelPolicy: { kind: 'follow-coding-agent' }, controls: {},
    authority: { profile: 'phase-8b-project' }, completion: { requireValidationPass: true,
        validation: [{ kind: 'test', label: 'focused', command: 'npm test' }] },
    origin: { kind: 'work-item', projectId: 'planning', planningMapId: 'map', workItemId: 'work',
        mapRevision: 2, basis, scope: { assignment: 'AI', workingSet: ['src'],
            delegablePaths: ['src'], humanReservedPaths: [] } }, planningMapId: 'map', reviewPolicy: { kind: 'required' } };
const grant = createDefaultExecutionGrant({ id: 'grant', revision: 0, taskId: 'task',
    acceptedAt: '2026-11-05T12:01:00Z' });
const source = { projectId: 'roadmap', revision: 3, sha256: 'a'.repeat(64) };
const index = { revision: 4, projectRoot: '', projectId: 'roadmap', gates: [
    { id: 'gate', parentPhaseId: 'phase', criteria: [
        { id: 'one', expectedResult: 'first check' }, { id: 'two', expectedResult: 'second check' }] }],
    phases: [{ id: 'phase', planningLock: { approvalId: 'approval', source,
        requiredGateIds: ['gate'], criteria: [
            { id: 'one', expectedResult: 'first check' }, { id: 'two', expectedResult: 'second check' }] },
        workLinks: [{ planningProjectId: 'planning', mapId: 'map', mapRevision: 2, basis,
            workItemId: 'work', criterionIds: ['one', 'two'] }] }] };

test('Task Contract reconstructs exact accepted basis and one-to-many reviewed links', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-task-contract-'));
    try {
        const planning = { read: async () => ({ projectId: 'planning', maps: [
            { id: 'map', projectId: 'planning', revision: 2, basis, workItems: [work] }] }) };
        const roadmap = { read: async () => ({ ...index, projectRoot: root }) };
        const first = await projectWorkTaskContract(root, task as any, grant, 'b'.repeat(40), planning as any, roadmap as any);
        assert.equal(first.objective, work.objective);
        assert.deepEqual(first.acceptance, work.acceptanceCriteria);
        assert.deepEqual(first.roadmap !== 'unknown' && first.roadmap.links.map(link => link.criterionId), ['one', 'two']);
        assert.deepEqual(await projectWorkTaskContract(root, task as any, grant, 'b'.repeat(40), planning as any, roadmap as any), first);
        const pointerOnly = { read: async () => ({ projectId: 'planning', maps: [
            { id: 'map', projectId: 'planning', revision: 2, basis,
                workItems: [{ ...work, status: 'in-progress', completionNotes: 'Read pointer updated' }] }] }) };
        assert.deepEqual(await projectWorkTaskContract(root, task as any, grant, 'b'.repeat(40),
            pointerOnly as any, roadmap as any), first);
        const changed = { read: async () => ({ projectId: 'planning', maps: [
            { id: 'map', projectId: 'planning', revision: 2, basis,
                workItems: [{ ...work, acceptanceCriteria: ['unreviewed change'] }] }] }) };
        await assert.rejects(projectWorkTaskContract(root, task as any, grant, 'b'.repeat(40),
            changed as any, roadmap as any), /basis changed/);
        await assert.rejects(projectWorkTaskContract(root, task as any, grant, 'b'.repeat(40),
            { read: async () => ({ projectId: 'foreign', maps: [] }) } as any, roadmap as any), /basis changed/);
        await assert.rejects(projectWorkTaskContract(root, task as any, grant, 'b'.repeat(40), planning as any,
            { read: async () => ({ ...index, projectRoot: root, phases: [{ ...index.phases[0],
                workLinks: [{ ...index.phases[0].workLinks[0], mapRevision: 1 }] }] }) } as any), /Stale Roadmap/);
        const direct = { ...task, origin: { kind: 'direct' }, instructions: 'Original prompt' };
        const projected = await projectWorkTaskContract(root, direct as any, grant, 'b'.repeat(40));
        assert.equal(projected.acceptance, 'unknown');
        assert.equal(projected.planning, 'unknown');
        assert.equal(projected.roadmap, 'unknown');
    } finally { await rm(root, { recursive: true, force: true }); }
});
