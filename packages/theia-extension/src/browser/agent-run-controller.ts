import { AGENT_SCHEMA_VERSION, createDefaultExecutionGrant, parseAgentTask } from '@dope/agent-core';
import type { AgentModelPolicy, AgentRun, AgentRunEvent, AgentTask, AgentTaskSequence } from '@dope/agent-core';
import { findEligibleModels, futureFeatureRoleRequest, resolveAIRole } from '@dope/ai';
import type { AIInventoryState } from '@dope/contracts/lib/ai-registry-service';
import type { AIRegistryService } from '@dope/contracts/lib/ai-registry-service';
import type { AIRolePolicyService } from '@dope/contracts/lib/ai-role-policy-service';
import type { AgentRuntimeService } from '@dope/contracts/lib/agent-runtime-service';

export interface AgentTarget { connectionId: string; modelId: string; label: string; locality: 'local' | 'hosted'; context?: number }
export class AgentRunController {
    project?: string;
    handle?: string;
    runs: AgentRun[] = [];
    sequences: AgentTaskSequence[] = [];
    selected?: AgentRun;
    task?: AgentTask;
    events: AgentRunEvent[] = [];
    exactTargets: AgentTarget[] = [];
    resolved?: AgentTarget;
    targetMessage = '';
    message = '';
    busy = false;
    accepted = false;
    hostedProjectDataAuthorized = false;
    objective = '';
    instructions = '';
    validationCommand = '';
    policy: AgentModelPolicy = { kind: 'follow-coding-agent' };
    private sequence = 0;
    private refreshing = false;
    private serial = 0;

    constructor(private readonly runtime: AgentRuntimeService, private readonly registry: AIRegistryService,
        private readonly roles: AIRolePolicyService, private readonly changed: () => void) {}

    async attach(project?: string): Promise<void> {
        const serial = ++this.serial;
        this.project = project; this.handle = undefined; this.runs = []; this.sequences = []; this.selected = undefined;
        this.task = undefined; this.events = []; this.sequence = 0; this.accepted = false; this.hostedProjectDataAuthorized = false;
        this.objective = ''; this.instructions = ''; this.validationCommand = '';
        this.changed();
        if (!project) return;
        try {
            const { projectHandle } = await this.runtime.attach(project);
            if (serial !== this.serial) return;
            this.handle = projectHandle;
            await this.refresh();
            await this.resolveTarget();
        } catch {
            if (serial === this.serial) { this.message = 'Agent Run could not attach to this project.'; this.changed(); }
        }
    }

