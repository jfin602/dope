import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import test from 'node:test';
import { challengeCandidateSystems, discoverCandidateSystems, planArchitectureEvidence,
  validateSynthesisStageRequest } from '../../packages/software-map/lib/index.js';
import type { ArchitectureEvidencePacket, ChallengeDecision, SynthesisProvider, SynthesisStageRequest,
  SystemCandidate } from '../../packages/software-map/lib/index.js';
import { LmStudioSynthesisProvider, SYSTEM_CHALLENGE_INSTRUCTION } from '../../packages/theia-extension/lib/node/lmstudio-synthesis-provider.js';

const fact = (id: string, kind: 'entrypoint' | 'semantic' | 'dependency', path: string, targetPath?: string) => {
  const base = { id, kind, path, sourceEvidenceIds: [`physical:${id}`] };
  if (kind === 'entrypoint') return { ...base, role: `main:${id}` };
  if (kind === 'dependency') return { ...base, targetPath: targetPath!, relation: 'imports', relationshipIds: [`relationship:${id}`] };
  return { ...base, symbol: id, relation: 'class:exported' };
};
const packet: ArchitectureEvidencePacket = { schemaVersion: 1, inputFingerprint: 'controlled:challenge', items: [
  { id: 'repo', kind: 'topology', path: 'package.json', name: 'Project', scope: 'workspace', sourceEvidenceIds: [] },
  fact('browser-main', 'entrypoint', 'apps/browser/src/main.ts'),
  fact('electron-main', 'entrypoint', 'apps/electron/src/main.ts'),
  fact('browser-workbench', 'semantic', 'apps/browser/src/workbench.ts'),
  fact('electron-workbench', 'semantic', 'apps/electron/src/workbench.ts'),
  fact('browser-core', 'dependency', 'apps/browser/src/main.ts', 'packages/workbench/src/index.ts'),
  fact('electron-core', 'dependency', 'apps/electron/src/main.ts', 'packages/workbench/src/index.ts'),
  fact('shared-workbench', 'semantic', 'packages/workbench/src/index.ts'),
  fact('store', 'semantic', 'packages/storage/src/store.ts'),
  fact('store-core', 'dependency', 'packages/storage/src/store.ts', 'packages/workbench/src/index.ts'),
  fact('api-main', 'entrypoint', 'packages/api/src/server.ts'),
  fact('api-contract', 'semantic', 'packages/api/src/contract.ts'),
  fact('compiler-main', 'entrypoint', 'packages/compiler/src/cli.ts'),
  fact('compiler-contract', 'semantic', 'packages/compiler/src/index.ts'),
  fact('search-main', 'entrypoint', 'packages/search/src/server.ts'),
  fact('search-contract', 'semantic', 'packages/search/src/index.ts'),
  fact('unrelated', 'semantic', 'packages/unrelated/src/index.ts'),
  fact('fixture', 'semantic', 'test/fixtures/example.ts'),
  ...Array.from({ length: 100 }, (_, i) => fact(`noise-${i}`, 'semantic', `test/fixtures/noise-${i}.ts`)),
] as ArchitectureEvidencePacket['items'] };
const candidate = (id: string, refs: string[]): SystemCandidate => ({ candidateKey: `candidate:${id}`, kind: 'system',
  name: id, responsibility: `Own ${id} behavior`, confidence: 0.8,
  ambiguityCodes: [], evidenceRefs: refs });
const firstPass = [candidate('browser', ['browser-main', 'browser-workbench']),
  candidate('electron', ['electron-main', 'electron-workbench']), candidate('storage', ['store']),
  candidate('services', ['api-main', 'compiler-main']), candidate('search', ['search-main'])];
