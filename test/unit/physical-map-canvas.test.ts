import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import type { ArchitectureViolation, GraphNode, GraphRelationship } from '../../packages/software-map/src/contracts.ts';
import { projectPhysicalMap } from '../../packages/theia-extension/src/browser/physical-map-projection.ts';
const require = createRequire(import.meta.url);
const { SoftwareMapController } = require('../../packages/theia-extension/lib/browser/software-map-controller.js') as
  typeof import('../../packages/theia-extension/src/browser/software-map-controller.ts');
const { PhysicalMapController } = require('../../packages/theia-extension/lib/browser/physical-map-controller.js') as
  typeof import('../../packages/theia-extension/src/browser/physical-map-controller.ts');

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const boundary = (id: string, kind: 'system' | 'subsystem' | 'component', name: string, parentId?: string): GraphNode =>
  ({ id, kind, name, purpose: '', parentId, evidenceIds: [] });
const code = (id: string, systemId?: string, subsystemId?: string): GraphNode => ({
  id, kind: 'code', name: id, path: id, codeKind: 'file', evidenceIds: [],
  ownership: systemId ? { state: 'assigned', systemId, subsystemId } : { state: 'unassigned' }
});

test('overview is deterministic and shows only Systems plus immediate Subsystems', () => {
  const nodes = [boundary('sys-b', 'system', 'Beta'), boundary('sub-z', 'subsystem', 'Zulu', 'sys-b'),
    boundary('sys-a', 'system', 'Alpha'), boundary('sub-b', 'subsystem', 'Bravo', 'sys-a'),
    boundary('sub-a', 'subsystem', 'Alpha', 'sys-a'), boundary('cmp', 'component', 'Hidden', 'sub-a'),
    code('file', 'sys-a', 'sub-a')];
  const first = projectPhysicalMap(nodes, [], []);
  const second = projectPhysicalMap([...nodes].reverse(), [], []);
  assert.deepEqual(first, second);
  assert.deepEqual(first.nodes.map(node => node.id), ['sys-a', 'sub-a', 'sub-b', 'sys-b', 'sub-z']);
  assert.equal(first.oneSystem, false);
  assert.ok(first.nodes.every(node => Number.isFinite(node.x) && Number.isFinite(node.y)));
  assert.ok(first.nodes.find(node => node.id === 'sub-a')!.parentId === 'sys-a');
  assert.ok(first.nodes.find(node => node.id === 'sys-b')!.x > first.nodes.find(node => node.id === 'sys-a')!.x);
});

test('one System is the main frame; state and edge meanings survive without color', () => {
  const nodes = [boundary('s', 'system', 'Main'), boundary('a', 'subsystem', 'A', 's'),
    boundary('b', 'subsystem', 'B', 's'), code('real', 's', 'a'), code('unknown')];
  const dependency: GraphRelationship = { id: 'dep', kind: 'depends-on', sourceId: 'a', targetId: 'b',
    evidenceIds: ['ev'], originRelationshipIds: ['raw'] };
  const violation: ArchitectureViolation = { id: 'v', rule: 'forbidden-dependency', sourceSubsystemId: 'a',
    targetSubsystemId: 'b', originRelationshipIds: ['raw'], evidenceIds: ['ev'] };
  const view = projectPhysicalMap(nodes, [dependency], [violation]);
  assert.equal(view.oneSystem, true);
  assert.equal(view.nodes[0].kind, 'system');
  assert.equal(view.nodes[0].width, 760);
  assert.deepEqual(view.nodes.map(node => [node.id, node.state, node.badge]), [
    ['s', 'drifted', 'Drift'], ['a', 'drifted', 'Drift'], ['b', 'drifted', 'Drift'],
    ['canvas:unassigned', 'unassigned', 'Unassigned']
  ]);
  assert.equal(view.edges.filter(edge => edge.kind === 'containment').length, 2);
  assert.deepEqual(view.edges.find(edge => edge.id === 'dep'), {
    id: 'dep', source: 'a', target: 'b', kind: 'dependency', state: 'drifted', label: 'Dependency · drift'
  });
  const allowed = projectPhysicalMap([...nodes, boundary('c', 'subsystem', 'C', 's')],
    [dependency, { ...dependency, id: 'allowed', targetId: 'c' }], [violation]);
  assert.equal(allowed.edges.find(edge => edge.id === 'allowed')?.state, 'realized');
  assert.equal(projectPhysicalMap(nodes.slice(0, 3), [], []).nodes.find(node => node.id === 'a')!.state, 'declared-only');
  assert.deepEqual(projectPhysicalMap([code('orphan')], [], []).nodes.map(node => [node.state, node.badge]),
    [['detected-only', 'Detected only · Unassigned']]);
});

