import { createHash, createPublicKey, randomBytes, randomUUID, verify, timingSafeEqual } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { constants } from 'node:fs';
import { lstat, mkdir, open, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import type { CodexAccountStatus } from '@dope/contracts/lib/codex-auth-service';
import type { SecureCredentialStore } from './ai-credential-manager';
import { osSecureStore } from './ai-credential-manager';
import { aiConfigDirectory } from './ai-config-directory';
import type { AIRegistryStore } from './ai-registry-store';

const service = 'Dope ChatGPT Plan Sessions';
const resource = 'https://api.openai.com/v1';
const scopes = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const planScope = 'chatgpt.tokens.use.direct';
const failed = (message: string): Error => new Error(`ChatGPT sign-in: ${message}`);
const fresh = (): string => randomBytes(32).toString('base64url');

interface Profile extends CodexAccountStatus { subject: string }
interface Bundle {
    accessToken: string;
    refreshToken: string;
    idToken: string;
    scopes: string[];
    expiresAt: number;
    earliestRefreshAt: number;
    subject: string;
    clientId: string;
}
interface Pending {
    connectionId: string;
    registrationId?: string;
    verifier: string;
    nonce: string;
    state: string;
    redirectUri: string;
    expiresAt: number;
    server: Pick<Server, 'close' | 'once'>;
}

type CallbackListener = (callback: (url: URL) => Promise<void>) => Promise<{ redirectUri: string; server: Pick<Server, 'close' | 'once'> }>;

export interface CodexAuthOptions {
    directory?: string;
    issuer?: string;
    fetcher?: typeof globalThis.fetch;
    secureStore?: () => Promise<SecureCredentialStore | undefined>;
    openBrowser?: (url: string) => Promise<void>;
    now?: () => number;
    callbackListener?: CallbackListener;
}

export class CodexAuthManager {
    private readonly directory: string;
    private readonly issuer: string;
    private readonly fetcher: typeof globalThis.fetch;
    private readonly secureStore: () => Promise<SecureCredentialStore | undefined>;
    private readonly openBrowser: (url: string) => Promise<void>;
    private readonly now: () => number;
    private readonly callbackListener: CallbackListener;
    private readonly pending = new Map<string, Pending>();

    private diagnostic(message: string): void {
        if (process.env.DOPE_CODEX_AUTH_DIAGNOSTICS === '1') console.info(`[dope-codex-auth] ${message}`);
    }

    constructor(private readonly registry: Pick<AIRegistryStore, 'read'>, options: CodexAuthOptions = {}) {
        this.directory = options.directory ?? aiConfigDirectory();
        this.issuer = options.issuer ?? 'https://auth.openai.com';
        this.fetcher = options.fetcher ?? globalThis.fetch;
        this.secureStore = options.secureStore ?? osSecureStore;
        this.now = options.now ?? Date.now;
        this.callbackListener = options.callbackListener ?? (async callback => {
            const server = createServer((request, response) => {
                const address = server.address();
                if (!address || typeof address === 'string') { response.writeHead(400).end('Invalid callback'); return; }
                const url = new URL(request.url ?? '/', `http://127.0.0.1:${address.port}`);
                if (request.method !== 'GET' || url.pathname !== '/auth/callback' ||
                    ['id_token', 'access_token', 'refresh_token'].some(name => url.searchParams.has(name))) {
                    response.writeHead(400).end('Invalid callback'); return;
                }
                void callback(url).then(() => response.writeHead(200).end('Sign-in completed. You may close this tab.'),
                    () => response.writeHead(400).end('Sign-in failed. Return to Dope and try again.'));
            });
            await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
            const address = server.address();
            if (!address || typeof address === 'string') { server.close(); throw failed('callback unavailable'); }
            this.diagnostic(`callback listener bound at http://127.0.0.1:${address.port}/auth/callback`);
            return { redirectUri: `http://127.0.0.1:${address.port}/auth/callback`, server };
        });
        this.openBrowser = options.openBrowser ?? (url => new Promise((resolve, reject) => {
            const browser = spawn('xdg-open', [url], { stdio: 'ignore', detached: true });
            browser.once('error', () => reject(failed('browser unavailable')));
            browser.once('spawn', () => { browser.unref(); resolve(); });
        }));
    }

    private async safeDirectory(): Promise<void> {
        await mkdir(this.directory, { recursive: true, mode: 0o700 });
        const info = await lstat(this.directory);
        if (!info.isDirectory() || (info.mode & 0o077)) throw failed('unsafe configuration directory');
    }
    private async read(path: string): Promise<string | undefined> {
        try {
            const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
            try {
                const info = await handle.stat();
                if (!info.isFile() || (info.mode & 0o077)) throw failed('unsafe configuration file');
                return await handle.readFile('utf8');
            } finally { await handle.close(); }
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
            throw error;
        }
    }
    private async write(path: string, value: string): Promise<void> {
        const temporary = `${path}.${randomUUID()}.tmp`;
        try {
            const handle = await open(temporary, 'wx', 0o600);
            try { await handle.writeFile(value); await handle.sync(); } finally { await handle.close(); }
            await rename(temporary, path);
            const folder = await open(this.directory, 'r');
            try { await folder.sync(); } finally { await folder.close(); }
        } finally { await rm(temporary, { force: true }); }
    }
    private async locked<Result>(name: string, work: () => Promise<Result>): Promise<Result> {
        await this.safeDirectory();
        const path = join(this.directory, `.codex-${name}.lock`);
        let acquired = false;
        const attempts = name.startsWith('account-') ? 2400 : 200;
        for (let attempt = 0; attempt < attempts; attempt++) {
            try {
                await mkdir(path, { mode: 0o700 });
                acquired = true;
                break;
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw failed('lock unavailable');
                const info = await lstat(path).catch(() => undefined);
                if (info && (!info.isDirectory() || (info.mode & 0o077))) throw failed('unsafe lock');
                await new Promise(resolve => setTimeout(resolve, 25));
            }
        }
        if (!acquired) throw failed('session busy; retry later');
        try { return await work(); } finally { await rm(path, { recursive: true }); }
    }
    async hostId(): Promise<string> {
        return this.locked('host', async () => {
            const path = join(this.directory, 'codex-host-id');
            const existing = await this.read(path);
            if (existing) {
                if (!/^urn:uuid:[0-9a-f-]{36}\n$/.test(existing)) throw failed('invalid host ID');
                return existing.trim();
            }
            const id = `urn:uuid:${randomUUID()}`;
            await this.write(path, `${id}\n`);
            return id;
        });
    }
    private async profiles(): Promise<Profile[]> {
        await this.safeDirectory();
        const bytes = await this.read(join(this.directory, 'codex-accounts.json'));
        if (!bytes) return [];
        try {
            const parsed: unknown = JSON.parse(bytes);
            if (!Array.isArray(parsed) || !parsed.every(item => item && typeof item.id === 'string' &&
                typeof item.clientId === 'string' && typeof item.subject === 'string' && typeof item.connectionId === 'string' &&
                typeof item.label === 'string' && ['signed-in', 'signed-out', 'needs-authentication'].includes(item.status) &&
                ['available', 'unavailable'].includes(item.planUsage))) throw failed('invalid accounts');
            return parsed as Profile[];
        } catch { throw failed('invalid account metadata'); }
    }
    private async saveProfiles(profiles: Profile[]): Promise<void> {
        await this.write(join(this.directory, 'codex-accounts.json'), `${JSON.stringify(profiles)}\n`);
    }
    private async assertConnection(connectionId: string): Promise<void> {
        if (typeof connectionId !== 'string' || !connectionId.trim() ||
            !(await this.registry.read()).connections.some(item => item.id === connectionId && item.config.type === 'codex'))
            throw failed('unknown Codex connection');
    }
    private async store(): Promise<SecureCredentialStore> {
        try {
            const store = await this.secureStore();
            if (store) return store;
        } catch {}
        throw failed('OS secure storage unavailable');
    }
    private async getBundle(store: SecureCredentialStore, id: string): Promise<Bundle | undefined> {
        try {
            const value = await store.getPassword(service, id);
            return value ? JSON.parse(value) as Bundle : undefined;
        } catch { throw failed('OS secure storage unavailable'); }
    }
    private async putBundle(store: SecureCredentialStore, id: string, bundle: Bundle): Promise<void> {
        try { await store.setPassword(service, id, JSON.stringify(bundle)); }
        catch { throw failed('OS secure storage unavailable'); }
    }
    private async removeBundle(store: SecureCredentialStore, id: string): Promise<void> {
        try { await store.deletePassword(service, id); }
        catch { throw failed('OS secure storage unavailable'); }
    }
    async list(connectionId: string): Promise<CodexAccountStatus[]> {
        await this.assertConnection(connectionId);
        const store = await this.store();
        const profiles = await this.profiles();
        return Promise.all(profiles.filter(profile => profile.connectionId === connectionId).map(async profile => {
            const bundle = await this.getBundle(store, profile.id);
            const { subject: _subject, ...publicProfile } = profile;
            return { ...publicProfile, status: bundle ? profile.status : 'signed-out' as const,
                planUsage: bundle?.scopes.includes(planScope) ? 'available' as const : 'unavailable' as const };
        }));
    }
    private async http(endpoint: string, body?: URLSearchParams): Promise<Record<string, unknown>> {
        const purpose = endpoint.endsWith('/oauth/token') ? 'token exchange' :
            endpoint.endsWith('/openid-configuration') ? 'OIDC metadata' : 'JWKS';
        try {
            const response = await this.fetcher(endpoint, body ? { method: 'POST', redirect: 'error',
                headers: { 'content-type': 'application/x-www-form-urlencoded' }, body } : { redirect: 'error' });
            if (!response.ok) this.diagnostic(`identity HTTP ${response.status} at ${purpose}`);
            if (!response.ok) throw failed(response.status === 400 || response.status === 401 ? 'authorization rejected' : 'identity service unavailable');
            return await response.json() as Record<string, unknown>;
        } catch (error) {
            const cause = error instanceof Error ? error.cause : undefined;
            this.diagnostic(`${purpose} failed: exception=${error instanceof Error ? error.name : 'unknown'} cause=${cause instanceof Error ? cause.name : 'unknown'}`);
            throw failed('identity service unavailable');
        }
    }
    private async identity(token: string, clientId: string, nonce?: string): Promise<{ sub: string; email?: string }> {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) throw failed('invalid ID token');
            const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString()) as { alg: string; kid: string };
            const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as Record<string, unknown>;
            const audienceMatches = claims.aud === clientId ||
                (Array.isArray(claims.aud) && claims.aud.length > 0 &&
                    claims.aud.every(value => typeof value === 'string') && claims.aud.includes(clientId));
            this.diagnostic(`ID claims: alg=${header.alg === 'RS256'} kid=${!!header.kid} issuer=${claims.iss === this.issuer} audience=${audienceMatches} audienceArray=${Array.isArray(claims.aud)} nonce=${nonce === undefined || claims.nonce === nonce} subject=${typeof claims.sub === 'string' && !!claims.sub} expiry=${typeof claims.exp === 'number' && claims.exp > this.now() / 1000} notBefore=${typeof claims.nbf !== 'number' || claims.nbf <= this.now() / 1000}`);
            if (header.alg !== 'RS256' || !header.kid || claims.iss !== this.issuer ||
                !audienceMatches || (nonce !== undefined && claims.nonce !== nonce) ||
                typeof claims.sub !== 'string' || !claims.sub ||
                typeof claims.exp !== 'number' || claims.exp <= this.now() / 1000 ||
                (typeof claims.nbf === 'number' && claims.nbf > this.now() / 1000)) throw failed('invalid ID token');
            this.diagnostic('ID claims accepted; loading OIDC metadata');
            const config = await this.http(`${this.issuer}/.well-known/openid-configuration`);
            if (config.issuer !== this.issuer || typeof config.jwks_uri !== 'string' ||
                !config.jwks_uri.startsWith(`${this.issuer}/`)) throw failed('invalid identity metadata');
            this.diagnostic('OIDC metadata accepted; loading JWKS');
            const keys = await this.http(config.jwks_uri);
            if (!Array.isArray(keys.keys)) throw failed('invalid signing keys');
            const key = keys.keys.find(item => item && item.kid === header.kid && item.kty === 'RSA' &&
                item.use === 'sig' && (!item.alg || item.alg === 'RS256'));
            this.diagnostic(`JWKS signing key matched=${!!key}`);
            if (!key || !verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key, format: 'jwk' }),
                Buffer.from(parts[2], 'base64url'))) throw failed('invalid ID signature');
            return { sub: claims.sub, ...(typeof claims.email === 'string' ? { email: claims.email } : {}) };
        } catch { throw failed('ID token verification failed'); }
    }
    private tokenBundle(response: Record<string, unknown>, subject: string, clientId: string, previousId?: string): Bundle {
        if (typeof response.access_token !== 'string' || !response.access_token ||
            typeof response.refresh_token !== 'string' || !response.refresh_token ||
            typeof (response.id_token ?? previousId) !== 'string' || !Number.isFinite(response.expires_in) ||
            Number(response.expires_in) <= 0 || response.token_type !== 'Bearer' || typeof response.scope !== 'string')
            throw failed('invalid token response');
        const earliest = response.earliest_refresh_at;
        const earliestRefreshAt = typeof earliest === 'number' && Number.isFinite(earliest) ? earliest * 1000 : 0;
        return { accessToken: response.access_token, refreshToken: response.refresh_token,
            idToken: (response.id_token ?? previousId) as string, scopes: response.scope.split(/\s+/).filter(Boolean),
            expiresAt: this.now() + Number(response.expires_in) * 1000, earliestRefreshAt, subject, clientId };
    }
    async signIn(connectionId: string, registrationId?: string): Promise<void> {
        await this.assertConnection(connectionId);
        const store = await this.store();
        const registration = registrationId ? (await this.profiles()).find(item => item.id === registrationId && item.connectionId === connectionId) : undefined;
        if (registrationId && !registration) throw failed('unknown registration');
        if ([...this.pending.values()].some(item => item.connectionId === connectionId && item.registrationId === registrationId))
            throw failed('sign-in already pending');
        const state = fresh();
        const nonce = fresh();
        const verifier = fresh();
        let server: Pick<Server, 'close' | 'once'> | undefined;
        try {
            const listener = await this.callbackListener(callback => this.complete(state, callback));
            server = listener.server;
            const redirectUri = listener.redirectUri;
            const pending: Pending = { connectionId, registrationId, state, nonce, verifier, redirectUri, server, expiresAt: this.now() + 300000 };
            this.pending.set(state, pending);
            const url = new URL(`${this.issuer}/api/accounts/authorize`);
            url.searchParams.set('client_id', registration?.clientId ?? 'dynamic_agent_client');
            url.searchParams.set('ext_agent_host_id', await this.hostId());
            if (!registration) url.searchParams.set('agent_name_hint', 'Dope');
            else {
                const bundle = await this.getBundle(store, registration.id);
                if (bundle?.idToken) url.searchParams.set('id_token_hint', bundle.idToken);
                if (registration.label) url.searchParams.set('login_hint', registration.label);
            }
            for (const [key, value] of Object.entries({ response_type: 'code', redirect_uri: redirectUri, scope: scopes,
                resource, state, nonce, code_challenge_method: 'S256',
                code_challenge: createHash('sha256').update(verifier).digest('base64url') })) url.searchParams.set(key, value);
            this.diagnostic(`authorization opening with matching redirect URI ${redirectUri}`);
            await this.openBrowser(url.toString());
            const timer = setTimeout(() => { this.pending.delete(state); pending.server.close(); }, 300000);
            timer.unref();
            server.once('close', () => clearTimeout(timer));
        } catch { this.pending.delete(state); server?.close(); throw failed('could not begin sign-in'); }
    }
    private async complete(state: string, callback: URL): Promise<void> {
        const pending = this.pending.get(state);
        if (!pending) throw failed('unknown sign-in');
        const param = callback.searchParams;
        this.diagnostic(`callback received: code=${param.has('code')} state=${param.has('state')} scope=${param.has('scope')} client_id=${param.has('client_id')} error=${param.has('error')}`);
        if (callback.origin !== new URL(pending.redirectUri).origin || callback.pathname !== '/auth/callback' ||
                param.getAll('state').length !== 1 ||
            !this.same(param.get('state'), state)) throw failed('invalid callback state');
        this.diagnostic('callback state and redirect URI validated');
        this.pending.delete(state);
        pending.server.close();
        if (this.now() >= pending.expiresAt || param.has('error') || param.getAll('code').length !== 1 || !param.get('code'))
            throw failed('authorization denied or expired');
        const profiles = await this.profiles();
        const selected = pending.registrationId ? profiles.find(item => item.id === pending.registrationId && item.connectionId === pending.connectionId) : undefined;
        if (pending.registrationId && !selected) throw failed('unknown registration');
        const supplied = param.getAll('client_id');
        if (supplied.length > 1 || (!selected && (supplied.length !== 1 || !/^oaiapp_[A-Za-z0-9_-]+$/.test(supplied[0]))) ||
            (selected && supplied.length && supplied[0] !== selected.clientId)) throw failed('invalid issued client');
        const clientId = selected?.clientId ?? supplied[0];
        this.diagnostic('issued client ID accepted');
        const tokens = await this.http(`${this.issuer}/api/accounts/oauth/token`, new URLSearchParams({
            grant_type: 'authorization_code', code: param.get('code')!, client_id: clientId,
            code_verifier: pending.verifier, redirect_uri: pending.redirectUri, resource
        }));
        this.diagnostic('authorization code exchange succeeded');
        if (typeof tokens.id_token !== 'string') throw failed('missing ID token');
        const identity = await this.identity(tokens.id_token, clientId, pending.nonce);
        this.diagnostic('ID token verified');
        if (selected && selected.subject !== identity.sub) throw failed('wrong account');
        const bundle = this.tokenBundle(tokens, identity.sub, clientId);
        this.diagnostic(`token response accepted; direct plan scope granted=${bundle.scopes.includes(planScope)}`);
        const id = selected?.id ?? randomUUID();
        await this.locked(`account-${id}`, async () => {
            const store = await this.store();
            await this.putBundle(store, id, bundle);
            this.diagnostic('protected credential bundle saved');
            await this.locked('profiles', async () => {
                const current = await this.profiles();
                const profile: Profile = { id, connectionId: pending.connectionId, clientId, subject: identity.sub,
                    label: identity.email ?? selected?.label ?? `ChatGPT account ${id.slice(0, 8)}`,
                    status: 'signed-in', planUsage: bundle.scopes.includes(planScope) ? 'available' : 'unavailable' };
                await this.saveProfiles([...current.filter(item => item.id !== id), profile]);
            });
        });
        this.diagnostic('account metadata saved');
    }
    private same(left: string | null, right: string): boolean {
        if (left === null) return false;
        const a = Buffer.from(left); const b = Buffer.from(right);
        return a.length === b.length && timingSafeEqual(a, b);
    }
    async accessToken(connectionId: string, registrationId: string): Promise<string> {
        await this.assertConnection(connectionId);
        return this.locked(`account-${this.validId(registrationId)}`, async () => {
            const profile = (await this.profiles()).find(item => item.id === registrationId && item.connectionId === connectionId);
            if (!profile || profile.status !== 'signed-in') throw failed('account not authorized');
            const store = await this.store();
            let bundle = await this.getBundle(store, registrationId);
            if (!bundle || bundle.subject !== profile.subject || bundle.clientId !== profile.clientId ||
                !bundle.scopes.includes(planScope)) throw failed('plan use not authorized');
            if (this.now() >= bundle.expiresAt - 60000 && this.now() >= bundle.earliestRefreshAt) {
                const token = await this.http(`${this.issuer}/api/accounts/oauth/token`, new URLSearchParams({
                    grant_type: 'refresh_token', client_id: profile.clientId, refresh_token: bundle.refreshToken, resource
                }));
                if (token.id_token) {
                    const identity = await this.identity(token.id_token as string, profile.clientId);
                    if (identity.sub !== profile.subject) throw failed('wrong account');
                }
                const replacement = this.tokenBundle(token, profile.subject, profile.clientId, bundle.idToken);
                await this.putBundle(store, registrationId, replacement);
                bundle = replacement;
                if (!replacement.scopes.includes(planScope)) {
                    await this.locked('profiles', async () => {
                        await this.saveProfiles((await this.profiles()).map(item => item.id === registrationId ?
                            { ...item, planUsage: 'unavailable' } : item));
                    });
                    throw failed('plan use not authorized');
                }
            }
            if (this.now() >= bundle.expiresAt) throw failed('access token expired');
            return bundle.accessToken;
        });
    }
    private validId(id: string): string {
        if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) throw failed('invalid registration');
        return id;
    }
    async signOut(connectionId: string, registrationId: string): Promise<{ revocationConfirmed: boolean }> {
        await this.assertConnection(connectionId);
        return this.locked(`account-${this.validId(registrationId)}`, () => this.signOutLocked(connectionId, registrationId));
    }
    private async signOutLocked(connectionId: string, registrationId: string): Promise<{ revocationConfirmed: boolean }> {
        const profile = (await this.profiles()).find(item => item.id === registrationId && item.connectionId === connectionId);
        if (!profile) throw failed('unknown registration');
        const store = await this.store();
        const bundle = await this.getBundle(store, registrationId);
        let revocationConfirmed = !bundle;
        if (bundle) {
            for (let attempt = 0; attempt < 3; attempt++) {
                let retry = true;
                try {
                    const config = await this.http(`${this.issuer}/.well-known/openid-configuration`);
                    if (typeof config.revocation_endpoint !== 'string' || !config.revocation_endpoint.startsWith(`${this.issuer}/`))
                        throw failed('invalid revocation endpoint');
                    const response = await this.fetcher(config.revocation_endpoint, { method: 'POST', redirect: 'error',
                        headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({
                            token: bundle.refreshToken, token_type_hint: 'refresh_token', client_id: profile.clientId
                        }) });
                    revocationConfirmed = response.ok;
                    retry = response.status >= 500;
                } catch { revocationConfirmed = false; }
                if (revocationConfirmed || !retry) break;
                if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
            }
        }
        await this.removeBundle(store, registrationId);
        await this.locked('profiles', async () => {
            await this.saveProfiles((await this.profiles()).map(item => item.id === registrationId ?
                { ...item, status: 'signed-out' } : item));
        });
        return { revocationConfirmed };
    }
    async disconnect(connectionId: string, registrationId: string): Promise<{ revocationConfirmed: boolean }> {
        await this.assertConnection(connectionId);
        return this.locked(`account-${this.validId(registrationId)}`, async () => {
            const result = await this.signOutLocked(connectionId, registrationId);
            await this.locked('profiles', async () => {
                await this.saveProfiles((await this.profiles()).filter(item => item.id !== registrationId));
            });
            return result;
        });
    }
}
