import assert from 'node:assert/strict';
import test from 'node:test';
import { createSnapshot, flowEndpointId, flowFactId, queryStaticFlow } from '../../packages/software-map/lib/index.js';
import type { Evidence, FlowDiagnostic, GraphNode, PhysicalFlowEndpoint, PhysicalFlowFact } from '../../packages/software-map/lib/index.js';

const proof = (id: string, kind?: PhysicalFlowFact['kind']): Evidence => ({ id, class: 'semantic', producer: 'fixture', producerVersion: '1', path: 'src/a.ts', span: { start: 0, length: 1 }, ...(kind ? { flowKind: kind } : {}) });
const base: GraphNode[] = [
  { id: 'p', kind: 'project', name: 'project', evidenceIds: [] },
  { id: 's', kind: 'system', name: 'System', purpose: '', parentId: 'p', evidenceIds: ['node'] },
  { id: 'a', kind: 'subsystem', name: 'A', purpose: '', parentId: 's', evidenceIds: ['node'] },
  { id: 'b', kind: 'subsystem', name: 'B', purpose: '', parentId: 's', evidenceIds: ['node'] },
];
const code = (id: string, subsystemId: string): GraphNode => ({ id, kind: 'code', codeKind: 'symbol', name: id, path: 'src/a.ts', parentId: subsystemId,
  ownership: { state: 'assigned', systemId: 's', subsystemId }, evidenceIds: ['node'] });
const edge = (sourceId: string, targetId: string, kind: PhysicalFlowFact['kind'] = 'invokes', discriminator = `${sourceId}-${targetId}`): PhysicalFlowFact =>
  ({ id: flowFactId(kind, sourceId, targetId, discriminator), kind, sourceId, targetId, discriminator, evidenceIds: [kind] });
const snapshot = (extraNodes: GraphNode[], facts: PhysicalFlowFact[], endpoints: PhysicalFlowEndpoint[] = [], diagnostics: FlowDiagnostic[] = [], status: 'partial' | 'unsupported' = 'partial') =>
  createSnapshot({ projectId: 'p', generation: 7, inputFingerprint: 'input', analysis: { completeness: 'partial', errors: [] } },
    [...base, ...extraNodes], [], [proof('node'), ...(['receives', 'invokes', 'reads', 'writes', 'calls-external', 'publishes', 'consumes', 'responds'] as const).map(kind => proof(kind, kind))],
    [], facts, endpoints, diagnostics.length ? [{ scopeId: 'a', status, diagnosticIds: diagnostics.map(d => d.id) }] : [], diagnostics);
const query = (map: ReturnType<typeof snapshot>, selectedId?: string, direction?: 'upstream' | 'downstream') =>
  queryStaticFlow(map, { projectId: 'p', generation: 7, focusId: 's', selectedId, direction });

test('overview, clear trace, upstream and downstream retain stable Static Flow facts', () => {
  const nodes = [code('x', 'a'), code('y', 'b'), code('z', 'b')];
  const facts = [edge('x', 'y'), edge('y', 'z'), edge('z', 'x')];
  const map = snapshot(nodes, facts.reverse());
  const overview = query(map);
  assert.equal(overview.kind, 'static');
  assert.equal(overview.generation, 7);
  assert.deepEqual(overview.facts.map(f => f.id), facts.map(f => f.id).sort());
  assert.deepEqual(query(map, 'x', 'downstream').facts.map(f => f.id), overview.facts.map(f => f.id));
  assert.deepEqual(query(map, 'x', 'upstream').facts.map(f => f.id), overview.facts.map(f => f.id));
  assert.deepEqual(query(map), overview);
  assert.equal(overview.truncated, false);
  assert.throws(() => queryStaticFlow(map, { projectId: 'other', generation: 7 }), /Stale/);
  assert.throws(() => queryStaticFlow(map, { projectId: 'p', generation: 8 }), /Stale/);
});

test('continuous one-hop summaries preserve branch/join, semantics, origin and evidence; gaps remain gaps', () => {
  const nodes = [code('entry', 'a'), code('left', 'b'), code('right', 'b'), code('join', 'b'), code('orphan', 'a')];
  const facts = [edge('entry', 'left'), edge('entry', 'right'), edge('left', 'join'), edge('right', 'join'),
    edge('join', 'entry', 'reads', 'read'), edge('join', 'entry', 'writes', 'write'), edge('orphan', 'join', 'calls-external')];
  const map = snapshot(nodes, facts);
  const result = query(map, 'entry', 'downstream');
  assert.equal(result.facts.length, 6);
  assert.equal(result.aggregates.length, 4);
  assert.deepEqual(result.aggregates.map(f => f.kind).sort(), ['invokes', 'invokes', 'reads', 'writes']);
  for (const item of result.aggregates) {
    assert.equal(item.originFlowFactIds?.length, 1);
    assert.deepEqual(item.evidenceIds, map.flowFacts.find(f => f.id === item.originFlowFactIds![0])!.evidenceIds);
  }
  assert.ok(!result.aggregates.some(f => f.kind === 'calls-external'));
  assert.ok(!result.aggregates.some(f => f.enrichment?.length));
});

