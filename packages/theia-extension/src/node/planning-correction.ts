import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import type { RoadmapIndex } from '@dope/project-intelligence/lib/node/roadmap-store';
import type { PlanningMap } from '@dope/visual-planning';
import type { FailedPromptEvidence, TaskStackSource } from '@dope/project-intelligence/lib/roadmap-task-projection';
import { composePhaseStackDraft } from '@dope/agent-core/lib/phase-stack-composer';
import type { ComposeStackInput, DraftStack } from '@dope/agent-core/lib/phase-stack-composer';
import { validPhaseFocusCitation } from './phase-focus-evidence';

const sha = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');
const safePath = (value: string): boolean => !!value && value.length <= 512 && !isAbsolute(value) &&
    !/[\\:\x00-\x1f]/u.test(value) && value.split('/').every(part => !!part && part !== '.' && part !== '..');

/** Exact typed failure provenance. A folder name or a nearby Not Green citation is insufficient. */
export function correctionFailure(index: RoadmapIndex, correctionId: string,
    evidence: FailedPromptEvidence, stacks: readonly TaskStackSource[]): boolean {
    const correction = index.checkpoints.find(item => item.id === correctionId && item.kind === 'correction');
    const source = stacks.find(item => item.path === evidence.failedPrompt.stackPath && !item.diagnostic);
    const branch = stacks.find(item => item.path === evidence.correctionPath && item.mode === 'correction' && !item.diagnostic);
    const prompt = source?.prompts.find(item => item.number === evidence.failedPrompt.number);
    if (!correction || !source?.fingerprint || !branch?.fingerprint || !prompt ||
        prompt.fingerprint !== evidence.failedPrompt.fingerprint ||
        !safePath(evidence.evidencePath) || !/^[a-f0-9]{64}$/u.test(evidence.evidenceHash)) return false;
    const citation = correction.evidence.find(item => item.path === evidence.evidencePath &&
        item.sha256 === evidence.evidenceHash && item.status === 'not-green');
    const promptKey = `phase-focus-prompt:${encodeURIComponent(source.path)}:P${prompt.number}:${prompt.fingerprint}`;
    const correctionKey = `phase-focus-correction:${encodeURIComponent(branch.path)}`;
    return !!citation && correction.links.some(link => link.owner === 'evidence' &&
        link.targetId === promptKey && link.sourceHash === citation.sha256) &&
        correction.links.some(link => link.owner === 'evidence' &&
            link.targetId === correctionKey && link.sourceHash === citation.sha256);
}

export interface CorrectionReplan {
    affectedWorkItemIds: string[];
    preservedWorkItemIds: string[];
    blockedExecutedWorkItemIds: string[];
    /** Existing target/stack approval digests must be rechecked before authoring or Run. */
    invalidateTargetAndStackApproval: boolean;
    /** Authored prompt files and historical runs are never rewritten by this plan. */
    requiresNewDraft: boolean;
}

/** Pure affected-only decision over the existing PlanningMap WorkItem owner. */
export function planCorrectionRework(map: PlanningMap, changedTransformationIds: readonly string[]): CorrectionReplan {
    const known = new Set(map.transformations.map(item => item.id));
    if (!changedTransformationIds.length || changedTransformationIds.some(id => !known.has(id)) ||
        new Set(changedTransformationIds).size !== changedTransformationIds.length)
        throw new Error('Correction needs exact changed target identities');
    const affected = new Set(map.workItems.filter(item => item.transformationIds.some(id =>
        changedTransformationIds.includes(id))).map(item => item.id));
    // A dependent unexecuted item may use an affected output even when its own target is unchanged.
    let changed = true;
    while (changed) {
        changed = false;
        for (const item of map.workItems) if (!affected.has(item.id) &&
            item.dependsOn.some(id => affected.has(id))) { affected.add(item.id); changed = true; }
    }
    const blockedExecutedWorkItemIds = map.workItems.filter(item => affected.has(item.id) &&
        !['proposed', 'ready'].includes(item.status)).map(item => item.id).sort();
    const affectedWorkItemIds = map.workItems.filter(item => affected.has(item.id) &&
        ['proposed', 'ready'].includes(item.status)).map(item => item.id).sort();
    return { affectedWorkItemIds,
        preservedWorkItemIds: map.workItems.filter(item => !affected.has(item.id)).map(item => item.id).sort(),
        blockedExecutedWorkItemIds,
        invalidateTargetAndStackApproval: affectedWorkItemIds.length > 0 || blockedExecutedWorkItemIds.length > 0,
        requiresNewDraft: affectedWorkItemIds.length > 0 };
}

