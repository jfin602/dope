import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ProjectPlanningActions } from '../../packages/project-intelligence/lib/node/project-planning-actions.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import type { RoadmapGateIndex } from '../../packages/project-intelligence/lib/node/roadmap-gate-domain.js';
import { RoadmapInspectorModel } from '../../packages/theia-extension/src/browser/roadmap-inspector-model.ts';
import { roadmapNextId } from '../../packages/theia-extension/src/browser/roadmap-canvas-model.ts';
import type { RoadmapIndex } from '../../packages/project-intelligence/src/node/roadmap-store.ts';
import type { RoadmapService } from '../../packages/theia-extension/src/roadmap-service.ts';

const root = 'file:///tmp/project';
const snapshot = (revision = 1, objective = 'Original', status: 'unknown' | 'not-green' = 'unknown'): RoadmapIndex => ({
    schemaVersion: 1, projectId: 'project', projectRoot: '/tmp/project', revision,
    checkpoints: [{ id: 'p1', kind: 'phase', title: 'Phase one', objective, order: 1, dependencies: [], links: [],
        status, readOnly: false, evidence: [] }]
});
const deferred = <T>() => {
    let release!: (value: T) => void;
    return { promise: new Promise<T>(resolve => { release = resolve; }), release };
};
const fake = (state: { index: RoadmapIndex; pending?: ReturnType<typeof deferred<any>>; applied: number; approved: boolean }): RoadmapService => ({
    read: async () => state.index,
    owners: async () => [],
    attach: async () => ({ projectHandle: 'handle', snapshot: state.index }),
    detach: async () => {},
    preview: async request => state.pending ? state.pending.promise : ({ token: 'a'.repeat(64), ownerId: 'project',
        revision: request.expectedRevision, changedIds: ['p1'], requiresApproval: request.actions.some(action => action.type === 'status'),
        next: snapshot(request.expectedRevision + 1, 'Edited', 'not-green') }),
    apply: async (_request, _token, approved) => { state.applied++; state.approved = approved; return state.index = snapshot(2, 'Edited', 'not-green'); },
    undo: async () => state.index = snapshot(3),
    undoToken: async () => 'undo-token'
});

test('Prepare Work requires a current canonical checkpoint and conveys requirements without writing', async () => {
    const state = { index: snapshot(), applied: 0, approved: false };
    const opened: unknown[] = [];
    const model = new RoadmapInspectorModel(fake(state), async () => {}, async selection => { opened.push(selection); });
    model.setSnapshot(root, state.index);
    assert.match(model.prepareWorkBlockedReason ?? '', /Select an approved canonical checkpoint/);
    model.select('p1');
    await model.prepareWork();
    assert.deepEqual(opened, [{ workspace: root, projectId: 'project', checkpointId: 'p1',
        title: 'Phase one', objective: 'Original', requirements: ['Original'], impactReferences: [],
        mapId: undefined, mapRevision: undefined, mapOwnerProjectId: undefined, mapBasis: undefined }]);
    assert.equal(state.applied, 0);
    model.change('objective', 'Pending');
    assert.match(model.prepareWorkBlockedReason ?? '', /Finish or discard/);
    model.discardEdit();
    state.index = { ...snapshot(), linkedDocument: { projectRoot: '/tmp/project', projectId: 'project',
        path: 'roadmap.md', sourceHash: 'a', sections: [], lastSynced: { sourceHash: 'a', roadmapRevision: 1 },
        syncState: 'source-changed' } };
    model.setSnapshot(root, state.index);
    assert.match(model.prepareWorkBlockedReason ?? '', /stale or unresolved/);
    state.index = snapshot();
    state.index.checkpoints[0].links.push({ owner: 'planning-map', targetId: 'foreign', ownerProjectId: 'other' });
    model.setSnapshot(root, state.index);
    assert.match(model.prepareWorkBlockedReason ?? '', /incomplete/);
    assert.equal(opened.length, 1);
    state.index = snapshot();
    state.index.checkpoints[0].links.push({ owner: 'planning-map', targetId: 'map', ownerProjectId: 'planning',
        ownerRevision: 2, basis: { architectureRevision: 1, architectureFingerprint: 'architecture',
            physicalGeneration: 1, physicalInputFingerprint: 'physical' } });
    model.setSnapshot(root, state.index);
    assert.equal(model.prepareWorkBlockedReason, undefined);
    await model.prepareWork();
    assert.equal((opened[1] as { mapId: string }).mapId, 'map');
    assert.equal((opened[1] as { mapOwnerProjectId: string }).mapOwnerProjectId, 'planning');
    state.index.checkpoints[0].links.push({ ...state.index.checkpoints[0].links[0], targetId: 'other-map' });
    model.setSnapshot(root, state.index);
    assert.match(model.prepareWorkBlockedReason ?? '', /one reviewed Planning Map/);
    assert.equal(opened.length, 2);
});

