import { BaseWidget, Message } from '@theia/core/lib/browser/widgets/widget';
import { ConfirmDialog, ConfirmSaveDialog, SingleTextInputDialog } from '@theia/core/lib/browser/dialogs';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { OpenerService, open } from '@theia/core/lib/browser';
import URI from '@theia/core/lib/common/uri';
import type { PlanningArtifactLink, PlanningFileLink, PlanningLink, PlanningOperation, PlanStatus, StepStatus, TaskStatus } from '@dope/contracts/lib/planning';
import type { ProjectMind } from '@dope/contracts/lib/project-mind';
import type { ProjectMindService } from '@dope/contracts/lib/project-mind-service';
import { PlanningConnection, PlanningController } from './planning-controller';
import { openPlanningFile } from './planning-file-navigation';

export const PLANNING_ID = 'dope-planning';

export class PlanningWidget extends BaseWidget {
    readonly controller: PlanningController;
    private readonly rootsListener;
    private readonly status = document.createElement('p');
    private readonly plans = document.createElement('section');
    private readonly detail = document.createElement('section');
    private formKey = '';
    private workspaceRequest = 0;
    private linksRequest = 0;
    private mind: ProjectMind | undefined;
    private loadPromise: Promise<void> = Promise.resolve();
    private readonly beforeUnload = (event: BeforeUnloadEvent) => {
        if (!this.controller.canLeave) { event.preventDefault(); event.returnValue = ''; }
    };

    constructor(connect: () => PlanningConnection, private readonly connectMind: () => ProjectMindService & { dispose(): void },
        private readonly workspaceService: WorkspaceService, private readonly files: FileService, private readonly opener: OpenerService,
        private readonly showArtifact: (id: string) => Promise<void>) {
        super();
        this.id = PLANNING_ID;
        this.title.label = this.title.caption = 'Planning';
        this.title.closable = true;
        this.addClass('dope-spike-view');
        this.addClass('dope-planning-view');
        this.controller = new PlanningController(connect, () => this.render());
        const heading = document.createElement('h2');
        heading.textContent = 'Planning';
        this.status.setAttribute('role', 'status');
        this.status.setAttribute('aria-live', 'polite');
        this.node.append(heading, this.status, this.plans, this.detail);
        this.rootsListener = workspaceService.onWorkspaceChanged(() => { this.loadPromise = this.load(); });
        window.addEventListener('beforeunload', this.beforeUnload);
        this.loadPromise = this.load();
    }

