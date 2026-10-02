import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import type { FlowQueryResult, GraphNode } from '../../packages/software-map/lib/index.js';
import type { SoftwareMapController } from '../../packages/theia-extension/src/browser/software-map-controller.ts';

const require = createRequire(import.meta.url);
const { PhysicalMapController } = require('../../packages/theia-extension/lib/browser/physical-map-controller.js') as
    typeof import('../../packages/theia-extension/src/browser/physical-map-controller.ts');
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
const nodes: GraphNode[] = [
    { id: 's', kind: 'system', name: 'System', purpose: '', evidenceIds: [] },
    { id: 'a', kind: 'subsystem', name: 'A', parentId: 's', purpose: '', evidenceIds: [] },
    { id: 'b', kind: 'subsystem', name: 'B', parentId: 's', purpose: '', evidenceIds: [] },
    { id: 'entry', kind: 'code', name: 'entry', parentId: 'a', codeKind: 'symbol', path: 'src/a.ts', evidenceIds: ['ev'],
        ownership: { state: 'assigned', systemId: 's', subsystemId: 'a' } },
    { id: 'worker', kind: 'code', name: 'worker', parentId: 'b', codeKind: 'symbol', path: 'src/b.ts', evidenceIds: ['ev'],
        ownership: { state: 'assigned', systemId: 's', subsystemId: 'b' } }
];
const input = { id: 'input', kind: 'http-input' as const, identity: { method: 'GET', path: '/entry' }, anchorNodeId: 'entry', evidenceIds: ['ev'] };
const raw = [
    { id: 'in', kind: 'receives' as const, sourceId: 'input', targetId: 'entry', discriminator: 'in', evidenceIds: ['ev'] },
    { id: 'call', kind: 'invokes' as const, sourceId: 'entry', targetId: 'worker', discriminator: 'call', evidenceIds: ['ev'] }
];
const result = (generation = 1): FlowQueryResult => ({ kind: 'static', projectId: 'project:root', generation, inputFingerprint: 'fingerprint',
    focusId: 's', nodes, endpoints: [input], facts: raw, aggregates: [
        { ...raw[0], id: 'sum-in', targetId: 'a', originFlowFactIds: ['in'] },
        { ...raw[1], id: 'sum-call', sourceId: 'a', targetId: 'b', originFlowFactIds: ['call'] }
    ], coverage: [{ scopeId: 's', status: 'partial', diagnosticIds: ['gap'] }], coverageStatus: 'partial',
    diagnostics: [{ id: 'gap', code: 'unsupported', message: 'Unsupported callback', scopeId: 's', evidenceIds: ['ev'] }],
    truncated: false, truncation: { nodes: false, facts: false, hops: false, continueDeeper: false, continueFromIds: [] } });

function harness() {
    const listeners = new Set<() => void>();
    const queries: Array<{ generation: number; focusId?: string; selectedId?: string; direction?: string }> = [];
    const map = {
        workspace: 'file:///A', loading: false,
        status: { state: 'ready', generation: 1, publishedGeneration: 1 },
        nodes, violations: [], selectedId: undefined as string | undefined,
        onChange(listener: () => void) { listeners.add(listener); return { dispose: () => { listeners.delete(listener); } }; },
        async select(id: string) { this.selectedId = id; listeners.forEach(listener => listener()); },
        relationshipPage() { return Promise.resolve({ generation: this.status.generation, total: 0, items: [] }); },
        flowQuery(query: { generation: number; focusId?: string; selectedId?: string; direction?: string }) {
            queries.push(query); return Promise.resolve({ ...result(query.generation), focusId: query.focusId,
                facts: query.direction === 'upstream' ? [raw[0]] : raw });
        },
        evidenceDetails() { return Promise.resolve([{ id: 'ev', class: 'semantic', producer: 'fixture',
            producerVersion: '1', path: 'src/a.ts', span: { start: 0, length: 1, line: 4 } }]); },
        source(id: string) { return Promise.resolve(id === 'ev' ? { uri: 'file:///A/src/a.ts', path: 'src/a.ts' } : undefined); }
    };
    const controller = new PhysicalMapController(map as unknown as SoftwareMapController, () => {});
    return { controller, map, queries, listeners };
}

test('Architecture and Flow share focus, selection and source; System overview and traces use the query seam', async () => {
    const { controller, map, queries } = harness();
    await flush();
    controller.focus('s'); await flush();
    controller.select('a'); await flush();
    controller.setMode('flow'); await flush();
    assert.equal(controller.focusId, 's');
    assert.equal(controller.selectedId, 'a');
    assert.deepEqual(controller.flowProjection?.nodes.map(node => node.id).sort(), ['a', 'b', 'input']);
    assert.equal(controller.flowProjection?.coverageStatus, 'partial');
    assert.equal(controller.flowProjection?.diagnostics[0].message, 'Unsupported callback');
    controller.select('input'); await flush();
    assert.equal(map.selectedId, 'a');
    controller.trace('downstream'); await flush();
    assert.ok(queries.some(query => query.selectedId === 'input' && query.direction === 'downstream'));
    controller.trace('upstream'); await flush();
    assert.ok(queries.some(query => query.selectedId === 'input' && query.direction === 'upstream'));
    controller.trace(); await flush();
    assert.equal(controller.direction, undefined);
    await controller.inspectFlowEdge('sum-in');
    assert.equal(controller.flowEvidence[0].path, 'src/a.ts');
    assert.equal((await controller.flowSource())?.uri, 'file:///A/src/a.ts');
    controller.setMode('architecture'); await flush();
    assert.equal(controller.focusId, 's');
    assert.equal(controller.selectedId, 'a');
    assert.equal((await controller.source()), undefined);
    controller.dispose();
});

