import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import type { GraphNode, GraphRelationship } from '../../packages/software-map/src/index.ts';
import { projectPhysicalMap } from '../../packages/theia-extension/src/browser/physical-map-projection.ts';
import type { SoftwareMapController } from '../../packages/theia-extension/src/browser/software-map-controller.ts';
const require = createRequire(import.meta.url);
const { PhysicalMapController, physicalMapTabId, physicalMapTabOptions } = require('../../packages/theia-extension/lib/browser/physical-map-controller.js') as
  typeof import('../../packages/theia-extension/src/browser/physical-map-controller.ts');

const boundary = (id: string, kind: 'system' | 'subsystem' | 'component', parentId?: string): GraphNode =>
  ({ id, kind, name: id, parentId, purpose: '', evidenceIds: ['declaration'] });
const code = (id: string, parentId: string): GraphNode => ({ id, kind: 'code', name: id, path: `${id}.ts`, parentId,
  codeKind: 'file', evidenceIds: ['source'], ownership: { state: 'assigned', systemId: 's', subsystemId: 'sub', componentId: 'cmp' } });
const nodes: GraphNode[] = [boundary('s', 'system'), boundary('sub', 'subsystem', 's'),
  boundary('cmp', 'component', 'sub'), code('file', 'cmp'), boundary('other', 'system'), boundary('outside', 'subsystem', 'other')];
const dependency: GraphRelationship = { id: 'dependency', kind: 'depends-on', sourceId: 'sub', targetId: 'outside',
  evidenceIds: ['source'], originRelationshipIds: ['raw'] };
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

function harness() {
  const listeners = new Set<() => void>();
  const service = { async relationships(request: { nodeId: string; direction: string }) {
    const items = request.nodeId === 'sub' && request.direction === 'outgoing' ? [dependency] : [];
    return { generation: 1, total: items.length, items };
  } };
  const map = {
    workspace: 'file:///A', loading: false,
    status: { state: 'ready', generation: 1, publishedGeneration: 1 },
    nodes, violations: [], selectedId: undefined as string | undefined,
    onChange(listener: () => void) { listeners.add(listener); return { dispose: () => { listeners.delete(listener); } }; },
    async select(id: string) { this.selectedId = id; for (const listener of listeners) listener(); },
    async source(id: string) { return id === 'source' ? { uri: 'file:///A/file.ts', path: 'file.ts', span: { start: 0, length: 1, line: 3, column: 2 } } : undefined; },
    relationshipPage(request: { nodeId: string; direction: string }) { return service.relationships(request); }
  };
  const controller = new PhysicalMapController(map as unknown as SoftwareMapController, () => {}, 'file:///A');
  return { controller, map, service, listeners };
}

test('focus, up, fit and code detail retain shared selection identity', async () => {
  const { controller, map } = harness();
  await flush();
  controller.select('sub');
  await flush();
  controller.focus();
  await flush();
  assert.equal(controller.focusId, 'sub');
  assert.deepEqual(controller.breadcrumbs.map(node => node.id), ['s', 'sub']);
  assert.deepEqual(controller.projection.nodes.slice(0, 2).map(node => node.id), ['sub', 'cmp']);
  controller.focus('cmp');
  await flush();
  assert.deepEqual(controller.projection.nodes.map(node => node.id), ['cmp', 'file']);
  assert.equal(controller.selectedId, 'sub');
  controller.select('file');
  await flush();
  assert.equal(map.selectedId, 'file');
  assert.equal((await controller.source())?.uri, 'file:///A/file.ts');
  controller.up();
  await flush();
  assert.equal(controller.focusId, 'sub');
  controller.fit();
  await flush();
  assert.equal(controller.focusId, undefined);
  assert.equal(controller.selectedId, 'file');
  assert.deepEqual(controller.projection.nodes.filter(node => node.kind === 'component'), []);
  controller.dispose();
});

test('focused projection keeps simplified cross-boundary dependency context', () => {
  const view = projectPhysicalMap(nodes, [dependency], [], 's');
  assert.deepEqual(view.nodes.map(node => [node.id, !!node.context]), [['s', false], ['sub', false], ['outside', true]]);
  assert.deepEqual(view.edges.filter(edge => edge.kind === 'dependency').map(edge => [edge.source, edge.target]), [['sub', 'outside']]);
});

test('focused tabs are keyed by project and identity, with shared controller state only', () => {
  assert.equal(physicalMapTabId(physicalMapTabOptions('file:///A', 's')),
    physicalMapTabId(physicalMapTabOptions('file:///A', 's')));
  assert.notEqual(physicalMapTabId(physicalMapTabOptions('file:///A', 's')),
    physicalMapTabId(physicalMapTabOptions('file:///B', 's')));
  const frontend = readFileSync(resolve(import.meta.dirname, '../../packages/theia-extension/src/browser/frontend-module.ts'), 'utf8');
  const widget = readFileSync(resolve(import.meta.dirname, '../../packages/theia-extension/src/browser/physical-map-widget.ts'), 'utf8');
  assert.match(frontend, /getOrCreateWidget<PhysicalMapWidget>\(PHYSICAL_MAP_ID, options\)/);
  assert.match(frontend, /map\?\.workspace !== options\.workspace/);
  assert.match(widget, /new PhysicalMapController\(map, \(\) => this\.render\(\)/);
  for (const file of ['packages/software-map/src/contracts.ts', 'packages/visual-planning/src/service.ts']) {
    assert.doesNotMatch(readFileSync(resolve(import.meta.dirname, '../..', file), 'utf8'), /PhysicalMapTabOptions|focusId|viewport/);
  }
});

test('project switch and disposal suppress late tab data and source intent', async () => {
  let complete!: (value: { generation: number; total: number; items: GraphRelationship[] }) => void;
  const { controller, map, service } = harness();
  await flush();
  service.relationships = () => new Promise(resolve => { complete = resolve; });
  controller.focus('s');
  map.workspace = 'file:///B';
  complete({ generation: 1, total: 0, items: [] });
  await flush();
  assert.deepEqual(controller.projection.nodes, []);
  assert.equal(await controller.source(), undefined);
  controller.dispose();
  map.workspace = 'file:///A';
  assert.equal(await controller.source(), undefined);
});

test('overview focus does not carry a matching node ID into another project', async () => {
  const { map, listeners, controller: focused } = harness();
  const overview = new PhysicalMapController(map as unknown as SoftwareMapController, () => {});
  await flush();
  overview.focus('s');
  await flush();
  map.workspace = 'file:///B';
  map.loading = true;
  for (const listener of listeners) listener();
  assert.equal(overview.focusId, undefined);
  assert.deepEqual(overview.projection.nodes, []);
  overview.dispose();
  focused.dispose();
});
