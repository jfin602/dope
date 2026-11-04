import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { RoadmapNativeStageOwner } from '../../packages/theia-extension/lib/node/roadmap-native-stage.js';
import { NextPhaseLoader, ProposedPhaseNode, ProposedChange, ProposedGateCard, proposedFieldEditorNext, proposedFieldKeyAction } from
    '../../packages/theia-extension/lib/browser/roadmap-proposal-cards.js';
import { roadmapProposalPreview } from '../../packages/theia-extension/lib/node/roadmap-proposal-presentation.js';
import { nextPhasePosition, showNextPhaseLoader } from '../../packages/theia-extension/lib/browser/roadmap-live-stage.js';
import { gateFixture } from './roadmap-gate-document-fixture.ts';

test('proposed field edit state preserves failed input and discards it on cancel', () => {
    const initial = { editing: false, draft: 'Original' };
    const open = proposedFieldEditorNext(initial, { type: 'open', value: 'Original' });
    const typed = proposedFieldEditorNext(open, { type: 'change', value: 'Correction in progress' });
    const failed = proposedFieldEditorNext(typed, { type: 'failure', error: 'invalid text' });
    assert.deepEqual(failed, { editing: true, draft: 'Correction in progress', error: 'invalid text' });
    const cancelled = proposedFieldEditorNext(failed, { type: 'cancel', value: 'Original' });
    assert.deepEqual(cancelled, initial);
    assert.equal(proposedFieldKeyAction('Escape', false), 'cancel');
    assert.equal(proposedFieldKeyAction('Escape', true), 'cancel');
    assert.equal(proposedFieldKeyAction('Enter', false), 'save');
    assert.equal(proposedFieldKeyAction('Enter', true), undefined);
});

test('next-Phase loader is an accessible status without invented Roadmap entities or actions', () => {
    const html = renderToStaticMarkup(React.createElement(NextPhaseLoader));
    assert.match(html, /role="status"/);
    assert.match(html, /aria-live="polite"/);
    assert.match(html, /Generating next Phase…/);
    assert.doesNotMatch(html, /data-phase-id|data-proposal-entity|Gate|Criterion|button|Apply|Reject|%/);
});

