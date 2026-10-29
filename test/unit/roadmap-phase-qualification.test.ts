import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { evaluatePhaseQualification } from '../../packages/project-intelligence/lib/node/roadmap-gate-domain.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const source = { projectId: 'owner-1', revision: 7, sha256: hash('tested project source') };
const laterSource = { ...source, revision: 8, sha256: hash('changed project source') };
const at = '2026-10-29T12:00:00Z';

async function fixture(run: (env: {
    root: string; store: RoadmapStore; act: (operation: Parameters<RoadmapStore['mutateGateIndex']>[3]) =>
        ReturnType<RoadmapStore['mutateGateIndex']>; read: () => ReturnType<RoadmapStore['read']>;
}) => Promise<void>) {
    const root = await mkdtemp(join(tmpdir(), 'dope-phase-qualification-'));
    const store = new RoadmapStore();
    try {
        await store.saveGateIndex(root, 0, 'uninitialized', { schemaVersion: 2, projectId: 'owner-1',
            projectRoot: root, revision: 1, phases: [{ id: 'p1', projectId: 'owner-1', title: 'Phase One',
                objective: 'Qualify the outcome', order: 0, dependencies: [], implementationStatus: 'unknown',
                qualificationStatus: 'unknown', draftAcceptance: 'accepted', gateSetCoverage: { status: 'unreviewed' } }],
            gates: [], corrections: [] });
        let revision = 1;
        const act = async (operation: Parameters<RoadmapStore['mutateGateIndex']>[3]) => {
            const next = await store.mutateGateIndex(root, revision, 'owner-1', operation);
            revision = next.revision;
            return next;
        };
        const read = () => new RoadmapStore().read<Awaited<ReturnType<typeof act>>>(root);
        await run({ root, store, act, read });
    } finally { await rm(root, { recursive: true, force: true }); }
}

const createGate = (id: string, designation: string) => ({ type: 'gate.create' as const, id,
    parentPhaseId: 'p1', designation, title: `Verify ${id}`, purpose: `Check ${id}`,
    criteria: [{ id: `${id}-c`, title: `Observe ${id}`, expectedResult: `${id} passes` }] });
const approveCoverage = (requiredGateIds: string[]) => ({ type: 'phase.coverage.approve' as const,
    id: 'p1', requiredGateIds, approvedBy: 'developer-1', reviewedAt: at, source });
async function passGate(act: (operation: Parameters<RoadmapStore['mutateGateIndex']>[3]) => Promise<unknown>, id: string) {
    await act({ type: 'evidence.propose', gateId: id, criterionId: `${id}-c`, id: `${id}-e`,
        result: 'pass', kind: 'test', summary: `${id} passed`, verifiedBy: 'focused-test', observedAt: at, source });
    await act({ type: 'evidence.approve', gateId: id, criterionId: `${id}-c`, id: `${id}-e`,
        reviewerId: 'developer-1', reviewedAt: at, currentSource: source });
}

test('zero Gates are Unplanned; one and many accepted Gates are only Planned without coverage', async () => fixture(async ({ act, read }) => {
    let index = await read();
    assert.deepEqual(evaluatePhaseQualification(index, 'p1', source), {
        status: 'unplanned', qualified: 0, required: 0,
        reasons: ['Phase has no accepted Gates', 'Complete required Gate set is not approved'] });
    await assert.rejects(act(approveCoverage([])), /complete nonempty required Gate set/);
    await assert.rejects(act({ type: 'phase.waiver.approve', id: 'p1', authorizedBy: 'developer-1',
        authorizedAt: at, reason: 'No requirements', source }), /Unplanned Phase/);
    index = await act(createGate('g1', 'G1'));
    assert.equal(evaluatePhaseQualification(index, 'p1', source).status, 'planned');
    await passGate(act, 'g1');
    index = await read();
    assert.equal(index.gates[0].qualificationStatus, 'green');
    assert.equal(evaluatePhaseQualification(index, 'p1', source).status, 'planned');
    assert.equal(index.phases[0].qualificationStatus, 'unknown');
    index = await act(createGate('g2', 'G2'));
    assert.equal(evaluatePhaseQualification(index, 'p1', source).required, 2);
    await assert.rejects(act(approveCoverage(['g1'])), /complete nonempty required Gate set/);
}));

