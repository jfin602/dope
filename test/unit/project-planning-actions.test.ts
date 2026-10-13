import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ProjectPlanningActions } from '../../packages/project-intelligence/lib/node/project-planning-actions.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { previewRoadmapImport } from '../../packages/project-intelligence/lib/node/roadmap-import.js';
import type { PlanningActionRequest } from '../../packages/project-intelligence/lib/node/project-planning-actions.js';

const fixture = async (run: (root: string, store: RoadmapStore, actions: ProjectPlanningActions) => Promise<void>): Promise<void> => {
    const root = await mkdtemp(join(tmpdir(), 'dope-planning-actions-'));
    const store = new RoadmapStore();
    const actions = new ProjectPlanningActions(store, async (_root, link) => link.owner === 'issue' &&
        link.targetId === 'issue-1' && link.ownerRevision === 3);
    try { await run(root, store, actions); } finally { await rm(root, { recursive: true, force: true }); }
};
const create = (id: string) => ({ type: 'create' as const, id, kind: 'milestone' as const, title: id, objective: '', order: 0 });
const attached = async (root: string, store: RoadmapStore, actions: ProjectPlanningActions) => {
    await store.mutate(root, 0, create('a'));
    return actions.attach(root);
};
const request = (projectHandle: string, ownerId: string, expectedRevision: number,
    actions: PlanningActionRequest['actions']): PlanningActionRequest => ({ projectHandle, ownerId, expectedRevision, actions });

test('preview is write-free; approval, events and next selected read use the committed revision', async () => fixture(async (root, store, actions) => {
    const { projectHandle, snapshot } = await attached(root, store, actions);
    const events: unknown[] = [];
    store.onChange(event => events.push(event));
    const proposal = request(projectHandle, snapshot.projectId, snapshot.revision, [
        { type: 'status', id: 'a', status: 'not-green' }]);
    const preview = await actions.preview(proposal);
    assert.equal(preview.requiresApproval, true);
    assert.equal((await store.read(root)).revision, 1);
    await assert.rejects(actions.apply(proposal, preview.token), /approval required/);
    assert.equal(events.length, 0);
    const committed = await actions.apply(proposal, preview.token, true);
    assert.equal(committed.revision, 2);
    assert.equal(committed.checkpoints[0].status, 'not-green');
    assert.deepEqual((events[0] as { changedIds: string[] }).changedIds, ['a']);
    assert.deepEqual((await actions.read(projectHandle, snapshot.projectId, 'a') as { revision: number }).revision, 2);
}));

test('stale race, foreign handle, invalid type and gate promotion fail without writes', async () => fixture(async (root, store, actions) => {
    const { projectHandle, snapshot } = await attached(root, store, actions);
    const proposal = request(projectHandle, snapshot.projectId, 1, [{ type: 'edit', id: 'a', objective: 'one' }]);
    const preview = await actions.preview(proposal);
    await store.mutate(root, 1, create('b'), snapshot.projectId);
    await assert.rejects(actions.apply(proposal, preview.token), /Stale Roadmap revision/);
    await assert.rejects(actions.preview({ ...proposal, projectHandle: 'foreign', expectedRevision: 2 }), /Foreign/);
    await assert.rejects(actions.preview({ ...proposal, ownerId: 'foreign', expectedRevision: 2 }), /Foreign/);
    await assert.rejects(actions.preview(request(projectHandle, snapshot.projectId, 2,
        [{ type: 'status', id: 'a', status: 'green' } as never])), /gate promotion/);
    await assert.rejects(actions.preview(request(projectHandle, snapshot.projectId, 2,
        [{ type: 'shell', id: 'a', command: 'whoami' } as never])), /Unknown planning action/);
    assert.equal((await store.read(root)).revision, 2);
}));

