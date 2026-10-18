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
const correctionMatches = (node: CheckpointNode, slug: string): boolean => {
    if (node.kind !== 'correction') return false;
    const section = node.id.slice(node.id.lastIndexOf('#') + 1);
    return section === slug || [...node.title.matchAll(/`(c\d+(?:-[a-z0-9]+)*)`/g)].some(match => match[1] === slug) ||
        [node.source?.path, ...node.evidence.map(item => item.path)].some(path => path?.startsWith(`docs/tasks/${slug}/`));
};
const phaseStackNumber = (name: string): number | undefined => {
    const match = /^p(?:[12]-(\d+)|(\d+)[a-z]?)$/.exec(name);
    if (!match) return undefined;
    const number = Number(match[1] ?? match[2]);
    return Number.isSafeInteger(number) ? number : undefined;
};
const stackValid = (stack: TaskStackSource): boolean => !stack.diagnostic && !!stack.fingerprint &&
    !!stack.mode && Number.isSafeInteger(stack.phase) && stack.phase! >= 0 &&
    validPath(stack.path) && stack.prompts.length > 0 && stack.prompts.length <= MAX_STACK_PROMPTS &&
    stack.prompts.every((prompt, i) => prompt.number === i + 1 && validPath(prompt.path) &&
        prompt.path.startsWith(`${stack.path}/`) && /^[a-f0-9]{64}$/.test(prompt.fingerprint));

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
        const slug = stack.folderName;
        const direct = stack.mode === 'correction' ? base.nodes.filter(node => correctionMatches(node, slug)) : [];
        const words = slug.replace(/^c\d+-/, '').split('-');
        const phrase = words.join(' ');
        const descriptive = stack.mode === 'correction' && direct.length === 0 && words.length >= 3 ?
            base.nodes.filter(node => node.kind === 'correction' &&
                node.phaseAssociation?.phaseId === parent.id &&
                node.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').includes(phrase)) : [];
        if (direct.length && (direct.length !== 1 || direct[0].phaseAssociation?.phaseId !== parent.id)) {
            unlinkedTasks.push({ path: stack.path, title: stack.folderName,
                reason: 'Correction source conflicts with its exact strategic phase parent.', diagnostic: 'ambiguous' });
            continue;
        }
        const canonical = direct.length === 1 ? direct[0] : descriptive.length === 1 ? descriptive[0] : undefined;
        const sourceOnly = stack.mode === 'correction' && !canonical;
        const headers = sourceOnly ? 2 : 1;
        if (nodes.length + headers > base.nodes.length + MAX_TASK_NODES) {
            omittedTaskNodes += headers + stack.prompts.length; continue;
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
            if (canonical) origin = canonical.id;
            else {
                const correctionId = `${stackId}:correction`;
                nodes.push({ id: correctionId, kind: 'correction', title: slug, order: parent.order,
                    status: 'unknown', statusLabel: 'Source only · status unknown', evidence: [], readOnly: true,
                    lane: 'branch', ...(association ? { phaseAssociation: association } : {}),
                    taskSource: { stackPath: stack.path, fingerprint: stack.fingerprint!, segment: slug } });
                origin = correctionId;
            }
        }
        if (stack.mode === 'correction') {
            const proofs = failedPromptEvidence.filter(proof => proof.correctionPath === stack.path &&
                validPath(proof.evidencePath) && /^[a-f0-9]{64}$/.test(proof.evidenceHash) &&
                index.checkpoints.some(item => item.evidence.some(citation =>
                    citation.path === proof.evidencePath && citation.sha256 === proof.evidenceHash &&
                    citation.status === 'not-green')));
            if (proofs.length === 1) {
                const proof = proofs[0];
                const known = knownPrompts.get(`${proof.failedPrompt.stackPath}\0${proof.failedPrompt.number}`);
                if (known && known.fingerprint === proof.failedPrompt.fingerprint &&
                    proof.failedPrompt.stackPath !== stack.path) {
                    edges.push({ id: `task-failure:${known.id}:${origin}`, from: known.id, to: origin,
                        kind: 'branch', label: 'Source-backed failed prompt relationship' });
                }
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

/** An adapter may supply this only after Work, runner and Git reconciliation has checked the checkpoint. */
export interface PhaseFocusCheckpointEvidence {
    projectId: string; stackPath: string; stackFingerprint: string; entryNumber: number;
    sha: string; taskId?: string; runId?: string; manualGate?: boolean; verified: boolean;
}
export interface PhaseFocusQualificationEvidence {
    projectId: string; stackPath: string; promptNumber: number; promptFingerprint: string;
    evidencePath: string; evidenceHash: string;
    status: 'green' | 'not-green' | 'waived';
}
export interface PhaseFocusPrompt {
    number: number; title: string; kind: 'implementation' | 'closeout'; path: string;
    fingerprint: string; browserRequired: boolean; version: string;
    source: 'present'; implementation: 'completed' | 'blocked' | 'manual' | 'unknown';
    manualGate: boolean;
    qualification: 'green' | 'not-green' | 'waived' | 'unknown';
    checkpointSha?: string;
}
export interface PhaseFocusStack {
    path: string; fingerprint: string; segment: 'phase' | 'continuation' | 'correction';
    continuationSlice?: string; failedPrompt?: { stackPath: string; number: number };
    prompts: PhaseFocusPrompt[];
}
export interface PhaseFocusSelection {
    projectId: string; phaseId: string; phaseTitle: string;
    qualification: CheckpointNode['status']; stacks: PhaseFocusStack[];
    diagnostics: string[];
}
export interface PhaseFocusBlockedEvidence {
    projectId: string; stackPath: string; stackFingerprint: string; entryNumber: number;
    reason: string; verified: boolean;
}

/** Pure, bounded selected-phase view. Canvas placement and display order cannot change authored execution order. */
export function selectPhaseFocus(index: RoadmapIndex, stacks: readonly TaskStackSource[], phaseId: string,
    checkpoints: readonly PhaseFocusCheckpointEvidence[] = [],
    qualifications: readonly PhaseFocusQualificationEvidence[] = [],
    failedPromptEvidence: readonly FailedPromptEvidence[] = [],
    blocked: readonly PhaseFocusBlockedEvidence[] = []): PhaseFocusSelection | undefined {
    const phase = index.checkpoints.find(item => item.id === phaseId && item.kind === 'phase');
    const phaseNumber = phase && roadmapPhaseNumber(phase.title);
    if (!phase || phaseNumber === undefined) return undefined;
    const phaseCount = index.checkpoints.filter(item => item.kind === 'phase' &&
        roadmapPhaseNumber(item.title) === phaseNumber).length;
    const diagnostics: string[] = [];
    const eligible: TaskStackSource[] = [];
    const canonicalNodes = projectRoadmap(index).nodes;
    const ordered = [...stacks].sort((a, b) => compare(a.path, b.path));
    for (const stack of ordered.slice(0, MAX_TASK_STACKS)) {
        const namedPhase = phaseStackNumber(stack.folderName);
        if (stack.phase !== phaseNumber && correctionPhaseNumber(stack.folderName) !== phaseNumber &&
            namedPhase !== phaseNumber) continue;
        if (!stackValid(stack) || stack.path !== `docs/tasks/${stack.folderName}`) {
            diagnostics.push(`${stack.path}: ${stack.diagnostic?.message ?? 'Invalid task source.'}`);
            continue;
        }
        if (phaseCount !== 1 || stack.phase !== phaseNumber ||
            stack.mode === 'correction' && correctionPhaseNumber(stack.folderName) !== phaseNumber ||
            stack.mode === 'phase' && namedPhase !== phaseNumber) {
            diagnostics.push(`${stack.path}: No unique, matching phase parent.`);
            continue;
        }
        if (stack.mode === 'correction') {
            const canonical = canonicalNodes.filter(node => correctionMatches(node, stack.folderName));
            if (canonical.length > 1 || canonical.length === 1 &&
                canonical[0].phaseAssociation?.phaseId !== phaseId) {
                diagnostics.push(`${stack.path}: Correction parent is ambiguous or conflicts with the selected phase.`);
                continue;
            }
        }
        eligible.push(stack);
    }
    if (ordered.length > MAX_TASK_STACKS) diagnostics.push('Task discovery exceeds Phase Focus stack limit.');
    const byPath = new Map(eligible.map(stack => [stack.path, stack]));
    const cited = new Set(index.checkpoints.flatMap(item => item.evidence.map(evidence =>
        `${evidence.path}\0${evidence.sha256}\0${evidence.status ?? 'unknown'}`)));
    const result: PhaseFocusStack[] = [];
    let count = 0;
    for (const stack of eligible) {
        if (count + stack.prompts.length > 4096) {
            diagnostics.push('Phase Focus prompt limit reached; remaining stacks omitted.');
            break;
        }
        count += stack.prompts.length;
        const proofs = failedPromptEvidence.filter(proof => proof.correctionPath === stack.path &&
            validPath(proof.evidencePath) && /^[a-f0-9]{64}$/.test(proof.evidenceHash) &&
            index.checkpoints.some(item => item.evidence.some(citation =>
                citation.path === proof.evidencePath && citation.sha256 === proof.evidenceHash &&
                citation.status === 'not-green')));
        let failedPrompt: PhaseFocusStack['failedPrompt'];
        if (stack.mode === 'correction' && proofs.length === 1) {
            const proof = proofs[0];
            const source = byPath.get(proof.failedPrompt.stackPath);
            const prompt = source?.prompts[proof.failedPrompt.number - 1];
            if (source?.mode === 'phase' && prompt?.number === proof.failedPrompt.number &&
                prompt.fingerprint === proof.failedPrompt.fingerprint)
                failedPrompt = { stackPath: source.path, number: prompt.number };
            else diagnostics.push(`${stack.path}: Failed prompt provenance is stale or foreign.`);
        } else if (stack.mode === 'correction' && proofs.length > 1)
            diagnostics.push(`${stack.path}: Ambiguous failed prompt provenance.`);
        let completedPrefix = 0;
        const seenSha = new Set<string>();
        const prompts = stack.prompts.map((prompt): PhaseFocusPrompt => {
            const manualGate = prompt.kind === 'closeout' || prompt.browserRequired;
            if (checkpoints.some(item => item.projectId === index.projectId && item.stackPath === stack.path &&
                item.entryNumber === prompt.number && item.stackFingerprint !== stack.fingerprint))
                diagnostics.push(`${prompt.path}: Stale implementation fingerprint.`);
            const matching = checkpoints.filter(item => item.verified && item.projectId === index.projectId &&
                item.stackPath === stack.path && item.stackFingerprint === stack.fingerprint &&
                item.entryNumber === prompt.number && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(item.sha) &&
                (manualGate ? item.manualGate === true :
                    !!item.taskId && !!item.runId));
            const candidate = matching.length === 1 ? matching[0] : undefined;
            const checkpoint = candidate && prompt.number === completedPrefix + 1 && !seenSha.has(candidate.sha)
                ? candidate : undefined;
            if (candidate && !checkpoint) diagnostics.push(`${prompt.path}: Incomplete checkpoint prefix.`);
            if (checkpoint) { completedPrefix++; seenSha.add(checkpoint.sha); }
            if (matching.length > 1) diagnostics.push(`${prompt.path}: Ambiguous implementation checkpoints.`);
            const blockedMatches = blocked.filter(item => item.verified && item.projectId === index.projectId &&
                item.stackPath === stack.path && item.stackFingerprint === stack.fingerprint &&
                item.entryNumber === prompt.number && !!item.reason);
            const matchingQualification = qualifications.filter(item => item.projectId === index.projectId &&
                item.stackPath === stack.path && item.promptNumber === prompt.number &&
                item.promptFingerprint === prompt.fingerprint && validPath(item.evidencePath) &&
                cited.has(`${item.evidencePath}\0${item.evidenceHash}\0${item.status}`));
            if (matchingQualification.length > 1)
                diagnostics.push(`${prompt.path}: Ambiguous qualification evidence.`);
            return { ...prompt, source: 'present', manualGate,
                implementation: checkpoint ? 'completed' : blockedMatches.length === 1 ? 'blocked' :
                    manualGate ? 'manual' : 'unknown',
                qualification: matchingQualification.length === 1 ? matchingQualification[0].status : 'unknown',
                ...(checkpoint ? { checkpointSha: checkpoint.sha } : {}) };
        });
        result.push({ path: stack.path, fingerprint: stack.fingerprint!,
            segment: stack.mode === 'correction' ? 'correction' : stack.continuationSlice ? 'continuation' : 'phase',
            ...(stack.continuationSlice ? { continuationSlice: stack.continuationSlice } : {}),
            ...(failedPrompt ? { failedPrompt } : {}), prompts });
    }
    const slices = (slice: string | undefined): number => slice === undefined ? 0 :
        /^[a-z]$/.test(slice) ? slice.charCodeAt(0) - 96 : 1000;
    result.sort((a, b) => Number(a.segment === 'correction') - Number(b.segment === 'correction') ||
        slices(a.continuationSlice) - slices(b.continuationSlice) || compare(a.path, b.path));
    return { projectId: index.projectId, phaseId, phaseTitle: phase.title,
        qualification: phase.status, stacks: result, diagnostics };
}
