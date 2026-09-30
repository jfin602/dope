import assert from 'node:assert/strict';
import test from 'node:test';
import { createArchitectureEvidenceView, detectReconciliationConflicts, HierarchicalSynthesisOrchestrator,
  parseArchitectureProposal, planArchitectureEvidence, SynthesisStageCache, stageWorkIdentity,
  MAX_VERIFICATION_CALLS, MAX_GEMINI_ATTEMPTS, SynthesisProviderFailure } from '../../packages/software-map/lib/index.js';
import type { ArchitectureEvidencePacket, SynthesisProvider, SynthesisStageRequest, SystemSubtree,
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
  name: id, responsibility: `${id} responsibility`, confidence: 0.8,
  ambiguityCodes: [], evidenceRefs: [ref] });
const systems = [system('a', 'a'), system('b', 'b')];
const tree = (systemKey: string, ref: string, ownership = ref): SystemSubtree => ({
  systemKey,
  nodes: [{ candidateKey: `${systemKey}.sub`, kind: 'subsystem', parentCandidateKey: systemKey, name: `${systemKey} sub`,
    responsibility: 'Own behavior', confidence: 0.8,
    ambiguityCodes: [], evidenceRefs: [ref, ...(ownership === ref ? [] : [ownership])], ownershipEvidenceRefs: [ownership] }],
});
const context = { systems: [], subtrees: [], subjectSystemKey: null, subsystems: [], subjectSubsystemKey: null, targetCandidateKeys: [] };
const request = (stage: SynthesisStageRequest['stage'], fingerprint = packet.inputFingerprint): SynthesisStageRequest => ({
  schemaVersion: 1, stageVersion: 3, stage, parentPacketFingerprint: fingerprint,
  view: createArchitectureEvidenceView({ ...packet, inputFingerprint: fingerprint }, ['top', 'a', 'b', 'shared', 'cross']), context,
});
const response = (req: SynthesisStageRequest, extra: object) => ({ schemaVersion: 1, stageVersion: 3,
  stage: req.stage, parentPacketFingerprint: req.parentPacketFingerprint, viewId: req.view.viewId, ...extra });
const executed = (req: SynthesisStageRequest, extra: object) => ({ output: response(req, extra),
  usage: { providerKind: 'local' as const, modelLabel: 'model', requestBytes: 12, outputBytes: 8,
    inputTokens: 12, tokenMeasurement: 'estimated' as const } });

test('deterministic audit catches cross-System duplicate ownership, overlapping support and dependencies', () => {
  const sharedSystems = systems.map(s => ({ ...s, evidenceRefs: [...s.evidenceRefs, 'shared'] }));
  const trees = [tree('candidate:a', 'shared'), tree('candidate:b', 'shared')];
  const findings = detectReconciliationConflicts(packet, sharedSystems, trees);
  assert.ok(findings.some(f => f.code === 'ownership-conflict'));
  assert.ok(findings.some(f => f.code === 'boundary-overlap'));
  assert.ok(findings.some(f => f.code === 'cross-system-dependency'));
  assert.ok(detectReconciliationConflicts(packet, systems, [tree('candidate:a', 'b'), tree('candidate:b', 'b')])
    .some(f => f.code === 'outside-system'));
  assert.ok(!detectReconciliationConflicts(packet, [system('root', 'top')], [tree('candidate:root', 'a')])
    .some(f => f.code === 'outside-system'));
  assert.ok(detectReconciliationConflicts(packet, [systems[0], { ...systems[1], responsibility: systems[0].responsibility }],
    [tree('candidate:a', 'a'), tree('candidate:b', 'b')]).some(f => f.code === 'duplicate-responsibility'));
  assert.throws(() => detectReconciliationConflicts(packet, systems, [trees[0]]), /Missing/);
  assert.throws(() => detectReconciliationConflicts(packet, systems, [
    { ...trees[0], nodes: [{ ...trees[0].nodes[0], parentCandidateKey: 'candidate:b' }] }, trees[1],
  ]), /escaped/);
});

