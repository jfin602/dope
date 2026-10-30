import { createHash, randomUUID } from 'node:crypto';
import type { ChatClient, ChatDeltaRequest, ChatLeaseRequest, ChatMutation, ChatSearchRequest, ChatService,
    ChatTurnRequest, ChatOperation, ChatContextPreview, ChatTurnResult, ChatPlanningProposal, ChatRoadmapOffer,
    ChatContextSelection, ChatStrategicDraftReview, ChatEvent, ChatCommandMode, ChatCommandPreview } from '@dope/chat/lib/service';
import { suggestedChatTitle, type Chat, type ChatAssistantMessage, type ChatModelProvenance, type ChatPlanningActivity, type ChatRoadmapAction, type ChatUserMessage } from '@dope/chat';
import { ChatRepository } from '@dope/chat/lib/node';
import { ModelRuntimeFailure, type ConversationMessage, type ConversationModelCapabilities } from '@dope/contracts/lib/model-runtime';
import type { AIRoleHardConstraints, RoutingProvenance } from '@dope/ai';
import { ModelConnectionsRegistry } from './model-connections';
import { ChatContextComposer } from './chat-context-composer';
import { ChatProjectGrounder, type GroundingResult } from './chat-project-grounder';
import { runChatInvestigationCommand } from './chat-command-broker';
import { AIRoleRoutingService, exactRoutingProvenance, type RoutedConversationEvent } from './ai-role-routing';
import { ProjectPlanningActions, type PlanningAction, type PlanningActionRequest } from '@dope/project-intelligence/lib/node/project-planning-actions';
import { LocalPlanningOutputFailure, localPlanningJson, requestsRoadmapOwnerRevision, validImplementationPlan,
    validImplementationPlanRevision,
    roadmapLocalBudget, verifyRoadmapLocalInput } from './roadmap-local-model';
import { RoadmapGreenfield, reviseImplementationPlan, type ImplementationPlanRevision,
    type GreenfieldEdit, type GreenfieldEditPreview, type ImplementationPlanPreview,
    type ImplementationPlanInput, type StrategicDraftPreview } from '@dope/project-intelligence/lib/node/roadmap-greenfield';
import { readRoadmapDocumentCapabilities } from '@dope/project-intelligence/lib/node/roadmap-document-patch';
import { selectDopeCapabilityHelp } from './dope-capability-help';
import type { VisualPlanningService } from '@dope/visual-planning/lib/service';
import { BridgeLocalProposal } from './bridge-local-proposal';
import { planRequirements, planRequirementCoverage, type PlanRequirement } from './chat-plan-requirements';
import { extractSavedRoadmap, roadmapCreationIntent } from './chat-roadmap-extract';
import { roadmapRequirementCoverage } from './chat-roadmap-requirements';
import { bindGateChatActions, gateChatDiff, validGateChatEnvelope } from './roadmap-gate-chat';
import { RoadmapStore } from '@dope/project-intelligence/lib/node/roadmap-store';
import type { RoadmapGateIndex } from '@dope/project-intelligence/lib/node/roadmap-gate-domain';
import type { GateDocumentPatch } from '@dope/project-intelligence/lib/node/roadmap-gate-document';

function draftInstruction(projectId: string, revision: number, maxSteps?: 2 | 3): string {
    const example = JSON.stringify({ type: 'roadmap-draft-proposal', projectId, draftRevision: revision,
        action: { type: 'create-phase', title: 'Example phase', objective: 'One clear objective' } });
    return `You are discussing a noncanonical Roadmap draft. Answer questions or ask one meaningful clarifying question as {"type":"no-action","message":"your concrete answer or question"}; do not force an edit. If the user asks for an edit, ${maxSteps ? `you may propose from two to ${maxSteps} small steps in one atomic preview using {"type":"roadmap-draft-sequence","projectId":"${projectId}","draftRevision":${revision},"actions":[{"type":"create-phase","title":"First phase"},{"type":"create-phase","title":"Second phase"}]}, or propose one step` : 'propose exactly one small step'} using the exact projectId and draftRevision below. The action must be an object with a "type" field, not a property named after the action. For a phase, use this exact JSON shape with your own title and objective: ${example}. A Gate is an explicit verifiable requirement, not an implementation step or feature inventory item. For a developer-requested Gate use {"type":"create-gate","phaseId":"<existing phase ID>","title":"<testable requirement>","purpose":"<why it must pass>"}; add each observable criterion separately with {"type":"add-criterion","phaseId":"<existing phase ID>","gateId":"<existing gate ID>","title":"<criterion>","expectedResult":"<observable pass result>"}. Copy IDs from the current draft; never invent an ID. Supported actions also include edit-phase, edit-gate, edit-criterion, create-correction (parentId, title, optional objective), and attach-correction (correctionId, parentId). Keep implementation tasks in the separate plan; do not convert them to required Gates. Return only one JSON object. This requires developer approval. Never claim an edit was applied or a Gate is Green.`;
}

const chatHard: AIRoleHardConstraints = { requiredCapabilities: ['conversationalText', 'streaming'],
    locality: 'any', enabledOnly: true, usableOnly: true, hostedProjectData: 'requires-feature-authorization' };
