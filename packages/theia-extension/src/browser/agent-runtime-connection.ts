import type { interfaces } from '@theia/core/shared/inversify';
import { AgentRuntimeService, type AgentRuntimeClient, type AgentStoreChange } from '@dope/contracts/lib/agent-runtime-service';

/** One renderer-owned channel; mounted views are subscribers, never channel owners. */
export function bindSharedAgentRuntime(bind: interfaces.Bind,
    create: (container: interfaces.Container, client: AgentRuntimeClient) => AgentRuntimeService,
    notify: (container: interfaces.Container, change: AgentStoreChange) => void): void {
    bind(AgentRuntimeService).toDynamicValue(context => create(context.container, {
        notifyAgentStateChanged: change => notify(context.container, change)
    })).inSingletonScope();
}
