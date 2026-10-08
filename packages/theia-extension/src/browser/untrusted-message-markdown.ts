import type { MarkdownRenderer } from '@theia/core/lib/browser/markdown-rendering/markdown-renderer';
import { MarkdownStringImpl } from '@theia/core/lib/common/markdown-rendering/markdown-string';
import { safeChatLink } from './chat-panel-presentation';

/** Shared presentation boundary for untrusted Chat and AgentRun prose. */
export function renderUntrustedMessageMarkdown(markdown: MarkdownRenderer, text: string): HTMLElement {
    const rendered = markdown.render(new MarkdownStringImpl(text,
        { supportHtml: false, isTrusted: false })).element;
    for (const link of rendered.querySelectorAll('a[href]')) {
        if (!safeChatLink(link.getAttribute('href')!, document.baseURI)) link.removeAttribute('href');
        else link.setAttribute('rel', 'noopener noreferrer');
    }
    return rendered;
}
