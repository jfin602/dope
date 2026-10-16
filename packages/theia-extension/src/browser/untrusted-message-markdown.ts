import type { MarkdownRenderer } from '@theia/core/lib/browser/markdown-rendering/markdown-renderer';
import { MarkdownStringImpl } from '@theia/core/lib/common/markdown-rendering/markdown-string';
import { safeChatLink } from './chat-panel-presentation';

const mediaPolicyId = 'dope-untrusted-message-media-policy';

function blockRemoteMessageImages(): void {
    if (document.getElementById(mediaPolicyId)) return;
    // Theia's Markdown renderer parses HTML before returning the detached
    // element. A remote image may start loading before it can be removed below.
    const policy = document.createElement('meta');
    policy.id = mediaPolicyId;
    policy.httpEquiv = 'Content-Security-Policy';
    policy.content = "img-src 'self' data: blob:";
    document.head.append(policy);
}

/** Shared presentation boundary for untrusted Chat and AgentRun prose. */
export function renderUntrustedMessageMarkdown(markdown: MarkdownRenderer, text: string): HTMLElement {
    blockRemoteMessageImages();
    const rendered = markdown.render(new MarkdownStringImpl(text,
        { supportHtml: false, isTrusted: false })).element;
    for (const image of rendered.querySelectorAll('img')) {
        image.replaceWith(document.createTextNode(image.alt ? `[Image omitted: ${image.alt}]` : '[Image omitted]'));
    }
    for (const link of rendered.querySelectorAll('a[href]')) {
        if (!safeChatLink(link.getAttribute('href')!, document.baseURI)) link.removeAttribute('href');
        else link.setAttribute('rel', 'noopener noreferrer');
    }
    return rendered;
}