test('late project, generation, mode, focus, trace and disposed results cannot publish', async () => {
    const { controller, map, listeners } = harness();
    await flush();
    const pending: Array<(value: FlowQueryResult) => void> = [];
    map.flowQuery = () => new Promise(resolve => { pending.push(resolve); });
    controller.setMode('flow'); await flush();
    controller.focus('a'); pending.shift()!(result()); await flush();
    assert.equal(controller.flowProjection, undefined);
    controller.select('entry'); await flush();
    controller.flowResult = result();
    controller.trace('downstream'); pending.shift()!(result()); await flush();
    assert.equal(controller.flowProjection, undefined);
    controller.setMode('architecture'); pending.shift()!(result()); await flush();
    assert.equal(controller.flowProjection, undefined);
    controller.setMode('flow'); await flush();
    map.status = { state: 'ready', generation: 2, publishedGeneration: 2 };
    listeners.forEach(listener => listener()); pending.shift()!(result()); await flush();
    assert.equal(controller.flowProjection, undefined);
    map.workspace = 'file:///B'; listeners.forEach(listener => listener()); pending.shift()!(result(2)); await flush();
    assert.equal(controller.flowProjection, undefined);
    controller.dispose(); pending.shift()!(result(2)); await flush();
    assert.equal(controller.flowProjection, undefined);
});

test('truncation remains explicit and late edge evidence is discarded', async () => {
    const { controller, map } = harness();
    await flush(); controller.focus('s'); await flush(); controller.setMode('flow'); await flush();
    controller.select('input'); await flush();
    map.flowQuery = query => Promise.resolve(query.direction ? { ...result(query.generation), truncated: true,
        coverageStatus: 'truncated' as const,
        truncation: { nodes: false, facts: false, hops: true, continueDeeper: true, continueFromIds: ['worker'] } } : result(query.generation));
    controller.trace('downstream'); await flush();
    assert.equal(controller.flowProjection?.coverageStatus, 'truncated');
    assert.deepEqual(controller.flowProjection?.truncation.continueFromIds, ['worker']);
    let finish!: (value: Awaited<ReturnType<typeof map.evidenceDetails>>) => void;
    map.evidenceDetails = () => new Promise(resolve => { finish = resolve; });
    const inspection = controller.inspectFlowEdge('sum-in');
    controller.setMode('architecture'); finish([{ id: 'ev', class: 'semantic', producer: 'fixture', producerVersion: '1' }]);
    await inspection;
    assert.deepEqual(controller.flowEvidence, []);
    controller.dispose();
});

test('Flow controls are keyboard-native, theme-based and absent from Planning Map UI', () => {
    const widget = readFileSync(resolve(import.meta.dirname, '../../packages/theia-extension/src/browser/physical-map-widget.ts'), 'utf8');
    const css = readFileSync(resolve(import.meta.dirname, '../../packages/theia-extension/src/browser/dope.css'), 'utf8');
    assert.match(widget, /this\.modeBar\.hidden = planningMode/);
    assert.match(widget, /planning\.planningMode && this\.controller\.mode === 'flow'/);
    for (const label of ['Architecture', 'Flow', 'Trace downstream', 'Trace upstream', 'Clear trace', 'Open edge source'])
        assert.ok(widget.includes(label));
    assert.match(widget, /edgeList\.append\(control\)/);
    assert.match(widget, /aria-pressed/);
    assert.match(css, /dope-flow-entry, \.dope-flow-exit \{ border-width: 3px; border-radius: 18px/);
    assert.match(css, /dope-flow-store \{ border-style: double/);
    assert.match(css, /var\(--theia-focusBorder\)/);
});

test('grouped System relationship can drill to a member trace and its Subsystem', async () => {
    const { controller, map, queries } = harness();
    await flush(); controller.focus('s'); await flush();
    map.flowQuery = query => {
        queries.push(query);
        return Promise.resolve(query.direction ? { ...result(query.generation), direction: query.direction, aggregates: [] } :
            { ...result(query.generation), facts: [raw[0]], nodes: [nodes[1]], endpoints: [input],
                groups: [{ id: 'flow:group:http-input:a', name: 'Inputs · A', role: 'Input' as const, focusId: 'a',
                    memberIds: ['input'], members: [{ id: 'input', name: 'GET /entry' }] }],
                aggregates: [{ ...raw[0], id: 'summary', sourceId: 'flow:group:http-input:a', targetId: 'a',
                    originFlowFactIds: ['in'], originParticipants: [{ id: 'in', sourceId: 'input', targetId: 'entry' }] }] });
    };
    controller.setMode('flow'); await flush();
    assert.deepEqual(controller.flowProjection?.nodes.map(node => node.id).sort(), ['a', 'flow:group:http-input:a']);
    controller.select('flow:group:http-input:a');
    assert.equal(controller.flowSelectedId, undefined);
    assert.equal(controller.selectedGroupId, 'flow:group:http-input:a');
    controller.traceOrigin(controller.flowProjection!.edges[0].originParticipants[0].sourceId); await flush();
    assert.ok(queries.some(query => query.selectedId === 'input' && query.direction === 'downstream'));
    controller.trace(); await flush();
    controller.select('flow:group:http-input:a'); controller.focus('flow:group:http-input:a'); await flush();
    assert.equal(controller.focusId, 'a');
    controller.dispose();
});
