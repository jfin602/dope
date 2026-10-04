import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile, mkdir, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { AIRegistryStore } from '../../packages/theia-extension/lib/node/ai-registry-store.js';
import { AIRegistryBackend } from '../../packages/theia-extension/lib/node/ai-registry-backend.js';
import { ModelConnectionsRegistry } from '../../packages/theia-extension/lib/node/model-connections.js';

const create = (id: string, expectedRevision: number) => ({ version: 1 as const, expectedRevision,
    mutation: { type: 'create-connection' as const, connection: { version: 1 as const, id,
        alias: id, lifecycle: 'enabled' as const, config: { type: 'openai' as const } } } });
async function temporary(work: (directory: string) => Promise<void>): Promise<void> {
    const directory = await mkdtemp(join(tmpdir(), 'dope-ai-registry-'));
    try { await work(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}
async function child(directory: string, id: string): Promise<string> {
    const script = `const {AIRegistryStore}=require(${JSON.stringify(fileURLToPath(new URL('../../packages/theia-extension/lib/node/ai-registry-store.js', import.meta.url)))});
        const store=new AIRegistryStore(process.argv[1]); store.mutate({version:1,expectedRevision:0,
        mutation:{type:'create-connection',connection:{version:1,id:process.argv[2],alias:process.argv[2],lifecycle:'enabled',config:{type:'openai'}}}})
        .then(()=>process.stdout.write('ok'),error=>{process.stderr.write(error.message);process.exitCode=1});`;
    return new Promise((resolve, reject) => {
        const processHandle = spawn(process.execPath, ['-e', script, directory, id]);
        let output = '', error = '';
        processHandle.stdout.on('data', chunk => { output += chunk; });
        processHandle.stderr.on('data', chunk => { error += chunk; });
        processHandle.on('close', code => code === 0 ? resolve(output) : reject(new Error(error)));
    });
}

test('one-time legacy migration preserves identity and preference; copies and project changes do not change global identity', async () => {
    await temporary(async directory => {
        const legacy = { version: 1, connections: [
            { id: 'local-id', providerId: 'local', label: 'Desk', preferredModelId: 'qwen' },
            { id: 'host-id', providerId: 'openai', label: 'Hosted', preferredModelId: 'gpt' },
            { id: 'gem-id', providerId: 'gemini', label: 'Gemini' }] };
        await writeFile(join(directory, 'model-connections.json'), JSON.stringify(legacy));
        const store = new AIRegistryStore(directory);
        const migrated = await store.read();
        assert.equal(migrated.revision, 1);
        assert.deepEqual(migrated.connections.map(item => [item.id, item.alias, item.preferredModelId]),
            [['local-id', 'Desk', 'qwen'], ['host-id', 'Hosted', 'gpt'], ['gem-id', 'Gemini', undefined]]);
        assert.deepEqual(migrated.connections.map(item => item.config.type), ['local', 'openai', 'gemini']);
        await writeFile(join(directory, 'model-connections.json'), '{broken legacy bytes');
        await mkdir(join(directory, 'project-a', '.dope'), { recursive: true });
        await cp(join(directory, 'project-a'), join(directory, 'project-b'), { recursive: true });
        await rm(join(directory, 'project-a'), { recursive: true });
        assert.deepEqual(await new AIRegistryStore(directory).read(), migrated);
        assert.equal(JSON.parse(await readFile(store.path, 'utf8')).revision, 1);
        const copy = join(directory, 'copied-config');
        await mkdir(copy);
        await cp(store.path, join(copy, 'ai-registry.json'));
        const reopened = new AIRegistryStore(copy);
        assert.deepEqual(await reopened.read(), migrated);
        reopened.dispose();
        store.dispose();
    });
});

test('atomic reopen, expected revision, two processes and external events', async () => {
    await temporary(async directory => {
        const first = new AIRegistryStore(directory), second = new AIRegistryStore(directory);
        const revisions: number[] = [];
        const backend = new AIRegistryBackend(second, { notifyAIRegistryChanged(revision) { revisions.push(revision); } });
        assert.equal((await backend.list()).revision, 0);
        assert.equal((await backend.mutate(create('one', 0))).revision, 1);
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('External registry event missing')), 2000);
            const unlisten = second.onChange(snapshot => {
                if (snapshot.revision === 2) { clearTimeout(timeout); unlisten(); resolve(); }
            });
            void first.mutate(create('two', 1)).catch(reject);
        });
        assert.ok(revisions.includes(2));
        assert.deepEqual((await second.read()).connections.map(item => item.id), ['one', 'two']);
        await assert.rejects(second.mutate(create('stale', 1)), /Stale/);
        assert.equal((await second.read()).revision, 2);
        const results = await Promise.allSettled([child(directory, 'left'), child(directory, 'right')]);
        assert.equal(results.filter(result => result.status === 'rejected').length, 2);
        assert.equal((await new AIRegistryStore(directory).read()).revision, 2);
        backend.dispose(); first.dispose(); second.dispose();
    });
});

