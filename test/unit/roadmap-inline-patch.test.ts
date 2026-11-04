import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProposedFieldDiff, ProposedPhaseNode, hasStructuralProposalChange, ProposalControlTab } from
    '../../packages/theia-extension/src/browser/roadmap-proposal-cards.ts';
import { proposalEntityOperations, proposalReviewScope } from
    '../../packages/theia-extension/src/browser/roadmap-proposal-selection.ts';
import { roadmapActionTargets, roadmapProposalPreview } from
    '../../packages/theia-extension/src/node/roadmap-proposal-presentation.ts';
import { assertRoadmapStageTargets } from
    '../../packages/theia-extension/src/node/roadmap-stage-overlap.ts';
import { parsePlanningActivity } from '../../packages/chat/lib/index.js';

const edit = { id: 'gate-1', action: 'edit' as const,
    before: { kind: 'gate' as const, id: 'gate-1', title: 'Set up the game',
        detail: 'Keep current purpose', parentId: 'phase-1', order: 0 },
    after: { kind: 'gate' as const, id: 'gate-1', title: 'Initialize LittleJS and game loop',
        detail: 'Keep current purpose', parentId: 'phase-1', order: 0 } };

test('title patch renders old and new at one outlined field with attached shared tabs', () => {
    const html = renderToStaticMarkup(React.createElement(ProposedFieldDiff,
        { change: edit, field: 'title', label: 'Gate title', operationIds: ['edit-1'] }));
    assert.match(html, /data-proposal-field="title"/);
    assert.match(html, /dope-roadmap-proposal-field-diff/);
    assert.match(html, /dope-roadmap-proposal-tab/);
    assert.match(html, /data-proposal-entity-id="gate-1"/);
    assert.match(html, /data-proposal-operation-ids="edit-1"/);
    assert.match(html, /<del>Set up the game<\/del>/);
    assert.match(html, /<ins>Initialize LittleJS and game loop<\/ins>/);
    assert.equal(renderToStaticMarkup(React.createElement(ProposedFieldDiff,
        { change: edit, field: 'purpose', label: 'Gate purpose' })), '');
    assert.equal(hasStructuralProposalChange(edit), false);
    assert.equal(hasStructuralProposalChange({ ...edit,
        after: { ...edit.after, order: 1 } }), false);
});

