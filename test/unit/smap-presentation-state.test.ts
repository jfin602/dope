import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { SmapPresentationState, nodeColorStorageKey, nodePalette, automaticSystemColor, architectureColors } = require('../../packages/theia-extension/lib/browser/smap-presentation-state.js') as
  typeof import('../../packages/theia-extension/src/browser/smap-presentation-state.ts');
const read = (path: string) => readFileSync(resolve(import.meta.dirname, '../..', path), 'utf8');

test('versioned preferences restore by workspace and persist only curated keys', async () => {
  const data = new Map<string, unknown>();
  const storage = {
    getData: async <T>(key: string): Promise<T | undefined> => data.get(key) as T | undefined,
    setData: async <T>(key: string, value: T): Promise<void> => { data.set(key, value); }
  };
  const colors = new SmapPresentationState(storage);
  await colors.attach('file:///project-a');
  await colors.set('system', 'blue');
  assert.deepEqual(data.get(nodeColorStorageKey('file:///project-a')),
    { version: 1, workspace: 'file:///project-a', colors: { system: 'blue' } });
  await colors.attach('file:///project-b');
  assert.equal(colors.get('system'), 'default');
  await colors.set('system', 'green');
  await colors.attach('file:///project-a');
  assert.equal(colors.get('system'), 'blue');
  const reopened = new SmapPresentationState(storage);
  await reopened.attach('file:///project-a');
  assert.equal(reopened.get('system'), 'blue');
  await reopened.set('system', 'default');
  assert.equal(reopened.get('system'), 'default');
  assert.deepEqual(data.get(nodeColorStorageKey('file:///project-a')),
    { version: 1, workspace: 'file:///project-a', colors: {} });
  assert.equal((data.get(nodeColorStorageKey('file:///project-b')) as { colors: Record<string, string> }).colors.system, 'green');
  data.set(nodeColorStorageKey('file:///project-a'), { version: 1, workspace: 'file:///project-a',
    colors: { valid: 'purple', invalid: 'raw-hex', reset: 'default' } });
  await reopened.attach('file:///project-b');
  await reopened.attach('file:///project-a');
  assert.equal(reopened.get('valid'), 'purple');
  assert.equal(reopened.get('invalid'), 'default');
  assert.equal(reopened.get('reset'), 'default');
  await reopened.set('another', 'orange');
  assert.deepEqual(data.get(nodeColorStorageKey('file:///project-a')),
    { version: 1, workspace: 'file:///project-a', colors: { valid: 'purple', another: 'orange' } });
  data.set(nodeColorStorageKey('unsupported'), { version: 2, workspace: 'unsupported', colors: { valid: 'blue' } });
  await reopened.attach('unsupported');
  assert.equal(reopened.get('valid'), 'default');
});

test('late restore from an old project cannot repaint a new project or undo an immediate edit', async () => {
  const pending = new Map<string, (value: unknown) => void>();
  const storage = {
    getData: <T>(key: string): Promise<T | undefined> => new Promise(resolve => { pending.set(key, resolve); }),
    setData: async <T>(_key: string, _value: T): Promise<void> => {}
  };
  const colors = new SmapPresentationState(storage);
  const old = colors.attach('A');
  const current = colors.attach('B');
  pending.get(nodeColorStorageKey('B'))!({ version: 1, workspace: 'B', colors: { same: 'green' } });
  await current;
  pending.get(nodeColorStorageKey('A'))!({ version: 1, workspace: 'A', colors: { same: 'blue' } });
  await old;
  assert.equal(colors.get('same'), 'green');
  const reload = colors.attach('C');
  await colors.set('same', 'orange');
  pending.get(nodeColorStorageKey('C'))!({ version: 1, workspace: 'C', colors: { same: 'purple' } });
  await reload;
  assert.equal(colors.get('same'), 'orange');
});

