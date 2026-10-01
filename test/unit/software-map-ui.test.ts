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
  const selectedModels: string[] = [];
  return {
    get analyzed() { return analyzed; }, get configured() { return configured; }, get accepted() { return accepted; }, configurations, selectedModels, savedDrafts,
    attachPending: attach, analyzePending: analyze, statusPending: statusRequest, hierarchyPending: hierarchy, violationsPending: violations, relationshipsPending: relationships, relationshipEdgesPending: relationshipEdges, evidencePending: evidence,
    setClient(value: any) { client = value; }, event(value: any) { client?.notifySoftwareMapChanged(value); },
    progress(handle: string, value: any) { client?.notifySoftwareMapAnalysisProgress(handle, value); },
    attach() { return attach.promise; }, analyze() { analyzed++; return analyze.promise; },
    initializationStatus() { return Promise.resolve({ state: 'uninitialized', declarationPresent: false, declarationFingerprint: 'absent' }); },
    synthesisEnvironment() { return Promise.resolve({ geminiKeyAvailable: false }); },
    clearSynthesis() { return Promise.resolve(); },
    configureSynthesis(_handle: string, options: any) { configured++; configurations.push(options); return Promise.resolve({ models: options.kind === 'local' ? ['other-model', 'Qwen3-Coder-30B-A3B-Instruct'] : ['gemini-3.6-flash', 'gemini-3.8-flash'] }); },
    refreshSynthesisModels() { return Promise.resolve({ models: ['gemini-3.6-flash', 'gemini-3.8-flash'] }); },
    selectSynthesisModel(_handle: string, id: string) { selectedModels.push(id); return Promise.resolve(); }, probeSynthesis() { return Promise.resolve(); },
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
  const controller = new SoftwareMapController(() => c, () => {});
  const attaching = controller.attach('file:///A');
  c.attachPending.resolve({ projectHandle: 'a', status: idle });
  await attaching;
  assert.equal(controller.flow, 'setup');
  assert.equal(controller.initialization.resumable.runId, 'run-one');
  controller.setupReady = true;
  await controller.synthesize('local', true);
  assert.deepEqual(calls, ['retry']);
  assert.equal(controller.review.reviewId, 'review');
  controller.dispose();
});

test('local setup prefers Qwen and stores endpoint/model only as application state after probe', async () => {
  const c = connection();
  const writes: any[] = [];
  const controller = new SoftwareMapController(() => c, () => {}, { getData: async () => undefined, setData: async (...args: any[]) => { writes.push(args); } });
  const attaching = controller.attach('file:///A'); c.attachPending.resolve({ projectHandle: 'a', status: idle }); await attaching;
  await controller.setup();
  await controller.discover();
  assert.equal(controller.model, 'Qwen3-Coder-30B-A3B-Instruct');
  assert.equal(c.configured, 1);
  assert.deepEqual(writes, []);
  await controller.probe();
  assert.equal(controller.setupReady, true);
  assert.equal(writes[0][0], 'dope.smap.synthesis');
  assert.deepEqual(writes[0][1], { kind: 'local', endpoint: 'http://127.0.0.1:1234/v1', model: 'Qwen3-Coder-30B-A3B-Instruct' });
  assert.equal(c.analyzed, 0);
  controller.changeContextTokens('32768');
  await controller.probe();
  assert.match(controller.error, /Discover models again/);
  assert.equal(controller.setupReady, false);
  await controller.discover();
  await controller.probe();
  assert.equal(controller.setupReady, true);
  assert.equal(c.configured, 2);
  controller.dispose();
});

