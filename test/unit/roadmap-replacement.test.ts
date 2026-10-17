import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { previewRoadmapImport } from '../../packages/project-intelligence/lib/node/roadmap-import.js';

const oldPath = 'docs/roadmap/mvp-roadmap.md';
const newPath = 'ROADMAP.md';
const original = '# Roadmap\n\n## Product Phase 1 — Original\nStatus: **ACTIVE**\nObjective: Keep original\nOrder: 1\n';
const replacement = '# Roadmap\n\n## Milestone New target\nStatus: **ACTIVE**\nObjective: New target\nOrder: 2\n';

async function fixture(run: (root: string, store: RoadmapStore) => Promise<void>): Promise<void> {
    const root = await mkdtemp(join(tmpdir(), 'dope-roadmap-replacement-'));
    try {
        await mkdir(join(root, 'docs/roadmap'), { recursive: true });
        await mkdir(join(root, 'docs/planning'), { recursive: true });
        await mkdir(join(root, 'docs/tasks'), { recursive: true });
        await writeFile(join(root, oldPath), original);
        await writeFile(join(root, newPath), replacement);
        await writeFile(join(root, 'known-issues.md'), '# Known Issues\n');
        const store = new RoadmapStore();
        await store.acceptImport(root, 0, await previewRoadmapImport(root));
        await run(root, store);
    } finally { await rm(root, { recursive: true, force: true }); }
}

test('existing wrong source previews distinct mapped replacement and leaves both owners unchanged', async () => fixture(async (root, store) => {
    const before = await readFile(join(root, '.dope/roadmap.json'));
    const oldBytes = await readFile(join(root, oldPath));
    const newBytes = await readFile(join(root, newPath));
    const events: unknown[] = [];
    const off = store.onChange(event => events.push(event));
    const preview = await store.previewReplacement(root, newPath);
    off();
    assert.equal(preview.state, 'ready');
    assert.equal(preview.projectId, (await store.read(root)).projectId);
    assert.equal(preview.revision, 1);
    assert.equal(preview.previousPath, oldPath);
    assert.equal(preview.path, newPath);
    assert.equal(preview.previousHash, preview.observedPreviousHash);
    assert.notEqual(preview.previousHash, preview.sourceHash);
    assert.deepEqual(preview.removedCheckpointIds, [`roadmap:${oldPath}#phase-1`]);
    assert.deepEqual(preview.addedCheckpointIds, [`roadmap:${newPath}#milestone-new-target`]);
    assert.deepEqual(preview.atRiskCheckpointIds, preview.removedCheckpointIds);
    assert.deepEqual(preview.atRiskCheckpoints, [{ id: `roadmap:${oldPath}#phase-1`,
        title: 'Product Phase 1 — Original', status: 'active', dependencies: 0, links: 0 }]);
    assert.match(preview.replacementWarning, /previous Markdown file remains on disk/);
    assert.deepEqual(preview.sections, [{ sectionKey: 'milestone-new-target',
        checkpointId: `roadmap:${newPath}#milestone-new-target`, line: 3 }]);
    assert.deepEqual(events, []);
    assert.deepEqual(await readFile(join(root, '.dope/roadmap.json')), before);
    assert.deepEqual(await readFile(join(root, oldPath)), oldBytes);
    assert.deepEqual(await readFile(join(root, newPath)), newBytes);
}));

test('manual checkpoint and its links are visible as replacement risk', async () => fixture(async (root, store) => {
    const accepted = await store.read(root);
    await store.mutate(root, accepted.revision, { type: 'create', id: 'manual-plan', kind: 'milestone',
        title: 'Manual plan', objective: 'Preserve this decision', order: 2,
        links: [{ owner: 'issue', targetId: 'issue-17' }] }, accepted.projectId);
    const before = await readFile(join(root, '.dope/roadmap.json'));
    const preview = await store.previewReplacement(root, newPath);
    assert.equal(preview.state, 'review');
    assert.deepEqual(preview.manualCheckpointIds, ['manual-plan']);
    assert.ok(preview.atRiskCheckpointIds.includes('manual-plan'));
    assert.ok(preview.atRiskCheckpoints.some(item => item.id === 'manual-plan' && item.links === 1));
    assert.deepEqual(await readFile(join(root, '.dope/roadmap.json')), before);
}));

