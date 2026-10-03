import { ContainerModule } from '@theia/core/shared/inversify';
import { ConnectionHandler, RpcConnectionHandler } from '@theia/core/lib/common';
import { KeyStoreService } from '@theia/core/lib/common/key-store';
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
import { modelConnectionsServicePath, type ModelConnectionsClient } from '@dope/contracts/lib/model-connections-service';
import { ModelConnectionsBackend, ModelConnectionsRegistry } from './model-connections';

export default new ContainerModule(bind => {
    bind(NoteStore).toSelf().inSingletonScope();
    bind(ProjectMindStore).toSelf().inSingletonScope();
    bind(SoftwareMapIndex).toDynamicValue(() => new SoftwareMapIndex(new TypeScriptAnalyzer())).inSingletonScope();
    bind(PlanningStore).toSelf().inSingletonScope();
    bind(ChatRepository).toSelf().inSingletonScope();
    bind(ChatContextComposer).toDynamicValue(context => new ChatContextComposer(
        context.container.get(ProjectMindStore), context.container.get(PlanningStore),
        context.container.get(SoftwareMapIndex), context.container.get(ChatRepository))).inSingletonScope();
    bind(ModelConnectionsRegistry).toDynamicValue(() => new ModelConnectionsRegistry()).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(context => new RpcConnectionHandler<ModelConnectionsClient>(modelConnectionsServicePath, client => {
        const backend = new ModelConnectionsBackend(context.container.get(ModelConnectionsRegistry), client);
        client.onDidCloseConnection(() => backend.dispose());
        return backend;
    })).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(context => new RpcConnectionHandler<ChatClient>(chatServicePath, client => {
        const backend = new ChatBackend(context.container.get(ChatRepository), client,
            context.container.get(ModelConnectionsRegistry), context.container.get(ChatContextComposer));
        client.onDidCloseConnection(() => backend.dispose());
        return backend;
    })).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(context => new RpcConnectionHandler<object>(visualPlanningServicePath, client => {
        const backend = new VisualPlanningBackend(context.container.get(PlanningStore), context.container.get(SoftwareMapIndex));
        client.onDidCloseConnection(() => backend.dispose());
        return backend;
    })).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(context => new RpcConnectionHandler<SoftwareMapClient>(softwareMapServicePath, client => {
        const backend = new SoftwareMapBackend(context.container.get(SoftwareMapIndex), client, undefined, undefined,
            context.container.get(KeyStoreService));
        client.onDidCloseConnection(() => backend.dispose());
        return backend;
    })).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(context => new RpcConnectionHandler<ProjectMindClient>(projectMindServicePath, client => {
        const backend = new ProjectMindBackend(context.container.get(ProjectMindStore), client);
        client.onDidCloseConnection(() => backend.dispose());
        return backend;
    })).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(context => new RpcConnectionHandler<NoteClient>(noteServicePath, client => {
        const backend = new NoteBackend(context.container.get(NoteStore), client);
        client.onDidCloseConnection(() => backend.dispose());
        return backend;
    })).inSingletonScope();
});
