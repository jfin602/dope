import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { RoadmapGreenfield } from '../../packages/project-intelligence/lib/node/roadmap-greenfield.js';
import type { GreenfieldChange, GreenfieldDraft } from '../../packages/project-intelligence/src/node/roadmap-greenfield.ts';
import type { RoadmapProjection } from '../../packages/project-intelligence/src/roadmap-projection.ts';
import { currentDraftChange, projectRoadmapDraft, roadmapCanvasConnectors } from '../../packages/theia-extension/src/browser/roadmap-canvas-model.ts';

const empty = (projectId: string): RoadmapProjection => ({ projectId, revision: 0, nodes: [], edges: [],
    pools: { ideas: [], issues: [] }, diagnostics: [] });

test('draft correction provenance and dependencies appear as provisional edges', () => {
    const draft: GreenfieldDraft = { revision: 4, phases: [
        { id: 'phase', title: 'Build', objective: '', checkpoints: [
            { id: 'first', title: 'First', objective: '' },
            { id: 'second', title: 'Second', objective: '', dependencies: ['first'] }] },
        { id: 'correction', title: 'Repair', objective: '', kind: 'correction', parentId: 'first', checkpoints: [] }] };
    const graph = projectRoadmapDraft(empty('project'), draft);
    assert.equal(graph.nodes.find(node => node.id === 'correction')?.kind, 'correction');
    assert.equal(graph.edges.find(edge => edge.id === 'draft-correction:first:correction')?.kind, 'branch');
    assert.equal(graph.edges.find(edge => edge.id === 'draft-dependency:first:second')?.kind, 'dependency');
});