test('Prepare Work refuses a changed Roadmap and clears selection on project change', async () => {
    const state = { index: snapshot(), applied: 0, approved: false };
    const opened: unknown[] = [];
    const model = new RoadmapInspectorModel(fake(state), async () => {}, async selection => { opened.push(selection); });
    model.setSnapshot(root, state.index); model.select('p1');
    state.index = snapshot(2);
    await model.prepareWork();
    assert.equal(opened.length, 0);
    assert.match(model.error ?? '', /Roadmap changed/);
    model.setSnapshot('file:///tmp/other', { ...snapshot(), projectId: 'other', projectRoot: '/tmp/other' });
    assert.equal(model.selectedId, undefined);
    assert.match(model.prepareWorkBlockedReason ?? '', /Select an approved/);
});

test('Prepare Work carries reviewed plan constraints only from the current linked source', async () => {
    const index = snapshot();
    const hash = 'a'.repeat(64);
    index.linkedDocument = { projectRoot: '/tmp/project', projectId: 'project', path: 'ROADMAP.md',
        sourceHash: hash, sections: [{ sectionKey: 'p1', checkpointId: 'p1' }],
        lastSynced: { sourceHash: hash, roadmapRevision: 1 }, syncState: 'synced' };
    index.checkpoints[0].source = { path: 'ROADMAP.md', sha256: hash, line: 1, text: 'Phase one' };
    index.planOrigin = { planRevision: 2, planHash: 'b'.repeat(64), sourceHash: hash,
        constraints: ['Keep permissions explicit'],
        steps: [{ stepId: 'step', checkpointId: 'p1', expectedOutputs: ['History view'] }] };
    const state = { index, applied: 0, approved: false };
    const opened: { requirements: string[]; impactReferences: string[] }[] = [];
    const service = { ...fake(state), previewDocumentSync: async () => ({ state: 'unchanged',
        projectId: 'project', revision: 1 }) } as unknown as RoadmapService;
    const model = new RoadmapInspectorModel(service, async () => {}, async selection => { opened.push(selection); });
    model.setSnapshot(root, index); model.select('p1');
    await model.prepareWork();
    assert.deepEqual(opened[0].requirements, ['Original', 'Keep permissions explicit', 'History view']);
    assert.match(opened[0].impactReferences[0], /Reviewed plan/);
    index.linkedDocument.sourceHash = 'c'.repeat(64);
    model.setSnapshot(root, index);
    assert.match(model.prepareWorkBlockedReason ?? '', /Approved plan source changed/);
    assert.equal(opened.length, 1);
});

test('selection, edit, preview, approval and undo synchronize without inferred Green', async () => {
    const state = { index: snapshot(), applied: 0, approved: false };
    const model = new RoadmapInspectorModel(fake(state));
    let changes = 0;
    model.onChange(() => changes++);
    model.setSnapshot(root, state.index);
    model.select('p1');
    model.change('objective', 'Edited');
    model.change('status', 'not-green');
    await model.save();
    assert.equal(model.requiresApproval, true);
    assert.equal(state.applied, 0);
    assert.match(model.previewSummary ?? '', /not green/);
    await model.approve();
    assert.equal(state.approved, true);
    assert.equal(model.index?.revision, 2);
    assert.equal(model.draft?.objective, 'Edited');
    assert.ok(changes > 4);
    assert.ok(model.undo);
    await model.undoEdit();
    assert.equal(model.index?.revision, 3);
});

test('an unrelated revision invalidates the visible undo with a recovery explanation', async () => {
    const state = { index: snapshot(), applied: 0, approved: false };
    const model = new RoadmapInspectorModel(fake(state));
    model.setSnapshot(root, state.index);
    model.select('p1');
    model.change('objective', 'Edited');
    await model.save();
    assert.ok(model.undo);
    model.setSnapshot(root, snapshot(3, 'Edited'));
    assert.equal(model.undo, undefined);
    assert.match(model.error ?? '', /Undo is no longer available because the Roadmap changed/);
});

test('latency preserves draft and stale or foreign previews cannot apply', async () => {
    const pending = deferred<any>();
    const state = { index: snapshot(), pending, applied: 0, approved: false };
    const model = new RoadmapInspectorModel(fake(state));
    model.setSnapshot(root, state.index);
    model.select('p1');
    model.change('objective', 'My draft');
    const saving = model.save();
    await Promise.resolve();
    model.setSnapshot(root, snapshot(2, 'Other writer'));
    assert.equal(model.draft?.objective, 'My draft');
    pending.release({ token: 'a'.repeat(64), ownerId: 'project', revision: 1, changedIds: ['p1'],
        requiresApproval: false, next: snapshot(2) });
    await saving;
    assert.equal(state.applied, 0);
    assert.equal(model.draft?.objective, 'My draft');
    model.setSnapshot('file:///tmp/other', snapshot());
    assert.equal(model.draft, undefined);
});

