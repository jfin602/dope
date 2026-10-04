import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import type { AIRolePolicy, AIRolePolicyEntry } from '../../packages/ai/lib/index.js';
import { AIRegistryStore } from '../../packages/theia-extension/lib/node/ai-registry-store.js';
import { AIRolePolicyStore } from '../../packages/theia-extension/lib/node/ai-role-policy-store.js';
import { AIRolePolicyBackend } from '../../packages/theia-extension/lib/node/ai-role-policy-backend.js';

async function temporary(work: (directory: string) => Promise<void>): Promise<void> {
    const directory = await mkdtemp(join(tmpdir(), 'dope-role-policy-'));
    try { await work(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}
const exact = (connectionId: string, modelId: string): AIRolePolicyEntry =>
    ({ type: 'exact', target: { connectionId, modelId } });
const request = (policy: AIRolePolicy, expectedRevision: number) =>
    ({ version: 1 as const, expectedRevision, policy });
async function child(directory: string, roleId: string): Promise<void> {
    const script = `const {AIRolePolicyStore}=require(${JSON.stringify(fileURLToPath(new URL('../../packages/theia-extension/lib/node/ai-role-policy-store.js', import.meta.url)))});
        const store=new AIRolePolicyStore(process.argv[1]); store.read().then(snapshot=>store.mutate({version:1,expectedRevision:0,
        policy:{...snapshot.policies.find(policy=>policy.roleId===process.argv[2]),preferred:{type:'exact',target:{connectionId:'c',modelId:'m'}}}}))
        .then(()=>process.stdout.write('ok'),error=>{process.stderr.write(error.message);process.exitCode=1});`;
    await new Promise<void>((resolve, reject) => {
        const processHandle = spawn(process.execPath, ['-e', script, directory, roleId]);
        let error = '';
        processHandle.stderr.on('data', chunk => { error += chunk; });
        processHandle.on('close', code => code === 0 ? resolve() : reject(new Error(error)));
    });
}

test('five unconfigured global roles, ordered edits and independent revision', async () => {
    await temporary(async directory => {
        const store = new AIRolePolicyStore(directory);
        const initial = await store.read();
        assert.equal(initial.revision, 0);
        assert.deepEqual(initial.policies.map(policy => policy.roleId),
            ['interactive', 'deep-reasoning', 'background', 'software-map', 'coding-agent']);
        assert.ok(initial.policies.every(policy => policy.preferred === undefined && !policy.fallbacks.length));
        await assert.rejects(readFile(store.path), { code: 'ENOENT' });
        const policy = { ...initial.policies[0], preferred: exact('one', 'first'),
            fallbacks: [exact('two', 'second'), exact('three', 'third')],
            preferences: ['prefer-local' as const], allowFallback: true };
        const edited = await store.mutate(request(policy, 0));
        assert.equal(edited.revision, 1);
        assert.deepEqual(edited.policies[0].fallbacks.map(entry => entry.type === 'exact' && entry.target.connectionId),
            ['two', 'three']);
        assert.deepEqual((await new AIRolePolicyStore(directory).read()).policies[0], edited.policies[0]);
        await assert.rejects(store.mutate(request(policy, 0)), /Stale/);
        await store.mutate(request({ ...policy, fallbacks: [...policy.fallbacks].reverse(),
            hard: { ...policy.hard, locality: 'local-only' } }, 1));
        assert.deepEqual((await store.read()).policies[0].fallbacks.map(entry => entry.type === 'exact' && entry.target.connectionId),
            ['three', 'two']);
        assert.equal((await store.read()).policies[0].hard.locality, 'local-only');
        const registry = new AIRegistryStore(directory);
        await registry.mutate({ version: 1, expectedRevision: 0, mutation: { type: 'create-connection',
            connection: { version: 1, id: 'another', alias: 'Another', lifecycle: 'enabled', config: { type: 'openai' } } } });
        assert.equal((await store.read()).revision, 2);
        await mkdir(join(directory, 'project', '.dope'), { recursive: true });
        await writeFile(join(directory, 'project', '.dope', 'architecture.json'), '{}');
        assert.equal((await store.read()).revision, 2);
        registry.dispose(); store.dispose();
    });
});

test('default location is OS-user config and requires no project', async () => {
    await temporary(async directory => {
        const previous = process.env.XDG_CONFIG_HOME;
        try {
            process.env.XDG_CONFIG_HOME = directory;
            const store = new AIRolePolicyStore();
            assert.equal(store.path, join(directory, 'dope', 'ai-role-policy.json'));
            const policy = (await store.read()).policies[4];
            assert.equal((await store.mutate(request({ ...policy, preferred: exact('connection', 'model') }, 0))).revision, 1);
            store.dispose();
        } finally {
            if (previous === undefined) delete process.env.XDG_CONFIG_HOME;
            else process.env.XDG_CONFIG_HOME = previous;
        }
    });
});

test('RPC backend propagates external writes and rejects stale requests', async () => {
    await temporary(async directory => {
        const first = new AIRolePolicyStore(directory), second = new AIRolePolicyStore(directory);
        const registry = new AIRegistryStore(directory);
        const revisions: number[] = [];
        const backend = new AIRolePolicyBackend(second, registry,
            { notifyAIRolePolicyChanged(revision) { revisions.push(revision); } });
        const policy = (await backend.list()).policies[0];
        await backend.mutate(request({ ...policy, preferred: exact('c', 'm') }, 0));
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('External role event missing')), 2000);
            const unlisten = second.onChange(snapshot => {
                if (snapshot.revision === 2) { clearTimeout(timeout); unlisten(); resolve(); }
            });
            void first.mutate(request({ ...policy, preferred: exact('other', 'model') }, 1)).catch(reject);
        });
        assert.ok(revisions.includes(2));
        await assert.rejects(backend.mutate(request(policy, 1)), /Stale/);
        assert.equal((await backend.list()).revision, 2);
        backend.dispose(); registry.dispose(); first.dispose(); second.dispose();
    });
});

