import assert from 'node:assert/strict';
import test from 'node:test';
import { acceptsLiveRoadmapStage } from '../../packages/theia-extension/lib/browser/roadmap-live-stage.js';
import type { ChatRoadmapStageSnapshot } from '../../packages/chat/src/service.ts';

test('provisional stage accepts only the next source-bound snapshot from one proposal', () => {
    const snapshot = { proposalId: 'proposal', chatId: 'chat', turnId: 'turn', projectId: 'project',
        ownerId: 'owner', revision: 0, sourceHash: null, sequence: 1,
        expiresAt: Date.now() + 60_000, operationIds: ['one'], entityIds: ['phase'],
        counts: { phases: 1, gates: 0, criteria: 0 }, incompletePhaseIds: ['phase'], complete: false,
        preview: { source: 'validated-roadmap', steps: [], entities: [], totalChanged: 1,
            additionalChanges: 0, parentTitles: {} } } as ChatRoadmapStageSnapshot;
    const event = { chatId: 'chat', messageId: 'turn' };
    const basis = { projectId: 'project', revision: 0, sourceHash: null };
    const accepts = (next: ChatRoadmapStageSnapshot, live?: ChatRoadmapStageSnapshot,
        pending?: ChatRoadmapStageSnapshot, ended?: string) =>
        acceptsLiveRoadmapStage(next, event, basis, live, pending, ended);
    assert.equal(accepts(snapshot), true);
    assert.equal(accepts(snapshot, snapshot), false);
    assert.equal(accepts({ ...snapshot, sequence: 0 }), false);
    assert.equal(accepts({ ...snapshot, sequence: 2 }, snapshot), true);
    assert.equal(accepts({ ...snapshot, sequence: 2 }, undefined,
        { ...snapshot, sequence: 3 }), false);
    assert.equal(accepts({ ...snapshot, sequence: 2, proposalId: 'foreign' }, snapshot), false);
    assert.equal(accepts({ ...snapshot, sequence: 2, projectId: 'foreign' }), false);
    assert.equal(accepts({ ...snapshot, sequence: 2, revision: 1 }), false);
    assert.equal(accepts({ ...snapshot, sequence: 2, sourceHash: 'changed' }), false);
    assert.equal(accepts({ ...snapshot, sequence: 2, turnId: 'replay' }), false);
    assert.equal(accepts({ ...snapshot, sequence: 2, expiresAt: Date.now() - 1 }), false);
    assert.equal(accepts({ ...snapshot, sequence: 2 }, undefined, undefined, 'turn'), false);
});
