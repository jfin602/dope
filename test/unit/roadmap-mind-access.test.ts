import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { ProjectMindStore } from '../../packages/project-intelligence/lib/node/project-mind-store.js';
import { ProjectMindBackend } from '../../packages/theia-extension/lib/node/project-mind-backend.js';
import { ProjectMindController } from '../../packages/theia-extension/lib/browser/project-mind-controller.js';
import { openProjectMindOwner } from '../../packages/theia-extension/lib/browser/project-mind-navigation.js';

const now = '2026-10-12T12:00:00.000Z';
const artifact = (type: 'note' | 'idea' | 'question' | 'decision') => {
    const base = { schemaVersion: 2 as const, id: randomUUID(), type, title: `${type} title`,
        provenance: 'developer' as const, createdAt: now, updatedAt: now, archivedAt: null, links: [] };
    return type === 'decision' ? { ...base, status: 'proposed', decision: 'Original decision', context: '', rationale: '',
        consequences: '', alternatives: '', revisitConditions: '' } :
        type === 'question' ? { ...base, status: 'open', body: 'Original question' } :
            { ...base, status: type === 'idea' ? 'captured' : 'active', body: `Original ${type}` };
};

test('four Mind types remain discoverable and editable at their original owner, with byte-stable reads', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-roadmap-mind-'));
    const uri = pathToFileURL(root).toString();
    const store = new ProjectMindStore();
    try {
        for (const type of ['note', 'idea', 'question', 'decision'] as const) {
            const current = await store.read(root);
            await store.mutate(root, current?.revision ?? 0, { type: 'create', artifact: artifact(type) });
        }
        const path = join(root, '.dope/project-mind.json');
        const original = await readFile(path);
        const controller = new ProjectMindController(() => {
            let client: { notifyProjectMindChanged(event: { projectId: string; revision: number }): void } | undefined;
            const backend = new ProjectMindBackend(store, { notifyProjectMindChanged: event => client?.notifyProjectMindChanged(event) });
            return { attach: backend.attach.bind(backend), read: backend.read.bind(backend),
                mutate: backend.mutate.bind(backend), migrate: backend.migrate.bind(backend),
                dispose: () => backend.dispose(), setClient: value => { client = value; } };
        }, () => {});
        await controller.attach(uri);
        const widget = { id: 'dope-project-mind', isAttached: true, controller,
            currentMind: async () => controller.snapshot,
            navigateArtifact: async (id: string, workspace: string, projectId: string) =>
                controller.workspace === workspace && controller.projectId === projectId && await controller.refresh() && controller.select(id) };
        const shown: string[] = [];
        const open = (id?: string, workspace?: string) => openProjectMindOwner(async () => widget,
            async (target, area) => { assert.equal(target, widget); shown.push(area); }, id, workspace);
        assert.equal(await open(), true); // old restored widget and command route
        for (const item of controller.snapshot!.artifacts) {
            assert.equal(await open(item.id, uri), true);
            assert.equal(controller.draft?.id, item.id);
            assert.equal(controller.draft?.type, item.type);
        }
        assert.deepEqual(await readFile(path), original);
        assert.equal(await open(randomUUID(), uri), false);
        assert.equal(await open(controller.snapshot!.artifacts[0].id, pathToFileURL(tmpdir()).toString()), false);
        assert.equal(shown.length, 5);
        assert.ok(shown.every(area => area === 'right'));
        assert.deepEqual(await readFile(path), original);

        const note = controller.snapshot!.artifacts.find(item => item.type === 'note')!;
        controller.select(note.id);
        controller.edit('body', 'Explicit edit');
        assert.equal(await controller.save(), true);
        assert.equal((await store.read(root))!.artifacts.find(item => item.id === note.id)!.body, 'Explicit edit');
        assert.notDeepEqual(await readFile(path), original);
        controller.dispose();
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('corrupt Mind owner refuses exact navigation without rewriting its bytes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-roadmap-mind-corrupt-'));
    try {
        await writeFile(join(root, 'known-issues.md'), '# Known Issues\n');
        const store = new ProjectMindStore();
        await store.mutate(root, 0, { type: 'create', artifact: artifact('idea') });
        const path = join(root, '.dope/project-mind.json');
        await writeFile(path, '{broken');
        const bytes = await readFile(path);
        const widget = { id: 'dope-project-mind', isAttached: false, controller: { workspace: pathToFileURL(root).toString(), projectId: undefined },
            currentMind: async () => { try { return await store.read(root); } catch { return undefined; } },
            navigateArtifact: async () => true };
        let shown = 0;
        assert.equal(await openProjectMindOwner(async () => widget, async () => { shown++; }, randomUUID(), widget.controller.workspace), false);
        assert.equal(shown, 0);
        assert.deepEqual(await readFile(path), bytes);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('old layout widget factory and History exact owner route survive launcher retirement', () => {
    const module = readFileSync(new URL('../../packages/theia-extension/src/browser/frontend-module.ts', import.meta.url), 'utf8');
    const history = readFileSync(new URL('../../packages/theia-extension/src/browser/history-owner-navigation.ts', import.meta.url), 'utf8');
    assert.match(module, /id: PROJECT_MIND_ID, createWidget:/);
    assert.match(module, /dope\.projectMind\.open/);
    assert.doesNotMatch(module, /bindViewContribution\(bind, ProjectMindView\)/);
    assert.match(history, /widget\.navigateArtifact\(owner\.artifactId, workspace, entry\.ownerProjectId\)/);
});
