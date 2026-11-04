import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import test from 'node:test';
import { build } from 'esbuild';
import puppeteer from 'puppeteer';

test('shared Chat and Work code blocks copy only their current visible text', async t => {
    const bundle = await build({
        entryPoints: ['packages/theia-extension/src/browser/untrusted-message-markdown.ts'],
        bundle: true, write: false, platform: 'browser', format: 'iife', globalName: 'DopeMarkdown',
        plugins: [{ name: 'presentation-link-policy', setup(plugin) {
            plugin.onResolve({ filter: /chat-panel-presentation$/ }, () => ({ path: 'link-policy', namespace: 'test' }));
            plugin.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: `export const safeChatLink = (href, base) => {
                try { return ['http:', 'https:', 'mailto:'].includes(new URL(href, base).protocol); }
                catch { return false; }
            };` }));
        } }]
    });
    const systemChrome = process.env.CHROME_BIN ?? '/usr/bin/google-chrome';
    const browserPath = existsSync(systemChrome) ? systemChrome : await puppeteer.executablePath();
    if (!existsSync(browserPath)) { t.skip('Chrome is unavailable for the browser smoke test'); return; }
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'], executablePath: browserPath });
    try {
        const page = await browser.newPage();
        await page.setContent('<main id="chat"></main><main id="work"></main><textarea id="composer"></textarea>');
        await page.addScriptTag({ content: bundle.outputFiles[0].text });
        await page.evaluate(() => {
            const clipboard = { writes: [] as string[], fail: false, async writeText(value: string) {
                if (this.fail) throw new Error('denied');
                this.writes.push(value);
            } };
            Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard });
            (window as any).testClipboard = clipboard;
            (window as any).renderCode = (target: string, markdown: string) => {
                const host = document.querySelector(target)!;
                host.replaceChildren((window as any).DopeMarkdown.renderUntrustedMessageMarkdown(undefined, markdown));
            };
        });
        const prompt = '/gen-roadmap Create a TypeScript game.\n\n  Keep indentation.\n';
        await page.evaluate(promptText => {
            (window as any).renderCode('#chat', `Before\n\n\`\`\`ts\n  const x = 1;\n\n    run();\n\`\`\`\n\nBetween\n\n\`\`\`\n${promptText}\`\`\`\n\nAfter`);
            (window as any).renderCode('#work', '\`\`\`sh\n  npm test\n\`\`\`');
        }, prompt);
        assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('.dope-message-code')].map(block => ({
            language: block.querySelector('.dope-message-code-language')?.textContent ?? '',
            code: block.querySelector('code')?.textContent,
            buttons: block.querySelectorAll('button').length,
            aria: block.querySelector('button')?.getAttribute('aria-label')
        }))), [
            { language: 'ts', code: '  const x = 1;\n\n    run();\n', buttons: 1, aria: 'Copy code block' },
            { language: '', code: prompt, buttons: 1, aria: 'Copy code block' },
            { language: 'sh', code: '  npm test\n', buttons: 1, aria: 'Copy code block' }
        ]);
        await page.click('#chat .dope-message-code:nth-of-type(2) button');
        assert.deepEqual(await page.evaluate(() => (window as any).testClipboard.writes), [prompt]);
        assert.equal(await page.$eval('#chat .dope-message-code:nth-of-type(2) button', button => button.textContent?.trim()), 'Copied');
        assert.equal(await page.$eval('#chat .dope-message-code:nth-of-type(2) button', button => button.getAttribute('aria-label')), 'Copied');
        assert.equal(await page.$eval('#composer', input => (input as HTMLTextAreaElement).value), '');
        await page.focus('#work .dope-message-code button');
        await page.keyboard.press('Enter');
        await page.keyboard.press('Space');
        assert.deepEqual(await page.evaluate(() => (window as any).testClipboard.writes),
            [prompt, '  npm test\n', '  npm test\n']);
        await page.evaluate(() => { (window as any).testClipboard.fail = true; });
        await page.click('#chat .dope-message-code button');
        assert.equal(await page.$eval('#chat .dope-message-code button', button => button.textContent?.trim()), 'Copy failed');
        assert.equal(await page.$eval('#chat .dope-message-code button', button => button.getAttribute('aria-label')), 'Copy failed');
        assert.equal(await page.evaluate(() => (window as any).testClipboard.writes.length), 3);

        await page.evaluate(() => {
            (window as any).testClipboard.fail = false;
            (window as any).renderCode('#chat', '\`\`\`text\n  partial');
            (window as any).renderCode('#chat', '\`\`\`text\n  partial\n  complete');
        });
        assert.equal(await page.$$eval('#chat .dope-message-code button', buttons => buttons.length), 1);
        await page.click('#chat .dope-message-code button');
        assert.deepEqual(await page.evaluate(() => (window as any).testClipboard.writes),
            [prompt, '  npm test\n', '  npm test\n', '  partial\n  complete']);
        await page.evaluate(() => (window as any).renderCode('#chat',
            '\`\`\`ts\"><img src="https://example.test/pixel" onerror="alert(1)">\n<script>alert(1)</script>\n\`\`\`'));
        assert.equal(await page.$eval('#chat', host => host.querySelectorAll('img, script, [onerror], [onclick]').length), 0);
        assert.equal(await page.$eval('#chat .dope-message-code', block => block.querySelectorAll('button').length), 1);

        // A localhost page exercises the real browser clipboard and a keyboard paste.
        const server = createServer((_request, response) => {
            response.setHeader('Content-Type', 'text/html');
            response.end('<main id="chat" class="dope-chat-message-content"></main><textarea id="composer"></textarea>');
        });
        await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
        try {
            const address = server.address();
            assert.ok(address && typeof address !== 'string');
            const origin = `http://127.0.0.1:${address.port}`;
            await browser.defaultBrowserContext().overridePermissions(origin, ['clipboard-read', 'clipboard-sanitized-write']);
            const livePage = await browser.newPage();
            await livePage.goto(origin);
            await livePage.addScriptTag({ content: bundle.outputFiles[0].text });
            await livePage.evaluate(promptText => {
                document.querySelector('#chat')!.append((window as any).DopeMarkdown.renderUntrustedMessageMarkdown(
                    undefined, `GPT-OSS response:\n\n\`\`\`text\n${promptText}\`\`\``));
            }, prompt);
            await livePage.click('#chat .dope-message-code-copy');
            await livePage.waitForFunction(() => document.querySelector('.dope-message-code-copy')?.textContent?.trim() === 'Copied');
            assert.equal(await livePage.evaluate(() => navigator.clipboard.readText()), prompt);
            await livePage.focus('#composer');
            await livePage.keyboard.down('Control');
            await livePage.keyboard.press('V');
            await livePage.keyboard.up('Control');
            assert.equal(await livePage.$eval('#composer', input => (input as HTMLTextAreaElement).value), prompt);
        } finally {
            server.close();
        }
    } finally {
        await browser.close();
    }
});

test('shared renderer stays in Chat and Work and code copy has no command path', async () => {
    const [chat, work, renderer] = await Promise.all([
        readFile('packages/theia-extension/src/browser/chat-panel-widget.ts', 'utf8'),
        readFile('packages/theia-extension/src/browser/agent-transcript-widget.ts', 'utf8'),
        readFile('packages/theia-extension/src/browser/untrusted-message-markdown.ts', 'utf8')
    ]);
    assert.match(chat, /renderUntrustedMessageMarkdown\(this\.markdown/);
    assert.match(work, /renderUntrustedMessageMarkdown\(this\.markdown/);
    assert.match(renderer, /navigator\.clipboard\?\.writeText\(content\)/);
    assert.doesNotMatch(renderer, /gen-roadmap|executeCommand|sendMessage|submitMessage/);
});
