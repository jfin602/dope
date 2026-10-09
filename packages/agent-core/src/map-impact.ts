import { projectPath } from './contracts';

/** A bounded observation of an applied candidate, never a canonical map update. */
export interface AgentMapImpact {
    version: 1; runId: string; taskId: string; projectId?: string; decisionFingerprint: string;
    reviewDecision?: { kind: 'accept'; revision: number };
    generation: number; inputFingerprint?: string; recordedAt: string; reanalysisNeeded: true;
    paths: { path: string; sourceFingerprint: string; status: 'resolved' | 'unknown';
        nodeIds: string[]; evidenceIds: string[]; evidenceStale?: true;
        reason?: 'missing-map' | 'stale-generation' | 'unmapped-path' }[];
}

export function parseAgentMapImpact(value: unknown): AgentMapImpact {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid map impact');
    const x = value as AgentMapImpact;
    if (x.version !== 1 || x.reanalysisNeeded !== true || !x.runId || !x.taskId ||
        x.projectId !== undefined && (typeof x.projectId !== 'string' || !x.projectId) ||
        !/^[a-f0-9]{64}$/u.test(x.decisionFingerprint) ||
        x.reviewDecision !== undefined && (x.reviewDecision.kind !== 'accept' ||
            !Number.isSafeInteger(x.reviewDecision.revision) || x.reviewDecision.revision < 1) ||
        !Number.isSafeInteger(x.generation) || x.generation < 0 || !Number.isFinite(Date.parse(x.recordedAt)) ||
        x.inputFingerprint !== undefined && !/^[a-f0-9]{64}$/u.test(x.inputFingerprint) ||
        !Array.isArray(x.paths) || x.paths.length > 500) throw new Error('Invalid map impact');
    const seen = new Set<string>();
    for (const item of x.paths) {
        if (projectPath(item.path) !== item.path || seen.has(item.path) ||
            !/^[a-f0-9]{64}$/u.test(item.sourceFingerprint) ||
            !['resolved', 'unknown'].includes(item.status) ||
            !Array.isArray(item.nodeIds) || !Array.isArray(item.evidenceIds) ||
            item.nodeIds.length > 100 || item.evidenceIds.length > 500 ||
            [...item.nodeIds, ...item.evidenceIds].some(id => typeof id !== 'string' || !id) ||
            (item.status === 'resolved' && (!item.nodeIds.length || item.reason !== undefined || item.evidenceStale !== true)) ||
            (item.status === 'unknown' && (item.nodeIds.length || item.evidenceIds.length ||
                item.evidenceStale !== undefined || !['missing-map', 'stale-generation', 'unmapped-path'].includes(item.reason!))))
            throw new Error('Invalid map impact path');
        seen.add(item.path);
    }
    return structuredClone(x);
}