const PLAN_INVESTIGATION_INSTRUCTION = `Create one complete first-pass implementation plan from the idea and supplied read-only project evidence. Return ONLY one compact strict JSON object with exactly: {"type":"implementation-plan","objective":"goal","successCriteria":["observable outcome"],"constraints":["developer constraint"],"assumptions":["uncertain assumption"],"steps":[{"title":"ordered step","detail":"objective and implementation approach","deliverables":["concrete output"],"dependsOn":[1],"reuse":[{"path":"project-relative source path","reason":"how it is reused"}]}],"tests":["test"],"guiQualification":"manual GUI check","risks":["risk and mitigation"],"alternatives":["alternative and tradeoff"],"question":"one material question only if needed, otherwise empty"}. Use 1-based earlier step numbers in dependsOn; first step has []. Give at least two substantive steps in the first answer. Cite only actual source paths supplied as verified file evidence; otherwise describe reuse as unverified in assumptions, not a fake citation. Keep output within the reserved local budget. Do not claim a write, approval or completed test. This is a noncanonical proposal awaiting developer review, never a Roadmap mutation.`;
function firstPlanInstruction(requirements: readonly PlanRequirement[]): string {
    return `${PLAN_INVESTIGATION_INSTRUCTION} Developer requirements (derived from the user's words, not model assumptions): ` +
        `${JSON.stringify(requirements.map(item => ({ id: item.id, text: item.text })))}. ` +
        'Cover every requirement with concrete implementation step detail, a deliverable and a success criterion or test. ' +
        'Related requirements may share a step. Do not assume a requested view or action already exists when evidence ' +
        'shows only underlying functions; include the work to create it. Put requested verification in an implementation ' +
        'step deliverable and in tests. For every requested action, connect its control to the actual operation, ' +
        'describe failure handling, and verify the operation succeeded. A button alone is not functional behavior. ' +
        'Describe explicit authorization as actual checks for each protected action. ' +
        'If evidence is missing, mark the unknown honestly and still plan supported work.';
}
/** Deliberately narrow first-turn intent; ordinary mentions of a plan remain ordinary Chat. */
export function requestsImplementationPlan(content: string): boolean {
    const text = content.trim();
    return /^plan\s+(?:a|an|the|my)\s+\S/i.test(text) &&
        /\b(?:please\s+)?inspect\b/i.test(text) &&
        /\b(?:complete|full)\s+ordered\s+implementation\s+plan\b/i.test(text);
}
function planRevisionInstruction(plan: NonNullable<ReturnType<RoadmapGreenfield['chatImplementationPlan']>>['plan']): string {
    if (!plan) return PLAN_INVESTIGATION_INSTRUCTION;
    return `Revise only the affected steps in the accepted noncanonical plan below, using fresh read-only source evidence. ` +
        `For an edit return ONLY strict JSON {"type":"implementation-plan-revision","baseRevision":${plan.revision},` +
        `"edits":[{"type":"update","step":1,"detail":"replacement detail"}],"constraintsAdd":[],"decisionsAdd":[],"question":""}. ` +
        `Supported edits: update(step,title and/or detail), merge(first,second,title,detail) for adjacent steps, ` +
        `move(step,before), split(step,title,detail), add(before,title,detail). Numbers refer to the accepted plan below, ` +
        `not to intermediate edits. Keep unaffected steps and confirmed decisions. Use decisionsAdd only for newly suggested choices, ` +
        `not developer approvals. If the request is ambiguous, answer {"type":"no-action","message":"one concrete question"}. ` +
        `Never claim approval or a Roadmap, Markdown, Work, or prompt write. Accepted plan: ${JSON.stringify(plan)}`;
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
    private root?: string;
    private handle?: string;
    private disposed = false;
    private attaching = 0;
    private readonly unlisten: () => void;
    private readonly turns = new Map<string, { token: string; abort: AbortController }>();
    private readonly roadmapPreparations = new Map<string, { token: string; abort: AbortController }>();
    /** Leases belong to this RPC connection, not to the reusable panel ID or backend PID. */
    private readonly leases = new Map<string, { root: string; token: string }>();
    private readonly commandModes = new Map<string, ChatCommandMode>();
    private readonly pendingCommands = new Map<string, { preview: ChatCommandPreview; root: string;
        leaseToken: string; turn: AbortController; digest: string; sourceBasis: string;
        finish: (decision: 'allow' | 'deny') => void }>();
    private readonly pendingCancel = new Map<string, string>();
    private readonly proposals = new Map<string, { id: string; messageId: string; leaseToken: string;
        handle?: string; request?: PlanningActionRequest; token?: string; changedIds: string[];
        document?: { root: string; preview: GateDocumentPatch };
        undo?: { handle: string; ownerId: string; revision: number; token: string };
        roadmapOffer?: ChatRoadmapOffer;
        draft?: { handle: string; preview: GreenfieldEditPreview };
        plan?: { handle: string; preview: ImplementationPlanPreview } }>();
    private readonly planUndo = new Map<string, { handle: string; leaseToken: string; revision: number }>();
    private readonly gateUndo = new Map<string, { handle: string; ownerId: string; revision: number;
        token: string; leaseToken: string }>();
    private readonly strategicReviews = new Map<string, { root: string; leaseToken: string; messageId: string; offerId: string;
        question: string; preview: StrategicDraftPreview; extractedSourceId?: string }>();

    private extractedSourceHash(chat: Chat, sourceId: string): string {
        const index = chat.messages.findIndex(item => item.id === sourceId && item.role === 'assistant');
        if (index < 0) throw new Error('Saved planning answer changed');
        const source = chat.messages[index];
        return createHash('sha256').update(JSON.stringify({ sourceId, content: source.content,
            decisions: chat.messages.slice(0, index).filter(item => item.role === 'user')
                .map(item => ({ id: item.id, content: item.content })) })).digest('hex');
    }

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

    private roadmapSourceMessages(chat: Chat): unknown[] {
        return chat.messages.map(message => {
            if (message.role !== 'assistant') return message;
            const { roadmapAction: _action, ...source } = message;
            return source;
        });
    }

    constructor(private readonly repository: ChatRepository, private readonly client: ChatClient,
        private readonly models?: ModelConnectionsRegistry, private readonly composer?: ChatContextComposer,
        private readonly routing?: AIRoleRoutingService, private readonly grounder?: ChatProjectGrounder,
        private readonly planning?: ProjectPlanningActions, private readonly greenfield?: RoadmapGreenfield,
        private readonly bridgePlanning?: VisualPlanningService & { dispose?: () => void },
        private readonly roadmapStore?: RoadmapStore) {
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
        if (!ordinary || !/\b(?:roadmap|milestone|plan|planning|start|begin|build|create|design|architecture)\b/i.test(content))
            return undefined;
        if (!this.greenfield) return 'Roadmap opportunity: the current project owner could not be checked. Do not claim the Roadmap is absent or offer to create a draft; suggest checking Roadmap first.';
        try {
            const state = await this.greenfield.readOpportunity(root);
            const base = `Checked read-only Roadmap opportunity for root ${JSON.stringify(root)}, projectId ${state.projectId}, owner revision ${state.revision}: `;
            if (state.revision || state.linkedDocument || state.canonicalMarkdown || state.pendingCreation || state.drafts ||
                state.acceptedPlans || state.pendingPlans)
                return base + `linked document ${state.linkedDocument ? JSON.stringify(state.linkedDocument) : 'none'}, ` +
                    `root ROADMAP.md present ${state.canonicalMarkdown}, ${state.gates} accepted Gates, ` +
                    `${state.draftGates} Gates in drafts, ${state.proposedGates} proposed Gates, ` +
                    `creation pending ${state.pendingCreation}, ${state.drafts} Greenfield drafts, ` +
                    `${state.acceptedPlans} accepted plans, ${state.pendingPlans} pending plans. ` +
                    'An owner, creation, draft, or plan already exists. Offer Open, Continue, or Review Roadmap as appropriate; do not offer a duplicate draft.';
            return base + 'revision zero, no linked document, pending creation, Greenfield draft, or accepted/pending plan. ' +
                'At a useful planning juncture you may mention that Dope can generate a provisional Roadmap draft. ' +
                'This is an informational possibility only: no executable offer or authorization exists in this turn. ' +
                'Do not claim a draft was generated or repeat the suggestion if it was already made in this Chat.';
        } catch {
            return 'Roadmap opportunity: the current project owner or draft state could not be verified. ' +
                'Do not infer absence or offer draft creation; suggest checking Roadmap first.';
        }
    }

    private async composeTurn(root: string, chat: Chat, content: string, context: ChatContextSelection[],
        model: ConversationModelCapabilities, budget?: ReturnType<typeof roadmapLocalBudget>,
        draft?: { text: string }, grounding?: GroundingResult, bridgeMode = false,
        opportunity?: string) {
        const capabilities = planningComposerCapabilities(model, budget, draft);
        let inputTokens = capabilities.maxInputTokens;
        for (let attempt = 0; attempt < 4; attempt++) {
            const composed = await this.composer!.compose(root, chat, content, context,
                inputTokens === undefined ? capabilities : { ...capabilities, maxInputTokens: inputTokens }, grounding,
                !!budget, bridgeMode, opportunity);
            if (!budget) return composed;
            const bytes = Buffer.byteLength(JSON.stringify(this.withDraft(composed.messages, draft)), 'utf8');
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
        await this.greenfield?.ensureRestored(root);
        const helpTurn = !!selectDopeCapabilityHelp(request.content);
        const planBinding = !helpTurn ? this.greenfield?.chatImplementationPlan(root, request.chatId) : undefined;
        const draft = helpTurn ? undefined : await this.draftContext(root, request.chatId);
        const explicitPlan = !helpTurn && !draft && !planBinding &&
            !request.context.some(item => item.kind === 'roadmap-checkpoint' || item.kind === 'roadmap' || item.kind === 'planning-map') &&
            requestsImplementationPlan(request.content);
        if (explicitPlan) {
            const owner = await this.greenfield?.owner(root);
            if (!owner || owner.revision !== 0 || owner.linkedDocument || owner.pendingCreation)
                throw new Error('This Roadmap already has an owner; review it before starting a new implementation plan');
        }
        const planOnly = planBinding?.planOnly === true || explicitPlan;
        const opportunity = await this.roadmapOpportunity(root, request.content, !helpTurn && !draft && !planOnly &&
            !request.context.some(item => item.kind === 'roadmap-checkpoint' || item.kind === 'roadmap' || item.kind === 'planning-map'));
        if (planOnly && !this.grounder) throw new Error('Project investigation unavailable');
        const planningGrounding = planOnly ? await this.grounder?.investigateIdea(root, request.content) :
            await this.grounder?.ground(root, request.content);
        const connection = (await this.models.list()).connections.find(item => item.id === request.selectedModel.connectionId);
        if (draft && connection?.providerId !== 'local') throw new Error('Greenfield Chat planning requires a local model');
        const localRoadmap = connection?.providerId === 'local' &&
            (request.context.some(item => item.kind === 'roadmap-checkpoint' || item.kind === 'roadmap') || !!draft || helpTurn || planOnly);
        if (planOnly && connection?.providerId !== 'local') throw new Error('Implementation planning requires a selected local model');
        const budget = localRoadmap ? roadmapLocalBudget(model.capabilities.contextWindowTokens,
            planOnly ? Math.max(2048, chat.settings.context.reservedOutputTokens) :
                chat.settings.context.reservedOutputTokens, model.capabilities) : undefined;
        if (planOnly && budget!.output < 2048) throw new Error('Selected local model has insufficient plan output capacity');
        const composed = await this.composeTurn(root, chat, request.content, request.context,
            model.capabilities, budget, planOnly ? { text: planBinding?.plan ? planRevisionInstruction(planBinding.plan) :
                firstPlanInstruction(planRequirements(request.content)) } : draft, planningGrounding, false, opportunity);
        if (budget) await this.verifyLoadedCapacity(request.selectedModel, budget,
            planOnly ? Math.max(2048, chat.settings.context.reservedOutputTokens) :
                chat.settings.context.reservedOutputTokens);
        if (request.context.some(item => item.kind === 'roadmap-checkpoint' || item.kind === 'roadmap') &&
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
                // A new lease cannot approve an in-memory preview from an earlier owner/session.
                await this.retirePending(root, request.chatId, result.token);
                await this.retireRoadmapActions(root, request.chatId, result.token);
                if (this.disposed) throw new Error('Disposed Chat connection');
                this.clearProposal(request.chatId);
                this.clearGateUndo(request.chatId);
                const prior = this.strategicReviews.get(request.chatId);
                if (prior) { this.greenfield?.rejectStrategicDraft(prior.preview.token);
                    this.strategicReviews.delete(request.chatId); }
                this.leases.set(request.chatId, { root, token: result.token });
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
            const review = this.strategicReviews.get(chatId);
            if (review) { this.greenfield?.rejectStrategicDraft(review.preview.token);
                this.strategicReviews.delete(chatId); }
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
        turn: AbortController, sourceBasis: string): Promise<boolean> {
        if (typeof command !== 'string' || !command.trim() || Buffer.byteLength(command, 'utf8') > 2048 ||
            /[\x00-\x08\x0b-\x1f\x7f]/u.test(command)) throw new Error('Command request denied');
        if (this.commandModes.get(request.chatId) === 'allow') return true;
        if (this.commandModes.get(request.chatId) !== 'ask' || this.pendingCommands.has(request.chatId))
            throw new Error('Command request unavailable');
        const preview: ChatCommandPreview = { id: randomUUID(), command, project: root, cwd: root,
            sandbox: 'Project read-only; private temporary files; no network or private home',
            effect: 'Runs only inside the bounded Linux sandbox after approval', expiresAt: Date.now() + 60_000 };
        const digest = createHash('sha256').update(command).digest('hex');
        return new Promise<boolean>(resolve => {
            let settled = false;
            const finish = (decision: 'allow' | 'deny') => {
                if (settled) return;
                settled = true; clearTimeout(timer); turn.signal.removeEventListener('abort', onAbort);
                if (this.pendingCommands.get(request.chatId)?.preview.id === preview.id)
                    this.pendingCommands.delete(request.chatId);
                if (this.handle) this.client.notifyChatEvent({ projectHandle: this.handle,
                    kind: 'command-settled', chatId: request.chatId, id: preview.id });
                resolve(decision === 'allow');
            };
            const onAbort = () => finish('deny');
            const timer = setTimeout(() => finish('deny'), 60_000);
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
        if (pending?.handle) this.planning?.detach(pending.handle);
        if (pending?.draft) this.greenfield?.clearEditPreview(pending.draft.handle);
        if (pending?.plan) this.greenfield?.clearImplementationPlanPreview(pending.plan.handle);
        this.proposals.delete(chatId);
    }
    private clearGateUndo(chatId: string): void {
        const undo = this.gateUndo.get(chatId);
        if (undo) this.planning?.detach(undo.handle);
        this.gateUndo.delete(chatId);
    }

    private async offerRoadmap(root: string, chatId: string, messageId: string,
        leaseToken: string, opportunity: string | undefined, output: string, direct = false): Promise<ChatRoadmapOffer | undefined> {
        if ((!direct && !opportunity?.includes('revision zero')) || !this.greenfield || this.proposals.has(chatId) ||
            this.strategicReviews.has(chatId)) return undefined;
        const chat = (await this.repository.read(root)).chats.find(item => item.id === chatId);
        if (!chat) return undefined;
        const lastUser = chat.messages.filter(item => item.role === 'user').at(-1)?.content ?? '';
        const requestedAgain = /\b(?:create|generate|make|offer(?:ing)?)\b[\s\S]{0,100}\bdraft\b[\s\S]{0,60}\broadmap\b/i.test(lastUser) ||
            /\b(?:create|generate|make|offer(?:ing)?)\b[\s\S]{0,100}\broadmap\b[\s\S]{0,60}\bdraft\b/i.test(lastUser);
        if (!direct && !requestedAgain && (!/\broadmap\b/i.test(output) || !/\bdraft\b/i.test(output))) return undefined;
        if (!direct && !requestedAgain && chat.messages.some(item => item.role === 'assistant' &&
            item.id !== messageId && /\broadmap\b/i.test(item.content) && /\bdraft\b/i.test(item.content)))
            return undefined;
        const state = await this.greenfield.readOpportunity(root);
        if (state.revision || state.linkedDocument || state.canonicalMarkdown || state.pendingCreation ||
            state.drafts || state.acceptedPlans || state.pendingPlans) return undefined;
        if (!this.handle || this.root !== root) return undefined;
        const offer: ChatRoadmapOffer = { id: randomUUID(), token: randomUUID(), projectHandle: this.handle,
            projectId: state.projectId,
            chatId, messageId, ownerId: state.projectId, ownerRevision: state.revision, basis: 'empty-owner',
            expiresAt: Date.now() + 5 * 60_000 };
        const prior = chat.messages.find(item => item.id === messageId);
        if (!prior || prior.role !== 'assistant' || prior.roadmapAction) return undefined;
        await this.repository.recordRoadmapAction(root, chatId, messageId, leaseToken,
            { schemaVersion: 1, offerId: offer.id, projectId: offer.projectId, chatId,
                sourceMessageId: messageId, sourceContentHash: createHash('sha256').update(prior.content).digest('hex'),
                ownerRevision: offer.ownerRevision, status: 'offered' });
        this.proposals.set(chatId, { id: offer.id, messageId, leaseToken, changedIds: [], roadmapOffer: offer });
        return offer;
    }

    async decideRoadmapOffer(projectHandle: string, chatId: string, leaseToken: string,
        offerId: string, token: string, approve: boolean, _selectedModel?: { connectionId: string; modelId: string }):
        Promise<'declined' | ChatStrategicDraftReview> {
        const root = this.active(projectHandle), pending = this.proposals.get(chatId);
        const offer = pending?.roadmapOffer;
        if (!offer || offer.id !== offerId || offer.token !== token || offer.chatId !== chatId ||
            offer.projectHandle !== projectHandle ||
            pending?.leaseToken !== leaseToken || this.leases.get(chatId)?.token !== leaseToken ||
            this.turns.has(chatId) || typeof approve !== 'boolean' || Date.now() >= offer.expiresAt)
            throw new Error('Roadmap offer expired or is no longer current; ask again in this Chat');
        // Consume before any await: simultaneous button/text submissions cannot both pass.
        this.proposals.delete(chatId);
        await this.repository.renew(root, chatId, leaseToken);
        if (!approve) {
            await this.updateRoadmapAction(root, chatId, pending.messageId, leaseToken, offer.id,
                'offered', 'declined');
            return 'declined';
        }
        const abort = new AbortController();
        this.roadmapPreparations.set(chatId, { token: leaseToken, abort });
        const checkCancelled = () => {
            if (abort.signal.aborted) throw new Error('Roadmap preparation cancelled');
        };
        let stagedPreview: StrategicDraftPreview | undefined;
        try {
        await this.updateRoadmapAction(root, chatId, pending.messageId, leaseToken, offer.id,
            'offered', 'generating', { stage: 'checking-owner' });
        checkCancelled();
        this.planningProgress(chatId, offer.id, 'checking-owner');
        if (!this.greenfield || !(await this.repository.read(root)).chats.some(chat => chat.id === chatId))
            throw new Error('Roadmap offer Chat is unavailable');
        const state = await this.greenfield.readOpportunity(root);
        checkCancelled();
        if (state.projectId !== offer.projectId || state.revision !== offer.ownerRevision ||
            state.linkedDocument || state.canonicalMarkdown || state.pendingCreation || state.drafts ||
            state.acceptedPlans || state.pendingPlans)
            throw new Error('Roadmap owner or draft changed; review Roadmap and request a new offer');
        const saved = (await this.repository.read(root)).chats.find(item => item.id === chatId);
        checkCancelled();
        const source = saved?.messages.find(item => item.id === pending.messageId);
        if (!saved || !source || source.role !== 'assistant') throw new Error('Saved planning answer is unavailable');
        this.planningProgress(chatId, offer.id, 'validating-draft');
        await this.updateRoadmapAction(root, chatId, pending.messageId, leaseToken, offer.id,
            'generating', 'generating', { stage: 'validating-draft' });
        const input = extractSavedRoadmap(saved, source, state.projectId, state.revision);
        const sourceHash = this.extractedSourceHash(saved, source.id);
        this.planningProgress(chatId, offer.id, 'preparing-draft');
        await this.updateRoadmapAction(root, chatId, pending.messageId, leaseToken, offer.id,
            'generating', 'generating', { stage: 'preparing-draft' });
        const preview = await this.greenfield.previewStrategicDraft(root, input, sourceHash);
        stagedPreview = preview;
        checkCancelled();
        const latest = (await this.repository.read(root)).chats.find(item => item.id === chatId);
        if (!latest || this.extractedSourceHash(latest, source.id) !== sourceHash ||
            this.disposed || this.root !== root || this.leases.get(chatId)?.token !== leaseToken) {
            this.greenfield.rejectStrategicDraft(preview.token);
            throw new Error('Saved planning answer or Chat owner changed');
        }
        const coverage = roadmapRequirementCoverage(
            saved.messages.filter(item => item.role === 'user').map(item => item.content),
            input.phases.map(phase => [phase.title, phase.objective,
                ...phase.checkpoints.map(item => item.title),
                ...(phase.gates ?? []).flatMap(gate => [gate.title, gate.purpose,
                    ...gate.criteria.map(criterion => `${criterion.title} ${criterion.expectedResult}`)])].join(' ')));
        const sourceIndex = saved.messages.findIndex(item => item.id === source.id);
        const sourceUser = saved.messages.slice(0, sourceIndex).reverse().find(item => item.role === 'user');
        const verifiedFile = sourceUser?.role === 'user' && sourceUser.contextRefs.some(ref =>
            ['file', 'editor', 'selection'].includes(ref.kind));
        const sourceCaution = /\bverified facts\b/i.test(source.content) && !verifiedFile ?
            'Source answer labels goals as verified without file evidence; treat them as proposed. ' : '';
        this.strategicReviews.set(chatId, { root, leaseToken, question: '', preview,
            messageId: pending.messageId, offerId: offer.id, extractedSourceId: source.id });
        const diagnostic = `${sourceCaution}Requirement coverage — ${coverage.join('; ')}. ` +
            `${input.phases.some(phase => (phase.gates?.length ?? 0) > 0) ?
                'Explicit Gate criteria are proposed for developer review, with no qualification evidence. ' :
                'The saved answer defines phases only; implementation tasks and feature lists did not become required Gates. '} ` +
            'Review unmet requirements, testable Gates and Gate-set completeness before any publication.';
        checkCancelled();
        await this.updateRoadmapAction(root, chatId, pending.messageId, leaseToken, offer.id,
            'generating', 'ready', { draftRevision: preview.after.revision, diagnostic });
        stagedPreview = undefined;
        this.planningProgress(chatId, offer.id, 'draft-ready');
        return { token: preview.token, projectId: preview.projectId, revision: preview.after.revision, diagnostic,
            draft: preview.after, phases: preview.after.phases.map(phase => ({ title: phase.title,
                objective: phase.objective, gates: (phase.gates ?? []).map(gate => ({
                    id: gate.id, parentPhaseId: gate.parentPhaseId, designation: gate.designation,
                    title: gate.title, purpose: gate.purpose, criteria: gate.criteria })),
                checkpoints: phase.checkpoints.map(item => ({
                    id: item.id, title: item.title, objective: item.objective, dependencies: item.dependencies ?? [] })) })) };
        } catch (error) {
            this.strategicReviews.delete(chatId);
            if (stagedPreview) this.greenfield?.rejectStrategicDraft(stagedPreview.token);
            await this.updateRoadmapAction(root, chatId, pending.messageId, leaseToken, offer.id,
                'generating', abort.signal.aborted ? 'cancelled' : 'failed',
                { diagnostic: abort.signal.aborted ? 'Preparation cancelled. Ask Chat for a new phase plan before another offer.' :
                    'Draft preparation failed. Ask Chat for a revised phase plan before another offer.' }).catch(() => {});
            this.planningProgress(chatId, offer.id, abort.signal.aborted ? 'cancelled' : 'failed');
            throw error;
        } finally {
            if (this.roadmapPreparations.get(chatId)?.abort === abort) this.roadmapPreparations.delete(chatId);
        }
    }

    async decideStrategicDraft(projectHandle: string, chatId: string, leaseToken: string,
        token: string, approve: boolean): Promise<number | undefined> {
        const root = this.active(projectHandle), pending = this.strategicReviews.get(chatId);
        if (!pending || pending.root !== root || pending.leaseToken !== leaseToken ||
            pending.preview.token !== token || this.leases.get(chatId)?.token !== leaseToken || this.turns.has(chatId) ||
            typeof approve !== 'boolean')
            throw new Error('Strategic draft review is no longer current');
        this.strategicReviews.delete(chatId);
        try {
            await this.repository.renew(root, chatId, leaseToken);
            if (!approve) {
                await this.updateRoadmapAction(root, chatId, pending.messageId, leaseToken,
                    pending.offerId, 'ready', 'rejected');
                return undefined;
            }
            const chat = (await this.repository.read(root)).chats.find(item => item.id === chatId);
            if (!chat) throw new Error('Saved Chat changed before strategic draft acceptance');
            const sourceHash = pending.extractedSourceId ? this.extractedSourceHash(chat, pending.extractedSourceId) :
                createHash('sha256').update(JSON.stringify({ messages: this.roadmapSourceMessages(chat),
                    evidence: (await this.grounder!.ground(root, pending.question)).blocks.map(item => item.ref) })).digest('hex');
            const revision = (await this.greenfield!.acceptStrategicDraft(root, chatId, pending.preview, sourceHash)).revision;
            await this.updateRoadmapAction(root, chatId, pending.messageId, leaseToken,
                pending.offerId, 'ready', 'accepted', { draftRevision: revision });
            return revision;
        } catch (error) {
            await this.updateRoadmapAction(root, chatId, pending.messageId, leaseToken,
                pending.offerId, 'ready', 'failed', { diagnostic: 'Draft acceptance failed. Review the current Roadmap before trying again.' }).catch(() => {});
            throw error;
        } finally { this.greenfield?.rejectStrategicDraft(token); }
    }

    private async retirePending(root: string, chatId: string, leaseToken: string): Promise<void> {
        const chat = (await this.repository.read(root)).chats.find(item => item.id === chatId);
        for (const message of chat?.messages ?? []) {
            if (message.role !== 'assistant' || message.planningActivity?.status !== 'pending' ||
                !message.planningActivity.proposalId) continue;
            await this.repository.recordPlanningActivity(root, chatId, message.id, leaseToken,
                { ...message.planningActivity, status: 'stale' },
                { proposalId: message.planningActivity.proposalId, status: 'pending' });
        }
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

    private async gateProposal(root: string, chatId: string, messageId: string, leaseToken: string,
        output: string, refs: ChatContextPreview['refs']):
        Promise<{ proposal?: ChatPlanningProposal; proposalError?: string;
            roadmapFocus?: ChatTurnResult['roadmapFocus'] }> {
        const ref = refs.find(item => item.kind === 'roadmap');
        if (!ref || !this.planning || !this.roadmapStore) return { proposalError: 'Current Roadmap authority is unavailable' };
        let handle: string | undefined;
        try {
            const value: unknown = JSON.parse(output);
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
            if (value && typeof value === 'object' && !Array.isArray(value) &&
                (value as { type?: string }).type === 'roadmap-gate-undo' &&
                Object.keys(value).length === 1) {
                const undo = this.gateUndo.get(chatId);
                if (!undo || undo.leaseToken !== leaseToken || undo.ownerId !== ref.projectId ||
                    undo.revision !== ref.ownerRevision)
                    throw new Error('No current Chat Roadmap change can be undone');
                const preview = await this.planning.previewUndoEligible({ projectHandle: undo.handle,
                    ownerId: undo.ownerId, expectedRevision: undo.revision, token: undo.token });
                const changedIds = [...new Set([...preview.before.phases, ...preview.before.gates,
                    ...preview.after.phases, ...preview.after.gates].map(item => item.id))].filter(id =>
                    JSON.stringify([...preview.before.phases, ...preview.before.gates].find(item => item.id === id)) !==
                    JSON.stringify([...preview.after.phases, ...preview.after.gates].find(item => item.id === id)));
                const id = randomUUID();
                this.proposals.set(chatId, { id, messageId, leaseToken, changedIds, undo });
                return { proposal: { id, chatId, messageId, ownerId: undo.ownerId,
                    revision: undo.revision, changedIds, action: { type: 'gate-undo', id: changedIds[0] ?? undo.ownerId },
                    summary: gateChatDiff(preview.before, preview.after, changedIds) } };
            }
            if (!validGateChatEnvelope(value) || value.projectId !== ref.projectId ||
                value.ownerRevision !== ref.ownerRevision)
                throw new Error('Stale or invalid Roadmap proposal');
            const attached = await this.planning.attach(root);
            handle = attached.projectHandle;
            const before = attached.snapshot as unknown as RoadmapGateIndex;
            if (before.schemaVersion !== 2 || before.projectId !== ref.projectId ||
                before.revision !== ref.ownerRevision || before.linkedDocument?.sourceHash !== ref.sourceHash ||
                ref.id !== 'roadmap' && !before.phases.some(item => item.id === ref.id) &&
                !before.gates.some(item => item.id === ref.id))
                throw new Error('Roadmap selection or source changed');
            const actions = bindGateChatActions(value.actions);
            const mapped = before.linkedDocument?.sections.find(section =>
                actions.length === 1 && 'id' in actions[0] && section.id === actions[0].id);
            if (mapped) {
                const action = actions[0];
                const kind = action.type === 'phase.edit' ? 'phase' : action.type === 'gate.edit' ? 'gate' :
                    action.type === 'criterion.edit' ? 'criterion' : undefined;
                if (!kind || mapped.kind !== kind || !before.linkedDocument ||
                    before.linkedDocument.syncState !== 'synced')
                    throw new Error('Linked Roadmap structure needs reviewed Markdown synchronization');
                if (action.type !== 'phase.edit' && action.type !== 'gate.edit' &&
                    action.type !== 'criterion.edit') throw new Error('Unsupported linked Roadmap edit');
                const title = action.title;
                const detail = action.type === 'phase.edit' ? action.objective :
                    action.type === 'gate.edit' ? action.purpose : action.expectedResult;
                if (!action.id) throw new Error('Linked Roadmap identity missing');
                const preview = await this.roadmapStore.previewGateDocumentPatch(root,
                    { kind, id: action.id, sourceHash: before.linkedDocument.sourceHash, title, detail });
                this.planning.detach(handle); handle = undefined;
                const id = randomUUID();
                this.proposals.set(chatId, { id, messageId, leaseToken, changedIds: [action.id],
                    document: { root, preview } });
                return { proposal: { id, chatId, messageId, ownerId: before.projectId,
                    revision: before.revision, changedIds: [action.id],
                    action: { type: action.type, id: action.id },
                    summary: `Linked Markdown: ${preview.path}\nSource SHA-256: ${preview.beforeHash}\n` +
                        preview.changedLines.map(line => `- ${line.before}\n+ ${line.after}`).join('\n') } };
            }
            const request: PlanningActionRequest = { projectHandle: handle, ownerId: before.projectId,
                expectedRevision: before.revision, actions,
                ...(before.linkedDocument && ref.sourceHash ?
                    { sourceHashes: Object.fromEntries(before.linkedDocument.sections.map(item => [item.id, ref.sourceHash!])) } : {}) };
            const preview = await this.planning.preview(request);
            const id = randomUUID();
            this.proposals.set(chatId, { id, messageId, leaseToken, handle, request,
                token: preview.token, changedIds: preview.changedIds });
            return { proposal: { id, chatId, messageId, ownerId: before.projectId, revision: before.revision,
                changedIds: preview.changedIds, action: { type: actions.length > 1 ? 'gate-sequence' : actions[0].type,
                    id: 'id' in actions[0] ? actions[0].id ?? before.projectId : before.projectId },
                summary: gateChatDiff(before, preview.next as unknown as RoadmapGateIndex, preview.changedIds) } };
        } catch (error) {
            if (handle) this.planning.detach(handle);
            return { proposalError: `Roadmap proposal rejected: ${String(error)}` };
        }
    }

    private async proposal(root: string, chatId: string, messageId: string, leaseToken: string,
        output: string, refs: ChatContextPreview['refs'], draft?: { handle: string; revision: number; projectId: string }):
        Promise<{ proposal?: ChatPlanningProposal; proposalError?: string;
            roadmapFocus?: ChatTurnResult['roadmapFocus'] }> {
        if (!output.trimStart().startsWith('{')) return {};
        if (refs.some(ref => ref.kind === 'roadmap'))
            return this.gateProposal(root, chatId, messageId, leaseToken, output, refs);
        if (!draft && (!this.planning || !refs.some(ref => ref.kind === 'roadmap-checkpoint'))) return {};
        let handle: string | undefined;
        try {
            if (Buffer.byteLength(output, 'utf8') > 32768) throw new Error('Planning proposal exceeds the size limit');
            const value: unknown = JSON.parse(output);
            if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid planning proposal');
            const raw = value as Record<string, unknown>;
            if (raw.type === 'no-action' && Object.keys(raw).sort().join(',') === 'message,type' &&
                typeof raw.message === 'string' && raw.message.length <= 4000) return {};
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

    private async planProposal(root: string, chatId: string, messageId: string, leaseToken: string,
        output: string, refs: ChatContextPreview['refs'], requirements: readonly PlanRequirement[]):
        Promise<{ proposal?: ChatPlanningProposal; proposalError?: string;
            planPreview?: ChatTurnResult['planPreview'] }> {
        try {
            const plan: unknown = JSON.parse(output);
            if (!validImplementationPlan(plan) || !this.greenfield) throw new Error('Invalid implementation plan');
            const bound = this.greenfield.chatImplementationPlan(root, chatId);
            if (!bound?.planOnly) throw new Error('Implementation plan binding changed');
            const draft = this.greenfield.read(bound.handle);
            const owner = await this.greenfield.owner(root);
            if (owner.projectId !== this.greenfield.draftProjectId(bound.handle) ||
                owner.revision !== (bound.ownerRevision ?? 0) || owner.pendingCreation)
                throw new Error('Implementation plan owner changed');
            const verified = new Map(refs.filter(ref => ref.kind === 'file' && ref.sourceHash && ref.includedBytes)
                .map(ref => [ref.id, ref.sourceHash!]));
            for (const [path, expected] of verified) {
                const current = await this.grounder?.readFile(root, path);
                if (current?.blocks[0]?.ref.contentHash !== expected || current.diagnostics.length)
                    throw new Error('Project source changed during planning');
                const supplied = refs.find(ref => ref.kind === 'file' && ref.id === path);
                if (supplied?.projectId && current.blocks[0].ref.projectId !== supplied.projectId)
                    throw new Error('Foreign project evidence');
            }
            const coverage = planRequirementCoverage(requirements, plan);
            if (coverage.some(item => !item.complete)) return {
                proposalError: 'Plan needs work before it can be accepted. Review the requirements below and ask Chat to revise the plan.',
                planPreview: { coverage: coverage.map(item => ({ id: item.requirement.id, text: item.requirement.text,
                    status: item.status, explanation: item.explanation, stepNumbers: item.stepNumbers })) },
            };
            const evidence = [...new Set(plan.steps.flatMap(step => step.reuse.map(item => item.path)))]
                .filter(path => verified.has(path)).map(path => ({ id: randomUUID(), path, sha256: verified.get(path)! }));
            const evidenceIds = new Map(evidence.map(item => [item.path, item.id]));
            const input: ImplementationPlanInput = { objective: `${plan.objective} Success: ${plan.successCriteria.join('; ')}`,
                constraints: plan.constraints, evidence,
                decisions: plan.assumptions.map(text => ({ text, origin: 'model-assumption' })),
                steps: plan.steps.map((step, index) => ({ title: step.title,
                    detail: [step.detail, ...step.reuse.filter(item => !verified.has(item.path))
                        .map(item => `Unverified reuse ${item.path}: ${item.reason}`),
                        ...(index === plan.steps.length - 1 ? [
                            `Tests: ${plan.tests.join('; ')}`, `GUI qualification: ${plan.guiQualification}`,
                            `Risks: ${plan.risks.join('; ')}`, `Alternatives: ${plan.alternatives.join('; ')}`,
                            ...(plan.question ? [`Question: ${plan.question}`] : [])] : [])].join(' | '),
                    expectedOutputs: step.deliverables,
                    dependencies: step.dependsOn.map(number => `step:${number}`),
                    evidenceIds: step.reuse.flatMap(item => {
                        const id = evidenceIds.get(item.path);
                        return id ? [id] : [];
                    }) })) };
            const preview = await this.greenfield.previewImplementationPlan(bound.handle, draft.revision,
                bound.plan?.revision ?? 0, input, 'model');
            const stepIds = preview.after.steps.map(step => step.id);
            const id = randomUUID();
            this.proposals.set(chatId, { id, messageId, leaseToken, changedIds: stepIds,
                plan: { handle: bound.handle, preview } });
            return { proposal: { id, chatId, messageId, ownerId: preview.after.source.projectId,
                revision: preview.planRevision, changedIds: stepIds,
                action: { type: 'implementation-plan', id: stepIds[0] },
                summary: JSON.stringify({ before: preview.before, after: preview.after, coverage }) } };
        } catch (error) {
            return { proposalError: `Implementation plan rejected: ${String(error)}` };
        }
    }

    private async planRevisionProposal(root: string, chatId: string, messageId: string, leaseToken: string,
        output: string, expectedRevision: number, refs: ChatContextPreview['refs']): Promise<{
        proposal?: ChatPlanningProposal; proposalError?: string }> {
        try {
            const raw: unknown = JSON.parse(output);
            if (!validImplementationPlanRevision(raw) || !this.greenfield)
                throw new Error('Invalid implementation plan revision');
            const bound = this.greenfield.chatImplementationPlan(root, chatId);
            if (!bound?.planOnly || !bound.plan) throw new Error('Implementation plan binding changed');
            const revision = raw as ImplementationPlanRevision;
            if (bound.plan.revision !== expectedRevision) throw new Error('Stale implementation plan revision');
            for (const ref of refs.filter(item => item.kind === 'file' && item.sourceHash && item.includedBytes)) {
                const current = await this.grounder?.readFile(root, ref.id);
                if (!current || current.blocks[0]?.ref.contentHash !== ref.sourceHash || current.diagnostics.length)
                    throw new Error('Cited project source changed during plan revision');
            }
            const input = reviseImplementationPlan(bound.plan, revision);
            const preview = await this.greenfield.previewImplementationPlan(bound.handle,
                this.greenfield.read(bound.handle).revision, revision.baseRevision, input, 'model');
            const before = new Map(preview.before!.steps.map(step => [step.id, step]));
            const after = new Map(preview.after.steps.map(step => [step.id, step]));
            const changedIds = [...new Set([...before.keys(), ...after.keys()])].filter(id =>
                JSON.stringify(before.get(id)) !== JSON.stringify(after.get(id)) ||
                preview.before!.steps.findIndex(step => step.id === id) !==
                preview.after.steps.findIndex(step => step.id === id));
            if (!changedIds.length && JSON.stringify(preview.before!.constraints) === JSON.stringify(preview.after.constraints) &&
                JSON.stringify(preview.before!.decisions) === JSON.stringify(preview.after.decisions))
                throw new Error('Implementation plan revision has no effect');
            const id = randomUUID();
            this.proposals.set(chatId, { id, messageId, leaseToken, changedIds,
                plan: { handle: bound.handle, preview } });
            return { proposal: { id, chatId, messageId, ownerId: preview.after.source.projectId,
                revision: preview.planRevision, changedIds,
                action: { type: 'implementation-plan-revision', id: changedIds[0] ?? preview.after.steps[0]?.id ?? id },
                summary: JSON.stringify({ before: preview.before, after: preview.after }) } };
        } catch (error) { return { proposalError: `Implementation plan revision rejected: ${String(error)}` }; }
    }

    async decidePlanningProposal(projectHandle: string, chatId: string, leaseToken: string,
        proposalId: string, approve: boolean): Promise<{ revision: number; changedIds: string[] } | undefined> {
        const root = this.active(projectHandle);
        const pending = this.proposals.get(chatId);
        if (!pending || pending.id !== proposalId || pending.leaseToken !== leaseToken ||
            typeof approve !== 'boolean') throw new Error('Planning proposal unavailable');
        await this.repository.renew(root, chatId, leaseToken);
        const message = (await this.repository.read(root)).chats.find(chat => chat.id === chatId)
            ?.messages.find(item => item.id === pending.messageId);
        if (message?.role !== 'assistant' || message.execution.status !== 'complete')
            throw new Error('Planning proposal is not a completed Chat turn');
        this.proposals.delete(chatId);
        const activity = message.planningActivity;
        if (!activity || activity.status !== 'pending' || activity.proposalId !== proposalId)
            throw new Error('Planning activity is not pending');
        const record = async (status: ChatPlanningActivity['status'], appliedRevision?: number) => {
            await this.repository.recordPlanningActivity(root, chatId, pending.messageId, leaseToken,
                { ...activity, status, ...(appliedRevision === undefined ? {} : { appliedRevision }) },
                { proposalId, status: 'pending' });
            tracePlanning('decision-recorded', chatId, pending.messageId, status);
        };
        let appliedRevision: number | undefined;
        try {
            tracePlanning('decision-requested', chatId, pending.messageId, approve ? 'approve' : 'reject');
            if (!approve) { await record('denied'); if (pending.draft) this.greenfield?.clearEditPreview(pending.draft.handle);
                if (pending.plan) this.greenfield?.clearImplementationPlanPreview(pending.plan.handle);
                return undefined; }
            if (pending.document) {
                if (!this.roadmapStore || pending.document.root !== root) throw new Error('Linked Roadmap owner changed');
                const result = await this.roadmapStore.publishGateDocumentPatch(root, pending.document.preview, true);
                appliedRevision = result.revision;
                await record('applied', result.revision);
                return { revision: result.revision, changedIds: pending.changedIds };
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
            if (pending.plan) {
                if (!this.greenfield || this.greenfield.chatImplementationPlan(root, chatId)?.handle !== pending.plan.handle)
                    throw new Error('Implementation plan binding changed');
                const result = await this.greenfield.applyImplementationPlan(pending.plan.handle, pending.plan.preview, true);
                appliedRevision = result.revision;
                if (pending.plan.preview.before) this.planUndo.set(chatId, {
                    handle: pending.plan.handle, leaseToken, revision: result.revision });
                else this.planUndo.delete(chatId);
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
            if (pending.plan && appliedRevision === undefined) this.greenfield?.clearImplementationPlanPreview(pending.plan.handle);
            if (appliedRevision !== undefined)
                throw new Error(`Planning write completed at revision ${appliedRevision}, but Chat activity could not be recorded; reread the Roadmap: ${String(error)}`);
            if ((await this.repository.read(root)).chats.find(chat => chat.id === chatId)?.messages
                .some(item => item.id === pending.messageId && item.role === 'assistant' &&
                    item.planningActivity?.status === 'pending'))
                await record(/stale|source|hash|conflict/i.test(String(error)) ? 'stale' : 'rejected');
            throw error;
        } finally { if (pending.handle && this.gateUndo.get(chatId)?.handle !== pending.handle)
            this.planning?.detach(pending.handle); }
    }

    async undoPlanningRevision(projectHandle: string, chatId: string, leaseToken: string,
        expectedRevision: number): Promise<number> {
        const root = this.active(projectHandle), undo = this.planUndo.get(chatId);
        if (!undo || undo.leaseToken !== leaseToken || undo.revision !== expectedRevision ||
            this.proposals.has(chatId) || this.turns.has(chatId) ||
            this.greenfield?.chatImplementationPlan(root, chatId)?.handle !== undo.handle)
            throw new Error('Stale implementation plan undo');
        await this.repository.renew(root, chatId, leaseToken);
        this.planUndo.delete(chatId);
        return (await this.greenfield!.undoImplementationPlan(undo.handle, expectedRevision)).revision;
    }

    async runTurn(request: ChatTurnRequest): Promise<ChatTurnResult> {
        const root = this.active(request.projectHandle);
        // Only this exact developer-authored phrase can resolve the current saved Chat offer.
        // Retries and quoted/embedded affirmatives never carry generation consent.
        if (!request.retryMessageId && /^yes,?\s+create the roadmap[.!]?$/i.test(request.content?.trim() ?? '')) {
            const offer = this.proposals.get(request.chatId)?.roadmapOffer;
            if (!offer) throw new Error('No current Roadmap offer in this Chat; request a new offer first');
            const decision = await this.decideRoadmapOffer(request.projectHandle, request.chatId,
                request.leaseToken, offer.id, offer.token, true, request.selectedModel);
            return { refs: [], diagnostics: [], usedTokens: 0, budgetTokens: 0,
                ...(decision === 'declined' ? {} : { roadmapDraftReview: decision }) };
        }
        if (!this.models || this.turns.has(request.chatId)) throw new Error('Chat turn already active or runtime unavailable');
        const snapshot = await this.repository.read(root);
        const chat = snapshot.chats.find(item => item.id === request.chatId);
        if (!chat) throw new Error('Chat not found');
        const roadmapIntent = !request.retryMessageId && !request.bridgeProposal && !request.planningSteps &&
            !(request.context ?? []).length ? roadmapCreationIntent(request.content ?? '') : undefined;
        if (roadmapIntent === 'ambiguous')
            throw new Error('Do you want to create a reviewable Roadmap draft from the saved planning answer?');
        if (roadmapIntent === 'create') {
            await this.repository.renew(root, request.chatId, request.leaseToken);
            if (!this.greenfield) throw new Error('Roadmap owner is unavailable');
            const state = await this.greenfield.readOpportunity(root);
            const candidates = chat.messages.filter(item => item.role === 'assistant' &&
                item.execution.status === 'complete' && (() => {
                    try { extractSavedRoadmap(chat, item, state.projectId, state.revision); return true; }
                    catch { return false; }
                })());
            if (candidates.length !== 1)
                throw new Error(candidates.length ? 'Multiple saved planning answers are suitable; choose one before creating a Roadmap' :
                    'No unique completed phase sequence is available; ask Chat for a new ordered phase plan first');
            const source = candidates[0];
            const pending = this.proposals.get(request.chatId)?.roadmapOffer;
            if (source.role === 'assistant' && source.roadmapAction && pending?.messageId !== source.id)
                throw new Error('This saved answer already has a Roadmap decision; ask Chat for a revised phase plan');
            const offer = pending?.messageId === source.id ? pending : await this.offerRoadmap(root,
                request.chatId, source.id, request.leaseToken, undefined, source.content, true);
            if (!offer) throw new Error('Roadmap owner or competing draft prevents a new proposal; review Roadmap first');
            const review = await this.decideRoadmapOffer(request.projectHandle, request.chatId,
                request.leaseToken, offer.id, offer.token, true);
            return { refs: [], diagnostics: [], usedTokens: 0, budgetTokens: 0,
                ...(review === 'declined' ? {} : { roadmapDraftReview: review }) };
        }
        const priorOffer = this.proposals.get(request.chatId);
        if (priorOffer?.roadmapOffer) {
            await this.updateRoadmapAction(root, request.chatId, priorOffer.messageId, request.leaseToken,
                priorOffer.roadmapOffer.id, 'offered', 'stale').catch(() => {});
        }
        const priorReview = this.strategicReviews.get(request.chatId);
        const relevantReviewChange = /\b(?:roadmap|phase|gate|criterion|criteria|checkpoint|tower|enemy|health|currency|money|abilit(?:y|ies))\b/i.test(request.content ?? '');
        if (priorReview && relevantReviewChange) { this.greenfield?.rejectStrategicDraft(priorReview.preview.token);
            await this.updateRoadmapAction(root, request.chatId, priorReview.messageId, request.leaseToken,
                priorReview.offerId, 'ready', 'stale').catch(() => {});
            this.strategicReviews.delete(request.chatId); }
        await this.repository.renew(root, request.chatId, request.leaseToken);
        await this.retirePending(root, request.chatId, request.leaseToken);
        this.clearProposal(request.chatId);
        const retryIndex = request.retryMessageId ? chat.messages.findIndex(item => item.id === request.retryMessageId) : -1;
        const content = request.retryMessageId ? (() => {
            if (retryIndex < 1 || chat.messages[retryIndex].role !== 'assistant' ||
                !['failed', 'cancelled'].includes((chat.messages[retryIndex] as ChatAssistantMessage).execution.status) ||
                chat.messages[retryIndex - 1].role !== 'user') throw new Error('Only a failed or cancelled attempt can be retried');
            return chat.messages[retryIndex - 1].content;
        })() : request.content?.trim() ?? '';
        const contextChat = retryIndex < 0 ? chat : { ...chat, messages: chat.messages.slice(0, retryIndex - 1) };
        const helpTurn = !!selectDopeCapabilityHelp(content);
        const draft = helpTurn ? undefined : await this.draftContext(root, request.chatId, request.planningSteps);
        let planBinding = !helpTurn ? this.greenfield?.chatImplementationPlan(root, request.chatId) : undefined;
        if (!helpTurn && !draft && !planBinding && !request.bridgeProposal && !request.planningSteps &&
            !(request.context ?? []).some(item => item.kind === 'roadmap-checkpoint' || item.kind === 'planning-map') &&
            requestsImplementationPlan(content)) {
            if (!this.greenfield || !this.grounder) throw new Error('Implementation planning is unavailable');
            const owner = await this.greenfield.owner(root);
            if (owner.revision !== 0 || owner.linkedDocument || owner.pendingCreation)
                throw new Error('This Roadmap already has an owner; review it before starting a new implementation plan');
            const started = await this.greenfield.beginImplementationPlan(root);
            try { this.greenfield.bindChat(root, started.handle, request.chatId); }
            catch (error) { this.greenfield.cancel(started.handle); throw error; }
            planBinding = this.greenfield.chatImplementationPlan(root, request.chatId);
        }
        const planOnly = planBinding?.planOnly === true;
        const requirements = planOnly && !planBinding?.plan ? planRequirements(content) : [];
        if (planOnly && !this.grounder) throw new Error('Project investigation unavailable');
        const bridgeSelection = request.bridgeProposal;
        if (bridgeSelection && (helpTurn || draft || request.planningSteps || !this.bridgePlanning ||
            (request.context ?? []).filter(item => item.kind === 'roadmap-checkpoint' &&
                item.id === bridgeSelection.checkpointId && item.projectId === bridgeSelection.projectId &&
                item.ownerRevision === bridgeSelection.roadmapRevision).length !== 1))
            throw new Error('Bridge proposal requires one current selected checkpoint and a Planning owner');
        const bridge = bridgeSelection ? await BridgeLocalProposal.prepare(this.bridgePlanning!, root, bridgeSelection) : undefined;
        const roadmapTurn = (request.context ?? []).some(item => item.kind === 'roadmap-checkpoint' || item.kind === 'roadmap') ||
            !!draft || helpTurn || !!bridge || planOnly;
        const opportunity = await this.roadmapOpportunity(root, content, !roadmapTurn &&
            !(request.context ?? []).some(item => item.kind === 'planning-map'));
        if (request.planningSteps !== undefined && (![2, 3].includes(request.planningSteps) ||
            !roadmapTurn || helpTurn || !draft &&
            (request.context ?? []).filter(item => item.kind === 'roadmap-checkpoint').length !== 1))
            throw new Error('Small-step planning requires a bound draft or one unlinked Roadmap checkpoint and a cap of two or three');
        const planningPrompt = planOnly ? { text: planBinding?.plan ? planRevisionInstruction(planBinding.plan) :
            firstPlanInstruction(requirements) } :
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
        if ((draft || bridge || planOnly) && connection.providerId !== 'local') throw new Error('Planning requires a selected local model');
        if (connection.providerId !== 'local' && request.hostedProjectDataAuthorized !== true)
            throw new Error('Chat hosted project-data confirmation required');
        const controls = chat.settings.reasoningControls ?? {};
        for (const [id, value] of Object.entries(controls))
            if (!model.capabilities.reasoningControls?.some(control => control.id === id && control.values.includes(value)))
                throw new ModelRuntimeFailure('Selected model does not support the saved reasoning control', 'unsupported-capability');
        if (!this.composer) throw new Error('Context composer unavailable');
        const localRoadmap = roadmapTurn && connection.providerId === 'local';
        const planningOutput = planOnly ? Math.max(2048, chat.settings.context.reservedOutputTokens) : chat.settings.context.reservedOutputTokens;
        const budget = localRoadmap ? roadmapLocalBudget(model.capabilities.contextWindowTokens,
            planningOutput, model.capabilities) : undefined;
        if (planOnly && budget!.output < 2048) throw new Error('Selected local model has insufficient plan output capacity');
        const grounding = planOnly ? await this.grounder?.investigateIdea(root, content) : await this.grounder?.ground(root, content);
        const priorRefs = retryIndex >= 0 ? (chat.messages[retryIndex - 1] as ChatUserMessage).contextRefs : undefined;
        if (priorRefs && !sameAutomaticEvidence(grounding, priorRefs))
            throw new Error('Retry project evidence changed or is stale; start a fresh turn');
        const composed = await this.composeTurn(root, contextChat, content, request.context ?? [],
            model.capabilities, budget, planningPrompt, grounding, !!bridge, opportunity);
        if (bridge) composed.refs.push(bridge.reference);
        if ((request.context ?? []).some(item => item.kind === 'roadmap-checkpoint' || item.kind === 'roadmap') &&
            !composed.refs.some(ref => ref.kind === 'roadmap-checkpoint' || ref.kind === 'roadmap'))
            throw new Error('Selected Roadmap context does not fit; shorten the request or select a larger local model');
        let localMode: 'linked' | 'unlinked' | 'draft' | 'gate' | 'help' | 'bridge' | 'plan' | 'plan-revision' =
            bridge ? 'bridge' : planOnly ? planBinding?.plan ? 'plan-revision' : 'plan' :
                helpTurn ? 'help' : draft ? 'draft' :
                    composed.refs.some(item => item.kind === 'roadmap') ? 'gate' : 'unlinked';
        let eligibleObjective = true;
        if (localRoadmap && localMode !== 'gate' && !draft && !helpTurn && !planOnly && this.planning) {
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
        const userMessageId = retryIndex >= 0 ? chat.messages[retryIndex - 1].id : randomUUID();
        let output = '';
        let actual: ChatModelProvenance = { schemaVersion: 1, connectionId: connection.id,
            modelId: model.id, providerId: connection.providerId, modelLabel: model.label };
        let routingProvenance: RoutingProvenance | undefined;
        const sourceRefs: NonNullable<ChatAssistantMessage['execution']['sourceRefs']> = [];
        const toolEvents: NonNullable<ChatAssistantMessage['execution']['toolEvents']> = [];
        let toolBytes = 0;
        const projectTools = this.grounder ? { root,
            execute: async (name: string, args: unknown, signal?: AbortSignal): Promise<string> => {
                if (signal?.aborted || this.active(request.projectHandle) !== root ||
                    this.turns.get(key)?.abort !== abort) throw new Error('Project discovery cancelled');
                if (toolEvents.length >= 16) throw new Error('Project discovery limit reached');
                if (name === 'dope_command') {
                    const record = args as Record<string, unknown>;
                    if (!record || typeof record !== 'object' || Array.isArray(record) ||
                        Object.keys(record).length !== 1 || typeof record.command !== 'string') {
                        toolEvents.push({ name, status: 'denied', truncated: false });
                        return 'Command denied: invalid request';
                    }
                    if (toolBytes >= 32 * 1024) {
                        toolEvents.push({ name, status: 'denied', truncated: false });
                        return 'Command denied: Chat tool output limit reached';
                    }
                    const basis = createHash('sha256').update(JSON.stringify(preview.refs)).digest('hex');
                    let approved: boolean;
                    try { approved = await this.requestCommand(root, request, record.command, abort, basis); }
                    catch {
                        toolEvents.push({ name, status: 'denied', truncated: false });
                        return 'Command denied: invalid or unavailable request; no execution occurred';
                    }
                    if (!approved) {
                        toolEvents.push({ name, status: 'denied', truncated: false });
                        return 'Command denied or expired; no execution occurred';
                    }
                    if (signal?.aborted || abort.signal.aborted || this.disposed ||
                        this.active(request.projectHandle) !== root ||
                        this.turns.get(key)?.abort !== abort ||
                        this.leases.get(key)?.token !== request.leaseToken) {
                        toolEvents.push({ name, status: 'denied', truncated: false });
                        return 'Command denied: Chat turn or project is no longer active';
                    }
                    const currentChat = (await this.repository.read(root).catch(() => undefined))?.chats
                        .find(item => item.id === key);
                    const currentUser = currentChat?.messages.filter(item => item.role === 'user').at(-1);
                    if (!currentUser || createHash('sha256').update(JSON.stringify(currentUser.contextRefs)).digest('hex') !==
                        basis) {
                        toolEvents.push({ name, status: 'denied', truncated: false });
                        return 'Command denied: Chat source basis changed';
                    }
                    const commandSignal = signal ? AbortSignal.any([signal, abort.signal]) : abort.signal;
                    const result = await runChatInvestigationCommand(root, record.command, commandSignal);
                    const output = Buffer.from(result.output, 'utf8');
                    const remaining = 32 * 1024 - toolBytes;
                    const truncated = result.truncated || output.length > remaining;
                    const bounded = output.subarray(0, remaining).toString('utf8');
                    toolBytes += Buffer.byteLength(bounded);
                    toolEvents.push({ name, status: result.executed ? 'completed' : 'denied',
                        truncated });
                    return bounded;
                }
                const allowed = ['dope_read', 'dope_list', 'dope_search_paths', 'dope_search_text'] as const;
                if (!allowed.includes(name as typeof allowed[number]) || !args || typeof args !== 'object' ||
                    Array.isArray(args)) throw new Error('Project discovery tool denied');
                const field = name === 'dope_read' || name === 'dope_list' ? 'path' : 'query';
                const record = args as Record<string, unknown>;
                if (Object.keys(record).length !== 1 || typeof record[field] !== 'string')
                    throw new Error('Project discovery arguments denied');
                const toolName = name as typeof allowed[number];
                try {
                    const result = name === 'dope_read' ? await this.grounder!.readFile(root, record.path as string) :
                        name === 'dope_list' ? await this.grounder!.listDirectory(root, record.path as string) :
                        name === 'dope_search_paths' ? await this.grounder!.searchPaths(root, record.query as string) :
                        await this.grounder!.searchText(root, record.query as string);
                    if (signal?.aborted || this.active(request.projectHandle) !== root) throw new Error('Project discovery cancelled');
                    const block = result.blocks[0];
                    const remaining = Math.max(0, Math.min(8192, 32 * 1024 - toolBytes));
                    if (!block || !remaining) throw new Error('Project discovery output limit reached');
                    const excerpt = Buffer.from(block.text, 'utf8').subarray(0, remaining).toString('utf8').replace(/\uFFFD+$/, '');
                    const truncated = excerpt !== block.text || result.diagnostics.some(item =>
                        item.kind === 'truncated' || item.kind === 'omitted');
                    toolBytes += Buffer.byteLength(excerpt);
                    sourceRefs.push({ ...block.ref, includedBytes: Buffer.byteLength(excerpt),
                        estimatedTokens: Math.ceil(Buffer.byteLength(excerpt) / 3) + 4,
                        contentHash: createHash('sha256').update(excerpt).digest('hex') });
                    toolEvents.push({ name: toolName, status: 'completed', truncated });
                    return JSON.stringify({ source: block.ref.id, kind: block.ref.kind,
                        contentHash: sourceRefs.at(-1)!.contentHash, sourceHash: block.ref.sourceHash, truncated,
                        omitted: result.diagnostics.some(item => item.kind === 'omitted'), text: excerpt });
                } catch {
                    toolEvents.push({ name: toolName, status: 'denied', truncated: false });
                    throw new Error('Project discovery denied or unavailable');
                }
            } } : undefined;
        try {
            if (this.pendingCancel.get(key) === request.leaseToken) abort.abort();
            if (!request.retryMessageId) {
                if (!request.content?.trim()) throw new Error('Enter a message before sending');
                const user: ChatUserMessage = { schemaVersion: 1, id: userMessageId, role: 'user',
                    createdAt: new Date().toISOString(), content: request.content.trim(), contextRefs: preview.refs };
                await mutate({ type: 'append-user', chatId: key, message: user });
            }
            const now = new Date().toISOString();
            assistant = { schemaVersion: 1, id: randomUUID(), role: 'assistant', createdAt: now, content: '',
                execution: { schemaVersion: 1, id: randomUUID(), status: 'pending',
                    selectedModel: { ...selectedModel }, resolutionSource: following ? 'role-policy' :
                        request.selectedModel ? 'explicit-turn' : 'chat-exact-default',
                    startedAt: now } };
            await mutate({ type: 'begin-assistant', chatId: key, message: assistant });
            if (localRoadmap) tracePlanning('submitted', key, assistant.id);
            if (localRoadmap) this.planningProgress(key, assistant.id, 'waiting');
            if (!following) {
                await mutate({ type: 'start-assistant', chatId: key, messageId: assistant.id, actualModel: actual });
            }
            let sequence = 0;
            const withRetryInstruction = (messages: readonly ConversationMessage[], instruction?: string): readonly ConversationMessage[] => {
                const sent = instruction ? [{ role: 'system' as const, content: instruction }, ...messages] : messages;
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
                    const next = await this.composeTurn(root, contextChat, content, request.context ?? [],
                        resolvedModel.capabilities, nextBudget, planningPrompt, grounding, !!bridge, opportunity);
                    if (bridge) next.refs.push(bridge.reference);
                    if (!sameRefIdentities(next.refs, preview.refs))
                        throw new Error('Fallback evidence differs; choose a model explicitly');
                    if (JSON.stringify(next.refs) !== JSON.stringify(preview.refs)) {
                        await mutate({ type: 'revise-user-context', chatId: key, userMessageId,
                            assistantMessageId: assistant!.id, contextRefs: next.refs });
                    }
                    preview = { refs: next.refs, diagnostics: next.diagnostics,
                        usedTokens: next.usedTokens, budgetTokens: next.budgetTokens };
                    return { messages: withRetryInstruction(this.withDraft(next.messages, planningPrompt), retryInstruction), controls, signal: abort.signal,
                        ...(resolvedConnection?.providerId === 'local' && projectTools ? { projectTools } : {}),
                        ...(planningOutput > 0 ?
                        { maxOutputTokens: nextBudget?.output ?? planningOutput } : {}) };
                } }) : this.models!.generate(selectedModel!,
                { messages: withRetryInstruction(this.withDraft(composed.messages, planningPrompt), retryInstruction), controls, signal: abort.signal,
                    ...(connection.providerId === 'local' && projectTools ? { projectTools } : {}),
                    ...(planningOutput > 0 ?
                        { maxOutputTokens: budget?.output ?? planningOutput } : {}) },
                localRoadmap ? { localOnly: true } : undefined);
            const events = localRoadmap ? (async function* (backend: ChatBackend) {
                const guardedGenerate = async function* (retryInstruction?: string) {
                    if (!following) await backend.verifyLoadedCapacity(selectedModel!, budget!, planningOutput);
                    yield* generate(retryInstruction);
                };
                const requestedRevision = !draft && requestsRoadmapOwnerRevision(content) ?
                    preview.refs.find(ref => ref.kind === 'roadmap-checkpoint')?.ownerRevision : undefined;
                const complete = await localPlanningJson(guardedGenerate, abort.signal, budget!.maxOutputBytes,
                    localMode, eligibleObjective, { requiredOwnerRevision: requestedRevision,
                        maxSteps: request.planningSteps,
                        validateBridge: bridge ? value => bridge.validate(value) : undefined,
                        onRetry: cause => tracePlanning('retry', key, assistant!.id, cause) });
                await backend.verifyLoadedCapacity(selectedModel!, budget!, planningOutput);
                tracePlanning('validated', key, assistant!.id);
                yield complete;
            })(this) : generate();
            for await (const event of events) {
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
                    await this.repository.publishDelta(root, key, assistant.id, assistant.execution.id,
                        sequence++, event.text, request.leaseToken);
                } else {
                    output = event.text;
                    if (localRoadmap) this.planningProgress(key, assistant.id, 'validating');
                    if (event.provenance) actual = { schemaVersion: 1, ...event.provenance };
                    else if (event.actualModelId) actual = { ...actual, modelId: event.actualModelId };
                    if (following) {
                        const route = (event as Extract<RoutedConversationEvent, { type: 'complete' }>).routingProvenance;
                        routingProvenance = route;
                        actual = { schemaVersion: 1, connectionId: route.actualTarget.connectionId,
                            modelId: route.actualTarget.modelId, providerId: route.executionLabels.provider,
                            modelLabel: route.executionLabels.model };
                        if (sequence === 0) await mutate({ type: 'start-assistant', chatId: key, messageId: assistant.id,
                            actualModel: actual, routingProvenance });
                    } else {
                        routingProvenance = exactRoutingProvenance(request.selectedModel ? 'explicit-turn' : 'chat-exact-default',
                            { connectionId: actual.connectionId, modelId: actual.modelId }, requestHard,
                            { connection: connection.label ?? connection.id, provider: actual.providerId,
                                model: actual.modelLabel });
                    }
                    if (localRoadmap && abort.signal.aborted)
                        throw new ModelRuntimeFailure('Local planning cancelled', 'cancelled');
                    if (planOnly && (actual.connectionId !== selectedModel!.connectionId ||
                        actual.modelId !== selectedModel!.modelId || actual.providerId !== 'local'))
                        throw new ModelRuntimeFailure('Selected local planning model changed during inference', 'model-unavailable');
                    const completed = await mutate({ type: 'finish-assistant', chatId: key, messageId: assistant.id,
                        outcome: 'complete', content: output, actualModel: actual, routingProvenance,
                        contextUsage: { usedTokens: preview.usedTokens, budgetTokens: preview.budgetTokens },
                        tokenUsage: event.usage, ...(event.compaction ? { compaction: event.compaction } : {}),
                        ...(event.finishReason ? { finishReason: event.finishReason } : {}),
                        ...(toolEvents.length ? { sourceRefs, toolEvents } : {}) });
                    const titledChat = completed.chats.find(item => item.id === key);
                    const index = titledChat?.messages.findIndex(message => message.id === assistant!.id) ?? -1;
                    const preceding = index > 0 ? titledChat!.messages[index - 1] : undefined;
                    if (!roadmapTurn && titledChat?.titleSource === 'placeholder' && preceding?.role === 'user' &&
                        !titledChat.messages.slice(0, index).some(message =>
                            message.role === 'assistant' && message.execution.status === 'complete'))
                        void this.automaticTitle(root, key, preceding, assistant.id, output, actual);
                    if (abort.signal.aborted && !localRoadmap) return preview;
                    const result = planOnly ? localMode === 'plan-revision' ?
                        (JSON.parse(output) as { type: string }).type === 'no-action' ? {} :
                            await this.planRevisionProposal(root, key, assistant.id, request.leaseToken, output,
                                planBinding!.plan!.revision, preview.refs) :
                        await this.planProposal(root, key, assistant.id, request.leaseToken, output, preview.refs, requirements) :
                        helpTurn || bridge ? {} : await this.proposal(root, key, assistant.id,
                            request.leaseToken, output, preview.refs, draft);
                    if (localRoadmap) {
                        const kind = (JSON.parse(output) as { type: ChatPlanningActivity['kind'] }).type;
                        await this.repository.recordPlanningActivity(root, key, assistant.id, request.leaseToken,
                            { schemaVersion: 1, kind, refs: preview.refs,
                                status: kind === 'no-action' || kind === 'roadmap-gate-focus' &&
                                    'roadmapFocus' in result && result.roadmapFocus ?
                                    'no-action' : bridge && kind === 'bridge-proposal' ? 'suggested' :
                                    result.proposal ? 'pending' : 'rejected',
                                ...(helpTurn && kind === 'no-action' && composed.verifiedGuidance ?
                                    { verifiedGuidance: composed.verifiedGuidance } : {}),
                                ...(result.proposal ? { proposalId: result.proposal.id } : {}) });
                        tracePlanning('result-recorded', key, assistant.id,
                            kind === 'no-action' || kind === 'roadmap-gate-focus' &&
                                'roadmapFocus' in result && result.roadmapFocus ?
                                'no-action' : bridge && kind === 'bridge-proposal' ? 'suggested' :
                                result.proposal ? 'pending' : 'rejected');
                    }
                    const roadmapOffer = !request.retryMessageId && !localRoadmap &&
                        !bridgeSelection && !request.planningSteps && !planOnly ?
                        await this.offerRoadmap(root, key, assistant.id, request.leaseToken, opportunity, output)
                            .catch(() => undefined) : undefined;
                    return { ...preview, ...result, ...(roadmapOffer ? { roadmapOffer } : {}) };
                }
            }
            throw new Error('Model stream ended without completion');
        } catch (error) {
            if (this.proposals.get(key)?.messageId === assistant?.id) this.clearProposal(key);
            if (assistant) {
                if (localRoadmap && error instanceof LocalPlanningOutputFailure && error.rawText)
                    output = error.rawText;
                const cancelled = abort.signal.aborted || error instanceof ModelRuntimeFailure && error.failureClass === 'cancelled';
                const failure = error instanceof ModelRuntimeFailure ? error.message : 'Conversation failed';
                try { await mutate({ type: 'finish-assistant', chatId: key, messageId: assistant.id,
                    outcome: cancelled ? 'cancelled' : 'failed', content: output,
                    contextUsage: { usedTokens: preview.usedTokens, budgetTokens: preview.budgetTokens },
                    ...(toolEvents.length ? { sourceRefs, toolEvents } : {}),
                    ...(!cancelled ? { failure } : {}) }); }
                catch { /* A lost lease or newer revision is recovered by ChatRepository. */ }
                if (localRoadmap) try {
                    await this.repository.recordPlanningActivity(root, key, assistant.id, request.leaseToken,
                        { schemaVersion: 1, kind: cancelled ? 'cancelled' : 'error',
                            status: cancelled ? 'cancelled' : 'failed', refs: preview.refs });
                } catch { /* The execution failure remains the authoritative saved outcome. */ }
            }
            throw error;
        } finally {
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
                else { response = event.text; break; }
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
    async cancelTurn(projectHandle: string, chatId: string, leaseToken: string): Promise<void> {
        this.active(projectHandle);
        const turn = this.turns.get(chatId);
        const preparation = this.roadmapPreparations.get(chatId);
        if (turn && turn.token !== leaseToken) throw new Error('Chat turn is not owned by this panel');
        if (preparation && preparation.token !== leaseToken) throw new Error('Roadmap preparation is not owned by this panel');
        if (turn) turn.abort.abort();
        else if (preparation) preparation.abort.abort();
        else this.pendingCancel.set(chatId, leaseToken);
    }
    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        for (const chatId of this.proposals.keys()) this.clearProposal(chatId);
        for (const chatId of this.gateUndo.keys()) this.clearGateUndo(chatId);
        for (const review of this.strategicReviews.values()) this.greenfield?.rejectStrategicDraft(review.preview.token);
        this.strategicReviews.clear();
        for (const turn of this.turns.values()) turn.abort.abort();
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
        this.unlisten();
    }
}
