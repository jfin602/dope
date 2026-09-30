import { randomUUID } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalLocalRoot } from '@dope/code-analysis/lib/node/architecture-file';
import { readInitialization, acceptInitialization } from '@dope/code-analysis/lib/node/smap-initialization-file';
import { SoftwareMapIndex } from '@dope/code-analysis/lib/node/software-map-index';
import { hierarchy, projectPath, relationshipsFor, parseArchitecture, parseArchitectureProposal,
    MAX_EVIDENCE_REFINEMENT_ROUNDS } from '@dope/software-map';
import type { ArchitectureViolation, Evidence, GraphNode, SoftwareMapPage, SoftwareMapPageRequest, GraphRelationship, SoftwareMapRelationshipRequest,
    PhysicalMapSnapshot, SoftwareMapClient, SoftwareMapService, ArchitectureEvidencePacket, ArchitectureReview, ArchitectureReviewNode,
    ArchitectureDeclaration, SoftwareMapInitializationStatus } from '@dope/software-map';
import { LmStudioSynthesisProvider } from './lmstudio-synthesis-provider';

export class SoftwareMapBackend implements SoftwareMapService {
    private root?: string;
    private handle?: string;
    private attaching = 0;
    private disposed = false;
    private initialized = false;
    private run = 0;
    private phase: 'analyzing' | 'review_required' | undefined;
    private pending?: ArchitectureReview & { fingerprint: string };
    // Existing bootstrap route stays local until P7 replaces initialization orchestration.
    private provider?: { synthesize(packet: ArchitectureEvidencePacket): Promise<unknown> };
    private localProvider?: LmStudioSynthesisProvider;
    private readonly unlisten: () => void;
    private idleStatus() {
        return { generation: 0, publishedGeneration: 0, state: 'idle' as const,
            analysis: { completeness: 'failed' as const, errors: [{ producer: '@dope/software-map', code: 'uninitialized', message: 'Software Map is not initialized' }] },
            reusedSourceFiles: 0 };
    }

    constructor(private readonly index: SoftwareMapIndex, client: SoftwareMapClient,
        provider?: { synthesize(packet: ArchitectureEvidencePacket): Promise<unknown> }) {
        this.provider = provider;
        this.unlisten = index.onChange((root, status) => {
            if (!this.disposed && this.initialized && root === this.root) client.notifySoftwareMapChanged(status);
        });
    }

    async attach(folderUri: string) {
        if (this.disposed) throw new Error('Disposed Software Map connection');
        const request = ++this.attaching;
        const root = await canonicalLocalRoot(folderUri);
        if (this.disposed || request !== this.attaching) throw new Error('Superseded Software Map attachment');
        if (this.root !== root || !this.handle) {
            this.handle = randomUUID();
            this.run++;
            this.phase = undefined;
            this.pending = undefined;
            this.provider = this.localProvider ? undefined : this.provider;
            this.localProvider = undefined;
        }
        this.root = root;
        this.initialized = (await readInitialization(root)).initialized;
        return { projectHandle: this.handle, status: this.initialized ? this.index.status(root) : this.idleStatus() };
    }

