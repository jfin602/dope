import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { ProjectMindStore } from '../../packages/project-intelligence/lib/node/project-mind-store.js';
import { ProjectMindBackend } from '../../packages/theia-extension/lib/node/project-mind-backend.js';

const now = '2026-09-28T12:00:00.000Z';
const draft = (type: string, id = randomUUID()) => ({
    id, type, schemaVersion: 2, title: type, createdAt: now, updatedAt: now,
    provenance: 'developer', archivedAt: null, links: [],
    status: { note: 'active', idea: 'captured', question: 'open', decision: 'proposed' }[type],
    ...(type === 'decision' ? { decision: 'Choice', context: 'Why', rationale: 'Reason', consequences: '', alternatives: '', revisitConditions: '' } : { body: type })
});

async function folders(run: (first: string, second: string) => Promise<void>): Promise<void> {
    const parent = await mkdtemp(join(tmpdir(), 'dope-mind-'));
    const first = join(parent, 'first'), second = join(parent, 'second');
    await mkdir(first); await mkdir(second);
    try { await run(first, second); }
    finally { await rm(parent, { recursive: true, force: true }); }
}

test('all artifact types round trip, reconstruct and reject stale revisions and wrong handles', async () => folders(async (first, second) => {
    const store = new ProjectMindStore();
    const events: string[] = [];
    const backend = new ProjectMindBackend(store, { notifyProjectMindChanged: event => events.push(`${event.revision}`) });
    const uri = pathToFileURL(first).toString();
    const { projectHandle: handle, snapshot } = await backend.attach(uri);
    assert.equal(snapshot, undefined);
    assert.deepEqual(await readdir(first), []);
    await assert.rejects(backend.attach(pathToFileURL(second).toString()), /different/);
    await assert.rejects(backend.read(randomUUID()), /handle/);
    await assert.rejects(backend.read(undefined), /handle/);
    for (const [index, type] of ['note', 'idea', 'question', 'decision'].entries()) {
        await backend.mutate({ projectHandle: handle, expectedRevision: index, operation: { type: 'create', artifact: draft(type) } });
    }
    const saved = await backend.read(handle);
    assert.equal(saved?.revision, 4);
    assert.deepEqual(saved?.artifacts.map(artifact => artifact.type), ['note', 'idea', 'question', 'decision']);
    assert.deepEqual(await new ProjectMindStore().read(await store.root(uri)), saved);
    await assert.rejects(backend.mutate({ projectHandle: handle, expectedRevision: 2, operation: { type: 'create', artifact: draft('note') } }), /Stale/);
    await assert.rejects(backend.mutate({ projectHandle: handle, expectedRevision: -1, operation: { type: 'create', artifact: draft('note') } }), /Invalid/);
    await assert.rejects(backend.mutate({ projectHandle: handle, expectedRevision: 4, operation: { type: 'create', artifact: { ...draft('idea'), status: 'accepted' } } }), /Invalid/);
    await assert.rejects(backend.mutate({ projectHandle: handle, expectedRevision: 4, operation: { type: 'archive', artifactId: saved.artifacts[0].id, archived: 'yes' } }), /Invalid/);
    await assert.rejects(backend.mutate({ projectHandle: randomUUID(), expectedRevision: 4, operation: { type: 'create', artifact: draft('note') } }), /handle/);
    assert.deepEqual(events, ['1', '2', '3', '4']);
    const file = join(first, '.dope', 'project-mind.json');
    await writeFile(file, JSON.stringify({ ...saved, projectId: randomUUID() }));
    await assert.rejects(backend.read(handle), /identity changed/);
    await assert.rejects(backend.mutate({ projectHandle: handle, expectedRevision: 4, operation: { type: 'create', artifact: draft('note') } }), /identity changed/);
    await writeFile(file, JSON.stringify(saved));
    backend.dispose();
    await assert.rejects(backend.read(handle), /handle/);
    await store.mutate(first, 4, { type: 'create', artifact: draft('note') });
    assert.deepEqual(events, ['1', '2', '3', '4']);
    const other = new ProjectMindBackend(store, { notifyProjectMindChanged: () => {} });
    assert.equal((await other.attach(pathToFileURL(second).toString())).snapshot, undefined);
    assert.notEqual((await other.mutate({ projectHandle: (await other.attach(pathToFileURL(second).toString())).projectHandle, expectedRevision: 0, operation: { type: 'create', artifact: draft('note') } })).projectId, saved?.projectId);
    other.dispose();
}));

