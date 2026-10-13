import { randomUUID } from 'node:crypto';
import type { ChatClient, ChatDeltaRequest, ChatLeaseRequest, ChatMutation, ChatSearchRequest, ChatService,
    ChatTurnRequest, ChatOperation, ChatContextPreview, ChatTurnResult, ChatPlanningProposal } from '@dope/chat/lib/service';
import { suggestedChatTitle, type ChatAssistantMessage, type ChatModelProvenance, type ChatUserMessage } from '@dope/chat';
import { ChatRepository } from '@dope/chat/lib/node';
import { ModelRuntimeFailure } from '@dope/contracts/lib/model-runtime';
import type { AIRoleHardConstraints, RoutingProvenance } from '@dope/ai';
import { ModelConnectionsRegistry } from './model-connections';
import { ChatContextComposer } from './chat-context-composer';
import { ChatProjectGrounder, type GroundingResult } from './chat-project-grounder';
import { AIRoleRoutingService, exactRoutingProvenance, type RoutedConversationEvent } from './ai-role-routing';
import { ProjectPlanningActions, type PlanningAction, type PlanningActionRequest } from '@dope/project-intelligence/lib/node/project-planning-actions';
import { localPlanningJson, roadmapLocalBudget, verifyRoadmapLocalInput } from './roadmap-local-model';

