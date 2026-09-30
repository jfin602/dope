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
  return {
    get analyzed() { return analyzed; }, get configured() { return configured; }, get accepted() { return accepted; },
    attachPending: attach, analyzePending: analyze, statusPending: statusRequest, hierarchyPending: hierarchy, violationsPending: violations, relationshipsPending: relationships, relationshipEdgesPending: relationshipEdges, evidencePending: evidence,
    setClient(value: any) { client = value; }, event(value: any) { client?.notifySoftwareMapChanged(value); },
    progress(handle: string, value: any) { client?.notifySoftwareMapAnalysisProgress(handle, value); },
    attach() { return attach.promise; }, analyze() { analyzed++; return analyze.promise; },
    initializationStatus() { return Promise.resolve({ state: 'uninitialized', declarationPresent: false, declarationFingerprint: 'absent' }); },
    configureSynthesis() { configured++; return Promise.resolve(['other-model', 'Qwen3-Coder-30B-A3B-Instruct']); },
    selectSynthesisModel() { return Promise.resolve(); }, probeSynthesis() { return Promise.resolve(); },
    synthesisReady() { return Promise.resolve(false); },
    startInitialization() { return Promise.resolve({ reviewId: 'review', packet: { items: [] }, proposal: { nodes: [], openQuestions: [], unassignedEvidenceRefs: [] }, draft: [] }); },
    cancelInitialization() { return Promise.resolve(); },
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

test('local setup prefers Qwen and stores endpoint/model only as application state after probe', async () => {
  const c = connection();
  const writes: any[] = [];
  const controller = new SoftwareMapController(() => c, () => {}, { getData: async () => undefined, setData: async (...args: any[]) => { writes.push(args); } });
  const attaching = controller.attach('file:///A'); c.attachPending.resolve({ projectHandle: 'a', status: idle }); await attaching;
  await controller.setup();
  assert.equal(controller.model, 'Qwen3-Coder-30B-A3B-Instruct');
  assert.equal(c.configured, 1);
  assert.deepEqual(writes, []);
  await controller.probe();
  assert.equal(controller.setupReady, true);
  assert.equal(writes[0][0], 'dope.smap.synthesis');
  assert.deepEqual(writes[0][1], { endpoint: 'http://127.0.0.1:1234/v1', model: 'Qwen3-Coder-30B-A3B-Instruct' });
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
  assert.match(controller.error, /runtime offline/);
  assert.equal(controller.setupBusy, false);
  c.configureSynthesis = () => Promise.resolve(['model']);
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

test('widget keeps explanation separate from hard facts and labels keyboard controls with theme colors', () => {
  const widget = readFileSync(new URL('../../packages/theia-extension/src/browser/software-map-widget.ts', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../../packages/theia-extension/src/browser/dope.css', import.meta.url), 'utf8');
  assert.match(widget, /'Evidence explanation'/);
  assert.match(widget, /'Source-backed evidence'/);
  assert.match(widget, /renderPacketFact\(ref, facts\.get\(ref\), row\)/);
  assert.match(widget, /'Open questions'/);
  assert.match(widget, /'Unassigned source-backed evidence'/);
  assert.match(widget, /'Canonical ID'/);
  assert.match(widget, /'Parent boundary'/);
  assert.match(widget, /'Implementation roots/);
  assert.match(widget, /'Not now'/);
  assert.match(widget, /'Use existing architecture'/);
  assert.match(widget, /setAttribute\('aria-label'/);
  assert.match(widget, /\.focus\(\)/);
  assert.match(css, /dope-smap-view input:focus-visible/);
  assert.match(css, /var\(--theia-input-background\)/);
  assert.match(css, /var\(--theia-editor-background\)/);
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
