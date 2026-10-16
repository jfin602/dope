// Disposable live Theia RoadmapService qualification client. No user project is opened.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rename, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(new URL('../../../../../../../package.json', import.meta.url));
const { io } = require('socket.io-client');
const { WebSocketChannel } = require('@theia/core/lib/common/messaging/web-socket-channel');
const { ChannelMultiplexer } = require('@theia/core/lib/common/message-rpc/channel');
const { RpcProxyFactory } = require('@theia/core/lib/common/messaging/proxy-factory');
const { registerMsgPackExtensions } = require('@theia/core/lib/common/message-rpc/rpc-message-encoder');
const { RoadmapStore } = require('@dope/project-intelligence/lib/node/roadmap-store');
const { previewRoadmapImport } = require('@dope/project-intelligence/lib/node/roadmap-import');
const { ChatRepository } = require('@dope/chat/lib/node/chat-repository');
registerMsgPackExtensions();

const baseUrl = process.argv[2];
assert.match(baseUrl ?? '', /^http:\/\/127\.0\.0\.1:\d+$/);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const deadline = (promise, label) => Promise.race([promise,
    new Promise((_, reject) => setTimeout(() => reject(Error(`${label}: RPC timeout`)), 10000))]);
const parent = await mkdtemp(join(tmpdir(), 'dope-r4-g1-'));

async function state(root) {
    const files = await inventory(root);
    const owner = await new RoadmapStore().read(root);
    return { files, projectId: owner.projectId, revision: owner.revision,
        checkpoints: owner.checkpoints.map(item => ({ id: item.id, status: item.status,
            dependencies: item.dependencies, links: item.links })),
        sourceHash: owner.linkedDocument?.sourceHash, syncState: owner.linkedDocument?.syncState };
}
async function inventory(root) {
    const files = {};
    async function visit(relative = '') {
        for (const item of await readdir(join(root, relative), { withFileTypes: true })) {
            const path = join(relative, item.name);
            if (item.isDirectory()) await visit(path);
            else if (item.isFile()) files[path] = sha(await readFile(join(root, path)));
            else if (item.isSymbolicLink()) files[path] = 'symlink';
        }
    }
    await visit();
    return files;
}

async function fixture(name, start) {
    const root = join(parent, name);
    await mkdir(root);
    const markdown = `# Roadmap\n\n## Product Phase ${start} — ${name} first\nStatus: **NOT GREEN**\nObjective: ${name} first baseline\nOrder: 1\nProse: First section\n\n## Product Phase ${start + 1} — ${name} second\nStatus: **NOT GREEN**\nObjective: ${name} second baseline\nOrder: 2\nProse: Second section\n`;
    await writeFile(join(root, 'ROADMAP.md'), markdown);
    const imported = await new RoadmapStore().acceptImport(root, 0,
        await previewRoadmapImport(root, 'ROADMAP.md'));
    assert.equal(imported.checkpoints.length, 2);
    const chatId = randomUUID();
    const chats = new ChatRepository();
    const collection = await chats.mutate(root, 0, { type: 'create-chat', id: chatId,
        folderPath: '', title: `${name} Roadmap review` });
    const lease = await chats.claim(root, chatId, 'r4-fixture');
    assert.equal(lease.acquired, true);
    const item = imported.checkpoints[0];
    await chats.mutate(root, collection.revision, { type: 'append-user', chatId,
        message: { schemaVersion: 1, id: randomUUID(), role: 'user', createdAt: new Date().toISOString(),
            content: `Review ${name} ${item.id}`, contextRefs: [{ schemaVersion: 1, kind: 'roadmap-checkpoint',
                id: item.id, label: item.title, estimatedTokens: 0, projectId: imported.projectId,
                ownerRevision: imported.revision, sourceHash: item.source.sha256 }] } }, lease.token);
    await chats.release(root, chatId, lease.token);
    return { root, uri: pathToFileURL(root).href, imported, chatId, initial: await state(root) };
}

async function connect() {
    const response = await fetch(`${baseUrl}/`, { cache: 'no-store' });
    assert.equal(response.status, 200);
    const cookie = response.headers.getSetCookie().find(value => value.startsWith('theia-connection-token='))?.split(';')[0];
    assert.ok(cookie);
    const socket = io(`${baseUrl}/services`, { path: '/socket.io', autoConnect: false,
        reconnection: false, transports: ['websocket'], extraHeaders: { Cookie: cookie, Origin: baseUrl } });
    const mux = new ChannelMultiplexer(new WebSocketChannel(socket));
    const connected = new Promise((resolve, reject) => {
        socket.once('connect_error', reject);
        socket.once('initialConnection', resolve);
        socket.once('connect', () => socket.emit('initialConnection', randomUUID()));
    });
    socket.connect();
    await deadline(connected, 'initialConnection');
    const channel = await deadline(mux.open('/services/dope/roadmap'), 'Roadmap channel');
    const factory = new RpcProxyFactory({ notifyRoadmapChanged() {}, notifyLinkedDocumentChanged() {} });
    factory.listen(channel);
    return { service: factory.createProxy(), close: () => { channel.close(); socket.disconnect(); } };
}