test('two independent processes racing the same revision accept exactly one', async () => {
    await temporary(async directory => {
        const results = await Promise.allSettled([child(directory, 'left'), child(directory, 'right')]);
        assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
        assert.equal(results.filter(result => result.status === 'rejected').length, 1);
        const store = new AIRegistryStore(directory);
        assert.equal((await store.read()).revision, 1);
        assert.equal((await store.read()).connections.length, 1);
        store.dispose();
    });
});

test('two processes recovering one abandoned lock cannot overwrite each other', async () => {
    await temporary(async directory => {
        await writeFile(join(directory, '.ai-registry.lock'), '999999999\n');
        const results = await Promise.allSettled([child(directory, 'left'), child(directory, 'right')]);
        assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
        const store = new AIRegistryStore(directory);
        assert.equal((await store.read()).revision, 1);
        assert.equal((await store.read()).connections.length, 1);
        store.dispose();
    });
});

test('abandoned lock recovers, while malformed and future bytes fail closed without overwrite', async () => {
    await temporary(async directory => {
        const store = new AIRegistryStore(directory);
        await writeFile(join(directory, '.ai-registry.lock'), '999999999\n');
        assert.equal((await store.mutate(create('one', 0))).revision, 1);
        for (const bytes of ['{broken', JSON.stringify({ version: 2, revision: 2, connections: [], models: [] })]) {
            await writeFile(store.path, bytes);
            await assert.rejects(store.read(), /Corrupt or unsupported/);
            await assert.rejects(store.mutate(create('two', 1)), /Corrupt or unsupported/);
            assert.equal(await readFile(store.path, 'utf8'), bytes);
        }
        await rm(store.path);
        await assert.rejects(store.read(), /Missing initialized/);
        await assert.rejects(store.mutate(create('two', 0)), /Missing initialized/);
        store.dispose();
    });
});

test('unrecognized or corrupt legacy providers do not initialize or overwrite the legacy file', async () => {
    for (const legacy of ['{bad', JSON.stringify({ version: 1, connections: [
        { id: 'unknown', label: 'Unknown', providerId: 'future' }] })]) {
        await temporary(async directory => {
            const path = join(directory, 'model-connections.json');
            await writeFile(path, legacy);
            const store = new AIRegistryStore(directory);
            await assert.rejects(store.read(), /Corrupt or unsupported legacy/);
            assert.equal(await readFile(path, 'utf8'), legacy);
            await assert.rejects(readFile(store.path), { code: 'ENOENT' });
            store.dispose();
        });
    }
});

test('default registry resolves OS-user configuration without a project handle', async () => {
    await temporary(async directory => {
        const original = process.env.XDG_CONFIG_HOME;
        try {
            process.env.XDG_CONFIG_HOME = directory;
            const store = new AIRegistryStore();
            assert.equal(store.path, join(directory, 'dope', 'ai-registry.json'));
            assert.equal((await store.read()).revision, 0);
            assert.equal((await store.mutate(create('global', 0))).connections[0].id, 'global');
            store.dispose();
        } finally {
            if (original === undefined) delete process.env.XDG_CONFIG_HOME;
            else process.env.XDG_CONFIG_HOME = original;
        }
    });
});

test('legacy Chat mutations join global revision authority and reject stale writers', async () => {
    await temporary(async directory => {
        const store = new AIRegistryStore(directory);
        const first = new ModelConnectionsRegistry(undefined, store);
        const second = new ModelConnectionsRegistry(undefined, new AIRegistryStore(directory));
        const before = await first.list();
        assert.equal(before.revision, 0);
        const saved = await first.upsert({ id: 'one', providerId: 'openai', label: 'Original', preferredModelId: 'gpt' }, before.revision);
        assert.equal(saved.revision, 1);
        await assert.rejects(second.upsert({ id: 'two', providerId: 'gemini', label: 'Other' }, 0), /Stale/);
        assert.equal((await second.list()).connections[0].preferredModelId, 'gpt');
        assert.equal((await second.setPreferred({ connectionId: 'one', modelId: 'new-model' }, 1)).revision, 2);
        assert.equal((await first.list()).connections[0].preferredModelId, 'new-model');
        store.dispose();
    });
});