test('endpoint selection and unresolved diagnostics stay visible', () => {
  const nodes = [code('x', 'a')];
  const identity = { method: 'GET', path: '/x' };
  const id = flowEndpointId('http-input', identity);
  const endpoint: PhysicalFlowEndpoint = { id, kind: 'http-input', identity, anchorNodeId: 'x', evidenceIds: ['receives'] };
  const diagnostic = { id: 'gap', code: 'unresolved-call', message: 'Unknown target', scopeId: 'x', evidenceIds: ['node'] };
  const map = snapshot(nodes, [edge(id, 'x', 'receives')], [endpoint], [diagnostic]);
  const result = query(map, id, 'downstream');
  assert.deepEqual(result.endpoints.map(e => e.id), [id]);
  assert.deepEqual(result.diagnostics.map(d => d.id), ['gap']);
  assert.equal(result.coverage[0].status, 'partial');
  assert.equal(result.coverageStatus, 'partial');
  assert.equal(result.truncated, false);
  const unsupported = snapshot(nodes, [], [], [{ id: 'unsupported', code: 'unsupported-framework', message: 'Unknown framework', scopeId: 'x', evidenceIds: ['node'] }], 'unsupported');
  assert.equal(query(unsupported).coverageStatus, 'unsupported');
});

test('queue continuation needs matching endpoint identity; unsupported hops are not stitched', () => {
  const nodes = [code('producer', 'a'), code('consumer', 'b'), code('unrelated', 'b')];
  const one = { channel: 'work' }, two = { channel: 'other-work' };
  const queue = (identity: typeof one, anchorNodeId: string): PhysicalFlowEndpoint => ({
    id: flowEndpointId('queue', identity), kind: 'queue', identity, anchorNodeId, evidenceIds: ['publishes'],
  });
  const first = queue(one, 'producer'), other = queue(two, 'unrelated');
  const map = snapshot(nodes, [edge('producer', first.id, 'publishes'), edge(first.id, 'consumer', 'consumes'),
    edge(other.id, 'unrelated', 'consumes')], [first, other]);
  const trace = query(map, 'producer', 'downstream');
  assert.deepEqual(trace.facts.map(f => f.kind), ['consumes', 'publishes']);
  assert.ok(!trace.nodes.some(n => n.id === 'unrelated'));
});

test('hard node, fact and hop budgets report each exhaustion', () => {
  const nodes = Array.from({ length: 104 }, (_, i) => code(`n${i}`, 'a'));
  const chain = Array.from({ length: 103 }, (_, i) => edge(`n${i}`, `n${i + 1}`));
  const map = snapshot(nodes, chain);
  const nodeResult = queryStaticFlow(map, { projectId: 'p', generation: 7, selectedId: 'n0', direction: 'downstream', maxHops: 32 });
  assert.equal(nodeResult.truncation.hops, true);
  assert.deepEqual(nodeResult.truncation.continueFromIds, ['n32']);
  assert.equal(nodeResult.coverageStatus, 'truncated');
  assert.equal(nodeResult.facts.length, 32);
  const manyNodes = queryStaticFlow(map, { projectId: 'p', generation: 7 });
  assert.equal(manyNodes.truncation.nodes, true);
  assert.ok(manyNodes.nodes.length + manyNodes.endpoints.length <= 100);
  const scoped = query(map);
  assert.ok(scoped.nodes.length + scoped.endpoints.length <= 100);
  assert.ok(scoped.facts.length + scoped.aggregates.length <= 200);
  const parallel = snapshot([code('x', 'a'), code('y', 'b')], Array.from({ length: 201 }, (_, i) => edge('x', 'y', 'invokes', `call-${i}`)));
  const factResult = queryStaticFlow(parallel, { projectId: 'p', generation: 7 });
  assert.equal(factResult.facts.length, 200);
  assert.ok(factResult.facts.length + factResult.aggregates.length <= 200);
  assert.equal(factResult.truncation.facts, true);
  assert.equal(factResult.truncation.continueDeeper, true);
  assert.throws(() => queryStaticFlow(map, { projectId: 'p', generation: 7, maxNodes: 101 }), /Invalid/);
  const self = snapshot([code('loop', 'a')], [edge('loop', 'loop')]);
  assert.equal(queryStaticFlow(self, { projectId: 'p', generation: 7, selectedId: 'loop', direction: 'downstream', maxNodes: 1 }).truncated, false);
});
