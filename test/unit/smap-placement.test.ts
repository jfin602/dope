import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const read = (path: string) => readFileSync(resolve(import.meta.dirname, '../..', path), 'utf8');

test('one canonical sMap Activity Bar contribution defaults left and preserves ordinary workbench wiring', () => {
  const widget = read('packages/theia-extension/src/browser/software-map-widget.ts');
  const frontend = read('packages/theia-extension/src/browser/frontend-module.ts');
  assert.match(widget, /SOFTWARE_MAP_ID = 'dope-software-map'/);
  assert.match(widget, /this\.id = SOFTWARE_MAP_ID/);
  assert.match(widget, /this\.title\.label = 'SMAP CONTROLS'/);
  assert.match(widget, /this\.title\.caption = 'sMap — Software Map'/);
  assert.match(widget, /this\.title\.iconClass = codicon\('type-hierarchy'\)/);
  assert.match(widget, /widgetId: SOFTWARE_MAP_ID, widgetName: 'sMap', defaultWidgetOptions: \{ area: 'left', rank: 200 \}/);
  assert.match(widget, /onDidInitializeLayout\(\)[\s\S]*?await this\.openView\(\)/);
  assert.match(widget, /onActivateRequest[\s\S]*?this\.node\.focus\(\)/);
  assert.equal(frontend.match(/bindViewContribution\(bind, SoftwareMapView\)/g)?.length, 1);
  assert.equal(frontend.match(/bind\(FrontendApplicationContribution\)\.toService\(SoftwareMapView\)/g)?.length, 1);
  assert.equal(frontend.match(/id: SOFTWARE_MAP_ID, createWidget/g)?.length, 1);
  for (const source of [widget, frontend]) {
    assert.doesNotMatch(source, /dope-software-model|SoftwareModelView|SOFTWARE_MODEL_ID/);
  }
  assert.doesNotMatch(widget, /area: 'right'|shell\.(?:addWidget|moveWidget)/);
  assert.doesNotMatch(widget, /\bsoftware model\b/i);
  assert.match(frontend, /bindViewContribution\(bind, ProjectMindView\)/);
  assert.match(frontend, /id: PROJECT_MIND_ID, createWidget/);
  for (const app of ['browser', 'electron']) {
    const dependencies = JSON.parse(read(`apps/${app}/package.json`)).dependencies;
    for (const module of ['navigator', 'editor', 'monaco', 'workspace']) {
      assert.equal(dependencies[`@theia/${module}`], '1.75.0');
    }
  }
  assert.match(JSON.parse(read('package.json')).scripts['test:baseline'], /smap-placement\.test\.ts/);
});
