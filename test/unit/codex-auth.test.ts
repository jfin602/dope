import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { CodexAuthManager } from '../../packages/theia-extension/lib/node/codex-auth-manager.js';
import { CodexAuthBackend } from '../../packages/theia-extension/lib/node/codex-auth-backend.js';

const issuer = 'https://auth.example.test';
const clientId = 'oaiapp_test_client';
const planScope = 'openid offline_access chatgpt.tokens.use.direct';

async function fixture(t: import('node:test').TestContext) {
    const directory = await mkdtemp(join(tmpdir(), 'dope-codex-auth-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const secrets = new Map<string, string>();
    const secureStore = async () => ({
        async getPassword(_service: string, account: string) { return secrets.get(account); },
        async setPassword(_service: string, account: string, secret: string) { secrets.set(account, secret); },
        async deletePassword(_service: string, account: string) { return secrets.delete(account); }
    });
    const registry = { async read() { return { connections: [
        { id: 'codex', config: { type: 'codex' } }, { id: 'other', config: { type: 'codex' } }
    ] }; } };
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const key = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' };
    let clock = Date.now();
    let authorization: URL | undefined;
    let receiveCallback: (url: URL) => Promise<void>;
    let claims: Record<string, unknown> = {};
    let grantedScope = planScope;
    let issuedClient = clientId;
    let subject = 'subject-one';
    let corruptSignature = false;
    let exchanges = 0;
    let refreshes = 0;
    let revocations = 0;
    let revocationFailures = 0;
    let earliestRefresh = 0;
    let refreshToken = 'refresh-0';
    let holdRefresh: (() => Promise<void>) | undefined;
    const token = (nonce: string, audience: string) => {
        const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-key' })).toString('base64url');
        const payload = Buffer.from(JSON.stringify({ iss: issuer, aud: audience, sub: subject,
            exp: Math.floor(clock / 1000) + 3600, nonce, email: 'same@example.test', ...claims })).toString('base64url');
        return `${header}.${payload}.${corruptSignature ? 'invalid-signature' :
            sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), privateKey).toString('base64url')}`;
    };
    const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
        assert.equal(init?.redirect, 'error');
        const url = String(input);
        if (url.endsWith('/.well-known/openid-configuration')) return Response.json({ issuer, jwks_uri: `${issuer}/jwks`, revocation_endpoint: `${issuer}/revoke` });
        if (url.endsWith('/jwks')) return Response.json({ keys: [key] });
        if (url.endsWith('/revoke')) {
            revocations++;
            return new Response(null, { status: revocations <= revocationFailures ? 503 : 200 });
        }
        if (url.endsWith('/api/accounts/oauth/token')) {
            const body = new URLSearchParams(init?.body as string);
            assert.equal(body.get('resource'), 'https://api.openai.com/v1');
            if (body.get('grant_type') === 'authorization_code') {
                exchanges++;
                assert.equal(body.get('redirect_uri'), authorization?.searchParams.get('redirect_uri'));
                assert.equal(createHash('sha256').update(body.get('code_verifier')!).digest('base64url'),
                    authorization?.searchParams.get('code_challenge'));
                assert.equal(body.get('client_id'), issuedClient);
                refreshToken = `refresh-${exchanges}`;
                return Response.json({ access_token: `access-${exchanges}`, refresh_token: refreshToken,
                    id_token: token(authorization!.searchParams.get('nonce')!, body.get('client_id')!),
                    token_type: 'Bearer', expires_in: 120, scope: grantedScope, earliest_refresh_at: earliestRefresh });
            }
            assert.equal(body.get('grant_type'), 'refresh_token');
            assert.equal(body.get('scope'), null);
            assert.equal(body.get('client_id'), issuedClient);
            if (body.get('refresh_token') !== refreshToken) return Response.json({ error: 'invalid_grant' }, { status: 400 });
            if (holdRefresh) await holdRefresh();
            refreshes++;
            refreshToken = `rotated-${refreshes}`;
            return Response.json({ access_token: `new-access-${refreshes}`, refresh_token: refreshToken,
                token_type: 'Bearer', expires_in: 3600, scope: grantedScope, earliest_refresh_at: 0 });
        }
        throw Error('unexpected endpoint');
    };
    const manager = () => new CodexAuthManager(registry as never, { directory, issuer,
        fetcher: fetcher as typeof globalThis.fetch, secureStore, now: () => clock,
        openBrowser: async url => { authorization = new URL(url); },
        callbackListener: async callback => {
            receiveCallback = callback;
            return { redirectUri: 'http://127.0.0.1:11234/auth/callback', server: {
                close() { return this as never; }, once() { return this as never; }
            } as never };
        } });
    async function callback(params: Record<string, string> = {}) {
        const url = new URL(authorization!.searchParams.get('redirect_uri')!);
        for (const [name, value] of Object.entries({ state: authorization!.searchParams.get('state')!,
            code: 'authorization-code', client_id: issuedClient, ...params })) url.searchParams.set(name, value);
        return receiveCallback(url);
    }
    async function login(auth = manager(), registrationId?: string) {
        await auth.signIn('codex', registrationId);
        await callback();
        return (await auth.list('codex')).at(-1)!;
    }
    return { directory, secrets, manager, login, callback, get authorization() { return authorization!; },
        set claims(value: Record<string, unknown>) { claims = value; },
        set grantedScope(value: string) { grantedScope = value; },
        set issuedClient(value: string) { issuedClient = value; },
        set subject(value: string) { subject = value; },
        set corruptSignature(value: boolean) { corruptSignature = value; },
        set revocationFailures(value: number) { revocationFailures = value; },
        set earliestRefresh(value: number) { earliestRefresh = value; },
        set clock(value: number) { clock = value; }, get clock() { return clock; },
        set holdRefresh(value: () => Promise<void>) { holdRefresh = value; },
        get exchanges() { return exchanges; }, get refreshes() { return refreshes; }, get revocations() { return revocations; } };
}

test('dynamic sign-in persists a stable host ID, issued client and token-free projections', async t => {
    const environment = await fixture(t);
    const auth = environment.manager();
    await auth.signIn('codex');
    assert.equal(environment.authorization.searchParams.get('client_id'), 'dynamic_agent_client');
    assert.equal(environment.authorization.searchParams.get('agent_name_hint'), 'Dope');
    assert.equal(environment.authorization.searchParams.get('code_challenge_method'), 'S256');
    const host = environment.authorization.searchParams.get('ext_agent_host_id');
    assert.match(host!, /^urn:uuid:/);
    const profile = (await new CodexAuthBackend(auth).list('codex'))[0];
    assert.equal(profile, undefined);
    await environment.callback();
    const account = (await auth.list('codex'))[0];
    assert.equal(account.clientId, clientId);
    assert.equal(account.planUsage, 'available');
    assert.equal(await auth.accessToken('codex', account.id), 'access-1');
    assert.equal(await environment.manager().hostId(), host);
    const metadata = await readFile(join(environment.directory, 'codex-accounts.json'), 'utf8');
    assert.doesNotMatch(metadata + JSON.stringify(account), /access-1|refresh-1|eyJhbGci/);
    assert.match([...environment.secrets.values()][0], /refresh-1/);
    await auth.signIn('codex', account.id);
    assert.equal(environment.authorization.searchParams.get('client_id'), clientId);
    assert.equal(environment.authorization.searchParams.has('agent_name_hint'), false);
    assert.equal(environment.authorization.searchParams.get('ext_agent_host_id'), host);
    assert.ok(environment.authorization.searchParams.get('id_token_hint'));
    await environment.callback();
    assert.equal((await auth.list('codex')).length, 1);
});

test('callback state and issued client mismatch fail before token exchange', async t => {
    const environment = await fixture(t);
    await environment.manager().signIn('codex');
    await assert.rejects(environment.callback({ state: 'wrong' }));
    await assert.rejects(environment.callback({ client_id: 'dynamic_agent_client' }));
    assert.equal(environment.exchanges, 0);
    await environment.manager().signIn('codex');
    await environment.callback();
    const profile = (await environment.manager().list('codex'))[0];
    await environment.manager().signIn('codex', profile.id);
    await assert.rejects(environment.callback({ client_id: 'oaiapp_other' }));
});

test('issuer, audience, nonce and selected subject are verified before replacing credentials', async t => {
    const environment = await fixture(t);
    for (const invalid of [{ iss: 'https://wrong.test' }, { aud: 'oaiapp_wrong' },
        { aud: ['oaiapp_wrong'] }, { aud: [clientId, 42] }, { nonce: 'wrong' }, { exp: 1 }]) {
        environment.claims = invalid;
        await environment.manager().signIn('codex');
        await assert.rejects(environment.callback());
        assert.equal(environment.secrets.size, 0);
    }
    environment.claims = {};
    environment.corruptSignature = true;
    await environment.manager().signIn('codex');
    await assert.rejects(environment.callback(), /ID token verification failed/);
    environment.corruptSignature = false;
    const account = await environment.login();
    environment.subject = 'different-subject';
    await environment.manager().signIn('codex', account.id);
    await assert.rejects(environment.callback());
    assert.equal(await environment.manager().accessToken('codex', account.id), 'access-8');
});

test('ID token audience array containing the issued client ID completes sign-in', async t => {
    const environment = await fixture(t);
    environment.claims = { aud: ['another-audience', clientId] };
    const account = await environment.login();
    assert.equal(account.clientId, clientId);
    assert.equal(account.status, 'signed-in');
    assert.equal(account.planUsage, 'available');
});

test('missing plan permission cannot authorize inference; failures never expose token payloads', async t => {
    const environment = await fixture(t);
    environment.grantedScope = 'openid offline_access';
    const account = await environment.login();
    assert.equal(account.planUsage, 'unavailable');
    await assert.rejects(environment.manager().accessToken('codex', account.id), error => {
        assert.doesNotMatch(String(error), /refresh-1|access-1|eyJ/); return true;
    });
    assert.doesNotMatch(JSON.stringify(await environment.manager().list('codex')), /refresh-1|access-1|eyJ/);
});

test('two independent manager instances serialize rotating refresh and reuse the replacement', async t => {
    const environment = await fixture(t);
    const account = await environment.login();
    environment.clock += 70000;
    environment.holdRefresh = () => new Promise(resolve => setTimeout(resolve, 80));
    const [first, second] = await Promise.all([
        environment.manager().accessToken('codex', account.id), environment.manager().accessToken('codex', account.id)
    ]);
    assert.deepEqual([first, second], ['new-access-1', 'new-access-1']);
    assert.equal(environment.refreshes, 1);
    assert.match(environment.secrets.get(account.id)!, /rotated-1/);
    assert.doesNotMatch(environment.secrets.get(account.id)!, /refresh-1/);
    const replacement = JSON.parse(environment.secrets.get(account.id)!);
    environment.secrets.set(account.id, JSON.stringify({ ...replacement, refreshToken: 'refresh-1', expiresAt: 0 }));
    await assert.rejects(environment.manager().accessToken('codex', account.id), error => {
        assert.doesNotMatch(String(error), /refresh-1|rotated-1/); return true;
    });
});

test('refresh rotation is retained but inference stops if plan permission is withdrawn', async t => {
    const environment = await fixture(t);
    const account = await environment.login();
    environment.clock += 70000;
    environment.grantedScope = 'openid offline_access';
    await assert.rejects(environment.manager().accessToken('codex', account.id), /plan use not authorized/);
    assert.match(environment.secrets.get(account.id)!, /rotated-1/);
    assert.equal((await environment.manager().list('codex'))[0].planUsage, 'unavailable');
    await assert.rejects(environment.manager().accessToken('codex', account.id), /plan use not authorized/);
    assert.equal(environment.refreshes, 1);
});

test('earliest refresh is respected even at expiry', async t => {
    const environment = await fixture(t);
    environment.earliestRefresh = Math.floor((environment.clock + 180000) / 1000);
    const account = await environment.login();
    environment.clock += 125000;
    await assert.rejects(environment.manager().accessToken('codex', account.id), /access token expired/);
    assert.equal(environment.refreshes, 0);
    environment.clock += 60000;
    assert.equal(await environment.manager().accessToken('codex', account.id), 'new-access-1');
});

test('secure-store failure, sign-out, reauthorization and disconnect fail closed', async t => {
    const environment = await fixture(t);
    const unavailable = new CodexAuthManager({ async read() { return { connections: [{ id: 'codex', config: { type: 'codex' } }] }; } } as never,
        { directory: environment.directory, secureStore: async () => undefined });
    await assert.rejects(unavailable.signIn('codex'), /OS secure storage unavailable/);
    const account = await environment.login();
    assert.deepEqual(await environment.manager().signOut('codex', account.id), { revocationConfirmed: true });
    assert.equal(environment.revocations, 1);
    assert.equal(environment.secrets.size, 0);
    assert.equal((await environment.manager().list('codex'))[0].status, 'signed-out');
    await assert.rejects(environment.manager().accessToken('codex', account.id));
    assert.equal((await environment.login(environment.manager(), account.id)).id, account.id);
    await environment.manager().disconnect('codex', account.id);
    assert.equal((await environment.manager().list('codex')).length, 0);
});

test('revocation retries transient failures and clears tokens if remote confirmation fails', async t => {
    const environment = await fixture(t);
    const account = await environment.login();
    environment.revocationFailures = 3;
    assert.deepEqual(await environment.manager().signOut('codex', account.id), { revocationConfirmed: false });
    assert.equal(environment.revocations, 3);
    assert.equal(environment.secrets.size, 0);
    await assert.rejects(environment.manager().accessToken('codex', account.id));
});

test('two registrations with the same email remain independent', async t => {
    const environment = await fixture(t);
    const first = await environment.login();
    const second = await environment.login();
    assert.notEqual(first.id, second.id);
    assert.equal(first.label, second.label);
    assert.equal((await environment.manager().list('codex')).length, 2);
    assert.equal(environment.secrets.size, 2);
});