test('reviewed complete set and all current Gate evidence permit Green; review provenance persists', async () => fixture(async ({ act, read, root, store }) => {
    await act(createGate('g1', 'G1'));
    await act(createGate('g2', 'G2'));
    await passGate(act, 'g1');
    await passGate(act, 'g2');
    let index = await read();
    assert.equal(evaluatePhaseQualification(index, 'p1', source).status, 'planned');
    index = await act(approveCoverage(['g2', 'g1']));
    assert.equal(index.phases[0].qualificationStatus, 'green');
    assert.deepEqual(evaluatePhaseQualification(index, 'p1', source), { status: 'green', qualified: 2, required: 2, reasons: [] });
    assert.equal(index.phases[0].gateSetCoverage.status, 'approved');
    if (index.phases[0].gateSetCoverage.status === 'approved') {
        assert.deepEqual(index.phases[0].gateSetCoverage.requiredGateIds, ['g1', 'g2']);
        assert.equal(index.phases[0].gateSetCoverage.approvedBy, 'developer-1');
        assert.equal(index.phases[0].gateSetCoverage.approvedAtRevision, index.revision);
    }
    assert.equal((await read()).phases[0].qualificationStatus, 'green');
    assert.equal(evaluatePhaseQualification(index, 'p1', laterSource).status, 'stale');
    assert.deepEqual(evaluatePhaseQualification(index, 'p1', laterSource).reasons,
        ['Phase source changed since Gate-set approval', 'g1: stale (g1-c: Tested source changed)',
            'g2: stale (g2-c: Tested source changed)']);
    const file = join(root, '.dope', 'roadmap.json');
    const before = hash(await readFile(file, 'utf8'));
    const forged = structuredClone(index);
    forged.revision++;
    forged.phases[0].gateSetCoverage = { status: 'unreviewed' };
    forged.phases[0].qualificationStatus = 'green';
    await assert.rejects(store.saveGateIndex(root, index.revision, 'owner-1', forged), /unverified Phase Green/);
    assert.equal(hash(await readFile(file, 'utf8')), before);
}));

test('blocker, explicit waiver and source revision never launder Gate or Phase Green', async () => fixture(async ({ act, read }) => {
    await act(createGate('g1', 'G1'));
    await passGate(act, 'g1');
    await act(approveCoverage(['g1']));
    let index = await act({ type: 'phase.blockers', id: 'p1', reasons: ['Owner signoff missing'] });
    assert.equal(index.phases[0].qualificationStatus, 'blocked');
    assert.match(evaluatePhaseQualification(index, 'p1', source).reasons.join(' '), /Phase blocker: Owner signoff missing/);
    index = await act({ type: 'phase.waiver.approve', id: 'p1', authorizedBy: 'developer-1',
        authorizedAt: at, reason: 'Explicit exceptional disposition', source });
    assert.equal(index.phases[0].qualificationStatus, 'waived');
    assert.equal(evaluatePhaseQualification(index, 'p1', source).status, 'waived');
    assert.match(evaluatePhaseQualification(index, 'p1', source).reasons.join(' '), /Exceptional Phase waiver/);
    index = await act({ type: 'phase.waiver.revoke', id: 'p1' });
    assert.equal(index.phases[0].qualificationStatus, 'blocked');
    index = await act({ type: 'phase.blockers', id: 'p1', reasons: [] });
    assert.equal(index.phases[0].qualificationStatus, 'green');
    index = await act({ type: 'phase.source', id: 'p1', source: laterSource });
    assert.equal(index.phases[0].gateSetCoverage.status, 'unreviewed');
    assert.equal(index.phases[0].qualificationStatus, 'stale');
    assert.equal((await read()).phases[0].qualificationStatus, 'stale');
}));