test('React Flow stays in presentation and registration preserves workbench placement', () => {
  const frontend = read('packages/theia-extension/src/browser/frontend-module.ts');
  const inspector = read('packages/theia-extension/src/browser/software-map-widget.ts');
  const canvas = read('packages/theia-extension/src/browser/physical-map-widget.ts');
  const css = read('packages/theia-extension/src/browser/dope.css');
  assert.match(frontend, /id: PHYSICAL_MAP_ID, createWidget/);
  assert.match(frontend, /new PhysicalMapWidget\(context\.container\.get\(SoftwareMapController\),\s*context\.container\.get\(OpenerService\)/);
  assert.doesNotMatch(frontend, /new PhysicalMapWidget\([\s\S]*?ServiceConnectionProvider\.createProxy<SoftwareMapService>/);
  assert.match(frontend, /registerCommand\(\{ id: 'dope\.physicalMap\.open'/);
  assert.match(frontend, /shell\.addWidget\(widget, \{ area: 'main' \}\)/);
  assert.match(inspector, /Open Physical Map/);
  assert.match(inspector, /defaultWidgetOptions: \{ area: 'left', rank: 200 \}/);
  assert.match(frontend, /bindViewContribution\(bind, ProjectMindView\)/);
  assert.match(frontend, /id: PROJECT_MIND_ID, createWidget/);
  assert.doesNotMatch(canvas, /area: 'left'|area: 'right'|nodesDraggable: true/);
  assert.match(canvas, /Fit Architecture/);
  assert.match(css, /\.dope-map-declared-only \{ border-style: dashed;/);
  assert.match(css, /\.dope-map-edge-containment .*stroke-dasharray/);
  assert.match(css, /\.dope-map-edge-drifted .*stroke-dasharray/);
  for (const path of ['packages/software-map/src/contracts.ts', 'packages/software-map/src/service.ts',
    'packages/visual-planning/src/service.ts']) assert.doesNotMatch(read(path), /@xyflow\/react|ReactFlowInstance|\bNode<.*>/);
});

test('published map loads through the inspector handle; failures and stale queries settle', async () => {
  const architecture = [boundary('system', 'system', 'System'), boundary('subsystem', 'subsystem', 'Subsystem', 'system')];
  const status = { state: 'ready', generation: 1, publishedGeneration: 1 };
  let attaches = 0;
  let fail = false;
  let pending: Array<(page: { generation: number; total: number; items: GraphRelationship[] }) => void> | undefined;
  let queriedHandle = '';
  const service = {
    setClient() {},
    async attach() { attaches++; return { projectHandle: 'accepted-handle', status }; },
    async initializationStatus() { return { state: 'initialized' }; },
    async hierarchy() { return { generation: 1, total: architecture.length, items: architecture }; },
    async violations() { return { generation: 1, total: 0, items: [] }; },
    relationships(request: { projectHandle: string }) {
      queriedHandle = request.projectHandle;
      if (fail) return Promise.reject(new Error('relationship unavailable'));
      if (pending) return new Promise(resolve => { pending!.push(resolve); });
      return Promise.resolve({ generation: 1, total: 0, items: [] });
    }
  };
  const map = new SoftwareMapController(() => service as any, () => {});
  await map.attach('file:///accepted');
  const canvas = new PhysicalMapController(map, () => {});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(attaches, 1);
  assert.equal(queriedHandle, 'accepted-handle');
  assert.equal(canvas.loading, false);
  assert.deepEqual(canvas.projection.nodes.map(node => node.id), ['system', 'subsystem']);

  fail = true;
  canvas.focus('system');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(canvas.loading, false);
  assert.match(canvas.error, /relationship unavailable/);

  fail = false;
  pending = [];
  canvas.fit();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(canvas.loading, true);
  map.status = { ...status, generation: 2, publishedGeneration: 2 } as any;
  for (const resolve of pending) resolve({ generation: 1, total: 0, items: [] });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(canvas.loading, false);
  assert.equal(canvas.projection.nodes.length, 0);
  canvas.dispose();
  map.dispose();
});
