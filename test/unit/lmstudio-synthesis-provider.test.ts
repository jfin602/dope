import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import test from 'node:test';
import { createArchitectureEvidenceView } from '../../packages/software-map/lib/index.js';
import type { ArchitectureEvidencePacket, SynthesisStageRequest } from '../../packages/software-map/lib/index.js';
import { DEFAULT_SYNTHESIS_TIMEOUT_MS, LmStudioSynthesisProvider, normalizeSynthesisEndpoint,
  SUBSYSTEM_DISCOVERY_INSTRUCTION } from '../../packages/theia-extension/lib/node/lmstudio-synthesis-provider.js';

const modelId = 'publisher/Qwen3-Coder-30B-A3B-Instruct-GGUF';
const secret = 'PROJECT_SECRET_FRAMEWORK_EVIDENCE';
const packet: ArchitectureEvidencePacket = { schemaVersion: 1, inputFingerprint: 'source@framework', items: [
  { id: 'framework:1', kind: 'framework', path: 'src/backend.ts', sourceEvidenceIds: ['physical:1'],
    framework: 'theia', producer: 'theia-inversify', producerVersion: '1', concept: 'rpc-handler', name: secret },
] };

type Request = { path: string; authorization?: string; body?: any };
async function mockServer(reply: (request: Request, response: ServerResponse) => void) {
  const requests: Request[] = [];
  const server = createServer(async (incoming: IncomingMessage, response: ServerResponse) => {
    const chunks: Buffer[] = [];
    for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
    const request = { path: incoming.url!, authorization: incoming.headers.authorization,
      body: chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined };
    requests.push(request);
    reply(request, response);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  return { endpoint: `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`, requests,
    close: async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); } };
}
function json(response: ServerResponse, value: unknown, status = 200) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(value));
}
const completion = (content: unknown) => ({ choices: [{ message: { content } }] });
const stageRequest = (): SynthesisStageRequest => ({ schemaVersion: 1, stage: 'system-discovery', stageVersion: 3,
  parentPacketFingerprint: packet.inputFingerprint, view: createArchitectureEvidenceView(packet, ['framework:1']),
  context: { systems: [], subjectSystemKey: null, subsystems: [], subjectSubsystemKey: null, subtrees: [], targetCandidateKeys: [] } });
