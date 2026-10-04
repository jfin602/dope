import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import markdownit from 'markdown-it';
import { safeChatLink } from '../../packages/theia-extension/lib/browser/chat-panel-presentation.js';

test('untrusted Markdown links permit web/mail destinations only', () => {
    const base = 'https://example.test/chat';
    for (const href of ['https://example.com', 'mailto:dev@example.com', './docs', '#answer'])
        assert.equal(safeChatLink(href, base), true, href);
    for (const href of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'command:run', 'file:///etc/passwd', 'http://['])
        assert.equal(safeChatLink(href, base), false, href);
});

test('Theia Markdown path formats documents while escaping model-authored HTML', async () => {
    const renderer = await readFile(new URL('../../node_modules/@theia/core/lib/browser/markdown-rendering/markdown-renderer.js', import.meta.url), 'utf8');
    assert.match(renderer, /markdownit\(\)/);
    assert.match(renderer, /DOMPurify\.sanitize\(html/);
    const html = markdownit().render('# Heading\n\n**bold** *italic*\n\n1. one\n2. two\n\n- item\n\n[link](https://example.com) `inline`\n\n```ts\nconst x = 1\n```\n\n> quote\n\n|a|b|\n|-|-|\n|1|2|\n\n<script>alert(1)</script>');
    for (const tag of ['h1', 'strong', 'em', 'ol', 'ul', 'a', 'code', 'pre', 'blockquote', 'table'])
        assert.match(html, new RegExp(`<${tag}\\b`), tag);
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /&lt;script&gt;/);
});

test('conversation surface keeps shell, roles, color and safe Markdown boundaries', async () => {
    const widget = await readFile(new URL('../../packages/theia-extension/src/browser/chat-panel-widget.ts', import.meta.url), 'utf8');
    const css = await readFile(new URL('../../packages/theia-extension/src/browser/dope.css', import.meta.url), 'utf8');
    const module = await readFile(new URL('../../packages/theia-extension/src/browser/frontend-module.ts', import.meta.url), 'utf8');
    assert.match(widget, /shell\.append\(header, region\)/);
    assert.match(widget, /shell\.append\(composer\)/);
    assert.match(css, /\.dope-chat-scroll \{[^}]*overflow: auto/);
    assert.match(css, /\.dope-chat-shell \{[^}]*flex-direction: column/);
    assert.match(css, /\.dope-chat-message-user \{[^}]*align-items: flex-end/);
    assert.match(css, /\.dope-chat-message-assistant \.dope-chat-message-content/);
    assert.match(widget, /item\.setAttribute\('aria-label', message\.role === 'user' \? 'You' : 'Assistant'\)/);
    assert.doesNotMatch(widget, /who\.textContent/);
    assert.match(widget, /dot\.dataset\.color = chat\.color/);
    assert.match(widget, /for \(const value of CHAT_COLORS\)/);
    assert.match(widget, /type: 'set-color', chatId, color: value/);
    assert.match(widget, /new MarkdownStringImpl\(body, \{ supportHtml: false, isTrusted: false \}\)/);
    assert.match(widget, /safeChatLink\(link\.getAttribute\('href'\)!/);
    assert.match(module, /CoreMarkdownRenderer/);
    assert.match(widget, /dope-chat-message-meta/);
    assert.match(widget, /dope-chat-message-alert/);
    assert.match(widget, /Scroll to latest/);
});
