import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  architectureProposalSchema, parseArchitectureProposal, parseArchitectureProposalJson, validateArchitectureEvidencePacket,
  createArchitectureEvidenceView, validateArchitectureEvidenceView, usableEvidenceTokens, assertSynthesisInputBudget,
  validateSynthesisStageRequest, parseSynthesisStageResult, synthesisStageResultSchemas, assembleArchitectureProposal,
  parseAnalysisProgressEvent, synthesisStageRequestSchema,
} from '../../packages/software-map/lib/index.js';
import type { ArchitectureEvidencePacket, ArchitectureProposal, SoftwareMapInitializationState,
  SynthesisCapabilities, SynthesisStageRequest, SystemCandidate, SubsystemDiscoveryResult } from '../../packages/software-map/lib/index.js';

const packet: ArchitectureEvidencePacket = {
  schemaVersion: 1, inputFingerprint: 'source@1', items: [
    { id: 'package', kind: 'topology', path: 'package.json', sourceEvidenceIds: [], scope: 'package', name: 'app' },
    { id: 'entry', kind: 'entrypoint', path: 'src/main.ts', sourceEvidenceIds: ['semantic:main'], role: 'server' },
  ],
};
const proposal: ArchitectureProposal = {
  schemaVersion: 1, summary: 'One application', needsMoreEvidence: false,
  nodes: [
    { proposalKey: 'proposal:a', kind: 'system', name: 'App', purpose: 'Serve users', parentProposalKey: null, confidence: 0,
      rationale: 'The package groups one app', evidenceRefs: ['package'], evidence: ['One package manifest'] },
    { proposalKey: 'proposal:b', kind: 'subsystem', name: 'Server', purpose: 'Serve requests', parentProposalKey: 'proposal:a', confidence: 1,
      rationale: 'The entrypoint starts a server', evidenceRefs: ['entry'], evidence: ['Server entrypoint'] },
    { proposalKey: 'proposal:c', kind: 'component', name: 'Main', purpose: 'Start server', parentProposalKey: 'proposal:b', confidence: 0.5,
      rationale: 'The file is an entrypoint', evidenceRefs: ['entry'], evidence: ['Main source file'] },
  ],
  unassignedEvidenceRefs: [], openQuestions: [], evidenceRequests: [],
};
const changed = (edit: (value: any) => void): unknown => { const value = structuredClone(proposal); edit(value); return value; };

test('schema and valid proposal retain temporary identities and confidence endpoints', () => {
  assert.equal(architectureProposalSchema.additionalProperties, false);
  assert.equal(architectureProposalSchema.properties.nodes.items.additionalProperties, false);
  assert.equal(architectureProposalSchema.properties.nodes.items.properties.confidence.minimum, 0);
  assert.equal(architectureProposalSchema.properties.nodes.items.properties.confidence.maximum, 1);
  assert.equal(architectureProposalSchema.properties.evidenceRequests.maxItems, 5);
  assert.deepEqual(parseArchitectureProposalJson(JSON.stringify(proposal), packet), proposal);
  assert.deepEqual(parseArchitectureProposal(proposal, packet), proposal);
  assert.equal('id' in proposal.nodes[0], false); // canonical identity is not model output
  assert.throws(() => parseArchitectureProposal(changed(p => { p.nodes[0].proposalKey = 'app'; }), packet));
  const states: SoftwareMapInitializationState[] = ['uninitialized', 'analyzing', 'review_required', 'initialized'];
  assert.deepEqual(states, ['uninitialized', 'analyzing', 'review_required', 'initialized']);
});

test('schema rejects malformed, unsupported, missing and extra fields', () => {
  assert.throws(() => parseArchitectureProposalJson('{', packet), /malformed JSON/);
  for (const value of [
    changed(p => { p.schemaVersion = 2; }), changed(p => { p.extra = true; }),
    changed(p => { delete p.summary; }), changed(p => { p.nodes[0].canonicalId = 'app'; }),
    changed(p => { delete p.nodes[0].rationale; }), changed(p => { p.evidenceRequests = [{ kind: 'topology', targets: ['src'], reason: 'Why', extra: true }]; p.needsMoreEvidence = true; }),
  ]) assert.throws(() => parseArchitectureProposal(value, packet));
});

