import assert from 'node:assert/strict';
import test from 'node:test';
import { createArchitectureEvidenceView, detectReconciliationConflicts, HierarchicalSynthesisOrchestrator,
  parseArchitectureProposal, planArchitectureEvidence, SynthesisStageCache, stageWorkIdentity,
  MAX_VERIFICATION_CALLS } from '../../packages/software-map/lib/index.js';
import type { ArchitectureEvidencePacket, SynthesisProvider, SynthesisStageRequest, SubsystemDiscoveryResult,
  SystemCandidate } from '../../packages/software-map/lib/index.js';

const packet: ArchitectureEvidencePacket = { schemaVersion: 1, inputFingerprint: 'packet-a', items: [
  { id: 'top', kind: 'topology', path: 'package.json', sourceEvidenceIds: [], scope: 'workspace', name: 'workspace' },
  { id: 'a', kind: 'entrypoint', path: 'packages/a/src/main.ts', sourceEvidenceIds: ['source:a'], role: 'server' },
  { id: 'b', kind: 'entrypoint', path: 'packages/b/src/main.ts', sourceEvidenceIds: ['source:b'], role: 'worker' },
  { id: 'shared', kind: 'framework', path: 'packages/shared/src/service.ts', sourceEvidenceIds: ['source:shared'],
    framework: 'test-framework', producer: 'fixture', producerVersion: '1', concept: 'service', name: 'SharedService' },
  { id: 'cross', kind: 'dependency', path: 'packages/a/src/main.ts', targetPath: 'packages/b/src/main.ts',
    sourceEvidenceIds: ['source:a'], relationshipIds: ['edge:a-b'], relation: 'imports' },
] };
const system = (id: string, ref: string): SystemCandidate => ({ candidateKey: `candidate:${id}`, kind: 'system',
  name: id, purpose: `${id} responsibility`, boundaryRationale: 'Distinct runtime responsibility', confidence: 0.8,
  uncertainty: [], evidenceRefs: [ref] });
const systems = [system('a', 'a'), system('b', 'b')];
const tree = (systemKey: string, ref: string, ownership = ref): SubsystemDiscoveryResult => ({
  schemaVersion: 1, stageVersion: 1, stage: 'subsystem-discovery', parentPacketFingerprint: packet.inputFingerprint,
  viewId: `view:${systemKey}`, systemKey, subdivisionAssessment: { rationale: 'Distinct unit', confidence: 0.8, uncertainty: [] },
  nodes: [{ candidateKey: `${systemKey}.sub`, kind: 'subsystem', parentCandidateKey: systemKey, name: `${systemKey} sub`,
    purpose: 'Own behavior', rationale: 'Direct source', siblingDistinction: 'Runtime role', confidence: 0.8,
    uncertainty: [], evidenceRefs: [ref, ...(ownership === ref ? [] : [ownership])], ownershipEvidenceRefs: [ownership] }],
});
const context = { systems: [], subtrees: [], subjectSystemKey: null, targetCandidateKeys: [] };
const request = (stage: SynthesisStageRequest['stage'], fingerprint = packet.inputFingerprint): SynthesisStageRequest => ({
  schemaVersion: 1, stageVersion: 1, stage, parentPacketFingerprint: fingerprint,
  view: createArchitectureEvidenceView({ ...packet, inputFingerprint: fingerprint }, ['top', 'a', 'b', 'shared', 'cross']), context,
});
const response = (req: SynthesisStageRequest, extra: object) => ({ schemaVersion: 1, stageVersion: 1,
  stage: req.stage, parentPacketFingerprint: req.parentPacketFingerprint, viewId: req.view.viewId, ...extra });

test('deterministic audit catches cross-System duplicate ownership, overlapping support and dependencies', () => {
  const sharedSystems = systems.map(s => ({ ...s, evidenceRefs: [...s.evidenceRefs, 'shared'] }));
  const trees = [tree('candidate:a', 'shared'), tree('candidate:b', 'shared')];
  const findings = detectReconciliationConflicts(packet, sharedSystems, trees);
  assert.ok(findings.some(f => /claimed by multiple Systems/.test(f.message)));
  assert.ok(findings.some(f => /share supporting evidence/.test(f.message)));
  assert.ok(findings.some(f => /cross-System dependency/.test(f.message)));
  assert.ok(detectReconciliationConflicts(packet, systems, [tree('candidate:a', 'b'), tree('candidate:b', 'b')])
    .some(f => /outside the challenged System/.test(f.message)));
  assert.ok(detectReconciliationConflicts(packet, [systems[0], { ...systems[1], purpose: systems[0].purpose }],
    [tree('candidate:a', 'a'), tree('candidate:b', 'b')]).some(f => /same name or responsibility/.test(f.message)));
  assert.throws(() => detectReconciliationConflicts(packet, systems, [trees[0]]), /Missing/);
  assert.throws(() => detectReconciliationConflicts(packet, systems, [
    { ...trees[0], nodes: [{ ...trees[0].nodes[0], parentCandidateKey: 'candidate:b' }] }, trees[1],
  ]), /escaped/);
});

