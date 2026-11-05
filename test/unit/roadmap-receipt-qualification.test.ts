import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { criterionHash, evaluateGateQualification, evaluatePhaseQualification, phaseCloseoutEligibility } from
    '../../packages/project-intelligence/lib/node/roadmap-gate-domain.js';
import type { GateEvidence, RoadmapGateIndex } from
    '../../packages/project-intelligence/src/node/roadmap-gate-domain.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const source = { projectId: 'owner', revision: 1, sha256: hash('source') };
const at = '2026-11-05T12:00:00Z';
const later = '2026-11-05T12:01:00Z';
const criterion = { id: 'c', projectId: 'owner', title: 'Checks', expectedResult: 'Observable result',
    order: 0, evidence: [] as GateEvidence[] };

function fixture(): RoadmapGateIndex {
    return { schemaVersion: 2, projectId: 'owner', projectRoot: '/tmp/receipt-qualification', revision: 2,
        phases: [{ id: 'p', projectId: 'owner', title: 'Phase', objective: 'Deliver', order: 0,
            dependencies: [], implementationStatus: 'implemented', qualificationStatus: 'unknown',
            draftAcceptance: 'accepted', gateSetCoverage: { status: 'approved', approvedBy: 'owner',
                reviewedAt: at, approvedAtRevision: 1, requiredGateIds: ['g'], source },
            planningLock: { approvalId: 'lock', lockedBy: 'owner', lockedAt: at, basisRevision: 1,
                requiredGateIds: ['g'], criteria: [{ id: 'c', expectedResult: criterion.expectedResult }], source },
            qualificationSource: source,
            workLinks: ['w1', 'w2'].map(workItemId => ({ planningProjectId: 'planning', mapId: 'map',
                mapRevision: 1, basis: { architectureRevision: 1, architectureFingerprint: 'a',
                    physicalInputFingerprint: 'b', physicalGeneration: 1 }, workItemId,
                transformationIds: ['t'], criterionIds: ['c'],
                requiredChecks: workItemId === 'w1' ? ['unit', 'integration'] : ['unit'] })) }],
        gates: [{ id: 'g', projectId: 'owner', parentPhaseId: 'p', designation: 'G1', title: 'Gate',
            purpose: 'Verify', order: 0, dependencies: [], criteria: [{ ...criterion, evidence: [] }],
            implementationStatus: 'implemented', qualificationStatus: 'unknown', draftAcceptance: 'accepted',
            qualificationSource: source }], corrections: [] };
}

function receipt(workItemId: string, result: GateEvidence['result'] = 'pass', checkId = 'unit'): GateEvidence {
    const id = `event-${workItemId}-${checkId}`;
    return { id, projectId: 'owner', criterionId: 'c', result, kind: 'test', summary: 'Checked assertion',
        verifiedBy: 'owner', observedAt: at, source, criterionHash: criterionHash(criterion),
        review: { status: 'approved', reviewerId: 'owner', reviewedAt: later },
        receipt: { eventId: id, origin: 'dope-validation', ownerId: 'owner', workOwnerId: 'planning',
            phaseId: 'p', gateId: 'g', workItemId, taskId: 'task', runId: 'run', grantId: 'grant',
            testedHead: 'a'.repeat(40), candidateFingerprint: hash('candidate'), method: 'test', checkId,
            artifactSha256: hash('artifact'), artifactLocation: 'agent-run/run/validation/0',
            assertionSha256: hash('actual assertion'), scope: 'criterion c', recordedAt: at,
            reviewerId: 'owner', reviewedAt: later } };
}

test('locked Phase requires each linked checked receipt and current approval', () => {
    const index = fixture();
    const phase = index.phases[0], gate = index.gates[0];
    assert.equal(evaluatePhaseQualification(index, 'p', source).status, 'not-green');
    gate.criteria[0].evidence.push(receipt('w1'));
    assert.equal(evaluateGateQualification(gate, source, phase).status, 'unknown');
    assert.equal(evaluatePhaseQualification(index, 'p', source).qualified, 0);
    gate.criteria[0].evidence.push(receipt('w2'));
    assert.equal(evaluateGateQualification(gate, source, phase).status, 'unknown');
    gate.criteria[0].evidence.push(receipt('w1', 'pass', 'integration'));
    assert.equal(evaluatePhaseQualification(index, 'p', source).status, 'green');
    assert.equal(evaluatePhaseQualification(index, 'p', source).qualified, 1);
    assert.equal(phaseCloseoutEligibility(index, 'p', 'foreign', source).eligible, false);
    assert.equal(phaseCloseoutEligibility(index, 'p', 'owner', source).eligible, true);
    gate.criteria[0].evidence[1].review = { status: 'proposed' };
    assert.equal(evaluateGateQualification(gate, source, phase).status, 'unknown');
    gate.criteria[0].evidence[1].review = { status: 'approved', reviewerId: 'owner', reviewedAt: later };
    gate.criteria[0].evidence[1].result = 'fail';
    assert.equal(evaluateGateQualification(gate, source, phase).status, 'not-green');
    gate.criteria[0].evidence[1].result = 'pass';
    assert.equal(evaluateGateQualification(gate, { ...source, revision: 2 }, phase).status, 'stale');
});

test('coverage, waiver and blockers remain independent of Work completion', () => {
    const index = fixture();
    const phase = index.phases[0], gate = index.gates[0];
    gate.criteria[0].evidence.push(receipt('w1'), receipt('w2'), receipt('w1', 'pass', 'integration'));
    phase.gateSetCoverage = { status: 'unreviewed' };
    assert.equal(evaluatePhaseQualification(index, 'p', source).status, 'planned');
    phase.gateSetCoverage = { status: 'approved', approvedBy: 'owner', reviewedAt: at,
        approvedAtRevision: 1, requiredGateIds: ['g'], source };
    gate.waiver = { authorizedBy: 'owner', authorizedAt: at, reason: 'Exception', source };
    assert.equal(evaluatePhaseQualification(index, 'p', source).qualified, 0);
    assert.equal(evaluatePhaseQualification(index, 'p', source).status, 'not-green');
    delete gate.waiver;
    phase.qualificationBlockers = ['Owner decision pending'];
    assert.equal(evaluatePhaseQualification(index, 'p', source).status, 'blocked');
    assert.equal(phaseCloseoutEligibility(index, 'p', 'owner', source).eligible, false);
    phase.qualificationBlockers = [];
    gate.qualificationBlockers = ['Required check blocked'];
    assert.equal(evaluatePhaseQualification(index, 'p', source).status, 'blocked');
    gate.qualificationBlockers = [];
    gate.criteria[0].evidence = [];
    assert.equal(evaluatePhaseQualification(index, 'p', source).status, 'not-green');
});
