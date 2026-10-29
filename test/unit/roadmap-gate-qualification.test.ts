import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { evaluateGateQualification } from '../../packages/project-intelligence/lib/node/roadmap-gate-domain.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import type { RoadmapGateIndex } from '../../packages/project-intelligence/src/node/roadmap-gate-domain.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const at = '2026-10-29T12:00:00Z';
const later = '2026-10-29T12:05:00Z';
const source = { projectId: 'owner', revision: 7, sha256: hash('source seven') };
const fixture = async (run: (root: string, store: RoadmapStore) => Promise<void>) => {
    const root = await mkdtemp(join(tmpdir(), 'dope-gate-evidence-'));
    try {
        const store = new RoadmapStore();
        await store.saveGateIndex(root, 0, 'uninitialized', {
            schemaVersion: 2, projectId: 'owner', projectRoot: root, revision: 1,
            phases: [{ id: 'p', projectId: 'owner', title: 'Phase', objective: 'Deliver', order: 0,
                dependencies: [], implementationStatus: 'implemented', qualificationStatus: 'unknown',
                draftAcceptance: 'accepted', gateSetCoverage: { status: 'unreviewed' } }],
            gates: [{ id: 'g', projectId: 'owner', parentPhaseId: 'p', designation: 'G1',
                title: 'Gate', purpose: 'Verify', order: 0, dependencies: [],
                criteria: [{ id: 'c', projectId: 'owner', title: 'Check', expectedResult: 'Value present', order: 0, evidence: [] }],
                implementationStatus: 'implemented', qualificationStatus: 'unknown', draftAcceptance: 'accepted' }],
            corrections: [],
        });
        await run(root, store);
    } finally { await rm(root, { recursive: true, force: true }); }
};

test('pure Gate evaluator requires reviewed current PASS for every criterion and no blocker', () => {
    const gate: RoadmapGateIndex['gates'][number] = { id: 'g', projectId: 'owner', parentPhaseId: 'p',
        designation: 'G1', title: 'Gate', purpose: 'Verify', order: 0, dependencies: [],
        criteria: [{ id: 'c', projectId: 'owner', title: 'Check', expectedResult: 'Value present', order: 0, evidence: [] }],
        implementationStatus: 'implemented', qualificationStatus: 'green', draftAcceptance: 'accepted' };
    assert.equal(evaluateGateQualification(gate).status, 'unknown'); // Stored Green is not evidence.
    const evidence = { id: 'e', projectId: 'owner', criterionId: 'c', result: 'pass' as const,
        kind: 'test' as const, summary: 'Focused test', verifiedBy: 'test runner', observedAt: at,
        source, criterionHash: hash(JSON.stringify(['Check', 'Value present'])),
        review: { status: 'proposed' as const } };
    gate.criteria[0].evidence.push(evidence);
    gate.qualificationSource = source;
    assert.equal(evaluateGateQualification(gate).status, 'unknown');
    gate.criteria[0].evidence[0].review = { status: 'approved', reviewerId: 'reviewer', reviewedAt: later };
    assert.equal(evaluateGateQualification(gate).status, 'green');
    gate.criteria.push({ id: 'c2', projectId: 'owner', title: 'Second check', expectedResult: 'Second value',
        order: 1, evidence: [] });
    assert.equal(evaluateGateQualification(gate).status, 'unknown');
    gate.criteria[1].evidence.push({ ...evidence, id: 'e2', criterionId: 'c2',
        criterionHash: hash(JSON.stringify(['Second check', 'Second value'])),
        review: { status: 'approved', reviewerId: 'reviewer', reviewedAt: later } });
    assert.equal(evaluateGateQualification(gate).status, 'green');
    gate.criteria[0].evidence[0].result = 'fail';
    assert.equal(evaluateGateQualification(gate).status, 'not-green');
    gate.criteria[0].evidence[0].result = 'pass';
    gate.qualificationBlockers = ['Unresolved failure'];
    assert.equal(evaluateGateQualification(gate).status, 'blocked');
    gate.qualificationBlockers = [];
    assert.equal(evaluateGateQualification(gate, { ...source, revision: 8, sha256: hash('source eight') }).status, 'stale');
    gate.criteria[0].expectedResult = 'Changed expectation';
    assert.equal(evaluateGateQualification(gate).status, 'stale');
});

