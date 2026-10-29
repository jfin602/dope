import { createHash, randomUUID } from 'node:crypto';
import type { ChatClient, ChatDeltaRequest, ChatLeaseRequest, ChatMutation, ChatSearchRequest, ChatService,
    ChatTurnRequest, ChatOperation, ChatContextPreview, ChatTurnResult, ChatPlanningProposal, ChatRoadmapOffer,
    ChatContextSelection, ChatStrategicDraftReview, ChatEvent } from '@dope/chat/lib/service';
import { suggestedChatTitle, type Chat, type ChatAssistantMessage, type ChatModelProvenance, type ChatPlanningActivity, type ChatRoadmapAction, type ChatUserMessage } from '@dope/chat';
import { ChatRepository } from '@dope/chat/lib/node';
import { ModelRuntimeFailure, type ConversationMessage, type ConversationModelCapabilities } from '@dope/contracts/lib/model-runtime';
import type { AIRoleHardConstraints, RoutingProvenance } from '@dope/ai';
import { ModelConnectionsRegistry } from './model-connections';
import { ChatContextComposer } from './chat-context-composer';
import { ChatProjectGrounder, type GroundingResult } from './chat-project-grounder';
import { AIRoleRoutingService, exactRoutingProvenance, type RoutedConversationEvent } from './ai-role-routing';
import { ProjectPlanningActions, type PlanningAction, type PlanningActionRequest } from '@dope/project-intelligence/lib/node/project-planning-actions';
import { LocalPlanningOutputFailure, localPlanningJson, parseStrategicDraft, requestsRoadmapOwnerRevision, validImplementationPlan,
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

function draftInstruction(projectId: string, revision: number, maxSteps?: 2 | 3): string {
    const example = JSON.stringify({ type: 'roadmap-draft-proposal', projectId, draftRevision: revision,
        action: { type: 'create-phase', title: 'Example phase', objective: 'One clear objective' } });
    return `You are discussing a noncanonical Roadmap draft. Answer questions or ask one meaningful clarifying question as {"type":"no-action","message":"your concrete answer or question"}; do not force an edit. If the user asks for an edit, ${maxSteps ? `you may propose from two to ${maxSteps} small steps in one atomic preview using {"type":"roadmap-draft-sequence","projectId":"${projectId}","draftRevision":${revision},"actions":[{"type":"create-phase","title":"First phase"},{"type":"create-phase","title":"Second phase"}]}, or propose one step` : 'propose exactly one small step'} using the exact projectId and draftRevision below. The action must be an object with a "type" field, not a property named after the action. For a phase, use this exact JSON shape with your own title and objective: ${example}. For a checkpoint, use action {"type":"create-checkpoint","phaseId":"<existing phase ID>","title":"<title>","objective":"<objective>"}; copy IDs from the current draft. Supported actions also include edit-phase, edit-checkpoint, reorder-phase, reorder-checkpoint, split-checkpoint (phaseId, checkpointId, title, optional objective), move-checkpoint (phaseId, checkpointId, targetPhaseId, order), add-dependency/remove-dependency (checkpointId, dependencyId), create-correction (parentId, title, optional objective), and attach-correction (correctionId, parentId). Never supply a new ID: Dope creates it. A correction parent must be an exact existing phase or checkpoint ID. Return only one JSON object. This requires developer approval. Never claim an edit was applied.`;
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
    /** Leases belong to this RPC connection, not to the reusable panel ID or backend PID. */
    private readonly leases = new Map<string, { root: string; token: string }>();
    private readonly pendingCancel = new Map<string, string>();
    private readonly proposals = new Map<string, { id: string; messageId: string; leaseToken: string;
        handle?: string; request?: PlanningActionRequest; token?: string; changedIds: string[];
        roadmapOffer?: ChatRoadmapOffer;
        draft?: { handle: string; preview: GreenfieldEditPreview };
        plan?: { handle: string; preview: ImplementationPlanPreview } }>();
    private readonly planUndo = new Map<string, { handle: string; leaseToken: string; revision: number }>();
    private readonly strategicReviews = new Map<string, { root: string; leaseToken: string; messageId: string; offerId: string;
        question: string; preview: StrategicDraftPreview }>();

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
        private readonly bridgePlanning?: VisualPlanningService & { dispose?: () => void }) {
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
                    `root ROADMAP.md present ${state.canonicalMarkdown}, ${state.checkpoints} checkpoints, creation pending ${state.pendingCreation}, ` +
                    `${state.drafts} Greenfield drafts, ${state.acceptedPlans} accepted plans, ${state.pendingPlans} pending plans. ` +
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
            !request.context.some(item => item.kind === 'roadmap-checkpoint' || item.kind === 'planning-map') &&
            requestsImplementationPlan(request.content);
        if (explicitPlan) {
            const owner = await this.greenfield?.owner(root);
            if (!owner || owner.revision !== 0 || owner.linkedDocument || owner.pendingCreation)
                throw new Error('This Roadmap already has an owner; review it before starting a new implementation plan');
        }
        const planOnly = planBinding?.planOnly === true || explicitPlan;
        const opportunity = await this.roadmapOpportunity(root, request.content, !helpTurn && !draft && !planOnly &&
            !request.context.some(item => item.kind === 'roadmap-checkpoint' || item.kind === 'planning-map'));
        if (planOnly && !this.grounder) throw new Error('Project investigation unavailable');
        const planningGrounding = planOnly ? await this.grounder?.investigateIdea(root, request.content) :
            await this.grounder?.ground(root, request.content);
        const connection = (await this.models.list()).connections.find(item => item.id === request.selectedModel.connectionId);
        if (draft && connection?.providerId !== 'local') throw new Error('Greenfield Chat planning requires a local model');
        const localRoadmap = connection?.providerId === 'local' &&
            (request.context.some(item => item.kind === 'roadmap-checkpoint') || !!draft || helpTurn || planOnly);
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
        if (request.context.some(item => item.kind === 'roadmap-checkpoint') &&
            !composed.refs.some(ref => ref.kind === 'roadmap-checkpoint'))
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
                if (this.disposed) throw new Error('Disposed Chat connection');
                this.clearProposal(request.chatId);
                const prior = this.strategicReviews.get(request.chatId);
                if (prior) { this.greenfield?.rejectStrategicDraft(prior.preview.token);
                    this.strategicReviews.delete(request.chatId); }
                this.leases.set(request.chatId, { root, token: result.token });
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
        if (this.turns.get(chatId)?.token === token) this.turns.get(chatId)?.abort.abort();
        await this.repository.release(root, chatId, token);
        if (this.leases.get(chatId)?.token === token) {
            this.leases.delete(chatId); this.clearProposal(chatId);
            const review = this.strategicReviews.get(chatId);
            if (review) { this.greenfield?.rejectStrategicDraft(review.preview.token);
                this.strategicReviews.delete(chatId); }
        }
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

    private async offerRoadmap(root: string, chatId: string, messageId: string,
        leaseToken: string, opportunity: string | undefined, output: string): Promise<ChatRoadmapOffer | undefined> {
        if (!opportunity?.includes('revision zero') || !this.greenfield || this.proposals.has(chatId) ||
            this.strategicReviews.has(chatId)) return undefined;
        const chat = (await this.repository.read(root)).chats.find(item => item.id === chatId);
        if (!chat) return undefined;
        const lastUser = chat.messages.filter(item => item.role === 'user').at(-1)?.content ?? '';
        const requestedAgain = /\b(?:create|generate|make|offer)\b[\s\S]{0,100}\bdraft\b[\s\S]{0,60}\broadmap\b/i.test(lastUser) ||
            /\b(?:create|generate|make|offer)\b[\s\S]{0,100}\broadmap\b[\s\S]{0,60}\bdraft\b/i.test(lastUser);
        if (!requestedAgain && (!/\broadmap\b/i.test(output) || !/\bdraft\b/i.test(output))) return undefined;
        if (!requestedAgain && chat.messages.some(item => item.role === 'assistant' &&
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
        await this.repository.recordRoadmapAction(root, chatId, messageId, leaseToken,
            { schemaVersion: 1, offerId: offer.id, projectId: offer.projectId, chatId,
                ownerRevision: offer.ownerRevision, status: 'offered' });
        this.proposals.set(chatId, { id: offer.id, messageId, leaseToken, changedIds: [], roadmapOffer: offer });
        return offer;
    }

    async decideRoadmapOffer(projectHandle: string, chatId: string, leaseToken: string,
        offerId: string, token: string, approve: boolean, selectedModel?: { connectionId: string; modelId: string }):
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
        await this.updateRoadmapAction(root, chatId, pending.messageId, leaseToken, offer.id,
            'offered', 'generating', { stage: 'checking-owner' });
        try {
        this.planningProgress(chatId, offer.id, 'checking-owner');
        if (!this.greenfield || !(await this.repository.read(root)).chats.some(chat => chat.id === chatId))
            throw new Error('Roadmap offer Chat is unavailable');
        const state = await this.greenfield.readOpportunity(root);
        if (state.projectId !== offer.projectId || state.revision !== offer.ownerRevision ||
            state.linkedDocument || state.canonicalMarkdown || state.pendingCreation || state.drafts ||
            state.acceptedPlans || state.pendingPlans)
            throw new Error('Roadmap owner or draft changed; review Roadmap and request a new offer');
        if (!this.models || !this.composer || !this.grounder) throw new Error('Strategic draft generation unavailable');
        const chat = (await this.repository.read(root)).chats.find(item => item.id === chatId)!;
        const selection = selectedModel ?? (chat.settings.modelPolicy.type === 'exact' ? chat.settings.modelPolicy.model : undefined);
        if (!selection) throw new Error('Select an exact local model for strategic Roadmap generation');
        const connection = (await this.models.list()).connections.find(item => item.id === selection.connectionId);
        const model = connection?.ready && connection.models.find(item => item.id === selection.modelId && item.usable);
        if (!connection || connection.providerId !== 'local' || !model)
            throw new Error('Selected local model is unavailable for strategic Roadmap generation');
        const outputTokens = Math.max(2048, chat.settings.context.reservedOutputTokens);
        const budget = roadmapLocalBudget(model.capabilities.contextWindowTokens, outputTokens, model.capabilities);
        if (budget.output < 2048) throw new Error('Selected local model has insufficient strategic draft output capacity');
        const question = chat.messages.filter(item => item.role === 'user').slice(-3).map(item => item.content).join('\n');
        if (!question.trim()) throw new Error('Saved Chat has no developer planning decisions');
        const grounding = await this.grounder.ground(root, question);
        const sourceHash = createHash('sha256').update(JSON.stringify({ messages: this.roadmapSourceMessages(chat),
            evidence: grounding.blocks.map(item => item.ref) })).digest('hex');
        const instruction = `Generate one concise whole strategic Roadmap draft for the developer's project. ` +
            `Use saved Chat decisions and verified current project evidence; label suggestions as proposals, never as source facts. ` +
            `Do not assert that missing evidence means an empty repository. Plan deliverable strategic phases and meaningful milestone checkpoints, ` +
            `not implementation-level tasks. Keep optional post-MVP work outside the main MVP path unless requested. ` +
            `Do not force five phases or assume this is a game. ` +
            `Return ONLY strict JSON with exactly {"type":"strategic-roadmap-draft","projectId":"${state.projectId}",` +
            `"ownerRevision":${state.revision},"phases":[{"title":"Phase title","objective":"Outcome",` +
            `"checkpoints":[{"title":"Milestone","objective":"Outcome","dependsOn":[]}]}]}. ` +
            `Use 2–32 phases, 1–16 checkpoints per phase, at most 256 total. dependsOn contains one-based numbers ` +
            `of earlier checkpoints across all phases. Keep output under 32768 UTF-8 bytes. ` +
            `No file names, tools, approvals or publication claims.`;
        const composed = await this.composeTurn(root, chat, question, [], model.capabilities, budget,
            { text: instruction }, grounding);
        const messages = this.withDraft(composed.messages, { text: instruction });
        verifyRoadmapLocalInput(messages, budget);
        await this.verifyLoadedCapacity(selection, budget, outputTokens);
        const abort = new AbortController();
        this.turns.set(chatId, { token: leaseToken, abort });
        try {
            if (this.pendingCancel.get(chatId) === leaseToken) abort.abort();
            this.planningProgress(chatId, offer.id, 'generating-draft');
            await this.updateRoadmapAction(root, chatId, pending.messageId, leaseToken, offer.id,
                'generating', 'generating', { stage: 'generating-draft' });
            let completed: { text: string; finishReason?: string; actualModelId?: string; provenance?: {
                connectionId: string; modelId: string } } | undefined;
            let streamedBytes = 0;
            for await (const event of this.models.generate(selection,
                { messages, controls: chat.settings.reasoningControls ?? {}, signal: abort.signal,
                    maxOutputTokens: budget.output }, { localOnly: true })) {
                if (abort.signal.aborted) throw new ModelRuntimeFailure('Strategic draft cancelled', 'cancelled');
                if (event.type === 'delta') {
                    streamedBytes += Buffer.byteLength(event.text, 'utf8');
                    if (streamedBytes > budget.maxOutputBytes)
                        throw new LocalPlanningOutputFailure('Strategic draft exceeds the output budget', '');
                } else completed = event;
            }
            if (!completed) throw new LocalPlanningOutputFailure('Strategic draft stream ended without completion', '');
            if (completed.actualModelId && completed.actualModelId !== selection.modelId ||
                completed.provenance && (completed.provenance.modelId !== selection.modelId ||
                    completed.provenance.connectionId !== selection.connectionId))
                throw new Error('Selected local model changed during strategic draft generation');
            await this.verifyLoadedCapacity(selection, budget, outputTokens);
            if (abort.signal.aborted) throw new ModelRuntimeFailure('Strategic draft cancelled', 'cancelled');
            if (Buffer.byteLength(completed.text, 'utf8') > budget.maxOutputBytes)
                throw new LocalPlanningOutputFailure('Strategic draft exceeds the output budget', '');
            this.planningProgress(chatId, offer.id, 'validating-draft');
            await this.updateRoadmapAction(root, chatId, pending.messageId, leaseToken, offer.id,
                'generating', 'generating', { stage: 'validating-draft' });
            const input = parseStrategicDraft(completed.text, completed.finishReason, state.projectId, state.revision);
            const freshChat = (await this.repository.read(root)).chats.find(item => item.id === chatId);
            const freshGrounding = await this.grounder.ground(root, question);
            const freshHash = createHash('sha256').update(JSON.stringify({ messages: freshChat && this.roadmapSourceMessages(freshChat),
                evidence: freshGrounding.blocks.map(item => item.ref) })).digest('hex');
            if (freshHash !== sourceHash) throw new Error('Chat decisions or project evidence changed during generation; regenerate');
            this.planningProgress(chatId, offer.id, 'preparing-draft');
            await this.updateRoadmapAction(root, chatId, pending.messageId, leaseToken, offer.id,
                'generating', 'generating', { stage: 'preparing-draft' });
            const preview = await this.greenfield.previewStrategicDraft(root, input, sourceHash);
            try {
                await this.repository.renew(root, chatId, leaseToken);
                if (abort.signal.aborted || this.disposed || this.root !== root)
                    throw new Error('Strategic draft generation is no longer current');
            } catch (error) { this.greenfield.rejectStrategicDraft(preview.token); throw error; }
            this.strategicReviews.set(chatId, { root, leaseToken, question, preview,
                messageId: pending.messageId, offerId: offer.id });
            await this.updateRoadmapAction(root, chatId, pending.messageId, leaseToken, offer.id,
                'generating', 'ready', { draftRevision: preview.after.revision });
            this.planningProgress(chatId, offer.id, 'draft-ready');
            return { token: preview.token, projectId: preview.projectId, revision: preview.after.revision,
                draft: preview.after,
                phases: preview.after.phases.map(phase => ({ title: phase.title, objective: phase.objective,
                    checkpoints: phase.checkpoints.map(checkpoint => ({ id: checkpoint.id, title: checkpoint.title,
                        objective: checkpoint.objective, dependencies: checkpoint.dependencies ?? [] })) })) };
        } catch (error) {
            const status = abort.signal.aborted ? 'cancelled' : 'failed';
            this.planningProgress(chatId, offer.id, status);
            await this.updateRoadmapAction(root, chatId, pending.messageId, leaseToken, offer.id,
                'generating', status, { diagnostic: String(error).slice(0, 240) }).catch(() => {});
            throw error;
        } finally { this.turns.delete(chatId); this.pendingCancel.delete(chatId); }
        } catch (error) {
            this.strategicReviews.delete(chatId);
            await this.updateRoadmapAction(root, chatId, pending.messageId, leaseToken, offer.id,
                'generating', 'failed', { diagnostic: String(error).slice(0, 240) }).catch(() => {});
            throw error;
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
            const grounding = await this.grounder!.ground(root, pending.question);
            const sourceHash = createHash('sha256').update(JSON.stringify({ messages: this.roadmapSourceMessages(chat),
                evidence: grounding.blocks.map(item => item.ref) })).digest('hex');
            const revision = (await this.greenfield!.acceptStrategicDraft(root, chatId, pending.preview, sourceHash)).revision;
            await this.updateRoadmapAction(root, chatId, pending.messageId, leaseToken,
                pending.offerId, 'ready', 'accepted', { draftRevision: revision });
            return revision;
        } catch (error) {
            await this.updateRoadmapAction(root, chatId, pending.messageId, leaseToken,
                pending.offerId, 'ready', 'failed', { diagnostic: String(error).slice(0, 240) }).catch(() => {});
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
    private planningProgress(chatId: string, messageId: string, stage: Extract<ChatEvent, { kind: 'planning-progress' }>['stage']): void {
        if (!this.handle || this.disposed) return;
        tracePlanning(stage, chatId, messageId);
        try { this.client.notifyChatEvent({ projectHandle: this.handle, kind: 'planning-progress',
            chatId, messageId, stage }); }
        catch { /* A transient UI notice cannot fail a planning turn. */ }
    }

    private async proposal(root: string, chatId: string, messageId: string, leaseToken: string,
        output: string, refs: ChatContextPreview['refs'], draft?: { handle: string; revision: number; projectId: string }):
        Promise<{ proposal?: ChatPlanningProposal; proposalError?: string }> {
        if (!output.trimStart().startsWith('{') || !draft && (!this.planning || !refs.some(ref => ref.kind === 'roadmap-checkpoint'))) return {};
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
                changedIds: preview.changedIds, action: { type: actions.length > 1 ? 'sequence' : actions[0].type, id: actions[0].id },
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
        } finally { if (pending.handle) this.planning?.detach(pending.handle); }
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
        const priorOffer = this.proposals.get(request.chatId);
        if (priorOffer?.roadmapOffer) {
            await this.updateRoadmapAction(root, request.chatId, priorOffer.messageId, request.leaseToken,
                priorOffer.roadmapOffer.id, 'offered', 'stale').catch(() => {});
        }
        const priorReview = this.strategicReviews.get(request.chatId);
        if (priorReview) { this.greenfield?.rejectStrategicDraft(priorReview.preview.token);
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
        const roadmapTurn = (request.context ?? []).some(item => item.kind === 'roadmap-checkpoint') || !!draft || helpTurn || !!bridge || planOnly;
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
        if ((request.context ?? []).some(item => item.kind === 'roadmap-checkpoint') &&
            !composed.refs.some(ref => ref.kind === 'roadmap-checkpoint'))
            throw new Error('Selected Roadmap context does not fit; shorten the request or select a larger local model');
        let localMode: 'linked' | 'unlinked' | 'draft' | 'help' | 'bridge' | 'plan' | 'plan-revision' =
            bridge ? 'bridge' : planOnly ? planBinding?.plan ? 'plan-revision' : 'plan' :
                helpTurn ? 'help' : draft ? 'draft' : 'unlinked';
        let eligibleObjective = true;
        if (localRoadmap && !draft && !helpTurn && !planOnly && this.planning) {
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
                        ...(planningOutput > 0 ?
                        { maxOutputTokens: nextBudget?.output ?? planningOutput } : {}) };
                } }) : this.models!.generate(selectedModel!,
                { messages: withRetryInstruction(this.withDraft(composed.messages, planningPrompt), retryInstruction), controls, signal: abort.signal,
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
                        outcome: 'complete', content: output, actualModel: actual, routingProvenance });
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
                                status: kind === 'no-action' ? 'no-action' : bridge && kind === 'bridge-proposal' ? 'suggested' :
                                    result.proposal ? 'pending' : 'rejected',
                                ...(helpTurn && kind === 'no-action' && composed.verifiedGuidance ?
                                    { verifiedGuidance: composed.verifiedGuidance } : {}),
                                ...(result.proposal ? { proposalId: result.proposal.id } : {}) });
                        tracePlanning('result-recorded', key, assistant.id,
                            kind === 'no-action' ? 'no-action' : bridge && kind === 'bridge-proposal' ? 'suggested' :
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
        if (turn && turn.token !== leaseToken) throw new Error('Chat turn is not owned by this panel');
        if (turn) turn.abort.abort();
        else this.pendingCancel.set(chatId, leaseToken);
    }
    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        for (const chatId of this.proposals.keys()) this.clearProposal(chatId);
        for (const review of this.strategicReviews.values()) this.greenfield?.rejectStrategicDraft(review.preview.token);
        this.strategicReviews.clear();
        for (const turn of this.turns.values()) turn.abort.abort();
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
