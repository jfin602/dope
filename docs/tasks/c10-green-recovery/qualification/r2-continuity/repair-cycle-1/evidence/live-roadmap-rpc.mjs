// Disposable qualification client. Uses Theia's own /services channel and RPC classes.
// Run from the repository root: node docs/tasks/c10-green-recovery/qualification/r2-continuity/repair-cycle-1/evidence/live-roadmap-rpc.mjs http://127.0.0.1:3001
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
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
registerMsgPackExtensions();

const baseUrl = process.argv[2];
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(baseUrl ?? '')) throw Error('Expected loopback Dope backend URL');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const deadline = (promise, label, ms = 10000) => Promise.race([promise,
    new Promise((_, reject) => setTimeout(() => reject(Error(`${label} timed out`)), ms))]);

async function state(root) {
    const files = {};
    async function visit(path = '') {
        for (const item of await readdir(join(root, path), { withFileTypes: true })) {
            const rel = join(path, item.name);
            if (item.isDirectory()) await visit(rel);
            else if (item.isFile()) files[rel] = digest(await readFile(join(root, rel)));
            else throw Error(`Unexpected non-file in disposable fixture: ${rel}`);
        }
    }
    await visit();
    const owner = await new RoadmapStore().read(root);
    return { files, projectId: owner.projectId, revision: owner.revision,
        checkpoints: owner.checkpoints.map(item => ({ id: item.id, status: item.status,
            dependencies: item.dependencies, links: item.links })), pendingCreation: owner.pendingCreation ?? null };
}

async function fixture(parent, name, phase) {
    const root = join(parent, name);
    await mkdir(root);
    const markdown = `# Roadmap\n\n## Product Phase ${phase} — ${name} boundary\nStatus: **NOT GREEN**\nObjective: ${name} source baseline\nOrder: ${phase}\n\n${name} linked source.\n`;
    await writeFile(join(root, 'ROADMAP.md'), markdown);
    const store = new RoadmapStore();
    const imported = await store.acceptImport(root, 0, await previewRoadmapImport(root, 'ROADMAP.md'));
    assert.equal(imported.revision, 1);
    assert.equal(imported.checkpoints.length, 1);
    return { root, uri: pathToFileURL(root).href, imported, baseline: await state(root) };
}

async function connect() {
    const response = await fetch(`${baseUrl}/`, { cache: 'no-store' });
    assert.equal(response.status, 200, 'normal first-page bootstrap');
    const cookie = response.headers.getSetCookie().find(value => value.startsWith('theia-connection-token='))?.split(';')[0];
    assert.ok(cookie, 'Theia first-page connection cookie');
    const socket = io(`${baseUrl}/services`, { path: '/socket.io', autoConnect: false, reconnection: false,
        transports: ['websocket'], extraHeaders: { Cookie: cookie, Origin: baseUrl } });
    const main = new WebSocketChannel(socket);
    const mux = new ChannelMultiplexer(main);
    const connected = new Promise((resolve, reject) => {
        socket.once('connect_error', reject);
        socket.once('initialConnection', resolve);
        socket.once('connect', () => socket.emit('initialConnection', randomUUID()));
    });
    socket.connect();
    await deadline(connected, 'Theia initialConnection');
    const channel = await deadline(mux.open('/services/dope/roadmap'), 'Roadmap channel AckOpen');
    const notifications = [];
    const factory = new RpcProxyFactory({
        notifyRoadmapChanged: change => notifications.push({ type: 'roadmap', projectId: change.projectId }),
        notifyLinkedDocumentChanged: (_root, projectId) => notifications.push({ type: 'linked', projectId })
    });
    factory.listen(channel);
    return { service: factory.createProxy(), socket, channel, notifications };
}

const parent = await mkdtemp(join(tmpdir(), 'dope-r2-g1-'));
const A = await fixture(parent, 'project-a', 1);
const B = await fixture(parent, 'project-b', 2);
assert.notEqual(A.root, B.root);
assert.notEqual(A.imported.projectId, B.imported.projectId);
const result = { fixtureRoot: parent, transport: 'Theia Socket.IO /services initialConnection + ChannelMultiplexer /services/dope/roadmap + RpcProxyFactory',
    fixtures: { A: { root: A.root, ...A.baseline }, B: { root: B.root, ...B.baseline } },
    cases: [], notifications: [] };
