import assert from 'node:assert/strict';
import test from 'node:test';
import { createArchitectureEvidenceView, discoverPerSystemSubtrees, planArchitectureEvidence,
  parseSynthesisStageResult } from '../../packages/software-map/lib/index.js';
import type { ArchitectureEvidencePacket, SubtreeCandidate, SynthesisProvider, SynthesisStageRequest,
  SystemCandidate, SystemChallengeResult } from '../../packages/software-map/lib/index.js';

const fact = (id: string, path: string) => ({ id, kind: 'semantic' as const, path,
  symbol: id, relation: 'class:exported', sourceEvidenceIds: [`source:${id}`] });
const packet: ArchitectureEvidencePacket = { schemaVersion: 1, inputFingerprint: 'per-system-fixture', items: [
  { id: 'workspace', kind: 'topology', path: 'package.json', scope: 'workspace', name: 'Fixture', sourceEvidenceIds: [] },
  fact('catalog-contract', 'packages/catalog/src/index.ts'),
  fact('catalog-a', 'packages/catalog/src/loader.ts'),
  fact('catalog-b', 'packages/storage/src/store.ts'),
  fact('catalog-c', 'packages/catalog/src/validator.ts'),
  fact('search-contract', 'packages/search/src/index.ts'),
  fact('search-engine', 'packages/search/src/engine.ts'),
  { id: 'boundary', kind: 'dependency', path: 'packages/catalog/src/index.ts', targetPath: 'packages/search/src/index.ts',
    relation: 'imports', relationshipIds: ['relationship:boundary'], sourceEvidenceIds: ['source:boundary'] },
  fact('fixture-only', 'test/fixtures/catalog.ts'),
] };
const system = (key: string, refs: string[]): SystemCandidate => ({ candidateKey: `candidate:${key}`, kind: 'system',
  name: key, purpose: `${key} responsibility`, boundaryRationale: 'Direct behavior and public contract',
  confidence: 0.8, uncertainty: [], evidenceRefs: refs });
const catalog = system('catalog', ['catalog-contract', 'catalog-b']);
const search = system('search', ['search-contract']);
const systems = [catalog, search];
const node = (key: string, kind: SubtreeCandidate['kind'], parent: string, refs: string[]): SubtreeCandidate => ({
  candidateKey: `candidate:${key}`, kind, parentCandidateKey: parent, name: key, purpose: `${key} responsibility`,
  rationale: 'Behavior and public boundary', siblingDistinction: `${key} owns a distinct behavior`,
  confidence: 0.8, uncertainty: [], evidenceRefs: refs, ownershipEvidenceRefs: refs,
});
const catalogNodes = [node('catalog-data', 'subsystem', catalog.candidateKey, ['catalog-a', 'catalog-b']),
  node('catalog-loader', 'component', 'candidate:catalog-data', ['catalog-a']),
  node('catalog-validator', 'component', 'candidate:catalog-data', ['catalog-c'])];
const capability = (parallel?: number) => ({ modelLabel: 'fixture', contextWindowTokens: 30000,
  maxInputTokens: 30000, reservedInstructionTokens: 100, reservedOutputTokens: 100,
  reservedOverheadTokens: 100, tokenEstimate: 'exact' as const,
  ...(parallel === undefined ? {} : { maxConcurrentGenerations: parallel }) });
const stage = (request: SynthesisStageRequest, body: object) => ({ schemaVersion: 1, stageVersion: 1,
  stage: request.stage, viewId: request.view.viewId, parentPacketFingerprint: request.parentPacketFingerprint, ...body });
async function challenged(provider: SynthesisProvider) {
  const context = { systems, subjectSystemKey: null, subtrees: [], targetCandidateKeys: [] };
  const plan = await planArchitectureEvidence(packet, 'system-challenge', context, await provider.capabilities(), provider);
  const result = stage(plan.request, { decisions: systems.map(s => ({ action: 'keep', sourceKeys: [s.candidateKey],
    systems: [s], rationale: 'Direct production responsibility', evidenceRefs: s.evidenceRefs })) });
  return { plan, result: parseSynthesisStageResult(result, plan.request, packet) as SystemChallengeResult, systems };
}
const provider = (parallel?: number, onCall?: (request: SynthesisStageRequest) => Promise<void>,
  nodes = catalogNodes): SynthesisProvider => ({ capabilities: async () => capability(parallel),
  estimateTokens: async input => input.length,
  runStage: async request => {
    await onCall?.(request);
    return stage(request, { systemKey: request.context.subjectSystemKey,
      subdivisionAssessment: request.context.subjectSystemKey === catalog.candidateKey
        ? { rationale: 'Two behaviors form one useful Subsystem', confidence: 0.8, uncertainty: [] }
        : { rationale: 'No useful subdivision supported', confidence: 0.3, uncertainty: ['One visible responsibility'] },
      nodes: request.context.subjectSystemKey === catalog.candidateKey ? nodes : [] });
  } });

