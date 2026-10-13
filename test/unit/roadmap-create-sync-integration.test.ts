import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { discoverRoadmapCandidates, previewRoadmapImport } from '../../packages/project-intelligence/lib/node/roadmap-import.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { RoadmapGreenfield } from '../../packages/project-intelligence/lib/node/roadmap-greenfield.js';
import { projectRoadmapTasks } from '../../packages/project-intelligence/lib/roadmap-task-projection.js';
import { discoverRoadmapTaskStacks } from '../../packages/agent-core/lib/node/roadmap-task-discovery.js';
import { RoadmapInspectorModel } from '../../packages/theia-extension/src/browser/roadmap-inspector-model.ts';
import { resolveRoadmapPromptSource } from '../../packages/theia-extension/src/node/roadmap-prompt-open.ts';
import type { RoadmapService } from '../../packages/theia-extension/src/roadmap-service.ts';

const markdown = '# Roadmap\n\n## Product Phase 10 — Planning\nStatus: **NOT GREEN**\nObjective: Original\nUnmapped developer note.\n';
const task = (number: number, closeout: boolean) =>
    `TASK: Correction 10 / P${number} — ${closeout ? 'Closeout' : 'Repair'}\n` +
    '- Recommended configuration: `GPT-6 Sol High`.\n' +
    `- Browser required: ${closeout ? 'yes' : 'no'}.\n` +
    '- Required unchanged project version: `0.10.16`.\n';

