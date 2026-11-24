import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ClipboardHistory, type ClipboardAdapter, type ClipboardContent,
    type ClipboardHistoryStore, type ClipboardSnapshot } from '../../packages/theia-extension/lib/clipboard/clipboard-history.js';

class FakeClipboard implements ClipboardAdapter {
    content?: ClipboardContent;
    writes: ClipboardContent[] = [];
    read(): ClipboardContent | undefined { return this.content; }
    write(content: ClipboardContent): void { this.writes.push(content); this.content = content; }
    copy(value: string): void { this.content = { kind: 'text', value }; }
}
class MemoryStore implements ClipboardHistoryStore {
    saved?: ClipboardSnapshot;
    read(): Promise<ClipboardSnapshot | undefined> { return Promise.resolve(this.saved); }
    write(snapshot: ClipboardSnapshot): Promise<void> { this.saved = structuredClone(snapshot); return Promise.resolve(); }
}
async function setup(store = new MemoryStore()) {
    const clipboard = new FakeClipboard();
    const history = new ClipboardHistory(clipboard, store, 60_000);
    await history.start();
    return { clipboard, history, store };
}

test('captures external text, deduplicates, orders, searches and restores system clipboard', async () => {
    const { clipboard, history } = await setup();
    clipboard.copy('terminal text'); assert.equal(history.capture(), true);
    clipboard.copy('browser text'); assert.equal(history.capture(), true);
    clipboard.copy('terminal text'); assert.equal(history.capture(), true);
    assert.deepEqual(history.snapshot().entries.map(entry => entry.value), ['terminal text', 'browser text']);
    assert.equal(history.search('BROWSER').length, 1);
    const older = history.snapshot().entries[1];
    assert.equal(history.restore(older.id), true);
    assert.equal(clipboard.writes[0].kind, 'text');
    assert.equal(clipboard.writes[0].value, 'browser text');
    assert.equal(history.capture(), false);
    assert.deepEqual(history.snapshot().entries.map(entry => entry.value), ['browser text', 'terminal text']);
    history.stop();
});

test('retention, pinning, deletion, clearing and restart persistence', async () => {
    const { clipboard, history, store } = await setup();
    history.setLimit(2);
    for (const value of ['one', 'two']) { clipboard.copy(value); history.capture(); }
    const pinned = history.snapshot().entries.find(entry => entry.value === 'one')!;
    history.pin(pinned.id, true);
    clipboard.copy('three'); history.capture();
    assert.deepEqual(history.snapshot().entries.map(entry => entry.value), ['three', 'one']);
    await history.flushed(); history.stop();
    const restarted = new ClipboardHistory(clipboard, store, 60_000); await restarted.start();
    assert.deepEqual(restarted.snapshot().entries.map(entry => entry.value), ['three', 'one']);
    restarted.delete(pinned.id); assert.equal(restarted.snapshot().entries.length, 1);
    restarted.clear(); assert.equal(restarted.snapshot().entries.length, 0);
    assert.throws(() => restarted.setLimit(0)); restarted.stop();
});

test('image restore, pause capture, likely-secret filter, size limits and shutdown', async () => {
    const { clipboard, history } = await setup();
    history.setPaused(true); clipboard.copy('paused'); assert.equal(history.capture(), false);
    history.setPaused(false); clipboard.copy('password=secret12345'); assert.equal(history.capture(), false);
    clipboard.copy('safe'); assert.equal(history.capture(), true);
    clipboard.content = { kind: 'image', mime: 'image/png', value: Buffer.from('image').toString('base64') };
    assert.equal(history.capture(), true);
    const image = history.snapshot().entries[0];
    assert.equal(history.restore(image.id), true);
    assert.equal(clipboard.writes.at(-1)?.kind, 'image'); assert.equal(history.capture(), false);
    clipboard.copy('x'.repeat(256 * 1024 + 1)); assert.equal(history.capture(), false);
    history.stop(); history.stop();
});

test('desktop registration is global, dockable and browser mode is explicit', () => {
    const read = (path: string) => readFileSync(new URL(`../../packages/theia-extension/src/${path}`, import.meta.url), 'utf8');
    const registration = read('browser/frontend-module.ts');
    const contribution = read('browser/clipboard-history-contribution.ts');
    const widget = read('browser/clipboard-history-widget.ts');
    const main = read('electron-main/clipboard-main-module.ts');
    assert.match(contribution, /defaultWidgetOptions: \{ area: 'bottom'/);
    assert.match(registration, /id: CLIPBOARD_HISTORY_ID/);
    assert.match(registration, /'electronTheiaCore' in window/);
    assert.match(widget, /requires the Dope desktop application/);
    assert.match(main, /ElectronMainApplicationContribution/);
    assert.match(main, /app\.getPath\('userData'\)/);
    assert.doesNotMatch(widget, /innerHTML|outerHTML/);
});