function normalReply(request: Request, response: ServerResponse) {
  if (request.path === '/v1/models') return json(response, { data: [{ id: 'another-model' }, { id: modelId }] });
  if (request.body.response_format.json_schema.name === 'readiness') return json(response, completion('{"ready":true}'));
  return json(response, completion('{}'));
}
test('local adapter runs one structured per-System call and declares serial generation', async () => {
  const server = await mockServer((request, response) => {
    if (request.path === '/v1/models') return normalReply(request, response);
    if (request.body.response_format.json_schema.name === 'readiness') return json(response, completion('{"ready":true}'));
    const sent = JSON.parse(request.body.messages[1].content) as SynthesisStageRequest;
    if (sent.stage === 'reconciliation') return json(response, completion(JSON.stringify({ schemaVersion: 1, stageVersion: 3,
      stage: sent.stage, parentPacketFingerprint: sent.parentPacketFingerprint, viewId: sent.view.viewId,
      findings: [], unresolved: [] })));
    if (sent.stage === 'verification') return json(response, completion(JSON.stringify({ schemaVersion: 1, stageVersion: 3,
      stage: sent.stage, parentPacketFingerprint: sent.parentPacketFingerprint, viewId: sent.view.viewId, findings: [] })));
    if (sent.stage === 'subsystem-challenge') return json(response, completion(JSON.stringify({ schemaVersion: 1, stageVersion: 3,
      stage: sent.stage, parentPacketFingerprint: sent.parentPacketFingerprint, viewId: sent.view.viewId,
      systemKey: sent.context.subjectSystemKey, decisions: sent.context.subsystems.map(node => ({ action: 'keep',
        sourceKeys: [node.candidateKey], subsystems: [node], evidenceRefs: node.evidenceRefs })) })));
    if (sent.stage === 'component-discovery') return json(response, completion(JSON.stringify({ schemaVersion: 1, stageVersion: 3,
      stage: sent.stage, parentPacketFingerprint: sent.parentPacketFingerprint, viewId: sent.view.viewId,
      systemKey: sent.context.subjectSystemKey, subsystemKey: sent.context.subjectSubsystemKey, components: [],
      disposition: { kind: 'leaf-responsibility', systemKey: sent.context.subjectSystemKey,
        subsystemKey: sent.context.subjectSubsystemKey, evidenceRefs: sent.context.subsystems.find(node =>
          node.candidateKey === sent.context.subjectSubsystemKey)!.ownershipEvidenceRefs.slice(0, 1),
        parentPacketFingerprint: sent.parentPacketFingerprint, viewId: sent.view.viewId } })));
    json(response, completion(JSON.stringify({ schemaVersion: 1, stageVersion: 3, stage: 'subsystem-discovery',
      parentPacketFingerprint: sent.parentPacketFingerprint, viewId: sent.view.viewId, systemKey: sent.context.subjectSystemKey,
      subsystems: [] })));
  });
  try {
    const provider = new LmStudioSynthesisProvider({ endpoint: server.endpoint, contextWindowTokens: 16384 });
    await provider.discoverModels(); provider.selectModel(modelId); await provider.probe();
    assert.equal((await provider.capabilities()).maxConcurrentGenerations, 1);
    assert.ok(DEFAULT_SYNTHESIS_TIMEOUT_MS >= 600_000);
    assert.equal('synthesize' in provider, false);
    const request: SynthesisStageRequest = { schemaVersion: 1, stage: 'subsystem-discovery', stageVersion: 3,
      parentPacketFingerprint: packet.inputFingerprint, view: createArchitectureEvidenceView(packet, ['framework:1']),
      context: { systems: [{ candidateKey: 'candidate:app', kind: 'system', name: 'App', responsibility: 'Serve',
        confidence: 0.8, ambiguityCodes: [], evidenceRefs: ['framework:1'] }],
        subjectSystemKey: 'candidate:app', subsystems: [], subjectSubsystemKey: null, subtrees: [], targetCandidateKeys: [] } };
    const execution = await provider.runStage(request);
    const result = execution.output as { systemKey: string; subsystems: unknown[] };
    assert.equal(result.systemKey, 'candidate:app'); assert.deepEqual(result.subsystems, []);
    assert.equal(server.requests.at(-1)!.body.response_format.json_schema.name, 'subsystem_discovery');
    const nodeSchema = server.requests.at(-1)!.body.response_format.json_schema.schema.properties.subsystems.items;
    assert.equal(nodeSchema.additionalProperties, false);
    assert.deepEqual(nodeSchema.required, ['candidateKey', 'kind', 'parentCandidateKey', 'name', 'responsibility',
      'confidence', 'ambiguityCodes', 'evidenceRefs', 'ownershipEvidenceRefs']);
    assert.match(server.requests.at(-1)!.body.messages[0].content, /may cross UI, HTTP\/API/);
    assert.match(SUBSYSTEM_DISCOVERY_INSTRUCTION, /Discover Subsystems only/i);
    const lower = { candidateKey: 'candidate:api', kind: 'subsystem' as const, parentCandidateKey: 'candidate:app',
      name: 'API', responsibility: 'Serve', confidence: .8, ambiguityCodes: [],
      evidenceRefs: ['framework:1'], ownershipEvidenceRefs: ['framework:1'] };
    const challengeRequest: SynthesisStageRequest = { ...request, stage: 'subsystem-challenge',
      context: { ...request.context, subsystems: [lower] } };
    const challengeOutput = (await provider.runStage(challengeRequest)).output as any;
    assert.equal(server.requests.at(-1)!.body.response_format.json_schema.name, 'subsystem_challenge');
    assert.match(server.requests.at(-1)!.body.messages[0].content, /technical-plane/i);
    const componentRequest: SynthesisStageRequest = { ...request, stage: 'component-discovery',
      context: { ...challengeRequest.context, subjectSubsystemKey: lower.candidateKey, challengedBy: challengeOutput } };
    await provider.runStage(componentRequest);
    assert.equal(server.requests.at(-1)!.body.response_format.json_schema.name, 'component_discovery');
    assert.match(server.requests.at(-1)!.body.messages[0].content, /exact challenged/i);
    assert.deepEqual(server.requests.slice(1, 3).map(r => r.body.response_format.json_schema.name), ['readiness', 'readiness']);
    const subtree = { systemKey: 'candidate:app', nodes: [] };
    const reconciliation: SynthesisStageRequest = { ...request, stage: 'reconciliation',
      context: { ...request.context, subjectSystemKey: null, subsystems: [], subjectSubsystemKey: null, subtrees: [subtree] } };
    await provider.runStage(reconciliation);
    const verification: SynthesisStageRequest = { ...reconciliation, stage: 'verification',
      context: { ...reconciliation.context, targetCandidateKeys: ['candidate:app'],
        boundaryCode: 'boundary-overlap' } };
    await provider.runStage(verification);
    assert.deepEqual(server.requests.slice(-2).map(r => r.body.response_format.json_schema.name), ['reconciliation', 'verification']);
    assert.match(server.requests.at(-2)!.body.messages[0].content, /cross-System/i);
    assert.match(server.requests.at(-1)!.body.messages[0].content, /boundaryCode/);
  } finally { await server.close(); }
});

