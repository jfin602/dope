import type { AgentRun, AgentMapImpact } from '@dope/agent-core';
import type { PhysicalMapSnapshot, SoftwareMapStatus } from '@dope/software-map';
import type { SoftwareMapIndex } from '@dope/code-analysis/lib/node/software-map-index';

type MapView = Pick<SoftwareMapIndex, 'status' | 'snapshot'>;

/** Resolve only existing physical identities. The source changed after this observation,
 * so evidence remains marked stale until a developer requests deterministic re-analysis. */
export function appliedMapImpact(run: AgentRun, index?: MapView, root?: string): AgentMapImpact {
    if (!run.authorityDecision?.allowed || !run.appliedFiles || !run.candidateDelta || !run.candidateFingerprint)
        throw new Error('Map impact requires authoritative promotion');
    const before: SoftwareMapStatus | undefined = index && root ? index.status(root) : undefined;
    const snapshot: PhysicalMapSnapshot | undefined = index && root ? index.snapshot(root) : undefined;
    const after: SoftwareMapStatus | undefined = index && root ? index.status(root) : undefined;
    const current = !!before && !!after && before.state === 'ready' &&
        before.generation === before.publishedGeneration && before.generation === after.generation &&
        after.state === 'ready' && after.publishedGeneration === after.generation &&
        snapshot?.metadata.generation === before.generation &&
        snapshot.metadata.inputFingerprint === before.inputFingerprint &&
        snapshot.metadata.projectId === 'project:root';
    const reason = !before || !snapshot ? 'missing-map' : 'stale-generation';
    const nodes = current ? new Map(snapshot!.nodes.map(node => [node.id, node] as const)) : undefined;
    const evidence = current ? new Map(snapshot!.evidence.map(item => [item.id, item] as const)) : undefined;
    return { version: 1, runId: run.id, taskId: run.taskId, projectId: run.projectId,
        decisionFingerprint: run.candidateFingerprint, generation: before?.generation ?? 0,
        ...(run.reviewDecision ? { reviewDecision: { kind: 'accept' as const, revision: run.reviewDecision.revision } } : {}),
        ...(current ? { inputFingerprint: snapshot!.metadata.inputFingerprint } : {}),
        recordedAt: new Date().toISOString(), reanalysisNeeded: true,
        paths: run.appliedFiles.map(path => {
            const sourceFingerprint = run.candidateDelta!.effects.find(effect => effect.path === path)?.after;
            if (!sourceFingerprint) throw new Error('Applied path lacks candidate source fingerprint');
            const file = current ? snapshot!.nodes.find(node => node.kind === 'code' && node.codeKind === 'file' && node.path === path) : undefined;
            if (!file) return { path, sourceFingerprint, status: 'unknown' as const,
                nodeIds: [], evidenceIds: [], reason: current ? 'unmapped-path' as const : reason };
            const nodeIds: string[] = [];
            let cursor: typeof file | undefined = file;
            while (cursor && nodeIds.length < 16) {
                nodeIds.push(cursor.id);
                cursor = cursor.parentId ? nodes!.get(cursor.parentId) : undefined;
            }
            return { path, sourceFingerprint, status: 'resolved' as const, nodeIds,
                evidenceIds: file.evidenceIds.filter(id => evidence!.get(id)?.path === path).slice(0, 100), evidenceStale: true as const };
        }) };
}
