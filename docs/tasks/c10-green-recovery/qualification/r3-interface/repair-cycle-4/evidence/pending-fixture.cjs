// Disposable, supported Roadmap import/action with one injected owner-write interruption.
// Run from repository root: node .../pending-fixture.cjs /tmp/dope-r3-g4-browser-pending
const fs = require('node:fs/promises');
const { RoadmapStore } = require('@dope/project-intelligence/lib/node/roadmap-store');
const { ProjectPlanningActions } = require('@dope/project-intelligence/lib/node/project-planning-actions');
const { previewRoadmapImport } = require('@dope/project-intelligence/lib/node/roadmap-import');

(async () => {
    const root = process.argv[2];
    if (!/^\/tmp\/dope-r3-g4-(browser|native)-pending$/.test(root ?? '')) throw Error('Use the disposable R3 pending root');
    await fs.mkdir(root, { recursive: true });
    const file = `${root}/ROADMAP.md`;
    await fs.writeFile(file, '# Roadmap\n\n## Product Phase 1 — Pending recovery\nStatus: **NOT GREEN**\nObjective: Accepted basis\nOrder: 1\n\nUnmapped narrative stays.\n');
    const store = new RoadmapStore();
    const imported = await store.acceptImport(root, 0, await previewRoadmapImport(root, 'ROADMAP.md'));
    const actions = new ProjectPlanningActions(store);
    const { projectHandle } = await actions.attach(root);
    const item = imported.checkpoints[0];
    const request = { projectHandle, ownerId: imported.projectId, expectedRevision: imported.revision,
        sourceHashes: { [item.id]: item.source.sha256 },
        actions: [{ type: 'document-edit', id: item.id, objective: 'Pending Dope objective' }] };
    const preview = await actions.preview(request);
    const replace = store.replace.bind(store);
    let writes = 0;
    store.replace = async (...args) => {
        await replace(...args);
        if (++writes === 1) throw Error('R3 injected interruption after pending owner write');
    };
    let interruption;
    try { await actions.apply(request, preview.token, true); }
    catch (error) { interruption = String(error); }
    if (!interruption?.includes('R3 injected interruption')) throw Error('Expected interruption did not occur');
    const pending = await new RoadmapStore().read(root);
    if (pending.linkedDocument?.syncState !== 'pending-sync') throw Error('Pending state missing');
    const source = await fs.readFile(file, 'utf8');
    await fs.writeFile(file, source.replace('Objective: Accepted basis', 'Objective: External overlap'));
    const restarted = new RoadmapStore();
    const conflict = await restarted.previewDocumentSync(root);
    if (conflict.state !== 'conflict') throw Error(`Expected conflict, got ${conflict.state}`);
    console.log(JSON.stringify({ root, projectId: pending.projectId, revision: (await restarted.read(root)).revision,
        checkpointId: item.id, originalHash: item.source.sha256, conflict, interruption }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
