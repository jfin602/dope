import assert from 'node:assert/strict';
import test from 'node:test';
import { createArchitectureEvidenceView, parseSynthesisStageResult } from '../../packages/software-map/lib/index.js';
import type { ArchitectureEvidencePacket, SynthesisStageRequest } from '../../packages/software-map/lib/index.js';
import { GEMINI_SYNTHESIS_MODEL, GeminiSynthesisProvider, geminiStageSchema } from
  '../../packages/theia-extension/lib/node/gemini-synthesis-provider.js';

const key = 'synthetic-test-secret';
const packet: ArchitectureEvidencePacket = { schemaVersion: 1, inputFingerprint: 'gemini-fixture', items: [
  { id: 'entry', kind: 'entrypoint', path: 'src/café.ts', sourceEvidenceIds: ['physical:entry'], role: 'server' },
] };
const request: SynthesisStageRequest = { schemaVersion: 1, stageVersion: 2, stage: 'system-discovery',
  parentPacketFingerprint: packet.inputFingerprint, view: createArchitectureEvidenceView(packet, ['entry']),
  context: { systems: [], subtrees: [], subjectSystemKey: null, targetCandidateKeys: [] } };
const output = { schemaVersion: 1, stageVersion: 2, stage: 'system-discovery',
  parentPacketFingerprint: packet.inputFingerprint, viewId: request.view.viewId,
  systems: [{ candidateKey: 'candidate:server', kind: 'system', name: 'Server', responsibility: 'Serve café requests',
    confidence: 0.8, ambiguityCodes: [], evidenceRefs: ['entry'] }] };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value),
  { status, headers: { 'Content-Type': 'application/json' } });
const completion = (text: string, usageMetadata?: object) => ({ candidates: [{ content: { role: 'model', parts: [{ text }] },
  finishReason: 'STOP' }], usageMetadata });
const model = { name: `models/${GEMINI_SYNTHESIS_MODEL}`, inputTokenLimit: 1048576, outputTokenLimit: 65536 };

test('Gemini SDK applies the API key, fixed model, compact schema and provider usage', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch: typeof globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init: init! });
    return json(String(url).endsWith(':generateContent') ?
      completion(JSON.stringify(output), { promptTokenCount: 123, candidatesTokenCount: 45, totalTokenCount: 170 }) : model);
  };
  const provider = new GeminiSynthesisProvider({ apiKey: key, fetch });
  const capability = await provider.capabilities();
  assert.equal(capability.modelLabel, GEMINI_SYNTHESIS_MODEL);
  assert.equal(capability.contextWindowTokens, 1048576);
  assert.ok(capability.maxInputTokens < capability.contextWindowTokens / 8);
  const executed = await provider.runStage(request);
  assert.deepEqual(parseSynthesisStageResult(executed.output, request, packet), output);
  assert.deepEqual(executed.usage, { providerKind: 'gemini', modelLabel: GEMINI_SYNTHESIS_MODEL,
    requestBytes: Buffer.byteLength(JSON.stringify(request)), outputBytes: Buffer.byteLength(JSON.stringify(output)),
    inputTokens: 123, outputTokens: 45, totalTokens: 170, tokenMeasurement: 'provider-reported' });
  assert.equal(calls.length, 2);
  assert.ok(calls.every(call => call.url.includes(`/models/${GEMINI_SYNTHESIS_MODEL}`)));
  assert.ok(calls.every(call => new Headers(call.init.headers).get('x-goog-api-key') === key));
  const body = JSON.parse(String(calls[1].init.body));
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  const schema = body.generationConfig.responseJsonSchema;
  assert.deepEqual(schema.properties.stage.enum, ['system-discovery']);
  assert.deepEqual(schema.properties.stageVersion.enum, [2]);
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.properties.systems.items.required,
    ['candidateKey', 'kind', 'name', 'responsibility', 'confidence', 'ambiguityCodes', 'evidenceRefs']);
  assert.equal(schema.properties.systems.items.properties.evidenceRefs.uniqueItems, undefined);
  assert.equal(JSON.stringify(body).includes(key), false);
});

