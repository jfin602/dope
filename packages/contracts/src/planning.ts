export type PlanStatus = 'draft' | 'active' | 'completed' | 'superseded';
export type StepStatus = 'pending' | 'active' | 'blocked' | 'complete' | 'skipped' | 'superseded';
export type TaskStatus = 'pending' | 'active' | 'blocked' | 'complete' | 'cancelled';

export interface PlanningArtifactLink { type: 'artifact'; id: string }
export interface PlanningFileLink { type: 'file'; path: string; line?: number }
export type PlanningLink = PlanningArtifactLink | PlanningFileLink;

export interface PlanStep {
    id: string;
    title: string;
    body: string;
    status: StepStatus;
    blockedReason?: string;
    createdAt: string;
    updatedAt: string;
}

export interface Plan {
    id: string;
    title: string;
    objective: string;
    context: string;
    status: PlanStatus;
    steps: PlanStep[];
    revision: number;
    provenance: 'developer';
    createdAt: string;
    updatedAt: string;
    links: PlanningLink[];
}

export interface Task {
    id: string;
    planId: string;
    stepId: string;
    title: string;
    objective: string;
    requirements: string[];
    constraints: string[];
    status: TaskStatus;
    links: PlanningArtifactLink[];
    workingSet: PlanningFileLink[];
    completionNotes?: string;
    validationNotes?: string;
    createdAt: string;
    updatedAt: string;
}

export type PlanningOperation =
    | { type: 'plan.create'; id: string; title: string; objective: string; context: string; links: PlanningLink[] }
    | { type: 'plan.edit'; planId: string; title: string; objective: string; context: string; links: PlanningLink[] }
    | { type: 'plan.transition'; planId: string; status: PlanStatus }
    | { type: 'step.create'; planId: string; id: string; title: string; body: string }
    | { type: 'step.edit'; planId: string; stepId: string; title: string; body: string }
    | { type: 'step.reorder'; planId: string; stepId: string; index: number }
    | { type: 'step.transition'; planId: string; stepId: string; status: StepStatus; blockedReason?: string }
    | { type: 'task.create'; id: string; planId: string; stepId: string; title: string; objective: string; requirements: string[]; constraints: string[]; links: PlanningArtifactLink[]; workingSet: PlanningFileLink[] }
    | { type: 'task.edit'; taskId: string; title: string; objective: string; requirements: string[]; constraints: string[]; links: PlanningArtifactLink[]; workingSet: PlanningFileLink[]; completionNotes?: string; validationNotes?: string }
    | { type: 'task.transition'; taskId: string; status: TaskStatus };

export interface PlanningHistoryEntry {
    id: string;
    timestamp: string;
    actor: 'developer';
    planRevision: number;
    operation: PlanningOperation['type'];
    planId: string;
    stepId?: string;
    taskId?: string;
    summary: string;
}

export interface PlanningDocument {
    schemaVersion: 1;
    projectId: string;
    revision: number;
    plans: Plan[];
    tasks: Task[];
    history: PlanningHistoryEntry[];
}

export interface PlanningMutation {
    projectHandle: string;
    expectedRevision: number;
    operation: PlanningOperation;
}

export interface PlanningResult { snapshot: PlanningDocument; entry: PlanningHistoryEntry }
export interface PlanningEvent { projectHandle: string; revision: number }
