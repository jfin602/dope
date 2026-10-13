import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

test('errors stay visible, keyboard order is stable, and view never forces Chat placement', async () => {
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
    assert.match(widget, /area: 'left'/);
    assert.match(widget, /focus\(\)/);
    assert.match(widget, /role', this\.model\.error \? 'alert'/);
    assert.doesNotMatch(widget, /openChatPanel|activateWidget|CHAT_PANEL_ID/);
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
