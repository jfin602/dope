import assert from 'node:assert/strict';
import test from 'node:test';
import {
  availableChatContextTokens, compareChatsByInteraction, isChatFolderWithin, joinChatFolderPath,
  parseChat, parseChatCollection, parseChatFolderPath, suggestedChatTitle, withAutomaticChatTitle,
} from '../../packages/chat/lib/index.js';
import type { Chat, ChatAssistantMessage } from '../../packages/chat/lib/index.js';

const chatId = 'd6174551-e136-48a8-a3f8-f3d4f911a10c';
const userId = '52a6ccf4-5cf7-4d70-914b-44c2663d6554';
const assistantId = 'de929fad-2685-43a0-8a76-34161921757e';
const executionId = '913b5c67-b2d9-42c4-99b8-b863d8101405';
const now = '2026-10-03T12:00:00.000Z';
const later = '2026-10-03T12:01:00.000Z';
const selectedModel = { connectionId: 'local-main', modelId: 'chat-model' };

function sampleChat(): Chat {
  return {
    schemaVersion: 1, id: chatId, revision: 2, folderPath: 'Research/Nested',
    title: 'Draft', titleSource: 'placeholder', createdAt: now, updatedAt: later, lastInteractedAt: later,
    settings: { schemaVersion: 1, defaultModel: selectedModel, context: {
      maxInputTokens: 4096, reservedOutputTokens: 512, history: 'recent', savedChatSearch: false,
      allowedSources: ['editor', 'saved-chat'],
    } },
    messages: [
      { schemaVersion: 1, id: userId, role: 'user', createdAt: now, content: 'Explain this', contextRefs: [
        { schemaVersion: 1, kind: 'file', id: 'src/main.ts', label: 'src/main.ts', estimatedTokens: 80 },
      ] },
      { schemaVersion: 1, id: assistantId, role: 'assistant', createdAt: later, content: 'Here is the explanation.', execution: {
        schemaVersion: 1, id: executionId, status: 'complete', selectedModel,
        actualModel: { schemaVersion: 1, ...selectedModel, providerId: 'local', modelLabel: 'Chat Model' },
        startedAt: later, finishedAt: later,
      } },
    ],
  };
}

test('versioned Chat round trips with explicit execution and context provenance', () => {
  const chat = sampleChat();
  assert.deepEqual(parseChat(JSON.parse(JSON.stringify(chat))), chat);
  assert.deepEqual(parseChatCollection({ schemaVersion: 1, revision: 3,
    folders: [{ schemaVersion: 1, path: 'Research', createdAt: now },
      { schemaVersion: 1, path: 'Research/Nested', createdAt: now }], chats: [chat] }).chats[0], chat);
  const moved = parseChat({ ...chat, folderPath: 'Research', title: 'New name' });
  assert.equal(moved.id, chat.id);
  assert.deepEqual(moved.messages[1], chat.messages[1]);
});

test('strict parsing rejects unknown fields, malformed hierarchy and invalid execution lifecycle', () => {
  const chat = sampleChat();
  assert.throws(() => parseChat({ ...chat, hiddenReasoning: 'private' }));
  assert.throws(() => parseChat({ ...chat, schemaVersion: 2 }));
  assert.throws(() => parseChat({ ...chat, id: 'from-title' }));
  assert.throws(() => parseChat({ ...chat, settings: { ...chat.settings, context: {
    ...chat.settings.context, allowedSources: ['editor', 'editor'],
  } } }));
  assert.throws(() => parseChat({ ...chat, messages: [...chat.messages, {
    ...chat.messages[1], reasoning: 'private',
  }] }));
  assert.throws(() => parseChat({ ...chat, messages: [...chat.messages].reverse() }));
  assert.throws(() => parseChat({ ...chat, messages: [chat.messages[0], {
    ...chat.messages[1], execution: { ...(chat.messages[1] as ChatAssistantMessage).execution,
      actualModel: { ...selectedModel, providerId: 'hosted', modelLabel: 'Other', modelId: 'other-model' } },
  }] }));
  assert.throws(() => parseChatCollection({ schemaVersion: 1, revision: 0, folders: [], chats: [chat] }));
});

test('all assistant lifecycle statuses are represented without invented completion', () => {
  const chat = sampleChat();
  const assistant = chat.messages[1] as ChatAssistantMessage;
  for (const status of ['pending', 'streaming', 'complete', 'failed', 'cancelled'] as const) {
    const execution = { ...assistant.execution, status, actualModel: status === 'pending' ? undefined : assistant.execution.actualModel,
      finishedAt: status === 'pending' || status === 'streaming' ? undefined : later,
      failure: status === 'failed' ? 'Connection lost' : undefined };
    const parsed = parseChat({ ...chat, messages: [chat.messages[0], { ...assistant, execution }] });
    assert.equal((parsed.messages[1] as typeof assistant).execution.status, status);
  }
  assert.throws(() => parseChat({ ...chat, messages: [chat.messages[0], {
    ...assistant, execution: { ...assistant.execution, status: 'complete', finishedAt: undefined },
  }] }));
});

test('folder paths reject traversal and preserve segment boundaries', () => {
  assert.equal(parseChatFolderPath(''), '');
  assert.equal(joinChatFolderPath('Research', 'Nested'), 'Research/Nested');
  assert.equal(isChatFolderWithin('Research/Nested', 'Research'), true);
  assert.equal(isChatFolderWithin('Researcher', 'Research'), false);
  for (const path of ['/absolute', '../escape', 'a/../b', 'a//b', 'a\\b', 'a/', ' a', 'a\0b'])
    assert.throws(() => parseChatFolderPath(path), path);
});

test('interaction order, title authority and context budget are pure', () => {
  const chat = sampleChat();
  const older = { ...chat, id: 'aa562fee-bef1-44c4-a355-79797050220a', lastInteractedAt: now };
  assert.deepEqual([older, chat].sort(compareChatsByInteraction).map(item => item.id), [chat.id, older.id]);
  assert.equal(suggestedChatTitle('  Explain\n this   code  ', 12), 'Explain this');
  assert.equal(withAutomaticChatTitle(chat, 'New title').titleSource, 'automatic');
  const manual = { ...chat, titleSource: 'developer' as const };
  assert.equal(withAutomaticChatTitle(manual, 'Ignored'), manual);
  assert.equal(availableChatContextTokens(chat.settings.context, 3000), 2488);
  assert.equal(availableChatContextTokens(chat.settings.context, 100), 0);
});
