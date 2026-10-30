import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSnapshot, flowFactId } from '../../packages/software-map/lib/index.js';
import { parseChatContextRef } from '../../packages/chat/lib/index.js';
import { ChatProjectGrounder, GROUNDING_LIMITS } from '../../packages/theia-extension/lib/node/chat-project-grounder.js';
import type { SoftwareMapIndex } from '../../packages/code-analysis/lib/node/software-map-index.js';

const emptyIndex = { status: () => ({ state: 'idle', generation: 0 }), snapshot: () => undefined,
  inputsCurrent: async () => false } as unknown as SoftwareMapIndex;
const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-grounding-'));
  await mkdir(join(root, 'test'));
  await mkdir(join(root, '.dope'));
  await mkdir(join(root, 'node_modules'));
  await mkdir(join(root, 'packages/chat/src/node'), { recursive: true });
  await mkdir(join(root, 'docs'));
  await writeFile(join(root, 'package.json'), '{"name":"fixture"}');
  await writeFile(join(root, 'packages/chat/src/node/chat-repository.ts'), 'export class ChatRepository { /* project-local chat persistence */ }');
  await writeFile(join(root, 'docs/chat-persistence.md'), 'Historical discussion, not source');
  await writeFile(join(root, 'test/a.test.ts'), 'Chat persistence is here\nother line');
  await writeFile(join(root, 'test/b.test.ts'), 'Second source');
  await writeFile(join(root, '.dope/private.txt'), 'private state');
  await writeFile(join(root, 'node_modules/skip.ts'), 'Chat persistence');
  return root;
};

test('orientation, root and test listing, existence, file read and automatic ref contract', async () => {
  const root = await fixture();
  try {
    const grounder = new ChatProjectGrounder(emptyIndex);
    const rootResult = await grounder.ground(root, 'what is at the repository root?');
    assert.equal(rootResult.blocks[0].ref.kind, 'project-orientation');
    assert.ok(!JSON.stringify(rootResult).includes(root));
    assert.match(rootResult.blocks[1].text, /package.json/);
    assert.doesNotMatch(rootResult.blocks[1].text, /\.dope/);
    assert.deepEqual((await grounder.ground(root, 'hello there')).blocks.map(block => block.ref.kind), ['project-orientation']);
    const nested = await grounder.ground(root, 'what is in test/?');
    assert.match(nested.blocks[1].text, /a\.test\.ts/);
    assert.match(nested.blocks[1].text, /b\.test\.ts/);
    assert.equal(nested.blocks[1].ref.origin, 'automatic');
    assert.equal(parseChatContextRef(nested.blocks[1].ref).origin, 'automatic');
    const old = { ...nested.blocks[1].ref }; delete old.origin;
    assert.equal(parseChatContextRef(old).origin, undefined);
    assert.match((await grounder.ground(root, 'does package.json exist?')).blocks[1].text, /fixture/);
    assert.match((await grounder.ground(root, 'does src/missing.ts exist?')).blocks[1].text, /absent/);
    assert.equal((await grounder.readFile(root, 'test/a.test.ts')).blocks[0].ref.contentHash,
      createHash('sha256').update('Chat persistence is here\nother line').digest('hex'));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('greenfield technology mentions are not file lookups; explicit filenames remain evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-greenfield-'));
  const other = await mkdtemp(join(tmpdir(), 'dope-greenfield-other-'));
  try {
    const grounder = new ChatProjectGrounder(emptyIndex);
    const idea = 'Lets plan the start of a new project. I want to make a 2D tower defense game with pixi.js';
    const greenfield = await grounder.ground(root, idea);
    assert.deepEqual(greenfield.blocks.map(block => block.ref.kind), ['project-orientation']);
    assert.match(greenfield.blocks[0].text, /Attached project/);
    assert.doesNotMatch(JSON.stringify(greenfield), /pixi\.js: absent|Architecture: unavailable|Physical Map: unavailable/);
    assert.equal(greenfield.blocks[0].ref.origin, 'automatic');
    assert.equal(greenfield.blocks[0].ref.projectId === (await grounder.ground(other, idea)).blocks[0].ref.projectId, false);
    assert.equal(greenfield.blocks[0].ref.contentHash, createHash('sha256').update(greenfield.blocks[0].text).digest('hex'));
    const design = await grounder.ground(root, 'What architecture would work for a new game?');
    assert.equal(design.blocks.some(block => block.ref.kind === 'architecture' || block.ref.kind === 'grounding-status'), false);
    for (const mention of ['Use pixi.js for graphics', 'using pixi.js', 'use React',
      'Build with three.js', 'use lodash.js for helpers']) {
      const result = await grounder.ground(root, mention);
      assert.equal(result.blocks.some(block => block.ref.kind === 'file'), false, mention);
      assert.equal(result.diagnostics.some(item => item.kind === 'unavailable'), false, mention);
    }
    await mkdir(join(root, 'src'));
    await writeFile(join(root, 'src/game.ts'), 'export const game = true;\n');
    await writeFile(join(root, 'package.json'), '{"name":"game"}');
    for (const [question, path] of [['read src/game.ts', 'src/game.ts'],
      ['inspect package.json', 'package.json'], ['read `src/game.ts;`', 'src/game.ts']]) {
      const result = await grounder.ground(root, question);
      assert.equal(result.blocks.find(block => block.ref.kind === 'file')?.ref.id, path);
      assert.ok(result.blocks.find(block => block.ref.kind === 'file')?.ref.sourceHash);
    }
    const missing = await grounder.ground(root, 'does pixi.js exist?');
    assert.match(missing.blocks.find(block => block.ref.kind === 'file')!.text, /Project file pixi\.js: absent/);
    assert.equal((await grounder.ground(root, 'does `pixi.js` exist?')).blocks.some(block =>
      block.ref.kind === 'file' && /absent/.test(block.text)), true);
    assert.equal((await grounder.ground(root, 'read ../secret')).diagnostics.some(item => item.kind === 'rejected'), true);
  } finally { await rm(root, { recursive: true, force: true }); await rm(other, { recursive: true, force: true }); }
});

