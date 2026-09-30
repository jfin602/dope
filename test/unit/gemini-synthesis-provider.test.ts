import assert from 'node:assert/strict';
import test from 'node:test';
import { createArchitectureEvidenceView, parseSynthesisStageResult, synthesisStageResultSchemas,
  SynthesisProviderFailure } from '../../packages/software-map/lib/index.js';
import type { ArchitectureEvidencePacket, SynthesisStageRequest } from '../../packages/software-map/lib/index.js';
import { GeminiSynthesisProvider, geminiStageSchema } from
  '../../packages/theia-extension/lib/node/gemini-synthesis-provider.js';
import { COMPONENT_DISCOVERY_INSTRUCTION, SUBSYSTEM_CHALLENGE_INSTRUCTION, SUBSYSTEM_DISCOVERY_INSTRUCTION,
  SYSTEM_DISCOVERY_INSTRUCTION } from '../../packages/theia-extension/lib/node/lmstudio-synthesis-provider.js';

const key = 'synthetic-test-secret';
const packet: ArchitectureEvidencePacket = { schemaVersion: 1, inputFingerprint: 'gemini-fixture', items: [
  { id: 'entry', kind: 'entrypoint', path: 'src/café.ts', sourceEvidenceIds: ['physical:entry'], role: 'server' },
] };
const request: SynthesisStageRequest = { schemaVersion: 1, stageVersion: 3, stage: 'system-discovery',
  parentPacketFingerprint: packet.inputFingerprint, view: createArchitectureEvidenceView(packet, ['entry']),
  context: { systems: [], subtrees: [], subjectSystemKey: null, subsystems: [], subjectSubsystemKey: null, targetCandidateKeys: [] } };
const output = { schemaVersion: 1, stageVersion: 3, stage: 'system-discovery',
  parentPacketFingerprint: packet.inputFingerprint, viewId: request.view.viewId,
  systems: [{ candidateKey: 'candidate:server', kind: 'system', name: 'Server', responsibility: 'Serve café requests',
    confidence: 0.8, ambiguityCodes: [], evidenceRefs: ['entry'] }] };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value),
  { status, headers: { 'Content-Type': 'application/json' } });
const completion = (text: string, usageMetadata?: object) => ({ candidates: [{ content: { role: 'model', parts: [{ text }] },
  finishReason: 'STOP' }], usageMetadata });
const modelId = 'gemini-3.6-flash';
const model = { name: `models/${modelId}`, inputTokenLimit: 1048576, outputTokenLimit: 65536,
  supportedGenerationMethods: ['generateContent'] };
async function prepared(options: ConstructorParameters<typeof GeminiSynthesisProvider>[0]) {
  const fetch = options.fetch!;
  const provider = new GeminiSynthesisProvider({ ...options, fetch: (url, init) =>
    /\/models(?:\?|$)/.test(String(url)) ? Promise.resolve(json({ models: [model] })) : fetch(url, init) });
  await provider.discoverModels();
  provider.selectModel(modelId);
  return provider;
}

