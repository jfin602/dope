import { randomUUID } from 'node:crypto';
import type { ChatClient, ChatDeltaRequest, ChatLeaseRequest, ChatMutation, ChatSearchRequest, ChatService,
    ChatTurnRequest, ChatOperation, ChatContextPreview, ChatTurnResult, ChatPlanningProposal,
    ChatContextSelection } from '@dope/chat/lib/service';
import { suggestedChatTitle, type Chat, type ChatAssistantMessage, type ChatModelProvenance, type ChatPlanningActivity, type ChatUserMessage } from '@dope/chat';
import { ChatRepository } from '@dope/chat/lib/node';
import { ModelRuntimeFailure, type ConversationMessage, type ConversationModelCapabilities } from '@dope/contracts/lib/model-runtime';
import type { AIRoleHardConstraints, RoutingProvenance } from '@dope/ai';
import { ModelConnectionsRegistry } from './model-connections';
import { ChatContextComposer } from './chat-context-composer';
import { ChatProjectGrounder, type GroundingResult } from './chat-project-grounder';
import { AIRoleRoutingService, exactRoutingProvenance, type RoutedConversationEvent } from './ai-role-routing';
import { ProjectPlanningActions, type PlanningAction, type PlanningActionRequest } from '@dope/project-intelligence/lib/node/project-planning-actions';
import { LocalPlanningOutputFailure, localPlanningJson, requestsRoadmapOwnerRevision,
    roadmapLocalBudget, verifyRoadmapLocalInput } from './roadmap-local-model';
import { RoadmapGreenfield, type GreenfieldEdit, type GreenfieldEditPreview } from '@dope/project-intelligence/lib/node/roadmap-greenfield';
import { readRoadmapDocumentCapabilities } from '@dope/project-intelligence/lib/node/roadmap-document-patch';
import { selectDopeCapabilityHelp } from './dope-capability-help';

function draftInstruction(projectId: string, revision: number, maxSteps?: 2 | 3): string {
    const example = JSON.stringify({ type: 'roadmap-draft-proposal', projectId, draftRevision: revision,
        action: { type: 'create-phase', title: 'Example phase', objective: 'One clear objective' } });
    return `You are discussing a noncanonical Roadmap draft. Answer questions or ask one meaningful clarifying question as {"type":"no-action","message":"your concrete answer or question"}; do not force an edit. If the user asks for an edit, ${maxSteps ? `you may propose from two to ${maxSteps} small steps in one atomic preview using {"type":"roadmap-draft-sequence","projectId":"${projectId}","draftRevision":${revision},"actions":[{"type":"create-phase","title":"First phase"},{"type":"create-phase","title":"Second phase"}]}, or propose one step` : 'propose exactly one small step'} using the exact projectId and draftRevision below. The action must be an object with a "type" field, not a property named after the action. For a phase, use this exact JSON shape with your own title and objective: ${example}. For a checkpoint, use action {"type":"create-checkpoint","phaseId":"<existing phase ID>","title":"<title>","objective":"<objective>"}; copy IDs from the current draft. Supported actions also include edit-phase, edit-checkpoint, reorder-phase, reorder-checkpoint, split-checkpoint (phaseId, checkpointId, title, optional objective), move-checkpoint (phaseId, checkpointId, targetPhaseId, order), add-dependency/remove-dependency (checkpointId, dependencyId), create-correction (parentId, title, optional objective), and attach-correction (correctionId, parentId). Never supply a new ID: Dope creates it. A correction parent must be an exact existing phase or checkpoint ID. Return only one JSON object. This requires developer approval. Never claim an edit was applied.`;
}

const chatHard: AIRoleHardConstraints = { requiredCapabilities: ['conversationalText', 'streaming'],
    locality: 'any', enabledOnly: true, usableOnly: true, hostedProjectData: 'requires-feature-authorization' };

