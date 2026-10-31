import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { ChatActivityRecorder, parseExecutionActivity } from '../../packages/chat/lib/index.js';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';
import type { ChatEvent } from '../../packages/chat/lib/service.js';

test('activity is identity-bound, ordered, bounded and redacted', () => {
    const ids = [randomUUID(), randomUUID(), randomUUID()] as const;
    const recorder = new ChatActivityRecorder(...ids);
    recorder.add('thinking', 'I found api_key=secret-value in the prompt.');
    recorder.add('provisional', 'Working...');
    const saved = recorder.snapshot();
    assert.match(saved.events[0].text, /\[redacted\]/);
    assert.doesNotMatch(JSON.stringify(saved), /secret-value/);
    assert.deepEqual(parseExecutionActivity(saved, ...ids), saved);
    assert.throws(() => parseExecutionActivity(saved, randomUUID(), ids[1], ids[2]), /identity/);
    assert.throws(() => parseExecutionActivity({ ...saved, events: [{ ...saved.events[0], sequence: 2 }] }, ...ids), /event/);
    const capped = new ChatActivityRecorder(...ids);
    for (let index = 0; index < 600; index++) capped.add('provisional', 'paragraph '.repeat(100));
    assert.ok(capped.snapshot().events.length <= 512);
    assert.ok(new TextEncoder().encode(capped.snapshot().events.map(event => event.text).join('')).length <= 128 * 1024);
    assert.equal(capped.snapshot().events.at(-1)?.kind, 'truncated');
    assert.equal(capped.snapshot().truncated, true);
    const eventCapped = new ChatActivityRecorder(...ids);
    for (let index = 0; index < 600; index++) eventCapped.add('provisional', '.');
    assert.equal(eventCapped.snapshot().events.length, 512);
    const tags = new ChatActivityRecorder(...ids);
    tags.add('provisional', '<thi');
    tags.add('provisional', 'nk>unverified</think>');
    assert.deepEqual(tags.snapshot().events.map(event => event.kind), ['provisional', 'provisional']);
    const splitSecret = new ChatActivityRecorder(...ids);
    splitSecret.add('provisional', 'My api_');
    splitSecret.add('provisional', 'key=unwanted-secret-value');
    assert.doesNotMatch(JSON.stringify(splitSecret.snapshot()), /unwanted-secret-value/);
    const interleaved = new ChatActivityRecorder(...ids);
    interleaved.add('thinking', 'Checking a file');
    interleaved.add('tool', 'read_file: running');
    interleaved.add('tool', 'read_file: completed');
    interleaved.add('answer', 'Ready');
    assert.deepEqual(interleaved.snapshot().events.map(event => event.kind),
        ['thinking', 'tool', 'tool', 'answer']);
    assert.throws(() => parseExecutionActivity({ ...interleaved.snapshot(), events: [
        { sequence: 1, kind: 'tool', text: 'read_file: secret-body' }] }, ...ids), /event/);
});

