import type { RoadmapIndex, RoadmapLink } from '@dope/project-intelligence/lib/node/roadmap-store';
import type { RoadmapStatus } from '@dope/project-intelligence/lib/node/roadmap-import';
import type { PlanningBasis, PlanningMap, ReconciliationOutcome } from '@dope/visual-planning';
import { sameSemanticBasis } from '@dope/visual-planning';
import { reconciliationRollups } from '@dope/visual-planning/lib/reconciliation';
import type { RoadmapTaskStack } from '@dope/agent-core/lib/node/roadmap-task-discovery';
import type { AgentTaskSequence } from '@dope/agent-core/lib/sequence';
import type { AgentTask, AgentRun } from '@dope/agent-core/lib/contracts';
import type { RoadmapPlanningLinks } from './roadmap-planning-links';
import type { ProjectMind } from '@dope/contracts/lib/project-mind';
import type { GreenfieldDraft } from '@dope/project-intelligence/lib/node/roadmap-greenfield';
import type { HistoryEntry } from '@dope/contracts/lib/history';

export type WorkflowStage = 'Captured' | 'Brainstorming' | 'Roadmapped' | 'Architecting' |
    'Prepared' | 'Implementing' | 'Validating' | 'Qualified' | 'Closed';
export type WorkflowCondition = 'Blocked' | 'Stale' | 'Needs Decision' | 'Failed' | 'Not Green';
export type LineageKind = 'idea' | 'draft-checkpoint' | 'plan' | 'plan-step' | 'checkpoint' | 'planning-map' | 'transformation' |
    'work-item' | 'stack' | 'prompt' | 'sequence' | 'task' | 'run';
export interface LineageRef { projectId: string; kind: LineageKind; id: string }
export interface LineageEdge { from: LineageRef; to: LineageRef; relation: 'plans' | 'contains' | 'sources' | 'executes' }
export interface PlanningLinkObservation { checkpointId: string; link: RoadmapLink; resolved: boolean }
/** Stack association is explicit provenance, never inferred from a similar name or phase number. */
export interface StackAssociation { checkpointId: string; stackPath: string; fingerprint: string }
export interface WorkflowLineageInput {
    roadmap: RoadmapIndex;
    projectMind?: ProjectMind;
    brainstormDraft?: { projectId: string; draft: GreenfieldDraft };
    maps?: readonly PlanningMap[];
    currentBasis?: PlanningBasis;
    planningLinks?: readonly PlanningLinkObservation[];
    stackAssociations?: readonly StackAssociation[];
    stacks?: readonly RoadmapTaskStack[];
    sequences?: readonly AgentTaskSequence[];
    tasks?: readonly AgentTask[];
    runs?: readonly AgentRun[];
    /** Optional owner-sourced History observations. A Git event is never attached by proximity alone. */
    historyEntries?: readonly HistoryEntry[];
    /** Explicit owner closeout observations; a completed run or Green Roadmap status cannot close work. */
    closeouts?: readonly { projectId: string; checkpointId: string; evidenceId: string }[];
    decisionsNeeded?: readonly { projectId: string; checkpointId: string; evidenceId: string }[];
}
export interface WorkflowCheckpoint {
    checkpoint: LineageRef;
    stage: WorkflowStage;
    ownerStatus: RoadmapStatus | 'captured' | 'brainstorming';
    conditions: WorkflowCondition[];
    links: LineageEdge[];
    unresolved: { kind: LineageKind; id: string; reason: 'missing' | 'foreign' | 'stale' | 'unverified' }[];
    reconciliation: BridgeReconciliation[];
}