test('Gemini setup uses only Gemini, drops session key, and switching clears readiness', async () => {
  const c = connection();
  const writes: any[] = [];
  let changes = 0;
  c.synthesisEnvironment = () => Promise.resolve({ geminiKeyAvailable: true });
  const controller = new SoftwareMapController(() => c, () => { changes++; }, {
    getData: async () => undefined, setData: async (...args: any[]) => { writes.push(args); }
  });
  const attaching = controller.attach('file:///A'); c.attachPending.resolve({ projectHandle: 'a', status: idle }); await attaching;
  changes = 0;
  await controller.setup();
  assert.equal(controller.geminiEnvironmentKeyAvailable, true);
  assert.equal(changes, 2);
  controller.changeGeminiKey('session-secret');
  controller.chooseProvider('gemini');
  await controller.discoverGemini();
  assert.deepEqual(controller.geminiModels, ['gemini-3.6-flash', 'gemini-3.8-flash']);
  assert.equal(controller.geminiModel, 'gemini-3.6-flash');
  await controller.probeGemini();
  assert.equal(controller.setupReady, true);
  assert.equal(controller.geminiKey, '');
  assert.deepEqual(c.configurations, [{ kind: 'gemini', apiKey: 'session-secret' }]);
  assert.equal(JSON.stringify(writes).includes('session-secret'), false);
  assert.deepEqual(writes[0][1], { kind: 'gemini', endpoint: controller.endpoint, model: '', geminiModel: 'gemini-3.6-flash' });
  assert.deepEqual(c.selectedModels, ['gemini-3.6-flash']);
  controller.chooseProvider('local');
  assert.equal(controller.setupReady, false);
  await controller.synthesize('gemini');
  assert.equal(controller.review, undefined);
  await controller.discover();
  assert.equal(c.configurations.at(-1).kind, 'local');
  controller.dispose();
});

test('Gemini failure preserves retry without Local fallback or secret in UI error', async () => {
  const c = connection();
  c.probeSynthesis = () => Promise.reject(new Error('Gemini connection test failed'));
  const controller = new SoftwareMapController(() => c, () => {});
  const attaching = controller.attach('file:///A'); c.attachPending.resolve({ projectHandle: 'a', status: idle }); await attaching;
  await controller.setup();
  controller.chooseProvider('gemini');
  controller.changeGeminiKey('session-secret');
  await controller.discoverGemini();
  await controller.probeGemini();
  assert.equal(controller.setupReady, false);
  assert.equal(controller.geminiKey, '');
  assert.equal(c.configurations.length, 1);
  assert.equal(c.configurations[0].kind, 'gemini');
  assert.equal(controller.error.includes('session-secret'), false);
  await controller.changeGeminiModel('gemini-3.8-flash');
  assert.equal(controller.setupReady, false);
  c.probeSynthesis = () => Promise.resolve();
  await controller.probeGemini();
  assert.equal(controller.setupReady, true);
  assert.deepEqual(c.selectedModels, ['gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-3.8-flash']);
  controller.dispose();
});

test('failed-stage retry waits for a successful test of the changed Gemini model', async () => {
  const c = connection();
  const saved = { state: 'failed', declarationPresent: false, declarationFingerprint: 'absent', resumable: {
    runId: 'saved', failedStage: 'subsystem-discovery', failedProviderKind: 'gemini', failedModelLabel: 'gemini-3.6-flash',
    message: 'Gemini synthesis request failed', completed: [{ stage: 'system-discovery', providerKind: 'gemini', modelLabel: 'gemini-3.6-flash' }] } };
  c.initializationStatus = () => Promise.resolve(saved);
  let retries = 0;
  c.retryFailedStage = () => { retries++; return Promise.resolve({ reviewId: 'recovered', packet: { items: [] },
    proposal: { nodes: [], openQuestions: [], unassignedEvidenceRefs: [] }, draft: [] }); };
  const controller = new SoftwareMapController(() => c, () => {});
  const attaching = controller.attach('file:///A'); c.attachPending.resolve({ projectHandle: 'a', status: idle }); await attaching;
  controller.chooseProvider('gemini');
  controller.changeGeminiKey('session-secret');
  await controller.discoverGemini();
  await controller.probeGemini();
  await controller.changeGeminiModel('gemini-3.8-flash');
  await controller.synthesize('gemini', true);
  assert.equal(retries, 0);
  await controller.probeGemini();
  await controller.synthesize('gemini', true);
  assert.equal(retries, 1);
  assert.equal(controller.review.reviewId, 'recovered');
  assert.deepEqual(saved.resumable.completed, [{ stage: 'system-discovery', providerKind: 'gemini', modelLabel: 'gemini-3.6-flash' }]);
  controller.dispose();
});

