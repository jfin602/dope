import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import type { FlowQueryResult, GraphNode, PhysicalFlowEndpoint, PhysicalFlowFact } from '../../packages/software-map/lib/index.js';

const require = createRequire(import.meta.url);
const { projectFlowMap } = require('../../packages/theia-extension/lib/browser/flow-map-projection.js') as
    typeof import('../../packages/theia-extension/src/browser/flow-map-projection.ts');
const code = (id: string, name = id, subsystemId = 'a'): GraphNode => ({ id, name, kind: 'code', codeKind: 'symbol', path: 'src/a.ts',
    ownership: { state: 'assigned', systemId: 's', subsystemId }, evidenceIds: [] });
const boundary = (id: string, kind: PhysicalFlowEndpoint['kind'], identity: PhysicalFlowEndpoint['identity']): PhysicalFlowEndpoint =>
    ({ id, kind, identity, anchorNodeId: 'entry', evidenceIds: ['proof'] });
const fact = (id: string, sourceId: string, targetId: string, kind: PhysicalFlowFact['kind'] = 'invokes',
    extra: Partial<PhysicalFlowFact> = {}): PhysicalFlowFact => ({ id, sourceId, targetId, kind, discriminator: id, evidenceIds: [`proof:${id}`], ...extra });
const query = (nodes: GraphNode[], facts: PhysicalFlowFact[], endpoints: PhysicalFlowEndpoint[] = [],
    extra: Partial<FlowQueryResult> = {}): FlowQueryResult => ({ kind: 'static', projectId: 'p', generation: 4,
        inputFingerprint: 'input', focusId: 's', nodes, facts, aggregates: [], projectionLevel: 'detail', endpoints, coverage: [],
        coverageStatus: 'complete', diagnostics: [], truncated: false,
        truncation: { nodes: false, facts: false, hops: false, continueDeeper: false, continueFromIds: [] }, ...extra });

test('deterministic left-to-right layout preserves branches, joins and cycle back edges', () => {
    const nodes = [code('entry'), code('left'), code('right'), code('join'), code('output')];
    const facts = [fact('e-l', 'entry', 'left'), fact('e-r', 'entry', 'right'), fact('l-j', 'left', 'join'),
        fact('r-j', 'right', 'join'), fact('j-o', 'join', 'output'), fact('j-e', 'join', 'entry')];
    const input = query(nodes, facts, [], { focusId: 'a' });
    const first = projectFlowMap(input);
    assert.deepEqual(first, projectFlowMap(query([...nodes].reverse(), [...facts].reverse(), [], { focusId: 'a' })));
    const position = (id: string) => first.nodes.find(node => node.id === id)!;
    assert.ok(position('entry').x < position('left').x);
    assert.ok(position('entry').x < position('right').x);
    assert.ok(position('left').x < position('join').x);
    assert.ok(position('right').x < position('join').x);
    assert.ok(position('join').x < position('output').x);
    assert.equal(first.edges.find(edge => edge.id === 'j-e')!.backEdge, true);
    assert.deepEqual(first.edges.filter(edge => edge.source === 'entry').map(edge => edge.target), ['left', 'right']);
    assert.deepEqual(first.edges.filter(edge => edge.target === 'join').map(edge => edge.source), ['left', 'right']);
});

test('System focus uses proven summaries and boundary facts, hiding internal code calls', () => {
    const nodes = [code('entry', 'Entry', 'a'), code('inside', 'Inside', 'a'), code('worker', 'Worker', 'b'),
        { id: 'a', name: 'A', kind: 'subsystem', purpose: '', evidenceIds: [] } as GraphNode,
        { id: 'b', name: 'B', kind: 'subsystem', purpose: '', evidenceIds: [] } as GraphNode];
    const endpoints = [boundary('input', 'http-input', { method: 'POST', path: '/very/long/request/path' }),
        boundary('output', 'http-output', { method: 'POST', path: '/very/long/request/path' }),
        boundary('store', 'store', { connection: 'db/main' }), boundary('external', 'external-service', { service: 'api.example.org' }),
        boundary('queue', 'queue', { channel: 'jobs' })];
    const facts = [fact('in', 'input', 'entry', 'receives'), fact('internal', 'entry', 'inside'),
        fact('cross', 'inside', 'worker'), fact('write', 'worker', 'store', 'writes'),
        fact('call', 'worker', 'external', 'calls-external'), fact('publish', 'worker', 'queue', 'publishes',
            { behavior: { async: true, evidenceIds: ['async-proof'] } }),
        fact('response', 'worker', 'output', 'responds')];
    const aggregates = facts.filter(item => item.id !== 'internal').map(item => fact(`agg:${item.id}`,
        item.sourceId === 'input' ? 'input' : item.sourceId === 'worker' ? 'b' : 'a',
        item.targetId === 'entry' ? 'a' : item.targetId === 'worker' ? 'b' : item.targetId,
        item.kind, { originFlowFactIds: [item.id], behavior: item.behavior }));
    const input = query(nodes, facts, endpoints, { aggregates, projectionLevel: 'system' });
    const original = structuredClone(input);
    const view = projectFlowMap(input, { kind: 'system' });
    assert.deepEqual(input, original);
    assert.deepEqual(view.nodes.map(node => node.id).sort(), ['a', 'b', 'external', 'input', 'output', 'queue', 'store']);
    assert.deepEqual(Object.fromEntries(view.nodes.map(node => [node.id, [node.role, node.shape]])), {
        input: ['Input', 'entry'], a: ['Processing', 'process'], b: ['Processing', 'process'],
        store: ['Store', 'store'], external: ['External', 'external'], output: ['Output', 'exit'], queue: ['Boundary', 'queue']
    });
    assert.equal(view.edges.length, 6);
    assert.equal(view.edges.find(edge => edge.originFlowFactIds[0] === 'publish')!.async, true);
    assert.equal(view.edges.find(edge => edge.originFlowFactIds[0] === 'publish')!.retry, false);
    assert.equal(view.edges.find(edge => edge.originFlowFactIds[0] === 'publish')!.error, false);
    assert.equal(view.nodes.find(node => node.id === 'input')!.name, 'POST /very/long/request/path');
    assert.equal(projectFlowMap(input, { kind: 'system' }, { selectedId: 'inside' }).nodes.find(node => node.id === 'a')!.selected, true);
});

