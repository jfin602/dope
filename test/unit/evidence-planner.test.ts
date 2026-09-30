import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { deriveResponsibilitySignals, planArchitectureEvidence, validateArchitectureEvidenceView,
  validateSynthesisStageRequest } from '../../packages/software-map/lib/index.js';
import type { ArchitectureEvidenceItem, ArchitectureEvidencePacket, SynthesisCapabilities,
  SynthesisStageContext, SystemCandidate } from '../../packages/software-map/lib/index.js';

const context = (systems: SystemCandidate[] = [], subjectSystemKey: string | null = null,
  targetCandidateKeys: string[] = []): SynthesisStageContext =>
  ({ systems, subjectSystemKey, subsystems: [], subjectSubsystemKey: null, subtrees: [], targetCandidateKeys,
    ...(targetCandidateKeys.length ? { boundaryCode: 'boundary-overlap' as const } : {}) });
const capability = (ceiling: number): SynthesisCapabilities => ({ modelLabel: 'controlled provider',
  contextWindowTokens: ceiling + 30, maxInputTokens: ceiling + 20, reservedInstructionTokens: 10,
  reservedOutputTokens: 10, reservedOverheadTokens: 10, tokenEstimate: 'exact' });
const counter = { estimateTokens: async (input: string) => Math.ceil(input.length / 4) };
const item = (id: string, kind: ArchitectureEvidenceItem['kind'], path: string): ArchitectureEvidenceItem => {
  const base = { id, path, sourceEvidenceIds: [`source:${id}`] };
  switch (kind) {
    case 'topology': return { ...base, kind, scope: 'package', name: id };
    case 'entrypoint': return { ...base, kind, role: 'main:src/index.ts' };
    case 'configuration': return { ...base, kind, signal: 'configured-ts-js-project' };
    case 'dependency': return { ...base, kind, targetPath: 'packages/api/src/index.ts', relation: 'imports', relationshipIds: [`relation:${id}`] };
    case 'semantic': return { ...base, kind, symbol: id, relation: 'class:exported' };
    case 'framework': return { ...base, kind, framework: 'inversify', producer: 'analyzer', producerVersion: '1', concept: 'binding', name: id };
  }
};
const facts: ArchitectureEvidenceItem[] = [
  item('workspace', 'topology', 'package.json'), item('app', 'topology', 'packages/app/package.json'),
  item('start', 'entrypoint', 'packages/app/package.json'), item('service', 'framework', 'packages/app/src/module.ts'),
  item('edge', 'dependency', 'packages/app/src/service.ts'), item('public', 'semantic', 'packages/app/src/index.ts'),
  ...Array.from({ length: 100 }, (_, i) => item(`test-${i}`, 'semantic', `test/fixtures/example-${i}.ts`)),
  ...Array.from({ length: 100 }, (_, i) => item(`detail-${i}`, 'semantic', `packages/app/src/detail-${i}.ts`)),
];
const packet: ArchitectureEvidencePacket = { schemaVersion: 1, inputFingerprint: 'packet:controlled',
  sourceFingerprint: 'source:controlled', items: facts };
const system: SystemCandidate = { candidateKey: 'candidate:app', kind: 'system', name: 'App', responsibility: 'Serve',
  confidence: 0.8, ambiguityCodes: [], evidenceRefs: ['start', 'public'] };

test('global skeleton is stable, bounded, whole, source-backed, and prioritizes production signals', async () => {
  const before = structuredClone(packet);
  const first = await planArchitectureEvidence(packet, 'system-discovery', context(), capability(1100), counter);
  const second = await planArchitectureEvidence(packet, 'system-discovery', context(), capability(1100), counter);
  assert.deepEqual(first, second);
  assert.deepEqual(packet, before);
  assert.ok(first.inputTokens <= first.inputBudgetTokens);
  assert.equal(first.inputTokens, await counter.estimateTokens(JSON.stringify(first.request)));
  assert.ok(first.includedEvidenceRefs.includes('app'));
  assert.ok(first.includedEvidenceRefs.includes('start'));
  assert.ok(first.includedEvidenceRefs.includes('service'));
  assert.ok(first.omittedEvidenceRefs.length > 100);
  assert.ok(first.includedEvidenceRefs.length < packet.items.length / 2);
  const originals = new Map(packet.items.map(fact => [fact.id, fact]));
  for (const fact of first.request.view.items) assert.deepEqual(fact, originals.get(fact.id));
  assert.deepEqual([...first.includedEvidenceRefs, ...first.omittedEvidenceRefs].sort(), packet.items.map(fact => fact.id).sort());
  assert.ok(first.request.view.items.filter(fact => fact.id.startsWith('test-')).length <
    first.request.view.items.filter(fact => !fact.id.startsWith('test-')).length);
  validateSynthesisStageRequest(first.request, packet);
  assert.notEqual((await planArchitectureEvidence(packet, 'system-discovery', context(), capability(1200), counter)).planId, first.planId);
  const revised = structuredClone(packet);
  const entry = revised.items.find(fact => fact.id === 'start') as Extract<ArchitectureEvidenceItem, { kind: 'entrypoint' }>;
  entry.role = 'main:revised.ts';
  assert.notEqual((await planArchitectureEvidence(revised, 'system-discovery', context(), capability(1100), counter)).planId, first.planId);
});