test('progress keeps text labels and theme tokens, with terminal heading from run state', () => {
  const widget = readFileSync(new URL('../../packages/theia-extension/src/browser/software-map-widget.ts', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../../packages/theia-extension/src/browser/dope.css', import.meta.url), 'utf8');
  assert.match(widget, /runState === 'failed' \? 'Analysis failed'/);
  assert.match(widget, /Retry failed stage with \$\{model\.geminiModel/);
  assert.match(widget, /Retry failed stage with \$\{model\.model/);
  assert.match(widget, /`\$\{state\}: \$\{item\.title\}`/);
  for (const state of ['complete', 'current', 'queued', 'failed'])
    assert.match(css, new RegExp(`dope-smap-stage-${state}`));
  assert.match(css, /var\(--theia-testing-iconPassed/);
  assert.match(css, /var\(--theia-testing-iconFailed/);
  assert.doesNotMatch(widget.slice(widget.indexOf('private renderProgress()'), widget.indexOf('private renderReview()')), /\.error/);
});

test('Gemini refresh and restart retain only selected model preference, never readiness or key', async () => {
  const stored: any = { kind: 'gemini', endpoint: 'http://127.0.0.1:1234/v1', model: '', geminiModel: 'gemini-3.8-flash' };
  const preference = { getData: async () => stored, setData: async (_key: string, value: any) => Object.assign(stored, value) };
  const c = connection();
  const controller = new SoftwareMapController(() => c, () => {}, preference);
  const attaching = controller.attach('file:///A'); c.attachPending.resolve({ projectHandle: 'a', status: idle }); await attaching;
  await controller.setup();
  assert.equal(controller.geminiModel, 'gemini-3.8-flash');
  assert.equal(controller.setupReady, false);
  await controller.discoverGemini();
  assert.equal(controller.geminiModel, 'gemini-3.8-flash');
  await controller.probeGemini();
  assert.equal(controller.setupReady, true);
  await controller.discoverGemini();
  assert.equal(controller.setupReady, false);
  assert.equal(c.configurations.length, 1);
  assert.deepEqual(c.selectedModels, ['gemini-3.8-flash']);
  assert.equal(JSON.stringify(stored).includes('ready'), false);
  assert.equal(JSON.stringify(stored).includes('secret'), false);
  controller.dispose();
  const next = connection();
  const reopened = new SoftwareMapController(() => next, () => {}, preference);
  const reattach = reopened.attach('file:///A'); next.attachPending.resolve({ projectHandle: 'new', status: idle }); await reattach;
  await reopened.setup();
  assert.equal(reopened.geminiModel, 'gemini-3.8-flash');
  assert.equal(reopened.setupReady, false);
  reopened.dispose();
});

test('cancelled Gemini analysis configures a fresh provider before model discovery', async () => {
  const c = connection();
  const pending = deferred();
  let configured = false;
  const configure = c.configureSynthesis;
  c.configureSynthesis = (handle: string, options: any) => { configured = true; return configure(handle, options); };
  c.clearSynthesis = () => { configured = false; return Promise.resolve(); };
  c.refreshSynthesisModels = () => configured
    ? Promise.resolve({ models: ['gemini-3.6-flash'] }) : Promise.reject(new Error('Gemini is not configured'));
  c.startInitialization = () => pending.promise;
  const controller = new SoftwareMapController(() => c, () => {});
  const attaching = controller.attach('file:///A'); c.attachPending.resolve({ projectHandle: 'a', status: idle }); await attaching;
  await controller.setup();
  await controller.discoverGemini();
  await controller.probeGemini();
  const analysis = controller.synthesize('gemini');
  await controller.cancel();
  assert.equal(controller.flow, 'setup');
  assert.equal(controller.setupReady, false);
  await controller.discoverGemini();
  assert.equal(controller.error, '');
  assert.equal(c.configured, 2);
  await controller.probeGemini();
  assert.equal(controller.setupReady, true);
  pending.resolve({ reviewId: 'stale', draft: [] }); await analysis;
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
  a.configureSynthesis = () => discovery.promise;
  a.startInitialization = () => proposal.promise;
  let count = 0;
  const controller = new SoftwareMapController(() => ++count === 1 ? a : b, () => {});
  const attachingA = controller.attach('file:///A'); a.attachPending.resolve({ projectHandle: 'a', status: idle }); await attachingA;
  const setup = controller.setup();
  const attachingB = controller.attach('file:///B'); b.attachPending.resolve({ projectHandle: 'b', status: idle }); await attachingB;
  discovery.resolve(['stale']); await setup;
  assert.deepEqual(controller.models, []);
  assert.equal(controller.setupBusy, false);
  const attachingA2 = controller.attach('file:///A'); a.attachPending.resolve({ projectHandle: 'a', status: idle }); await attachingA2;
  controller.setupReady = true;
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
  const controller = new SoftwareMapController(() => ++count === 1 ? a : b, () => {});
  const attachA = controller.attach('file:///A'); a.attachPending.resolve({ projectHandle: 'a', status: idle }); await attachA;
  controller.setupReady = true;
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
  const controller = new SoftwareMapController(() => c, () => {});
  const attaching = controller.attach('file:///A'); c.attachPending.resolve({ projectHandle: 'a', status: idle }); await attaching;
  await controller.setup();
  await controller.discover();
  assert.match(controller.error, /runtime offline/);
  assert.equal(controller.setupBusy, false);
  c.configureSynthesis = () => Promise.resolve({ models: ['model'] });
  await controller.discover();
  assert.equal(controller.error, '');
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
  const controller = new SoftwareMapController(() => c, () => {});
  const attaching = controller.attach('file:///A'); c.attachPending.resolve({ projectHandle: 'a', status: idle }); await attaching;
  controller.setupReady = true;
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

test('review has one controller, center hierarchy, focused detail and explicit accept', () => {
  const sidebar = readFileSync(new URL('../../packages/theia-extension/src/browser/software-map-widget.ts', import.meta.url), 'utf8');
  const editor = readFileSync(new URL('../../packages/theia-extension/src/browser/software-map-review-widget.ts', import.meta.url), 'utf8');
  const wiring = readFileSync(new URL('../../packages/theia-extension/src/browser/frontend-module.ts', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../../packages/theia-extension/src/browser/dope.css', import.meta.url), 'utf8');
  assert.match(sidebar, /Open Architecture Review/);
  assert.doesNotMatch(sidebar.slice(sidebar.indexOf('private renderReview()'), sidebar.indexOf('private renderDraft(')), /fieldset|renderPacketFact/);
  assert.match(wiring, /bind\(SoftwareMapController\).*inSingletonScope\(\)/s);
  assert.match(wiring, /area: 'main'/);
  assert.match(editor, /this\.controller\.draft/);
  assert.match(editor, /list\(node\.proposalKey\)/);
  assert.match(editor, /aria-current/);
  assert.match(editor, /find\(node => node\.proposalKey === this\.selectedKey\)/);
  assert.match(editor, /this\.renderDetail\(selected, detail\)/);
  assert.match(editor, /reviewSource\(ref\)/);
  assert.match(editor, /Accept architecture/);
  assert.match(editor, /this\.controller\.draftDiagnostics\(\)/);
  assert.match(editor, /Acceptance blocked:/);
  assert.match(editor, /node\.kind !== 'component'[\s\S]*Search Deeper/);
  for (const label of ['Observed', 'Documented', 'Inferred', 'Accept refinement', 'Reject refinement']) assert.match(editor, new RegExp(label));
  assert.match(editor, /reviewDocument\(path\)/);
  assert.match(editor, /Advanced: canonical ID and implementation roots/);
  assert.match(css, /dope-smap-review-layout/);
  assert.match(css, /var\(--theia-list-activeSelectionBackground\)/);
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
