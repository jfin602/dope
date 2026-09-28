import type { Artifact, ArtifactLink, ArtifactStatus, ProjectMind } from '@dope/contracts/lib/project-mind';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const utc = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;

function invalid(): never { throw new Error('Invalid Project Mind data'); }
function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
    return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, required: string[], optional: string[] = []): void {
    if (required.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) invalid();
}
function linkIdentity(link: ArtifactLink): string {
    return `${link.relation}:${link.target.type === 'artifact' ? link.target.id : `${link.target.path}:${link.target.line ?? ''}`}`;
}
function date(value: unknown): boolean {
    return typeof value === 'string' && utc.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;
}
function filePath(value: unknown): boolean {
    return typeof value === 'string' && value.length > 0 && !value.includes('\\') && !value.includes('\0') &&
        !value.startsWith('/') && !value.includes(':') &&
        value.split('/').every(part => part !== '' && part !== '.' && part !== '..');
}

export function parseArtifact(value: unknown): Artifact {
    const artifact = record(value);
    const common = ['schemaVersion', 'type', 'id', 'title', 'createdAt', 'updatedAt', 'provenance', 'status', 'archivedAt', 'links'];
    const fields: Record<string, string[]> = {
        note: ['body'], idea: ['body'], question: ['body'],
        decision: ['decision', 'context', 'rationale', 'consequences', 'alternatives', 'revisitConditions'],
    };
    const statuses: Record<string, string[]> = {
        note: ['active'], idea: ['captured', 'parked'], question: ['open', 'answered'],
        decision: ['proposed', 'accepted', 'superseded', 'rejected'],
    };
    if (typeof artifact.type !== 'string' || !fields[artifact.type]) invalid();
    keys(artifact, [...common, ...fields[artifact.type]], ['migration', ...(artifact.type === 'question' ? ['answer'] : [])]);
    if (artifact.schemaVersion !== 2 || typeof artifact.id !== 'string' || !uuid.test(artifact.id) ||
        typeof artifact.title !== 'string' || artifact.provenance !== 'developer' ||
        !statuses[artifact.type].includes(String(artifact.status)) ||
        !(artifact.createdAt === null || date(artifact.createdAt)) ||
        !(artifact.updatedAt === null || date(artifact.updatedAt)) ||
        !(artifact.archivedAt === null || date(artifact.archivedAt)) ||
        !fields[artifact.type].every(field => typeof artifact[field] === 'string') ||
        !Array.isArray(artifact.links)) invalid();
    if (artifact.migration !== undefined) {
        const migration = record(artifact.migration);
        keys(migration, ['sourcePath', 'sourceSchemaVersion', 'migratedAt']);
        if (artifact.type !== 'note' || migration.sourcePath !== '.dope/note.json' || migration.sourceSchemaVersion !== 1 || !date(migration.migratedAt)) invalid();
    }
    if ((artifact.createdAt === null || artifact.updatedAt === null) && artifact.migration === undefined) invalid();
    if (typeof artifact.createdAt === 'string' && typeof artifact.updatedAt === 'string' && artifact.updatedAt < artifact.createdAt) invalid();
    if (artifact.type === 'question' && (artifact.answer !== undefined && typeof artifact.answer !== 'string' ||
        artifact.status === 'answered' && (typeof artifact.answer !== 'string' || !artifact.answer.trim()))) invalid();
    if (artifact.type === 'decision' && artifact.status === 'accepted' &&
        ['decision', 'context', 'rationale'].some(field => !(artifact[field] as string).trim())) invalid();
    for (const link of artifact.links) {
        const entry = record(link);
        keys(entry, ['relation', 'target']);
        const target = record(entry.target);
        if (target.type === 'artifact') {
            keys(target, ['type', 'id']);
            if (typeof target.id !== 'string' || !uuid.test(target.id) ||
                !['related', 'answers', 'supersedes'].includes(String(entry.relation))) invalid();
        } else if (target.type === 'file') {
            keys(target, ['type', 'path'], ['line']);
            if (entry.relation !== 'related' || !filePath(target.path) ||
                (target.line !== undefined && (!Number.isSafeInteger(target.line) || (target.line as number) < 1))) invalid();
        } else invalid();
    }
    return artifact as unknown as Artifact;
}

