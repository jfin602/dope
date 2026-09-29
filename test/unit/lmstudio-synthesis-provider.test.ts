import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import test from 'node:test';
import type { ArchitectureEvidencePacket, ArchitectureProposal } from '../../packages/software-map/lib/index.js';
import { DEFAULT_SYNTHESIS_TIMEOUT_MS, LmStudioSynthesisProvider, normalizeSynthesisEndpoint, preferredSynthesisModel } from '../../packages/theia-extension/lib/node/lmstudio-synthesis-provider.js';

const modelId = 'publisher/Qwen3-Coder-30B-A3B-Instruct-GGUF';
const secret = 'PROJECT_SECRET_FRAMEWORK_EVIDENCE';
const packet: ArchitectureEvidencePacket = { schemaVersion: 1, inputFingerprint: 'source@framework', items: [
  { id: 'framework:1', kind: 'framework', path: 'src/backend.ts', sourceEvidenceIds: ['physical:1'],
    framework: 'theia', producer: 'theia-inversify', producerVersion: '1', concept: 'rpc-handler', name: secret },
] };
const proposal: ArchitectureProposal = { schemaVersion: 1, summary: 'One system', needsMoreEvidence: false, nodes: [
  { proposalKey: 'proposal:app', kind: 'system', name: 'App', purpose: 'Serve the app', parentProposalKey: null,
    confidence: 0.8, rationale: 'Framework registration', evidenceRefs: ['framework:1'], evidence: ['RPC handler'] },
], unassignedEvidenceRefs: [], openQuestions: [], evidenceRequests: [] };

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
function normalReply(request: Request, response: ServerResponse) {
  if (request.path === '/v1/models') return json(response, { data: [{ id: 'another-model' }, { id: modelId }] });
  if (request.body.response_format.json_schema.name === 'readiness') return json(response, completion('{"ready":true}'));
  return json(response, completion(JSON.stringify({ ...proposal, nodes: [{ ...proposal.nodes[0], evidenceRefs: ['e1'] }] })));
}
async function configured(endpoint: string, options: { token?: string; timeoutMs?: number } = {}) {
  const provider = new LmStudioSynthesisProvider({ endpoint, ...options });
  const models = await provider.discoverModels();
  provider.selectModel(preferredSynthesisModel(models)!);
  await provider.probe();
  return provider;
}

test('discovery -> synthetic probe -> synthetic warm -> compact facts; refs resolve against exact packet', async () => {
  const server = await mockServer(normalReply);
  try {
    const provider = await configured(server.endpoint);
    assert.equal(provider.selectedModel, modelId);
    assert.deepEqual(await provider.synthesize(packet), proposal);
    assert.deepEqual(await provider.synthesize(packet), proposal);
    assert.deepEqual(server.requests.map(r => r.path), ['/v1/models', '/v1/chat/completions', '/v1/chat/completions', '/v1/chat/completions', '/v1/chat/completions']);
    assert.deepEqual(server.requests.slice(1).map(r => r.body.response_format.json_schema.name), ['readiness', 'readiness', 'architecture_proposal', 'architecture_proposal']);
    assert.ok(server.requests.slice(1, 3).every(r => !JSON.stringify(r.body).includes(secret) && r.body.response_format.json_schema.strict));
    assert.ok(server.requests.slice(3).every(r => {
      const sent = JSON.parse(r.body.messages[1].content);
      return sent.items.length === packet.items.length && sent.items[0].ref === 'e1' &&
        sent.items[0].kind === 'framework' && sent.paths[sent.items[0].path] === packet.items[0].path &&
        !r.body.messages[1].content.includes('physical:1');
    }));
    assert.ok(server.requests.slice(1).every(r => r.body.model === modelId));
    assert.deepEqual(server.requests[3].body.response_format.json_schema.schema.required, [
      'schemaVersion', 'summary', 'needsMoreEvidence', 'nodes', 'unassignedEvidenceRefs', 'openQuestions', 'evidenceRequests',
    ]);
  } finally { await server.close(); }
});

test('large source-backed packets retain every fact within a bounded local-model input', async () => {
  assert.ok(DEFAULT_SYNTHESIS_TIMEOUT_MS >= 600_000, 'local synthesis must allow full-packet generation time');
  const large: ArchitectureEvidencePacket = { schemaVersion: 1, inputFingerprint: 'large', items: Array.from({ length: 426 }, (_, i) => ({
    id: `fact-${i}-${'f'.repeat(64)}`, kind: 'framework' as const, path: `packages/p${i % 12}/src/backend.ts`,
    sourceEvidenceIds: [`source-${i}-${'s'.repeat(64)}`], framework: 'theia', producer: 'theia-inversify',
    producerVersion: '1', concept: 'rpc-handler', name: `Service${i}`,
  })) };
  const server = await mockServer(normalReply);
  try {
    const provider = await configured(server.endpoint);
    const result = await provider.synthesize(large);
    assert.equal(result.nodes[0].evidenceRefs[0], large.items[0].id);
    const sent = server.requests[3].body.messages[1].content;
    assert.equal(JSON.parse(sent).items.length, 426);
    assert.ok(sent.length < 60000, `compact input was ${sent.length} bytes`);
    assert.ok(JSON.stringify(large).length > 100000);
  } finally { await server.close(); }
});