test('minimal skeleton fits exactly when possible and fails clearly below that', async () => {
  const minimal = await planArchitectureEvidence(packet, 'system-discovery', context(), capability(600), counter);
  assert.ok(minimal.includedEvidenceRefs.includes('start'));
  assert.ok(minimal.request.view.items.every(fact => facts.includes(fact)) === false); // cloned, never shared
  await assert.rejects(planArchitectureEvidence(packet, 'system-discovery', context(), capability(20), counter), /minimal.*skeleton|context exceeds/);
});

test('bootstrap and supporting documents leave room for source-backed System discovery', async () => {
  const document = (path: string, kind: 'modules-seed' | 'readme-orientation' | 'architecture', content: string) =>
    ({ path, class: kind, authority: 'Documented' as const, status: 'unknown' as const,
      sha256: 'a'.repeat(64), bytes: content.length, truncated: false, content });
  const documented: ArchitectureEvidencePacket = { ...packet, documents: [
    document('MODULES.md', 'modules-seed', 'M'.repeat(4741)),
    document('README.md', 'readme-orientation', 'R'.repeat(6340)),
    ...Array.from({ length: 8 }, (_, i) => document(`docs/architecture/${i}.md`, 'architecture', 'D'.repeat(2000))),
  ] };
  const byteCounter = { estimateTokens: async (input: string) => Buffer.byteLength(input) };
  const plan = await planArchitectureEvidence(documented, 'system-discovery', context(),
    { modelLabel: 'controlled provider', contextWindowTokens: 1_048_576, maxInputTokens: 32_768,
      reservedInstructionTokens: 2048, reservedOutputTokens: 4096, reservedOverheadTokens: 1024,
      tokenEstimate: 'conservative' }, byteCounter);
  assert.ok(plan.includedEvidenceRefs.includes('start'));
  assert.deepEqual(plan.request.view.documents?.slice(0, 2).map(doc => [doc.path, doc.truncated]),
    [['MODULES.md', false], ['README.md', false]]);
  assert.ok(plan.inputTokens <= plan.inputBudgetTokens);
  validateSynthesisStageRequest(plan.request, documented);
  const challenge = await planArchitectureEvidence(documented, 'system-challenge', context([
    { ...system, evidenceRefs: ['start', 'service', 'edge', 'public'] },
  ]), { modelLabel: 'controlled provider', contextWindowTokens: 1_048_576, maxInputTokens: 32_768,
    reservedInstructionTokens: 2048, reservedOutputTokens: 4096, reservedOverheadTokens: 1024,
    tokenEstimate: 'conservative' }, byteCounter);
  assert.ok(challenge.includedEvidenceRefs.includes('public'));
  assert.ok(challenge.request.view.documents?.some(doc => doc.path === 'README.md'));
  validateSynthesisStageRequest(challenge.request, documented);
});

test('later stages use candidate refs and packet relationships, never arbitrary path requests', async () => {
  const subtree = { systemKey: system.candidateKey, nodes: [] };
  for (const [stage, ctx] of [
    ['system-challenge', context([system])], ['subsystem-discovery', context([system], system.candidateKey)],
    ['verification', context([system], null, [system.candidateKey])],
    ['reconciliation', { ...context([system]), subtrees: [subtree] }],
  ] as const) {
    const plan = await planArchitectureEvidence(packet, stage, ctx, capability(1100), counter);
    validateSynthesisStageRequest(plan.request, packet);
    assert.ok(plan.includedEvidenceRefs.includes('start') || plan.includedEvidenceRefs.includes('public'));
    assert.ok(plan.includedEvidenceRefs.every(ref => packet.items.some(fact => fact.id === ref)));
    if (stage === 'reconciliation') assert.ok(plan.includedEvidenceRefs.includes('edge'));
  }
  await assert.rejects(planArchitectureEvidence(packet, 'verification', context([system], null, ['candidate:missing']),
    capability(1100), counter), /unknown request target/);
  await assert.rejects(planArchitectureEvidence(packet, 'subsystem-discovery', context([{ ...system,
    evidenceRefs: ['../../secret'] }], system.candidateKey), capability(1100), counter), /unknown/);
  await assert.rejects(planArchitectureEvidence(packet, 'system-discovery', { ...context(),
    path: '/tmp/secret' } as SynthesisStageContext, capability(1100), counter), /fields/);
});

