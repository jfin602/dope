import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { DeveloperSessionController, emptyLinkDraft, linkRefFromDraft } =
    require('../../packages/theia-extension/lib/browser/developer-session-controller.js');
const { parseSessionArtifactRef, sessionArtifactRefKey } =
    require('../../packages/contracts/lib/developer-session.js');
const { DeveloperSessionBackend } = require('../../packages/theia-extension/lib/node/developer-session-backend.js');
const { DeveloperSessionStore } = require('../../packages/theia-extension/lib/node/developer-session-store.js');
const { ChatRepository } = require('../../packages/chat/lib/node/chat-repository.js');

const firstId = 'c433482f-9576-4402-af45-ef246414c9c0';
const secondId = '5852ad1b-6ab5-4632-bb64-9cac4a9469f8';
const chatId = 'be37c92c-b18d-4bd5-bda7-50a354d4cad2';
const mindId = 'da2a693d-d6b0-4cb3-899f-1b0a068fe128';
const refs = [
    { kind: 'chat', chatId },
    { kind: 'planning-map', mapId: 'release.map' },
    { kind: 'work-item', mapId: 'release.map', workItemId: 'work-1' },
    { kind: 'agent-task', taskId: 'task-1' },
    { kind: 'agent-run', taskId: 'task-1', runId: 'run-1' },
    { kind: 'agent-sequence', sequenceId: 'sequence-1' },
    { kind: 'project-mind', artifactType: 'idea', artifactId: mindId },
] as const;

function workspace(uri = 'file:///project') {
    return { roots: Promise.resolve([{ resource: { toString: () => uri } }]),
        onWorkspaceChanged: () => ({ dispose() {} }) };
}

function backend() {
    const project = { canonicalRoot: '/project', projectMindId: null };
    const session = (id: string) => ({ schemaVersion: 2, id, project, revision: 1, title: id,
        objective: '', createdAt: '', updatedAt: '', status: 'active', notes: '', nextActions: [],
        closeout: null, links: [] as any[] });
    let snapshot = { schemaVersion: 2, project, revision: 2, sessions: [session(firstId), session(secondId)] };
    const requests: { action: string; request: any }[] = [];
    const change = (action: string, request: any) => {
        requests.push({ action, request });
        assert.equal(request.projectHandle, 'opaque-project-handle');
        const ref = parseSessionArtifactRef(request.ref);
        if (request.expectedCollectionRevision !== snapshot.revision) throw Error('Stale collection revision conflict');
        const selected = snapshot.sessions.find(item => item.id === request.sessionId);
        if (!selected) throw Error('Unknown Session');
        if (request.expectedSessionRevision !== selected.revision) throw Error('Stale Session revision conflict');
        if (selected.status === 'closed') throw Error('Closed Session is immutable');
        const key = sessionArtifactRefKey(ref);
        const existing = selected.links.findIndex(link => sessionArtifactRefKey(link) === key);
        if (action === 'attach' && existing < 0 || action === 'detach' && existing >= 0) {
            selected.links = action === 'attach' ? [...selected.links, ref] :
                selected.links.filter((_, index) => index !== existing);
            selected.revision++;
            snapshot.revision++;
        }
        return Promise.resolve({ snapshot: structuredClone(snapshot), session: structuredClone(selected) });
    };
    return {
        requests,
        get snapshot() { return snapshot; },
        attach: async () => ({ projectHandle: 'opaque-project-handle', project,
            snapshot: structuredClone(snapshot) }),
        read: async () => structuredClone(snapshot),
        attachLink: (request: any) => change('attach', request),
        detachLink: (request: any) => change('detach', request),
        dispose() {},
        close(id: string) { snapshot.sessions.find(item => item.id === id)!.status = 'closed';
            snapshot.sessions.find(item => item.id === id)!.revision++; snapshot.revision++; },
        externalRevision() { snapshot.revision++; },
    };
}

test('typed exact-ID form creates all seven v2 variants and rejects malformed composite IDs', () => {
    for (const ref of refs) {
        const draft = { ...emptyLinkDraft(), ...ref };
        assert.deepEqual(linkRefFromDraft(draft), ref);
    }
    assert.throws(() => linkRefFromDraft({ ...emptyLinkDraft(), kind: 'work-item',
        mapId: 'release.map', workItemId: '../bad' }), /Invalid/);
    assert.throws(() => linkRefFromDraft({ ...emptyLinkDraft(), kind: 'agent-run',
        taskId: 'task-1', runId: '' }), /Invalid/);
    assert.throws(() => linkRefFromDraft({ ...emptyLinkDraft(), kind: 'project-mind',
        artifactId: mindId, artifactType: 'task' }), /Invalid/);
    const widget = readFileSync(new URL('../../packages/theia-extension/src/browser/developer-session-widget.ts', import.meta.url), 'utf8');
    assert.match(widget, /renderLinkForm\(\)/);
    assert.match(widget, /controller\.attachLink\(\)/);
    assert.match(widget, /controller\.detachLink\(ref\)/);
    assert.doesNotMatch(widget, /innerHTML|insertAdjacentHTML/);
});

