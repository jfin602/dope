import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { cp, link, lstat, mkdtemp, mkdir, open, readFile, readdir, rm, symlink, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { assignedChatColor, compareChatsByInteraction, parseChatMessage } from '../../packages/chat/lib/index.js';
import { ChatRepository } from '../../packages/chat/lib/node/chat-repository.js';
import { TypeScriptAnalyzer } from '../../packages/code-analysis-typescript/lib/index.js';
import { SoftwareMapIndex } from '../../packages/code-analysis/lib/node/software-map-index.js';
import { sameSemanticBasis } from '../../packages/visual-planning/lib/index.js';

const folder = () => mkdtemp(join(tmpdir(), 'dope-chat-'));
const id = () => randomUUID();
const model = { connectionId: 'local', modelId: 'model' };
const provenance = { schemaVersion: 1 as const, ...model, providerId: 'test', modelLabel: 'Test' };
const emptyAnalysis = { projects: [], nodes: [], relationships: [], evidence: [], status: { completeness: 'complete' as const, errors: [] } };

test('generation limit policy persists across repository reopen', async () => {
  const root = await folder(), repo = new ChatRepository(), chatId = id();
  try {
    let state = await repo.mutate(root, 0, { type: 'create-chat', id: chatId, folderPath: '' });
    assert.equal(state.chats[0].settings.outputLimitPolicy, 'ask');
    state = await repo.mutate(root, state.revision, { type: 'set-settings', chatId,
      settings: { ...state.chats[0].settings, outputLimitPolicy: 'allow' } });
    assert.equal((await new ChatRepository().read(root)).chats[0].settings.outputLimitPolicy, 'allow');
    await assert.rejects(repo.mutate(root, state.revision, { type: 'set-settings', chatId,
      settings: { ...state.chats[0].settings, outputLimitPolicy: 'invalid' as never } }), /output limit policy/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('partial output is append-once, lease-bound, and remains noncanonical through stop and recovery', async () => {
  const root = await folder(), repo = new ChatRepository(), chatId = id(), messageId = id(), executionId = id();
  try {
    let state = await repo.mutate(root, 0, { type: 'create-chat', id: chatId, folderPath: '' });
    const lease = await repo.claim(root, chatId, 'partial-owner');
    if (!lease.acquired) throw new Error('Chat claim missing');
    state = await repo.mutate(root, state.revision, { type: 'begin-assistant', chatId, message: {
      schemaVersion: 1, id: messageId, role: 'assistant', createdAt: state.chats[0].updatedAt, content: '',
      execution: { schemaVersion: 1, id: executionId, status: 'pending', selectedModel: model,
        startedAt: state.chats[0].updatedAt } } }, lease.token);
    state = await repo.mutate(root, state.revision, { type: 'start-assistant', chatId, messageId,
      actualModel: provenance, outputLimitPolicy: 'ask' }, lease.token);
    const append = { type: 'append-answer-partial' as const, chatId, messageId, executionId,
      segment: 1, cursor: 0, delta: 'Draft 🔥' };
    await assert.rejects(repo.mutate(root, state.revision, append, 'wrong-lease'), /lease/);
    await assert.rejects(repo.mutate(root, state.revision, { ...append, executionId: id() }, lease.token), /cursor or execution/);
    state = await repo.mutate(root, state.revision, append, lease.token);
    const cursor = Buffer.byteLength(append.delta);
    await assert.rejects(repo.mutate(root, state.revision, append, lease.token), /cursor or execution/);
    await assert.rejects(repo.mutate(root, state.revision, { ...append, cursor, segment: 2 }, lease.token), /append/);
    assert.deepEqual(await repo.search(root, 'Draft', 5), []);
    state = await repo.mutate(root, state.revision, { type: 'pause-output-limit', chatId, messageId,
      executionId, segment: 1, cursor, finishReason: 'length' }, lease.token);
    const paused = state.chats[0].messages[0];
    assert.equal(paused.role, 'assistant');
    if (paused.role === 'assistant') {
      assert.equal(paused.content, '');
      assert.equal(paused.answerPartial?.text, 'Draft 🔥');
      assert.equal(paused.execution.status, 'paused-output-limit');
      assert.equal(paused.execution.outputLimitPolicy, 'ask');
    }
    await assert.rejects(repo.mutate(root, state.revision, { type: 'append-user', chatId, message: {
      schemaVersion: 1, id: id(), role: 'user', createdAt: new Date().toISOString(),
      content: 'A new question', contextRefs: [] } }, lease.token), /active Chat execution/);
    const stop = { type: 'stop-incomplete' as const, chatId, messageId, executionId, cursor };
    const decisions = await Promise.allSettled([
      repo.mutate(root, state.revision, stop, lease.token),
      new ChatRepository().mutate(root, state.revision,
        { type: 'resume-output-limit', chatId, messageId, executionId, cursor }, lease.token)]);
    assert.equal(decisions.filter(result => result.status === 'fulfilled').length, 1);
    state = await repo.read(root);
    const current = state.chats[0].messages[0];
    if (current.role !== 'assistant') throw new Error('Assistant missing');
    if (current.execution.status === 'streaming') {
      state = await repo.mutate(root, state.revision, { type: 'pause-output-limit', chatId, messageId,
        executionId, segment: 2, cursor, finishReason: 'length' }, lease.token);
      state = await repo.mutate(root, state.revision, stop, lease.token);
    }
    await assert.rejects(repo.mutate(root, state.revision, stop, lease.token), /not paused/);
    const stopped = state.chats[0].messages[0];
    if (stopped.role !== 'assistant') throw new Error('Assistant missing');
    assert.equal(stopped.execution.status, 'stopped-incomplete');
    assert.equal(stopped.content, '');
    assert.equal(stopped.answerPartial?.text, 'Draft 🔥');
    await repo.release(root, chatId, lease.token);
    const reopened = (await new ChatRepository().read(root)).chats[0].messages[0];
    if (reopened.role !== 'assistant') throw new Error('Assistant missing');
    assert.equal(reopened.execution.status, 'stopped-incomplete');
    assert.equal(reopened.answerPartial?.text, 'Draft 🔥');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('completed continuation commits one answer; abandoned pause recovers as interrupted', async () => {
  const root = await folder(), repo = new ChatRepository(), chatId = id();
  try {
    let state = await repo.mutate(root, 0, { type: 'create-chat', id: chatId, folderPath: '' });
    const lease = await repo.claim(root, chatId, 'owner');
    if (!lease.acquired) throw new Error('Chat claim missing');
    for (const complete of [true, false]) {
      const messageId = id(), executionId = id();
      state = await repo.mutate(root, state.revision, { type: 'begin-assistant', chatId, message: {
        schemaVersion: 1, id: messageId, role: 'assistant', createdAt: state.chats[0].updatedAt, content: '',
        execution: { schemaVersion: 1, id: executionId, status: 'pending', selectedModel: model,
          startedAt: state.chats[0].updatedAt } } }, lease.token);
      state = await repo.mutate(root, state.revision,
        { type: 'start-assistant', chatId, messageId, actualModel: provenance }, lease.token);
      state = await repo.mutate(root, state.revision,
        { type: 'append-answer-partial', chatId, messageId, executionId, segment: 1, cursor: 0, delta: 'Half' }, lease.token);
      state = await repo.mutate(root, state.revision,
        { type: 'pause-output-limit', chatId, messageId, executionId, segment: 1, cursor: 4, finishReason: 'length' }, lease.token);
      if (complete) {
        state = await repo.mutate(root, state.revision,
          { type: 'resume-output-limit', chatId, messageId, executionId, cursor: 4 }, lease.token);
        await assert.rejects(repo.mutate(root, state.revision,
          { type: 'finish-assistant', chatId, messageId, outcome: 'complete', content: 'Different' }, lease.token), /differs/);
        await assert.rejects(repo.mutate(root, state.revision,
          { type: 'finish-assistant', chatId, messageId, outcome: 'complete', content: 'Half done',
            finishReason: 'length' }, lease.token), /Output limit/);
        state = await repo.mutate(root, state.revision,
          { type: 'finish-assistant', chatId, messageId, outcome: 'complete', content: 'Half done' }, lease.token);
        const done = state.chats[0].messages.at(-1);
        if (done?.role !== 'assistant') throw new Error('Assistant missing');
        assert.equal(done.content, 'Half done');
        assert.equal(done.answerPartial, undefined);
      }
    }
    await repo.release(root, chatId, lease.token);
    const recovered = await new ChatRepository().read(root);
    const interrupted = recovered.chats[0].messages.at(-1);
    if (interrupted?.role !== 'assistant') throw new Error('Assistant missing');
    assert.equal(interrupted.execution.status, 'interrupted');
    assert.equal(interrupted.content, '');
    assert.equal(interrupted.answerPartial?.text, 'Half');
    assert.deepEqual((await repo.search(root, 'Half', 5)).map(hit => hit.messageId),
      [recovered.chats[0].messages[0].id]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('historical locked Roadmap text remains readable and inert after generator removal', () => {
  const messageId = id(), executionId = id();
  const text = 'Phase 1 — Historical planning only. '.repeat(10);
  const message = parseChatMessage({ schemaVersion: 1, id: messageId, role: 'assistant',
    createdAt: new Date().toISOString(), content: 'Saved historical answer',
    execution: { schemaVersion: 1, id: executionId, status: 'complete', selectedModel: model, actualModel: provenance,
      startedAt: new Date().toISOString(), finishedAt: new Date().toISOString() },
    lockedRoadmapPlan: { schemaVersion: 1, status: 'planning-only', text,
      sha256: createHash('sha256').update(text).digest('hex'), projectRoot: '/tmp/historical',
      projectId: 'historical-project', chatId: id(), userMessageId: id(), assistantMessageId: messageId,
      executionId, turnId: messageId, leaseDigest: 'a'.repeat(64), ownerRevision: 0,
      sourceHash: null, createdAt: new Date().toISOString() } });
  assert.equal(message.role, 'assistant');
  if (message.role === 'assistant') {
    assert.equal(message.lockedRoadmapPlan?.text, text);
    assert.equal(message.lockedRoadmapPlan?.status, 'planning-only');
  }
});

test('simultaneous claims across repository instances have exactly one writer', async () => {
  const root = await folder(), chatId = id();
  const first = new ChatRepository(), second = new ChatRepository();
  try {
    await first.mutate(root, 0, { type: 'create-chat', id: chatId, folderPath: '' });
    const results = await Promise.all([first.claim(root, chatId, 'first-tab'), second.claim(root, chatId, 'second-tab')]);
    assert.equal(results.filter(result => result.acquired).length, 1);
    const winner = results.find(result => result.acquired);
    if (!winner?.acquired) throw new Error('No writer');
    await assert.rejects(first.release(root, chatId, 'guessed-token'), /lost/);
    assert.equal((await second.claim(root, chatId, 'same-panel-id')).acquired, false);
    await first.release(root, chatId, winner.token);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('read follows a replaced manifest during concurrent Chat revisions', async () => {
  const root = await folder(), repo = new ChatRepository(), chatId = id();
  try {
    let state = await repo.mutate(root, 0, { type: 'create-chat', id: chatId, folderPath: '' });
    await Promise.all([
      (async () => {
        for (let step = 0; step < 40; step++)
          state = await repo.mutate(root, state.revision,
            { type: 'rename-chat', chatId, title: `Revision ${step}` });
      })(),
      (async () => {
        for (let step = 0; step < 120; step++) {
          const snapshot = await repo.read(root);
          assert.equal(snapshot.chats.length, 1);
          assert.equal(snapshot.chats[0].id, chatId);
        }
      })()
    ]);
    assert.equal((await repo.read(root)).chats[0].title, 'Revision 39');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('delete Chat removes its saved file and index entry after the writer releases it', async () => {
  const root = await folder(), repo = new ChatRepository(), chatId = id(), keptId = id();
  try {
    let state = await repo.mutate(root, 0, { type: 'create-chat', id: chatId, folderPath: '', title: 'Disposable' });
    state = await repo.mutate(root, state.revision, { type: 'create-chat', id: keptId, folderPath: '', title: 'Keep' });
    const manifestPath = join(root, '.dope/chats/index.json');
    const entry = JSON.parse(await readFile(manifestPath, 'utf8')).entries.find((item: { id: string }) => item.id === chatId);
    const savedFile = join(root, '.dope/chats/folders', entry.file);
    const lease = await repo.claim(root, chatId, 'owner');
    if (!lease.acquired) throw new Error('Chat claim missing');
    await assert.rejects(repo.mutate(root, state.revision, { type: 'delete-chat', chatId }), /open Chat/);
    assert.ok((await lstat(savedFile)).isFile());
    await repo.release(root, chatId, lease.token);
    state = await repo.mutate(root, state.revision, { type: 'delete-chat', chatId });
    assert.deepEqual(state.chats.map(chat => chat.id), [keptId]);
    await assert.rejects(lstat(savedFile), { code: 'ENOENT' });
    await assert.rejects(lstat(join(root, '.dope/chats/.leases', `${chatId}.json`)), { code: 'ENOENT' });
    assert.equal(JSON.parse(await readFile(manifestPath, 'utf8')).entries.some((item: { id: string }) =>
      item.id === chatId), false);
    await assert.rejects(repo.mutate(root, state.revision, { type: 'delete-chat', chatId }), /not found/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('nested folders and chats survive copy/reopen with stable ID, revisions and bounded search', async () => {
  const root = await folder(), copyRoot = await folder();
  const repo = new ChatRepository(), chatId = id(), messageId = id();
  try {
    assert.equal(await repo.root(pathToFileURL(root).href), root);
    let state = await repo.mutate(root, 0, { type: 'create-folder', path: 'Research' });
    state = await repo.mutate(root, state.revision, { type: 'create-folder', path: 'Research/Notes' });
    state = await repo.mutate(root, state.revision, { type: 'create-chat', id: chatId, folderPath: 'Research/Notes' });
    assert.equal(state.chats[0].color, assignedChatColor(chatId));
    const lease = await repo.claim(root, chatId, 'panel');
    if (!lease.acquired) throw new Error('claim failed');
    state = await repo.mutate(root, state.revision, { type: 'append-user', chatId,
      message: { schemaVersion: 1, id: messageId, role: 'user', createdAt: state.chats[0].createdAt,
        content: 'How does the repository recover?', contextRefs: [] } }, lease.token);
    assert.equal((await repo.search(root, 'repository', 1))[0].messageId, messageId);
    assert.equal((await repo.search(root, 'repository', 1))[0].excerpt, 'How does the repository recover?');
    assert.deepEqual(await repo.search(root, 'repository', 1, chatId), []);
    await assert.rejects(repo.search(root, 'x', 51), /search/);
    state = await repo.mutate(root, state.revision, { type: 'move-folder', path: 'Research/Notes', destination: '' });
    assert.equal(state.chats[0].folderPath, 'Notes');
    assert.equal(state.chats[0].id, chatId);
    assert.equal(state.chats[0].revision, 2);
    assert.ok((await lstat(join(root, '.dope/chats/folders/Notes'))).isDirectory());
    state = await repo.mutate(root, state.revision, { type: 'move-chat', chatId, folderPath: 'Research' });
    assert.equal(state.chats[0].id, chatId);
    assert.equal(state.chats[0].revision, 3);
    assert.ok((await lstat(join(root, '.dope/chats/folders/Research'))).isDirectory());
    await cp(root, join(copyRoot, 'project'), { recursive: true });
    assert.deepEqual(await new ChatRepository().read(join(copyRoot, 'project')), state);
    const copiedLease = await new ChatRepository().claim(join(copyRoot, 'project'), chatId, 'copy-panel');
    assert.equal(copiedLease.acquired, true);
    if (copiedLease.acquired) await repo.release(join(copyRoot, 'project'), chatId, copiedLease.token);
    assert.deepEqual(await new ChatRepository().read(root), state);
    assert.deepEqual(await new ChatRepository().read(copyRoot), { schemaVersion: 1, revision: 0, folders: [], chats: [] });
    await assert.rejects(repo.mutate(root, state.revision - 1, { type: 'rename-chat', chatId, title: 'stale' }), /Stale/);
    await repo.release(root, chatId, lease.token);
  } finally { await rm(root, { recursive: true, force: true }); await rm(copyRoot, { recursive: true, force: true }); }
});

test('set-color is lease-free durable metadata across rename, move and isolated projects', async () => {
  const root = await folder(), other = await folder(), repo = new ChatRepository(), chatId = id();
  try {
    let state = await repo.mutate(root, 0, { type: 'create-chat', id: chatId, folderPath: '' });
    const interaction = state.chats[0].lastInteractedAt;
    await assert.rejects(repo.mutate(root, state.revision,
      { type: 'set-color', chatId, color: 'chartreuse' as never }), /color/);
    assert.equal((await repo.read(root)).revision, state.revision);
    state = await repo.mutate(root, state.revision, { type: 'set-color', chatId, color: 'pink' });
    assert.equal(state.chats[0].lastInteractedAt, interaction);
    assert.equal(state.chats[0].color, 'pink');
    state = await repo.mutate(root, state.revision, { type: 'create-folder', path: 'Moved' });
    state = await repo.mutate(root, state.revision, { type: 'rename-chat', chatId, title: 'Renamed' });
    state = await repo.mutate(root, state.revision, { type: 'move-chat', chatId, folderPath: 'Moved' });
    assert.equal((await new ChatRepository().read(root)).chats[0].color, 'pink');
    assert.equal((await repo.read(root)).chats[0].lastInteractedAt, interaction);
    assert.deepEqual(await repo.read(other), { schemaVersion: 1, revision: 0, folders: [], chats: [] });
  } finally { await rm(root, { recursive: true, force: true }); await rm(other, { recursive: true, force: true }); }
});

test('valid no-color Chats migrate once with transcript, settings, timestamps and ordering intact', async () => {
  const root = await folder(), repo = new ChatRepository(), first = id(), second = id();
  try {
    let state = await repo.mutate(root, 0, { type: 'create-folder', path: 'Notes' });
    state = await repo.mutate(root, state.revision, { type: 'create-chat', id: first, folderPath: 'Notes', title: 'First' });
    state = await repo.mutate(root, state.revision, { type: 'create-chat', id: second, folderPath: '', title: 'Second' });
    const settings = { schemaVersion: 1 as const, defaultModel: model, context: {
      maxInputTokens: 1000, reservedOutputTokens: 100, history: 'none' as const,
      savedChatSearch: true, allowedSources: ['editor' as const],
    } };
    state = await repo.mutate(root, state.revision, { type: 'set-settings', chatId: first, settings });
    const lease = await repo.claim(root, first, 'panel');
    if (!lease.acquired) throw new Error('claim failed');
    state = await repo.mutate(root, state.revision, { type: 'append-user', chatId: first,
      message: { schemaVersion: 1, id: id(), role: 'user', createdAt: state.chats[0].updatedAt,
        content: 'Persist me', contextRefs: [] } }, lease.token);
    const before = state.chats;
    const manifestPath = join(root, '.dope/chats/index.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    let firstFile = '';
    for (const entry of manifest.entries) {
      const file = join(root, '.dope/chats/folders', entry.folderPath, entry.file);
      const stored = JSON.parse(await readFile(file, 'utf8'));
      delete stored.color;
      if (entry.id === first) {
        stored.settings.defaultModel = stored.settings.modelPolicy.model;
        delete stored.settings.modelPolicy;
      } else delete stored.settings.modelPolicy;
      await writeFile(file, JSON.stringify(stored));
      if (entry.id === first) firstFile = file;
    }
    const validLegacy = await readFile(firstFile, 'utf8');
    await writeFile(firstFile, JSON.stringify({ ...JSON.parse(validLegacy), titleSource: 'unknown' }));
    await assert.rejects(new ChatRepository().read(root), /Corrupt or unsupported Chat file/);
    assert.equal(JSON.parse(await readFile(manifestPath, 'utf8')).revision, state.revision);
    await writeFile(firstFile, validLegacy);
    const migrated = await new ChatRepository().read(root);
    assert.deepEqual(migrated.chats.find(chat => chat.id === first)?.settings.modelPolicy,
      { type: 'exact', model });
    assert.deepEqual(migrated.chats.find(chat => chat.id === second)?.settings.modelPolicy,
      { type: 'follow-interactive' });
    await repo.renew(root, first, lease.token);
    await repo.release(root, first, lease.token);
    assert.equal(migrated.revision, state.revision + 1);
    assert.deepEqual(migrated.chats.map(chat => chat.id), before.map(chat => chat.id));
    assert.deepEqual([...migrated.chats].sort(compareChatsByInteraction).map(chat => chat.id),
      [...before].sort(compareChatsByInteraction).map(chat => chat.id));
    for (let i = 0; i < before.length; i++) {
      assert.deepEqual(migrated.chats[i], { ...before[i], color: assignedChatColor(before[i].id), revision: before[i].revision + 1 });
    }
    assert.deepEqual(await new ChatRepository().read(root), migrated);
    assert.equal(JSON.parse(await readFile(manifestPath, 'utf8')).revision, migrated.revision);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('locks, leases and abandoned execution recovery retain truthful status', async () => {
  const root = await folder(), repo = new ChatRepository(), chatId = id();
  try {
    let state = await repo.mutate(root, 0, { type: 'create-chat', id: chatId, folderPath: '' });
    const lock = join(root, '.dope/chats/.mutation.lock');
    await writeFile(lock, `${process.pid}\n`);
    await assert.rejects(repo.mutate(root, state.revision, { type: 'rename-chat', chatId, title: 'blocked' }), /locked/);
    await rm(lock);
    await writeFile(lock, '99999999\n');
    state = await repo.mutate(root, state.revision, { type: 'rename-chat', chatId, title: 'recovered' });
    assert.equal(state.chats[0].title, 'recovered');
    const first = await repo.claim(root, chatId, 'panel-a');
    assert.equal(first.acquired, true);
    const denied = await new ChatRepository().claim(root, chatId, 'panel-b');
    assert.equal(denied.acquired, false);
    if (denied.acquired) throw new Error('Expected denied lease');
    assert.equal(denied.ownerId, 'panel-a');
    assert.ok(denied.retryAfterMs > 0 && denied.retryAfterMs <= 60_010);
    if (!first.acquired) throw new Error('claim failed');
    await repo.renew(root, chatId, first.token);
    const assistantId = id();
    state = await repo.mutate(root, state.revision, { type: 'begin-assistant', chatId, message: {
      schemaVersion: 1, id: assistantId, role: 'assistant', createdAt: state.chats[0].updatedAt,
      content: '', execution: { schemaVersion: 1, id: id(), status: 'pending', selectedModel: model,
        startedAt: state.chats[0].updatedAt },
    } }, first.token);
    state = await repo.mutate(root, state.revision, { type: 'start-assistant', chatId,
      messageId: assistantId, actualModel: provenance }, first.token);
    assert.equal((await repo.read(root)).chats[0].messages[0].role, 'assistant');
    await repo.release(root, chatId, first.token);
    const recovered = await new ChatRepository().read(root);
    const execution = recovered.chats[0].messages[0];
    assert.equal(execution.role, 'assistant');
    if (execution.role !== 'assistant') throw new Error('assistant missing');
    assert.equal(execution.execution.status, 'failed');
    assert.equal(execution.execution.failure, 'Interrupted before completion');
    assert.equal(recovered.chats[0].lastInteractedAt, state.chats[0].lastInteractedAt);
    assert.equal(recovered.revision, state.revision + 1);
    const second = await repo.claim(root, chatId, 'panel-c');
    assert.equal(second.acquired, true);
    if (second.acquired) {
      const pendingId = id();
      await repo.mutate(root, recovered.revision, { type: 'begin-assistant', chatId, message: {
        schemaVersion: 1, id: pendingId, role: 'assistant', createdAt: recovered.chats[0].updatedAt,
        content: '', execution: { schemaVersion: 1, id: id(), status: 'pending', selectedModel: model,
          startedAt: recovered.chats[0].updatedAt },
      } }, second.token);
      const file = join(root, '.dope/chats/.leases', `${chatId}.json`);
      const lease = JSON.parse(await readFile(file, 'utf8'));
      await writeFile(file, JSON.stringify({ ...lease, pid: 99999999 }));
      const reclaimed = await new ChatRepository().claim(root, chatId, 'panel-d');
      assert.equal(reclaimed.acquired, true);
      const pending = (await repo.read(root)).chats[0].messages[1];
      assert.equal(pending.role, 'assistant');
      if (pending.role === 'assistant') assert.equal(pending.execution.status, 'failed');
      await assert.rejects(repo.release(root, chatId, second.token), /lost/);
      if (reclaimed.acquired) await repo.release(root, chatId, reclaimed.token);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a second panel waits for a short live Chat lock', async () => {
  const root = await folder(), repo = new ChatRepository();
  try {
    await repo.mutate(root, 0, { type: 'create-chat', id: id(), folderPath: '' });
    const lock = join(root, '.dope/chats/.mutation.lock');
    await writeFile(lock, `${process.pid}\n`);
    const release = new Promise<void>((resolve, reject) => setTimeout(() => rm(lock).then(resolve, reject), 30));
    assert.equal((await repo.read(root)).chats.length, 1);
    await release;
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('an orphaned empty legacy lock recovers without changing existing conversations', async () => {
  const root = await folder(), repo = new ChatRepository(), chatId = id();
  try {
    const before = await repo.mutate(root, 0, { type: 'create-chat', id: chatId, folderPath: '', title: 'Kept' });
    const lock = join(root, '.dope/chats/.mutation.lock');
    await writeFile(lock, '');
    const old = new Date(Date.now() - 60_000);
    await utimes(lock, old, old);
    const results = await Promise.all([repo.mutate(root, before.revision,
      { type: 'rename-chat', chatId, title: 'Recovered' }),
    new ChatRepository().mutate(root, before.revision,
      { type: 'rename-chat', chatId, title: 'Competing' })].map(p => p.then(value => value, error => error)));
    assert.equal(results.filter(value => !(value instanceof Error)).length, 1);
    const after = await new ChatRepository().read(root);
    assert.equal(after.chats.length, 1);
    assert.equal(after.chats[0].id, chatId);
    assert.equal(after.revision, before.revision + 1);
    await assert.rejects(lstat(lock), { code: 'ENOENT' });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('an open empty legacy lock is not stolen, and a failed mutation releases its lock', async () => {
  const root = await folder(), repo = new ChatRepository(), chatId = id();
  try {
    const state = await repo.mutate(root, 0, { type: 'create-chat', id: chatId, folderPath: '' });
    const lock = join(root, '.dope/chats/.mutation.lock');
    const holder = await open(lock, 'wx');
    try {
      const old = new Date(Date.now() - 60_000);
      await utimes(lock, old, old);
      await assert.rejects(repo.mutate(root, state.revision,
        { type: 'rename-chat', chatId, title: 'Blocked' }), /locked/);
      assert.equal((await lstat(lock)).size, 0);
    } finally { await holder.close(); }
    await repo.mutate(root, state.revision, { type: 'rename-chat', chatId, title: 'Recovered' });
    await assert.rejects(repo.mutate(root, state.revision,
      { type: 'rename-chat', chatId, title: 'Stale' }), /Stale Chat revision/);
    await repo.mutate(root, state.revision + 1, { type: 'rename-chat', chatId, title: 'Still works' });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('an interrupted empty-lock recovery marker is reclaimed on retry', async () => {
  const root = await folder(), repo = new ChatRepository(), chatId = id();
  try {
    const state = await repo.mutate(root, 0, { type: 'create-chat', id: chatId, folderPath: '' });
    const lock = join(root, '.dope/chats/.mutation.lock');
    await writeFile(lock, '');
    const old = new Date(Date.now() - 60_000);
    await utimes(lock, old, old);
    await link(lock, `${lock}.recover`);
    const updated = await repo.mutate(root, state.revision, { type: 'rename-chat', chatId, title: 'Recovered' });
    assert.equal(updated.chats[0].title, 'Recovered');
    await assert.rejects(lstat(lock), { code: 'ENOENT' });
    await assert.rejects(lstat(`${lock}.recover`), { code: 'ENOENT' });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('completed turns retain actual model and failure cannot masquerade as completion', async () => {
  const root = await folder(), repo = new ChatRepository(), chatId = id(), messageId = id();
  try {
    let state = await repo.mutate(root, 0, { type: 'create-chat', id: chatId, folderPath: '' });
    const lease = await repo.claim(root, chatId, 'panel');
    state = await repo.mutate(root, state.revision, { type: 'begin-assistant', chatId, message: {
      schemaVersion: 1, id: messageId, role: 'assistant', content: '', createdAt: state.chats[0].createdAt,
      execution: { schemaVersion: 1, id: id(), status: 'pending', selectedModel: model, startedAt: state.chats[0].createdAt },
    } }, lease.acquired ? lease.token : undefined);
    await assert.rejects(repo.mutate(root, state.revision, { type: 'start-assistant', chatId, messageId, actualModel: provenance }), /lease/);
    state = await repo.mutate(root, state.revision, { type: 'start-assistant', chatId, messageId, actualModel: provenance },
      lease.acquired ? lease.token : undefined);
    await assert.rejects(repo.mutate(root, state.revision, { type: 'finish-assistant', chatId, messageId,
      outcome: 'complete', content: 'wrong', actualModel: { ...provenance, providerId: 'other' } },
      lease.acquired ? lease.token : undefined), /immutable/);
    const compaction = { canonicalContextSha256: 'a'.repeat(64), originalSha256: 'b'.repeat(64),
      compactedSha256: 'c'.repeat(64), tokensBefore: 4940 };
    state = await repo.mutate(root, state.revision, { type: 'finish-assistant', chatId, messageId,
      outcome: 'complete', content: 'Answer', compaction }, lease.acquired ? lease.token : undefined);
    const message = (await new ChatRepository().read(root)).chats[0].messages[0];
    assert.equal(message.role, 'assistant');
    if (message.role !== 'assistant') throw new Error('assistant missing');
    assert.equal(message.execution.status, 'complete');
    assert.deepEqual(message.execution.actualModel, provenance);
    assert.deepEqual(message.execution.compaction, compaction);
    await assert.rejects(repo.mutate(root, state.revision, { type: 'finish-assistant', chatId, messageId,
      outcome: 'complete', content: 'again', actualModel: provenance }, lease.acquired ? lease.token : undefined), /not active/);
    if (lease.acquired) await repo.release(root, chatId, lease.token);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Roadmap review details and terminal outcome survive a fresh repository read without approval authority', async () => {
  const root = await folder(), repo = new ChatRepository(), chatId = id(), messageId = id(), proposalId = id();
  try {
    let state = await repo.mutate(root, 0, { type: 'create-chat', id: chatId, folderPath: '' });
    const lease = await repo.claim(root, chatId, 'panel');
    if (!lease.acquired) throw new Error('claim failed');
    state = await repo.mutate(root, state.revision, { type: 'begin-assistant', chatId, message: {
      schemaVersion: 1, id: messageId, role: 'assistant', content: '', createdAt: state.chats[0].createdAt,
      execution: { schemaVersion: 1, id: id(), status: 'pending', selectedModel: model,
        startedAt: state.chats[0].createdAt },
    } }, lease.token);
    state = await repo.mutate(root, state.revision, { type: 'start-assistant', chatId,
      messageId, actualModel: provenance }, lease.token);
    state = await repo.mutate(root, state.revision, { type: 'finish-assistant', chatId, messageId,
      outcome: 'complete', content: '{"type":"roadmap-gate-proposal"}' }, lease.token);
    const proposal = { id: proposalId, chatId, messageId, ownerId: 'project', revision: 4,
      changedIds: ['gate'], action: { type: 'gate.edit', id: 'gate' }, summary: 'Old → New',
      preview: { source: 'validated-roadmap' as const, steps: [{ type: 'gate.edit', id: 'gate',
        title: 'New', affectedCount: 1 }], entities: [], totalChanged: 1, additionalChanges: 0,
        parentTitles: {} } };
    const activity = { schemaVersion: 1 as const, kind: 'roadmap-gate-proposal' as const,
      status: 'pending' as const, refs: [], proposalId, proposal };
    await repo.recordPlanningActivity(root, chatId, messageId, lease.token, activity);
    await repo.recordPlanningActivity(root, chatId, messageId, lease.token,
      { ...activity, status: 'applied', appliedRevision: 5 }, { proposalId, status: 'pending' });
    const saved = (await new ChatRepository().read(root)).chats[0].messages[0];
    assert.equal(saved.role, 'assistant');
    if (saved.role !== 'assistant') throw new Error('assistant missing');
    assert.equal(saved.planningActivity?.status, 'applied');
    assert.equal(saved.planningActivity.appliedRevision, 5);
    assert.deepEqual(saved.planningActivity.proposal?.preview?.steps, proposal.preview.steps);
    assert.equal(JSON.stringify(saved.planningActivity).includes('token'), false);
    await assert.rejects(repo.recordPlanningActivity(root, chatId, messageId, lease.token,
      activity, { proposalId, status: 'pending' }), /state changed/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('corrupt/future data and symlink/traversal paths fail closed without modifying outside project', async () => {
  const root = await folder(), outside = await folder(), repo = new ChatRepository(), chatId = id();
  try {
    await assert.rejects(repo.root('https://example.com/project'), /local/);
    await assert.rejects(repo.mutate(root, 0, { type: 'create-folder', path: '../escape' }), /path/);
    await repo.mutate(root, 0, { type: 'create-chat', id: chatId, folderPath: '' });
    const manifest = join(root, '.dope/chats/index.json');
    const original = await readFile(manifest, 'utf8');
    await writeFile(manifest, original.replace('"schemaVersion": 1', '"schemaVersion": 2'));
    await assert.rejects(repo.read(root), /Corrupt or unsupported/);
    await writeFile(manifest, '{');
    await assert.rejects(repo.mutate(root, 1, { type: 'rename-chat', chatId, title: 'bad' }), /Corrupt or unsupported/);
    await writeFile(manifest, original);
    const entry = JSON.parse(original).entries[0];
    const chatFile = join(root, '.dope/chats/folders', entry.file);
    const chatOriginal = await readFile(chatFile, 'utf8');
    await writeFile(chatFile, chatOriginal.replace('"schemaVersion": 1', '"schemaVersion": 2'));
    await assert.rejects(repo.read(root), /Corrupt or unsupported Chat file/);
    await writeFile(chatFile, chatOriginal);
    await rm(join(root, '.dope/chats/folders'), { recursive: true });
    await symlink(outside, join(root, '.dope/chats/folders'));
    await assert.rejects(repo.read(root), /Unsafe/);
    assert.deepEqual(await readFile(manifest, 'utf8'), original);
  } finally { await rm(root, { recursive: true, force: true }); await rm(outside, { recursive: true, force: true }); }
});

test('.dope/chats writes do not change Physical Map inputs or semantic Planning basis', async () => {
  const root = await folder(), repo = new ChatRepository();
  try {
    await writeFile(join(root, 'app.ts'), 'export const app = 1;\n');
    await writeFile(join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022' }, include: ['app.ts'] }));
    const index = new SoftwareMapIndex({ analyze: () => emptyAnalysis });
    const configured = new SoftwareMapIndex(new TypeScriptAnalyzer());
    const before = await index.analyze(root);
    const configuredBefore = await configured.analyze(root);
    assert.equal(before.state, 'ready');
    const chatId = id();
    let state = await repo.mutate(root, 0, { type: 'create-chat', id: chatId, folderPath: '' });
    state = await repo.mutate(root, state.revision, { type: 'rename-chat', chatId, title: 'New title' });
    assert.equal(await index.inputsCurrent(root), true);
    assert.equal(await configured.inputsCurrent(root), true);
    const after = await index.analyze(root);
    const configuredAfter = await configured.analyze(root);
    assert.equal(after.inputFingerprint, before.inputFingerprint);
    assert.equal(configuredAfter.inputFingerprint, configuredBefore.inputFingerprint);
    assert.equal(after.reusedSourceFiles, 0);
    const basis = { architectureRevision: 0, architectureFingerprint: 'same',
      physicalInputFingerprint: before.inputFingerprint!, physicalGeneration: before.publishedGeneration };
    assert.equal(sameSemanticBasis(basis, { ...basis, physicalInputFingerprint: after.inputFingerprint!,
      physicalGeneration: after.publishedGeneration }), true);
  } finally { await rm(root, { recursive: true, force: true }); }
});
