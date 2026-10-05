export const codexAuthServicePath = '/services/dope/codex-auth';

export interface CodexAccountStatus {
    id: string;
    connectionId: string;
    label: string;
    clientId: string;
    status: 'signed-in' | 'signed-out' | 'needs-authentication';
    planUsage: 'available' | 'unavailable';
}

export interface CodexAuthService {
    list(connectionId: string): Promise<CodexAccountStatus[]>;
    signIn(connectionId: string, registrationId?: string): Promise<void>;
    signOut(connectionId: string, registrationId: string): Promise<{ revocationConfirmed: boolean }>;
    disconnect(connectionId: string, registrationId: string): Promise<{ revocationConfirmed: boolean }>;
}