test('Gemini model discovery filters generation models and rejects undiscovered selection', async () => {
  const listed = [model, { name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
    { name: 'models/gemini-image', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-old', supportedGenerationMethods: ['countTokens'] }];
  const provider = new GeminiSynthesisProvider({ apiKey: key, fetch: async () => json({ models: listed }) });
  assert.deepEqual(await provider.discoverModels(), [modelId, 'gemini-3.8-flash']);
  assert.throws(() => provider.selectModel('gemini-image'), /discovered/);
  provider.selectModel(modelId);
  assert.equal(provider.selectedModel, modelId);
  await provider.discoverModels();
  assert.equal(provider.selectedModel, undefined);
});

test('Gemini SDK applies the API key, selected model, compact schema and provider usage', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch: typeof globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init: init! });
    return json(String(url).endsWith(':generateContent') ?
      completion(JSON.stringify(output), { promptTokenCount: 123, candidatesTokenCount: 45, totalTokenCount: 170 }) : model);
  };
  const provider = await prepared({ apiKey: key, fetch });
  const capability = await provider.capabilities();
  assert.equal(capability.modelLabel, modelId);
  assert.equal(capability.contextWindowTokens, 1048576);
  assert.equal(capability.maxInputTokens, 65536);
  assert.ok(capability.maxInputTokens < capability.contextWindowTokens / 8);
  const executed = await provider.runStage(request);
  assert.deepEqual(parseSynthesisStageResult(executed.output, request, packet), output);
  assert.deepEqual(executed.usage, { providerKind: 'gemini', modelLabel: modelId,
    requestBytes: Buffer.byteLength(JSON.stringify(request)), outputBytes: Buffer.byteLength(JSON.stringify(output)),
    inputTokens: 123, outputTokens: 45, totalTokens: 170, tokenMeasurement: 'provider-reported' });
  assert.equal(calls.length, 2);
  assert.ok(calls.every(call => call.url.includes(`/models/${modelId}`)));
  assert.ok(calls.every(call => new Headers(call.init.headers).get('x-goog-api-key') === key));
  const body = JSON.parse(String(calls[1].init.body));
  assert.equal(body.systemInstruction.parts[0].text, SYSTEM_DISCOVERY_INSTRUCTION);
  assert.match(body.systemInstruction.parts[0].text, /One cohesive product may be one System/);
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.equal(body.generationConfig.maxOutputTokens, 32768);
  const schema = body.generationConfig.responseJsonSchema;
  assert.deepEqual(schema.properties.stage.enum, ['system-discovery']);
  assert.deepEqual(schema.properties.stageVersion.enum, [3]);
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.properties.systems.items.required,
    ['candidateKey', 'kind', 'name', 'responsibility', 'confidence', 'ambiguityCodes', 'evidenceRefs']);
  assert.equal(schema.properties.systems.items.properties.evidenceRefs.uniqueItems, undefined);
  assert.equal(schema.properties.systems.items.properties.candidateKey.description,
    'Must match ^candidate:[A-Za-z0-9._-]+$');
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
  const provider = await prepared({ apiKey: key, fetch });
  await provider.probe();
  assert.equal(calls.length, 1);
  assert.ok(calls[0].includes('synthetic request'));
  assert.ok(JSON.parse(calls[0]).generationConfig.maxOutputTokens >= 1024);
  assert.ok(!calls[0].includes('"enum":[true]'));
  assert.ok(!calls[0].includes(packet.inputFingerprint));
  assert.ok(!calls[0].includes(key));
  const bad = await prepared({ apiKey: key, fetch: async url => json(
    String(url).endsWith(':generateContent') ? completion(key) : model) });
  await assert.rejects(bad.probe(), error => {
    assert.match(String(error), /Gemini readiness: Invalid readiness response/);
    return !String(error).includes(key);
  });
});

test('failed selected model stays failed until a different model is manually selected', async () => {
  const called: string[] = [];
  const provider = new GeminiSynthesisProvider({ apiKey: key, fetch: async (url) => {
    const path = String(url);
    if (/\/models(?:\?|$)/.test(path)) return json({ models: [model,
      { name: 'models/gemini-3.8-flash', inputTokenLimit: 1048576, supportedGenerationMethods: ['generateContent'] }] });
    const id = path.includes('gemini-3.8-flash') ? 'gemini-3.8-flash' : modelId;
    if (path.endsWith(':generateContent')) {
      called.push(id);
      return id === 'gemini-3.8-flash' ? json({ error: { code: 503, message: key } }, 503) :
        json(completion('{"ready":true}'));
    }
    return json({ ...model, name: `models/${id}` });
  } });
  await provider.discoverModels();
  provider.selectModel('gemini-3.8-flash');
  await assert.rejects(provider.probe(), /upstream service failed \(HTTP 503\)/);
  assert.equal(provider.selectedModel, 'gemini-3.8-flash');
  assert.deepEqual(called, ['gemini-3.8-flash']);
  provider.selectModel(modelId);
  await provider.probe();
  assert.deepEqual(called, ['gemini-3.8-flash', modelId]);
});