test('ordinary structure updates inspect current safe files on every turn', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-structure-'));
  const outside = await mkdtemp(join(tmpdir(), 'dope-structure-private-'));
  try {
    const grounder = new ChatProjectGrounder(emptyIndex);
    const phrase = 'Okay I created our basic structure';
    const empty = await grounder.ground(root, phrase);
    assert.match(empty.blocks.find(block => block.ref.kind === 'directory')!.text, /Project directory \.: \(empty\)/);
    await mkdir(join(root, 'src')); await mkdir(join(root, 'test'));
    await mkdir(join(root, '.dope'));
    await writeFile(join(root, '.dope/private.json'), 'private');
    await writeFile(join(root, 'package.json'), '{"name":"tower","version":"1.2.3"}');
    await writeFile(join(root, 'src/game.ts'), 'export const level = 1;\n');
    await writeFile(join(root, 'test/game.test.ts'), 'test("game", () => {});\n');
    await writeFile(join(outside, 'secret.ts'), 'outside-secret');
    await symlink(join(outside, 'secret.ts'), join(root, 'src/secret.ts'));
    const current = await grounder.ground(root, phrase);
    assert.deepEqual(current.blocks.filter(block => block.ref.kind === 'directory').map(block => block.ref.id), ['.', 'src', 'test']);
    const source = current.blocks.find(block => block.ref.id === 'src/game.ts')!;
    assert.equal(source.text, 'export const level = 1;\n');
    assert.equal(source.ref.sourceHash, createHash('sha256').update(source.text).digest('hex'));
    assert.equal(source.ref.contentHash, source.ref.sourceHash);
    assert.ok(current.blocks.some(block => block.ref.id === 'package.json'));
    assert.equal(current.blocks.some(block => block.ref.id === 'src/secret.ts'), false);
    assert.doesNotMatch(JSON.stringify(current), /outside-secret|private\.json|\.dope/);
    await writeFile(join(root, 'src/game.ts'), 'export const level = 2;\n');
    const changed = await grounder.ground(root, 'I added the files');
    assert.match(changed.blocks.find(block => block.ref.id === 'src/game.ts')!.text, /level = 2/);
    assert.notEqual(changed.blocks.find(block => block.ref.id === 'src/game.ts')!.ref.sourceHash, source.ref.sourceHash);
    assert.equal((await grounder.ground(root, 'I made a src folder')).blocks.some(block => block.ref.id === 'src'), true);
    await writeFile(join(root, 'src/large.ts'), 'x'.repeat(10_000));
    const bounded = await grounder.ground(root, phrase);
    const large = bounded.blocks.find(block => block.ref.id === 'src/large.ts')!;
    assert.ok(large.ref.includedBytes! <= 2048);
    assert.equal(large.ref.sourceHash, undefined);
    assert.ok(bounded.diagnostics.some(item => item.kind === 'truncated' && item.source === 'src/large.ts'));
    await mkdir(join(root, 'src', 'scenes'));
    await writeFile(join(root, 'src', 'scenes', 'level.ts'), 'export const scene = true;\n');
    const nested = await grounder.ground(root, 'I updated our source structure');
    assert.equal(nested.blocks.some(block => block.ref.id === 'src/scenes' && block.ref.kind === 'directory'), true);
    assert.equal(nested.blocks.some(block => block.ref.id === 'src/scenes/level.ts' && block.ref.kind === 'file'), true);
    assert.equal((await grounder.ground(root, 'hello there')).blocks.some(block => block.ref.kind === 'directory'), false);
  } finally { await rm(root, { recursive: true, force: true }); await rm(outside, { recursive: true, force: true }); }
});

