import { ContainerModule } from '@theia/core/shared/inversify';
import { ConnectionHandler, RpcConnectionHandler } from '@theia/core/lib/common';
import { NoteClient, noteServicePath } from '@dope/contracts/lib/note-service';
import { NoteBackend } from './note-backend';
import { NoteStore } from './note-store';

export default new ContainerModule(bind => {
    bind(NoteStore).toSelf().inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(context => new RpcConnectionHandler<NoteClient>(noteServicePath, client => {
        const backend = new NoteBackend(context.container.get(NoteStore), client);
        client.onDidCloseConnection(() => backend.dispose());
        return backend;
    })).inSingletonScope();
});