test('schema projection retains supported constraints and full Dope validation rejects surplus output', async () => {
  assert.deepEqual(geminiStageSchema({ type: 'string', const: 'yes', minLength: 2 }),
    { type: 'string', enum: ['yes'] });
  const provider = await prepared({ apiKey: key, fetch: async (url) => json(
    String(url).endsWith(':generateContent') ? completion(JSON.stringify({ ...output, rationale: 'surplus' })) : model) });
  const executed = await provider.runStage(request);
  assert.throws(() => parseSynthesisStageResult(executed.output, request, packet), /fields/);
});

test('Gemini normalizes absent usage and sanitizes malformed response and JSON', async () => {
  for (const [reply, valid] of [[completion(JSON.stringify(output)), true], [{ candidates: [] }, false],
    [completion('{'), false]] as const) {
    const provider = await prepared({ apiKey: key, fetch: async url => json(
      String(url).endsWith(':generateContent') ? reply : model) });
    if (valid) {
      const executed = await provider.runStage(request);
      assert.equal(executed.usage.tokenMeasurement, 'unavailable');
      assert.equal(executed.usage.inputTokens, undefined);
    } else await assert.rejects(provider.runStage(request), error => {
      assert.equal((error as SynthesisProviderFailure).failureClass, 'invalid-json');
      return /Invalid Gemini stage JSON/.test(String(error));
    });
  }
});

test('Gemini reports stage truncation without exposing response text', async () => {
  const provider = await prepared({ apiKey: key, fetch: async url => json(
    String(url).endsWith(':generateContent') ? { ...completion(key), candidates: [{
      ...completion(key).candidates[0], finishReason: 'MAX_TOKENS' }] } : model) });
  await assert.rejects(provider.runStage(request), error => {
    assert.match((error as Error).message, /Gemini stage output truncated at token limit/);
    assert.ok(!String(error).includes(key));
    return true;
  });
});

test('Gemini reconciliation instructs one unresolved entry per candidate', async () => {
  let instruction = '';
  const provider = await prepared({ apiKey: key, fetch: async (url, init) => {
    if (!String(url).endsWith(':generateContent')) return json(model);
    instruction = JSON.parse(String(init?.body)).systemInstruction.parts[0].text;
    return json(completion('{}'));
  } });
  await provider.runStage({ ...request, stage: 'reconciliation' });
  assert.match(instruction, /Each unresolved candidateKey may appear only once/);
});

