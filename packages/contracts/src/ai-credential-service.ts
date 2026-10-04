import type { AIConnectionId } from '@dope/ai';

export const aiCredentialServicePath = '/services/dope/ai-credentials';
export const AICredentialService = Symbol('AICredentialService');

export type AICredentialSource = 'environment' | 'session' | 'secure';
export type AICredentialAvailability = 'available' | 'missing' | 'unavailable';
export interface AICredentialStatus {
    connectionId: AIConnectionId;
    effectiveSource?: AICredentialSource;
    sources: { source: AICredentialSource; status: AICredentialAvailability; name?: string }[];
}

export interface AICredentialService {
    status(connectionId: AIConnectionId): Promise<AICredentialStatus>;
    replace(connectionId: AIConnectionId, source: 'session' | 'secure', secret: string): Promise<AICredentialStatus>;
    remove(connectionId: AIConnectionId, source: 'session' | 'secure'): Promise<AICredentialStatus>;
}
export interface AICredentialClient { notifyAICredentialChanged(connectionId: AIConnectionId): void }
