// Original-source diagnostic for d4ad098; run only on that historical source.
// The original publisher renamed the staged temp file directly over ROADMAP.md.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { mkdtemp, readFile, writeFile } = fs;
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { RoadmapStore } = require('@dope/project-intelligence/lib/node/roadmap-store');
const { previewRoadmapImport } = require('@dope/project-intelligence/lib/node/roadmap-import');
const { ProjectPlanningActions } = require('@dope/project-intelligence/lib/node/project-planning-actions');

(async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-r4-publication-race-'));
    const file = join(root, 'ROADMAP.md');
    const original = '# Roadmap\n\n## Product Phase 71 — Race\nStatus: **NOT GREEN**\nObjective: Original\nOrder: 1\nProse: Keep\n';
    const external = original.replace('Objective: Original', 'Objective: External competing write');
    await writeFile(file, original);
    const store = new RoadmapStore();
    const imported = await store.acceptImport(root, 0, await previewRoadmapImport(root, 'ROADMAP.md'));
    const actions = new ProjectPlanningActions(store);
    const handle = (await actions.attach(root)).projectHandle;
    const item = imported.checkpoints[0];
    const request = { projectHandle: handle, ownerId: imported.projectId, expectedRevision: imported.revision,
        sourceHashes: { [item.id]: item.source.sha256 },
        actions: [{ type: 'document-edit', id: item.id, objective: 'Approved write' }] };
    const preview = await actions.preview(request);
    const originalRename = fs.rename;
    let injected = false;
    fs.rename = async (from, to) => {
        if (!injected && to === file && from.includes('.dope-roadmap-')) {
            injected = true;
            await writeFile(file, external);
        }
        return originalRename(from, to);
    };
    let response;
    try { await actions.apply(request, preview.token, true); response = 'accepted'; }
    catch (error) { response = String(error?.message ?? error); }
    finally { fs.rename = originalRename; }
    assert.equal(injected, true);
    const actual = await readFile(file, 'utf8');
    const owner = await store.read(root);
    let recovery;
    if (actual === external && owner.linkedDocument?.syncState === 'pending-sync') {
        const restarted = new RoadmapStore();
        const pending = await restarted.previewPendingRecovery(root);
        const settled = await restarted.applyPendingRecovery(root, pending, true);
        const backup = `${file}.dope-pending-backup`;
        let backupExists = true;
        try { await fs.lstat(backup); } catch (error) { if (error.code === 'ENOENT') backupExists = false; else throw error; }
        recovery = { previewState: pending.state, revision: settled.revision,
            syncState: settled.linkedDocument?.syncState, sourcePreserved: (await readFile(file, 'utf8')) === external,
            backupExists };
    }
    console.log(JSON.stringify({ root, injected, response, externalPreserved: actual === external,
        approvedPublished: actual.includes('Objective: Approved write'), revision: owner.revision,
        syncState: owner.linkedDocument?.syncState, status: owner.checkpoints[0].status, recovery }));
})().catch(error => { console.error(error); process.exitCode = 1; });