test('planner never reads canonical declarations into physical evidence', async () => {
  const withDeclaration = { ...packet, items: [...packet.items,
    item('declaration', 'topology', '.dope/architecture.json')] };
  const plan = await planArchitectureEvidence(withDeclaration, 'system-discovery', context(), capability(1100), counter);
  assert.ok(plan.omittedEvidenceRefs.includes('declaration'));
  assert.equal(JSON.stringify(plan.request).includes('architecture.json'), false);
  assert.equal(JSON.stringify(plan.request).includes('canonicalId'), false);
  await assert.rejects(planArchitectureEvidence(withDeclaration, 'subsystem-discovery',
    context([{ ...system, evidenceRefs: ['declaration'] }], system.candidateKey), capability(1100), counter), /declarations/);
});

test('root manifest System scope includes production source behavior for Subsystem discovery', async () => {
  const scoped: ArchitectureEvidencePacket = { schemaVersion: 1, inputFingerprint: 'root-manifest', items: [
    item('root', 'entrypoint', 'package.json'),
    ...Array.from({ length: 6 }, (_, i) => item(`client-${i}`, 'semantic', `src/client/app/file-${i}.ts`)),
    item('worker', 'semantic', 'src/server/worker.ts'), item('test', 'semantic', 'test/main.test.ts'),
  ] };
  const parent = { ...system, evidenceRefs: ['root'] };
  const plan = await planArchitectureEvidence(scoped, 'subsystem-discovery', context([parent], parent.candidateKey),
    capability(450), counter);
  assert.ok(plan.includedEvidenceRefs.includes('client-0'));
  assert.ok(plan.includedEvidenceRefs.includes('worker'));
  assert.ok(!plan.includedEvidenceRefs.includes('test'));
});

test('cross-area responsibility cues are deterministic, bounded, source-backed and non-authoritative', async () => {
  const crossArea: ArchitectureEvidencePacket = { schemaVersion: 1, inputFingerprint: 'cross-area', items: [
    item('root', 'topology', 'package.json'), item('start', 'entrypoint', 'package.json'),
    { ...item('client', 'semantic', 'src/client/orders.ts'), symbol: 'OrderSummary' },
    { ...item('server', 'semantic', 'src/server/orders.ts'), symbol: 'OrderController' },
    { ...item('worker', 'semantic', 'src/worker/orders.ts'), symbol: 'OrderProcessor' },
    item('noise', 'semantic', 'test/orders.test.ts'),
  ] as ArchitectureEvidenceItem[] };
  const original = structuredClone(crossArea);
  const first = await planArchitectureEvidence(crossArea, 'system-discovery', context(), capability(1800), counter);
  const second = await planArchitectureEvidence(crossArea, 'system-discovery', context(), capability(1800), counter);
  assert.deepEqual(first, second);
  assert.deepEqual(crossArea, original);
  const signal = first.request.view.responsibilitySignals.find(value => value.concept === 'order');
  assert.ok(signal);
  assert.deepEqual(signal.evidenceRefs, ['client', 'server', 'worker']);
  assert.deepEqual(signal.sourceAreas, ['src/client', 'src/server', 'src/worker']);
  assert.ok(signal.key.startsWith('signal:v1:'));
  assert.deepEqual(deriveResponsibilitySignals(first.request.view.items), first.request.view.responsibilitySignals);
  assert.ok(signal.evidenceRefs.every(ref => first.includedEvidenceRefs.includes(ref)));
  assert.ok(first.request.view.items.every(fact => crossArea.items.some(parent => parent.id === fact.id)));
  assert.ok(!JSON.stringify(first.request).includes('test/orders.test.ts'));
  validateArchitectureEvidenceView(first.request.view, crossArea);
  assert.throws(() => validateArchitectureEvidenceView({ ...first.request.view,
    responsibilitySignals: [{ ...signal, evidenceRefs: ['fabricated'] }] }, crossArea), /signals/);
  assert.equal('systems' in first.request.view, false);
  assert.equal('ownership' in signal, false);
  const scoped = await planArchitectureEvidence(crossArea, 'subsystem-discovery',
    context([{ ...system, evidenceRefs: ['server'] }], system.candidateKey), capability(1800), counter);
  assert.ok(scoped.includedEvidenceRefs.includes('server'));
  assert.ok(scoped.includedEvidenceRefs.includes('client'));
  assert.ok(scoped.request.view.responsibilitySignals.some(value => value.concept === 'order'));
});

test('production planner policy contains no benchmark answer vocabulary', () => {
  const policy = readFileSync(new URL('../../packages/software-map/src/evidence-planner.ts', import.meta.url), 'utf8') +
    readFileSync(new URL('../../packages/software-map/src/hierarchical-synthesis.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(policy, /\b(?:Feed|Delivery|Integration|Opportunity|GA4|Ahrefs)\b/i);
});
