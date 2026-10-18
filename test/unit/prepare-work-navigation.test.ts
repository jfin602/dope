import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyPrepareWorkNavigation, type PrepareWorkPlanningView } from '../../packages/theia-extension/src/browser/prepare-work-navigation.ts';
import type { PlanningMap } from '../../packages/visual-planning/src/index.ts';

const workspace = 'file:///tmp/bridge-a';
const basis = { architectureRevision: 0, architectureFingerprint: 'architecture',
    physicalInputFingerprint: 'source', physicalGeneration: 1 };
const map = { id: 'existing', projectId: 'planning-owner', revision: 2, basis, status: 'draft' } as PlanningMap;
const software = { workspace, status: { state: 'ready' as const },
    initialization: { state: 'initialized' as const, declarationPresent: true, declarationFingerprint: 'architecture' } };
const selection = { workspace, projectId: 'roadmap-owner', mapId: 'existing', mapRevision: 2,
    mapOwnerProjectId: 'planning-owner', mapBasis: basis };
const planning = (): PrepareWorkPlanningView => ({ focusWorkspace: workspace,
    collection: { schemaVersion: 1, projectId: 'planning-owner', revision: 3, maps: [map] },
    navigationCurrentMap: async () => map });

test('Prepare Work accepts independent owner IDs only under the same attached workspace and exact current map', async () => {
    assert.deepEqual(await verifyPrepareWorkNavigation(selection, software as never, planning()),
        { projectId: 'planning-owner', revision: 3, existingMapId: undefined });
    assert.deepEqual(await verifyPrepareWorkNavigation({ workspace, projectId: 'roadmap-owner' },
        software as never, planning()), { projectId: 'planning-owner', revision: 3, existingMapId: 'existing' });
    await assert.rejects(verifyPrepareWorkNavigation({ workspace, projectId: 'roadmap-owner' }, software as never,
        { ...planning(), navigationCurrentMap: async () => undefined }), /basis changed/);
    await assert.rejects(verifyPrepareWorkNavigation({ ...selection, workspace: 'file:///tmp/bridge-b' },
        software as never, planning()), /unavailable/);
    await assert.rejects(verifyPrepareWorkNavigation(selection, software as never,
        { ...planning(), collection: { schemaVersion: 1, projectId: 'foreign', revision: 1, maps: [] } }), /foreign owner/);
    await assert.rejects(verifyPrepareWorkNavigation({ ...selection, mapRevision: 1 }, software as never, planning()), /stale/);
    await assert.rejects(verifyPrepareWorkNavigation({ ...selection, mapBasis: { ...basis, physicalInputFingerprint: 'changed' } },
        software as never, planning()), /stale/);
    await assert.rejects(verifyPrepareWorkNavigation(selection, software as never,
        { ...planning(), navigationCurrentMap: async () => undefined }), /stale/);
    await assert.rejects(verifyPrepareWorkNavigation(selection,
        { ...software, initialization: { ...software.initialization, state: 'uninitialized' as const } } as never,
        planning()), /unavailable/);
});

test('Prepare Work rejects a Planning owner or revision switch during the fresh map read', async () => {
    const state = planning();
    const changedOwner = { ...state, navigationCurrentMap: async () => {
        changedOwner.collection = { schemaVersion: 1, projectId: 'foreign', revision: 1, maps: [] };
        return map;
    } };
    await assert.rejects(verifyPrepareWorkNavigation(selection, software as never, changedOwner), /Project changed/);
    const changedRevision = { ...planning(), navigationCurrentMap: async () => {
        changedRevision.collection = { ...changedRevision.collection!, revision: 4 };
        return map;
    } };
    await assert.rejects(verifyPrepareWorkNavigation(selection, software as never, changedRevision), /Project changed/);
});
