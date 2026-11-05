import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { projectPath } from '@dope/agent-core';
import type { AgentTask, TaskContractSnapshot, ExecutionGrant } from '@dope/agent-core';
import type { PlanningStore } from '@dope/visual-planning/lib/node/planning-store';
import type { RoadmapStore } from '@dope/project-intelligence/lib/node/roadmap-store';
import type { RoadmapGateIndex } from '@dope/project-intelligence/lib/node/roadmap-gate-domain';

const digest = (value: unknown): string => createHash('sha256').update(
    typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');

/** Start-time snapshot from canonical owners. The snapshot is evidence, never an execution grant. */
export async function projectWorkTaskContract(root: string, task: AgentTask, grant: ExecutionGrant,
    sourceHead: string, planning?: Pick<PlanningStore, 'read'>,
    roadmap?: Pick<RoadmapStore, 'read'>): Promise<TaskContractSnapshot> {
    if (await realpath(root) !== root || grant.taskId !== task.id || grant.projectRoot !== task.projectRoot)
        throw new Error('Task Contract project or grant mismatch');
    let acceptance: TaskContractSnapshot['acceptance'] = 'unknown';
    let planningRef: TaskContractSnapshot['planning'] = 'unknown';
    let roadmapRef: TaskContractSnapshot['roadmap'] = 'unknown';
    if (task.origin.kind === 'work-item') {
        // Standalone runtimes without owner services retain the accepted task snapshot.
        // The product runtime supplies both services and performs the checks below.
        if (planning && roadmap) {
        const origin = task.origin;
        const collection = await planning.read(root);
        const map = collection.maps.find(item => item.id === origin.planningMapId);
        const work = map?.workItems.find(item => item.id === origin.workItemId);
        if (collection.projectId !== origin.projectId || task.projectId !== origin.projectId ||
            !map || map.projectId !== origin.projectId || map.revision !== origin.mapRevision ||
            JSON.stringify(map.basis) !== JSON.stringify(origin.basis) || !work ||
            work.objective !== task.objective ||
            JSON.stringify({ title: work.title, requirements: work.requirements, constraints: work.constraints,
                acceptanceCriteria: work.acceptanceCriteria, validationTargets: work.validationTargets,
                transformationIds: work.transformationIds, delegatedPaths: origin.scope.delegablePaths,
                humanReservedPaths: work.humanReservedPaths ?? [] }) !== task.instructions)
            throw new Error('Accepted WorkItem basis changed; review and prepare a new task');
        acceptance = [...work.acceptanceCriteria];
        planningRef = { projectId: collection.projectId, mapId: map.id, mapRevision: map.revision,
            workItemId: work.id, workItemHash: digest({ objective: work.objective, instructions: task.instructions }) };
        const index = await roadmap.read<RoadmapGateIndex>(root);
        if (index.revision) {
            if (index.projectRoot !== root) throw new Error('Foreign Roadmap owner');
            if (index.phases.some(phase => phase.workLinks?.some(link =>
                link.workItemId === work.id && link.planningProjectId !== collection.projectId)))
                throw new Error('Foreign Roadmap Work link');
            const matches = index.phases.flatMap(phase => (phase.workLinks ?? [])
                .filter(link => link.workItemId === work.id && link.planningProjectId === collection.projectId)
                .map(link => ({ phase, link })));
            if (matches.length > 1) throw new Error('Ambiguous Roadmap Work links');
            if (matches.length) {
                const { phase, link } = matches[0];
                const lock = phase.planningLock;
                if (!lock || link.mapId !== map.id || link.mapRevision !== map.revision ||
                    JSON.stringify(link.basis) !== JSON.stringify(map.basis) ||
                    lock.source.projectId !== index.projectId ||
                    index.linkedDocument && (index.linkedDocument.syncState !== 'synced' ||
                        index.linkedDocument.sourceHash !== lock.source.sha256 ||
                        index.linkedDocument.path !== lock.source.path))
                    throw new Error('Stale Roadmap Work source');
                if (lock.source.path) {
                    const path = join(root, projectPath(lock.source.path));
                    if (!(await lstat(path)).isFile() || await realpath(path) !== path ||
                        digest(await readFile(path)) !== lock.source.sha256)
                        throw new Error('Locked Roadmap source bytes changed');
                }
                const links = link.criterionIds.map(criterionId => {
                    const gate = index.gates.find(item => item.parentPhaseId === phase.id &&
                        item.criteria.some(criterion => criterion.id === criterionId));
                    const criterion = gate?.criteria.find(item => item.id === criterionId);
                    if (!gate || !criterion || !lock.criteria.some(item => item.id === criterionId &&
                        item.expectedResult === criterion.expectedResult) ||
                        !lock.requiredGateIds.includes(gate.id)) throw new Error('Stale Roadmap Criterion link');
                    return { gateId: gate.id, criterionId, expectedResult: criterion.expectedResult };
                });
                if (!links.length) throw new Error('Roadmap Work link has no Criteria');
                roadmapRef = { projectId: index.projectId, phaseId: phase.id,
                    approvalId: lock.approvalId, sourceRevision: lock.source.revision,
                    sourceHash: lock.source.sha256, links };
            }
        }
        }
    }
    return { taskId: task.id, taskHash: digest(task), objective: task.objective,
        instructionsHash: digest(task.instructions), acceptance, validation: task.completion.validation,
        planning: planningRef, roadmap: roadmapRef,
        grant: { id: grant.id, revision: grant.revision, acceptedAt: grant.acceptedAt,
            permissionsHash: digest(grant.permissions) }, sourceHead };
}