test('hierarchy requires unique keys and exact System -> Subsystem -> Component parenting in any order', () => {
  assert.deepEqual(parseArchitectureProposal(changed(p => p.nodes.reverse()), packet).nodes.map(n => n.proposalKey), ['proposal:c', 'proposal:b', 'proposal:a']);
  for (const value of [
    changed(p => { p.nodes[1].proposalKey = 'proposal:a'; }),
    changed(p => { p.nodes[0].kind = 'code'; }),
    changed(p => { p.nodes[1].parentProposalKey = 'proposal:missing'; }),
    changed(p => { p.nodes[1].parentProposalKey = 'proposal:c'; }), // cycle and invalid parent kind
    changed(p => { p.nodes[0].parentProposalKey = 'proposal:a'; }),
    changed(p => { p.nodes[2].parentProposalKey = 'proposal:a'; }),
    changed(p => { p.nodes[2].parentProposalKey = 'proposal:c'; }),
  ]) assert.throws(() => parseArchitectureProposal(value, packet));
});

test('confidence is finite numeric 0..1 and never canonical authority', () => {
  for (const confidence of [-0.01, 1.01, NaN, Infinity, -Infinity, '0.5', null]) {
    assert.throws(() => parseArchitectureProposal(changed(p => { p.nodes[0].confidence = confidence; }), packet));
  }
  assert.equal(parseArchitectureProposal(changed(p => { p.nodes[0].confidence = 0.25; }), packet).nodes[0].confidence, 0.25);
});

test('hard refs resolve only against the exact packet; prose cannot replace them', () => {
  for (const value of [
    changed(p => { p.nodes[0].evidenceRefs = []; }),
    changed(p => { delete p.nodes[0].evidenceRefs; }),
    changed(p => { p.nodes[0].evidenceRefs = ['made-up']; p.nodes[0].evidence = ['This is source-backed']; }),
    changed(p => { p.nodes[0].evidenceRefs = ['package', 'package']; }),
    changed(p => { p.unassignedEvidenceRefs = ['made-up']; }),
    changed(p => { p.nodes[0].evidenceIds = ['made-up']; }),
  ]) assert.throws(() => parseArchitectureProposal(value, packet));
  assert.throws(() => parseArchitectureProposal(proposal, { ...packet, items: [packet.items[1]] }), /unknown/);
  assert.throws(() => validateArchitectureEvidencePacket({ ...packet, items: [packet.items[0], packet.items[0]] }), /duplicate/);
  assert.throws(() => validateArchitectureEvidencePacket({ ...packet, items: [{ ...packet.items[0], path: '../outside' }] }), /path/);
  assert.throws(() => validateArchitectureEvidencePacket({ ...packet, schemaVersion: 2 as 1 }), /packet/);
});

test('evidence requests are bounded, typed and path targeted', () => {
  const request = { kind: 'dependency', targets: ['src/main.ts'], reason: 'Inspect imports' };
  const valid = changed(p => { p.needsMoreEvidence = true; p.evidenceRequests = [request]; });
  assert.deepEqual(parseArchitectureProposal(valid, packet).evidenceRequests, [request]);
  for (const value of [
    changed(p => { p.evidenceRequests = [request]; }),
    changed(p => { p.needsMoreEvidence = true; }),
    changed(p => { p.needsMoreEvidence = true; p.evidenceRequests = Array(6).fill(request); }),
    changed(p => { p.needsMoreEvidence = true; p.evidenceRequests = [{ ...request, kind: 'filesystem' }]; }),
    changed(p => { p.needsMoreEvidence = true; p.evidenceRequests = [{ ...request, targets: [] }]; }),
    changed(p => { p.needsMoreEvidence = true; p.evidenceRequests = [{ ...request, targets: Array(6).fill('src/main.ts') }]; }),
    changed(p => { p.needsMoreEvidence = true; p.evidenceRequests = [{ ...request, targets: ['../outside'] }]; }),
    changed(p => { p.needsMoreEvidence = true; p.evidenceRequests = [{ ...request, reason: '' }]; }),
  ]) assert.throws(() => parseArchitectureProposal(value, packet));
});

