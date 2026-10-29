import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { previewRoadmapImport, roadmapSectionKey } from '../../packages/project-intelligence/lib/node/roadmap-import.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';

const source = `# Roadmap
## Phase 1 [id: phase-one]: First
Objective: Deliver first
### Gate G1 [id: gate-one] [phase: phase-one]: Check first
Objective: Prove first
- Criterion C1 [id: criterion-one]: Result one — Expected: one is visible
- Criterion C2 [id: criterion-two]: Result two — Expected: two is visible
## Phase 2 [id: phase-two]: Second
Objective: Deliver second
### Gate G1 [id: gate-two] [phase: phase-two]: Check second
Objective: Prove second
- Criterion C1 [id: criterion-three]: Result three — Expected: three is visible
### Correction Repair [id: correction-one] [gate: gate-two]: Repair second
## Phase 3 [id: phase-three]: Third
Objective: Deliver third
### Gate G1 [id: gate-three] [phase: phase-three]: Check third
Objective: Prove third
- Criterion C1 [id: criterion-four]: Result four — Expected: four is visible
Status: GREEN
## Unrelated prose
- Build a feature
- [x] Complete a task
`;
const fixture = async (body: string, run: (root: string, path: string) => Promise<void>): Promise<void> => {
    const root = await mkdtemp(join(tmpdir(), 'dope-gate-import-'));
    const path = join(root, 'ROADMAP.md');
    try { await writeFile(path, body); await run(root, path); }
    finally { await rm(root, { recursive: true, force: true }); }
};

test('explicit three-phase source previews and persists schema 2 without touching Markdown', async () => fixture(source, async (root, path) => {
    const before = await readFile(path);
    const hash = createHash('sha256').update(before).digest('hex');
    const preview = await previewRoadmapImport(root, 'ROADMAP.md');
    assert.deepEqual(preview.gateSource.diagnostics, []);
    assert.deepEqual(preview.gateSource.phases.map(item => item.id), ['phase-one', 'phase-two', 'phase-three']);
    assert.deepEqual(preview.gateSource.gates.map(item => item.parentPhaseId), ['phase-one', 'phase-two', 'phase-three']);
    assert.deepEqual(preview.gateSource.gates[0].criteria.map(item => item.id), ['criterion-one', 'criterion-two']);
    assert.equal(preview.gateSource.gates[0].source.line, 4);
    assert.equal(preview.gateSource.gates[0].criteria[0].source.line, 6);
    assert.equal(preview.gateSource.gates[0].source.sha256, hash);
    assert.deepEqual(await readFile(path), before);
    assert.deepEqual(await readdir(root), ['ROADMAP.md']);
    assert.equal(roadmapSectionKey('Gate G1 [id: gate-one] [phase: phase-one]: Check first', true), 'gate-one');
    assert.equal(roadmapSectionKey('- Criterion C1 [id: criterion-one]: Result one — Expected: one is visible', true), 'criterion-one');
    const store = new RoadmapStore();
    const saved = await store.acceptGateImport(root, 0, 'owner-one', preview);
    assert.equal(saved.schemaVersion, 2);
    assert.equal(saved.linkedDocument?.sourceHash, hash);
    assert.deepEqual(saved.linkedDocument?.sections.map(item => item.kind),
        ['phase', 'phase', 'phase', 'gate', 'criterion', 'criterion', 'gate', 'criterion', 'gate', 'criterion', 'correction']);
    assert.equal(saved.phases[0].gateSetCoverage.status, 'unreviewed');
    assert.ok(saved.gates.every(item => item.qualificationStatus === 'unknown' && item.criteria.every(c => !c.evidence.length)));
    assert.deepEqual(await new RoadmapStore().read(root), saved);
    assert.deepEqual(await readFile(path), before);
    await assert.rejects(store.acceptGateImport(root, 1, 'owner-one', preview), /replacement/);
}));

test('phase-only is valid but incomplete; generic tasks never create Gates', async () => fixture(
    '# Roadmap\n## Phase 1 [id: phase-one]: First\nObjective: Deliver first\n- Build feature\n- [ ] Ship task\n', async (root, path) => {
        const preview = await previewRoadmapImport(root, 'ROADMAP.md');
        assert.equal(preview.gateSource.gates.length, 0);
        const saved = await new RoadmapStore().acceptGateImport(root, 0, 'owner-one', preview);
        assert.equal(saved.phases.length, 1);
        assert.equal(saved.gates.length, 0);
        assert.equal(saved.phases[0].qualificationStatus, 'unknown');
        assert.match(await readFile(path, 'utf8'), /Build feature/);
    }));

test('task-only, duplicate IDs, ambiguous parent and correction owner reject without index or source writes', async () => {
    for (const body of [
        '# Roadmap\n- Build feature\n- [ ] Ship task\n',
        source.replace('[id: gate-two]', '[id: gate-one]'),
        source.replace('[phase: phase-two]', '[phase: maybe-two]'),
        source.replace('[gate: gate-two]', '[gate: absent]'),
        source.replace('[phase: phase-two]', ''),
        source.replace('Objective: Prove second\n', ''),
    ]) await fixture(body, async (root, path) => {
        const before = await readFile(path);
        const preview = await previewRoadmapImport(root, 'ROADMAP.md');
        await assert.rejects(new RoadmapStore().acceptGateImport(root, 0, 'owner-one', preview), /incomplete or ambiguous/);
        assert.deepEqual(await readFile(path), before);
        assert.deepEqual(await readdir(root), ['ROADMAP.md']);
    });
});

test('source drift rejects a reviewed import and preserves original owner state', async () => fixture(source, async (root, path) => {
    const preview = await previewRoadmapImport(root, 'ROADMAP.md');
    await writeFile(path, `${source}\nOther prose\n`);
    await assert.rejects(new RoadmapStore().acceptGateImport(root, 0, 'owner-one', preview), /preview or source changed/);
    assert.deepEqual(await readdir(root), ['ROADMAP.md']);
}));
