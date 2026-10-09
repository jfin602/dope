import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentStore } from '../../packages/agent-core/lib/node/agent-store.js';
import { appliedMapImpact } from '../../packages/theia-extension/lib/node/agent-map-impact.js';

const hash = 'a'.repeat(64);
const fingerprint = 'b'.repeat(64);
const run = { version: 1, id: 'run-impact', taskId: 'task-impact', projectRoot: '.', projectId: 'project',
    status: 'completed', grantId: 'grant', grantRevision: 0, requestedPolicy: { kind: 'follow-coding-agent' },
    createdAt: '2026-10-09T12:00:00Z', startedAt: '2026-10-09T12:00:01Z', endedAt: '2026-10-09T12:00:02Z',
    changedFiles: ['src/known.ts', 'src/new.ts'], validationResults: [],
    candidateFingerprint: fingerprint, candidateDelta: { version: 1, effects: [
        { kind: 'modify', path: 'src/known.ts', before: 'c'.repeat(64), after: hash },
        { kind: 'create', path: 'src/new.ts', after: 'd'.repeat(64) }] },
    authorityDecision: { allowed: true, blocked: [] }, appliedFiles: ['src/known.ts', 'src/new.ts'] } as const;
const snapshot = { metadata: { projectId: 'project:root', generation: 4, inputFingerprint: fingerprint,
    analysis: { completeness: 'complete', errors: [] } },
    nodes: [{ id: 'project:root', kind: 'project', name: 'Project', evidenceIds: [] },
        { id: 'system', kind: 'system', name: 'System', parentId: 'project:root', purpose: 'Work', evidenceIds: [] },
        { id: 'code:known', kind: 'code', codeKind: 'file', name: 'known.ts', path: 'src/known.ts',
            parentId: 'system', evidenceIds: ['syntax:known'], ownership: { state: 'assigned', systemId: 'system' } }],
    evidence: [{ id: 'syntax:known', class: 'syntax', producer: 'test', producerVersion: '1', path: 'src/known.ts' }],
    relationships: [], violations: [], flowFacts: [], flowEndpoints: [], flowCoverage: [], flowDiagnostics: [] } as any;
const ready = { generation: 4, publishedGeneration: 4, state: 'ready', inputFingerprint: fingerprint,
    analysis: { completeness: 'complete', errors: [] }, reusedSourceFiles: 0 } as any;

test('applied paths resolve bounded physical IDs or remain unknown, with stale source evidence explicit', () => {
    const impact = appliedMapImpact(run as any, { status: () => ready, snapshot: () => snapshot }, '/project');
    assert.equal(impact.generation, 4);
    assert.equal(impact.reanalysisNeeded, true);
    assert.deepEqual(impact.paths[0], { path: 'src/known.ts', sourceFingerprint: hash, status: 'resolved',
        nodeIds: ['code:known', 'system', 'project:root'], evidenceIds: ['syntax:known'], evidenceStale: true });
    assert.deepEqual(impact.paths[1], { path: 'src/new.ts', sourceFingerprint: 'd'.repeat(64),
        status: 'unknown', nodeIds: [], evidenceIds: [], reason: 'unmapped-path' });
});

test('generation change never publishes IDs from an obsolete snapshot', () => {
    let calls = 0;
    const impact = appliedMapImpact(run as any,
        { status: () => ++calls === 1 ? ready : { ...ready, generation: 5 }, snapshot: () => snapshot }, '/project');
    assert.equal(impact.paths[0].status, 'unknown');
    assert.equal(impact.paths[0].reason, 'stale-generation');
    assert.deepEqual(impact.paths[0].nodeIds, []);
});

test('impact receipt persists under its run and rejects a second decision', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-map-impact-'));
    const store = new AgentStore();
    try {
        await store.createTask(root, { version: 1, id: 'task-impact', createdAt: run.createdAt,
            objective: 'Change sources', instructions: 'Edit sources', projectRoot: '.', projectId: run.projectId,
            modelPolicy: run.requestedPolicy, controls: {}, authority: { profile: 'phase-8b-project' },
            completion: { validation: [], requireValidationPass: false }, origin: { kind: 'direct' } } as any);
        let saved = await store.createRun(root, { ...run, status: 'pending', startedAt: undefined, endedAt: undefined,
            changedFiles: [], candidateFingerprint: undefined, candidateDelta: undefined,
            authorityDecision: undefined, appliedFiles: undefined } as any);
        const impact = appliedMapImpact(run as any, { status: () => ready, snapshot: () => snapshot }, root);
        await assert.rejects(store.writeMapImpact(root, impact), /authoritative promotion/);
        saved = await store.updateRun(root, saved, { ...saved, status: 'running', startedAt: run.startedAt } as any);
        await store.updateRun(root, saved, run as any);
        await store.writeMapImpact(root, impact);
        assert.deepEqual(await new AgentStore().readMapImpact(root, run.id), impact);
        await assert.rejects(store.writeMapImpact(root, { ...impact, decisionFingerprint: 'e'.repeat(64) }));
    } finally { await rm(root, { recursive: true, force: true }); }
});
