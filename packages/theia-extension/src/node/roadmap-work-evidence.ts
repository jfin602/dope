import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { AgentStore } from '@dope/agent-core/lib/node/agent-store';
import { projectPath } from '@dope/agent-core';
import { captureGitBasis } from '@dope/agent-core/lib/node/git-evidence';
import { RoadmapStore } from '@dope/project-intelligence/lib/node/roadmap-store';
import type { GateEvidence, RoadmapGateIndex, RoadmapSourceProof } from '@dope/project-intelligence/lib/node/roadmap-gate-domain';

const digest = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
const sha = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const gitHead = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{40}$/u.test(value);
const identity = (value: unknown): value is string => typeof value === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/u.test(value);
const time = (value: unknown): value is string => typeof value === 'string' &&
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/u.test(value) && !Number.isNaN(Date.parse(value));

export interface CriterionEvidenceTarget {
    projectId: string; phaseId: string; gateId: string; criterionId: string; workItemId: string;
    /** Stable caller event ID. Retries of the same verified event return its existing proposal. */
    eventId: string; reviewerId: string; reviewedAt: string; scope: string;
    /** Explicit human verification that the named Criterion assertion held or failed. Never model prose. */
    assertion: string;
}
export interface ValidationEvidenceRequest extends CriterionEvidenceTarget {
    runId: string; validationIndex: number;
}
export interface ObservationEvidenceRequest extends CriterionEvidenceTarget {
    result: 'pass' | 'fail' | 'inconclusive'; testedHead: string;
    observedAt: string; method: string; artifactSha256: string; artifactLocation: string;
}

/** Reads only canonical owners, then appends a proposed receipt to the existing Gate evidence owner. */
export class RoadmapWorkEvidenceIntake {
    constructor(private readonly roadmap: RoadmapStore, private readonly agents: AgentStore,
        private readonly currentHead: (root: string) => Promise<string | null> =
            async root => (await captureGitBasis(root)).head) {}

    private async basis(root: string, input: CriterionEvidenceTarget): Promise<{
        index: RoadmapGateIndex; source: RoadmapSourceProof }> {
        if (!identity(input.projectId) || !identity(input.phaseId) || !identity(input.gateId) ||
            !identity(input.criterionId) || !identity(input.workItemId) || !identity(input.eventId) ||
            !identity(input.reviewerId) || !time(input.reviewedAt) ||
            typeof input.scope !== 'string' || !input.scope.trim() || input.scope.length > 1024 ||
            typeof input.assertion !== 'string' || !input.assertion.trim() || input.assertion.length > 4096)
            throw new Error('Incomplete Criterion evidence review');
        const index = await this.roadmap.read<RoadmapGateIndex>(root);
        if (index.projectRoot !== root || index.projectId !== input.projectId || !index.revision)
            throw new Error('Foreign Roadmap evidence owner');
        const phase = index.phases.find(item => item.id === input.phaseId);
        const gate = index.gates.find(item => item.id === input.gateId && item.parentPhaseId === input.phaseId);
        const link = phase?.workLinks?.find(item => item.workItemId === input.workItemId &&
            item.criterionIds.includes(input.criterionId));
        if (!phase?.planningLock || phase.planningLock.lockedBy !== input.reviewerId ||
            !gate?.criteria.some(item => item.id === input.criterionId) ||
            !link)
            throw new Error('Criterion is not linked to reviewed Phase Work');
        const source = phase.planningLock.source;
        if (source.projectId !== input.projectId || !sha(source.sha256) ||
            index.linkedDocument && (index.linkedDocument.syncState !== 'synced' ||
                index.linkedDocument.path !== source.path || index.linkedDocument.sourceHash !== source.sha256))
            throw new Error('Locked Roadmap source is stale');
        if (source.path) {
            const path = join(root, projectPath(source.path));
            if (!(await lstat(path)).isFile() || await realpath(path) !== path ||
                digest(await readFile(path)) !== source.sha256)
                throw new Error('Locked Roadmap source bytes changed');
        }
        return { index, source };
    }

