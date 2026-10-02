import assert from 'node:assert/strict';
import test from 'node:test';
import { anonymousCallableId, createSnapshot, flowEndpointId, flowFactId } from '../../packages/software-map/lib/index.js';
import type { Evidence, FlowEndpointIdentity, GraphNode, PhysicalFlowEndpoint, PhysicalFlowFact, SnapshotMetadata } from '../../packages/software-map/lib/index.js';

const metadata: SnapshotMetadata = { projectId: 'project', generation: 1, inputFingerprint: 'source', analysis: { completeness: 'complete', errors: [] } };
const nodes: GraphNode[] = [
  { id: 'project', kind: 'project', name: 'Project', evidenceIds: [] },
  { id: 'handler', kind: 'code', codeKind: 'other', name: 'handler', path: 'src/app.ts', parentId: 'project', ownership: { state: 'unassigned' }, evidenceIds: ['node'] },
];
const evidence: Evidence[] = [
  { id: 'node', class: 'syntax', producer: 'ts', producerVersion: '1', path: 'src/app.ts', span: { start: 0, length: 1 } },
  { id: 'call', class: 'semantic', producer: 'ts', producerVersion: '1', path: 'src/app.ts', span: { start: 10, length: 4 }, flowKind: 'receives' },
  { id: 'call2', class: 'semantic', producer: 'ts', producerVersion: '1', path: 'src/app.ts', span: { start: 10, length: 4 }, flowKind: 'receives' },
  { id: 'type', class: 'semantic', producer: 'ts', producerVersion: '1', path: 'src/app.ts', span: { start: 10, length: 4 }, flowEnrichmentKind: 'type', flowBehavior: 'async' },
  { id: 'runtime', class: 'runtime', producer: 'trace', producerVersion: '1', observationId: 'run-1', flowKind: 'receives' },
];
const identity: FlowEndpointIdentity = { method: 'GET', path: '/items' };
const endpoint: PhysicalFlowEndpoint = { id: flowEndpointId('http-input', identity), kind: 'http-input', identity, anchorNodeId: 'handler', evidenceIds: ['call'] };
const fact: PhysicalFlowFact = { id: flowFactId('receives', endpoint.id, 'handler', 'route-1'), kind: 'receives', sourceId: endpoint.id, targetId: 'handler', discriminator: 'route-1', evidenceIds: ['call'] };
const make = (facts: PhysicalFlowFact[] = [], endpoints: PhysicalFlowEndpoint[] = [], proof = evidence) =>
  createSnapshot(metadata, nodes, [], proof, [], facts, endpoints);

test('Flow IDs, endpoints and snapshot order are deterministic', () => {
  assert.equal(flowEndpointId('http-input', { path: '/items', method: 'get' }), endpoint.id);
  assert.equal(flowFactId('receives', endpoint.id, 'handler', 'route-1'), fact.id);
  assert.notEqual(flowEndpointId('store', { sourceScope: 'src/a.ts:10' }), flowEndpointId('store', { sourceScope: 'src/b.ts:10' }));
  assert.notEqual(flowEndpointId('external-service', { sourceScope: 'src/a.ts:10' }), flowEndpointId('external-service', { sourceScope: 'src/b.ts:10' }));
  assert.throws(() => flowEndpointId('store', { store: 'generic-db' }));
  const first = make([{ ...fact, evidenceIds: ['call2'] }, fact], [endpoint, { ...endpoint, evidenceIds: ['call2'] }]);
  const reversed = make([fact, { ...fact, evidenceIds: ['call2'] }], [{ ...endpoint, evidenceIds: ['call2'] }, endpoint], [...evidence].reverse());
  assert.deepEqual(first.flowFacts, reversed.flowFacts);
  assert.deepEqual(first.flowEndpoints, reversed.flowEndpoints);
  assert.deepEqual(first.flowFacts[0].evidenceIds, ['call', 'call2']);
  assert.deepEqual(first.flowEndpoints[0].evidenceIds, ['call', 'call2']);
  const empty = make();
  assert.deepEqual([empty.flowFacts, empty.flowEndpoints, empty.flowCoverage, empty.flowDiagnostics], [[], [], [], []]);
  assert.deepEqual(make(), empty);
});

test('Flow rejects missing references, structural proof, wrong interaction and conflicting identities', () => {
  assert.throws(() => make([{ ...fact, targetId: 'missing' }], [endpoint]));
  assert.throws(() => make([fact], []));
  assert.throws(() => make([{ ...fact, evidenceIds: ['node'] }], [endpoint]));
  assert.throws(() => make([{ ...fact, kind: 'invokes' }], [endpoint]));
  assert.throws(() => make([fact], [{ ...endpoint, evidenceIds: ['node'] }]));
  assert.throws(() => make([fact], [endpoint, { ...endpoint, anchorNodeId: 'project' }]));
  assert.throws(() => make([fact, { ...fact, discriminator: 'other' }], [endpoint]));
});

