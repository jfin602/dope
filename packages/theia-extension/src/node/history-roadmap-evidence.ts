import type { HistoryEntry, HistoryProject } from '@dope/contracts/lib/history';
import type { RoadmapGateIndex } from '@dope/project-intelligence/lib/node/roadmap-gate-domain';

/** Derive events from archived owner revisions; replay and restart yield the same IDs. */
export function projectRoadmapEvidenceRevision(project: HistoryProject, before: RoadmapGateIndex | undefined,
    after: RoadmapGateIndex, occurredAt: string): HistoryEntry[] {
    if (!before || after.projectRoot !== project.projectRoot ||
        before.projectId !== after.projectId || before.projectRoot !== after.projectRoot ||
        before.revision + 1 !== after.revision) return [];
    const entries: HistoryEntry[] = [];
    const emit = (sourceId: string, title: string, label: string,
        evidence?: HistoryEntry['evidence']): void => {
        entries.push({ ...project, kind: 'event', source: 'roadmap', sourceId,
            owner: { kind: 'editor', projectRelativePath: '.dope/roadmap.json' },
            title, status: { kind: 'owner', label }, availability: 'available',
            ownerRevision: after.revision, ownerProjectId: after.projectId,
            occurredAt, observedAt: null, ...(evidence ? { evidence } : {}) });
    };
    for (const gate of after.gates) {
        if (gate.projectId !== after.projectId) continue;
        const priorGate = before?.gates.find(item => item.id === gate.id);
        for (const criterion of gate.criteria) {
            if (criterion.projectId !== after.projectId) continue;
            const prior = priorGate?.criteria.find(item => item.id === criterion.id);
            for (const item of criterion.evidence) {
                const receipt = item.receipt;
                if (!receipt || item.projectId !== after.projectId || receipt.ownerId !== after.projectId ||
                    receipt.phaseId !== gate.parentPhaseId || receipt.gateId !== gate.id ||
                    item.criterionId !== criterion.id || receipt.eventId !== item.id) continue;
                const previous = prior?.evidence.find(value => value.id === item.id);
                if (previous && JSON.stringify(previous.receipt) !== JSON.stringify(receipt)) continue;
                if (previous?.review.status === item.review.status) continue;
                const review = item.review.status;
                const safe = { receiptId: item.id, origin: receipt.origin, phaseId: receipt.phaseId,
                    gateId: gate.id, criterionId: criterion.id,
                    ...(receipt.workItemId ? { workItemId: receipt.workItemId } : {}),
                    ...(receipt.runId ? { runId: receipt.runId } : {}), artifactSha256: receipt.artifactSha256,
                    result: item.result, review };
                emit(`receipt:${item.id}:${review}:R${after.revision}`,
                    `Criterion evidence ${review}: ${item.result}`, `Evidence ${review}`, safe);
            }
        }
        if (priorGate && gate.qualificationStatus !== priorGate.qualificationStatus)
            emit(`gate-qualification:${gate.id}:R${after.revision}`,
                `Gate qualification: ${gate.qualificationStatus}`, 'Gate qualification projection');
    }
    for (const phase of after.phases) {
        const prior = before?.phases.find(item => item.id === phase.id);
        if (!prior) continue;
        if (phase.qualificationStatus !== prior.qualificationStatus)
            emit(`phase-qualification:${phase.id}:R${after.revision}`,
                `Phase qualification: ${phase.qualificationStatus}`, 'Phase qualification projection');
        if (phase.gateSetCoverage.status === 'approved' &&
            JSON.stringify(phase.gateSetCoverage) !== JSON.stringify(prior.gateSetCoverage))
            emit(`phase-coverage:${phase.id}:R${after.revision}`,
                'Phase Gate coverage reviewed', 'Owner coverage decision');
    }
    return entries;
}
