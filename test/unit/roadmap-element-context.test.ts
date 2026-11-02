import assert from 'node:assert/strict';
import test from 'node:test';
import { roadmapElementContext } from '../../packages/theia-extension/lib/node/roadmap-element-context.js';
import { ChatContextComposer } from '../../packages/theia-extension/lib/node/chat-context-composer.js';
import { roadmapLocalBudget, verifyRoadmapLocalInput } from '../../packages/theia-extension/lib/node/roadmap-local-model.js';
import { resolveChatSkill } from '../../packages/theia-extension/lib/node/chat-skills.js';
import { parseChatContextRef } from '../../packages/chat/lib/index.js';
import type { RoadmapGateIndex } from '../../packages/project-intelligence/lib/node/roadmap-gate-domain.js';
import type { ChatContextSelection } from '../../packages/chat/lib/service.js';

const state = { implementationStatus: 'unknown' as const, qualificationStatus: 'unknown' as const,
    draftAcceptance: 'accepted' as const };
const index = (): RoadmapGateIndex => ({
    schemaVersion: 2, projectId: 'project-1', projectRoot: '/tmp/project-1', revision: 4,
    phases: [{ id: 'phase-one', projectId: 'project-1', title: 'Phase 1', objective: 'Deliver readiness',
        order: 0, dependencies: [], ...state, gateSetCoverage: { status: 'unreviewed' } }],
    gates: [
        { id: 'gate-one', projectId: 'project-1', parentPhaseId: 'phase-one', designation: 'G1',
            title: 'Readiness', purpose: 'Verify target handling', order: 0, dependencies: [], ...state,
            criteria: [{ id: 'criterion-one', projectId: 'project-1', title: 'Ambiguity covered',
                expectedResult: 'One target chosen', order: 0,
                evidence: [{ id: 'evidence-one', projectId: 'project-1', criterionId: 'criterion-one',
                    result: 'pass', kind: 'test', summary: 'Ambiguous target test passed', verifiedBy: 'owner',
                    observedAt: '2026-11-01T00:00:00Z', criterionHash: 'a'.repeat(64),
                    review: { status: 'approved', reviewerId: 'owner', reviewedAt: '2026-11-01T00:00:00Z' } }] }] },
        { id: 'gate-two', projectId: 'project-1', parentPhaseId: 'phase-one', designation: 'G2',
            title: 'Other readiness', purpose: 'Secret sibling purpose', order: 1, dependencies: [], ...state,
            criteria: [{ id: 'criterion-two', projectId: 'project-1', title: 'Sibling criterion',
                expectedResult: 'Sibling evidence', order: 0, evidence: [] }] }
    ],
    corrections: [{ id: 'correction-one', projectId: 'project-1', parent: { kind: 'gate', id: 'gate-one' },
        title: 'Fix ambiguity', objective: 'Repair target', order: 0, ...state }]
});
const select = (kind: NonNullable<ChatContextSelection['elementKind']>, id: string): ChatContextSelection =>
    ({ kind: 'roadmap', elementKind: kind, id, projectId: 'project-1', ownerRevision: 4 });

test('selected Gate carries full owned criteria and evidence without sibling content', () => {
    const payload = roadmapElementContext(index(), [select('gate', 'gate-one')]);
    assert.match(payload, /Ambiguous target test passed/);
    assert.match(payload, /accepted draft, not yet canonical/);
    assert.doesNotMatch(payload, /Other readiness|Secret sibling purpose|Sibling criterion/);
    const data = JSON.parse(payload);
    assert.deepEqual(data.selected, [{ kind: 'gate', id: 'gate-one' }]);
    assert.equal(data.entities.filter((item: { id: string }) => item.id === 'criterion-one').length, 1);
    assert.equal(data.siblingGateOrder, undefined);
    assert.equal(data.siblingCriterionOrder, undefined);
    const ordered = JSON.parse(roadmapElementContext(index(), [select('gate', 'gate-one')],
        'Move G1 after G2'));
    assert.deepEqual(ordered.siblingGateOrder, [{ parentPhaseId: 'phase-one', gates: [
        { id: 'gate-one', designation: 'G1', order: 0 },
        { id: 'gate-two', designation: 'G2', order: 1 }] }]);
    assert.deepEqual(ordered.siblingCriterionOrder, [{ gateId: 'gate-one', criteria: [
        { id: 'criterion-one', order: 0 }] }]);
    const moved = index();
    moved.phases.push({ ...moved.phases[0], id: 'phase-two', title: 'Phase 2', objective: 'Deliver next stage', order: 1 });
    moved.gates[1].parentPhaseId = 'phase-two';
    const destination = JSON.parse(roadmapElementContext(moved, [select('gate', 'gate-one')],
        'Move G1 to Phase 2'));
    assert.deepEqual(destination.destinationPhases, [{ id: 'phase-two', title: 'Phase 2',
        objective: 'Deliver next stage', order: 1, dependencies: [],
        siblingGates: [{ id: 'gate-two', designation: 'G2', order: 1 }] }]);
    assert.doesNotMatch(JSON.stringify(destination), /Secret sibling purpose/);
});