    private localEndpointReady(endpoint: string): boolean {
        try { const url = new URL(endpoint); return url.protocol === 'http:' && !url.username && !url.password &&
            !url.search && !url.hash && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
            ['/', '/v1', '/v1/'].includes(url.pathname); } catch { return false; }
    }
    async resolvePolicyTarget(policy: AgentModelPolicy): Promise<{ target?: AgentTarget; targets: AgentTarget[]; reason: string }> {
        const inventory = await this.registry.inventory();
        const eligible = findEligibleModels(inventory.registry, { capabilities: ['agentExecution'],
            enabledOnly: true, usableOnly: true, loadedLocalModels: inventory.loadedLocalModels,
            minimumKnownContextTokens: 2304 }, inventory.observations);
        const targets = eligible.models.filter(model => {
            const connection = inventory.registry.connections.find(item => item.id === model.connectionId);
            return model.capabilities.agentExecution?.source === 'adapter-known' &&
                (model.locality === 'local' ? connection?.config.type === 'local' && connection.config.runtime === 'lm-studio' &&
                    this.localEndpointReady(connection.config.endpoint) :
                    connection?.config.type === 'codex' && connection.config.runtime === 'app-server' &&
                    connection.codexAccount?.status === 'signed-in' && connection.codexAccount.planUsage === 'available' &&
                    Boolean(connection.codexAccount.accountId));
        }).map(model => this.labelTarget(inventory, model.connectionId, model.providerModelKey));
        const roles = await this.roles.list();
        const request = futureFeatureRoleRequest('coding-agent', true);
        const resolution = resolveAIRole({ policy: roles, inventory: inventory.registry, observations: inventory.observations,
            loadedLocalModels: inventory.loadedLocalModels ?? [], roleId: 'coding-agent',
            requestHard: request.requestHard, hostedProjectDataAuthorized: true });
        const candidate = resolution.candidates[0]?.target;
        const target = policy.kind === 'exact' ? targets.find(item => item.connectionId === policy.connectionId &&
            item.modelId === policy.modelId) : candidate && targets.find(item => item.connectionId === candidate.connectionId &&
                item.modelId === candidate.modelId);
        const reason = target ? '' : policy.kind === 'exact' ? 'Selected Coding Agent is unavailable, unprobed or has insufficient observed context.' :
            resolution.excluded[0]?.reason ? `Coding Agent unavailable: ${resolution.excluded[0].reason}. Check AI Center readiness and loaded context.` :
            'No eligible Coding Agent target. Configure a ready model in AI Center.';
        return { target, targets, reason };
    }
    async resolveTarget(): Promise<void> {
        const serial = this.serial, policy = this.policy;
        try {
            const result = await this.resolvePolicyTarget(policy);
            if (serial !== this.serial || policy !== this.policy) return;
            const previous = this.resolved;
            this.exactTargets = result.targets;
            this.resolved = result.target;
            if (previous && (!result.target || previous.connectionId !== result.target.connectionId ||
                previous.modelId !== result.target.modelId || previous.locality !== result.target.locality)) {
                this.accepted = false; this.hostedProjectDataAuthorized = false;
            }
            this.targetMessage = result.target ? `Coding Agent target: ${result.target.label} (${result.target.locality}${
                result.target.context ? `, observed context ${result.target.context} tokens` : ''})` : result.reason;
            this.changed();
        } catch {
            if (serial === this.serial) { this.resolved = undefined; this.exactTargets = [];
                this.accepted = false; this.hostedProjectDataAuthorized = false;
                this.targetMessage = 'Coding Agent target could not be resolved.'; this.changed(); }
        }
    }
    private labelTarget(state: AIInventoryState, connectionId: string, modelId: string): AgentTarget {
        const connection = state.registry.connections.find(item => item.id === connectionId);
        const model = state.registry.models.find(item => item.connectionId === connectionId && item.providerModelKey === modelId);
        return { connectionId, modelId, label: `${connection?.alias ?? 'Connection'} · ${model?.label ?? 'Model'}`,
            locality: model?.locality ?? 'hosted', context: state.loadedLocalModels?.find(item =>
                item.connectionId === connectionId && item.providerModelKey === modelId)?.contextWindowTokens };
    }
    setPolicy(policy: AgentModelPolicy): void { this.policy = policy; this.accepted = false; this.hostedProjectDataAuthorized = false; this.resolved = undefined; void this.resolveTarget(); this.changed(); }
    edit(objective: string, instructions: string): void { this.objective = objective; this.instructions = instructions;
        this.accepted = false; }
    setValidation(command: string): void { this.validationCommand = command; this.accepted = false; this.changed(); }
    acceptGrant(accepted: boolean): void { this.accepted = accepted; this.changed(); }
    authorizeHostedProjectData(authorized: boolean): void { this.hostedProjectDataAuthorized = authorized; this.changed(); }
    get canStart(): boolean { return Boolean((this.resolved?.locality !== 'hosted' || this.hostedProjectDataAuthorized) && this.handle && this.project && this.resolved && this.accepted &&
        this.objective.trim() && this.instructions.trim() && !this.busy && !this.runs.some(run =>
            ['pending', 'running', 'blocked', 'cancelling'].includes(run.status))); }
    async start(): Promise<AgentRun | undefined> {
        if (!this.canStart || !this.handle || !this.project) return;
        this.busy = true; this.message = ''; this.changed();
        try {
            const shown = this.resolved!;
            const fresh = (await this.resolvePolicyTarget(this.policy)).target;
            if (!fresh || fresh.connectionId !== shown.connectionId || fresh.modelId !== shown.modelId ||
                fresh.locality !== shown.locality || (fresh.locality === 'hosted' && !this.hostedProjectDataAuthorized))
                throw new Error('Coding Agent selection changed. Review the target and approve again.');
            const hostedAuthorized = shown.locality === 'hosted' && this.hostedProjectDataAuthorized;
            const task = parseAgentTask({ version: AGENT_SCHEMA_VERSION, id: crypto.randomUUID(), createdAt: new Date().toISOString(),
                objective: this.objective.trim(), instructions: this.instructions.trim(), projectRoot: '.',
                modelPolicy: this.policy, controls: {}, authority: { profile: 'phase-8b-project' },
                completion: { validation: this.validationCommand.trim() ?
                    [{ kind: 'test', label: 'Required validation', command: this.validationCommand.trim() }] : [],
                    requireValidationPass: Boolean(this.validationCommand.trim()) }, origin: { kind: 'direct' } });
            this.task = await this.runtime.createTask(this.handle, task);
            const grant = createDefaultExecutionGrant({ id: crypto.randomUUID(), revision: 1, taskId: task.id,
                acceptedAt: new Date().toISOString() });
            const run = await this.runtime.start(this.handle, this.project, task.id, grant, hostedAuthorized);
            this.selected = run; this.accepted = false; this.hostedProjectDataAuthorized = false;
            await this.refresh();
            return run;
        } catch { this.message = 'Agent Run could not start. Review the project, target and grant, then retry.'; }
        finally { this.busy = false; this.changed(); }
    }
    async stop(): Promise<void> {
        if (!this.handle || !this.selected || !['pending', 'running', 'blocked'].includes(this.selected.status) || this.busy) return;
        this.busy = true; this.changed();
        try { this.selected = await this.runtime.stop(this.handle, this.selected.id); await this.refresh(); }
        catch { this.message = 'Stop request failed. Check the run status and retry.'; }
        finally { this.busy = false; this.changed(); }
    }
    async select(runId: string): Promise<void> {
        if (!this.handle) return;
        const run = await this.runtime.readRun(this.handle, runId);
        if (!run) return;
        this.selected = run; this.task = await this.runtime.readTask(this.handle, run.taskId);
        this.events = []; this.sequence = 0;
        await this.refresh();
    }
    async resumeManualGate(sequenceId: string): Promise<void> {
        if (!this.handle || this.busy) return;
        this.busy = true; this.message = ''; this.changed();
        try {
            const result = await this.runtime.reconcileManualGate(this.handle, sequenceId);
            this.message = result.gateMessage ?? (result.status === 'completed' ?
                'Manual closeout checkpoint verified.' : 'Manual checkpoint verified; next entry is ready.');
            this.sequences = await this.runtime.listSequences(this.handle);
        } catch { this.message = 'Manual gate reconciliation failed. Inspect the repository and retry.'; }
        finally { this.busy = false; this.changed(); }
    }
    async refresh(): Promise<void> {
        if (!this.handle || this.refreshing) return;
        this.refreshing = true;
        const handle = this.handle;
        try {
            const before = JSON.stringify(this.runs.map(run => [run.id, run.status, run.endedAt, run.changedFiles.length, run.validationResults.length, run.changeSummary?.summary]));
            const priorGates = JSON.stringify(this.sequences);
            const priorSequence = this.sequence;
            [this.runs, this.sequences] = await Promise.all([this.runtime.listRuns(handle), this.runtime.listSequences(handle)]);
            if (this.handle !== handle) return;
            if (this.selected) this.selected = this.runs.find(item => item.id === this.selected?.id) ?? this.selected;
            else if (this.runs.length) { this.selected = this.runs[0]; this.task = await this.runtime.readTask(handle, this.selected.taskId); }
            if (this.selected) {
                for (let page = 0; page < 4; page++) {
                    const result = await this.runtime.readEvents(handle, this.selected.id, this.sequence, 100);
                    if (this.handle !== handle) return;
                    this.events.push(...result.events); this.events = this.events.slice(-300);
                    this.sequence = result.nextSequence;
                    if (!result.hasMore) break;
                }
            }
            if (priorGates !== JSON.stringify(this.sequences) ||
                before !== JSON.stringify(this.runs.map(run => [run.id, run.status, run.endedAt, run.changedFiles.length, run.validationResults.length, run.changeSummary?.summary])) ||
                priorSequence !== this.sequence) this.changed();
        } catch { this.message = 'Agent Run activity could not be refreshed.'; this.changed(); }
        finally { this.refreshing = false; }
    }
}
