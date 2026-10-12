import { randomUUID } from 'node:crypto';
import type { DeveloperSessionService, SessionArtifactResolution, SessionAttachment, SessionLinkMutationRequest,
    SessionMutationRequest, SessionMutationResult, SessionResolveRequest, SessionResolveResult, SessionCandidateResult } from '@dope/contracts/lib/developer-session-service';
import type { DeveloperSession, SessionCollection } from '@dope/contracts/lib/developer-session';
import { parseSessionArtifactRef, sessionArtifactRefKey } from '@dope/contracts/lib/developer-session';
import { DeveloperSessionStore } from './developer-session-store';
import { DeveloperSessionAgentMindResolver, DeveloperSessionChatPlanningResolver, trustedPlanningBasis } from './developer-session-resolver';
import { DeveloperSessionCandidates } from './developer-session-candidates';
import type { SoftwareMapIndex } from '@dope/code-analysis/lib/node/software-map-index';

/** One RPC connection owns one attachment. The store owns all durable state. */
export class DeveloperSessionBackend implements DeveloperSessionService {
    private root?: string;
    private handle?: string;
    private attaching = 0;
    private disposed = false;

    private readonly chatPlanning: DeveloperSessionChatPlanningResolver;
    private readonly agentMind: DeveloperSessionAgentMindResolver;
    private readonly candidateOwner = new DeveloperSessionCandidates();

    constructor(private readonly store: DeveloperSessionStore, index?: SoftwareMapIndex) {
        const scope = () => this.root && this.handle && !this.disposed ?
            { root: this.root, projectHandle: this.handle } : undefined;
        this.chatPlanning = new DeveloperSessionChatPlanningResolver(scope, store,
            undefined, undefined, index ? root => trustedPlanningBasis(root, index) : undefined);
        this.agentMind = new DeveloperSessionAgentMindResolver(scope, store);
    }

    async attach(folderUri: string): Promise<SessionAttachment> {
        if (this.disposed) throw new Error('Disposed Development Sessions connection');
        const request = ++this.attaching;
        const root = await this.store.root(folderUri);
        this.checkAttach(request);
        if (this.root && this.root !== root) throw new Error('A different Development Sessions project is already attached');
        const snapshot = await this.store.read(root);
        this.checkAttach(request);
        this.verify(root, snapshot);
        const projectHandle = randomUUID();
        this.root = root;
        this.handle = projectHandle;
        return { projectHandle, project: snapshot.project, snapshot };
    }

    private checkAttach(request: number): void {
        if (this.disposed || request !== this.attaching)
            throw new Error('Disposed or superseded Development Sessions attachment');
    }

    private active(projectHandle: string): string {
        if (this.disposed || !this.root || !this.handle || projectHandle !== this.handle)
            throw new Error('Invalid or disposed Development Sessions handle');
        return this.root;
    }

    private verify(root: string, snapshot: SessionCollection): void {
        if (snapshot.project.canonicalRoot !== root || snapshot.project.projectMindId !== null)
            throw new Error('Development Sessions project identity changed');
    }

    async read(projectHandle: string): Promise<SessionCollection> {
        const root = this.active(projectHandle);
        const snapshot = await this.store.read(root);
        this.active(projectHandle);
        this.verify(root, snapshot);
        return snapshot;
    }

    async list(projectHandle: string): Promise<DeveloperSession[]> {
        return (await this.read(projectHandle)).sessions;
    }

    async get(projectHandle: string, sessionId: string): Promise<DeveloperSession | undefined> {
        return (await this.read(projectHandle)).sessions.find(session => session.id === sessionId);
    }

    async mutate(request: SessionMutationRequest): Promise<SessionMutationResult> {
        if (!request || typeof request !== 'object') throw new Error('Invalid Development Sessions mutation');
        const root = this.active(request.projectHandle);
        const result = await this.store.mutate(root, null, request);
        this.verify(root, result.snapshot);
        return result;
    }

    private async resolveRef(projectHandle: string, ref: SessionArtifactResolution['ref']): Promise<SessionArtifactResolution> {
        if (ref.kind === 'chat' || ref.kind === 'planning-map' || ref.kind === 'work-item')
            return this.chatPlanning.resolve(projectHandle, ref);
        return this.agentMind.resolve(projectHandle, ref);
    }

    async attachLink(request: SessionLinkMutationRequest): Promise<SessionMutationResult> {
        if (!request || typeof request !== 'object') throw new Error('Invalid Session link request');
        const root = this.active(request.projectHandle);
        const ref = parseSessionArtifactRef(request.ref);
        const snapshot = await this.read(request.projectHandle);
        const alreadyLinked = snapshot.sessions.find(session => session.id === request.sessionId)?.links
            .some(link => sessionArtifactRefKey(link) === sessionArtifactRefKey(ref));
        if (!alreadyLinked) {
            const owner = await this.resolveRef(request.projectHandle, ref);
            if (owner.availability !== 'resolved') throw new Error(`Cannot attach ${owner.availability} Session artifact: ${owner.diagnostic}`);
        }
        if (this.active(request.projectHandle) !== root) throw new Error('Development Sessions project changed');
        const result = await this.store.mutateLink(root, null, { ...request, ref }, 'attach', () => {
            if (this.active(request.projectHandle) !== root) throw new Error('Development Sessions project changed');
        });
        this.verify(root, result.snapshot);
        this.active(request.projectHandle);
        return result;
    }

    async detachLink(request: SessionLinkMutationRequest): Promise<SessionMutationResult> {
        if (!request || typeof request !== 'object') throw new Error('Invalid Session link request');
        const root = this.active(request.projectHandle);
        const result = await this.store.mutateLink(root, null, request, 'detach', () => {
            if (this.active(request.projectHandle) !== root) throw new Error('Development Sessions project changed');
        });
        this.verify(root, result.snapshot);
        this.active(request.projectHandle);
        return result;
    }

    async resolve(request: SessionResolveRequest): Promise<SessionResolveResult> {
        if (!request || typeof request !== 'object') throw new Error('Invalid Session resolve request');
        const root = this.active(request.projectHandle);
        const snapshot = await this.read(request.projectHandle);
        const session = snapshot.sessions.find(item => item.id === request.sessionId);
        if (!session) throw new Error('Unknown Development Session');
        const artifacts: SessionArtifactResolution[] = [];
        for (const ref of session.links) {
            artifacts.push(await this.resolveRef(request.projectHandle, ref));
            if (this.active(request.projectHandle) !== root) throw new Error('Development Sessions project changed');
        }
        return { sessionId: session.id, collectionRevision: snapshot.revision,
            sessionRevision: session.revision, artifacts };
    }

    async candidates(projectHandle: string, kind: SessionArtifactResolution['ref']['kind']): Promise<SessionCandidateResult> {
        const root = this.active(projectHandle);
        const snapshot = await this.read(projectHandle);
        this.verify(root, snapshot);
        const result = await this.candidateOwner.list(root, kind);
        if (this.active(projectHandle) !== root) throw new Error('Development Sessions project changed');
        return result;
    }

    dispose(): void {
        this.disposed = true;
        this.attaching++;
        this.root = undefined;
        this.handle = undefined;
    }
}