test('Flow aggregate origins, enrichment and runtime observation stay explicit', () => {
  const aggregate: PhysicalFlowFact = { ...fact, id: flowFactId('receives', endpoint.id, 'project', 'aggregate'), targetId: 'project', discriminator: 'aggregate', originFlowFactIds: [fact.id] };
  const enriched: PhysicalFlowFact = { ...fact, enrichment: [{ kind: 'type', label: 'Request', evidenceIds: ['type'] }], behavior: { async: true, evidenceIds: ['type'] } };
  assert.deepEqual(make([aggregate, fact], [endpoint]).flowFacts.find(item => item.id === aggregate.id)?.originFlowFactIds, [fact.id]);
  assert.throws(() => make([aggregate], [endpoint]));
  assert.throws(() => make([{ ...aggregate, originFlowFactIds: [aggregate.id] }, fact], [endpoint]));
  assert.equal(make([enriched], [endpoint]).flowFacts[0].enrichment?.[0].label, 'Request');
  assert.throws(() => make([{ ...fact, enrichment: [{ kind: 'type', label: 'Guessed', evidenceIds: ['call'] }] }], [endpoint]));
  assert.throws(() => make([{ ...fact, enrichment: [{ kind: 'type', label: 'Guessed', evidenceIds: ['node'] }] }], [endpoint]));
  assert.throws(() => make([{ ...fact, enrichment: [{ kind: 'type', label: 'Guessed', evidenceIds: ['missing'] }] }], [endpoint]));
  const observed = { ...fact, id: flowFactId('receives', endpoint.id, 'handler', 'route-1', 'run-1'), observationId: 'run-1', evidenceIds: ['runtime'] };
  assert.equal(make([observed], [endpoint]).flowFacts[0].evidenceIds[0], 'runtime');
  assert.notEqual(observed.id, fact.id);
  assert.throws(() => make([{ ...fact, evidenceIds: ['runtime'] }], [endpoint]));
  assert.throws(() => make([{ ...observed, evidenceIds: ['runtime', 'call'] }], [endpoint]));
  assert.throws(() => make([observed], [endpoint], evidence.map(item => item.id === 'runtime' ? { ...item, observationId: undefined } : item)));
  assert.deepEqual(make([observed, fact], [endpoint]).flowFacts.map(item => item.id), [fact.id, observed.id].sort());
});

test('Flow coverage and diagnostics are separate, ordered and reference checked', () => {
  const diagnostic = { id: 'unresolved', code: 'unresolved-call', message: 'Target unknown', scopeId: 'handler', evidenceIds: ['node'] };
  const snapshot = createSnapshot(metadata, nodes, [], evidence, [], [], [],
    [{ scopeId: 'handler', status: 'partial', diagnosticIds: ['unresolved'] }], [diagnostic]);
  assert.equal(snapshot.metadata.analysis.completeness, 'complete');
  assert.equal(snapshot.flowCoverage[0].status, 'partial');
  assert.throws(() => createSnapshot(metadata, nodes, [], evidence, [], [], [],
    [{ scopeId: 'handler', status: 'partial', diagnosticIds: ['missing'] }], [diagnostic]));
  assert.throws(() => createSnapshot(metadata, nodes, [], evidence, [], [], [], [], [{ ...diagnostic, scopeId: 'missing' }]));
});

test('anonymous callable identity is source-scoped and not a symbol', () => {
  const id = anonymousCallableId('src/app.ts', 12, 5);
  assert.equal(id, anonymousCallableId('src/app.ts', 12, 5));
  assert.throws(() => anonymousCallableId('./src/app.ts', 12, 5));
  assert.notEqual(id, anonymousCallableId('src/app.ts', 13, 5));
  assert.match(id, /^code:anonymous:/);
  const callable: GraphNode = { id, kind: 'code', codeKind: 'other', name: 'Anonymous callback', path: 'src/app.ts', parentId: 'project', ownership: { state: 'unassigned' }, evidenceIds: ['node'] };
  assert.equal(createSnapshot(metadata, [...nodes, callable], [], evidence).nodes.find(node => node.id === id && node.kind === 'code')?.symbol, undefined);
  assert.throws(() => anonymousCallableId('src/app.ts', -1, 5));
});