const capability: SynthesisCapabilities = { modelLabel: 'local model', contextWindowTokens: 1000, maxInputTokens: 900,
  reservedInstructionTokens: 100, reservedOutputTokens: 200, reservedOverheadTokens: 50, tokenEstimate: 'conservative' };
const view = createArchitectureEvidenceView(packet, ['entry', 'package']);
const systemCandidate: SystemCandidate = { candidateKey: 'candidate:app', kind: 'system', name: 'App', purpose: 'Serve users',
  boundaryRationale: 'The application owns request handling', confidence: 0.8, uncertainty: [], evidenceRefs: ['entry'] };
const context = (systems: SystemCandidate[] = [], subjectSystemKey: string | null = null,
  subtrees: SubsystemDiscoveryResult[] = [], targetCandidateKeys: string[] = []) =>
  ({ systems, subjectSystemKey, subtrees, targetCandidateKeys });
const request = (stage: SynthesisStageRequest['stage'], stageContext = context()): SynthesisStageRequest =>
  ({ schemaVersion: 1, stage, stageVersion: 1, parentPacketFingerprint: packet.inputFingerprint, view, context: stageContext });
const result = (stage: SynthesisStageRequest['stage'], extra: object) =>
  ({ schemaVersion: 1, stageVersion: 1, parentPacketFingerprint: packet.inputFingerprint, viewId: view.viewId, stage, ...extra });
const subtree = result('subsystem-discovery', { systemKey: systemCandidate.candidateKey, nodes: [
  { candidateKey: 'candidate:server', kind: 'subsystem', parentCandidateKey: systemCandidate.candidateKey,
    name: 'Server', purpose: 'Serve requests', confidence: 0.7, uncertainty: ['Entry role may overlap'], evidenceRefs: ['entry'] },
  { candidateKey: 'candidate:main', kind: 'component', parentCandidateKey: 'candidate:server',
    name: 'Main', purpose: 'Start server', confidence: 1, uncertainty: [], evidenceRefs: ['entry'] },
] }) as SubsystemDiscoveryResult;
test('capabilities reserve context and reject unsafe or malformed estimates', async () => {
  assert.equal(usableEvidenceTokens(capability), 650);
  assert.equal(await assertSynthesisInputBudget({ estimateTokens: async () => 650 }, capability, 'input'), 650);
  await assert.rejects(assertSynthesisInputBudget({ estimateTokens: async () => 651 }, capability, 'input'), /budget/);
  await assert.rejects(assertSynthesisInputBudget({ estimateTokens: async () => 2.5 }, capability, 'input'), /estimate/);
  for (const bad of [
    { ...capability, contextWindowTokens: 0 }, { ...capability, reservedOutputTokens: 900 },
    { ...capability, maxInputTokens: Infinity }, { ...capability, tokenEstimate: 'guess' },
    { ...capability, extra: 1 },
  ]) assert.throws(() => usableEvidenceTokens(bad as SynthesisCapabilities));
});

test('views retain whole parent items, deterministic identity and exact source refs', () => {
  assert.deepEqual(view.items.map(item => item.id), ['entry', 'package']);
  assert.deepEqual(createArchitectureEvidenceView(packet, ['package', 'entry']), view);
  validateArchitectureEvidenceView(view, packet);
  assert.throws(() => createArchitectureEvidenceView(packet, ['entry', 'entry']), /view evidence IDs/);
  assert.throws(() => createArchitectureEvidenceView(packet, ['fabricated']), /unknown/);
  assert.throws(() => validateArchitectureEvidenceView({ ...view, items: [{ ...view.items[0], path: 'other.ts' }, view.items[1]] }, packet));
  assert.throws(() => validateArchitectureEvidenceView(view, { ...packet, inputFingerprint: 'changed' }));
  assert.throws(() => validateArchitectureEvidenceView({ ...view, viewVersion: 2 as 1 }, packet));
});

