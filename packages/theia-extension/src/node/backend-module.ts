import { ContainerModule } from '@theia/core/shared/inversify';
import { ConnectionHandler, RpcConnectionHandler } from '@theia/core/lib/common';
import { NoteClient, noteServicePath } from '@dope/contracts/lib/note-service';
import { NoteBackend } from './note-backend';
import { NoteStore } from './note-store';
import { ProjectMindClient, projectMindServicePath } from '@dope/contracts/lib/project-mind-service';
import { ProjectMindStore } from '@dope/project-intelligence/lib/node/project-mind-store';
import { ProjectMindBackend } from './project-mind-backend';
import { softwareMapServicePath } from '@dope/software-map';
import type { SoftwareMapClient } from '@dope/software-map';
import { SoftwareMapIndex } from '@dope/code-analysis/lib/node/software-map-index';
import { TypeScriptAnalyzer } from '@dope/code-analysis-typescript';
import { SoftwareMapBackend } from './software-map-backend';
import { visualPlanningServicePath } from '@dope/visual-planning/lib/service';
import { PlanningStore } from '@dope/visual-planning/lib/node/planning-store';
import { VisualPlanningBackend } from './visual-planning-backend';
import { ChatRepository } from '@dope/chat/lib/node';
import { chatServicePath, type ChatClient } from '@dope/chat/lib/service';
import { ChatBackend } from './chat-backend';
import { ChatContextComposer } from './chat-context-composer';
import { ChatProjectGrounder } from './chat-project-grounder';
import { modelConnectionsServicePath, type ModelConnectionsClient } from '@dope/contracts/lib/model-connections-service';
import { ModelConnectionsBackend, ModelConnectionsRegistry } from './model-connections';
import { aiRegistryServicePath, type AIRegistryClient } from '@dope/contracts/lib/ai-registry-service';
import { AIRegistryStore } from './ai-registry-store';
import { AIRolePolicyStore } from './ai-role-policy-store';
import { AIRoleRoutingService } from './ai-role-routing';
import { AIRolePolicyBackend } from './ai-role-policy-backend';
import { aiRolePolicyServicePath, type AIRolePolicyClient } from '@dope/contracts/lib/ai-role-policy-service';
import { AIInventoryController, AIRegistryBackend } from './ai-registry-backend';
import { aiCredentialServicePath, type AICredentialClient } from '@dope/contracts/lib/ai-credential-service';
import { AICredentialManager } from './ai-credential-manager';
import { AICredentialBackend } from './ai-credential-backend';
import { codexAuthServicePath } from '@dope/contracts/lib/codex-auth-service';
import { CodexAuthManager } from './codex-auth-manager';
import { CodexAppServer } from './codex-app-server';
import { BackendApplicationContribution } from '@theia/core/lib/node/backend-application';
import { CodexAuthBackend } from './codex-auth-backend';
import { AgentStore } from '@dope/agent-core/lib/node/agent-store';
import { agentRuntimeServicePath, type AgentRuntimeClient } from '@dope/contracts/lib/agent-runtime-service';
import { AgentRuntimeBackend } from './agent-runtime-backend';
import { AgentExecutionRuntime } from './agent-execution-runtime';
import { CodexAgentExecutionAdapter } from './codex-agent-execution';
import { LocalAgentExecutionAdapter } from './local-agent-execution';
import type { AgentExecutionAdapter } from '@dope/agent-core';
import { historyServicePath, historyFocusServicePath } from '@dope/contracts/lib/history-service';
import { HistoryBackend } from './history-backend';
import { RoadmapStore } from '@dope/project-intelligence/lib/node/roadmap-store';
import { RoadmapGreenfield } from '@dope/project-intelligence/lib/node/roadmap-greenfield';
import { RoadmapLinkedObserver } from '@dope/project-intelligence/lib/node/roadmap-linked-observer';
import { RoadmapOwnerLinks } from '@dope/project-intelligence/lib/node/roadmap-owner-links';
import { discoverRoadmapCandidates, previewRoadmapImport } from '@dope/project-intelligence/lib/node/roadmap-import';
import { discoverRoadmapTaskStacks } from '@dope/agent-core/lib/node/roadmap-task-discovery';
import { resolveRoadmapPromptSource } from './roadmap-prompt-open';
import { roadmapServicePath, type RoadmapClient, type RoadmapService } from '../roadmap-service';
import { createRoadmapActionRuntime } from './roadmap-action-runtime';
import { RoadmapPlanningLinks } from './roadmap-planning-links';