test('store events refresh the selected detail and keep an in-progress draft', async () => {
    const state = { index: snapshot(), applied: 0, approved: false };
    const model = new RoadmapInspectorModel(fake(state));
    model.setSnapshot(root, state.index); model.select('p1');
    state.index = snapshot(2, 'External edit');
    await model.remoteChange({ root: '/tmp/project', projectId: 'project', revision: 2, changedIds: ['p1'] });
    assert.equal(model.draft?.objective, 'External edit');
    model.change('objective', 'My unsaved text');
    state.index = snapshot(3, 'Another edit');
    await model.remoteChange({ root: '/tmp/project', projectId: 'project', revision: 3, changedIds: ['p1'] });
    assert.equal(model.draft?.objective, 'My unsaved text');
    assert.equal(model.index?.revision, 3);
    state.index = snapshot(4, 'Foreign copy');
    await model.remoteChange({ root: '/tmp/another-project', projectId: 'project', revision: 4, changedIds: ['p1'] });
    assert.equal(model.index?.revision, 3);
});

test('greenfield publication replaces the provisional identity without a manual refresh', async () => {
    const provisional: RoadmapIndex = { schemaVersion: 1, projectId: 'uninitialized',
        projectRoot: '/tmp/project', revision: 0, checkpoints: [] };
    const state = { index: provisional, applied: 0, approved: false };
    const model = new RoadmapInspectorModel(fake(state));
    model.setSnapshot(root, provisional);
    state.index = snapshot(2, 'Published');
    await model.remoteChange({ root: '/tmp/project', projectId: 'project', revision: 1, changedIds: [] });
    assert.equal(model.index?.revision, 2);
    assert.equal(model.index?.projectId, 'project');
    assert.equal(model.index?.checkpoints[0]?.objective, 'Published');
    state.index = { ...snapshot(3), projectId: 'foreign' };
    await model.remoteChange({ root: '/tmp/project', projectId: 'foreign', revision: 3, changedIds: [] });
    assert.equal(model.index?.revision, 2);
});

