import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { PlanningStore } from '../../packages/planning/lib/node/planning-store.js';
import { PlanningBackend } from '../../packages/theia-extension/lib/node/planning-backend.js';
import { ProjectMindStore } from '../../packages/project-intelligence/lib/node/project-mind-store.js';

const plan = (links: unknown[] = []) => ({ type: 'plan.create', id: randomUUID(), title: 'Plan', objective: '', context: '', links });
const artifact = (id = randomUUID()) => ({ type: 'note', schemaVersion: 2, id, title: 'Note', body: '',
    status: 'active', provenance: 'developer', createdAt: '2026-09-28T12:00:00.000Z',
    updatedAt: '2026-09-28T12:00:00.000Z', archivedAt: null, links: [] });

async function folders(run: (first: string, second: string) => Promise<void>) {
    const parent = await fs.mkdtemp(join(tmpdir(), 'dope-planning-'));
    const first = join(parent, 'first'), second = join(parent, 'second');
    await fs.mkdir(first); await fs.mkdir(second);
    try { await run(first, second); }
    finally { await fs.rm(parent, { recursive: true, force: true }); }
}

async function mindAt(root: string, id = randomUUID()) {
    const mind = new ProjectMindStore();
    const snapshot = await mind.mutate(root, 0, { type: 'create', artifact: artifact(id) } as never);
    return { mind, snapshot, id };
}

test('missing identity stays read-only; distinct roots retain separate canonical identities and revisions', async () => folders(async (first, second) => {
    const store = new PlanningStore();
    const backend = new PlanningBackend(store, new ProjectMindStore(), { notifyPlanningChanged: () => {} });
    const attached = await backend.attach(pathToFileURL(first).toString());
    assert.equal(attached.prerequisite, 'project-mind');
    assert.equal(attached.snapshot, undefined);
    assert.deepEqual(await fs.readdir(first), []);
    await assert.rejects(backend.mutate({ projectHandle: attached.projectHandle, expectedRevision: 0, operation: plan() as never }), /prerequisite/);
    assert.deepEqual(await fs.readdir(first), []);
    await assert.rejects(store.mutate(first, '', 0, plan() as never), /identity required/);
    assert.deepEqual(await fs.readdir(first), []);
    await assert.rejects(backend.attach(pathToFileURL(second).toString()), /different/);
    const firstMind = await mindAt(first);
    const secondMind = await mindAt(second);
    assert.notEqual(firstMind.snapshot.projectId, secondMind.snapshot.projectId);
    const ready = await backend.attach(pathToFileURL(first).toString());
    assert.equal(ready.prerequisite, undefined);
    const saved = await backend.mutate({ projectHandle: ready.projectHandle, expectedRevision: 0, operation: plan() as never });
    assert.equal(saved.snapshot.projectId, firstMind.snapshot.projectId);
    assert.equal(saved.snapshot.revision, 1);
    assert.equal(saved.snapshot.history.length, 1);
    assert.equal(JSON.parse(await fs.readFile(join(first, '.dope', 'planning.json'), 'utf8')).projectId, firstMind.snapshot.projectId);
    assert.equal(await store.read(second), undefined);
    const other = new PlanningBackend(store, secondMind.mind, { notifyPlanningChanged: () => {} });
    const otherHandle = (await other.attach(pathToFileURL(second).toString())).projectHandle;
    assert.equal((await other.mutate({ projectHandle: otherHandle, expectedRevision: 0, operation: plan() as never })).snapshot.projectId, secondMind.snapshot.projectId);
    await assert.rejects(backend.mutate({ projectHandle: ready.projectHandle, expectedRevision: 0, operation: plan() as never }), /Stale/);
    backend.dispose(); other.dispose();
}));

test('identity mismatch, corrupt and future schemas fail closed without changing either store', async () => folders(async (first) => {
    const { mind, snapshot } = await mindAt(first);
    const store = new PlanningStore();
    const backend = new PlanningBackend(store, mind, { notifyPlanningChanged: () => {} });
    const handle = (await backend.attach(pathToFileURL(first).toString())).projectHandle;
    await backend.mutate({ projectHandle: handle, expectedRevision: 0, operation: plan() as never });
    const file = join(first, '.dope', 'planning.json');
    const good = await fs.readFile(file, 'utf8');
    await fs.writeFile(file, JSON.stringify({ ...JSON.parse(good), projectId: randomUUID() }));
    await assert.rejects(backend.read(handle), /identity mismatch/);
    await assert.rejects(backend.mutate({ projectHandle: handle, expectedRevision: 1, operation: plan() as never }), /identity mismatch/);
    assert.equal((await mind.read(first))?.projectId, snapshot.projectId);
    for (const value of ['{', JSON.stringify({ ...JSON.parse(good), schemaVersion: 2 })]) {
        await fs.writeFile(file, value);
        await assert.rejects(backend.attach(pathToFileURL(first).toString()), /Corrupt or unsupported/);
        await assert.rejects(backend.mutate({ projectHandle: handle, expectedRevision: 1, operation: plan() as never }), /Corrupt or unsupported/);
        assert.equal(await fs.readFile(file, 'utf8'), value);
    }
    backend.dispose();
}));

