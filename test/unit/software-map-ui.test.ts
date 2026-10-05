import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { SoftwareMapController, declarationFromDraft } = require('../../packages/theia-extension/lib/browser/software-map-controller.js');
const deferred = () => {
  let resolve: (value: any) => void = () => {};
  const promise = new Promise<any>(ok => { resolve = ok; });
  return { promise, resolve };
};
const status = (generation: number) => ({ generation, publishedGeneration: generation, state: 'ready', analysis: { completeness: 'complete', errors: [] }, reusedSourceFiles: 0, declarationPresent: true });
const idle = { ...status(0), state: 'idle' };
const page = (generation: number, items: any[]) => ({ generation, total: items.length, items });
function inventory() {
  const connections = [
    { version: 1, id: 'local-one', alias: 'Local', lifecycle: 'enabled', config: { type: 'local', runtime: 'lm-studio', endpoint: 'http://127.0.0.1:1234/v1' } },
    { version: 1, id: 'gemini-one', alias: 'Gemini', lifecycle: 'enabled', config: { type: 'gemini' } },
  ];
  const models = [
    { version: 1, connectionId: 'local-one', providerModelKey: 'Qwen3-Coder-30B-A3B-Instruct', label: 'Qwen', enabled: true, state: 'ready', limits: { contextWindowTokens: { source: 'configured', value: 65536 } } },
    { version: 1, connectionId: 'gemini-one', providerModelKey: 'gemini-3.6-flash', label: 'Flash', enabled: true, state: 'ready', limits: { contextWindowTokens: { source: 'adapter-known', value: 100000 } } },
    { version: 1, connectionId: 'gemini-one', providerModelKey: 'gemini-3.8-flash', label: 'Flash 2', enabled: true, state: 'ready', limits: { contextWindowTokens: { source: 'adapter-known', value: 100000 } } },
  ];
  const state = { registry: { version: 1, revision: 1, connections, models }, observations: [], tests: [] };
  return { state, inventory: async () => state, list: async () => state.registry,
    refreshModels: async () => state, mutate: async () => state.registry };
}
function roleInventory() {
  const registry = inventory();
  const known = (value: boolean) => ({ source: 'adapter-known', value });
  for (const model of registry.state.registry.models) {
    (model as any).locality = model.connectionId === 'local-one' ? 'local' : 'hosted';
    (model as any).capabilities = { conversationalText: known(true), streaming: known(true),
      structuredOutput: known(true), toolCalling: known(false) };
    (model as any).limits = { ...model.limits, maxInputTokens: { source: 'unknown' }, maxOutputTokens: { source: 'unknown' } };
  }
  registry.state.observations.push({ connectionId: 'local-one', health: 'ready' } as any,
    { connectionId: 'gemini-one', health: 'ready' } as any);
  (registry.state as any).loadedLocalModels = [{ connectionId: 'local-one',
    providerModelKey: 'Qwen3-Coder-30B-A3B-Instruct', contextWindowTokens: 65536 }];
  return registry;
}
function smapRoles(target: string) {
  const hard = { requiredCapabilities: [], locality: 'any', enabledOnly: true,
    usableOnly: true, hostedProjectData: 'requires-feature-authorization' };
  return { list: async () => ({ version: 1, revision: 1, policies:
    ['interactive', 'deep-reasoning', 'background', 'software-map', 'coding-agent'].map(roleId => ({
      roleId, preferred: roleId === 'software-map' ? { type: 'exact', target: {
        connectionId: target, modelId: target === 'local-one' ? 'Qwen3-Coder-30B-A3B-Instruct' : 'gemini-3.6-flash' } } : undefined,
      fallbacks: [], hard, preferences: [], allowFallback: false })) }) };
}
async function ready(controller: any, kind: 'local' | 'gemini' = 'local', model?: string): Promise<void> {
  await controller.refreshInventory();
  controller.selectTarget(kind === 'local' ? 'local-one' : 'gemini-one', model ??
    (kind === 'local' ? 'Qwen3-Coder-30B-A3B-Instruct' : 'gemini-3.6-flash'));
  await controller.probe();
  if (kind === 'gemini') controller.consentToHostedEvidence();
}
function connection() {
  const attach = deferred();
  const analyze = deferred();
  const statusRequest = deferred();
  const hierarchy = deferred();
  const violations = deferred();
  const relationships = deferred();
  const relationshipEdges = deferred();
  const evidence = deferred();
  let client: any;
  let disposed = false;
  let analyzed = 0;
  let configured = 0;
  let accepted = 0;
  let revision = 0;
  const savedDrafts: any[] = [];
  const configurations: any[] = [];
  return {
    get analyzed() { return analyzed; }, get configured() { return configured; }, get accepted() { return accepted; }, configurations, savedDrafts,
    attachPending: attach, analyzePending: analyze, statusPending: statusRequest, hierarchyPending: hierarchy, violationsPending: violations, relationshipsPending: relationships, relationshipEdgesPending: relationshipEdges, evidencePending: evidence,
    setClient(value: any) { client = value; }, event(value: any) { client?.notifySoftwareMapChanged(value); },
    progress(handle: string, value: any) { client?.notifySoftwareMapAnalysisProgress(handle, value); },
    attach() { return attach.promise; }, analyze() { analyzed++; return analyze.promise; },
    initializationStatus() { return Promise.resolve({ state: 'uninitialized', declarationPresent: false, declarationFingerprint: 'absent' }); },
    clearSynthesis() { return Promise.resolve(); },
    configureSynthesis(_handle: string, options: any) { configured++; configurations.push(options); return Promise.resolve({ models: [options.modelId] }); },
    probeSynthesis() { return Promise.resolve(); },
    synthesisReady() { return Promise.resolve(false); },
    startInitialization() { return Promise.resolve({ reviewId: 'review', packet: { items: [] }, proposal: { nodes: [], openQuestions: [], unassignedEvidenceRefs: [] }, draft: [] }); },
    cancelInitialization() { return Promise.resolve(); },
    saveReviewDraft(_handle: string, _reviewId: string, expectedRevision: number, draft: any[]) {
      assert.equal(expectedRevision, revision++); savedDrafts.push(structuredClone(draft)); return Promise.resolve(revision);
    },
    acceptManual() { accepted++; return Promise.resolve(idle); },
    acceptReview() { accepted++; return Promise.resolve(idle); },
    acceptExisting() { accepted++; return Promise.resolve(idle); },
    resolveReviewSource() { return Promise.resolve({ uri: 'file:///A/a.ts', path: 'a.ts' }); },
    status() { return statusRequest.promise; },
    hierarchy() { return hierarchy.promise; }, violations() { return violations.promise; },
    relationships() { return relationships.promise; }, evidence() { return evidence.promise; },
    relationshipEdges() { return relationshipEdges.promise; }, resolveSource() { return Promise.resolve({ uri: 'file:///A', path: 'a.ts' }); },
    dispose() { disposed = true; }, get disposed() { return disposed; }
  };
}

test('late attach and query from A cannot render in B; disposal rejects late data', async () => {
  const a = connection();
  const b = connection();
  let count = 0;
  const controller = new SoftwareMapController(() => ++count === 1 ? a : b, () => {});
  const attachingA = controller.attach('file:///A');
  const attachingB = controller.attach('file:///B');
  a.attachPending.resolve({ projectHandle: 'a', status: idle });
  b.attachPending.resolve({ projectHandle: 'b', status: idle });
  await Promise.all([attachingA, attachingB]);
  const loading = controller.analyze();
  b.event(status(1));
  b.hierarchyPending.resolve(page(1, [{ id: 'B', kind: 'system', name: 'B', purpose: 'B', evidenceIds: [] }]));
  b.violationsPending.resolve(page(1, []));
  b.analyzePending.resolve(status(1));
  await loading;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(controller.workspace, 'file:///B');
  assert.deepEqual(controller.nodes.map((node: any) => node.id), ['B']);
  assert.equal(a.disposed, false);
  controller.dispose();
  b.event(status(2));
  assert.deepEqual(controller.nodes.map((node: any) => node.id), ['B']);
  assert.equal(b.disposed, false);
});

