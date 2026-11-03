import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { roadmapHistoryTarget } from '../../packages/theia-extension/src/browser/roadmap-history-navigation.ts';
import { gatePhaseCards } from '../../packages/theia-extension/src/browser/roadmap-canvas-model.ts';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import type { RoadmapGateIndex } from '../../packages/project-intelligence/src/node/roadmap-gate-domain.ts';

test('four retained revisions browse Undo, Undo, Redo, Redo without changing the head', () => {
    const revisions = [12, 11, 10, 9];
    let cursor = 12;
    cursor = roadmapHistoryTarget(revisions, 12, 9, cursor, -1)!;
    assert.equal(cursor, 11);
    cursor = roadmapHistoryTarget(revisions, 12, 9, cursor, -1)!;
    assert.equal(cursor, 10);
    cursor = roadmapHistoryTarget(revisions, 12, 9, cursor, 1)!;
    assert.equal(cursor, 11);
    cursor = roadmapHistoryTarget(revisions, 12, 9, cursor, 1)!;
    assert.equal(cursor, 12);
    assert.equal(roadmapHistoryTarget(revisions, 12, 9, 12, 1), undefined);
    assert.equal(roadmapHistoryTarget(revisions, 12, 9, 9, -1), undefined);
    assert.deepEqual(revisions, [12, 11, 10, 9]);
});

test('late baseline and incomplete or stale archive metadata fail closed', () => {
    assert.equal(roadmapHistoryTarget([8, 7], 8, 7, 7, -1), undefined);
    assert.equal(roadmapHistoryTarget([8, 7], 8, 7, 8, -1), 7);
    assert.equal(roadmapHistoryTarget([8, 6], 8, 6, 8, -1), undefined);
    assert.equal(roadmapHistoryTarget([8, 7], 9, 7, 8, -1), undefined);
    assert.equal(roadmapHistoryTarget([8, 7, 7], 8, 7, 8, -1), undefined);
    assert.equal(roadmapHistoryTarget([8, 7], 8, 7, 9, -1), undefined);
});

test('four fetched snapshots project exact as-of titles without touching canonical or Markdown bytes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-history-view-'));
    try {
        await mkdir(join(root, '.dope'));
        const file = join(root, '.dope', 'roadmap.json');
        const markdown = join(root, 'ROADMAP.md');
        await writeFile(markdown, '# Independent source\n');
        const initial: RoadmapGateIndex = { schemaVersion: 2, projectId: 'owner', projectRoot: root, revision: 1,
            phases: [{ id: 'phase', projectId: 'owner', title: 'First', objective: 'First outcome', order: 0,
                dependencies: [], implementationStatus: 'unknown', qualificationStatus: 'unknown',
                draftAcceptance: 'accepted', gateSetCoverage: { status: 'unreviewed' } }],
            gates: [], corrections: [] };
        await writeFile(file, `${JSON.stringify(initial)}\n`);
        const store = new RoadmapStore();
        await store.initializeRevisionArchive(root, 'owner');
        let current = initial;
        for (const title of ['Second', 'Third', 'Fourth']) current = await store.mutateGateIndex(
            root, current.revision, current.projectId, { type: 'phase.edit', id: 'phase', title, objective: `${title} outcome` });
        const before = await readFile(file);
        const sourceBefore = await readFile(markdown);
        const list = await store.listRevisions(root, 'owner');
        assert.deepEqual(list.revisions.map(item => item.revision), [4, 3, 2, 1]);
        const snapshots = await Promise.all([1, 2, 3, 4].map(revision => store.fetchRevision(root, 'owner', revision)));
        assert.deepEqual(snapshots.map(item => gatePhaseCards(JSON.parse(item.snapshot) as RoadmapGateIndex)
            .nodes[0].title), ['First', 'Second', 'Third', 'Fourth']);
        assert.deepEqual(await readFile(file), before);
        assert.deepEqual(await readFile(markdown), sourceBefore);
        assert.equal((await store.read(root)).revision, 4);
    } finally { await rm(root, { recursive: true, force: true }); }
});
