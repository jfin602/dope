import { BaseWidget, codicon, Message } from '@theia/core/lib/browser/widgets/widget';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { AgentRunController } from './agent-run-controller';
import type { AgentRuntimeService } from '@dope/contracts/lib/agent-runtime-service';
import type { AIRegistryService } from '@dope/contracts/lib/ai-registry-service';
import type { AIRolePolicyService } from '@dope/contracts/lib/ai-role-policy-service';
import { createDefaultExecutionGrant, EFFECT_KINDS } from '@dope/agent-core';

export const AGENT_RUN_ID = 'dope-agent-run';
const names: Record<string, string> = { 'workspace-read': 'Read isolated workspace', 'workspace-write': 'Edit isolated workspace',
    'workspace-process': 'Run workspace processes', 'workspace-test': 'Run workspace tests',
    'workspace-build': 'Run workspace builds', 'project-create': 'Create project files after review',
    'project-modify': 'Modify project files after review', 'project-delete': 'Delete project files',
    'project-rename': 'Rename project files',
    'git-inspect': 'Inspect Git', 'git-write': 'Write Git index or refs', 'git-history': 'Change Git history',
    network: 'Network access', secrets: 'Access secrets', 'private-state': 'Access private state',
    'outside-root': 'Access outside project', destructive: 'Destructive actions', system: 'System actions',
    'package-admin': 'Package administration' };
function el<Tag extends keyof HTMLElementTagNameMap>(tag: Tag, content?: string): HTMLElementTagNameMap[Tag] {
    const node = document.createElement(tag); if (content !== undefined) node.textContent = content; return node;
}
function button(text: string, action: () => void, disabled = false): HTMLButtonElement {
    const node = el('button', text); node.type = 'button'; node.disabled = disabled; node.onclick = action; return node;
}

