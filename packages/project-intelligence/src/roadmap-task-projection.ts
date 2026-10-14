import { projectRoadmap } from './roadmap-projection';
import type { CheckpointEdge, CheckpointNode, RoadmapPresentation, RoadmapProjection } from './roadmap-projection';
import type { RoadmapIndex } from './node/roadmap-store';
import type { RoadmapOwnerRecord } from './node/roadmap-owner-links';
import { correctionPhaseNumber, resolveCorrectionPhase, roadmapPhaseNumber } from './roadmap-phase-association';

/** Structural input from the strict, read-only P11 discovery. No runner or Node dependency enters this projection. */
export interface TaskStackSource {
    folderName: string; path: string; mode?: 'phase' | 'correction'; phase?: number;
    fingerprint?: string; continuationSlice?: string; correctionSlug?: string;
    prompts: readonly { number: number; title: string; kind: 'implementation' | 'closeout';
        path: string; fingerprint: string; browserRequired: boolean; version: string }[];
    diagnostic?: { code: string; message: string };
}
/** Only a typed, fingerprint-checked source relation can move a correction off its phase. */
export interface FailedPromptEvidence {
    correctionPath: string;
    failedPrompt: { stackPath: string; number: number; fingerprint: string };
    evidencePath: string;
    evidenceHash: string;
}
export interface UnlinkedTaskSource { path: string; title: string; reason: string; diagnostic?: string }
export interface TaskRoadmapProjection extends RoadmapProjection {
    unlinkedTasks: UnlinkedTaskSource[];
    omittedTaskNodes: number;
}

const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const MAX_TASK_NODES = 512;
const MAX_TASK_STACKS = 256;
const MAX_STACK_PROMPTS = 256;
const taskId = (project: string, stack: string, number?: number): string =>
    `task:${encodeURIComponent(project)}:${encodeURIComponent(stack)}:${number === undefined ? 'stack' : `P${number}`}`;
const validPath = (path: string): boolean => path.length > 0 && !path.startsWith('/') &&
    !path.includes('\\') && !path.includes(':') && path.split('/').every(part => !!part && part !== '.' && part !== '..');