test('explicit migration retains source bytes, provenance, identity and unknown dates', async () => folders(async (first) => {
    const directory = join(first, '.dope'); await mkdir(directory);
    const id = randomUUID();
    const legacy = ` {"id":"${id}","schemaVersion":1,"type":"note","title":"legacy","body":"source","provenance":"developer"}\n`;
    await writeFile(join(directory, 'note.json'), legacy);
    const store = new ProjectMindStore();
    assert.equal(await store.read(first), undefined);
    assert.deepEqual(await readdir(directory), ['note.json']);
    const migrated = await store.migrate(first);
    assert.equal(migrated.revision, 1);
    assert.deepEqual([migrated.artifacts[0].id, migrated.artifacts[0].createdAt, migrated.artifacts[0].updatedAt], [id, null, null]);
    assert.deepEqual([migrated.artifacts[0].migration.sourcePath, migrated.artifacts[0].migration.sourceSchemaVersion], ['.dope/note.json', 1]);
    assert.equal(await readFile(join(directory, 'note.json'), 'utf8'), legacy);
    await assert.rejects(store.migrate(first), /already exists/);
    assert.deepEqual(await new ProjectMindStore().read(first), migrated);
    const changed = await store.mutate(first, 1, { type: 'replace', artifact: { ...migrated.artifacts[0], title: 'edited', updatedAt: new Date().toISOString() } });
    assert.equal(changed.artifacts[0].createdAt, null);
    assert.equal(await readFile(join(directory, 'note.json'), 'utf8'), legacy);
}));

test('corruption, unsupported schema and invalid legacy never create or overwrite state', async () => folders(async (first) => {
    const directory = join(first, '.dope'); await mkdir(directory);
    const store = new ProjectMindStore();
    const file = join(directory, 'project-mind.json');
    for (const content of ['{', '{"schemaVersion":3,"projectId":"future","revision":1,"artifacts":[]}']) {
        await writeFile(file, content);
        await assert.rejects(store.read(first), /Corrupt or unsupported/);
        await assert.rejects(store.migrate(first), /Corrupt or unsupported/);
        await assert.rejects(store.mutate(first, 0, { type: 'create', artifact: draft('note') }), /Corrupt or unsupported/);
        assert.equal(await readFile(file, 'utf8'), content);
    }
    await rm(file);
    await writeFile(join(directory, 'note.json'), '{');
    await assert.rejects(store.migrate(first), /Corrupt legacy/);
    assert.equal((await readdir(directory)).includes('project-mind.json'), false);
}));

test('failed temp write/rename do not replace committed bytes; retry checks revision', async (context) => folders(async (first) => {
    const store = new ProjectMindStore();
    const base = await store.mutate(first, 0, { type: 'create', artifact: draft('note') });
    const file = join(first, '.dope', 'project-mind.json');
    const original = await readFile(file, 'utf8');
    const filesystem = createRequire(import.meta.url)('node:fs/promises');
    const actualOpen = filesystem.open;
    const writeFailure = context.mock.method(filesystem, 'open', (path: string, ...args: unknown[]) => {
        if (path.endsWith('.tmp')) throw new Error('injected temp write failure');
        return actualOpen(path, ...args);
    });
    await assert.rejects(store.mutate(first, 1, { type: 'create', artifact: draft('idea') }), /injected temp write failure/);
    writeFailure.mock.restore();
    const renameFailure = context.mock.method(filesystem, 'rename', async () => { throw new Error('injected rename failure'); });
    await assert.rejects(store.mutate(first, 1, { type: 'create', artifact: draft('idea') }), /injected rename failure/);
    renameFailure.mock.restore();
    assert.equal(await readFile(file, 'utf8'), original);
    assert.deepEqual(await store.read(first), base);
    assert.deepEqual((await readdir(join(first, '.dope'))).filter(name => name.endsWith('.tmp')), []);
    assert.equal((await store.mutate(first, 1, { type: 'create', artifact: draft('idea') })).revision, 2);
    await assert.rejects(store.mutate(first, 1, { type: 'create', artifact: draft('idea') }), /Stale/);
}));

test('post-rename sync failure requires reading the committed revision before retry', async (context) => folders(async (first) => {
    const store = new ProjectMindStore();
    await store.mutate(first, 0, { type: 'create', artifact: draft('note') });
    const filesystem = createRequire(import.meta.url)('node:fs/promises');
    const actualOpen = filesystem.open;
    const failure = context.mock.method(filesystem, 'open', (path: string, ...args: unknown[]) => {
        if (path === join(first, '.dope')) return Promise.resolve({ sync: async () => { throw new Error('injected sync failure'); }, close: async () => {} });
        return actualOpen(path, ...args);
    });
    await assert.rejects(store.mutate(first, 1, { type: 'create', artifact: draft('idea') }), /outcome uncertain; re-read/);
    failure.mock.restore();
    assert.equal((await store.read(first))?.revision, 2);
    await assert.rejects(store.mutate(first, 1, { type: 'create', artifact: draft('idea') }), /Stale/);
}));

