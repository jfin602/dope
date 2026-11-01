import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { ChatActivityRecorder, parseExecutionActivity, safeChatToolPath } from '../../packages/chat/lib/index.js';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';
import type { ChatEvent } from '../../packages/chat/lib/service.js';

test('activity is identity-bound, ordered, redacted and retains output beyond the old limit', () => {
    const ids = [randomUUID(), randomUUID(), randomUUID()] as const;
    const recorder = new ChatActivityRecorder(...ids);
    recorder.add('thinking', 'I found api_key=secret-value in the prompt.');
    recorder.add('provisional', 'Working...');
    const saved = recorder.snapshot();
    assert.match(saved.events[0].text, /\[redacted\]/);
    assert.doesNotMatch(JSON.stringify(saved), /secret-value/);
    assert.deepEqual(parseExecutionActivity(saved, ...ids), saved);
    assert.equal(parseExecutionActivity(recorder.snapshot('provider-truncated'), ...ids).issue,
        'provider-truncated');
    assert.throws(() => parseExecutionActivity(saved, randomUUID(), ids[1], ids[2]), /identity/);
    assert.throws(() => parseExecutionActivity({ ...saved, events: [{ ...saved.events[0], sequence: 2 }] }, ...ids), /event/);
    const long = new ChatActivityRecorder(...ids);
    for (let index = 0; index < 600; index++) long.add('provisional', `paragraph-${index} ` + 'word '.repeat(200));
    const longSaved = long.snapshot();
    assert.equal(longSaved.events.length, 600);
    assert.ok(new TextEncoder().encode(longSaved.events.map(event => event.text).join('')).length > 128 * 1024);
    assert.equal(longSaved.events.at(-1)?.text.startsWith('paragraph-599'), true);
    assert.equal(longSaved.truncated, false);
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
    assert.equal(safeChatToolPath('src/counter file.ts'), 'src/counter file.ts');
    assert.equal(safeChatToolPath('../outside.ts'), undefined);
    assert.equal(safeChatToolPath('src/api_key=hidden.ts'), undefined);
    const withPath = new ChatActivityRecorder(...ids);
    withPath.add('tool', 'read_file: running · src/counter file.ts');
    withPath.add('tool', 'read_file: completed · src/counter file.ts');
    assert.deepEqual(parseExecutionActivity(withPath.snapshot(), ...ids), withPath.snapshot());
    assert.throws(() => parseExecutionActivity({ ...withPath.snapshot(), events: [
        { sequence: 1, kind: 'tool', text: 'read_file: running · ../outside.ts' }] }, ...ids), /event/);
});

test('activity capture does not stop at the former replacement event and byte ceilings', () => {
    const ids = [randomUUID(), randomUUID(), randomUUID()] as const;
    const byEvents = new ChatActivityRecorder(...ids);
    for (let index = 0; index < 65_540; index++) byEvents.add('thinking', 'r');
    const eventRecord = byEvents.snapshot();
    assert.equal(eventRecord.events.length, 65_540);
    assert.equal(eventRecord.events.at(-1)?.text, 'r');
    assert.equal(parseExecutionActivity(eventRecord, ...ids).events.length, 65_540);

    const byBytes = new ChatActivityRecorder(...ids);
    for (let index = 0; index < 2_100; index++) byBytes.add('thinking', 'x'.repeat(8192));
    byBytes.add('thinking', 'last reasoning chunk');
    const byteRecord = byBytes.snapshot();
    assert.ok(byteRecord.events.length > 2_100);
    assert.equal(byteRecord.events.at(-1)?.text, 'last reasoning chunk');
    assert.equal(byteRecord.truncated, false);
    assert.equal(parseExecutionActivity(byteRecord, ...ids).events.at(-1)?.text, 'last reasoning chunk');
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

test('batched activity log restores a long interrupted stream in order', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-activity-log-'));
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
        const state = await backend.read(handle);
        await backend.mutate({ projectHandle: handle, expectedRevision: state.revision,
            leaseToken: lease.token, operation: { type: 'begin-assistant', chatId, message: {
                schemaVersion: 1, id: messageId, role: 'assistant', createdAt: now, content: '',
                execution: { schemaVersion: 1, id: executionId, status: 'pending', startedAt: now,
                    selectedModel: { connectionId: 'local', modelId: 'q4' } } } } });
        const recorder = new ChatActivityRecorder(chatId, messageId, executionId);
        for (let index = 0; index < 400; index++) recorder.add('thinking', `begin-${index} ${'r'.repeat(512)} end-${index}\n`);
        recorder.add('tool', 'read_file: completed · src/counter.js');
        recorder.add('thinking', 'final-reasoning-marker');
        const events = recorder.snapshot().events;
        await repository.appendActivity(root, chatId, messageId, executionId, events.slice(0, 200), lease.token);
        await repository.appendActivity(root, chatId, messageId, executionId, events.slice(200), lease.token);
        await backend.release(handle, chatId, lease.token);
        const restored = new ChatBackend(repository, { notifyChatEvent() {} });
        try {
            const next = await restored.attach(pathToFileURL(root).href);
            const message = (await restored.get(next.projectHandle, chatId))!.messages[0];
            assert.equal(message.role, 'assistant');
            if (message.role === 'assistant') {
                assert.equal(message.execution.status, 'failed');
                assert.deepEqual(message.activity?.events, events);
                assert.equal(message.activity?.truncated, false);
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
    let mode: 'complete' | 'cancel' | 'error' | 'text-only' | 'long' = 'complete';
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
        } else if (mode === 'long') {
            for (let index = 0; index < 400; index++) {
                yield { type: 'activity' as const, kind: 'thinking' as const,
                    text: `reason-${index} ${'r'.repeat(512)}\n` };
                if (index === 200) yield { type: 'activity' as const, kind: 'tool' as const,
                    text: 'read_file: completed · src/counter.js' };
            }
            yield { type: 'complete' as const, text: 'Long reasoning complete.', actualModelId: 'q4',
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
        mode = 'long';
        await run('Reason through a long turn');
        saved = (await backend.get(handle, chatId))!.messages.at(-1)!;
        assert.equal(saved.content, 'Long reasoning complete.');
        if (saved.role === 'assistant') {
            const activity = saved.activity!;
            assert.equal(activity.events.length, 401);
            assert.equal(activity.truncated, false);
            assert.match(activity.events[0].text, /^reason-0 /);
            assert.equal(activity.events[201].text, 'read_file: completed · src/counter.js');
            assert.match(activity.events.at(-1)!.text, /^reason-399 /);
        }
        assert.ok(events.some(event => event.kind === 'assistant-activity' && event.activityKind === 'thinking'));
        await backend.release(handle, chatId, token);
        const restored = new ChatBackend(repository, { notifyChatEvent() {} });
        try {
            const reopened = await restored.attach(pathToFileURL(root).href);
            const messages = (await restored.get(reopened.projectHandle, chatId))!.messages;
            assert.equal(messages.filter(message => message.role === 'assistant' && message.content).length, 3);
            assert.equal(messages[3].role === 'assistant' && messages[3].activity?.events.length, 12);
            const last = messages.at(-1)!;
            assert.equal(last.role === 'assistant' && last.activity?.events.length, 401);
        } finally { restored.dispose(); }
        assert.equal(await readFile(join(root, 'src/counter.js'), 'utf8'), 'export const count = 1;\n');
    } finally { backend.dispose(); await rm(root, { recursive: true, force: true }); }
});
