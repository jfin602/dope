import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readlink, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const script = path.join(repo, 'scripts/local-install.mjs');

test('local install keeps releases, history, launcher, and safe rollback', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'dope-install-'));
  const root = path.join(dir, 'installed');
  const data = path.join(dir, 'share');
  const source = path.join(dir, 'candidate.AppImage');
  const env = { ...process.env, DOPE_INSTALL_ROOT: root, XDG_DATA_HOME: data };
  const run = (...args) => spawnSync(process.execPath, [script, ...args], { env, encoding: 'utf8' });
  try {
    await writeFile(source, Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0, 0x41, 0x49, 2]));
    assert.equal(run('install', '--artifact', source).status, 0);
    const first = path.basename(await readlink(path.join(root, 'current')));
    assert.equal(run('install', '--artifact', source, '--note', 'second build').status, 0);
    const second = path.basename(await readlink(path.join(root, 'current')));
    assert.notEqual(first, second);
    const launcher = await readFile(path.join(data, 'applications/dope.desktop'), 'utf8');
    assert.match(launcher, /current\/Dope\.AppImage/);
    const icon = launcher.match(/^Icon=(.+)$/m)?.[1];
    assert.match(icon, /dope-[a-f0-9]{16}\.png$/);
    assert.deepEqual(await readFile(icon), await readFile(path.join(repo, 'apps/electron/build/icon.png')));
    assert.deepEqual(await readFile(path.join(root, 'releases', second, 'icon.png')), await readFile(icon));
    assert.equal(run('refresh-launcher').status, 0);
    assert.equal(run('rollback', '../bad').status, 1);
    assert.equal(path.basename(await readlink(path.join(root, 'current'))), second);
    await rename(path.join(root, 'releases', first, 'Dope.AppImage'), path.join(root, 'releases', first, 'moved'));
    assert.equal(run('rollback', first).status, 1);
    assert.equal(path.basename(await readlink(path.join(root, 'current'))), second);
    await rename(path.join(root, 'releases', first, 'moved'), path.join(root, 'releases', first, 'Dope.AppImage'));
    const earlierIcon = Buffer.concat([await readFile(icon), Buffer.from([0])]);
    await writeFile(path.join(root, 'releases', first, 'icon.png'), earlierIcon);
    assert.equal(run('rollback', first).status, 0);
    assert.equal(path.basename(await readlink(path.join(root, 'current'))), first);
    const restoredIcon = (await readFile(path.join(data, 'applications/dope.desktop'), 'utf8')).match(/^Icon=(.+)$/m)?.[1];
    assert.notEqual(restoredIcon, icon);
    assert.deepEqual(await readFile(restoredIcon), earlierIcon);
    const history = (await readFile(path.join(root, 'history.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    assert.deepEqual(history.map(item => item.result), ['pending', 'activated', 'pending', 'activated', 'pending', 'activated']);
    assert.equal(history[0].packagePath, source);
    assert.equal(history[2].notes, 'second build');
    assert.match(await readFile(path.join(root, 'BUILD-HISTORY.md'), 'utf8'), new RegExp(`Active: ${first}`));
    assert.equal(run('list').status, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