test('interrupted saved activity survives recovery without becoming assistant speech', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-activity-recover-'));
    const repository = new ChatRepository();
    const backend = new ChatBackend(repository, { notifyChatEvent() {} });
    try {
        const handle = (await backend.attach(pathToFileURL(root).href)).projectHandle;
        const chatId = randomUUID(), messageId = randomUUID(), executionId = randomUUID();
        await backend.mutate({ projectHandle: handle, expectedRevision: 0,
            operation: { type: 'create-chat', id: chatId, folderPath: '' } });
        const lease = await backend.claim({ projectHandle: handle, chatId, ownerId: 'panel' });
        assert.equal(lease.acquired, true);
        if (!lease.acquired) return;
        const now = new Date().toISOString();
        let state = await backend.read(handle);
        state = await backend.mutate({ projectHandle: handle, expectedRevision: state.revision,
            leaseToken: lease.token, operation: { type: 'begin-assistant', chatId, message: {
                schemaVersion: 1, id: messageId, role: 'assistant', createdAt: now, content: '',
                execution: { schemaVersion: 1, id: executionId, status: 'pending', startedAt: now,
                    selectedModel: { connectionId: 'local', modelId: 'q4' } } } } });
        const recorder = new ChatActivityRecorder(chatId, messageId, executionId);
        recorder.add('provisional', 'A diagnostic draft only');
        state = await backend.mutate({ projectHandle: handle, expectedRevision: state.revision,
            leaseToken: lease.token, operation: { type: 'record-assistant-activity', chatId, messageId,
                activity: recorder.snapshot() } });
        await assert.rejects(backend.mutate({ projectHandle: handle, expectedRevision: state.revision,
            leaseToken: 'wrong', operation: { type: 'record-assistant-activity', chatId, messageId,
                activity: recorder.snapshot() } }), /lease required/);
        await assert.rejects(backend.mutate({ projectHandle: handle, expectedRevision: state.revision,
            leaseToken: lease.token, operation: { type: 'record-assistant-activity', chatId, messageId,
                activity: recorder.snapshot() } }), /Stale or out-of-order/);
        await backend.release(handle, chatId, lease.token);
        const restored = new ChatBackend(repository, { notifyChatEvent() {} });
        try {
            const next = await restored.attach(pathToFileURL(root).href);
            const message = (await restored.get(next.projectHandle, chatId))!.messages[0];
            assert.equal(message.role, 'assistant');
            if (message.role === 'assistant') {
                assert.equal(message.execution.status, 'failed');
                assert.equal(message.content, '');
                assert.equal(message.activity?.events[0].text, 'A diagnostic draft only');
            }
        } finally { restored.dispose(); }
    } finally { backend.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('completed answer alone enters saved conversation; twelve cancelled drafts and errors remain diagnostic', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-activity-'));
    await mkdir(join(root, 'src'));
    await writeFile(join(root, 'src/counter.js'), 'export const count = 1;\n');
    const repository = new ChatRepository();
    const events: ChatEvent[] = [];
    const requests: string[][] = [];
    let mode: 'complete' | 'cancel' | 'error' | 'text-only' = 'complete';
    let backend: ChatBackend;
    let handle = '', chatId = '', token = '';
    const models = { list: async () => ({ connections: [{ id: 'local', ready: true, providerId: 'local',
        models: [{ id: 'q4', label: 'Q4', usable: true, capabilities: { conversationalText: true,
            streaming: true, contextWindowTokens: 8192, maxInputTokens: 8192 } }] }] }),
    async *generate(_selection: unknown, request: { messages: { role: string; content: string }[] }) {
        requests.push(request.messages.filter(item => item.role === 'assistant').map(item => item.content));
        if (mode === 'complete') {
            yield { type: 'activity' as const, kind: 'thinking' as const, text: 'Explicit exposed thinking.' };
            yield { type: 'delta' as const, text: 'draft answer' };
            yield { type: 'complete' as const, text: 'Final answer.', actualModelId: 'q4',
                usage: { tokenMeasurement: 'unavailable' as const } };
        } else if (mode === 'text-only') {
            yield { type: 'delta' as const, text: 'Plain final.' };
            yield { type: 'complete' as const, text: 'Plain final.', actualModelId: 'q4',
                usage: { tokenMeasurement: 'unavailable' as const } };
        } else {
            for (let index = 0; index < (mode === 'cancel' ? 12 : 2); index++)
                yield { type: 'delta' as const, text: `provisional paragraph ${index}\n` };
            if (mode === 'cancel') await backend.cancelTurn(handle, chatId, token);
            throw new Error('Provider stopped');
        }
    } };
    const composer = { compose: async (_root: string, chat: { messages: { role: string; content: string;
        execution?: { status: string } }[] }, content: string) => ({
        messages: [...chat.messages.filter(item => item.role === 'assistant' && item.execution?.status === 'complete')
            .map(item => ({ role: 'assistant', content: item.content })), { role: 'user', content }],
        refs: [], diagnostics: [], usedTokens: 10, budgetTokens: 8192 }) };
    backend = new ChatBackend(repository, { notifyChatEvent: event => events.push(event) },
        models as never, composer as never);
    try {
        handle = (await backend.attach(pathToFileURL(root).href)).projectHandle;
        chatId = randomUUID();
        await backend.mutate({ projectHandle: handle, expectedRevision: 0,
            operation: { type: 'create-chat', id: chatId, folderPath: '' } });
        const lease = await backend.claim({ projectHandle: handle, chatId, ownerId: 'panel' });
        assert.equal(lease.acquired, true);
        if (!lease.acquired) return;
        token = lease.token;
        const run = (content: string) => backend.runTurn({ projectHandle: handle, chatId, leaseToken: token,
            selectedModel: { connectionId: 'local', modelId: 'q4' }, content });
        await run('First turn');
        let saved = (await backend.get(handle, chatId))!.messages.at(-1)!;
        assert.equal(saved.content, 'Final answer.');
        assert.equal(saved.role === 'assistant' && saved.activity?.events[0].kind, 'thinking');
        mode = 'cancel';
        await assert.rejects(run('Read src/counter.js and increment(1)'), /cancel|stopped/i);
        saved = (await backend.get(handle, chatId))!.messages.at(-1)!;
        assert.equal(saved.content, '');
        assert.equal(saved.role === 'assistant' && saved.execution.status, 'cancelled');
        assert.equal(saved.role === 'assistant' && saved.activity?.events.length, 12);
        assert.equal((await backend.search({ projectHandle: handle, query: 'provisional paragraph', limit: 5 })).length, 0);
        mode = 'error';
        await assert.rejects(run('Try again'), /stopped|failed/i);
        saved = (await backend.get(handle, chatId))!.messages.at(-1)!;
        assert.equal(saved.content, '');
        assert.equal(saved.role === 'assistant' && saved.execution.status, 'failed');
        mode = 'text-only';
        await run('Continue');
        saved = (await backend.get(handle, chatId))!.messages.at(-1)!;
        assert.equal(saved.content, 'Plain final.');
        assert.deepEqual(requests.at(-1), ['Final answer.']);
        assert.ok(events.some(event => event.kind === 'assistant-activity' && event.activityKind === 'thinking'));
        await backend.release(handle, chatId, token);
        const restored = new ChatBackend(repository, { notifyChatEvent() {} });
        try {
            const reopened = await restored.attach(pathToFileURL(root).href);
            const messages = (await restored.get(reopened.projectHandle, chatId))!.messages;
            assert.equal(messages.filter(message => message.role === 'assistant' && message.content).length, 2);
            assert.equal(messages[3].role === 'assistant' && messages[3].activity?.events.length, 12);
        } finally { restored.dispose(); }
        assert.equal(await readFile(join(root, 'src/counter.js'), 'utf8'), 'export const count = 1;\n');
    } finally { backend.dispose(); await rm(root, { recursive: true, force: true }); }
});
