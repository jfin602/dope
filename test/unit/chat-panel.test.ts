import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';
import { ChatOpenOwners, ChatPanelController, chatTree } from '../../packages/theia-extension/lib/browser/chat-panel-controller.js';
import { CHAT_PANEL_ID, ChatScrollFollow, ChatTranscriptDrag, animateChatToLatest, canDragChatTranscript, chatAreas, chatLauncherIds, chatLauncherOptions, chatPanelOptions, chatPanelWidgetId, openChatPanel, resolveChatModel } from '../../packages/theia-extension/lib/browser/chat-panel-presentation.js';
import type { ChatCollection } from '../../packages/chat/lib/index.js';
import type { ChatClient } from '../../packages/chat/lib/service.js';
import type { ChatConnection } from '../../packages/theia-extension/src/browser/chat-panel-controller.js';

async function until(ready: () => boolean): Promise<void> {
    for (let i = 0; i < 100; i++) { if (ready()) return; await new Promise(resolve => setTimeout(resolve, 10)); }
    assert.fail('Timed out waiting for Chat event');
}
async function untilAsync(ready: () => Promise<boolean>): Promise<void> {
    for (let i = 0; i < 100; i++) { if (await ready()) return; await new Promise(resolve => setTimeout(resolve, 10)); }
    assert.fail('Timed out waiting for Chat ownership');
}
function connect(repository: ChatRepository): ChatConnection {
    let client: ChatClient | undefined;
    const backend = new ChatBackend(repository, { notifyChatEvent: event => client?.notifyChatEvent(event) });
    return Object.assign(backend, { setClient(value: ChatClient | undefined) { client = value; } });
}

test('Chat keeps follow-role, exact default and turn authority as shared inventory changes', () => {
    const first = { connectionId: 'first', modelId: 'chat' };
    const second = { connectionId: 'second', modelId: 'chat' };
    const available = [{ selection: first }, { selection: second }];
    assert.equal(resolveChatModel(available), undefined);
    assert.deepEqual(resolveChatModel(available, undefined, second), second);
    assert.deepEqual(resolveChatModel(available, first, second), first);
    assert.equal(resolveChatModel([available[0]], undefined, second), undefined);
    assert.equal(resolveChatModel([available[0]], second, first), undefined);
    assert.deepEqual(resolveChatModel([available[0]], undefined, first), first);
});