test('validated preview, accepted edit and rejection project into one provisional graph without canonical mutation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-live-draft-'));
    try {
        const store = new RoadmapStore();
        const greenfield = new RoadmapGreenfield(store);
        const changes: GreenfieldChange[] = [];
        const off = greenfield.onChange(change => changes.push(change));
        const { handle } = await greenfield.begin(root);
        const projectId = (await store.read(root)).projectId;
        const preview = greenfield.previewEdit(handle, 0, { type: 'create-phase', title: 'Plan' });
        assert.deepEqual(changes.map(change => change.kind), ['proposed']);
        assert.equal(greenfield.read(handle).revision, 0);
        let graph = projectRoadmapDraft(empty(projectId), greenfield.read(handle), changes[0].draft);
        assert.equal(graph.nodes[0].draftState, 'proposed');
        assert.equal(graph.nodes[0].status, 'not-implemented');
        greenfield.clearEditPreview(handle);
        assert.equal(changes.at(-1)?.kind, 'cleared');
        graph = projectRoadmapDraft(empty(projectId), greenfield.read(handle));
        assert.equal(graph.nodes.length, 0);
        const approved = greenfield.previewEdit(handle, 0, { type: 'create-phase', title: 'Plan' });
        await greenfield.applyEdit(handle, approved, true);
        graph = projectRoadmapDraft(empty(projectId), greenfield.read(handle));
        assert.equal(graph.nodes[0].draftState, 'accepted');
        assert.equal(graph.nodes[0].statusLabel, 'Accepted draft · not implemented');
        const checkpoint = greenfield.previewEdit(handle, 1,
            { type: 'create-checkpoint', phaseId: approved.after.phases[0].id, title: 'First' });
        graph = projectRoadmapDraft(empty(projectId), greenfield.read(handle), checkpoint.after);
        assert.equal(graph.nodes.find(node => node.title === 'Plan')?.draftState, 'accepted');
        assert.equal(graph.nodes.find(node => node.title === 'First')?.draftState, 'proposed');
        assert.equal(roadmapCanvasConnectors(graph).length, 1);
        assert.equal((await store.read(root)).revision, 0);
        off();
        greenfield.clearEditPreview(handle);
        assert.equal(changes.at(-1)?.kind, 'proposed');
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('draft notifications reject duplicate, old, foreign and malformed updates', () => {
    const draft: GreenfieldDraft = { revision: 3, phases: [] };
    const state = { root: '/one', projectId: 'project', handle: 'handle', revision: 2, sequence: 5 };
    const change: GreenfieldChange = { root: '/one', projectId: 'project', handle: 'handle',
        revision: 2, epoch: 'process', sequence: 6, kind: 'proposed', draft };
    assert.equal(currentDraftChange(change, state), true);
    assert.equal(currentDraftChange({ ...change, draft: { revision: 5, phases: [] } }, state), true);
    assert.equal(currentDraftChange({ ...change, draft: { revision: 6, phases: [] } }, state), false);
    for (const altered of [{ sequence: 5 }, { sequence: 4 }, { root: '/two' }, { projectId: 'other' },
        { handle: 'other' }, { revision: 1 }, { draft: { revision: 2, phases: [] } },
        { sequence: Number.NaN }])
        assert.equal(currentDraftChange({ ...change, ...altered }, state), false);
    assert.equal(currentDraftChange({ ...change, kind: 'accepted', revision: 3 }, state), true);
    assert.equal(currentDraftChange({ ...change, kind: 'accepted' }, state), false);
});

test('provisional cards name their authority and route review through existing owners', () => {
    const source = (path: string) => readFileSync(resolve(import.meta.dirname, '../..', path), 'utf8');
    const widget = source('packages/theia-extension/src/browser/roadmap-canvas-widget.ts');
    const css = source('packages/theia-extension/src/browser/dope.css');
    assert.match(widget, /'Proposed · review required'/);
    assert.match(widget, /'Accepted draft · not yet canonical'/);
    assert.match(widget, /'Canonical Roadmap'/);
    assert.match(widget, /this\.renderDraftInspection\(\)/);
    assert.match(widget, /this\.setInspectionOpen\(true\)/);
    assert.match(widget, /this\.service\.applyDraftEdit\(state\.handle, preview, true\)/);
    assert.match(widget, /this\.service\.acceptDraft\(state\.handle, state\.preview, true\)/);
    assert.match(css, /\.dope-roadmap-draft-proposed \.dope-roadmap-node \{[^}]*var\(--dope-primary, var\(--theia-focusBorder\)\)/);
    assert.match(css, /body\.theia-light:not\(\.dope-dark\)/);
});

test('reload reattaches accepted draft and the event route targets the existing widget', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-live-draft-reload-'));
    try {
        const store = new RoadmapStore();
        const first = new RoadmapGreenfield(store);
        const { handle } = await first.begin(root);
        first.edit(handle, 0, { type: 'create-phase', title: 'Retained' });
        const second = new RoadmapGreenfield(new RoadmapStore());
        const recovered = await second.list(root);
        assert.equal(recovered[0].handle, handle);
        assert.equal(projectRoadmapDraft(empty((await store.read(root)).projectId), recovered[0].draft).nodes[0].title,
            'Retained');
        const source = (path: string) => readFileSync(resolve(import.meta.dirname, '../..', path), 'utf8');
        const frontend = source('packages/theia-extension/src/browser/frontend-module.ts');
        const widget = source('packages/theia-extension/src/browser/roadmap-canvas-widget.ts');
        assert.match(frontend, /getWidget<RoadmapCanvasWidget>\(ROADMAP_CANVAS_ID\)/);
        assert.match(frontend, /widget\?\.draftChanged\(change\)/);
        assert.match(widget, /draftChanged\(change: GreenfieldChange\)/);
        assert.match(widget, /const restored = index\.revision === 0 \? await this\.service\.recoverDrafts\(projectUri\)[\s\S]*?const draft = await this\.service\.readDraft\(this\.createState\.handle\)/);
        assert.match(widget, /this\.projection = this\.withDraft\(projectRoadmapTasks/);
        assert.match(widget.slice(widget.indexOf('draftChanged(change:'), widget.indexOf('private setSourceOpen(')),
            /this\.projection = this\.withDraft\([\s\S]*this\.render\(\)/);
    } finally { await rm(root, { recursive: true, force: true }); }
});
