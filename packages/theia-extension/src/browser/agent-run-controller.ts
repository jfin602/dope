import { AGENT_SCHEMA_VERSION, createDefaultExecutionGrant, parseAgentTask } from '@dope/agent-core';
import type { AgentModelPolicy, AgentRun, AgentRunEvent, AgentTask, AgentTaskSequence } from '@dope/agent-core';
import { findEligibleModels, futureFeatureRoleRequest, resolveAIRole } from '@dope/ai';
import type { AIInventoryState } from '@dope/contracts/lib/ai-registry-service';
import type { AIRegistryService } from '@dope/contracts/lib/ai-registry-service';
import type { AIRolePolicyService } from '@dope/contracts/lib/ai-role-policy-service';
import type { AgentRuntimeService } from '@dope/contracts/lib/agent-runtime-service';

export interface AgentTarget { connectionId: string; modelId: string; label: string }
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
    objective = '';
    instructions = '';
    policy: AgentModelPolicy = { kind: 'follow-coding-agent' };
    private sequence = 0;
    private refreshing = false;
    private serial = 0;

    constructor(private readonly runtime: AgentRuntimeService, private readonly registry: AIRegistryService,
        private readonly roles: AIRolePolicyService, private readonly changed: () => void) {}

    async attach(project?: string): Promise<void> {
        const serial = ++this.serial;
        this.project = project; this.handle = undefined; this.runs = []; this.sequences = []; this.selected = undefined;
        this.task = undefined; this.events = []; this.sequence = 0; this.accepted = false;
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

    async resolveTarget(): Promise<void> {
        const serial = this.serial;
        try {
            const inventory = await this.registry.inventory();
            const eligible = findEligibleModels(inventory.registry, { capabilities: ['agentExecution'],
                enabledOnly: true, usableOnly: true, loadedLocalModels: inventory.loadedLocalModels }, inventory.observations);
            const targets = eligible.models.filter(model => {
                const connection = inventory.registry.connections.find(item => item.id === model.connectionId);
                return model.capabilities.agentExecution?.source === 'adapter-known' && model.locality === 'hosted' &&
                    connection?.config.type === 'codex' && connection.config.runtime === 'app-server' &&
                    connection.codexAccount?.status === 'signed-in' && connection.codexAccount.planUsage === 'available' &&
                    Boolean(connection.codexAccount.accountId);
            }).map(model => this.labelTarget(inventory, model.connectionId, model.providerModelKey));
            const policy = await this.roles.list();
            const request = futureFeatureRoleRequest('coding-agent', true);
            const resolution = resolveAIRole({ policy, inventory: inventory.registry, observations: inventory.observations,
                loadedLocalModels: inventory.loadedLocalModels ?? [], roleId: 'coding-agent',
                requestHard: request.requestHard, hostedProjectDataAuthorized: true });
            const candidate = resolution.candidates[0]?.target;
            if (serial !== this.serial) return;
            const previousTarget = this.resolved && `${this.resolved.connectionId}/${this.resolved.modelId}`;
            this.exactTargets = targets;
            const selectedPolicy = this.policy;
            this.resolved = selectedPolicy.kind === 'exact' ? targets.find(item => item.connectionId === selectedPolicy.connectionId &&
                item.modelId === selectedPolicy.modelId) : candidate && targets.find(item => item.connectionId === candidate.connectionId &&
                    item.modelId === candidate.modelId);
            if (previousTarget && previousTarget !== (this.resolved && `${this.resolved.connectionId}/${this.resolved.modelId}`))
                this.accepted = false;
            this.targetMessage = this.resolved ? `Coding Agent target: ${this.resolved.label} (hosted)` :
                'No eligible Coding Agent target. Configure a ready Codex agent model in AI Center.';
            this.changed();
        } catch {
            if (serial === this.serial) { this.resolved = undefined; this.exactTargets = [];
                this.targetMessage = 'Coding Agent target could not be resolved.'; this.changed(); }
        }
    }
    private labelTarget(state: AIInventoryState, connectionId: string, modelId: string): AgentTarget {
        const connection = state.registry.connections.find(item => item.id === connectionId);
        const model = state.registry.models.find(item => item.connectionId === connectionId && item.providerModelKey === modelId);
        return { connectionId, modelId, label: `${connection?.alias ?? 'Connection'} · ${model?.label ?? 'Model'}` };
    }
    setPolicy(policy: AgentModelPolicy): void { this.policy = policy; this.accepted = false; void this.resolveTarget(); this.changed(); }
    edit(objective: string, instructions: string): void { this.objective = objective; this.instructions = instructions;
        this.accepted = false; }
    acceptGrant(accepted: boolean): void { this.accepted = accepted; this.changed(); }
    get canStart(): boolean { return Boolean(this.handle && this.project && this.resolved && this.accepted &&
        this.objective.trim() && this.instructions.trim() && !this.busy && !this.runs.some(run =>
            ['pending', 'running', 'blocked', 'cancelling'].includes(run.status))); }
    async start(): Promise<void> {
        if (!this.canStart || !this.handle || !this.project) return;
        this.busy = true; this.message = ''; this.changed();
        try {
            const task = parseAgentTask({ version: AGENT_SCHEMA_VERSION, id: crypto.randomUUID(), createdAt: new Date().toISOString(),
                objective: this.objective.trim(), instructions: this.instructions.trim(), projectRoot: '.',
                modelPolicy: this.policy, controls: {}, authority: { profile: 'phase-8b-project' },
                completion: { validation: [], requireValidationPass: false }, origin: { kind: 'direct' } });
            this.task = await this.runtime.createTask(this.handle, task);
            const grant = createDefaultExecutionGrant({ id: crypto.randomUUID(), revision: 1, taskId: task.id,
                acceptedAt: new Date().toISOString() });
            const run = await this.runtime.start(this.handle, this.project, task.id, grant, true);
            this.selected = run; this.accepted = false;
            await this.refresh();
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
