import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import test from 'node:test';
import { discoverCandidateSystems } from '../../packages/software-map/lib/index.js';
import type { ArchitectureEvidencePacket, SynthesisStageRequest } from '../../packages/software-map/lib/index.js';
import { LmStudioSynthesisProvider, SYSTEM_DISCOVERY_INSTRUCTION } from '../../packages/theia-extension/lib/node/lmstudio-synthesis-provider.js';

const model = 'local-qwen';
const topology = (id: string, path: string, name: string) =>
  ({ id, kind: 'topology' as const, path, name, scope: 'package' as const, sourceEvidenceIds: [`source:${id}`] });
const entry = (id: string, path: string, role: string) =>
  ({ id, kind: 'entrypoint' as const, path, role, sourceEvidenceIds: [`source:${id}`] });
const semantic = (id: string, path: string, symbol: string) =>
  ({ id, kind: 'semantic' as const, path, symbol, relation: 'class:exported', sourceEvidenceIds: [`source:${id}`] });
const oneResponsibility: ArchitectureEvidencePacket = { schemaVersion: 1, inputFingerprint: 'one-responsibility', items: [
  topology('browser', 'apps/browser/package.json', 'browser'), topology('electron', 'apps/electron/package.json', 'electron'),
  topology('domain', 'packages/core/package.json', 'core'),
  entry('browser-start', 'apps/browser/src/main.ts', 'browser:main'),
  entry('electron-start', 'apps/electron/src/main.ts', 'electron:main'),
  semantic('workbench', 'packages/core/src/workbench.ts', 'Workbench'),
  semantic('fixture', 'test/fixtures/example.ts', 'FixtureWorkbench'),
  ...Array.from({ length: 100 }, (_, index) => semantic(`noise-${index}`, `test/noise/example-${index}.ts`, `Fixture${index}`)),
] };
const multipleResponsibilities: ArchitectureEvidencePacket = { schemaVersion: 1, inputFingerprint: 'multiple-responsibilities', items: [
  topology('api', 'packages/api/package.json', 'api'), topology('compiler', 'packages/compiler/package.json', 'compiler'),
  entry('api-start', 'packages/api/src/server.ts', 'main:server'), entry('compiler-start', 'packages/compiler/src/cli.ts', 'bin:compiler'),
  semantic('api-contract', 'packages/api/src/contracts.ts', 'PublicApi'),
  semantic('compiler-contract', 'packages/compiler/src/index.ts', 'Compiler'),
] };
type Call = { path: string; body?: any };
async function serverFor(reply: (request: SynthesisStageRequest) => unknown, warmFails = false) {
  const calls: Call[] = [];
  let readiness = 0;
  const server = createServer(async (incoming: IncomingMessage, response: ServerResponse) => {
    const chunks: Buffer[] = [];
    for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
    const call: Call = { path: incoming.url!, body: chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined };
    calls.push(call);
    const send = (value: unknown, status = 200) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(value)); };
    if (call.path === '/v1/models') return send({ data: [{ id: model }, { id: 'other' }] });
    if (call.body.response_format.json_schema.name === 'readiness') {
      readiness++;
      return warmFails && readiness === 2 ? send({ error: 'unloaded' }, 503) : send({ choices: [{ message: { content: '{"ready":true}' } }] });
    }
    const request = JSON.parse(call.body.messages[1].content) as SynthesisStageRequest;
    send({ choices: [{ message: { content: JSON.stringify(reply(request)) } }] });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  return { endpoint: `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`, calls,
    close: async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); } };
}
const candidate = (key: string, name: string, refs: string[]) => ({ candidateKey: `candidate:${key}`, kind: 'system', name,
  purpose: `Own ${name} behavior`, boundaryRationale: `${name} has an independent responsibility and owned entrypoint`,
  confidence: 0.8, uncertainty: [], evidenceRefs: refs });
const result = (request: SynthesisStageRequest, systems: unknown[]) => ({ schemaVersion: 1, stageVersion: 1,
  stage: 'system-discovery', parentPacketFingerprint: request.parentPacketFingerprint, viewId: request.view.viewId, systems });
async function configured(endpoint: string) {
  const provider = new LmStudioSynthesisProvider({ endpoint, contextWindowTokens: 32768 });
  await provider.discoverModels(); provider.selectModel(model); await provider.probe();
  return provider;
}