test('one focused pass per challenged System retains whole facts and meaningful hierarchy', async () => {
  const calls: SynthesisStageRequest[] = [];
  const adapter = provider(undefined, async request => { calls.push(request); });
  const result = await discoverPerSystemSubtrees(packet, await challenged(adapter), adapter);
  assert.deepEqual(calls.map(call => call.context.subjectSystemKey), systems.map(s => s.candidateKey));
  assert.deepEqual(result.passes[0].result.nodes, catalogNodes);
  assert.equal(result.passes[1].result.nodes.length, 0);
  assert.match(result.passes[1].result.subdivisionAssessment.rationale, /No useful subdivision/);
  const ids = new Set(packet.items.map(item => item.id));
  for (const pass of result.passes) {
    assert.ok(pass.result.nodes.every(n => n.evidenceRefs.every(ref => ids.has(ref))));
    assert.deepEqual(pass.plan.request.view, createArchitectureEvidenceView(packet, pass.plan.includedEvidenceRefs));
    assert.ok(pass.plan.request.view.items.every(item => JSON.stringify(item) ===
      JSON.stringify(packet.items.find(original => original.id === item.id))));
  }
  assert.ok(result.passes[0].plan.includedEvidenceRefs.includes('catalog-b'));
  assert.ok(result.passes[0].plan.includedEvidenceRefs.includes('boundary'));
  assert.ok(!result.passes[0].plan.includedEvidenceRefs.includes('search-engine'));
  assert.ok(!result.passes[0].plan.includedEvidenceRefs.includes('fixture-only'));
  assert.deepEqual(result.ownershipConflicts, []);
});

test('per-System results reject foreign parents, fabricated refs, duplicate keys and canonical IDs', async () => {
  const adapter = provider();
  const challenge = await challenged(adapter);
  const context = { systems, subjectSystemKey: catalog.candidateKey, subtrees: [], targetCandidateKeys: [] };
  const plan = await planArchitectureEvidence(packet, 'subsystem-discovery', context, await adapter.capabilities(), adapter);
  const body = { systemKey: catalog.candidateKey,
    subdivisionAssessment: { rationale: 'Useful boundary', confidence: 0.8, uncertainty: [] }, nodes: catalogNodes };
  const bad = [
    { ...body, nodes: [{ ...catalogNodes[0], parentCandidateKey: search.candidateKey }] },
    { ...body, nodes: [{ ...catalogNodes[0], evidenceRefs: ['invented'] }] },
    { ...body, nodes: [catalogNodes[0], catalogNodes[0]] },
    { ...body, nodes: [{ ...catalogNodes[0], canonicalId: 'catalog' }] },
    { ...body, nodes: [{ ...catalogNodes[0], ownershipEvidenceRefs: ['search-contract'] }] },
  ];
  for (const value of bad) assert.throws(() => parseSynthesisStageResult(stage(plan.request, value), plan.request, packet));
});

test('scheduler defaults serial and uses only explicit bounded provider concurrency', async () => {
  for (const [limit, expected] of [[undefined, 1], [1, 1], [2, 2]] as const) {
    let active = 0; let peak = 0;
    const adapter = provider(limit, async () => {
      peak = Math.max(peak, ++active);
      await new Promise(resolve => setTimeout(resolve, 15));
      active--;
    });
    await discoverPerSystemSubtrees(packet, await challenged(adapter), adapter);
    assert.equal(peak, expected);
  }
});

test('shared direct ownership claims are marked for P6 and cross-System keys cannot collide', async () => {
  const base = provider();
  const challenge = await challenged(base);
  const sharedSearch = { ...search, evidenceRefs: ['search-contract', 'catalog-b'] };
  challenge.systems[1] = sharedSearch;
  challenge.result.decisions[1].systems[0] = sharedSearch;
  const searchNode = node('search-data', 'subsystem', search.candidateKey, ['catalog-b']);
  const adapter: SynthesisProvider = { ...base, runStage: async request => request.context.subjectSystemKey === search.candidateKey
    ? stage(request, { systemKey: search.candidateKey,
      subdivisionAssessment: { rationale: 'Possible shared data owner', confidence: 0.4, uncertainty: ['Cross-System overlap'] },
      nodes: [searchNode] }) : base.runStage(request) };
  const result = await discoverPerSystemSubtrees(packet, challenge, adapter);
  assert.deepEqual(result.ownershipConflicts, [{ evidenceRef: 'catalog-b',
    systemKeys: ['candidate:catalog', 'candidate:search'],
    candidateKeys: ['candidate:catalog-data', 'candidate:search-data'] }]);
  const duplicate = { ...adapter, runStage: async (request: SynthesisStageRequest) =>
    request.context.subjectSystemKey === search.candidateKey
      ? stage(request, { systemKey: search.candidateKey,
        subdivisionAssessment: { rationale: 'Duplicate temporary key', confidence: 0.4, uncertainty: [] },
        nodes: [{ ...searchNode, candidateKey: 'candidate:catalog-data' }] }) : base.runStage(request) };
  await assert.rejects(discoverPerSystemSubtrees(packet, challenge, duplicate), /Duplicate cross-System candidate identity/);
});

test('a provider failure settles active parallel passes before returning', async () => {
  const base = provider(2);
  let finished = false;
  const adapter: SynthesisProvider = { ...base, runStage: async request => {
    if (request.context.subjectSystemKey === catalog.candidateKey) throw new Error('generation failed');
    await new Promise(resolve => setTimeout(resolve, 20));
    finished = true;
    return base.runStage(request);
  } };
  await assert.rejects(discoverPerSystemSubtrees(packet, await challenged(adapter), adapter), /generation failed/);
  assert.equal(finished, true);
});
