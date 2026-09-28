import type { Plan, PlanStep, PlanningDocument, PlanningOperation, Task } from '@dope/contracts/lib/planning';
import type { PlanningClient, PlanningService } from '@dope/contracts/lib/planning-service';

export type PlanningConnection = PlanningService & { setClient(client: PlanningClient | undefined): void; dispose(): void };
export type PlanningDraft = { kind: 'plan'; value: Plan } | { kind: 'step'; value: PlanStep } | { kind: 'task'; value: Task };

export class PlanningController {
    workspace: string | undefined;
    snapshot: PlanningDocument | undefined;
    prerequisite = false;
    planId: string | undefined;
    stepId: string | undefined;
    taskId: string | undefined;
    draft: PlanningDraft | undefined;
    dirty = false;
    pending = false;
    stale = false;
    loading = false;
    error = '';
    private connection: PlanningConnection | undefined;
    private handle: string | undefined;
    private generation = 0;
    private request = 0;
    private draftVersion = 0;
    private eventRevision = 0;
    private disposed = false;

    constructor(private readonly connect: () => PlanningConnection, private readonly changed: () => void) { }

    get canLeave(): boolean { return !this.dirty && !this.pending; }
    get revision(): number { return this.snapshot?.revision ?? 0; }
    get projectId(): string | undefined { return this.snapshot?.projectId; }
    get attached(): boolean { return !!this.handle && !this.prerequisite; }

    private disconnect(): void {
        this.connection?.setClient(undefined);
        if (this.connection) void Promise.resolve(this.connection.dispose()).catch(() => {});
        this.connection = undefined;
    }

    async attach(workspace: string | undefined, discard = false): Promise<boolean> {
        if (this.disposed || !discard && !this.canLeave) return false;
        const generation = ++this.generation;
        ++this.request;
        this.disconnect();
        this.workspace = workspace;
        this.handle = undefined;
        this.snapshot = undefined;
        this.planId = this.stepId = this.taskId = undefined;
        this.draft = undefined;
        this.dirty = this.pending = this.stale = this.prerequisite = false;
        this.error = '';
        this.eventRevision = 0;
        this.loading = !!workspace;
        this.changed();
        if (!workspace) return true;
        try {
            const connection = this.connect();
            this.connection = connection;
            connection.setClient({ notifyPlanningChanged: event => {
                if (this.disposed || generation !== this.generation || event.projectHandle !== this.handle || event.revision <= this.revision) return;
                this.eventRevision = Math.max(this.eventRevision, event.revision);
                if (this.dirty || this.pending) { this.stale = true; this.changed(); }
                else void this.refresh();
            } });
            const attached = await connection.attach(workspace);
            if (this.disposed || generation !== this.generation) return false;
            this.handle = attached.projectHandle;
            this.snapshot = attached.snapshot;
            this.prerequisite = attached.prerequisite === 'project-mind';
            this.loading = false;
            this.changed();
            if (this.eventRevision > this.revision) void this.refresh();
            return true;
        } catch (error) {
            if (!this.disposed && generation === this.generation) { this.loading = false; this.error = String(error); this.changed(); }
            return false;
        }
    }

    select(planId?: string, stepId?: string, taskId?: string): boolean {
        if (!this.canLeave) return false;
        const plan = this.snapshot?.plans.find(item => item.id === planId);
        const step = plan?.steps.find(item => item.id === stepId);
        const task = this.snapshot?.tasks.find(item => item.id === taskId && item.planId === planId && item.stepId === stepId);
        if (planId && !plan || stepId && !step || taskId && !task) return false;
        this.planId = planId;
        this.stepId = stepId;
        this.taskId = taskId;
        this.draft = task ? { kind: 'task', value: structuredClone(task) } : step ? { kind: 'step', value: structuredClone(step) } : plan ? { kind: 'plan', value: structuredClone(plan) } : undefined;
        this.dirty = false;
        this.error = '';
        this.changed();
        return true;
    }

    create(kind: PlanningDraft['kind']): boolean {
        if (!this.canLeave || !this.attached || kind === 'step' && !this.planId || kind === 'task' && !this.stepId) return false;
        if (kind === 'plan') this.planId = this.stepId = this.taskId = undefined;
        else if (kind === 'step') this.stepId = this.taskId = undefined;
        else this.taskId = undefined;
        const now = new Date().toISOString();
        const base = { id: crypto.randomUUID(), title: '', createdAt: now, updatedAt: now };
        this.draft = kind === 'plan' ? { kind, value: { ...base, objective: '', context: '', status: 'draft', steps: [], revision: 1, provenance: 'developer', links: [] } } :
            kind === 'step' ? { kind, value: { ...base, body: '', status: 'pending' } } :
                { kind, value: { ...base, planId: this.planId!, stepId: this.stepId!, objective: '', requirements: [], constraints: [], status: 'pending', links: [], workingSet: [] } };
        this.dirty = true;
        ++this.draftVersion;
        this.changed();
        return true;
    }