test('Gemini connection probe sends only synthetic readiness and sanitizes failure', async () => {
  const calls: string[] = [];
  const fetch: typeof globalThis.fetch = async (url, init) => {
    if (!String(url).endsWith(':generateContent')) return json(model);
    const body = JSON.parse(String(init?.body));
    calls.push(JSON.stringify(body));
    return json(completion('{"ready":true}'));
  };
  const provider = new GeminiSynthesisProvider({ apiKey: key, fetch });
  await provider.probe();
  assert.equal(calls.length, 1);
  assert.ok(calls[0].includes('synthetic request'));
  assert.ok(!calls[0].includes(packet.inputFingerprint));
  assert.ok(!calls[0].includes(key));
  const bad = new GeminiSynthesisProvider({ apiKey: key, fetch: async url => json(
    String(url).endsWith(':generateContent') ? completion(key) : model) });
  await assert.rejects(bad.probe(), error => !String(error).includes(key));
});

test('schema projection retains supported constraints and full Dope validation rejects surplus output', async () => {
  assert.deepEqual(geminiStageSchema({ type: 'string', const: 'yes', minLength: 2 }),
    { type: 'string', enum: ['yes'] });
  const provider = new GeminiSynthesisProvider({ apiKey: key, fetch: async (url) => json(
    String(url).endsWith(':generateContent') ? completion(JSON.stringify({ ...output, rationale: 'surplus' })) : model) });
  const executed = await provider.runStage(request);
  assert.throws(() => parseSynthesisStageResult(executed.output, request, packet), /fields/);
});

test('Gemini normalizes absent usage and sanitizes malformed response and JSON', async () => {
  for (const [reply, valid] of [[completion(JSON.stringify(output)), true], [{ candidates: [] }, false],
    [completion('{'), false]] as const) {
    const provider = new GeminiSynthesisProvider({ apiKey: key, fetch: async url => json(
      String(url).endsWith(':generateContent') ? reply : model) });
    if (valid) {
      const executed = await provider.runStage(request);
      assert.equal(executed.usage.tokenMeasurement, 'unavailable');
      assert.equal(executed.usage.inputTokens, undefined);
    } else await assert.rejects(provider.runStage(request), /Invalid Gemini stage JSON/);
  }
});

test('Gemini configuration, auth, quota, upstream and arbitrary errors never expose the key', async () => {
  assert.throws(() => new GeminiSynthesisProvider({ apiKey: '' }), /Invalid Gemini API key/);
  assert.throws(() => new GeminiSynthesisProvider({ apiKey: `${key}\n` }), /Invalid Gemini API key/);
  assert.throws(() => new GeminiSynthesisProvider({ apiKey: key, timeoutMs: 0 }), /Invalid Gemini synthesis timeout/);
  for (const [status, message] of [[401, 'authentication'], [403, 'authentication'], [429, 'quota'], [503, 'upstream']] as const) {
    const provider = new GeminiSynthesisProvider({ apiKey: key, fetch: async () => json({ error: { code: status,
      message: `${key} rejected` } }, status) });
    await assert.rejects(provider.capabilities(), error => {
      assert.match((error as Error).message, new RegExp(message));
      assert.ok(!String(error).includes(key));
      return true;
    });
  }
  const provider = new GeminiSynthesisProvider({ apiKey: key, fetch: async () => { throw new Error(key); } });
  await assert.rejects(provider.capabilities(), error => !String(error).includes(key));
  const stageProvider = new GeminiSynthesisProvider({ apiKey: key, fetch: async url =>
    String(url).endsWith(':generateContent') ? json({ error: { code: 429, message: key } }, 429) : json(model) });
  await assert.rejects(stageProvider.runStage(request), error => {
    assert.match((error as Error).message, /quota/);
    assert.ok(!String(error).includes(key));
    return true;
  });
});

test('Gemini stage cancellation and timeout are sanitized', async () => {
  for (const cancelled of [true, false]) {
    const controller = new AbortController();
    const provider = new GeminiSynthesisProvider({ apiKey: key, timeoutMs: cancelled ? 1000 : 20,
      fetch: async (url, init) => {
        if (!String(url).endsWith(':generateContent')) return json(model);
        if (cancelled) queueMicrotask(() => controller.abort());
        return new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new Error(key))));
      } });
    await assert.rejects(provider.runStage(request, controller.signal), error => {
      assert.match((error as Error).message, /cancelled or timed out/);
      assert.ok(!String(error).includes(key));
      return true;
    });
  }
});