test('attach uses current handle/revisions; duplicates, sharing and detach only change membership', async () => {
    const service = backend();
    const controller = new DeveloperSessionController(() => service, workspace() as any, () => {});
    await controller.attach();
    controller.select(firstId);
    for (const ref of refs) {
        for (const [key, value] of Object.entries(ref)) controller.setLinkDraft(key as any, value as any);
        assert.equal(await controller.attachLink(), true);
    }
    assert.deepEqual(controller.selected?.links, refs);
    assert.equal(controller.revision, 9);
    assert.equal(controller.selected?.revision, 8);
    assert.deepEqual(service.requests[0].request, { projectHandle: 'opaque-project-handle',
        sessionId: firstId, expectedCollectionRevision: 2, expectedSessionRevision: 1, ref: refs[0] });
    assert.equal(await controller.attachLink(), true);
    assert.match(controller.notice, /already linked/);
    assert.equal(controller.revision, 9);
    controller.select(secondId);
    controller.setLinkDraft('kind', 'chat');
    controller.setLinkDraft('chatId', chatId);
    assert.equal(await controller.attachLink(), true);
    assert.deepEqual(controller.selected?.links, [refs[0]]);
    controller.select(firstId);
    assert.equal(await controller.detachLink(refs[0]), true);
    assert.deepEqual(controller.selected?.links, refs.slice(1));
    assert.deepEqual(service.snapshot.sessions[1].links, [refs[0]]);
    controller.dispose();
});

test('malformed, stale and closed links show errors without owner writes', async () => {
    const service = backend();
    const controller = new DeveloperSessionController(() => service, workspace() as any, () => {});
    await controller.attach(); controller.select(firstId);
    controller.setLinkDraft('kind', 'work-item');
    controller.setLinkDraft('mapId', 'map');
    controller.setLinkDraft('workItemId', '../bad');
    assert.equal(await controller.attachLink(), false);
    assert.match(controller.error, /Invalid/);
    assert.equal(service.requests.length, 0);
    controller.setLinkDraft('workItemId', 'item');
    service.externalRevision();
    assert.equal(await controller.attachLink(), false);
    assert.match(controller.error, /Refresh and review/);
    assert.equal(service.snapshot.sessions[0].links.length, 0);
    await controller.refresh();
    service.close(firstId);
    await controller.refresh();
    assert.equal(await controller.attachLink(), false);
    assert.equal(await controller.detachLink(refs[0]), false);
    assert.equal(service.requests.length, 1);
    controller.dispose();
});

test('UI attach and detach touch Session membership while real Chat owner bytes stay unchanged', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-session-ui-link-'));
    const service = new DeveloperSessionBackend(new DeveloperSessionStore());
    try {
        await new ChatRepository().mutate(root, 0,
            { type: 'create-chat', id: chatId, folderPath: '', title: 'Existing Chat' });
        const manifest = join(root, '.dope/chats/index.json');
        const entry = JSON.parse(await readFile(manifest, 'utf8')).entries[0];
        const chatFile = join(root, '.dope/chats/folders', entry.file);
        const original = [await readFile(manifest), await readFile(chatFile)];
        const controller = new DeveloperSessionController(() => service,
            workspace(pathToFileURL(root).href) as any, () => {});
        await controller.attach();
        assert.equal(await controller.mutate({ type: 'create', title: 'Link UI', objective: '' }), true);
        controller.setLinkDraft('chatId', chatId);
        assert.equal(await controller.attachLink(), true);
        assert.deepEqual(controller.selected?.links, [{ kind: 'chat', chatId }]);
        assert.equal(await controller.detachLink({ kind: 'chat', chatId }), true);
        assert.deepEqual(controller.selected?.links, []);
        assert.deepEqual([await readFile(manifest), await readFile(chatFile)], original);
        controller.dispose();
    } finally {
        service.dispose();
        await rm(root, { recursive: true, force: true });
    }
});

test('late attach result after switching roots cannot select or overwrite the new project', async () => {
    let root = 'file:///A';
    let changed: (() => void) | undefined;
    const workspace = { get roots() { return Promise.resolve([{ resource: { toString: () => root } }]); },
        onWorkspaceChanged(listener: () => void) { changed = listener; return { dispose() { changed = undefined; } }; } };
    const record = (project: any) => ({ schemaVersion: 2, id: firstId, project, revision: 1,
        title: project.canonicalRoot, objective: '', createdAt: '', updatedAt: '', status: 'active',
        notes: '', nextActions: [], closeout: null, links: [] });
    const aProject = { canonicalRoot: '/A', projectMindId: null };
    const bProject = { canonicalRoot: '/B', projectMindId: null };
    const aSnapshot = { schemaVersion: 2, project: aProject, revision: 1, sessions: [record(aProject)] };
    const bSnapshot = { schemaVersion: 2, project: bProject, revision: 1, sessions: [record(bProject)] };
    let deliver!: (result: any) => void;
    let calls = 0;
    const a: any = { attach: async () => ({ projectHandle: 'A', project: aProject, snapshot: aSnapshot }),
        attachLink: () => { calls++; return new Promise(resolve => { deliver = resolve; }); }, dispose() {} };
    const b: any = { attach: async () => ({ projectHandle: 'B', project: bProject, snapshot: bSnapshot }),
        attachLink: () => { calls++; throw Error('Unexpected B mutation'); }, dispose() {} };
    const connections = [a, b];
    const controller = new DeveloperSessionController(() => connections.shift()!, workspace as any, () => {});
    await controller.attach(); controller.select(firstId);
    controller.setLinkDraft('chatId', chatId);
    const pending = controller.attachLink();
    root = 'file:///B'; changed?.();
    await Promise.resolve(); await Promise.resolve();
    deliver({ snapshot: { ...aSnapshot, revision: 2 }, session: aSnapshot.sessions[0] });
    assert.equal(await pending, false);
    assert.equal(controller.workspace, 'file:///B');
    assert.equal(controller.snapshot?.project.canonicalRoot, '/B');
    assert.equal(controller.selectedId, undefined);
    assert.equal(controller.notice, '');
    assert.equal(calls, 1);
    controller.dispose();
});