    edit(field: string, value: string | string[] | object): void {
        if (!this.draft || this.pending || !(field in this.draft.value) &&
            !(this.draft.kind === 'task' && (field === 'completionNotes' || field === 'validationNotes'))) return;
        this.draft = { ...this.draft, value: { ...this.draft.value, [field]: value } } as PlanningDraft;
        this.dirty = true;
        ++this.draftVersion;
        this.changed();
    }

    async save(): Promise<boolean> {
        if (!this.draft || !this.dirty) return false;
        const { kind, value } = this.draft;
        const operation: PlanningOperation = kind === 'plan' ? this.planId ? { type: 'plan.edit', planId: this.planId, title: value.title, objective: value.objective, context: value.context, links: value.links } :
            { type: 'plan.create', id: value.id, title: value.title, objective: value.objective, context: value.context, links: value.links } :
            kind === 'step' ? this.stepId ? { type: 'step.edit', planId: this.planId!, stepId: this.stepId, title: value.title, body: value.body } :
                { type: 'step.create', planId: this.planId!, id: value.id, title: value.title, body: value.body } :
                this.taskId ? { type: 'task.edit', taskId: this.taskId, title: value.title, objective: value.objective, requirements: value.requirements, constraints: value.constraints, links: value.links, workingSet: value.workingSet, completionNotes: value.completionNotes, validationNotes: value.validationNotes } :
                    { type: 'task.create', id: value.id, planId: this.planId!, stepId: this.stepId!, title: value.title, objective: value.objective, requirements: value.requirements, constraints: value.constraints, links: value.links, workingSet: value.workingSet };
        if (this.pending || this.stale || !this.connection || !this.handle || this.prerequisite) return false;
        const connection = this.connection;
        const handle = this.handle;
        const revision = this.revision;
        return this.perform(() => connection.mutate({ projectHandle: handle, expectedRevision: revision, operation }), () => {
            if (kind === 'plan') this.planId = value.id;
            if (kind === 'step') this.stepId = value.id;
            if (kind === 'task') this.taskId = value.id;
        });
    }

    async createFromDecision(decisionId: string): Promise<string | undefined> {
        if (!this.canLeave || !this.connection || !this.handle || this.stale || this.prerequisite) return undefined;
        const id = crypto.randomUUID();
        const connection = this.connection;
        const handle = this.handle;
        const revision = this.revision;
        return await this.perform(() => connection.createFromDecision(handle, revision, decisionId, id), () => { this.planId = id; this.stepId = this.taskId = undefined; }) ? id : undefined;
    }

    async mutate(operation: PlanningOperation, selected?: () => void): Promise<boolean> {
        if (!this.canLeave || this.stale || !this.connection || !this.handle || this.prerequisite) return false;
        const connection = this.connection;
        const handle = this.handle;
        const revision = this.revision;
        return this.perform(() => connection.mutate({ projectHandle: handle, expectedRevision: revision, operation }), selected);
    }

    private async perform(action: () => ReturnType<PlanningConnection['mutate']>, selected?: () => void): Promise<boolean> {
        const generation = this.generation;
        const request = ++this.request;
        const projectId = this.projectId;
        this.pending = true;
        this.error = '';
        this.changed();
        try {
            const result = await action();
            if (this.disposed || generation !== this.generation || request !== this.request) return false;
            if (projectId && result.snapshot.projectId !== projectId) throw new Error('Planning identity changed');
            this.snapshot = result.snapshot;
            selected?.();
            this.dirty = false;
            this.draft = undefined;
            this.pending = false;
            this.stale = this.eventRevision > this.revision;
            this.select(this.planId, this.stepId, this.taskId);
            if (this.stale) void this.refresh();
            return true;
        } catch (error) {
            if (!this.disposed && generation === this.generation && request === this.request) {
                this.pending = false;
                this.stale = true;
                this.error = `${String(error)}. Draft retained; copy it or reload and reconcile before retrying.`;
                this.changed();
            }
            return false;
        }
    }

    async refresh(discard = false): Promise<boolean> {
        if (!this.connection || !this.handle || this.pending || this.dirty && !discard) return false;
        const generation = this.generation;
        const request = ++this.request;
        const version = this.draftVersion;
        const projectId = this.projectId;
        const selected = [this.planId, this.stepId, this.taskId] as const;
        try {
            const snapshot = await this.connection.read(this.handle);
            if (this.disposed || generation !== this.generation || request !== this.request) return false;
            if (version !== this.draftVersion || this.dirty && !discard) { this.stale = true; this.changed(); return false; }
            if (projectId && snapshot?.projectId !== projectId) throw new Error('Planning identity changed; inspect the project');
            this.snapshot = snapshot;
            this.dirty = this.stale = false;
            this.error = '';
            if (!this.select(...selected)) this.select();
            return true;
        } catch (error) {
            if (!this.disposed && generation === this.generation) { this.error = String(error); this.stale = true; this.changed(); }
            return false;
        }
    }

    dispose(): void { if (this.disposed) return; this.disposed = true; ++this.generation; ++this.request; this.disconnect(); }
}
