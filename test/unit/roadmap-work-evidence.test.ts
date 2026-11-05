import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { RoadmapWorkEvidenceIntake } from '../../packages/theia-extension/lib/node/roadmap-work-evidence.js';
import { RoadmapStore as DurableRoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { criterionHash, evaluateGateQualification, parseRoadmapGateIndex } from '../../packages/project-intelligence/lib/node/roadmap-gate-domain.js';
import type { RoadmapGateIndex } from '../../packages/project-intelligence/src/node/roadmap-gate-domain.js';
import type { AgentRun, AgentTask } from '../../packages/agent-core/src/contracts.js';
import type { AgentStore } from '../../packages/agent-core/src/node/agent-store.js';
import type { RoadmapStore } from '../../packages/project-intelligence/src/node/roadmap-store.js';

const root = resolve('.');
const head = 'a'.repeat(40);
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const at = '2026-11-05T12:00:00Z';
const later = '2026-11-05T12:01:00Z';
const source = { projectId: 'owner', revision: 1, sha256: hash('roadmap source') };
const basis = { architectureRevision: 1, architectureFingerprint: 'architecture',
    physicalInputFingerprint: 'physical', physicalGeneration: 1 };
const target = { projectId: 'owner', phaseId: 'p', gateId: 'g', criterionId: 'c', workItemId: 'w',
    eventId: 'event-1', reviewerId: 'human-owner', reviewedAt: later,
    scope: 'Criterion c, source HEAD and accepted candidate', assertion: 'Value present was observed' };

async function harness(projectRoot = root) {
    const bytes = await readFile(resolve(projectRoot, 'BOOT.md'));
    const index: RoadmapGateIndex = { schemaVersion: 2, projectId: 'owner', projectRoot, revision: 1,
        phases: [{ id: 'p', projectId: 'owner', title: 'Phase', objective: 'Deliver', order: 0,
            dependencies: [], implementationStatus: 'active', qualificationStatus: 'unknown',
            draftAcceptance: 'accepted', gateSetCoverage: { status: 'approved', requiredGateIds: ['g'],
                approvedBy: 'human-owner', reviewedAt: at, approvedAtRevision: 1, source },
            planningLock: { approvalId: 'approval', lockedBy: 'human-owner', lockedAt: at,
                basisRevision: 1, requiredGateIds: ['g'], criteria: [{ id: 'c', expectedResult: 'Value present' }], source },
            workLinks: [{ planningProjectId: 'planning', mapId: 'map', mapRevision: 1, basis,
                workItemId: 'w', transformationIds: ['transformation'], criterionIds: ['c'] }] }],
        gates: [{ id: 'g', projectId: 'owner', parentPhaseId: 'p', designation: 'G1', title: 'Gate',
            purpose: 'Check value', order: 0, dependencies: [], implementationStatus: 'active',
            qualificationStatus: 'unknown', draftAcceptance: 'accepted',
            criteria: [{ id: 'c', projectId: 'owner', title: 'Check', expectedResult: 'Value present', order: 0, evidence: [] }] }],
        corrections: [] };
    const task = { id: 'task', projectId: 'planning', reviewPolicy: { kind: 'required' },
        completion: { validation: [{ kind: 'test', label: 'test', command: 'node --test' }] },
        origin: { kind: 'work-item', projectId: 'planning', workItemId: 'w', planningMapId: 'map', mapRevision: 1, basis } } as AgentTask;
    const validation = { version: 1, kind: 'test', label: 'test', command: 'node --test', owner: 'dope',
        status: 'passed', exitCode: 0, candidateFingerprint: hash('candidate'), workspaceId: 'workspace',
        stdout: 'ok 1 - Value present\n# pass 1\n# fail 0\ntoken [redacted]' } as const;
    const run = { id: 'run', taskId: 'task', projectId: 'planning', grantId: 'grant', grantRevision: 0,
        status: 'completed', basis: { head, clean: true }, validationBasis: 'execution-workspace',
        finalGit: { head, headChanged: false },
        executionWorkspace: { id: 'workspace' }, candidateFingerprint: hash('candidate'),
        candidateReview: { candidateFingerprint: hash('candidate'), validation: [validation] },
        reviewDecision: { kind: 'accept', candidateFingerprint: hash('candidate') },
        authorityDecision: { allowed: true }, appliedFiles: ['BOOT.md'],
        candidateDelta: { effects: [{ kind: 'modify', path: 'BOOT.md', after: hash(bytes) }] },
        validationResults: [validation], endedAt: at } as AgentRun;
    const roadmap = { read: async () => index,
        mutateGateIndex: async (_root: string, revision: number, owner: string, operation: any) => {
            assert.equal(revision, index.revision); assert.equal(owner, index.projectId);
            const criterion = index.gates[0].criteria[0];
            criterion.evidence.push({ id: operation.id, projectId: owner, criterionId: criterion.id,
                result: operation.result, kind: operation.kind, summary: operation.summary,
                verifiedBy: operation.verifiedBy, observedAt: operation.observedAt,
                source: operation.source, receipt: operation.receipt,
                criterionHash: criterionHash(criterion), review: { status: 'proposed' } });
            index.revision++;
            parseRoadmapGateIndex(index, root, 'owner');
            return index;
        } } as unknown as RoadmapStore;
    const agents = { readRun: async (_root: string, id: string) => id === 'run' ? run : undefined,
        readTask: async (_root: string, id: string) => id === 'task' ? task : undefined } as AgentStore;
    return { intake: new RoadmapWorkEvidenceIntake(roadmap, agents, async () => head), index, run, task, validation,
        agents };
}

test('checked AgentRun receipt is proposed, idempotent and contains safe provenance', async () => {
    const { intake, index } = await harness();
    const request = { ...target, runId: 'run', validationIndex: 0 };
    const receipt = await intake.ingestValidation(root, request);
    assert.equal(receipt.review.status, 'proposed');
    assert.equal(receipt.receipt?.origin, 'dope-validation');
    assert.equal(receipt.receipt?.workOwnerId, 'planning');
    assert.equal(receipt.receipt?.candidateFingerprint, hash('candidate'));
    assert.ok(!JSON.stringify(receipt).includes('token'));
    assert.equal(evaluateGateQualification(index.gates[0]).status, 'unknown');
    assert.equal((await intake.ingestValidation(root, request)).id, receipt.id);
    assert.equal(index.gates[0].criteria[0].evidence.length, 1);
    await assert.rejects(intake.ingestValidation(root, { ...request, assertion: 'Value present, different review' }), /already used/);
});

test('forged, foreign, ungranted, partial and unpromoted Work are denied', async () => {
    const { intake, run, task, validation } = await harness();
    const request = { ...target, runId: 'run', validationIndex: 0 };
    await assert.rejects(intake.ingestValidation(root, { ...request, runId: 'forged' }), /Unaccepted/);
    await assert.rejects(intake.ingestValidation(root, { ...request, projectId: 'foreign' }), /Foreign/);
    run.projectId = 'foreign';
    await assert.rejects(intake.ingestValidation(root, request), /Unaccepted/);
    run.projectId = 'planning';
    run.grantId = '';
    await assert.rejects(intake.ingestValidation(root, request), /Unaccepted/);
    run.grantId = 'grant';
    validation.status = 'failed';
    await assert.rejects(intake.ingestValidation(root, request), /partial or failed/);
    validation.status = 'passed';
    run.validationBasis = undefined;
    await assert.rejects(intake.ingestValidation(root, request), /Unaccepted/);
    run.validationBasis = 'execution-workspace';
    validation.stdout = 'command exited successfully';
    await assert.rejects(intake.ingestValidation(root, request), /partial or failed/);
    validation.stdout = 'ok 1 - Value present\n# pass 1\n# fail 0\ntoken [redacted]';
    run.reviewDecision = undefined;
    await assert.rejects(intake.ingestValidation(root, request), /Unaccepted/);
    run.reviewDecision = { kind: 'accept', revision: 0, at, candidateFingerprint: hash('candidate') };
    task.origin = { ...task.origin, workItemId: 'other' } as AgentTask['origin'];
    await assert.rejects(intake.ingestValidation(root, request), /Unaccepted/);
});

test('human observation needs a current artifact and remains proposed for fail or pass', async () => {
    const { intake, index } = await harness();
    const artifactSha256 = hash(await readFile(resolve(root, 'BOOT.md')));
    const request = { ...target, observedAt: at, testedHead: head, result: 'fail' as const,
        method: 'manual browser replay', artifactLocation: 'BOOT.md', artifactSha256 };
    const receipt = await intake.ingestObservation(root, request);
    assert.equal(receipt.result, 'fail');
    assert.equal(receipt.review.status, 'proposed');
    assert.equal(evaluateGateQualification(index.gates[0]).status, 'unknown');
    await assert.rejects(intake.ingestObservation(root, { ...request, eventId: 'event-2',
        artifactSha256: hash('forged') }), /digest changed/);
    await assert.rejects(intake.ingestObservation(root, { ...request, eventId: 'event-2',
        reviewerId: '' }), /review/);
});

test('real Roadmap owner persists a proposed receipt without qualifying the Gate', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'dope-criterion-receipt-'));
    try {
        await writeFile(join(projectRoot, 'BOOT.md'), await readFile(join(root, 'BOOT.md')));
        const { agents } = await harness(projectRoot);
        const roadmap = new DurableRoadmapStore();
        let index = await roadmap.saveGateIndex(projectRoot, 0, 'uninitialized', {
            schemaVersion: 2, projectId: 'owner', projectRoot, revision: 1,
            phases: [], gates: [], corrections: [] });
        index = await roadmap.mutateGateIndex(projectRoot, index.revision, 'owner',
            { type: 'phase.create', id: 'p', title: 'Phase', objective: 'Deliver' });
        index = await roadmap.mutateGateIndex(projectRoot, index.revision, 'owner',
            { type: 'gate.create', id: 'g', parentPhaseId: 'p', designation: 'G1', title: 'Gate',
                purpose: 'Check value', criteria: [{ id: 'c', title: 'Check', expectedResult: 'Value present' }] });
        index = await roadmap.mutateGateIndex(projectRoot, index.revision, 'owner',
            { type: 'phase.coverage.approve', id: 'p', requiredGateIds: ['g'], approvedBy: 'human-owner',
                reviewedAt: at, source: { ...source, revision: index.revision } });
        index = await roadmap.finishPlanning(projectRoot,
            await roadmap.previewFinishPlanning(projectRoot, 'owner', index.revision, 'p'), true, 'human-owner');
        const planning = async () => ({ projectId: 'planning', revision: 1, maps: [{ id: 'map',
            projectId: 'planning', revision: 1, status: 'active', basis,
            transformations: [{ id: 'transformation' }], workItems: [{ id: 'w', title: 'Work', status: 'ready',
                transformationIds: ['transformation'], acceptanceCriteria: ['Value present'], validationTargets: ['test'] }] }] });
        index = await roadmap.applyPhaseWork(projectRoot,
            await roadmap.previewPhaseWork(projectRoot, 'owner', index.revision, 'p',
                [{ planningProjectId: 'planning', mapId: 'map', mapRevision: 1, basis,
                    workItemId: 'w', transformationIds: ['transformation'], criterionIds: ['c'] }], planning),
            true, 'human-owner', planning);
        const intake = new RoadmapWorkEvidenceIntake(roadmap, agents, async () => head);
        const receipt = await intake.ingestValidation(projectRoot, { ...target, runId: 'run', validationIndex: 0 });
        assert.equal(receipt.review.status, 'proposed');
        const saved = await new DurableRoadmapStore().read<RoadmapGateIndex>(projectRoot);
        assert.equal(saved.gates[0].criteria[0].evidence[0].id, target.eventId);
        assert.equal(saved.gates[0].qualificationStatus, 'unknown');
        assert.equal((await intake.ingestValidation(projectRoot, { ...target, runId: 'run', validationIndex: 0 })).id,
            target.eventId);
        assert.equal((await roadmap.read<RoadmapGateIndex>(projectRoot)).revision, saved.revision);
    } finally { await rm(projectRoot, { recursive: true, force: true }); }
});