test('native stage snapshots render a provisional Phase, then nested Gate and Criterion without diff metadata or writes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-proposal-cards-'));
    try {
        const store = new RoadmapStore();
        const owner = new RoadmapNativeStageOwner(store);
        const context = { root, projectId: 'uninitialized', chatId: 'chat', turnId: 'turn', lease: 'lease' };
        const basis = { version: 1, expectedRevision: 0, expectedSourceHash: null };
        await owner.stage(context, { ...basis, expectedStage: 1, actions: [
            { type: 'phase.create', id: 'new:p', title: 'Phase Alpha', objective: 'Initial setup' }] });
        const first = (await owner.snapshot(context))!;
        const render = (snapshot: typeof first) => {
            const phase = snapshot.preview.entities.find(item => item.after?.kind === 'phase')!;
            return renderToStaticMarkup(React.createElement(ProposedPhaseNode, { data: { change: phase,
                children: snapshot.preview.entities.filter(item => item.id !== phase.id), source: false,
                save: async () => undefined } }));
        };
        const firstHtml = render(first);
        assert.match(firstHtml, /PHASE 1/);
        assert.match(firstHtml, /Phase Alpha/);
        assert.match(firstHtml, /Initial setup/);
        assert.match(firstHtml, /Awaiting Gates/);
        assert.match(firstHtml, /Proposed · Not applied/);
        assert.match(firstHtml, /dope-roadmap-proposal-tab/);
        assert.match(firstHtml, /data-proposal-action="select"/);
        assert.match(firstHtml, /data-proposal-action="apply"/);
        assert.match(firstHtml, /data-proposal-action="reject"/);
        assert.match(firstHtml, /Select Phase/);
        assert.match(firstHtml, /Shift activates this element and its pending descendants/);
        assert.doesNotMatch(firstHtml, />Select with children<|>Apply selected</);
        assert.match(firstHtml, /Edit proposed Phase title/);
        assert.match(firstHtml, /Edit proposed Phase objective/);
        assert.doesNotMatch(firstHtml, /none →|Order:|Dependencies:|Planned|GREEN/);
        assert.equal(await store.gateIndexHash(root), null);

        await owner.stage(context, { ...basis, expectedStage: 2, done: true, actions: [
            { type: 'gate.create', id: 'new:g', parentPhaseId: 'new:p', designation: 'G1',
                title: 'Setup Gate', purpose: 'Verify setup', criteria: [
                    { id: 'new:c', title: 'Check launch', expectedResult: 'App launches' }] }] });
        const second = (await owner.snapshot(context))!;
        const secondHtml = render(second);
        assert.match(secondHtml, /G1 · Setup Gate/);
        assert.match(secondHtml, /Verify setup/);
        assert.match(secondHtml, /Check launch/);
        assert.match(secondHtml, /App launches/);
        assert.match(secondHtml, /Select Gate/);
        assert.match(secondHtml, /Select Criterion/);
        assert.match(secondHtml, /Edit proposed Gate title/);
        assert.match(secondHtml, /Edit proposed Gate purpose/);
        assert.match(secondHtml, /Edit proposed Criterion title/);
        assert.match(secondHtml, /Edit proposed Criterion expected result/);
        assert.equal((secondHtml.match(/data-proposal-entity="[^"]+"/g) ?? []).length, 3);
        assert.doesNotMatch(secondHtml, /none →|Order:|Dependencies:|Planned|GREEN/);
        const stagedHtml = renderToStaticMarkup(React.createElement(ProposedPhaseNode, { data: {
            change: second.preview.entities.find(item => item.after?.kind === 'phase')!,
            children: second.preview.entities.filter(item => item.after?.kind !== 'phase'),
            source: false, provisional: true } }));
        assert.match(stagedHtml, /Staged · Provisional/);
        assert.match(stagedHtml, /G1 · Setup Gate/);
        assert.match(stagedHtml, /Check launch/);
        assert.doesNotMatch(stagedHtml, /Select proposed|Edit proposed|Planned|GREEN/);
        await owner.cancel(context, { version: 1 });
        assert.equal(await owner.snapshot(context), undefined);
        assert.equal(await store.gateIndexHash(root), null);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('two authoritative Phase snapshots advance one visual loader without counting it as an entity', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-next-phase-loader-'));
    try {
        const store = new RoadmapStore();
        const owner = new RoadmapNativeStageOwner(store);
        const context = { root, projectId: 'uninitialized', chatId: 'chat', turnId: 'turn', lease: 'lease' };
        const basis = { version: 1, expectedRevision: 0, expectedSourceHash: null, done: false };
        const stage = (expectedStage: number, actions: object[]) => owner.stage(context,
            { ...basis, expectedStage, actions });
        const phase = (n: number) => ({ type: 'phase.create', id: `new:p${n}`,
            title: `Phase ${n}`, objective: `Objective ${n}` });
        const gate = (n: number) => ({ type: 'gate.create', id: `new:g${n}`,
            parentPhaseId: `new:p${n}`, designation: 'G1', title: `Gate ${n}`, purpose: `Purpose ${n}`,
            criteria: [1, 2].map(i => ({ id: `new:c${n}${i}`, title: `Criterion ${n}.${i}`,
                expectedResult: `Result ${n}.${i}` })) });
        await stage(1, [phase(1), gate(1)]);
        const first = (await owner.snapshot(context))!;
        assert.deepEqual(first.counts, { phases: 1, gates: 1, criteria: 2 });
        assert.equal(showNextPhaseLoader(first), true);
        const firstPositions = first.preview.entities.filter(item => item.after?.kind === 'phase')
            .reduce<{ x: number; y: number }[]>((positions) => {
                positions.push(nextPhasePosition(positions)); return positions;
            }, []);
        assert.deepEqual(nextPhasePosition(firstPositions), { x: 624, y: 64 });
        await stage(2, [phase(2), gate(2)]);
        const second = (await owner.snapshot(context))!;
        assert.equal(second.proposalId, first.proposalId);
        assert.deepEqual(second.counts, { phases: 2, gates: 2, criteria: 4 });
        assert.equal(showNextPhaseLoader(second), true);
        const secondPositions = second.preview.entities.filter(item => item.after?.kind === 'phase')
            .reduce<{ x: number; y: number }[]>((positions) => {
                positions.push(nextPhasePosition(positions)); return positions;
            }, []);
        assert.deepEqual(nextPhasePosition(secondPositions), { x: 1184, y: 64 });
        const entities = second.preview.entities;
        assert.equal(entities.filter(item => item.after?.kind === 'phase').length, 2);
        assert.equal(entities.filter(item => item.after?.kind === 'gate').length, 2);
        assert.equal(entities.filter(item => item.after?.kind === 'criterion').length, 4);
        assert.equal(await store.gateIndexHash(root), null);
        await owner.finish(context, 0, null);
        const ready = (await owner.snapshot(context))!;
        assert.equal(ready.complete, true);
        assert.equal(showNextPhaseLoader(ready), false);
        assert.deepEqual(ready.counts, second.counts);
        assert.equal(await store.gateIndexHash(root), null);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('validated existing-element edit and removal retain field diffs and removal ghost', async () => {
    await gateFixture(async (root, _file, store) => {
        const before = await store.read(root);
        const edited = structuredClone(before);
        edited.gates[0].purpose = 'New purpose';
        const edit = roadmapProposalPreview(before, edited,
            [{ type: 'gate.edit', id: edited.gates[0].id, title: edited.gates[0].title,
                purpose: 'New purpose' }], [edited.gates[0].id]).entities[0];
        const editHtml = renderToStaticMarkup(React.createElement(ProposedChange, { change: edit, source: false }));
        assert.match(editHtml, /Purpose: .* → New purpose/);
        const removed = structuredClone(before);
        removed.gates = [];
        const deletion = roadmapProposalPreview(before, removed,
            [{ type: 'gate.delete', id: before.gates[0].id }], [before.gates[0].id]).entities[0];
        const deleteHtml = renderToStaticMarkup(React.createElement(ProposedChange, { change: deletion, source: false }));
        assert.match(deleteHtml, /dope-roadmap-proposal-delete/);
        assert.match(deleteHtml, /Remove gate/);
        assert.doesNotMatch(deleteHtml, / → /);
        const created = roadmapProposalPreview(removed, before,
            [{ type: 'gate.create', id: before.gates[0].id, parentPhaseId: before.phases[0].id,
                designation: before.gates[0].designation, title: before.gates[0].title,
                purpose: before.gates[0].purpose, criteria: before.gates[0].criteria.map(item => ({
                    id: item.id, title: item.title, expectedResult: item.expectedResult })) }],
            [before.gates[0].id]).entities[0];
        const gateHtml = renderToStaticMarkup(React.createElement(ProposedGateCard,
            { change: created, children: [], source: false }));
        assert.match(gateHtml, /dope-roadmap-gate-row/);
        assert.match(gateHtml, /Check first/);
        assert.doesNotMatch(gateHtml, /none →|Order:/);
    });
});
