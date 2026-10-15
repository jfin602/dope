import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectPlanningActions } from '../../../../../../../packages/project-intelligence/lib/node/project-planning-actions.js';
import { RoadmapStore } from '../../../../../../../packages/project-intelligence/lib/node/roadmap-store.js';
import { previewRoadmapImport } from '../../../../../../../packages/project-intelligence/lib/node/roadmap-import.js';

const store = new RoadmapStore();
const actions = new ProjectPlanningActions(store);
const base = await mkdtemp(join(tmpdir(), 'dope-p13-authority-'));
const roots = [join(base, 'a'), join(base, 'b'), join(base, 'linked')];
for (const root of roots) await mkdir(root);
const create = id => ({ type: 'create', id, kind: 'milestone', title: id, objective: 'original', order: 0 });
for (const root of roots.slice(0, 2)) await store.mutate(root, 0, create('checkpoint'));
const [a, b] = await Promise.all(roots.slice(0, 2).map(root => actions.attach(root)));
const request = { projectHandle: a.projectHandle, ownerId: a.snapshot.projectId, expectedRevision: 1,
    actions: [{ type: 'status', id: 'checkpoint', status: 'not-green' }] };
const beforeA = await readFile(join(roots[0], '.dope/roadmap.json'));
const beforeB = await readFile(join(roots[1], '.dope/roadmap.json'));
const failures = {};
const denied = async (name, operation, pattern) => {
    try { await operation(); throw new Error(`${name}: unexpectedly succeeded`); }
    catch (error) { if (!pattern.test(String(error))) throw error; failures[name] = String(error); }
};
await denied('foreign owner', () => actions.preview({ ...request, ownerId: b.snapshot.projectId }), /Foreign/);
await denied('foreign handle', () => actions.preview({ ...request, projectHandle: b.projectHandle }), /Foreign/);
await denied('unknown shell action', () => actions.preview({ ...request,
    actions: [{ type: 'shell', id: 'checkpoint', command: 'touch /tmp/dope-p13-unauthorized-marker' }] }), /Unknown planning action/);
await denied('gate promotion', () => actions.preview({ ...request,
    actions: [{ type: 'status', id: 'checkpoint', status: 'green' }] }), /gate promotion/);
const preview = await actions.preview(request);
assert.equal(preview.requiresApproval, true);
await denied('unapproved apply', () => actions.apply(request, preview.token, false), /approval required/);
assert.deepEqual(await readFile(join(roots[0], '.dope/roadmap.json')), beforeA);
assert.deepEqual(await readFile(join(roots[1], '.dope/roadmap.json')), beforeB);
await store.mutate(roots[0], 1, create('second'), a.snapshot.projectId);
await denied('stale revision', () => actions.apply(request, preview.token, true), /Stale Roadmap revision/);
await symlink(roots[0], join(base, 'symlink-root'));
await denied('symlink root', () => actions.attach(join(base, 'symlink-root')), /Invalid planning root/);

await mkdir(join(roots[2], 'docs/roadmap'), { recursive: true });
const source = join(roots[2], 'docs/roadmap/mvp-roadmap.md');
await writeFile(source, '# Roadmap\n## Phase 1 — Local\nStatus: NOT GREEN\nObjective: original\n');
const imported = await store.acceptImport(roots[2], 0, await previewRoadmapImport(roots[2]));
const linked = await actions.attach(roots[2]);
const item = imported.checkpoints.find(checkpoint => checkpoint.source);
assert.ok(item);
const linkedRequest = { projectHandle: linked.projectHandle, ownerId: imported.projectId,
    expectedRevision: imported.revision, sourceHashes: { [item.id]: item.source.sha256 },
    actions: [{ type: 'document-edit', id: item.id, objective: 'proposed' }] };
const linkedPreview = await actions.preview(linkedRequest);
const changedSource = '# Roadmap\n## Phase 1 — Local\nStatus: NOT GREEN\nObjective: external\n';
await writeFile(source, changedSource);
await denied('changed source after preview', () => actions.apply(linkedRequest, linkedPreview.token, true), /Stale linked Roadmap source fingerprint/);
assert.equal(await readFile(source, 'utf8'), changedSource);
assert.equal((await store.read(roots[2])).revision, imported.revision);

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
console.log(JSON.stringify({ base, failures, before: { a: sha256(beforeA), b: sha256(beforeB) },
    after: { aRevision: (await store.read(roots[0])).revision, b: sha256(await readFile(join(roots[1], '.dope/roadmap.json'))),
        linkedRevision: (await store.read(roots[2])).revision, linkedSource: sha256(await readFile(source)) },
    deniedCount: Object.keys(failures).length }, null, 2));