test('selected Markdown, linked edits, external conflict and read-only correction prompt remain distinct owners', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-roadmap-cross-owner-'));
    const file = join(root, 'ROADMAP.md');
    const taskDir = join(root, 'docs/tasks/c10-repair');
    try {
        await mkdir(join(root, '.git'));
        await mkdir(join(root, '.git/objects'));
        await mkdir(join(root, '.git/refs/heads'), { recursive: true });
        await writeFile(join(root, '.git/HEAD'), 'ref: refs/heads/main\n');
        await writeFile(join(root, '.git/config'), '[core]\n\trepositoryformatversion = 0\n\tbare = false\n');
        await writeFile(file, markdown);
        await mkdir(taskDir, { recursive: true });
        await writeFile(join(taskDir, 'P1-repair.txt'), task(1, false));
        await writeFile(join(taskDir, 'P2-closeout.txt'), task(2, true));
        const discovered = await discoverRoadmapCandidates(root);
        assert.deepEqual(discovered.candidates.map(item => item.path), ['ROADMAP.md']);
        const preview = await previewRoadmapImport(root, 'ROADMAP.md');
        assert.equal((await new RoadmapStore().read(root)).revision, 0);
        const store = new RoadmapStore();
        let index = await store.acceptImport(root, 0, preview);
        const id = index.checkpoints[0].id;
        assert.equal(index.checkpoints[0].status, 'not-green');
        assert.equal(index.linkedDocument?.path, 'ROADMAP.md');

        const stacks = await discoverRoadmapTaskStacks(root);
        const branch = stacks.find(item => item.folderName === 'c10-repair')!;
        assert.equal(branch.diagnostic, undefined);
        assert.equal(branch.executable, false);
        const projection = projectRoadmapTasks(index, stacks);
        const prompt = projection.nodes.find(item => item.kind === 'prompt' && item.taskSource?.number === 1)!;
        assert.ok(prompt);
        assert.ok(projection.edges.some(edge => edge.label === 'Correction branch'));
        assert.equal(prompt.status, 'unknown');
        const opened: string[] = [];
        let workCalls = 0;
        const service = { resolvePromptSource: (_uri: string, path: string, hash: string) =>
            resolveRoadmapPromptSource(root, path, hash),
        apply: async () => { workCalls++; throw new Error('Work must not run'); } } as unknown as RoadmapService;
        const inspector = new RoadmapInspectorModel(service, async uri => { opened.push(uri); });
        inspector.setSnapshot(pathToFileURL(root).href, index);
        inspector.selectTask(prompt);
        assert.deepEqual(opened, []);
        await inspector.openPrompt();
        assert.deepEqual(opened, [pathToFileURL(join(taskDir, 'P1-repair.txt')).href]);
        assert.equal(workCalls, 0);
        await assert.rejects(resolveRoadmapPromptSource(root, prompt.taskSource!.path!, '0'.repeat(64)), /Refresh.*relink/);

        // Inspector and Chat both dispatch document-edit through this checked owner path.
        const actions = (await import('../../packages/project-intelligence/lib/node/project-planning-actions.js')).ProjectPlanningActions;
        const planning = new actions(store);
        const { projectHandle } = await planning.attach(root);
        const request = { projectHandle, ownerId: index.projectId, expectedRevision: index.revision,
            sourceHashes: { [id]: index.checkpoints[0].source!.sha256 },
            actions: [{ type: 'document-edit' as const, id, objective: 'Approved' }] };
        const edit = await planning.preview(request);
        assert.equal(edit.requiresApproval, true);
        await assert.rejects(planning.apply(request, edit.token), /approval required/);
        assert.equal(await readFile(file, 'utf8'), markdown);
        index = await planning.apply(request, edit.token, true);
        assert.equal(index.checkpoints[0].status, 'not-green');
        assert.match(await readFile(file, 'utf8'), /Objective: Approved\nUnmapped developer note\./);
        assert.equal((await new RoadmapStore().previewDocumentSync(root)).state, 'unchanged');
        await assert.rejects(planning.preview({ ...request, expectedRevision: index.revision }), /Stale or unsupported linked Roadmap section/);
        await assert.rejects(planning.preview({ ...request, ownerId: 'foreign', expectedRevision: index.revision }), /Foreign/);
        await assert.rejects(planning.preview({ ...request, expectedRevision: index.revision,
            sourceHashes: { [id]: index.checkpoints[0].source!.sha256 },
            actions: [{ type: 'status', id, status: 'green' } as never] }), /gate promotion/);

        const external = (await readFile(file, 'utf8')).replace('Objective: Approved', 'Objective: External');
        await writeFile(file, external);
        const change = await store.previewDocumentSync(root);
        assert.equal(change.state, 'source-changed');
        await writeFile(file, external.replace('External', 'Later'));
        await assert.rejects(store.applyDocumentSync(root, change), /Stale linked/);
        assert.equal((await store.read(root)).checkpoints[0].objective, 'Approved');
        const accepted = await store.applyDocumentSync(root, await store.previewDocumentSync(root));
        assert.equal(accepted.checkpoints[0].objective, 'Later');
        assert.equal(accepted.checkpoints[0].status, 'not-green');
        assert.equal((await new RoadmapStore().read(root)).checkpoints[0].objective, 'Later');
        await writeFile(file, (await readFile(file, 'utf8')).replace('Objective: Later', 'Objective: Conflict\nObjective: duplicate'));
        assert.equal((await store.previewDocumentSync(root)).state, 'conflict');
        assert.equal((await store.read(root)).checkpoints[0].objective, 'Later');
        await rename(file, join(root, 'MOVED.md'));
        assert.equal((await new RoadmapStore().previewDocumentSync(root)).state, 'relink-needed');
        assert.equal((await new RoadmapStore().read(root)).linkedDocument?.path, 'ROADMAP.md');
        await assert.rejects(store.acceptImport(root, accepted.revision,
            await previewRoadmapImport(root, 'MOVED.md'), accepted.projectId), /explicit relink is required/);
        assert.equal((await readFile(join(root, 'MOVED.md'), 'utf8')).includes('Objective: Conflict'), true);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('manual greenfield preview creates a linked document only after approval; historical gates retain source truth', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-roadmap-greenfield-integration-'));
    try {
        const store = new RoadmapStore();
        const greenfield = new RoadmapGreenfield(store);
        const { handle } = await greenfield.begin(root);
        const phase = greenfield.edit(handle, 0, { type: 'create-phase', title: 'Build', objective: 'Human intent' });
        greenfield.edit(handle, 1, { type: 'create-checkpoint', phaseId: phase.phases[0].id, title: 'First' });
        assert.throws(() => greenfield.preview(handle, '../outside.md'), /Unsafe/);
        const preview = greenfield.preview(handle, 'ROADMAP.md');
        await assert.rejects(greenfield.accept(handle, preview, false), /approval/);
        await assert.rejects(readFile(join(root, 'ROADMAP.md')), /ENOENT/);
        const created = await greenfield.accept(handle, preview, true);
        assert.equal(created.linkedDocument?.syncState, 'synced');
        assert.equal(await readFile(join(root, 'ROADMAP.md'), 'utf8'), preview.markdown);
        assert.equal((await new RoadmapStore().read(root)).checkpoints.length, 2);

        const historical = await previewRoadmapImport(process.cwd());
        const status = (phase: number) => historical.checkpoints.find(item => item.sectionKey === `phase-${phase}`)?.status;
        assert.equal(status(6), 'waived');
        assert.equal(status(7), 'green');
        assert.equal(status(10), 'not-green');
    } finally { await rm(root, { recursive: true, force: true }); }
});