export default new ContainerModule(bind => {
    bind(NoteStore).toSelf().inSingletonScope();
    bind(ProjectMindStore).toSelf().inSingletonScope();
    bind(AgentStore).toSelf().inSingletonScope();
    bind(CodexAgentExecutionAdapter).toDynamicValue(context => new CodexAgentExecutionAdapter(
        context.container.get(CodexAuthManager))).inSingletonScope();
    bind(AgentExecutionRuntime).toDynamicValue(context => {
        const inventory = context.container.get(AIInventoryController);
        let runtime!: AgentExecutionRuntime;
        const local = new LocalAgentExecutionAdapter({
            inventory: () => inventory.inventory(),
            workspace: async request => runtime.localWorkspace(request),
            commands: request => runtime.localCommands(request),
            credential: id => context.container.get(AICredentialManager).readForExecution(id)
        });
        runtime = new AgentExecutionRuntime(context.container.get(AgentStore),
            context.container.get(AIRoleRoutingService), inventory,
            new Map<string, AgentExecutionAdapter>([
                ['codex', context.container.get(CodexAgentExecutionAdapter)], ['local', local]]),
            undefined, undefined, context.container.get(SoftwareMapIndex));
        return runtime;
    }).inSingletonScope();
    bind(BackendApplicationContribution).toDynamicValue(context => ({
        onStop: () => context.container.get(AgentExecutionRuntime).dispose()
    })).inSingletonScope();
    bind(SoftwareMapIndex).toDynamicValue(() => new SoftwareMapIndex(new TypeScriptAnalyzer())).inSingletonScope();
    bind(PlanningStore).toSelf().inSingletonScope();
    bind(RoadmapStore).toSelf().inSingletonScope();
    bind(RoadmapGreenfield).toDynamicValue(context => new RoadmapGreenfield(context.container.get(RoadmapStore))).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(context => new RpcConnectionHandler<RoadmapClient>(
        roadmapServicePath, client => {
            const { actions, dispose } = createRoadmapActionRuntime(context.container.get(RoadmapStore),
                () => new VisualPlanningBackend(context.container.get(PlanningStore), context.container.get(SoftwareMapIndex)));
            const handles = new Set<string>();
            const store = context.container.get(RoadmapStore);
            const greenfield = context.container.get(RoadmapGreenfield);
            const draftHandles = new Set<string>();
            const observer = new RoadmapLinkedObserver(root => store.read(root),
                (root, projectId) => client.notifyLinkedDocumentChanged(root, projectId));
            const off = store.onChange(change => client.notifyRoadmapChanged(change));
            client.onDidCloseConnection(() => { off(); observer.dispose(); for (const handle of handles) actions.detach(handle);
                dispose(); });
            const backend: RoadmapService = {
                beginDraft: async uri => { const result = await greenfield.begin(await context.container.get(PlanningStore).root(uri));
                    draftHandles.add(result.handle); return result; },
                recoverDrafts: async uri => {
                    const root = await context.container.get(PlanningStore).root(uri);
                    const restored = await greenfield.restore(root);
                    const chats = new Set((await context.container.get(ChatRepository).read(root)).chats.map(chat => chat.id));
                    for (const item of restored) if (!item.chatId || chats.has(item.chatId)) draftHandles.add(item.handle);
                    return restored.filter(item => !item.chatId || chats.has(item.chatId));
                },
                editDraft: async (handle, revision, action) => {
                    if (!draftHandles.has(handle)) throw new Error('Unknown draft'); return greenfield.edit(handle, revision, action);
                },
                readDraft: async handle => {
                    if (!draftHandles.has(handle)) throw new Error('Unknown draft'); return greenfield.read(handle);
                },
                previewDraft: async (handle, path) => {
                    if (!draftHandles.has(handle)) throw new Error('Unknown draft'); return greenfield.preview(handle, path);
                },
                acceptDraft: async (handle, preview, approved) => {
                    if (!draftHandles.has(handle)) throw new Error('Unknown draft');
                    const result = await greenfield.accept(handle, preview, approved); draftHandles.delete(handle); return result;
                },
                cancelDraft: async handle => { if (draftHandles.has(handle)) { greenfield.cancel(handle); draftHandles.delete(handle); } },
                bindDraftChat: async (uri, handle, chatId) => {
                    if (!draftHandles.has(handle)) throw new Error('Unknown draft');
                    const root = await context.container.get(PlanningStore).root(uri);
                    if (!chatId) { greenfield.unbindChat(root, handle); return; }
                    const chat = (await context.container.get(ChatRepository).read(root)).chats.find(item => item.id === chatId);
                    if (!chat) throw new Error('Saved Chat not found in project');
                    greenfield.bindChat(root, handle, chatId);
                },
                read: async (uri) => context.container.get(RoadmapStore).read(await context.container.get(PlanningStore).root(uri)),
                owners: async (uri) => new RoadmapOwnerLinks().list(await context.container.get(PlanningStore).root(uri)),
                discoverTasks: async (uri) => {
                    const root = await context.container.get(PlanningStore).root(uri);
                    try { return await discoverRoadmapTaskStacks(root); }
                    catch (error) {
                        if (error instanceof Error && error.message.startsWith('Tasks folder not found:')) return [];
                        throw error;
                    }
                },
                resolvePromptSource: async (uri, path, fingerprint) => resolveRoadmapPromptSource(
                    await context.container.get(PlanningStore).root(uri), path, fingerprint),
                discoverImports: async uri => discoverRoadmapCandidates(await context.container.get(PlanningStore).root(uri)),
                previewImport: async (uri, path) => previewRoadmapImport(await context.container.get(PlanningStore).root(uri), path),
                acceptImport: async (uri, revision, projectId, importPreview) => context.container.get(RoadmapStore)
                    .acceptImport(await context.container.get(PlanningStore).root(uri), revision, importPreview, projectId),
                previewReplacement: async (uri, path) => store.previewReplacement(
                    await context.container.get(PlanningStore).root(uri), path),
                applyReplacement: async (uri, preview, approved) => {
                    const root = await context.container.get(PlanningStore).root(uri);
                    const result = await store.applyReplacement(root, preview, approved);
                    if (approved) {
                        try { await observer.rebindIfObserving(root); }
                        catch {
                            client.notifyLinkedDocumentChanged(root, result.projectId);
                            throw new Error('Roadmap replacement committed, but linked observation failed; reopen the Roadmap to retry observation');
                        }
                        client.notifyLinkedDocumentChanged(root, result.projectId);
                    }
                    return result;
                },
                previewDocumentSync: async uri => context.container.get(RoadmapStore)
                    .previewDocumentSync(await context.container.get(PlanningStore).root(uri)),
                applyDocumentSync: async (uri, preview) => context.container.get(RoadmapStore)
                    .applyDocumentSync(await context.container.get(PlanningStore).root(uri), preview),
                previewPendingRecovery: async uri => context.container.get(RoadmapStore)
                    .previewPendingRecovery(await context.container.get(PlanningStore).root(uri)),
                applyPendingRecovery: async (uri, preview, approved) => context.container.get(RoadmapStore)
                    .applyPendingRecovery(await context.container.get(PlanningStore).root(uri), preview, approved),
                previewRelink: async (uri, path) => context.container.get(RoadmapStore)
                    .previewRelink(await context.container.get(PlanningStore).root(uri), path),
                applyRelink: async (uri, preview, approved) => context.container.get(RoadmapStore)
                    .applyRelink(await context.container.get(PlanningStore).root(uri), preview, approved),
                observeLinkedDocument: async uri => observer.observe(uri ? await context.container.get(PlanningStore).root(uri) : undefined),
                attach: async (uri) => {
                    const result = await actions.attach(await context.container.get(PlanningStore).root(uri));
                    handles.add(result.projectHandle);
                    return result;
                },
                detach: async (handle) => { actions.detach(handle); handles.delete(handle); },
                preview: request => actions.preview(request),
                apply: (request, token, approved) => actions.apply(request, token, approved),
                undo: request => actions.undoEligible(request),
                undoToken: (handle, ownerId) => Promise.resolve(actions.undoToken(handle, ownerId))
            };
            return backend;
        })).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(context => new RpcConnectionHandler(historyServicePath, client => {
        const backend = new HistoryBackend(context.container.get(PlanningStore),
            context.container.get(AIRoleRoutingService), context.container.get(ModelConnectionsRegistry));
        client.onDidCloseConnection(() => backend.dispose());
        return backend;
    })).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(context => new RpcConnectionHandler(historyFocusServicePath, client => {
        const backend = new HistoryBackend(context.container.get(PlanningStore));
        client.onDidCloseConnection(() => backend.dispose());
        return backend;
    })).inSingletonScope();
    bind(ChatRepository).toSelf().inSingletonScope();
    bind(ChatContextComposer).toDynamicValue(context => new ChatContextComposer(
        context.container.get(ProjectMindStore), context.container.get(PlanningStore),
        context.container.get(SoftwareMapIndex), context.container.get(ChatRepository),
        context.container.get(RoadmapStore), async (root, link) => {
            const service = new VisualPlanningBackend(context.container.get(PlanningStore), context.container.get(SoftwareMapIndex));
            try { return !!await new RoadmapPlanningLinks(root, service).resolve(root, link); }
            finally { service.dispose(); }
        })).inSingletonScope();
    bind(ChatProjectGrounder).toDynamicValue(context => new ChatProjectGrounder(
        context.container.get(SoftwareMapIndex))).inSingletonScope();
    bind(AIRegistryStore).toSelf().inSingletonScope();
    bind(AIRolePolicyStore).toSelf().inSingletonScope();
    bind(AIRoleRoutingService).toDynamicValue(context => new AIRoleRoutingService(
        context.container.get(AIRolePolicyStore), context.container.get(AIInventoryController),
        context.container.get(ModelConnectionsRegistry))).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(context => new RpcConnectionHandler<AIRolePolicyClient>(aiRolePolicyServicePath, client => {
        const backend = new AIRolePolicyBackend(context.container.get(AIRolePolicyStore),
            context.container.get(AIRegistryStore), client);
        client.onDidCloseConnection(() => backend.dispose());
        return backend;
    })).inSingletonScope();
    bind(AICredentialManager).toDynamicValue(context => new AICredentialManager(context.container.get(AIRegistryStore))).inSingletonScope();
    bind(CodexAuthManager).toDynamicValue(context => new CodexAuthManager(context.container.get(AIRegistryStore))).inSingletonScope();
    bind(CodexAppServer).toDynamicValue(context => new CodexAppServer(context.container.get(CodexAuthManager))).inSingletonScope();
    bind(BackendApplicationContribution).toDynamicValue(context => ({
        onStop: () => context.container.get(CodexAppServer).dispose()
    })).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(context => new RpcConnectionHandler(codexAuthServicePath,
        () => new CodexAuthBackend(context.container.get(CodexAuthManager)))).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(context => new RpcConnectionHandler<AICredentialClient>(aiCredentialServicePath, client => {
        const backend = new AICredentialBackend(context.container.get(AICredentialManager), client);
        client.onDidCloseConnection(() => backend.dispose());
        return backend;
    })).inSingletonScope();
    bind(ModelConnectionsRegistry).toDynamicValue(context => new ModelConnectionsRegistry(undefined,
        context.container.get(AIRegistryStore), context.container.get(AICredentialManager))).inSingletonScope();
    bind(AIInventoryController).toDynamicValue(context => new AIInventoryController(context.container.get(AIRegistryStore),
        context.container.get(ModelConnectionsRegistry), context.container.get(AICredentialManager),
        context.container.get(CodexAppServer))).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(context => new RpcConnectionHandler<AIRegistryClient>(aiRegistryServicePath, client => {
        const backend = new AIRegistryBackend(context.container.get(AIRegistryStore), client, undefined,
            context.container.get(AIInventoryController));
        client.onDidCloseConnection(() => backend.dispose());
        return backend;
    })).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(context => new RpcConnectionHandler<ModelConnectionsClient>(modelConnectionsServicePath, client => {
        const backend = new ModelConnectionsBackend(context.container.get(ModelConnectionsRegistry), client);
        client.onDidCloseConnection(() => backend.dispose());
        return backend;
    })).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(context => new RpcConnectionHandler<ChatClient>(`${chatServicePath}/:panelId`, client => {
        const { actions, dispose } = createRoadmapActionRuntime(context.container.get(RoadmapStore),
            () => new VisualPlanningBackend(context.container.get(PlanningStore), context.container.get(SoftwareMapIndex)));
        const backend = new ChatBackend(context.container.get(ChatRepository), client,
            context.container.get(ModelConnectionsRegistry), context.container.get(ChatContextComposer),
            context.container.get(AIRoleRoutingService), context.container.get(ChatProjectGrounder),
            actions, context.container.get(RoadmapGreenfield));
        client.onDidCloseConnection(() => { backend.dispose(); dispose(); });
        return backend;
    })).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(context => new RpcConnectionHandler<object>(visualPlanningServicePath, client => {
        const backend = new VisualPlanningBackend(context.container.get(PlanningStore), context.container.get(SoftwareMapIndex));
        client.onDidCloseConnection(() => backend.dispose());
        return backend;
    })).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(context => new RpcConnectionHandler<SoftwareMapClient>(softwareMapServicePath, client => {
        const backend = new SoftwareMapBackend(context.container.get(SoftwareMapIndex), client, undefined, undefined,
            context.container.get(AIRegistryStore), context.container.get(AICredentialManager));
        client.onDidCloseConnection(() => backend.dispose());
        return backend;
    })).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(context => new RpcConnectionHandler<ProjectMindClient>(projectMindServicePath, client => {
        const backend = new ProjectMindBackend(context.container.get(ProjectMindStore), client);
        client.onDidCloseConnection(() => backend.dispose());
        return backend;
    })).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(context => new RpcConnectionHandler<AgentRuntimeClient>(agentRuntimeServicePath, client => {
        const backend = new AgentRuntimeBackend(context.container.get(AgentStore), client,
            context.container.get(AgentExecutionRuntime), context.container.get(PlanningStore));
        client.onDidCloseConnection(() => backend.dispose());
        return backend;
    })).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(context => new RpcConnectionHandler<NoteClient>(noteServicePath, client => {
        const backend = new NoteBackend(context.container.get(NoteStore), client);
        client.onDidCloseConnection(() => backend.dispose());
        return backend;
    })).inSingletonScope();
});
