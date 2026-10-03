import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';
import { ChatPanelController, chatTree } from '../../packages/theia-extension/lib/browser/chat-panel-controller.js';
import { CHAT_PANEL_ID, chatAreas, chatPanelOptions, chatPanelWidgetId, openChatPanel } from '../../packages/theia-extension/lib/browser/chat-panel-presentation.js';
import type { ChatCollection } from '../../packages/chat/lib/index.js';
import type { ChatClient } from '../../packages/chat/lib/service.js';
import type { ChatConnection } from '../../packages/theia-extension/src/browser/chat-panel-controller.js';

async function until(ready: () => boolean): Promise<void> {
    for (let i = 0; i < 100; i++) { if (ready()) return; await new Promise(resolve => setTimeout(resolve, 10)); }
    assert.fail('Timed out waiting for Chat event');
}
function connect(repository: ChatRepository): ChatConnection {
    let client: ChatClient | undefined;
    const backend = new ChatBackend(repository, { notifyChatEvent: event => client?.notifyChatEvent(event) });
    return Object.assign(backend, { setClient(value: ChatClient | undefined) { client = value; } });
}

test('four area opens create distinct factory descriptions and widget identities', async () => {
    const calls: string[] = [], ids = new Set<string>();
    for (const area of Object.keys(chatAreas) as (keyof typeof chatAreas)[]) {
        const widget = await openChatPanel(area, async options => {
            assert.equal(CHAT_PANEL_ID, 'dope-chat-panel');
            const id = chatPanelWidgetId(options);
            assert.ok(!ids.has(id)); ids.add(id);
            calls.push(`create:${area}`);
            return { id };
        }, {
            async addWidget(widget, options) { calls.push(`add:${options.area}:${widget.id}`); },
            async activateWidget(id) { calls.push(`activate:${id}`); }
        });
        assert.equal(calls.at(-1), `activate:${widget.id}`);
    }
    assert.deepEqual([...ids].length, 4);
    assert.deepEqual(Object.values(chatAreas), ['left', 'right', 'main', 'bottom']);
    assert.throws(() => chatPanelWidgetId({ instanceId: '../bad' }), /Invalid ChatPanel/);
    assert.notEqual(chatPanelWidgetId(chatPanelOptions()), chatPanelWidgetId(chatPanelOptions()));
    const module = await readFile(new URL('../../packages/theia-extension/src/browser/frontend-module.ts', import.meta.url), 'utf8');
    assert.match(module, /Object\.keys\(chatAreas\)/);
    assert.match(module, /id: `dope\.chat\.open\.\$\{name\}`/);
    assert.match(module, /openChatPanel\(name/);
    assert.match(module, /id: CHAT_PANEL_ID, createWidget/);
});

test('nested selector sorts saved Chats by real interaction within each folder', () => {
    const when = (day: number) => `2026-10-${String(day).padStart(2, '0')}T00:00:00.000Z`;
    const chat = (id: string, folderPath: string, day: number) => ({ id, folderPath, title: id,
        createdAt: when(1), updatedAt: when(day), lastInteractedAt: when(day) });
    const tree = chatTree({ folders: [{ path: 'B' }, { path: 'A' }, { path: 'A/Inner' }],
        chats: [chat('old', 'A', 2), chat('inner', 'A/Inner', 3), chat('new', 'A', 4), chat('root', '', 1)] } as ChatCollection);
    assert.deepEqual(tree.folders.map(folder => folder.path), ['A', 'B']);
    assert.deepEqual(tree.folders[0].chats.map(chat => chat.id), ['new', 'old']);
    assert.equal(tree.folders[0].folders[0].chats[0].id, 'inner');
    assert.equal(tree.chats[0].id, 'root');
});

test('two panels share service changes while navigation remains panel-local and project scoped', async () => {
    const first = await mkdtemp(join(tmpdir(), 'dope-chat-panel-'));
    const second = await mkdtemp(join(tmpdir(), 'dope-chat-panel-'));
    const repository = new ChatRepository();
    const a = new ChatPanelController(() => connect(repository), () => {});
    const b = new ChatPanelController(() => connect(repository), () => {});
    try {
        await Promise.all([a.attach(pathToFileURL(first).href), b.attach(pathToFileURL(first).href)]);
        assert.equal(a.mode, 'select-chat');
        assert.equal(await a.newFolder('', 'Ideas'), true);
        await until(() => b.snapshot?.folders.some(folder => folder.path === 'Ideas') === true);
        assert.deepEqual(b.snapshot?.folders.map(folder => folder.path), ['Ideas']);
        assert.equal(await a.newChat('Ideas'), true);
        await until(() => b.snapshot?.chats.length === 1);
        assert.equal(a.mode, 'chat');
        assert.equal(b.mode, 'select-chat');
        const chatId = a.chatId!;
        assert.equal(b.snapshot?.chats[0].id, chatId);
        assert.equal(b.select(chatId), true);
        assert.equal(b.mode, 'chat');
        const writer = connect(repository);
        try {
            const attached = await writer.attach(pathToFileURL(first).href);
            const claim = await writer.claim({ projectHandle: attached.projectHandle, chatId, ownerId: 'test-writer' });
            assert.equal(claim.acquired, true);
            if (!claim.acquired) throw new Error('Expected Chat lease');
            await writer.mutate({ projectHandle: attached.projectHandle, expectedRevision: attached.snapshot.revision,
                leaseToken: claim.token, operation: { type: 'append-user', chatId, message: {
                    schemaVersion: 1, id: randomUUID(), role: 'user', createdAt: new Date().toISOString(),
                    content: 'Saved transcript', contextRefs: [] } } });
            await until(() => b.chat?.messages[0]?.content === 'Saved transcript' &&
                a.snapshot?.chats[0].messages[0]?.content === 'Saved transcript');
            assert.equal(a.snapshot?.chats[0].messages[0].content, 'Saved transcript');
        } finally { writer.dispose(); }
        a.select(undefined);
        assert.equal(a.mode, 'select-chat');
        assert.equal(b.mode, 'chat');
        await b.attach(pathToFileURL(second).href);
        assert.equal(b.mode, 'select-chat');
        assert.deepEqual(b.snapshot?.chats, []);
        assert.equal(b.select(chatId), false);
        assert.equal(a.snapshot?.chats[0].id, chatId);
        await b.attach(undefined);
        assert.equal(b.snapshot, undefined);
    } finally {
        a.dispose(); b.dispose();
        await rm(first, { recursive: true, force: true });
        await rm(second, { recursive: true, force: true });
    }
});

test('late attach and read responses cannot replace a newer workspace or revision', async () => {
    const empty = (revision: number): ChatCollection => ({ schemaVersion: 1, revision, folders: [], chats: [] });
    let resolveAttach!: (value: { projectHandle: string; snapshot: ChatCollection }) => void;
    const reads: Array<(value: ChatCollection) => void> = [];
    let client: ChatClient | undefined;
    const connection = (delayed = false) => ({
        setClient(value: ChatClient | undefined) { client = value; }, dispose() {},
        attach: () => delayed ? new Promise<{ projectHandle: string; snapshot: ChatCollection }>(resolve => { resolveAttach = resolve; }) :
            Promise.resolve({ projectHandle: 'new', snapshot: empty(2) }),
        read: () => new Promise<ChatCollection>(resolve => { reads.push(resolve); }),
    }) as unknown as ChatConnection;
    const panel = new ChatPanelController(() => connection(true), () => {});
    const old = panel.attach('old');
    await panel.attach(undefined);
    resolveAttach({ projectHandle: 'old', snapshot: empty(9) });
    await old;
    assert.equal(panel.snapshot, undefined);
    panel.dispose();

    const current = new ChatPanelController(() => connection(), () => {});
    await current.attach('new');
    const read = current.refresh();
    client?.notifyChatEvent({ projectHandle: 'new', kind: 'changed', revision: 3 });
    reads.shift()!(empty(1));
    await read;
    assert.equal(current.snapshot?.revision, 2);
    await current.attach(undefined);
    reads.shift()?.(empty(3));
    assert.equal(current.snapshot, undefined);
    current.dispose();
});

test('selector and transcript retain keyboard and dark theme surfaces', async () => {
    const css = await readFile(new URL('../../packages/theia-extension/src/browser/dope.css', import.meta.url), 'utf8');
    const source = await readFile(new URL('../../packages/theia-extension/src/browser/chat-panel-widget.ts', import.meta.url), 'utf8');
    assert.match(css, /\.dope-chat-panel button:focus-visible/);
    assert.match(css, /var\(--theia-editor-background\)/);
    assert.match(source, /document\.createElement\('button'\)/);
    assert.match(source, /document\.createElement\('summary'\)/);
    assert.match(source, /Back \/ Chats/);
    assert.match(source, /message\.content/);
    assert.match(source, /dope-chat-settings/);
});
