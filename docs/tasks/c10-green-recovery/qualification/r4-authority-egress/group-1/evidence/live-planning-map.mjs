// Disposable integrated Software Map -> Planning Map -> Roadmap RPC qualification.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
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
const baseUrl = process.argv[2];
assert.match(baseUrl ?? '', /^http:\/\/127\.0\.0\.1:\d+$/);
const deadline = (promise, label) => Promise.race([promise,
    new Promise((_, reject) => setTimeout(() => reject(Error(`${label}: RPC timeout`)), 15000))]);
const root = await mkdtemp(join(tmpdir(), 'dope-r4-planning-'));
await mkdir(join(root, 'src'));
await mkdir(join(root, 'src/worker'));
await writeFile(join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'CommonJS' }, include: ['src/**/*.ts'] }));
await writeFile(join(root, 'src/a.ts'), 'export const value = 1;\n');
await writeFile(join(root, 'src/worker/w.ts'), 'export const worker = 1;\n');
await writeFile(join(root, 'ROADMAP.md'), '# Roadmap\n\n## Product Phase 61 — Planning link\nStatus: **NOT GREEN**\nObjective: Observe explicit adoption\nOrder: 1\nProse: Preserve\n');
const imported = await new RoadmapStore().acceptImport(root, 0, await previewRoadmapImport(root, 'ROADMAP.md'));
const uri = pathToFileURL(root).href;
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
const channels = [];
async function service(path, client = {}) {
    const channel = await deadline(mux.open(path), `${path} channel`);
    channels.push(channel);
    const factory = new RpcProxyFactory(client);
    factory.listen(channel);
    return factory.createProxy();
}
const report = { root, transport: 'Theia registered MsgPack RPC channels', cases: [] };
try {
    const smap = await service('/services/dope/software-map', { notifySoftwareMapChanged() {}, notifyAnalysisProgress() {} });
    const planning = await service('/services/dope/visual-planning');
    const roadmap = await service('/services/dope/roadmap', { notifyRoadmapChanged() {}, notifyLinkedDocumentChanged() {} });
    const smapHandle = (await deadline(smap.attach(uri), 'Software Map attach')).projectHandle;
    const status = await deadline(smap.initializationStatus(smapHandle), 'Software Map initialization status');
    const architecture = { schemaVersion: 1, systems: [{ id: 'app', name: 'App', purpose: 'App',
        subsystems: [{ id: 'core', name: 'Core', purpose: 'Core', roots: ['src'], components: [] }] }] };
    const accepted = await deadline(smap.acceptManual(smapHandle, architecture, status.declarationFingerprint), 'accept manual architecture');
    assert.equal(accepted.state, 'ready');
    const planningHandle = (await deadline(planning.attach(uri), 'Planning Map attach')).projectHandle;
    const basis = await deadline(planning.currentBasis(planningHandle), 'Planning Map current basis');
    let collection = await deadline(planning.mutate({ projectHandle: planningHandle, expectedRevision: 0,
        operation: { type: 'create', id: 'plan', title: 'Local plan', objective: 'Add a component', basis } }), 'create Planning Map');
    collection = await deadline(planning.mutate({ projectHandle: planningHandle, expectedRevision: collection.revision,
        operation: { type: 'put-transformation', mapId: 'plan', transformation: {
            id: 'add-worker', kind: 'add', currentIds: [], futureNodes: [{ id: 'worker', kind: 'component',
                parentId: 'core', name: 'Worker', purpose: 'Worker', roots: ['src/worker'] }], dependsOn: [] } } }), 'add transformation');
    const owner = (await deadline(roadmap.attach(uri), 'Roadmap attach')).snapshot;
    const roadmapHandle = (await deadline(roadmap.attach(uri), 'Roadmap second attach')).projectHandle;
    const checkpoint = owner.checkpoints[0];
    let map = collection.maps[0];
    const linkFor = (mapValue, projectId = collection.projectId) => ({ owner: 'planning-map', targetId: 'plan',
        ownerProjectId: projectId, ownerRevision: mapValue.revision, basis: mapValue.basis });
    const linkRequest = link => ({ projectHandle: roadmapHandle, ownerId: owner.projectId,
        expectedRevision: owner.revision, sourceHashes: { [checkpoint.id]: checkpoint.source.sha256 },
        actions: [{ type: 'link', id: checkpoint.id, link }] });
    const roadmapBefore = sha(await readFile(join(root, '.dope/roadmap.json')));
    const planningBefore = sha(await readFile(join(root, '.dope/planning-maps.json')));
    async function denied(name, operation, pattern) {
        let response;
        try { await deadline(operation(), name); } catch (error) { response = String(error?.message ?? error); }
        assert.match(response ?? '', pattern);
        assert.equal(sha(await readFile(join(root, '.dope/roadmap.json'))), roadmapBefore);
        report.cases.push({ name, response, roadmapUnchanged: true });
    }
    await denied('wrong Planning Map project', () => roadmap.preview(linkRequest(linkFor(map, 'foreign'))), /Foreign or unresolved Roadmap link/);
    await denied('missing Planning Map owner', () => roadmap.preview(linkRequest({ ...linkFor(map), ownerProjectId: '' })), /Planning Map link requires exact owner and basis/);
    await denied('wrong basis', () => roadmap.preview(linkRequest({ ...linkFor(map), basis: { ...basis, physicalGeneration: basis.physicalGeneration + 1 } })), /Foreign or unresolved Roadmap link/);
    await denied('invalid transformation identity', () => roadmap.preview(linkRequest({ ...linkFor(map), owner: 'transformation', targetId: 'plan/missing' })), /Foreign or unresolved Roadmap link/);
    const staleRequest = linkRequest(linkFor(map));
    const stalePreview = await deadline(roadmap.preview(staleRequest), 'valid Roadmap link preview');
    assert.equal(sha(await readFile(join(root, '.dope/roadmap.json'))), roadmapBefore);
    collection = await deadline(planning.mutate({ projectHandle: planningHandle, expectedRevision: collection.revision,
        operation: { type: 'update', mapId: 'plan', title: 'Revised plan', objective: 'Add a component' } }), 'change Planning Map revision');
    let staleResponse;
    try { await deadline(roadmap.apply(staleRequest, stalePreview.token, true), 'stale Roadmap link apply'); }
    catch (error) { staleResponse = String(error?.message ?? error); }
    assert.match(staleResponse ?? '', /Foreign or unresolved Roadmap link/);
    assert.equal(sha(await readFile(join(root, '.dope/roadmap.json'))), roadmapBefore);
    report.cases.push({ name: 'Planning Map revision changed after preview', response: staleResponse, roadmapUnchanged: true });
    map = collection.maps[0];
    const link = linkFor(map);
    const request = linkRequest(link);
    const preview = await deadline(roadmap.preview(request), 'fresh Roadmap link preview');
    const planningBeforeLink = sha(await readFile(join(root, '.dope/planning-maps.json')));
    const linked = await deadline(roadmap.apply(request, preview.token, true), 'Roadmap link apply');
    assert.equal(linked.checkpoints[0].links.length, 1);
    assert.equal(sha(await readFile(join(root, '.dope/planning-maps.json'))), planningBeforeLink);
    report.link = { roadmapRevision: linked.revision, mapRevision: map.revision,
        planningOwner: collection.projectId, planningInitial: planningBefore, planningBeforeLink,
        planningAfterLink: sha(await readFile(join(root, '.dope/planning-maps.json'))),
        roadmapBefore, roadmapAfterLink: sha(await readFile(join(root, '.dope/roadmap.json'))),
        sourceSha256: sha(await readFile(join(root, 'ROADMAP.md'))) };
    const adoptionRequest = { projectHandle: planningHandle, mapId: 'plan', expectedRevision: collection.revision,
        expectedMapRevision: map.revision, expectedBasis: map.basis,
        scope: { kind: 'transformations', ids: ['add-worker'] } };
    const adoptionPreview = await deadline(planning.previewAdoption(adoptionRequest), 'adoption preview');
    assert.deepEqual(adoptionPreview.blockers, []);
    assert.equal(adoptionPreview.changes.length, 1);
    const architectureBefore = sha(await readFile(join(root, '.dope/architecture.json')));
    const planningBeforeAdoption = sha(await readFile(join(root, '.dope/planning-maps.json')));
    assert.equal((await planning.read(planningHandle)).maps[0].transformations[0].adopted, undefined);
    assert.equal((await planning.get(planningHandle, 'plan')).transformations[0].adopted, undefined);
    assert.equal(sha(await readFile(join(root, '.dope/architecture.json'))), architectureBefore);
    let rejectedAdoption;
    try { await deadline(planning.adoptTarget({ ...adoptionRequest,
        acceptedChanges: [], acceptedTransformationIds: ['add-worker'] }), 'unaccepted adoption'); }
    catch (error) { rejectedAdoption = String(error?.message ?? error); }
    assert.match(rejectedAdoption ?? '', /Adoption diff was not accepted/);
    assert.equal(sha(await readFile(join(root, '.dope/architecture.json'))), architectureBefore);
    assert.equal(sha(await readFile(join(root, '.dope/planning-maps.json'))), planningBeforeAdoption);
    const adopted = await deadline(planning.adoptTarget({ ...adoptionRequest,
        acceptedChanges: adoptionPreview.changes,
        acceptedTransformationIds: ['add-worker'] }), 'explicit adoption');
    assert.equal(adopted.maps[0].transformations[0].adopted, true);
    assert.notEqual(sha(await readFile(join(root, '.dope/architecture.json'))), architectureBefore);
    assert.notEqual(sha(await readFile(join(root, '.dope/planning-maps.json'))), planningBeforeAdoption);
    let staleLinkResponse;
    try { await deadline(roadmap.preview({ ...request, expectedRevision: linked.revision,
        actions: [{ type: 'link', id: checkpoint.id, link: { ...link, owner: 'transformation',
            targetId: 'plan/add-worker' } }] }), 'stale transformation link'); }
    catch (error) { staleLinkResponse = String(error?.message ?? error); }
    assert.match(staleLinkResponse ?? '', /Foreign or unresolved Roadmap link/);
    report.adoption = { previewChanges: adoptionPreview.changes.map(change => ({ id: change.id, action: change.action })),
        architectureBefore, architectureAfter: sha(await readFile(join(root, '.dope/architecture.json'))),
        planningBefore: planningBeforeAdoption, planningAfter: sha(await readFile(join(root, '.dope/planning-maps.json'))),
        roadmapAfter: sha(await readFile(join(root, '.dope/roadmap.json'))), mapRevisionAfter: adopted.maps[0].revision,
        oldRoadmapReferenceUnresolved: true, staleLinkResponse, rejectedAdoption };
    assert.equal(report.adoption.roadmapAfter, report.link.roadmapAfterLink);
    console.log(JSON.stringify(report, null, 2));
} finally { channels.forEach(channel => channel.close()); socket.disconnect(); }