test('two processes race and recover an abandoned lock without lost writes', async () => {
    for (const abandoned of [false, true]) await temporary(async directory => {
        if (abandoned) await writeFile(join(directory, '.ai-role-policy.lock'), '999999999\n');
        const results = await Promise.allSettled([child(directory, 'interactive'), child(directory, 'background')]);
        assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
        assert.equal(results.filter(result => result.status === 'rejected').length, 1);
        const store = new AIRolePolicyStore(directory);
        assert.equal((await store.read()).revision, 1);
        store.dispose();
    });
});

test('known exact target retains bounded descriptor through removal and same-ID return', async () => {
    await temporary(async directory => {
        const registry = new AIRegistryStore(directory), store = new AIRolePolicyStore(directory);
        const backend = new AIRolePolicyBackend(store, registry, { notifyAIRolePolicyChanged() {} });
        await registry.mutate({ version: 1, expectedRevision: 0, mutation: { type: 'create-connection',
            connection: { version: 1, id: 'original', alias: 'Desk', lifecycle: 'enabled', config: { type: 'local',
                runtime: 'lm-studio', endpoint: 'http://127.0.0.1:1234/v1' } } } });
        const model = { version: 1 as const, connectionId: 'original', providerModelKey: 'key', label: 'Model',
            locality: 'local' as const, enabled: true, state: 'ready' as const,
            capabilities: { conversationalText: { source: 'unknown' as const }, streaming: { source: 'unknown' as const },
                structuredOutput: { source: 'unknown' as const }, toolCalling: { source: 'unknown' as const } },
            limits: { contextWindowTokens: { source: 'unknown' as const }, maxInputTokens: { source: 'unknown' as const },
                maxOutputTokens: { source: 'unknown' as const } } };
        await registry.mutate({ version: 1, expectedRevision: 1, mutation: { type: 'upsert-model', model } });
        const policy = (await backend.list()).policies[0];
        const assigned = await backend.mutate(request({ ...policy, preferred: exact('original', 'key') }, 0));
        assert.deepEqual(assigned.policies[0].preferred, { ...exact('original', 'key'),
            lastKnown: { connectionLabel: 'Desk', modelLabel: 'Model', locality: 'local' } });
        await registry.mutate({ version: 1, expectedRevision: 2, mutation: { type: 'set-model-enabled',
            connectionId: 'original', providerModelKey: 'key', enabled: false } });
        assert.deepEqual((await backend.list()).policies[0].preferred, assigned.policies[0].preferred);
        await registry.mutate({ version: 1, expectedRevision: 3, mutation: { type: 'upsert-model',
            model: { ...model, state: 'unavailable' } } });
        assert.deepEqual((await backend.list()).policies[0].preferred, assigned.policies[0].preferred);
        await registry.mutate({ version: 1, expectedRevision: 4, mutation: { type: 'remove-connection', id: 'original' } });
        assert.equal((await backend.list()).revision, 1);
        const retained = await backend.mutate(request({ ...assigned.policies[0], fallbacks: [exact('other', 'key')] }, 1));
        assert.deepEqual(retained.policies[0].preferred, assigned.policies[0].preferred);
        await registry.mutate({ version: 1, expectedRevision: 5, mutation: { type: 'create-connection',
            connection: { version: 1, id: 'replacement', alias: 'Desk', lifecycle: 'enabled',
                config: { type: 'openai' } } } });
        assert.equal((await backend.list()).policies[0].preferred?.type === 'exact' &&
            (await backend.list()).policies[0].preferred.target.connectionId, 'original');
        await registry.mutate({ version: 1, expectedRevision: 6, mutation: { type: 'create-connection',
            connection: { version: 1, id: 'original', alias: 'Desk', lifecycle: 'enabled',
                config: { type: 'openai' } } } });
        await registry.mutate({ version: 1, expectedRevision: 7, mutation: { type: 'upsert-model', model } });
        assert.equal((await backend.list()).policies[0].preferred?.type === 'exact' &&
            (await backend.list()).policies[0].preferred.target.modelId, 'key');
        assert.ok((await registry.read()).models.some(candidate => candidate.connectionId === 'original' &&
            candidate.providerModelKey === 'key'));
        assert.equal((await backend.list()).revision, 2);
        backend.dispose(); registry.dispose(); store.dispose();
    });
});

test('corrupt, future and missing initialized policy fail closed without rewrite', async () => {
    await temporary(async directory => {
        const store = new AIRolePolicyStore(directory);
        const policy = (await store.read()).policies[0];
        await store.mutate(request(policy, 0));
        for (const bytes of ['{broken', JSON.stringify({ version: 2, revision: 4, policies: [] })]) {
            await writeFile(store.path, bytes);
            await assert.rejects(store.read(), /Corrupt or unsupported/);
            await assert.rejects(store.mutate(request(policy, 1)), /Corrupt or unsupported/);
            assert.equal(await readFile(store.path, 'utf8'), bytes);
        }
        await rm(store.path);
        await assert.rejects(store.read(), /Missing initialized/);
        await assert.rejects(store.mutate(request(policy, 1)), /Missing initialized/);
        store.dispose();
    });
});