/** Enrich canonical checkpoints without changing Roadmap, Markdown, runner or evidence ownership. */
export function projectRoadmapTasks(index: RoadmapIndex, stacks: readonly TaskStackSource[],
    owners: readonly RoadmapOwnerRecord[] = [], presentation: RoadmapPresentation = {},
    failedPromptEvidence: readonly FailedPromptEvidence[] = []): TaskRoadmapProjection {
    const base = projectRoadmap(index, owners, presentation);
    const nodes = [...base.nodes];
    const edges = [...base.edges];
    const diagnostics = [...base.diagnostics];
    const unlinkedTasks: UnlinkedTaskSource[] = [];
    const phases = new Map<number, CheckpointNode[]>();
    for (const node of base.nodes) {
        if (node.kind !== 'phase') continue;
        const number = roadmapPhaseNumber(node.title);
        if (number !== undefined) phases.set(number, [...(phases.get(number) ?? []), node]);
    }
    const sorted = [...stacks].sort((a, b) => compare(a.path, b.path));
    const eligible = sorted.slice(0, MAX_TASK_STACKS);
    let omittedTaskNodes = sorted.slice(MAX_TASK_STACKS).reduce((count, stack) => count + 1 + stack.prompts.length, 0);
    const knownPrompts = new Map<string, { id: string; fingerprint: string }>();
    const stackValid = (stack: TaskStackSource): boolean => !stack.diagnostic && !!stack.fingerprint &&
        !!stack.mode && Number.isSafeInteger(stack.phase) && stack.phase! >= 0 &&
        validPath(stack.path) && stack.prompts.length > 0 && stack.prompts.length <= MAX_STACK_PROMPTS &&
        stack.prompts.every((prompt, i) => prompt.number === i + 1 && validPath(prompt.path) &&
            prompt.path.startsWith(`${stack.path}/`) && /^[a-f0-9]{64}$/.test(prompt.fingerprint));
    // Resolve all validated prompt identities before correction links, independent of scanner order.
    for (const stack of eligible) if (stackValid(stack)) for (const prompt of stack.prompts)
        knownPrompts.set(`${stack.path}\0${prompt.number}`,
            { id: taskId(index.projectId, stack.path, prompt.number), fingerprint: prompt.fingerprint });
    for (const stack of eligible) {
        const association = stack.mode === 'correction' ? resolveCorrectionPhase(
            correctionPhaseNumber(stack.folderName), stack.phase === undefined ? [] :
                (phases.get(stack.phase) ?? []).map(node => node.id),
            new Map([...phases].map(([number, nodes]) => [number, nodes.map(node => node.id)]))) : undefined;
        const candidates = stack.phase === undefined ? [] : phases.get(stack.phase) ?? [];
        const parent = association ? candidates.find(node => node.id === association.phaseId) :
            candidates.length === 1 ? candidates[0] : undefined;
        if (!stackValid(stack) || !parent) {
            unlinkedTasks.push({ path: stack.path, title: stack.folderName,
                reason: stack.diagnostic?.message ?? association?.unresolvedReason ?? (!parent ? 'No unique strategic phase match.' : 'Invalid task stack.'),
                diagnostic: stack.diagnostic?.code });
            continue;
        }
        if (nodes.length + 1 > base.nodes.length + MAX_TASK_NODES) {
            omittedTaskNodes += 1 + stack.prompts.length; continue;
        }
        const stackId = taskId(index.projectId, stack.path);
        const segment = stack.mode === 'correction' ? `Correction ${stack.correctionSlug ?? stack.folderName}` :
            stack.continuationSlice ? `Continuation ${stack.continuationSlice}` : `Phase ${stack.phase} prompts`;
        const stackNode: CheckpointNode = { id: stackId, kind: 'task-stack', title: segment,
            order: parent.order, status: 'unknown', statusLabel: 'Unknown', evidence: [], readOnly: true,
            lane: 'branch', ...(association ? { phaseAssociation: association } : {}),
            taskSource: { stackPath: stack.path, fingerprint: stack.fingerprint!, segment } };
        nodes.push(stackNode);
        let origin = parent.id;
        if (stack.mode === 'correction') {
            const proofs = failedPromptEvidence.filter(proof => proof.correctionPath === stack.path &&
                validPath(proof.evidencePath) && /^[a-f0-9]{64}$/.test(proof.evidenceHash) &&
                index.checkpoints.some(item => item.evidence.some(citation =>
                    citation.path === proof.evidencePath && citation.sha256 === proof.evidenceHash)));
            if (proofs.length === 1) {
                const proof = proofs[0];
                const known = knownPrompts.get(`${proof.failedPrompt.stackPath}\0${proof.failedPrompt.number}`);
                if (known && known.fingerprint === proof.failedPrompt.fingerprint &&
                    proof.failedPrompt.stackPath !== stack.path) origin = known.id;
                else diagnostics.push(`Unresolved failed prompt evidence: ${stack.path}`);
            } else if (proofs.length > 1) diagnostics.push(`Ambiguous failed prompt evidence: ${stack.path}`);
        }
        edges.push({ id: `task-parent:${origin}:${stackId}`, from: origin, to: stackId,
            kind: 'branch', label: stack.mode === 'correction' ? 'Correction branch' : 'Prompt segment' });
        let previous = stackId;
        for (const prompt of stack.prompts) {
            if (nodes.length >= base.nodes.length + MAX_TASK_NODES) {
                omittedTaskNodes += stack.prompts.length - prompt.number + 1; break;
            }
            const id = taskId(index.projectId, stack.path, prompt.number);
            nodes.push({ id, kind: 'prompt', title: `P${prompt.number} — ${prompt.title}`,
                order: parent.order, status: 'unknown', statusLabel: 'Unknown', evidence: [], readOnly: true,
                lane: 'branch', taskSource: { stackPath: stack.path, path: prompt.path,
                    fingerprint: prompt.fingerprint, number: prompt.number, version: prompt.version,
                    browserRequired: prompt.browserRequired, segment } });
            edges.push({ id: `task-next:${previous}:${id}`, from: previous, to: id,
                kind: 'branch', label: prompt.number === 1 ? 'First prompt' : 'Next prompt' });
            previous = id;
        }
    }
    if (omittedTaskNodes) diagnostics.push(`${omittedTaskNodes} task nodes omitted by projection limit.`);
    const selected = (presentation.projectId === undefined || presentation.projectId === index.projectId) &&
        nodes.find(node => node.id === presentation.selectedId);
    const selection = selected ? { node: selected,
        neighbors: nodes.filter(node => edges.some(edge => edge.from === selected.id && edge.to === node.id ||
            edge.to === selected.id && edge.from === node.id)).slice(0, 16),
        links: index.checkpoints.find(item => item.id === selected.id)?.links.slice(0, 16) ?? [],
        omittedNeighbors: Math.max(0, edges.filter(edge => edge.from === selected.id || edge.to === selected.id).length - 16),
        omittedLinks: Math.max(0, (index.checkpoints.find(item => item.id === selected.id)?.links.length ?? 0) - 16),
    } : undefined;
    return { ...base, nodes, edges, diagnostics: diagnostics.sort(compare), selection,
        unlinkedTasks, omittedTaskNodes };
}
