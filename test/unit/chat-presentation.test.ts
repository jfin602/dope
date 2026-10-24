import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import markdownit from 'markdown-it';
import { implementationPlanAnswer, isDraftPlanningAction, planningActivityPresentation, planningOutcome, safeChatLink } from '../../packages/theia-extension/lib/browser/chat-panel-presentation.js';
import { renderUntrustedMessageHtml } from '../../packages/theia-extension/lib/browser/untrusted-message-markdown.js';
import type { ChatAssistantMessage } from '../../packages/chat/lib/index.js';

test('only persisted trusted planning activity receives a compact label and honest status', () => {
    const message = { content: '{"type":"roadmap-intent"}', planningActivity: {
        schemaVersion: 1, kind: 'roadmap-intent', status: 'pending', refs: [], proposalId: 'proposal',
    } } as ChatAssistantMessage;
    assert.deepEqual(planningActivityPresentation(message), {
        label: 'Roadmap intent', status: 'Pending · no write', alert: false,
    });
    assert.equal(planningActivityPresentation({ ...message, planningActivity: undefined }), undefined);
    assert.equal(planningActivityPresentation({ ...message, content: '{"type":"unknown"}', planningActivity: undefined }), undefined);
    for (const [status, expected] of [['rejected', 'Rejected · no change'], ['denied', 'Denied · no change'],
        ['stale', 'Stale · no change'], ['applied', 'Applied']] as const) {
        assert.equal(planningActivityPresentation({ ...message, planningActivity: { ...message.planningActivity!, status } })?.status, expected);
    }
    assert.equal(planningActivityPresentation({ ...message, planningActivity: {
        schemaVersion: 1, kind: 'error', status: 'failed', refs: [],
    } }) , undefined);
});

test('draft review labels only draft action types', () => {
    for (const type of ['create-phase', 'split-checkpoint', 'move-checkpoint', 'add-dependency',
        'remove-dependency', 'create-correction', 'attach-correction', 'draft-sequence'])
        assert.equal(isDraftPlanningAction(type), true);
    for (const type of ['edit', 'reorder', 'document-edit', 'unknown'])
        assert.equal(isDraftPlanningAction(type), false);
});

