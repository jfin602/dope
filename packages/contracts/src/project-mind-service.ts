import type { ProjectMind, ProjectMindMutation, ProjectMindEvent } from './project-mind';

export const projectMindServicePath = '/services/dope/project-mind';
export const ProjectMindService = Symbol('ProjectMindService');

export interface ProjectMindClient {
    notifyProjectMindChanged(event: ProjectMindEvent): void;
}

export interface ProjectMindService {
    attach(folderUri: string): Promise<{ projectHandle: string; snapshot: ProjectMind | undefined }>;
    read(projectHandle: string): Promise<ProjectMind | undefined>;
    mutate(request: ProjectMindMutation): Promise<ProjectMind>;
    migrate(projectHandle: string): Promise<ProjectMind>;
}
