import type { SessionArtifactRef } from '@dope/contracts/lib/developer-session';
import { parseSessionArtifactRef } from '@dope/contracts/lib/developer-session';
import type { PlanningBasis } from '@dope/visual-planning';
import { sameSemanticBasis } from '@dope/visual-planning';
import { PlanningStore } from '@dope/visual-planning/lib/node/planning-store';
import { ChatRepository } from '@dope/chat/lib/node/chat-repository';
import type { SoftwareMapIndex } from '@dope/code-analysis/lib/node/software-map-index';
import { readInitialization } from '@dope/code-analysis/lib/node/smap-initialization-file';
import { DeveloperSessionStore } from './developer-session-store';
import { AgentStore } from '@dope/agent-core/lib/node/agent-store';
import { ProjectMindStore } from '@dope/project-intelligence/lib/node/project-mind-store';

export type ChatPlanningRef = Extract<SessionArtifactRef, { kind: 'chat' | 'planning-map' | 'work-item' }>;
export type ResolvedChatPlanningArtifact = {
    ref: ChatPlanningRef;
    availability: 'resolved' | 'missing' | 'stale' | 'unavailable';
    diagnostic: string;
    title?: string;
    status?: string;
    observedRevision?: number;
    observedBasis?: PlanningBasis;
};

/** Reads only previously published, current Software Map evidence. It never starts analysis. */
export async function trustedPlanningBasis(root: string, index: SoftwareMapIndex): Promise<PlanningBasis | undefined> {
    const before = index.status(root);
    const snapshot = index.snapshot(root);
    if (before.state !== 'ready' || !before.inputFingerprint || !snapshot ||
        snapshot.metadata.generation !== before.generation ||
        snapshot.metadata.inputFingerprint !== before.inputFingerprint ||
        !await index.inputsCurrent(root)) return undefined;
    const canonical = await readInitialization(root);
    if (!canonical.initialized) return undefined;
    const after = index.status(root);
    if (after.state !== 'ready' || after.generation !== before.generation ||
        after.inputFingerprint !== before.inputFingerprint) return undefined;
    return { architectureRevision: 0, architectureFingerprint: canonical.declarationFingerprint,
        physicalInputFingerprint: before.inputFingerprint, physicalGeneration: before.generation };
}

export type AgentMindRef = Extract<SessionArtifactRef,
    { kind: 'agent-task' | 'agent-run' | 'agent-sequence' | 'project-mind' }>;
export interface ResolvedAgentMindArtifact {
    ref: AgentMindRef;
    availability: 'resolved' | 'missing' | 'stale' | 'unavailable';
    diagnostic: string;
    title?: string;
    objective?: string;
    status?: string;
    taskOrigin?: string;
    validationStatus?: 'passed' | 'failed' | 'incomplete' | 'unavailable';
    reviewDecision?: 'accept' | 'reject';
    promotionStatus?: 'applied' | 'not-applied';
    source?: 'agent-task' | 'agent-run' | 'agent-sequence' | 'project-mind';
}

/** Compact owner metadata only; Session references never start or mutate linked work. */
export class DeveloperSessionAgentMindResolver {
    constructor(
        private readonly scope: () => { root: string; projectHandle: string } | undefined,
        private readonly sessions = new DeveloperSessionStore(),
        private readonly agents = new AgentStore(),
        private readonly mind = new ProjectMindStore(),
    ) {}