test('path/text search is stable, skips generated trees and reports bounds', async () => {
  const root = await fixture();
  try {
    const grounder = new ChatProjectGrounder(emptyIndex);
    const paths = await grounder.searchPaths(root, '.test.ts');
    assert.match(paths.blocks[0].text, /test\/a\.test\.ts\ntest\/b\.test\.ts/);
    assert.match((await grounder.searchPaths(root, 'test')).blocks[0].text, /(?:^|\n)test\//);
    const text = await grounder.searchText(root, 'Chat persistence');
    assert.match(text.blocks[0].text, /test\/a\.test\.ts:1/);
    assert.doesNotMatch(text.blocks[0].text, /node_modules/);
    assert.ok(text.diagnostics.some(item => item.message.includes('skipped')));
    const located = await grounder.ground(root, 'where is Chat persistence implemented?');
    assert.equal(located.blocks.some(block => block.ref.kind === 'path-search'), true);
    assert.equal(located.blocks.find(block => block.ref.kind === 'file')?.ref.id, 'packages/chat/src/node/chat-repository.ts');
    assert.match(located.blocks.find(block => block.ref.kind === 'file')!.text, /ChatRepository/);
    for (let i = 0; i < GROUNDING_LIMITS.entries + 4; i++) await writeFile(join(root, `file-${String(i).padStart(3, '0')}`), 'x');
    const listing = await grounder.listDirectory(root);
    assert.equal((await grounder.listDirectory(root, '.')).blocks[0].text, listing.blocks[0].text);
    assert.ok(listing.diagnostics.some(item => item.kind === 'truncated'));
    await writeFile(join(root, 'large.txt'), 'x'.repeat(GROUNDING_LIMITS.fileBytes + 100));
    assert.ok((await grounder.readFile(root, 'large.txt')).diagnostics.some(item => item.kind === 'truncated'));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('generic access rejects .dope, absolute/traversal/control paths and symlink escape', async () => {
  const root = await fixture();
  const outside = await mkdtemp(join(tmpdir(), 'dope-grounding-outside-'));
  try {
    await writeFile(join(outside, 'secret'), 'host-secret');
    await symlink(join(outside, 'secret'), join(root, 'test', 'escape'));
    const grounder = new ChatProjectGrounder(emptyIndex);
    for (const path of ['.dope/private.txt', '../secret', '/tmp/secret', 'test/../package.json', 'test/\u0000bad']) {
      await assert.rejects(grounder.readFile(root, path), /Unsafe|protected|escapes/);
    }
    await assert.rejects(grounder.readFile(root, 'test/escape'), /escapes/);
    const rejected = await grounder.ground(root, 'read ../secret');
    assert.ok(rejected.diagnostics.some(item => item.kind === 'rejected'));
    assert.equal(rejected.blocks.at(-1)?.ref.kind, 'grounding-status');
    assert.match(rejected.blocks.at(-1)!.text, /Rejected project request/);
    assert.ok(!JSON.stringify(rejected.blocks).includes('../secret'));
    assert.ok(!JSON.stringify(await grounder.ground(root, 'read test/escape')).includes('host-secret'));
  } finally { await rm(root, { recursive: true, force: true }); await rm(outside, { recursive: true, force: true }); }
});

test('canonical Architecture and only current Physical Map/Flow supply evidence', async () => {
  const root = await fixture();
  try {
    const declaration = JSON.stringify({ schemaVersion: 1, systems: [{ id: 'system', name: 'Core', purpose: 'Core purpose',
      subsystems: [{ id: 'subsystem', name: 'Chat', purpose: 'Conversations', roots: ['test'] }] }] });
    await writeFile(join(root, '.dope/architecture.json'), declaration);
    await writeFile(join(root, '.dope/smap.json'), JSON.stringify({ schemaVersion: 1,
      architectureFingerprint: createHash('sha256').update(declaration).digest('hex') }));
    const fact = { id: flowFactId('invokes', 'src', 'dst', 'call'), kind: 'invokes' as const,
      sourceId: 'src', targetId: 'dst', discriminator: 'call', evidenceIds: ['proof'] };
    const snapshot = createSnapshot({ projectId: 'project:root', generation: 7, inputFingerprint: 'input',
      analysis: { completeness: 'complete', errors: [] } }, [
      { id: 'project:root', kind: 'project', name: 'Project', evidenceIds: [] },
      { id: 'src', kind: 'code', codeKind: 'symbol', name: 'Sender', path: 'test/a.test.ts',
        parentId: 'project:root', ownership: { state: 'unassigned' }, evidenceIds: ['proof'] },
      { id: 'dst', kind: 'code', codeKind: 'symbol', name: 'Receiver', path: 'test/b.test.ts',
        parentId: 'project:root', ownership: { state: 'unassigned' }, evidenceIds: ['proof'] },
    ], [], [{ id: 'proof', class: 'semantic', producer: 'test', producerVersion: '1', path: 'test/a.test.ts',
      span: { start: 0, length: 1 }, flowKind: 'invokes' }], [], [fact]);
    let current = true;
    const index = { snapshot: () => snapshot, status: () => ({ state: 'ready', generation: 7, inputFingerprint: 'input' }),
      inputsCurrent: async () => current } as unknown as SoftwareMapIndex;
    const grounder = new ChatProjectGrounder(index);
    assert.match((await grounder.ground(root, 'describe the Chat Architecture subsystem')).blocks.at(-1)!.text, /Conversations/);
    const map = await grounder.ground(root, 'what is in the Physical Map?');
    assert.equal(map.blocks.at(-1)?.ref.generation, 7);
    assert.match(map.blocks.at(-1)!.text, /proof/);
    const flow = await grounder.ground(root, 'trace the Flow for Sender');
    assert.equal(flow.blocks.at(-1)?.ref.kind, 'flow');
    assert.match(flow.blocks.at(-1)!.text, /invokes/);
    const unknown = await grounder.ground(root, 'Physical Map node id definitely-not-real');
    assert.equal(unknown.blocks.some(block => block.ref.kind === 'physical-map'), false);
    assert.match(unknown.blocks.at(-1)!.text, /Requested map identity unavailable/);
    current = false;
    const stale = await grounder.ground(root, 'trace the Flow');
    assert.equal(stale.blocks.some(block => block.ref.kind === 'flow'), false);
    assert.ok(stale.diagnostics.some(item => item.kind === 'unavailable'));
    assert.equal(stale.blocks.at(-1)?.ref.kind, 'grounding-status');
    const wrongGeneration = new ChatProjectGrounder({ ...index,
      status: () => ({ state: 'ready', generation: 8, inputFingerprint: 'input' }) } as SoftwareMapIndex);
    assert.equal((await wrongGeneration.ground(root, 'Physical Map')).blocks.some(block => block.ref.kind === 'physical-map'), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('guided investigation cites bounded source and reports unavailable evidence', async () => {
  const root = await fixture();
  try {
    const grounder = new ChatProjectGrounder(emptyIndex);
    const found = await grounder.investigateIdea(root, 'Improve ChatRepository persistence');
    assert.ok(found.blocks.some(block => block.ref.kind === 'file' &&
      block.ref.id === 'packages/chat/src/node/chat-repository.ts'));
    const file = found.blocks.find(block => block.ref.kind === 'file')!;
    assert.equal(file.ref.contentHash, createHash('sha256').update(file.text).digest('hex'));
    await writeFile(join(root, 'packages/chat/src/node/chat-repository.ts'), 'changed source');
    const changed = await grounder.investigate(root, { queries: [{ kind: 'read', path: file.ref.id }] });
    assert.notEqual(changed.blocks[0].ref.contentHash, file.ref.contentHash);
    const absent = await grounder.investigate(root, { queries: [{ kind: 'read', path: 'missing.ts' }] });
    assert.equal(absent.blocks.some(block => block.ref.kind === 'file'), false);
    assert.ok(absent.diagnostics.some(item => item.kind === 'unavailable'));
    await writeFile(join(root, 'binary.dat'), Buffer.from([0, 1, 2]));
    const binary = await grounder.investigate(root, { queries: [{ kind: 'read', path: 'binary.dat' }] });
    assert.ok(binary.diagnostics.some(item => item.kind === 'unavailable'));
    await assert.rejects(grounder.investigate(root, { queries: [{ kind: 'read', path: '.dope/private.txt' }] }), /Unsafe/);
    await assert.rejects(grounder.investigate(root, { queries: [{ kind: 'read', path: 'node_modules/ignored.txt' }] }), /Unsafe/);
    await assert.rejects(grounder.investigate(root, { queries: [{ kind: 'read', path: 'secret.key' }] }), /Unsafe/);
    await symlink(join(root, 'package.json'), join(root, 'test', 'linked.json'));
    const linked = await grounder.investigate(root, { queries: [{ kind: 'read', path: 'test/linked.json' }] });
    assert.equal(linked.blocks.some(block => block.ref.kind === 'file'), false);
    assert.ok(linked.diagnostics.some(item => item.kind === 'unavailable'));
    const other = await fixture();
    try {
      const otherEvidence = await grounder.investigate(other, { queries: [{ kind: 'read', path: 'package.json' }] });
      assert.notEqual(otherEvidence.blocks[0].ref.projectId, found.blocks[0].ref.projectId);
    } finally { await rm(other, { recursive: true, force: true }); }
    await assert.rejects(grounder.investigate(root, { projectId: 'other', queries: [] }), /Foreign/);
    await assert.rejects(grounder.investigate(root, { queries: Array(7).fill({ kind: 'directory', path: '' }) }), /limit/);
    await assert.rejects(grounder.investigate(root, { queries: Array(6).fill({ kind: 'read', path: 'package.json' }) }), /read limit/);
    const controller = new AbortController(); controller.abort();
    await assert.rejects(grounder.investigate(root, { signal: controller.signal, queries: [{ kind: 'read', path: 'package.json' }] }), /cancelled/);
    await writeFile(join(root, 'large.ts'), 'x'.repeat(GROUNDING_LIMITS.fileBytes + 1));
    const capped = await grounder.investigate(root, { queries: [{ kind: 'read', path: 'large.ts' }] });
    assert.ok(capped.blocks[0].text.length <= 12 * 1024);
    assert.ok(capped.diagnostics.some(item => item.kind === 'truncated'));
    await writeFile(join(root, 'tail.ts'), 'x'.repeat(15_000) + 'old');
    const before = await grounder.investigate(root, { queries: [{ kind: 'read', path: 'tail.ts' }] });
    await writeFile(join(root, 'tail.ts'), 'x'.repeat(15_000) + 'new');
    const after = await grounder.investigate(root, { queries: [{ kind: 'read', path: 'tail.ts' }] });
    assert.equal(before.blocks[0].ref.contentHash, after.blocks[0].ref.contentHash);
    assert.notEqual(before.blocks[0].ref.sourceHash, after.blocks[0].ref.sourceHash);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('exact planning wording reads normalized named source before bounded heuristics', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-cp-paths-'));
  try {
    await mkdir(join(root, 'src')); await mkdir(join(root, 'test'));
    const paths = ['src/diffEditor.js', 'src/history.js', 'src/toolbar.js', 'src/permissions.js', 'test/history.test.js'];
    for (const path of paths) await writeFile(join(root, path), `verified ${path}\n`);
    const grounder = new ChatProjectGrounder(emptyIndex);
    const question = 'Plan a visual Git history for this project. Reuse the existing read-only diff editor in src/diffEditor.js; put branch checkout and commits in the toolbar; keep checkout and commit permissions explicit. Please inspect the relevant files and give me a complete ordered implementation plan with tests before changing anything.';
    const result = await grounder.ground(root, question);
    const file = result.blocks.find(block => block.ref.kind === 'file');
    assert.equal(file?.ref.id, 'src/diffEditor.js');
    assert.equal(file?.text, 'verified src/diffEditor.js\n');
    assert.equal(file?.ref.contentHash, createHash('sha256').update(file!.text).digest('hex'));
    assert.equal(file?.ref.sourceHash, file?.ref.contentHash);
    assert.equal(result.blocks.some(block => block.ref.kind === 'directory' || /absent/.test(block.text)), false);
    assert.equal(result.diagnostics.some(item => item.kind === 'rejected'), false);
    const investigated = await grounder.investigateIdea(root, question);
    assert.equal(investigated.blocks.find(block => block.ref.kind === 'file')?.ref.id, 'src/diffEditor.js');
    assert.equal(investigated.blocks.find(block => block.ref.kind === 'file')?.ref.sourceHash, file?.ref.sourceHash);
    assert.equal(investigated.blocks.some(block => block.ref.kind === 'path-search'), false);
    for (const wording of ['read `src/diffEditor.js`', 'read "src/diffEditor.js,"', 'read (src/diffEditor.js).', 'read src/diffEditor.js!']) {
      assert.equal((await grounder.ground(root, wording)).blocks.find(block => block.ref.kind === 'file')?.ref.id, 'src/diffEditor.js');
    }
    const directory = await grounder.ground(root, 'list contents of src/');
    assert.equal(directory.blocks.find(block => block.ref.kind === 'directory')?.ref.id, 'src');
    assert.match(directory.blocks.find(block => block.ref.kind === 'directory')!.text, /diffEditor\.js/);
    assert.equal((await grounder.ground(root, 'what is in test/?')).blocks.find(block => block.ref.kind === 'directory')?.ref.id, 'test');
    const absent = await grounder.investigateIdea(root, 'read src/missing.js');
    assert.equal(absent.blocks.some(block => block.ref.kind === 'file'), false);
    assert.ok(absent.diagnostics.some(item => item.kind === 'unavailable'));
    const rootSource = await grounder.investigateIdea(root, 'Find history source');
    assert.ok(rootSource.blocks.some(block => block.ref.kind === 'file' && block.ref.id === 'src/history.js'));
    await writeFile(join(root, 'src/diffEditor.js'), 'changed source\n');
    assert.notEqual((await grounder.ground(root, question)).blocks.find(block => block.ref.kind === 'file')?.ref.sourceHash, file?.ref.sourceHash);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('named-source planning investigation keeps rejection, absence, binary and project boundaries separate', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-cp-safe-'));
  const other = await mkdtemp(join(tmpdir(), 'dope-cp-other-'));
  try {
    await mkdir(join(root, 'src')); await mkdir(join(root, '.dope'));
    await mkdir(join(other, 'src'));
    await writeFile(join(root, 'src/ok.js'), 'project A');
    await writeFile(join(other, 'src/ok.js'), 'project B');
    await writeFile(join(root, 'src/binary.js'), Buffer.from([0, 1, 2]));
    await writeFile(join(root, '.dope/private.js'), 'private');
    await symlink(join(other, 'src/ok.js'), join(root, 'src/link.js'));
    const grounder = new ChatProjectGrounder(emptyIndex);
    for (const path of ['../src/ok.js', '/tmp/host.js', '.dope/private.js', 'src/link.js', 'src/binary.js']) {
      const result = await grounder.ground(root, `read ${path};`);
      assert.equal(result.blocks.some(block => block.ref.kind === 'file'), false);
      assert.equal(result.blocks.some(block => block.ref.kind === 'directory'), false);
      assert.ok(result.diagnostics.some(item => item.kind === 'rejected'));
      assert.doesNotMatch(JSON.stringify(result.blocks), /project B|private/);
    }
    const absent = await grounder.ground(root, 'read src/nope.js;');
    assert.match(absent.blocks.find(block => block.ref.kind === 'file')!.text, /absent/);
    assert.equal(absent.diagnostics.some(item => item.kind === 'rejected'), false);
    const a = await grounder.investigateIdea(root, 'inspect src/ok.js');
    const b = await grounder.investigateIdea(other, 'inspect src/ok.js');
    assert.notEqual(a.blocks.find(block => block.ref.kind === 'file')?.ref.projectId,
      b.blocks.find(block => block.ref.kind === 'file')?.ref.projectId);
    assert.equal(a.blocks.find(block => block.ref.kind === 'file')?.text, 'project A');
    assert.equal(b.blocks.find(block => block.ref.kind === 'file')?.text, 'project B');
  } finally { await rm(root, { recursive: true, force: true }); await rm(other, { recursive: true, force: true }); }
});
