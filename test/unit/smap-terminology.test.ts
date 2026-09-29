import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../..');
const oldNames = /packages[\\/]software-model\b|@dope\/software-model\b|\b(?:PhysicalSoftwareModel\w*|SoftwareModel\w*|softwareModel\w*|SOFTWARE_MODEL_ID)\b|dope-software-model\b|dope\.softwareModel\b|\/services\/dope\/software-model\b|software-model-(?:widget|controller|backend)\.ts\b|dope-model-(?:view|edge)\b/;

function files(directory: string): string[] {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap(entry => {
    if (['node_modules', 'lib', 'src-gen', 'build'].includes(entry.name)) return [];
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : /\.(?:ts|js|mjs|cjs|json|css)$/.test(path) ? [path] : [];
  });
}

test('current Software Map package, public exports, and workbench IDs stay canonical', () => {
  const read = (path: string) => readFileSync(join(root, path), 'utf8');
  for (const path of ['packages/software-model/package.json', 'packages/software-model/src']) {
    assert.equal(existsSync(join(root, path)), false, `${path}: legacy production package`);
  }
  assert.equal(existsSync(join(root, 'packages/software-map/src/service.ts')), true);
  assert.equal(JSON.parse(read('packages/software-map/package.json')).name, '@dope/software-map');
  for (const module of ['contracts', 'graph', 'service']) {
    assert.match(read('packages/software-map/src/index.ts'), new RegExp(`export \\* from '\\./${module}'`));
  }
  for (const symbol of ['SoftwareMapService', 'SoftwareMapClient', 'softwareMapServicePath']) {
    assert.match(read('packages/software-map/src/service.ts'), new RegExp(`export (?:const|interface) ${symbol}\\b`));
  }
  assert.match(read('packages/software-map/src/contracts.ts'), /export interface PhysicalMapSnapshot\b/);
  assert.match(read('packages/theia-extension/src/browser/software-map-widget.ts'), /dope-software-map/);
  assert.match(read('packages/theia-extension/src/browser/software-map-widget.ts'), /dope\.softwareMap\.open/);
  const manifest = JSON.parse(read('package.json'));
  assert.ok(manifest.workspaces.includes('packages/software-map'));
  for (const script of ['build:extension', 'typecheck']) assert.match(manifest.scripts[script], /@dope\/software-map build/);
  assert.match(manifest.scripts['test:product'], /software-map\.test\.ts/);

  for (const path of ['package.json', 'tsconfig.json', ...files('apps'), ...files('packages'), ...files('scripts')]) {
    assert.doesNotMatch(path, oldNames, `${path}: legacy module`);
    assert.doesNotMatch(read(path), oldNames, `${path}: legacy Software Model wiring`);
  }
});