    private button(label: string, click: () => void, disabled = false): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.disabled = disabled;
        button.onclick = click;
        return button;
    }

    private async leave(): Promise<boolean> {
        if (this.controller.canLeave) return true;
        if (this.controller.pending) return !!await new ConfirmDialog({ title: 'Planning', msg: 'A write is pending and may commit. Leave and inspect the old project before retrying?' }).open();
        const choice = await new ConfirmSaveDialog({ title: 'Unsaved Planning draft', msg: 'Save this draft before leaving?', save: 'Save', dontSave: 'Discard', cancel: 'Cancel' }).open();
        if (choice === undefined) return false;
        return choice ? this.controller.save() : this.controller.refresh(true);
    }

    private async load(): Promise<void> {
        const request = ++this.workspaceRequest;
        const roots = await this.workspaceService.roots;
        if (this.isDisposed || request !== this.workspaceRequest) return;
        const workspace = roots.length === 1 && roots[0].resource.scheme === 'file' ? roots[0].resource.toString() : undefined;
        if (workspace === this.controller.workspace) return;
        if (!await this.leave() || request !== this.workspaceRequest || this.isDisposed) {
            this.status.textContent = 'Workspace changed; draft remains attached to its original project.';
            this.detail.append(this.button('Switch workspace', () => void this.load()));
            return;
        }
        this.formKey = '';
        this.mind = undefined;
        await this.controller.attach(workspace, true);
        if (request !== this.workspaceRequest || !workspace || !this.controller.attached) return;
        const connection = this.connectMind();
        try {
            const attached = await connection.attach(workspace);
            if (request === this.workspaceRequest && !this.isDisposed && attached.snapshot?.projectId === this.controller.projectId) {
                this.mind = attached.snapshot;
                this.render();
            }
        } catch { /* Planning is still usable if artifact display is unavailable. */ }
        finally { connection.dispose(); }
    }

    async openPlan(id: string): Promise<void> {
        await this.loadPromise;
        await this.load();
        const roots = await this.workspaceService.roots;
        const workspace = roots.length === 1 && roots[0].resource.scheme === 'file' ? roots[0].resource.toString() : undefined;
        if (workspace !== this.controller.workspace) return;
        if (!await this.leave()) return;
        if (this.controller.pending) return;
        this.formKey = '';
        if (!this.controller.select(id)) { await this.controller.refresh(); this.controller.select(id); }
        this.detail.querySelector<HTMLElement>('input, textarea, button')?.focus();
    }

    private async navigate(planId?: string, stepId?: string, taskId?: string): Promise<void> {
        if (!await this.leave() || this.controller.pending) return;
        this.formKey = '';
        this.controller.select(planId, stepId, taskId);
        this.detail.querySelector<HTMLElement>('input, textarea, button')?.focus();
    }

    private async create(kind: 'plan' | 'step' | 'task'): Promise<void> {
        if (!await this.leave() || this.controller.pending) return;
        this.formKey = '';
        this.controller.create(kind);
        this.detail.querySelector<HTMLElement>('input, textarea')?.focus();
    }

    private render(): void {
        const controller = this.controller;
        this.status.textContent = controller.error || (controller.loading ? 'Loading Planning…' : controller.pending ? 'Saving Planning…' :
            controller.stale ? 'Planning changed elsewhere. Copy your draft, then reload and reconcile.' :
                controller.dirty ? 'Unsaved Planning draft' : !controller.workspace ? 'Open one local folder to use Planning.' :
                    controller.prerequisite ? 'Create a Project Mind artifact first to establish project identity, then retry.' :
                        controller.snapshot ? `Saved · document revision ${controller.revision}` : 'No Plans yet. Create a draft Plan.');
        this.renderPlans();
        const key = `${controller.workspace}:${controller.revision}:${controller.planId}:${controller.stepId}:${controller.taskId}:${controller.draft?.value.id}:${controller.draft?.kind}`;
        if (key === this.formKey) {
            this.detail.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select').forEach(input => { input.disabled = controller.pending; });
            this.detail.querySelectorAll<HTMLButtonElement>('button[data-mutation]').forEach(button => { button.disabled = controller.pending || controller.dirty || controller.stale; });
            this.detail.querySelectorAll<HTMLButtonElement>('button[data-save]').forEach(button => { button.disabled = controller.pending || !controller.dirty || controller.stale; });
            return;
        }
        this.formKey = key;
        ++this.linksRequest;
        this.detail.replaceChildren();
        if (!controller.workspace || controller.loading) return;
        if (controller.prerequisite || controller.error && !controller.attached) {
            this.detail.append(this.button('Retry attachment', () => { this.formKey = ''; void controller.attach(controller.workspace); }));
            return;
        }
        const draft = controller.draft;
        if (!draft) { this.detail.append(document.createTextNode(controller.snapshot ? 'Select or create a Plan.' : 'Create your first draft Plan.')); return; }
        const value = draft.value;
        const heading = document.createElement('h3');
        heading.textContent = `${draft.kind.toUpperCase()} · ${value.status}`;
        const identity = document.createElement('small');
        identity.textContent = `ID ${value.id} · created ${value.createdAt} · updated ${value.updatedAt}`;
        this.detail.append(heading, identity);
        if (draft.kind !== 'plan') this.detail.append(this.button('Back to Plan', () => void this.navigate(controller.planId)));
        if (draft.kind === 'task') this.detail.append(this.button('Back to Step', () => void this.navigate(controller.planId, controller.stepId)));
        const fields = draft.kind === 'plan' ? ['title', 'objective', 'context'] : draft.kind === 'step' ? ['title', 'body'] :
            ['title', 'objective', 'requirements', 'constraints', 'completionNotes', 'validationNotes'];
        for (const field of fields) {
            const label = document.createElement('label');
            label.textContent = field.replace(/([A-Z])/g, ' $1');
            const input = field === 'title' ? document.createElement('input') : document.createElement('textarea');
            const current = (value as unknown as Record<string, unknown>)[field];
            input.value = Array.isArray(current) ? current.join('\n') : String(current ?? '');
            input.oninput = () => controller.edit(field, field === 'requirements' || field === 'constraints' ? input.value.split('\n').filter(line => line.trim()) : input.value);
            label.append(input);
            this.detail.append(label);
        }
        const actions = document.createElement('div');
        actions.className = 'dope-mind-actions';
        const save = this.button('Save', () => void controller.save(), controller.pending || !controller.dirty || controller.stale);
        save.dataset.save = '';
        actions.append(save, this.button('Discard / reload', () => void this.discard(), controller.pending));
        this.detail.append(actions);
        if (draft.kind === 'plan') {
            const plan = draft.value;
            if (controller.planId) {
                this.transitions(actions, ['draft', 'active', 'completed', 'superseded'] as const, plan.status, status => ({ type: 'plan.transition', planId: plan.id, status }));
                const revision = document.createElement('p');
                revision.textContent = `Plan revision ${plan.revision}`;
                this.detail.append(revision);
            }
            this.links(plan.links, 'plan');
            if (controller.planId) this.steps(plan.steps);
        } else if (draft.kind === 'step') {
            const step = draft.value;
            if (controller.stepId) {
                this.transitions(actions, ['pending', 'active', 'blocked', 'complete', 'skipped', 'superseded'] as const, step.status, status => ({ type: 'step.transition', planId: controller.planId!, stepId: step.id, status,
                    ...(status === 'blocked' ? { blockedReason: this.blockReason() } : {}) }));
                if (step.blockedReason) { const reason = document.createElement('p'); reason.textContent = `Blocked: ${step.blockedReason}`; this.detail.append(reason); }
                this.tasks();
            }
        } else {
            const task = draft.value;
            this.links(task.links, 'task');
            this.workingSet(task.workingSet);
            if (controller.taskId) this.transitions(actions, ['pending', 'active', 'blocked', 'complete', 'cancelled'] as const, task.status, status => ({ type: 'task.transition', taskId: task.id, status }));
        }
        if (controller.planId) this.history();
    }

    private blockReason(): string | undefined {
        const reason = window.prompt('Why is this Step blocked?')?.trim();
        return reason || undefined;
    }

    private transitions<Status extends string>(container: HTMLElement, statuses: readonly Status[], current: Status, operation: (status: Status) => PlanningOperation): void {
        const allowed: Record<string, string[]> = {
            draft: ['active', 'superseded'], active: statuses.includes('cancelled' as Status) ? ['blocked', 'complete', 'cancelled'] : statuses.includes('pending' as Status) ? ['blocked', 'complete', 'skipped', 'superseded'] : ['completed', 'superseded'],
            completed: ['active'], superseded: [], pending: statuses.includes('cancelled' as Status) ? ['active', 'blocked', 'cancelled'] : ['active', 'blocked', 'skipped', 'superseded'],
            blocked: statuses.includes('cancelled' as Status) ? ['pending', 'active', 'cancelled'] : ['pending', 'active', 'skipped', 'superseded'],
            complete: ['active'], skipped: ['pending', 'active'], cancelled: ['pending']
        };
        for (const status of statuses) {
            if (!allowed[current]?.includes(status)) continue;
            const button = this.button(status === 'pending' ? 'Reopen / unblock' : status === 'active' && current === 'blocked' ? 'Unblock / activate' : status, () => {
                const action = operation(status);
                if (action.type === 'step.transition' && action.status === 'blocked' && !action.blockedReason) return;
                void this.controller.mutate(action);
            }, this.controller.pending || this.controller.dirty || this.controller.stale);
            button.dataset.mutation = '';
            container.append(button);
        }
    }

    private renderPlans(): void {
        const controller = this.controller;
        this.plans.replaceChildren();
        if (!controller.workspace || controller.loading || controller.prerequisite) return;
        this.plans.append(this.button('New draft Plan', () => void this.create('plan'), controller.pending || !controller.attached));
        const list = document.createElement('ul');
        for (const plan of controller.snapshot?.plans ?? []) {
            const item = document.createElement('li');
            const button = this.button(`${plan.title} · ${plan.status} · rev ${plan.revision}`, () => void this.navigate(plan.id));
            button.setAttribute('aria-current', String(controller.planId === plan.id));
            item.append(button);
            list.append(item);
        }
        this.plans.append(list);
    }

    private steps(steps: readonly { id: string; title: string; status: StepStatus }[]): void {
        const section = document.createElement('section');
        const heading = document.createElement('h4'); heading.textContent = 'Ordered Steps'; section.append(heading);
        steps.forEach((step, index) => {
            const row = document.createElement('div'); row.className = 'dope-mind-actions';
            row.append(this.button(`${index + 1}. ${step.title} · ${step.status}`, () => void this.navigate(this.controller.planId, step.id)));
            for (const [label, position] of [['Move up', index - 1], ['Move down', index + 1]] as const) {
                row.append(this.button(label, () => void this.controller.mutate({ type: 'step.reorder', planId: this.controller.planId!, stepId: step.id, index: position }), position < 0 || position >= steps.length || !this.controller.canLeave || this.controller.stale));
            }
            section.append(row);
        });
        section.append(this.button('New Step', () => void this.create('step'), !this.controller.canLeave));
        this.detail.append(section);
    }

    private tasks(): void {
        const section = document.createElement('section');
        const heading = document.createElement('h4'); heading.textContent = 'Tasks'; section.append(heading);
        const list = document.createElement('ul');
        for (const task of this.controller.snapshot?.tasks.filter(item => item.stepId === this.controller.stepId && item.planId === this.controller.planId) ?? []) {
            const row = document.createElement('li');
            row.append(this.button(`${task.title} · ${task.status}`, () => void this.navigate(this.controller.planId, this.controller.stepId, task.id)));
            list.append(row);
        }
        section.append(list, this.button('New Task', () => void this.create('task'), !this.controller.canLeave));
        this.detail.append(section);
    }

    private links(links: readonly PlanningLink[], owner: 'plan' | 'task'): void {
        const section = document.createElement('section');
        const heading = document.createElement('h4'); heading.textContent = 'Project Mind links'; section.append(heading);
        links.forEach((link, index) => {
            if (link.type !== 'artifact') { if (owner === 'plan') this.fileButton(section, link); }
            else {
            const artifact = this.mind?.artifacts.find(item => item.id === link.id);
            section.append(this.button(artifact ? `${artifact.type}: ${artifact.title}` : `${link.id} (unavailable artifact)`, () => void this.showArtifact(link.id), !artifact));
            }
            section.append(this.button('Remove link', () => this.updateLinks('links', links.filter((_, position) => position !== index)), this.controller.pending));
        });
        const targets = this.mind?.artifacts ?? [];
        if (targets.length) {
            const select = document.createElement('select'); select.setAttribute('aria-label', 'Project Mind artifact');
            for (const artifact of targets) select.add(new Option(`${artifact.type}: ${artifact.title}`, artifact.id));
            const add = this.button('Add artifact link', () => this.updateLinks('links', [...((this.controller.draft?.value as { links?: PlanningLink[] })?.links ?? links), { type: 'artifact', id: select.value } satisfies PlanningArtifactLink]), !this.controller.draft || this.controller.pending);
            section.append(select, add);
        }
        if (owner === 'plan') section.append(this.button('Add project file…', () => void this.addFile('links'), this.controller.pending));
        this.detail.append(section);
    }

    private workingSet(links: readonly PlanningFileLink[]): void {
        const section = document.createElement('section');
        const heading = document.createElement('h4'); heading.textContent = 'Working-set files'; section.append(heading);
        links.forEach((link, index) => {
            this.fileButton(section, link);
            section.append(this.button('Remove file', () => this.updateLinks('workingSet', links.filter((_, position) => position !== index)), this.controller.pending));
        });
        section.append(this.button('Add working-set file…', () => void this.addFile('workingSet'), this.controller.pending));
        this.detail.append(section);
    }

    private async addFile(field: 'links' | 'workingSet'): Promise<void> {
        const workspace = this.controller.workspace;
        const draftId = this.controller.draft?.value.id;
        const value = await new SingleTextInputDialog({ title: 'Project-relative file path (optional :line)', confirmButtonLabel: 'Add file' }).open();
        if (!value || !this.controller.draft || this.controller.pending || workspace !== this.controller.workspace || draftId !== this.controller.draft.value.id) return;
        const match = /^(.*?)(?::(\d+))?$/.exec(value.trim());
        if (!match) return;
        const links = field === 'workingSet' && this.controller.draft.kind === 'task' ? this.controller.draft.value.workingSet :
            'links' in this.controller.draft.value ? this.controller.draft.value.links : [];
        this.updateLinks(field, [...links, { type: 'file', path: match[1], ...(match[2] ? { line: Number(match[2]) } : {}) } satisfies PlanningFileLink]);
    }

    private updateLinks(field: 'links' | 'workingSet', links: PlanningLink[]): void {
        this.controller.edit(field, links);
        this.formKey = '';
        this.render();
    }

    private fileButton(section: HTMLElement, link: PlanningFileLink): void {
        const workspace = this.controller.workspace;
        const request = this.linksRequest;
        const target = workspace ? new URI(workspace).resolve(link.path) : undefined;
        const button = this.button(`${link.path}${link.line ? `:${link.line}` : ''}`, () => {
            if (target && !button.disabled) void openPlanningFile(link, () => this.files.exists(target),
                line => open(this.opener, target, line ? { selection: { start: { line: line - 1, character: 0 } } } : undefined),
                () => !this.isDisposed && request === this.linksRequest && workspace === this.controller.workspace && this.controller.canLeave)
                .then(opened => { if (!opened) { button.disabled = true; button.textContent += ' (file unavailable)'; } })
                .catch(() => { button.disabled = true; button.textContent += ' (file unavailable)'; });
        }, true);
        section.append(button);
        if (target) void this.files.exists(target).then(exists => {
            if (this.isDisposed || request !== this.linksRequest) return;
            if (exists) button.disabled = !this.controller.canLeave;
            else { button.disabled = true; button.textContent += ' (unavailable file)'; }
        }).catch(() => {
            if (this.isDisposed || request !== this.linksRequest) return;
            button.disabled = true; button.textContent += ' (file unavailable)';
        });
    }

    private history(): void {
        const section = document.createElement('section');
        const heading = document.createElement('h4'); heading.textContent = 'Plan history'; section.append(heading);
        const list = document.createElement('ol');
        for (const entry of this.controller.snapshot?.history.filter(item => item.planId === this.controller.planId).slice().reverse() ?? []) {
            const row = document.createElement('li');
            row.textContent = `${entry.timestamp} · rev ${entry.planRevision} · ${entry.summary}`;
            list.append(row);
        }
        section.append(list);
        this.detail.append(section);
    }

    private async discard(): Promise<void> {
        if (!await new ConfirmDialog({ title: 'Reload Planning', msg: 'Discard this draft and reload committed Planning state?' }).open()) return;
        this.formKey = '';
        await this.controller.refresh(true);
    }

    protected override onCloseRequest(msg: Message): void {
        if (this.controller.canLeave) { super.onCloseRequest(msg); return; }
        void this.leave().then(leave => {
            if (!leave) return;
            if (this.controller.pending) this.controller.dispose();
            else if (this.controller.dirty) this.controller.select(this.controller.planId, this.controller.stepId, this.controller.taskId);
            super.onCloseRequest(msg);
        });
    }

    override dispose(): void {
        ++this.workspaceRequest;
        ++this.linksRequest;
        window.removeEventListener('beforeunload', this.beforeUnload);
        this.rootsListener.dispose();
        this.controller.dispose();
        super.dispose();
    }
}
