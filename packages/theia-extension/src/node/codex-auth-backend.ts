import type { CodexAuthService } from '@dope/contracts/lib/codex-auth-service';
import { CodexAuthManager } from './codex-auth-manager';

export class CodexAuthBackend implements CodexAuthService {
    constructor(private readonly manager: CodexAuthManager) {}
    list(connectionId: string) { return this.manager.list(connectionId); }
    signIn(connectionId: string, registrationId?: string) { return this.manager.signIn(connectionId, registrationId); }
    signOut(connectionId: string, registrationId: string) { return this.manager.signOut(connectionId, registrationId); }
    disconnect(connectionId: string, registrationId: string) { return this.manager.disconnect(connectionId, registrationId); }
}
