#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import { access, chmod, copyFile, mkdir, open, readFile, readlink, rename, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const home = homedir();
const root = process.env.DOPE_INSTALL_ROOT || path.join(home, '.local/opt/dope');
const dataHome = process.env.XDG_DATA_HOME || path.join(home, '.local/share');
const releases = path.join(root, 'releases');
const current = path.join(root, 'current');
const history = path.join(root, 'history.jsonl');
const summary = path.join(root, 'BUILD-HISTORY.md');
const launcher = path.join(dataHome, 'applications/dope.desktop');
const icon = path.join(dataHome, 'icons/hicolor/512x512/apps/dope.png');

const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
const timestamp = () => new Date().toISOString();
const safeId = id => /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(id) && id !== '.' && id !== '..';
const buildPath = id => path.join(releases, id);
const artifactPath = id => path.join(buildPath(id), 'Dope.AppImage');

async function append(record) {
  const file = await open(history, 'a');
  try {
    await file.writeFile(`${JSON.stringify(record)}\n`);
    await file.sync();
  } finally {
    await file.close();
  }
}

async function records() {
  try {
    return (await readFile(history, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function activeId() {
  try {
    const link = await readlink(current);
    const target = path.resolve(root, link);
    if (path.dirname(target) !== releases) throw new Error('current points outside releases');
    return path.basename(target);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function refreshSummary() {
  const entries = (await records()).filter(item => item.result !== 'pending');
  const active = await activeId();
  const lines = ['# Dope local build history', '', `Active: ${active || 'none'}`, '', '| Time (UTC) | Action | Build | Version | Commit | Branch | Tree | Result | Notes |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |'];
  for (const item of entries) {
    const cells = [item.timestamp, item.action, item.buildId, item.version, item.commit.slice(0, 12), item.branch, item.dirty ? 'dirty' : 'clean', item.result, item.notes || ''];
    lines.push(`| ${cells.map(value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ')).join(' | ')} |`);
  }
  const tmp = `${summary}.${process.pid}.tmp`;
  await writeFile(tmp, `${lines.join('\n')}\n`);
  await rename(tmp, summary);
}

async function activate(id) {
  const tmp = path.join(root, `.current-${process.pid}-${randomBytes(4).toString('hex')}`);
  await symlink(path.join('releases', id), tmp);
  try {
    await rename(tmp, current);
  } catch (error) {
    await rm(tmp, { force: true });
    throw error;
  }
}

async function checkArtifact(file) {
  const info = await stat(file);
  if (!info.isFile() || info.size < 11) throw new Error(`Invalid AppImage: ${file}`);
  const handle = await open(file, 'r');
  try {
    const bytes = Buffer.alloc(11);
    await handle.read(bytes, 0, 11, 0);
    if (!bytes.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])) || !bytes.subarray(8).equals(Buffer.from([0x41, 0x49, 0x02]))) throw new Error(`Not a type 2 AppImage: ${file}`);
  } finally {
    await handle.close();
  }
}

async function writeLauncher() {
  await mkdir(path.dirname(launcher), { recursive: true });
  await mkdir(path.dirname(icon), { recursive: true });
  await copyFile(path.join(repo, 'apps/electron/build/icon.png'), icon);
  const exec = path.join(current, 'Dope.AppImage').replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('%', '%%');
  const body = `[Desktop Entry]\nType=Application\nName=Dope\nComment=Dope development environment\nExec="${exec}" %U\nIcon=dope\nTerminal=false\nCategories=Development;IDE;\nStartupWMClass=dope\n`;
  const tmp = `${launcher}.${process.pid}.tmp`;
  await writeFile(tmp, body);
  await rename(tmp, launcher);
}

async function recordActivation(base, id) {
  await append({ ...base, result: 'pending' });
  try {
    await activate(id);
  } catch (error) {
    await append({ ...base, result: 'failed', error: error.message });
    throw error;
  }
  await append({ ...base, result: 'activated' });
  await refreshSummary();
}

async function install(note, artifact) {
  const version = JSON.parse(await readFile(path.join(repo, 'apps/electron/package.json'), 'utf8')).version;
  const commit = git('rev-parse', 'HEAD');
  const branch = git('branch', '--show-current') || '(detached)';
  const dirty = git('status', '--porcelain').length > 0;
  const source = path.resolve(artifact || path.join(repo, 'dist/linux', `Dope-${version}.AppImage`));
  await checkArtifact(source);
  const id = `${version}-${timestamp().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}-${commit.slice(0, 12)}-${randomBytes(3).toString('hex')}`;
  const target = artifactPath(id);
  await mkdir(buildPath(id));
  try {
    await copyFile(source, target, constants.COPYFILE_EXCL);
    await chmod(target, 0o755);
    await checkArtifact(target);
    const base = { timestamp: timestamp(), action: 'install', buildId: id, version, commit, branch, dirty, packagePath: source, artifactPath: target, notes: note || null };
    await writeFile(path.join(buildPath(id), 'build.json'), `${JSON.stringify(base, null, 2)}\n`, { flag: 'wx' });
    await writeLauncher();
    await recordActivation(base, id);
    console.log(`Installed ${id}\nLauncher: ${launcher}\nHistory: ${summary}`);
  } catch (error) {
    if (await activeId() !== id) await rm(buildPath(id), { recursive: true, force: true });
    throw error;
  }
}

async function rollback(id, note) {
  if (!safeId(id)) throw new Error('Invalid build ID');
  const base = JSON.parse(await readFile(path.join(buildPath(id), 'build.json'), 'utf8'));
  if (base.buildId !== id) throw new Error('Build metadata does not match directory');
  await checkArtifact(artifactPath(id));
  await access(artifactPath(id), constants.X_OK);
  if (await activeId() === id) throw new Error(`${id} is already active`);
  await recordActivation({ ...base, timestamp: timestamp(), action: 'rollback', notes: note || null }, id);
  console.log(`Activated ${id}`);
}

async function list() {
  await refreshSummary();
  console.log(await readFile(summary, 'utf8'));
}

try {
  const { values, positionals } = parseArgs({ args: process.argv.slice(2), options: { note: { type: 'string' }, artifact: { type: 'string' } }, allowPositionals: true });
  const [command, id] = positionals;
  if (values.note === '' || values.artifact === '') throw new Error('Empty option value');
  await mkdir(releases, { recursive: true });
  if (command === 'install' && positionals.length === 1) await install(values.note, values.artifact);
  else if (command === 'rollback' && positionals.length === 2 && !values.artifact) await rollback(id, values.note);
  else if (command === 'list' && positionals.length === 1 && !values.note && !values.artifact) await list();
  else throw new Error('Usage: local-install.mjs install [--note TEXT] [--artifact FILE] | rollback BUILD_ID [--note TEXT] | list');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