test('stage reuse requires exact packet, view, scope, prompt and provider identity', async () => {
  const cache = new SynthesisStageCache();
  let calls = 0;
  const provider = { runStage: async (req: SynthesisStageRequest) => { calls++; return response(req, { systems: [system('a', 'a')] }); } } as SynthesisProvider;
  const first = request('system-discovery');
  const firstRun = await cache.run(first, packet, provider, 'provider/model', 1);
  assert.equal(firstRun.reused, false);
  assert.equal((await cache.run(first, packet, provider, 'provider/model', 1)).reused, true);
  assert.equal(calls, 1);
  assert.notEqual(stageWorkIdentity(first, 'provider/model', 1), stageWorkIdentity(first, 'provider/model', 2));
  assert.notEqual(stageWorkIdentity(first, 'provider/model', 1), stageWorkIdentity(first, 'other/model', 1));
  assert.notEqual(stageWorkIdentity(first, 'provider/model', 1), stageWorkIdentity({ ...first,
    view: createArchitectureEvidenceView(packet, ['a']) }, 'provider/model', 1));
  assert.notEqual(stageWorkIdentity(first, 'provider/model', 1), stageWorkIdentity({ ...first,
    context: { ...first.context, subjectSystemKey: 'candidate:a' } }, 'provider/model', 1));
  await cache.run(first, packet, provider, 'provider/model', 2);
  await cache.run(first, packet, provider, 'other/model', 1);
  const changedPacket = { ...packet, inputFingerprint: 'packet-b' };
  await cache.run(request('system-discovery', 'packet-b'), changedPacket, provider, 'provider/model', 1);
  assert.equal(calls, 4);
  await cache.run(first, packet, { ...provider }, 'provider/model', 1);
  assert.equal(calls, 5);
  await assert.rejects(cache.run(first, changedPacket, provider, 'provider/model', 1), /identity|packet/);
});

test('targeted verification view remains small over a larger complete packet', async () => {
  const large: ArchitectureEvidencePacket = { ...packet, inputFingerprint: 'large', items: [...packet.items,
    ...Array.from({ length: 60 }, (_, i) => ({ id: `extra:${i}`, kind: 'semantic' as const,
      path: `packages/a/src/service-${i}.ts`, sourceEvidenceIds: [`source:${i}`], symbol: `service${i}`,
      relation: 'exported' }))] };
  const capability = { modelLabel: 'model', contextWindowTokens: 100000, maxInputTokens: 90000,
    reservedInstructionTokens: 1000, reservedOutputTokens: 2000, reservedOverheadTokens: 1000,
    tokenEstimate: 'conservative' as const };
  const plan = await planArchitectureEvidence(large, 'verification', { systems: [system('a', 'a')], subtrees: [],
    subjectSystemKey: null, targetCandidateKeys: ['candidate:a'], boundaryQuestion: 'Is this one System?' },
  capability, { estimateTokens: async input => input.length });
  assert.ok(plan.request.view.items.length <= 24);
  assert.ok(plan.request.view.items.some(item => item.id === 'a'));
  assert.equal(large.items.length, 65);
});

test('failed stage has zero automatic retries and is never cached', async () => {
  const cache = new SynthesisStageCache();
  let calls = 0;
  const provider = { runStage: async () => { calls++; throw new Error('provider failed'); } } as unknown as SynthesisProvider;
  await assert.rejects(cache.run(request('system-discovery'), packet, provider, 'provider/model'), /provider failed/);
  assert.equal(calls, 1);
  await assert.rejects(cache.run(request('system-discovery'), packet, provider, 'provider/model'), /provider failed/);
  assert.equal(calls, 2);
});

