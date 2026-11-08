import { createHash, randomUUID } from 'node:crypto';
import type { ChatClient, ChatDeltaRequest, ChatLeaseRequest, ChatMutation, ChatSearchRequest, ChatService,
    ChatTurnRequest, ChatOperation, ChatContextPreview, ChatTurnResult, ChatPlanningProposal,
    ChatContextSelection, ChatEvent, ChatCommandMode, ChatCommandPreview } from '@dope/chat/lib/service';
import type { ChatRoadmapStageSnapshot } from '@dope/chat/lib/service';
import type { ChatSkill, ChatSkillChange } from '@dope/chat/lib/service';
import { boundPromptStage, changeChatSkill, generationChatSkillSnapshot, isBoundDocumentationSkill, isBoundRoadmapSkill, listChatSkills, resolveChatSkill, roadmapPublicationIntent } from './chat-skills';
import { suggestedChatTitle, ChatActivityRecorder, safeChatToolPath, type Chat, type ChatAssistantMessage, type ChatModelProvenance, type ChatModelSelection, type ChatPlanningActivity, type ChatPromptStackProposal, type ChatRoadmapAction, type ChatUserMessage } from '@dope/chat';
import { parseChatContextRef } from '@dope/chat';
import { ChatRepository } from '@dope/chat/lib/node';
import { ModelRuntimeFailure, type ConversationEvent, type ConversationMessage, type ConversationModelCapabilities } from '@dope/contracts/lib/model-runtime';
import type { AIRoleHardConstraints, RoutingProvenance } from '@dope/ai';
import { ModelConnectionsRegistry } from './model-connections';
import { ChatContextComposer } from './chat-context-composer';
import { ChatProjectGrounder, type GroundingResult } from './chat-project-grounder';
import { runChatInvestigationCommand } from './chat-command-broker';
import { AIRoleRoutingService, RoleRoutingFailure, exactRoutingProvenance, type RoutedConversationEvent } from './ai-role-routing';
import { ProjectPlanningActions, type PlanningAction, type PlanningActionRequest } from '@dope/project-intelligence/lib/node/project-planning-actions';
import { LocalPlanningOutputFailure, allowsPlainGateAnswer, localPlanningJson, requestsRoadmapOwnerRevision,
    roadmapLocalBudget, verifyRoadmapLocalInput } from './roadmap-local-model';
import { RoadmapGreenfield, type GreenfieldEdit, type GreenfieldEditPreview } from '@dope/project-intelligence/lib/node/roadmap-greenfield';
import { readRoadmapDocumentCapabilities } from '@dope/project-intelligence/lib/node/roadmap-document-patch';
import { selectDopeCapabilityHelp } from './dope-capability-help';
import type { VisualPlanningService } from '@dope/visual-planning/lib/service';
import { BridgeLocalProposal } from './bridge-local-proposal';
import { roadmapGenerationCommand } from './roadmap-generation-command';
import { RoadmapGenerationController, type GenerationIdentity, type GenerationPhase } from './roadmap-generation-controller';
import { roadmapActionTargets, roadmapProposalPreview } from './roadmap-proposal-presentation';
import { RoadmapStore } from '@dope/project-intelligence/lib/node/roadmap-store';
import type { RoadmapGateIndex } from '@dope/project-intelligence/lib/node/roadmap-gate-domain';
import type { RoadmapPublicationPreview, RoadmapExistingLinkPreview } from '@dope/project-intelligence/lib/node/roadmap-publication';
import { verifiedPublicationFile } from '@dope/project-intelligence/lib/node/roadmap-publication';
import { RoadmapNativeStageOwner } from './roadmap-native-stage';
import { RoadmapGenerationNativeStage } from './roadmap-generation-native-stage';
import { typedRoadmapCounts } from './roadmap-typed-stage';
import { prepareDocumentationReview, documentationReviewApplicability, documentationDependencyConflict,
    renewDocumentationReviewLease } from './documentation-review';
import { applyDocumentationProposal, reconcileDocumentationApplication } from './documentation-application';
import { discoverDocumentation, documentationReviewObjective } from './documentation-discovery';
import type { DocumentationReadPage } from './documentation-skill-review';
import { promptStageCommand, priorPromptDraft, verifyPromptDraftSource, verifyPromptSourceRefs,
    promptStageInstruction, finishedPromptText, requestedWorkPromptCount,
    validatePromptAssessment, validatePromptPlan } from './prompt-authoring-stage';
import { capturePromptSourceEvidence, validatePromptStackProposal } from './prompt-stack-proposal';
import { PlanningStackPublication } from './planning-stack-publication';
import { IncrementalProposalController, type ProposalHandoff } from './incremental-proposal-controller';
import { documentModelStage, promptModelStage, proposalToolError } from './proposal-model-tools';
import { IncrementalDocumentReview } from './incremental-document-review';
import { IncrementalPromptStack } from './incremental-prompt-stack';

function draftInstruction(projectId: string, revision: number, maxSteps?: 2 | 3): string {
    void projectId; void revision; void maxSteps;
    return 'This is a historical noncanonical Roadmap draft. Answer read-only questions as strict JSON {"type":"no-action","message":"your answer"}. For AI changes, ask the developer to use a fresh native Roadmap request after resolving the draft. Do not output mutation actions or claim an edit was applied.';
}

const chatHard: AIRoleHardConstraints = { requiredCapabilities: ['conversationalText', 'streaming'],
    locality: 'any', enabledOnly: true, usableOnly: true, hostedProjectData: 'requires-feature-authorization' };