test('independent process holds lock; abandoned lock is never stolen', async () => folders(async (first) => {
    const { snapshot } = await mindAt(first);
    const store = new PlanningStore();
    const lock = join(first, '.dope', 'planning.lock');
    const child = spawn(process.execPath, ['-e', `const fs=require('fs'); fs.openSync(process.argv[1], 'wx'); console.log('locked'); setInterval(()=>{},1000)`, lock], { stdio: ['ignore', 'pipe', 'pipe'] });
    try {
        await new Promise<void>((resolve, reject) => {
            child.stdout.once('data', () => resolve()); child.once('error', reject); child.once('exit', code => reject(new Error(`child exited ${code}`)));
        });
        await assert.rejects(store.mutate(first, snapshot.projectId, 0, plan() as never), /locked/);
    } finally { child.kill(); await new Promise(resolve => child.once('exit', resolve)); }
    await assert.rejects(store.mutate(first, snapshot.projectId, 0, plan() as never), /locked/);
    assert.equal(await store.read(first), undefined);
    await fs.rm(lock);
    assert.equal((await store.mutate(first, snapshot.projectId, 0, plan() as never)).snapshot.revision, 1);
}));

test('temp sync and rename errors preserve committed bytes; post-rename sync requires committed reread', async () => folders(async (first) => {
    const { snapshot } = await mindAt(first);
    const file = join(first, '.dope', 'planning.json');
    const store = new PlanningStore();
    await store.mutate(first, snapshot.projectId, 0, plan() as never);
    const original = await fs.readFile(file, 'utf8');
    const fail = (stage: 'temp' | 'rename' | 'directory') => new PlanningStore({ ...fs,
        open: async (path: Parameters<typeof fs.open>[0], ...args: unknown[]) => {
            const handle = await (fs.open as (...values: unknown[]) => ReturnType<typeof fs.open>)(path, ...args);
            if (stage === 'temp' && String(path).endsWith('.tmp') || stage === 'directory' && path === join(first, '.dope')) {
                return Object.assign(handle, { sync: async () => { throw new Error(`${stage} sync failed`); } });
            }
            return handle;
        },
        rename: async (...args: Parameters<typeof fs.rename>) => {
            if (stage === 'rename') throw new Error('rename failed');
            return fs.rename(...args);
        }
    } as typeof fs);
    for (const stage of ['temp', 'rename'] as const) {
        await assert.rejects(fail(stage).mutate(first, snapshot.projectId, 1, plan() as never), new RegExp(stage));
        assert.equal(await fs.readFile(file, 'utf8'), original);
        assert.deepEqual((await fs.readdir(join(first, '.dope'))).filter(name => name.endsWith('.tmp') || name.endsWith('.lock')), []);
    }
    await assert.rejects(fail('directory').mutate(first, snapshot.projectId, 1, plan() as never), /outcome uncertain.*re-read/);
    assert.equal((await store.read(first))?.revision, 2);
    await assert.rejects(store.mutate(first, snapshot.projectId, 1, plan() as never), /Stale/);
}));

test('file path and symlink escapes are rejected but missing targets and positive lines persist', async () => folders(async (first, second) => {
    const { snapshot } = await mindAt(first);
    const store = new PlanningStore();
    const invalid = ['/tmp/x', '../x', 'src/../x', 'https://host/x', 'C:/x', 'src\\x'];
    for (const path of invalid) await assert.rejects(store.mutate(first, snapshot.projectId, 0, plan([{ type: 'file', path }]) as never), /Invalid/);
    await fs.symlink(second, join(first, 'escape'));
    await assert.rejects(store.mutate(first, snapshot.projectId, 0, plan([{ type: 'file', path: 'escape/missing' }]) as never), /Unsafe Planning file link/);
    await assert.rejects(store.mutate(first, snapshot.projectId, 0, plan([{ type: 'file', path: 'missing', line: 0 }]) as never), /Invalid/);
    assert.equal((await store.mutate(first, snapshot.projectId, 0, plan([{ type: 'file', path: 'missing/later.ts', line: 12 }]) as never)).snapshot.revision, 1);
    await fs.symlink(second, join(first, 'missing'));
    await assert.rejects(store.read(first), /Unsafe Planning file link/);
}));

