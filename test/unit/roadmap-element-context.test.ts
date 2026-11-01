import assert from 'node:assert/strict';
import test from 'node:test';
import { roadmapElementContext } from '../../packages/theia-extension/lib/node/roadmap-element-context.js';
import { ChatContextComposer } from '../../packages/theia-extension/lib/node/chat-context-composer.js';
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
    assert.doesNotMatch(serialized, /gate-two|Other readiness|Secret sibling purpose/);
    assert.deepEqual(composed.refs.map(ref => [ref.id, ref.elementKind]), [['gate-one', 'gate']]);
    await assert.rejects(composer.compose(source.projectRoot, chat, request, selection,
        { conversationalText: true, streaming: true, contextWindowTokens: 500,
            maxInputTokens: 500 }, undefined, false, false, undefined, false, true),
    /does not fit|exceeds/);
});

test('saved Chat parses Roadmap element identity without widening other context kinds', () => {
    const ref = { schemaVersion: 1, kind: 'roadmap', id: 'gate-one', label: 'G1',
        estimatedTokens: 5, elementKind: 'gate' };
    assert.equal(parseChatContextRef(ref).elementKind, 'gate');
    assert.throws(() => parseChatContextRef({ ...ref, kind: 'file' }), /requires Roadmap context/);
});
