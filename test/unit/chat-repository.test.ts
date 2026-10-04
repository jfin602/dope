import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cp, lstat, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { assignedChatColor, compareChatsByInteraction } from '../../packages/chat/lib/index.js';
import { ChatRepository } from '../../packages/chat/lib/node/chat-repository.js';
import { TypeScriptAnalyzer } from '../../packages/code-analysis-typescript/lib/index.js';
import { SoftwareMapIndex } from '../../packages/code-analysis/lib/node/software-map-index.js';
import { sameSemanticBasis } from '../../packages/visual-planning/lib/index.js';

const folder = () => mkdtemp(join(tmpdir(), 'dope-chat-'));
const id = () => randomUUID();
const model = { connectionId: 'local', modelId: 'model' };
const provenance = { schemaVersion: 1 as const, ...model, providerId: 'test', modelLabel: 'Test' };
const emptyAnalysis = { projects: [], nodes: [], relationships: [], evidence: [], status: { completeness: 'complete' as const, errors: [] } };

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
    assert.deepEqual(await new ChatRepository().claim(root, chatId, 'panel-b'), { acquired: false, ownerId: 'panel-a' });
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
    state = await repo.mutate(root, state.revision, { type: 'finish-assistant', chatId, messageId,
      outcome: 'complete', content: 'Answer' }, lease.acquired ? lease.token : undefined);
    const message = (await new ChatRepository().read(root)).chats[0].messages[0];
    assert.equal(message.role, 'assistant');
    if (message.role !== 'assistant') throw new Error('assistant missing');
    assert.equal(message.execution.status, 'complete');
    assert.deepEqual(message.execution.actualModel, provenance);
    await assert.rejects(repo.mutate(root, state.revision, { type: 'finish-assistant', chatId, messageId,
      outcome: 'complete', content: 'again', actualModel: provenance }, lease.acquired ? lease.token : undefined), /not active/);
    if (lease.acquired) await repo.release(root, chatId, lease.token);
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
