import assert from 'node:assert/strict';
import test from 'node:test';
import { discoverSystemHierarchy, planArchitectureEvidence, parseSynthesisStageResult,
  stageWorkIdentity, synthesisStageResultSchemas, buildCoverageLedger,
  assembleArchitectureProposal } from '../../packages/software-map/lib/index.js';
import type { ArchitectureEvidencePacket, SubsystemCandidate, SynthesisProvider, SynthesisStageContext,
  SynthesisStageRequest, SystemCandidate } from '../../packages/software-map/lib/index.js';

const fact = (id: string, path: string) => ({ id, kind: 'semantic' as const, path,
  symbol: id, relation: 'class:exported', sourceEvidenceIds: [`source:${id}`] });
const packet: ArchitectureEvidencePacket = { schemaVersion: 1, inputFingerprint: 'responsibility-fixture', items: [
  fact('client', 'src/client/orders.ts'), fact('server', 'src/server/orders.ts'),
  fact('worker', 'src/worker/orders.ts'), fact('platform', 'src/worker/execution.ts'),
  fact('store', 'src/server/order-store.ts'), fact('other', 'src/server/reports.ts'),
] };
const system: SystemCandidate = { candidateKey: 'candidate:product', kind: 'system', name: 'Product',
  responsibility: 'Process orders', confidence: .8, ambiguityCodes: [], evidenceRefs: ['client', 'server', 'worker', 'platform', 'store'] };
const subsystem = (key: string, refs: string[], parent = system.candidateKey): SubsystemCandidate => ({
  candidateKey: `candidate:${key}`, kind: 'subsystem', parentCandidateKey: parent, name: key,
  responsibility: `${key} responsibility`, confidence: .8, ambiguityCodes: [], evidenceRefs: refs,
  ownershipEvidenceRefs: refs });
const frontend = subsystem('frontend', ['client']);
const backend = subsystem('backend', ['server', 'worker', 'store']);
const platform = subsystem('platform', ['platform']);
const orders = subsystem('orders', ['client', 'server', 'worker', 'store']);
const context = (subsystems: SubsystemCandidate[] = [], subjectSubsystemKey: string | null = null): SynthesisStageContext =>
  ({ systems: [system], subjectSystemKey: system.candidateKey, subsystems, subjectSubsystemKey,
    subtrees: [], targetCandidateKeys: [] });
const capability = { modelLabel: 'fixture', contextWindowTokens: 40000, maxInputTokens: 40000,
  reservedInstructionTokens: 100, reservedOutputTokens: 100, reservedOverheadTokens: 100, tokenEstimate: 'exact' as const };
const counter = { estimateTokens: async (input: string) => input.length };
const result = (request: SynthesisStageRequest, fields: object) => ({ schemaVersion: 1, stageVersion: 3,
  stage: request.stage, parentPacketFingerprint: packet.inputFingerprint, viewId: request.view.viewId, ...fields });
const decisions = [
  { action: 'merge', sourceKeys: [frontend.candidateKey, backend.candidateKey], subsystems: [orders],
    evidenceRefs: ['client', 'server', 'worker'] },
  { action: 'keep', sourceKeys: [platform.candidateKey], subsystems: [platform], evidenceRefs: ['platform'] },
];

