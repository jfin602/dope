import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { build } from 'esbuild';
import puppeteer from 'puppeteer';

test('live Markdown fades only appended text and keeps code copy content intact', async () => {
    const bundle = await build({ entryPoints: ['packages/theia-extension/src/browser/live-answer-fade.ts'],
        bundle: true, write: false, platform: 'browser', format: 'iife', globalName: 'DopeFade' });
    const systemChrome = process.env.CHROME_BIN ?? '/usr/bin/google-chrome';
    assert.ok(existsSync(systemChrome), 'Chrome is required for the DOM fade test');
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'],
        executablePath: systemChrome });
    try {
        const page = await browser.newPage();
        await page.setContent('<main id="answer"></main>');
        await page.addScriptTag({ content: bundle.outputFiles[0].text });
        const result = await page.evaluate(() => {
            const host = document.querySelector<HTMLElement>('#answer')!;
            host.innerHTML = '<p>First <strong>part</strong> and more.</p>';
            const first = (window as any).DopeFade.fadeInNewAnswerText(host, '', true);
            host.innerHTML = '<p>First <strong>part</strong> and more.</p>' +
                '<div class="dope-message-code"><div class="dope-message-code-header">ts<button>Copy</button></div>' +
                '<pre><code>const x = 1;</code></pre></div>';
            const second = (window as any).DopeFade.fadeInNewAnswerText(host, first, true);
            return { first, second, faded: [...host.querySelectorAll('.dope-chat-answer-fade')].map(node => node.textContent),
                code: host.querySelector('code')?.textContent, buttons: host.querySelectorAll('button').length };
        });
        assert.equal(result.first, 'First part and more.');
        assert.equal(result.second, 'First part and more.const x = 1;');
        assert.deepEqual(result.faded, ['const x = 1;']);
        assert.equal(result.code, 'const x = 1;');
        assert.equal(result.buttons, 1);
    } finally { await browser.close(); }
});