const A = await fixture('project-a', 31);
const B = await fixture('project-b', 41);
const report = { parent, transport: 'Theia /services RoadmapService MsgPack RPC',
    A: { root: A.root, chatId: A.chatId, baseline: A.initial },
    B: { root: B.root, chatId: B.chatId, baseline: B.initial }, cases: [] };
let connection;
try {
    connection = await connect();
    const svc = connection.service;
    const readA = await deadline(svc.read(A.uri), 'read A');
    const readB = await deadline(svc.read(B.uri), 'read B');
    assert.equal(readA.projectId, A.initial.projectId);
    assert.equal(readB.projectId, B.initial.projectId);
    const handleA = (await deadline(svc.attach(A.uri), 'attach A')).projectHandle;
    const handleB = (await deadline(svc.attach(B.uri), 'attach B')).projectHandle;
    const first = readA.checkpoints[0], second = readA.checkpoints[1];
    const request = (objective, id = first.id) => ({ projectHandle: handleA, ownerId: readA.projectId,
        expectedRevision: readA.revision, sourceHashes: { [id]: first.source.sha256 },
        actions: [{ type: 'document-edit', id, objective }] });
    const pending = request('A preview only');
    const preview = await deadline(svc.preview(pending), 'valid preview');
    assert.equal(preview.requiresApproval, true);
    assert.deepEqual(await state(A.root), A.initial);
    report.valid = { readA: readA.projectId, readB: readB.projectId, revision: readA.revision,
        checkpointIds: [first.id, second.id], tokenFingerprint: sha(preview.token), pendingNoWrite: true };

    async function denied(name, operation, pattern, roots = [A, B]) {
        const before = await Promise.all(roots.map(item => state(item.root)));
        let response;
        try { await deadline(operation(), name); }
        catch (error) { response = String(error?.message ?? error); }
        assert.ok(response, `${name} was accepted`);
        assert.doesNotMatch(response, /RPC timeout/);
        assert.match(response, pattern);
        for (let i = 0; i < roots.length; i++) assert.deepEqual(await state(roots[i].root), before[i], `${name}: mutation`);
        report.cases.push({ name, result: 'DENIED', response, unchanged: true });
    }

    await denied('foreign owner', () => svc.preview({ ...pending, ownerId: readB.projectId }), /Foreign or disposed planning handle/);
    await denied('foreign handle', () => svc.preview({ ...pending, projectHandle: handleB }), /Foreign or disposed planning handle/);
    await denied('stale revision', () => svc.preview({ ...pending, expectedRevision: 2 }), /Stale or foreign planning owner revision/);
    await denied('wrong source hash', () => svc.preview({ ...pending, sourceHashes: { [first.id]: readB.checkpoints[0].source.sha256 } }), /Stale or unsupported linked Roadmap section/);
    await denied('other project checkpoint', () => svc.preview(request('cross project', readB.checkpoints[0].id)), /Stale or unsupported linked Roadmap section/);
    await denied('multiple linked actions', () => svc.preview({ ...pending, actions: [pending.actions[0], { ...pending.actions[0], id: second.id }] }), /single action/);
    await denied('malformed action', () => svc.preview({ ...pending, actions: [{ type: 'shell', id: first.id, command: 'echo blocked' }] }), /Unknown planning action type/);
    await denied('no approval', () => svc.apply(pending, preview.token, false), /Planning preview or approval required/);
    await denied('wrong token', () => svc.apply(pending, '0'.repeat(64), true), /Planning preview or approval required/);
    await denied('unknown Planning Map owner link', () => svc.preview({ ...pending,
        actions: [{ type: 'link', id: first.id, link: { owner: 'planning-map', targetId: 'missing',
            ownerProjectId: readA.projectId, ownerRevision: 1, basis: { fake: true } } }] }), /Foreign or unresolved Roadmap link/);
    await denied('Green promotion', () => svc.preview({ ...pending,
        actions: [{ type: 'status', id: first.id, status: 'green' }] }), /Roadmap gate promotion requires evidence authority/);
    await denied('parent traversal import', () => svc.previewImport(A.uri, '../external.md'), /Unsafe roadmap source path/);
    await denied('absolute external import', () => svc.previewImport(A.uri, join(parent, 'external.md')), /Unsafe roadmap source path/);
    await denied('invalid project root', () => svc.attach(pathToFileURL(join(parent, 'missing')).href), /ENOENT|Unsafe|Invalid/);
    const foreignImport = await deadline(svc.previewImport(B.uri, 'ROADMAP.md'), 'foreign import preview');
    await denied('cross-project import acceptance', () => svc.acceptImport(A.uri, A.initial.revision,
        B.initial.projectId, foreignImport), /Roadmap identity changed|Stale Roadmap import preview/);

    const bFirst = readB.checkpoints[0];
    const bRequest = { projectHandle: handleB, ownerId: readB.projectId,
        expectedRevision: readB.revision, sourceHashes: { [bFirst.id]: bFirst.source.sha256 },
        actions: [{ type: 'document-edit', id: bFirst.id, objective: 'Approved B change' }] };
    const bPreview = await deadline(svc.preview(bRequest), 'preview B concurrent');
    assert.deepEqual(await state(B.root), B.initial);
    const concurrent = await Promise.allSettled([
        deadline(svc.apply(bRequest, bPreview.token, true), 'concurrent B 1'),
        deadline(svc.apply(bRequest, bPreview.token, true), 'concurrent B 2')
    ]);
    assert.equal(concurrent.filter(entry => entry.status === 'fulfilled').length, 1);
    assert.equal(concurrent.filter(entry => entry.status === 'rejected').length, 1);
    const publishedB = await state(B.root);
    assert.equal(publishedB.revision, 4);
    assert.notEqual(publishedB.files['ROADMAP.md'], B.initial.files['ROADMAP.md']);
    assert.deepEqual(await state(A.root), A.initial);
    report.approval = { B: { before: B.initial, after: publishedB,
        previewTokenFingerprint: sha(bPreview.token),
        concurrentOutcomes: concurrent.map(entry => entry.status === 'fulfilled' ?
            `fulfilled revision ${entry.value.revision}` : String(entry.reason?.message ?? entry.reason)) } };
    await denied('approved token replay', () => svc.apply(bRequest, bPreview.token, true), /Stale Roadmap revision|Stale Roadmap revision or project identity/);

    const depend = { projectHandle: handleB, ownerId: readB.projectId,
        expectedRevision: publishedB.revision,
        sourceHashes: { [readB.checkpoints[1].id]: publishedB.sourceHash },
        actions: [{ type: 'depend', id: readB.checkpoints[1].id, dependencyId: bFirst.id }] };
    const dependPreview = await deadline(svc.preview(depend), 'dependency preview');
    const depended = await deadline(svc.apply(depend, dependPreview.token, false), 'dependency apply');
    const undoToken = await deadline(svc.undoToken(handleB, readB.projectId), 'undo token');
    assert.ok(undoToken);
    const change = { projectHandle: handleB, ownerId: readB.projectId,
        expectedRevision: depended.revision,
        sourceHashes: { [readB.checkpoints[1].id]: publishedB.sourceHash },
        actions: [{ type: 'undepend', id: readB.checkpoints[1].id, dependencyId: bFirst.id }] };
    const changePreview = await deadline(svc.preview(change), 'dependency removal preview');
    await deadline(svc.apply(change, changePreview.token, true), 'dependency removal apply');
    await denied('stale Undo', () => svc.undo({ projectHandle: handleB, ownerId: readB.projectId,
        expectedRevision: depended.revision, token: undoToken }), /Undo conflict or unavailable/);
    report.approval.staleUndo = { tokenFingerprint: sha(undoToken), revisionBefore: depended.revision,
        revisionAfter: (await state(B.root)).revision, denied: true };

    const external = join(parent, 'external.md');
    await writeFile(external, 'external stays intact\n');
    const source = join(A.root, 'ROADMAP.md');
    const moved = join(A.root, 'moved.md');
    await rename(source, moved);
    await symlink(external, source);
    const beforeExternal = sha(await readFile(external));
    await denied('symlink substitution after preview', () => svc.apply(pending, preview.token, true),
        /Unsafe linked Roadmap symlink|Stale linked Roadmap source/, [A]);
    assert.equal(sha(await readFile(external)), beforeExternal);
    report.symlinkExternalUnchanged = true;
    await rename(source, join(A.root, 'discarded-link'));
    await rename(moved, source);
    // The intentionally retained link remains within the disposable fixture; remove it from the state record only.

    const stale = await deadline(svc.preview(pending), 'preview before external edit');
    await writeFile(source, (await readFile(source, 'utf8')).replace('first baseline', 'externally changed'));
    const externalHash = sha(await readFile(source));
    await denied('external edit after preview', () => svc.apply(pending, stale.token, true),
        /Stale linked Roadmap source fingerprint|Stale or unsupported linked Roadmap section/, [A]);
    assert.equal(sha(await readFile(source)), externalHash);
    report.externalEditPreserved = true;

    const C = await fixture('project-c-root-replacement', 81);
    const movedA = `${A.root}-displaced`;
    await rename(A.root, movedA);
    await rename(C.root, A.root);
    const movedBefore = await inventory(movedA);
    const replacementBefore = await inventory(A.root);
    let ownerChangedResponse;
    try { await deadline(svc.apply(pending, preview.token, true), 'owner changed after preview'); }
    catch (error) { ownerChangedResponse = String(error?.message ?? error); }
    assert.match(ownerChangedResponse ?? '', /Stale Roadmap revision or project identity|Planning owner changed|Corrupt or unsupported Roadmap index/);
    assert.deepEqual(await inventory(movedA), movedBefore);
    assert.deepEqual(await inventory(A.root), replacementBefore);
    report.ownerChangedAfterPreview = { response: ownerChangedResponse,
        displacedRoot: movedA, replacementRoot: A.root,
        displacedProjectId: A.initial.projectId, replacementProjectId: C.initial.projectId,
        displacedUnchanged: true, replacementUnchanged: true };
    console.log(JSON.stringify(report, null, 2));
} finally { connection?.close(); }