let connection;
let otherConnection;
try {
    connection = await connect();
    const svc = connection.service;
    const readA = await deadline(svc.read(A.uri), 'RoadmapService.read(A)');
    assert.equal(readA.projectId, A.imported.projectId);
    assert.equal(readA.revision, A.imported.revision);
    const attachedA = await deadline(svc.attach(A.uri), 'RoadmapService.attach(A)');
    assert.equal(attachedA.snapshot.projectId, A.imported.projectId);
    const attachedB = await deadline(svc.attach(B.uri), 'RoadmapService.attach(B)');
    assert.equal(attachedB.snapshot.projectId, B.imported.projectId);
    const itemA = readA.checkpoints[0];
    const requestA = { projectHandle: attachedA.projectHandle, ownerId: readA.projectId,
        expectedRevision: readA.revision, sourceHashes: { [itemA.id]: itemA.source.sha256 },
        actions: [{ type: 'document-edit', id: itemA.id, objective: 'Preview only; no accepted change' }] };
    const previewA = await deadline(svc.preview(requestA), 'RoadmapService.preview(A)');
    assert.equal(previewA.ownerId, readA.projectId);
    assert.equal(previewA.revision, readA.revision);
    assert.equal(previewA.requiresApproval, true);
    assert.deepEqual(await state(A.root), A.baseline);
    assert.deepEqual(await state(B.root), B.baseline);
    result.authorized = { read: { projectId: readA.projectId, revision: readA.revision, checkpointId: itemA.id },
        A: { handle: attachedA.projectHandle, ownerId: readA.projectId },
        B: { handle: attachedB.projectHandle, ownerId: attachedB.snapshot.projectId },
        preview: { ownerId: previewA.ownerId, revision: previewA.revision,
            requiresApproval: previewA.requiresApproval, tokenSha256: digest(previewA.token) },
        nonMutating: true };

    async function denial(name, operation, category) {
        let error;
        try { await deadline(operation(), name); }
        catch (caught) { error = String(caught?.message ?? caught); }
        if (!error) throw Error(`${name} was unexpectedly accepted; stop hostile tests`);
        if (error.includes('timed out')) throw Error(`${name} transport failure: ${error}`);
        assert.match(error, category, `${name} expected authority category`);
        const afterA = await state(A.root), afterB = await state(B.root);
        assert.deepEqual(afterA, A.baseline, `${name} mutated project A`);
        assert.deepEqual(afterB, B.baseline, `${name} mutated project B`);
        result.cases.push({ name, response: error, A: afterA, B: afterB, unchanged: true });
    }

    await denial('A handle with B owner preview', () => svc.preview({ ...requestA, ownerId: B.imported.projectId }), /Foreign or disposed planning handle/);
    await denial('A handle with B owner apply and A token', () => svc.apply({ ...requestA, ownerId: B.imported.projectId }, previewA.token, true), /Foreign or disposed planning handle/);
    await denial('B handle with A owner preview', () => svc.preview({ ...requestA, projectHandle: attachedB.projectHandle }), /Foreign or disposed planning handle/);
    await denial('B handle with A owner apply and A token', () => svc.apply({ ...requestA, projectHandle: attachedB.projectHandle }, previewA.token, true), /Foreign or disposed planning handle/);
    await denial('A stale owner revision', () => svc.preview({ ...requestA, expectedRevision: readA.revision + 1 }), /Stale or foreign planning owner revision/);
    await denial('A foreign source fingerprint', () => svc.preview({ ...requestA,
        sourceHashes: { [itemA.id]: B.imported.checkpoints[0].source.sha256 } }), /Stale or unsupported linked Roadmap section|Stale linked Roadmap source fingerprint/);
    const itemB = B.imported.checkpoints[0];
    await denial('A request for B checkpoint', () => svc.preview({ ...requestA,
        sourceHashes: { [itemB.id]: itemB.source.sha256 },
        actions: [{ type: 'document-edit', id: itemB.id, objective: 'Foreign checkpoint attempt' }] }),
    /Stale or unsupported linked Roadmap section|Unknown linked Roadmap checkpoint|Unknown or read-only Roadmap checkpoint/);
    await denial('A apply without approval', () => svc.apply(requestA, previewA.token, false), /Planning preview or approval required/);
    otherConnection = await connect();
    await denial('A handle on separate app connection', () => otherConnection.service.preview(requestA), /Foreign or disposed planning handle/);
    const requestB = { projectHandle: attachedB.projectHandle, ownerId: B.imported.projectId,
        expectedRevision: B.imported.revision, sourceHashes: { [itemB.id]: itemB.source.sha256 },
        actions: [{ type: 'document-edit', id: itemB.id, objective: 'Separate connection attempt' }] };
    await denial('B handle on separate app connection', () => otherConnection.service.preview(requestB), /Foreign or disposed planning handle/);
    const undoA = await deadline(svc.undoToken(attachedA.projectHandle, A.imported.projectId), 'RoadmapService.undoToken(A)');
    assert.equal(undoA, undefined);
    await deadline(svc.detach(attachedA.projectHandle), 'RoadmapService.detach(A)');
    await denial('disposed A handle preview', () => svc.preview(requestA), /Foreign or disposed planning handle/);
    await denial('disposed A handle apply', () => svc.apply(requestA, previewA.token, true), /Foreign or disposed planning handle/);
    const undo = await deadline(svc.undoToken(attachedB.projectHandle, B.imported.projectId), 'RoadmapService.undoToken(B)');
    assert.equal(undo, undefined);
    result.approval = { foreignPreviewReturnedToken: false, foreignApplyAccepted: false,
        disposedHandleUsable: false, AUndoToken: null, BUndoToken: null };
    result.notifications = connection.notifications;
    result.final = { A: await state(A.root), B: await state(B.root) };
    assert.deepEqual(result.final.A, A.baseline);
    assert.deepEqual(result.final.B, B.baseline);
    result.finalUnchanged = true;
    console.log(JSON.stringify(result, null, 2));
} finally {
    otherConnection?.channel.close();
    otherConnection?.socket.disconnect();
    connection?.channel.close();
    connection?.socket.disconnect();
}
