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
      stages: { target: string; content: string }[] }) => snapshot.stages.map(item => item.content).join(''),
    preview: async (snapshot: { stages: { target: string; content: string }[] }) => snapshot.stages.length ?
      [{ target: 'docs/new.md', path: 'docs/new.md', original: null,
        proposed: snapshot.stages.map(item => item.content).join('') }] : [] };
    const controller = new IncrementalProposalController(repo, identity, authority, handler);
    assert.equal((await controller.begin()).nextSequence, 1);
    await assert.rejects(controller.begin(), /ALREADY_STARTED/);
    await assert.rejects(controller.finish({ finalMessage: 'Ready' }), /INCOMPLETE/);
    const first = stage(1, 0, 'docs/new.md', 0, '# New\n', false);
    assert.equal((await controller.stage(first, 'document')).revision, 1);
    assert.deepEqual((await controller.progress()).targets.map(item =>
      ({ path: item.path, complete: item.complete, proposed: item.proposed })),
    [{ path: 'docs/new.md', complete: false, proposed: '# New\n' }]);
    const reopened = new IncrementalProposalController(new ChatRepository(), identity, authority, handler);
    assert.equal((await reopened.status()).targets[0].bytes, Buffer.byteLength(first.content));
    assert.equal((await reopened.stage(first, 'document')).revision, 1);
    await assert.rejects(reopened.stage({ ...first, content: 'other', digest: hash('other') }, 'document'),
      /REPLAY_CONFLICT/);
    await assert.rejects(reopened.stage(stage(3, 1, 'docs/new.md', 1, 'wrong', true), 'document'), /SEQUENCE/);
    await assert.rejects(reopened.stage(stage(2, 1, 'docs/new.md', 1, 'finish', true), 'prompt'), /DOMAIN/);
    await assert.rejects(reopened.stage({ ...stage(2, 1, 'docs/new.md', 1, 'finish', true), digest: 'wrong' },
      'document'), /STAGE_ARGUMENTS/);
    await assert.rejects(reopened.stage({ ...stage(2, 1, 'docs/new.md', 1, 'finish', true),
      idempotencyKey: 'a' }, 'document'), /STAGE_IDEMPOTENCY_KEY/);
    assert.equal((await reopened.status()).nextSequence, 2);
    await assert.rejects(reopened.stage(stage(2, 1, '../outside.md', 1, 'bad', true), 'document'), /STAGE_ARGUMENTS/);
    await assert.rejects(reopened.stage(stage(2, 1, 'docs/new.md', 1, 'x'.repeat(16_001), true),
      'document'), /STAGE_ARGUMENTS/);
    await assert.rejects(reopened.finish({ finalMessage: 'Ready' }), /INCOMPLETE/);
    assert.equal((await reopened.stage(stage(2, 1, 'docs/new.md', 1, 'finish', true), 'document')).revision, 2);
    await assert.rejects(reopened.finish({ finalMessage: '' }), /FINISH_ARGUMENTS/);
    await assert.rejects(reopened.finish({ finalMessage: 'Ready\u202e spoofed' }), /FINISH_ARGUMENTS/);
    await assert.rejects(reopened.finish({ finalMessage: 'x'.repeat(2_001) }), /FINISH_ARGUMENTS/);
    const handoff = await reopened.finish({ finalMessage: 'Prepared for review.' });
    assert.equal(handoff.finalMessage, 'Prepared for review.');
    assert.equal(handoff.candidate, '# New\nfinish');
    assert.equal((await reopened.progress()).state, 'ready-for-review');
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

