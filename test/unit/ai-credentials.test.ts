import assert from 'node:assert/strict';
import test from 'node:test';
import { AICredentialManager } from '../../packages/theia-extension/lib/node/ai-credential-manager.js';
import { AICredentialBackend } from '../../packages/theia-extension/lib/node/ai-credential-backend.js';

const connection = (type: 'gemini' | 'openai' | 'openai-compatible' = 'gemini', credential?: { source: 'secure' | 'environment' | 'session'; status: 'unknown'; name?: string }) =>
    ({ version: 1 as const, id: 'connection-1', alias: 'Hosted', lifecycle: 'enabled' as const,
        config: type === 'openai-compatible' ? { type, endpoint: 'https://example.org' } : { type }, credential });

function fixture(credential?: ReturnType<typeof connection>['credential']) {
    const values = new Map<string, string>();
    const secure = {
        async findCredentials() { return []; },
        async getPassword(service: string, account: string) { return values.get(`${service}:${account}`); },
        async setPassword(service: string, account: string, secret: string) { values.set(`${service}:${account}`, secret); },
        async deletePassword(service: string, account: string) { values.delete(`${service}:${account}`); }
    };
    const registry = { async read() { return { connections: [connection('gemini', credential)] }; } };
    const environment = { GEMINI_API_KEY: 'environment-secret', OTHER_KEY: 'not-an-adapter-key' };
    const manager = () => new AICredentialManager(registry as never, async () => secure, environment);
    return { manager, values, registry, secure, environment };
}

test('environment declaration, precedence, replace/remove, restart and redacted notifications', async () => {
    const { manager: create, registry, values } = fixture();
    const manager = create();
    const events: string[] = [];
    const backend = new AICredentialBackend(manager, { notifyAICredentialChanged(id) { events.push(id); } });
    assert.equal((await backend.status('connection-1')).effectiveSource, 'environment');
    assert.deepEqual((await backend.status('connection-1')).sources[0],
        { source: 'environment', name: 'GEMINI_API_KEY', status: 'available' });
    assert.equal(await manager.readForExecution('connection-1'), 'environment-secret');
    await backend.replace('connection-1', 'secure', 'secure-secret');
    assert.equal((await backend.status('connection-1')).effectiveSource, 'secure');
    await backend.replace('connection-1', 'session', 'session-secret');
    assert.equal((await backend.status('connection-1')).effectiveSource, 'session');
    assert.equal(await manager.readForExecution('connection-1'), 'session-secret');
    const response = JSON.stringify(await backend.status('connection-1'));
    assert.doesNotMatch(response, /environment-secret|secure-secret|session-secret|OTHER_KEY/);
    assert.deepEqual(events, ['connection-1', 'connection-1']);
    assert.doesNotMatch(JSON.stringify(await registry.read()), /environment-secret|secure-secret|session-secret/);
    assert.equal(await create().readForExecution('connection-1'), 'secure-secret');
    await backend.remove('connection-1', 'session');
    assert.equal((await backend.status('connection-1')).effectiveSource, 'secure');
    await backend.remove('connection-1', 'secure');
    assert.equal(values.size, 0);
    assert.equal((await backend.status('connection-1')).effectiveSource, 'environment');
    assert.deepEqual(events, Array(4).fill('connection-1'));
    backend.dispose();
});

test('selected sources cannot silently fall back; secure store fails closed and errors redact secrets', async () => {
    const { manager: create, registry } = fixture({ source: 'secure', status: 'unknown' });
    const unavailable = new AICredentialManager(registry as never, async () => undefined, { GEMINI_API_KEY: 'environment-secret' });
    assert.equal((await unavailable.status('connection-1')).effectiveSource, undefined);
    assert.equal((await unavailable.status('connection-1')).sources.at(-1)?.status, 'unavailable');
    await assert.rejects(unavailable.replace('connection-1', 'secure', 'super-secret'), /OS secure storage unavailable/);
    await assert.rejects(unavailable.remove('connection-1', 'secure'), /OS secure storage unavailable/);
    await assert.rejects(unavailable.readForExecution('connection-1'), /OS secure storage unavailable/);
    const broken = new AICredentialManager(registry as never, async () => ({
        async findCredentials() { throw Error('super-secret'); },
        async getPassword() { throw Error('super-secret'); },
        async setPassword() { throw Error('super-secret'); },
        async deletePassword() { throw Error('super-secret'); }
    }), {});
    assert.equal((await broken.status('connection-1')).sources.at(-1)?.status, 'unavailable');
    await assert.rejects(broken.replace('connection-1', 'secure', 'super-secret'), error => {
        assert.doesNotMatch(String(error), /super-secret/); return true;
    });
    assert.equal((await create().status('connection-1')).effectiveSource, undefined);
});

test('environment selection uses only adapter declarations, not registry-provided names or session values', async () => {
    const { manager: create } = fixture({ source: 'environment', status: 'unknown', name: 'OTHER_KEY' });
    const manager = create();
    await manager.replace('connection-1', 'session', 'session-secret');
    assert.equal((await manager.status('connection-1')).effectiveSource, 'environment');
    assert.equal(await manager.readForExecution('connection-1'), 'environment-secret');
    assert.equal((await manager.status('connection-1')).sources[0].name, 'GEMINI_API_KEY');
    assert.doesNotMatch(JSON.stringify(await manager.status('connection-1')), /OTHER_KEY|session-secret/);
});

test('legacy Gemini handoff requires explicit secure migration and never reveals a credential', async () => {
    const { manager: create, secure, values } = fixture();
    await secure.setPassword('Dope Gemini', 'AI Studio API key', 'legacy-secret');
    const manager = create();
    assert.equal((await manager.status('connection-1')).effectiveSource, 'environment');
    assert.equal(await manager.reuseSoftwareMapGemini('connection-1'), true);
    assert.equal(await manager.reuseSoftwareMapGemini('connection-1'), false);
    assert.equal(await manager.readForExecution('connection-1'), 'legacy-secret');
    assert.doesNotMatch(JSON.stringify(await manager.status('connection-1')), /legacy-secret/);
    assert.equal(values.get('Dope Gemini:AI Studio API key'), 'legacy-secret');
    await manager.retireSoftwareMapGemini('connection-1');
    assert.equal(values.has('Dope Gemini:AI Studio API key'), false);
    assert.equal(await manager.readForExecution('connection-1'), 'legacy-secret');
});

test('legacy credential cannot be retired if a distinct central secret is present', async () => {
    const { manager: create, secure, values } = fixture();
    await secure.setPassword('Dope Gemini', 'AI Studio API key', 'legacy-secret');
    await secure.setPassword('Dope AI Connections', 'connection-1', 'different-secret');
    const manager = create();
    assert.equal(await manager.reuseSoftwareMapGemini('connection-1'), false);
    await assert.rejects(manager.retireSoftwareMapGemini('connection-1'), /retire legacy Gemini credential/);
    assert.equal(values.get('Dope Gemini:AI Studio API key'), 'legacy-secret');
});
