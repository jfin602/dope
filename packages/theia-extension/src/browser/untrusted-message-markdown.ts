import type { MarkdownRenderer } from '@theia/core/lib/browser/markdown-rendering/markdown-renderer';
import markdownit = require('markdown-it');
import emoji = require('markdown-it-emoji');
import DOMPurify = require('dompurify');
import { safeChatLink } from './chat-panel-presentation';

const messageMarkdown = markdownit({ html: false, linkify: false }).use(emoji.full);
messageMarkdown.renderer.rules.image = (tokens, index) => {
    const alt = tokens[index].content;
    return messageMarkdown.utils.escapeHtml(alt ? `[Image omitted: ${alt}]` : '[Image omitted]');
};
messageMarkdown.renderer.rules.fence = (tokens, index) => {
    const token = tokens[index];
    const language = token.info.trim().split(/\s+/u, 1)[0];
    // A label is presentation only. Never interpolate untrusted fence info as markup.
    const safeLanguage = /^[a-z][a-z0-9_+.#-]{0,24}$/iu.test(language) ? language : '';
    const label = safeLanguage ? `<span class="dope-message-code-language">${messageMarkdown.utils.escapeHtml(safeLanguage)}</span>` : '';
    return `<div class="dope-message-code"><div class="dope-message-code-header">${label}</div><pre><code>${messageMarkdown.utils.escapeHtml(token.content)}</code></pre></div>\n`;
};

/** Image tokens become text before HTML parsing can create an image request. */
export function renderUntrustedMessageHtml(text: string): string {
    // Some local models put an entire fenced snippet inside a prose line.
    // Markdown treats that as literal backticks; present it as inline code.
    const inlineFences = text.replace(/```[ \t]*([^\r\n`]*?\S[^\r\n`]*?)[ \t]*```/gu,
        (_match, content: string) => `\`${content.trim()}\``);
    return messageMarkdown.render(inlineFences);
}

/** Shared presentation boundary for untrusted Chat and AgentRun prose. */
export function renderUntrustedMessageMarkdown(_markdown: MarkdownRenderer, text: string): HTMLElement {
    // Theia's renderer creates <img> during its own HTML parse, before callers
    // can remove it. Keep the service argument for existing widget bindings.
    const rendered = document.createElement('div');
    rendered.append(DOMPurify.sanitize(renderUntrustedMessageHtml(text), {
        RETURN_DOM_FRAGMENT: true,
        FORBID_TAGS: ['img', 'picture', 'source', 'svg', 'video', 'audio', 'iframe', 'object', 'embed'],
        FORBID_ATTR: ['src', 'srcset', 'poster']
    }));
    for (const link of rendered.querySelectorAll('a[href]')) {
        if (!safeChatLink(link.getAttribute('href')!, document.baseURI)) link.removeAttribute('href');
        else link.setAttribute('rel', 'noopener noreferrer');
    }
    for (const block of rendered.querySelectorAll<HTMLElement>('.dope-message-code')) {
        const header = block.querySelector<HTMLElement>('.dope-message-code-header');
        const code = block.querySelector<HTMLElement>('pre > code');
        if (!header || !code) continue;
        const copy = document.createElement('button');
        copy.type = 'button';
        copy.className = 'dope-message-code-copy';
        copy.setAttribute('aria-label', 'Copy code block');
        const icon = document.createElement('span');
        icon.className = 'codicon codicon-copy';
        icon.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span');
        label.setAttribute('role', 'status');
        label.setAttribute('aria-live', 'polite');
        label.textContent = 'Copy';
        copy.append(icon, label);
        let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
        copy.addEventListener('click', () => {
            // Read this block at activation time so an updated streaming block copies what is shown.
            const content = code.textContent ?? '';
            const write = navigator.clipboard?.writeText(content) ?? Promise.reject(new Error('Clipboard unavailable'));
            void write.then(() => showFeedback('Copied'), () => showFeedback('Copy failed'));
        });
        const showFeedback = (message: string) => {
            if (!copy.isConnected) return;
            if (feedbackTimer) clearTimeout(feedbackTimer);
            label.textContent = message;
            copy.setAttribute('aria-label', message);
            feedbackTimer = setTimeout(() => {
                label.textContent = 'Copy';
                copy.setAttribute('aria-label', 'Copy code block');
                feedbackTimer = undefined;
            }, 1800);
        };
        header.append(copy);
    }
    return rendered;
}