export function parseProjectMind(value: unknown): ProjectMind {
    const project = record(value);
    keys(project, ['schemaVersion', 'projectId', 'revision', 'artifacts']);
    if (project.schemaVersion !== 2 || typeof project.projectId !== 'string' || !uuid.test(project.projectId) ||
        !Number.isSafeInteger(project.revision) || (project.revision as number) < 1 || !Array.isArray(project.artifacts)) invalid();
    const artifacts = project.artifacts.map(parseArtifact);
    const byId = new Map(artifacts.map(artifact => [artifact.id, artifact]));
    if (byId.size !== artifacts.length) invalid();
    const superseded = new Set<string>();
    for (const artifact of artifacts) {
        const seen = new Set<string>();
        for (const link of artifact.links) {
            const target = link.target;
            const identity = linkIdentity(link);
            if (seen.has(identity)) invalid();
            seen.add(identity);
            if (target.type === 'file') continue;
            const linked = byId.get(target.id);
            if (!linked || linked.id === artifact.id ||
                link.relation === 'answers' && (!(artifact.type === 'note' || artifact.type === 'decision') || linked.type !== 'question') ||
                link.relation === 'supersedes' && (artifact.type !== 'decision' || artifact.status !== 'accepted' || linked.type !== 'decision' || linked.status !== 'superseded')) invalid();
            if (link.relation === 'supersedes') {
                if (superseded.has(linked.id)) invalid();
                superseded.add(linked.id);
            }
        }
    }
    if (artifacts.some(artifact => artifact.type === 'decision' && artifact.status === 'superseded' && !superseded.has(artifact.id))) invalid();
    return project as unknown as ProjectMind;
}

function changed(project: ProjectMind, artifacts: Artifact[]): ProjectMind {
    return parseProjectMind({ ...project, revision: project.revision + 1, artifacts });
}
function update(project: ProjectMind, id: string, now: string, apply: (artifact: Artifact) => Artifact): ProjectMind {
    parseProjectMind(project);
    if (!date(now) || !project.artifacts.some(artifact => artifact.id === id && (artifact.updatedAt === null || now >= artifact.updatedAt))) invalid();
    return changed(project, project.artifacts.map(artifact => artifact.id === id ? apply({ ...artifact, updatedAt: now }) : artifact));
}

function initialArtifact(artifact: Artifact): void {
    parseArtifact(artifact);
    if (artifact.links.length ||
        !['note:active', 'idea:captured', 'question:open', 'decision:proposed'].includes(`${artifact.type}:${artifact.status}`)) invalid();
}

export function createProjectMind(projectId: string, artifact: Artifact): ProjectMind {
    initialArtifact(artifact);
    return parseProjectMind({ schemaVersion: 2, projectId, revision: 1, artifacts: [artifact] });
}

export function addArtifact(project: ProjectMind, artifact: Artifact): ProjectMind {
    parseProjectMind(project);
    initialArtifact(artifact);
    if (project.artifacts.some(existing => existing.id === artifact.id)) invalid();
    return changed(project, [...project.artifacts, artifact]);
}

export function replaceArtifact(project: ProjectMind, replacement: Artifact): ProjectMind {
    parseProjectMind(project);
    parseArtifact(replacement);
    const original = project.artifacts.find(artifact => artifact.id === replacement.id);
    if (!original || original.type !== replacement.type || original.status !== replacement.status ||
        original.createdAt !== replacement.createdAt || original.provenance !== replacement.provenance ||
        JSON.stringify(original.migration) !== JSON.stringify(replacement.migration) ||
        original.archivedAt !== replacement.archivedAt || JSON.stringify(original.links) !== JSON.stringify(replacement.links) ||
        !date(replacement.updatedAt) || (typeof replacement.updatedAt === 'string' && original.updatedAt !== null && replacement.updatedAt < original.updatedAt)) invalid();
    return changed(project, project.artifacts.map(artifact => artifact.id === replacement.id ? replacement : artifact));
}