const chatHard: AIRoleHardConstraints = { requiredCapabilities: ['conversationalText', 'streaming'],
    locality: 'any', enabledOnly: true, usableOnly: true, hostedProjectData: 'requires-feature-authorization' };

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
        handle: string; request: PlanningActionRequest; token: string; changedIds: string[] }>();

    constructor(private readonly repository: ChatRepository, client: ChatClient,
        private readonly models?: ModelConnectionsRegistry, private readonly composer?: ChatContextComposer,
        private readonly routing?: AIRoleRoutingService, private readonly grounder?: ChatProjectGrounder,
        private readonly planning?: ProjectPlanningActions) {
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
        const localRoadmap = connection?.providerId === 'local' &&
            request.context.some(item => item.kind === 'roadmap-checkpoint');
        const budget = localRoadmap ? roadmapLocalBudget(model.capabilities.contextWindowTokens,
            chat.settings.context.reservedOutputTokens) : undefined;
        const capabilities = budget ? { ...model.capabilities, maxInputTokens: budget.composerInputTokens } : model.capabilities;
        const composed = await this.composer.compose(root, chat, request.content, request.context, capabilities, grounding);
        if (budget) verifyRoadmapLocalInput(composed.messages, budget);
        if (localRoadmap && !composed.refs.some(ref => ref.kind === 'roadmap-checkpoint'))
            throw new Error('Selected Roadmap context does not fit; shorten the request or select a larger local model');
        return { refs: composed.refs, diagnostics: composed.diagnostics,
            usedTokens: composed.usedTokens, budgetTokens: composed.budgetTokens };
    }
    claim(request: ChatLeaseRequest) {
        if (!request || typeof request !== 'object') throw new Error('Invalid Chat lease request');
        return this.repository.claim(this.active(request.projectHandle), request.chatId, request.ownerId);
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
        if (pending) this.planning?.detach(pending.handle);
        this.proposals.delete(chatId);
    }

    private async proposal(root: string, chatId: string, messageId: string, leaseToken: string,
        output: string, refs: ChatContextPreview['refs']): Promise<{ proposal?: ChatPlanningProposal; proposalError?: string }> {
        if (!this.planning || !output.trimStart().startsWith('{') || !refs.some(ref => ref.kind === 'roadmap-checkpoint')) return {};
        let handle: string | undefined;
        try {
            if (Buffer.byteLength(output, 'utf8') > 4096) throw new Error('Planning proposal exceeds the size limit');
            const value: unknown = JSON.parse(output);
            if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid planning proposal');
            const raw = value as Record<string, unknown>;
            if (Object.keys(raw).sort().join(',') !== 'action,ownerRevision,projectId,type' ||
                raw.type !== 'roadmap-proposal' || typeof raw.projectId !== 'string' ||
                !Number.isSafeInteger(raw.ownerRevision) || !raw.action || typeof raw.action !== 'object' ||
                Array.isArray(raw.action)) throw new Error('Invalid planning proposal schema');
            const context = refs.filter(ref => ref.kind === 'roadmap-checkpoint');
            if (context.length !== 1 || context[0].projectId !== raw.projectId ||
                context[0].ownerRevision !== raw.ownerRevision) throw new Error('Stale or foreign planning proposal');
            const action = raw.action as PlanningAction;
            if (action.type !== 'create' && action.id !== context[0].id)
                throw new Error('Planning proposal targets an unselected checkpoint');
            // The action is untrusted. P3 validates every field, identity, source and owner transition.
            const attached = await this.planning.attach(root);
            handle = attached.projectHandle;
            if (attached.snapshot.projectId !== raw.projectId || attached.snapshot.revision !== raw.ownerRevision)
                throw new Error('Stale or foreign planning proposal');
            const request: PlanningActionRequest = { projectHandle: handle, ownerId: raw.projectId,
                expectedRevision: raw.ownerRevision as number, actions: [action],
                ...(context[0].sourceHash ? { sourceHashes: { [context[0].id]: context[0].sourceHash } } : {}) };
            const preview = await this.planning.preview(request);
            const id = randomUUID();
            const fields = (item: typeof preview.next.checkpoints[number] | undefined) => item && ({
                id: item.id, title: item.title, objective: item.objective, order: item.order,
                dependencies: item.dependencies, links: item.links, status: item.status });
            this.proposals.set(chatId, { id, messageId, leaseToken, handle, request,
                token: preview.token, changedIds: preview.changedIds });
            return { proposal: { id, chatId, messageId, ownerId: preview.ownerId, revision: preview.revision,
                changedIds: preview.changedIds, action: { type: action.type, id: action.id },
                summary: JSON.stringify({ action, before: fields(attached.snapshot.checkpoints.find(item => item.id === action.id)),
                    after: fields(preview.next.checkpoints.find(item => item.id === action.id)),
                    ...(preview.documentDiff ? { documentDiff: preview.documentDiff } : {}) }) } };
        } catch (error) {
            if (handle) this.planning.detach(handle);
            return { proposalError: `Planning proposal rejected: ${String(error)}` };
        }
    }

    async decidePlanningProposal(projectHandle: string, chatId: string, leaseToken: string,
        proposalId: string, approve: boolean): Promise<{ revision: number; changedIds: string[] } | undefined> {
        const root = this.active(projectHandle);
        const pending = this.proposals.get(chatId);
        if (!pending || pending.id !== proposalId || pending.leaseToken !== leaseToken || !this.planning ||
            typeof approve !== 'boolean') throw new Error('Planning proposal unavailable');
        await this.repository.renew(root, chatId, leaseToken);
        const message = (await this.repository.read(root)).chats.find(chat => chat.id === chatId)
            ?.messages.find(item => item.id === pending.messageId);
        if (message?.role !== 'assistant' || message.execution.status !== 'complete')
            throw new Error('Planning proposal is not a completed Chat turn');
        this.proposals.delete(chatId);
        try {
            if (!approve) return undefined;
            const result = await this.planning.apply(pending.request, pending.token, true);
            return { revision: result.revision, changedIds: pending.changedIds };
        } finally { this.planning.detach(pending.handle); }
    }

    async runTurn(request: ChatTurnRequest): Promise<ChatTurnResult> {
        const root = this.active(request.projectHandle);
        if (!this.models || this.turns.has(request.chatId)) throw new Error('Chat turn already active or runtime unavailable');
        const snapshot = await this.repository.read(root);
        const chat = snapshot.chats.find(item => item.id === request.chatId);
        if (!chat) throw new Error('Chat not found');
        await this.repository.renew(root, request.chatId, request.leaseToken);
        this.clearProposal(request.chatId);
        const retryIndex = request.retryMessageId ? chat.messages.findIndex(item => item.id === request.retryMessageId) : -1;
        const content = request.retryMessageId ? (() => {
            if (retryIndex < 1 || chat.messages[retryIndex].role !== 'assistant' ||
                !['failed', 'cancelled'].includes((chat.messages[retryIndex] as ChatAssistantMessage).execution.status) ||
                chat.messages[retryIndex - 1].role !== 'user') throw new Error('Only a failed or cancelled attempt can be retried');
            return chat.messages[retryIndex - 1].content;
        })() : request.content?.trim() ?? '';
        const contextChat = retryIndex < 0 ? chat : { ...chat, messages: chat.messages.slice(0, retryIndex - 1) };
        const roadmapTurn = (request.context ?? []).some(item => item.kind === 'roadmap-checkpoint');
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
        if (roadmapTurn && connection.providerId !== 'local' && request.hostedProjectDataAuthorized !== true)
            throw new Error('Chat hosted project-data confirmation required');
        const controls = chat.settings.reasoningControls ?? {};
        for (const [id, value] of Object.entries(controls))
            if (!model.capabilities.reasoningControls?.some(control => control.id === id && control.values.includes(value)))
                throw new ModelRuntimeFailure('Selected model does not support the saved reasoning control', 'unsupported-capability');
        if (!this.composer) throw new Error('Context composer unavailable');
        const localRoadmap = roadmapTurn && connection.providerId === 'local';
        const budget = localRoadmap ? roadmapLocalBudget(model.capabilities.contextWindowTokens,
            chat.settings.context.reservedOutputTokens) : undefined;
        const capabilities = budget ? { ...model.capabilities, maxInputTokens: budget.composerInputTokens } : model.capabilities;
        const grounding = await this.grounder?.ground(root, content);
        const priorRefs = retryIndex >= 0 ? (chat.messages[retryIndex - 1] as ChatUserMessage).contextRefs : undefined;
        if (priorRefs && !sameAutomaticEvidence(grounding, priorRefs))
            throw new Error('Retry project evidence changed or is stale; start a fresh turn');
        const composed = await this.composer.compose(root, contextChat, content, request.context ?? [], capabilities, grounding);
        if (budget) verifyRoadmapLocalInput(composed.messages, budget);
        if (roadmapTurn && !composed.refs.some(ref => ref.kind === 'roadmap-checkpoint'))
            throw new Error('Selected Roadmap context does not fit; shorten the request or select a larger local model');
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
            if (!following) {
                await mutate({ type: 'start-assistant', chatId: key, messageId: assistant.id, actualModel: actual });
            }
            let sequence = 0;
            const generate = () => following ? this.routing!.generate({ roleId: 'interactive',
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
                        chat.settings.context.reservedOutputTokens) : undefined;
                    const nextCapabilities = nextBudget ? { ...resolvedModel.capabilities,
                        maxInputTokens: nextBudget.composerInputTokens } : resolvedModel.capabilities;
                    const next = await this.composer!.compose(root, contextChat, content, request.context ?? [], nextCapabilities, grounding);
                    if (nextBudget) verifyRoadmapLocalInput(next.messages, nextBudget);
                    if (!sameRefIdentities(next.refs, preview.refs))
                        throw new Error('Fallback evidence differs; choose a model explicitly');
                    if (JSON.stringify(next.refs) !== JSON.stringify(preview.refs)) {
                        await mutate({ type: 'revise-user-context', chatId: key, userMessageId,
                            assistantMessageId: assistant!.id, contextRefs: next.refs });
                    }
                    preview = { refs: next.refs, diagnostics: next.diagnostics,
                        usedTokens: next.usedTokens, budgetTokens: next.budgetTokens };
                    return { messages: next.messages, controls, signal: abort.signal,
                        ...(chat.settings.context.reservedOutputTokens > 0 ?
                        { maxOutputTokens: budget?.output ?? chat.settings.context.reservedOutputTokens } : {}) };
                } }) : this.models!.generate(selectedModel!,
                { messages: composed.messages, controls, signal: abort.signal,
                    ...(chat.settings.context.reservedOutputTokens > 0 ?
                        { maxOutputTokens: budget?.output ?? chat.settings.context.reservedOutputTokens } : {}) },
                localRoadmap ? { localOnly: true } : undefined);
            const events = localRoadmap ? (async function* () {
                yield await localPlanningJson(generate, abort.signal, budget!.output);
            })() : generate();
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
                    const completed = await mutate({ type: 'finish-assistant', chatId: key, messageId: assistant.id,
                        outcome: 'complete', content: output, actualModel: actual, routingProvenance });
                    const titledChat = completed.chats.find(item => item.id === key);
                    const index = titledChat?.messages.findIndex(message => message.id === assistant!.id) ?? -1;
                    const preceding = index > 0 ? titledChat!.messages[index - 1] : undefined;
                    if (!roadmapTurn && titledChat?.titleSource === 'placeholder' && preceding?.role === 'user' &&
                        !titledChat.messages.slice(0, index).some(message =>
                            message.role === 'assistant' && message.execution.status === 'complete'))
                        void this.automaticTitle(root, key, preceding, assistant.id, output, actual);
                    if (abort.signal.aborted || request.retryMessageId) return preview;
                    return { ...preview, ...await this.proposal(root, key, assistant.id, request.leaseToken, output, preview.refs) };
                }
            }
            throw new Error('Model stream ended without completion');
        } catch (error) {
            if (assistant) {
                const cancelled = abort.signal.aborted || error instanceof ModelRuntimeFailure && error.failureClass === 'cancelled';
                const failure = error instanceof ModelRuntimeFailure ? error.message : 'Conversation failed';
                try { await mutate({ type: 'finish-assistant', chatId: key, messageId: assistant.id,
                    outcome: cancelled ? 'cancelled' : 'failed', content: output,
                    ...(!cancelled ? { failure } : {}) }); }
                catch { /* A lost lease or newer revision is recovered by ChatRepository. */ }
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