test('live controls are present but cannot approve until the stage is complete', () => {
    const live = renderToStaticMarkup(React.createElement(ProposalControlTab,
        { id: 'gate-1', scope: 'Gate title', provisional: true }));
    assert.equal((live.match(/disabled=""/g) ?? []).length, 3);
    assert.match(live, /data-provisional="true"/);
    const ready = renderToStaticMarkup(React.createElement(ProposalControlTab,
        { id: 'gate-1', scope: 'Gate title' }));
    assert.doesNotMatch(ready, /disabled=""/);
    assert.match(ready, /aria-label="Accept Gate title/);
    assert.match(ready, /aria-label="Reject Gate title/);
    assert.doesNotMatch(ready, /— review/);
});

test('dependency changes use the same field outline rather than a structural diff card', () => {
    const change = { ...edit, before: { ...edit.before, dependencies: ['gate-a'] },
        after: { ...edit.after, title: edit.before.title, dependencies: ['gate-b'] } };
    const html = renderToStaticMarkup(React.createElement(ProposedFieldDiff,
        { change, field: 'dependencies', label: 'Gate dependencies', operationIds: ['deps-1'] }));
    assert.match(html, /<del>gate-a<\/del>/);
    assert.match(html, /<ins>gate-b<\/ins>/);
    assert.match(html, /data-proposal-operation-ids="deps-1"/);
    assert.equal(hasStructuralProposalChange(change), false);
});

test('independent operation IDs stay selectable while reorder targets map to their entities', () => {
    const proposal = { operations: [
        { id: 'edit-1', type: 'gate.edit', targetId: 'gate-1', status: 'Pending' as const },
        { id: 'edit-2', type: 'gate.edit', targetId: 'gate-2', status: 'Pending' as const },
        { id: 'reorder', type: 'gate.reorder', targetId: 'phase-1',
            targetIds: ['gate-3', 'gate-4'], status: 'Pending' as const } ],
        preview: { entities: [] } } as any;
    assert.deepEqual(proposalEntityOperations(proposal, 'gate-1'), ['edit-1']);
    assert.deepEqual(proposalEntityOperations(proposal, 'gate-2'), ['edit-2']);
    assert.deepEqual(proposalEntityOperations(proposal, 'gate-4'), ['reorder']);
    assert.deepEqual(proposalReviewScope(proposal, ['edit-1'], 'apply'), ['edit-1']);
    assert.deepEqual(roadmapActionTargets({ type: 'gate.reorder', parentPhaseId: 'phase-1',
        ids: ['gate-3', 'gate-4'] }), ['gate-3', 'gate-4']);
});

test('saved native proposal retains validated operation target IDs', () => {
    const proposalId = randomUUID(), chatId = randomUUID(), messageId = randomUUID();
    const gateId = 'gate-one', operationId = randomUUID();
    const activity = { schemaVersion: 1, kind: 'roadmap-gate-proposal', status: 'pending', refs: [],
        proposalId, proposal: { id: proposalId, chatId, messageId,
            ownerId: 'owner-1', revision: 1, changedIds: [gateId],
            action: { type: 'native-stage-preview', id: 'owner-1' }, summary: 'One Gate edit',
            operations: [{ id: operationId, type: 'gate.edit', targetId: gateId,
                targetIds: [gateId], status: 'Pending' }] } };
    assert.deepEqual(parsePlanningActivity(activity).proposal?.operations?.[0].targetIds, [gateId]);
    assert.throws(() => parsePlanningActivity({ ...activity, proposal: { ...activity.proposal,
        operations: [{ ...activity.proposal.operations[0], targetIds: [''] }] } }),
    /Invalid saved Roadmap operations/);
});

test('overlapping direct edits cannot be staged as separate reviewable patches', () => {
    const operation = (id: string, type = 'gate.edit') => ({ action: { type, id } });
    assert.doesNotThrow(() => assertRoadmapStageTargets([
        operation('gate-1'), operation('gate-2') ] as any));
    assert.throws(() => assertRoadmapStageTargets([
        operation('gate-1'), operation('gate-1') ] as any), /OVERLAPPING_TARGETS/);
    assert.throws(() => assertRoadmapStageTargets([
        operation('gate-1'), operation('gate-1', 'gate.delete') ] as any), /OVERLAPPING_TARGETS/);
    assert.throws(() => assertRoadmapStageTargets([
        operation('gate-1'), operation('gate-1', 'gate.reparent') ] as any), /OVERLAPPING_TARGETS/);
    assert.throws(() => assertRoadmapStageTargets([
        operation('gate-1'), { action: { type: 'gate.reorder', ids: ['gate-1'] } } ] as any),
    /OVERLAPPING_TARGETS/);
    assert.doesNotThrow(() => assertRoadmapStageTargets([
        operation('gate-1', 'gate.create'), { action: { type: 'gate.reorder', ids: ['gate-1'] } } ] as any));
});

test('a change past the former short preview boundary remains visible', () => {
    const oldTitle = `${'A'.repeat(400)} old`;
    const newTitle = `${'A'.repeat(400)} new`;
    const before = { projectId: 'project', phases: [{ id: 'phase-1', title: oldTitle,
        objective: 'Purpose', order: 0, dependencies: [] }], gates: [], corrections: [] };
    const after = { ...before, phases: [{ ...before.phases[0], title: newTitle }] };
    const change = roadmapProposalPreview(before as any, after as any,
        [{ type: 'phase.edit', id: 'phase-1', title: newTitle, objective: 'Purpose' }],
        ['phase-1']).entities[0];
    const html = renderToStaticMarkup(React.createElement(ProposedFieldDiff,
        { change, field: 'title', label: 'Phase title' }));
    assert.match(html, / old<\/del>/);
    assert.match(html, / new<\/ins>/);
});

test('the shared generation card keeps its nested Gate and Criterion review controls', () => {
    const phase = { id: 'phase-new', action: 'create', after: { kind: 'phase', id: 'phase-new',
        title: 'Build', detail: 'Working result', order: 0 } };
    const gate = { id: 'gate-new', action: 'create', after: { kind: 'gate', id: 'gate-new',
        title: 'Verify', detail: 'Check the result', parentId: 'phase-new', order: 1,
        designation: 'G1', criteria: [{ id: 'criterion-new', title: 'Launch', expectedResult: 'Runs' }] } };
    const html = renderToStaticMarkup(React.createElement(ProposedPhaseNode,
        { data: { change: phase, children: [gate], source: false } } as any));
    assert.match(html, /data-phase-id="phase-new"/);
    assert.match(html, /data-proposal-gate-id="gate-new"/);
    assert.match(html, /style="order:101"/);
    assert.match(html, /Select Phase/);
    assert.match(html, /Select Gate/);
    assert.match(html, /Select Criterion/);
});
