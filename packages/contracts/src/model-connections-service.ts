import type { ConnectedModel, ModelConnectionId, ModelId, ModelSelection } from './model-runtime';
import type { AIConnectionId } from '@dope/ai/lib/index';

export const modelConnectionsServicePath = '/services/dope/model-connections';
export const ModelConnectionsService = Symbol('ModelConnectionsService');

/** Persistable application preference. Deliberately contains no endpoint or credential. */
export interface ModelConnectionMetadata {
    id: AIConnectionId;
    providerId: string;
    label: string;
    preferredModelId?: ModelId;
}
export interface ModelConnectionState extends ModelConnectionMetadata {
    ready: boolean;
    models: (ConnectedModel & { usable: boolean })[];
}
export interface ModelConnectionsSnapshot { revision?: number; connections: ModelConnectionState[] }
export interface ModelConnectionsClient { notifyModelConnectionsChanged(): void }
export interface ModelConnectionsService {
    list(): Promise<ModelConnectionsSnapshot>;
    upsert(metadata: ModelConnectionMetadata, expectedRevision: number): Promise<ModelConnectionsSnapshot>;
    remove(connectionId: ModelConnectionId, expectedRevision: number): Promise<ModelConnectionsSnapshot>;
    setPreferred(selection: ModelSelection, expectedRevision: number): Promise<ModelConnectionsSnapshot>;
    /** Secret is sent to this process only; null clears it. It is never echoed or persisted. */
    setSessionCredential(connectionId: ModelConnectionId, credential: string | null): Promise<void>;
    /** Bind a configured connection to its conversational runtime for this application session. */
    activate(connectionId: ModelConnectionId): Promise<ModelConnectionsSnapshot>;
}
