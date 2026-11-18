import { randomUUID } from 'node:crypto';
import { checkWorkMCPObservationApproval, parseExecutionGrant } from '@dope/agent-core/lib/authority';
import type { ExecutionGrant, WorkMCPObservationCallApproval, WorkMCPObservationScope } from '@dope/agent-core/lib/authority';
import { mcpProjectKey, MCPProjectPreferencesStore } from './mcp-project-preferences-store';
import { MCPServerRegistryStore } from './mcp-server-registry-store';
import { reviewedMCPObservation, reviewedMCPObservations } from './mcp-chat-observation';

export interface PendingWorkMCPObservation {
    id: string; runId: string; taskId: string; projectKey: string;
    serverId: string; toolName: string; expiresAt: string;
}

/** The browser may decide a pending call; only this backend constructs its exact approval. */
export class WorkMCPObservationAuthority {
    private readonly sessions = new Map<string, Set<() => void>>();
    private readonly pending = new Map<string, { view: PendingWorkMCPObservation;
        grant: ExecutionGrant; current: Omit<WorkMCPObservationCallApproval, 'approvedAt' | 'approvedBy'>;
        resolve: (approval: WorkMCPObservationCallApproval | undefined) => void;
        timer: ReturnType<typeof setTimeout>; signal: AbortSignal; cancel: () => void }>();
    private readonly listeners = new Set<(root: string, runId: string) => void>();

    constructor(readonly registry: MCPServerRegistryStore, readonly preferences: MCPProjectPreferencesStore) {}

    onChange(listener: (root: string, runId: string) => void): () => void {
        this.listeners.add(listener); return () => this.listeners.delete(listener);
    }
    private changed(root: string, runId: string): void {
        for (const listener of this.listeners) { try { listener(root, runId); } catch {} }
    }
    registerSession(root: string, revoke: () => void): () => void {
        const sessions = this.sessions.get(root) ?? new Set<() => void>();
        sessions.add(revoke); this.sessions.set(root, sessions);
        return () => { sessions.delete(revoke); if (!sessions.size) this.sessions.delete(root); };
    }
    revoke(root: string): void {
        this.finish(root, undefined);
        for (const revoke of this.sessions.get(root) ?? []) { try { revoke(); } catch {} }
    }

    /** Current global, project and reviewed-method checks. Server metadata grants nothing. */
    async offer(root: string, connectionId: string, modelId: string): Promise<WorkMCPObservationScope | undefined> {
        const projectKey = await mcpProjectKey(root);
        const [catalog, activation] = await Promise.all([this.registry.read(), this.preferences.read()]);
        const eligible = reviewedMCPObservations().flatMap(policy => catalog.servers.filter(server =>
            server.id === policy.serverId && server.lifecycle === 'installed' &&
            server.configStatus === 'configured' && !!server.config.launch && !!server.credential &&
            activation.preferences.some(item => item.projectKey === projectKey && item.serverId === server.id &&
                item.registrationRevision === server.registrationRevision && item.enabled))
            .map(server => ({ server, toolName: policy.toolName })));
        if (eligible.length !== 1) return undefined;
        const { server, toolName } = eligible[0];
        if (await this.registry.bridgeCredentialStatus(server.id) !== 'available') return undefined;
        return { projectKey, serverId: server.id, registrationRevision: server.registrationRevision,
            catalogRevision: catalog.revision,
            toolName, connectionId, modelId, maxCalls: 1,
            expiresAt: new Date(Date.now() + 10 * 60_000).toISOString() };
    }

    async assertScope(root: string, grant: ExecutionGrant, connectionId: string, modelId: string): Promise<void> {
        const scope = parseExecutionGrant(grant).mcpObservation;
        if (!scope) return;
        if (!reviewedMCPObservation(scope.serverId, scope.toolName) ||
            scope.connectionId !== connectionId || scope.modelId !== modelId ||
            Date.now() > Date.parse(scope.expiresAt)) throw new Error('Work MCP observation scope unavailable');
        const offered = await this.offer(root, connectionId, modelId);
        if (!offered || offered.projectKey !== scope.projectKey || offered.serverId !== scope.serverId ||
            offered.registrationRevision !== scope.registrationRevision ||
            offered.catalogRevision !== scope.catalogRevision || offered.toolName !== scope.toolName)
            throw new Error('Work MCP observation server or project unavailable');
    }

    list(root: string): PendingWorkMCPObservation[] {
        const pending = this.pending.get(root);
        return pending ? [pending.view] : [];
    }

    request(root: string, runId: string, grant: ExecutionGrant,
        current: Omit<WorkMCPObservationCallApproval, 'approvedAt' | 'approvedBy'>,
        signal: AbortSignal): Promise<WorkMCPObservationCallApproval | undefined> {
        if (signal.aborted || this.pending.has(root) || !grant.mcpObservation ||
            grant.mcpObservation.projectKey !== current.projectKey || grant.taskId !== current.taskId)
            return Promise.resolve(undefined);
        const id = randomUUID();
        const view = { id, runId, taskId: current.taskId, projectKey: current.projectKey,
            serverId: current.serverId, toolName: current.toolName,
            expiresAt: new Date(Math.min(Date.now() + 60_000,
                Date.parse(grant.mcpObservation.expiresAt))).toISOString() };
        return new Promise(resolve => {
            const cancel = () => this.finish(root, undefined);
            const timer = setTimeout(cancel, Math.max(1, Date.parse(view.expiresAt) - Date.now()));
            timer.unref?.();
            this.pending.set(root, { view, grant, current, resolve, timer, signal, cancel });
            signal.addEventListener('abort', cancel, { once: true });
            this.changed(root, runId);
        });
    }

    private finish(root: string, approval: WorkMCPObservationCallApproval | undefined): void {
        const pending = this.pending.get(root);
        if (!pending) return;
        this.pending.delete(root);
        clearTimeout(pending.timer);
        pending.signal.removeEventListener('abort', pending.cancel);
        pending.resolve(approval);
        this.changed(root, pending.view.runId);
    }

    decide(root: string, runId: string, requestId: string, approved: boolean): void {
        const pending = this.pending.get(root);
        if (!pending || pending.view.runId !== runId || pending.view.id !== requestId ||
            typeof approved !== 'boolean') throw new Error('Stale Work MCP approval request');
        const now = new Date().toISOString();
        if (!approved || pending.signal.aborted || now > pending.view.expiresAt) {
            this.finish(root, undefined); return;
        }
        const approval: WorkMCPObservationCallApproval = { ...pending.current, approvedAt: now, approvedBy: 'developer' };
        this.finish(root, checkWorkMCPObservationApproval(pending.grant, approval, pending.current, 0, now) ?
            approval : undefined);
    }

    dispose(): void { for (const root of [...this.sessions.keys(), ...this.pending.keys()]) this.revoke(root);
        this.listeners.clear(); }
}