test('Chat delegates connection repair to AI Center and listens for live registry changes', async () => {
    const widget = await readFile(new URL('../../packages/theia-extension/src/browser/chat-panel-widget.ts', import.meta.url), 'utf8');
    const module = await readFile(new URL('../../packages/theia-extension/src/browser/frontend-module.ts', import.meta.url), 'utf8');
    const center = await readFile(new URL('../../packages/theia-extension/src/browser/ai-center-contribution.ts', import.meta.url), 'utf8');
    const centerWidget = await readFile(new URL('../../packages/theia-extension/src/browser/ai-center-widget.ts', import.meta.url), 'utf8');
    assert.match(widget, /Manage AI connections.*openFromChat\(this\.id\)/);
    assert.match(widget, /onModelsChanged\?\.\(\(\) => \{ void this\.loadModels\(\)/);
    assert.match(module, /notifyModelConnectionsChanged\(\) \{ modelInventoryChanged\.fire\(\)/);
    assert.match(module, /modelInventoryChanged\.event/);
    assert.match(center, /setReturnToChat\(chatPanelId \? \(\) =>/);
    assert.match(center, /this\.shell\.revealWidget\(chatPanelId\)/);
    assert.match(centerWidget, /Return to Chat/);
    assert.doesNotMatch(widget, /setSessionCredential|\.upsert\(|\.activate\(|SecretInputDialog|setupModels|private async reconnect/);
});

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
    const owners = new ChatOpenOwners();
    let focused = 0;
    const a = new ChatPanelController(() => connect(repository), () => {}, owners, 'panel-a', () => { focused++; });
    const b = new ChatPanelController(() => connect(repository), () => {}, owners, 'panel-b');
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
        assert.equal(await b.select(chatId), false);
        assert.equal(b.mode, 'select-chat');
        assert.equal(focused, 1);
        assert.match(b.error, /already open/);
        const writer = connect(repository);
        try {
            const attached = await writer.attach(pathToFileURL(first).href);
            const claim = await writer.claim({ projectHandle: attached.projectHandle, chatId, ownerId: 'test-writer' });
            assert.equal(claim.acquired, false);
            await a.select(undefined);
            const acquired = await writer.claim({ projectHandle: attached.projectHandle, chatId, ownerId: 'test-writer' });
            assert.equal(acquired.acquired, true);
            if (!acquired.acquired) throw new Error('Expected Chat lease');
            await writer.mutate({ projectHandle: attached.projectHandle, expectedRevision: attached.snapshot.revision,
                leaseToken: acquired.token, operation: { type: 'append-user', chatId, message: {
                    schemaVersion: 1, id: randomUUID(), role: 'user', createdAt: new Date().toISOString(),
                    content: 'Saved transcript', contextRefs: [] } } });
            await until(() => b.snapshot?.chats[0].messages[0]?.content === 'Saved transcript' &&
                a.snapshot?.chats[0].messages[0]?.content === 'Saved transcript');
            assert.equal(a.snapshot?.chats[0].messages[0].content, 'Saved transcript');
            await writer.release(attached.projectHandle, chatId, acquired.token);
        } finally { writer.dispose(); }
        assert.equal(a.mode, 'select-chat');
        assert.equal(b.mode, 'select-chat');
        await b.attach(pathToFileURL(second).href);
        assert.equal(b.mode, 'select-chat');
        assert.deepEqual(b.snapshot?.chats, []);
        assert.equal(await b.select(chatId), false);
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
    await until(() => typeof resolveAttach === 'function');
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

test('restoration resolves duplicate panels, permits different Chats, and releases on switch, back and dispose', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-chat-owners-'));
    const workspace = pathToFileURL(root).href;
    const repository = new ChatRepository(), owners = new ChatOpenOwners();
    const first = new ChatPanelController(() => connect(repository), () => {}, owners, 'first');
    const second = new ChatPanelController(() => connect(repository), () => {}, owners, 'second');
    const third = new ChatPanelController(() => connect(repository), () => {}, owners, 'third');
    try {
        await Promise.all([first.attach(workspace), second.attach(workspace), third.attach(workspace)]);
        assert.equal(await first.newChat(''), true);
        const one = first.chatId!;
        await first.select(undefined);
        assert.equal(await first.newChat(''), true);
        const two = first.chatId!;
        await until(() => second.snapshot?.chats.length === 2 && third.snapshot?.chats.length === 2);
        second.restore(workspace, 'chat', one);
        await until(() => second.chatId === one);
        third.restore(workspace, 'chat', one);
        await until(() => third.error.includes('already restored'));
        assert.equal(third.mode, 'select-chat');
        assert.equal(await third.select(two), false);
        assert.equal(await first.select(one), false);
        await first.select(undefined);
        assert.equal(await third.select(two), true);
        assert.equal(await second.select(two), false);
        assert.equal(second.mode, 'select-chat');
        assert.equal(await first.select(one), true);
        third.dispose();
        const replacement = new ChatPanelController(() => connect(repository), () => {}, owners, 'replacement');
        try {
            await replacement.attach(workspace);
            await untilAsync(() => replacement.select(two));
        } finally { replacement.dispose(); }
    } finally {
        first.dispose(); second.dispose(); third.dispose();
        await rm(root, { recursive: true, force: true });
    }
});

test('project switch waits for a late claim to release before disposing its connection', async () => {
    const chatId = randomUUID(), events: string[] = [];
    const snapshot = { schemaVersion: 1, revision: 0, folders: [], chats: [{ id: chatId }] } as ChatCollection;
    let resolveClaim!: (value: { acquired: true; token: string }) => void;
    const connection = (name: string) => ({
        setClient() {},
        dispose() { events.push(`${name}:dispose`); },
        attach: async () => ({ projectHandle: name, snapshot }),
        claim: () => new Promise<{ acquired: true; token: string }>(resolve => { resolveClaim = resolve; }),
        release: async () => { events.push(`${name}:release`); },
    }) as unknown as ChatConnection;
    let next = 0;
    const panel = new ChatPanelController(() => connection(++next === 1 ? 'old' : 'new'), () => {});
    try {
        await panel.attach('old');
        const selecting = panel.select(chatId);
        await until(() => typeof resolveClaim === 'function');
        const switching = panel.attach('new');
        resolveClaim({ acquired: true, token: 'old-token' });
        assert.equal(await selecting, false);
        await switching;
        assert.deepEqual(events.slice(0, 2), ['old:release', 'old:dispose']);
        assert.equal(panel.workspace, 'new');
        assert.equal(panel.mode, 'select-chat');
    } finally { panel.dispose(); }
});

test('saved panel selection waits for repository attach and never rewrites conversation state', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-chat-restore-'));
    const other = await mkdtemp(join(tmpdir(), 'dope-chat-other-'));
    const workspace = pathToFileURL(root).href, repository = new ChatRepository();
    const original = new ChatPanelController(() => connect(repository), () => {});
    const restored = new ChatPanelController(() => connect(repository), () => {});
    try {
        await original.attach(workspace);
        assert.equal(await original.newChat(''), true);
        const chatId = original.chatId!, revision = original.snapshot!.revision;
        await original.select(undefined);
        restored.restore(workspace, 'chat', chatId);
        await restored.attach(workspace);
        await until(() => restored.chatId === chatId);
        assert.equal(restored.mode, 'chat');
        assert.equal(restored.snapshot?.revision, revision);
        assert.equal((await repository.read(root)).revision, revision);
        await restored.attach(pathToFileURL(other).href);
        assert.equal(restored.mode, 'select-chat');
        assert.equal(await original.select(chatId), true);
        await original.select(undefined);
        restored.restore('some-other-project', 'chat', chatId);
        assert.equal(restored.mode, 'select-chat');
    } finally {
        original.dispose(); restored.dispose();
        await rm(root, { recursive: true, force: true });
        await rm(other, { recursive: true, force: true });
    }
});

test('dispose during a late claim releases the token and ignores the late selection', async () => {
    const chatId = randomUUID(), events: string[] = [];
    let resolveClaim!: (value: { acquired: true; token: string }) => void;
    const connection = () => ({
        setClient() {}, dispose() { events.push('dispose'); },
        attach: async () => ({ projectHandle: 'project', snapshot: {
            schemaVersion: 1, revision: 0, folders: [], chats: [{ id: chatId }]
        } as ChatCollection }),
        claim: () => new Promise<{ acquired: true; token: string }>(resolve => { resolveClaim = resolve; }),
        release: async () => { events.push('release'); },
    }) as unknown as ChatConnection;
    const panel = new ChatPanelController(connection, () => {});
    await panel.attach('project');
    const selecting = panel.select(chatId);
    await until(() => typeof resolveClaim === 'function');
    panel.dispose();
    resolveClaim({ acquired: true, token: 'late-token' });
    assert.equal(await selecting, false);
    await until(() => events.includes('dispose'));
    assert.deepEqual(events, ['release', 'dispose']);
    assert.equal(panel.chatId, undefined);
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

test('scroll follow respects manual upward scrolling and jump to latest', () => {
    const follow = new ChatScrollFollow();
    follow.select('first');
    assert.equal(follow.restore(0, 600, 200), 600);
    follow.scrolled(100, 600, 200);
    assert.equal(follow.following, false);
    assert.equal(follow.restore(100, 900, 200), 100);
    assert.equal(follow.latestBelow, true);
    follow.jump();
    assert.equal(follow.restore(100, 900, 200), 900);
    assert.equal(follow.latestBelow, false);
    follow.scrolled(690, 900, 200);
    assert.equal(follow.following, true);
    follow.select('second');
    assert.equal(follow.following, true);
});

test('side Chat launchers use stable separate identities and normal Select Chat release', async () => {
    assert.equal(chatPanelWidgetId(chatLauncherOptions.left), chatLauncherIds.left);
    assert.equal(chatPanelWidgetId(chatLauncherOptions.right), chatLauncherIds.right);
    assert.notEqual(chatLauncherIds.left, chatLauncherIds.right);
    const source = await readFile(new URL('../../packages/theia-extension/src/browser/frontend-module.ts', import.meta.url), 'utf8');
    const widget = await readFile(new URL('../../packages/theia-extension/src/browser/chat-panel-widget.ts', import.meta.url), 'utf8');
    assert.match(source, /bindViewContribution\(bind, LeftChatLauncher\)/);
    assert.match(source, /bindViewContribution\(bind, RightChatLauncher\)/);
    assert.match(source, /id: chatLauncherIds\[side\], createWidget: \(\) => createChatWidget\(context, chatLauncherOptions\[side\]\)/);
    assert.match(source, /name === 'left'.*LeftChatLauncher/s);
    assert.match(source, /name === 'right'.*RightChatLauncher/s);
    assert.match(source, /openChatPanel\(name/);
    assert.match(source, /tabBar\.tabActivateRequested\.connect\(activated\)/);
    assert.match(source, /if \(title\.owner === widget && widget\.panel\.mode === 'chat'\) void widget\.selectChatLauncher\(\)/);
    assert.match(source, /await widget\.selectChatLauncher\(\)/);
    assert.match(widget, /codicon\('comment-discussion'\)/);
});

test('transcript drag threshold and fast latest animation respect reduced motion', () => {
    const drag = new ChatTranscriptDrag();
    drag.start(200, 150);
    assert.equal(drag.move(197), undefined);
    assert.equal(drag.dragging, false);
    assert.equal(drag.move(180), 170);
    assert.equal(drag.move(160), 190);
    assert.equal(drag.end(), true);
    assert.equal(drag.dragging, false);
    const scroll = { scrollTop: 100, scrollHeight: 700, clientHeight: 200 } as HTMLElement;
    const frames: FrameRequestCallback[] = [];
    const schedule = (frame: FrameRequestCallback) => { frames.push(frame); return frames.length; };
    animateChatToLatest(scroll, false, schedule);
    frames.shift()!(0);
    assert.equal(scroll.scrollTop, 100);
    scroll.scrollHeight = 900;
    frames.shift()!(100);
    assert.ok(scroll.scrollTop > 100 && scroll.scrollTop < 700);
    frames.shift()!(200);
    assert.equal(scroll.scrollTop, 700);
    scroll.scrollTop = 0;
    animateChatToLatest(scroll, true, schedule);
    assert.equal(scroll.scrollTop, 700);
});

test('transcript drag starts on messages, links, code and disclosures but leaves controls clickable', () => {
    const target = (tag: string) => ({ closest: (selector: string) =>
        selector.split(',').map(part => part.trim()).includes(tag) ? {} : null }) as unknown as Element;
    for (const tag of ['p', 'a', 'pre', 'code', 'summary', 'div'])
        assert.equal(canDragChatTranscript(target(tag)), true, tag);
    for (const tag of ['button', '[role="button"]', 'input', 'textarea', 'select', '[contenteditable]'])
        assert.equal(canDragChatTranscript(target(tag)), false, tag);
});

test('touch drag follows vertical movement and leaves horizontal gestures to the browser', () => {
    const drag = new ChatTranscriptDrag();
    drag.start(200, 150, 100);
    assert.equal(drag.move(197, 103, true), undefined);
    assert.equal(drag.move(194, 120, true), undefined);
    assert.equal(drag.dragging, false);
    assert.equal(drag.move(170, 104, true), 180);
    assert.equal(drag.move(150, 106, true), 200);
    assert.equal(drag.end(), true);
});

test('transcript wiring preserves manual reading and uses one centered latest action', async () => {
    const widget = await readFile(new URL('../../packages/theia-extension/src/browser/chat-panel-widget.ts', import.meta.url), 'utf8');
    const css = await readFile(new URL('../../packages/theia-extension/src/browser/dope.css', import.meta.url), 'utf8');
    assert.match(widget, /scroll\.onpointerdown/);
    assert.match(widget, /document\.addEventListener\('pointermove', this\.moveTranscriptDrag\)/);
    assert.match(widget, /document\.addEventListener\('pointerup', this\.endTranscriptPointer\)/);
    assert.match(widget, /document\.addEventListener\('pointercancel', this\.endTranscriptPointer\)/);
    assert.match(widget, /scroll\.setPointerCapture/);
    assert.match(widget, /this\.transcriptDrag\.dragging/);
    assert.match(widget, /window\.getSelection\(\)\?\.removeAllRanges\(\)/);
    assert.match(widget, /this\.scrollFollow\.scrolled\(scroll\.scrollTop/);
    assert.match(widget, /this\.scrollFollow\.jump\(\)/);
    assert.match(widget, /this\.scrollToLatest\(\)/);
    assert.match(widget, /aria-label', 'Scroll to latest'/);
    assert.match(widget, /codicon\('chevron-down'\)/);
    assert.match(css, /\.dope-chat-panel \.dope-chat-latest \{[^}]*left: 50%;[^}]*border-radius: 50%/);
    assert.doesNotMatch(widget, /event\.pointerType === 'touch' \|\| event\.button !== 0/);
    assert.match(css, /\.dope-chat-scroll \{[^}]*touch-action: pan-x pinch-zoom/);
    assert.match(css, /\.dope-chat-scroll-dragging, \.dope-chat-scroll-dragging \* \{[^}]*user-select: none/);
});

test('each ChatPanel opens its own RPC channel on the backend Chat route', async () => {
    const frontend = await readFile(new URL('../../packages/theia-extension/src/browser/frontend-module.ts', import.meta.url), 'utf8');
    const backend = await readFile(new URL('../../packages/theia-extension/src/node/backend-module.ts', import.meta.url), 'utf8');
    assert.match(frontend, /chatServicePath\}\/\$\{options\.instanceId\}/);
    assert.match(backend, /chatServicePath\}\/\:panelId/);
});