test('orchestrator caps targeted verification, preserves uncertainty and assembles full-packet refs', async () => {
  const calls: string[] = [];
  const overlappingSystems = systems.map(s => ({ ...s, evidenceRefs: [...s.evidenceRefs, 'shared'] }));
  const provider: SynthesisProvider = {
    capabilities: async () => ({ modelLabel: 'model', contextWindowTokens: 100000, maxInputTokens: 90000,
      reservedInstructionTokens: 1000, reservedOutputTokens: 2000, reservedOverheadTokens: 1000, tokenEstimate: 'conservative' }),
    estimateTokens: async input => input.length,
    runStage: async req => {
      calls.push(req.stage);
      switch (req.stage) {
        case 'system-discovery': return response(req, { systems: overlappingSystems });
        case 'system-challenge': return response(req, { decisions: overlappingSystems.map(s => ({ action: 'keep', sourceKeys: [s.candidateKey],
          systems: [s], rationale: 'Independent behavior', evidenceRefs: s.evidenceRefs })) });
        case 'subsystem-discovery': return response(req, { systemKey: req.context.subjectSystemKey,
          nodes: tree(req.context.subjectSystemKey!, req.context.subjectSystemKey === 'candidate:a' ? 'a' : 'b', 'shared').nodes,
          subdivisionAssessment: { rationale: 'Distinct', confidence: 0.8, uncertainty: [] } });
        case 'reconciliation': return response(req, { findings: [{ candidateKeys: ['candidate:a', 'candidate:b'],
          evidenceRefs: ['cross'], status: 'uncertain', message: 'Cross boundary needs review' }],
          unresolvedCandidateKeys: ['candidate:a', 'candidate:b'] });
        case 'verification':
          assert.ok(req.context.boundaryQuestion);
          assert.ok(req.view.items.length <= 24);
          return response(req, { findings: [{ candidateKeys: req.context.targetCandidateKeys,
            evidenceRefs: [req.view.items[0].id], status: 'uncertain', message: 'Evidence remains ambiguous' }] });
      }
    },
  };
  const orchestrator = new HierarchicalSynthesisOrchestrator(provider, 'fixture');
  const analyzed = await orchestrator.analyze(packet);
  assert.equal(analyzed.verificationCalls, MAX_VERIFICATION_CALLS);
  assert.ok(analyzed.proposal.openQuestions.length);
  assert.ok(analyzed.proposal.nodes.every(node => node.evidenceRefs.every(ref => packet.items.some(item => item.id === ref))));
  assert.deepEqual(parseArchitectureProposal(analyzed.proposal, packet), analyzed.proposal);
  assert.ok(analyzed.timings.some(t => t.operation === 'assembly'));
  assert.ok(analyzed.timings.some(t => t.operation === 'verification-call'));
  const firstCallCount = calls.length;
  const repeated = await orchestrator.analyze(packet);
  assert.equal(calls.length, firstCallCount);
  assert.ok(repeated.timings.filter(t => t.operation === 'stage-call').every(t => t.reused));
  assert.throws(() => parseArchitectureProposal({ ...analyzed.proposal, nodes: analyzed.proposal.nodes.map((n, i) =>
    i === 1 ? { ...n, parentProposalKey: analyzed.proposal.nodes[2].proposalKey } : n) }, packet), /parent/);
});

test('clear boundaries skip reconciliation and verification model calls', async () => {
  const clean: ArchitectureEvidencePacket = { ...packet, inputFingerprint: 'clean',
    items: packet.items.filter(item => item.id !== 'cross' && item.id !== 'shared') };
  const calls: string[] = [];
  const provider: SynthesisProvider = {
    capabilities: async () => ({ modelLabel: 'model', contextWindowTokens: 100000, maxInputTokens: 90000,
      reservedInstructionTokens: 1000, reservedOutputTokens: 2000, reservedOverheadTokens: 1000, tokenEstimate: 'conservative' }),
    estimateTokens: async input => input.length,
    runStage: async req => {
      calls.push(req.stage);
      if (req.stage === 'system-discovery') return response(req, { systems });
      if (req.stage === 'system-challenge') return response(req, { decisions: systems.map(s => ({ action: 'keep',
        sourceKeys: [s.candidateKey], systems: [s], rationale: 'Distinct', evidenceRefs: s.evidenceRefs })) });
      if (req.stage === 'subsystem-discovery') {
        const ref = req.context.subjectSystemKey === 'candidate:a' ? 'a' : 'b';
        return response(req, { systemKey: req.context.subjectSystemKey, nodes: tree(req.context.subjectSystemKey!, ref).nodes,
          subdivisionAssessment: { rationale: 'Distinct', confidence: 0.8, uncertainty: [] } });
      }
      throw new Error(`Unexpected ${req.stage}`);
    },
  };
  const analyzed = await new HierarchicalSynthesisOrchestrator(provider, 'fixture').analyze(clean);
  assert.equal(analyzed.verificationCalls, 0);
  assert.deepEqual(analyzed.proposal.openQuestions, []);
  assert.deepEqual(calls, ['system-discovery', 'system-challenge', 'subsystem-discovery', 'subsystem-discovery']);
});