test('stage requests and outputs enforce stage, context, evidence and temporary identity', () => {
  const discovery = request('system-discovery');
  validateSynthesisStageRequest(discovery, packet);
  assert.equal(synthesisStageRequestSchema.additionalProperties, false);
  const discovered = result('system-discovery', { systems: [systemCandidate] });
  assert.deepEqual(parseSynthesisStageResult(discovered, discovery, packet), discovered);
  assert.equal(synthesisStageResultSchemas['system-discovery'].additionalProperties, false);
  for (const bad of [
    { ...discovered, stageVersion: 2 }, { ...discovered, viewId: 'wrong' },
    result('system-discovery', { systems: [systemCandidate, systemCandidate] }),
    result('system-discovery', { systems: [{ ...systemCandidate, candidateKey: 'app' }] }),
    result('system-discovery', { systems: [{ ...systemCandidate, evidenceRefs: ['fabricated'] }] }),
    result('system-discovery', { systems: [{ ...systemCandidate, confidence: NaN }] }),
    result('system-discovery', { systems: [{ ...systemCandidate, uncertainty: ['x', 'x'] }] }),
    { ...discovered, canonicalId: 'app' },
  ]) assert.throws(() => parseSynthesisStageResult(bad, discovery, packet));
  assert.throws(() => validateSynthesisStageRequest({ ...discovery, stage: 'unknown' as any }, packet));
  assert.throws(() => validateSynthesisStageRequest({ ...discovery, context: context([systemCandidate]) }, packet));
  assert.throws(() => validateSynthesisStageRequest({ ...discovery, parentPacketFingerprint: 'other' }, packet));
});

