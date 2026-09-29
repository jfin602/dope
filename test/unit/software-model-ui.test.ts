import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { SoftwareModelController } = require('../../packages/theia-extension/lib/browser/software-model-controller.js');
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
  return {
    attachPending: attach, analyzePending: analyze, statusPending: statusRequest, hierarchyPending: hierarchy, violationsPending: violations, relationshipsPending: relationships, relationshipEdgesPending: relationshipEdges, evidencePending: evidence,
    setClient(value: any) { client = value; }, event(value: any) { client?.notifySoftwareModelChanged(value); },
    attach() { return attach.promise; }, analyze() { return analyze.promise; },
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
  const controller = new SoftwareModelController(() => ++count === 1 ? a : b, () => {});
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

test('attach reconciles analysis completed before handle was available', async () => {
  const c = connection();
  const controller = new SoftwareModelController(() => c, () => {});
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
  const controller = new SoftwareModelController(() => c, () => {});
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
  const controller = new SoftwareModelController(() => c, () => {});
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
