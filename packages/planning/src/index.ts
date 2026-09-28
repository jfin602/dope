import type { Plan, PlanStep, PlanningArtifactLink, PlanningDocument, PlanningFileLink, PlanningHistoryEntry, PlanningLink, PlanningOperation, PlanningResult, Task } from '@dope/contracts/lib/planning';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const utc = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
const transitions = {
    plan: { draft: ['active', 'superseded'], active: ['completed', 'superseded'], completed: ['active'], superseded: [] },
    step: { pending: ['active', 'blocked', 'skipped', 'superseded'], active: ['blocked', 'complete', 'skipped', 'superseded'], blocked: ['pending', 'active', 'skipped', 'superseded'], complete: ['active'], skipped: ['pending', 'active'], superseded: [] },
    task: { pending: ['active', 'blocked', 'cancelled'], active: ['blocked', 'complete', 'cancelled'], blocked: ['pending', 'active', 'cancelled'], complete: ['active'], cancelled: ['pending'] },
} as const;

function invalid(): never { throw new Error('Invalid Planning data'); }
function object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
    return value as Record<string, unknown>;
}
function fields(value: Record<string, unknown>, required: string[], optional: string[] = []): void {
    if (required.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) invalid();
}
function id(value: unknown): value is string { return typeof value === 'string' && uuid.test(value); }
function date(value: unknown): value is string {
    return typeof value === 'string' && utc.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;
}
function text(value: unknown): value is string { return typeof value === 'string'; }
function title(value: unknown): value is string { return text(value) && !!value.trim(); }
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every(text); }
function natural(value: unknown): value is number { return Number.isSafeInteger(value) && (value as number) >= 0; }
function positive(value: unknown): value is number { return natural(value) && (value as number) > 0; }
function path(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0 && !value.includes('\\') && !value.includes('\0') &&
        !value.startsWith('/') && !value.includes(':') && value.split('/').every(part => part !== '' && part !== '.' && part !== '..');
}
function status(value: unknown, kind: keyof typeof transitions): boolean {
    return typeof value === 'string' && Object.hasOwn(transitions[kind], value);
}
function links(value: unknown, kind: 'artifact' | 'file' | 'any'): value is PlanningLink[] {
    if (!Array.isArray(value)) return false;
    for (const link of value) {
        const entry = object(link);
        if (entry.type === 'artifact' && kind !== 'file') {
            fields(entry, ['type', 'id']);
            if (!id(entry.id)) invalid();
        } else if (entry.type === 'file' && kind !== 'artifact') {
            fields(entry, ['type', 'path'], ['line']);
            if (!path(entry.path) || entry.line !== undefined && !positive(entry.line)) invalid();
        } else invalid();
    }
    return true;
}
function step(value: unknown): PlanStep {
    const item = object(value);
    fields(item, ['id', 'title', 'body', 'status', 'createdAt', 'updatedAt'], ['blockedReason']);
    if (!id(item.id) || !title(item.title) || !text(item.body) || !status(item.status, 'step') ||
        !date(item.createdAt) || !date(item.updatedAt) || item.updatedAt < item.createdAt ||
        (item.status === 'blocked' ? !title(item.blockedReason) : item.blockedReason !== undefined)) invalid();
    return item as unknown as PlanStep;
}
function plan(value: unknown): Plan {
    const item = object(value);
    fields(item, ['id', 'title', 'objective', 'context', 'status', 'steps', 'revision', 'provenance', 'createdAt', 'updatedAt', 'links']);
    if (!id(item.id) || !title(item.title) || !text(item.objective) || !text(item.context) || !status(item.status, 'plan') ||
        !positive(item.revision) || item.provenance !== 'developer' || !date(item.createdAt) || !date(item.updatedAt) ||
        item.updatedAt < item.createdAt || !Array.isArray(item.steps) || !links(item.links, 'any')) invalid();
    item.steps.forEach(step);
    return item as unknown as Plan;
}
function task(value: unknown): Task {
    const item = object(value);
    fields(item, ['id', 'planId', 'stepId', 'title', 'objective', 'requirements', 'constraints', 'status', 'links', 'workingSet', 'createdAt', 'updatedAt'], ['completionNotes', 'validationNotes']);
    if (!id(item.id) || !id(item.planId) || !id(item.stepId) || !title(item.title) || !text(item.objective) ||
        !strings(item.requirements) || !strings(item.constraints) || !status(item.status, 'task') ||
        !links(item.links, 'artifact') || !links(item.workingSet, 'file') ||
        item.completionNotes !== undefined && !text(item.completionNotes) ||
        item.validationNotes !== undefined && !text(item.validationNotes) ||
        !date(item.createdAt) || !date(item.updatedAt) || item.updatedAt < item.createdAt) invalid();
    return item as unknown as Task;
}
const operationFields: Record<PlanningOperation['type'], [string[], string[]?]> = {
    'plan.create': [['id', 'title', 'objective', 'context', 'links']],
    'plan.edit': [['planId', 'title', 'objective', 'context', 'links']],
    'plan.transition': [['planId', 'status']],
    'step.create': [['planId', 'id', 'title', 'body']],
    'step.edit': [['planId', 'stepId', 'title', 'body']],
    'step.reorder': [['planId', 'stepId', 'index']],
    'step.transition': [['planId', 'stepId', 'status'], ['blockedReason']],
    'task.create': [['id', 'planId', 'stepId', 'title', 'objective', 'requirements', 'constraints', 'links', 'workingSet']],
    'task.edit': [['taskId', 'title', 'objective', 'requirements', 'constraints', 'links', 'workingSet'], ['completionNotes', 'validationNotes']],
    'task.transition': [['taskId', 'status']],
};

