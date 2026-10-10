import { randomUUID } from 'node:crypto';
import type { DeveloperSessionService, SessionAttachment, SessionMutationRequest, SessionMutationResult } from '@dope/contracts/lib/developer-session-service';
import type { DeveloperSession, SessionCollection } from '@dope/contracts/lib/developer-session';
import { DeveloperSessionStore } from './developer-session-store';

/** One RPC connection owns one attachment. The store owns all durable state. */
export class DeveloperSessionBackend implements DeveloperSessionService {
    private root?: string;
    private handle?: string;
    private attaching = 0;
    private disposed = false;

    constructor(private readonly store: DeveloperSessionStore) {}

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

    dispose(): void {
        this.disposed = true;
        this.attaching++;
        this.root = undefined;
        this.handle = undefined;
    }
}