const corrected: ChallengeDecision[] = [
  { action: 'merge', sourceKeys: ['candidate:browser', 'candidate:electron'],
    systems: [candidate('workbench', ['browser-main', 'electron-main', 'shared-workbench'])],
    evidenceRefs: ['browser-core', 'electron-core'] },
  { action: 'reject', sourceKeys: ['candidate:storage'], systems: [],
    evidenceRefs: ['store-core'] },
  { action: 'split', sourceKeys: ['candidate:services'],
    systems: [candidate('api', ['api-main', 'api-contract']), candidate('compiler', ['compiler-main', 'compiler-contract'])],
    evidenceRefs: ['api-main', 'compiler-main'] },
  { action: 'keep', sourceKeys: ['candidate:search'], systems: [candidate('search', ['search-main', 'search-contract'])],
    evidenceRefs: ['search-main'] },
];
const capability = { modelLabel: 'fixture-provider', contextWindowTokens: 65536, maxInputTokens: 65536,
  reservedInstructionTokens: 1000, reservedOutputTokens: 2000, reservedOverheadTokens: 500,
  tokenEstimate: 'conservative' as const };
const stageResult = (request: SynthesisStageRequest, body: Record<string, unknown>) => ({ schemaVersion: 1,
  stageVersion: 2, stage: request.stage, parentPacketFingerprint: request.parentPacketFingerprint,
  viewId: request.view.viewId, ...body });
const provider = (decisions: ChallengeDecision[] = corrected, calls: SynthesisStageRequest[] = []): SynthesisProvider => ({
  kind: 'local',
  capabilities: async () => capability,
  estimateTokens: async input => new TextEncoder().encode(input).length,
  runStage: async request => {
    calls.push(request);
    return { output: stageResult(request, request.stage === 'system-discovery' ? { systems: firstPass } : { decisions }),
      usage: { providerKind: 'local', modelLabel: 'fixture-provider', requestBytes: 1, outputBytes: 1,
        tokenMeasurement: 'unavailable' } };
  },
});

test('independent challenge merges Browser/Electron, rejects storage, splits services and keeps search', async () => {
  const calls: SynthesisStageRequest[] = [];
  const adapter = provider(corrected, calls);
  const discovery = await discoverCandidateSystems(packet, adapter);
  const challenged = await challengeCandidateSystems(packet, discovery, adapter);
  assert.deepEqual(calls.map(call => call.stage), ['system-discovery', 'system-challenge']);
  assert.deepEqual(challenged.systems.map(system => system.candidateKey),
    ['candidate:workbench', 'candidate:api', 'candidate:compiler', 'candidate:search']);
  assert.deepEqual(challenged.mapping.map(entry => [entry.sourceCandidateKey, entry.action, entry.challengedSystemKeys]), [
    ['candidate:browser', 'merge', ['candidate:workbench']],
    ['candidate:electron', 'merge', ['candidate:workbench']],
    ['candidate:storage', 'reject', []],
    ['candidate:services', 'split', ['candidate:api', 'candidate:compiler']],
    ['candidate:search', 'keep', ['candidate:search']],
  ]);
  const view = challenged.plan.request.view;
  const refs = new Set(packet.items.map(item => item.id));
  assert.ok(firstPass.flatMap(system => system.evidenceRefs).every(ref => view.items.some(item => item.id === ref)));
  assert.ok(['browser-core', 'electron-core', 'store-core', 'api-contract', 'compiler-contract']
    .every(ref => view.items.some(item => item.id === ref)));
  assert.ok(view.items.length < packet.items.length);
  assert.ok(!view.items.some(item => item.id === 'unrelated'));
  assert.ok(challenged.systems.every(system => system.evidenceRefs.every(ref => refs.has(ref))));
  assert.ok(!JSON.stringify(view).includes('.dope/architecture.json'));
  validateSynthesisStageRequest(challenged.plan.request, packet);
  assert.match(SYSTEM_CHALLENGE_INSTRUCTION, /merge two or more/);
  assert.match(SYSTEM_CHALLENGE_INSTRUCTION, /split one into two/);
  assert.match(SYSTEM_CHALLENGE_INSTRUCTION, /reject one with no output/);
  assert.match(SYSTEM_CHALLENGE_INSTRUCTION, /Do not force a count/);
});