test('generation dry run discards a late project response and sanitizes service errors', async () => {
  const a = connection(), b = connection();
  const pending = deferred();
  (a as any).dryRunSynthesis = () => pending.promise;
  (b as any).dryRunSynthesis = () => Promise.reject(new Error('private token'));
  let count = 0;
  const controller = new SoftwareMapController(() => ++count === 1 ? a : b, () => {});
  const first = controller.attach('file:///dry-a');
  a.attachPending.resolve({ projectHandle: 'a', status: idle });
  await first;
  const report = controller.dryRun();
  assert.equal(controller.flow, 'dry-run');
  const second = controller.attach('file:///dry-b');
  b.attachPending.resolve({ projectHandle: 'b', status: idle });
  await second;
  pending.resolve({ inputFingerprint: 'stale', evidence: [], documents: [], diagnostics: [], untested: [] });
  await report;
  assert.equal(controller.dryRunReport, undefined);
  await controller.dryRun();
  assert.doesNotMatch(controller.dryRunError, /private token/);
  assert.equal(controller.flow, 'dry-run');
  controller.returnToSetup();
  assert.equal(controller.flow, 'setup');
  controller.dispose();
});

test('first-use offer, decline, and later Analyze Project do not analyze on attach', async () => {
  const c = connection();
  const controller = new SoftwareMapController(() => c, () => {});
  const attaching = controller.attach('file:///A');
  c.attachPending.resolve({ projectHandle: 'a', status: idle });
  await attaching;
  assert.equal(controller.flow, 'offer');
  assert.equal(c.analyzed, 0);
  controller.decline();
  assert.equal(controller.flow, 'none');
  assert.equal(c.analyzed, 0);
  controller.begin();
  assert.equal(controller.flow, 'offer');
  controller.dispose();
  const reopened = connection();
  const next = new SoftwareMapController(() => reopened, () => {});
  const reattach = next.attach('file:///A'); reopened.attachPending.resolve({ projectHandle: 'a2', status: idle }); await reattach;
  assert.equal(next.flow, 'none');
  next.begin();
  assert.equal(next.flow, 'offer');
  next.dispose();
});

test('reopened failed analysis keeps its run and invokes the retry operation', async () => {
  const c = connection();
  const calls: string[] = [];
  const failed = { state: 'failed', declarationPresent: false, declarationFingerprint: 'absent',
    resumable: { runId: 'run-one', failedStage: 'subsystem-discovery', failedSubject: 'candidate:frontend',
      message: 'Provider request failed.', completed: [{ stage: 'system-discovery', providerKind: 'local', modelLabel: 'old' }] } };
  c.initializationStatus = () => Promise.resolve(failed);
  c.synthesisReady = () => Promise.resolve(true);
  c.retryFailedStage = () => { calls.push('retry'); return Promise.resolve({ reviewId: 'review', packet: { items: [] },
    proposal: { nodes: [], openQuestions: [], unassignedEvidenceRefs: [] }, draft: [] }); };
  c.startInitialization = () => { calls.push('restart'); return Promise.resolve({ reviewId: 'fresh', packet: { items: [] },
    proposal: { nodes: [], openQuestions: [], unassignedEvidenceRefs: [] }, draft: [] }); };
  const controller = new SoftwareMapController(() => c, () => {}, undefined, inventory());
  const attaching = controller.attach('file:///A');
  c.attachPending.resolve({ projectHandle: 'a', status: idle });
  await attaching;
  assert.equal(controller.flow, 'setup');
  assert.equal(controller.initialization.resumable.runId, 'run-one');
  await ready(controller);
  await controller.synthesize(true);
  assert.deepEqual(calls, ['retry']);
  assert.equal(controller.review.reviewId, 'review');
  controller.dispose();
});

test('central target requires a Software Map probe; switching invalidates readiness', async () => {
  const c = connection(), registry = inventory();
  const writes: any[] = [];
  const controller = new SoftwareMapController(() => c, () => {},
    { getData: async () => undefined, setData: async (...args: any[]) => { writes.push(args); } }, registry);
  const attaching = controller.attach('file:///A'); c.attachPending.resolve({ projectHandle: 'a', status: idle }); await attaching;
  await controller.setup();
  controller.selectTarget('local-one', 'Qwen3-Coder-30B-A3B-Instruct');
  assert.equal(controller.setupReady, false);
  await controller.probe();
  assert.equal(controller.setupReady, true);
  assert.deepEqual(c.configurations[0], { connectionId: 'local-one', modelId: 'Qwen3-Coder-30B-A3B-Instruct', contextWindowTokens: 65536 });
  assert.deepEqual(writes, []);
  controller.selectTarget('gemini-one', 'gemini-3.6-flash');
  assert.equal(controller.setupReady, false);
  await controller.probe();
  assert.equal(controller.setupReady, true);
  await controller.synthesize();
  assert.match(controller.error, /Confirm hosted repository-evidence/);
  controller.consentToHostedEvidence();
  await controller.synthesize();
  assert.equal(controller.flow, 'review');
  controller.dispose();
});

test('Software Map role suggests an exact run target; override and active run stay exact', async () => {
  const c = connection(), registry = roleInventory();
  let roleTarget = 'gemini-one';
  const roles = { list: () => smapRoles(roleTarget).list() };
  const controller = new SoftwareMapController(() => c, () => {}, undefined, registry, undefined, roles);
  const attaching = controller.attach('file:///A'); c.attachPending.resolve({ projectHandle: 'a', status: idle }); await attaching;
  await controller.setup();
  assert.equal(controller.connectionId, 'gemini-one');
  assert.equal(controller.modelId, 'gemini-3.6-flash');
  assert.equal(controller.roleSuggested, true);
  assert.equal(controller.setupReady, false);
  await controller.probe();
  await controller.synthesize();
  assert.match(controller.error, /Confirm hosted repository-evidence/);
  roleTarget = 'local-one';
  await controller.setup();
  assert.equal(controller.connectionId, 'gemini-one');
  controller.selectTarget('local-one', 'Qwen3-Coder-30B-A3B-Instruct');
  assert.equal(controller.roleSuggested, false);
  await controller.probe();
  roleTarget = 'gemini-one';
  const run = controller.synthesize();
  assert.equal(controller.initialization.state, 'analyzing');
  controller.selectTarget('gemini-one', 'gemini-3.6-flash');
  assert.equal(controller.connectionId, 'local-one');
  await run;
  assert.deepEqual(c.configurations.map((item: any) => item.connectionId), ['gemini-one', 'local-one']);
  await controller.setup(true);
  assert.equal(controller.connectionId, 'local-one');
  controller.dispose();
});

test('Search Deeper setup takes the Software Map role suggestion when no exact target exists', async () => {
  const c = connection(), registry = roleInventory();
  const controller = new SoftwareMapController(() => c, () => {}, undefined, registry, undefined,
    smapRoles('local-one'));
  const attaching = controller.attach('file:///A'); c.attachPending.resolve({ projectHandle: 'a', status: idle }); await attaching;
  await controller.setup(true);
  assert.equal(controller.connectionId, 'local-one');
  assert.equal(controller.contextWindowTokens, 65536);
  assert.equal(controller.roleSuggested, true);
  await controller.probe();
  assert.deepEqual(c.configurations.at(-1), { connectionId: 'local-one',
    modelId: 'Qwen3-Coder-30B-A3B-Instruct', contextWindowTokens: 65536 });
  controller.dispose();
});

test('Software Map probe failure stays on the suggested exact target despite role fallback', async () => {
  const c = connection(), registry = roleInventory();
  const roles = smapRoles('local-one');
  const snapshot = await roles.list();
  const softwareMap: any = snapshot.policies.find((item: any) => item.roleId === 'software-map');
  softwareMap.allowFallback = true;
  softwareMap.fallbacks = [{ type: 'exact', target: { connectionId: 'gemini-one', modelId: 'gemini-3.6-flash' } }];
  (c as any).probeSynthesis = () => Promise.reject(new Error('structured output failed'));
  const controller = new SoftwareMapController(() => c, () => {}, undefined, registry, undefined,
    { list: async () => snapshot });
  const attaching = controller.attach('file:///A'); c.attachPending.resolve({ projectHandle: 'a', status: idle }); await attaching;
  await controller.setup();
  await controller.probe();
  assert.equal(controller.connectionId, 'local-one');
  assert.equal(controller.setupReady, false);
  assert.deepEqual(c.configurations.map((item: any) => item.connectionId), ['local-one']);
  controller.dispose();
});