test('staged adapter rejects malformed JSON and refusal after synthetic readiness', async () => {
  for (const [reply, error] of [[completion('{'), /Invalid system-discovery JSON/],
    [{ choices: [{ message: { refusal: 'No' } }] }, /refused/] ] as const) {
    const server = await mockServer((request, response) => {
      if (request.path === '/v1/models' || request.body.response_format.json_schema.name === 'readiness')
        return normalReply(request, response);
      json(response, reply);
    });
    try {
      const provider = new LmStudioSynthesisProvider({ endpoint: server.endpoint, contextWindowTokens: 16384 });
      await provider.discoverModels(); provider.selectModel(modelId); await provider.probe();
      const request: SynthesisStageRequest = { schemaVersion: 1, stageVersion: 3, stage: 'system-discovery',
        parentPacketFingerprint: packet.inputFingerprint, view: createArchitectureEvidenceView(packet, ['framework:1']),
        context: { systems: [], subjectSystemKey: null, subsystems: [], subjectSubsystemKey: null, subtrees: [], targetCandidateKeys: [] } };
      await assert.rejects(provider.runStage(request), error);
      assert.deepEqual(server.requests.slice(1, 3).map(r => r.body.response_format.json_schema.name), ['readiness', 'readiness']);
      assert.ok(server.requests.slice(1, 3).every(r => !JSON.stringify(r.body).includes(secret)));
    } finally { await server.close(); }
  }
});

test('local usage distinguishes provider counts from conservative input estimate', async () => {
  let reported: 'complete' | 'absent' | 'empty' = 'complete';
  const server = await mockServer((request, response) => {
    if (request.path === '/v1/models' || request.body.response_format.json_schema.name === 'readiness')
      return normalReply(request, response);
    json(response, { ...completion(JSON.stringify({ schemaVersion: 1, stageVersion: 3,
      stage: 'system-discovery', parentPacketFingerprint: packet.inputFingerprint,
      viewId: stageRequest().view.viewId, systems: [] })),
      ...(reported === 'complete' ? { usage: { prompt_tokens: 17, completion_tokens: 9, total_tokens: 26 } } :
        reported === 'empty' ? { usage: {} } : {}) });
  });
  try {
    const provider = new LmStudioSynthesisProvider({ endpoint: server.endpoint, contextWindowTokens: 16384 });
    await provider.discoverModels(); provider.selectModel(modelId); await provider.probe();
    const request = stageRequest();
    const fresh = await provider.runStage(request);
    assert.deepEqual(fresh.usage, { providerKind: 'local', modelLabel: modelId,
      requestBytes: Buffer.byteLength(JSON.stringify(request)),
      outputBytes: Buffer.byteLength(JSON.stringify(fresh.output)), inputTokens: 17,
      outputTokens: 9, totalTokens: 26, tokenMeasurement: 'provider-reported' });
    reported = 'absent';
    const estimated = await provider.runStage(request);
    assert.equal(estimated.usage.tokenMeasurement, 'estimated');
    assert.equal(estimated.usage.inputTokens, Buffer.byteLength(JSON.stringify(request)));
    assert.equal(estimated.usage.outputTokens, undefined);
    assert.equal(estimated.usage.totalTokens, undefined);
    reported = 'empty';
    assert.equal((await provider.runStage(request)).usage.inputTokens, Buffer.byteLength(JSON.stringify(request)));
  } finally { await server.close(); }
});

test('endpoint and token validation rejects credentials and keeps diagnostics redacted', async () => {
  assert.equal(normalizeSynthesisEndpoint(), 'http://127.0.0.1:1234/v1');
  assert.equal(normalizeSynthesisEndpoint('http://localhost:1234/v1/'), 'http://localhost:1234/v1');
  for (const endpoint of ['ftp://localhost', 'http://user:pass@localhost/v1', 'http://localhost/v1?key=x', 'http://localhost/other']) {
    assert.throws(() => normalizeSynthesisEndpoint(endpoint), /Invalid synthesis endpoint/);
  }
  assert.throws(() => new LmStudioSynthesisProvider({ token: 'line\nbreak' }), /Invalid synthesis token/);
  const server = await mockServer((request, response) => {
    assert.equal(request.authorization, 'Bearer top-secret-token');
    json(response, { error: 'top-secret-token' }, 401);
  });
  try {
    const provider = new LmStudioSynthesisProvider({ endpoint: server.endpoint, token: 'top-secret-token' });
    await assert.rejects(provider.discoverModels(), error => {
      assert.equal((error as Error).message, 'Synthesis HTTP 401');
      assert.ok(!String(error).includes('top-secret-token'));
      return true;
    });
  } finally { await server.close(); }
});

test('timeout, network, HTTP and invalid JSON failures stay visible without packet requests', async () => {
  const server = await mockServer((request, response) => {
    if (request.path === '/v1/models') return normalReply(request, response);
    // No response to the synthetic probe: the client timeout must abort it.
  });
  try {
    const provider = new LmStudioSynthesisProvider({ endpoint: server.endpoint, timeoutMs: 30 });
    const models = await provider.discoverModels();
    provider.selectModel(modelId);
    await assert.rejects(provider.probe(), /timed out/);
    assert.equal(server.requests.length, 2);
    assert.ok(server.requests.every(r => !JSON.stringify(r.body ?? '').includes(secret)));
  } finally { await server.close(); }
  const closed = new LmStudioSynthesisProvider({ endpoint: server.endpoint, timeoutMs: 100 });
  await assert.rejects(closed.discoverModels(), /connection failed/);
  const invalid = await mockServer((request, response) => {
    response.end('{');
  });
  try { await assert.rejects(new LmStudioSynthesisProvider({ endpoint: invalid.endpoint }).discoverModels(), /HTTP JSON/); }
  finally { await invalid.close(); }
});