test('file traversal and symlinks in links or storage paths are rejected', async () => folders(async (first, second) => {
    const store = new ProjectMindStore();
    const created = await store.mutate(first, 0, { type: 'create', artifact: draft('note') });
    const artifactId = created.artifacts[0].id;
    const link = (path: string) => ({ relation: 'related', target: { type: 'file', path } });
    for (const path of ['../second/secret', '/etc/passwd', 'nested/../../second']) {
        await assert.rejects(store.mutate(first, 1, { type: 'link', artifactId, link: link(path) }));
    }
    await symlink(second, join(first, 'escape'));
    await assert.rejects(store.mutate(first, 1, { type: 'link', artifactId, link: link('escape/secret') }), /Unsafe/);
    const file = join(first, '.dope', 'project-mind.json');
    const snapshot = await readFile(file, 'utf8');
    await rm(file); await symlink(join(second, 'external.json'), file);
    await assert.rejects(store.read(first), /Unsafe/);
    await rm(file); await writeFile(file, snapshot);
    await rm(join(first, '.dope'), { recursive: true });
    await symlink(second, join(first, '.dope'));
    await assert.rejects(store.read(first), /Unsafe/);
    await assert.rejects(store.mutate(first, 0, { type: 'create', artifact: draft('note') }), /Unsafe/);
}));

test('independent process holds exclusive lock; abandoned locks remain for manual recovery', async () => folders(async (first) => {
    const store = new ProjectMindStore();
    const directory = join(first, '.dope'); await mkdir(directory);
    const lock = join(directory, 'project-mind.lock');
    const child = spawn(process.execPath, ['-e', `const fs=require('fs'); const fd=fs.openSync(${JSON.stringify(lock)},'wx'); process.stdout.write('ready\\n'); process.stdin.on('data',()=>{fs.closeSync(fd);process.exit(0)})`], { stdio: ['pipe', 'pipe', 'inherit'] });
    try {
        await new Promise<void>((resolve, reject) => { child.stdout.once('data', () => resolve()); child.once('error', reject); child.once('exit', () => reject(new Error('Child exited early'))); });
        await assert.rejects(store.mutate(first, 0, { type: 'create', artifact: draft('note') }), /locked/);
        assert.equal(await readFile(lock, 'utf8'), '');
    } finally { child.stdin.end(); await new Promise(resolve => child.once('exit', resolve)); }
    await assert.rejects(store.migrate(first), /locked/);
    assert.equal(await readFile(lock, 'utf8'), '');
    await rm(lock);
    assert.equal((await store.mutate(first, 0, { type: 'create', artifact: draft('note') })).revision, 1);
}));

test('second backend process commits first and the original revision cannot overwrite it', async () => folders(async (first) => {
    const store = new ProjectMindStore();
    const uri = pathToFileURL(first).toString();
    const backend = new ProjectMindBackend(store, { notifyProjectMindChanged: () => {} });
    const { projectHandle } = await backend.attach(uri);
    const modulePath = join(process.cwd(), 'packages', 'theia-extension', 'lib', 'node', 'project-mind-backend.js');
    const script = `const {ProjectMindBackend}=require(${JSON.stringify(modulePath)}); const {ProjectMindStore}=require(${JSON.stringify(join(process.cwd(), 'packages', 'project-intelligence', 'lib', 'node', 'project-mind-store.js'))}); (async()=>{ const backend=new ProjectMindBackend(new ProjectMindStore(), {notifyProjectMindChanged(){}}); const {projectHandle}=await backend.attach(${JSON.stringify(uri)}); await backend.mutate({projectHandle,expectedRevision:0,operation:{type:'create',artifact:${JSON.stringify(draft('note'))}}}); backend.dispose() })().catch(error=>{console.error(error);process.exitCode=1})`;
    const child = spawn(process.execPath, ['-e', script]);
    const exit = await new Promise<number | null>(resolve => child.once('exit', resolve));
    assert.equal(exit, 0);
    await assert.rejects(backend.mutate({ projectHandle, expectedRevision: 0, operation: { type: 'create', artifact: draft('idea') } }), /Stale/);
    assert.equal((await backend.read(projectHandle))?.revision, 1);
    backend.dispose();
}));