test('contradictory or unsupported decisions fail closed', async () => {
  const discovery = await discoverCandidateSystems(packet, provider());
  const bad: { decisions: ChallengeDecision[]; error: RegExp }[] = [
    { decisions: corrected.slice(1), error: /incomplete challenge coverage/ },
    { decisions: [...corrected, corrected[3]], error: /duplicate challenge source keys/ },
    { decisions: [{ ...corrected[0], sourceKeys: ['candidate:browser', 'candidate:missing'] }, ...corrected.slice(1)], error: /unknown source/ },
    { decisions: [{ ...corrected[0], sourceKeys: ['candidate:browser', 'candidate:browser'] }, ...corrected.slice(1)], error: /duplicate/ },
    { decisions: [{ ...corrected[0], systems: [candidate('browser', ['browser-main'])] }, ...corrected.slice(1)], error: /shape/ },
    { decisions: [{ ...corrected[2], systems: [candidate('api', ['api-main']), candidate('api', ['compiler-main'])] }, ...corrected.slice(0, 2), corrected[3]], error: /duplicate/ },
    { decisions: [{ ...corrected[1], systems: [candidate('storage', ['store'])] }, corrected[0], ...corrected.slice(2)], error: /shape/ },
    { decisions: [{ ...corrected[0], systems: [candidate('workbench', ['fixture'])] }, ...corrected.slice(1)], error: /unknown/ },
    { decisions: [{ ...corrected[0], systems: [candidate('workbench', ['repo'])] }, ...corrected.slice(1)], error: /source-backed production behavior/ },
    { decisions: [{ ...corrected[0], evidenceRefs: ['invented'] }, ...corrected.slice(1)], error: /unknown/ },
  ];
  for (const { decisions, error } of bad) {
    await assert.rejects(challengeCandidateSystems(packet, discovery, provider(decisions)), error);
  }
});

test('challenge planning requires all cited facts and remains bounded', async () => {
  const context = { systems: firstPass, subjectSystemKey: null, subtrees: [], targetCandidateKeys: [] };
  const adapter = provider();
  const plan = await planArchitectureEvidence(packet, 'system-challenge', context, capability, adapter);
  assert.ok(plan.inputTokens <= plan.inputBudgetTokens);
  assert.ok(plan.omittedEvidenceRefs.length > 0);
  const tiny = { ...capability, contextWindowTokens: 1000, maxInputTokens: 1000,
    reservedInstructionTokens: 1, reservedOutputTokens: 1, reservedOverheadTokens: 0 };
  await assert.rejects(planArchitectureEvidence(packet, 'system-challenge', context, tiny, adapter), /minimal.*skeleton exceeds/);
});

test('local provider sends independent structured challenge call after discovery without another warm-up', async () => {
  const calls: { name: string; body: any }[] = [];
  const server = createServer(async (incoming: IncomingMessage, response: ServerResponse) => {
    const chunks: Buffer[] = [];
    for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined;
    if (incoming.url === '/v1/models') {
      response.end(JSON.stringify({ data: [{ id: 'local-qwen' }] }));
      return;
    }
    const name = body.response_format.json_schema.name;
    calls.push({ name, body });
    const content = name === 'readiness' ? '{"ready":true}' : (() => {
      const request = JSON.parse(body.messages[1].content) as SynthesisStageRequest;
      return JSON.stringify(stageResult(request, name === 'system_discovery' ? { systems: firstPass } : { decisions: corrected }));
    })();
    response.end(JSON.stringify({ choices: [{ message: { content } }] }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const adapter = new LmStudioSynthesisProvider({ endpoint: `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`,
      contextWindowTokens: 65536 });
    await adapter.discoverModels(); adapter.selectModel('local-qwen'); await adapter.probe();
    const discovery = await discoverCandidateSystems(packet, adapter);
    const challenged = await challengeCandidateSystems(packet, discovery, adapter);
    assert.equal(challenged.result.decisions.length, 4);
    assert.deepEqual(calls.map(call => call.name), ['readiness', 'readiness', 'system_discovery', 'system_challenge']);
    assert.equal(calls[3].body.response_format.json_schema.schema.properties.decisions.type, 'array');
    assert.equal(calls[3].body.response_format.json_schema.schema.properties.decisions.items.properties.action.enum.length, 4);
    assert.deepEqual(JSON.parse(calls[3].body.messages[1].content), challenged.plan.request);
    assert.ok(calls[3].body.messages[0].content.includes('counter-evidence'));
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
