export type ArtifactType = 'note' | 'idea' | 'question' | 'decision';
export type ArtifactStatus = 'active' | 'captured' | 'parked' | 'open' | 'answered' | 'proposed' | 'accepted' | 'superseded' | 'rejected';

export interface MigrationProvenance {
    sourcePath: string;
    sourceSchemaVersion: 1;
    migratedAt: string;
}

export interface ArtifactTarget { type: 'artifact'; id: string }
export interface FileTarget { type: 'file'; path: string; line?: number }
export type ArtifactLink =
    | { relation: 'related'; target: ArtifactTarget | FileTarget }
    | { relation: 'answers' | 'supersedes'; target: ArtifactTarget };

export interface ArtifactBase {
    schemaVersion: 2;
    id: string;
    title: string;
    createdAt: string | null;
    updatedAt: string | null;
    provenance: 'developer';
    migration?: MigrationProvenance;
    archivedAt: string | null;
    links: ArtifactLink[];
}

export type Artifact =
    | (ArtifactBase & { type: 'note'; status: 'active'; body: string })
    | (ArtifactBase & { type: 'idea'; status: 'captured' | 'parked'; body: string })
    | (ArtifactBase & { type: 'question'; status: 'open' | 'answered'; body: string; answer?: string })
    | (ArtifactBase & { type: 'decision'; status: 'proposed' | 'accepted' | 'superseded' | 'rejected'; decision: string; context: string; rationale: string; consequences: string; alternatives: string; revisitConditions: string });

export interface ProjectMind {
    schemaVersion: 2;
    projectId: string;
    revision: number;
    artifacts: Artifact[];
}

export type ProjectMindOperation =
    | { type: 'create'; artifact: Artifact }
    | { type: 'replace'; artifact: Artifact }
    | { type: 'transition'; artifactId: string; status: ArtifactStatus; answer?: string }
    | { type: 'archive'; artifactId: string; archived: boolean }
    | { type: 'link' | 'unlink'; artifactId: string; link: ArtifactLink }
    | { type: 'supersede'; oldId: string; replacementId: string };

export interface ProjectMindMutation {
    projectHandle: string;
    expectedRevision: number;
    operation: ProjectMindOperation;
}

export interface ProjectMindResult {
    projectId: string;
    revision: number;
    artifacts: Artifact[];
}

export interface ProjectMindEvent {
    projectId: string;
    revision: number;
}