test('validated plan projects substantial readable prose and distinguishes verified reuse', () => {
    const plan = { type: 'implementation-plan', objective: 'Build history', successCriteria: ['Browse commits'],
        constraints: ['Ask before checkout'], assumptions: ['Diff API shape is uncertain'],
        steps: [{ title: 'Inspect', detail: 'Read Git integration. '.repeat(90), deliverables: ['Map'], dependsOn: [],
            reuse: [{ path: 'packages/git/src/history.ts', reason: 'Existing history owner' }] },
        { title: 'Build', detail: 'Wire the panel safely. '.repeat(86), deliverables: ['Panel'], dependsOn: [1],
            reuse: [{ path: 'packages/git/src/diff.ts', reason: 'Potential diff UI' }] }],
        tests: ['Unit test'], guiQualification: 'Open the panel', risks: ['Stale branch'],
        alternatives: ['Read-only first'], question: '' };
    const message = { content: JSON.stringify(plan), execution: { status: 'complete' }, planningActivity: {
        schemaVersion: 1, kind: 'implementation-plan', status: 'pending', proposalId: 'proposal',
        refs: [{ kind: 'file', id: 'packages/git/src/history.ts', sourceHash: 'a'.repeat(64), includedBytes: 100 }],
    } } as ChatAssistantMessage;
    const answer = implementationPlanAnswer(message)!;
    assert.ok(answer.length > 4000);
    assert.match(answer, /Goal:.*Build history/);
    assert.match(answer, /1\. \*\*Inspect/);
    assert.match(answer, /2\. \*\*Build/);
    assert.match(answer, /history\.ts \(verified source/);
    assert.match(answer, /diff\.ts \(unverified/);
    assert.match(answer, /GUI qualification/);
    assert.doesNotMatch(answer, /"type":"implementation-plan"/);
    assert.equal(implementationPlanAnswer({ ...message, planningActivity: undefined }), undefined);
});

test('trusted greenfield creation is described as creation even when it has an objective', () => {
    for (const [type, expected] of [['create-phase', 'create a phase'],
        ['create-checkpoint', 'create a checkpoint']] as const) {
        const message = { content: JSON.stringify({ type: 'roadmap-draft-proposal', projectId: 'uninitialized',
            draftRevision: 0, action: { type, title: 'Cache', objective: 'Define a cache boundary' } }),
        planningActivity: { schemaVersion: 1, kind: 'roadmap-draft-proposal', status: 'pending', refs: [],
            proposalId: 'proposal' } } as ChatAssistantMessage;
        assert.match(planningOutcome(message)?.summary ?? '', new RegExp(expected));
        assert.doesNotMatch(planningOutcome(message)?.summary ?? '', /set the objective/);
        assert.match(planningOutcome(message)?.summary ?? '', /accepted draft and canonical Roadmap are unchanged/);
        const accepted = { ...message, planningActivity: { ...message.planningActivity!,
            status: 'applied' as const, appliedRevision: 2 } };
        assert.match(planningOutcome(accepted)?.summary ?? '', /saved in the accepted draft at revision 2.*not yet canonical/);
    }
});

test('completed backend-validated no-action presents its message once without implying a write', () => {
    const content = JSON.stringify({ type: 'no-action', message: 'Use the Roadmap source menu to review the linked file.' });
    const message = { content, execution: { status: 'complete' }, planningActivity: {
        schemaVersion: 1, kind: 'no-action', status: 'no-action', refs: [],
    } } as ChatAssistantMessage;
    assert.deepEqual(planningOutcome(message), {
        summary: 'Use the Roadmap source menu to review the linked file.', questions: [],
    });
    assert.equal(planningActivityPresentation(message)?.status, 'No change');
    for (const damaged of [
        { ...message, planningActivity: undefined },
        { ...message, execution: { status: 'streaming' } },
        { ...message, content: '{"type":"no-action","message":"<script>bad</script>","extra":true}' },
        { ...message, content: '{"type":"no-action","message":""}' },
        { ...message, content: '{"type":"no-action","message":"' + 'x'.repeat(4001) + '"}' },
        { ...message, content: 'not JSON' },
    ] as ChatAssistantMessage[]) {
        assert.notEqual(planningOutcome(damaged)?.summary, '<script>bad</script>');
        assert.notEqual(planningOutcome(damaged)?.summary, 'x'.repeat(4001));
        assert.notEqual(planningOutcome(damaged)?.summary, 'Use the Roadmap source menu to review the linked file.');
    }
    assert.equal(planningOutcome({ ...message, planningActivity: undefined }), undefined);
    assert.equal(planningActivityPresentation({ ...message, planningActivity: undefined }), undefined);
    assert.equal(planningOutcome({ ...message, planningActivity: undefined, content: 'Ordinary assistant prose' }), undefined);
    assert.equal(planningOutcome({ ...message,
        content: JSON.stringify({ type: 'no-action', message: '<script>literal text</script>' }) })?.summary,
    '<script>literal text</script>'); // The widget inserts this through textContent, never HTML.
    for (const claim of ['I applied the edit.', 'The Roadmap was updated.', 'We have saved the new source.']) {
        assert.match(planningOutcome({ ...message, content: JSON.stringify({ type: 'no-action', message: claim }) })?.summary ?? '',
            /Nothing was written/);
    }
});

test('verified guidance is distinct from preserved model text and requires a valid no-action envelope', () => {
    const message = { content: JSON.stringify({ type: 'no-action',
        message: 'I changed the linked file and the synced Roadmap is conflicted.' }),
    execution: { status: 'complete' }, planningActivity: { schemaVersion: 1, kind: 'no-action',
        status: 'no-action', refs: [], verifiedGuidance: { capabilityId: 'roadmap-change-file',
            version: '0.11.8-m1', text: 'Review the replacement preview and explicitly confirm it. The old file remains on disk.' } } } as ChatAssistantMessage;
    assert.equal(planningActivityPresentation(message)?.label, 'Verified Dope guidance');
    assert.match(planningOutcome(message)?.summary ?? '', /explicitly confirm/);
    assert.doesNotMatch(planningOutcome(message)?.summary ?? '', /conflicted|I changed/);
    assert.match(message.content, /conflicted/);
    for (const content of ['garbage', '{"type":"no-action","message":"ok","extra":true}',
        '{"type":"unknown","message":"ok"}']) {
        const damaged = { ...message, content };
        assert.equal(planningActivityPresentation(damaged)?.label, 'No planning action');
        assert.doesNotMatch(planningOutcome(damaged)?.summary ?? '', /explicitly confirm/);
    }
});

test('untrusted Markdown links permit web/mail destinations only', () => {
    const base = 'https://example.test/chat';
    for (const href of ['https://example.com', 'mailto:dev@example.com', './docs', '#answer'])
        assert.equal(safeChatLink(href, base), true, href);
    for (const href of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'command:run', 'file:///etc/passwd', 'http://['])
        assert.equal(safeChatLink(href, base), false, href);
});

test('untrusted message renderer retains Markdown formatting while escaping model-authored HTML', () => {
    const html = renderUntrustedMessageHtml('# Heading\n\n**bold** *italic*\n\n1. one\n2. two\n\n- item\n\n[link](https://example.com) `inline`\n\n```ts\nconst x = 1\n```\n\n> quote\n\n|a|b|\n|-|-|\n|1|2|\n\n<script>alert(1)</script>');
    for (const tag of ['h1', 'strong', 'em', 'ol', 'ul', 'a', 'code', 'pre', 'blockquote', 'table'])
        assert.match(html, new RegExp(`<${tag}\\b`), tag);
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /&lt;script&gt;/);
});