test('broker-owned stage order serializes calls and rejects conflicting transport replay', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-model-stage-'));
  const repo = new ChatRepository(), chatId = randomUUID();
  try {
    await repo.mutate(root, 0, { type: 'create-chat', id: chatId, folderPath: '' });
    const lease = await repo.claim(root, chatId, 'panel');
    if (!lease.acquired) throw new Error('missing lease');
    const identity = { root, chatId, messageId: randomUUID(), leaseToken: lease.token,
      ownerId: 'panel', worktreeId: 'worktree-a', sourceBasis: 'source-a', domain: 'document' as const };
    const handler = { validateStage: async () => {}, validateComplete: async () => 'candidate' };
    const controller = new IncrementalProposalController(repo, identity,
      async () => ({ worktreeId: 'worktree-a', sourceBasis: 'source-a' }), handler);
    await controller.begin();
    const first = { target: 'docs/a.md', content: 'first', complete: false };
    const second = { target: 'docs/a.md', content: 'second', complete: true };
    assert.equal((await controller.stageModel(first, 'document', 17)).nextSequence, 2);
    assert.equal((await controller.stageModel(first, 'document', 17)).revision, 1);
    assert.equal((await controller.stageModel(first, 'document', 18)).revision, 1,
      'a new call with identical content cannot duplicate an ambiguous retry');
    await assert.rejects(controller.stageModel({ ...first, content: 'changed' }, 'document', 17),
      /REPLAY_CONFLICT/);
    const [a, b] = await Promise.all([controller.stageModel(second, 'document', 19),
      controller.stageModel({ target: 'docs/b.md', content: 'other', complete: true }, 'document', 20)]);
    assert.deepEqual([a.revision, b.revision].sort(), [2, 3]);
    assert.equal((await controller.status()).nextSequence, 4);
    await assert.rejects(controller.stageModel({ target: '../escape', content: 'bad', complete: true },
      'document', 21), /STAGE_INVALID_FIELD:target/);
    assert.equal((await controller.finish({ finalMessage: 'Ready.' })).candidate, 'candidate');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('direct prompt files survive restart with exact chunks, assigned handles and terminal closeout', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-direct-files-'));
  const repo = new ChatRepository(), chatId = randomUUID(), messageId = randomUUID();
  const canonical = join(root, 'P1-implement.txt');
  try {
    await repo.mutate(root, 0, { type: 'create-chat', id: chatId, folderPath: '' });
    const lease = await repo.claim(root, chatId, 'panel');
    if (!lease.acquired) throw new Error('missing lease');
    const identity = { root, chatId, messageId, leaseToken: lease.token, ownerId: 'panel',
      worktreeId: 'source-a', sourceBasis: 'head:version:source-a', domain: 'direct-prompt' as const };
    let basis = identity.sourceBasis;
    const authority = async () => ({ worktreeId: 'source-a', sourceBasis: basis });
    const controller = new IncrementalProposalController(repo, identity, authority);
    await controller.begin();
    const first = { title: 'Implement Unicode labels', body: 'A'.repeat(100), kind: 'work' as const,
      complete: false };
    const one = await controller.stageFile(first, 1);
    assert.equal(one.targets[0].target, 'P1');
    assert.equal(one.targets[0].filename, 'P1-implement-unicode-labels.txt');
    assert.equal(one.targets[0].digest, hash(first.body));
    assert.deepEqual(one.incompleteTargets, ['P1']);
    const reopened = new IncrementalProposalController(new ChatRepository(), identity, authority);
    assert.equal((await reopened.resume()).revision, 1);
    assert.equal((await reopened.stageFile(first, 1)).revision, 1);
    await assert.rejects(reopened.stageFile({ ...first, body: 'B'.repeat(100) }, 1), /REPLAY_CONFLICT/);
    await assert.rejects(reopened.stageFile({ ...first, body: 'B'.repeat(100) }, 2), /CHUNK_ORDER/);
    await assert.rejects(reopened.stageFile({ ...first, handle: 'P2' }, 2), /CHUNK_ORDER/);
    await assert.rejects(reopened.stageFile({ ...first, handle: 'P1', body: 'B'.repeat(16_001) }, 2),
      /STAGE_ARGUMENTS/);
    const second = { ...first, handle: 'P1', body: '🎯'.repeat(30), complete: true };
    assert.equal((await reopened.stageFile(second, 2)).targets[0].digest, hash(first.body + second.body));
    const next = await reopened.stageFile({ title: 'Verify labels', body: 'C'.repeat(100),
      kind: 'work', complete: true }, 3);
    assert.deepEqual(next.completedTargets, ['P1', 'P2']);
    await assert.rejects(reopened.stageFile({ title: 'Manual closeout', body: 'D'.repeat(100),
      kind: 'manual-closeout', complete: false }, 4), /CLOSEOUT_ORDER/);
    const closeout = await reopened.stageFile({ title: 'Manual closeout', body: 'D'.repeat(100),
      kind: 'manual-closeout', complete: true }, 4);
    assert.equal(closeout.targets.at(-1)?.target, 'P3');
    assert.equal(closeout.finishPermitted, true);
    await assert.rejects(reopened.stageFile({ title: 'More work', body: 'E'.repeat(100),
      kind: 'work', complete: true }, 5), /TERMINAL_CLOSEOUT/);
    assert.equal((await reopened.progress()).targets[0].proposed, '');
    await assert.rejects(readFile(canonical), /ENOENT/);
    await reopened.stop();
    assert.equal((await reopened.resume()).state, 'staging');
    const wrongOwner = new IncrementalProposalController(repo, { ...identity, ownerId: 'foreign' }, authority);
    await assert.rejects(wrongOwner.resume(), /FOREIGN_SESSION/);
    basis = 'changed';
    await assert.rejects(reopened.resume(), /STALE_SOURCE/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('sealed direct draft reopens for one checked file replacement without writing project files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-direct-revision-'));
  const repo = new ChatRepository(), chatId = randomUUID(), messageId = randomUUID();
  const canonical = join(root, 'P1-first.txt');
  try {
    await repo.mutate(root, 0, { type: 'create-chat', id: chatId, folderPath: '' });
    const lease = await repo.claim(root, chatId, 'panel');
    if (!lease.acquired) throw new Error('missing lease');
    const identity = { root, chatId, messageId, leaseToken: lease.token, ownerId: 'panel',
      worktreeId: 'source', sourceBasis: 'basis', domain: 'direct-prompt' as const };
    const handler = { validateStage: async () => {}, validateComplete: async (snapshot: {
      stages: { target: string; content: string }[] }) => snapshot.stages.map(stage => stage.content) };
    const controller = new IncrementalProposalController(repo, identity,
      async () => ({ worktreeId: 'source', sourceBasis: 'basis' }), handler);
    await controller.begin();
    const before = 'Original body '.repeat(12), other = 'Manual closeout '.repeat(9);
    await controller.stageFile({ title: 'First', body: before, kind: 'work', complete: true });
    await controller.stageFile({ title: 'Closeout', body: other, kind: 'manual-closeout', complete: true });
    const sealed = await controller.finish({ finalMessage: 'Ready' });
    assert.deepEqual(sealed.candidate, [before, other]);
    const receipt = await controller.reopenDirectRevision();
    assert.equal(receipt.state, 'staging');
    await assert.rejects(controller.reopenDirectRevision(), /REVISION_STATE/);
    await assert.rejects(controller.replaceFile({ handle: 'P2', expectedRevision: receipt.revision,
      expectedDigest: hash(before), body: 'Changed closeout '.repeat(9) }), /REPLACE_STALE/);
    const changed = 'Replacement body '.repeat(12);
    const replacement = await controller.replaceFile({ handle: 'P1', expectedRevision: receipt.revision,
      expectedDigest: hash(before), body: changed });
    assert.equal(replacement.targets[1].digest, hash(other));
    assert.notEqual(replacement.targets[0].digest, hash(before));
    const next = await controller.finish({ finalMessage: 'Revised' });
    assert.deepEqual(next.candidate, [changed, other]);
    assert.deepEqual(sealed.candidate, [before, other]);
    await assert.rejects(readFile(canonical), /ENOENT/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('direct staging accepts long bounded files and rejects file and total ceilings without changing accepted bytes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-direct-limits-'));
  const repo = new ChatRepository(), chatId = randomUUID();
  try {
    await repo.mutate(root, 0, { type: 'create-chat', id: chatId, folderPath: '' });
    const lease = await repo.claim(root, chatId, 'panel');
    if (!lease.acquired) throw new Error('missing lease');
    const identity = { root, chatId, messageId: randomUUID(), leaseToken: lease.token,
      ownerId: 'panel', worktreeId: 'worktree', sourceBasis: 'basis', domain: 'direct-prompt' as const };
    const limits = { payloadBytes: 20_000, chunkBytes: 16_000, fileBytes: 120_000,
      totalBytes: 120_000, files: 64, stages: 256, calls: 512, elapsedMs: 60_000 };
    const controller = new IncrementalProposalController(repo, identity,
      async () => ({ worktreeId: 'worktree', sourceBasis: 'basis' }), undefined, limits);
    await controller.begin();
    const parts = Array.from({ length: 9 }, (_, index) => String(index).repeat(12_000));
    for (const [index, body] of parts.entries()) {
      const status = await controller.stageFile({ title: 'Long implementation', body,
        kind: 'work', ...(index ? { handle: 'P1' } : {}), complete: index === 8 }, index + 1);
      assert.equal(status.targets[0].chunks, index + 1);
    }
    const before = await controller.status();
    assert.equal(before.targets[0].bytes, 108_000);
    await assert.rejects(controller.stageFile({ title: 'Overflow', body: 'X'.repeat(16_000),
      kind: 'work', complete: true }, 20), /BYTE_OR_FILE_LIMIT/);
    assert.equal((await controller.status()).targets[0].digest, hash(parts.join('')));
    await assert.rejects(controller.stageFile({ title: 'Outside', body: 'Y'.repeat(100),
      kind: 'work', handle: '../P2', complete: true }, 21), /STAGE_ARGUMENTS/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