/** Create only a new, unapproved correction draft from current affected WorkItems. Publication remains separate. */
export async function composeAffectedCorrectionDraft(map: PlanningMap, changedTransformationIds: readonly string[],
    input: ComposeStackInput, previousStackPath: string): Promise<DraftStack> {
    const plan = planCorrectionRework(map, changedTransformationIds);
    const ids = new Set(plan.affectedWorkItemIds);
    if (!ids.size || input.folderName === previousStackPath.split('/').at(-1) ||
        !/^c\d+-[a-z0-9-]+$/u.test(input.folderName) || input.work.length !== ids.size ||
        input.work.some(choice => !ids.has(choice.workItem.id)))
        throw new Error('Correction needs a new affected-only draft folder and current WorkItems');
    const fields = (item: ComposeStackInput['work'][number]['workItem']) => ({ id: item.id,
        title: item.title, objective: item.objective, dependsOn: item.dependsOn,
        requirements: item.requirements, constraints: item.constraints,
        acceptanceCriteria: item.acceptanceCriteria, validationTargets: item.validationTargets,
        workingSet: item.workingSet, status: item.status });
    for (const choice of input.work) {
        const current = map.workItems.find(item => item.id === choice.workItem.id);
        if (!current || current.status !== 'ready' ||
            current.dependsOn.some(id => !ids.has(id)) ||
            JSON.stringify(fields(current)) !== JSON.stringify(fields(choice.workItem)))
            throw new Error('Correction draft requires newly reviewed affected WorkItems and dependencies');
    }
    return composePhaseStackDraft(input);
}

export interface FastLaneSourceImpact { path: string; sha256: string }
export interface FastLaneArchitectureDecision { reason: string; developerApproved: true }
export interface FastLaneRoute { checkpointId: string; sourceImpact: FastLaneSourceImpact[];
    architecture: 'not-applicable'; route: 'direct-work'; requires: readonly ['explicit-work-run', 'execution-grants',
        'source-validation', 'qualification']; }

/** Read-only route to existing direct Work. The caller still supplies the ordinary Work grants and qualification. */
export async function directWorkFastLane(root: string, index: RoadmapIndex, checkpointId: string,
    sourceImpact: readonly FastLaneSourceImpact[], architecture: FastLaneArchitectureDecision,
    failure?: { evidence: FailedPromptEvidence; stacks: readonly TaskStackSource[] },
    issueExists?: (issueId: string) => Promise<boolean>): Promise<FastLaneRoute> {
    const checkpoint = index.checkpoints.find(item => item.id === checkpointId);
    const issue = checkpoint?.links.find(link => link.owner === 'issue' &&
        link.ownerProjectId === index.projectId && !!link.targetId);
    if (index.projectRoot !== root || resolve(root) !== root || await realpath(root) !== root ||
        !checkpoint || checkpoint.readOnly || architecture?.developerApproved !== true ||
        !architecture.reason.trim() || architecture.reason.length > 1000 ||
        checkpoint.kind !== 'correction' && (!issue || !issueExists || !await issueExists(issue.targetId)) ||
        checkpoint.kind === 'correction' && (!failure || !correctionFailure(index, checkpointId,
            failure.evidence, failure.stacks))) throw new Error('Fast lane needs an owned issue or proven correction');
    if (checkpoint.kind === 'correction') {
        const citation = checkpoint.evidence.find(item => item.path === failure!.evidence.evidencePath &&
            item.sha256 === failure!.evidence.evidenceHash && item.status === 'not-green');
        if (!citation || !await validPhaseFocusCitation(root, citation))
            throw new Error('Correction failure evidence changed; review again');
    }
    if (!sourceImpact.length || sourceImpact.length > 32 ||
        new Set(sourceImpact.map(item => item.path)).size !== sourceImpact.length)
        throw new Error('Fast lane needs bounded actual source impact');
    for (const impact of sourceImpact) {
        if (!safePath(impact.path) || !/^[a-f0-9]{64}$/u.test(impact.sha256))
            throw new Error('Invalid source impact');
        let current = root;
        for (const part of impact.path.split('/')) {
            current = join(current, part);
            const info = await lstat(current);
            if (info.isSymbolicLink()) throw new Error('Unsafe source impact');
        }
        if (!(await lstat(current)).isFile()) throw new Error('Source impact is not a file');
        const handle = await open(current, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
            const info = await handle.stat();
            if (!info.isFile() || info.size > 4_000_000 || sha(await handle.readFile()) !== impact.sha256)
                throw new Error('Source impact changed; review again');
        } finally { await handle.close(); }
    }
    return { checkpointId, sourceImpact: sourceImpact.map(item => ({ ...item })), architecture: 'not-applicable',
        route: 'direct-work', requires: ['explicit-work-run', 'execution-grants', 'source-validation', 'qualification'] };
}