function history(value: unknown): PlanningHistoryEntry {
    const entry = object(value);
    fields(entry, ['id', 'timestamp', 'actor', 'planRevision', 'operation', 'planId', 'summary'], ['stepId', 'taskId']);
    if (!id(entry.id) || !date(entry.timestamp) || entry.actor !== 'developer' || !positive(entry.planRevision) ||
        !Object.hasOwn(operationFields, String(entry.operation)) || !id(entry.planId) ||
        entry.stepId !== undefined && !id(entry.stepId) || entry.taskId !== undefined && !id(entry.taskId) ||
        !title(entry.summary)) invalid();
    return entry as unknown as PlanningHistoryEntry;
}

function allIds(document: PlanningDocument): string[] {
    return [document.projectId, ...document.plans.map(item => item.id),
        ...document.plans.flatMap(item => item.steps.map(child => child.id)),
        ...document.tasks.map(item => item.id), ...document.history.map(item => item.id)];
}

export function parsePlanningDocument(value: unknown): PlanningDocument {
    const document = object(value);
    fields(document, ['schemaVersion', 'projectId', 'revision', 'plans', 'tasks', 'history']);
    if (document.schemaVersion !== 1 || !id(document.projectId) || !natural(document.revision) ||
        !Array.isArray(document.plans) || !Array.isArray(document.tasks) || !Array.isArray(document.history) ||
        document.revision !== document.history.length) invalid();
    const plans = document.plans.map(plan);
    const tasks = document.tasks.map(task);
    const entries = document.history.map(history);
    const ids = allIds(document as unknown as PlanningDocument);
    if (new Set(ids).size !== ids.length) invalid();
    for (const item of tasks) {
        if (!plans.find(parent => parent.id === item.planId)?.steps.some(child => child.id === item.stepId)) invalid();
    }
    for (const item of plans) {
        const revisions = entries.filter(entry => entry.planId === item.id).map(entry => entry.planRevision);
        if (revisions.length !== item.revision || revisions.some((revision, index) => revision !== index + 1)) invalid();
    }
    for (const entry of entries) {
        const parent = plans.find(item => item.id === entry.planId);
        if (!parent || entry.stepId && !parent.steps.some(item => item.id === entry.stepId) ||
            entry.taskId && !tasks.some(item => item.id === entry.taskId && item.planId === parent.id) ||
            (entry.operation.startsWith('step.') || entry.operation.startsWith('task.')) !== !!entry.stepId ||
            entry.operation.startsWith('task.') !== !!entry.taskId) invalid();
    }
    if (entries.some((entry, index) => index > 0 && entry.timestamp < entries[index - 1].timestamp)) invalid();
    return document as unknown as PlanningDocument;
}