function tracePlanning(stage: string, chatId: string, messageId: string, status?: string): void {
    if (process.env.DOPE_CHAT_PLANNING_TRACE !== '1') return;
    console.info('[dope-chat-planning-trace]', JSON.stringify({ at: new Date().toISOString(),
        stage, chatId, messageId, ...(status ? { status } : {}) }));
}

function evidenceIdentity(ref: { kind: string; id: string; contentHash?: string; projectId?: string; generation?: number }) {
    return [ref.kind, ref.id, ref.contentHash, ref.projectId, ref.generation];
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
    private readonly pendingCancel = new Map<string, string>();
    private readonly proposals = new Map<string, { id: string; messageId: string; leaseToken: string;
        handle?: string; request?: PlanningActionRequest; token?: string; changedIds: string[];
        draft?: { handle: string; preview: GreenfieldEditPreview } }>();

    constructor(private readonly repository: ChatRepository, private readonly client: ChatClient,
        private readonly models?: ModelConnectionsRegistry, private readonly composer?: ChatContextComposer,
        private readonly routing?: AIRoleRoutingService, private readonly grounder?: ChatProjectGrounder,
        private readonly planning?: ProjectPlanningActions, private readonly greenfield?: RoadmapGreenfield) {
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

    private async composeTurn(root: string, chat: Chat, content: string, context: ChatContextSelection[],
        model: ConversationModelCapabilities, budget?: ReturnType<typeof roadmapLocalBudget>,
        draft?: { text: string }, grounding?: GroundingResult) {
        const capabilities = planningComposerCapabilities(model, budget, draft);
        let inputTokens = capabilities.maxInputTokens;
        for (let attempt = 0; attempt < 4; attempt++) {
            const composed = await this.composer!.compose(root, chat, content, context,
                inputTokens === undefined ? capabilities : { ...capabilities, maxInputTokens: inputTokens }, grounding, !!budget);
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
        const grounding = await this.grounder?.ground(root, request.content);
        const connection = (await this.models.list()).connections.find(item => item.id === request.selectedModel.connectionId);
        const helpTurn = !!selectDopeCapabilityHelp(request.content);
        const draft = helpTurn ? undefined : await this.draftContext(root, request.chatId);
        if (draft && connection?.providerId !== 'local') throw new Error('Greenfield Chat planning requires a local model');
        const localRoadmap = connection?.providerId === 'local' &&
            (request.context.some(item => item.kind === 'roadmap-checkpoint') || !!draft || helpTurn);
        const budget = localRoadmap ? roadmapLocalBudget(model.capabilities.contextWindowTokens,
            chat.settings.context.reservedOutputTokens, model.capabilities) : undefined;
        const composed = await this.composeTurn(root, chat, request.content, request.context,
            model.capabilities, budget, draft, grounding);
        if (budget) await this.verifyLoadedCapacity(request.selectedModel, budget,
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
                // A new lease cannot approve an in-memory preview from an earlier owner/session.
                await this.retirePending(root, request.chatId, result.token);
                this.clearProposal(request.chatId);
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
    release(projectHandle: string, chatId: string, token: string) {
        return this.repository.release(this.active(projectHandle), chatId, token);
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
        this.proposals.delete(chatId);
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
    private planningProgress(chatId: string, messageId: string, stage: 'waiting' | 'validating'): void {
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
                    revision: draft.revision, changedIds, action: { type: sequence ? 'sequence' : action.type, id: changedIds[0] },
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
                return undefined; }
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
            if (appliedRevision !== undefined)
                throw new Error(`Planning write completed at revision ${appliedRevision}, but Chat activity could not be recorded; reread the Roadmap: ${String(error)}`);
            if ((await this.repository.read(root)).chats.find(chat => chat.id === chatId)?.messages
                .some(item => item.id === pending.messageId && item.role === 'assistant' &&
                    item.planningActivity?.status === 'pending'))
                await record(/stale|source|hash|conflict/i.test(String(error)) ? 'stale' : 'rejected');
            throw error;
        } finally { if (pending.handle) this.planning?.detach(pending.handle); }
    }

    async runTurn(request: ChatTurnRequest): Promise<ChatTurnResult> {
        const root = this.active(request.projectHandle);
        if (!this.models || this.turns.has(request.chatId)) throw new Error('Chat turn already active or runtime unavailable');
        const snapshot = await this.repository.read(root);
        const chat = snapshot.chats.find(item => item.id === request.chatId);
        if (!chat) throw new Error('Chat not found');
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
        const roadmapTurn = (request.context ?? []).some(item => item.kind === 'roadmap-checkpoint') || !!draft || helpTurn;
        if (request.planningSteps !== undefined && (![2, 3].includes(request.planningSteps) ||
            !roadmapTurn || helpTurn || !draft &&
            (request.context ?? []).filter(item => item.kind === 'roadmap-checkpoint').length !== 1))
            throw new Error('Small-step planning requires a bound draft or one unlinked Roadmap checkpoint and a cap of two or three');
        const planningPrompt = draft ?? (request.planningSteps ? { text:
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
        if (draft && connection.providerId !== 'local') throw new Error('Greenfield Chat planning requires a local model');
        if (roadmapTurn && connection.providerId !== 'local' && request.hostedProjectDataAuthorized !== true)
            throw new Error('Chat hosted project-data confirmation required');
        const controls = chat.settings.reasoningControls ?? {};
        for (const [id, value] of Object.entries(controls))
            if (!model.capabilities.reasoningControls?.some(control => control.id === id && control.values.includes(value)))
                throw new ModelRuntimeFailure('Selected model does not support the saved reasoning control', 'unsupported-capability');
        if (!this.composer) throw new Error('Context composer unavailable');
        const localRoadmap = roadmapTurn && connection.providerId === 'local';
        const budget = localRoadmap ? roadmapLocalBudget(model.capabilities.contextWindowTokens,
            chat.settings.context.reservedOutputTokens, model.capabilities) : undefined;
        const grounding = await this.grounder?.ground(root, content);
        const priorRefs = retryIndex >= 0 ? (chat.messages[retryIndex - 1] as ChatUserMessage).contextRefs : undefined;
        if (priorRefs && !sameAutomaticEvidence(grounding, priorRefs))
            throw new Error('Retry project evidence changed or is stale; start a fresh turn');
        const composed = await this.composeTurn(root, contextChat, content, request.context ?? [],
            model.capabilities, budget, planningPrompt, grounding);
        if ((request.context ?? []).some(item => item.kind === 'roadmap-checkpoint') &&
            !composed.refs.some(ref => ref.kind === 'roadmap-checkpoint'))
            throw new Error('Selected Roadmap context does not fit; shorten the request or select a larger local model');
        let localMode: 'linked' | 'unlinked' | 'draft' | 'help' = helpTurn ? 'help' : draft ? 'draft' : 'unlinked';
        let eligibleObjective = true;
        if (localRoadmap && !draft && !helpTurn && this.planning) {
            const ref = composed.refs.filter(item => item.kind === 'roadmap-checkpoint');
            if (ref.length !== 1) throw new Error('Select exactly one Roadmap checkpoint');
            const attached = await this.planning.attach(root);
            try {
                if (attached.snapshot.projectId !== ref[0].projectId || attached.snapshot.revision !== ref[0].ownerRevision)
                    throw new Error('Stale or foreign Roadmap context');
                const selected = attached.snapshot.checkpoints.find(item => item.id === ref[0].id);
                if (!selected || selected.source?.sha256 !== ref[0].sourceHash)
                    throw new Error('Stale Roadmap source');
                if (attached.snapshot.linkedDocument && selected.source?.path === attached.snapshot.linkedDocument.path) {
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
                        chat.settings.context.reservedOutputTokens, resolvedModel.capabilities) : undefined;
                    if (nextBudget && (nextBudget.total !== budget?.total ||
                        nextBudget.inputBytes !== budget.inputBytes || nextBudget.output !== budget.output))
                        throw new ModelRuntimeFailure('Loaded local context or limits changed; preview this turn again',
                            'unsupported-capability');
                    const next = await this.composeTurn(root, contextChat, content, request.context ?? [],
                        resolvedModel.capabilities, nextBudget, planningPrompt, grounding);
                    if (!sameRefIdentities(next.refs, preview.refs))
                        throw new Error('Fallback evidence differs; choose a model explicitly');
                    if (JSON.stringify(next.refs) !== JSON.stringify(preview.refs)) {
                        await mutate({ type: 'revise-user-context', chatId: key, userMessageId,
                            assistantMessageId: assistant!.id, contextRefs: next.refs });
                    }
                    preview = { refs: next.refs, diagnostics: next.diagnostics,
                        usedTokens: next.usedTokens, budgetTokens: next.budgetTokens };
                    return { messages: withRetryInstruction(this.withDraft(next.messages, planningPrompt), retryInstruction), controls, signal: abort.signal,
                        ...(chat.settings.context.reservedOutputTokens > 0 ?
                        { maxOutputTokens: nextBudget?.output ?? chat.settings.context.reservedOutputTokens } : {}) };
                } }) : this.models!.generate(selectedModel!,
                { messages: withRetryInstruction(this.withDraft(composed.messages, planningPrompt), retryInstruction), controls, signal: abort.signal,
                    ...(chat.settings.context.reservedOutputTokens > 0 ?
                        { maxOutputTokens: budget?.output ?? chat.settings.context.reservedOutputTokens } : {}) },
                localRoadmap ? { localOnly: true } : undefined);
            const events = localRoadmap ? (async function* (backend: ChatBackend) {
                const guardedGenerate = async function* (retryInstruction?: string) {
                    if (!following) await backend.verifyLoadedCapacity(selectedModel!, budget!,
                        chat.settings.context.reservedOutputTokens);
                    yield* generate(retryInstruction);
                };
                const requestedRevision = !draft && requestsRoadmapOwnerRevision(content) ?
                    preview.refs.find(ref => ref.kind === 'roadmap-checkpoint')?.ownerRevision : undefined;
                const complete = await localPlanningJson(guardedGenerate, abort.signal, budget!.maxOutputBytes,
                    localMode, eligibleObjective, { requiredOwnerRevision: requestedRevision,
                        maxSteps: request.planningSteps,
                        onRetry: cause => tracePlanning('retry', key, assistant!.id, cause) });
                await backend.verifyLoadedCapacity(selectedModel!, budget!,
                    chat.settings.context.reservedOutputTokens);
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
                    const result = helpTurn ? {} : await this.proposal(root, key, assistant.id,
                        request.leaseToken, output, preview.refs, draft);
                    if (localRoadmap) {
                        const kind = (JSON.parse(output) as { type: ChatPlanningActivity['kind'] }).type;
                        await this.repository.recordPlanningActivity(root, key, assistant.id, request.leaseToken,
                            { schemaVersion: 1, kind, refs: preview.refs,
                                status: kind === 'no-action' ? 'no-action' : result.proposal ? 'pending' : 'rejected',
                                ...(helpTurn && kind === 'no-action' && composed.verifiedGuidance ?
                                    { verifiedGuidance: composed.verifiedGuidance } : {}),
                                ...(result.proposal ? { proposalId: result.proposal.id } : {}) });
                        tracePlanning('result-recorded', key, assistant.id,
                            kind === 'no-action' ? 'no-action' : result.proposal ? 'pending' : 'rejected');
                    }
                    return { ...preview, ...result };
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
        this.disposed = true;
        for (const chatId of this.proposals.keys()) this.clearProposal(chatId);
        for (const turn of this.turns.values()) turn.abort.abort();
        this.unlisten();
    }
}