test('persisted proposal, approval, failure, source drift, revision, revocation and no-write authority', async () => fixture(async (root, store) => {
    const file = join(root, '.dope', 'roadmap.json');
    let revision = 1;
    const act = async (operation: Parameters<RoadmapStore['mutateGateIndex']>[3]) =>
        store.mutateGateIndex(root, revision++, 'owner', operation);
    const read = async () => (await new RoadmapStore().read<RoadmapGateIndex>(root)).gates[0];
    const before = hash(await readFile(file, 'utf8'));
    assert.equal((await read()).qualificationStatus, 'unknown');
    await assert.rejects(store.mutateGateIndex(root, 1, 'foreign', { type: 'gate.source', id: 'g', source }), /identity changed/);
    await assert.rejects(store.mutateGateIndex(root, 1, 'owner', { type: 'gate.qualify', id: 'g', status: 'green' } as never), /Unknown Roadmap Gate mutation/);
    await assert.rejects(store.saveGateIndex(root, 1, 'owner', { ...(await store.read<RoadmapGateIndex>(root)), revision: 2,
        gates: [{ ...(await read()), qualificationStatus: 'green' }] }), /typed review operations/);
    assert.equal(hash(await readFile(file, 'utf8')), before);
    await act({ type: 'evidence.propose', gateId: 'g', criterionId: 'c', id: 'e1', result: 'pass', kind: 'test',
        summary: 'Focused assertion', verifiedBy: 'test runner', observedAt: at, source });
    assert.equal((await read()).qualificationStatus, 'unknown');
    assert.equal((await read()).criteria[0].evidence[0].review.status, 'proposed');
    await assert.rejects(store.mutateGateIndex(root, revision, 'owner', { type: 'evidence.approve',
        gateId: 'g', criterionId: 'c', id: 'e1', reviewerId: 'owner', reviewedAt: later }), /Current tested source/);
    await act({ type: 'evidence.approve', gateId: 'g', criterionId: 'c', id: 'e1', reviewerId: 'owner',
        reviewedAt: later, currentSource: source });
    assert.equal((await read()).qualificationStatus, 'green');
    assert.equal(evaluateGateQualification(await read()).status, 'green');
    const approvedBytes = hash(await readFile(file, 'utf8'));
    const forged = await store.read<RoadmapGateIndex>(root);
    forged.revision++;
    forged.gates[0].criteria[0].evidence = [];
    forged.gates[0].qualificationStatus = 'unknown';
    await assert.rejects(store.saveGateIndex(root, revision, 'owner', forged), /typed review operations/);
    await assert.rejects(store.mutateGateIndex(root, revision, 'owner', { type: 'criterion.remove',
        gateId: 'g', id: 'c' }), /evidence must be retained/);
    assert.equal(hash(await readFile(file, 'utf8')), approvedBytes);
    await act({ type: 'evidence.propose', gateId: 'g', criterionId: 'c', id: 'e2', result: 'fail', kind: 'test',
        summary: 'Regression failed', verifiedBy: 'test runner', observedAt: at, source });
    assert.equal((await read()).qualificationStatus, 'green'); // proposal is not proof
    await act({ type: 'evidence.approve', gateId: 'g', criterionId: 'c', id: 'e2', reviewerId: 'owner',
        reviewedAt: later, currentSource: source });
    assert.equal((await read()).qualificationStatus, 'not-green');
    await act({ type: 'criterion.edit', gateId: 'g', id: 'c', title: 'Check revised', expectedResult: 'New value' });
    assert.equal((await read()).qualificationStatus, 'stale');
    assert.match((await read()).criteria[0].evidence[0].validation!.reason, /definition changed/);
    await act({ type: 'gate.source', id: 'g', source: { ...source, revision: 8, sha256: hash('source eight') } });
    assert.equal((await read()).qualificationStatus, 'stale');
    await act({ type: 'evidence.revoke', gateId: 'g', criterionId: 'c', id: 'e2', reviewerId: 'owner', reviewedAt: later });
    assert.equal((await read()).criteria[0].evidence[1].review.status, 'revoked');
    const revisedSource = { ...source, revision: 8, sha256: hash('source eight') };
    await act({ type: 'evidence.propose', gateId: 'g', criterionId: 'c', id: 'e3', result: 'pass', kind: 'test',
        summary: 'Retest revised criterion', verifiedBy: 'test runner', observedAt: at, source: revisedSource });
    await act({ type: 'evidence.approve', gateId: 'g', criterionId: 'c', id: 'e3', reviewerId: 'owner',
        reviewedAt: later, currentSource: revisedSource });
    assert.equal((await read()).qualificationStatus, 'green');
    await act({ type: 'evidence.revoke', gateId: 'g', criterionId: 'c', id: 'e3', reviewerId: 'owner', reviewedAt: later });
    assert.equal((await read()).qualificationStatus, 'stale');
    const unchanged = hash(await readFile(file, 'utf8'));
    await assert.rejects(store.mutateGateIndex(root, revision - 1, 'owner', { type: 'evidence.revoke',
        gateId: 'g', criterionId: 'c', id: 'e1', reviewerId: 'owner', reviewedAt: later }), /Stale/);
    assert.equal(hash(await readFile(file, 'utf8')), unchanged);
}));

test('source-free manual check requires action and separate responsible approval', async () => fixture(async (root, store) => {
    await assert.rejects(store.mutateGateIndex(root, 1, 'owner', { type: 'evidence.propose', gateId: 'g',
        criterionId: 'c', id: 'manual', result: 'pass', kind: 'manual-check', summary: 'Observed UI',
        verifiedBy: 'observer', observedAt: at }), /evidence fields/);
    await store.mutateGateIndex(root, 1, 'owner', { type: 'evidence.propose', gateId: 'g',
        criterionId: 'c', id: 'manual', result: 'pass', kind: 'manual-check', summary: 'Observed UI',
        verifiedBy: 'observer', observedAt: at, observedAction: 'Opened Gate and checked the response' });
    const result = await store.mutateGateIndex(root, 2, 'owner', { type: 'evidence.approve', gateId: 'g',
        criterionId: 'c', id: 'manual', reviewerId: 'responsible-owner', reviewedAt: later });
    assert.equal(result.gates[0].qualificationStatus, 'green');
    assert.deepEqual((await new RoadmapStore().read<RoadmapGateIndex>(root)).gates[0].criteria[0].evidence[0].review,
        { status: 'approved', reviewerId: 'responsible-owner', reviewedAt: later });
    const revoked = await store.mutateGateIndex(root, 3, 'owner', { type: 'evidence.revoke', gateId: 'g',
        criterionId: 'c', id: 'manual', reviewerId: 'responsible-owner', reviewedAt: later });
    assert.equal(revoked.gates[0].qualificationStatus, 'unknown');
}));
