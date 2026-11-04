import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatPlanningProposal } from '../../packages/chat/src/service.ts';
import { proposalEntityOperations, proposalReviewScope } from '../../packages/theia-extension/lib/browser/roadmap-proposal-selection.js';

function fixture(): ChatPlanningProposal {
    const operations: NonNullable<ChatPlanningProposal['operations']> = [];
    const entities: NonNullable<ChatPlanningProposal['preview']>['entities'] = [];
    for (let index = 1; index <= 5; index++) {
        const phase = `phase-${index}`, gate = `gate-${index}`, criterion = `criterion-${index}`;
        operations.push({ id: `op-p${index}`, type: 'phase.create', targetId: phase, status: 'Pending' },
            { id: `op-g${index}`, type: 'gate.create', targetId: gate, status: 'Pending' });
        entities.push({ id: phase, action: 'create', after: { kind: 'phase', id: phase, title: `Phase ${index}` } },
            { id: gate, action: 'create', after: { kind: 'gate', id: gate, parentId: phase,
                title: `Gate ${index}`, criteria: [{ id: criterion, title: 'Observe', expectedResult: 'Visible result' }] } },
            { id: criterion, action: 'create', after: { kind: 'criterion', id: criterion,
                parentId: gate, title: 'Observe', detail: 'Visible result' } });
    }
    return { id: 'proposal', chatId: 'chat', messageId: 'message', ownerId: 'owner', revision: 0,
        changedIds: entities.map(entity => entity.id), action: { type: 'roadmap.native', id: 'proposal' },
        summary: 'Five phases', operations, preview: { source: 'validated-roadmap', steps: [], entities,
            totalChanged: entities.length, additionalChanges: 0, parentTitles: {} } };
}

test('visible Phase group, Gate and embedded Criterion resolve exact pending operation IDs', () => {
    const proposal = fixture();
    assert.deepEqual(proposalEntityOperations(proposal, 'phase-1'), ['op-p1']);
    assert.deepEqual(proposalEntityOperations(proposal, 'phase-1', true), ['op-p1', 'op-g1']);
    assert.deepEqual(proposalEntityOperations(proposal, 'gate-1'), ['op-g1']);
    assert.deepEqual(proposalEntityOperations(proposal, 'criterion-1'), ['op-g1']);
    assert.deepEqual(proposalEntityOperations(proposal, 'unknown', true), []);
    assert.equal(proposal.operations?.length, 10);
    assert.equal(proposal.preview?.entities.length, 15);
});

test('applied operations cannot be reselected and unrelated phases remain independent', () => {
    const proposal = fixture();
    proposal.operations![1].status = 'Applied';
    assert.deepEqual(proposalEntityOperations(proposal, 'criterion-1'), []);
    assert.deepEqual(proposalEntityOperations(proposal, 'phase-1', true), ['op-p1']);
    assert.deepEqual(proposalEntityOperations(proposal, 'phase-5', true), ['op-p5', 'op-g5']);
});

test('a separately staged Criterion selects only its own operation', () => {
    const proposal = fixture();
    proposal.operations!.push({ id: 'op-c1', type: 'criterion.add', targetId: 'criterion-1', status: 'Pending' });
    assert.deepEqual(proposalEntityOperations(proposal, 'criterion-1'), ['op-c1']);
    assert.deepEqual(proposalEntityOperations(proposal, 'phase-1', true), ['op-p1', 'op-g1', 'op-c1']);
    proposal.operations!.at(-1)!.status = 'Rejected';
    assert.deepEqual(proposalEntityOperations(proposal, 'criterion-1'), []);
});

test('review closes child Apply over its creator and parent Reject over descendants', () => {
    const proposal = fixture();
    assert.deepEqual(proposalReviewScope(proposal, ['op-g1'], 'apply'), ['op-p1', 'op-g1']);
    assert.deepEqual(proposalReviewScope(proposal, ['op-p1'], 'reject'), ['op-p1', 'op-g1']);
    assert.deepEqual(proposalReviewScope(proposal, ['op-g1'], 'reject'), ['op-g1']);
    assert.deepEqual(proposalReviewScope(proposal, ['op-p1'], 'apply'), ['op-p1']);
    proposal.operations!.push({ id: 'op-c1', type: 'criterion.add', targetId: 'criterion-1', status: 'Pending' });
    assert.deepEqual(proposalReviewScope(proposal, ['op-c1'], 'apply'), ['op-p1', 'op-g1', 'op-c1']);
    assert.deepEqual(proposalReviewScope(proposal, ['op-p1'], 'reject'), ['op-p1', 'op-g1', 'op-c1']);
});
