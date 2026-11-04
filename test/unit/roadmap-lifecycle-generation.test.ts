import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { RoadmapGreenfield } from '../../packages/project-intelligence/lib/node/roadmap-greenfield.js';
import { RoadmapNativeStageOwner } from '../../packages/theia-extension/lib/node/roadmap-native-stage.js';
import { RoadmapGenerationNativeStage } from '../../packages/theia-extension/lib/node/roadmap-generation-native-stage.js';
import type { GenerationIdentity, GenerationPhase } from '../../packages/theia-extension/src/node/roadmap-generation-controller';
import { gateFixture } from './roadmap-gate-document-fixture.ts';

test('unlink preserves linked Markdown and Roadmap across restart', async () => gateFixture(async (root, file, store) => {
    const before = await store.read(root);
    const markdown = await readFile(file);
    const unlinked = await store.manageGateIndex(root, before.revision, before.projectId, 'unlink');
    assert.equal(unlinked.linkedDocument, undefined);
    assert.deepEqual(unlinked.phases, before.phases);
    assert.deepEqual(await readFile(file), markdown);
    assert.equal((await new RoadmapStore().read(root)).linkedDocument, undefined);
    await assert.rejects(store.manageGateIndex(root, unlinked.revision, unlinked.projectId,
        'unknown' as 'empty'), /Invalid Roadmap lifecycle action/);
    await assert.rejects(store.manageGateIndex(root, before.revision, before.projectId, 'empty'), /Stale/);
}));