export interface BridgeReconciliation {
    mapId: string;
    mapRevision: number;
    /** Approved stack associations on this checkpoint; not transformation or run attribution. */
    checkpointStacks: LineageRef[];
    /** Compares the report to the latest supplied analysis, not to an unobserved filesystem. */
    sourceState: 'matches-observed-analysis' | 'same-source-new-generation' | 'source-drift' |
        'basis-changed' | 'unknown' | 'not-reconciled';
    basis?: PlanningBasis;
    physicalGeneration?: number;
    physicalInputFingerprint?: string;
    counts: Partial<Record<ReconciliationOutcome, number>>;
    /** Map-wide rollups are shown only for an explicitly linked whole Planning Map. */
    rollups?: ReturnType<typeof reconciliationRollups>;
    outcomes: { transformationId?: string; identityId: string; outcome: ReconciliationOutcome;
        evidenceIds: string[]; disposition?: PlanningMap['transformations'][number]['resolution'];
        workItems: LineageRef[]; runs: { ref: LineageRef; status: AgentRun['status'];
            validation: AgentRun['validationResults'][number]['status'][]; taskMapRevision: number;
            basisState: 'matches-map' | 'historical' }[];
        history: { source: HistoryEntry['source']; sourceId: string }[]; ambiguity?: string }[];
}

const sameBasis = (a: PlanningBasis, b: PlanningBasis): boolean =>
    a.architectureRevision === b.architectureRevision && a.architectureFingerprint === b.architectureFingerprint &&
    a.physicalInputFingerprint === b.physicalInputFingerprint && a.physicalGeneration === b.physicalGeneration;
const ref = (projectId: string, kind: LineageKind, id: string): LineageRef => ({ projectId, kind, id });
const stageRank: WorkflowStage[] = ['Captured', 'Brainstorming', 'Roadmapped', 'Architecting',
    'Prepared', 'Implementing', 'Validating', 'Qualified', 'Closed'];
const validStack = (stack: RoadmapTaskStack): boolean => !stack.diagnostic && !!stack.fingerprint &&
    stack.prompts.length > 0 && stack.prompts.every((prompt, i) => prompt.number === i + 1 &&
        prompt.path.startsWith(`${stack.path}/`) && /^[a-f0-9]{64}$/.test(prompt.fingerprint));