test('new artifact links validate current Project Mind including archived; events stop on disposal', async () => folders(async (first) => {
    const { mind, snapshot, id } = await mindAt(first);
    const store = new PlanningStore();
    const events: number[] = [];
    const backend = new PlanningBackend(store, mind, { notifyPlanningChanged: event => events.push(event.revision) });
    const handle = (await backend.attach(pathToFileURL(first).toString())).projectHandle;
    const unknown = randomUUID();
    await assert.rejects(backend.mutate({ projectHandle: handle, expectedRevision: 0, operation: plan([{ type: 'artifact', id: unknown }]) as never }), /Unknown/);
    assert.equal(await store.read(first), undefined);
    await mind.mutate(first, 1, { type: 'archive', artifactId: id, archived: true });
    const saved = await backend.mutate({ projectHandle: handle, expectedRevision: 0, operation: plan([{ type: 'artifact', id }]) as never });
    assert.deepEqual(events, [1]);
    assert.equal(saved.snapshot.projectId, snapshot.projectId);
    const secondPlan = plan([{ type: 'artifact', id }]);
    assert.equal((await backend.mutate({ projectHandle: handle, expectedRevision: 1, operation: secondPlan as never })).snapshot.revision, 2);
    await assert.rejects(backend.mutate({ projectHandle: randomUUID(), expectedRevision: 1, operation: plan() as never }), /handle/);
    backend.dispose();
    await assert.rejects(backend.read(handle), /handle/);
    await store.mutate(first, snapshot.projectId, 2, plan() as never);
    assert.deepEqual(events, [1, 2]);
}));

test('symlinked storage entries and changed Project Mind identity fail closed', async () => folders(async (first, second) => {
    const { mind, snapshot } = await mindAt(first);
    const store = new PlanningStore();
    const backend = new PlanningBackend(store, mind, { notifyPlanningChanged: () => {} });
    const handle = (await backend.attach(pathToFileURL(first).toString())).projectHandle;
    await store.mutate(first, snapshot.projectId, 0, plan() as never);
    const file = join(first, '.dope', 'planning.json');
    const bytes = await fs.readFile(file);
    await fs.rename(file, join(first, '.dope', 'saved.json'));
    await fs.symlink(join(first, '.dope', 'saved.json'), file);
    await assert.rejects(backend.read(handle), /Unsafe Planning path/);
    await assert.rejects(backend.mutate({ projectHandle: handle, expectedRevision: 1, operation: plan() as never }), /Unsafe Planning path/);
    await fs.rm(file);
    await fs.rename(join(first, '.dope', 'saved.json'), file);
    await fs.symlink(join(second, 'lock'), join(first, '.dope', 'planning.lock'));
    await assert.rejects(backend.mutate({ projectHandle: handle, expectedRevision: 1, operation: plan() as never }), /locked/);
    await fs.rm(join(first, '.dope', 'planning.lock'));
    const mindFile = join(first, '.dope', 'project-mind.json');
    const currentMind = JSON.parse(await fs.readFile(mindFile, 'utf8'));
    await fs.writeFile(mindFile, JSON.stringify({ ...currentMind, projectId: randomUUID() }));
    await assert.rejects(backend.read(handle), /identity changed/);
    await assert.rejects(backend.mutate({ projectHandle: handle, expectedRevision: 1, operation: plan() as never }), /identity changed/);
    assert.deepEqual(await fs.readFile(file), bytes);
    backend.dispose();
}));

test('local canonical folders only; symlinked .dope directory is never followed', async () => folders(async (first, second) => {
    const store = new PlanningStore();
    await assert.rejects(store.root('https://example.com/project'), /local folder/);
    await assert.rejects(store.root('file://remote/project'), /local folder/);
    await fs.symlink(second, join(first, '.dope'));
    await assert.rejects(store.read(await store.root(pathToFileURL(first).toString())), /Unsafe Planning directory/);
    await assert.rejects(store.mutate(first, randomUUID(), 0, plan() as never), /Unsafe Planning directory/);
    assert.deepEqual(await fs.readdir(second), []);
}));
