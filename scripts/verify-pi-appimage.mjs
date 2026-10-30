#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { constants } from 'node:fs';
import { access, lstat, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimeSource = path.join(repo, 'packages/pi-runtime');
const manifest = JSON.parse(await readFile(path.join(repo, 'apps/electron/package.json'), 'utf8'));
const artifact = path.join(repo, 'dist/linux', `Dope-${manifest.version}.AppImage`);
const temp = await mkdtemp(path.join(tmpdir(), 'dope-pi-appimage-'));

try {
  await access(artifact, constants.X_OK);
  // Extract the actual delivered image, including extraResources outside app.asar.
  execFileSync(artifact, ['--appimage-extract'], { cwd: temp, stdio: 'ignore', timeout: 120_000 });
  const root = path.join(temp, 'squashfs-root');
  await access(path.join(root, 'dope'), constants.X_OK);
  await access(path.join(root, 'resources/app.asar'));
  const runtime = path.join(root, 'resources/app/pi-runtime');
  for (const file of ['worker.mjs', 'package.json', 'package-lock.json', 'LICENSE.pi', 'NOTICE.md'])
    await access(path.join(runtime, file));
  for (const file of ['worker.mjs', 'package.json', 'package-lock.json', 'LICENSE.pi', 'NOTICE.md']) {
    const source = await readFile(path.join(runtimeSource, file));
    const packed = await readFile(path.join(runtime, file));
    if (!source.equals(packed)) throw new Error(`Packaged Pi ${file} differs from source`);
  }
  const packedLock = await readFile(path.join(runtime, 'package-lock.json'));
  const lock = JSON.parse(packedLock.toString('utf8'));
  const piVersion = lock.packages['node_modules/@earendil-works/pi-coding-agent']?.version;
  if (piVersion !== '1.4.0' || lock.version !== manifest.version)
    throw new Error('Packaged Pi version or Dope version mismatch');
  for (const name of Object.keys(lock.packages)) {
    if (!name) continue;
    const relative = `${name}/package.json`;
    const file = path.join(runtime, relative);
    if (!(await lstat(file).catch(() => undefined))?.isFile())
      throw new Error(`Packaged Pi dependency missing: ${relative}`);
  }
  const notice = await readFile(path.join(runtime, 'NOTICE.md'), 'utf8');
  const license = await readFile(path.join(runtime, 'LICENSE.pi'), 'utf8');
  if (!notice.includes('@earendil-works/pi-coding-agent') || !license.includes('MIT License'))
    throw new Error('Packaged Pi notice or license missing');
  console.log(`AppImage ${manifest.version}: Pi ${piVersion}, ${Object.keys(lock.packages).length - 1} locked dependency packages and license present`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
