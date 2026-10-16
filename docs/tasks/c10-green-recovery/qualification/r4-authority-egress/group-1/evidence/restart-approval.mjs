// Two-stage disposable restart probe. Raw capability remains only in private /tmp state.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
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
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const [mode, baseUrl, saved] = process.argv.slice(2);
assert.match(baseUrl ?? '', /^http:\/\/127\.0\.0\.1:\d+$/);
const deadline = (promise, label) => Promise.race([promise,
    new Promise((_, reject) => setTimeout(() => reject(Error(`${label}: RPC timeout`)), 10000))]);
async function connect() {
    const page = await fetch(`${baseUrl}/`, { cache: 'no-store' });
    assert.equal(page.status, 200);
    const cookie = page.headers.getSetCookie().find(value => value.startsWith('theia-connection-token='))?.split(';')[0];
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
const connection = await connect();
try {
    const svc = connection.service;
    if (mode === 'prepare') {
        const root = await mkdtemp(join(tmpdir(), 'dope-r4-restart-'));
        const source = join(root, 'ROADMAP.md');
        await writeFile(source, '# Roadmap\n\n## Product Phase 51 — Restart\nStatus: **NOT GREEN**\nObjective: Before restart\nOrder: 1\nProse: Keep\n');
        const owner = await new RoadmapStore().acceptImport(root, 0,
            await previewRoadmapImport(root, 'ROADMAP.md'));
        const handle = (await deadline(svc.attach(pathToFileURL(root).href), 'attach')).projectHandle;
        const item = owner.checkpoints[0];
        const request = { projectHandle: handle, ownerId: owner.projectId,
            expectedRevision: owner.revision, sourceHashes: { [item.id]: item.source.sha256 },
            actions: [{ type: 'document-edit', id: item.id, objective: 'Should not apply across restart' }] };
        const preview = await deadline(svc.preview(request), 'preview');
        const before = { source: sha(await readFile(source)), owner: sha(await readFile(join(root, '.dope/roadmap.json'))) };
        await writeFile(saved, JSON.stringify({ root, request, token: preview.token, before }), { mode: 0o600 });
        console.log(JSON.stringify({ root, projectId: owner.projectId, revision: owner.revision,
            sourceSha256: before.source, ownerSha256: before.owner, tokenFingerprint: sha(preview.token),
            pendingNoWrite: before.source === sha(await readFile(source)) &&
                before.owner === sha(await readFile(join(root, '.dope/roadmap.json'))) }));
    } else if (mode === 'prepare-sync') {
        const root = await mkdtemp(join(tmpdir(), 'dope-r4-pending-sync-'));
        await mkdir(join(root, 'docs'));
        const source = join(root, 'docs/ROADMAP.md');
        await writeFile(source, '# Roadmap\n\n## Product Phase 52 — Pending sync\nStatus: **NOT GREEN**\nObjective: Before interruption\nOrder: 1\nProse: Keep\n');
        const owner = await new RoadmapStore().acceptImport(root, 0,
            await previewRoadmapImport(root, 'docs/ROADMAP.md'));
        const handle = (await deadline(svc.attach(pathToFileURL(root).href), 'attach sync')).projectHandle;
        const item = owner.checkpoints[0];
        const request = { projectHandle: handle, ownerId: owner.projectId, expectedRevision: owner.revision,
            sourceHashes: { [item.id]: item.source.sha256 },
            actions: [{ type: 'document-edit', id: item.id, objective: 'Pending approved objective' }] };
        const preview = await deadline(svc.preview(request), 'pending sync preview');
        await chmod(join(root, 'docs'), 0o500);
        let response;
        try { await deadline(svc.apply(request, preview.token, true), 'interrupted apply'); }
        catch (error) { response = String(error?.message ?? error); }
        finally { await chmod(join(root, 'docs'), 0o700); }
        assert.match(response ?? '', /pending sync/);
        const pending = await new RoadmapStore().read(root);
        assert.equal(pending.linkedDocument?.syncState, 'pending-sync');
        const external = (await readFile(source, 'utf8')).replace('Before interruption', 'External edit preserved');
        await writeFile(source, external);
        const sourceHash = sha(await readFile(source));
        await writeFile(saved, JSON.stringify({ root, sourceHash, pendingRevision: pending.revision }), { mode: 0o600 });
        console.log(JSON.stringify({ root, response, ownerId: owner.projectId,
            beforeRevision: owner.revision, pendingRevision: pending.revision,
            syncState: pending.linkedDocument.syncState,
            pendingOwnerSha256: sha(await readFile(join(root, '.dope/roadmap.json'))),
            externalSourceSha256: sourceHash, externalEditPreserved: true }));
    } else if (mode === 'verify-sync') {
        const { root, sourceHash, pendingRevision } = JSON.parse(await readFile(saved, 'utf8'));
        const uri = pathToFileURL(root).href;
        const preview = await deadline(svc.previewPendingRecovery(uri), 'pending recovery preview');
        assert.equal(preview.state, 'ready');
        assert.ok(preview.revision >= pendingRevision);
        assert.equal(preview.sourceHash, sourceHash);
        const declined = await deadline(svc.applyPendingRecovery(uri, preview, false), 'decline recovery');
        assert.equal(declined.linkedDocument?.syncState, 'pending-sync');
        assert.equal(sha(await readFile(join(root, 'docs/ROADMAP.md'))), sourceHash);
        const recovered = await deadline(svc.applyPendingRecovery(uri, preview, true), 'approve recovery');
        assert.equal(recovered.linkedDocument?.syncState, 'synced');
        assert.equal(recovered.checkpoints[0].objective, 'External edit preserved');
        assert.equal(recovered.checkpoints[0].status, 'not-green');
        assert.equal(sha(await readFile(join(root, 'docs/ROADMAP.md'))), sourceHash);
        let replay;
        try { await deadline(svc.applyPendingRecovery(uri, preview, true), 'recovery replay'); }
        catch (error) { replay = String(error?.message ?? error); }
        assert.match(replay ?? '', /No pending|Stale pending/);
        console.log(JSON.stringify({ root, previewState: preview.state,
            previewChanges: preview.changes.map(change => ({ field: change.field, conflict: change.conflict })),
            declinedNoWrite: true, beforeRevision: pendingRevision,
            conflictMarkedRevision: preview.revision, recoveredRevision: recovered.revision,
            recoveredOwnerSha256: sha(await readFile(join(root, '.dope/roadmap.json'))),
            externalSourceSha256: sourceHash, sourcePreserved: true, replay }));
    } else if (mode === 'verify') {
        const { root, request, token, before } = JSON.parse(await readFile(saved, 'utf8'));
        let response;
        try { await deadline(svc.apply(request, token, true), 'stale approval'); }
        catch (error) { response = String(error?.message ?? error); }
        assert.match(response ?? '', /Foreign or disposed planning handle/);
        const after = { source: sha(await readFile(join(root, 'ROADMAP.md'))),
            owner: sha(await readFile(join(root, '.dope/roadmap.json'))) };
        assert.deepEqual(after, before);
        console.log(JSON.stringify({ root, staleApprovalResponse: response, before, after,
            unchanged: true, revision: (await new RoadmapStore().read(root)).revision }));
    } else throw Error('Expected prepare or verify');
} finally { connection.close(); }
