import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { RoadmapLinkedObserver } from '../../packages/project-intelligence/lib/node/roadmap-linked-observer.js';
import { ProjectPlanningActions } from '../../packages/project-intelligence/lib/node/project-planning-actions.js';
import { previewRoadmapImport } from '../../packages/project-intelligence/lib/node/roadmap-import.js';

const document = '# Roadmap\n## Product Phase 1 — One\nStatus: **NOT GREEN**\nObjective: old\nOrder: 1\nOther prose stays.\n';
async function fixture(run: (root: string, file: string, store: RoadmapStore) => Promise<void>): Promise<void> {
    const root = await mkdtemp(join(tmpdir(), 'dope-roadmap-recover-'));
    const file = join(root, 'docs/roadmap/mvp-roadmap.md');
    try {
        await mkdir(join(root, 'docs/roadmap'), { recursive: true });
        await writeFile(file, document);
        await run(root, file, new RoadmapStore());
    } finally { await rm(root, { recursive: true, force: true }); }
}
async function approvedEdit(root: string, store: RoadmapStore): Promise<() => Promise<unknown>> {
    const first = await store.acceptImport(root, 0, await previewRoadmapImport(root));
    const actions = new ProjectPlanningActions(store);
    const { projectHandle } = await actions.attach(root);
    const item = first.checkpoints[0];
    const request = { projectHandle, ownerId: first.projectId, expectedRevision: first.revision,
        sourceHashes: { [item.id]: item.source!.sha256 },
        actions: [{ type: 'document-edit' as const, id: item.id, objective: 'approved' }] };
    const preview = await actions.preview(request);
    return () => actions.apply(request, preview.token, true);
}

for (const failAt of [1, 2, 3]) test(`restart recovers injected failure after owner write ${failAt}`, async () => fixture(async (root, file, store) => {
    const apply = await approvedEdit(root, store);
    const original = (store as any).replace.bind(store);
    let calls = 0;
    (store as any).replace = async (...args: unknown[]) => {
        const result = await original(...args);
        if (++calls === failAt) throw new Error('injected owner write failure');
        return result;
    };
    await assert.rejects(apply(), /injected owner write failure|pending sync/);
    const pending = await new RoadmapStore().read(root);
    assert.equal(pending.linkedDocument?.syncState, failAt === 3 ? 'synced' : 'pending-sync');
    const restarted = new RoadmapStore();
    const preview = await restarted.previewDocumentSync(root);
    assert.equal(preview.state, 'unchanged');
    const final = await restarted.read(root);
    assert.equal(final.checkpoints[0].objective, 'approved');
    assert.equal(final.checkpoints[0].status, 'not-green');
    assert.equal((await readFile(file, 'utf8')).includes('Objective: approved'), true);
    assert.equal((await readFile(file, 'utf8')).includes('Other prose stays.'), true);
    await assert.rejects(apply(), /Stale Roadmap revision/);
}));

test('stale source after pending write remains a visible conflict and preserves both owners', async () => fixture(async (root, file, store) => {
    const apply = await approvedEdit(root, store);
    const original = (store as any).replace.bind(store);
    let calls = 0;
    (store as any).replace = async (...args: unknown[]) => {
        const result = await original(...args);
        if (++calls === 1) throw new Error('injected owner write failure');
        return result;
    };
    await assert.rejects(apply());
    const foreign = document.replace('Objective: old', 'Objective: external');
    await writeFile(file, foreign);
    const restarted = new RoadmapStore();
    assert.equal((await restarted.previewDocumentSync(root)).state, 'conflict');
    assert.equal((await restarted.read(root)).linkedDocument?.pending?.outcome, 'conflict');
    assert.equal(await readFile(file, 'utf8'), foreign);
    await assert.rejects(restarted.mutate(root, (await restarted.read(root)).revision,
        { type: 'create', id: 'manual', kind: 'milestone', title: 'Manual', objective: '', order: 2 }), /Pending linked/);
}));

test('missing and unsafe linked source never relink or overwrite on recovery', async () => fixture(async (root, file, store) => {
    const apply = await approvedEdit(root, store);
    const original = (store as any).replace.bind(store);
    (store as any).replace = async (...args: unknown[]) => { await original(...args); throw new Error('injected'); };
    await assert.rejects(apply());
    await rm(file);
    const other = join(root, 'other.md');
    await writeFile(other, document);
    await symlink(other, file);
    const restarted = new RoadmapStore();
    const preview = await restarted.previewDocumentSync(root);
    assert.equal(preview.state, 'relink-needed');
    assert.equal((await restarted.read(root)).linkedDocument?.syncState, 'pending-sync');
    assert.equal(await readFile(other, 'utf8'), document);
}));

test('one observer debounces duplicate source events and detaches on project switch', async () => fixture(async (root, file, store) => {
    await store.acceptImport(root, 0, await previewRoadmapImport(root));
    const otherRoot = await mkdtemp(join(tmpdir(), 'dope-roadmap-other-'));
    try {
        await mkdir(join(otherRoot, 'docs/roadmap'), { recursive: true });
        await writeFile(join(otherRoot, 'docs/roadmap/mvp-roadmap.md'), document);
        await store.acceptImport(otherRoot, 0, await previewRoadmapImport(otherRoot));
        const seen: string[] = [];
        const observer = new RoadmapLinkedObserver(value => store.read(value), value => seen.push(value));
        await observer.observe(root);
        await writeFile(file, document.replace('Objective: old', 'Objective: external'));
        await new Promise(resolve => setTimeout(resolve, 350));
        assert.deepEqual(seen, [root]);
        await observer.observe(otherRoot);
        await writeFile(file, document.replace('Objective: old', 'Objective: another'));
        await new Promise(resolve => setTimeout(resolve, 250));
        assert.deepEqual(seen, [root]);
        observer.dispose();
    } finally { await rm(otherRoot, { recursive: true, force: true }); }
}));

test('approved local document write does not feed back as an external source event', async () => fixture(async (root, _file, store) => {
    const apply = await approvedEdit(root, store);
    const seen: string[] = [];
    const observer = new RoadmapLinkedObserver(value => store.read(value), value => seen.push(value));
    try {
        await observer.observe(root);
        await apply();
        await new Promise(resolve => setTimeout(resolve, 300));
        assert.deepEqual(seen, []);
    } finally { observer.dispose(); }
}));
