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
  assert.deepEqual(overview.facts, []);
  assert.deepEqual(overview.aggregates.map(f => f.kind), ['invokes', 'invokes']);
  assert.deepEqual(query(map, 'x', 'downstream').facts.map(f => f.id), facts.map(f => f.id).sort());
  assert.deepEqual(query(map, 'x', 'upstream').facts.map(f => f.id), facts.map(f => f.id).sort());
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

test('Component and Code focus disclose only adjacent evidenced invocation detail', () => {
  const component: GraphNode = { id: 'cmp', kind: 'component', name: 'Component', purpose: '', parentId: 'a', evidenceIds: ['node'] };
  const entry = { ...code('entry', 'a'), parentId: 'cmp', ownership: { state: 'assigned' as const, systemId: 's', subsystemId: 'a', componentId: 'cmp' } };
  const map = snapshot([component, entry, code('outside', 'b')], [edge('entry', 'outside')]);
  const focused = queryStaticFlow(map, { projectId: 'p', generation: 7, focusId: 'cmp' });
  assert.deepEqual(focused.facts.map(fact => [fact.sourceId, fact.targetId]), [['entry', 'outside']]);
  assert.equal(focused.aggregates.length, 0);
  assert.deepEqual(queryStaticFlow(map, { projectId: 'p', generation: 7, focusId: 'entry' }).facts.map(fact => fact.id),
    focused.facts.map(fact => fact.id));
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

test('dense overviews admit HTTP boundaries before hidden calls and report visible truncation', () => {
  const nodes = Array.from({ length: 130 }, (_, i) => code(`worker${i}`, 'a'));
  const calls = Array.from({ length: 300 }, (_, i) => edge(`worker${i % 130}`, `worker${(i + 1) % 130}`, 'invokes', `call${i}`));
  const stores = Array.from({ length: 105 }, (_, i): PhysicalFlowEndpoint => ({
    id: flowEndpointId('store', { connection: `db${i}` }), kind: 'store', identity: { connection: `db${i}` }, anchorNodeId: 'worker0', evidenceIds: ['reads'] }));
  const input: PhysicalFlowEndpoint = { id: flowEndpointId('http-input', { method: 'GET', path: '/entry' }), kind: 'http-input', identity: { method: 'GET', path: '/entry' },
    anchorNodeId: 'worker0', evidenceIds: ['receives'] };
  const output: PhysicalFlowEndpoint = { id: flowEndpointId('http-output', { method: 'GET', path: '/entry' }), kind: 'http-output', identity: { method: 'GET', path: '/entry' },
    anchorNodeId: 'worker0', evidenceIds: ['responds'] };
  const facts = [...calls, edge(input.id, 'worker0', 'receives'), edge('worker0', output.id, 'responds'),
    ...stores.map(store => edge('worker0', store.id, 'reads'))];
  const map = snapshot(nodes, facts, [...stores, input, output]);
  const system = query(map);
  assert.equal(system.truncated, true);
  assert.ok(system.aggregates.some(fact => fact.kind === 'receives'));
  assert.ok(system.aggregates.some(fact => fact.kind === 'responds'));
  assert.ok(!system.aggregates.some(fact => fact.kind === 'invokes'));
  assert.ok(system.nodes.length + system.endpoints.length <= 100);
  assert.ok(system.aggregates.length <= 200);
  assert.deepEqual(query(map), system);
  const subsystem = queryStaticFlow(map, { projectId: 'p', generation: 7, focusId: 'a' });
  assert.equal(subsystem.truncated, true);
  assert.ok(subsystem.aggregates.some(fact => fact.kind === 'receives'));
  assert.ok(subsystem.aggregates.some(fact => fact.kind === 'responds'));
});

test('shared endpoint scope follows each fact and retains one physical store identity', () => {
  const nodes = [code('callerA', 'a'), code('callerB', 'b'), code('callerC', 'a')];
  const store: PhysicalFlowEndpoint = { id: flowEndpointId('store', { connection: 'shared' }), kind: 'store', identity: { connection: 'shared' },
    anchorNodeId: 'callerA', evidenceIds: ['reads'] };
  const map = snapshot(nodes, nodes.map(node => edge(node.id, store.id, 'reads')), [store]);
  const focused = queryStaticFlow(map, { projectId: 'p', generation: 7, focusId: 'b' });
  assert.deepEqual(focused.aggregates.flatMap(fact => fact.originFlowFactIds), [edge('callerB', store.id, 'reads').id]);
  assert.deepEqual(focused.endpoints.map(endpoint => endpoint.id), [store.id]);
  assert.ok(queryStaticFlow(map, { projectId: 'p', generation: 7, focusId: 'b', selectedId: store.id, direction: 'upstream' })
    .facts.some(fact => fact.sourceId === 'callerB'));
});

test('System-owned code is reduced to its System in a System overview', () => {
  const direct = { ...code('direct', 'a'), parentId: 's', ownership: { state: 'assigned' as const, systemId: 's' } };
  const input: PhysicalFlowEndpoint = { id: flowEndpointId('http-input', { method: 'GET', path: '/direct' }),
    kind: 'http-input', identity: { method: 'GET', path: '/direct' }, anchorNodeId: 'direct', evidenceIds: ['receives'] };
  const result = query(snapshot([direct], [edge(input.id, 'direct', 'receives')], [input]));
  assert.deepEqual(result.aggregates.map(fact => [fact.sourceId, fact.targetId]), [['flow:group:http-input:s', 's']]);
  assert.deepEqual(result.groups?.[0].memberIds, [input.id]);
  assert.deepEqual(result.nodes.map(node => node.id), ['s']);
});

test('Subsystem overview favors cross-scope invocation over interior calls', () => {
  const nodes = [code('localA', 'a'), code('localB', 'a'), code('outside', 'b')];
  const map = snapshot(nodes, [edge('localA', 'localB', 'invokes', 'inside'), edge('localA', 'outside', 'invokes', 'cross')]);
  const result = queryStaticFlow(map, { projectId: 'p', generation: 7, focusId: 'a', maxFacts: 1 });
  assert.deepEqual(result.aggregates.flatMap(fact => fact.originFlowFactIds), [edge('localA', 'outside', 'invokes', 'cross').id]);
});

test('System relationship groups detail variants without inventing shared semantics', () => {
  const nodes = [code('one', 'a'), code('two', 'a')];
  const store: PhysicalFlowEndpoint = { id: flowEndpointId('store', { connection: 'shared' }), kind: 'store', identity: { connection: 'shared' },
    anchorNodeId: 'one', evidenceIds: ['reads'] };
  const first = { ...edge('one', store.id, 'reads', 'first'), enrichment: [{ kind: 'schema' as const, label: 'items', evidenceIds: ['schema1'] }],
    behavior: { async: true, evidenceIds: ['async1'] } };
  const second = { ...edge('two', store.id, 'reads', 'second'), enrichment: [{ kind: 'schema' as const, label: 'items', evidenceIds: ['schema2'] }],
    behavior: { async: true, evidenceIds: ['async2'] } };
  const differentSchema = { ...edge('one', store.id, 'reads', 'third'), enrichment: [{ kind: 'schema' as const, label: 'other', evidenceIds: ['schema3'] }] };
  const differentKind = { ...edge('two', store.id, 'reads', 'fifth'), enrichment: [{ kind: 'data' as const, label: 'items', evidenceIds: ['data'] }] };
  const retry = { ...edge('two', store.id, 'reads', 'fourth'), behavior: { retry: true, evidenceIds: ['retry'] } };
  const error = { ...edge('one', store.id, 'reads', 'sixth'), behavior: { error: true, evidenceIds: ['error'] } };
  const writes = edge('one', store.id, 'writes');
  const map = { ...snapshot(nodes, [], [store]), flowFacts: [first, second, differentSchema, differentKind, retry, error, writes] };
  const result = query(map);
  assert.equal(result.aggregates.length, 2);
  const combined = result.aggregates.find(fact => fact.kind === 'reads')!;
  assert.deepEqual(combined.originFlowFactIds, [first, second, differentSchema, differentKind, retry, error].map(f => f.id).sort());
  assert.deepEqual(combined.evidenceIds, ['reads']);
  assert.equal(combined.enrichment, undefined);
  assert.equal(combined.behavior, undefined);
  assert.equal(combined.projectionVariants?.length, 5);
  assert.deepEqual(combined.projectionVariants?.find(item => item.originFlowFactIds.length === 2)?.enrichment?.[0].evidenceIds, ['schema1', 'schema2']);
  assert.deepEqual(combined.projectionVariants?.find(item => item.originFlowFactIds.length === 2)?.behavior?.evidenceIds, ['async1', 'async2']);
  assert.deepEqual(combined.originParticipants?.map(item => item.id), combined.originFlowFactIds);
  assert.deepEqual(query(map), result);
});

test('rich hierarchy projects a quiet System, a finer Subsystem, and exact detail without losing evidence', () => {
  const component: GraphNode = { id: 'ac', kind: 'component', name: 'A component', purpose: '', parentId: 'a', evidenceIds: ['node'] };
  const a = Array.from({ length: 40 }, (_, i) => ({ ...code(`a${i}`, 'a'), parentId: 'ac',
    ownership: { state: 'assigned' as const, systemId: 's', subsystemId: 'a', componentId: 'ac' } }));
  const b = Array.from({ length: 10 }, (_, i) => code(`b${i}`, 'b'));
  const makeEndpoint = (kind: PhysicalFlowEndpoint['kind'], identity: PhysicalFlowEndpoint['identity'], anchorNodeId: string,
    evidenceId: PhysicalFlowFact['kind']): PhysicalFlowEndpoint => ({ id: flowEndpointId(kind, identity), kind, identity, anchorNodeId, evidenceIds: [evidenceId] });
  const inputs = Array.from({ length: 15 }, (_, i) => makeEndpoint('http-input', { method: 'GET', path: `/entry/${i}` }, `a${i}`, 'receives'));
  const outputs = Array.from({ length: 15 }, (_, i) => makeEndpoint('http-output', { method: 'GET', path: `/entry/${i}` }, `a${i}`, 'responds'));
  const stores = [makeEndpoint('store', { connection: 'primary' }, 'a0', 'reads'),
    makeEndpoint('store', { connection: 'audit' }, 'a0', 'reads')];
  const externals = [makeEndpoint('external-service', { service: 'one.example' }, 'a0', 'calls-external'),
    makeEndpoint('external-service', { service: 'two.example' }, 'a0', 'calls-external')];
  const facts = [
    ...inputs.map((input, i) => edge(input.id, `a${i}`, 'receives')),
    ...outputs.map((output, i) => edge(`a${i}`, output.id, 'responds')),
    ...a.slice(0, 39).map((node, i) => edge(node.id, `a${i + 1}`, 'invokes')),
    edge('a0', 'b0'), edge('b0', stores[0].id, 'reads'),
    ...a.map(node => edge(node.id, stores[0].id, 'reads')),
    ...a.map(node => edge(node.id, stores[1].id, 'reads')),
    ...externals.map(external => edge('a0', external.id, 'calls-external'))
  ];
  const map = snapshot([component, ...a, ...b], facts, [...inputs, ...outputs, ...stores, ...externals]);
  const system = query(map);
  assert.equal(system.projectionLevel, 'system');
  assert.ok(system.nodes.length + system.endpoints.length + system.groups!.length <= 9);
  assert.ok(system.aggregates.length <= 9);
  assert.equal(system.truncated, false);
  assert.equal(system.aggregation?.sourceFacts, facts.length);
  assert.deepEqual(system.groups?.filter(group => group.role === 'Input').flatMap(group => group.memberIds), inputs.map(item => item.id).sort());
  assert.deepEqual([...new Set(system.aggregates.filter(fact => fact.kind === 'reads').map(fact => fact.targetId))].sort(), stores.map(item => item.id).sort());
  assert.deepEqual(system.aggregates.filter(fact => fact.kind === 'calls-external').map(fact => fact.targetId).sort(), externals.map(item => item.id).sort());
  assert.deepEqual(system.aggregates.find(fact => fact.kind === 'receives')?.originFlowFactIds,
    inputs.map((input, i) => edge(input.id, `a${i}`, 'receives').id).sort());
  assert.ok(system.aggregates.find(fact => fact.kind === 'invokes')?.originParticipants?.some(item => item.sourceId === 'a0' && item.targetId === 'b0'));
  const subsystem = queryStaticFlow(map, { projectId: 'p', generation: 7, focusId: 'a' });
  assert.equal(subsystem.projectionLevel, 'subsystem');
  assert.ok(subsystem.aggregates.length > system.aggregates.length);
  assert.ok(subsystem.aggregates.some(fact => fact.sourceId === inputs[0].id && fact.targetId === 'ac'));
  const trace = query(map, inputs[0].id, 'downstream');
  assert.equal(trace.projectionLevel, 'detail');
  assert.ok(trace.facts.some(fact => fact.sourceId === inputs[0].id && fact.targetId === 'a0'));
  assert.ok(trace.facts.some(fact => fact.sourceId === 'a0' && fact.targetId === 'b0'));
  assert.ok(trace.facts.some(fact => fact.sourceId === 'b0' && fact.targetId === stores[0].id));
  const bounded = queryStaticFlow(map, { projectId: 'p', generation: 7, focusId: 's', maxNodes: 2 });
  assert.equal(bounded.coverageStatus, 'truncated');
  assert.equal(bounded.aggregation?.sourceFacts, facts.length);
  assert.ok(bounded.aggregates.some(fact => fact.kind === 'receives'));
  assert.deepEqual(query(snapshot([...b, component, ...a], [...facts].reverse(), [...externals, ...stores, ...outputs, ...inputs])), system);
});

test('unassigned invocation evidence stays traceable without a false System connector', () => {
  const unknown = { ...code('unknown', 'a'), parentId: 'p', ownership: { state: 'unassigned' as const } };
  const input: PhysicalFlowEndpoint = { id: flowEndpointId('http-input', { method: 'GET', path: '/work' }),
    kind: 'http-input', identity: { method: 'GET', path: '/work' }, anchorNodeId: 'owned', evidenceIds: ['receives'] };
  const facts = [edge(input.id, 'owned', 'receives'), edge('owned', 'other'),
    ...Array.from({ length: 60 }, (_, i) => edge(i % 2 ? 'unknown' : 'owned', i % 2 ? 'other' : 'unknown', 'invokes', `unknown-${i}`))];
  const map = snapshot([code('owned', 'a'), code('other', 'b'), unknown], facts, [input]);
  const system = query(map);
  assert.equal(system.aggregation?.unassignedInvocations, 60);
  assert.ok(system.groups?.some(group => group.name === 'Unassigned code' && group.memberIds.includes('unknown')));
  assert.ok(system.aggregates.some(fact => fact.sourceId === 'a' && fact.targetId === 'b'));
  assert.ok(!system.aggregates.some(fact => fact.sourceId.includes('unassigned') || fact.targetId.includes('unassigned')));
  assert.ok(system.aggregates.some(fact => fact.kind === 'receives'));
  assert.equal(system.truncated, false);
  assert.ok(query(map, 'unknown', 'downstream').facts.some(fact => fact.sourceId === 'unknown' && fact.targetId === 'other'));
});