test('global view groups Browser and Electron packages under one responsibility without a count rule', async () => {
  const server = await serverFor(request => result(request, [candidate('workbench', 'Workbench', ['browser-start', 'electron-start', 'workbench'])]));
  try {
    const provider = await configured(server.endpoint);
    const first = await discoverCandidateSystems(oneResponsibility, provider);
    const second = await discoverCandidateSystems(oneResponsibility, provider);
    assert.equal(first.result.systems.length, 1);
    assert.deepEqual(first.result, second.result);
    assert.deepEqual(server.calls.map(call => call.body?.response_format.json_schema.name ?? 'models'),
      ['models', 'readiness', 'readiness', 'system_discovery', 'system_discovery']);
    const sent = JSON.parse(server.calls[3].body.messages[1].content) as SynthesisStageRequest;
    assert.deepEqual(sent, first.plan.request);
    assert.ok(sent.view.items.some(item => item.id === 'browser'));
    assert.ok(sent.view.items.some(item => item.id === 'electron'));
    assert.ok(sent.view.items.length < oneResponsibility.items.length);
    assert.ok(first.plan.omittedEvidenceRefs.length > 0);
    assert.equal(JSON.stringify(sent).includes('sourceFingerprint'), false);
    assert.equal(server.calls[3].body.response_format.json_schema.schema.properties.systems.items.properties.kind.const, 'system');
    assert.equal(JSON.stringify(server.calls[3].body.response_format.json_schema.schema).includes('subsystem'), false);
    assert.equal(JSON.stringify(server.calls[3].body.response_format.json_schema.schema).includes('component'), false);
    assert.ok(!/1-2 Systems|2-5 Subsystems|2-8 Components/.test(SYSTEM_DISCOVERY_INSTRUCTION));
    assert.match(SYSTEM_DISCOVERY_INSTRUCTION, /Do not force a target count/);
    assert.ok(!server.calls[1].body.messages.some((message: { content: string }) => message.content.includes('workbench')));
    assert.ok(!server.calls[2].body.messages.some((message: { content: string }) => message.content.includes('workbench')));
  } finally { await server.close(); }
});

test('one repository can return multiple independent Systems from one global view', async () => {
  const server = await serverFor(request => result(request, [
    candidate('api', 'API', ['api-start', 'api-contract']), candidate('compiler', 'Compiler', ['compiler-start', 'compiler-contract']),
  ]));
  try {
    const { result: discovered, plan } = await discoverCandidateSystems(multipleResponsibilities, await configured(server.endpoint));
    assert.deepEqual(discovered.systems.map(item => item.name), ['API', 'Compiler']);
    assert.ok(plan.request.view.items.some(item => item.id === 'api-start'));
    assert.ok(plan.request.view.items.some(item => item.id === 'compiler-start'));
  } finally { await server.close(); }
});

test('strict stage result rejects lower hierarchy, fabricated refs and fixture-only production support', async () => {
  for (const mode of ['subsystem', 'component', 'fabricated', 'fixture'] as const) {
    const server = await serverFor(request => {
      const node = candidate('workbench', 'Workbench', mode === 'fabricated' ? ['fabricated'] : mode === 'fixture' ? ['fixture'] : ['workbench']);
      return result(request, mode === 'subsystem' ? [{ ...node, kind: 'subsystem' }] :
        mode === 'component' ? [{ ...node, components: [] }] : [node]);
    });
    try {
      await assert.rejects(discoverCandidateSystems(oneResponsibility, await configured(server.endpoint)),
        mode === 'subsystem' ? /kind/ : mode === 'component' ? /fields/ :
          mode === 'fixture' ? /production evidence/ : /unknown/);
      assert.equal(server.calls.filter(call => call.body?.response_format.json_schema.name === 'system_discovery').length, 1);
    } finally { await server.close(); }
  }
});

test('warm failure blocks evidence; reconnect and model change require new probe and warm-up', async () => {
  const server = await serverFor(request => result(request, [candidate('workbench', 'Workbench', ['workbench'])]), true);
  try {
    const provider = await configured(server.endpoint);
    assert.equal(provider.isProbed, true);
    await assert.rejects(discoverCandidateSystems(oneResponsibility, provider), /HTTP 503/);
    assert.equal(provider.isProbed, false);
    assert.equal(server.calls.filter(call => call.body?.response_format.json_schema.name === 'system_discovery').length, 0);
    await assert.rejects(discoverCandidateSystems(oneResponsibility, provider), /probe required/);
    await provider.probe();
    assert.equal(provider.isProbed, true);
    await discoverCandidateSystems(oneResponsibility, provider);
    await provider.discoverModels();
    await assert.rejects(discoverCandidateSystems(oneResponsibility, provider), /probe required/);
    await provider.probe();
    await discoverCandidateSystems(oneResponsibility, provider);
    provider.selectModel('other');
    await assert.rejects(discoverCandidateSystems(oneResponsibility, provider), /probe required/);
    await provider.probe();
    await discoverCandidateSystems(oneResponsibility, provider);
    assert.equal(server.calls.filter(call => call.body?.response_format.json_schema.name === 'system_discovery').length, 3);
    assert.equal(server.calls.filter(call => call.body?.response_format.json_schema.name === 'readiness').length, 8);
  } finally { await server.close(); }
});