test('untrusted Markdown omits image tokens before DOM creation without a document-wide policy', async () => {
    const markdown = await readFile(new URL('../../packages/theia-extension/src/browser/untrusted-message-markdown.ts', import.meta.url), 'utf8');
    assert.match(markdownit().render('![private context](https://example.test/pixel?context=private)'),
        /<img src="https:\/\/example\.test\/pixel\?context=private"/);
    for (const input of [
        '![private context](https://example.test/pixel?context=private)',
        '[![nested](https://example.test/nested)](https://example.test/destination)',
        '![reference][remote]\n\n[remote]: https://example.test/reference',
        '<img src="https://example.test/raw">'
    ]) {
        const html = renderUntrustedMessageHtml(input);
        assert.doesNotMatch(html, /<(?:img|picture|source)\b/i);
    }
    assert.match(renderUntrustedMessageHtml('<img src="https://example.test/raw">'), /&lt;img src=&quot;/);
    assert.match(renderUntrustedMessageHtml('**bold** and [link](https://example.test/page)'),
        /<strong>bold<\/strong> and <a href="https:\/\/example\.test\/page">link<\/a>/);
    assert.match(markdown, /DOMPurify\.sanitize\(renderUntrustedMessageHtml\(text\)/);
    assert.match(markdown, /RETURN_DOM_FRAGMENT: true/);
    assert.match(markdown, /FORBID_TAGS: \['img'/);
    assert.doesNotMatch(markdown, /Content-Security-Policy|document\.head\.append/);
});

test('conversation surface keeps shell, roles, color and safe Markdown boundaries', async () => {
    const widget = await readFile(new URL('../../packages/theia-extension/src/browser/chat-panel-widget.ts', import.meta.url), 'utf8');
    const markdown = await readFile(new URL('../../packages/theia-extension/src/browser/untrusted-message-markdown.ts', import.meta.url), 'utf8');
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
    assert.match(widget, /renderUntrustedMessageMarkdown\(this\.markdown, body\)/);
    assert.match(widget, /renderUntrustedMessageMarkdown\(this\.markdown, state\.stream\.content\)/);
    assert.match(markdown, /messageMarkdown\.renderer\.rules\.image =/);
    assert.match(markdown, /safeChatLink\(link\.getAttribute\('href'\)!, document\.baseURI\)/);
    assert.match(markdown, /link\.removeAttribute\('href'\)/);
    assert.match(markdown, /link\.setAttribute\('rel', 'noopener noreferrer'\)/);
    assert.doesNotMatch(markdown, /innerHTML|outerHTML/);
    assert.match(module, /CoreMarkdownRenderer/);
    assert.match(widget, /dope-chat-message-meta/);
    assert.match(widget, /\['automatic', 'Auto context'\]/);
    assert.match(widget, /ref\.includedBytes === 0 \? ' \(omitted by budget\)'/);
    assert.doesNotMatch(widget, /ref\.label}\s*\(\$\{ref\.id\}\)/);
    assert.match(widget, /dope-chat-message-alert/);
    assert.match(widget, /Scroll to latest/);
});

test('trusted machine activity uses native disclosure, literal raw text and neutral narrow styling', async () => {
    const widget = await readFile(new URL('../../packages/theia-extension/src/browser/chat-panel-widget.ts', import.meta.url), 'utf8');
    const css = await readFile(new URL('../../packages/theia-extension/src/browser/dope.css', import.meta.url), 'utf8');
    assert.match(widget, /planningActivityPresentation\(message\)/);
    assert.match(widget, /document\.createElement\('details'\)/);
    assert.match(widget, /summary\.setAttribute\('aria-label', `\$\{activity\.label\}: \$\{activity\.status\}\. Original JSON`\)/);
    assert.match(widget, /raw\.textContent = body/);
    assert.match(widget, /navigator\.clipboard\?\.writeText\(body\)/);
    assert.match(widget, /summary\.textContent = outcome\.summary/);
    assert.match(widget, /if \(outcome\) \{/);
    assert.doesNotMatch(widget, /body\.replace\(\/\\s\+\/g, ' '\)\.slice\(0, 160\)/);
    assert.match(widget, /this\.openPlanningActivities\.add\(message\.id\)/);
    assert.match(widget, /if \(activity\.alert\) item\.classList\.add\('dope-chat-message-alert'\)/);
    assert.match(widget, /else content\.append\(renderUntrustedMessageMarkdown\(this\.markdown, body\)\)/);
    assert.match(css, /\.dope-chat-planning-outcome \{[^}]*overflow-wrap: anywhere/);
    assert.match(css, /\.dope-chat-planning-activity \{[^}]*var\(--theia-descriptionForeground\)/);
    assert.match(css, /\.dope-chat-message-alert \.dope-chat-activity-status \{[^}]*var\(--theia-errorForeground\)/);
    assert.match(css, /\.dope-chat-panel button:focus-visible, \.dope-chat-panel summary:focus-visible/);
});

test('Select Chat keeps nested disclosure and contextual actions separate from selection', async () => {
    const widget = await readFile(new URL('../../packages/theia-extension/src/browser/chat-panel-widget.ts', import.meta.url), 'utf8');
    const css = await readFile(new URL('../../packages/theia-extension/src/browser/dope.css', import.meta.url), 'utf8');
    const tree = widget.slice(widget.indexOf('private renderTree('), widget.indexOf('private render():'));
    assert.match(tree, /details\.append\(menu, this\.renderTree\(folder\)\)/);
    assert.match(tree, /menuLabel\.setAttribute\('aria-label', `Actions for folder \$\{folder\.path\}`\)/);
    assert.match(tree, /select = this\.button\('', \(\) => void this\.controller\.select\(chat\.id\)\)/);
    assert.match(tree, /select\.setAttribute\('aria-label', `Open Chat \$\{chat\.title\}`\)/);
    assert.match(tree, /title\.textContent = chat\.title/);
    assert.match(tree, /dot\.dataset\.color = chat\.color/);
    assert.match(tree, /time\.dateTime = chat\.lastInteractedAt/);
    assert.match(tree, /menuLabel\.setAttribute\('aria-label', `Actions for Chat \$\{chat\.title\}`\)/);
    assert.match(tree, /menu\.append\(menuLabel, actions\);\s*row\.append\(select, menu\)/);
    assert.match(tree, /type: 'rename-chat'/);
    assert.match(tree, /type: 'move-chat'/);
    assert.match(widget, /navigation\.setAttribute\('aria-label', 'Chats and folders'\)/);
    assert.match(css, /\.dope-chat-selector-list \{[^}]*overflow: auto/);
    assert.match(css, /\.dope-chat-panel button:focus-visible, \.dope-chat-panel summary:focus-visible/);
});
