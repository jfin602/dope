import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const root = new URL('../../', import.meta.url).pathname;
const paths = ['package.json', 'apps/browser/package.json', 'apps/electron/package.json', 'packages/theia-extension/package.json', 'packages/contracts/package.json'];
const manifests = paths.map(path => ({ path, value: JSON.parse(readFileSync(join(root, path), 'utf8')) }));

test('every directly controlled Theia package stays on the Phase 0 baseline', () => {
  for (const { path, value } of manifests) {
    for (const section of ['dependencies', 'devDependencies']) {
      for (const [name, version] of Object.entries(value[section] ?? {})) {
        if (name.startsWith('@theia/')) assert.equal(version, '1.75.0', `${path}: ${name}`);
      }
    }
  }
  for (const { path, value } of manifests) assert.equal(value.version, '0.0.6', path);
  assert.equal(existsSync(join(root, 'package-lock.json')), false);
});

test('both applications carry the required IDE composition', () => {
  const required = [
    'core', 'debug', 'editor', 'file-search', 'filesystem', 'keymaps', 'markers',
    'monaco', 'navigator', 'plugin-ext-vscode', 'preferences', 'process', 'scm',
    'search-in-workspace', 'terminal', 'vsx-registry', 'workspace',
  ];
  for (const { path, value } of manifests.slice(1, 3)) {
    for (const name of required) assert.equal(value.dependencies[`@theia/${name}`], '1.75.0', `${path}: ${name}`);
    assert.equal(value.dependencies['@dope/theia-extension'], '0.0.6');
    assert.equal(value.theia.frontend.config.applicationName, 'Dope');
  }
  assert.equal(manifests[1].value.theia.target, 'browser');
  assert.equal(manifests[2].value.theia.target, 'electron');
  assert.equal(manifests[2].value.dependencies['@theia/electron'], '1.75.0');
  assert.equal(manifests[2].value.devDependencies.electron, '42.8.1');
  assert.equal(manifests[2].value.productName, 'Dope');
  assert.equal(manifests[2].value.build.executableName, 'dope');
  assert.deepEqual(manifests[2].value.build.linux.target, ['AppImage']);
  assert.equal(manifests[2].value.main, 'scripts/packaged-main.cjs');
  assert.equal(manifests[2].value.build.extraResources[0].to, 'app/plugins');
  assert.match(manifests[0].value.scripts['package:linux'], /npm run download:plugins/);
  assert.equal(manifests[3].value.dependencies['@dope/contracts'], '0.0.6');
  assert.match(manifests[0].value.theiaPlugins['vscode-builtin-extensions'], /\/1\.108\.2\//);
});

test('packaged entrypoint passes bundled plugins before starting Theia', () => {
  const argv = ['dope'];
  const source = readFileSync(join(root, 'apps/electron/scripts/packaged-main.cjs'), 'utf8');
  runInNewContext(source, {
    process: { argv, resourcesPath: '/tmp/Dope/resources' },
    require: (id: string) => {
      if (id === 'node:path') return { join };
      assert.equal(id, '../lib/backend/electron-main.js');
      assert.deepEqual(argv, ['dope', '--plugins=local-dir:/tmp/Dope/resources/app/plugins']);
    },
  });
});