/** Pure, read-only view. All owner records and observations must come from the same project read. */
export function projectWorkflowLineage(input: WorkflowLineageInput): WorkflowCheckpoint[] {
    const { roadmap } = input;
    const projectId = roadmap.projectId;
    const maps = new Map((input.maps ?? []).filter(map => map.projectId === projectId).map(map => [map.id, map]));
    const stacks = new Map((input.stacks ?? []).filter(validStack).map(stack => [stack.path, stack]));
    const early: WorkflowCheckpoint[] = [];
    if (input.projectMind?.projectId === projectId) for (const idea of input.projectMind.artifacts) {
        if (idea.type !== 'idea' || idea.status !== 'captured' || idea.archivedAt) continue;
        early.push({ checkpoint: ref(projectId, 'idea', idea.id), stage: 'Captured', ownerStatus: 'captured',
            conditions: [], links: [], unresolved: [], reconciliation: [] });
    }
    if (input.brainstormDraft?.projectId === projectId) for (const phase of input.brainstormDraft.draft.phases) {
        early.push({ checkpoint: ref(projectId, 'draft-checkpoint', phase.id), stage: 'Brainstorming', ownerStatus: 'brainstorming',
            conditions: [], links: [], unresolved: [], reconciliation: [] });
        for (const checkpoint of phase.checkpoints) early.push({
            checkpoint: ref(projectId, 'draft-checkpoint', checkpoint.id), stage: 'Brainstorming', ownerStatus: 'brainstorming',
            conditions: [], links: [], unresolved: [], reconciliation: [] });
    }
    return [...early, ...roadmap.checkpoints.map(checkpoint => {
        const checkpointRef = ref(projectId, 'checkpoint', checkpoint.id);
        const links: LineageEdge[] = [];
        const unresolved: WorkflowCheckpoint['unresolved'] = [];
        const reconciliation: BridgeReconciliation[] = [];
        const conditions = new Set<WorkflowCondition>();
        let rank = 2; // A canonical Roadmap checkpoint is Roadmapped even when not implemented.
        const advance = (stage: WorkflowStage): void => { rank = Math.max(rank, stageRank.indexOf(stage)); };
        const edge = (from: LineageRef, kind: LineageKind, id: string, relation: LineageEdge['relation']): LineageRef => {
            const to = ref(projectId, kind, id);
            links.push({ from, to, relation });
            return to;
        };
        const origin = roadmap.planOrigin;
        const planStep = origin?.steps.find(step => step.checkpointId === checkpoint.id);
        if (origin && planStep) {
            if (origin.sourceHash !== roadmap.linkedDocument?.sourceHash ||
                roadmap.linkedDocument.syncState !== 'synced' ||
                checkpoint.source?.sha256 !== origin.sourceHash) {
                unresolved.push({ kind: 'plan-step', id: planStep.stepId, reason: 'stale' });
                conditions.add('Stale');
            } else {
                const planRef = edge(checkpointRef, 'plan', origin.planHash, 'sources');
                edge(planRef, 'plan-step', planStep.stepId, 'contains');
            }
        }
        for (const link of checkpoint.links.filter(link => ['planning-map', 'transformation', 'work-item'].includes(link.owner))) {
            const kind = link.owner as 'planning-map' | 'transformation' | 'work-item';
            const parts = link.targetId.split('/');
            const map = maps.get(parts[0]);
            const observation = input.planningLinks?.find(item => item.checkpointId === checkpoint.id && item.link === link);
            const sourceOnlyStale = !!(map && map.revision === link.ownerRevision && link.basis &&
                sameBasis(map.basis, link.basis) && observation?.resolved && input.currentBasis &&
                !sameSemanticBasis(map.basis, input.currentBasis));
            const reason = link.ownerProjectId && link.ownerProjectId !== projectId ? 'foreign' :
                !map || (kind !== 'planning-map' && parts.length !== 2) ? 'missing' :
                    map.revision !== link.ownerRevision || !link.basis || !sameBasis(map.basis, link.basis) ||
                    input.currentBasis && !sameSemanticBasis(map.basis, input.currentBasis) ? 'stale' :
                        !observation?.resolved ? 'unverified' : undefined;
            if (reason) {
                unresolved.push({ kind, id: link.targetId, reason });
                if (reason === 'stale') conditions.add('Stale');
                if (!sourceOnlyStale) continue;
            }
            if (!map) continue;
            const mapRef = edge(checkpointRef, 'planning-map', map.id, 'plans');
            advance('Architecting');
            const transformations = kind === 'transformation' ? map.transformations.filter(item => item.id === parts[1]) : map.transformations;
            const workItems = kind === 'work-item' ? map.workItems.filter(item => item.id === parts[1]) : map.workItems;
            if (kind === 'transformation' && !transformations.length || kind === 'work-item' && !workItems.length) {
                unresolved.push({ kind, id: link.targetId, reason: 'missing' });
                continue;
            }
            for (const transformation of transformations) edge(mapRef, 'transformation', `${map.id}/${transformation.id}`, 'contains');
            for (const item of workItems) {
                const workRef = edge(mapRef, 'work-item', `${map.id}/${item.id}`, 'contains');
                for (const id of item.transformationIds) edge(workRef, 'transformation', `${map.id}/${id}`, 'plans');
                if (item.status === 'ready' || item.status === 'in-progress' || item.status === 'completed') advance('Prepared');
                for (const task of input.tasks ?? []) {
                    if (task.projectId !== projectId || task.origin.kind !== 'work-item' ||
                        task.origin.projectId !== projectId || task.origin.planningMapId !== map.id ||
                        task.origin.workItemId !== item.id || task.origin.mapRevision !== map.revision ||
                        !sameBasis(task.origin.basis, map.basis)) continue;
                    const taskRef = edge(workRef, 'task', task.id, 'executes');
                    for (const run of input.runs ?? []) {
                        if (run.projectId !== projectId || run.taskId !== task.id) continue;
                        edge(taskRef, 'run', run.id, 'executes');
                        if (run.status === 'blocked' || run.status === 'interrupted') conditions.add('Blocked');
                        if (run.status === 'failed') conditions.add('Failed');
                        if (run.status === 'completed') advance('Validating');
                        else if (run.status !== 'pending') advance('Implementing');
                    }
                }
            }
            if (!reconciliation.some(item => item.mapId === map.id)) {
                const report = map.reconciliation;
                const sourceState: BridgeReconciliation['sourceState'] = !report ? 'not-reconciled' :
                    !input.currentBasis ? 'unknown' : report.basis.architectureFingerprint !== input.currentBasis.architectureFingerprint ||
                        report.basis.architectureRevision !== input.currentBasis.architectureRevision ? 'basis-changed' :
                        report.basis.physicalInputFingerprint !== input.currentBasis.physicalInputFingerprint ? 'source-drift' :
                            report.basis.physicalGeneration !== input.currentBasis.physicalGeneration ?
                                'same-source-new-generation' : 'matches-observed-analysis';
                const scopedIds = new Set(kind === 'work-item' ? workItems.flatMap(item => item.transformationIds) :
                    transformations.map(item => item.id));
                const history = (input.historyEntries ?? []).filter(item => item.projectId === projectId &&
                    item.projectRoot === roadmap.projectRoot && (!item.ownerProjectId || item.ownerProjectId === projectId) &&
                    item.availability === 'available');
                const outcomes = (report?.results ?? []).filter(result => result.transformationId ?
                    scopedIds.has(result.transformationId) : kind === 'planning-map')
                    .map(result => {
                        const owners = map.workItems.filter(item => result.transformationId && item.transformationIds.includes(result.transformationId));
                        const linkedRuns = (input.tasks ?? []).filter(task => task.projectId === projectId &&
                            task.origin.kind === 'work-item' && task.origin.projectId === projectId &&
                            task.origin.planningMapId === map.id && owners.some(item => item.id ===
                                (task.origin.kind === 'work-item' ? task.origin.workItemId : undefined)))
                            .flatMap(task => (input.runs ?? []).filter(run => run.projectId === projectId && run.taskId === task.id)
                                .map(run => ({ run, task })));
                        const ownerIds = new Set(owners.map(item => item.id));
                        const runIds = new Set(linkedRuns.map(item => item.run.id));
                        const disposition = map.transformations.find(item => item.id === result.transformationId)?.resolution;
                        const ambiguity = [!result.transformationId ? 'Unexpected source change has no planned transformation or exact WorkItem/run attribution' : '',
                            result.outcome === 'implemented-differently' && !disposition ? 'Manual disposition is unresolved' : '',
                            !result.transformationId || linkedRuns.length ? '' : 'No WorkItem AgentRun attribution; outcome comes from Physical Map evidence',
                            linkedRuns.some(({ task }) => task.origin.kind === 'work-item' &&
                                (task.origin.mapRevision !== map.revision || !sameBasis(task.origin.basis, map.basis))) ?
                                'Some linked AgentRuns use a historical Planning Map revision or basis' : ''].filter(Boolean).join('; ');
                        return { transformationId: result.transformationId, identityId: result.identityId,
                            outcome: result.outcome, evidenceIds: result.evidenceIds,
                            ...(disposition ? { disposition } : {}),
                            workItems: owners.map(item => ref(projectId, 'work-item', `${map.id}/${item.id}`)),
                            runs: linkedRuns.map(({ run, task }) => ({ ref: ref(projectId, 'run', run.id), status: run.status,
                                validation: run.validationResults?.map(value => value.status) ?? [],
                                taskMapRevision: task.origin.kind === 'work-item' ? task.origin.mapRevision : -1,
                                basisState: task.origin.kind === 'work-item' && task.origin.mapRevision === map.revision &&
                                    sameBasis(task.origin.basis, map.basis) ? 'matches-map' as const : 'historical' as const })),
                            history: history.filter(entry => entry.owner.kind === 'planning-map' && entry.owner.mapId === map.id ||
                                entry.owner.kind === 'work-item' && entry.owner.mapId === map.id && ownerIds.has(entry.owner.workItemId) ||
                                entry.owner.kind === 'agent-run' && runIds.has(entry.owner.runId))
                                .map(entry => ({ source: entry.source, sourceId: entry.sourceId })),
                            ...(ambiguity ? { ambiguity } : {}) };
                    });
                const counts = outcomes.reduce((value, item) => {
                    value[item.outcome] = (value[item.outcome] ?? 0) + 1; return value;
                }, {} as Partial<Record<ReconciliationOutcome, number>>);
                reconciliation.push({ mapId: map.id, mapRevision: map.revision, checkpointStacks: [], sourceState,
                    ...(report ? { basis: report.basis, physicalGeneration: report.basis.physicalGeneration,
                        physicalInputFingerprint: report.basis.physicalInputFingerprint } : {}),
                    counts, outcomes, ...(kind === 'planning-map' ? { rollups: reconciliationRollups(map) } : {}) });
            }
        }
        for (const association of input.stackAssociations ?? []) {
            if (association.checkpointId !== checkpoint.id) continue;
            const stack = stacks.get(association.stackPath);
            if (!stack || stack.fingerprint !== association.fingerprint) {
                unresolved.push({ kind: 'stack', id: association.stackPath, reason: stack ? 'stale' : 'missing' });
                if (stack) conditions.add('Stale');
                continue;
            }
            const stackRef = edge(checkpointRef, 'stack', stack.path, 'sources');
            for (const prompt of stack.prompts) edge(stackRef, 'prompt', `${stack.path}/P${prompt.number}`, 'contains');
            advance('Prepared');
            for (const sequence of input.sequences ?? []) {
                if (sequence.stack.sourcePath !== stack.path || sequence.stack.fingerprint !== stack.fingerprint) continue;
                const sequenceRef = edge(stackRef, 'sequence', sequence.id, 'executes');
                if (sequence.status === 'blocked' || sequence.status === 'interrupted') conditions.add('Blocked');
                for (const checkpointEntry of sequence.checkpoints) {
                    const task = input.tasks?.find(item => item.id === checkpointEntry.taskId && item.projectId === projectId &&
                        item.origin.kind === 'phase-stack' && item.phaseStack?.stackFingerprint === stack.fingerprint);
                    if (!task) continue;
                    const taskRef = edge(sequenceRef, 'task', task.id, 'executes');
                    for (const run of input.runs ?? []) {
                        if (run.taskId !== task.id || run.projectId !== projectId ||
                            checkpointEntry.runId !== run.id) continue;
                        edge(taskRef, 'run', run.id, 'executes');
                        if (run.status === 'blocked' || run.status === 'interrupted') conditions.add('Blocked');
                        if (run.status === 'failed') conditions.add('Failed');
                        if (run.status === 'completed') advance('Validating');
                        else if (run.status !== 'pending') advance('Implementing');
                    }
                }
                if (sequence.status === 'running' || sequence.status === 'waiting-manual') advance('Implementing');
                if (sequence.status === 'completed') advance('Validating');
            }
        }
        if (checkpoint.status === 'not-green') conditions.add('Not Green');
        if (input.decisionsNeeded?.some(item => item.projectId === projectId && item.checkpointId === checkpoint.id && item.evidenceId))
            conditions.add('Needs Decision');
        if (checkpoint.status === 'green' && checkpoint.evidence.length) advance('Qualified');
        if (checkpoint.status === 'green' && checkpoint.evidence.length &&
            input.closeouts?.some(item => item.projectId === projectId && item.checkpointId === checkpoint.id && item.evidenceId))
            advance('Closed');
        return { checkpoint: checkpointRef, stage: stageRank[rank], ownerStatus: checkpoint.status,
            conditions: [...conditions], links, unresolved, reconciliation: reconciliation.map(item => ({ ...item,
                checkpointStacks: links.filter(edge => edge.from.kind === 'checkpoint' && edge.to.kind === 'stack')
                    .map(edge => edge.to) })) };
    })];
}

/** Checks live Planning ownership before handing link observations to the pure projection. */
export async function observeWorkflowPlanningLinks(root: string, roadmap: RoadmapIndex,
    owner: RoadmapPlanningLinks): Promise<PlanningLinkObservation[]> {
    if (root !== roadmap.projectRoot) throw new Error('Foreign Roadmap project root');
    const result: PlanningLinkObservation[] = [];
    for (const checkpoint of roadmap.checkpoints) for (const link of checkpoint.links) {
        if (!['planning-map', 'transformation', 'work-item'].includes(link.owner)) continue;
        result.push({ checkpointId: checkpoint.id, link, resolved: !!await owner.resolve(root, link) });
    }
    return result;
}