test('dependency cycle and invalid foreign link roll back an entire owner batch', async () => fixture(async (root, store, actions) => {
    const { projectHandle, snapshot } = await attached(root, store, actions);
    const cycle = request(projectHandle, snapshot.projectId, 1, [create('b'),
        { type: 'depend', id: 'a', dependencyId: 'b' }, { type: 'depend', id: 'b', dependencyId: 'a' }]);
    await assert.rejects(actions.preview(cycle), /dependency cycle/);
    const foreign = request(projectHandle, snapshot.projectId, 1, [create('b'),
        { type: 'link', id: 'b', link: { owner: 'issue', targetId: 'foreign', ownerRevision: 3 } }]);
    await assert.rejects(actions.preview(foreign), /Foreign or unresolved/);
    assert.deepEqual((await store.read(root)).checkpoints.map(item => item.id), ['a']);
    assert.equal((await store.read(root)).revision, 1);
}));

test('typed link, approval for unlink, and revision-safe undo conflict', async () => fixture(async (root, store, actions) => {
    const { projectHandle, snapshot } = await attached(root, store, actions);
    const link = { owner: 'issue' as const, targetId: 'issue-1', ownerRevision: 3 };
    const add = request(projectHandle, snapshot.projectId, 1, [{ type: 'link', id: 'a', link }]);
    const added = await actions.apply(add, (await actions.preview(add)).token);
    assert.deepEqual(added.checkpoints[0].links, [link]);
    const token = actions.undoToken(projectHandle, snapshot.projectId);
    assert.ok(token);
    await store.mutate(root, 2, create('b'), snapshot.projectId);
    await assert.rejects(actions.undoEligible({ projectHandle, ownerId: snapshot.projectId, expectedRevision: 2, token }), /Stale Roadmap revision/);
    const remove = request(projectHandle, snapshot.projectId, 3, [{ type: 'unlink', id: 'a', link }]);
    const preview = await actions.preview(remove);
    assert.equal(preview.requiresApproval, true);
    await assert.rejects(actions.apply(remove, preview.token), /approval required/);
    const removed = await actions.apply(remove, preview.token, true);
    assert.deepEqual(removed.checkpoints[0].links, []);
}));

test('eligible edit undo restores one owner object and detects a changed source', async () => fixture(async (root, store, actions) => {
    const { projectHandle, snapshot } = await attached(root, store, actions);
    const edit = request(projectHandle, snapshot.projectId, 1, [{ type: 'edit', id: 'a', objective: 'new' }]);
    const changed = await actions.apply(edit, (await actions.preview(edit)).token);
    const token = actions.undoToken(projectHandle, snapshot.projectId)!;
    const undone = await actions.undoEligible({ projectHandle, ownerId: snapshot.projectId, expectedRevision: changed.revision, token });
    assert.equal(undone.checkpoints[0].objective, '');
    assert.equal(undone.revision, 3);
    await assert.rejects(actions.undoEligible({ projectHandle, ownerId: snapshot.projectId, expectedRevision: 3, token }), /Undo conflict/);

    await mkdir(join(root, 'docs/roadmap'), { recursive: true });
    const source = join(root, 'docs/roadmap/mvp-roadmap.md');
    await writeFile(source, '# Roadmap\n## Product Phase 1 — One\nStatus: NOT GREEN\nObjective: old\n');
    const before = await readFile(source);
    const imported = await store.acceptImport(root, 3, await previewRoadmapImport(root), snapshot.projectId);
    const item = imported.checkpoints.find(checkpoint => checkpoint.source)!;
    const sourceEdit = { ...request(projectHandle, snapshot.projectId, 4, [{ type: 'document-edit', id: item.id, objective: 'plan' }]),
        sourceHashes: { [item.id]: item.source!.sha256 } };
    const preview = await actions.preview(sourceEdit);
    await writeFile(source, '# Roadmap\n## Product Phase 1 — One\nStatus: GREEN\nObjective: old\n');
    await assert.rejects(actions.apply(sourceEdit, preview.token, true), /Stale linked Roadmap source fingerprint/);
    assert.equal((await store.read(root)).revision, 4);
    assert.deepEqual(before.toString(), '# Roadmap\n## Product Phase 1 — One\nStatus: NOT GREEN\nObjective: old\n');
}));