test('new Gate, criterion revision and evidence revocation invalidate prior Phase Green', async () => fixture(async ({ act, read }) => {
    await act(createGate('g1', 'G1'));
    await passGate(act, 'g1');
    await act(approveCoverage(['g1']));
    let index = await act(createGate('g2', 'G2'));
    assert.equal(index.phases[0].gateSetCoverage.status, 'unreviewed');
    assert.equal(index.phases[0].qualificationStatus, 'stale');
    await passGate(act, 'g2');
    index = await act(approveCoverage(['g1', 'g2']));
    assert.equal(index.phases[0].qualificationStatus, 'green');
    index = await act({ type: 'evidence.revoke', gateId: 'g1', criterionId: 'g1-c', id: 'g1-e',
        reviewerId: 'developer-1', reviewedAt: at });
    assert.equal(index.phases[0].qualificationStatus, 'stale');
    assert.equal(index.phases[0].gateSetCoverage.status, 'approved');
    index = await act({ type: 'criterion.edit', gateId: 'g2', id: 'g2-c', title: 'New observation',
        expectedResult: 'New result' });
    assert.equal(index.phases[0].gateSetCoverage.status, 'unreviewed');
    assert.notEqual(index.phases[0].qualificationStatus, 'green');
    assert.equal((await read()).gates.find(gate => gate.id === 'g2')?.qualificationStatus, 'stale');
}));

test('a persisted waived Gate is never counted Green even with current passing evidence', async () => fixture(async ({ act, read, store, root }) => {
    await act(createGate('g1', 'G1'));
    await passGate(act, 'g1');
    let index = await act(approveCoverage(['g1']));
    assert.equal(index.phases[0].qualificationStatus, 'green');
    index = await act({ type: 'gate.waiver.approve', id: 'g1', authorizedBy: 'developer-1',
        authorizedAt: at, reason: 'Explicit Gate exception', source });
    assert.equal(index.gates[0].qualificationStatus, 'waived');
    assert.equal(index.phases[0].qualificationStatus, 'stale');
    assert.deepEqual(evaluatePhaseQualification(await read(), 'p1', source), {
        status: 'not-green', qualified: 0, required: 1,
        reasons: ['g1: waived (Exceptional Gate waiver: Explicit Gate exception)'] });
    const candidate = structuredClone(index);
    candidate.revision++;
    delete candidate.gates[0].waiver;
    candidate.gates[0].qualificationStatus = 'green';
    await assert.rejects(store.saveGateIndex(root, index.revision, 'owner-1', candidate), /typed review operations/);
    index = await act({ type: 'phase.edit', id: 'p1', title: 'Phase One', objective: 'New requirement' });
    assert.equal(index.phases[0].gateSetCoverage.status, 'unreviewed');
    assert.equal(index.phases[0].qualificationStatus, 'stale');
}));

test('foreign, incomplete, stale and forged coverage approvals leave persisted bytes unchanged', async () => fixture(async ({ act, read, root, store }) => {
    await act(createGate('g1', 'G1'));
    const file = join(root, '.dope', 'roadmap.json');
    const current = await read();
    const before = hash(await readFile(file, 'utf8'));
    await assert.rejects(store.mutateGateIndex(root, current.revision, 'foreign', approveCoverage(['g1'])), /identity changed/);
    await assert.rejects(store.mutateGateIndex(root, current.revision - 1, 'owner-1', approveCoverage(['g1'])), /Stale/);
    await assert.rejects(act({ ...approveCoverage(['g1']), source: { ...source, projectId: 'foreign' } }), /Foreign Phase approval source/);
    await assert.rejects(act(approveCoverage(['g1', 'foreign-gate'])), /complete nonempty required Gate set/);
    assert.equal(hash(await readFile(file, 'utf8')), before);
    const forged = structuredClone(current);
    forged.revision++;
    forged.phases[0].gateSetCoverage = { status: 'approved', approvedBy: 'attacker', reviewedAt: at,
        approvedAtRevision: forged.revision, requiredGateIds: ['g1'], source };
    await assert.rejects(store.saveGateIndex(root, current.revision, 'owner-1', forged), /typed review operations/);
    assert.equal(hash(await readFile(file, 'utf8')), before);
}));