test('delete writes an empty active head, retires drafts, and blocks historical resurrection', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-lifecycle-'));
    try {
        const store = new RoadmapStore();
        const drafts = new RoadmapGreenfield(store);
        const { handle } = await drafts.begin(root);
        drafts.edit(handle, 0, { type: 'create-phase', title: 'Draft old phase' });
        const empty = await store.manageGateIndex(root, 0, 'uninitialized', 'empty');
        await drafts.retire(root);
        assert.deepEqual(await new RoadmapGreenfield(new RoadmapStore()).restore(root), []);
        const old = await store.mutateGateIndex(root, empty.revision, empty.projectId,
            { type: 'phase.create', id: 'old', title: 'Old phase', objective: 'Old objective' });
        const deleted = await store.manageGateIndex(root, old.revision, old.projectId, 'empty');
        assert.deepEqual(deleted.phases, []);
        assert.equal(deleted.retiredBeforeRevision, old.revision);
        const restarted = new RoadmapStore();
        assert.deepEqual((await restarted.read(root)).phases, []);
        await assert.rejects(restarted.previewRestore(root, deleted.projectId, old.revision), /Foreign or current/);
        const newEmpty = await restarted.manageGateIndex(root, deleted.revision, deleted.projectId, 'empty');
        assert.deepEqual((await new RoadmapStore().read(root)).phases, []);
        const owner = new RoadmapNativeStageOwner(restarted);
        const identity: GenerationIdentity = { generationId: 'after-delete', root,
            projectId: newEmpty.projectId, revision: newEmpty.revision, sourceHash: null,
            indexHash: await restarted.gateIndexHash(root), chatId: 'after-delete-chat',
            turnId: 'after-delete-turn', ownerId: newEmpty.projectId,
            model: { connectionId: 'local', modelId: 'model', providerId: 'local',
                contextWindowTokens: 8192, reasoningControls: {} }, origin: 'trusted-user-chat' };
        const adapter = new RoadmapGenerationNativeStage(owner, 'lease', identity);
        await adapter.stage({ title: 'New phase', objective: 'New objective', subcalls: 1,
            gates: [{ title: 'New gate', purpose: 'Verify new phase', criteria: [
                { title: 'New criterion', expectedResult: 'Pass' }] }] }, identity, new AbortController().signal);
        await adapter.complete(identity, new AbortController().signal);
        const stage = owner.get(identity.chatId)!;
        const ids = stage.operations.map(item => item.id);
        const review = await owner.review(stage.context, ids, 'apply');
        await owner.decide(stage.context, review.token, ids, 'apply');
        const generated = await new RoadmapStore().read(root);
        assert.deepEqual(generated.phases.map(item => item.title), ['New phase']);
        const newPhase = await restarted.mutateGateIndex(root, generated.revision, generated.projectId,
            { type: 'phase.edit', id: generated.phases[0].id, title: 'Edited phase', objective: 'Edited objective' });
        assert.equal(newPhase.retiredBeforeRevision, newEmpty.revision);
        assert.deepEqual((await new RoadmapStore().read(root)).phases.map(item => item.title), ['Edited phase']);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('generation stages a clean candidate and applies only an exact reviewed replacement', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-generation-replace-'));
    try {
        const store = new RoadmapStore(), owner = new RoadmapNativeStageOwner(store);
        const empty = await store.manageGateIndex(root, 0, 'uninitialized', 'empty');
        const old = await store.mutateGateIndex(root, empty.revision, empty.projectId,
            { type: 'phase.create', id: 'old', title: 'Old phase', objective: 'Old objective' });
        const identity: GenerationIdentity = { generationId: 'one', root, projectId: old.projectId,
            revision: old.revision, sourceHash: null, indexHash: await store.gateIndexHash(root),
            chatId: 'chat', turnId: 'turn', ownerId: old.projectId,
            model: { connectionId: 'local', modelId: 'model', providerId: 'local',
                contextWindowTokens: 8192, reasoningControls: {} }, origin: 'trusted-user-chat' };
        const phase: GenerationPhase = { title: 'Fresh phase', objective: 'Fresh objective', subcalls: 1,
            gates: [{ title: 'Fresh gate', purpose: 'Verify fresh', criteria: [
                { title: 'Fresh criterion', expectedResult: 'Fresh result' }] }] };
        const adapter = new RoadmapGenerationNativeStage(owner, 'lease', identity);
        await adapter.stage(phase, identity, new AbortController().signal);
        await adapter.complete(identity, new AbortController().signal);
        const stage = owner.get('chat')!;
        const snapshot = await adapter.snapshot();
        assert.equal(snapshot?.isolated, true);
        assert.deepEqual(snapshot?.counts, { phases: 1, gates: 1, criteria: 1 });
        assert.ok(snapshot?.preview.entities.every(item => item.before === undefined));
        assert.equal((await store.read(root)).phases[0].title, 'Old phase');
        await assert.rejects(owner.review(stage.context, [stage.operations[0].id], 'apply'), /REPLACEMENT_INCOMPLETE/);
        const ids = stage.operations.map(item => item.id);
        const reviewed = await owner.review(stage.context, ids, 'apply');
        assert.equal(reviewed.after?.phases[0].title, 'Fresh phase');
        assert.equal(reviewed.after?.phases.some(item => item.title === 'Old phase'), false);
        await owner.decide(stage.context, reviewed.token, ids, 'apply');
        const restarted = await new RoadmapStore().read(root);
        assert.deepEqual(restarted.phases.map(item => item.title), ['Fresh phase']);
        assert.equal(restarted.linkedDocument, undefined);
        assert.equal(restarted.retiredBeforeRevision, old.revision);
        await assert.rejects(store.previewRestore(root, restarted.projectId, old.revision), /Foreign or current/);
        const secondIdentity = { ...identity, generationId: 'two', revision: restarted.revision,
            indexHash: await store.gateIndexHash(root), chatId: 'second-chat', turnId: 'second-turn' };
        const second = new RoadmapGenerationNativeStage(owner, 'lease', secondIdentity);
        await second.stage({ ...phase, title: 'Cancelled candidate' }, secondIdentity, new AbortController().signal);
        await second.complete(secondIdentity, new AbortController().signal);
        const secondStage = owner.get('second-chat')!;
        const secondIds = secondStage.operations.map(item => item.id);
        const reject = await owner.review(secondStage.context, secondIds, 'reject');
        await owner.decide(secondStage.context, reject.token, secondIds, 'reject');
        owner.forget('second-chat');
        assert.deepEqual((await new RoadmapStore().read(root)).phases.map(item => item.title), ['Fresh phase']);
        const thirdIdentity = { ...secondIdentity, generationId: 'three', chatId: 'third-chat', turnId: 'third-turn' };
        const third = new RoadmapGenerationNativeStage(owner, 'lease', thirdIdentity);
        await third.stage({ ...phase, title: 'Stale candidate' }, thirdIdentity, new AbortController().signal);
        await third.complete(thirdIdentity, new AbortController().signal);
        const thirdStage = owner.get('third-chat')!;
        const thirdIds = thirdStage.operations.map(item => item.id);
        const staleReview = await owner.review(thirdStage.context, thirdIds, 'apply');
        const advanced = await store.mutateGateIndex(root, restarted.revision, restarted.projectId,
            { type: 'phase.edit', id: restarted.phases[0].id, title: 'Owner changed', objective: 'Owner changed' });
        await assert.rejects(owner.decide(thirdStage.context, staleReview.token, thirdIds, 'apply'), /STALE/);
        assert.deepEqual((await new RoadmapStore().read(root)).phases.map(item => item.title), ['Owner changed']);
        assert.equal(advanced.retiredBeforeRevision, old.revision);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('project switch and interrupted generation leave each active Roadmap unchanged', async () => {
    const firstRoot = await mkdtemp(join(tmpdir(), 'dope-generation-first-'));
    const secondRoot = await mkdtemp(join(tmpdir(), 'dope-generation-second-'));
    try {
        const store = new RoadmapStore(), owner = new RoadmapNativeStageOwner(store);
        const first = await store.manageGateIndex(firstRoot, 0, 'uninitialized', 'empty');
        const second = await store.manageGateIndex(secondRoot, 0, 'uninitialized', 'empty');
        const old = await store.mutateGateIndex(firstRoot, first.revision, first.projectId,
            { type: 'phase.create', id: 'old', title: 'Old phase', objective: 'Keep this' });
        const identity: GenerationIdentity = { generationId: 'interrupted', root: firstRoot,
            projectId: old.projectId, revision: old.revision, sourceHash: null,
            indexHash: await store.gateIndexHash(firstRoot), chatId: 'chat', turnId: 'turn', ownerId: old.projectId,
            model: { connectionId: 'local', modelId: 'model', providerId: 'local',
                contextWindowTokens: 8192, reasoningControls: {} }, origin: 'trusted-user-chat' };
        const adapter = new RoadmapGenerationNativeStage(owner, 'lease', identity);
        await adapter.stage({ title: 'Candidate', objective: 'Provisional', subcalls: 1,
            gates: [{ title: 'Candidate gate', purpose: 'Provisional', criteria: [
                { title: 'Check', expectedResult: 'Pass' }] }] }, identity, new AbortController().signal);
        await adapter.complete(identity, new AbortController().signal);
        const stage = owner.get('chat')!;
        await assert.rejects(owner.review({ ...stage.context, root: secondRoot, projectId: second.projectId },
            stage.operations.map(item => item.id), 'apply'), /OWNER_CHANGED|STALE/);
        assert.deepEqual((await store.read(firstRoot)).phases.map(item => item.title), ['Old phase']);
        assert.deepEqual((await store.read(secondRoot)).phases, []);
        const afterRestart = new RoadmapNativeStageOwner(new RoadmapStore());
        assert.equal(afterRestart.get('chat'), undefined);
        assert.deepEqual((await new RoadmapStore().read(firstRoot)).phases.map(item => item.title), ['Old phase']);
    } finally {
        await rm(firstRoot, { recursive: true, force: true });
        await rm(secondRoot, { recursive: true, force: true });
    }
});