    private async append(root: string, input: CriterionEvidenceTarget, index: RoadmapGateIndex,
        source: RoadmapSourceProof, result: GateEvidence['result'], kind: GateEvidence['kind'],
        receipt: NonNullable<GateEvidence['receipt']>): Promise<GateEvidence> {
        const existing = index.gates.flatMap(g => g.criteria.flatMap(c => c.evidence))
            .find(item => item.id === input.eventId);
        if (existing) {
            if (existing.criterionId !== input.criterionId || existing.result !== result ||
                JSON.stringify(existing.receipt) !== JSON.stringify(receipt))
                throw new Error('Evidence event ID was already used');
            return existing;
        }
        const after = await this.roadmap.mutateGateIndex(root, index.revision, input.projectId, {
            type: 'evidence.propose', gateId: input.gateId, criterionId: input.criterionId,
            id: input.eventId, result, kind, summary: 'Reviewed Criterion assertion recorded',
            verifiedBy: input.reviewerId, observedAt: receipt.recordedAt, source, receipt });
        return after.gates.find(g => g.id === input.gateId)!.criteria.find(c => c.id === input.criterionId)!
            .evidence.find(e => e.id === input.eventId)!;
    }

    async ingestValidation(root: string, input: ValidationEvidenceRequest): Promise<GateEvidence> {
        const { index, source } = await this.basis(root, input);
        if (!identity(input.runId) || !Number.isSafeInteger(input.validationIndex) || input.validationIndex < 0)
            throw new Error('Invalid AgentRun validation reference');
        const run = await this.agents.readRun(root, input.runId);
        const task = run && await this.agents.readTask(root, run.taskId);
        const origin = task?.origin.kind === 'work-item' ? task.origin : undefined;
        if (!run || !task || task.origin.kind !== 'work-item' ||
            !origin || run.projectId !== origin.projectId || task.projectId !== origin.projectId ||
            origin.workItemId !== input.workItemId ||
            task.reviewPolicy?.kind !== 'required' ||
            !index.phases.find(p => p.id === input.phaseId)?.workLinks?.some(link =>
                link.planningProjectId === origin.projectId && link.workItemId === input.workItemId &&
                link.mapId === origin.planningMapId &&
                link.mapRevision === origin.mapRevision && JSON.stringify(link.basis) === JSON.stringify(origin.basis) &&
                link.criterionIds.includes(input.criterionId)) ||
            run.taskId !== task.id || !identity(run.grantId) || run.grantRevision < 0 ||
            run.status !== 'completed' || run.outcome || !run.basis?.head || !gitHead(run.basis.head) ||
            !run.basis.clean || run.validationBasis !== 'execution-workspace' ||
            !run.finalGit?.head || run.finalGit.head !== run.basis.head || run.finalGit.headChanged ||
            !run.reviewDecision || run.reviewDecision.kind !== 'accept' ||
            run.reviewDecision.candidateFingerprint !== run.candidateFingerprint ||
            !run.authorityDecision?.allowed || !run.appliedFiles?.length || !run.candidateDelta?.effects.length ||
            run.appliedFiles.length !== run.candidateDelta.effects.length ||
            run.candidateReview?.candidateFingerprint !== run.candidateFingerprint ||
            !sha(run.candidateFingerprint)) throw new Error('Unaccepted or foreign Work candidate');
        const validation = run.validationResults[input.validationIndex];
        const expected = index.gates.find(g => g.id === input.gateId)!.criteria.find(c => c.id === input.criterionId)!.expectedResult;
        if (!validation || validation.owner !== 'dope' || validation.kind !== 'test' ||
            validation.status !== 'passed' ||
            !input.assertion.includes(expected) || !time(run.endedAt) || input.reviewedAt < run.endedAt ||
            validation.exitCode !== 0 || !validation.command ||
            validation.candidateFingerprint !== run.candidateFingerprint ||
            !validation.workspaceId || validation.workspaceId !== run.executionWorkspace?.id ||
            !run.candidateReview.validation.some(item => JSON.stringify(item) === JSON.stringify(validation)) ||
            !task.completion.validation.some(target => target.kind === validation.kind &&
                target.label === validation.label && target.command === validation.command) ||
            !validation.stdout || validation.stdoutTruncated || validation.stderrTruncated ||
            !validation.stdout.split(/\r?\n/u).some(line => line.startsWith('ok ') && line.includes(expected)) ||
            !/^# pass [1-9]\d*$/mu.test(validation.stdout) || !/^# fail 0$/mu.test(validation.stdout))
            throw new Error('Dope validation is missing, partial or failed');
        // Accepted candidate bytes must still match the tested bytes. A HEAD alone is insufficient.
        if (await realpath(root) !== root || await this.currentHead(root) !== run.basis.head)
            throw new Error('Tested Git source changed');
        for (const effect of run.candidateDelta.effects) {
            if (!sha(effect.after) || !run.appliedFiles.includes(effect.path))
                throw new Error('Candidate promotion evidence incomplete');
            const path = join(root, projectPath(effect.path));
            if (!(await lstat(path)).isFile() || await realpath(path) !== path ||
                digest(await readFile(path)) !== effect.after)
                throw new Error('Accepted candidate bytes changed');
        }
        const receipt: NonNullable<GateEvidence['receipt']> = {
            eventId: input.eventId, origin: 'dope-validation', ownerId: input.projectId,
            workOwnerId: origin.projectId,
            phaseId: input.phaseId, gateId: input.gateId, workItemId: input.workItemId,
            taskId: task.id, runId: run.id, grantId: run.grantId, testedHead: run.basis.head,
            candidateFingerprint: run.candidateFingerprint!, method: validation.kind,
            artifactSha256: digest(JSON.stringify(validation)),
            artifactLocation: `agent-run/${run.id}/validation/${input.validationIndex}`,
            assertionSha256: digest(input.assertion), scope: input.scope,
            recordedAt: run.endedAt!, reviewerId: input.reviewerId,
            reviewedAt: input.reviewedAt };
        return this.append(root, input, index, source, 'pass', 'test', receipt);
    }

    async ingestObservation(root: string, input: ObservationEvidenceRequest): Promise<GateEvidence> {
        const { index, source } = await this.basis(root, input);
        if (!gitHead(input.testedHead) || !sha(input.artifactSha256) || !time(input.observedAt) ||
            !['pass', 'fail', 'inconclusive'].includes(input.result) ||
            typeof input.method !== 'string' || !input.method.trim() || input.method.length > 256 ||
            typeof input.artifactLocation !== 'string' || !input.artifactLocation.trim() ||
            input.artifactLocation.length > 512 || !/^\d{4}/u.test(input.reviewedAt) ||
            input.reviewedAt < input.observedAt)
            throw new Error('Incomplete reviewed human observation');
        const location = join(root, projectPath(input.artifactLocation));
        if (!(await lstat(location)).isFile() || await realpath(location) !== location ||
            digest(await readFile(location)) !== input.artifactSha256)
            throw new Error('Observation artifact digest changed');
        if (await realpath(root) !== root || await this.currentHead(root) !== input.testedHead)
            throw new Error('Observed Git source changed');
        const receipt: NonNullable<GateEvidence['receipt']> = {
            eventId: input.eventId, origin: 'reviewed-observation', ownerId: input.projectId,
            phaseId: input.phaseId, gateId: input.gateId, workItemId: input.workItemId,
            testedHead: input.testedHead, method: input.method,
            artifactSha256: input.artifactSha256, artifactLocation: input.artifactLocation,
            assertionSha256: digest(input.assertion),
            scope: input.scope, recordedAt: input.observedAt, reviewerId: input.reviewerId,
            reviewedAt: input.reviewedAt };
        return this.append(root, input, index, source, input.result, 'observation', receipt);
    }
}
