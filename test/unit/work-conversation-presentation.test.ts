import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { build } from 'esbuild';
import puppeteer from 'puppeteer';
import { workConversationTimeline } from '../../packages/theia-extension/lib/browser/work-conversation-presentation.js';

test('saved Work messages and typed events retain chronological order and delivery truth', () => {
    const at = (second: number) => `2026-11-24T00:00:0${second}.000Z`;
    const entries: any[] = [
        { kind: 'marker', code: 'run-started', at: at(0), sequence: 1 },
        { kind: 'work', toolId: 'tool-1', phase: 'requested', at: at(2), sequence: 2 },
        { kind: 'message', text: 'Recorded response', at: at(4), sequence: 3 }
    ];
    const session: any = { messages: [
        { id: 'queued', text: '<img src=x>', queuedAt: at(1), status: 'queued' },
        { id: 'delivered', text: 'Continue', queuedAt: at(3), status: 'delivered', deliveredAt: at(4) }
    ] };
    const events: any[] = [{ kind: 'authority', summary: 'Approval required', at: at(2) }];
    const timeline = workConversationTimeline(entries, session, events);
    assert.deepEqual(timeline.map(item => 'event' in item ? item.event.kind :
        'message' in item ? item.message.id : item.entry.kind),
    ['marker', 'queued', 'work', 'authority', 'delivered', 'message']);
    assert.equal(session.messages[0].status, 'queued');
    assert.equal(session.messages[0].text, '<img src=x>');
});

test('dockable Work panel owns the conversation, history navigation and theme-safe narrow composer', async () => {
    const browser = new URL('../../packages/theia-extension/src/browser/', import.meta.url);
    const [widget, frontend, css] = await Promise.all(['chat-panel-widget.ts', 'frontend-module.ts', 'dope.css']
        .map(name => readFile(new URL(name, browser), 'utf8')));
    assert.match(frontend, /for \(const area of Object\.keys\(chatAreas\) as ChatArea\[\]\) commands\.registerCommand\(/);
    assert.match(frontend, /await widget\.selectWorkLauncher\(\{ kind: 'run', id: runId \}\)/);
    assert.doesNotMatch(frontend, /AGENT_TRANSCRIPT_ID|AgentTranscriptWidget|openAgentTranscript/);
    assert.match(widget, /renderWorkConversation\(this\.markdown, controller\.transcript/);
    assert.match(widget, /controller\.events\)/);
    assert.match(widget, /session\.segments\.at\(-1\)\?\.runId === run\.id/);
    assert.match(widget, /shouldSendChatInput\(event\)/);
    assert.match(widget, /element instanceof HTMLTextAreaElement && selection\)[\s\S]*?element\.setSelectionRange\(selection\[0\], selection\[1\]\)/);
    assert.match(widget, /input\.maxLength = 16000/);
    assert.match(css, /\.dope-work-conversation-composer \{[^}]*min-width: 0/s);
    assert.match(css, /\.dope-work-conversation-composer textarea \{[^}]*width: 100%/s);
    assert.match(css, /\.dope-work-conversation-composer textarea \{[^}]*var\(--theia-input-background\)/s);
    assert.match(css, /\.dope-work-conversation-composer textarea:focus-visible \{[^}]*var\(--theia-focusBorder\)/s);
});

test('saved Work renderer preserves event order and treats hostile content as text', async t => {
    const browserPath = process.env.CHROME_BIN ?? '/usr/bin/google-chrome';
    if (!existsSync(browserPath)) { t.skip('Chrome unavailable'); return; }
    const bundle = await build({
        entryPoints: ['packages/theia-extension/src/browser/work-conversation-presentation.ts'],
        bundle: true, write: false, platform: 'browser', format: 'iife', globalName: 'DopeWork',
        plugins: [{ name: 'presentation-link-policy', setup(plugin) {
            plugin.onResolve({ filter: /chat-panel-presentation$/ }, () => ({ path: 'link-policy', namespace: 'test' }));
            plugin.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: `export const safeChatLink = (href, base) => {
                try { return ['http:', 'https:', 'mailto:'].includes(new URL(href, base).protocol); }
                catch { return false; }
            };` }));
        } }]
    });
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'], executablePath: browserPath });
    try {
        const page = await browser.newPage();
        await page.setContent('<main id="work"></main>');
        await page.addScriptTag({ content: bundle.outputFiles[0].text });
        const result = await page.evaluate(() => {
            const at = (second: number) => `2026-11-24T00:00:0${second}.000Z`;
            const entries = [
                { runId: 'run', sequence: 1, at: at(1), kind: 'work', toolId: 'read', toolName: 'Read', phase: 'requested' },
                { runId: 'run', sequence: 2, at: at(3), kind: 'message', text: '<img src=x onerror=alert(1)>', truncated: false },
                { runId: 'run', sequence: 3, at: at(4), kind: 'work', toolId: 'read', toolName: 'Read', phase: 'completed' }
            ];
            const session = { status: 'recovery-required', messages: [
                { id: 'exact-id', text: '<script>alert(1)</script>',
                    queuedAt: at(0), status: 'delivered', deliveredAt: at(2) },
                { id: 'uncertain-id', text: 'Continue', queuedAt: at(5), status: 'delivering' }
            ] };
            const events = [{ kind: 'authority', summary: '<img src=x>', at: at(2) }];
            const host = document.querySelector('#work')!;
            host.append((window as any).DopeWork.renderWorkConversation(undefined, entries, session, events));
            return { childText: [...host.querySelector('section')!.children].map(child => child.textContent?.trim()),
                unsafeNodes: host.querySelectorAll('img, script, [onerror]').length };
        });
        assert.equal(result.unsafeNodes, 0);
        assert.match(result.childText[0] ?? '', /Message ID exact-id/);
        assert.match(result.childText[1] ?? '', /Read · Running/);
        assert.match(result.childText[2] ?? '', /Approval · <img src=x>/);
        assert.match(result.childText[3] ?? '', /<img src=x onerror=alert\(1\)>/);
        assert.match(result.childText[4] ?? '', /Read · Completed/);
        assert.match(result.childText[5] ?? '', /Delivery unconfirmed · recovery required · Message ID uncertain-id/);
    } finally { await browser.close(); }
});