test('high-signal topology precedes lower-level facts without changing hard-reference validation', async () => {
  const mixed: ArchitectureEvidencePacket = { ...packet, items: [packet.items[0],
    { id: 'topology:1', kind: 'topology', path: 'package.json', sourceEvidenceIds: [], scope: 'workspace', name: 'Dope' }] };
  const server = await mockServer(normalReply);
  try {
    const provider = await configured(server.endpoint);
    const result = await provider.synthesize(mixed);
    const sent = JSON.parse(server.requests[3].body.messages[1].content);
    assert.equal(sent.items[0].kind, 'topology');
    assert.equal(sent.items[1].kind, 'framework');
    assert.equal(result.nodes[0].evidenceRefs[0], 'topology:1');
  } finally { await server.close(); }
});

test('warm-up failure blocks packet submission, including retry until probe succeeds', async () => {
  let readiness = 0;
  const server = await mockServer((request, response) => {
    if (request.body?.response_format.json_schema.name === 'readiness' && ++readiness === 2) return json(response, { error: 'unloaded' }, 503);
    normalReply(request, response);
  });
  try {
    const provider = await configured(server.endpoint);
    await assert.rejects(provider.synthesize(packet), /HTTP 503/);
    assert.equal(server.requests.length, 3);
    assert.ok(server.requests.every(r => !JSON.stringify(r.body ?? '').includes(secret)));
    await assert.rejects(provider.synthesize(packet), /probe required/);
    await provider.probe();
    assert.deepEqual(await provider.synthesize(packet), proposal);
    assert.deepEqual(server.requests.slice(3).map(r => r.body.response_format.json_schema.name), ['readiness', 'readiness', 'architecture_proposal']);
  } finally { await server.close(); }
});

test('probe rejects unavailable models and malformed structured readiness without project evidence', async () => {
  const server = await mockServer((request, response) => {
    if (request.path === '/v1/models') return normalReply(request, response);
    json(response, completion('{"ready":false}'));
  });
  try {
    const provider = new LmStudioSynthesisProvider({ endpoint: server.endpoint });
    await provider.discoverModels();
    assert.throws(() => provider.selectModel('not-loaded'), /unavailable/);
    provider.selectModel(modelId);
    await assert.rejects(provider.probe(), /readiness response/);
    await assert.rejects(provider.synthesize(packet), /probe required/);
    assert.deepEqual(server.requests.map(r => r.path), ['/v1/models', '/v1/chat/completions']);
    assert.ok(server.requests.every(r => !JSON.stringify(r.body ?? '').includes(secret)));
  } finally { await server.close(); }
});

test('explicit unload, reconnect and model change each invalidate warm readiness', async () => {
  const server = await mockServer(normalReply);
  try {
    const provider = await configured(server.endpoint);
    await provider.synthesize(packet);
    provider.invalidateWarmState();
    await provider.synthesize(packet);
    await provider.discoverModels();
    await assert.rejects(provider.synthesize(packet), /probe required/);
    await provider.probe();
    await provider.synthesize(packet);
    provider.selectModel('another-model');
    await assert.rejects(provider.synthesize(packet), /probe required/);
    await provider.probe();
    await provider.synthesize(packet);
    assert.deepEqual(server.requests.map(r => r.body?.response_format.json_schema.name ?? 'models'), [
      'models', 'readiness', 'readiness', 'architecture_proposal', 'readiness', 'architecture_proposal',
      'models', 'readiness', 'readiness', 'architecture_proposal', 'readiness', 'readiness', 'architecture_proposal',
    ]);
    assert.equal(server.requests.at(-1)!.body.model, 'another-model');
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

test('malformed, schema-invalid, fabricated-ref and refused proposals fail after warm-up', async () => {
  const cases = [
    { content: '{', error: /malformed JSON/ },
    { content: JSON.stringify({ ...proposal, extra: true }), error: /fields/ },
    { content: JSON.stringify({ ...proposal, nodes: [{ ...proposal.nodes[0], evidenceRefs: ['fabricated'] }] }), error: /unknown/ },
  ];
  for (const scenario of cases) {
    const server = await mockServer((request, response) => {
      if (request.body?.response_format.json_schema.name === 'architecture_proposal') return json(response, completion(scenario.content));
      normalReply(request, response);
    });
    try {
      const provider = await configured(server.endpoint);
      await assert.rejects(provider.synthesize(packet), scenario.error);
      assert.equal(server.requests.length, 4);
      assert.ok(server.requests.slice(1, 3).every(r => !JSON.stringify(r.body).includes(secret)));
    } finally { await server.close(); }
  }
  const refused = await mockServer((request, response) => {
    if (request.body?.response_format.json_schema.name === 'architecture_proposal') return json(response, { choices: [{ message: { refusal: 'No' } }] });
    normalReply(request, response);
  });
  try { await assert.rejects((await configured(refused.endpoint)).synthesize(packet), /refused/); }
  finally { await refused.close(); }
});