test('technical tiers merge into one cross-layer responsibility while an execution platform survives', async () => {
  const calls: SynthesisStageRequest[] = [];
  const provider: SynthesisProvider = { kind: 'local', capabilities: async () => capability,
    estimateTokens: counter.estimateTokens, runStage: async request => {
      calls.push(request);
      const fields = request.stage === 'subsystem-discovery' ? { systemKey: system.candidateKey,
        subsystems: [frontend, backend, platform] } : request.stage === 'subsystem-challenge'
        ? { systemKey: system.candidateKey, decisions } : {
          systemKey: system.candidateKey, subsystemKey: request.context.subjectSubsystemKey,
          components: [{ candidateKey: `candidate:${request.context.subjectSubsystemKey!.split(':')[1]}-unit`,
            kind: 'component', parentCandidateKey: request.context.subjectSubsystemKey, name: 'Unit',
            responsibility: 'Implement responsibility', confidence: .8, ambiguityCodes: [],
            evidenceRefs: request.context.subjectSubsystemKey === orders.candidateKey ? ['client', 'server', 'worker'] : ['platform'],
            ownershipEvidenceRefs: request.context.subjectSubsystemKey === orders.candidateKey ? ['client', 'server', 'worker'] : ['platform'] }] };
      return { output: result(request, fields), usage: { providerKind: 'local', modelLabel: 'fixture',
        requestBytes: 1, outputBytes: 1, tokenMeasurement: 'unavailable' } };
    } };
  const systemChallenge = await planArchitectureEvidence(packet, 'system-challenge',
    { systems: [system], subjectSystemKey: null, subsystems: [], subjectSubsystemKey: null,
      subtrees: [], targetCandidateKeys: [] }, capability, counter);
  const first = await discoverSystemHierarchy(packet, { plan: systemChallenge,
    result: parseSynthesisStageResult(result(systemChallenge.request, { decisions: [{ action: 'keep',
      sourceKeys: [system.candidateKey], systems: [system], evidenceRefs: system.evidenceRefs }] }),
      systemChallenge.request, packet) as any }, system.candidateKey, provider);
  assert.deepEqual(calls.map(call => call.stage), ['subsystem-discovery', 'subsystem-challenge',
    'component-discovery', 'component-discovery']);
  assert.deepEqual(first.tree.nodes.filter(node => node.kind === 'subsystem').map(node => node.candidateKey),
    [orders.candidateKey, platform.candidateKey]);
  assert.deepEqual(calls.slice(2).map(call => call.context.subjectSubsystemKey), [orders.candidateKey, platform.candidateKey]);
  assert.ok(calls[2].view.items.some(item => item.path.startsWith('src/client/')));
  assert.ok(calls[2].view.items.some(item => item.path.startsWith('src/worker/')));
  assert.ok(calls[1].view.items.some(item => item.id === 'other')); // counter evidence outside initial claims
  const second = await planArchitectureEvidence(packet, 'subsystem-challenge', context([frontend, backend, platform]), capability, counter);
  assert.deepEqual(first.challenge.plan, second);
  assert.equal(stageWorkIdentity(first.challenge.plan.request, 'local:fixture'), stageWorkIdentity(second.request, 'local:fixture'));
  assert.deepEqual(synthesisStageResultSchemas['subsystem-discovery'].properties.subsystems.items.properties.kind, { const: 'subsystem' });
  assert.deepEqual(synthesisStageResultSchemas['component-discovery'].properties.components.items.properties.kind, { const: 'component' });
});

test('Subsystem Challenge coverage, parent, refs and compact shape fail closed', async () => {
  const plan = await planArchitectureEvidence(packet, 'subsystem-challenge', context([frontend, backend, platform]), capability, counter);
  assert.deepEqual(parseSynthesisStageResult(result(plan.request, { systemKey: system.candidateKey, decisions }), plan.request, packet).stage,
    'subsystem-challenge');
  const split = [
    { action: 'reject', sourceKeys: [frontend.candidateKey], subsystems: [], evidenceRefs: ['client'] },
    { action: 'split', sourceKeys: [backend.candidateKey], subsystems: [
      subsystem('order-service', ['server', 'store']), subsystem('order-jobs', ['worker'])], evidenceRefs: ['server', 'worker'] },
    decisions[1],
  ];
  assert.equal(parseSynthesisStageResult(result(plan.request, { systemKey: system.candidateKey, decisions: split }),
    plan.request, packet).stage, 'subsystem-challenge');
  const bad = [
    decisions.slice(0, 1), [decisions[0], decisions[0], decisions[1]],
    [{ ...decisions[0], action: 'keep' }, decisions[1]],
    [{ ...decisions[0], subsystems: [{ ...orders, parentCandidateKey: 'candidate:foreign' }] }, decisions[1]],
    [{ ...decisions[0], subsystems: [{ ...orders, evidenceRefs: ['fabricated'] }] }, decisions[1]],
    [{ ...decisions[0], subsystems: [{ ...orders, canonicalId: 'orders' }] }, decisions[1]],
    [{ ...decisions[0], evidenceRefs: ['fabricated'] }, decisions[1]],
  ];
  for (const choices of bad) assert.throws(() => parseSynthesisStageResult(result(plan.request,
    { systemKey: system.candidateKey, decisions: choices }), plan.request, packet));
  const empty = await planArchitectureEvidence(packet, 'subsystem-challenge', context(), capability, counter);
  assert.equal(parseSynthesisStageResult(result(empty.request,
    { systemKey: system.candidateKey, decisions: [] }), empty.request, packet).stage, 'subsystem-challenge');
});