export function emptyPlanningDocument(projectId: string): PlanningDocument {
    return parsePlanningDocument({ schemaVersion: 1, projectId, revision: 0, plans: [], tasks: [], history: [] });
}

function advance(current: string, now: string): void { if (now < current) invalid(); }
function transition(kind: keyof typeof transitions, from: string, to: string): void {
    const allowed = (transitions[kind] as Record<string, readonly string[]>)[from];
    if (!allowed?.includes(to)) invalid();
}

export function applyPlanningOperation(document: PlanningDocument, expectedRevision: number, operation: PlanningOperation, now: string, historyId: string): PlanningResult {
    parsePlanningDocument(document);
    if (!natural(expectedRevision) || expectedRevision !== document.revision || !date(now) || !id(historyId)) invalid();
    const input = object(operation);
    if (!Object.hasOwn(operationFields, String(input.type))) invalid();
    const [required, optional] = operationFields[input.type as PlanningOperation['type']];
    fields(input, ['type', ...required], optional);
    if (document.history.some(entry => now < entry.timestamp) || allIds(document).includes(historyId)) invalid();
    const next = structuredClone(document);
    let planId: string;
    let stepId: string | undefined;
    let taskId: string | undefined;
    let summary: string;
    if (operation.type === 'plan.create') {
        const { id: newId, title: name, objective, context, links: references } = operation;
        if (!id(newId) || !title(name) || !text(objective) || !text(context) || !links(references, 'any') ||
            allIds(document).includes(newId) || newId === historyId) invalid();
        next.plans.push({ id: newId, title: name, objective, context, links: structuredClone(references), status: 'draft', steps: [], revision: 0, provenance: 'developer', createdAt: now, updatedAt: now });
        planId = newId;
        summary = 'Created plan';
    } else {
        const targetTask = operation.type === 'task.edit' || operation.type === 'task.transition' ? next.tasks.find(item => item.id === operation.taskId) : undefined;
        if ((operation.type === 'task.edit' || operation.type === 'task.transition') && !targetTask) invalid();
        planId = 'planId' in operation ? operation.planId : targetTask!.planId;
        const parent = next.plans.find(item => item.id === planId);
        if (!parent || parent.status === 'superseded') invalid();
        if (operation.type === 'plan.edit') {
            if (!title(operation.title) || !text(operation.objective) || !text(operation.context) || !links(operation.links, 'any')) invalid();
            Object.assign(parent, { title: operation.title, objective: operation.objective, context: operation.context, links: structuredClone(operation.links) });
            summary = 'Edited plan';
        } else if (operation.type === 'plan.transition') {
            if (!status(operation.status, 'plan')) invalid();
            transition('plan', parent.status, operation.status);
            parent.status = operation.status;
            summary = `Plan ${operation.status}`;
        } else if (operation.type === 'step.create') {
            if (!id(operation.id) || !title(operation.title) || !text(operation.body) ||
                allIds(document).includes(operation.id) || operation.id === historyId) invalid();
            parent.steps.push({ id: operation.id, title: operation.title, body: operation.body, status: 'pending', createdAt: now, updatedAt: now });
            stepId = operation.id;
            summary = 'Created step';
        } else if (operation.type === 'step.edit' || operation.type === 'step.reorder' || operation.type === 'step.transition') {
            stepId = operation.stepId;
            const child = parent.steps.find(item => item.id === stepId);
            if (!child) invalid();
            advance(child.updatedAt, now);
            if (operation.type === 'step.edit') {
                if (!title(operation.title) || !text(operation.body)) invalid();
                Object.assign(child, { title: operation.title, body: operation.body, updatedAt: now });
                summary = 'Edited step';
            } else if (operation.type === 'step.reorder') {
                if (!natural(operation.index) || operation.index >= parent.steps.length || parent.steps.indexOf(child) === operation.index) invalid();
                parent.steps.splice(parent.steps.indexOf(child), 1);
                parent.steps.splice(operation.index, 0, child);
                child.updatedAt = now;
                summary = 'Reordered step';
            } else if (operation.type === 'step.transition') {
                if (!status(operation.status, 'step') ||
                    (operation.status === 'blocked' ? !title(operation.blockedReason) : operation.blockedReason !== undefined)) invalid();
                transition('step', child.status, operation.status);
                child.status = operation.status;
                if (operation.status === 'blocked') child.blockedReason = operation.blockedReason;
                else delete child.blockedReason;
                child.updatedAt = now;
                summary = `Step ${operation.status}`;
            } else invalid();
        } else if (operation.type === 'task.create') {
            if (!id(operation.id) || !parent.steps.some(item => item.id === operation.stepId) || !title(operation.title) || !text(operation.objective) ||
                !strings(operation.requirements) || !strings(operation.constraints) || !links(operation.links, 'artifact') || !links(operation.workingSet, 'file') ||
                allIds(document).includes(operation.id) || operation.id === historyId) invalid();
            next.tasks.push({ id: operation.id, planId, stepId: operation.stepId, title: operation.title, objective: operation.objective,
                requirements: structuredClone(operation.requirements), constraints: structuredClone(operation.constraints),
                links: structuredClone(operation.links), workingSet: structuredClone(operation.workingSet), status: 'pending', createdAt: now, updatedAt: now });
            stepId = operation.stepId;
            taskId = operation.id;
            summary = 'Created task';
        } else if (operation.type === 'task.edit') {
            if (!title(operation.title) || !text(operation.objective) || !strings(operation.requirements) || !strings(operation.constraints) ||
                !links(operation.links, 'artifact') || !links(operation.workingSet, 'file') ||
                operation.completionNotes !== undefined && !text(operation.completionNotes) ||
                operation.validationNotes !== undefined && !text(operation.validationNotes)) invalid();
            advance(targetTask!.updatedAt, now);
            Object.assign(targetTask!, { title: operation.title, objective: operation.objective, requirements: structuredClone(operation.requirements), constraints: structuredClone(operation.constraints),
                links: structuredClone(operation.links) as PlanningArtifactLink[], workingSet: structuredClone(operation.workingSet) as PlanningFileLink[], updatedAt: now });
            if (operation.completionNotes === undefined) delete targetTask!.completionNotes;
            else targetTask!.completionNotes = operation.completionNotes;
            if (operation.validationNotes === undefined) delete targetTask!.validationNotes;
            else targetTask!.validationNotes = operation.validationNotes;
            stepId = targetTask!.stepId;
            taskId = targetTask!.id;
            summary = 'Edited task';
        } else if (operation.type === 'task.transition') {
            if (!status(operation.status, 'task')) invalid();
            transition('task', targetTask!.status, operation.status);
            advance(targetTask!.updatedAt, now);
            targetTask!.status = operation.status;
            targetTask!.updatedAt = now;
            stepId = targetTask!.stepId;
            taskId = targetTask!.id;
            summary = `Task ${operation.status}`;
        } else invalid();
        advance(parent.updatedAt, now);
        parent.updatedAt = now;
    }
    const changedPlan = next.plans.find(item => item.id === planId)!;
    changedPlan.revision++;
    next.revision++;
    const entry: PlanningHistoryEntry = { id: historyId, timestamp: now, actor: 'developer', planRevision: changedPlan.revision,
        operation: operation.type, planId, ...(stepId ? { stepId } : {}), ...(taskId ? { taskId } : {}), summary };
    next.history.push(entry);
    parsePlanningDocument(next);
    return { snapshot: next, entry: structuredClone(entry) };
}

function compare(left: string, right: string): number { return left < right ? -1 : left > right ? 1 : 0; }

export function queryPlans(document: PlanningDocument): Plan[] {
    parsePlanningDocument(document);
    return [...document.plans].sort((left, right) => compare(left.title.toLowerCase(), right.title.toLowerCase()) || compare(left.id, right.id));
}

export function queryTasks(document: PlanningDocument, planId: string, stepId?: string): Task[] {
    parsePlanningDocument(document);
    const parent = document.plans.find(item => item.id === planId);
    if (!parent || stepId !== undefined && !parent.steps.some(item => item.id === stepId)) invalid();
    return document.tasks.filter(item => item.planId === planId && (stepId === undefined || item.stepId === stepId))
        .sort((left, right) => compare(left.title.toLowerCase(), right.title.toLowerCase()) || compare(left.id, right.id));
}