test('Software Map does not suggest an agent-only Codex target', async () => {
  const c = connection(), registry = roleInventory();
  registry.state.registry.connections.push({ version: 1, id: 'codex-one', alias: 'Codex', lifecycle: 'enabled',
    config: { type: 'codex', runtime: 'app-server' } } as any);
  registry.state.registry.models.push({ version: 1, connectionId: 'codex-one', providerModelKey: 'agent',
    label: 'Agent', locality: 'hosted', enabled: true, state: 'ready', capabilities: {
      conversationalText: { source: 'unknown' }, streaming: { source: 'unknown' },
      structuredOutput: { source: 'unknown' }, toolCalling: { source: 'unknown' },
      agentExecution: { source: 'adapter-known', value: true } }, limits: {
      contextWindowTokens: { source: 'unknown' }, maxInputTokens: { source: 'unknown' },
      maxOutputTokens: { source: 'unknown' } } } as any);
  registry.state.observations.push({ connectionId: 'codex-one', health: 'ready' } as any);
  const roles = smapRoles('local-one');
  const snapshot = await roles.list();
  const softwareMap: any = snapshot.policies.find((item: any) => item.roleId === 'software-map');
  softwareMap.preferred = { type: 'exact', target: { connectionId: 'codex-one', modelId: 'agent' } };
  softwareMap.allowFallback = true;
  softwareMap.fallbacks = [{ type: 'exact', target: { connectionId: 'local-one',
    modelId: 'Qwen3-Coder-30B-A3B-Instruct' } }];
  const controller = new SoftwareMapController(() => c, () => {}, undefined, registry, undefined,
    { list: async () => snapshot });
  const attaching = controller.attach('file:///A'); c.attachPending.resolve({ projectHandle: 'a', status: idle }); await attaching;
  await controller.setup();
  assert.equal(controller.connectionId, 'local-one');
  controller.selectTarget('codex-one', 'agent');
  await controller.probe();
  assert.equal(controller.setupReady, false);
  assert.equal(c.configured, 0);
  controller.dispose();
});

test('generic connection test and missing target never authorize synthesis', async () => {
  const c = connection(), registry = inventory();
  registry.state.tests.push({ connectionId: 'local-one', modelId: 'Qwen3-Coder-30B-A3B-Instruct' } as any);
  const controller = new SoftwareMapController(() => c, () => {}, undefined, registry);
  const attaching = controller.attach('file:///A'); c.attachPending.resolve({ projectHandle: 'a', status: idle }); await attaching;
  await controller.setup();
  controller.selectTarget('local-one', 'Qwen3-Coder-30B-A3B-Instruct');
  await controller.synthesize();
  assert.equal(c.configured, 0);
  await controller.probe();
  assert.equal(controller.setupReady, true);
  controller.credentialChanged('local-one');
  assert.equal(controller.setupReady, false);
  await controller.probe();
  registry.state.registry.models.splice(0, 1);
  await controller.refreshInventory();
  assert.equal(controller.setupReady, false);
  assert.equal(controller.selectedModel(), undefined);
  await controller.synthesize();
  assert.equal(c.analyzed, 0);
  controller.dispose();
});

test('missing-target repair opens AI Center and retains a return to synthesis setup', () => {
  const widget = readFileSync(new URL('../../packages/theia-extension/src/browser/software-map-widget.ts', import.meta.url), 'utf8');
  const center = readFileSync(new URL('../../packages/theia-extension/src/browser/ai-center-contribution.ts', import.meta.url), 'utf8');
  const wiring = readFileSync(new URL('../../packages/theia-extension/src/browser/frontend-module.ts', import.meta.url), 'utf8');
  assert.match(widget, /Selected target is missing\. Use AI Center to repair it/);
  assert.match(widget, /Manage connections in AI Center/);
  assert.match(wiring, /openFromSoftwareMap\(\)/);
  assert.match(center, /Return to synthesis setup/);
});

test('hosted evidence consent never carries into another project or target setup', async () => {
  const a = connection(), b = connection(), registry = inventory();
  let count = 0;
  const controller = new SoftwareMapController(() => ++count === 1 ? a : b, () => {}, undefined, registry);
  const attachA = controller.attach('file:///A'); a.attachPending.resolve({ projectHandle: 'a', status: idle }); await attachA;
  await ready(controller, 'gemini');
  assert.equal(controller.hostedConsentGranted(), true);
  const attachB = controller.attach('file:///B'); b.attachPending.resolve({ projectHandle: 'b', status: idle }); await attachB;
  await controller.refreshInventory();
  controller.selectTarget('gemini-one', 'gemini-3.6-flash');
  await controller.probe();
  assert.equal(controller.hostedConsentGranted(), false);
  controller.consentToHostedEvidence();
  assert.equal(controller.hostedConsentGranted(), true);
  controller.selectTarget('local-one', 'Qwen3-Coder-30B-A3B-Instruct');
  controller.selectTarget('gemini-one', 'gemini-3.6-flash');
  await controller.probe();
  assert.equal(controller.hostedConsentGranted(), false);
  controller.dispose();
});

test('failed-stage retry requires a fresh probe of the exact selected model', async () => {
  const c = connection(), registry = inventory();
  const saved = { state: 'failed', declarationPresent: false, declarationFingerprint: 'absent', resumable: {
    runId: 'saved', failedStage: 'subsystem-discovery', message: 'Provider failed', completed: [] } };
  c.initializationStatus = () => Promise.resolve(saved);
  let retries = 0;
  c.retryFailedStage = () => { retries++; return Promise.resolve({ reviewId: 'recovered', packet: { items: [] },
    proposal: { nodes: [], openQuestions: [], unassignedEvidenceRefs: [] }, draft: [] }); };
  const controller = new SoftwareMapController(() => c, () => {}, undefined, registry);
  const attaching = controller.attach('file:///A'); c.attachPending.resolve({ projectHandle: 'a', status: idle }); await attaching;
  await ready(controller, 'gemini');
  controller.selectTarget('gemini-one', 'gemini-3.8-flash');
  await controller.synthesize(true); assert.equal(retries, 0);
  await controller.probe(); controller.consentToHostedEvidence();
  await controller.synthesize(true); assert.equal(retries, 1);
  assert.equal(controller.review.reviewId, 'recovered');
  controller.dispose();
});