    private active(handle: string): string {
        if (this.disposed || !this.root || handle !== this.handle) throw new Error('Invalid or detached Software Map handle');
        return this.root;
    }
    private async snapshot(handle: string): Promise<PhysicalMapSnapshot> {
        const root = this.active(handle);
        if (!(await readInitialization(root)).initialized) throw new Error('Software Map is not initialized');
        const snapshot = this.index.snapshot(root);
        if (!snapshot) throw new Error('Software Map has no current analysis');
        return snapshot;
    }
    private page<T>(snapshot: PhysicalMapSnapshot, request: SoftwareMapPageRequest, items: T[]): SoftwareMapPage<T> {
        const offset = request.offset ?? 0;
        const limit = request.limit ?? 100;
        if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 200) throw new Error('Invalid Software Map page');
        return { generation: snapshot.metadata.generation, total: items.length, items: items.slice(offset, offset + limit) };
    }

    async configureSynthesis(projectHandle: string, options: { endpoint?: string; token?: string }): Promise<string[]> {
        this.active(projectHandle);
        const provider = new LmStudioSynthesisProvider(options);
        const models = await provider.discoverModels();
        this.active(projectHandle);
        this.localProvider = provider;
        this.provider = provider;
        return models;
    }
    async selectSynthesisModel(projectHandle: string, modelId: string): Promise<void> {
        this.active(projectHandle);
        if (!this.localProvider) throw new Error('Synthesis provider is not configured');
        this.localProvider.selectModel(modelId);
    }
    async probeSynthesis(projectHandle: string): Promise<void> {
        this.active(projectHandle);
        if (!this.localProvider) throw new Error('Synthesis provider is not configured');
        await this.localProvider.probe();
        this.active(projectHandle);
    }
    async initializationStatus(projectHandle: string): Promise<SoftwareMapInitializationStatus> {
        const root = this.active(projectHandle);
        const state = await readInitialization(root);
        this.initialized = state.initialized;
        return { state: state.initialized ? 'initialized' : this.phase ?? 'uninitialized',
            declarationPresent: state.declarationPresent, declarationFingerprint: state.declarationFingerprint };
    }
    private still(handle: string, root: string, run: number): void {
        if (this.active(handle) !== root || this.run !== run) throw new Error('Superseded Software Map initialization');
    }
    async startInitialization(projectHandle: string): Promise<ArchitectureReview> {
        const root = this.active(projectHandle);
        if ((await readInitialization(root)).initialized || this.phase) throw new Error('Software Map initialization is already active');
        if (!this.provider) throw new Error('Synthesis provider is not configured');
        const provider = this.provider;
        const run = ++this.run;
        this.phase = 'analyzing';
        this.pending = undefined;
        try {
            const fingerprint = (await readInitialization(root)).declarationFingerprint;
            let packet = await this.index.collectEvidence(root);
            this.still(projectHandle, root, run);
            let proposal;
            for (let round = 0; round <= MAX_EVIDENCE_REFINEMENT_ROUNDS; round++) {
                proposal = parseArchitectureProposal(await provider.synthesize(packet), packet);
                this.still(projectHandle, root, run);
                if (!proposal.needsMoreEvidence) break;
                if (round === MAX_EVIDENCE_REFINEMENT_ROUNDS) throw new Error('Architecture evidence refinement limit reached');
                packet = await this.index.refineEvidence(root, packet, proposal.evidenceRequests);
                this.still(projectHandle, root, run);
            }
            if ((await readInitialization(root)).declarationFingerprint !== fingerprint) throw new Error('Stale Software Map architecture declaration');
            const draft: ArchitectureReviewNode[] = proposal!.nodes.map(node => {
                const roots = new Set<string>();
                for (const ref of node.evidenceRefs) {
                    const item = packet.items.find(item => item.id === ref)!;
                    if (item.kind === 'configuration') for (const path of item.sourcePaths ?? []) roots.add(path);
                    if (item.kind === 'entrypoint' || item.kind === 'semantic' || item.kind === 'framework') roots.add(item.path);
                }
                return { proposalKey: node.proposalKey, kind: node.kind, id: '', name: node.name,
                    purpose: node.purpose, parentProposalKey: node.parentProposalKey, roots: [...roots].sort() };
            });
            this.still(projectHandle, root, run);
            const reviewId = randomUUID();
            this.pending = { reviewId, packet, proposal: proposal!, draft, fingerprint };
            this.phase = 'review_required';
            return structuredClone({ reviewId, packet, proposal: proposal!, draft });
        } catch (error) {
            if (this.run === run) { this.phase = undefined; this.pending = undefined; }
            throw error;
        }
    }
    async review(projectHandle: string): Promise<ArchitectureReview | undefined> {
        this.active(projectHandle);
        if (!this.pending) return undefined;
        const { reviewId, packet, proposal, draft } = this.pending;
        return structuredClone({ reviewId, packet, proposal, draft });
    }
    async resolveReviewSource(projectHandle: string, reviewId: string, evidenceRef: string) {
        const root = this.active(projectHandle);
        if (!this.pending || this.pending.reviewId !== reviewId) return undefined;
        const item = this.pending.packet.items.find(item => item.id === evidenceRef);
        if (!item) return undefined;
        const path = join(root, projectPath(item.path));
        const canonical = await realpath(path);
        this.active(projectHandle);
        if (this.pending?.reviewId !== reviewId) return undefined;
        const local = relative(root, canonical);
        if (!local || local === '..' || local.startsWith(`..${sep}`)) throw new Error('Unsafe Software Map source path');
        return { uri: pathToFileURL(canonical).href, path: item.path };
    }
    async cancelInitialization(projectHandle: string): Promise<void> {
        this.active(projectHandle);
        this.run++;
        this.phase = undefined;
        this.pending = undefined;
    }
    private declaration(draft: ArchitectureReviewNode[]): ArchitectureDeclaration {
        if (!Array.isArray(draft) || !draft.length) throw new Error('Invalid architecture review draft');
        const keys = new Set(draft.map(node => node.proposalKey));
        if (keys.size !== draft.length || draft.some(node => !['system', 'subsystem', 'component'].includes(node.kind) ||
            typeof node.id !== 'string' || !node.id || !Array.isArray(node.roots))) throw new Error('Invalid architecture review draft');
        const systems = draft.filter(node => node.kind === 'system').map(system => ({
            id: system.id, name: system.name, purpose: system.purpose,
            ...(system.roots.length ? { roots: system.roots } : {}),
            subsystems: draft.filter(node => node.kind === 'subsystem' && node.parentProposalKey === system.proposalKey).map(subsystem => ({
                id: subsystem.id, name: subsystem.name, purpose: subsystem.purpose, roots: subsystem.roots,
                components: draft.filter(node => node.kind === 'component' && node.parentProposalKey === subsystem.proposalKey).map(component => ({
                    id: component.id, name: component.name, purpose: component.purpose, roots: component.roots,
                })),
            })),
        }));
        if (draft.some(node => node.kind !== 'system' && !draft.some(parent => parent.proposalKey === node.parentProposalKey &&
            parent.kind === (node.kind === 'subsystem' ? 'system' : 'subsystem')))) throw new Error('Invalid architecture review parent');
        return parseArchitecture({ schemaVersion: 1, systems });
    }
    async acceptReview(projectHandle: string, reviewId: string, draft: ArchitectureReviewNode[]) {
        const root = this.active(projectHandle);
        if (this.phase !== 'review_required' || !this.pending || reviewId !== this.pending.reviewId) throw new Error('No matching architecture review to accept');
        const declaration = this.declaration(draft);
        if ((await this.index.collectEvidence(root)).sourceFingerprint !== this.pending.packet.sourceFingerprint) throw new Error('Stale Software Map evidence');
        await acceptInitialization(root, this.pending.fingerprint, declaration);
        this.initialized = true;
        this.phase = undefined;
        this.pending = undefined;
        return this.index.analyze(root);
    }
    async acceptExisting(projectHandle: string, expectedFingerprint: string) {
        const root = this.active(projectHandle);
        if (this.phase) throw new Error('Software Map initialization is active');
        await acceptInitialization(root, expectedFingerprint);
        this.initialized = true;
        return this.index.analyze(root);
    }
    async acceptManual(projectHandle: string, declaration: ArchitectureDeclaration, expectedFingerprint: string) {
        const root = this.active(projectHandle);
        if (this.phase) throw new Error('Software Map initialization is active');
        await acceptInitialization(root, expectedFingerprint, parseArchitecture(declaration));
        this.initialized = true;
        return this.index.analyze(root);
    }
    async analyze(projectHandle: string) {
        const root = this.active(projectHandle);
        if (!(await readInitialization(root)).initialized) throw new Error('Software Map is not initialized');
        return this.index.analyze(root);
    }
    async status(projectHandle: string) {
        const root = this.active(projectHandle);
        this.initialized = (await readInitialization(root)).initialized;
        return this.initialized ? this.index.status(root) : this.idleStatus();
    }
    async hierarchy(request: SoftwareMapPageRequest & { parentId?: string; descendants?: boolean }): Promise<SoftwareMapPage<GraphNode>> {
        const snapshot = await this.snapshot(request.projectHandle);
        return this.page(snapshot, request, hierarchy(snapshot, request.parentId ?? snapshot.metadata.projectId, request.descendants));
    }
    async node(projectHandle: string, nodeId: string) {
        const snapshot = await this.snapshot(projectHandle);
        return { generation: snapshot.metadata.generation, item: snapshot.nodes.find(node => node.id === nodeId) };
    }
    async relationships(request: SoftwareMapRelationshipRequest): Promise<SoftwareMapPage<GraphRelationship>> {
        const snapshot = await this.snapshot(request.projectHandle);
        if (!['incoming', 'outgoing'].includes(request.direction) || request.scope && !['direct', 'aggregated', 'all'].includes(request.scope) ||
            request.kinds && (!Array.isArray(request.kinds) || request.kinds.some(kind => !['contains', 'owns', 'imports', 'depends-on', 'exports', 'references', 'extends', 'implements'].includes(kind)))) throw new Error('Invalid Software Map relationship query');
        const items = relationshipsFor(snapshot, request.nodeId, request.direction, request.kinds).filter(edge =>
            request.scope === 'aggregated' ? !!edge.originRelationshipIds?.length : request.scope === 'direct' ? !edge.originRelationshipIds?.length : true);
        return this.page(snapshot, request, items);
    }
    async relationshipEdges(request: SoftwareMapPageRequest & { relationshipIds: string[] }): Promise<SoftwareMapPage<GraphRelationship>> {
        const snapshot = await this.snapshot(request.projectHandle);
        if (!Array.isArray(request.relationshipIds) || request.relationshipIds.length > 200 || request.relationshipIds.some(id => typeof id !== 'string')) throw new Error('Invalid Software Map relationship IDs');
        const ids = new Set(request.relationshipIds);
        return this.page(snapshot, request, snapshot.relationships.filter(edge => ids.has(edge.id)));
    }
    async evidence(request: SoftwareMapPageRequest & { evidenceIds: string[] }): Promise<SoftwareMapPage<Evidence>> {
        const snapshot = await this.snapshot(request.projectHandle);
        if (!Array.isArray(request.evidenceIds) || request.evidenceIds.length > 200 || request.evidenceIds.some(id => typeof id !== 'string')) throw new Error('Invalid Software Map evidence query');
        const ids = new Set(request.evidenceIds);
        return this.page(snapshot, request, snapshot.evidence.filter(item => ids.has(item.id)));
    }
    async violations(request: SoftwareMapPageRequest & { subsystemId?: string; rule?: ArchitectureViolation['rule'] }): Promise<SoftwareMapPage<ArchitectureViolation>> {
        const snapshot = await this.snapshot(request.projectHandle);
        if (request.rule && !['forbidden-dependency', 'unlisted-dependency'].includes(request.rule)) throw new Error('Invalid Software Map violation query');
        return this.page(snapshot, request, snapshot.violations.filter(item =>
            (!request.subsystemId || item.sourceSubsystemId === request.subsystemId || item.targetSubsystemId === request.subsystemId) &&
            (!request.rule || item.rule === request.rule)));
    }
    async resolveSource(projectHandle: string, evidenceId: string) {
        const root = this.active(projectHandle);
        const evidence = (await this.snapshot(projectHandle)).evidence.find(item => item.id === evidenceId);
        if (!evidence?.path) return undefined;
        const path = join(root, projectPath(evidence.path));
        const canonical = await realpath(path);
        const local = relative(root, canonical);
        if (!local || local === '..' || local.startsWith(`..${sep}`)) throw new Error('Unsafe Software Map source path');
        return { uri: pathToFileURL(canonical).href, path: evidence.path, span: evidence.span };
    }
    dispose(): void { if (!this.disposed) { this.disposed = true; this.run++; this.pending = undefined; this.unlisten(); } }
}