test('missing, unsafe, symlink and same candidate paths are rejected without writes', async () => fixture(async (root, store) => {
    const before = await readFile(join(root, '.dope/roadmap.json'));
    await assert.rejects(store.previewReplacement(root, 'missing.md'), /Missing roadmap source/);
    await assert.rejects(store.previewReplacement(root, '../foreign.md'), /Unsafe roadmap source path/);
    await assert.rejects(store.previewReplacement(root, '.dope/roadmap.json'), /different safe project Markdown path/);
    await assert.rejects(store.previewReplacement(root, oldPath), /different safe project Markdown path/);
    await symlink(join(root, newPath), join(root, 'alias.md'));
    await assert.rejects(store.previewReplacement(root, 'alias.md'), /Unsafe roadmap source path/);
    assert.deepEqual(await readFile(join(root, '.dope/roadmap.json')), before);
}));

test('unsupported mapping, stale source and pending sync require review without changing revision', async () => fixture(async (root, store) => {
    const indexFile = join(root, '.dope/roadmap.json');
    await writeFile(join(root, newPath), '# Roadmap\n\n## Unrecognized section\nStatus: **ACTIVE**\n');
    const unsupported = await store.previewReplacement(root, newPath);
    assert.equal(unsupported.state, 'review');
    assert.ok(unsupported.diagnostics.some(item => item.path === newPath && item.line === 3 &&
        /Unsupported roadmap section/i.test(item.message)));
    await writeFile(join(root, newPath), replacement);
    await writeFile(join(root, oldPath), original.replace('Keep original', 'External edit'));
    const stale = await store.previewReplacement(root, newPath);
    assert.equal(stale.state, 'review');
    assert.ok(stale.diagnostics.some(item => item.path === oldPath && /changed since acceptance/i.test(item.message)));
    await writeFile(join(root, oldPath), original);
    const index = JSON.parse(await readFile(indexFile, 'utf8'));
    index.revision++;
    index.linkedDocument.syncState = 'pending-sync';
    index.linkedDocument.pending = { basisRevision: index.revision - 1, checkpointId: index.checkpoints[0].id,
        beforeHash: index.linkedDocument.sourceHash, afterHash: index.linkedDocument.sourceHash,
        title: index.checkpoints[0].title, objective: index.checkpoints[0].objective,
        order: index.checkpoints[0].order, outcome: 'prepared' };
    await writeFile(indexFile, `${JSON.stringify(index)}\n`);
    const pendingBytes = await readFile(indexFile);
    const pending = await store.previewReplacement(root, newPath);
    assert.equal(pending.state, 'review');
    assert.ok(pending.diagnostics.some(item => /Pending linked Roadmap sync/.test(item.message)));
    assert.deepEqual(await readFile(indexFile), pendingBytes);
    assert.equal((await store.read(root)).revision, 2);
    index.linkedDocument.syncState = 'conflict';
    delete index.linkedDocument.pending;
    await writeFile(indexFile, `${JSON.stringify(index)}\n`);
    const conflict = await store.previewReplacement(root, newPath);
    assert.equal(conflict.state, 'review');
    assert.ok(conflict.diagnostics.some(item => item.path === oldPath && /conflict/.test(item.message)));
}));

test('unsynced local Roadmap state is protected and reported against its source', async () => fixture(async (root, store) => {
    const indexFile = join(root, '.dope/roadmap.json');
    const index = JSON.parse(await readFile(indexFile, 'utf8'));
    index.revision++;
    index.checkpoints[0].objective = 'Unpublished local decision';
    await writeFile(indexFile, `${JSON.stringify(index)}\n`);
    const before = await readFile(indexFile);
    const preview = await store.previewReplacement(root, newPath);
    assert.equal(preview.state, 'review');
    assert.ok(preview.diagnostics.some(item => item.path === oldPath && /Roadmap changed after|unsynced/.test(item.message)));
    assert.deepEqual(await readFile(indexFile), before);
    assert.equal((await store.read(root)).checkpoints[0].objective, 'Unpublished local decision');
}));

test('missing optional evidence is reported without making a compatible candidate unusable', async () => fixture(async (root, store) => {
    await rm(join(root, 'known-issues.md'));
    const preview = await store.previewReplacement(root, newPath);
    assert.equal(preview.state, 'ready');
    assert.ok(preview.diagnostics.some(item => item.path === 'known-issues.md' && item.severity === 'warning' &&
        /Missing source/.test(item.message)));
}));