test('Software Map stage contract stays provider independent', () => {
  const source = readFileSync(new URL('../../packages/software-map/src/hierarchical-synthesis.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /LM Studio|Qwen|65,536|32,768/);
});

test('System Challenge covers every source and validates keep, merge, split and reject', () => {
  const second = { ...systemCandidate, candidateKey: 'candidate:browser' };
  const third = { ...systemCandidate, candidateKey: 'candidate:electron' };
  const challenged = request('system-challenge', context([systemCandidate, second, third]));
  const decision = (action: string, sourceKeys: string[], systems: SystemCandidate[]) =>
    ({ action, sourceKeys, systems, rationale: 'Boundary evidence', evidenceRefs: ['entry'] });
  const keep = decision('keep', ['candidate:app'], [systemCandidate]);
  const merge = decision('merge', ['candidate:browser', 'candidate:electron'],
    [{ ...systemCandidate, candidateKey: 'candidate:desktop' }]);
  const valid = result('system-challenge', { decisions: [keep, merge] });
  assert.deepEqual(parseSynthesisStageResult(valid, challenged, packet), valid);
  assert.deepEqual(parseSynthesisStageResult(result('system-challenge', { decisions: [
    decision('split', ['candidate:app'], [{ ...systemCandidate, candidateKey: 'candidate:a' },
      { ...systemCandidate, candidateKey: 'candidate:b' }]), decision('reject', ['candidate:browser'], []),
    decision('reject', ['candidate:electron'], []),
  ] }), challenged, packet).stage, 'system-challenge');
  for (const decisions of [
    [keep], [keep, keep, merge], [decision('merge', ['candidate:app'], [systemCandidate]), merge],
    [keep, decision('split', ['candidate:browser'], [second]), decision('reject', ['candidate:electron'], [])],
    [keep, decision('reject', ['candidate:browser'], [second]), decision('reject', ['candidate:electron'], [])],
    [keep, decision('reject', ['candidate:browser'], []), decision('reject', ['candidate:missing'], [])],
    [keep, { ...merge, evidenceRefs: ['unknown'] }],
  ]) assert.throws(() => parseSynthesisStageResult(result('system-challenge', { decisions }), challenged, packet));
});

test('per-System trees, reconciliation, verification and final assembly preserve parent relationships', () => {
  const perSystem = request('subsystem-discovery', context([systemCandidate], systemCandidate.candidateKey));
  assert.deepEqual(parseSynthesisStageResult(subtree, perSystem, packet), subtree);
  for (const nodes of [
    [{ ...subtree.nodes[0], parentCandidateKey: 'candidate:missing' }],
    [{ ...subtree.nodes[0], kind: 'component' }],
    [subtree.nodes[0], { ...subtree.nodes[1], candidateKey: subtree.nodes[0].candidateKey }],
    [{ ...subtree.nodes[0], evidenceRefs: ['unknown'] }],
  ]) assert.throws(() => parseSynthesisStageResult({ ...subtree, nodes }, perSystem, packet));
  const reconciliation = result('reconciliation', { findings: [{ candidateKeys: ['candidate:server'], evidenceRefs: ['entry'],
    status: 'uncertain', message: 'Check boundary' }], unresolvedCandidateKeys: ['candidate:server'] });
  const reconRequest = request('reconciliation', context([systemCandidate], null, [subtree]));
  assert.deepEqual(parseSynthesisStageResult(reconciliation, reconRequest, packet), reconciliation);
  const anotherSystem = { ...systemCandidate, candidateKey: 'candidate:another' };
  assert.throws(() => validateSynthesisStageRequest(request('reconciliation',
    context([systemCandidate, anotherSystem], null, [subtree, subtree])), packet), /duplicate/);
  const verification = result('verification', { findings: [{ candidateKeys: ['candidate:server'], evidenceRefs: ['entry'],
    status: 'supported', message: 'Boundary supported' }] });
  assert.deepEqual(parseSynthesisStageResult(verification,
    request('verification', context([systemCandidate], null, [subtree], ['candidate:server'])), packet), verification);
  assert.throws(() => parseSynthesisStageResult({ ...verification, findings: [{ ...verification.findings[0],
    candidateKeys: ['candidate:main'] }] }, request('verification', context([systemCandidate], null, [subtree], ['candidate:server'])), packet));
  const assembly = { parentPacketFingerprint: packet.inputFingerprint, summary: 'App', systems: [systemCandidate],
    subtrees: [subtree], reconciliation, verifications: [verification] };
  const proposal = assembleArchitectureProposal(assembly, packet);
  assert.deepEqual(proposal.nodes.map(node => node.proposalKey), ['proposal:stage-1', 'proposal:stage-2', 'proposal:stage-3']);
  assert.equal(proposal.nodes[0].parentProposalKey, null);
  assert.equal(proposal.nodes[2].parentProposalKey, 'proposal:stage-2');
  assert.ok(proposal.nodes.every(node => !('id' in node) && !node.proposalKey.includes('candidate:')));
  assert.throws(() => assembleArchitectureProposal({ ...assembly, parentPacketFingerprint: 'other' }, packet));
  assert.throws(() => assembleArchitectureProposal({ ...assembly, systems: [{ ...systemCandidate, evidenceRefs: ['unknown'] }] }, packet));
});

test('progress events expose only bounded safe stage metadata and honest known counts', () => {
  const event = { stage: 'subsystem-discovery', status: 'retrying', subject: 'App', completedUnits: 1, totalUnits: 3,
    providerModelLabel: 'local model', attempt: 2, elapsedMs: 1234, message: 'Retrying App discovery' };
  assert.deepEqual(parseAnalysisProgressEvent(event), event);
  assert.deepEqual(parseAnalysisProgressEvent({ stage: 'planning-evidence', status: 'started', elapsedMs: 0,
    message: 'Planning evidence' }).stage, 'planning-evidence');
  for (const bad of [
    { ...event, stage: 'imaginary' }, { ...event, status: 'thinking' }, { ...event, totalUnits: 0 },
    { ...event, elapsedMs: -1 }, { ...event, attempt: 0 }, { ...event, message: 'x'.repeat(241) },
    { ...event, message: 'raw\nprompt' }, { ...event, prompt: 'hidden' },
    { ...event, stage: 'completed', status: 'started' },
  ]) assert.throws(() => parseAnalysisProgressEvent(bad));
});