test('challenged Subsystem peers expose direct ownership and dependency conflicts', () => {
  const first = tree('candidate:a', 'a').nodes[0];
  const second = { ...first, candidateKey: 'candidate:a.other', name: 'Other', responsibility: 'Other behavior',
    evidenceRefs: ['a', 'b'], ownershipEvidenceRefs: ['a', 'b'] };
  const findings = detectReconciliationConflicts(packet, [system('a', 'a')],
    [{ systemKey: 'candidate:a', nodes: [first, second] }]);
  assert.ok(findings.some(f => f.code === 'ownership-conflict' && f.candidateKeys.includes(second.candidateKey)));
  const separated = { ...second, ownershipEvidenceRefs: ['b'], evidenceRefs: ['b'] };
  assert.ok(detectReconciliationConflicts(packet, [system('a', 'a')],
    [{ systemKey: 'candidate:a', nodes: [first, separated] }]).some(f => f.code === 'cross-subsystem-dependency'));
});

test('stage reuse requires exact packet, view, scope, prompt and provider identity', async () => {
  const cache = new SynthesisStageCache();
  let calls = 0;
  const provider = { kind: 'local', runStage: async (req: SynthesisStageRequest) => { calls++; return executed(req, { systems: [system('a', 'a')] }); } } as SynthesisProvider;
  const first = request('system-discovery');
  const firstRun = await cache.run(first, packet, provider, 'provider/model', 1);
  assert.equal(firstRun.reused, false);
  assert.deepEqual(firstRun.usage, executed(first, {}).usage);
  assert.ok(firstRun.durationMs >= 0);
  assert.equal(cache.attempts().length, 1);
  assert.equal(cache.attempts()[0].consumed, true);
  const reused = await cache.run(first, packet, provider, 'provider/model', 1);
  assert.equal(reused.reused, true);
  assert.equal(reused.durationMs, 0);
  assert.equal(reused.usage, undefined);
  assert.equal(calls, 1);
  assert.equal(cache.attempts().length, 1);
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
    subjectSystemKey: null, subsystems: [], subjectSubsystemKey: null, targetCandidateKeys: ['candidate:a'], boundaryCode: 'boundary-overlap' },
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

test('Gemini transient retry retains failed and consumed attempts with exact request/model identity', async () => {
  const cache = new SynthesisStageCache();
  const req = request('system-discovery');
  const seen: SynthesisStageRequest[] = [];
  const projected: string[] = [];
  const provider = { kind: 'gemini', runStage: async (input: SynthesisStageRequest) => {
    seen.push(input);
    if (seen.length === 1) throw new SynthesisProviderFailure('safe transport failure', 'transient-transport');
    return { ...executed(input, { systems: [system('a', 'a')] }),
      usage: { ...executed(input, {}).usage, providerKind: 'gemini' as const, modelLabel: 'gemini-fixed' } };
  } } as SynthesisProvider;
  await cache.run(req, packet, provider, 'gemini/model', 1, () => {}, item => projected.push(item.attemptId), 'gemini-fixed');
  const attempts = cache.attempts();
  assert.equal(attempts.length, 2);
  assert.deepEqual(projected, attempts.map(item => item.attemptId));
  assert.deepEqual(attempts.map(item => item.consumed), [false, true]);
  assert.equal(attempts[0].failureClass, 'transient-transport');
  assert.equal(attempts[0].tokenMeasurement, 'unavailable');
  assert.equal(attempts[1].retryOf, attempts[0].attemptId);
  assert.equal(attempts[0].callId, attempts[1].callId);
  assert.ok(attempts.every(item => item.providerKind === 'gemini' && item.modelLabel === 'gemini-fixed' &&
    item.requestBytes === Buffer.byteLength(JSON.stringify(req)) && item.durationMs >= 0));
  assert.equal(seen[0], seen[1]);
  assert.equal(JSON.stringify(attempts).includes('safe transport failure'), false);
  projected.length = 0;
  assert.equal(cache.attempts().length, 2);
  attempts[0].modelLabel = 'mutated';
  assert.equal(cache.attempts()[0].modelLabel, 'gemini-fixed');
});

test('Gemini retry cap and nonretryable stage failures remain explicit', async () => {
  const req = request('system-discovery');
  for (const failure of ['upstream', 'invalid-json', 'schema', 'content', 'auth'] as const) {
    const cache = new SynthesisStageCache();
    let calls = 0;
    const provider = { kind: 'gemini', runStage: async (input: SynthesisStageRequest) => {
      calls++;
      if (failure === 'upstream') throw new SynthesisProviderFailure('safe upstream', 'transient-upstream');
      if (failure === 'invalid-json') throw new SynthesisProviderFailure('Invalid Gemini stage JSON', 'invalid-json');
      if (failure === 'auth') throw new SynthesisProviderFailure('Gemini authentication failed (HTTP 401)', 'authentication');
      return executed(input, { systems: [{ ...system('a', 'a'),
        ...(failure === 'schema' ? { extra: true } : { evidenceRefs: ['fabricated'] }) }] });
    } } as SynthesisProvider;
    await assert.rejects(cache.run(req, packet, provider, 'gemini/model'));
    assert.equal(calls, failure === 'upstream' ? MAX_GEMINI_ATTEMPTS : 1, failure);
    assert.equal(cache.attempts().length, calls);
    assert.ok(cache.attempts().every(item => !item.consumed));
    if (failure === 'invalid-json') assert.equal(cache.attempts()[0].failureClass, 'invalid-json');
    if (failure === 'auth') assert.equal(cache.attempts()[0].failureClass, 'authentication');
    if (failure === 'schema' || failure === 'content')
      assert.equal(cache.attempts()[0].failureClass, 'invalid-stage-result');
  }
});

test('failed provider calls retain duration and status without fabricated token spend', async () => {
  const timings: { status?: string; durationMs: number; usage?: unknown; providerKind?: string; modelLabel?: string }[] = [];
  const provider: SynthesisProvider = { kind: 'local',
    capabilities: async () => ({ modelLabel: 'model', contextWindowTokens: 100000, maxInputTokens: 90000,
      reservedInstructionTokens: 1000, reservedOutputTokens: 2000, reservedOverheadTokens: 1000,
      tokenEstimate: 'conservative' }),
    estimateTokens: async input => input.length,
    runStage: async () => { throw new Error('provider failed'); } };
  await assert.rejects(new HierarchicalSynthesisOrchestrator(provider, 'fixture', undefined,
    timing => timings.push(timing)).analyze(packet), /provider failed/);
  assert.equal(timings.at(-1)?.status, 'failed');
  assert.equal(timings.at(-1)?.providerKind, 'local');
  assert.equal(timings.at(-1)?.modelLabel, 'model');
  assert.equal(timings.at(-1)?.usage, undefined);
  assert.ok(timings.at(-1)!.durationMs >= 0);
});

test('rejected stage JSON still accounts for provider-reported usage', async () => {
  const timings: { status?: string; usage?: { inputTokens?: number }; durationMs: number }[] = [];
  const provider: SynthesisProvider = { kind: 'local',
    capabilities: async () => ({ modelLabel: 'model', contextWindowTokens: 100000, maxInputTokens: 90000,
      reservedInstructionTokens: 1000, reservedOutputTokens: 2000, reservedOverheadTokens: 1000,
      tokenEstimate: 'conservative' }),
    estimateTokens: async input => input.length,
    runStage: async req => ({ ...executed(req, { systems: [{ ...system('a', 'a'), rationale: 'surplus' }] }),
      usage: { ...executed(req, {}).usage, inputTokens: 31, tokenMeasurement: 'provider-reported' } }) };
  await assert.rejects(new HierarchicalSynthesisOrchestrator(provider, 'fixture', undefined,
    timing => timings.push(timing)).analyze(packet), /fields/);
  assert.equal(timings.at(-1)?.status, 'failed');
  assert.equal(timings.at(-1)?.usage?.inputTokens, 31);
  assert.ok(timings.at(-1)!.durationMs >= 0);
});

test('orchestrator caps targeted verification, preserves uncertainty and assembles full-packet refs', async () => {
  const calls: string[] = [];
  const overlappingSystems = systems.map(s => ({ ...s, evidenceRefs: [...s.evidenceRefs, 'shared'] }));
  const provider: SynthesisProvider = {
    kind: 'local',
    capabilities: async () => ({ modelLabel: 'model', contextWindowTokens: 100000, maxInputTokens: 90000,
      reservedInstructionTokens: 1000, reservedOutputTokens: 2000, reservedOverheadTokens: 1000, tokenEstimate: 'conservative' }),
    estimateTokens: async input => input.length,
    runStage: async req => {
      calls.push(req.stage);
      switch (req.stage) {
        case 'system-discovery': return executed(req, { systems: overlappingSystems });
        case 'system-challenge': return executed(req, { decisions: overlappingSystems.map(s => ({ action: 'keep', sourceKeys: [s.candidateKey],
          systems: [s], evidenceRefs: s.evidenceRefs })) });
        case 'subsystem-discovery': return executed(req, { systemKey: req.context.subjectSystemKey,
          subsystems: tree(req.context.subjectSystemKey!, req.context.subjectSystemKey === 'candidate:a' ? 'a' : 'b', 'shared').nodes });
        case 'subsystem-challenge': return executed(req, { systemKey: req.context.subjectSystemKey,
          decisions: req.context.subsystems.map(node => ({ action: 'keep', sourceKeys: [node.candidateKey],
            subsystems: [node], evidenceRefs: node.evidenceRefs })) });
        case 'component-discovery': return executed(req, { systemKey: req.context.subjectSystemKey,
          subsystemKey: req.context.subjectSubsystemKey, components: [] });
        case 'reconciliation': return executed(req, { findings: [{ candidateKeys: ['candidate:a', 'candidate:b'],
          evidenceRefs: ['cross'], status: 'uncertain', code: 'boundary-overlap' }],
          unresolved: [{ candidateKey: 'candidate:a', code: 'boundary-overlap' }, { candidateKey: 'candidate:b', code: 'boundary-overlap' }] });
        case 'verification':
          assert.ok(req.context.boundaryCode);
          assert.ok(req.view.items.length <= 24);
          return executed(req, { findings: [{ candidateKeys: req.context.targetCandidateKeys,
            evidenceRefs: [req.view.items[0].id], status: 'uncertain', code: req.context.boundaryCode }] });
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
  assert.ok(analyzed.timings.filter(t => t.operation === 'stage-call').every(t => t.usage?.modelLabel === 'model'));
  assert.ok(repeated.timings.filter(t => t.operation === 'stage-call').every(t => t.durationMs === 0 && !t.usage));
  assert.throws(() => parseArchitectureProposal({ ...analyzed.proposal, nodes: analyzed.proposal.nodes.map((n, i) =>
    i === 1 ? { ...n, parentProposalKey: analyzed.proposal.nodes[2].proposalKey } : n) }, packet), /parent/);
});

test('clear boundaries skip reconciliation and verification model calls', async () => {
  const clean: ArchitectureEvidencePacket = { ...packet, inputFingerprint: 'clean',
    items: packet.items.filter(item => item.id !== 'cross' && item.id !== 'shared') };
  const calls: string[] = [];
  const provider: SynthesisProvider = {
    kind: 'local',
    capabilities: async () => ({ modelLabel: 'model', contextWindowTokens: 100000, maxInputTokens: 90000,
      reservedInstructionTokens: 1000, reservedOutputTokens: 2000, reservedOverheadTokens: 1000, tokenEstimate: 'conservative' }),
    estimateTokens: async input => input.length,
    runStage: async req => {
      calls.push(req.stage);
      if (req.stage === 'system-discovery') return executed(req, { systems });
      if (req.stage === 'system-challenge') return executed(req, { decisions: systems.map(s => ({ action: 'keep',
        sourceKeys: [s.candidateKey], systems: [s], evidenceRefs: s.evidenceRefs })) });
      if (req.stage === 'subsystem-discovery') {
        const ref = req.context.subjectSystemKey === 'candidate:a' ? 'a' : 'b';
        return executed(req, { systemKey: req.context.subjectSystemKey, subsystems: tree(req.context.subjectSystemKey!, ref).nodes });
      }
      if (req.stage === 'subsystem-challenge') return executed(req, { systemKey: req.context.subjectSystemKey,
        decisions: req.context.subsystems.map(node => ({ action: 'keep', sourceKeys: [node.candidateKey],
          subsystems: [node], evidenceRefs: node.evidenceRefs })) });
      if (req.stage === 'component-discovery') return executed(req, { systemKey: req.context.subjectSystemKey,
        subsystemKey: req.context.subjectSubsystemKey, components: [] });
      throw new Error(`Unexpected ${req.stage}`);
    },
  };
  const analyzed = await new HierarchicalSynthesisOrchestrator(provider, 'fixture').analyze(clean);
  assert.equal(analyzed.verificationCalls, 0);
  assert.deepEqual(analyzed.proposal.openQuestions, []);
  assert.deepEqual(calls, ['system-discovery', 'system-challenge', 'subsystem-discovery', 'subsystem-challenge',
    'component-discovery', 'subsystem-discovery', 'subsystem-challenge', 'component-discovery']);
});