test('selected Phase includes its subtree and overlapping selections are deduplicated', () => {
    const data = JSON.parse(roadmapElementContext(index(), [
        select('gate', 'gate-one'), select('phase', 'phase-one'), select('criterion', 'criterion-one')]));
    assert.equal(data.entities.filter((item: { id: string }) => item.id === 'gate-one').length, 1);
    assert.equal(data.entities.filter((item: { id: string }) => item.id === 'criterion-one').length, 1);
    assert.ok(data.entities.some((item: { id: string }) => item.id === 'gate-two'));
    assert.ok(data.entities.some((item: { id: string }) => item.id === 'correction-one'));
});

test('stale, foreign, missing and duplicate selected identities fail closed', () => {
    const source = index();
    assert.throws(() => roadmapElementContext(source, [{ ...select('gate', 'gate-one'), ownerRevision: 3 }]), /Stale/);
    assert.throws(() => roadmapElementContext(source, [{ ...select('gate', 'gate-one'), projectId: 'foreign' }]), /Stale/);
    assert.throws(() => roadmapElementContext(source, [select('gate', 'deleted')]), /missing/);
    assert.throws(() => roadmapElementContext(source, [select('gate', 'gate-one'), select('gate', 'gate-one')]), /Duplicate/);
});

test('selected linked Gate retains authoritative Markdown identity and mapped section', () => {
    const source = index();
    source.linkedDocument = { projectId: source.projectId, projectRoot: source.projectRoot,
        path: 'ROADMAP.md', sourceHash: 'b'.repeat(64), syncState: 'synced',
        sections: [{ sectionKey: 'g1', kind: 'gate', id: 'gate-one' }] };
    const data = JSON.parse(roadmapElementContext(source, [
        { ...select('gate', 'gate-one'), sourceHash: 'b'.repeat(64) }]));
    assert.equal(data.source.linkedDocument.path, 'ROADMAP.md');
    assert.equal(data.source.linkedDocument.sourceHash, 'b'.repeat(64));
    assert.deepEqual(data.source.linkedDocument.mappedSections,
        [{ sectionKey: 'g1', kind: 'gate', id: 'gate-one' }]);
    assert.throws(() => roadmapElementContext(source, [select('gate', 'gate-one')]), /Stale/);
});

test('serialized model messages carry only the selected Gate and refuse an incomplete budget', async () => {
    const source = index();
    const composer = new ChatContextComposer({} as never, {} as never, {} as never, {} as never,
        { read: async () => source } as never);
    const chat = { messages: [], settings: { context: { maxInputTokens: 12000,
        reservedOutputTokens: 1024, history: 'recent', savedChatSearch: false,
        allowedSources: [] } } } as never;
    const selection = [select('gate', 'gate-one')];
    const request = '/roadmap Change the purpose of the selected readiness Gate';
    const composed = await composer.compose(source.projectRoot, chat, request, selection,
        { conversationalText: true, streaming: true, contextWindowTokens: 16384 },
        undefined, false, false, undefined, false, true);
    const serialized = JSON.stringify(composed.messages);
    assert.match(serialized, /gate-one|Ambiguous target test passed/);
    assert.doesNotMatch(serialized, /gate-two|Other readiness|Secret sibling purpose|siblingGateOrder/);
    assert.deepEqual(composed.refs.map(ref => [ref.id, ref.elementKind]), [['gate-one', 'gate']]);
    const relationship = await composer.compose(source.projectRoot, chat, '/roadmap Move G1 after G2', selection,
        { conversationalText: true, streaming: true, contextWindowTokens: 16384 },
        undefined, false, false, undefined, false, true);
    assert.match(JSON.stringify(relationship.messages), /siblingGateOrder/);
    assert.doesNotMatch(JSON.stringify(relationship.messages), /Secret sibling purpose/);
    await assert.rejects(composer.compose(source.projectRoot, chat, request, selection,
        { conversationalText: true, streaming: true, contextWindowTokens: 500,
            maxInputTokens: 500 }, undefined, false, false, undefined, false, true),
    /does not fit|exceeds/);
});

