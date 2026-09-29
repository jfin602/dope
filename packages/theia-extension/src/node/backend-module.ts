import { ContainerModule } from '@theia/core/shared/inversify';
import { ConnectionHandler, RpcConnectionHandler } from '@theia/core/lib/common';
import { NoteClient, noteServicePath } from '@dope/contracts/lib/note-service';
import { NoteBackend } from './note-backend';
import { NoteStore } from './note-store';
import { ProjectMindClient, projectMindServicePath } from '@dope/contracts/lib/project-mind-service';
import { ProjectMindStore } from '@dope/project-intelligence/lib/node/project-mind-store';
import { ProjectMindBackend } from './project-mind-backend';

export default new ContainerModule(bind => {
    bind(NoteStore).toSelf().inSingletonScope();
    bind(ProjectMindStore).toSelf().inSingletonScope();
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
