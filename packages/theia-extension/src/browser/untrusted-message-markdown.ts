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
    return `<div class="dope-message-code">${label}<pre><code>${messageMarkdown.utils.escapeHtml(token.content)}</code></pre></div>\n`;
};

/** Image tokens become text before HTML parsing can create an image request. */
export function renderUntrustedMessageHtml(text: string): string {
    return messageMarkdown.render(text);
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
    return rendered;
}
