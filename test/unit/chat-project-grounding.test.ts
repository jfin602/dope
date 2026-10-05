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
