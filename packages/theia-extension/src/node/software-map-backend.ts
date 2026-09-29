import { randomUUID } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalLocalRoot } from '@dope/code-analysis/lib/node/architecture-file';
import { SoftwareMapIndex } from '@dope/code-analysis/lib/node/software-map-index';
import { hierarchy, projectPath, relationshipsFor } from '@dope/software-map';
import type { ArchitectureViolation, Evidence, GraphNode, SoftwareMapPage, SoftwareMapPageRequest, GraphRelationship, SoftwareMapRelationshipRequest,
    PhysicalMapSnapshot, SoftwareMapClient, SoftwareMapService } from '@dope/software-map';

export class SoftwareMapBackend implements SoftwareMapService {
    private root?: string;
    private handle?: string;
    private attaching = 0;
    private disposed = false;
    private readonly unlisten: () => void;

    constructor(private readonly index: SoftwareMapIndex, client: SoftwareMapClient) {
        this.unlisten = index.onChange((root, status) => {
            if (!this.disposed && root === this.root) client.notifySoftwareMapChanged(status);
        });
    }

    async attach(folderUri: string) {
        if (this.disposed) throw new Error('Disposed Software Map connection');
        const request = ++this.attaching;
        const root = await canonicalLocalRoot(folderUri);
        if (this.disposed || request !== this.attaching) throw new Error('Superseded Software Map attachment');
        if (this.root !== root || !this.handle) this.handle = randomUUID();
        this.root = root;
        return { projectHandle: this.handle, status: this.index.status(root) };
    }

    private active(handle: string): string {
        if (this.disposed || !this.root || handle !== this.handle) throw new Error('Invalid or detached Software Map handle');
        return this.root;
    }
    private snapshot(handle: string): PhysicalMapSnapshot {
        const snapshot = this.index.snapshot(this.active(handle));
        if (!snapshot) throw new Error('Software Map has no current analysis');
        return snapshot;
    }
    private page<T>(snapshot: PhysicalMapSnapshot, request: SoftwareMapPageRequest, items: T[]): SoftwareMapPage<T> {
        const offset = request.offset ?? 0;
        const limit = request.limit ?? 100;
        if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 200) throw new Error('Invalid Software Map page');
        return { generation: snapshot.metadata.generation, total: items.length, items: items.slice(offset, offset + limit) };
    }

    async analyze(projectHandle: string) { return this.index.analyze(this.active(projectHandle)); }
    async status(projectHandle: string) { return this.index.status(this.active(projectHandle)); }
    async hierarchy(request: SoftwareMapPageRequest & { parentId?: string; descendants?: boolean }): Promise<SoftwareMapPage<GraphNode>> {
        const snapshot = this.snapshot(request.projectHandle);
        return this.page(snapshot, request, hierarchy(snapshot, request.parentId ?? snapshot.metadata.projectId, request.descendants));
    }
    async node(projectHandle: string, nodeId: string) {
        const snapshot = this.snapshot(projectHandle);
        return { generation: snapshot.metadata.generation, item: snapshot.nodes.find(node => node.id === nodeId) };
    }
    async relationships(request: SoftwareMapRelationshipRequest): Promise<SoftwareMapPage<GraphRelationship>> {
        const snapshot = this.snapshot(request.projectHandle);
        if (!['incoming', 'outgoing'].includes(request.direction) || request.scope && !['direct', 'aggregated', 'all'].includes(request.scope) ||
            request.kinds && (!Array.isArray(request.kinds) || request.kinds.some(kind => !['contains', 'owns', 'imports', 'depends-on', 'exports', 'references', 'extends', 'implements'].includes(kind)))) throw new Error('Invalid Software Map relationship query');
        const items = relationshipsFor(snapshot, request.nodeId, request.direction, request.kinds).filter(edge =>
            request.scope === 'aggregated' ? !!edge.originRelationshipIds?.length : request.scope === 'direct' ? !edge.originRelationshipIds?.length : true);
        return this.page(snapshot, request, items);
    }
    async relationshipEdges(request: SoftwareMapPageRequest & { relationshipIds: string[] }): Promise<SoftwareMapPage<GraphRelationship>> {
        const snapshot = this.snapshot(request.projectHandle);
        if (!Array.isArray(request.relationshipIds) || request.relationshipIds.length > 200 || request.relationshipIds.some(id => typeof id !== 'string')) throw new Error('Invalid Software Map relationship IDs');
        const ids = new Set(request.relationshipIds);
        return this.page(snapshot, request, snapshot.relationships.filter(edge => ids.has(edge.id)));
    }
    async evidence(request: SoftwareMapPageRequest & { evidenceIds: string[] }): Promise<SoftwareMapPage<Evidence>> {
        const snapshot = this.snapshot(request.projectHandle);
        if (!Array.isArray(request.evidenceIds) || request.evidenceIds.length > 200 || request.evidenceIds.some(id => typeof id !== 'string')) throw new Error('Invalid Software Map evidence query');
        const ids = new Set(request.evidenceIds);
        return this.page(snapshot, request, snapshot.evidence.filter(item => ids.has(item.id)));
    }
    async violations(request: SoftwareMapPageRequest & { subsystemId?: string; rule?: ArchitectureViolation['rule'] }): Promise<SoftwareMapPage<ArchitectureViolation>> {
        const snapshot = this.snapshot(request.projectHandle);
        if (request.rule && !['forbidden-dependency', 'unlisted-dependency'].includes(request.rule)) throw new Error('Invalid Software Map violation query');
        return this.page(snapshot, request, snapshot.violations.filter(item =>
            (!request.subsystemId || item.sourceSubsystemId === request.subsystemId || item.targetSubsystemId === request.subsystemId) &&
            (!request.rule || item.rule === request.rule)));
    }
    async resolveSource(projectHandle: string, evidenceId: string) {
        const root = this.active(projectHandle);
        const evidence = this.snapshot(projectHandle).evidence.find(item => item.id === evidenceId);
        if (!evidence?.path) return undefined;
        const path = join(root, projectPath(evidence.path));
        const canonical = await realpath(path);
        const local = relative(root, canonical);
        if (!local || local === '..' || local.startsWith(`..${sep}`)) throw new Error('Unsafe Software Map source path');
        return { uri: pathToFileURL(canonical).href, path: evidence.path, span: evidence.span };
    }
    dispose(): void { if (!this.disposed) { this.disposed = true; this.unlisten(); } }
}
