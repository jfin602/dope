import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import puppeteer from 'puppeteer';

test('adding Work activity retains the mounted transcript and open disclosure', async t => {
    const browserPath = process.env.CHROME_BIN ?? '/usr/bin/google-chrome';
    if (!existsSync(browserPath)) { t.skip('Chrome unavailable'); return; }
    const bundle = await build({ entryPoints: ['packages/theia-extension/src/browser/work-panel-update.ts'],
        bundle: true, write: false, platform: 'browser', format: 'iife', globalName: 'DopeWorkUpdate' });
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'], executablePath: browserPath });
    try {
        const page = await browser.newPage();
        await page.setContent('<div class="dope-chat-panel"><div class="dope-chat-content-work"><button class="dope-chat-composer-submit" aria-label="Start Work">↑</button></div></div>' +
            '<div id="current"><header>Work</header><section class="dope-work-transcript"><details open><summary>Working</summary><p>First tool</p></details></section><footer>Composer</footer><details class="dope-work-run-details"><summary>Run details</summary><p>Event 1</p></details></div>' +
            '<div id="fresh"><header>Work</header><section class="dope-work-transcript"><details open><summary>Working</summary><p>First tool</p><p>Second tool</p></details></section><footer>Composer</footer><details class="dope-work-run-details"><summary>Run details</summary><p>Event 1</p><p>Event 2</p></details></div>');
        await page.addStyleTag({ content: await readFile('packages/theia-extension/src/browser/dope.css', 'utf8') });
        await page.addScriptTag({ content: bundle.outputFiles[0].text });
        const buttonBackground = await page.$eval('.dope-chat-composer-submit',
            button => getComputedStyle(button).backgroundColor);
        await page.hover('.dope-chat-composer-submit');
        const hoverBackground = await page.$eval('.dope-chat-composer-submit',
            button => getComputedStyle(button).backgroundColor);
        const result = await page.evaluate(() => {
            const current = document.querySelector<HTMLElement>('#current')!;
            const fresh = document.querySelector<HTMLElement>('#fresh')!;
            const transcript = current.querySelector('.dope-work-transcript');
            const disclosure = current.querySelector('details')!;
            const runDetails = current.querySelector('.dope-work-run-details');
            disclosure.open = false;
            const reused = (window as any).DopeWorkUpdate.reuseWorkTranscript(current, fresh);
            const retained = transcript === current.querySelector('.dope-work-transcript') &&
                disclosure === current.querySelector('details') &&
                runDetails === current.querySelector('.dope-work-run-details');
            fresh.querySelector('header')!.textContent = 'Another Work';
            return { reused, retained, open: disclosure.open,
                tools: [...current.querySelectorAll('details p')].map(node => node.textContent),
                changedShellRejected: !(window as any).DopeWorkUpdate.reuseWorkTranscript(current, fresh) };
        });
        assert.deepEqual(result, { reused: true, retained: true, open: false,
            tools: ['First tool', 'Second tool', 'Event 1', 'Event 2'], changedShellRejected: true });
        assert.equal(buttonBackground, 'rgba(0, 0, 0, 0)');
        assert.equal(hoverBackground, 'rgba(0, 0, 0, 0)');
    } finally { await browser.close(); }
});
