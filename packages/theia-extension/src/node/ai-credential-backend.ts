import type { AICredentialClient, AICredentialService } from '@dope/contracts/lib/ai-credential-service';
import { AICredentialManager } from './ai-credential-manager';

export class AICredentialBackend implements AICredentialService {
    private readonly unlisten: () => void;
    constructor(private readonly manager: AICredentialManager, client: AICredentialClient) {
        this.unlisten = manager.onChange(id => client.notifyAICredentialChanged(id));
    }
    status(id: string) { return this.manager.status(id); }
    replace(id: string, source: 'session' | 'secure', secret: string) { return this.manager.replace(id, source, secret); }
    remove(id: string, source: 'session' | 'secure') { return this.manager.remove(id, source); }
    reuseSoftwareMapGemini(id: string) { return this.manager.reuseSoftwareMapGemini(id); }
    retireSoftwareMapGemini(id: string) { return this.manager.retireSoftwareMapGemini(id); }
    dispose(): void { this.unlisten(); }
}
