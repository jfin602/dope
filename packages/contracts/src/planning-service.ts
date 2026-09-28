import type { PlanningDocument, PlanningEvent, PlanningMutation, PlanningResult } from './planning';

export const planningServicePath = '/services/dope/planning';
export const PlanningService = Symbol('PlanningService');

export interface PlanningClient {
    notifyPlanningChanged(event: PlanningEvent): void;
}

export interface PlanningService {
    attach(folderUri: string): Promise<{ projectHandle: string; snapshot: PlanningDocument | undefined }>;
    read(projectHandle: string): Promise<PlanningDocument | undefined>;
    mutate(request: PlanningMutation): Promise<PlanningResult>;
}