test('challenge recovers only an uncovered implementation cue under its System', async () => {
  const plan = await planArchitectureEvidence(packet, 'subsystem-challenge', context([frontend]), capability, counter);
  const cue = plan.request.view.responsibilitySignals.find(item => item.strength === 'behavior' && item.evidenceRefs.includes('other'))!;
  assert.ok(cue);
  const recovery = { cueKey: cue.key, subsystem: subsystem('reports', ['other']) };
  const fields = { systemKey: system.candidateKey, decisions: [{ action: 'keep', sourceKeys: [frontend.candidateKey],
    subsystems: [frontend], evidenceRefs: ['client'] }], recovered: [recovery] };
  const accepted = parseSynthesisStageResult(result(plan.request, fields), plan.request, packet);
  assert.equal(accepted.stage, 'subsystem-challenge');
  assert.throws(() => parseSynthesisStageResult(result(plan.request, { ...fields, recovered: [
    { ...recovery, subsystem: subsystem('docs-only', ['fabricated']) }] }), plan.request, packet));
  assert.throws(() => parseSynthesisStageResult(result(plan.request, { ...fields, recovered: [
    { ...recovery, cueKey: 'document:claim' }] }), plan.request, packet));
});

test('Component parent escape and old combined result fail closed', async () => {
  const challengePlan = await planArchitectureEvidence(packet, 'subsystem-challenge', context([frontend, backend, platform]), capability, counter);
  const challengedBy = parseSynthesisStageResult(result(challengePlan.request,
    { systemKey: system.candidateKey, decisions }), challengePlan.request, packet);
  assert.equal(challengedBy.stage, 'subsystem-challenge');
  const scope = { ...context([orders, platform], orders.candidateKey), challengedBy };
  const plan = await planArchitectureEvidence(packet, 'component-discovery', scope, capability, counter);
  const component = { candidateKey: 'candidate:order-unit', kind: 'component', parentCandidateKey: orders.candidateKey,
    name: 'Order Unit', responsibility: 'Process orders', confidence: .8, ambiguityCodes: [],
    evidenceRefs: ['client', 'server', 'worker'], ownershipEvidenceRefs: ['client', 'server', 'worker'] };
  assert.deepEqual(parseSynthesisStageResult(result(plan.request, { systemKey: system.candidateKey,
    subsystemKey: orders.candidateKey, components: [component] }), plan.request, packet).stage, 'component-discovery');
  for (const parentCandidateKey of [system.candidateKey, platform.candidateKey, 'candidate:foreign'])
    assert.throws(() => parseSynthesisStageResult(result(plan.request, { systemKey: system.candidateKey,
      subsystemKey: orders.candidateKey, components: [{ ...component, parentCandidateKey }] }), plan.request, packet));
  const discovery = await planArchitectureEvidence(packet, 'subsystem-discovery', context(), capability, counter);
  assert.throws(() => parseSynthesisStageResult(result(discovery.request, { systemKey: system.candidateKey,
    nodes: [frontend, component], subdivisionAssessment: { confidence: .8, ambiguityCodes: [] } }), discovery.request, packet));
  await assert.rejects(planArchitectureEvidence(packet, 'component-discovery', context([orders], orders.candidateKey),
    capability, counter), /challenged Subsystem/);
});

