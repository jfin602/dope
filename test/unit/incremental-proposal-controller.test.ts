import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/chat-repository.js';
import { IncrementalProposalController } from '../../packages/theia-extension/lib/node/incremental-proposal-controller.js';

const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const stage = (sequence: number, revision: number, target: string, chunkIndex: number,
  content: string, complete: boolean) => ({ version: 1, sequence, expectedRevision: revision,
  idempotencyKey: `stage_key_${sequence}`, target, chunkIndex, content, digest: hash(content), complete });

test('trusted controller persists bounded ordered chunks, exact replay and sealed handoff without canonical effects', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-proposal-'));
  const repo = new ChatRepository(), chatId = randomUUID(), messageId = randomUUID();
  const canonical = join(root, 'original.md');
  await writeFile(canonical, 'original\n');
  try {
    await repo.mutate(root, 0, { type: 'create-chat', id: chatId, folderPath: '' });
    const lease = await repo.claim(root, chatId, 'panel');
    if (!lease.acquired) throw new Error('missing lease');
    const identity = { root, chatId, messageId, leaseToken: lease.token, ownerId: 'panel',
      worktreeId: 'worktree-a', sourceBasis: 'source-a', domain: 'document' as const };
    let basis = 'source-a';
    const authority = async () => ({ worktreeId: 'worktree-a', sourceBasis: basis });
    const handler = { validateStage: async () => {}, validateComplete: async (snapshot: {
      stages: { target: string; content: string }[] }) => snapshot.stages.map(item => item.content).join('') };
    const controller = new IncrementalProposalController(repo, identity, authority, handler);
    assert.equal((await controller.begin()).nextSequence, 1);
    await assert.rejects(controller.begin(), /ALREADY_STARTED/);
    await assert.rejects(controller.finish({ finalMessage: 'Ready' }), /INCOMPLETE/);
    const first = stage(1, 0, 'docs/new.md', 0, '# New\n', false);
    assert.equal((await controller.stage(first, 'document')).revision, 1);
    const reopened = new IncrementalProposalController(new ChatRepository(), identity, authority, handler);
    assert.equal((await reopened.status()).targets[0].bytes, Buffer.byteLength(first.content));
    assert.equal((await reopened.stage(first, 'document')).revision, 1);
    await assert.rejects(reopened.stage({ ...first, content: 'other', digest: hash('other') }, 'document'),
      /REPLAY_CONFLICT/);
    await assert.rejects(reopened.stage(stage(3, 1, 'docs/new.md', 1, 'wrong', true), 'document'), /SEQUENCE/);
    await assert.rejects(reopened.stage(stage(2, 1, 'docs/new.md', 1, 'finish', true), 'prompt'), /DOMAIN/);
    await assert.rejects(reopened.stage({ ...stage(2, 1, 'docs/new.md', 1, 'finish', true), digest: 'wrong' },
      'document'), /STAGE_ARGUMENTS/);
    await assert.rejects(reopened.stage(stage(2, 1, '../outside.md', 1, 'bad', true), 'document'), /STAGE_ARGUMENTS/);
    await assert.rejects(reopened.stage(stage(2, 1, 'docs/new.md', 1, 'x'.repeat(16_001), true),
      'document'), /STAGE_ARGUMENTS/);
    await assert.rejects(reopened.finish({ finalMessage: 'Ready' }), /INCOMPLETE/);
    assert.equal((await reopened.stage(stage(2, 1, 'docs/new.md', 1, 'finish', true), 'document')).revision, 2);
    await assert.rejects(reopened.finish({ finalMessage: '' }), /FINISH_ARGUMENTS/);
    const handoff = await reopened.finish({ finalMessage: 'Prepared for review.' });
    assert.equal(handoff.finalMessage, 'Prepared for review.');
    assert.equal(handoff.candidate, '# New\nfinish');
    await assert.rejects(reopened.finish({ finalMessage: 'again' }), /ALREADY_FINISHED/);
    assert.equal(await readFile(canonical, 'utf8'), 'original\n');
    assert.equal((await repo.read(root)).chats[0].messages.length, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('foreign lease, stale source, unsupported domain and cancellation fail closed', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-proposal-'));
  const repo = new ChatRepository(), chatId = randomUUID(), messageId = randomUUID();
  try {
    await repo.mutate(root, 0, { type: 'create-chat', id: chatId, folderPath: '' });
    const lease = await repo.claim(root, chatId, 'panel');
    if (!lease.acquired) throw new Error('missing lease');
    const identity = { root, chatId, messageId, leaseToken: lease.token, ownerId: 'panel',
      worktreeId: 'worktree-a', sourceBasis: 'source-a', domain: 'prompt' as const };
    let source = 'source-a';
    const authority = async () => ({ worktreeId: 'worktree-a', sourceBasis: source });
    const controller = new IncrementalProposalController(repo, identity, authority);
    await controller.begin();
    await assert.rejects(controller.stage(stage(1, 0, 'docs/tasks/p1.txt', 0, 'safe', true), 'prompt'),
      /DOMAIN_NOT_SUPPORTED/);
    const foreign = new IncrementalProposalController(repo, { ...identity, chatId: randomUUID() }, authority);
    await assert.rejects(foreign.status(), /lease|FOREIGN_SESSION/);
    const wrongOwner = new IncrementalProposalController(repo, { ...identity, ownerId: 'other-panel' }, authority);
    await assert.rejects(wrongOwner.status(), /FOREIGN_SESSION/);
    const wrongLease = new IncrementalProposalController(repo, { ...identity, leaseToken: 'other-lease' }, authority);
    await assert.rejects(wrongLease.status(), /lease/);
    const otherRoot = await mkdtemp(join(tmpdir(), 'dope-proposal-other-'));
    try {
      const wrongProject = new IncrementalProposalController(repo, { ...identity, root: otherRoot }, authority);
      await assert.rejects(wrongProject.status(), /lease/);
    } finally { await rm(otherRoot, { recursive: true, force: true }); }
    source = 'source-b';
    await assert.rejects(controller.status(), /STALE_SOURCE/);
    source = 'source-a';
    await assert.rejects(controller.status(), /TERMINAL/);
    const cancellable = new IncrementalProposalController(repo, { ...identity, messageId: randomUUID() }, authority);
    await cancellable.begin();
    assert.equal((await cancellable.cancel()).state, 'cancelled');
    await assert.rejects(cancellable.status(), /TERMINAL/);
    await repo.release(root, chatId, lease.token);
    await assert.rejects(controller.begin(), /lease/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
