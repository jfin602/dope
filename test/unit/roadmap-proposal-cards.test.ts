import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { RoadmapNativeStageOwner } from '../../packages/theia-extension/lib/node/roadmap-native-stage.js';
import { ProposedPhaseNode, ProposedChange, ProposedGateCard } from
    '../../packages/theia-extension/lib/browser/roadmap-proposal-cards.js';
import { roadmapProposalPreview } from '../../packages/theia-extension/lib/node/roadmap-proposal-presentation.js';
import { gateFixture } from './roadmap-gate-document-fixture.ts';

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
                children: snapshot.preview.entities.filter(item => item.id !== phase.id), source: false } }));
        };
        const firstHtml = render(first);
        assert.match(firstHtml, /PHASE 1/);
        assert.match(firstHtml, /Phase Alpha/);
        assert.match(firstHtml, /Initial setup/);
        assert.match(firstHtml, /Awaiting Gates/);
        assert.match(firstHtml, /Proposed · Not applied/);
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
        assert.equal((secondHtml.match(/data-proposal-entity="[^"]+"/g) ?? []).length, 3);
        assert.doesNotMatch(secondHtml, /none →|Order:|Dependencies:|Planned|GREEN/);
        await owner.cancel(context, { version: 1 });
        assert.equal(await owner.snapshot(context), undefined);
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