test('trace emphasis subdues unrelated known Flow and keeps diagnostics and truncation visible', () => {
    const facts = [fact('a-b', 'a', 'b'), fact('b-c', 'b', 'c'), fact('x-y', 'x', 'y')];
    const input = query(['a', 'b', 'c', 'x', 'y'].map(id => code(id)), facts, [], {
        coverageStatus: 'truncated', truncated: true,
        coverage: [{ scopeId: 'a', status: 'unsupported', diagnosticIds: ['gap'] }],
        diagnostics: [{ id: 'gap', code: 'unsupported', message: 'Unknown call', scopeId: 'a', evidenceIds: ['proof'] }],
        truncation: { nodes: false, facts: true, hops: false, continueDeeper: true, continueFromIds: ['c'] }
    });
    const original = structuredClone(input);
    const view = projectFlowMap(input, {}, { selectedId: 'a', traceFactIds: ['a-b', 'b-c'] });
    assert.deepEqual(input, original);
    assert.equal(view.edges.find(edge => edge.id === 'x-y')!.subdued, true);
    assert.equal(view.nodes.find(node => node.id === 'y')!.subdued, true);
    assert.equal(view.edges.find(edge => edge.id === 'b-c')!.selected, true);
    assert.equal(view.nodes.find(node => node.id === 'a')!.selected, true);
    assert.equal(view.coverageStatus, 'truncated');
    assert.equal(view.coverage[0].status, 'unsupported');
    assert.equal(view.diagnostics[0].message, 'Unknown call');
    assert.deepEqual(view.truncation.continueFromIds, ['c']);
    view.truncation.continueFromIds.push('changed');
    assert.deepEqual(input.truncation.continueFromIds, ['c']);
});

test('long identity names remain complete and receive space for wrapping', () => {
    const name = `src/${'very_long_directory_name/'.repeat(12)}Handler.process`;
    const view = projectFlowMap(query([code('long', name)], [], [], { selectedId: 'long' }));
    assert.equal(view.nodes[0].name, name);
    assert.ok(view.nodes[0].height > 86);
    assert.ok(view.nodes[0].width <= 480);
});

test('semantic overview renders aggregates without raw origins; trace renders raw facts', () => {
    const aggregate = fact('summary', 'input', 'a', 'receives', { originFlowFactIds: ['raw'], evidenceIds: ['proof'] });
    const endpoint = boundary('input', 'http-input', { method: 'GET', path: '/entry' });
    const overview = query([{ id: 'a', name: 'A', kind: 'subsystem', purpose: '', evidenceIds: [] }], [], [endpoint],
        { aggregates: [aggregate], projectionLevel: 'system' });
    assert.deepEqual(projectFlowMap(overview, { kind: 'system' }).edges.map(edge => edge.originFlowFactIds), [['raw']]);
    assert.deepEqual(projectFlowMap({ ...overview, projectionLevel: 'subsystem' }, { kind: 'subsystem' }).edges.map(edge => edge.id), ['summary']);
    const traced = query([code('handler')], [fact('raw', 'input', 'handler', 'receives')], [endpoint],
        { direction: 'downstream', aggregates: [aggregate], projectionLevel: 'detail' });
    assert.deepEqual(projectFlowMap(traced, { kind: 'system' }).edges.map(edge => edge.id), ['raw']);
});

test('architectural areas with only outbound facts remain Processing, not invented Inputs', () => {
    const area = { id: 'area', name: 'Area', kind: 'subsystem', purpose: '', evidenceIds: [] } as GraphNode;
    const store = boundary('store', 'store', { connection: 'db' });
    const view = projectFlowMap(query([area], [fact('read', 'area', 'store', 'reads')], [store]));
    assert.equal(view.nodes.find(node => node.id === 'area')?.role, 'Processing');
    assert.equal(view.nodes.find(node => node.id === 'store')?.role, 'Store');
});