test('progress keeps text labels and theme tokens, with terminal heading from run state', () => {
  const widget = readFileSync(new URL('../../packages/theia-extension/src/browser/software-map-widget.ts', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../../packages/theia-extension/src/browser/dope.css', import.meta.url), 'utf8');
  assert.match(widget, /runState === 'failed' \? 'Analysis failed'/);
  assert.match(widget, /Retry failed stage with selected target/);
  assert.match(widget, /`\$\{state\}: \$\{item\.title\}`/);
  for (const state of ['complete', 'current', 'queued', 'failed'])
    assert.match(css, new RegExp(`dope-smap-stage-${state}`));
  assert.match(css, /var\(--theia-testing-iconPassed/);
  assert.match(css, /var\(--theia-testing-iconFailed/);
  assert.doesNotMatch(widget.slice(widget.indexOf('private renderProgress()'), widget.indexOf('private renderReview()')), /\.error/);
});

test('legacy safe preference converges onto an exact AI Center model without copying secrets', async () => {
  const c = connection(), registry = inventory();
  registry.state.registry.connections[1].id = 'dope-smap-legacy-gemini';
  registry.state.registry.models.filter(item => item.connectionId === 'gemini-one').forEach(item => { item.connectionId = 'dope-smap-legacy-gemini'; });
  const writes: any[] = [];
  const credentials = { reuseSoftwareMapGemini: async (id: string) => { assert.equal(id, 'dope-smap-legacy-gemini'); return true; },
    status: async () => ({ sources: [{ source: 'secure', status: 'available' }] }),
    retireSoftwareMapGemini: async (id: string) => { assert.equal(id, 'dope-smap-legacy-gemini'); } };
  const controller = new SoftwareMapController(() => c, () => {}, {
    getData: async () => ({ kind: 'gemini', endpoint: '', model: '', geminiModel: 'gemini-3.8-flash' }),
    setData: async (...args: any[]) => { writes.push(args); }
  }, registry, credentials);
  const attaching = controller.attach('file:///A'); c.attachPending.resolve({ projectHandle: 'a', status: idle }); await attaching;
  await controller.setup();
  assert.equal(controller.connectionId, 'dope-smap-legacy-gemini'); assert.equal(controller.modelId, 'gemini-3.8-flash');
  assert.equal(controller.setupReady, false);
  assert.deepEqual(writes, [['dope.smap.synthesis', undefined]]);
  assert.equal(JSON.stringify(registry.state).includes('secret'), false);
  controller.dispose();
});

test('unmatched safe Local preference creates one central connection, then retires feature preference', async () => {
  const c = connection(), registry = inventory();
  const writes: any[] = [], mutations: any[] = [];
  registry.mutate = async (request: any) => {
    mutations.push(request);
    registry.state.registry.connections.push(request.mutation.connection);
    registry.state.registry.revision++;
    return registry.state.registry;
  };
  registry.refreshModels = async (id: string) => {
    registry.state.registry.models.push({ ...registry.state.registry.models[0],
      connectionId: id, providerModelKey: 'migrated-model', label: 'Migrated' });
    return registry.state;
  };
  const controller = new SoftwareMapController(() => c, () => {}, {
    getData: async () => ({ kind: 'local', endpoint: 'http://127.0.0.1:4321/v1', model: 'migrated-model' }),
    setData: async (...args: any[]) => { writes.push(args); }
  }, registry);
  const attaching = controller.attach('file:///A'); c.attachPending.resolve({ projectHandle: 'a', status: idle }); await attaching;
  await controller.setup();
  assert.equal(mutations.length, 1);
  assert.equal(mutations[0].mutation.connection.id, 'dope-smap-legacy-local');
  assert.equal(controller.connectionId, 'dope-smap-legacy-local');
  assert.equal(controller.modelId, 'migrated-model');
  assert.deepEqual(writes, [['dope.smap.synthesis', undefined]]);
  assert.equal(controller.setupReady, false);
  controller.dispose();
});

test('missing inventory fails closed and preserves the selected target for repair', async () => {
  const c = connection(), registry = inventory();
  const controller = new SoftwareMapController(() => c, () => {}, undefined, registry);
  const attaching = controller.attach('file:///A'); c.attachPending.resolve({ projectHandle: 'a', status: idle }); await attaching;
  await ready(controller);
  registry.inventory = async () => { throw new Error('secret transport failure'); };
  await controller.refreshInventory();
  assert.equal(controller.setupReady, false);
  assert.equal(controller.connectionId, 'local-one');
  assert.match(controller.error, /AI Center inventory is unavailable/);
  assert.doesNotMatch(controller.error, /secret/);
  controller.dispose();
});

test('draft validation, manual cancellation and existing acceptance are explicit', async () => {
  const c = connection();
  c.initializationStatus = () => Promise.resolve({ state: 'uninitialized', declarationPresent: true, declarationFingerprint: 'existing' });
  const controller = new SoftwareMapController(() => c, () => {});
  const attaching = controller.attach('file:///A'); c.attachPending.resolve({ projectHandle: 'a', status: idle }); await attaching;
  controller.manual();
  assert.match(controller.draftError(), /Invalid architecture/);
  const system = controller.draft[0];
  Object.assign(system, { id: 'app', name: 'App', purpose: 'Purpose' });
  controller.add('subsystem', system.proposalKey);
  Object.assign(controller.draft[1], { id: 'core', name: 'Core', purpose: 'Purpose', roots: ['src'] });
  assert.equal(controller.draftError(), undefined);
  assert.equal(declarationFromDraft(controller.draft).systems[0].subsystems[0].id, 'core');
  controller.draft[0].roots = ['src'];
  assert.deepEqual(controller.draftDiagnostics().find((issue: any) => issue.code === 'ambiguous_root')?.proposalKeys,
    [controller.draft[0].proposalKey, controller.draft[1].proposalKey].sort());
  assert.match(controller.draftError(), /ambiguous_root|Ownership root/);
  controller.draft[0].roots = [];
  await controller.cancel();
  assert.equal(c.accepted, 0);
  await controller.useExisting();
  assert.equal(c.accepted, 1);
  assert.equal(controller.initialization.state, 'initialized');
  controller.dispose();
});

test('stale model discovery and proposal cannot render into a new project', async () => {
  const a = connection(), b = connection();
  const discovery = deferred(), proposal = deferred();
  const registry = inventory(); registry.inventory = () => discovery.promise;
  a.startInitialization = () => proposal.promise;
  let count = 0;
  const controller = new SoftwareMapController(() => ++count === 1 ? a : b, () => {}, undefined, registry);
  const attachingA = controller.attach('file:///A'); a.attachPending.resolve({ projectHandle: 'a', status: idle }); await attachingA;
  const setup = controller.setup();
  const attachingB = controller.attach('file:///B'); b.attachPending.resolve({ projectHandle: 'b', status: idle }); await attachingB;
  discovery.resolve(registry.state); await setup;
  assert.equal(controller.workspace, 'file:///B');
  assert.equal(controller.setupBusy, false);
  const attachingA2 = controller.attach('file:///A'); a.attachPending.resolve({ projectHandle: 'a', status: idle }); await attachingA2;
  await ready(controller);
  const synthesis = controller.synthesize();
  const attachingB2 = controller.attach('file:///B'); b.attachPending.resolve({ projectHandle: 'b', status: idle }); await attachingB2;
  proposal.resolve({ reviewId: 'stale', draft: [] }); await synthesis;
  assert.equal(controller.review, undefined);
  assert.equal(controller.workspace, 'file:///B');
  controller.dispose();
});

test('controller accepts only current project progress and measures review delivery from Analyze invocation', async () => {
  const a = connection(), b = connection();
  const pending = deferred();
  a.startInitialization = () => pending.promise;
  let count = 0;
  const controller = new SoftwareMapController(() => ++count === 1 ? a : b, () => {}, undefined, inventory());
  const attachA = controller.attach('file:///A'); a.attachPending.resolve({ projectHandle: 'a', status: idle }); await attachA;
  await ready(controller);
  const analysis = controller.synthesize();
  const event = { stage: 'subsystem-discovery', status: 'started', elapsedMs: 10, stageElapsedMs: 2,
    message: 'Discovering Subsystems', subject: 'App', completedUnits: 0, totalUnits: 2 };
  a.progress('wrong', event);
  assert.equal(controller.progressEvents.length, 0);
  a.progress('a', event);
  assert.equal(controller.progressEvents.length, 1);
  assert.ok(controller.analysisElapsedMs() >= 10);
  const attachB = controller.attach('file:///B'); b.attachPending.resolve({ projectHandle: 'b', status: idle }); await attachB;
  a.progress('a', { ...event, message: 'raw prompt: hidden chain-of-thought' });
  pending.resolve({ reviewId: 'stale', draft: [] }); await analysis;
  assert.equal(controller.progressEvents.length, 0);
  assert.equal(controller.review, undefined);
  controller.dispose();
});

test('setup/probe failures keep recovery controls usable and do not mark readiness', async () => {
  const c = connection();
  c.configureSynthesis = () => Promise.reject(new Error('runtime offline'));
  const controller = new SoftwareMapController(() => c, () => {}, undefined, inventory());
  const attaching = controller.attach('file:///A'); c.attachPending.resolve({ projectHandle: 'a', status: idle }); await attaching;
  await controller.setup();
  controller.selectTarget('local-one', 'Qwen3-Coder-30B-A3B-Instruct');
  await controller.probe();
  assert.match(controller.error, /runtime offline/);
  assert.equal(controller.setupBusy, false);
  c.configureSynthesis = () => Promise.resolve({ models: ['Qwen3-Coder-30B-A3B-Instruct'] });
  c.probeSynthesis = () => Promise.reject(new Error('structured output unsupported'));
  await controller.probe();
  assert.match(controller.error, /structured output unsupported/);
  assert.equal(controller.setupReady, false);
  c.probeSynthesis = () => Promise.resolve();
  await controller.probe();
  assert.equal(controller.setupReady, true);
  c.startInitialization = () => Promise.reject(new Error('warm-up failed'));
  await controller.synthesize();
  assert.match(controller.error, /warm-up failed/);
  assert.equal(controller.setupReady, false);
  assert.equal(controller.initialization.state, 'uninitialized');
  controller.dispose();
});

test('retry retains a successful probe when analysis fails without provider readiness loss', async () => {
  const c = connection();
  c.synthesisReady = () => Promise.resolve(true);
  c.startInitialization = () => Promise.reject(new Error('proposal validation failed'));
  const controller = new SoftwareMapController(() => c, () => {}, undefined, inventory());
  const attaching = controller.attach('file:///A'); c.attachPending.resolve({ projectHandle: 'a', status: idle }); await attaching;
  await ready(controller);
  await controller.synthesize();
  assert.equal(controller.setupReady, true);
  assert.match(controller.error, /proposal validation failed/);
  assert.equal(controller.initialization.state, 'uninitialized');
  controller.dispose();
});

test('late review-source failure cannot report into another root', async () => {
  const c = connection();
  const pending = deferred();
  c.resolveReviewSource = () => pending.promise;
  const controller = new SoftwareMapController(() => c, () => {});
  const first = controller.attach('file:///A'); c.attachPending.resolve({ projectHandle: 'a', status: idle }); await first;
  controller.review = { reviewId: 'r', draft: [], packet: { items: [] }, proposal: { nodes: [] } };
  controller.flow = 'review';
  const source = controller.reviewSource('fact');
  const second = controller.attach('file:///B'); c.attachPending.resolve({ projectHandle: 'b', status: idle }); await second;
  pending.resolve({ uri: 'file:///A/a.ts', path: 'a.ts' });
  assert.equal(await source, undefined);
  assert.equal(controller.workspace, 'file:///B');
  controller.dispose();
});

test('failed cancel keeps review available for retry', async () => {
  const c = connection();
  c.cancelInitialization = () => Promise.reject(new Error('connection failed'));
  const controller = new SoftwareMapController(() => c, () => {});
  const attaching = controller.attach('file:///A'); c.attachPending.resolve({ projectHandle: 'a', status: idle }); await attaching;
  controller.review = { reviewId: 'r', draft: [], packet: { items: [] }, proposal: { nodes: [] } };
  controller.flow = 'review';
  await controller.cancel();
  assert.equal(controller.flow, 'review');
  assert.match(controller.error, /connection failed/);
  c.cancelInitialization = () => Promise.resolve();
  await controller.cancel();
  assert.equal(controller.flow, 'none');
  assert.equal(controller.review, undefined);
  controller.dispose();
});

test('review and initialized editing share one center widget with focused detail and explicit accept/save', () => {
  const sidebar = readFileSync(new URL('../../packages/theia-extension/src/browser/software-map-widget.ts', import.meta.url), 'utf8');
  const editor = readFileSync(new URL('../../packages/theia-extension/src/browser/software-map-review-widget.ts', import.meta.url), 'utf8');
  const wiring = readFileSync(new URL('../../packages/theia-extension/src/browser/frontend-module.ts', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../../packages/theia-extension/src/browser/dope.css', import.meta.url), 'utf8');
  assert.match(sidebar, /this\.button\('Edit Architecture', \(\) => void this\.openReview\(\)\)/);
  assert.doesNotMatch(sidebar.slice(sidebar.indexOf('private renderReview()'), sidebar.indexOf('private renderDraft(')), /fieldset|renderPacketFact/);
  assert.match(wiring, /bind\(SoftwareMapController\).*inSingletonScope\(\)/s);
  assert.match(wiring, /area: 'main'/);
  assert.match(editor, /this\.acceptedDraft \?\? this\.controller\.draft/);
  assert.match(editor, /list\(node\.proposalKey\)/);
  assert.match(editor, /aria-current/);
  assert.match(editor, /find\(node => node\.proposalKey === this\.selectedKey\)/);
  assert.match(editor, /this\.renderDetail\(selected, detail\)/);
  assert.match(editor, /reviewSource\(ref\)/);
  assert.match(editor, /Accept Architecture/);
  assert.match(editor, /Save Architecture/);
  assert.match(editor, /reviewDiagnostics\(draft\)/);
  assert.match(editor, /'Acceptance' : 'Save'/);
  assert.match(editor, /node\.kind !== 'component'[\s\S]*Search Deeper/);
  for (const label of ['Observed', 'Documented', 'Inferred', 'Accept refinement', 'Reject refinement']) assert.match(editor, new RegExp(label));
  assert.match(editor, /reviewDocument\(path\)/);
  assert.match(editor, /Advanced: canonical ID, implementation roots and dependencies/);
  assert.match(css, /dope-smap-review-layout/);
  assert.match(css, /var\(--theia-list-activeSelectionBackground\)/);
});

test('accepted Architecture read/save uses its canonical fingerprint and keeps selection local', async () => {
  const c = connection();
  (c as any).initializationStatus = () => Promise.resolve({ state: 'initialized', declarationPresent: true, declarationFingerprint: 'basis' });
  const declaration = { schemaVersion: 1, systems: [{ id: 'sys', name: 'System', purpose: 'System', subsystems: [
    { id: 'sub', name: 'Subsystem', purpose: 'Subsystem', roots: ['src/sub'], allowedDependencies: ['peer'], forbiddenDependencies: [], components: [] },
    { id: 'peer', name: 'Peer', purpose: 'Peer', roots: ['src/peer'], components: [] },
  ] }] };
  let saved: any;
  (c as any).readArchitecture = () => Promise.resolve({ declaration, declarationFingerprint: 'basis' });
  (c as any).saveArchitecture = (handle: string, fingerprint: string, full: any) => {
    saved = { handle, fingerprint, full };
    return Promise.resolve({ committed: true, declarationFingerprint: 'next', status: idle });
  };
  const controller = new SoftwareMapController(() => c, () => {});
  const attached = controller.attach('file:///A'); c.attachPending.resolve({ projectHandle: 'a', status: idle }); await attached;
  const current = await controller.readCurrentArchitecture();
  const { architectureDraft } = require('../../packages/software-map/lib/review-diagnostics.js');
  const draft = architectureDraft(current.declaration);
  assert.deepEqual(draft.find((node: any) => node.id === 'sub').allowedDependencies, ['peer']);
  draft[0].name = 'Edited System';
  controller.selectedId = 'map-only';
  assert.equal(saved, undefined);
  await controller.saveCurrentArchitecture(current.declarationFingerprint, declarationFromDraft(draft));
  assert.equal(saved.handle, 'a');
  assert.equal(saved.fingerprint, 'basis');
  assert.equal(saved.full.systems[0].name, 'Edited System');
  assert.deepEqual(saved.full.systems[0].subsystems.find((subsystem: any) => subsystem.id === 'sub').allowedDependencies, ['peer']);
  assert.equal(controller.selectedId, 'map-only');
  assert.equal(controller.initialization.declarationFingerprint, 'next');
  controller.dispose();
});

test('workspace switches reject late accepted Architecture reads and saves', async () => {
  const a = connection(), b = connection();
  const pendingRead = deferred(), pendingSave = deferred();
  (a as any).initializationStatus = (b as any).initializationStatus = () => Promise.resolve({ state: 'initialized', declarationPresent: true, declarationFingerprint: 'basis' });
  (a as any).readArchitecture = () => pendingRead.promise;
  (a as any).saveArchitecture = () => pendingSave.promise;
  let count = 0;
  const controller = new SoftwareMapController(() => ++count === 1 ? a : b, () => {});
  const attachingA = controller.attach('file:///A'); a.attachPending.resolve({ projectHandle: 'a', status: idle }); await attachingA;
  const reading = controller.readCurrentArchitecture();
  const saving = controller.saveCurrentArchitecture('basis', { schemaVersion: 1, systems: [] });
  const attachingB = controller.attach('file:///B'); b.attachPending.resolve({ projectHandle: 'b', status: idle }); await attachingB;
  pendingRead.resolve({ declaration: { schemaVersion: 1, systems: [] }, declarationFingerprint: 'old' });
  pendingSave.resolve({ committed: true, declarationFingerprint: 'old', status: idle });
  await assert.rejects(reading, /Workspace changed/);
  await assert.rejects(saving, /Workspace changed/);
  assert.equal(controller.workspace, 'file:///B');
  assert.notEqual(controller.initialization.declarationFingerprint, 'old');
  controller.dispose();
});

test('Edit Architecture remains one widget with an in-memory accepted draft and no map selection coupling', () => {
  const sidebar = readFileSync(new URL('../../packages/theia-extension/src/browser/software-map-widget.ts', import.meta.url), 'utf8');
  const editor = readFileSync(new URL('../../packages/theia-extension/src/browser/software-map-review-widget.ts', import.meta.url), 'utf8');
  const wiring = readFileSync(new URL('../../packages/theia-extension/src/browser/frontend-module.ts', import.meta.url), 'utf8');
  assert.match(wiring, /getOrCreateWidget<SoftwareMapReviewWidget>\(SOFTWARE_MAP_REVIEW_ID\)/);
  assert.equal(wiring.match(/id: SOFTWARE_MAP_REVIEW_ID, createWidget/g)?.length, 1);
  assert.match(sidebar, /this\.button\('EDIT ARCHITECTURE', \(\) => void this\.openReview\(\)\)/);
  assert.match(sidebar, /if \(id && id !== this\.openedReviewId\).*this\.openReview\(\)/);
  assert.match(editor, /this\.title\.label = this\.title\.caption = 'Edit Architecture'/);
  assert.match(editor, /private acceptedDraft\?: ArchitectureReviewNode\[\]/);
  assert.match(editor, /architectureDraft\(current\.declaration\)/);
  assert.match(editor, /this\.controller\.saveCurrentArchitecture\(expectedFingerprint, declarationFromDraft\(draft\)\)/);
  assert.match(editor, /this\.acceptedBaseline = JSON\.stringify\(draft\)/);
  assert.match(editor, /accept\.disabled = !!issues\.length \|\| \(pending \? this\.controller\.setupBusy : this\.acceptedBusy/);
  assert.match(editor, /this\.selectedKey = node\.proposalKey; this\.render\(\)/);
  assert.match(editor, /this\.node\.scrollTop = scrollTop/);
  assert.match(editor, /this\.clearAccepted\(\);/);
  assert.match(editor, /Allowed' : 'Forbidden'/);
  assert.match(editor, /if \(node\.kind !== 'component'\)/);
  assert.match(editor, /Search Deeper provider setup/);
  assert.match(editor, /this\.controller\.setup\(true\)/);
  assert.match(editor, /this\.controller\.searchDeeper\(node\.proposalKey, \{ draft, fingerprint/);
  assert.match(editor, /this\.controller\.acceptRefinement\(this\.acceptedDraft\)/);
  assert.match(editor, /input\.type = 'password'/);
  assert.doesNotMatch(editor, /selectedId|saveReviewDraft|\.dope\//);
  assert.doesNotMatch(editor, /setData|localStorage|sessionStorage/);
  assert.doesNotMatch(editor, /sMap Architecture Review|Proposed hierarchy|Edit Hierarchy/);
});

test('Search Deeper previews current edits, preserves siblings, rejects stale and switches roots safely', async () => {
  const c = connection();
  const pending = deferred();
  let sent: any;
  c.searchDeeper = (_handle: string, input: any) => { sent = input; return pending.promise; };
  const controller = new SoftwareMapController(() => c, () => {});
  const attached = controller.attach('file:///A'); c.attachPending.resolve({ projectHandle: 'a', status: idle }); await attached;
  controller.review = { reviewId: 'r', packet: { items: [] }, proposal: { nodes: [] }, draft: [] };
  controller.flow = 'review'; controller.initialization = { state: 'review_required', declarationFingerprint: 'absent', declarationPresent: false };
  controller.draft = [
    { proposalKey: 'proposal:a', kind: 'system', parentProposalKey: null, id: 'a', name: 'Edited A', purpose: 'A', roots: ['src/a'] },
    { proposalKey: 'proposal:b', kind: 'system', parentProposalKey: null, id: 'b', name: 'B', purpose: 'B', roots: ['src/b'] },
    { proposalKey: 'proposal:s', kind: 'subsystem', parentProposalKey: 'proposal:a', id: 's', name: 'Manual S', purpose: 'S', roots: [] },
    { proposalKey: 'draft:1', kind: 'component', parentProposalKey: 'proposal:s', id: 'c', name: 'Manual C', purpose: 'C', roots: [] },
  ];
  const original = structuredClone(controller.draft);
  const search = controller.searchDeeper('proposal:a');
  assert.deepEqual(sent.branch.map((node: any) => node.name), ['Edited A', 'Manual S', 'Manual C']);
  const proposal = { nodes: [
    { proposalKey: 'proposal:new-a', kind: 'system', parentProposalKey: null, name: 'Refined A', purpose: 'A', evidenceRefs: [] },
    { proposalKey: 'proposal:new-s', kind: 'subsystem', parentProposalKey: 'proposal:new-a', name: 'Refined S', purpose: 'S', evidenceRefs: [] },
  ] };
  pending.resolve({ ...sent, parentPacketFingerprint: 'packet', proposal }); await search;
  assert.deepEqual(controller.draft, original);
  assert.equal(c.savedDrafts.length, 0);
  controller.rejectRefinement(); assert.deepEqual(controller.draft, original);
  c.searchDeeper = (_handle: string, input: any) => Promise.resolve({ ...input, parentPacketFingerprint: 'packet', proposal });
  await controller.searchDeeper('proposal:a'); controller.acceptRefinement();
  assert.equal(controller.draft.find((node: any) => node.proposalKey === 'proposal:b').name, 'B');
  assert.equal(controller.draft.some((node: any) => node.name === 'Manual C'), false);
  assert.equal(controller.draft.some((node: any) => node.name === 'Refined S'), true);
  assert.ok(controller.refinedEvidence.size === 2);
  assert.equal(c.accepted, 0);
  const stale = deferred(); c.searchDeeper = (_handle: string, input: any) => { sent = input; return stale.promise; };
  const inFlight = controller.searchDeeper('proposal:b');
  controller.draft.find((node: any) => node.proposalKey === 'proposal:b').name = 'Changed B'; controller.draftChanged();
  stale.resolve({ ...sent, proposal }); await inFlight;
  assert.equal(controller.refinementPreview, undefined);
  assert.match(controller.refinementError.message, /changed/);
  c.searchDeeper = (_handle: string, input: any) => Promise.resolve({ ...input, proposal });
  await controller.searchDeeper('proposal:b');
  assert.ok(controller.refinementPreview);
  const switchedCall = deferred();
  c.searchDeeper = (_handle: string, input: any) => { sent = input; return switchedCall.promise; };
  const inFlightSwitch = controller.searchDeeper('proposal:b');
  const switched = controller.attach('file:///B'); c.attachPending.resolve({ projectHandle: 'b', status: idle }); await switched;
  assert.equal(c.savedDrafts.at(-1).find((node: any) => node.proposalKey === 'proposal:b').name, 'Changed B');
  assert.equal(c.savedDrafts.at(-1).some((node: any) => node.name === 'Refined S'), true);
  switchedCall.resolve({ ...sent, proposal }); await inFlightSwitch;
  assert.equal(controller.refinementPreview, undefined);
  assert.equal(controller.refinementBusyKey, undefined);
  controller.dispose();
});

test('review edits coalesce and flush before acceptance and disposal', async () => {
  const c = connection();
  const controller = new SoftwareMapController(() => c, () => {});
  const attached = controller.attach('file:///A'); c.attachPending.resolve({ projectHandle: 'a', status: idle }); await attached;
  controller.review = { reviewId: 'r', revision: 0, packet: { items: [] }, proposal: { nodes: [] }, draft: [] };
  controller.flow = 'review';
  controller.initialization = { state: 'review_required', declarationFingerprint: 'absent', declarationPresent: false };
  controller.add('system');
  const node = controller.draft[0];
  node.id = 'app'; node.name = 'App'; node.purpose = 'First'; controller.draftChanged();
  controller.add('subsystem', node.proposalKey);
  const subsystem = controller.draft[1];
  subsystem.id = 'core'; subsystem.name = 'Core'; subsystem.purpose = 'Core'; subsystem.roots = ['src']; controller.draftChanged();
  node.purpose = 'Latest'; controller.draftChanged();
  assert.equal(c.savedDrafts.length, 0);
  await controller.accept();
  assert.equal(c.savedDrafts.length, 1);
  assert.equal(c.savedDrafts[0][0].purpose, 'Latest');
  assert.equal(c.accepted, 1);
  controller.dispose();

  const d = connection();
  const reopened = new SoftwareMapController(() => d, () => {});
  const attaching = reopened.attach('file:///B'); d.attachPending.resolve({ projectHandle: 'b', status: idle }); await attaching;
  reopened.review = { reviewId: 'r', revision: 0, packet: { items: [] }, proposal: { nodes: [] }, draft: [] };
  reopened.flow = 'review';
  reopened.add('system');
  reopened.draft[0].name = 'Last edit'; reopened.draftChanged();
  reopened.dispose();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(d.savedDrafts.at(-1)[0].name, 'Last edit');
});

test('accepted Search Deeper suggestions avoid sibling IDs and leave a valid full draft', async () => {
  const c = connection();
  const controller = new SoftwareMapController(() => c, () => {});
  const attached = controller.attach('file:///A'); c.attachPending.resolve({ projectHandle: 'a', status: idle }); await attached;
  controller.review = { reviewId: 'r', packet: { items: [
    { id: 'sub-root', kind: 'semantic', path: 'src/new-sub' },
    { id: 'component-root', kind: 'semantic', path: 'src/new-component' },
  ] }, proposal: { nodes: [] }, draft: [] };
  controller.flow = 'review';
  controller.draft = [
    { proposalKey: 'old', kind: 'system', parentProposalKey: null, id: 'old', name: 'Old', purpose: 'Old', roots: [] },
    { proposalKey: 'old-sub', kind: 'subsystem', parentProposalKey: 'old', id: 'old-sub', name: 'Old Sub', purpose: 'Old', roots: ['src/old'] },
    { proposalKey: 'sibling', kind: 'system', parentProposalKey: null, id: 'b', name: 'Sibling', purpose: 'Sibling', roots: [] },
    { proposalKey: 'sibling-sub', kind: 'subsystem', parentProposalKey: 'sibling', id: 'custom_ID', name: 'Sibling Sub', purpose: 'Sibling', roots: ['src/sibling'] },
  ];
  c.searchDeeper = (_handle: string, input: any) => Promise.resolve({ ...input, proposal: { nodes: [
    { proposalKey: 'new', kind: 'system', parentProposalKey: null, name: 'B', purpose: 'New', evidenceRefs: [] },
    { proposalKey: 'new-sub', kind: 'subsystem', parentProposalKey: 'new', name: '3D Renderer', purpose: 'New Sub', evidenceRefs: ['sub-root'] },
    { proposalKey: 'new-component', kind: 'component', parentProposalKey: 'new-sub', name: '3D Renderer', purpose: 'New Component', evidenceRefs: ['component-root'] },
  ] } });
  await controller.searchDeeper('old'); controller.acceptRefinement();
  assert.deepEqual(controller.draft.filter((node: any) => node.proposalKey === 'sibling' || node.proposalKey === 'sibling-sub')
    .map((node: any) => node.id), ['b', 'custom_ID']);
  assert.deepEqual(controller.draft.filter((node: any) => node.proposalKey.startsWith('draft:')).map((node: any) => node.id),
    ['b-2', 'node-3d-renderer', 'node-3d-renderer-2']);
  assert.equal(controller.draftError(), undefined);
  controller.dispose();
});

test('Subsystem refinement replaces only that Subsystem inside its parent System', async () => {
  const c = connection();
  const controller = new SoftwareMapController(() => c, () => {});
  const attached = controller.attach('file:///A'); c.attachPending.resolve({ projectHandle: 'a', status: idle }); await attached;
  controller.review = { reviewId: 'r', packet: { items: [] }, proposal: { nodes: [] }, draft: [] };
  controller.flow = 'review';
  controller.draft = [
    { proposalKey: 'proposal:a', kind: 'system', parentProposalKey: null, id: 'a', name: 'A', purpose: 'A', roots: [] },
    { proposalKey: 'proposal:b', kind: 'system', parentProposalKey: null, id: 'b', name: 'B', purpose: 'B', roots: [] },
    { proposalKey: 'proposal:s', kind: 'subsystem', parentProposalKey: 'proposal:a', id: 's', name: 'S', purpose: 'S', roots: [] },
    { proposalKey: 'proposal:t', kind: 'subsystem', parentProposalKey: 'proposal:a', id: 't', name: 'T', purpose: 'T', roots: [] },
  ];
  c.searchDeeper = (_handle: string, input: any) => Promise.resolve({ ...input, parentPacketFingerprint: 'packet', proposal: { nodes: [
    { proposalKey: 'proposal:anchor', kind: 'system', parentProposalKey: null, name: 'A', purpose: 'A', evidenceRefs: [] },
    { proposalKey: 'proposal:new-s1', kind: 'subsystem', parentProposalKey: 'proposal:anchor', name: 'S1', purpose: 'S1', evidenceRefs: [] },
    { proposalKey: 'proposal:new-s2', kind: 'subsystem', parentProposalKey: 'proposal:anchor', name: 'S2', purpose: 'S2', evidenceRefs: [] },
  ] } });
  await controller.searchDeeper('proposal:s');
  assert.equal(controller.draft.length, 4);
  controller.acceptRefinement();
  assert.equal(controller.draft.length, 5);
  assert.deepEqual(controller.draft.filter((node: any) => node.kind === 'system').map((node: any) => node.name), ['A', 'B']);
  assert.equal(controller.draft.find((node: any) => node.proposalKey === 'proposal:t').name, 'T');
  assert.deepEqual(controller.draft.filter((node: any) => node.name === 'S1' || node.name === 'S2').map((node: any) => node.parentProposalKey),
    ['proposal:a', 'proposal:a']);
  controller.dispose();
});

test('accepted refinement is ready-only, preview-first, branch-local and drops late results', async () => {
  const c = connection();
  const controller = new SoftwareMapController(() => c, () => {});
  const attached = controller.attach('file:///A'); c.attachPending.resolve({ projectHandle: 'a', status: idle }); await attached;
  controller.initialization = { state: 'initialized', declarationFingerprint: 'canonical', declarationPresent: true };
  controller.connectionId = 'local-one'; controller.modelId = 'chosen-model';
  const draft = [
    { proposalKey: 'system', kind: 'system', parentProposalKey: null, id: 'system', name: 'Manual system', purpose: 'System', roots: ['src'] },
    { proposalKey: 'sub', kind: 'subsystem', parentProposalKey: 'system', id: 'sub', name: 'Manual sub', purpose: 'Sub', roots: ['src/api'], forbiddenDependencies: ['secret'] },
    { proposalKey: 'sibling', kind: 'system', parentProposalKey: null, id: 'sibling', name: 'Sibling', purpose: 'Unrelated edit', roots: [] },
  ] as any[];
  const current = () => true;
  await controller.searchDeeper('system', { draft, fingerprint: 'canonical', current });
  assert.match(controller.refinementError?.message ?? '', /Set up and test/);
  controller.setupReady = true;
  let sent: any;
  const waiting = deferred();
  c.searchDeeper = (_handle: string, input: any) => { sent = input; return waiting.promise; };
  const search = controller.searchDeeper('system', { draft, fingerprint: 'canonical', current });
  assert.equal(sent.reviewId, undefined);
  assert.equal(sent.providerKind, 'local'); assert.equal(sent.modelLabel, 'chosen-model');
  assert.deepEqual(sent.branch.map((node: any) => node.name), ['Manual system', 'Manual sub']);
  const proposal = { nodes: [
    { proposalKey: 'new-system', kind: 'system', parentProposalKey: null,
      name: 'Refined', purpose: 'Refined', evidenceRefs: ['system-fact'] },
    { proposalKey: 'new-sub', kind: 'subsystem', parentProposalKey: 'new-system',
      name: 'Refined Subsystem', purpose: 'Refined Subsystem', evidenceRefs: ['fact'] },
  ] };
  const evidence = [
    { id: 'system-fact', kind: 'semantic', path: 'src/app.ts', uri: 'file:///A/src/app.ts' },
    { id: 'fact', kind: 'semantic', path: 'src/api/a.ts', uri: 'file:///A/src/api/a.ts' },
  ];
  waiting.resolve({ ...sent, proposal, evidence });
  await search;
  assert.equal(draft[0].name, 'Manual system');
  controller.rejectRefinement(); assert.equal(draft[0].name, 'Manual system');
  c.searchDeeper = (_handle: string, input: any) => Promise.resolve({ ...input, proposal, evidence });
  await controller.searchDeeper('system', { draft, fingerprint: 'canonical', current });
  const next = controller.acceptRefinement(draft)!;
  assert.ok(next, controller.refinementError?.message);
  assert.equal(next.find(node => node.proposalKey === 'sibling')?.purpose, 'Unrelated edit');
  assert.equal(draft[0].name, 'Manual system');
  assert.equal(c.accepted, 0); assert.equal(c.analyzed, 0);
  const late = deferred();
  c.searchDeeper = (_handle: string, input: any) => { sent = input; return late.promise; };
  const stale = controller.searchDeeper('sub', { draft, fingerprint: 'canonical', current });
  draft[1].name = 'Changed during request';
  late.resolve({ ...sent, proposal }); await stale;
  assert.equal(controller.refinementPreview, undefined);
  assert.match(controller.refinementError?.message ?? '', /changed/);
  const newRequest = deferred(); c.searchDeeper = (_handle: string, input: any) => { sent = input; return newRequest.promise; };
  const pending = controller.searchDeeper('sub', { draft, fingerprint: 'canonical', current });
  controller.invalidateRefinement();
  c.searchDeeper = (_handle: string, input: any) => Promise.resolve({ ...input, proposal });
  await controller.searchDeeper('sub', { draft, fingerprint: 'canonical', current });
  const newest = controller.refinementPreview;
  newRequest.resolve({ ...sent, proposal }); await pending;
  assert.equal(controller.refinementPreview, newest);
  controller.rejectRefinement();
  const discarded = deferred(); c.searchDeeper = (_handle: string, input: any) => { sent = input; return discarded.promise; };
  let editorOpen = true;
  const closing = controller.searchDeeper('sub', { draft, fingerprint: 'canonical', current: () => editorOpen });
  editorOpen = false;
  discarded.resolve({ ...sent, proposal }); await closing;
  assert.equal(controller.refinementPreview, undefined);
  const canonicalChange = deferred(); c.searchDeeper = (_handle: string, input: any) => { sent = input; return canonicalChange.promise; };
  const changing = controller.searchDeeper('sub', { draft, fingerprint: 'canonical', current });
  controller.initialization.declarationFingerprint = 'new-canonical';
  canonicalChange.resolve({ ...sent, proposal }); await changing;
  assert.equal(controller.refinementPreview, undefined);
  controller.initialization.declarationFingerprint = 'canonical';
  const switchedCall = deferred(); c.searchDeeper = (_handle: string, input: any) => { sent = input; return switchedCall.promise; };
  const switching = controller.searchDeeper('sub', { draft, fingerprint: 'canonical', current });
  await controller.attach('file:///B');
  switchedCall.resolve({ ...sent, proposal }); await switching;
  assert.equal(controller.refinementPreview, undefined);
  controller.dispose();
});

test('accepted refinement keeps conflicting file ownership in preview', async () => {
  const c = connection();
  const controller = new SoftwareMapController(() => c, () => {});
  const attached = controller.attach('file:///A'); c.attachPending.resolve({ projectHandle: 'a', status: idle }); await attached;
  controller.initialization = { state: 'initialized', declarationFingerprint: 'canonical', declarationPresent: true };
  controller.connectionId = 'local-one'; controller.modelId = 'chosen-model'; controller.setupReady = true;
  const draft = [
    { proposalKey: 'system', kind: 'system', parentProposalKey: null, id: 'system', name: 'System', purpose: 'System', roots: [] },
    { proposalKey: 'sub', kind: 'subsystem', parentProposalKey: 'system', id: 'sub', name: 'Subsystem', purpose: 'Subsystem', roots: ['src/a.ts'] },
  ] as any[];
  c.searchDeeper = (_handle: string, input: any) => Promise.resolve({ ...input, proposal: { nodes: [
    { proposalKey: 'anchor', kind: 'system', parentProposalKey: null, name: 'System', purpose: 'System', evidenceRefs: ['fact'] },
    { proposalKey: 'sub-new', kind: 'subsystem', parentProposalKey: 'anchor', name: 'Subsystem', purpose: 'Subsystem', evidenceRefs: ['fact'] },
    { proposalKey: 'a', kind: 'component', parentProposalKey: 'sub-new', name: 'A', purpose: 'A', evidenceRefs: ['fact'] },
    { proposalKey: 'b', kind: 'component', parentProposalKey: 'sub-new', name: 'B', purpose: 'B', evidenceRefs: ['fact'] },
  ] }, evidence: [{ id: 'fact', kind: 'semantic', path: 'src/a.ts', uri: 'file:///A/src/a.ts' }] });
  await controller.searchDeeper('sub', { draft, fingerprint: 'canonical', current: () => true });
  assert.ok(controller.refinementPreview);
  assert.equal(controller.acceptRefinement(draft), undefined);
  assert.match(controller.refinementError?.message ?? '', /ambiguous_root/);
  assert.ok(controller.refinementPreview);
  assert.equal(draft.length, 2);
  assert.equal(c.accepted, 0); assert.equal(c.analyzed, 0);
  controller.rejectRefinement();
  assert.equal(controller.refinementPreview, undefined);
  assert.equal(controller.refinementError, undefined);
  controller.dispose();
});

test('attach reconciles analysis completed before handle was available', async () => {
  const c = connection();
  const controller = new SoftwareMapController(() => c, () => {});
  const attached = controller.attach('file:///A');
  c.attachPending.resolve({ projectHandle: 'a', status: { ...status(1), state: 'analyzing', publishedGeneration: 0 } });
  c.statusPending.resolve(status(1));
  c.hierarchyPending.resolve(page(1, [{ id: 'current', kind: 'system', name: 'Current', purpose: 'Current', evidenceIds: [] }]));
  c.violationsPending.resolve(page(1, []));
  await attached;
  assert.deepEqual(controller.nodes.map((node: any) => node.id), ['current']);
  controller.dispose();
});

test('late aggregate origins from A cannot appear after a root switch', async () => {
  const c = connection();
  const controller = new SoftwareMapController(() => c, () => {});
  const attached = controller.attach('file:///A');
  c.attachPending.resolve({ projectHandle: 'a', status: idle });
  await attached;
  controller.status = status(1);
  const origins = controller.origins({ id: 'aggregate', originRelationshipIds: ['r1'] });
  await controller.attach('file:///B');
  c.relationshipEdgesPending.resolve(page(1, [{ id: 'r1', kind: 'imports', sourceId: 'A', targetId: 'B', evidenceIds: [] }]));
  await origins;
  assert.deepEqual(controller.originEdges, []);
  assert.equal(controller.workspace, 'file:///B');
  controller.dispose();
});

test('refresh clears old generation and stale query cannot publish', async () => {
  const c = connection();
  const controller = new SoftwareMapController(() => c, () => {});
  const attaching = controller.attach('file:///A');
  c.attachPending.resolve({ projectHandle: 'a', status: idle });
  await attaching;
  const refreshing = controller.analyze();
  c.event({ ...status(2), state: 'analyzing', publishedGeneration: 1 });
  c.hierarchyPending.resolve(page(1, [{ id: 'old', kind: 'system', name: 'Old', evidenceIds: [] }]));
  c.violationsPending.resolve(page(1, []));
  c.analyzePending.resolve(status(2));
  await refreshing;
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(controller.nodes, []);
  assert.equal(controller.status.generation, 2);
  controller.dispose();
});
