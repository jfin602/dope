import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { buildPlan } from '../../scripts/codex-phase-core.mjs';
import { discoverRoadmapTaskStacks } from '../../packages/agent-core/lib/node/roadmap-task-discovery.js';

const root = process.cwd();
const prompt = (phase: number, number: number, closeout = false, version = '0.10.16') => ({
  filename: `P${number}-${closeout ? 'closeout' : 'task'}.txt`,
  text: `TASK: Correction ${phase} / P${number} — ${closeout ? 'Closeout' : 'Task'}\n- Recommended configuration: \`GPT-6 Sol High\`.\n- Browser required: ${closeout ? 'yes' : 'no'}.\n- Required unchanged project version: \`${version}\`.\n`,
});

test('real phase, continuation, and correction sources match strict runner plans', async () => {
  const stacks = await discoverRoadmapTaskStacks(root);
  assert.equal(stacks.find(stack => stack.folderName === 'c6-branch-seam')?.diagnostic?.code, 'one-off');
  for (const name of ['p10', 'p8a', 'p8b', 'c8-fix', 'c10-roadmap-create-sync']) {
    const item = stacks.find(stack => stack.folderName === name);
    assert.ok(item, name);
    assert.ok(item.fingerprint, name);
    const entries = await Promise.all(item.prompts.map(async source => ({
      filename: path.basename(source.path), text: await readFile(path.join(root, source.path), 'utf8'),
    })));
    const runner = buildPlan(entries, name);
    assert.deepEqual(item.prompts.map(source => source.number), runner.prompts.map(entry => entry.number));
    assert.deepEqual(item.prompts.map(source => source.version), runner.prompts.map(entry =>
      entry.mode === 'correction' ? entry.unchangedVersion : entry.targetVersion));
    assert.equal(item.prompts.at(-1)?.kind, 'closeout');
  }
});

test('malformed, one-off, superseded, missing, foreign, ambiguous and symlink sources stay diagnostic', async () => {
  const temp = await mkdtemp(path.join(root, 'test', 'roadmap-task-discovery-'));
  const relative = path.relative(root, temp).split(path.sep).join('/');
  const writeStack = async (name: string, entries: ReturnType<typeof prompt>[]) => {
    const folder = path.join(temp, name);
    await mkdir(folder);
    await Promise.all(entries.map(entry => writeFile(path.join(folder, entry.filename), entry.text)));
  };
  try {
    await writeStack('c10-valid', [prompt(10, 1), prompt(10, 2, true)]);
    await writeStack('c10-bad', [prompt(10, 1), prompt(10, 3, true)]);
    await writeStack('c10-version', [prompt(10, 1), prompt(10, 2, true, '0.10.17')]);
    await writeStack('c10-unsafe-file', [prompt(10, 1)]);
    await symlink(path.join(root, 'docs', 'tasks', 'c10-roadmap-create-sync', 'P19-roadmap-closeout.txt'),
      path.join(temp, 'c10-unsafe-file', 'P2-closeout.txt'));
    await writeStack('p8', []);
    await writeStack('p8a', []);
    await writeFile(path.join(temp, 'P1-one-off.txt'), prompt(10, 1).text);
    await symlink(path.join(root, 'docs', 'tasks', 'p10'), path.join(temp, 'p10'));
    const items = await discoverRoadmapTaskStacks(root, relative, {
      expectedPaths: [`${relative}/c10-missing`, 'docs/tasks/p10'],
      supersededFolders: ['c10-valid'],
    });
    const code = (name: string) => items.find(item => item.folderName === name)?.diagnostic?.code;
    assert.equal(code('c10-valid'), 'superseded');
    assert.equal(code('c10-bad'), 'malformed');
    assert.equal(code('c10-version'), 'malformed');
    assert.equal(code('c10-unsafe-file'), 'unsafe');
    assert.equal(code('P1-one-off.txt'), 'one-off');
    assert.equal(code('p8'), 'malformed');
    assert.equal(code('p10'), 'unsafe');
    assert.equal(code('c10-missing'), 'missing');
    assert.equal(items.find(item => item.path === 'docs/tasks/p10')?.diagnostic?.code, 'foreign');
    assert.ok(items.every(item => item.executable === false));
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('base phase and slice A with valid stacks are ambiguous', async () => {
  const temp = await mkdtemp(path.join(root, 'test', 'roadmap-task-discovery-'));
  const relative = path.relative(root, temp).split(path.sep).join('/');
  const phasePrompt = (number: number, closeout: boolean) => ({
    filename: `P${number}-${closeout ? 'closeout' : 'task'}.txt`,
    text: `TASK: Phase 8 / P${number} — ${closeout ? 'Closeout' : 'Task'}\n- Recommended configuration: \`GPT-6 Sol High\`.\n- Browser required: no.\nThe assigned project version is \`0.8.${number}\`.\n`,
  });
  try {
    for (const folder of ['p8', 'p8a']) {
      const dir = path.join(temp, folder);
      await mkdir(dir);
      for (const entry of [phasePrompt(1, false), phasePrompt(2, true)])
        await writeFile(path.join(dir, entry.filename), entry.text);
    }
    const items = await discoverRoadmapTaskStacks(root, relative);
    assert.deepEqual(items.map(item => item.diagnostic?.code), ['ambiguous', 'ambiguous']);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('post-1.0 and post-2.0 folder families retain runner version rules and stable fingerprints', async () => {
  const temp = await mkdtemp(path.join(root, 'test', 'roadmap-task-discovery-'));
  const relative = path.relative(root, temp).split(path.sep).join('/');
  try {
    for (const [folder, major] of [['p1-0', 1], ['p2-1', 2]] as const) {
      const dir = path.join(temp, folder);
      const phase = Number(folder.split('-')[1]);
      await mkdir(dir);
      for (const number of [1, 2]) {
        const filename = `P${number}-${number === 2 ? 'closeout' : 'task'}.txt`;
        const text = `TASK: Phase ${phase} / P${number} — ${number === 2 ? 'Closeout' : 'Task'}\n- Recommended configuration: \`GPT-6 Sol High\`.\n- Browser required: no.\nThe assigned project version is \`${major}.${phase}.${number}\`.\n`;
        await writeFile(path.join(dir, filename), text);
      }
    }
    const first = await discoverRoadmapTaskStacks(root, relative);
    const second = await discoverRoadmapTaskStacks(root, relative);
    assert.deepEqual(first, second);
    for (const item of first) {
      assert.ok(item.fingerprint);
      assert.equal(item.diagnostic, undefined);
      assert.equal(item.prompts.length, 2);
    }
  } finally { await rm(temp, { recursive: true, force: true }); }
});