test('Local instructions and Gemini schemas route the same three compact lower stages through Dope validation', async () => {
  const system = { ...output.systems[0], candidateKey: 'candidate:app' };
  const subsystem = { candidateKey: 'candidate:api', kind: 'subsystem', parentCandidateKey: system.candidateKey,
    name: 'API', responsibility: 'Serve requests', confidence: .8, ambiguityCodes: [],
    evidenceRefs: ['entry'], ownershipEvidenceRefs: ['entry'] };
  const discovery: SynthesisStageRequest = { ...request, stage: 'subsystem-discovery',
    context: { ...request.context, systems: [system], subjectSystemKey: system.candidateKey } };
  const challenge: SynthesisStageRequest = { ...discovery, stage: 'subsystem-challenge',
    context: { ...discovery.context, subsystems: [subsystem] } };
  const challengeResult = { ...output, stage: 'subsystem-challenge', viewId: request.view.viewId,
    systemKey: system.candidateKey, decisions: [{ action: 'keep', sourceKeys: [subsystem.candidateKey],
      subsystems: [subsystem], evidenceRefs: ['entry'] }] };
  delete (challengeResult as { systems?: unknown }).systems;
  const component: SynthesisStageRequest = { ...challenge, stage: 'component-discovery',
    context: { ...challenge.context, subjectSubsystemKey: subsystem.candidateKey, challengedBy: challengeResult as any } };
  const stages = [
    [discovery, { systemKey: system.candidateKey, subsystems: [subsystem] }, SUBSYSTEM_DISCOVERY_INSTRUCTION],
    [challenge, { systemKey: system.candidateKey, decisions: challengeResult.decisions }, SUBSYSTEM_CHALLENGE_INSTRUCTION],
    [component, { systemKey: system.candidateKey, subsystemKey: subsystem.candidateKey, components: [{ ...subsystem,
      candidateKey: 'candidate:handler', kind: 'component', parentCandidateKey: subsystem.candidateKey }] },
      COMPONENT_DISCOVERY_INSTRUCTION],
  ] as const;
  for (const [stageRequest, fields, instruction] of stages) {
    let body: any;
    const response = { schemaVersion: 1, stageVersion: 3, stage: stageRequest.stage,
      parentPacketFingerprint: packet.inputFingerprint, viewId: stageRequest.view.viewId, ...fields };
    const provider = await prepared({ apiKey: key, fetch: async (url, init) => {
      if (!String(url).endsWith(':generateContent')) return json(model);
      body = JSON.parse(String(init?.body));
      return json(completion(JSON.stringify(response)));
    } });
    const executed = await provider.runStage(stageRequest);
    assert.equal(body.systemInstruction.parts[0].text, instruction);
    assert.match(instruction, /Never use dependency, topology, configuration, test, or document refs as ownership/);
    assert.deepEqual(body.generationConfig.responseJsonSchema,
      geminiStageSchema(synthesisStageResultSchemas[stageRequest.stage]));
    assert.deepEqual(parseSynthesisStageResult(executed.output, stageRequest, packet), response);
    assert.throws(() => parseSynthesisStageResult({ ...executed.output as object, rationale: 'essay' }, stageRequest, packet));
  }
});

test('Gemini configuration, auth, quota, upstream and arbitrary errors never expose the key', async () => {
  assert.throws(() => new GeminiSynthesisProvider({ apiKey: '' }), /Invalid Gemini API key/);
  assert.throws(() => new GeminiSynthesisProvider({ apiKey: `${key}\n` }), /Invalid Gemini API key/);
  assert.throws(() => new GeminiSynthesisProvider({ apiKey: key, timeoutMs: 0 }), /Invalid Gemini synthesis timeout/);
  for (const [status, message] of [[400, 'HTTP 400'], [401, 'authentication'], [403, 'authentication'], [429, 'quota'], [503, 'upstream']] as const) {
    const provider = await prepared({ apiKey: key, fetch: async () => json({ error: { code: status,
      message: `${key} rejected` } }, status) });
    await assert.rejects(provider.capabilities(), error => {
      assert.match((error as Error).message, /Gemini model metadata:/);
      assert.match((error as Error).message, new RegExp(message));
      assert.ok(!String(error).includes(key));
      return true;
    });
  }
  const provider = await prepared({ apiKey: key, fetch: async () => { throw new Error(key); } });
  await assert.rejects(provider.capabilities(), error => !String(error).includes(key));
  const stageProvider = await prepared({ apiKey: key, fetch: async url =>
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
    const provider = await prepared({ apiKey: key, timeoutMs: cancelled ? 1000 : 20,
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

test('Gemini marks only sanitized stage transport and upstream failures retryable', async () => {
  for (const [response, failureClass] of [
    [() => { throw new TypeError(key); }, 'transient-transport'],
    [() => json({ error: { code: 503, message: key } }, 503), 'transient-upstream'],
    [() => json({ error: { code: 401, message: key } }, 401), 'authentication'],
  ] as const) {
    const provider = await prepared({ apiKey: key, fetch: async url =>
      String(url).endsWith(':generateContent') ? response() : json(model) });
    await assert.rejects(provider.runStage(request), error => {
      assert.equal(error instanceof SynthesisProviderFailure ? error.failureClass : undefined, failureClass);
      assert.equal(String(error).includes(key), false);
      return true;
    });
  }
});