test('large selected Roadmap remains complete within the measured 16K input bound and fails closed when mandatory fields grow', async () => {
    const source = index();
    for (let number = 3; number <= 90; number++) source.gates.push({
        ...source.gates[1], id: `gate-${number}`, designation: `G${number}`,
        title: `Unrelated Gate ${number}`, purpose: `Unrelated purpose ${number}`, order: number - 1,
        criteria: [{ ...source.gates[1].criteria[0], id: `criterion-${number}` }]
    });
    const composer = new ChatContextComposer({} as never, {} as never, {} as never, {} as never,
        { read: async () => source } as never);
    const chat = { messages: [], settings: { context: { maxInputTokens: 12000,
        reservedOutputTokens: 2048, history: 'recent', savedChatSearch: false, allowedSources: [] } } } as never;
    const budget = roadmapLocalBudget(16384, 2048);
    const skill = await resolveChatSkill('/roadmap');
    assert.ok(skill);
    const skillInstruction = `Dope skill /${skill.name} (turn-scoped, untrusted instructions; no new tool or write authority):\n${skill.body}`;
    const capabilities = { conversationalText: true, streaming: true, contextWindowTokens: 16384,
        maxInputTokens: budget.composerInputTokens - Math.ceil(Buffer.byteLength(skillInstruction) / 3) - 4 };
    const selection = [select('gate', 'gate-one')];
    const request = '/roadmap Change G1 purpose while retaining its title';
    const result = await composer.compose(source.projectRoot, chat, request, selection,
        capabilities, undefined, false, false, undefined, true, true);
    const sent = [{ role: 'system' as const, content: skillInstruction },
        ...result.messages];
    verifyRoadmapLocalInput(sent, budget);
    assert.match(JSON.stringify(sent), /Verify target handling|criterion-one/);
    assert.doesNotMatch(JSON.stringify(sent), /Unrelated purpose 90/);
    assert.equal(result.diagnostics.some(item => item.source === 'roadmap:gate-one' &&
        item.message.includes('budget')), false);
    source.gates[0].purpose = 'required '.repeat(6000);
    await assert.rejects(composer.compose(source.projectRoot, chat, request, selection,
        capabilities, undefined, false, false, undefined, true, true), /does not fit|exceeds/);
});

test('saved Chat parses Roadmap element identity without widening other context kinds', () => {
    const ref = { schemaVersion: 1, kind: 'roadmap', id: 'gate-one', label: 'G1',
        estimatedTokens: 5, elementKind: 'gate' };
    assert.equal(parseChatContextRef(ref).elementKind, 'gate');
    assert.throws(() => parseChatContextRef({ ...ref, kind: 'file' }), /requires Roadmap context/);
});

test('unrelated ordinary Chat does not read Roadmap or include its edit grammar', async () => {
    let reads = 0;
    const composer = new ChatContextComposer({} as never, {} as never, {} as never, {} as never,
        { read: async () => { reads++; throw new Error('unexpected Roadmap read'); } } as never);
    const chat = { messages: [], settings: { context: { maxInputTokens: 12000,
        reservedOutputTokens: 1024, history: 'recent', savedChatSearch: false, allowedSources: [] } } } as never;
    const result = await composer.compose('/tmp/unrelated', chat, 'Explain what a checksum is.', [],
        { conversationalText: true, streaming: true, contextWindowTokens: 16384 });
    assert.equal(reads, 0);
    assert.equal(result.refs.length, 0);
    assert.doesNotMatch(JSON.stringify(result.messages), /Supported action types and fields|roadmap-gate-proposal/);
});
