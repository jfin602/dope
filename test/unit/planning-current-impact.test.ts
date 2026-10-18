import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { PlanningStore } from '../../packages/visual-planning/lib/node/planning-store.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { SoftwareMapIndex } from '../../packages/code-analysis/lib/node/software-map-index.js';
import { TypeScriptAnalyzer } from '../../packages/code-analysis-typescript/lib/index.js';
import { acceptInitialization, readInitialization } from '../../packages/code-analysis/lib/node/smap-initialization-file.js';
import { VisualPlanningBackend } from '../../packages/theia-extension/lib/node/visual-planning-backend.js';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'dope-impact-'));
  await mkdir(join(root, '.dope'));
  await mkdir(join(root, 'src/a'), { recursive: true });
  await mkdir(join(root, 'src/b'), { recursive: true });
  await writeFile(join(root, 'tsconfig.json'), JSON.stringify({ include: ['src/**/*.ts'] }));
  await writeFile(join(root, 'src/a/a.ts'), 'export const a = 1;\n');
  await writeFile(join(root, 'src/b/b.ts'), 'export const b = 2;\n');
  await writeFile(join(root, '.dope/architecture.json'), JSON.stringify({ schemaVersion: 1, systems: [
    { id: 'sys', name: 'System', purpose: 'Purpose', subsystems: [
      { id: 'a', name: 'A', purpose: 'Own A', roots: ['src/a'], components: [] },
      { id: 'b', name: 'B', purpose: 'Own B', roots: ['src/b'], components: [] }
    ] }
  ] }));
  await acceptInitialization(root, (await readInitialization(root)).declarationFingerprint);
  const roadmap = new RoadmapStore();
  const saved = await roadmap.mutate(root, 0, { type: 'create', id: 'checkpoint', kind: 'milestone',
    title: 'Change A', objective: 'Make A safer', order: 0 });
  const index = new SoftwareMapIndex(new TypeScriptAnalyzer());
  const backend = new VisualPlanningBackend(new PlanningStore(), index, roadmap);
  const handle = (await backend.attach(pathToFileURL(root).href)).projectHandle;
  const request = { projectHandle: handle, projectId: saved.projectId, checkpointId: 'checkpoint',
    expectedRoadmapRevision: saved.revision, branchIds: ['a'] };
  return { root, roadmap, index, backend, request };
}

test('current impact is scoped, bounded, source backed and read only without a model', async () => {
  const f = await fixture();
  try {
    const architectureBefore = await readFile(join(f.root, '.dope/architecture.json'));
    const roadmapBefore = await readFile(join(f.root, '.dope/roadmap.json'));
    const sourceBefore = await readFile(join(f.root, 'src/a/a.ts'));
    assert.equal((await f.backend.currentSoftwareImpact(f.request)).status, 'unavailable');
    for (let i = 0; i < 30; i++) await writeFile(join(f.root, `src/a/extra-${i}.ts`), `export const extra${i} = ${i};\n`);
    await f.index.analyze(f.root);
    const packet = await f.backend.currentSoftwareImpact(f.request);
    assert.equal(packet.status, 'ready');
    assert.equal(packet.checkpoint?.objective, 'Make A safer');
    assert.equal(packet.basis?.physicalGeneration, f.index.status(f.root).generation);
    assert.deepEqual(packet.branches.map(branch => branch.id), ['a']);
    assert.ok(packet.sources.some(source => source.path === 'src/a/a.ts'));
    assert.ok(packet.sources.every(source => source.path.startsWith('src/a/')));
    assert.ok(packet.sources.length <= packet.limits.maxPaths);
    assert.equal(packet.limits.truncated, true);
    assert.ok(Buffer.byteLength(JSON.stringify(packet)) <= packet.limits.maxBytes);
    assert.equal(packet.action.explicit, true);
    assert.deepEqual(await readFile(join(f.root, '.dope/architecture.json')), architectureBefore);
    assert.deepEqual(await readFile(join(f.root, '.dope/roadmap.json')), roadmapBefore);
    assert.deepEqual(await readFile(join(f.root, 'src/a/a.ts')), sourceBefore);
    assert.equal((await f.backend.currentSoftwareImpact({ ...f.request, projectId: 'foreign' })).status, 'unavailable');
    assert.equal((await f.backend.currentSoftwareImpact({ ...f.request, branchIds: [] })).status, 'ambiguous');
    assert.equal((await f.backend.currentSoftwareImpact({ ...f.request, branchIds: ['missing'] })).status, 'ambiguous');
    assert.equal((await f.backend.currentSoftwareImpact({ ...f.request, expectedRoadmapRevision: 0 })).status, 'stale');
    await writeFile(join(f.root, 'src/a/a.ts'), 'export const a = 3;\n');
    assert.equal((await f.backend.currentSoftwareImpact(f.request)).status, 'stale');
    await f.index.analyze(f.root);
    assert.equal((await f.backend.currentSoftwareImpact(f.request)).status, 'ready');
    const basis = await f.backend.currentBasis(f.request.projectHandle);
    const created = await f.backend.mutate({ projectHandle: f.request.projectHandle, expectedRevision: 0,
      operation: { type: 'create', id: 'plan', title: 'Plan', objective: 'A', basis } });
    const linked = await f.roadmap.mutate(f.root, f.request.expectedRoadmapRevision,
      { type: 'update', id: 'checkpoint', title: 'Change A', objective: 'Make A safer', order: 0,
        dependencies: [], links: [{ owner: 'planning-map', targetId: 'plan', ownerProjectId: created.projectId,
          ownerRevision: created.maps[0].revision, basis }] }, f.request.projectId);
    const linkedRequest = { ...f.request, expectedRoadmapRevision: linked.revision };
    assert.equal((await f.backend.currentSoftwareImpact(linkedRequest)).planningMap?.id, 'plan');
    await f.index.analyze(f.root);
    assert.equal((await f.backend.currentSoftwareImpact(linkedRequest)).status, 'ready'); // generation-only refresh
    await writeFile(join(f.root, 'src/a/a.ts'), 'export const a = 4;\n');
    await f.index.analyze(f.root);
    assert.equal((await f.backend.currentSoftwareImpact(linkedRequest)).status, 'stale');
    await rm(join(f.root, '.dope/smap.json'));
    assert.equal((await f.backend.currentSoftwareImpact(linkedRequest)).status, 'unavailable');
  } finally { f.backend.dispose(); await rm(f.root, { recursive: true, force: true }); }
});