    async resolve(projectHandle: string, input: AgentMindRef): Promise<ResolvedAgentMindArtifact> {
        const ref = parseSessionArtifactRef(input);
        if (ref.kind === 'chat' || ref.kind === 'planning-map' || ref.kind === 'work-item')
            throw new Error('Unsupported Session resolver reference');
        const attached = this.scope();
        if (!attached || attached.projectHandle !== projectHandle) throw new Error('Invalid Development Sessions handle');
        const root = attached.root;
        const snapshot = await this.sessions.read(root);
        if (snapshot.project.canonicalRoot !== root) throw new Error('Development Sessions project identity changed');
        const stillAttached = () => {
            const current = this.scope();
            if (!current || current.root !== root || current.projectHandle !== projectHandle)
                throw new Error('Superseded Development Sessions handle');
        };
        const result = (availability: ResolvedAgentMindArtifact['availability'], diagnostic: string,
            extra: Partial<ResolvedAgentMindArtifact> = {}): ResolvedAgentMindArtifact =>
            ({ ref, availability, diagnostic, ...extra });
        try {
            if (ref.kind === 'project-mind') {
                const project = await this.mind.read(root);
                stillAttached();
                if (!project) return result('missing', 'Project Mind is absent');
                if (snapshot.project.projectMindId && snapshot.project.projectMindId !== project.projectId)
                    return result('stale', 'Project Mind identity changed');
                const artifact = project.artifacts.find(item => item.id.toLowerCase() === ref.artifactId.toLowerCase());
                if (!artifact) return result('missing', 'Project Mind artifact is absent');
                if (artifact.type !== ref.artifactType)
                    return result('stale', 'Project Mind artifact type changed');
                return result('resolved', 'Project Mind owner metadata',
                    { source: 'project-mind', title: artifact.title.slice(0, 160), status: artifact.status });
            }
            if (ref.kind === 'agent-sequence') {
                const sequence = await this.agents.readSequence(root, ref.sequenceId);
                stillAttached();
                return sequence ? result('resolved', 'Agent sequence owner metadata',
                    { source: 'agent-sequence', title: sequence.stack.folderName.slice(0, 160), status: sequence.status }) :
                    result('missing', 'Agent sequence is absent');
            }
            const task = await this.agents.readTask(root, ref.taskId);
            stillAttached();
            if (!task) return result('missing', 'Agent task is absent');
            if (task.id !== ref.taskId) return result('unavailable', 'Agent task identity is invalid');
            if (task.origin.kind === 'work-item' && task.projectId !== task.origin.projectId)
                return result('stale', 'Agent task project relationship changed');
            const display = { objective: task.objective.slice(0, 400), taskOrigin: task.origin.kind };
            if (ref.kind === 'agent-task')
                return result('resolved', 'Agent task owner metadata', { source: 'agent-task', ...display });
            const run = await this.agents.readRun(root, ref.runId);
            stillAttached();
            if (!run) return result('missing', 'Agent run is absent', display);
            if (run.taskId !== task.id || run.projectId !== task.projectId)
                return result('stale', 'Agent run does not belong to requested task', display);
            const validation = run.candidateReview?.validation ?? run.validationResults;
            const owned = validation.filter(item => item.owner === 'dope' &&
                (!run.candidateFingerprint || item.candidateFingerprint === run.candidateFingerprint));
            const targetsCovered = task.completion.validation.every(target =>
                owned.some(item => item.kind === target.kind && item.label === target.label && item.status === 'passed'));
            const validationStatus = owned.some(item => item.status === 'failed') ? 'failed' :
                owned.length && owned.every(item => item.status === 'passed') && targetsCovered ? 'passed' :
                owned.length ? 'incomplete' : 'unavailable';
            const promoted = run.status === 'completed' &&
                run.authorityDecision?.allowed === true && run.appliedFiles !== undefined &&
                (!run.reviewDecision || run.reviewDecision.kind === 'accept' &&
                    run.reviewDecision.candidateFingerprint === run.candidateFingerprint);
            return result('resolved', 'Agent run owner metadata', { source: 'agent-run', ...display,
                status: run.status, validationStatus, reviewDecision: run.reviewDecision?.kind,
                promotionStatus: promoted ? 'applied' : 'not-applied' });
        } catch {
            stillAttached();
            return result('unavailable', 'Owner metadata is unavailable or invalid');
        }
    }
}

/** Connection scope is supplied by the Session backend; no owner store mints authority. */
export class DeveloperSessionChatPlanningResolver {
    constructor(
        private readonly scope: () => { root: string; projectHandle: string } | undefined,
        private readonly sessions = new DeveloperSessionStore(),
        private readonly chats = new ChatRepository(),
        private readonly planning = new PlanningStore(),
        private readonly basisEvidence?: (root: string) => Promise<PlanningBasis | undefined>,
    ) {}

    async resolve(projectHandle: string, input: ChatPlanningRef): Promise<ResolvedChatPlanningArtifact> {
        const ref = parseSessionArtifactRef(input);
        if (ref.kind !== 'chat' && ref.kind !== 'planning-map' && ref.kind !== 'work-item')
            throw new Error('Unsupported Session resolver reference');
        const attached = this.scope();
        if (!attached || attached.projectHandle !== projectHandle) throw new Error('Invalid Development Sessions handle');
        const root = attached.root;
        const snapshot = await this.sessions.read(root);
        if (snapshot.project.canonicalRoot !== root || snapshot.project.projectMindId !== null)
            throw new Error('Development Sessions project identity changed');
        const stillAttached = () => {
            const current = this.scope();
            if (!current || current.root !== root || current.projectHandle !== projectHandle)
                throw new Error('Superseded Development Sessions handle');
        };
        const result = (availability: ResolvedChatPlanningArtifact['availability'], diagnostic: string,
            extra: Partial<ResolvedChatPlanningArtifact> = {}): ResolvedChatPlanningArtifact =>
            ({ ref, availability, diagnostic, ...extra });
        try {
            if (ref.kind === 'chat') {
                const chat = await this.chats.peekMetadata(root, ref.chatId);
                stillAttached();
                return chat ? result('resolved', 'Chat metadata read from owner store',
                    { title: chat.title, observedRevision: chat.revision }) : result('missing', 'Chat is absent');
            }
            const collection = await this.planning.read(root);
            stillAttached();
            const map = collection.maps.find(item => item.id === ref.mapId);
            if (!map) return result('missing', 'Planning Map is absent', { observedRevision: collection.revision });
            // Planning project identity is independent of Session/Project Mind identity.
            if (map.projectId !== collection.projectId) return result('unavailable', 'Planning project identity mismatch');
            const item = ref.kind === 'work-item' ? map.workItems.find(work => work.id === ref.workItemId) : undefined;
            if (ref.kind === 'work-item' && !item)
                return result('missing', 'WorkItem is absent from its Planning Map', { observedRevision: map.revision });
            const display = { title: item?.title ?? map.title, status: item?.status ?? map.status,
                observedRevision: map.revision, observedBasis: map.basis };
            const currentBasis = await this.basisEvidence?.(root);
            stillAttached();
            if (!currentBasis) return result('unavailable', 'Current semantic Planning basis is unavailable', display);
            if (!sameSemanticBasis(map.basis, currentBasis))
                return result('stale', 'Planning Map semantic basis changed', display);
            return result('resolved', 'Planning metadata read from owner store', display);
        } catch (error) {
            stillAttached();
            return result('unavailable', 'Owner metadata is unavailable or invalid');
        }
    }
}