test('ten automatic colors resolve from stable System identity and nearest explicit ancestor', async () => {
  assert.deepEqual(nodePalette, ['default', 'blue', 'cyan', 'teal', 'green', 'yellow', 'orange', 'red', 'pink', 'purple', 'indigo']);
  const writes: unknown[] = [];
  const colors = new SmapPresentationState({ getData: async () => undefined, setData: async (_key, value) => { writes.push(value); } });
  await colors.attach('project');
  const nodes = [
    { id: 'system-a', kind: 'system' }, { id: 'sub-a', kind: 'subsystem', parentId: 'system-a' },
    { id: 'comp-a', kind: 'component', parentId: 'sub-a' }, { id: 'code-a', kind: 'code', parentId: 'comp-a' },
    { id: 'system-b', kind: 'system' }
  ];
  const get = (items = nodes) => architectureColors(items, [], id => colors.get(id));
  assert.equal(get()('system-a'), automaticSystemColor('system-a'));
  assert.equal(get()('comp-a'), get()('system-a'));
  assert.equal(get([...nodes].reverse())('comp-a'), get()('comp-a'));
  assert.equal(automaticSystemColor('system-a'), automaticSystemColor('system-a'));
  assert.equal(writes.length, 0);
  await colors.set('sub-a', 'purple');
  assert.equal(get()('code-a'), 'purple');
  await colors.set('comp-a', 'green');
  assert.equal(get()('code-a'), 'green');
  await colors.set('comp-a', 'default');
  assert.equal(get()('code-a'), 'purple');
  await colors.set('sub-a', 'default');
  assert.equal(get()('code-a'), automaticSystemColor('system-a'));
  assert.equal(get()('system-b'), automaticSystemColor('system-b'));
  assert.equal(architectureColors([{ id: 'new-system', kind: 'system' }, { id: 'new-child', kind: 'component', parentId: 'new-system' }], [], id => colors.get(id))('new-child'), automaticSystemColor('new-system'));
  assert.equal(architectureColors([{ id: 'comp-a', kind: 'component', parentId: 'system-b' }], nodes, id => colors.get(id))('comp-a'), automaticSystemColor('system-b'));
  assert.equal(architectureColors([{ id: 'comp-a', kind: 'component' }], nodes, id => colors.get(id))('comp-a'), automaticSystemColor('system-a'));
  assert.equal(architectureColors([{ id: 'context', kind: 'component' }], nodes, id => colors.get(id))('context'), 'default');
});

test('both map modes share one identity lookup and color cannot replace semantic cues', () => {
  const widget = read('packages/theia-extension/src/browser/physical-map-widget.ts');
  const css = read('packages/theia-extension/src/browser/dope.css');
  const frontend = read('packages/theia-extension/src/browser/frontend-module.ts');
  const store = read('packages/theia-extension/src/browser/smap-presentation-state.ts');
  assert.match(widget, /planningMode && selectedMap \? projectPlanningMap/);
  assert.match(widget, /data: \{ item, editable: planningMode && !!selectedMap, color: effectiveColor\(item\.id\) \}/);
  assert.match(widget, /this\.colorSelect\.disabled = !this\.controller\.projectMatches \|\| !selectedNode/);
  assert.match(widget, /architectureColors\(projection\.nodes, this\.controller\.sourceNodes/);
  assert.match(widget, /aria-haspopup', 'listbox'/);
  assert.match(widget, /option\.append\(swatch, label\)/);
  assert.match(widget, /event\.key === 'ArrowDown'/);
  assert.match(widget, /event\.key === 'Escape'/);
  assert.match(widget, /color === 'default' \? 'Automatic'/);
  assert.match(frontend, /bind\(SmapPresentationState\).*inSingletonScope\(\)/);
  assert.doesNotMatch(store, /\.dope\/|@dope\/|SoftwareMapService|VisualPlanningService/);
  for (const color of nodePalette.slice(1))
    assert.match(css, new RegExp(`\\.dope-map-color-${color} \\{ --map-accent:`));
  for (const [kind, fill] of [['system', '27'], ['subsystem', '9'], ['component', '21'], ['code', '6']])
    assert.match(css, new RegExp(`\\.dope-map-node\\.dope-map-${kind} \\{ --map-fill: ${fill}%; \\}`));
  assert.match(css, /\.dope-map-node \{[^}]*color: var\(--theia-editor-foreground\)/);
  for (const cue of ['map-unassigned', 'map-detected-only', 'map-declared-only', 'map-drifted', 'plan-add', 'plan-modify', 'plan-remove', 'plan-stale', 'plan-conflicted'])
    assert.match(css, new RegExp(`\\.dope-${cue}\\b`));
  assert.match(css, /\.dope-map-drifted \{[^}]*border-color/);
  assert.match(css, /\.dope-plan-add \{[^}]*border-style/);
  assert.match(css, /\.dope-plan-stale \{[^}]*outline/);
  assert.match(css, /\.dope-map-node\[class\*="dope-map-color-"\]:not\(\.dope-map-color-default\)/);
  for (const path of ['packages/software-map/src/index.ts', 'packages/visual-planning/src/index.ts', 'packages/theia-extension/src/browser/physical-map-projection.ts'])
    assert.doesNotMatch(read(path), /nodePalette|nodeColorStorageKey|smap-presentation-state/);
});
