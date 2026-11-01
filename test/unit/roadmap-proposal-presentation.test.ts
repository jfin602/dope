import assert from 'node:assert/strict';
import test from 'node:test';
import { gateFixture } from './roadmap-gate-document-fixture.ts';
import { linkedRoadmapProposalPreview, roadmapProposalPreview } from
    '../../packages/theia-extension/lib/node/roadmap-proposal-presentation.js';

test('validated snapshots project bounded Phase, Gate, Criterion, relationship and multi-action changes', async () => {
    await gateFixture(async (root, _file, store) => {
        const before = await store.read(root);
        const after = structuredClone(before);
        after.phases[0].title = 'First verified';
        after.gates[0].purpose = 'Prove release';
        after.gates[0].criteria[0].expectedResult = 'Visible result';
        after.gates[0].dependencies = ['other-gate'];
        const actions = [
            { type: 'phase.edit', id: 'phase-one', title: 'First verified', objective: after.phases[0].objective },
            { type: 'gate.edit', id: 'gate-one', title: after.gates[0].title, purpose: 'Prove release' },
            { type: 'criterion.edit', gateId: 'gate-one', id: 'criterion-one',
                title: after.gates[0].criteria[0].title, expectedResult: 'Visible result' }
        ] as const;
        const preview = roadmapProposalPreview(before, after, actions, ['phase-one', 'gate-one', 'criterion-one']);
        assert.equal(preview.source, 'validated-roadmap');
        assert.deepEqual(preview.steps.map(step => step.type), actions.map(action => action.type));
        assert.equal(preview.entities[1].after?.parentId, 'phase-one');
        assert.equal(preview.entities[1].after?.detail, 'Prove release');
        assert.equal(preview.entities[2].after?.detail, 'Visible result');
        assert.deepEqual(preview.entities[1].after?.dependencies, ['other-gate']);
        assert.equal(preview.parentTitles['phase-one'], 'First verified');
        const removed = structuredClone(before);
        removed.gates = [];
        const deleted = roadmapProposalPreview(before, removed, [{ type: 'gate.delete', id: 'gate-one' }],
            ['gate-one', 'criterion-one']);
        assert.equal(deleted.entities[0].action, 'delete');
        assert.equal(deleted.entities[0].after, undefined);
        const created = roadmapProposalPreview(removed, before,
            [{ type: 'gate.create', id: 'gate-one', parentPhaseId: 'phase-one', designation: 'G1',
                title: before.gates[0].title, purpose: before.gates[0].purpose,
                criteria: before.gates[0].criteria.map(item => ({ id: item.id, title: item.title,
                    expectedResult: item.expectedResult })) }], ['gate-one', 'criterion-one']);
        assert.equal(created.entities[0].action, 'create');
        assert.equal(created.entities[0].after?.criteria?.[0]?.expectedResult,
            before.gates[0].criteria[0].expectedResult);
        const many = roadmapProposalPreview(before, after, actions, Array.from({ length: 20 }, (_, i) => `id-${i}`));
        assert.equal(many.entities.length, 12);
        assert.equal(many.additionalChanges, 8);
    });
});

test('linked card source lines come from checked Markdown patch', async () => {
    await gateFixture(async (root, _file, store) => {
        const before = await store.read(root);
        const patch = await store.previewGateDocumentPatch(root, { kind: 'gate', id: 'gate-one',
            sourceHash: before.linkedDocument!.sourceHash, title: 'Check second' });
        const preview = linkedRoadmapProposalPreview(before, 'gate', 'gate-one', patch);
        assert.equal(preview.source, 'validated-markdown-patch');
        assert.deepEqual(preview.sourceChanges, patch.changedLines);
        assert.equal(preview.entities[0].before?.title, 'Check first');
        assert.equal(preview.entities[0].after?.title, 'Check second');
    });
});