test('empty Component descent requires one source-backed typed disposition for its exact parent and view', async () => {
  const challengePlan = await planArchitectureEvidence(packet, 'subsystem-challenge', context([frontend, backend, platform]), capability, counter);
  const challengedBy = parseSynthesisStageResult(result(challengePlan.request,
    { systemKey: system.candidateKey, decisions }), challengePlan.request, packet);
  assert.equal(challengedBy.stage, 'subsystem-challenge');
  const plan = await planArchitectureEvidence(packet, 'component-discovery',
    { ...context([orders, platform], orders.candidateKey), challengedBy }, capability, counter);
  const fields = { systemKey: system.candidateKey, subsystemKey: orders.candidateKey, components: [] };
  const disposition = { kind: 'leaf-responsibility', systemKey: system.candidateKey,
    subsystemKey: orders.candidateKey, evidenceRefs: ['server'],
    parentPacketFingerprint: packet.inputFingerprint, viewId: plan.request.view.viewId };
  assert.throws(() => parseSynthesisStageResult(result(plan.request, fields), plan.request, packet), /disposition/);
  for (const kind of ['leaf-responsibility', 'insufficient-evidence', 'responsibility-belongs-elsewhere',
    'no-stable-component-boundary']) {
    const descent = { ...disposition, kind };
    assert.equal((parseSynthesisStageResult(result(plan.request, { ...fields, disposition: descent }),
      plan.request, packet) as any).disposition.kind, kind);
    const ledger = buildCoverageLedger(packet, [{ systemKey: system.candidateKey, nodes: [orders],
      componentDescents: [descent as any] }]);
    assert.ok(ledger.some(item => item.componentDescents.some(descent => descent.kind === kind) &&
      item.candidateKeys.includes(orders.candidateKey)));
    if (kind === 'insufficient-evidence' || kind === 'responsibility-belongs-elsewhere')
      assert.ok(ledger.some(item => item.componentDescents.some(descent => descent.kind === kind) && item.status === 'unresolved'));
    else assert.ok(ledger.some(item => item.componentDescents.some(descent => descent.kind === kind) &&
      item.status === 'represented'));
  }
  for (const bad of [
    { ...disposition, subsystemKey: platform.candidateKey },
    { ...disposition, systemKey: 'candidate:foreign' },
    { ...disposition, viewId: 'view:foreign' },
    { ...disposition, evidenceRefs: ['fabricated'] },
    { ...disposition, evidenceRefs: ['platform'] },
    { ...disposition, evidenceRefs: ['other'] },
    { ...disposition, evidenceRefs: ['server'], rationale: 'unsupported prose' },
  ]) assert.throws(() => parseSynthesisStageResult(result(plan.request, { ...fields, disposition: bad }), plan.request, packet));
  assert.throws(() => parseSynthesisStageResult(result(plan.request, { ...fields,
    components: [{ candidateKey: 'candidate:unit', kind: 'component', parentCandidateKey: orders.candidateKey,
      name: 'Unit', responsibility: 'Process orders', confidence: .8, ambiguityCodes: [],
      evidenceRefs: ['server'], ownershipEvidenceRefs: ['server'] }], disposition }), plan.request, packet), /disposition/);
  const documented = { ...packet, documents: [{ path: 'MODULES.md', class: 'modules-seed' as const,
    authority: 'Documented' as const, status: 'accepted' as const, sha256: 'a'.repeat(64), bytes: 6,
    truncated: false, content: 'Orders are a leaf Subsystem' }] };
  assert.throws(() => parseSynthesisStageResult(result(plan.request, { ...fields,
    disposition: { ...disposition, evidenceRefs: ['MODULES.md'] } }), plan.request, packet));
  const unproven = buildCoverageLedger(documented, [{ systemKey: system.candidateKey, nodes: [orders],
    componentDescents: [{ ...disposition, kind: 'insufficient-evidence' }] }]);
  assert.ok(unproven.some(item => item.status === 'unresolved' &&
    item.componentDescents.some(descent => descent.kind === 'insufficient-evidence')));
  const forged = { ...documented, items: [...documented.items, { id: 'modules', kind: 'semantic' as const,
    path: 'MODULES.md', symbol: 'Orders', relation: 'class:exported', sourceEvidenceIds: ['source:modules'] }] };
  const docParent = subsystem('documented', ['modules']);
  assert.throws(() => assembleArchitectureProposal({ parentPacketFingerprint: forged.inputFingerprint,
    summary: 'Documented architecture', systems: [system], subtrees: [{ systemKey: system.candidateKey,
      nodes: [docParent], componentDescents: [{ ...disposition, subsystemKey: docParent.candidateKey,
        evidenceRefs: ['modules'] }] }],
    reconciliation: { schemaVersion: 1, stageVersion: 3, stage: 'reconciliation',
      parentPacketFingerprint: forged.inputFingerprint, viewId: 'view:fixture', findings: [], unresolved: [] },
    verifications: [] }, forged), /parent implementation evidence/);
});