const acceptedRoadmapEditPrompt = 'For accepted Roadmap changes, use roadmap_read before roadmap_stage. Dope retains the trusted source and revision from that read; do not supply either field in stage calls. When the user selected Roadmap elements, use their exact IDs and the selected array in the attached context; other included entities are context, not explicit selections. If the written request names other Phases or all Gates, discover that scope even when the selection contains only one Phase. If target IDs are unknown, call roadmap_read with only version: 1 to discover entities. Phase entries include gateIds; use those IDs to read their Gates in groups of at most 20. Results are paged: while nextOffset is not null, call roadmap_read again with offset: nextOffset when more entities are needed. Do not ask the user for IDs available through roadmap_read, and do not conclude that an entity is absent from one page. For known selected IDs, read only those IDs. To edit several Gates, use each gate ID from the read result and supply its complete title and purpose; Gate designation is a separate field, so remove redundant numbering from title without changing designation. Stage typed operations in ordered batches of at most eight with expectedStage starting at 1. Use new: aliases across batches. Set done true only on the final batch. A Gate deletion needs only gate.delete with its exact ID: the Roadmap owner renumbers later sibling Gates, so stage that one action with done true and do not send separate reorder or designation edits. Include complete Gates and observable Criteria for structural edits. The server validates the stage for a preview. Do not emit mutation JSON in your final answer or claim an applied change. For read-only questions, answer without staging.';
const emptyRoadmapEditPrompt = 'The Roadmap is uninitialized. Answer read-only questions without staging or claiming a Roadmap was created. If creation was requested but the intent is unclear, ask one precise question.';
function forbidsCommandExecution(content: string): boolean {
    return content.split(/(?<=[.!?;])\s+|;\s*|\n+(?=\s*[-*]\s+)/).some(clause =>
        /\bdo\s+not\b.{0,160}\b(?:execute|run)\s+commands?\b\s*(?:,|[.!?;]?\s*$)/i.test(clause));
}
/** A direct instruction in the current request, not a quoted example or discussion. */
export function forbidsProjectTools(content: string): boolean {
    const prose = content.replace(/```[\s\S]*?```/g, '');
    return prose.split('\n').filter(line => !/^\s*(?:>|[-*]\s*['"`])/.test(line)).some(line =>
        /(?:^|[.!?]\s+)(?:please\s+)?do\s+not\s+(?:call|use|invoke)\s+(?:any\s+|project\s+)?tools\b/i.test(line));
}
function tracePlanning(stage: string, chatId: string, messageId: string, status?: string): void {
    if (process.env.DOPE_CHAT_PLANNING_TRACE !== '1') return;
    console.info('[dope-chat-planning-trace]', JSON.stringify({ at: new Date().toISOString(),
        stage, chatId, messageId, ...(status ? { status } : {}) }));
}
function evidenceIdentity(ref: { kind: string; id: string; contentHash?: string; sourceHash?: string;
    projectId?: string; generation?: number }) {
    return [ref.kind, ref.id, ref.contentHash, ref.sourceHash, ref.projectId, ref.generation];
}
function sameAutomaticEvidence(grounding: GroundingResult | undefined, saved: ChatUserMessage['contextRefs']): boolean {
    return JSON.stringify((grounding?.blocks ?? []).map(block => evidenceIdentity(block.ref))) ===
        JSON.stringify(saved.filter(ref => ref.origin === 'automatic').map(evidenceIdentity));
}
function sameRefIdentities(next: ChatUserMessage['contextRefs'], initial: ChatUserMessage['contextRefs']): boolean {
    return next.length === initial.length && next.every((ref, index) =>
        JSON.stringify(evidenceIdentity(ref)) === JSON.stringify(evidenceIdentity(initial[index])) &&
        (ref.origin !== 'automatic' || !initial[index].includedBytes || !!ref.includedBytes));
}
function planningComposerCapabilities(capabilities: ConversationModelCapabilities,
    budget: ReturnType<typeof roadmapLocalBudget> | undefined, draft?: { text: string }): ConversationModelCapabilities {
    if (!budget) return capabilities;
    // The draft is prepended after composition, so charge it before packing optional context.
    const draftTokens = draft ? Math.ceil(Buffer.byteLength(JSON.stringify([{ role: 'system', content: draft.text }]), 'utf8') / 3) : 0;
    return { ...capabilities, maxInputTokens: Math.max(0, budget.composerInputTokens - draftTokens) };
}

/** One RPC connection owns one project handle; the repository shares durable state and events. */
export class ChatBackend implements ChatService {
    listSkills(): Promise<ChatSkill[]> { return listChatSkills(); }
    changeSkill(change: ChatSkillChange): Promise<ChatSkill[]> { return changeChatSkill(change); }
    private root?: string;
    private handle?: string;
    private disposed = false;
    private attaching = 0;
    private readonly unlisten: () => void;
    private readonly unlistenPlanningConflicts?: () => void;
    private readonly turns = new Map<string, { token: string; abort: AbortController }>();
    private readonly pendingOutputLimits = new Map<string, { root: string; leaseToken: string;
        messageId: string; executionId: string; segment: number; cursor: number;
        selectedModel: ChatModelSelection; actualModel: ChatModelProvenance; sourceBasis?: string;
        resolve: (decision: 'stop' | 'continue') => void }>();
    private readonly generationPreparing = new Set<string>();
    private readonly generationControllers = new Map<string, { token: string; controller: RoadmapGenerationController }>();
    private readonly nativeStages?: RoadmapNativeStageOwner;
    private readonly roadmapPreparations = new Map<string, { token: string; abort: AbortController }>();
    /** Leases belong to this RPC connection, not to the reusable panel ID or backend PID. */
    private readonly leases = new Map<string, { root: string; token: string; ownerId: string }>();
    private readonly commandModes = new Map<string, ChatCommandMode>();
    private readonly promptPublisher = new PlanningStackPublication(async () => {
        throw new Error('Bridge owner is unavailable to native prompt publication');
    });
    private readonly pendingCommands = new Map<string, { preview: ChatCommandPreview; root: string;
        leaseToken: string; turn: AbortController; digest: string; sourceBasis: string;
        finish: (decision: 'allow' | 'deny' | 'expired') => void }>();
    private readonly pendingCancel = new Map<string, string>();
    private readonly proposals = new Map<string, { id: string; messageId: string; leaseToken: string;
        handle?: string; request?: PlanningActionRequest; token?: string; changedIds: string[];
        nativeStageId?: string; generationOnly?: boolean;
        publication?: { root: string; mode: 'publish' | 'link'; preview: RoadmapPublicationPreview | RoadmapExistingLinkPreview };
        undo?: { handle: string; ownerId: string; revision: number; token: string };
        draft?: { handle: string; preview: GreenfieldEditPreview };
        }>();
    private readonly nativeProposalEdits = new Set<string>();
    private readonly gateUndo = new Map<string, { handle: string; ownerId: string; revision: number;
        token: string; leaseToken: string }>();
    private async updateRoadmapAction(root: string, chatId: string, messageId: string, leaseToken: string,
        offerId: string, expected: ChatRoadmapAction['status'], status: ChatRoadmapAction['status'],
        extra: Partial<Pick<ChatRoadmapAction, 'stage' | 'draftRevision' | 'diagnostic'>> = {}): Promise<void> {
        const message = (await this.repository.read(root)).chats.find(chat => chat.id === chatId)?.messages
            .find(item => item.id === messageId);
        if (!message || message.role !== 'assistant' || message.roadmapAction?.offerId !== offerId ||
            message.roadmapAction.status !== expected) throw new Error('Roadmap action is no longer current');
        const { stage: _stage, draftRevision: _draftRevision, diagnostic: _diagnostic, ...base } = message.roadmapAction;
        await this.repository.recordRoadmapAction(root, chatId, messageId, leaseToken,
            { ...base, status, ...extra }, { offerId, status: expected });
    }

    constructor(private readonly repository: ChatRepository, private readonly client: ChatClient,
        private readonly models?: ModelConnectionsRegistry, private readonly composer?: ChatContextComposer,
        private readonly routing?: AIRoleRoutingService, private readonly grounder?: ChatProjectGrounder,
        private readonly planning?: ProjectPlanningActions, private readonly greenfield?: RoadmapGreenfield,
        private readonly bridgePlanning?: VisualPlanningService & { dispose?: () => void },
        private readonly roadmapStore?: RoadmapStore) {
        this.nativeStages = roadmapStore ? new RoadmapNativeStageOwner(roadmapStore) : undefined;
        this.unlistenPlanningConflicts = roadmapStore?.onPlanningConflict((root, projectId) =>
            !this.disposed && (this.nativeStages?.hasPending(root, projectId) ||
                [...this.proposals.keys()].some(chatId => this.leases.get(chatId)?.root === root)) || false);
        this.unlisten = repository.onChange((root, event) => {
            if (!this.disposed && root === this.root && this.handle)
                client.notifyChatEvent({ ...event, projectHandle: this.handle });
        });
    }

    async attach(folderUri: string) {
        if (this.disposed) throw new Error('Disposed Chat connection');
        const request = ++this.attaching;
        const root = await this.repository.root(folderUri);
        if (this.disposed || request !== this.attaching) throw new Error('Superseded Chat attachment');
        if (this.root && this.root !== root) throw new Error('A different Chat project is already attached');
        const snapshot = await this.repository.read(root);
        if (this.disposed || request !== this.attaching) throw new Error('Superseded Chat attachment');
        this.root = root;
        this.handle ??= randomUUID();
        return { projectHandle: this.handle, snapshot };
    }

    private active(handle: string): string {
        if (this.disposed || !this.root || handle !== this.handle) throw new Error('Invalid or disposed Chat handle');
        return this.root;
    }

    private async draftContext(root: string, chatId: string, maxSteps?: 2 | 3) {
        await this.greenfield?.ensureRestored(root);
        const bound = this.greenfield?.chatDraft(root, chatId);
        if (!bound) return undefined;
        const current = await this.greenfield!.owner(root);
        if (current.projectId !== this.greenfield!.draftProjectId(bound.handle) ||
            current.revision || current.linkedDocument || current.pendingCreation)
            throw new Error('Greenfield Roadmap draft is stale');
        return { handle: bound.handle, revision: bound.draft.revision, projectId: current.projectId,
                text: `${draftInstruction(current.projectId, bound.draft.revision, maxSteps)}\nCurrent draft: ${JSON.stringify({ projectId: current.projectId,
                    draftRevision: bound.draft.revision, phases: bound.draft.phases.slice(-6).map(phase => ({
                        id: phase.id, title: phase.title, objective: phase.objective.slice(0, 200),
                        checkpoints: phase.checkpoints.slice(-5).map(item => ({ id: item.id, title: item.title,
                            objective: item.objective.slice(0, 200) })) })) })}` };
    }

    private withDraft(messages: readonly ConversationMessage[], draft?: { text: string }): readonly ConversationMessage[] {
        return draft ? [{ role: 'system' as const, content: draft.text }, ...messages] : messages;
    }

    private async roadmapOpportunity(root: string, content: string, ordinary: boolean): Promise<string | undefined> {
        if (!ordinary || !/\b(?:roadmap|milestone|plan|planning|start|begin|build|create|design)\b/i.test(content))
            return undefined;
        if (!this.greenfield) return 'Roadmap opportunity: the current project owner could not be checked. Do not claim the Roadmap is absent or offer to create a draft; suggest checking Roadmap first.';
        try {
            const state = await this.greenfield.readOpportunity(root);
            const base = `Checked read-only Roadmap opportunity for root ${JSON.stringify(root)}, projectId ${state.projectId}, owner revision ${state.revision}: `;
            if (state.revision || state.linkedDocument || state.canonicalMarkdown || state.pendingCreation || state.drafts)
                return base + `linked document ${state.linkedDocument ? JSON.stringify(state.linkedDocument) : 'none'}, ` +
                    `root ROADMAP.md present ${state.canonicalMarkdown}, ${state.gates} accepted Gates, ` +
                    `${state.draftGates} Gates in drafts, ` +
                    `creation pending ${state.pendingCreation}, ${state.drafts} Greenfield drafts. ` +
                    'An owner, creation, or draft already exists. Offer Open, Continue, or Review Roadmap as appropriate; do not offer a duplicate draft.';
            return base + 'revision zero, no linked document, pending creation, or Greenfield draft. ' +
                'A user may submit a fresh /gen-roadmap command with a prompt in Chat. Do not start generation from this ordinary message or claim a draft exists.';
        } catch {
            return 'Roadmap opportunity: the current project owner or draft state could not be verified. ' +
                'Do not infer absence or offer draft creation; suggest checking Roadmap first.';
        }
    }
    /** A protected edit needs a current owner; an empty owner enters the reviewed creation flow. */
    private async bindRoadmapSkill(root: string, selections: ChatContextSelection[], chatId?: string):
        Promise<{ greenfield: boolean; revision: number }> {
        if (!this.roadmapStore) throw new Error('Current Roadmap owner is unavailable');
        const index = await this.roadmapStore.read<RoadmapGateIndex>(root);
        if (index.schemaVersion !== 2 || index.projectRoot !== root)
            throw new Error('Current Roadmap owner is invalid');
        if (!index.revision) {
            if (selections.some(item => item.kind === 'roadmap')) {
                await this.greenfield?.ensureRestored(root);
                const bound = chatId && this.greenfield?.chatDraft(root, chatId);
                if (!bound || selections.filter(item => item.kind === 'roadmap').some(item => !item.elementKind ||
                    item.projectId !== index.projectId || item.ownerRevision !== 0 ||
                    item.draftHandle !== bound.handle || item.draftRevision !== bound.draft.revision))
                    throw new Error('Selected Roadmap draft changed; select its elements again');
                return { greenfield: true, revision: 0 };
            }
            await this.greenfield?.ensureRestored(root);
            if (chatId && this.greenfield?.chatDraft(root, chatId)) return { greenfield: true, revision: 0 };
            selections.push({ kind: 'roadmap', id: 'roadmap', projectId: index.projectId,
                ownerRevision: 0 });
            return { greenfield: false, revision: 0 };
        }
        if (selections.some(item => item.kind === 'roadmap' && item.draftHandle))
            throw new Error('Selected Roadmap draft was published or replaced; select its elements again');
        if (!selections.some(item => item.kind === 'roadmap'))
            selections.push({ kind: 'roadmap', id: 'roadmap', projectId: index.projectId,
                ownerRevision: index.revision, sourceHash: index.linkedDocument?.sourceHash });
        return { greenfield: false, revision: index.revision };
    }

    private async composeTurn(root: string, chat: Chat, content: string, context: ChatContextSelection[],
        model: ConversationModelCapabilities, budget?: ReturnType<typeof roadmapLocalBudget>,
        draft?: { text: string }, grounding?: GroundingResult, bridgeMode = false,
        opportunity?: string, piMode = false, roadmapSkill = false,
        roadmapPromptMode: 'ordinary' | 'native-roadmap-edit' = 'ordinary', ordinaryChat = false,
        specializedTurn = false) {
        const nativeRoadmap = roadmapPromptMode !== 'ordinary';
        const capabilities = planningComposerCapabilities(model, budget, draft);
        let inputTokens = capabilities.maxInputTokens;
        for (let attempt = 0; attempt < 4; attempt++) {
            const composed = await this.composer!.compose(root, chat, content, context,
                inputTokens === undefined ? capabilities : { ...capabilities, maxInputTokens: inputTokens }, grounding,
                !!budget, bridgeMode, opportunity, piMode, roadmapSkill, nativeRoadmap, ordinaryChat,
                specializedTurn);
            if (!budget) return composed;
            const messages = this.withDraft(composed.messages, draft);
            const bytes = Buffer.byteLength(JSON.stringify(messages), 'utf8');
            if (bytes <= budget.inputBytes) {
                verifyRoadmapLocalInput(this.withDraft(composed.messages, draft), budget);
                return composed;
            }
            if (attempt === 3) verifyRoadmapLocalInput(this.withDraft(composed.messages, draft), budget);
            // Repack optional context against the exact serialized excess. No provider call occurs here.
            inputTokens = Math.max(0, inputTokens! - Math.ceil((bytes - budget.inputBytes) / 3) - 32);
        }
        throw new ModelRuntimeFailure('Local planning context exceeds the measured budget; reduce the request',
            'unsupported-capability');
    }

    private async verifyLoadedCapacity(selection: { connectionId: string; modelId: string },
        expected: ReturnType<typeof roadmapLocalBudget>, requestedOutput: number): Promise<void> {
        const connection = (await this.models!.list()).connections.find(item => item.id === selection.connectionId);
        const model = connection?.models.find(item => item.id === selection.modelId && item.usable);
        if (!connection?.ready || connection.providerId !== 'local' || !model ||
            model.capabilities.contextWindowTokens !== expected.total)
            throw new ModelRuntimeFailure('Loaded local context changed or is unknown; preview this turn again',
                'unsupported-capability');
        const current = roadmapLocalBudget(model.capabilities.contextWindowTokens, requestedOutput, model.capabilities);
        if (current.inputBytes !== expected.inputBytes || current.output !== expected.output)
            throw new ModelRuntimeFailure('Loaded local input or output limit changed; preview this turn again',
                'unsupported-capability');
    }

    read(projectHandle: string) { return this.repository.read(this.active(projectHandle)); }
    async list(projectHandle: string) { return (await this.read(projectHandle)).chats; }
    async get(projectHandle: string, chatId: string) {
        return (await this.read(projectHandle)).chats.find(chat => chat.id === chatId);
    }
    mutate(request: ChatMutation) {
        if (!request || typeof request !== 'object') throw new Error('Invalid Chat mutation');
        if (request.operation?.type === 'finish-assistant' && request.operation.planningActivity)
            throw new Error('Backend-only Roadmap outcome');
        return this.repository.mutate(this.active(request.projectHandle), request.expectedRevision,
            request.operation, request.leaseToken);
    }
    search(request: ChatSearchRequest) {
        if (!request || typeof request !== 'object') throw new Error('Invalid Chat search request');
        return this.repository.search(this.active(request.projectHandle), request.query, request.limit, request.excludeChatId);
    }
    async previewContext(request: { projectHandle: string; chatId: string; selectedModel: NonNullable<ChatTurnRequest['selectedModel']>;
        content: string; context: NonNullable<ChatTurnRequest['context']> }): Promise<ChatContextPreview> {
        const root = this.active(request.projectHandle);
        if (!this.composer || !this.models) throw new Error('Context composer unavailable');
        const chat = (await this.repository.read(root)).chats.find(item => item.id === request.chatId);
        if (!chat) throw new Error('Chat not found');
        const model = (await this.models.list()).connections.find(item => item.id === request.selectedModel.connectionId)
            ?.models.find(item => item.id === request.selectedModel.modelId && item.usable);
        if (!model) throw new Error('Selected model unavailable');
        const skill = await resolveChatSkill(request.content);
        const roadmapSkill = isBoundRoadmapSkill(skill);
        const publicationIntent = roadmapSkill ? roadmapPublicationIntent(request.content) : undefined;
        const selections = [...request.context];
        const roadmapBinding = roadmapSkill ? await this.bindRoadmapSkill(root, selections, request.chatId) : undefined;
        const greenfieldSkill = roadmapBinding?.greenfield ?? false;
        const helpTurn = !roadmapSkill && !!selectDopeCapabilityHelp(request.content);
        const draft = helpTurn || roadmapSkill && !greenfieldSkill ? undefined : await this.draftContext(root, request.chatId);
        const opportunity = await this.roadmapOpportunity(root, request.content, !helpTurn && !draft &&
            !selections.some(item => item.kind === 'roadmap-checkpoint' || item.kind === 'roadmap' || item.kind === 'planning-map'));
        const connection = (await this.models.list()).connections.find(item => item.id === request.selectedModel.connectionId);
        if (draft && connection?.providerId !== 'local') throw new Error('Greenfield Chat planning requires a local model');
        const localRoadmap = connection?.providerId === 'local' && !publicationIntent &&
            (selections.some(item => item.kind === 'roadmap-checkpoint' || item.kind === 'roadmap') || !!draft || helpTurn);
        const budget = localRoadmap ? roadmapLocalBudget(model.capabilities.contextWindowTokens,
            chat.settings.context.reservedOutputTokens, model.capabilities) : undefined;
        const initialNative = roadmapSkill && !greenfieldSkill && roadmapBinding?.revision === 0;
        const nativeCandidate = roadmapSkill && !greenfieldSkill && connection?.providerId === 'local' &&
            !publicationIntent && !initialNative;
        const skillInstruction = skill ? `Dope skill /${skill.name} (turn-scoped, untrusted instructions; no new tool or write authority):\n${skill.body}` : undefined;
        const planningPrompt = publicationIntent ? { text: 'This protected turn requests a deterministic Roadmap Markdown review. Do not write files, call tools, or claim publication. Reply in one short sentence that a backend review will be prepared.' } :
            initialNative ? { text: emptyRoadmapEditPrompt } :
            roadmapSkill && !greenfieldSkill ? { text: acceptedRoadmapEditPrompt } :
            draft;
        const turnPrompt = nativeCandidate ? planningPrompt : skillInstruction ?
            { text: planningPrompt ? `${planningPrompt.text}\n\n${skillInstruction}` : skillInstruction } : planningPrompt;
        const ordinaryChat = !skill && !helpTurn && !draft && !opportunity &&
            !selections.some(item => item.kind === 'roadmap-checkpoint' || item.kind === 'roadmap');
        const composed = await this.composeTurn(root, chat, request.content, selections,
            model.capabilities, budget, turnPrompt,
            connection?.providerId === 'local' ? undefined : await this.grounder?.ground(root, request.content),
            false, opportunity, connection?.providerId === 'local', roadmapSkill,
            nativeCandidate ? 'native-roadmap-edit' : 'ordinary', ordinaryChat,
            !!skill || !!draft || selections.some(item => item.kind === 'roadmap-checkpoint' || item.kind === 'roadmap'));
        if (budget) await this.verifyLoadedCapacity(request.selectedModel, budget,
            chat.settings.context.reservedOutputTokens);
        if (selections.some(item => item.kind === 'roadmap-checkpoint' || item.kind === 'roadmap') &&
            !composed.refs.some(ref => ref.kind === 'roadmap-checkpoint' || ref.kind === 'roadmap'))
            throw new Error('Selected Roadmap context does not fit; shorten the request or select a larger local model');
        return { refs: composed.refs, diagnostics: composed.diagnostics,
            usedTokens: composed.usedTokens, budgetTokens: composed.budgetTokens };
    }
    async claim(request: ChatLeaseRequest) {
        if (!request || typeof request !== 'object') throw new Error('Invalid Chat lease request');
        const root = this.active(request.projectHandle);
        const result = await this.repository.claim(root, request.chatId, request.ownerId);
        if (result.acquired) {
            try {
                if (this.disposed) throw new Error('Disposed Chat connection');
                // Other previews remain tied to their old session. A saved Docs review
                // may continue only for the same panel owner and unchanged source.
                await this.retirePending(root, request.chatId, result.token, 'stale', true);
                await this.reclaimPendingDocumentation(root, request.chatId, request.ownerId, result.token);
                await this.reclaimPendingPromptStacks(root, request.chatId, result.token);
                await this.retireRoadmapActions(root, request.chatId, result.token);
                if (this.disposed) throw new Error('Disposed Chat connection');
                this.clearProposal(request.chatId);
                this.clearGateUndo(request.chatId);
                this.leases.set(request.chatId, { root, token: result.token, ownerId: request.ownerId });
                this.commandModes.set(request.chatId, 'ask');
            } catch (error) {
                await this.repository.release(root, request.chatId, result.token).catch(() => {});
                throw error;
            }
        }
        return result;
    }
    renew(projectHandle: string, chatId: string, token: string) {
        return this.repository.renew(this.active(projectHandle), chatId, token);
    }
    async readNativeRoadmapStage(projectHandle: string, chatId: string, turnId: string,
        leaseToken: string): Promise<ChatRoadmapStageSnapshot | undefined> {
        const root = this.active(projectHandle);
        if (!this.nativeStages || this.leases.get(chatId)?.root !== root ||
            this.leases.get(chatId)?.token !== leaseToken ||
            !(this.turns.get(chatId)?.token === leaseToken &&
                !this.turns.get(chatId)?.abort.signal.aborted ||
                this.generationControllers.get(chatId)?.token === leaseToken &&
                this.generationControllers.get(chatId)?.controller.identity.turnId === turnId))
            return undefined;
        const stage = this.nativeStages.get(chatId);
        if (!stage || stage.context.root !== root || stage.context.turnId !== turnId ||
            stage.context.lease !== leaseToken) return undefined;
        await this.repository.renew(root, chatId, leaseToken);
        return this.nativeStages.snapshot(stage.context);
    }
    async release(projectHandle: string, chatId: string, token: string) {
        const root = this.active(projectHandle);
        if (this.leases.get(chatId)?.token === token) {
            this.pendingCommands.get(chatId)?.finish('deny');
            this.commandModes.delete(chatId);
        }
        if (this.turns.get(chatId)?.token === token) this.turns.get(chatId)?.abort.abort();
        if (this.leases.get(chatId)?.token === token)
            await this.retireRoadmapActions(root, chatId, token).catch(() => {});
        await this.repository.release(root, chatId, token);
        if (this.leases.get(chatId)?.token === token) {
            this.leases.delete(chatId); this.clearProposal(chatId); this.clearGateUndo(chatId);
        }
    }
    async setCommandMode(projectHandle: string, chatId: string, leaseToken: string,
        mode: ChatCommandMode): Promise<void> {
        const root = this.active(projectHandle);
        if (mode !== 'ask' && mode !== 'allow') throw new Error('Invalid command mode');
        if (this.leases.get(chatId)?.root !== root || this.leases.get(chatId)?.token !== leaseToken)
            throw new Error('Chat command mode is not owned by this panel');
        await this.repository.renew(root, chatId, leaseToken);
        if (this.leases.get(chatId)?.token !== leaseToken) throw new Error('Chat command mode is stale');
        if (this.commandModes.get(chatId) !== mode) this.turns.get(chatId)?.abort.abort();
        this.commandModes.set(chatId, mode);
        this.pendingCommands.get(chatId)?.finish('deny');
    }
    async decideCommand(projectHandle: string, chatId: string, leaseToken: string,
        requestId: string, allowOnce: boolean): Promise<void> {
        const root = this.active(projectHandle);
        const pending = this.pendingCommands.get(chatId);
        if (typeof allowOnce !== 'boolean' || !pending || pending.preview.id !== requestId ||
            pending.root !== root || pending.leaseToken !== leaseToken ||
            this.leases.get(chatId)?.token !== leaseToken ||
            this.turns.get(chatId)?.abort !== pending.turn || pending.turn.signal.aborted ||
            Date.now() >= pending.preview.expiresAt || this.commandModes.get(chatId) !== 'ask' ||
            createHash('sha256').update(pending.preview.command).digest('hex') !== pending.digest)
            throw new Error('Command approval is stale or not owned by this Chat');
        if (!allowOnce) { pending.finish('deny'); return; }
        const chat = (await this.repository.read(root)).chats.find(item => item.id === chatId);
        const lastUser = chat?.messages.filter(item => item.role === 'user').at(-1);
        if (!lastUser || createHash('sha256').update(JSON.stringify(lastUser.contextRefs)).digest('hex') !==
            pending.sourceBasis) throw new Error('Command source basis changed');
        await this.repository.renew(root, chatId, leaseToken);
        if (this.pendingCommands.get(chatId) !== pending || this.turns.get(chatId)?.abort !== pending.turn ||
            pending.turn.signal.aborted || Date.now() >= pending.preview.expiresAt ||
            this.leases.get(chatId)?.token !== leaseToken || this.commandModes.get(chatId) !== 'ask')
            throw new Error('Command approval is stale or not owned by this Chat');
        // Consume before resuming Pi. The broker rechecks turn, lease and project.
        pending.finish(allowOnce ? 'allow' : 'deny');
    }
    private async requestCommand(root: string, request: ChatTurnRequest, command: string,
        turn: AbortController, sourceBasis: string): Promise<'granted' | 'denied' | 'expired'> {
        if (typeof command !== 'string' || !command.trim() || Buffer.byteLength(command, 'utf8') > 2048 ||
            /[\x00-\x08\x0b-\x1f\x7f]/u.test(command)) throw new Error('Command request denied');
        if (this.commandModes.get(request.chatId) === 'allow') return 'granted';
        if (this.commandModes.get(request.chatId) !== 'ask' || this.pendingCommands.has(request.chatId))
            throw new Error('Command request unavailable');
        const preview: ChatCommandPreview = { id: randomUUID(), command, project: root, cwd: root,
            sandbox: 'Project read-only; private temporary files; no network or private home',
            effect: 'Runs only inside the bounded Linux sandbox after approval', expiresAt: Date.now() + 60_000 };
        const digest = createHash('sha256').update(command).digest('hex');
        return new Promise<'granted' | 'denied' | 'expired'>(resolve => {
            let settled = false;
            const finish = (decision: 'allow' | 'deny' | 'expired') => {
                if (settled) return;
                settled = true; clearTimeout(timer); turn.signal.removeEventListener('abort', onAbort);
                if (this.pendingCommands.get(request.chatId)?.preview.id === preview.id)
                    this.pendingCommands.delete(request.chatId);
                if (this.handle) this.client.notifyChatEvent({ projectHandle: this.handle,
                    kind: 'command-settled', chatId: request.chatId, id: preview.id });
                resolve(decision === 'allow' ? 'granted' : decision === 'expired' ? 'expired' : 'denied');
            };
            const onAbort = () => finish('deny');
            const timer = setTimeout(() => finish('expired'), 60_000);
            this.pendingCommands.set(request.chatId, { preview, root, leaseToken: request.leaseToken,
                turn, digest, sourceBasis, finish });
            turn.signal.addEventListener('abort', onAbort, { once: true });
            if (turn.signal.aborted) { finish('deny'); return; }
            this.client.notifyChatEvent({ projectHandle: request.projectHandle,
                kind: 'command-pending', chatId: request.chatId, preview });
        });
    }
    publishDelta(request: ChatDeltaRequest) {
        if (!request || typeof request !== 'object') throw new Error('Invalid Chat delta request');
        return this.repository.publishDelta(this.active(request.projectHandle), request.chatId,
            request.messageId, request.executionId, request.sequence, request.delta, request.leaseToken);
    }
    private clearProposal(chatId: string): void {
        const pending = this.proposals.get(chatId);
        if (pending?.publication && this.roadmapStore) {
            const { root, mode, preview } = pending.publication;
            void (mode === 'publish' ? this.roadmapStore.applyRoadmapPublication(root,
                preview as RoadmapPublicationPreview, false) : this.roadmapStore.applyExistingRoadmapLink(root,
                    preview as RoadmapExistingLinkPreview, false)).catch(() => undefined);
        }
        if (pending?.handle) this.planning?.detach(pending.handle);
        if (pending?.draft) this.greenfield?.clearEditPreview(pending.draft.handle);
        if (pending?.nativeStageId) this.nativeStages?.forget(chatId);
        this.proposals.delete(chatId);
    }
    private clearGateUndo(chatId: string): void {
        const undo = this.gateUndo.get(chatId);
        if (undo) this.planning?.detach(undo.handle);
        this.gateUndo.delete(chatId);
    }

    private async retirePending(root: string, chatId: string, leaseToken: string,
        status: 'stale' | 'superseded' | 'cancelled' = 'stale',
        preserveReviewed = false): Promise<void> {
        const chat = (await this.repository.read(root)).chats.find(item => item.id === chatId);
        for (const message of chat?.messages ?? []) {
            if (message.role !== 'assistant' || message.planningActivity?.status !== 'pending' ||
                !message.planningActivity.proposalId) continue;
            if (message.planningActivity.kind === 'prompt-stack-proposal' ||
                preserveReviewed && message.planningActivity.kind === 'documentation-proposal')
                continue;
            await this.repository.recordPlanningActivity(root, chatId, message.id, leaseToken,
                { ...message.planningActivity, status },
                { proposalId: message.planningActivity.proposalId, status: 'pending' });
        }
    }
    private async reclaimPendingDocumentation(root: string, chatId: string, ownerId: string,
        leaseToken: string): Promise<void> {
        const chat = (await this.repository.read(root)).chats.find(item => item.id === chatId);
        for (const message of chat?.messages ?? []) {
            const activity = message.role === 'assistant' ? message.planningActivity : undefined;
            if (activity?.kind !== 'documentation-proposal' || activity.status !== 'pending' ||
                !activity.documentProposal || !activity.proposalId) continue;
            const proposal = activity.documentProposal;
            let next: typeof proposal | undefined;
            if (this.roadmapStore && proposal.chatId === chatId && proposal.messageId === message.id &&
                proposal.id === activity.proposalId) {
                try { next = await renewDocumentationReviewLease(this.roadmapStore, proposal,
                    root, ownerId, leaseToken); }
                catch { /* Changed owner, source, or proposal stays fail-closed. */ }
            }
            await this.repository.recordPlanningActivity(root, chatId, message.id, leaseToken,
                next ? { ...activity, documentProposal: next } : { ...activity, status: 'stale' },
                { proposalId: activity.proposalId, status: 'pending' });
        }
    }
    private async reclaimPendingPromptStacks(root: string, chatId: string,
        leaseToken: string): Promise<void> {
        const chat = (await this.repository.read(root)).chats.find(item => item.id === chatId);
        for (const message of chat?.messages ?? []) {
            const activity = message.role === 'assistant' ? message.planningActivity : undefined;
            const proposal = activity?.promptStackProposal;
            if (activity?.kind !== 'prompt-stack-proposal' || activity.status !== 'pending' || !proposal) continue;
            // The new panel has a fresh lease owner after reload. Its current Chat lease
            // authorizes decisions; the immutable proposal retains its originating owner.
            let current = proposal.chatId === chatId &&
                proposal.messageId === message.id && proposal.id === activity.proposalId;
            let reason = 'Prompt source, destination or owner changed.';
            try {
                if (!current || !this.grounder) throw new Error('Prompt owner unavailable');
                validatePromptStackProposal(proposal);
                const assessment = chat?.messages.find(item => item.id === proposal.assessmentMessageId);
                const plan = chat?.messages.find(item => item.id === proposal.planMessageId);
                if (assessment?.role !== 'assistant' || plan?.role !== 'assistant')
                    throw new Error('Prompt stages unavailable');
                await verifyPromptDraftSource(root, assessment, this.grounder);
                await verifyPromptDraftSource(root, plan, this.grounder);
                const git = await capturePromptSourceEvidence(root);
                current = git.head === proposal.gitHead && git.packageVersion === proposal.sourceVersion &&
                    git.worktreeFingerprint === proposal.worktreeId &&
                    !(await this.promptPublisher.inspect(root, proposal.folder)).record;
            } catch (error) {
                current = false;
                reason = `Prompt review needs a new source check: ${String(error).slice(0, 180)}`;
            }
            if (!current) await this.repository.recordPlanningActivity(root, chatId, message.id, leaseToken,
                { ...activity, status: 'stale', diagnostic: reason },
                { proposalId: proposal.id, status: 'pending', digest: proposal.digest });
        }
    }
    async reviewDocumentation(projectHandle: string, chatId: string, leaseToken: string, messageId: string,
        changes: { path: string; after: string }[]): Promise<import('@dope/chat').ChatDocumentationProposal> {
        const root = this.active(projectHandle);
        if (!this.roadmapStore || this.leases.get(chatId)?.root !== root ||
            this.leases.get(chatId)?.token !== leaseToken || this.turns.has(chatId))
            throw new Error('Current Chat and Roadmap ownership required for documentation review');
        const chat = (await this.repository.read(root)).chats.find(item => item.id === chatId);
        const at = chat?.messages.findIndex(item => item.id === messageId) ?? -1;
        const message = at < 0 ? undefined : chat?.messages[at];
        const user = at > 0 ? chat?.messages[at - 1] : undefined;
        if (!message || message.role !== 'assistant' || message.execution.status !== 'complete' ||
            message.planningActivity || !user || user.role !== 'user' ||
            !(/^(?:please\s+)?(?:review|formalize)\s+(?:the\s+)?(?:documentation|decision)\b/iu.test(user.content.trim()) ||
                /^\/docs-review(?=\s|$)/u.test(user.content) && isBoundDocumentationSkill(user.skill, 'docs-review')))
            throw new Error('A completed, explicit saved documentation review request is required');
        await this.repository.renew(root, chatId, leaseToken);
        const refs = (message.execution.sourceRefs ?? []).filter(ref => ref.kind === 'file');
        const dependencies = [...new Map(refs.map(ref => {
            if (!ref.sourceHash || ref.sourceHash !== ref.contentHash)
                throw new Error(`Grounding dependency identity unavailable: ${ref.id}`);
            return [ref.id, { path: ref.id, contentHash: ref.contentHash }] as const;
        })).values()];
        if (/^\/docs-review(?=\s|$)/u.test(user.content) && !dependencies.length)
            throw new Error('Review needs broker-read grounding dependencies');
        const proposal = await prepareDocumentationReview(this.roadmapStore,
            { root, chatId, messageId, ownerId: this.leases.get(chatId)!.ownerId, leaseToken, changes,
                ...(dependencies.length ? { dependencies } : {}) });
        if (await documentationReviewApplicability(this.roadmapStore, proposal, root) !== 'applicable')
            throw new Error('Documentation changed during review');
        await this.repository.recordPlanningActivity(root, chatId, messageId, leaseToken,
            { schemaVersion: 1, kind: 'documentation-proposal', status: 'pending',
                refs: message.execution.sourceRefs ?? [], proposalId: proposal.id, documentProposal: proposal });
        return proposal;
    }
    async inspectDocumentation(projectHandle: string, chatId: string, leaseToken: string,
        proposalId: string, proposalDigest: string): Promise<{
            status: 'applicable' | 'stale'; projectRoot: string;
            proposal: import('@dope/chat').ChatDocumentationProposal }> {
        const root = this.active(projectHandle);
        const lease = this.leases.get(chatId);
        if (!this.roadmapStore || lease?.root !== root || lease.token !== leaseToken)
            throw new Error('Current Chat ownership required for documentation review');
        const chat = (await this.repository.read(root)).chats.find(item => item.id === chatId);
        const message = chat?.messages.find(item => item.role === 'assistant' &&
            item.planningActivity?.kind === 'documentation-proposal' &&
            item.planningActivity.proposalId === proposalId &&
            item.planningActivity.documentProposal?.digest === proposalDigest);
        const proposal = message?.role === 'assistant' ? message.planningActivity?.documentProposal : undefined;
        if (!proposal || proposal.id !== proposalId || proposal.chatId !== chatId ||
            proposal.messageId !== message?.id || proposal.root !== root ||
            proposal.ownerId !== lease.ownerId ||
            proposal.leaseDigest !== createHash('sha256').update(leaseToken).digest('hex'))
            throw new Error('Exact saved documentation candidate and Chat owner required');
        const applicable = message?.role === 'assistant' && message.planningActivity?.status === 'pending' &&
            await documentationReviewApplicability(this.roadmapStore, proposal, root) === 'applicable';
        return { status: applicable ? 'applicable' : 'stale', projectRoot: root, proposal };
    }
    async dismissDocumentation(projectHandle: string, chatId: string, leaseToken: string,
        proposalId: string, decision: 'deny' | 'cancel'): Promise<void> {
        const root = this.active(projectHandle);
        if (!['deny', 'cancel'].includes(decision) || this.leases.get(chatId)?.root !== root ||
            this.leases.get(chatId)?.token !== leaseToken) throw new Error('Current Chat ownership required');
        const chat = (await this.repository.read(root)).chats.find(item => item.id === chatId);
        const message = chat?.messages.find(item => item.role === 'assistant' &&
            item.planningActivity?.kind === 'documentation-proposal' &&
            item.planningActivity.proposalId === proposalId && item.planningActivity.status === 'pending');
        if (!message || message.role !== 'assistant' || !message.planningActivity)
            throw new Error('Documentation proposal is unavailable or already decided');
        await this.repository.recordPlanningActivity(root, chatId, message.id, leaseToken,
            { ...message.planningActivity, status: decision === 'deny' ? 'denied' : 'cancelled' },
            { proposalId, status: 'pending' });
    }
    async applyDocumentation(projectHandle: string, chatId: string, leaseToken: string,
        proposalId: string, proposalDigest: string): Promise<{ id: string; status: string; paths: string[]; diagnostic?: string }> {
        const root = this.active(projectHandle);
        if (!this.roadmapStore || this.leases.get(chatId)?.root !== root ||
            this.leases.get(chatId)?.token !== leaseToken || this.turns.has(chatId))
            throw new Error('Current Chat ownership required for documentation approval');
        const chat = (await this.repository.read(root)).chats.find(item => item.id === chatId);
        const message = chat?.messages.find(item => item.role === 'assistant' &&
            item.planningActivity?.kind === 'documentation-proposal' &&
            item.planningActivity.proposalId === proposalId && item.planningActivity.status === 'pending');
        const activity = message?.role === 'assistant' ? message.planningActivity : undefined,
            proposal = activity?.documentProposal;
        if (!message || message.role !== 'assistant' || !activity || !proposal ||
            proposal.digest !== proposalDigest || proposal.root !== root || proposal.chatId !== chatId ||
            proposal.messageId !== message.id || proposal.ownerId !== this.leases.get(chatId)?.ownerId ||
            proposal.leaseDigest !== createHash('sha256').update(leaseToken).digest('hex'))
            throw new Error('Exact pending documentation proposal and approval lease required');
        if (await documentationReviewApplicability(this.roadmapStore, proposal, root) !== 'applicable') {
            const reason = await documentationDependencyConflict(proposal, root) ??
                'Documentation target, Roadmap, or proposal changed';
            await this.repository.recordPlanningActivity(root, chatId, message.id, leaseToken,
                { ...activity, status: 'stale', diagnostic: `${reason}. Regenerate and review current source.` },
                { proposalId, status: 'pending' });
            throw new Error(`${reason}. Regenerate and review current source.`);
        }
        await this.repository.renew(root, chatId, leaseToken);
        await this.repository.recordPlanningActivity(root, chatId, message.id, leaseToken,
            { ...activity, status: 'approved' }, { proposalId, status: 'pending' });
        return this.recoverApprovedDocumentation(root, chatId, leaseToken, message.id, proposal,
            () => applyDocumentationProposal(this.roadmapStore!, proposal, root, leaseToken,
                message.execution.actualModel));
    }
    private async recoverApprovedDocumentation(root: string, chatId: string, leaseToken: string,
        messageId: string, proposal: import('@dope/chat').ChatDocumentationProposal,
        action: () => Promise<import('./documentation-application').DocumentationApplication | undefined>):
        Promise<{ id: string; status: string; paths: string[]; diagnostic?: string }> {
        let record: import('./documentation-application').DocumentationApplication | undefined;
        try { record = await action(); }
        catch (error) {
            const chat = (await this.repository.read(root)).chats.find(item => item.id === chatId);
            const message = chat?.messages.find(item => item.id === messageId);
            const activity = message?.role === 'assistant' ? message.planningActivity : undefined;
            if (activity?.status === 'approved' && activity.documentProposal?.digest === proposal.digest)
                await this.repository.recordPlanningActivity(root, chatId, messageId, leaseToken,
                    { ...activity, status: 'failed', diagnostic: `${String(error).slice(0, 300)}. Regenerate and review current source.` },
                    { proposalId: proposal.id, status: 'approved' });
            throw error;
        }
        if (!record) {
            const chat = (await this.repository.read(root)).chats.find(item => item.id === chatId);
            const message = chat?.messages.find(item => item.id === messageId);
            const activity = message?.role === 'assistant' ? message.planningActivity : undefined;
            if (activity?.status === 'approved' && activity.documentProposal?.digest === proposal.digest)
                await this.repository.recordPlanningActivity(root, chatId, messageId, leaseToken,
                    { ...activity, status: 'failed', diagnostic: 'Approved, but no application journal or file effect was created. Review current source again.' },
                    { proposalId: proposal.id, status: 'approved' });
            return { id: proposal.id, status: 'failed', paths: [], diagnostic: 'No application journal or file effect was created.' };
        }
        const chat = (await this.repository.read(root)).chats.find(item => item.id === chatId);
        const message = chat?.messages.find(item => item.id === messageId);
        const activity = message?.role === 'assistant' ? message.planningActivity : undefined;
        if (activity?.status === 'approved' && activity.documentProposal?.digest === proposal.digest)
            await this.repository.recordPlanningActivity(root, chatId, messageId, leaseToken,
                { ...activity, status: record.status === 'complete' ? 'applied' :
                    record.status === 'failed' ? 'failed' : 'approved',
                    diagnostic: record.diagnostic ?? (record.status === 'complete' ?
                        `Applied ${record.effects.length} reviewed document change(s).` :
                        `Application ${record.status}; ${record.effects.length} verified retained change(s).`) },
                { proposalId: proposal.id, status: 'approved' });
        return { id: record.id, status: record.status, paths: record.effects.map(effect => effect.path),
            ...(record.diagnostic ? { diagnostic: record.diagnostic } : {}) };
    }
    async recoverDocumentation(projectHandle: string, chatId: string, leaseToken: string,
        proposalId: string): Promise<{ id: string; status: string; paths: string[]; diagnostic?: string }> {
        const root = this.active(projectHandle);
        if (this.leases.get(chatId)?.root !== root || this.leases.get(chatId)?.token !== leaseToken || this.turns.has(chatId))
            throw new Error('Current Chat ownership required for documentation recovery');
        const chat = (await this.repository.read(root)).chats.find(item => item.id === chatId);
        const message = chat?.messages.find(item => item.role === 'assistant' &&
            item.planningActivity?.kind === 'documentation-proposal' &&
            item.planningActivity.proposalId === proposalId && item.planningActivity.status === 'approved');
        const proposal = message?.role === 'assistant' ? message.planningActivity?.documentProposal : undefined;
        if (!message || !proposal || proposal.root !== root || proposal.chatId !== chatId)
            throw new Error('Approved documentation proposal unavailable');
        await this.repository.renew(root, chatId, leaseToken);
        return this.recoverApprovedDocumentation(root, chatId, leaseToken, message.id, proposal,
            () => reconcileDocumentationApplication(root, proposalId, proposal.digest));
    }
    private async savedPromptStack(root: string, chatId: string, leaseToken: string,
        proposalId: string, digest: string): Promise<{
            message: ChatAssistantMessage; activity: ChatPlanningActivity; proposal: ChatPromptStackProposal;
            assessment: ChatAssistantMessage; plan: ChatAssistantMessage }> {
        const lease = this.leases.get(chatId);
        if (lease?.root !== root || lease.token !== leaseToken)
            throw new Error('Current Chat ownership required for prompt review');
        const chat = (await this.repository.read(root)).chats.find(item => item.id === chatId);
        const message = chat?.messages.find(item => item.role === 'assistant' &&
            item.planningActivity?.kind === 'prompt-stack-proposal' &&
            item.planningActivity.proposalId === proposalId) as ChatAssistantMessage | undefined;
        const activity = message?.planningActivity, proposal = activity?.promptStackProposal;
        if (!message || !activity || !proposal || proposal.digest !== digest ||
            proposal.id !== proposalId || proposal.root !== root || proposal.chatId !== chatId ||
            proposal.messageId !== message.id ||
            message.execution.status !== 'complete') throw new Error('Exact saved prompt proposal unavailable');
        validatePromptStackProposal(proposal);
        const assessment = chat?.messages.find(item => item.id === proposal.assessmentMessageId);
        const plan = chat?.messages.find(item => item.id === proposal.planMessageId);
        if (assessment?.role !== 'assistant' || plan?.role !== 'assistant' ||
            assessment.execution.status !== 'complete' || plan.execution.status !== 'complete' ||
            !assessment.content.startsWith('# Unpublished prompt assessment\n') ||
            !plan.content.startsWith('# Unpublished prompt plan\n') ||
            chat!.messages.indexOf(assessment) >= chat!.messages.indexOf(plan) ||
            chat!.messages.indexOf(plan) >= chat!.messages.indexOf(message))
            throw new Error('Selected saved assessment or plan is unavailable');
        return { message, activity, proposal, assessment, plan };
    }
    async inspectPromptStack(projectHandle: string, chatId: string, leaseToken: string,
        proposalId: string, digest: string): Promise<{
            status: 'applicable' | 'stale'; projectRoot: string; proposal: ChatPromptStackProposal }> {
        const root = this.active(projectHandle);
        const saved = await this.savedPromptStack(root, chatId, leaseToken, proposalId, digest);
        let applicable = saved.activity.status === 'pending';
        if (applicable) {
            try {
                await verifyPromptDraftSource(root, saved.assessment, this.grounder!);
                await verifyPromptDraftSource(root, saved.plan, this.grounder!);
                const git = await capturePromptSourceEvidence(root);
                applicable = git.head === saved.proposal.gitHead &&
                    git.packageVersion === saved.proposal.sourceVersion &&
                    git.worktreeFingerprint === saved.proposal.worktreeId &&
                    !(await this.promptPublisher.inspect(root, saved.proposal.folder)).record;
            } catch { applicable = false; }
        }
        return { status: applicable ? 'applicable' : 'stale', projectRoot: root, proposal: saved.proposal };
    }
    async dismissPromptStack(projectHandle: string, chatId: string, leaseToken: string,
        proposalId: string, digest: string): Promise<void> {
        const root = this.active(projectHandle);
        const { message, activity } = await this.savedPromptStack(root, chatId, leaseToken, proposalId, digest);
        if (activity.status !== 'pending' || this.turns.has(chatId))
            throw new Error('Pending prompt proposal required');
        await this.repository.recordPlanningActivity(root, chatId, message.id, leaseToken,
            { ...activity, status: 'denied' }, { proposalId, status: 'pending', digest });
    }
    async publishPromptStack(projectHandle: string, chatId: string, leaseToken: string,
        proposalId: string, digest: string): Promise<{ id: string; status: string; paths: string[]; diagnostic?: string }> {
        const root = this.active(projectHandle);
        if (this.turns.has(chatId)) throw new Error('Finish the Chat turn before publishing');
        const saved = await this.savedPromptStack(root, chatId, leaseToken, proposalId, digest);
        if (saved.activity.status !== 'pending') throw new Error('Pending prompt proposal required');
        if ((await this.inspectPromptStack(projectHandle, chatId, leaseToken, proposalId, digest)).status !== 'applicable') {
            await this.repository.recordPlanningActivity(root, chatId, saved.message.id, leaseToken,
                { ...saved.activity, status: 'stale', diagnostic: 'Source or destination changed; prepare a new proposal.' },
                { proposalId, status: 'pending', digest });
            throw new Error('Prompt proposal source or destination changed');
        }
        await this.repository.renew(root, chatId, leaseToken);
        await this.repository.recordPlanningActivity(root, chatId, saved.message.id, leaseToken,
            { ...saved.activity, status: 'approved' }, { proposalId, status: 'pending', digest });
        try {
            const record = await this.promptPublisher.publishNative(root, saved.proposal);
            const current = (await this.repository.read(root)).chats.find(item => item.id === chatId)?.messages
                .find(item => item.id === saved.message.id);
            if (current?.role === 'assistant' && current.planningActivity?.status === 'approved')
                await this.repository.recordPlanningActivity(root, chatId, saved.message.id, leaseToken,
                    { ...current.planningActivity, status: 'applied' },
                    { proposalId, status: 'approved', digest });
            return { id: proposalId, status: record.status, paths: record.files.map(file => file.path) };
        } catch (error) {
            const current = (await this.repository.read(root)).chats.find(item => item.id === chatId)?.messages
                .find(item => item.id === saved.message.id);
            if (current?.role === 'assistant' && current.planningActivity?.status === 'approved')
                await this.repository.recordPlanningActivity(root, chatId, saved.message.id, leaseToken,
                    { ...current.planningActivity, status: 'failed',
                        diagnostic: `Publication needs recovery: ${String(error).slice(0, 250)}` },
                    { proposalId, status: 'approved', digest });
            throw error;
        }
    }
    async recoverPromptStack(projectHandle: string, chatId: string, leaseToken: string,
        proposalId: string, digest: string): Promise<{ id: string; status: string; paths: string[]; diagnostic?: string }> {
        const root = this.active(projectHandle);
        if (this.turns.has(chatId)) throw new Error('Finish the Chat turn before recovery');
        const saved = await this.savedPromptStack(root, chatId, leaseToken, proposalId, digest);
        if (!['approved', 'failed'].includes(saved.activity.status))
            throw new Error('Prompt publication recovery is unavailable');
        await verifyPromptDraftSource(root, saved.assessment, this.grounder!);
        await verifyPromptDraftSource(root, saved.plan, this.grounder!);
        const source = await capturePromptSourceEvidence(root, saved.proposal.folder);
        if (source.head !== saved.proposal.gitHead ||
            source.packageVersion !== saved.proposal.sourceVersion ||
            source.worktreeFingerprint !== saved.proposal.worktreeId)
            throw new Error('Other project source changed; recovery needs manual review');
        const existing = await this.promptPublisher.inspect(root, saved.proposal.folder);
        if (existing.record) {
            const draftHash = createHash('sha256').update(JSON.stringify(saved.proposal.files.map(
                ({ path, afterHash }) => ({ path, afterHash })))).digest('hex');
            if (existing.record.mode !== 'native' || existing.record.draftHash !== draftHash ||
                existing.record.projectId !== saved.proposal.projectId ||
                existing.record.sourceHash !== saved.proposal.worktreeId ||
                existing.record.ownerHash !== createHash('sha256').update(saved.proposal.ownerId).digest('hex') ||
                existing.record.gitHead !== saved.proposal.gitHead ||
                existing.record.packageVersion !== saved.proposal.sourceVersion)
                throw new Error('Publication journal does not match the saved proposal');
        }
        const record = existing.record ?
            await this.promptPublisher.confirmRecovered(root, saved.proposal.folder, true) :
            await this.promptPublisher.publishNative(root, saved.proposal);
        await this.repository.recordPlanningActivity(root, chatId, saved.message.id, leaseToken,
            { ...saved.activity, status: 'applied', diagnostic: undefined },
            { proposalId, status: saved.activity.status === 'approved' ? 'approved' : 'failed', digest });
        return { id: proposalId, status: record.status, paths: record.files.map(file => file.path) };
    }
    /** A new owner cannot reuse an offer or a preview held only by the old connection. */
    private async retireRoadmapActions(root: string, chatId: string, leaseToken: string): Promise<void> {
        const chat = (await this.repository.read(root)).chats.find(item => item.id === chatId);
        for (const message of chat?.messages ?? []) {
            if (message.role !== 'assistant' || !message.roadmapAction ||
                !['offered', 'generating', 'ready'].includes(message.roadmapAction.status)) continue;
            await this.updateRoadmapAction(root, chatId, message.id, leaseToken,
                message.roadmapAction.offerId, message.roadmapAction.status, 'stale');
        }
    }
    private planningProgress(chatId: string, messageId: string, stage: Extract<ChatEvent, { kind: 'planning-progress' }>['stage']): void {
        if (!this.handle || this.disposed) return;
        tracePlanning(stage, chatId, messageId);
        try { this.client.notifyChatEvent({ projectHandle: this.handle, kind: 'planning-progress',
            chatId, messageId, stage }); }
        catch { /* A transient UI notice cannot fail a planning turn. */ }
    }

    /** Schema-2 answer text may provide a read-only focus hint, never a mutation. */
    private async gateProposal(root: string, output: string, refs: ChatContextPreview['refs']):
        Promise<{ proposalError?: string; roadmapFocus?: ChatTurnResult['roadmapFocus'] }> {
        const ref = refs.find(item => item.kind === 'roadmap');
        if (!ref || !this.roadmapStore) return { proposalError: 'Current Roadmap authority is unavailable' };
        try {
            const value: unknown = JSON.parse(output);
            if (value && typeof value === 'object' && !Array.isArray(value) &&
                (value as { type?: string }).type === 'no-action' &&
                Object.keys(value).sort().join(',') === 'message,type' &&
                typeof (value as { message?: unknown }).message === 'string' &&
                !!(value as { message: string }).message.trim() &&
                (value as { message: string }).message.length <= 4000) return {};
            if (value && typeof value === 'object' && !Array.isArray(value) &&
                (value as { type?: string }).type === 'roadmap-gate-focus' &&
                Object.keys(value).sort().join(',') === 'id,type') {
                const id = (value as { id?: unknown }).id;
                const current = await this.roadmapStore.read<RoadmapGateIndex>(root);
                if (typeof id !== 'string' || current.projectId !== ref.projectId ||
                    current.revision !== ref.ownerRevision ||
                    !current.phases.some(item => item.id === id) && !current.gates.some(item => item.id === id))
                    throw new Error('Roadmap focus target is stale or missing');
                return { roadmapFocus: { projectId: current.projectId, revision: current.revision, id } };
            }
            throw new Error('Use protected /roadmap tools to stage a reviewed Roadmap change');
        } catch (error) {
            return { proposalError: `Roadmap proposal rejected: ${String(error)}` };
        }
    }

    private async publicationProposal(root: string, chatId: string, messageId: string, leaseToken: string,
        refs: ChatContextPreview['refs'], intent: { mode: 'publish' | 'link'; path: string }):
        Promise<{ proposal?: ChatPlanningProposal; proposalError?: string }> {
        try {
            if (!this.roadmapStore) throw new Error('Roadmap owner unavailable');
            const ref = refs.find(item => item.kind === 'roadmap');
            const current = await this.roadmapStore.read<RoadmapGateIndex>(root);
            if (!ref || current.schemaVersion !== 2 || current.projectRoot !== root ||
                current.projectId !== ref.projectId || current.revision !== ref.ownerRevision ||
                current.linkedDocument?.sourceHash !== ref.sourceHash)
                throw new Error('Roadmap source or selection changed; start a fresh /roadmap turn');
            const reviewed = intent.mode === 'publish' ?
                await this.roadmapStore.previewRoadmapPublication(root, intent.path) :
                await this.roadmapStore.previewExistingRoadmapLink(root, intent.path);
            if (intent.mode === 'link' && !(reviewed as RoadmapExistingLinkPreview).compatible)
                throw new Error(`Existing Markdown is incompatible: ${(reviewed as RoadmapExistingLinkPreview).diagnostics.join('; ')}`);
            const id = randomUUID();
            this.proposals.set(chatId, { id, messageId, leaseToken, changedIds: [],
                publication: { root, mode: intent.mode, preview: reviewed } });
            const publication = { mode: intent.mode, path: reviewed.path, sourceHash: reviewed.sourceHash,
                phaseCount: reviewed.phaseCount, gateCount: reviewed.gateCount,
                criterionCount: reviewed.criterionCount,
                warnings: intent.mode === 'publish' ? (() => {
                    const warnings = (reviewed as RoadmapPublicationPreview).warnings;
                    return warnings.length <= 32 ? warnings : [...warnings.slice(0, 31),
                        `${warnings.length - 31} additional coverage warnings`];
                })() : [],
                ...(intent.mode === 'publish' ? { content: (reviewed as RoadmapPublicationPreview).content.slice(0, 16000) } :
                    { compatible: true, diagnostics: (reviewed as RoadmapExistingLinkPreview).diagnostics }) };
            return { proposal: { id, chatId, messageId, ownerId: current.projectId,
                revision: current.revision, sourceHash: reviewed.sourceHash, changedIds: [],
                action: { type: `roadmap-${intent.mode}`, id: reviewed.path },
                summary: `${intent.mode === 'publish' ? 'Publish New' : 'Link Existing'} · ${reviewed.path}`,
                publication } };
        } catch (error) { return { proposalError: `Roadmap publication unavailable: ${String(error)}` }; }
    }

    private async proposal(root: string, chatId: string, messageId: string, leaseToken: string,
        output: string, refs: ChatContextPreview['refs'], draft?: { handle: string; revision: number; projectId: string }):
        Promise<{ proposal?: ChatPlanningProposal; proposalError?: string;
            roadmapFocus?: ChatTurnResult['roadmapFocus'] }> {
        if (!output.trimStart().startsWith('{')) return {};
        if (!draft && refs.some(ref => ref.kind === 'roadmap'))
            return this.gateProposal(root, output, refs);
        if (!draft && (!this.planning || !refs.some(ref => ref.kind === 'roadmap-checkpoint'))) return {};
        let handle: string | undefined;
        try {
            if (Buffer.byteLength(output, 'utf8') > 32768) throw new Error('Planning proposal exceeds the size limit');
            const value: unknown = JSON.parse(output);
            if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid planning proposal');
            const raw = value as Record<string, unknown>;
            if (raw.type === 'no-action' && Object.keys(raw).sort().join(',') === 'message,type' &&
                typeof raw.message === 'string' && raw.message.length <= 4000) return {};
            if (draft && raw.type !== 'no-action')
                throw new Error('Legacy draft Chat mutations are retired; use native Roadmap staging from an empty owner');
            for (const ref of refs.filter(item => item.kind === 'file' && item.sourceHash && item.includedBytes)) {
                const current = await this.grounder?.readFile(root, ref.id);
                if (!current || current.blocks[0]?.ref.sourceHash !== ref.sourceHash || current.diagnostics.length ||
                    ref.projectId && current.blocks[0].ref.projectId !== ref.projectId)
                    throw new Error('Project source changed during planning');
            }
            if (draft) {
                const single = raw.type === 'roadmap-draft-proposal' &&
                    Object.keys(raw).sort().join(',') === 'action,draftRevision,projectId,type' &&
                    raw.action && typeof raw.action === 'object' && !Array.isArray(raw.action);
                const sequence = raw.type === 'roadmap-draft-sequence' &&
                    Object.keys(raw).sort().join(',') === 'actions,draftRevision,projectId,type' &&
                    Array.isArray(raw.actions) && raw.actions.length >= 2 && raw.actions.length <= 3;
                if (!this.greenfield || (!single && !sequence) || raw.projectId !== draft.projectId ||
                    raw.draftRevision !== draft.revision)
                    throw new Error('Stale or foreign greenfield proposal');
                const actions = (sequence ? raw.actions : [raw.action]) as GreenfieldEdit[];
                const action = actions[0];
                const preview = sequence ? this.greenfield.previewEditSequence(draft.handle, draft.revision, actions) :
                    this.greenfield.previewEdit(draft.handle, draft.revision, action);
                const id = randomUUID();
                const changedIds = sequence ? [...new Set([
                    ...preview.after.phases.filter(phase => !preview.before.phases.some(old => old.id === phase.id)).map(phase => phase.id),
                    ...preview.after.phases.flatMap(phase => phase.checkpoints.filter(item =>
                        !preview.before.phases.some(old => old.checkpoints.some(checkpoint => checkpoint.id === item.id)))
                        .map(item => item.id)),
                    ...actions.flatMap(step => [
                        ...('phaseId' in step ? [step.phaseId] : []),
                        ...('checkpointId' in step ? [step.checkpointId] : []),
                        ...('correctionId' in step ? [step.correctionId] : [])])
                ])] : ['checkpointId' in action ? action.checkpointId :
                    'phaseId' in action ? action.phaseId : 'correctionId' in action ? action.correctionId : 'new-phase'];
                this.proposals.set(chatId, { id, messageId, leaseToken, changedIds,
                    draft: { handle: draft.handle, preview } });
                return { proposal: { id, chatId, messageId, ownerId: draft.projectId,
                    revision: draft.revision, changedIds, action: { type: sequence ? 'draft-sequence' : action.type, id: changedIds[0] },
                    summary: JSON.stringify({ actions, before: preview.before.phases, after: preview.after.phases }) } };
            }
            const context = refs.filter(ref => ref.kind === 'roadmap-checkpoint');
            if (context.length !== 1) throw new Error('Select exactly one Roadmap checkpoint');
            const attached = await this.planning!.attach(root);
            handle = attached.projectHandle;
            if (attached.snapshot.projectId !== context[0].projectId || attached.snapshot.revision !== context[0].ownerRevision)
                throw new Error('Stale or foreign planning proposal');
            const selected = attached.snapshot.checkpoints.find(item => item.id === context[0].id);
            if (!selected || selected.source?.sha256 !== context[0].sourceHash)
                throw new Error('Stale or foreign Roadmap source');
            const linked = !!attached.snapshot.linkedDocument && !!selected.source &&
                selected.source.path === attached.snapshot.linkedDocument.path;
            let actions: PlanningAction[];
            if (linked) {
                if (raw.type !== 'roadmap-intent' || Object.keys(raw).sort().join(',') !== 'intent,type,value' ||
                    raw.intent !== 'set-objective' || typeof raw.value !== 'string' ||
                    raw.value.length > 8192 || /[\r\n\0]/.test(raw.value))
                    throw new Error('Linked Roadmap requires one eligible field intent');
                const capabilities = await readRoadmapDocumentCapabilities(root, attached.snapshot, selected.id);
                if (!capabilities.fields.objective.editable || capabilities.sourceHash !== context[0].sourceHash)
                    throw new Error(capabilities.fields.objective.reason ?? 'Stale linked Roadmap source');
                actions = [{ type: 'document-edit', id: selected.id, objective: raw.value }];
            } else {
                const single = raw.type === 'roadmap-proposal' &&
                    Object.keys(raw).sort().join(',') === 'action,ownerRevision,projectId,type' &&
                    raw.action && typeof raw.action === 'object' && !Array.isArray(raw.action);
                const sequence = raw.type === 'roadmap-sequence' &&
                    Object.keys(raw).sort().join(',') === 'actions,ownerRevision,projectId,type' &&
                    Array.isArray(raw.actions) && raw.actions.length >= 2 && raw.actions.length <= 3;
                if ((!single && !sequence) || raw.projectId !== context[0].projectId ||
                    raw.ownerRevision !== context[0].ownerRevision)
                    throw new Error('Invalid planning proposal schema');
                actions = (sequence ? raw.actions : [raw.action]) as PlanningAction[];
                if (actions.some(action => !('id' in action) || typeof action.id !== 'string'))
                    throw new Error('Planning proposal requires a selected identity');
                if (actions.some(action => action.type !== 'create' && action.id !== selected.id))
                    throw new Error('Planning proposal targets an unselected checkpoint');
            }
            // The action is untrusted. ProjectPlanningActions validates fields, owner, source and revision.
            const request: PlanningActionRequest = { projectHandle: handle, ownerId: attached.snapshot.projectId,
                expectedRevision: attached.snapshot.revision, actions,
                ...(context[0].sourceHash ? { sourceHashes: { [context[0].id]: context[0].sourceHash } } : {}) };
            const preview = await this.planning!.preview(request);
            const id = randomUUID();
            const fields = (item: typeof preview.next.checkpoints[number] | undefined) => item && ({
                id: item.id, title: item.title, objective: item.objective, order: item.order,
                dependencies: item.dependencies, links: item.links, status: item.status });
            this.proposals.set(chatId, { id, messageId, leaseToken, handle, request,
                token: preview.token, changedIds: preview.changedIds });
            return { proposal: { id, chatId, messageId, ownerId: preview.ownerId, revision: preview.revision,
                changedIds: preview.changedIds, action: { type: actions.length > 1 ? 'sequence' : actions[0].type, id: actions[0].id! },
                summary: JSON.stringify({ actions, before: actions.map(action => fields(attached.snapshot.checkpoints.find(item => item.id === action.id))),
                    after: actions.map(action => fields(preview.next.checkpoints.find(item => item.id === action.id))),
                    ...(preview.documentDiff ? { documentDiff: preview.documentDiff } : {}) }) } };
        } catch (error) {
            if (handle) this.planning?.detach(handle);
            return { proposalError: `Planning proposal rejected: ${String(error)}` };
        }
    }

    async decidePlanningProposal(projectHandle: string, chatId: string, leaseToken: string,
        proposalId: string, approve: boolean): Promise<{ revision: number; changedIds: string[] } | undefined> {
        const root = this.active(projectHandle);
        const pending = this.proposals.get(chatId);
        if (!pending || pending.id !== proposalId || pending.leaseToken !== leaseToken ||
            typeof approve !== 'boolean') throw new Error('Planning proposal unavailable');
        if (pending.nativeStageId) throw new Error('Native Roadmap requires selected operation review');
        await this.repository.renew(root, chatId, leaseToken);
        const message = (await this.repository.read(root)).chats.find(chat => chat.id === chatId)
            ?.messages.find(item => item.id === pending.messageId);
        if (message?.role !== 'assistant' || message.execution.status !== 'complete')
            throw new Error('Planning proposal is not a completed Chat turn');
        this.proposals.delete(chatId);
        const activity = message.planningActivity;
        if (!activity || activity.status !== 'pending' || activity.proposalId !== proposalId)
            throw new Error('Planning activity is not pending');
        const record = async (status: ChatPlanningActivity['status'], appliedRevision?: number,
            diagnostic?: string) => {
            await this.repository.recordPlanningActivity(root, chatId, pending.messageId, leaseToken,
                { ...activity, status, ...(appliedRevision === undefined ? {} : { appliedRevision }),
                    ...(diagnostic === undefined ? {} : { diagnostic: diagnostic.slice(0, 2000) }) },
                { proposalId, status: 'pending' });
            tracePlanning('decision-recorded', chatId, pending.messageId, status);
        };
        let appliedRevision: number | undefined;
        try {
            tracePlanning('decision-requested', chatId, pending.messageId, approve ? 'approve' : 'reject');
            if (!approve) { await record('denied'); if (pending.draft) this.greenfield?.clearEditPreview(pending.draft.handle);
                if (pending.publication && this.roadmapStore) {
                    const { root: publicationRoot, mode, preview } = pending.publication;
                    if (publicationRoot !== root) throw new Error('Roadmap owner changed');
                    if (mode === 'publish') await this.roadmapStore.applyRoadmapPublication(root, preview as RoadmapPublicationPreview, false);
                    else await this.roadmapStore.applyExistingRoadmapLink(root, preview as RoadmapExistingLinkPreview, false);
                }
                return undefined; }
            if (pending.publication) {
                if (!this.roadmapStore || pending.publication.root !== root) throw new Error('Roadmap owner changed');
                const { mode, preview } = pending.publication;
                const result = mode === 'publish' ?
                    await this.roadmapStore.applyRoadmapPublication(root, preview as RoadmapPublicationPreview, true) :
                    await this.roadmapStore.applyExistingRoadmapLink(root, preview as RoadmapExistingLinkPreview, true);
                const persisted = await this.roadmapStore.read<RoadmapGateIndex>(root);
                if (result.pendingPublication || persisted.pendingPublication ||
                    persisted.revision !== result.revision ||
                    persisted.linkedDocument?.path !== preview.path ||
                    persisted.linkedDocument.sourceHash !== preview.sourceHash ||
                    persisted.linkedDocument.syncState !== 'synced' ||
                    !(await verifiedPublicationFile(root, preview.path, preview.sourceHash)))
                    throw new Error('Publication is not confirmed; inspect Roadmap recovery state');
                appliedRevision = result.revision;
                await record('applied', result.revision);
                return { revision: result.revision, changedIds: [] };
            }
            if (pending.undo) {
                if (!this.planning || this.gateUndo.get(chatId) !== pending.undo)
                    throw new Error('Roadmap undo changed');
                const result = await this.planning.undoEligible({ projectHandle: pending.undo.handle,
                    ownerId: pending.undo.ownerId, expectedRevision: pending.undo.revision, token: pending.undo.token });
                appliedRevision = result.revision;
                this.clearGateUndo(chatId);
                await record('applied', result.revision);
                return { revision: result.revision, changedIds: pending.changedIds };
            }
            if (pending.draft) {
                if (!this.greenfield) throw new Error('Greenfield draft unavailable');
                if (this.greenfield.chatDraft(root, chatId)?.handle !== pending.draft.handle)
                    throw new Error('Greenfield Chat binding changed');
                const result = await this.greenfield.applyEdit(pending.draft.handle, pending.draft.preview, true);
                appliedRevision = result.revision;
                await record('applied', result.revision);
                return { revision: result.revision, changedIds: pending.changedIds };
            }
            if (!this.planning || !pending.request || !pending.token) throw new Error('Planning action unavailable');
            const result = await this.planning.apply(pending.request, pending.token, true);
            appliedRevision = result.revision;
            if (pending.request.actions.every(action => action.type.includes('.')) && pending.handle) {
                this.clearGateUndo(chatId);
                const token = this.planning.undoToken(pending.handle, pending.request.ownerId);
                if (token) this.gateUndo.set(chatId, { handle: pending.handle, ownerId: pending.request.ownerId,
                    revision: result.revision, token, leaseToken });
            }
            await record('applied', result.revision);
            return { revision: result.revision, changedIds: pending.changedIds };
        } catch (error) {
            if (pending.draft && appliedRevision === undefined) this.greenfield?.clearEditPreview(pending.draft.handle);
            if (appliedRevision !== undefined)
                throw new Error(`Planning write completed at revision ${appliedRevision}, but Chat activity could not be recorded; reread the Roadmap: ${String(error)}`);
            if ((await this.repository.read(root)).chats.find(chat => chat.id === chatId)?.messages
                .some(item => item.id === pending.messageId && item.role === 'assistant' &&
                    item.planningActivity?.status === 'pending'))
                await record(/stale|source|hash|conflict|revision|changed/i.test(String(error)) ? 'stale' : 'rejected',
                    undefined, String(error));
            throw error;
        } finally { if (pending.handle && this.gateUndo.get(chatId)?.handle !== pending.handle)
            this.planning?.detach(pending.handle); }
    }

    async reviewNativeRoadmap(projectHandle: string, chatId: string, leaseToken: string,
        proposalId: string, operationIds: string[], decision: 'apply' | 'reject'):
        Promise<{ token: string; summary: string; preview?: ChatPlanningProposal['preview'] }> {
        const root = this.active(projectHandle);
        const pending = this.proposals.get(chatId);
        const stage = this.nativeStages?.get(chatId);
        if (this.nativeProposalEdits.has(chatId) || !pending?.nativeStageId || pending.id !== proposalId || pending.leaseToken !== leaseToken ||
            !stage || stage.id !== pending.nativeStageId || stage.context.root !== root ||
            !Array.isArray(operationIds) || !['apply', 'reject'].includes(decision))
            throw new Error('Native Roadmap proposal unavailable');
        if (pending.generationOnly && decision === 'apply') {
            const selected = new Set(operationIds);
            for (const item of stage.operations) if (selected.has(item.id) &&
                item.action.type === 'phase.create' && !stage.operations.some(gate =>
                    selected.has(gate.id) && gate.action.type === 'gate.create' &&
                    gate.action.parentPhaseId === item.action.id))
                throw new Error('ROADMAP_GENERATION_SELECTED_PHASE_REQUIRES_GATE');
        }
        await this.repository.renew(root, chatId, leaseToken);
        const message = (await this.repository.read(root)).chats.find(chat => chat.id === chatId)
            ?.messages.find(item => item.id === pending.messageId);
        if (message?.role !== 'assistant' || message.execution.status !== 'complete' ||
            message.planningActivity?.status !== 'pending' ||
            message.planningActivity.proposalId !== proposalId)
            throw new Error('Native Roadmap activity changed');
        const context = stage.context;
        const review = await this.nativeStages!.review(context, operationIds, decision);
        const entities = (index: RoadmapGateIndex) => [...index.phases, ...index.gates,
            ...index.corrections, ...index.gates.flatMap(gate => gate.criteria)];
        const prior = new Map(entities(review.before).map(item => [item.id, item]));
        const next = new Map(review.after ? entities(review.after).map(item => [item.id, item]) : []);
        const changedIds = review.after ? [...new Set([...prior.keys(), ...next.keys()])].filter(id =>
            JSON.stringify(prior.get(id)) !== JSON.stringify(next.get(id))) : [];
        const changed = review.after ? roadmapProposalPreview(review.before, review.after,
            stage.operations.filter(item => operationIds.includes(item.id)).map(item => item.action), changedIds) : undefined;
        return { token: review.token, summary: decision === 'reject' ?
            `Reject ${operationIds.length} selected operation(s); canonical Roadmap remains at revision ${review.before.revision}.` :
            `Apply ${operationIds.length} selected operation(s) at revision ${review.before.revision}; ` +
                `${changedIds.length} actual entity changes.`, ...(changed ? { preview: changed } : {}) };
    }

    async reviseNativeRoadmap(projectHandle: string, chatId: string, leaseToken: string,
        proposalId: string, expectedGeneration: number, operationId: string, entityId: string,
        field: 'title' | 'objective' | 'purpose' | 'expectedResult', value: string): Promise<ChatPlanningProposal> {
        const root = this.active(projectHandle);
        const pending = this.proposals.get(chatId);
        const stage = this.nativeStages?.get(chatId);
        if (this.nativeProposalEdits.has(chatId) || !pending?.nativeStageId || pending.id !== proposalId ||
            pending.leaseToken !== leaseToken || !stage || stage.id !== proposalId ||
            stage.context.root !== root) throw new Error('Native Roadmap proposal unavailable');
        this.nativeProposalEdits.add(chatId);
        try {
            await this.repository.renew(root, chatId, leaseToken);
            const message = (await this.repository.read(root)).chats.find(chat => chat.id === chatId)
                ?.messages.find(item => item.id === pending.messageId);
            if (message?.role !== 'assistant' || message.execution.status !== 'complete' ||
                message.planningActivity?.status !== 'pending' ||
                message.planningActivity.proposalId !== proposalId || !message.planningActivity.proposal ||
                message.planningActivity.proposal.generation !== expectedGeneration)
                throw new Error('Native Roadmap activity or generation changed');
            const revised = await this.nativeStages!.revise(stage.context, { proposalId, expectedGeneration,
                operationId, entityId, field, value });
            try {
                if (this.proposals.get(chatId) !== pending || this.nativeStages?.get(chatId) !== stage)
                    throw new Error('Native Roadmap proposal changed during edit');
                const snapshot = revised.snapshot;
                const proposal: ChatPlanningProposal = { ...message.planningActivity.proposal,
                    generation: stage.generation, changedIds: snapshot.entityIds, counts: snapshot.counts,
                    preview: snapshot.preview,
                    summary: `Revised staged Roadmap: ${snapshot.counts.phases} Phases, ` +
                        `${snapshot.counts.gates} Gates, ${snapshot.counts.criteria} Criteria. ` +
                        `Validated preview; no Roadmap change applied.` };
                await this.repository.recordPlanningActivity(root, chatId, pending.messageId, leaseToken,
                    { ...message.planningActivity, proposal }, { proposalId, status: 'pending' });
                return proposal;
            } catch (error) { revised.rollback(); throw error; }
        } finally { this.nativeProposalEdits.delete(chatId); }
    }

    async decideNativeRoadmap(projectHandle: string, chatId: string, leaseToken: string,
        proposalId: string, operationIds: string[], decision: 'apply' | 'reject', token: string):
        Promise<{ revision?: number; changedIds: string[]; proposal?: ChatPlanningProposal }> {
        const root = this.active(projectHandle);
        const pending = this.proposals.get(chatId);
        const stage = this.nativeStages?.get(chatId);
        if (this.nativeProposalEdits.has(chatId) || !pending?.nativeStageId || pending.id !== proposalId || pending.leaseToken !== leaseToken ||
            !stage || stage.id !== pending.nativeStageId || stage.context.root !== root ||
            typeof token !== 'string') throw new Error('Native Roadmap proposal unavailable');
        await this.repository.renew(root, chatId, leaseToken);
        const message = (await this.repository.read(root)).chats.find(chat => chat.id === chatId)
            ?.messages.find(item => item.id === pending.messageId);
        if (message?.role !== 'assistant' || message.execution.status !== 'complete' ||
            message.planningActivity?.status !== 'pending' ||
            message.planningActivity.proposalId !== proposalId || !message.planningActivity.proposal)
            throw new Error('Native Roadmap activity changed');
        const outcome = await this.nativeStages!.decide(stage.context, token, operationIds, decision);
        if (outcome.revision && message.planningActivity.proposal.action.type === 'native-generation-replacement')
            await this.greenfield?.retire(root).catch(error => {
                console.warn('[dope-roadmap-generation] retired draft cleanup needs retry', String(error));
            });
        const remaining = outcome.statuses.some(item => item.status === 'Pending');
        let pendingPreview: ChatPlanningProposal['preview'];
        let pendingCounts = message.planningActivity.proposal.counts;
        let pendingSummary = message.planningActivity.proposal.summary;
        if (remaining) {
            const current = await this.roadmapStore!.read<RoadmapGateIndex>(root);
            const actions = stage.operations.filter(item => item.status === 'Pending').map(item => item.action);
            try {
                const projected = await this.roadmapStore!.mutateGateIndex(root, current.revision,
                    stage.ownerId, actions, true, stage.isolated ?
                        { indexHash: stage.basisHash ?? null, replace: true } : undefined);
                const entities = (index: RoadmapGateIndex) => [...index.phases, ...index.gates,
                    ...index.corrections, ...index.gates.flatMap(gate => gate.criteria)];
                const presentationBefore = stage.isolated ? { ...current, phases: [], gates: [],
                    corrections: [], linkedDocument: undefined } : current;
                const old = new Map(entities(presentationBefore).map(item => [item.id, item]));
                const next = new Map(entities(projected).map(item => [item.id, item]));
                const changed = [...new Set([...old.keys(), ...next.keys()])].filter(id =>
                    JSON.stringify(old.get(id)) !== JSON.stringify(next.get(id)));
                pendingPreview = roadmapProposalPreview(presentationBefore, projected, actions, changed);
                pendingCounts = typedRoadmapCounts(projected);
                pendingSummary = `${actions.length} pending operation(s) revalidated at Roadmap revision ${current.revision}.`;
            } catch (error) {
                pendingCounts = undefined;
                pendingSummary = `Pending operations need a new valid subset: ${String(error)}`;
            }
        }
        const committed = await this.roadmapStore!.read<RoadmapGateIndex>(root);
        const proposal: ChatPlanningProposal = { ...message.planningActivity.proposal,
            ownerId: committed.projectId,
            ...(outcome.revision && message.planningActivity.proposal.action.type === 'native-generation-replacement' ?
                { action: { type: 'native-stage-preview', id: committed.projectId } } : {}),
            revision: outcome.revision ?? message.planningActivity.proposal.revision,
            summary: pendingSummary, counts: remaining ? pendingCounts : typedRoadmapCounts(committed),
            ...(remaining ? { preview: pendingPreview } : {}),
            operations: message.planningActivity.proposal.operations?.map(item => ({ ...item,
                status: outcome.statuses.find(status => status.id === item.id)?.status ?? item.status })) };
        const appliedRevision = !remaining && outcome.statuses.some(item => item.status === 'Applied') ?
            outcome.revision ?? proposal.revision : undefined;
        await this.repository.recordPlanningActivity(root, chatId, pending.messageId, leaseToken,
            { ...message.planningActivity, status: remaining ? 'pending' : appliedRevision ? 'applied' : 'denied',
                ...(appliedRevision ? { appliedRevision } : {}), proposal },
            { proposalId, status: 'pending' });
        if (!remaining) this.clearProposal(chatId);
        return { revision: outcome.revision, changedIds: outcome.changedIds,
            ...(remaining ? { proposal } : {}) };
    }

    /** Only the fresh top-level Chat command parser calls this entry. P3 supplies native phase staging. */
    private async runGenerationCommand(root: string, request: ChatTurnRequest, scope: string): Promise<ChatTurnResult> {
        if (!this.roadmapStore || !this.nativeStages || !this.models || this.turns.has(request.chatId) ||
            this.generationControllers.has(request.chatId) || this.generationPreparing.has(request.chatId) ||
            this.leases.get(request.chatId)?.root !== root ||
            this.leases.get(request.chatId)?.token !== request.leaseToken)
            throw new Error('Roadmap generation is unavailable until the new controller is ready');
        if (this.nativeStages.get(request.chatId) || this.proposals.has(request.chatId))
            throw new Error('Review or dismiss the existing Roadmap proposal before generating another');
        this.generationPreparing.add(request.chatId);
        try { return await this.prepareGenerationCommand(root, request, scope); }
        finally { this.generationPreparing.delete(request.chatId); }
    }

    private async prepareGenerationCommand(root: string, request: ChatTurnRequest, scope: string): Promise<ChatTurnResult> {
        await this.repository.renew(root, request.chatId, request.leaseToken);
        const chat = (await this.repository.read(root)).chats.find(item => item.id === request.chatId);
        if (!chat || request.planningSteps !== undefined || request.bridgeProposal ||
            forbidsProjectTools(request.content ?? ''))
            throw new Error('Roadmap generation requires one current local Chat command');
        const selection = request.selectedModel ?? (chat.settings.modelPolicy.type === 'exact' ?
            chat.settings.modelPolicy.model : undefined);
        if (!selection) throw new Error('Select one exact local model for Roadmap generation');
        const connection = (await this.models!.list()).connections.find(item => item.id === selection.connectionId);
        const model = connection?.ready && connection.providerId === 'local' &&
            connection.models.find(item => item.id === selection.modelId && item.usable);
        if (!model || !model.capabilities.contextWindowTokens)
            throw new Error('Selected local model is unavailable');
        const connectionFingerprint = JSON.stringify(connection);
        for (const [id, value] of Object.entries(chat.settings.reasoningControls ?? {}))
            if (!model.capabilities.reasoningControls?.some(control => control.id === id && control.values.includes(value)))
                throw new Error('Selected local model does not support the saved reasoning control');
        const index = await this.roadmapStore!.read<RoadmapGateIndex>(root);
        if (index.schemaVersion !== 2 || index.projectRoot !== root || !index.projectId)
            throw new Error('Current Roadmap owner is invalid');
        const sourceHash = index.linkedDocument?.sourceHash ?? null;
        const indexHash = await this.roadmapStore!.gateIndexHash(root);
        const identity = { root, projectId: index.projectId, revision: index.revision, sourceHash, indexHash,
            baselinePhases: 0,
            chatId: request.chatId, turnId: randomUUID(), ownerId: index.projectId,
            model: { connectionId: selection.connectionId, modelId: selection.modelId,
                providerId: 'local' as const, contextWindowTokens: model.capabilities.contextWindowTokens,
                reasoningControls: { ...chat.settings.reasoningControls } },
            origin: 'trusted-user-chat' as const };
        // Historic partials remain in saved Chat; every command opens a new protected execution.
        const context = JSON.stringify({ projectId: index.projectId,
            generationWorkspace: 'empty', replacementBasis: { revision: index.revision, indexHash },
            currentRoadmapPresent: index.phases.length > 0 || index.gates.length > 0 });
        // Generation receives no saved Roadmap selection, prior Chat planning turn or
        // accepted draft. Project/source selections remain available when explicit.
        const cleanChat = { ...chat, messages: [] };
        const cleanSelections = (request.context ?? []).filter(item =>
            item.kind !== 'roadmap' && item.kind !== 'roadmap-checkpoint' && item.kind !== 'saved-chat' &&
            !item.draftHandle &&
            (!index.linkedDocument || item.id !== index.linkedDocument.path &&
                item.label !== index.linkedDocument.path));
        const composed = this.composer ? await this.composeTurn(root, cleanChat, scope, cleanSelections,
            model.capabilities, undefined, undefined, undefined, false, undefined, true,
            false, 'ordinary', false, true) : undefined;
        const contextRefs = composed?.refs ?? [];
        const executionId = randomUUID();
        const generationToolEvents: NonNullable<ChatAssistantMessage['execution']['toolEvents']> = [];
        const generationActivity = new ChatActivityRecorder(request.chatId, identity.turnId, executionId);
        let generationActivitySequence = 0;
        let generationCallNumber = 0;
        const traceStarted = performance.now();
        const traceGeneration = (generationId: string, stage: string, detail: Record<string, unknown> = {}) =>
            console.info('[dope-roadmap-generation]', JSON.stringify({ at: new Date().toISOString(),
                elapsedMs: Math.round(performance.now() - traceStarted), generationId, stage, ...detail }));
        const recordGenerationActivity = (kind: 'thinking' | 'provisional' | 'answer' | 'tool', value: string) => {
            if (!value) return;
            generationActivity.add(kind, value);
            for (const item of generationActivity.eventsSince(generationActivitySequence)) try {
                this.client.notifyChatEvent({ projectHandle: request.projectHandle, kind: 'assistant-activity',
                    chatId: request.chatId, messageId: identity.turnId, executionId,
                    sequence: ++generationActivitySequence, activityKind: item.kind, text: item.text });
            } catch { /* Display cannot affect inference or staging. */ }
        };
        const generationCurrent = async (bound: GenerationIdentity): Promise<boolean> => {
            if (this.disposed || this.root !== bound.root || this.handle !== request.projectHandle ||
                this.leases.get(bound.chatId)?.token !== request.leaseToken) return false;
            try { await this.repository.renew(root, bound.chatId, request.leaseToken); } catch { return false; }
            const selected = (await this.models!.list()).connections.find(item => item.id === bound.model.connectionId);
            const actual = selected?.ready && selected.providerId === 'local' &&
                selected.models.find(item => item.id === bound.model.modelId && item.usable);
            if (!actual || JSON.stringify(selected) !== connectionFingerprint ||
                actual.capabilities.contextWindowTokens !== bound.model.contextWindowTokens) return false;
            const currentChat = (await this.repository.read(root)).chats.find(item => item.id === bound.chatId);
            if (!currentChat || JSON.stringify(currentChat.settings.reasoningControls ?? {}) !==
                JSON.stringify(bound.model.reasoningControls) ||
                !request.selectedModel && currentChat.settings.modelPolicy.type === 'exact' &&
                (currentChat.settings.modelPolicy.model.connectionId !== bound.model.connectionId ||
                    currentChat.settings.modelPolicy.model.modelId !== bound.model.modelId)) return false;
            const next = await this.roadmapStore!.read<RoadmapGateIndex>(root);
            if (next.projectId !== bound.projectId || next.projectRoot !== bound.root ||
                next.revision !== bound.revision ||
                (next.linkedDocument?.sourceHash ?? null) !== bound.sourceHash ||
                await this.roadmapStore!.gateIndexHash(root) !== bound.indexHash) return false;
            try {
                const stageRead = await this.nativeStages!.read({ root, projectId: bound.projectId,
                    chatId: bound.chatId, turnId: bound.turnId, lease: request.leaseToken,
                    generation: true },
                    { version: 1 }) as { link?: { syncState?: string } | null };
                if (stageRead.link && stageRead.link.syncState !== 'synced') return false;
            }
            catch { return false; }
            return true;
        };
        let nativeAdapter: RoadmapGenerationNativeStage;
        const controller = new RoadmapGenerationController(identity, scope, context, {
            current: generationCurrent,
            call: async input => {
                generationCallNumber++;
                traceGeneration(input.identity.generationId, 'phase-dispatched',
                    { phase: input.phase, call: generationCallNumber });
                let usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number;
                    reasoningTokens?: number; finishReason?: string; reasoning?: string } = {};
                let sequence = 0;
                let toolOutputStarted = false;
                let toolQueue: Promise<void> = Promise.resolve();
                let toolCalls = 0;
                const toolEvents = generationToolEvents;
                const tools = { root, roadmapGeneration: true, generationId: input.identity.generationId,
                    execute: async (name: string, args: unknown, signal?: AbortSignal): Promise<string> => {
                        // Pi can dispatch a batch. Capture its order, but admit only one checked stage at a time.
                        const ordinal = ++toolCalls;
                        const work = async (): Promise<string> => {
                            const started = performance.now();
                            traceGeneration(input.identity.generationId, 'tool-call-start',
                                { phase: ordinal, call: generationCallNumber, tool: name });
                            let status: 'completed' | 'failed' | 'denied' = 'denied';
                            let error = 'ROADMAP_GENERATION_TOOL_DENIED';
                            let output = '';
                            let current = false;
                            try {
                                current = !input.signal.aborted && !signal?.aborted &&
                                    this.generationControllers.get(request.chatId)?.controller === controller &&
                                    await generationCurrent(controller.identity);
                                if (!current) throw new Error('ROADMAP_GENERATION_STALE');
                                await input.admitTool();
                                const record = args && typeof args === 'object' && !Array.isArray(args) ?
                                    args as Record<string, unknown> : undefined;
                                if (!record || record.version !== 1) throw new Error('ROADMAP_GENERATION_ARGUMENTS');
                                if (name === 'roadmap_phase') {
                                    if (Object.keys(record).sort().join(',') !== 'gates,objective,phase,title,version' ||
                                        !Number.isSafeInteger(record.phase) || typeof record.title !== 'string' ||
                                        typeof record.objective !== 'string' || !Array.isArray(record.gates) ||
                                        !record.gates.length || record.gates.length > 12 ||
                                        !record.gates.every(gate => gate && typeof gate === 'object' &&
                                            !Array.isArray(gate) && Object.keys(gate).sort().join(',') ===
                                                'criteria,purpose,title' && typeof gate.title === 'string' &&
                                            typeof gate.purpose === 'string' && Array.isArray(gate.criteria) &&
                                            gate.criteria.length > 0 && gate.criteria.length <= 12 &&
                                            gate.criteria.every((criterion: unknown) => criterion &&
                                                typeof criterion === 'object' && !Array.isArray(criterion) &&
                                                Object.keys(criterion).sort().join(',') === 'expectedResult,title' &&
                                                typeof (criterion as { title: unknown }).title === 'string' &&
                                                typeof (criterion as { expectedResult: unknown }).expectedResult === 'string')))
                                        throw new Error('ROADMAP_GENERATION_ARGUMENTS');
                                    const gates = record.gates as GenerationPhase['gates'];
                                    const phase = { title: record.title, objective: record.objective, gates,
                                        subcalls: Math.ceil((gates.length + 1) / 8) };
                                    const receipt = await input.submitPhase(record.phase as number, phase);
                                    output = JSON.stringify({ version: 1, accepted: true, ...receipt });
                                } else if (name === 'roadmap_finish') {
                                    if (Object.keys(record).sort().join(',') !== 'unresolved,version' ||
                                        !Array.isArray(record.unresolved) || record.unresolved.length > 16 ||
                                        !record.unresolved.every(item => typeof item === 'string' &&
                                            !!item.trim() && item.length <= 300))
                                        throw new Error('ROADMAP_GENERATION_ARGUMENTS: roadmap_finish needs version 1 and unresolved as an array of short strings; use [] if none.');
                                    await input.finish(record.unresolved as string[]);
                                    output = JSON.stringify({ version: 1, accepted: true, status: 'review-ready' });
                                } else throw new Error('ROADMAP_GENERATION_TOOL_DENIED');
                                status = 'completed';
                            } catch (cause) {
                                if (current) input.rejectTool();
                                error = String(cause).replace(/^Error: /, '').slice(0, 180);
                                status = current ? 'failed' : 'denied';
                                output = JSON.stringify({ version: 1, accepted: false, error });
                            }
                            toolEvents.push({ name: name as 'roadmap_phase' | 'roadmap_finish', status,
                                truncated: false, brokerExecuted: current, stage: current ? 'broker' : 'authority' });
                            traceGeneration(input.identity.generationId, 'tool-call-complete',
                                { phase: ordinal, call: generationCallNumber, tool: name, status,
                                    durationMs: Math.round(performance.now() - started) });
                            recordGenerationActivity('tool', `${name}: ${status}`);
                            return output;
                        };
                        const result = toolQueue.then(work);
                        toolQueue = result.then(() => undefined, () => undefined);
                        return result;
                    } };
                const instructions = `Use roadmap_phase for each next Phase, in order, with a title, objective, ` +
                    `Gates and observable Criteria. Wait for each checked stage receipt before continuing. ` +
                    `Finish with roadmap_finish and list unresolved requirements. Dope owns IDs, staging and approval. ` +
                    `Only tool arguments are accepted.`;
                const messages: ConversationMessage[] = [{ role: 'system', content: instructions },
                    ...(composed?.messages.slice(0, -1) ?? []),
                    { role: 'user', content: (composed?.messages.at(-1)?.content ?? input.scope) + '\n\n' +
                        JSON.stringify({ project: input.context, scope: input.scope }) }];
                const outputBudget = Math.min(4096, Math.max(2048, chat.settings.context.reservedOutputTokens));
                traceGeneration(input.identity.generationId, 'model-dispatch',
                    { phase: input.phase, call: generationCallNumber, outputBudget,
                        messageBytes: Buffer.byteLength(JSON.stringify(messages), 'utf8') });
                let firstProviderOutput = false;
                for await (const event of this.models!.generate(selection!, {
                    messages, controls: chat.settings.reasoningControls, signal: input.signal,
                    projectTools: tools, maxOutputTokens: outputBudget }, { localOnly: true })) {
                    if (event.type === 'activity' || event.type === 'delta') {
                        if (event.text && !firstProviderOutput) {
                            firstProviderOutput = true;
                            traceGeneration(input.identity.generationId, 'first-provider-output',
                                { phase: input.phase, call: generationCallNumber,
                                    kind: event.type === 'delta' ? 'final' : event.kind });
                        }
                    }
                    if (event.type === 'activity') {
                        if (event.kind === 'thinking') {
                            input.report({ generationId: input.identity.generationId, call: generationCallNumber,
                                sequence: ++sequence, kind: 'reasoning', text: event.text });
                            recordGenerationActivity('thinking', event.text);
                        } else if (event.kind === 'provisional') {
                            input.report({ generationId: input.identity.generationId, call: generationCallNumber,
                                sequence: ++sequence, kind: 'tool-argument', text: event.text });
                            if (!toolOutputStarted) {
                                toolOutputStarted = true;
                                traceGeneration(input.identity.generationId, 'tool-output-start',
                                    { phase: input.phase, call: generationCallNumber });
                                recordGenerationActivity('provisional', event.text);
                            }
                        } else recordGenerationActivity(event.kind, event.text);
                    } else if (event.type === 'delta' && event.text) {
                        input.report({ generationId: input.identity.generationId, call: generationCallNumber,
                            sequence: ++sequence, kind: 'final', text: event.text });
                    } else if (event.type === 'complete') {
                        if (event.actualModelId && event.actualModelId !== input.identity.model.modelId)
                            throw new Error('ROADMAP_GENERATION_MODEL_CHANGED');
                        usage = { inputTokens: event.usage.inputTokens,
                            outputTokens: event.usage.outputTokens, totalTokens: event.usage.totalTokens,
                            reasoningTokens: event.usage.reasoningTokens,
                            finishReason: event.finishReason };
                        traceGeneration(input.identity.generationId, 'model-complete',
                            { phase: input.phase, call: generationCallNumber,
                                finishReason: event.finishReason, inputTokens: usage.inputTokens,
                                outputTokens: usage.outputTokens, reasoningTokens: usage.reasoningTokens,
                                totalTokens: usage.totalTokens });
                    }
                }
                if (!await generationCurrent(input.identity) || input.signal.aborted)
                    throw new Error('ROADMAP_GENERATION_STALE');
                await toolQueue;
                return { usage };
            },
            stage: {
                validate: async (phase, bound, signal) => nativeAdapter.validate(phase, bound, signal),
                stage: (phase, bound, signal) => nativeAdapter.stage(phase, bound, signal),
                complete: (bound, signal) => nativeAdapter.complete(bound, signal),
                snapshot: async () => nativeAdapter.snapshot()
            },
            onEvent: event => {
                if (event.state !== 'initializing')
                    traceGeneration(event.generationId, 'controller-state',
                        { state: event.state, phase: event.phase, calls: event.calls,
                            ...(event.diagnostic ? { reason: event.diagnostic.slice(0, 160) } : {}) });
                if (['failed', 'cancelled', 'stale'].includes(event.state))
                    traceGeneration(event.generationId, 'abort-signal',
                        { reason: event.diagnostic?.slice(0, 160) ?? event.state });
                if (!['incomplete', 'failed', 'cancelled', 'stale'].includes(event.state) ||
                    this.generationControllers.get(request.chatId)?.controller !== controller) return;
                this.nativeStages?.forget(request.chatId);
                try { this.client.notifyChatEvent({ projectHandle: request.projectHandle,
                    kind: 'roadmap-stage', chatId: request.chatId, messageId: controller.identity.turnId,
                    snapshot: null, reason: event.state === 'cancelled' ? 'cancelled' :
                        event.state === 'stale' ? 'stale' : 'failed' }); }
                catch { /* The validated stage owner does not depend on a UI listener. */ }
            }
        });
        nativeAdapter = new RoadmapGenerationNativeStage(this.nativeStages!, request.leaseToken,
            controller.identity, update => {
                if (this.generationControllers.get(request.chatId)?.controller !== controller ||
                    this.leases.get(request.chatId)?.token !== request.leaseToken ||
                    this.root !== root || this.handle !== request.projectHandle ||
                    update.generationId !== controller.identity.generationId ||
                    update.proposalId !== update.snapshot.proposalId ||
                    update.seq !== update.snapshot.sequence ||
                    update.projectionRevision !== controller.identity.revision ||
                    update.snapshot.projectId !== controller.identity.projectId ||
                    update.snapshot.turnId !== controller.identity.turnId ||
                    update.snapshot.sourceHash !== controller.identity.sourceHash) return;
                this.client.notifyChatEvent({ projectHandle: request.projectHandle,
                    kind: 'roadmap-stage', chatId: request.chatId,
                    messageId: controller.identity.turnId, snapshot: update.snapshot,
                    generation: { generationId: update.generationId, proposalId: update.proposalId,
                        seq: update.seq, status: update.status, counts: update.counts,
                        projectionRevision: update.projectionRevision } });
            });
        if (this.disposed || this.root !== root || this.leases.get(request.chatId)?.token !== request.leaseToken)
            throw new Error('Roadmap generation command lost its Chat owner');
        if (this.pendingCancel.get(request.chatId) === request.leaseToken) {
            this.pendingCancel.delete(request.chatId);
            controller.cancel();
        }
        const mutate = async (operation: ChatOperation) => {
            for (let attempt = 0; attempt < 3; attempt++) {
                try { return await this.repository.mutate(root, (await this.repository.read(root)).revision,
                    operation, request.leaseToken); }
                catch (error) { if (attempt === 2 || !String(error).includes('Stale Chat revision')) throw error; }
            }
            throw new Error('Chat mutation conflict');
        };
        const user: ChatUserMessage = { schemaVersion: 1, id: randomUUID(), role: 'user',
            createdAt: new Date().toISOString(), content: request.content!.trim(), contextRefs,
            skill: generationChatSkillSnapshot() };
        const now = new Date().toISOString();
        const assistant: ChatAssistantMessage = { schemaVersion: 1, id: identity.turnId, role: 'assistant',
            createdAt: now, content: '', execution: { schemaVersion: 1, id: executionId,
                status: 'pending', selectedModel: { ...selection },
                resolutionSource: request.selectedModel ? 'explicit-turn' : 'chat-exact-default', startedAt: now } };
        await mutate({ type: 'append-user', chatId: request.chatId, message: user });
        await mutate({ type: 'begin-assistant', chatId: request.chatId, message: assistant });
        const actualModel: ChatModelProvenance = { schemaVersion: 1, connectionId: connection!.id,
            modelId: model.id, providerId: 'local', modelLabel: model.label };
        await mutate({ type: 'start-assistant', chatId: request.chatId,
            messageId: assistant.id, actualModel });
        traceGeneration(controller.identity.generationId, 'chat-command-accepted');
        this.generationControllers.set(request.chatId, { token: request.leaseToken, controller });
        let result;
        try {
            traceGeneration(controller.identity.generationId, 'controller-start');
            result = await controller.run();
        }
        finally { if (this.generationControllers.get(request.chatId)?.controller === controller)
            this.generationControllers.delete(request.chatId); }
        try {
        const usageSum = (key: 'inputTokens' | 'outputTokens' | 'totalTokens' | 'reasoningTokens') =>
            result.usage.length && result.usage.every(item => Number.isSafeInteger(item[key]) &&
                (item[key] ?? -1) >= 0) ? result.usage.reduce((sum, item) => sum + item[key]!, 0) : undefined;
        const totalTokens = usageSum('totalTokens');
        const outputTokens = usageSum('outputTokens');
        const reasoningTokens = usageSum('reasoningTokens');
        const finalTokens = outputTokens !== undefined && reasoningTokens !== undefined &&
            outputTokens >= reasoningTokens ? outputTokens - reasoningTokens : undefined;
        const tokenUsage: NonNullable<ChatAssistantMessage['execution']['tokenUsage']> = {
            tokenMeasurement: totalTokens === undefined ? 'unavailable' : 'provider-reported',
            ...(usageSum('inputTokens') === undefined ? {} : { inputTokens: usageSum('inputTokens') }),
            ...(outputTokens === undefined ? {} : { outputTokens }),
            ...(totalTokens === undefined ? {} : { totalTokens }),
            ...(reasoningTokens === undefined ? {} : { reasoningTokens }) };
        const finishReason = result.usage.at(-1)?.finishReason;
        const last = result.events.at(-1);
        if (result.state !== 'review-ready') {
            this.nativeStages!.forget(request.chatId);
            const reason = last?.diagnostic ?? `Roadmap generation ${result.state}`;
            const partial = result.scopeLedger.staged.map(item => `${item.title}: ` +
                item.gates.map(gate => `${gate.title} (${gate.criteria.join('; ')})`).join(', ')).join(' | ');
            const diagnostic = (`${reason}. ${result.phases} validated Phase(s); ` +
                `${result.calls} call(s), ${result.metrics.retries} retry(ies). ` +
                `Elapsed ${result.metrics.durationMs} ms; first stage ` +
                `${result.metrics.timeToFirstStageMs ?? 'unknown'} ms. ` +
                (partial ? `Inspectable partial draft: ${partial}. ` : '') +
                'No Apply authority; submit a fresh /gen-roadmap command after checking the source and model.')
                .slice(0, 2000);
            await mutate({ type: 'finish-assistant', chatId: request.chatId, messageId: assistant.id,
                outcome: result.state === 'cancelled' ? 'cancelled' : 'failed', content: '',
                ... (result.state === 'cancelled' ? {} : { failure: reason.slice(0, 1000) }),
                planningActivity: { schemaVersion: 1,
                    kind: result.state === 'cancelled' ? 'cancelled' : 'error',
                    status: result.state === 'cancelled' ? 'cancelled' : 'failed',
                    refs: contextRefs, diagnostic },
                activity: generationActivity.snapshot(), actualModel, tokenUsage,
                ...(finishReason ? { finishReason } : {}),
                toolEvents: generationToolEvents });
            return { refs: contextRefs, diagnostics: composed?.diagnostics ?? [],
                usedTokens: composed?.usedTokens ?? 0, budgetTokens: composed?.budgetTokens ?? 0,
                proposalError: reason };
        }
        const stage = this.nativeStages!.get(request.chatId);
        if (!await generationCurrent(controller.identity))
            throw new Error('ROADMAP_GENERATION_FINAL_SOURCE_STALE');
        if (!stage?.done || stage.context.turnId !== assistant.id || !stage.snapshot?.complete) {
            this.nativeStages!.forget(request.chatId);
            throw new Error('ROADMAP_GENERATION_FINAL_STAGE_MISSING');
        }
        const { before, after } = await this.nativeStages!.complete(stage.context);
        const entities = (index: RoadmapGateIndex) => [...index.phases, ...index.gates,
            ...index.corrections, ...index.gates.flatMap(gate => gate.criteria)];
        const prior = new Map(entities(before).map(item => [item.id, item]));
        const next = new Map(entities(after).map(item => [item.id, item]));
        const changedIds = stage.isolated ? [...next.keys()] :
            [...new Set([...prior.keys(), ...next.keys()])].filter(id =>
                JSON.stringify(prior.get(id)) !== JSON.stringify(next.get(id)));
        const counts = typedRoadmapCounts(after);
        const scopeWarnings = [...(before.linkedDocument ? [
            `Replacement unlinks ${before.linkedDocument.path}; the Markdown file is preserved.`] : []),
            ...result.scopeLedger.candidateCoverage.map(item =>
            `User goal, semantic coverage unverified: ${item.requirement.slice(0, 300)}; ` +
            (item.candidates.length ? `candidate Gate(s): ${item.candidates.join(', ').slice(0, 140)}` :
                'no text-matched Gate or Criterion; inspect coverage manually')),
            ...result.scopeLedger.unresolved.map(item => `Model-reported unresolved: ${item.slice(0, 440)}`)];
        const proposal: ChatPlanningProposal = { id: stage.id, chatId: request.chatId,
            messageId: assistant.id, ownerId: before.projectId, revision: before.revision,
            generation: stage.generation, counts, sourceHash: before.linkedDocument?.sourceHash,
            changedIds, action: { type: 'native-generation-replacement', id: before.projectId },
            operations: stage.operations.map(item => ({ id: item.id, type: item.action.type,
                targetId: 'id' in item.action ? item.action.id ?? before.projectId :
                    'gateId' in item.action ? item.action.gateId : before.projectId,
                status: item.status })),
            warnings: scopeWarnings.length <= 16 ? scopeWarnings :
                [...scopeWarnings.slice(0, 15), `${scopeWarnings.length - 15} additional scope or unresolved items; inspect the original Chat request.`],
            summary: `Replace the current Roadmap with ${counts.phases} Phases, ${counts.gates} Gates, ${counts.criteria} Criteria; ` +
                `${stage.operations.length} pending operations. Validated preview; no Roadmap change applied.` +
                ` Scope coverage is unverified. ${result.calls} calls, ${result.metrics.retries} retries; ` +
                `first stage ${result.metrics.timeToFirstStageMs ?? 'unknown'} ms; ` +
                `review ${result.metrics.timeToReviewMs ?? 'unknown'} ms; ` +
                `provider tokens ${totalTokens ?? 'unknown'}, reasoning ${reasoningTokens ?? 'unknown'}, ` +
                `derived final ${finalTokens ?? 'unknown'}; finish ${finishReason ?? 'unknown'}.`,
            preview: roadmapProposalPreview(stage.isolated ? { ...before, phases: [], gates: [], corrections: [],
                linkedDocument: undefined } : before, after,
                stage.operations.map(item => item.action), changedIds) };
        if (Buffer.byteLength(JSON.stringify(proposal), 'utf8') > 60_000) {
            this.nativeStages!.forget(request.chatId);
            throw new Error('ROADMAP_GENERATION_PROPOSAL_LIMIT');
        }
        const content = `Roadmap draft ready for review: ${counts.phases} Phases, ` +
            `${counts.gates} Gates, ${counts.criteria} Criteria. No Roadmap changes have been applied.`;
        if (!await generationCurrent(controller.identity))
            throw new Error('ROADMAP_GENERATION_FINAL_SOURCE_STALE');
        await mutate({ type: 'finish-assistant', chatId: request.chatId, messageId: assistant.id,
            outcome: 'complete', content, activity: generationActivity.snapshot(), actualModel,
            toolEvents: generationToolEvents, tokenUsage,
            ...(finishReason ? { finishReason } : {}),
            planningActivity: { schemaVersion: 1, kind: 'roadmap-gate-proposal', refs: contextRefs,
                status: 'pending', proposalId: proposal.id, proposal } });
        this.proposals.set(request.chatId, { id: stage.id, messageId: assistant.id,
            leaseToken: request.leaseToken, changedIds, nativeStageId: stage.id,
            generationOnly: true });
        return { refs: contextRefs, diagnostics: composed?.diagnostics ?? [],
            usedTokens: composed?.usedTokens ?? 0, budgetTokens: composed?.budgetTokens ?? 0, proposal };
        } catch (error) {
            this.nativeStages!.forget(request.chatId);
            this.clearProposal(request.chatId);
            const reason = `Roadmap generation finalization failed: ${String(error)}`.slice(0, 1000);
            const saved = (await this.repository.read(root)).chats.find(item => item.id === request.chatId)
                ?.messages.find(item => item.id === assistant.id);
            if (saved?.role === 'assistant' && saved.execution.status === 'pending')
                await mutate({ type: 'finish-assistant', chatId: request.chatId, messageId: assistant.id,
                    outcome: 'failed', content: '', failure: reason,
                    activity: generationActivity.snapshot(), actualModel,
                    toolEvents: generationToolEvents });
            return { refs: contextRefs, diagnostics: composed?.diagnostics ?? [],
                usedTokens: composed?.usedTokens ?? 0, budgetTokens: composed?.budgetTokens ?? 0,
                proposalError: reason };
        }
    }

    async runTurn(request: ChatTurnRequest): Promise<ChatTurnResult> {
        const root = this.active(request.projectHandle);
        const command = !request.retryMessageId ? roadmapGenerationCommand(request.content ?? '') : { kind: 'none' as const };
        if (command.kind === 'usage') throw new Error('Usage: /gen-roadmap <roadmap prompt>');
        if (command.kind === 'ready') return this.runGenerationCommand(root, request, command.body);
        if (!request.retryMessageId && (/^\/roadmap\s+generate(?:\s|$)/u.test(request.content?.trim() ?? '') ||
            /^yes,?\s+create the roadmap[.!]?$/iu.test(request.content?.trim() ?? '')))
            throw new Error('Legacy Roadmap generation is unavailable; submit /gen-roadmap <roadmap prompt> as a fresh Chat command');
        if (!this.models || this.turns.has(request.chatId) || this.generationControllers.has(request.chatId) ||
            this.generationPreparing.has(request.chatId))
            throw new Error('Chat turn already active or runtime unavailable');
        const snapshot = await this.repository.read(root);
        const chat = snapshot.chats.find(item => item.id === request.chatId);
        if (!chat) throw new Error('Chat not found');
        if (chat.messages.some(message => message.role === 'assistant' &&
            ['pending', 'streaming', 'paused-output-limit'].includes(message.execution.status)))
            throw new Error('Resolve the active Chat execution before sending another turn');
        // Saved offers remain inert; a saved answer never becomes Roadmap mutation authority.
        await this.repository.renew(root, request.chatId, request.leaseToken);
        const retryIndex = request.retryMessageId ? chat.messages.findIndex(item => item.id === request.retryMessageId) : -1;
        const content = request.retryMessageId ? (() => {
            if (retryIndex < 1 || chat.messages[retryIndex].role !== 'assistant' ||
                !['failed', 'cancelled'].includes((chat.messages[retryIndex] as ChatAssistantMessage).execution.status) ||
                chat.messages[retryIndex - 1].role !== 'user') throw new Error('Only a failed or cancelled attempt can be retried');
            return chat.messages[retryIndex - 1].content;
        })() : request.content?.trim() ?? '';
        const skill = retryIndex >= 0 ? (chat.messages[retryIndex - 1] as ChatUserMessage).skill :
            await resolveChatSkill(content);
        // A saved skill snapshot describes the old attempt; it cannot authorize a new protected edit.
        if (retryIndex >= 0 && roadmapGenerationCommand(content).kind !== 'none')
            throw new Error('Roadmap generation cannot be replayed; submit a fresh /gen-roadmap command');
        if (retryIndex >= 0 && (skill?.name === 'roadmap' || /^\/roadmap(?=\s|$)/.test(content)))
            throw new Error('Start a fresh /roadmap turn to request a reviewed Roadmap change');
        if (skill && createHash('sha256').update(skill.body).digest('hex') !== skill.digest)
            throw new Error('Saved skill instructions changed; start a fresh turn');
        const promptStage = promptStageCommand(content, boundPromptStage(skill));
        if (/^\/prompt-(?:ass|plan|write)(?=\s|$)/u.test(content) && !promptStage)
            throw new Error('Protected prompt authoring skill identity changed; start a fresh turn');
        if (request.promptStackRevision && (promptStage?.stage !== 'prompt-write' || retryIndex >= 0))
            throw new Error('Prompt revision requires a fresh protected /prompt-write turn');
        const selectedPrompt = request.promptStackRevision ?
            await this.savedPromptStack(root, request.chatId, request.leaseToken,
                request.promptStackRevision.proposalId, request.promptStackRevision.digest) : undefined;
        if (selectedPrompt && (selectedPrompt.activity.status !== 'pending' ||
            selectedPrompt.proposal.revision !== request.promptStackRevision!.revision ||
            selectedPrompt.proposal.folder !== promptStage?.folder ||
            (await this.inspectPromptStack(request.projectHandle, request.chatId, request.leaseToken,
                selectedPrompt.proposal.id, selectedPrompt.proposal.digest)).status !== 'applicable'))
            throw new Error('Selected prompt stack proposal is stale; its last valid revision remains available');
        const selectedPair = (assistant: ChatAssistantMessage) => {
            let index = chat.messages.findIndex(item => item.id === assistant.id) - 1;
            while (index >= 0 && chat.messages[index].role === 'assistant') index--;
            const user = chat.messages[index];
            if (!user || user.role !== 'user') throw new Error('Saved prompt command is unavailable');
            return { assistant, user };
        };
        const priorAssessment = selectedPrompt ? selectedPair(selectedPrompt.assessment) :
            promptStage && promptStage.stage !== 'prompt-ass' ?
            priorPromptDraft(chat, 'prompt-ass', retryIndex >= 0 ? retryIndex - 1 : undefined) : undefined;
        const priorPlan = selectedPrompt ? selectedPair(selectedPrompt.plan) :
            promptStage?.stage === 'prompt-write' ?
            priorPromptDraft(chat, 'prompt-plan', retryIndex >= 0 ? retryIndex - 1 : undefined) : undefined;
        if (promptStage && promptStage.stage !== 'prompt-ass' && !priorAssessment ||
            promptStage?.stage === 'prompt-write' && !priorPlan)
            throw new Error('Complete /prompt-ass and /prompt-plan in this saved Chat before writing a stack');
        if (priorAssessment && priorPlan &&
            chat.messages.findIndex(message => message.id === priorAssessment.assistant.id) >
            chat.messages.findIndex(message => message.id === priorPlan.assistant.id))
            throw new Error('The selected assessment is newer than the saved plan; run /prompt-plan again');
        if (promptStage && !this.grounder) throw new Error('Prompt authoring requires brokered project reads');
        if (priorAssessment) await verifyPromptDraftSource(root, priorAssessment.assistant, this.grounder!);
        if (priorPlan) await verifyPromptDraftSource(root, priorPlan.assistant, this.grounder!);
        const promptSourceBasis = promptStage?.stage === 'prompt-write' ?
            await capturePromptSourceEvidence(root) : undefined;
        const promptSourceVersion = promptSourceBasis?.packageVersion;
        if (selectedPrompt && selectedPrompt.proposal.sourceVersion !== promptSourceVersion)
            throw new Error('Prompt revision project version changed');
        const docsReview = isBoundDocumentationSkill(skill, 'docs-review');
        if (skill?.name === 'docs-review' && !docsReview)
            throw new Error('Saved protected documentation skill identity changed; start a fresh turn');
        if (request.documentationRevision && (!docsReview || retryIndex >= 0))
            throw new Error('Proposal revision requires a fresh /docs-review turn');
        const revisionTarget = request.documentationRevision;
        const revisionMessage = revisionTarget ? chat.messages.find(message => message.role === 'assistant' &&
            message.planningActivity?.kind === 'documentation-proposal' &&
            message.planningActivity.proposalId === revisionTarget.proposalId) as ChatAssistantMessage | undefined : undefined;
        const revisionActivity = revisionMessage?.planningActivity;
        const revisionProposal = revisionActivity?.documentProposal;
        if (revisionTarget && (!this.roadmapStore || !revisionMessage || !revisionProposal ||
            revisionActivity?.status !== 'pending' || revisionProposal.digest !== revisionTarget.digest ||
            (revisionProposal.proposalRevision ?? 1) !== revisionTarget.revision ||
            revisionProposal.root !== root || revisionProposal.chatId !== request.chatId ||
            revisionProposal.messageId !== revisionMessage.id ||
            revisionProposal.ownerId !== this.leases.get(request.chatId)?.ownerId ||
            revisionProposal.leaseDigest !== createHash('sha256').update(request.leaseToken).digest('hex') ||
            await documentationReviewApplicability(this.roadmapStore, revisionProposal, root) !== 'applicable'))
            throw new Error('Selected documentation proposal is missing or stale. Its last valid revision remains available.');
        await this.retirePending(root, request.chatId, request.leaseToken, 'superseded', !!revisionProposal);
        this.clearProposal(request.chatId);
        const roadmapSkill = isBoundRoadmapSkill(skill);
        const publicationIntent = roadmapSkill && retryIndex < 0 ? roadmapPublicationIntent(content) : undefined;
        if (skill?.name === 'roadmap' && !roadmapSkill)
            throw new Error('Saved /roadmap identity changed; start a fresh turn');
        const retryElementRefs = retryIndex >= 0 ?
            (chat.messages[retryIndex - 1] as ChatUserMessage).contextRefs.filter(ref =>
                ref.kind === 'roadmap' && ref.elementKind) : [];
        const selections = retryElementRefs.length ? [
            ...retryElementRefs.map(ref => ({ kind: 'roadmap' as const, id: ref.id,
                elementKind: ref.elementKind, projectId: ref.projectId,
                ownerRevision: ref.ownerRevision, sourceHash: ref.sourceHash })),
            ...(request.context ?? []).filter(item => item.kind !== 'roadmap')
        ] : [...request.context ?? []];
        const roadmapBinding = roadmapSkill ? await this.bindRoadmapSkill(root, selections, request.chatId) : undefined;
        const greenfieldSkill = roadmapBinding?.greenfield ?? false;
        const initialNative = roadmapSkill && !greenfieldSkill && roadmapBinding?.revision === 0;
        if (greenfieldSkill && publicationIntent) throw new Error('Accept a Roadmap before publishing it');
        const reviewObjective = docsReview ? documentationReviewObjective(content,
            chat.messages.filter(message => message.role === 'user').map(message => message.content)) : undefined;
        const discovery = docsReview ? await discoverDocumentation(root, reviewObjective!) : undefined;
        const promptRequestedCount = promptStage?.stage === 'prompt-write' ? requestedWorkPromptCount(
            content, ...chat.messages.filter(message => message.role === 'user').slice(-8).reverse()
                .map(message => message.content), priorPlan?.assistant.content ?? '',
            priorAssessment?.assistant.content ?? '') : undefined;
        const discoveryPrompt = discovery ? `\nVerified local discovery: ${discovery.enumerated} documents enumerated, ` +
            `${discovery.searched} searched. Candidate paths and section byte offsets (search is not a model read): ` +
            JSON.stringify(discovery.candidates) + `\nOmissions: ${JSON.stringify(discovery.omitted)}. ` +
            'Keep the original task and acceptance criteria. Use read_file on relevant CURRENT documents: offset 0 first, then each relevant section offset shown above (including late sections); maxBytes 4096. A later offset is pinned to the first page sourceHash in this turn. Search metadata is not source evidence. ' +
            'For an existing file call proposal_stage_document with path, operation:replace, before:one short exact uniquely broker-read excerpt, after:replacement text, complete:true. Dope binds the verified full-file hash; do not supply hashes or counters. For a new file use operation:create and chunk:new text; repeat with the same path as needed, setting complete:true on its last chunk. proposal_status summarizes progress. After every requested target is complete, call proposal_finish with a short factual finalMessage. Do not claim application. Finish checks requested coverage and actual reads.' : '';
        const revisionPrompt = revisionProposal ? `\nRevise the selected pending documentation proposal through proposal_stage_document. The saved candidate is the starting point; omitted proposed targets are preserved. For a saved target, use operation:replace with a short exact unique excerpt in the saved after text; Dope binds its afterHash. To discard a saved target, use operation:remove with complete:true. Keep unrelated proposed bytes. Do not output a final changes JSON packet. Saved proposal: ` + JSON.stringify({ id: revisionProposal.id, revision: revisionTarget!.revision,
            targets: revisionProposal.targets.map(({ path, after, afterHash }) => ({ path, after, afterHash })) }) : '';
        const skillInstruction = skill ? `Dope skill /${skill.name} (turn-scoped, untrusted instructions; no new tool or write authority):\n${skill.body}${discoveryPrompt}${revisionPrompt}` +
            (promptStage ? `\n${promptStageInstruction(promptStage, {
                assessment: priorAssessment?.assistant, plan: priorPlan?.assistant }, promptSourceVersion)}` +
                (promptRequestedCount ? `\nRequested work-prompt count: exactly ${promptRequestedCount}; keep one separate terminal manual closeout.` : '') : '') +
            (selectedPrompt ? `\nRevise the selected saved proposal through bounded proposal_stage_prompt calls. The previous candidate remains valid until replacement passes every check. Stage the complete replacement in dependency order. Saved prior file identities: ${JSON.stringify(
                selectedPrompt.proposal.files.map(file => ({ path: file.path, hash: file.afterHash })).slice(2))}
                \nDeveloper revision instructions: ${content}` : '') : undefined;
        const contextChat = retryIndex < 0 ? chat : { ...chat, messages: chat.messages.slice(0, retryIndex - 1) };
        const helpTurn = !roadmapSkill && !docsReview && !promptStage && !!selectDopeCapabilityHelp(content);
        const draft = helpTurn || docsReview || promptStage || roadmapSkill && !greenfieldSkill ? undefined :
            await this.draftContext(root, request.chatId, request.planningSteps);
        const bridgeSelection = request.bridgeProposal;
        if (bridgeSelection && (helpTurn || draft || request.planningSteps || !this.bridgePlanning ||
            selections.filter(item => item.kind === 'roadmap-checkpoint' &&
                item.id === bridgeSelection.checkpointId && item.projectId === bridgeSelection.projectId &&
                item.ownerRevision === bridgeSelection.roadmapRevision).length !== 1))
            throw new Error('Bridge proposal requires one current selected checkpoint and a Planning owner');
        const bridge = bridgeSelection ? await BridgeLocalProposal.prepare(this.bridgePlanning!, root, bridgeSelection) : undefined;
        const roadmapTurn = !docsReview && !promptStage && (selections.some(item => item.kind === 'roadmap-checkpoint' || item.kind === 'roadmap') ||
            !!draft || helpTurn || !!bridge);
        const opportunity = docsReview || promptStage ? undefined : await this.roadmapOpportunity(root, content, !roadmapTurn &&
            !selections.some(item => item.kind === 'planning-map'));
        if (request.planningSteps !== undefined && (![2, 3].includes(request.planningSteps) ||
            !roadmapTurn || helpTurn || !draft &&
            selections.filter(item => item.kind === 'roadmap-checkpoint').length !== 1))
            throw new Error('Small-step planning requires a bound draft or one unlinked Roadmap checkpoint and a cap of two or three');
        const planningPrompt = publicationIntent ? { text: 'This protected turn requests a deterministic Roadmap Markdown review. Do not write files, call tools, or claim publication. Reply in one short sentence that a backend review will be prepared.' } :
            initialNative ? { text: emptyRoadmapEditPrompt } :
            roadmapSkill && !greenfieldSkill ? { text: acceptedRoadmapEditPrompt } :
            bridge ? { text: bridge.instruction } : draft ?? (request.planningSteps ? { text:
            `The user explicitly requested up to ${request.planningSteps} small Roadmap steps. If the supplied evidence supports two or more safe unlinked edits, return one strict JSON object with exactly these fields: type "roadmap-sequence", projectId (exact project ID from evidence), ownerRevision (numeric current owner revision from evidence), and actions (two or three typed action objects). ` +
            'Each action must use a supported Roadmap action type and exact selected checkpoint ID where required. The complete sequence is one atomic preview requiring human approval. If any step is ambiguous, ask a concrete question in a no-action message instead. Never claim an edit was applied.' } : undefined);
        const requestHard: AIRoleHardConstraints = { ...chatHard,
            minimumKnownContextTokens: Math.ceil(Buffer.byteLength(content, 'utf8') / 3) + 4 +
                chat.settings.context.reservedOutputTokens };
        const following = !request.selectedModel && chat.settings.modelPolicy.type === 'follow-interactive';
        let selectedModel = request.selectedModel ?? (chat.settings.modelPolicy.type === 'exact' ? chat.settings.modelPolicy.model : undefined);
        if (following) {
            if (!this.routing) throw new Error('Interactive role routing unavailable');
            const proposed = await this.routing.resolve('interactive',
                roadmapTurn ? { ...requestHard, locality: 'local-only' } : requestHard,
                roadmapTurn ? false : true);
            const first = proposed.resolution.selectedTarget;
            if (!first) throw new Error('Interactive role has no eligible model; configure or repair it in AI Center → Roles');
            const locality = proposed.inventory.models.find(item => item.connectionId === first.connectionId &&
                item.providerModelKey === first.modelId)?.locality;
            if (locality === 'hosted' && !request.hostedProjectDataAuthorized)
                throw new Error('Chat hosted egress confirmation required');
            const eligible = await this.routing.resolve('interactive',
                roadmapTurn ? { ...requestHard, locality: 'local-only' } : requestHard,
                !roadmapTurn && request.hostedProjectDataAuthorized === true);
            selectedModel = eligible.resolution.selectedTarget;
        }
        if (!selectedModel) throw new Error('Select an exact model or configure Interactive in AI Center → Roles');
        const connection = (await this.models.list()).connections.find(item => item.id === selectedModel.connectionId);
        const model = connection?.ready && connection.models.find(item => item.id === selectedModel.modelId && item.usable);
        if (!connection || !model) throw new ModelRuntimeFailure('Selected model is unavailable; manage AI connections in AI Center', 'model-unavailable');
        if (docsReview && (connection.providerId !== 'local' || !this.grounder || !this.roadmapStore))
            throw new Error('Protected documentation review requires the selected local Pi model, brokered reads and proposal owner');
        if (promptStage && connection.providerId !== 'local')
            throw new Error('Prompt authoring requires the selected local Pi model and brokered project reads');
        if ((draft || bridge) && connection.providerId !== 'local') throw new Error('Planning requires a selected local model');
        if (connection.providerId !== 'local' && request.hostedProjectDataAuthorized !== true)
            throw new Error('Chat hosted project-data confirmation required');
        const controls = chat.settings.reasoningControls ?? {};
        for (const [id, value] of Object.entries(controls))
            if (!model.capabilities.reasoningControls?.some(control => control.id === id && control.values.includes(value)))
                throw new ModelRuntimeFailure(id === 'reasoning.effort' && value === 'off' &&
                    model.capabilities.localReasoning?.format === 'qwen-chat-template' ?
                    'Reasoning Off is unavailable for this LM Studio Qwen model through the Pi tool endpoint; choose Auto or On' :
                    'Selected model does not support the saved reasoning control', 'unsupported-capability');
        if (!this.composer) throw new Error('Context composer unavailable');
        if (publicationIntent && connection.providerId !== 'local') throw new Error('Roadmap publication Chat requires a selected local model');
        const localRoadmap = roadmapTurn && connection.providerId === 'local' && !publicationIntent;
        const reasoningOn = connection.providerId === 'local' && !!model.capabilities.localReasoning &&
            (controls['reasoning.effort'] ?? model.capabilities.localReasoning.default) !== 'off';
        const planningOutput = reasoningOn ? Math.max(2048, chat.settings.context.reservedOutputTokens) :
            chat.settings.context.reservedOutputTokens;
        const budget = localRoadmap ? roadmapLocalBudget(model.capabilities.contextWindowTokens,
            planningOutput, model.capabilities) : undefined;
        // Pi must discover source with its own brokered tools; automatic grounding is for other providers.
        const grounding = connection.providerId === 'local' ? undefined : await this.grounder?.ground(root, content);
        const priorRefs = retryIndex >= 0 ? (chat.messages[retryIndex - 1] as ChatUserMessage).contextRefs : undefined;
        if (priorRefs && !sameAutomaticEvidence(grounding, priorRefs))
            throw new Error('Retry project evidence changed or is stale; start a fresh turn');
        const nativeCandidate = roadmapSkill && !greenfieldSkill && connection.providerId === 'local' &&
            !publicationIntent && !initialNative;
        const roadmapPromptMode = nativeCandidate ? 'native-roadmap-edit' as const : 'ordinary' as const;
        const turnPrompt = nativeCandidate ? planningPrompt : skillInstruction ?
            { text: planningPrompt ? `${planningPrompt.text}\n\n${skillInstruction}` : skillInstruction } : planningPrompt;
        const ordinaryChat = !roadmapTurn && !docsReview && !skill;
        const composed = await this.composeTurn(root, contextChat, content, selections,
            model.capabilities, budget, turnPrompt, grounding, !!bridge, opportunity,
            connection.providerId === 'local', roadmapSkill,
            roadmapPromptMode, ordinaryChat, !!skill || roadmapTurn);
        if (bridge) composed.refs.push(bridge.reference);
        if (selections.some(item => item.kind === 'roadmap-checkpoint' || item.kind === 'roadmap') &&
            !composed.refs.some(ref => ref.kind === 'roadmap-checkpoint' || ref.kind === 'roadmap'))
            throw new Error('Selected Roadmap context does not fit; shorten the request or select a larger local model');
        let localMode: 'linked' | 'unlinked' | 'draft' | 'gate' | 'help' | 'bridge' =
            bridge ? 'bridge' :
                helpTurn ? 'help' : draft ? 'draft' :
                    composed.refs.some(item => item.kind === 'roadmap') ? 'gate' : 'unlinked';
        const nativeRoadmap = !initialNative && localRoadmap && roadmapSkill && localMode === 'gate' && !greenfieldSkill &&
            !!this.nativeStages && !!this.grounder;
        const retainStreamedAnswer = !localRoadmap && !nativeRoadmap && !docsReview && !promptStage && !publicationIntent;
        if (roadmapSkill && !publicationIntent && !greenfieldSkill && localMode === 'gate' &&
            !nativeRoadmap)
            throw new Error('Protected native Roadmap tools are unavailable; no proposal was staged');
        let eligibleObjective = true;
        if (localRoadmap && localMode !== 'gate' && !draft && !helpTurn && this.planning) {
            const ref = composed.refs.filter(item => item.kind === 'roadmap-checkpoint');
            if (ref.length !== 1) throw new Error('Select exactly one Roadmap checkpoint');
            const attached = await this.planning.attach(root);
            try {
                if (attached.snapshot.projectId !== ref[0].projectId || attached.snapshot.revision !== ref[0].ownerRevision)
                    throw new Error('Stale or foreign Roadmap context');
                const selected = attached.snapshot.checkpoints.find(item => item.id === ref[0].id);
                if (!selected || selected.source?.sha256 !== ref[0].sourceHash)
                    throw new Error('Stale Roadmap source');
                if (!bridge && attached.snapshot.linkedDocument && selected.source?.path === attached.snapshot.linkedDocument.path) {
                    localMode = 'linked';
                    eligibleObjective = (await readRoadmapDocumentCapabilities(root, attached.snapshot, selected.id))
                        .fields.objective.editable;
                }
            } finally { this.planning.detach(attached.projectHandle); }
        }
        if (request.planningSteps && (!localRoadmap || !['unlinked', 'draft'].includes(localMode)))
            throw new Error('Small-step planning requires a selected local model and unlinked Roadmap or bound draft');
        let preview: ChatContextPreview = { refs: composed.refs, diagnostics: composed.diagnostics,
            usedTokens: composed.usedTokens, budgetTokens: composed.budgetTokens };
        if (priorRefs && JSON.stringify(preview.refs.filter(ref => ref.origin !== 'automatic')) !==
            JSON.stringify(priorRefs.filter(ref => ref.origin !== 'automatic')))
            throw new Error('Retry context changed or missing; reattach the original context');
        if (this.turns.has(request.chatId)) throw new Error('Chat turn already active');
        const key = request.chatId;
        const abort = new AbortController();
        this.turns.set(key, { token: request.leaseToken, abort });
        const leaseHeartbeat = setInterval(() => {
            void this.repository.renew(root, key, request.leaseToken).catch(() => abort.abort());
        }, 20_000);
        leaseHeartbeat.unref?.();
        const mutate = async (operation: ChatOperation) => {
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    return await this.repository.mutate(root, (await this.repository.read(root)).revision,
                        operation, request.leaseToken);
                } catch (error) {
                    if (attempt === 2 || !String(error).includes('Stale Chat revision')) throw error;
                }
            }
            throw new Error('Chat mutation conflict');
        };
        let assistant: ChatAssistantMessage | undefined;
        let liveContinuation: Extract<ConversationEvent, { type: 'paused' }>['continuation'] | undefined;
        let liveProposalTerminal: Extract<ConversationEvent, { type: 'complete' }>['terminalContinuation'] | undefined;
        let proposalTerminalAttempted = false;
        let activity: ChatActivityRecorder | undefined;
        let activitySequence = 0;
        let activityCount = 0;
        let activityPersisted = 0;
        let activityTimer: ReturnType<typeof setTimeout> | undefined;
        let activityWrite = Promise.resolve();
        const flushActivity = () => {
            if (activityTimer) { clearTimeout(activityTimer); activityTimer = undefined; }
            if (!assistant || !activity) return activityWrite;
            const batch = activity.eventsSince(activityPersisted);
            activityPersisted += batch.length;
            if (batch.length) activityWrite = activityWrite.then(() =>
                this.repository.appendActivity(root, key, assistant!.id, assistant!.execution.id,
                    batch, request.leaseToken));
            return activityWrite;
        };
        const recordActivity = (kind: 'thinking' | 'provisional' | 'answer' | 'tool', text: string) => {
            if (!assistant || !activity || !text) return;
            activity.add(kind, text);
            const recorded = activity.eventsSince(activityCount);
            activityCount += recorded.length;
            if (recorded.length && !activityTimer) activityTimer = setTimeout(() => {
                void flushActivity().catch(() => undefined); // Terminal mutation observes write failure.
            }, 250);
            for (const item of recorded) try {
                this.client.notifyChatEvent({ projectHandle: request.projectHandle, kind: 'assistant-activity',
                    chatId: key, messageId: assistant.id, executionId: assistant.execution.id,
                    sequence: ++activitySequence, activityKind: item.kind, text: item.text });
            } catch { /* Diagnostic display cannot control execution. */ }
        };
        const userMessageId = retryIndex >= 0 ? chat.messages[retryIndex - 1].id : randomUUID();
        let output = '';
        let partialCursor = 0;
        let partialSegments = 0;
        let persistedPartial = '';
        let lastPartialWrite = 0;
        const persistOutputPartial = async (text: string) => {
            if (!retainStreamedAnswer || !assistant || text === persistedPartial) return;
            if (!text.startsWith(persistedPartial)) throw new Error('Streamed answer differs from saved partial');
            const delta = text.slice(persistedPartial.length);
            if (!delta) return;
            await mutate({ type: 'append-answer-partial', chatId: key, messageId: assistant.id,
                executionId: assistant.execution.id, segment: partialSegments + 1,
                cursor: partialCursor, delta });
            persistedPartial = text;
            partialCursor += Buffer.byteLength(delta, 'utf8');
            lastPartialWrite = Date.now();
        };
        let actual: ChatModelProvenance = { schemaVersion: 1, connectionId: connection.id,
            modelId: model.id, providerId: connection.providerId, modelLabel: model.label };
        let routingProvenance: RoutingProvenance | undefined;
        const sourceRefs: NonNullable<ChatAssistantMessage['execution']['sourceRefs']> = [];
        const toolEvents: NonNullable<ChatAssistantMessage['execution']['toolEvents']> = [];
        let toolBytes = 0;
        const documentationPages: DocumentationReadPage[] = [];
        const documentationHashes = new Map<string, string>();
        const protectedProposal = retryIndex < 0 && (docsReview || promptStage?.stage === 'prompt-write');
        let proposalController: IncrementalProposalController | undefined;
        let finishedDocument: ProposalHandoff<import('@dope/chat').ChatDocumentationProposal> | undefined;
        let finishedPrompt: ProposalHandoff<ChatPromptStackProposal> | undefined;
        const rejectedProposalCalls = new Map<string, number>();
        const noProjectTools = !!publicationIntent || forbidsProjectTools(content);
        // This closure belongs to one authorized Chat execution. A later read may inspect
        // staged operations, but cannot silently rebase its original source preconditions.
        let stagingBasis: { root: string; projectId: string; ownerId: string; chatId: string;
            turnId: string; lease: string; revision: number; sourceHash: string | null;
            linkState: string | null; expiresAt: number } | undefined;
        const projectTools = this.grounder && !noProjectTools ? { root, roadmapTools: nativeRoadmap,
            proposalTools: protectedProposal,
            execute: async (name: string, args: unknown, signal?: AbortSignal, toolCallId?: number): Promise<string> => {
                if (noProjectTools) throw new Error('Project tools prohibited for this Chat turn');
                if (name.startsWith('proposal_')) {
                    const proposalName = name as 'proposal_status' | 'proposal_stage_document' |
                        'proposal_stage_prompt' | 'proposal_finish';
                    const stageTarget = args && typeof args === 'object' && !Array.isArray(args) &&
                        typeof (args as { target?: unknown }).target === 'string' ?
                        safeChatToolPath((args as { target: string }).target) : undefined;
                    recordActivity('tool', `${proposalName}: running${stageTarget ? ` · ${stageTarget}` : ''}`);
                    let status: 'completed' | 'failed' | 'denied' = 'denied';
                    const rejectedKey = name === 'proposal_stage_prompt' ? JSON.stringify([name, args]) : '';
                    try {
                        if (!protectedProposal || !proposalController || signal?.aborted || abort.signal.aborted ||
                            this.turns.get(key)?.abort !== abort || toolEvents.length >= 512)
                            throw new Error('PROPOSAL_TOOL_AUTHORITY');
                        if (proposalTerminalAttempted &&
                            (name === 'proposal_stage_document' || name === 'proposal_stage_prompt'))
                            throw new Error('PROPOSAL_TERMINAL_FINISH_ONLY');
                        if (rejectedKey && (rejectedProposalCalls.get(rejectedKey) ?? 0) >= 2)
                            throw new Error('PROPOSAL_REPEATED_INVALID_STAGE');
                        const result = name === 'proposal_status' ?
                            (args && typeof args === 'object' && !Array.isArray(args) &&
                                Object.keys(args).length === 0 ?
                                await proposalController.status() : (() => { throw new Error('PROPOSAL_STATUS_ARGUMENTS'); })()) :
                            name === 'proposal_stage_document' ? await proposalController.stageModel(
                                documentModelStage(args, documentationPages, revisionProposal), 'document', toolCallId) :
                            name === 'proposal_stage_prompt' ? await proposalController.stageModel(
                                promptModelStage(args), 'prompt', toolCallId) :
                            name === 'proposal_finish' ? await proposalController.finish(args) :
                            (() => { throw new Error('PROPOSAL_TOOL_UNKNOWN'); })();
                        if (docsReview && name === 'proposal_finish')
                            finishedDocument = result as ProposalHandoff<import('@dope/chat').ChatDocumentationProposal>;
                        if (promptStage?.stage === 'prompt-write' && name === 'proposal_finish')
                            finishedPrompt = result as ProposalHandoff<ChatPromptStackProposal>;
                        if (name !== 'proposal_status') {
                            const projection = await proposalController.progress();
                            if (name === 'proposal_finish') projection.reviewDigest =
                                ((finishedDocument ?? finishedPrompt)!.candidate as { digest: string }).digest;
                            await this.repository.recordProposalProgress(root, key, assistant!.id,
                                request.leaseToken, projection).catch(() => undefined);
                        }
                        status = 'completed';
                        return JSON.stringify(name === 'proposal_finish' && (docsReview || promptStage?.stage === 'prompt-write') ?
                            { proposalId: (finishedDocument ?? finishedPrompt)!.proposalId,
                                revision: (finishedDocument ?? finishedPrompt)!.revision,
                                state: 'ready-for-review' } : result);
                    } catch (error) {
                        status = 'failed';
                        if (rejectedKey) rejectedProposalCalls.set(rejectedKey,
                            (rejectedProposalCalls.get(rejectedKey) ?? 0) + 1);
                        if (name === 'proposal_finish' || name === 'proposal_stage_document' ||
                            name === 'proposal_stage_prompt') {
                            const diagnostic = error instanceof Error && error.message.startsWith('PROPOSAL_') ?
                                error.message : 'Proposal stage failed validation';
                            await proposalController?.progress(diagnostic).then(progress =>
                                this.repository.recordProposalProgress(root, key, assistant!.id,
                                    request.leaseToken, progress)).catch(() => undefined);
                        }
                        return JSON.stringify(proposalToolError(error));
                    } finally {
                        recordActivity('tool', `${proposalName}: ${status}${stageTarget ? ` · ${stageTarget}` : ''}`);
                        toolEvents.push({ name: proposalName, status, truncated: false,
                            brokerExecuted: status === 'completed', stage: 'broker' });
                    }
                }
                if (name.startsWith('roadmap_')) {
                    if (!['roadmap_read', 'roadmap_stage', 'roadmap_cancel'].includes(name))
                        throw new Error('ROADMAP_TOOL_UNKNOWN');
                    const roadmapName = name as 'roadmap_read' | 'roadmap_stage' | 'roadmap_cancel';
                    recordActivity('tool', `${roadmapName}: running`);
                    let roadmapStatus: 'completed' | 'failed' | 'denied' = 'denied';
                    let brokerExecuted = false;
                    try {
                    if (toolEvents.length >= 127) throw new Error('ROADMAP_TOOL_LIMIT');
                    const output = await (async (): Promise<string> => {
                    if (!nativeRoadmap || !this.nativeStages || !this.roadmapStore || signal?.aborted ||
                        abort.signal.aborted || this.active(request.projectHandle) !== root ||
                        this.turns.get(key)?.abort !== abort ||
                        this.leases.get(key)?.token !== request.leaseToken)
                        throw new Error('ROADMAP_TOOL_AUTHORITY');
                    const selected = (await this.models!.list()).connections.find(item => item.id === connection.id);
                    if (!selected?.ready || selected.providerId !== 'local' ||
                        JSON.stringify(selected) !== JSON.stringify(connection) ||
                        !selected.models.some(item => item.id === model.id && item.usable))
                        throw new Error('ROADMAP_MODEL_CHANGED');
                    const current = await this.roadmapStore.read<RoadmapGateIndex>(root);
                    if (name === 'roadmap_stage') {
                        if (!args || typeof args !== 'object' || Array.isArray(args) ||
                            Object.keys(args).some(field => !['version', 'expectedStage', 'strategy', 'done', 'actions'].includes(field)))
                            return JSON.stringify({ version: 1, acceptedOperationIds: [],
                                error: 'ROADMAP_STAGE_ARGUMENTS: unexpected model-facing field' });
                        if (!stagingBasis) return JSON.stringify({ version: 1, acceptedOperationIds: [],
                            error: 'ROADMAP_STAGE_READ_REQUIRED: call roadmap_read before staging' });
                        if (Date.now() >= stagingBasis.expiresAt)
                            return JSON.stringify({ version: 1, acceptedOperationIds: [],
                                error: 'ROADMAP_STAGE_BASIS_EXPIRED: start a fresh authorized turn' });
                        if (stagingBasis.root !== root || stagingBasis.projectId !== current.projectId ||
                            stagingBasis.ownerId !== current.projectId || stagingBasis.chatId !== key ||
                            stagingBasis.turnId !== assistant!.id || stagingBasis.lease !== request.leaseToken)
                            return JSON.stringify({ version: 1, acceptedOperationIds: [],
                                error: 'ROADMAP_STAGE_BASIS_CHANGED: project, Chat or turn changed' });
                        if (stagingBasis.revision !== current.revision)
                            return JSON.stringify({ version: 1, acceptedOperationIds: [],
                                error: 'ROADMAP_STAGE_STALE_REVISION: start a fresh authorized turn' });
                        if (stagingBasis.sourceHash !== (current.linkedDocument?.sourceHash ?? null) ||
                            stagingBasis.linkState !== (current.linkedDocument?.syncState ?? null))
                            return JSON.stringify({ version: 1, acceptedOperationIds: [],
                                error: 'ROADMAP_STAGE_STALE_SOURCE: linked Roadmap changed' });
                    }
                    const selectedRef = composed.refs.find(ref => ref.kind === 'roadmap');
                    if (!selectedRef || selectedRef.projectId !== current.projectId ||
                        selectedRef.ownerRevision !== current.revision ||
                        selectedRef.sourceHash !== current.linkedDocument?.sourceHash)
                        throw new Error('ROADMAP_SELECTION_CHANGED');
                    const context = { root, projectId: current.projectId, chatId: key,
                        turnId: assistant!.id, lease: request.leaseToken };
                    let result: unknown;
                    try {
                        await this.repository.renew(root, key, request.leaseToken);
                        brokerExecuted = true;
                        result = name === 'roadmap_read' ? await this.nativeStages.read(context, args) :
                        name === 'roadmap_stage' ? await this.nativeStages.stage(context, {
                            ...(args as object), expectedRevision: stagingBasis!.revision,
                            expectedSourceHash: stagingBasis!.sourceHash }) :
                        name === 'roadmap_cancel' ? await this.nativeStages.cancel(context, args) :
                        (() => { throw new Error('ROADMAP_TOOL_UNKNOWN'); })(); }
                    catch (error) {
                        const code = error instanceof Error && error.message === 'Chat lease lost' ?
                            'ROADMAP_STAGE_LEASE_LOST' : error instanceof Error && error.message.startsWith('ROADMAP_') ?
                            error.message.slice(0, 500) : 'ROADMAP_TOOL_FAILED';
                        if (/^ROADMAP_(?:STAGE_STALE|STAGE_LEASE_LOST|STAGE_STALE_SOURCE|OWNER_CHANGED|SOURCE_CHANGED|SOURCE_NOT_SYNCED)/u.test(code) &&
                            this.nativeStages.get(key)) try {
                            this.client.notifyChatEvent({ projectHandle: request.projectHandle,
                                kind: 'roadmap-stage', chatId: key, messageId: assistant!.id,
                                snapshot: null, reason: 'stale' });
                        } catch { /* A disconnected observer cannot change source validation. */ }
                        return JSON.stringify({ version: 1, acceptedOperationIds: [], error: code });
                    }
                    if (signal?.aborted || abort.signal.aborted || this.active(request.projectHandle) !== root)
                        throw new Error('ROADMAP_TOOL_CANCELLED');
                    if (name === 'roadmap_read' && !stagingBasis) {
                        const read = result as { projectId: string; revision: number;
                            stageBasis: { expectedRevision: number; expectedSourceHash: string | null };
                            link: { syncState: string } | null };
                        if (read.projectId !== current.projectId || read.revision !== current.revision ||
                            read.stageBasis.expectedRevision !== read.revision)
                            throw new Error('ROADMAP_STAGE_BASIS_CHANGED');
                        stagingBasis = { root, projectId: read.projectId, ownerId: current.projectId,
                            chatId: key, turnId: assistant!.id, lease: request.leaseToken,
                            revision: read.revision, sourceHash: read.stageBasis.expectedSourceHash,
                            linkState: read.link?.syncState ?? null, expiresAt: Date.now() + 30 * 60_000 };
                    }
                    if (name === 'roadmap_stage') {
                        const snapshot = await this.nativeStages.snapshot(context);
                        if (!snapshot || this.turns.get(key)?.abort !== abort ||
                            this.leases.get(key)?.token !== request.leaseToken ||
                            signal?.aborted || abort.signal.aborted ||
                            this.active(request.projectHandle) !== root)
                            throw new Error('ROADMAP_STAGE_STALE');
                        try { this.client.notifyChatEvent({ projectHandle: request.projectHandle,
                            kind: 'roadmap-stage', chatId: key, messageId: assistant!.id, snapshot }); }
                        catch { /* Transient observer delivery cannot control stage acceptance. */ }
                    } else if (name === 'roadmap_cancel' && (result as { cancelled?: boolean }).cancelled) {
                        stagingBasis = undefined;
                        try { this.client.notifyChatEvent({ projectHandle: request.projectHandle,
                            kind: 'roadmap-stage', chatId: key, messageId: assistant!.id,
                            snapshot: null, reason: 'cancelled' }); }
                        catch { /* A disconnected observer cannot change cancellation. */ }
                    }
                    return JSON.stringify(result);
                    })();
                    roadmapStatus = typeof (JSON.parse(output) as { error?: unknown }).error === 'string' ?
                        'failed' : 'completed';
                    return output;
                    } finally {
                        recordActivity('tool', `${roadmapName}: ${roadmapStatus}`);
                        toolEvents.push({ name: roadmapName, status: roadmapStatus, truncated: false,
                            brokerExecuted, stage: brokerExecuted ? 'broker' : 'authority' });
                    }
                }
                if (nativeRoadmap) throw new Error('ROADMAP_TOOL_DENIED');
                if ((docsReview || promptStage) && name === 'run_command') {
                    toolEvents.push({ name, status: 'denied', truncated: false, brokerExecuted: false,
                        code: 'COMMAND_DENIED', stage: 'authority', approval: 'denied' });
                    recordActivity('tool', 'run_command: denied');
                    return 'Command denied: this protected authoring turn permits brokered reads only';
                }
                const toolName = name as NonNullable<ChatAssistantMessage['execution']['toolEvents']>[number]['name'];
                const field = name === 'run_command' ? 'command' :
                    name === 'read_file' || name === 'list_files' ? 'path' : 'query';
                const detailValue = args && typeof args === 'object' && !Array.isArray(args) ?
                    (args as Record<string, unknown>)[field] : undefined;
                const detail = typeof detailValue === 'string' && Buffer.byteLength(detailValue, 'utf8') <= 2048 &&
                    !/[\x00-\x08\x0b-\x1f\x7f]/u.test(detailValue) ?
                    `${name}(${JSON.stringify({ [field]: detailValue })})` : undefined;
                const target = detail && typeof detailValue === 'string' ?
                    detailValue.replace(/\s+/gu, ' ').trim().slice(0, 160) : undefined;
                const activityPath = name === 'read_file' || name === 'list_files' ?
                    safeChatToolPath(detailValue) : undefined;
                const notify = (status: 'running' | 'completed' | 'failed' | 'denied', truncated?: boolean) => {
                    if (['read_file', 'list_files', 'search_paths', 'search_text', 'run_command'].includes(name))
                        recordActivity('tool', `${name}: ${status}${activityPath ? ` · ${activityPath}` : ''}`);
                    if (!this.handle || !assistant || !['read_file', 'list_files', 'search_paths',
                        'search_text', 'run_command'].includes(name)) return;
                    try { this.client.notifyChatEvent({ projectHandle: this.handle, kind: 'tool-progress',
                        chatId: key, messageId: assistant.id, name: toolName, status, truncated, detail, target }); }
                    catch { /* Transient progress never controls tool authority. */ }
                };
                const count = toolEvents.length;
                notify('running');
                try { return await (async () => {
                if (signal?.aborted || this.active(request.projectHandle) !== root ||
                    this.turns.get(key)?.abort !== abort) throw new Error('Project discovery cancelled');
                if (toolEvents.length >= (protectedProposal ? 512 : 16))
                    throw new Error('Project discovery limit reached');
                if (name === 'run_command') {
                    const record = args as Record<string, unknown>;
                    const commandMode = this.commandModes.get(key) === 'allow' ? 'allow' : 'ask';
                    const commandDigest = typeof record?.command === 'string' ?
                        createHash('sha256').update(record.command).digest('hex') : undefined;
                    const commandMeta = { commandMode, ...(commandDigest ? { commandDigest } : {}),
                        brokerExecuted: false, commandExecuted: false } as const;
                    if (forbidsCommandExecution(content)) {
                        toolEvents.push({ name, status: 'denied', truncated: false, ...commandMeta,
                            code: 'COMMAND_DENIED', stage: 'authority', approval: 'denied' });
                        return 'Command denied: the developer prohibited command execution in this turn';
                    }
                    if (!record || typeof record !== 'object' || Array.isArray(record) ||
                        Object.keys(record).length !== 1 || typeof record.command !== 'string') {
                        toolEvents.push({ name, status: 'denied', truncated: false, ...commandMeta,
                            code: 'COMMAND_INVALID', stage: 'argument-validation', approval: 'denied' });
                        return 'Command denied: invalid request';
                    }
                    if (toolBytes >= 32 * 1024) {
                        toolEvents.push({ name, status: 'denied', truncated: false, ...commandMeta,
                            code: 'OUTPUT_BUDGET', stage: 'output-budget', approval: 'denied' });
                        return 'Command denied: Chat tool output limit reached';
                    }
                    // The repository canonicalizes context references before saving the user turn.
                    // Bind approval to those canonical bytes, not the composer's field order.
                    const basis = createHash('sha256').update(JSON.stringify(preview.refs.map(parseChatContextRef))).digest('hex');
                    let approved: 'granted' | 'denied' | 'expired';
                    try { approved = await this.requestCommand(root, request, record.command, abort, basis); }
                    catch {
                        toolEvents.push({ name, status: 'denied', truncated: false, ...commandMeta,
                            code: 'COMMAND_INVALID', stage: 'argument-validation', approval: 'denied' });
                        return 'Command denied: invalid or unavailable request; no execution occurred';
                    }
                    if (approved !== 'granted') {
                        toolEvents.push({ name, status: 'denied', truncated: false, ...commandMeta,
                            code: approved === 'expired' ? 'COMMAND_EXPIRED' : 'COMMAND_DENIED',
                            stage: 'authority', approval: approved });
                        return 'Command denied or expired; no execution occurred';
                    }
                    if (signal?.aborted || abort.signal.aborted || this.disposed ||
                        this.active(request.projectHandle) !== root ||
                        this.turns.get(key)?.abort !== abort ||
                        this.leases.get(key)?.token !== request.leaseToken) {
                        toolEvents.push({ name, status: 'denied', truncated: false, ...commandMeta,
                            code: 'AUTHORITY_DENIED', stage: 'authority', approval: 'granted' });
                        return 'Command denied: Chat turn or project is no longer active';
                    }
                    const currentChat = (await this.repository.read(root).catch(() => undefined))?.chats
                        .find(item => item.id === key);
                    const currentUser = currentChat?.messages.filter(item => item.role === 'user').at(-1);
                    if (!currentUser || createHash('sha256').update(JSON.stringify(currentUser.contextRefs)).digest('hex') !==
                        basis) {
                        toolEvents.push({ name, status: 'denied', truncated: false, ...commandMeta,
                            code: 'AUTHORITY_DENIED', stage: 'authority', approval: 'granted' });
                        return 'Command denied: Chat source basis changed';
                    }
                    const commandSignal = signal ? AbortSignal.any([signal, abort.signal]) : abort.signal;
                    const result = await runChatInvestigationCommand(root, record.command, commandSignal);
                    const output = Buffer.from(result.output, 'utf8');
                    const remaining = 32 * 1024 - toolBytes;
                    const truncated = result.truncated || output.length > remaining;
                    const bounded = output.subarray(0, remaining).toString('utf8');
                    toolBytes += Buffer.byteLength(bounded);
                    toolEvents.push({ name, status: !result.executed ? 'denied' : result.succeeded ? 'completed' : 'failed',
                        truncated, ...commandMeta, brokerExecuted: true, commandExecuted: result.executed,
                        approval: 'granted', ...(!result.executed ? { code: 'AUTHORITY_DENIED', stage: 'broker' } : {}) });
                    return bounded;
                }
                const allowed = ['read_file', 'list_files', 'search_paths', 'search_text'] as const;
                if (!allowed.includes(name as typeof allowed[number]) || !args || typeof args !== 'object' ||
                    Array.isArray(args)) throw new Error('Project discovery tool denied');
                const field = name === 'read_file' || name === 'list_files' ? 'path' : 'query';
                const record = args as Record<string, unknown>;
                const keys = Object.keys(record);
                const rangeRead = name === 'read_file' && keys.some(key => key !== 'path');
                if (typeof record[field] !== 'string' || (rangeRead ?
                    keys.some(key => !['path', 'offset', 'maxBytes', 'expectedSourceHash'].includes(key)) :
                    keys.length !== 1)) {
                    if (name === 'read_file') {
                        toolEvents.push({ name, status: 'failed', truncated: false, code: 'INVALID_ARGUMENTS',
                            stage: 'argument-validation', brokerExecuted: false });
                        return 'INVALID_ARGUMENTS: Use a relative path and optional offset, maxBytes and expectedSourceHash.';
                    }
                    throw new Error('Project discovery arguments denied');
                }
                const toolName = name as typeof allowed[number];
                const rangeMeta = { ...(record.offset === undefined ? { offset: 0 } :
                    Number.isSafeInteger(record.offset) && (record.offset as number) >= 0 ?
                        { offset: record.offset as number } : {}),
                    ...(record.maxBytes === undefined ? { pageSize: 4096 } :
                        Number.isSafeInteger(record.maxBytes) && (record.maxBytes as number) >= 0 ?
                            { pageSize: record.maxBytes as number } : {}),
                    sourceHashSupplied: record.expectedSourceHash !== undefined };
                try {
                    if (rangeRead) {
                        const invalid = !Number.isSafeInteger(record.offset ?? 0) || (record.offset as number ?? 0) < 0 ?
                            ['INVALID_OFFSET', 'Use a nonnegative UTF-8 byte offset.'] :
                            !Number.isSafeInteger(record.maxBytes ?? 4096) || (record.maxBytes as number ?? 4096) < 1 ||
                            (record.maxBytes as number ?? 4096) > 4096 ?
                            ['INVALID_PAGE_SIZE', 'Use a page size from 1 to 4096 bytes.'] :
                            record.expectedSourceHash !== undefined &&
                            (typeof record.expectedSourceHash !== 'string' ||
                            !/^[a-f0-9]{64}$/u.test(record.expectedSourceHash)) ?
                            ['INVALID_SOURCE_IDENTITY', 'Use the sourceHash returned by the first page.'] :
                            (record.offset as number ?? 0) > 0 && !record.expectedSourceHash &&
                            !(docsReview && documentationHashes.has(record.path as string)) ?
                            ['SOURCE_IDENTITY_REQUIRED', 'Start with offset 0 to obtain sourceHash, then retry the later range.'] : undefined;
                        if (invalid) {
                            toolEvents.push({ name: toolName, status: 'failed', truncated: false,
                                code: invalid[0] as 'INVALID_OFFSET', stage: 'argument-validation',
                                brokerExecuted: false, ...rangeMeta });
                            return `${invalid[0]}: ${invalid[1]}`;
                        }
                        const remaining = 32 * 1024 - toolBytes;
                        if (remaining < 8200) throw new Error('Project discovery output limit reached');
                        const page = await this.grounder!.readFileRange(root, record.path as string,
                            record.offset === undefined ? 0 : record.offset as number,
                            record.maxBytes === undefined ? 4096 : record.maxBytes as number,
                            (record.expectedSourceHash as string | undefined) ??
                                (docsReview ? documentationHashes.get(record.path as string) : undefined));
                        if (signal?.aborted || this.active(request.projectHandle) !== root)
                            throw new Error('Project discovery cancelled');
                        const payload = JSON.stringify(page);
                        const payloadBytes = Buffer.byteLength(payload, 'utf8');
                        if (payloadBytes > 8000 || payloadBytes > remaining) throw new Error('Project discovery output limit reached');
                        toolBytes += payloadBytes;
                        if (docsReview) {
                            documentationHashes.set(page.path, page.sourceHash);
                            documentationPages.push(page);
                        }
                        sourceRefs.push({ schemaVersion: 1, kind: 'file', id: page.path, label: page.path,
                            origin: 'tool', projectId: createHash('sha256').update(root).digest('hex'),
                            includedBytes: Buffer.byteLength(page.text, 'utf8'),
                            estimatedTokens: Math.ceil(Buffer.byteLength(page.text, 'utf8') / 3) + 4,
                            contentHash: createHash('sha256').update(page.text).digest('hex'),
                            sourceHash: page.sourceHash });
                        toolEvents.push({ name: toolName, status: 'completed', truncated: page.truncated,
                            stage: 'broker', brokerExecuted: true, ...rangeMeta, endOffset: page.endOffset });
                        return payload;
                    }
                    const result = name === 'read_file' ? await this.grounder!.readFile(root, record.path as string) :
                        name === 'list_files' ? await this.grounder!.listDirectory(root, record.path as string) :
                        name === 'search_paths' ? await this.grounder!.searchPaths(root, record.query as string) :
                        await this.grounder!.searchText(root, record.query as string);
                    if (signal?.aborted || this.active(request.projectHandle) !== root) throw new Error('Project discovery cancelled');
                    const block = result.blocks[0];
                    const remaining = Math.max(0, Math.min(8192, 32 * 1024 - toolBytes));
                    if (!block || !remaining) throw new Error('Project discovery output limit reached');
                    const excerpt = Buffer.from(block.text, 'utf8').subarray(0, remaining).toString('utf8').replace(/\uFFFD+$/, '');
                    const truncated = excerpt !== block.text || result.diagnostics.some(item =>
                        item.kind === 'truncated' || item.kind === 'omitted');
                    toolBytes += Buffer.byteLength(excerpt);
                    sourceRefs.push({ ...block.ref, origin: 'tool', includedBytes: Buffer.byteLength(excerpt),
                        estimatedTokens: Math.ceil(Buffer.byteLength(excerpt) / 3) + 4,
                        contentHash: createHash('sha256').update(excerpt).digest('hex') });
                    toolEvents.push({ name: toolName, status: 'completed', truncated,
                        stage: 'broker', brokerExecuted: true });
                    const payload = JSON.stringify({ source: block.ref.id, kind: block.ref.kind,
                        contentHash: sourceRefs.at(-1)!.contentHash, sourceHash: block.ref.sourceHash, truncated,
                        omitted: result.diagnostics.some(item => item.kind === 'omitted'), text: excerpt });
                    return payload;
                } catch (error) {
                    const message = error instanceof Error ? error.message : '';
                    const code = message === 'Project discovery output limit reached' ||
                        message === 'File page cannot fit output budget' ? 'OUTPUT_BUDGET' :
                        message === 'Stale file continuation' || message === 'Project file changed during read' ?
                        'STALE_SOURCE' : message === 'Invalid file range' ||
                        message === 'Offset splits UTF-8 character' ? 'INVALID_OFFSET' : undefined;
                    if (rangeRead && code) {
                        toolEvents.push({ name: toolName, status: 'failed', truncated: false, code,
                            stage: code === 'OUTPUT_BUDGET' ? 'output-budget' :
                                code === 'STALE_SOURCE' ? 'source-identity' : 'argument-validation',
                            brokerExecuted: code !== 'OUTPUT_BUDGET', ...rangeMeta });
                        return code === 'STALE_SOURCE' ? 'STALE_SOURCE: Reread from offset 0 to obtain a fresh sourceHash.' :
                            code === 'OUTPUT_BUDGET' ? 'OUTPUT_BUDGET: Use a smaller page or finish with available evidence.' :
                            'INVALID_OFFSET: Use an offset within the file at a UTF-8 boundary.';
                    }
                    toolEvents.push({ name: toolName, status: 'denied', truncated: false,
                        code: 'AUTHORITY_DENIED', stage: 'authority', brokerExecuted: true });
                    throw new Error('Project discovery denied or unavailable');
                }
                })(); } finally {
                    const result = toolEvents.length > count ? toolEvents.at(-1) : undefined;
                    notify(result?.status ?? 'denied', result?.truncated);
                }
            } } : undefined;
        try {
            if (this.pendingCancel.get(key) === request.leaseToken) abort.abort();
            if (!request.retryMessageId) {
                if (!request.content?.trim()) throw new Error('Enter a message before sending');
                const user: ChatUserMessage = { schemaVersion: 1, id: userMessageId, role: 'user',
                    createdAt: new Date().toISOString(), content: request.content.trim(), contextRefs: preview.refs,
                    ...(skill ? { skill } : {}) };
                await mutate({ type: 'append-user', chatId: key, message: user });
            }
            const now = new Date().toISOString();
            assistant = { schemaVersion: 1, id: randomUUID(), role: 'assistant', createdAt: now, content: '',
                execution: { schemaVersion: 1, id: randomUUID(), status: 'pending',
                    outputLimitPolicy: chat.settings.outputLimitPolicy,
                    selectedModel: { ...selectedModel }, resolutionSource: following ? 'role-policy' :
                        request.selectedModel ? 'explicit-turn' : 'chat-exact-default',
                    startedAt: now } };
            activity = new ChatActivityRecorder(key, assistant.id, assistant.execution.id);
            await mutate({ type: 'begin-assistant', chatId: key, message: assistant });
            if (protectedProposal) {
                const stageBasis = async () => {
                    if (docsReview) {
                        const roadmap = await this.roadmapStore!.read<RoadmapGateIndex>(root);
                        return { worktreeId: createHash('sha256').update(root).digest('hex'),
                            sourceBasis: JSON.stringify({ projectId: roadmap.projectId, revision: roadmap.revision,
                                sourceHash: roadmap.linkedDocument?.sourceHash ?? null,
                                syncState: roadmap.linkedDocument?.syncState ?? null }) };
                    }
                    const git = await capturePromptSourceEvidence(root);
                    return { worktreeId: git.worktreeFingerprint,
                        sourceBasis: `${git.head}:${git.packageVersion}:${git.worktreeFingerprint}` };
                };
                const basis = await stageBasis();
                const proposalOwnerId = this.leases.get(key)!.ownerId;
                const authority = async () => {
                    if (this.active(request.projectHandle) !== root || this.turns.get(key)?.abort !== abort ||
                        abort.signal.aborted || this.leases.get(key)?.token !== request.leaseToken ||
                        this.leases.get(key)?.ownerId !== proposalOwnerId)
                        throw new Error('PROPOSAL_TOOL_AUTHORITY');
                    return stageBasis();
                };
                proposalController = new IncrementalProposalController<import('@dope/chat').ChatDocumentationProposal |
                    ChatPromptStackProposal>(this.repository,
                    { root, chatId: key, messageId: assistant.id, leaseToken: request.leaseToken,
                        ownerId: proposalOwnerId, worktreeId: basis.worktreeId,
                        sourceBasis: basis.sourceBasis,
                        domain: docsReview ? 'document' : 'prompt' }, authority, docsReview ?
                        new IncrementalDocumentReview(this.roadmapStore!, { root, chatId: key,
                            messageId: assistant.id, ownerId: proposalOwnerId, leaseToken: request.leaseToken,
                            objective: content, reviewIntent: reviewObjective, discovery: discovery!, pages: documentationPages,
                            readPaths: () => documentationPages.map(page => page.path),
                            ...(revisionProposal ? { prior: revisionProposal } : {}) }) :
                        new IncrementalPromptStack(root, promptStage!.folder!, promptSourceVersion!,
                            { assessment: priorAssessment!.assistant, plan: priorPlan!.assistant },
                            this.grounder!, selectedPrompt ? selectedPrompt.proposal.revision + 1 : 1,
                            promptSourceBasis!, promptRequestedCount));
                await proposalController.begin();
                await this.repository.recordProposalProgress(root, key, assistant.id,
                    request.leaseToken, await proposalController.progress());
            }
            if (localRoadmap) tracePlanning('submitted', key, assistant.id);
            if (localRoadmap) this.planningProgress(key, assistant.id, 'waiting');
            if (!following) {
                await mutate({ type: 'start-assistant', chatId: key, messageId: assistant.id, actualModel: actual });
            }
            let sequence = 0;
            const withRetryInstruction = (messages: readonly ConversationMessage[], instruction?: string): readonly ConversationMessage[] => {
                let retry = instruction;
                const sent = retry ? [{ role: 'system' as const, content: retry }, ...messages] : messages;
                if (localRoadmap) verifyRoadmapLocalInput(sent, budget!);
                return sent;
            };
            const generate = (retryInstruction?: string) => following ? this.routing!.generate({ roleId: 'interactive',
                requestHard: localRoadmap ? { ...requestHard, locality: 'local-only' as const } : requestHard,
                hostedProjectDataAuthorized: !localRoadmap && request.hostedProjectDataAuthorized === true,
                allowFallback: !roadmapTurn,
                localOnly: localRoadmap,
                signal: abort.signal,
                conversation: async target => {
                    const resolvedConnection = (await this.models!.list()).connections.find(item => item.id === target.connectionId);
                    if (connection.providerId === 'local' && resolvedConnection?.providerId !== 'local')
                        throw new ModelRuntimeFailure('Pi Chat cannot switch providers within a turn; choose a model explicitly',
                            'unsupported-capability');
                    const resolvedModel = resolvedConnection?.models.find(item => item.id === target.modelId && item.usable);
                    if (!resolvedModel) throw new ModelRuntimeFailure('Role target unavailable', 'model-unavailable');
                    for (const [id, value] of Object.entries(controls))
                        if (!resolvedModel.capabilities.reasoningControls?.some(control => control.id === id && control.values.includes(value)))
                            throw new ModelRuntimeFailure('Role target does not support the saved reasoning control', 'unsupported-capability');
                    const nextBudget = localRoadmap ? roadmapLocalBudget(resolvedModel.capabilities.contextWindowTokens,
                        planningOutput, resolvedModel.capabilities) : undefined;
                    if (nextBudget && (nextBudget.total !== budget?.total ||
                        nextBudget.inputBytes !== budget.inputBytes || nextBudget.output !== budget.output))
                        throw new ModelRuntimeFailure('Loaded local context or limits changed; preview this turn again',
                            'unsupported-capability');
                    const next = await this.composeTurn(root, contextChat, content, selections,
                        resolvedModel.capabilities, nextBudget, turnPrompt,
                        resolvedConnection?.providerId === 'local' ? undefined :
                            grounding ?? await this.grounder?.ground(root, content),
                        !!bridge, opportunity, resolvedConnection?.providerId === 'local', roadmapSkill,
                        roadmapPromptMode, ordinaryChat, !!skill || roadmapTurn);
                    if (bridge) next.refs.push(bridge.reference);
                    if (!sameRefIdentities(next.refs, preview.refs))
                        throw new Error('Fallback evidence differs; choose a model explicitly');
                    if (JSON.stringify(next.refs) !== JSON.stringify(preview.refs)) {
                        await mutate({ type: 'revise-user-context', chatId: key, userMessageId,
                            assistantMessageId: assistant!.id, contextRefs: next.refs });
                    }
                    preview = { refs: next.refs, diagnostics: next.diagnostics,
                        usedTokens: next.usedTokens, budgetTokens: next.budgetTokens };
                    return { messages: withRetryInstruction(this.withDraft(next.messages, turnPrompt), retryInstruction), controls, signal: abort.signal,
                        ...(resolvedConnection?.providerId === 'local' && projectTools ? { projectTools } : {}),
                        ...(planningOutput > 0 ?
                        { maxOutputTokens: nextBudget?.output ?? planningOutput } : {}) };
                } }) : this.models!.generate(selectedModel!,
                { messages: withRetryInstruction(this.withDraft(composed.messages, turnPrompt), retryInstruction), controls, signal: abort.signal,
                    ...(connection.providerId === 'local' && projectTools ? { projectTools } : {}),
                    ...(planningOutput > 0 ?
                        { maxOutputTokens: budget?.output ?? planningOutput } : {}) },
                localRoadmap ? { localOnly: true } : undefined);
            // The current protected command is already a complete typed intent. No model output
            // can add authority or improve the owner-issued publication preview.
            let events: AsyncIterable<ConversationEvent> = publicationIntent ? (async function* (): AsyncGenerator<ConversationEvent> {
                yield { type: 'complete', text: 'Roadmap Markdown request received.',
                    usage: { tokenMeasurement: 'unavailable' }, finishReason: 'deterministic-intent' };
            })() : nativeRoadmap ? generate() : localRoadmap ? (async function* (backend: ChatBackend) {
                const guardedGenerate = async function* (retryInstruction?: string) {
                    if (!following) await backend.verifyLoadedCapacity(selectedModel!, budget!, planningOutput);
                    for await (const event of generate(retryInstruction))
                        if (event.type !== 'reset') yield event;
                };
                const requestedRevision = !draft && requestsRoadmapOwnerRevision(content) ?
                    preview.refs.find(ref => ref.kind === 'roadmap-checkpoint')?.ownerRevision : undefined;
                const complete = await localPlanningJson(guardedGenerate, abort.signal, budget!.maxOutputBytes,
                    localMode, eligibleObjective, { requiredOwnerRevision: requestedRevision,
                        maxSteps: request.planningSteps,
                        allowPlainNoAction: localMode === 'gate' &&
                            (!roadmapSkill || allowsPlainGateAnswer(content)),
                        validateBridge: bridge ? value => bridge.validate(value) : undefined,
                        onActivity: recordActivity,
                        onRetry: cause => tracePlanning('retry', key, assistant!.id, cause) });
                await backend.verifyLoadedCapacity(selectedModel!, budget!, planningOutput);
                tracePlanning('validated', key, assistant!.id);
                yield complete;
            })(this) : generate();
            let partialText = '';
            let cumulativeOutputTokens = 0;
            while (true) {
                let resumedEvents: AsyncIterable<ConversationEvent> | undefined;
                for await (const event of events) {
                    if (event.type === 'paused') {
                        liveContinuation = event.continuation;
                        if (docsReview) throw new ModelRuntimeFailure(
                            'Documentation review reached the generation limit before validation', 'incomplete-answer');
                        if (abort.signal.aborted) throw new ModelRuntimeFailure('Conversation cancelled', 'cancelled');
                        if (following) {
                            const route = (event as Extract<RoutedConversationEvent, { type: 'paused' }>).routingProvenance;
                            if (!route) throw new ModelRuntimeFailure('Chat continuation has no routing provenance', 'incomplete-answer');
                            const routed = { schemaVersion: 1 as const, connectionId: route.actualTarget.connectionId,
                                modelId: route.actualTarget.modelId, providerId: route.executionLabels.provider,
                                modelLabel: route.executionLabels.model };
                            if (sequence === 0) {
                                await mutate({ type: 'start-assistant', chatId: key, messageId: assistant!.id,
                                    actualModel: routed, routingProvenance: route });
                                actual = routed;
                                routingProvenance = route;
                            } else if (actual.connectionId !== routed.connectionId || actual.modelId !== routed.modelId)
                                throw new ModelRuntimeFailure('Chat continuation changed routed model', 'incomplete-answer');
                        }
                        if (event.segmentIndex !== partialSegments + 1 || !event.text.startsWith(partialText) ||
                            event.novelText !== event.text.slice(partialText.length) ||
                            event.actualModelId !== actual.modelId ||
                            !this.turns.has(key) || this.leases.get(key)?.token !== request.leaseToken)
                            throw new ModelRuntimeFailure('Chat continuation identity changed', 'incomplete-answer');
                        if (!following && !routingProvenance) routingProvenance = exactRoutingProvenance(
                            request.selectedModel ? 'explicit-turn' : 'chat-exact-default',
                            { connectionId: actual.connectionId, modelId: actual.modelId }, requestHard,
                            { connection: connection.label ?? connection.id, provider: actual.providerId,
                                model: actual.modelLabel });
                        await this.repository.renew(root, key, request.leaseToken);
                        const novel = event.novelText;
                        if (retainStreamedAnswer) await persistOutputPartial(event.text);
                        else if (novel) {
                            await mutate({ type: 'append-answer-partial', chatId: key, messageId: assistant!.id,
                                executionId: assistant!.execution.id, segment: event.segmentIndex,
                                cursor: partialCursor, delta: novel });
                            partialCursor += Buffer.byteLength(novel, 'utf8');
                        }
                        persistedPartial = event.text;
                        partialText = event.text;
                        partialSegments = event.segmentIndex;
                        // Provider usage can be absent; the byte bound remains authoritative in that case.
                        cumulativeOutputTokens += event.segmentUsage.outputTokens ?? 0;
                        await flushActivity();
                        const automaticDecision = chat.settings.outputLimitPolicy === 'cancel' ? 'stop' :
                            chat.settings.outputLimitPolicy === 'allow' ?
                                // At most two automatic resumes (three segments), 8k reported tokens
                                // and 48 KiB of retained answer text within the repository's 64 KiB bound.
                                event.segmentIndex >= 3 || cumulativeOutputTokens >= 8192 || partialCursor >= 49_152 ?
                                    'stop' : 'continue' : undefined;
                        const decisionWait = automaticDecision ?? new Promise<'stop' | 'continue'>((resolve, reject) => {
                            let timer: ReturnType<typeof setTimeout>;
                            const cleanup = () => { clearTimeout(timer); abort.signal.removeEventListener('abort', onAbort); };
                            const settle = (choice: 'stop' | 'continue') => { cleanup(); resolve(choice); };
                            const pending = { root, leaseToken: request.leaseToken, messageId: assistant!.id,
                                executionId: assistant!.execution.id, segment: event.segmentIndex,
                                cursor: partialCursor, selectedModel: { ...selectedModel! },
                                actualModel: { ...actual }, resolve: settle };
                            const onAbort = () => { cleanup(); this.pendingOutputLimits.delete(key);
                                reject(new ModelRuntimeFailure('Conversation cancelled', 'cancelled')); };
                            if (abort.signal.aborted) { onAbort(); return; }
                            timer = setTimeout(() => { cleanup(); this.pendingOutputLimits.delete(key);
                                reject(new ModelRuntimeFailure('Local Pi continuation expired', 'connection-unavailable')); }, 120_000);
                            this.pendingOutputLimits.set(key, pending);
                            abort.signal.addEventListener('abort', onAbort, { once: true });
                        });
                        // Cancellation can arrive after the paused status is saved but before
                        // the wait below; observe that rejection immediately without consuming it.
                        if (typeof decisionWait !== 'string') void decisionWait.catch(() => undefined);
                        try {
                            await mutate({ type: 'pause-output-limit', chatId: key, messageId: assistant!.id,
                                executionId: assistant!.execution.id, segment: event.segmentIndex, cursor: partialCursor,
                                finishReason: 'length', outputCeilingTokens: event.outputCeilingTokens,
                                tokenUsage: event.usage, segmentUsage: event.segmentUsage, sourceRefs, toolEvents,
                            activity: activity?.snapshot(),
                                ...(routingProvenance ? { routingProvenance } : {}) });
                        } catch (error) {
                            const pending = this.pendingOutputLimits.get(key);
                            if (pending?.messageId === assistant!.id) { this.pendingOutputLimits.delete(key); pending.resolve('stop'); }
                            throw error;
                        }
                        const pending = this.pendingOutputLimits.get(key);
                        if (pending?.messageId === assistant!.id && !pending.sourceBasis)
                            pending.sourceBasis = this.outputLimitSourceBasis(
                                (await this.repository.read(root)).chats.find(chat => chat.id === key)?.messages ?? [], assistant!.id);
                        const decision = await decisionWait;
                        if (abort.signal.aborted) throw new ModelRuntimeFailure('Conversation cancelled', 'cancelled');
                        await this.repository.renew(root, key, request.leaseToken);
                        if (decision === 'stop') {
                            await event.continuation.stop();
                            await mutate({ type: 'stop-incomplete', chatId: key, messageId: assistant!.id,
                                executionId: assistant!.execution.id, cursor: partialCursor });
                        void this.repository.removeActivityLog(root, key, assistant!.id, assistant!.execution.id)
                            .catch(() => undefined);
                            return preview;
                        }
                        await mutate({ type: 'resume-output-limit', chatId: key, messageId: assistant!.id,
                            executionId: assistant!.execution.id, cursor: partialCursor });
                        resumedEvents = event.continuation.resume();
                        break;
                    }
                    if (event.type === 'stopped-incomplete')
                        throw new ModelRuntimeFailure('Local answer stopped incomplete', 'incomplete-answer');
                    if (event.type === 'activity') {
                        recordActivity(event.kind, event.text);
                        continue;
                    }
                    if (event.type === 'reset') {
                        output = '';
                        if (retainStreamedAnswer && partialCursor && !partialSegments) {
                            await mutate({ type: 'reset-answer-partial', chatId: key, messageId: assistant!.id,
                                executionId: assistant!.execution.id, cursor: partialCursor });
                            partialCursor = 0;
                            persistedPartial = '';
                        }
                        if (!protectedProposal) await this.repository.publishReset(root, key, assistant!.id,
                            assistant!.execution.id, sequence++, request.leaseToken);
                        else sequence++;
                        continue;
                    }
                    if (event.type === 'delta') {
                        if (following && sequence === 0) {
                            const routed = (event as Extract<RoutedConversationEvent, { type: 'delta' }>).target;
                            const usedConnection = (await this.models.list()).connections.find(item => item.id === routed.connectionId);
                            const usedModel = usedConnection?.models.find(item => item.id === routed.modelId);
                            actual = { schemaVersion: 1, ...routed, providerId: usedConnection?.providerId ?? connection.providerId,
                                modelLabel: usedModel?.label ?? model.label };
                            await mutate({ type: 'start-assistant', chatId: key, messageId: assistant.id, actualModel: actual });
                        }
                        output += event.text;
                        recordActivity('provisional', event.text);
                        if (!protectedProposal) await this.repository.publishDelta(root, key, assistant.id,
                            assistant.execution.id, sequence++, event.text, request.leaseToken);
                        else sequence++;
                        if (retainStreamedAnswer && output && (Buffer.byteLength(output, 'utf8') - partialCursor >= 1024 ||
                            Date.now() - lastPartialWrite >= 3000)) await persistOutputPartial(output);
                    } else {
                        if (protectedProposal && event.finishReason === 'stop' &&
                            !finishedDocument && !finishedPrompt) {
                            liveProposalTerminal = event.terminalContinuation;
                            const current = await proposalController!.status();
                            if (!proposalTerminalAttempted && current.finishPermitted &&
                                current.state === 'staging' && event.finishReason === 'stop' &&
                                event.terminalContinuation && !abort.signal.aborted &&
                                this.turns.get(key)?.abort === abort &&
                                this.leases.get(key)?.token === request.leaseToken) {
                                proposalTerminalAttempted = true;
                                recordActivity('provisional', 'Proposal completion: one same-session finish attempt.');
                                resumedEvents = event.terminalContinuation.continue();
                                break;
                            }
                            recordActivity('provisional', proposalTerminalAttempted ?
                                'proposal completion continuation: ended without proposal_finish' :
                                `proposal completion continuation: unavailable; ${current.nextAction}`);
                            throw new ModelRuntimeFailure(proposalTerminalAttempted ?
                                'Proposal remains incomplete: the model did not call proposal_finish after one continuation' :
                                `Proposal remains incomplete: ${current.nextAction}`, 'incomplete-answer');
                        }
                        if (proposalTerminalAttempted)
                            recordActivity('provisional', 'Proposal completion: proposal_finish validated.');
                        output = event.text;
                        if (partialSegments && !output.startsWith(partialText))
                            throw new ModelRuntimeFailure('Completed answer differs from saved continuation', 'incomplete-answer');
                        if (retainStreamedAnswer && persistedPartial && output.startsWith(persistedPartial))
                            await persistOutputPartial(output);
                        if (localMode === 'gate' && !roadmapSkill) {
                            try {
                                const value = JSON.parse(output) as { type?: string };
                                if (value.type === 'roadmap-gate-proposal' || value.type === 'roadmap-gate-undo')
                                    output = JSON.stringify({ type: 'no-action',
                                        message: 'No Roadmap change was made. Use /roadmap to prepare a reviewed change.' });
                            } catch { /* Ordinary read-only prose remains unchanged. */ }
                        }
                        if (localRoadmap) this.planningProgress(key, assistant.id, 'validating');
                        if (event.provenance) actual = { schemaVersion: 1, ...event.provenance };
                        else if (event.actualModelId) actual = { ...actual, modelId: event.actualModelId };
                        if (following && !publicationIntent) {
                            const route = (event as Extract<RoutedConversationEvent, { type: 'complete' }>).routingProvenance;
                            routingProvenance = route;
                            actual = { schemaVersion: 1, connectionId: route.actualTarget.connectionId,
                                modelId: route.actualTarget.modelId, providerId: route.executionLabels.provider,
                                modelLabel: route.executionLabels.model };
                            if (sequence === 0) await mutate({ type: 'start-assistant', chatId: key, messageId: assistant.id,
                                actualModel: actual, routingProvenance });
                        } else if (!publicationIntent) {
                            routingProvenance = exactRoutingProvenance(request.selectedModel ? 'explicit-turn' : 'chat-exact-default',
                                { connectionId: actual.connectionId, modelId: actual.modelId }, requestHard,
                                { connection: connection.label ?? connection.id, provider: actual.providerId,
                                    model: actual.modelLabel });
                        }
                        if (abort.signal.aborted)
                            throw new ModelRuntimeFailure('Conversation cancelled', 'cancelled');
                        await flushActivity();
                        if (publicationIntent) output = 'Roadmap Markdown request received. Check the verified result below before any decision.';
                        let promptActivity: ChatPlanningActivity | undefined;
                        if (promptStage) {
                            if (event.finishReason === 'length' &&
                                (promptStage.stage !== 'prompt-write' || !finishedPrompt))
                                throw new Error('Prompt authoring output was truncated');
                            // /prompt-write is bound to the two previously verified drafts. It need not
                            // make a redundant model read when their source identities are still current.
                            if (promptStage.stage !== 'prompt-write')
                                await verifyPromptSourceRefs(root, sourceRefs, this.grounder!);
                            if (promptStage.stage === 'prompt-write') {
                                if (!finishedPrompt)
                                    throw new Error('Incremental prompt stack was not finished and validated');
                                const proposal = finishedPrompt.candidate;
                                promptActivity = { schemaVersion: 1, kind: 'prompt-stack-proposal',
                                    status: 'pending', refs: [...preview.refs, ...sourceRefs],
                                    proposalId: proposal.id, promptStackProposal: proposal };
                                output = finishedPrompt.finalMessage;
                            } else {
                                if (promptStage.stage === 'prompt-ass')
                                    validatePromptAssessment(output, sourceRefs, content + '\n' +
                                        (chat.messages.filter(message => message.role === 'user').at(-1)?.content ?? ''));
                                else {
                                    const count = requestedWorkPromptCount(content,
                                        priorAssessment?.user.content ?? '', priorAssessment?.assistant.content ?? '');
                                    if (count) validatePromptPlan(output, sourceRefs, count,
                                        priorAssessment?.assistant.execution.sourceRefs ?? []);
                                }
                                output = finishedPromptText(promptStage.stage, output, sourceRefs, content);
                            }
                        }
                        let documentActivity: ChatPlanningActivity | undefined;
                        let revisionActivityToCommit: ChatPlanningActivity | undefined;
                        if (docsReview) {
                            const readPaths = sourceRefs.filter(ref => ref.kind === 'file').map(ref => ref.id);
                            try {
                                if (!finishedDocument)
                                    throw new Error('Incremental proposal was not finished and validated');
                                const proposal = finishedDocument.candidate;
                                output = finishedDocument.finalMessage;
                                {
                                    const priorDiscovery = revisionActivity?.documentationDiscovery;
                                    const readCounts = new Map((priorDiscovery?.reads ?? []).map(item =>
                                        [item.path, item.count] as const));
                                    for (const path of readPaths) readCounts.set(path, (readCounts.get(path) ?? 0) + 1);
                                    const nextActivity: ChatPlanningActivity = { schemaVersion: 1,
                                        kind: 'documentation-proposal', status: 'pending',
                                        refs: [...preview.refs, ...sourceRefs], proposalId: proposal.id,
                                        documentProposal: proposal,
                                        documentationDiscovery: { detected: discovery!.enumerated,
                                            omitted: [...new Set([...priorDiscovery?.omitted ?? [], ...discovery!.omitted])].slice(0, 30),
                                            reads: [...readCounts].map(([path, count]) => ({ path, count }))
                                                .sort((a, b) => a.path.localeCompare(b.path)) } };
                                    if (revisionProposal) revisionActivityToCommit = nextActivity;
                                    else documentActivity = nextActivity;
                                }
                            } catch (error) {
                                output = `Documentation review could not stage a proposal: ${String(error).slice(0, 300)}. ` +
                                    'No document was changed.';
                            }
                        }
                        const finishAssistant = async (planningActivity?: ChatPlanningActivity) => {
                            const completed = await mutate({ type: 'finish-assistant', chatId: key, messageId: assistant!.id,
                            outcome: 'complete', content: output,
                            ...(planningActivity ? { planningActivity } : {}),
                            activity: activity?.snapshot(event.finishReason === 'length' && !publicationIntent ?
                                'provider-truncated' : undefined),
                            ...(publicationIntent ? {} : { actualModel: actual, routingProvenance }),
                            contextUsage: { usedTokens: preview.usedTokens, budgetTokens: preview.budgetTokens },
                            tokenUsage: event.usage, ...(event.compaction ? { compaction: event.compaction } : {}),
                            ...(event.finishReason && !(protectedProposal && (finishedDocument || finishedPrompt)) ?
                                { finishReason: event.finishReason } : {}),
                            ...(toolEvents.length ? { sourceRefs, toolEvents } : {}) });
                            void this.repository.removeActivityLog(root, key, assistant!.id, assistant!.execution.id)
                            .catch(() => undefined);
                            const titledChat = completed.chats.find(item => item.id === key);
                            const index = titledChat?.messages.findIndex(message => message.id === assistant!.id) ?? -1;
                            const preceding = index > 0 ? titledChat!.messages[index - 1] : undefined;
                            if (!roadmapTurn && titledChat?.titleSource === 'placeholder' && preceding?.role === 'user' &&
                                !titledChat.messages.slice(0, index).some(message =>
                                    message.role === 'assistant' && message.execution.status === 'complete'))
                                void this.automaticTitle(root, key, preceding, assistant!.id, output, actual);
                        };
                        let revisionCommitError: string | undefined;
                        if (revisionActivityToCommit && revisionProposal && !abort.signal.aborted) {
                            try {
                                await this.repository.recordPlanningActivity(root, key, revisionProposal.messageId,
                                    request.leaseToken, revisionActivityToCommit,
                                    { proposalId: revisionProposal.id, status: 'pending', digest: revisionProposal.digest });
                            } catch (error) {
                                revisionCommitError = `Documentation revision was not accepted: ${String(error)}. ` +
                                    'The last valid proposal remains available.';
                            }
                        }
                        if (revisionCommitError) output = revisionCommitError;
                        await finishAssistant(promptActivity ?? documentActivity);
                        if (promptActivity && selectedPrompt && !abort.signal.aborted) {
                            try {
                                await this.repository.recordPlanningActivity(root, key, selectedPrompt.message.id,
                                    request.leaseToken, { ...selectedPrompt.activity, status: 'superseded' },
                                    { proposalId: selectedPrompt.proposal.id, status: 'pending',
                                        digest: selectedPrompt.proposal.digest });
                            } catch {
                                // Both candidates remain immutable. The older one retains its review controls.
                            }
                        }
                        if (abort.signal.aborted && !localRoadmap) return preview;
                        const proposalRefs = [...preview.refs, ...sourceRefs];
                        const result = docsReview ? revisionCommitError ? { proposalError: revisionCommitError } : {} :
                            promptStage ? {} :
                            nativeRoadmap ? await (async () => {
                            const stage = this.nativeStages?.get(key);
                            if (!stage) return {};
                            if (!stage.done) return { proposalError: 'Roadmap draft incomplete: final staged batch did not mark done' };
                            try {
                                const context = { root, projectId: stage.context.projectId, chatId: key,
                                    turnId: assistant.id, lease: request.leaseToken };
                                const { before, after } = await this.nativeStages!.complete(context);
                                const entities = (index: RoadmapGateIndex) => [...index.phases, ...index.gates,
                                    ...index.corrections, ...index.gates.flatMap(gate => gate.criteria)];
                                const prior = new Map(entities(before).map(item => [item.id, item]));
                                const next = new Map(entities(after).map(item => [item.id, item]));
                                const changedIds = [...new Set([...prior.keys(), ...next.keys()])].filter(id =>
                                    JSON.stringify(prior.get(id)) !== JSON.stringify(next.get(id)));
                                const presentation = roadmapProposalPreview(before, after,
                                    stage.operations.map(item => item.action), changedIds);
                                const proposal: ChatPlanningProposal = { id: stage.id, chatId: key,
                                    messageId: assistant.id, ownerId: before.projectId, revision: before.revision,
                                    generation: stage.generation,
                                    counts: typedRoadmapCounts(after),
                                    sourceHash: before.linkedDocument?.sourceHash, changedIds,
                                    action: { type: 'native-stage-preview', id: before.projectId },
                                    operations: stage.operations.map(item => ({ id: item.id, type: item.action.type,
                                        targetId: 'id' in item.action ? item.action.id ?? before.projectId :
                                            'gateId' in item.action ? item.action.gateId : before.projectId,
                                        targetIds: roadmapActionTargets(item.action),
                                        status: item.status })),
                                    summary: `${stage.strategy === 'phase-only' ? 'Phase-only' : 'Full'} staged draft: ` +
                                        `${typedRoadmapCounts(after).phases} Phases, ${typedRoadmapCounts(after).gates} Gates, ` +
                                        `${typedRoadmapCounts(after).criteria} Criteria; ${stage.operations.length} operations, ` +
                                        `${changedIds.length} changed entities. Validated preview; no Roadmap change applied.` +
                                        '',
                                    preview: presentation };
                                if (Buffer.byteLength(JSON.stringify(proposal), 'utf8') > 60_000)
                                    return { proposalError: 'Roadmap preview exceeds the saved proposal limit; reduce the draft' };
                                this.proposals.set(key, { id: stage.id, messageId: assistant.id,
                                    leaseToken: request.leaseToken, changedIds, nativeStageId: stage.id });
                                return { proposal };
                            } catch (error) { return { proposalError: `Roadmap stage rejected: ${String(error)}` }; }
                        })() : helpTurn || bridge ? {} : publicationIntent ? await this.publicationProposal(root,
                            key, assistant.id, request.leaseToken, proposalRefs, publicationIntent) :
                            await this.proposal(root, key, assistant.id, request.leaseToken, output, proposalRefs, draft);
                        if (nativeRoadmap && result.proposalError && this.nativeStages?.get(key)) {
                            try { this.client.notifyChatEvent({ projectHandle: request.projectHandle, kind: 'roadmap-stage',
                                chatId: key, messageId: assistant.id, snapshot: null, reason: 'failed' }); }
                            catch { /* A disconnected observer cannot change the denied turn. */ }
                            this.nativeStages.forget(key);
                        }
                        if (nativeRoadmap && (result.proposal || result.proposalError)) {
                            await this.repository.recordPlanningActivity(root, key, assistant.id, request.leaseToken,
                                { schemaVersion: 1, kind: 'roadmap-gate-proposal', refs: proposalRefs,
                                    status: result.proposal ? 'pending' : 'rejected',
                                    ...(result.proposalError ? { diagnostic: result.proposalError.slice(0, 2000) } : {}),
                                    ...(result.proposal ? { proposalId: result.proposal.id, proposal: result.proposal } : {}) });
                        }
                        if (localRoadmap && !nativeRoadmap || publicationIntent) {
                            const kind: ChatPlanningActivity['kind'] = publicationIntent ? 'roadmap-publication' :
                                (JSON.parse(output) as { type: ChatPlanningActivity['kind'] }).type;
                            await this.repository.recordPlanningActivity(root, key, assistant.id, request.leaseToken,
                                { schemaVersion: 1, kind, refs: proposalRefs,
                                    status: kind === 'no-action' || kind === 'roadmap-gate-focus' &&
                                        'roadmapFocus' in result && result.roadmapFocus ?
                                        'no-action' : bridge && kind === 'bridge-proposal' ? 'suggested' :
                                        result.proposal ? 'pending' : 'rejected',
                                    ...(helpTurn && kind === 'no-action' && composed.verifiedGuidance ?
                                        { verifiedGuidance: composed.verifiedGuidance } : {}),
                                    ...(result.proposalError ? { diagnostic: result.proposalError.slice(0, 2000) } : {}),
                                    ...(result.proposal ? { proposalId: result.proposal.id,
                                        ...(['roadmap-gate-proposal', 'roadmap-gate-undo', 'roadmap-publication'].includes(kind) ?
                                            { proposal: result.proposal } : {}) } : {}) });
                            tracePlanning('result-recorded', key, assistant.id,
                                kind === 'no-action' || kind === 'roadmap-gate-focus' &&
                                    'roadmapFocus' in result && result.roadmapFocus ?
                                    'no-action' : bridge && kind === 'bridge-proposal' ? 'suggested' :
                                    result.proposal ? 'pending' : 'rejected');
                        }
                        return { ...preview, ...result };
                    }
                }
                if (resumedEvents) { events = resumedEvents; continue; }
                break;
            }
            throw new Error('Model stream ended without completion');
        } catch (error) {
            if (nativeRoadmap && assistant && this.nativeStages?.get(key)) try {
                this.client.notifyChatEvent({ projectHandle: request.projectHandle, kind: 'roadmap-stage',
                    chatId: key, messageId: assistant.id, snapshot: null,
                    reason: abort.signal.aborted ? 'cancelled' : 'failed' });
            } catch { /* A disconnected observer cannot change turn outcome. */ }
            if (nativeRoadmap) this.nativeStages?.forget(key);
            if (this.proposals.get(key)?.messageId === assistant?.id) this.clearProposal(key);
            if (assistant) {
                if (localRoadmap && error instanceof LocalPlanningOutputFailure && error.rawText)
                    recordActivity('provisional', error.rawText);
                const cancelled = abort.signal.aborted || error instanceof ModelRuntimeFailure && error.failureClass === 'cancelled';
                const storageCode = (error as NodeJS.ErrnoException)?.code;
                const baseFailure = error instanceof ModelRuntimeFailure ? error.message :
                    promptStage && error instanceof Error &&
                    /^(?:Assessment |Plan |Saved prompt draft |Prompt authoring output )/u.test(error.message) ?
                        error.message.slice(0, 500) :
                    storageCode === 'ENOSPC' || storageCode === 'EDQUOT' ? 'Chat storage exhausted during activity capture' :
                    storageCode === 'EIO' ? 'Chat activity storage failed with an I/O error' :
                    error instanceof Error && /^(?:Pi Chat stream backpressure limit exceeded|Pi worker output limit exceeded|Chat activity storage limit reached)$/u.test(error.message) ?
                        error.message : 'Conversation failed';
                const diagnostic = undefined;
                const failure = diagnostic && !cancelled ? `${baseFailure}. ${diagnostic}`.slice(0, 1000) : baseFailure;
                if (retainStreamedAnswer && output && output.startsWith(persistedPartial))
                    try { await persistOutputPartial(output); } catch { /* Storage failure is reported below. */ }
                try { await flushActivity(); } catch { /* Final mutation below still carries the captured snapshot. */ }
                const saved = (await this.repository.read(root)).chats.find(chat => chat.id === key)
                    ?.messages.find(message => message.id === assistant!.id);
                try { await mutate(saved?.role === 'assistant' && saved.answerPartial ?
                    { type: 'interrupt-output-limit', chatId: key, messageId: assistant.id,
                        executionId: assistant.execution.id, cursor: saved.answerPartial.cursor,
                        failure: cancelled ? 'Conversation cancelled' : failure, cancelled, sourceRefs, toolEvents,
                        activity: activity?.snapshot() } :
                    { type: 'finish-assistant', chatId: key, messageId: assistant.id,
                    outcome: cancelled ? 'cancelled' : 'failed', content: '', activity: activity?.snapshot(),
                    contextUsage: { usedTokens: preview.usedTokens, budgetTokens: preview.budgetTokens },
                    ...(toolEvents.length ? { sourceRefs, toolEvents } : {}),
                    ...(!cancelled ? { failure } : {}) });
                    void this.repository.removeActivityLog(root, key, assistant.id, assistant.execution.id)
                        .catch(() => undefined); }
                catch { /* A lost lease or newer revision is recovered by ChatRepository. */ }
                if (localRoadmap) try {
                    await this.repository.recordPlanningActivity(root, key, assistant.id, request.leaseToken,
                        { schemaVersion: 1, kind: cancelled ? 'cancelled' : 'error',
                            status: cancelled ? 'cancelled' : 'failed', refs: preview.refs,
                            ...(diagnostic && !cancelled ? { diagnostic: failure } : {}) });
                } catch { /* The execution failure remains the authoritative saved outcome. */ }
            }
            throw error;
        } finally {
            if (proposalController) {
                await proposalController.stop().catch(() => undefined);
                if (!finishedDocument && !finishedPrompt)
                    await proposalController.progress('Generation ended before a reviewable proposal was sealed; no files were changed.').then(progress =>
                        this.repository.recordProposalProgress(root, key, assistant!.id,
                            request.leaseToken, progress)).catch(() => undefined);
            }
            liveContinuation?.dispose();
            liveProposalTerminal?.dispose();
            clearInterval(leaseHeartbeat);
            this.pendingOutputLimits.delete(key);
            if (activityTimer) clearTimeout(activityTimer);
            if (this.turns.get(key)?.abort === abort) this.turns.delete(key);
            if (this.pendingCancel.get(key) === request.leaseToken) this.pendingCancel.delete(key);
        }
    }
    private async automaticTitle(root: string, chatId: string, user: ChatUserMessage, assistantId: string,
        answer: string, actual: ChatModelProvenance): Promise<void> {
        let title = suggestedChatTitle(user.content);
        try {
            if (this.disposed || this.root !== root || !this.models) return;
            const connection = (await this.models.list()).connections.find(item => item.id === actual.connectionId);
            if (!connection?.ready || connection.providerId !== actual.providerId ||
                !connection.models.some(item => item.id === actual.modelId && item.usable))
                throw new Error('Original model unavailable');
            let response = '';
            for await (const event of this.models.generate({ connectionId: actual.connectionId, modelId: actual.modelId }, {
                messages: [{ role: 'user', content: `Write a short title (at most 80 characters) for this exchange. Return only the title.\nUser: ${user.content.slice(0, 300)}\nAssistant: ${answer.slice(0, 300)}` }],
                signal: AbortSignal.timeout(10_000),
            })) {
                if (event.type === 'delta') response += event.text;
                else if (event.type === 'reset') response = '';
                else if (event.type === 'complete') { response = event.text; break; }
                if (response.length > 240) throw new Error('Title response too long');
            }
            title = suggestedChatTitle(response.replace(/[\r\n]+/g, ' ').replace(/^['"\s]+|['"\s]+$/g, ''));
        } catch { /* Keep the deterministic first-message title. */ }
        if (this.disposed || this.root !== root) return;
        try {
            for (let attempt = 0; attempt < 3; attempt++) {
                const snapshot = await this.repository.read(root);
                if (snapshot.chats.find(item => item.id === chatId)?.titleSource !== 'placeholder') return;
                try {
                    await this.repository.mutate(root, snapshot.revision, { type: 'automatic-title', chatId,
                        title, firstUserMessageId: user.id, firstAssistantMessageId: assistantId });
                    return;
                } catch (error) { if (!String(error).includes('Stale Chat revision')) return; }
            }
        } catch { /* A title never changes the answer outcome. */ }
    }
    private outputLimitSourceBasis(messages: Chat['messages'], messageId: string): string {
        const at = messages.findIndex(message => message.id === messageId);
        const saved = at >= 0 ? messages[at] : undefined;
        const user = at > 0 ? messages[at - 1] : undefined;
        return createHash('sha256').update(JSON.stringify({
            refs: user?.role === 'user' ? user.contextRefs : [],
            sourceRefs: saved?.role === 'assistant' ? saved.execution.sourceRefs ?? [] : [],
            toolEvents: saved?.role === 'assistant' ? saved.execution.toolEvents ?? [] : []
        })).digest('hex');
    }
    async decideOutputLimit(projectHandle: string, chatId: string, leaseToken: string,
        messageId: string, executionId: string, segment: number, cursor: number,
        decision: 'stop' | 'continue'): Promise<void> {
        const root = this.active(projectHandle);
        if (decision !== 'stop' && decision !== 'continue') throw new Error('Invalid output-limit decision');
        const pending = this.pendingOutputLimits.get(chatId);
        if (!pending || pending.root !== root || pending.leaseToken !== leaseToken ||
            pending.messageId !== messageId || pending.executionId !== executionId ||
            pending.segment !== segment || pending.cursor !== cursor ||
            this.leases.get(chatId)?.root !== root || this.leases.get(chatId)?.token !== leaseToken ||
            this.turns.get(chatId)?.token !== leaseToken || this.turns.get(chatId)?.abort.signal.aborted)
            throw new Error('Stale or foreign Chat output-limit decision');
        await this.repository.renew(root, chatId, leaseToken);
        const messages = (await this.repository.read(root)).chats.find(chat => chat.id === chatId)?.messages;
        const at = messages?.findIndex(message => message.id === messageId) ?? -1;
        const saved = at >= 0 ? messages![at] : undefined;
        const sourceBasis = this.outputLimitSourceBasis(messages ?? [], messageId);
        if (this.pendingOutputLimits.get(chatId) !== pending || saved?.role !== 'assistant' ||
            saved.execution.id !== executionId || saved.execution.status !== 'paused-output-limit' ||
            saved.answerPartial?.cursor !== cursor || saved.answerPartial.segments.length !== segment ||
            saved.execution.selectedModel.connectionId !== pending.selectedModel.connectionId ||
            saved.execution.selectedModel.modelId !== pending.selectedModel.modelId ||
            saved.execution.actualModel?.connectionId !== pending.actualModel.connectionId ||
            saved.execution.actualModel?.modelId !== pending.actualModel.modelId ||
            saved.execution.actualModel?.providerId !== pending.actualModel.providerId ||
            pending.sourceBasis !== undefined && sourceBasis !== pending.sourceBasis)
            throw new Error('Stale Chat output-limit decision');
        pending.sourceBasis ??= sourceBasis;
        this.pendingOutputLimits.delete(chatId);
        pending.resolve(decision);
    }
    async cancelTurn(projectHandle: string, chatId: string, leaseToken: string): Promise<void> {
        const root = this.active(projectHandle);
        const turn = this.turns.get(chatId);
        const generation = this.generationControllers.get(chatId);
        const preparation = this.roadmapPreparations.get(chatId);
        const proposal = this.proposals.get(chatId);
        if (turn && turn.token !== leaseToken) throw new Error('Chat turn is not owned by this panel');
        if (generation && generation.token !== leaseToken) throw new Error('Roadmap generation is not owned by this panel');
        if (preparation && preparation.token !== leaseToken) throw new Error('Roadmap preparation is not owned by this panel');
        if (generation) generation.controller.cancel();
        else if (turn) turn.abort.abort();
        else if (preparation) preparation.abort.abort();
        else if (proposal) {
            if (proposal.leaseToken !== leaseToken) throw new Error('Planning proposal is not owned by this panel');
            await this.repository.renew(root, chatId, leaseToken);
            await this.retirePending(root, chatId, leaseToken, 'cancelled');
            this.clearProposal(chatId);
        }
        else this.pendingCancel.set(chatId, leaseToken);
    }
    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        for (const chatId of this.proposals.keys()) this.clearProposal(chatId);
        for (const chatId of this.gateUndo.keys()) this.clearGateUndo(chatId);
        for (const turn of this.turns.values()) turn.abort.abort();
        for (const generation of this.generationControllers.values()) generation.controller.cancel();
        this.generationControllers.clear();
        for (const pending of this.pendingCommands.values()) pending.finish('deny');
        this.commandModes.clear();
        for (const preparation of this.roadmapPreparations.values()) preparation.abort.abort();
        // Browser unload cannot reliably finish an RPC release. The server still has
        // the connection's exact tokens when its socket closes. Token checks in the
        // repository prevent a delayed release from touching a successor lease.
        for (const [chatId, lease] of this.leases) {
            void this.repository.release(lease.root, chatId, lease.token).catch(() => {});
        }
        this.leases.clear();
        this.bridgePlanning?.dispose?.();
        this.unlistenPlanningConflicts?.();
        this.unlisten();
    }
}