export function transition(project: ProjectMind, id: string, status: ArtifactStatus, now: string, answer?: string): ProjectMind {
    return update(project, id, now, artifact => {
        const allowed: Record<string, string[]> = {
            'idea:captured': ['parked'], 'idea:parked': ['captured'],
            'question:open': ['answered'], 'question:answered': ['open'],
            'decision:proposed': ['accepted', 'rejected'], 'decision:rejected': ['proposed'],
        };
        if (!allowed[`${artifact.type}:${artifact.status}`]?.includes(status)) invalid();
        if (artifact.type === 'question') {
            if (status === 'answered' && !(answer ?? artifact.answer)?.trim()) invalid();
            return { ...artifact, status: status as 'open' | 'answered', answer: answer ?? artifact.answer };
        }
        if (answer !== undefined) invalid();
        return { ...artifact, status } as Artifact;
    });
}

export function archive(project: ProjectMind, id: string, archived: boolean, now: string): ProjectMind {
    return update(project, id, now, artifact => {
        if ((artifact.archivedAt !== null) === archived) invalid();
        return { ...artifact, archivedAt: archived ? now : null };
    });
}

export function linkArtifact(project: ProjectMind, id: string, link: ArtifactLink, now: string): ProjectMind {
    return update(project, id, now, artifact => {
        if (link.relation === 'supersedes') invalid();
        return { ...artifact, links: [...artifact.links, link] };
    });
}

export function unlinkArtifact(project: ProjectMind, id: string, link: ArtifactLink, now: string): ProjectMind {
    return update(project, id, now, artifact => {
        if (link.relation === 'supersedes') invalid();
        const links = artifact.links.filter(existing => linkIdentity(existing) !== linkIdentity(link));
        if (links.length === artifact.links.length) invalid();
        return { ...artifact, links };
    });
}

export function supersede(project: ProjectMind, oldId: string, replacementId: string, now: string): ProjectMind {
    parseProjectMind(project);
    const old = project.artifacts.find(artifact => artifact.id === oldId);
    const replacement = project.artifacts.find(artifact => artifact.id === replacementId);
    if (!date(now) || !old || old.type !== 'decision' || old.status !== 'accepted' ||
        !replacement || replacement.type !== 'decision' || replacement.status !== 'accepted' ||
        replacementId === oldId || (old.updatedAt !== null && now < old.updatedAt) ||
        (replacement.updatedAt !== null && now < replacement.updatedAt) ||
        replacement.links.some(link => link.relation === 'supersedes' && link.target.id === oldId)) invalid();
    return changed(project, project.artifacts.map(artifact => artifact.id === oldId ? { ...old, status: 'superseded', updatedAt: now } :
        artifact.id === replacementId ? { ...replacement, updatedAt: now, links: [...replacement.links, { relation: 'supersedes', target: { type: 'artifact', id: oldId } }] } : artifact));
}

export interface ArtifactFilter {
    text?: string;
    types?: Artifact['type'][];
    statuses?: ArtifactStatus[];
    archived?: boolean;
}

export function queryArtifacts(project: ProjectMind, filter: ArtifactFilter = {}): Artifact[] {
    parseProjectMind(project);
    const text = filter.text?.toLowerCase() ?? '';
    return project.artifacts.filter(artifact =>
        (filter.archived ?? false) === (artifact.archivedAt !== null) &&
        (!filter.types || filter.types.includes(artifact.type)) &&
        (!filter.statuses || filter.statuses.includes(artifact.status)) &&
        [artifact.title, artifact.type === 'decision' ? [artifact.decision, artifact.context, artifact.rationale, artifact.consequences, artifact.alternatives, artifact.revisitConditions].join(' ') :
            [artifact.body, artifact.type === 'question' ? artifact.answer ?? '' : ''].join(' ')].some(value => value.toLowerCase().includes(text))
    ).sort((left, right) => left.title.toLowerCase() < right.title.toLowerCase() ? -1 :
        left.title.toLowerCase() > right.title.toLowerCase() ? 1 : left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
}
