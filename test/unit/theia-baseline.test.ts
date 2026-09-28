import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const root = new URL('../../', import.meta.url).pathname;
const paths = ['package.json', 'apps/browser/package.json', 'apps/electron/package.json', 'packages/theia-extension/package.json', 'packages/contracts/package.json', 'packages/project-intelligence/package.json', 'packages/planning/package.json'];
const manifests = paths.map(path => ({ path, value: JSON.parse(readFileSync(join(root, path), 'utf8')) }));

test('Theia stays on the qualified baseline and package versions stay coherent', () => {
  for (const { path, value } of manifests) {
    for (const section of ['dependencies', 'devDependencies']) {
      for (const [name, version] of Object.entries(value[section] ?? {})) {
        if (name.startsWith('@theia/')) assert.equal(version, '1.75.0', `${path}: ${name}`);
      }
    }
  }
  for (const { path, value } of manifests) assert.equal(value.version, '0.3.4', path);
  for (const { path, value } of manifests) for (const [name, version] of Object.entries(value.dependencies ?? {})) {
    if (name.startsWith('@dope/')) assert.equal(version, '0.3.4', `${path}: ${name}`);
  }
  assert.equal(existsSync(join(root, 'package-lock.json')), false);
});

test('both applications carry the required IDE composition', () => {
  const required = [
    'core', 'debug', 'editor', 'file-search', 'filesystem', 'keymaps', 'markers',
    'monaco', 'navigator', 'plugin-ext-vscode', 'preferences', 'process', 'scm',
    'search-in-workspace', 'test', 'terminal', 'vsx-registry', 'workspace',
  ];
  for (const { path, value } of manifests.slice(1, 3)) {
    for (const name of required) assert.equal(value.dependencies[`@theia/${name}`], '1.75.0', `${path}: ${name}`);
    assert.equal(value.dependencies['@dope/theia-extension'], '0.3.4');
    assert.equal(value.theia.frontend.config.applicationName, 'Dope');
    assert.equal(value.theia.frontend.config.defaultTheme, 'dark');
    assert.equal(value.theia.frontend.config.preferences['jestrunner.enableTestExplorer'], true);
  }
  assert.equal(manifests[1].value.theia.target, 'browser');
  assert.equal(manifests[2].value.theia.target, 'electron');
  assert.equal(manifests[2].value.dependencies['@theia/electron'], '1.75.0');
  assert.equal(manifests[2].value.devDependencies.electron, '42.8.1');
  assert.equal(manifests[2].value.productName, 'Dope');
  assert.equal(manifests[2].value.author, 'Dope Contributors');
  assert.equal(manifests[2].value.desktopName, 'Dope');
  assert.equal(manifests[2].value.build.appId, 'dev.dope.desktop');
  assert.equal(manifests[2].value.build.executableName, 'dope');
  const iconPath = manifests[2].value.build.linux.icon;
  assert.equal(iconPath, 'build/icon.png');
  const icon = readFileSync(join(root, 'apps/electron', iconPath));
  assert.equal(icon.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(icon.readUInt32BE(16), 512);
  assert.equal(icon.readUInt32BE(20), 512);
  assert.ok(icon.length > 10_000);
  assert.deepEqual(manifests[2].value.build.linux.target, ['AppImage']);
  assert.deepEqual(manifests[2].value.build.appImage.executableArgs, []);
  assert.equal(manifests[2].value.main, 'scripts/packaged-main.cjs');
  assert.equal(manifests[2].value.build.extraResources[0].to, 'app/plugins');
  assert.match(manifests[0].value.scripts['package:linux'], /npm run download:plugins/);
  assert.equal(manifests[3].value.dependencies['@dope/contracts'], '0.3.4');
  assert.equal(manifests[3].value.dependencies['@dope/project-intelligence'], '0.3.4');
  assert.equal(manifests[3].value.dependencies['@dope/planning'], '0.3.4');
  assert.equal(manifests[5].value.dependencies['@dope/contracts'], '0.3.4');
  assert.equal(manifests[6].value.dependencies['@dope/contracts'], '0.3.4');
  assert.match(manifests[0].value.scripts['test:product'], /planning\.test\.ts/);
  assert.match(manifests[0].value.scripts['test:product'], /planning-storage\.test\.ts/);
  assert.match(manifests[0].value.scripts['test:product'], /planning-ui\.test\.ts/);
  assert.match(manifests[0].value.scripts['typecheck'], /@dope\/planning build/);
  assert.ok(manifests[0].value.workspaces.includes('packages/project-intelligence'));
  assert.match(manifests[0].value.scripts['build:extension'], /@dope\/project-intelligence build/);
  assert.match(manifests[0].value.scripts['test:product'], /project-intelligence\.test\.ts/);
  assert.match(manifests[0].value.scripts['test:product'], /project-mind-storage\.test\.ts/);
  assert.match(manifests[0].value.theiaPlugins['vscode-builtin-extensions'], /\/1\.108\.2\//);
  assert.match(manifests[0].value.theiaPlugins['firsttris.vscode-jest-runner'], /\/0\.4\.149\/file\/firsttris\.vscode-jest-runner-0\.4\.149\.vsix$/);
  for (const id of ['ms-vscode.js-debug', 'vscode.typescript-language-features', 'vscode.javascript', 'vscode.json-language-features', 'vscode.git']) {
    assert.ok(!manifests[0].value.theiaPluginsExcludeIds.includes(id), `${id} must stay bundled`);
  }
  assert.match(manifests[0].value.scripts['package:linux'], /plugins\/firsttris\.vscode-jest-runner\/extension\/package\.json/);
  assert.match(manifests[0].value.scripts['test:ide'], /node --test test\/fixtures\/ide-testing\/sample\.test\.js/);
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