test('errors stay visible, keyboard order is stable, and the canvas editor never forces Chat placement', async () => {
    const state = { index: snapshot(), applied: 0, approved: false };
    const service = fake(state);
    service.preview = async () => { throw new Error('Stale planning revision'); };
    const model = new RoadmapInspectorModel(service);
    model.setSnapshot(root, state.index); model.select('p1'); model.change('objective', 'Edited');
    await model.save();
    assert.match(model.error ?? '', /Stale planning revision/);
    assert.equal(model.draft?.objective, 'Edited');
    assert.equal(roadmapNextId(['p1', 'p2'], 'p1', 'ArrowDown'), 'p2');
    const widget = readFileSync(resolve(import.meta.dirname, '../../packages/theia-extension/src/browser/roadmap-inspector-widget.ts'), 'utf8');
    assert.doesNotMatch(widget, /AbstractViewContribution|area: 'left'/);
    assert.match(widget, /focus\(\)/);
    assert.match(widget, /role', this\.model\.error \? 'alert'/);
    assert.doesNotMatch(widget, /openChatPanel|activateWidget|CHAT_PANEL_ID/);
});

test('closing the editor can retain a pending preview, while explicit discard releases selection without a write', async () => {
    const state = { index: snapshot(), applied: 0, approved: false };
    const model = new RoadmapInspectorModel(fake(state));
    model.setSnapshot(root, state.index); model.select('p1');
    model.change('status', 'not-green');
    await model.save();
    assert.equal(model.requiresApproval, true);
    assert.equal(model.draft?.status, 'not-green');
    assert.equal(state.applied, 0);
    model.discardEdit();
    assert.equal(model.requiresApproval, false);
    assert.equal(model.dirty, false);
    assert.equal(model.draft?.status, 'unknown');
    assert.equal(state.applied, 0);
    const widget = readFileSync(resolve(import.meta.dirname, '../../packages/theia-extension/src/browser/roadmap-inspector-widget.ts'), 'utf8');
    assert.match(widget, /Discard draft and preview/);
    assert.match(widget, /this\.model\.discardEdit\(\)/);
});

test('a draft cannot grant Green without evidence authority', async () => {
    const state = { index: snapshot(), applied: 0, approved: false };
    const model = new RoadmapInspectorModel(fake(state));
    model.setSnapshot(root, state.index); model.select('p1');
    model.change('status', 'green');
    await model.save();
    assert.match(model.error ?? '', /require evidence authority/);
    assert.equal(state.applied, 0);
    assert.equal(model.requiresApproval, false);
    assert.equal(model.draft?.status, 'green');
});

test('linked source edits use document authority and expose the exact line diff for approval', async () => {
    const state = { index: snapshot(), applied: 0, approved: false };
    const source = state.index.checkpoints[0];
    source.source = { path: 'docs/roadmap/mvp-roadmap.md', sha256: 'a'.repeat(64), line: 2,
        text: '## Phase one' };
    let requestType = '';
    let sourceHash = '';
    const service = fake(state);
    service.preview = async request => {
        requestType = request.actions[0].type;
        sourceHash = request.sourceHashes?.p1 ?? '';
        return { token: 'a'.repeat(64), ownerId: 'project', revision: 1, changedIds: ['p1'],
            requiresApproval: true, next: snapshot(2, 'Edited'), documentDiff: {
                path: source.source!.path, beforeHash: source.source!.sha256, afterHash: 'b'.repeat(64),
                changedLines: [{ before: 'Objective: Original', after: 'Objective: Edited' }] } };
    };
    const model = new RoadmapInspectorModel(service);
    model.setSnapshot(root, state.index); model.select('p1'); model.change('objective', 'Edited');
    await model.save();
    assert.equal(requestType, 'document-edit');
    assert.equal(sourceHash, 'a'.repeat(64));
    assert.match(model.previewSummary ?? '', /- Objective: Original\n\+ Objective: Edited/);
    assert.equal(state.applied, 0);
});

test('real planning service creates, approves and reloads a selected Gate without granting Green', async () => {
    const project = await mkdtemp(join(tmpdir(), 'dope-gate-inspector-'));
    try {
        const store = new RoadmapStore();
        await store.saveGateIndex(project, 0, 'uninitialized', { schemaVersion: 2, projectId: 'owner-1',
            projectRoot: project, revision: 1, phases: [], gates: [], corrections: [] });
        await store.mutateGateIndex(project, 1, 'owner-1', { type: 'phase.create', id: 'phase-1',
            title: 'Phase One', objective: 'Deliver one' });
        const actions = new ProjectPlanningActions(store);
        const service = {
            read: async () => store.read<RoadmapGateIndex>(project) as unknown as RoadmapIndex,
            attach: async () => actions.attach(project), detach: async (handle: string) => actions.detach(handle),
            preview: async (request: Parameters<ProjectPlanningActions['preview']>[0]) => actions.preview(request),
            apply: async (request: Parameters<ProjectPlanningActions['apply']>[0], token: string, approved: boolean) =>
                actions.apply(request, token, approved),
            undoToken: async (handle: string, ownerId: string) => actions.undoToken(handle, ownerId),
            undo: async (request: Parameters<ProjectPlanningActions['undoEligible']>[0]) => actions.undoEligible(request)
        } as unknown as RoadmapService;
        const uri = pathToFileURL(project).href;
        const model = new RoadmapInspectorModel(service);
        model.setSnapshot(uri, await service.read(uri));
        await model.proposeGate('phase-1', 'gate-1', 'G1', 'Review', 'Verify result', [
            { id: 'criterion-1', title: 'Visible', expectedResult: 'Result is visible' }]);
        assert.equal(model.requiresApproval, true);
        assert.equal((await store.read<RoadmapGateIndex>(project)).gates.length, 0);
        await model.approve();
        assert.equal(model.selectedId, 'gate-1');
        assert.equal(model.selectedGate?.qualificationStatus, 'unknown');
        model.changeGate('purpose', 'Verify saved result');
        await model.saveGate();
        assert.equal(model.requiresApproval, true);
        await model.approve();
        assert.equal(model.selectedGate?.purpose, 'Verify saved result');
        model.setSnapshot(uri, await service.read(uri));
        assert.equal(model.selectedId, 'gate-1');
        assert.equal(model.selectedGate?.purpose, 'Verify saved result');
        const reloaded = new RoadmapInspectorModel(service);
        reloaded.setSnapshot(uri, await service.read(uri));
        reloaded.select('gate-1');
        assert.equal(reloaded.selectedGate?.purpose, 'Verify saved result');
        assert.equal(reloaded.selectedGate?.qualificationStatus, 'unknown');
        assert.match(reloaded.prepareWorkBlockedReason ?? '', /Gate-scoped Prepare Work needs planning/);
        const beforePrepare = JSON.stringify(await store.read<RoadmapGateIndex>(project));
        await reloaded.prepareWork();
        assert.equal(JSON.stringify(await store.read<RoadmapGateIndex>(project)), beforePrepare);
        await reloaded.proposeGate('phase-1', 'bad\0id', 'G2', 'Invalid', 'Invalid', [
            { id: 'criterion-2', title: 'Visible', expectedResult: 'Visible' }]);
        assert.match(reloaded.error ?? '', /Invalid|identity/);
        assert.equal((await store.read<RoadmapGateIndex>(project)).gates.length, 1);
    } finally { await rm(project, { recursive: true, force: true }); }
});
