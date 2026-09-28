import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { parseNote } from '../../packages/contracts/src/note.ts';
import { NoteBackend } from '../../packages/theia-extension/lib/node/note-backend.js';
import { NoteStore } from '../../packages/theia-extension/lib/node/note-store.js';

async function workspace(run: (uri: string, file: string) => Promise<void>): Promise<void> {
    const root = await mkdtemp(join(tmpdir(), 'dope-p3-'));
    try { await run(pathToFileURL(root).toString(), join(root, '.dope', 'note.json')); }
    finally { await rm(root, { recursive: true, force: true }); }
}

test('ProjectArtifact/Note round trip and reconstruction preserve identity', async () => workspace(async (uri, file) => {
    const first = new NoteStore();
    assert.equal(await first.read(uri), undefined);
    const created = await first.save(uri, { title: 'A title', body: 'A body' });
    assert.deepEqual(parseNote(JSON.parse(await readFile(file, 'utf8'))), created);
    const reconstructed = new NoteStore();
    assert.deepEqual(await reconstructed.read(uri), created);
    const updated = await reconstructed.save(uri, { title: 'Revised', body: 'New body' });
    assert.equal(updated.id, created.id);
    assert.equal(updated.provenance, 'developer');
    assert.deepEqual(await new NoteStore().read(uri), updated);
}));

test('missing state is empty; corrupt and unsupported state cannot be overwritten', async () => workspace(async (uri, file) => {
    const store = new NoteStore();
    assert.equal(await store.read(uri), undefined);
    await mkdir(join(file, '..'), { recursive: true });
    for (const corrupt of ['{', JSON.stringify({ schemaVersion: 2, type: 'note' }), JSON.stringify({
        id: '27ddf5b6-c2f1-4c27-8c1d-15e7ad5ee909', schemaVersion: 1, type: 'note', title: 'x', body: 'y', provenance: 'developer', futureField: true
    })]) {
        await writeFile(file, corrupt);
        await assert.rejects(store.read(uri), /Corrupt Dope note/);
        await assert.rejects(store.save(uri, { title: 'x', body: 'y' }), /Corrupt Dope note/);
        assert.equal(await readFile(file, 'utf8'), corrupt);
    }
}));

test('typed backend requests and backend events reach clients, then stop after disposal', async () => workspace(async (uri) => {
    const store = new NoteStore();
    const seen: string[] = [];
    const backend = new NoteBackend(store, { notifyNoteChanged: (changedUri, note) => seen.push(`${changedUri}:${note.id}`) });
    store.onChange(() => { throw new Error('closed connection'); });
    const secondClient: string[] = [];
    const peer = new NoteBackend(store, { notifyNoteChanged: (_changedUri, note) => secondClient.push(note.title) });
    const saved = await backend.save(uri, { title: 'Event', body: 'Payload' });
    assert.deepEqual(await backend.read(uri), saved);
    assert.deepEqual(seen, [`${uri}:${saved.id}`]);
    assert.deepEqual(secondClient, ['Event']);
    backend.dispose();
    await store.save(uri, { title: 'Again', body: 'Payload' });
    assert.equal(seen.length, 1);
    assert.deepEqual(secondClient, ['Event', 'Again']);
    peer.dispose();
}));

test('legacy Note cannot write once a Project Mind snapshot exists', async () => workspace(async (uri, file) => {
    const store = new NoteStore();
    const original = await store.save(uri, { title: 'legacy', body: 'unchanged' });
    const bytes = await readFile(file, 'utf8');
    const lock = join(file, '..', 'project-mind.lock');
    await writeFile(lock, '');
    await assert.rejects(store.save(uri, { title: 'racing', body: 'not written' }), /locked/);
    assert.equal(await readFile(file, 'utf8'), bytes);
    await rm(lock);
    await writeFile(join(file, '..', 'project-mind.json'), '{');
    await assert.rejects(store.save(uri, { title: 'new', body: 'not written' }), /read-only history/);
    assert.equal(await readFile(file, 'utf8'), bytes);
    assert.deepEqual(await store.read(uri), original);
    await rm(join(file, '..', 'project-mind.json'));
    await symlink(join(file, '..', 'missing'), join(file, '..', 'project-mind.json'));
    await assert.rejects(store.save(uri, { title: 'new', body: 'not written' }), /read-only history/);
    assert.equal(await readFile(file, 'utf8'), bytes);
}));

test('transport bindings and browser side keep filesystem access on Node', async () => {
    const root = new URL('../../', import.meta.url);
    const fs = await import('node:fs/promises');
    const frontend = await fs.readFile(new URL('packages/theia-extension/src/browser/frontend-module.ts', root), 'utf8');
    const backend = await fs.readFile(new URL('packages/theia-extension/src/node/backend-module.ts', root), 'utf8');
    const widget = await fs.readFile(new URL('packages/theia-extension/src/browser/dope-workbench.ts', root), 'utf8');
    assert.match(frontend, /ServiceConnectionProvider\.createProxy<NoteService>/);
    assert.match(backend, /RpcConnectionHandler<NoteClient>/);
    assert.match(backend, /onDidCloseConnection/);
    assert.match(backend, /RpcConnectionHandler<ProjectMindClient>/);
    assert.match(frontend, /createProxy<ProjectMindService/);
    assert.match(widget, /ProjectMindController/);
    assert.doesNotMatch(frontend + widget, /node:fs|note-store|note-backend/);
});