export class AgentRunWidget extends BaseWidget {
    controller: AgentRunController;
    private readonly content = el('div');
    private timer?: ReturnType<typeof setInterval>;
    private readonly workspaceListener;
    constructor(private readonly runtimeFactory: () => AgentRuntimeService, private readonly registry: AIRegistryService,
        private readonly roles: AIRolePolicyService,
        private readonly workspaces: WorkspaceService) {
        super(); this.id = AGENT_RUN_ID; this.title.label = this.title.caption = 'Agent Run';
        this.title.iconClass = codicon('play-circle'); this.title.closable = true;
        this.addClass('dope-agent-run'); this.node.tabIndex = 0; this.node.append(this.content);
        this.controller = new AgentRunController(runtimeFactory(), registry, roles, () => this.render());
        this.workspaceListener = workspaces.onWorkspaceChanged(() => void this.attach());
        void this.attach(); this.render();
    }
    private async attach(): Promise<void> {
        const roots = await this.workspaces.roots;
        const project = roots.length === 1 ? roots[0].resource.toString() : undefined;
        if (this.controller.project && this.controller.project !== project)
            this.controller = new AgentRunController(this.runtimeFactory(), this.registry, this.roles, () => this.render());
        await this.controller.attach(project);
    }
    protected override onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg); this.timer = setInterval(() => void this.controller.refresh(), 1200);
        void this.controller.refresh();
    }
    protected override onBeforeDetach(msg: Message): void {
        if (this.timer) clearInterval(this.timer); this.timer = undefined; super.onBeforeDetach(msg);
    }
    protected override onCloseRequest(msg: Message): void {
        this.workspaceListener.dispose(); super.onCloseRequest(msg);
    }
    private syncStart(): void { const start = this.content.querySelector<HTMLButtonElement>('[data-agent-start]');
        if (start) start.disabled = !this.controller.canStart;
        const accept = this.content.querySelector<HTMLInputElement>('input[aria-label="Accept Grant"]');
        if (accept) accept.checked = this.controller.accepted; }
    private render(): void {
        const c = this.controller;
        const root = el('div'); root.append(el('h2', 'Agent Run'));
        const status = el('p', c.message || (!c.project ? 'Open one project folder to use Agent Run.' : c.targetMessage));
        status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); root.append(status);
        if (!c.handle) { this.content.replaceChildren(root); return; }
        const form = el('section'); form.append(el('h3', 'Direct task'));
        const objectiveLabel = el('label', 'Objective'); const objective = el('input'); objective.type = 'text';
        objective.maxLength = 1000; objective.value = c.objective; objective.setAttribute('aria-label', 'Objective');
        objective.oninput = () => { c.edit(objective.value, instructions.value); this.syncStart(); }; objectiveLabel.append(objective); form.append(objectiveLabel);
        const instructionsLabel = el('label', 'Executable instructions'); const instructions = el('textarea');
        instructions.maxLength = 20000; instructions.value = c.instructions;
        instructions.setAttribute('aria-label', 'Executable instructions');
        instructions.oninput = () => { c.edit(objective.value, instructions.value); this.syncStart(); }; instructionsLabel.append(instructions);
        form.append(instructionsLabel);
        const policyLabel = el('label', 'Model policy'); const policy = el('select'); policy.setAttribute('aria-label', 'Model policy');
        const follow = el('option', 'Follow Coding Agent'); follow.value = 'follow'; policy.append(follow);
        if (c.exactTargets.length) { const exact = el('option', 'Exact target'); exact.value = 'exact'; policy.append(exact); }
        policy.value = c.policy.kind === 'exact' && c.exactTargets.length ? 'exact' : 'follow';
        policy.onchange = () => c.setPolicy(policy.value === 'follow' ? { kind: 'follow-coding-agent' } :
            { kind: 'exact', connectionId: c.exactTargets[0].connectionId, modelId: c.exactTargets[0].modelId });
        policyLabel.append(policy); form.append(policyLabel);
        if (policy.value === 'exact') {
            const targetLabel = el('label', 'Exact Coding Agent target'); const target = el('select');
            target.setAttribute('aria-label', 'Exact Coding Agent target');
            for (const item of c.exactTargets) { const option = el('option', item.label); option.value = `${item.connectionId}\u0000${item.modelId}`; target.append(option); }
            target.value = `${c.policy.kind === 'exact' ? c.policy.connectionId : ''}\u0000${c.policy.kind === 'exact' ? c.policy.modelId : ''}`;
            target.onchange = () => { const item = c.exactTargets.find(entry => `${entry.connectionId}\u0000${entry.modelId}` === target.value);
                if (item) c.setPolicy({ kind: 'exact', connectionId: item.connectionId, modelId: item.modelId }); };
            targetLabel.append(target); form.append(targetLabel);
        }
        form.append(el('p', c.targetMessage));
        const grant = createDefaultExecutionGrant({ id: 'preview', revision: 1, taskId: 'preview', acceptedAt: new Date().toISOString() });
        const grantSection = el('fieldset'); const legend = el('legend', 'Phase 8B execution grant'); grantSection.append(legend);
        const allowed = el('div'); allowed.append(el('strong', 'Allowed within this project'));
        const denied = el('div'); denied.append(el('strong', 'Denied'));
        for (const kind of EFFECT_KINDS) (grant.permissions[kind] ? allowed : denied).append(el('div', names[kind]));
        grantSection.append(allowed, denied);
        const acceptLabel = el('label'); const accept = el('input'); accept.type = 'checkbox'; accept.checked = c.accepted;
        accept.setAttribute('aria-label', 'Accept Grant'); accept.onchange = () => c.acceptGrant(accept.checked);
        acceptLabel.append(accept, document.createTextNode(' Accept Grant')); grantSection.append(acceptLabel); form.append(grantSection);
        const start = button('Start', () => void c.start(), !c.canStart); start.dataset.agentStart = '';
        form.append(start); root.append(form);
        const history = el('section'); history.append(el('h3', 'Runs'));
        for (const run of c.runs) { const item = button(`${run.createdAt} · ${run.status}`, () => void c.select(run.id));
            item.setAttribute('aria-current', String(c.selected?.id === run.id)); history.append(item); }
        root.append(history);
        const run = c.selected;
        if (run) {
            const detail = el('section'); detail.append(el('h3', 'Selected run'));
            const runStatus = el('p', `Status: ${run.status}`); runStatus.setAttribute('role', 'status'); detail.append(runStatus);
            if (c.task) detail.append(el('p', `Objective: ${c.task.objective}`));
            if (run.provenance) detail.append(el('p', `Coding Agent used: ${c.exactTargets.find(item =>
                item.connectionId === run.provenance?.connectionId && item.modelId === run.provenance?.modelId)?.label ??
                'Previously selected model'} (${run.provenance.runtimeKind})`));
            detail.append(button('Stop', () => void c.stop(), c.busy || !['pending', 'running', 'blocked'].includes(run.status)));
            if (run.outcome) detail.append(el('p', `Outcome: ${run.outcome.summary}`));
            const files = el('section'); files.append(el('h4', 'Changed files'));
            files.append(el('p', run.changedFiles.length ? run.changedFiles.join(', ') : 'No changed files recorded.')); detail.append(files);
            if (run.candidateDelta) {
                const candidate = el('section'); candidate.append(el('h4', 'Candidate changes'));
                candidate.append(el('p', run.candidateDelta.effects.length ?
                    run.candidateDelta.effects.map(effect => `${effect.kind}: ${effect.path}`).join(', ') : 'No candidate changes.'));
                if (run.authorityDecision) candidate.append(el('p', run.authorityDecision.allowed ?
                    `Promotion allowed; applied: ${run.appliedFiles?.join(', ') || 'none'}` :
                    `Promotion blocked: ${run.authorityDecision.blocked.map(effect => `${effect.kind}: ${effect.path}`).join(', ')}`));
                detail.append(candidate);
            }
            const validations = el('section'); validations.append(el('h4', 'Validation results'));
            if (!run.validationResults.length) validations.append(el('p', 'No validation results recorded.'));
            for (const result of run.validationResults) validations.append(el('p', `${result.label}: ${result.status} (execution workspace)${result.summary ? ` — ${result.summary}` : ''}`));
            detail.append(validations);
            if (run.changeSummary) detail.append(el('p', `Changes: ${run.changeSummary.filesChanged} files, +${run.changeSummary.insertions} / -${run.changeSummary.deletions}. ${run.changeSummary.summary}${run.changeSummary.truncated ? ' (truncated)' : ''}`));
            const activity = el('section'); activity.append(el('h4', 'Activity'));
            const list = el('ol'); list.setAttribute('aria-label', 'Agent Run activity');
            for (const event of c.events) list.append(el('li', `${event.at} · ${event.kind}${event.status ? ` · ${event.status}` : ''}: ${event.summary}`));
            activity.append(list); detail.append(activity); root.append(detail);
        }
        this.content.replaceChildren(root);
    }
}
