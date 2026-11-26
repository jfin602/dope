import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { build } from 'esbuild';
import puppeteer from 'puppeteer';
import { lockedWorkMode, workConversationTimeline, workSegmentReviewEnabled } from '../../packages/theia-extension/lib/browser/work-conversation-presentation.js';

test('locked Work wording distinguishes applied Direct edits, held Isolated candidates, and unknown evidence', () => {
    const segment: any = { runId: 'run', taskId: 'task', executionMode: 'direct' };
    const direct = lockedWorkMode({ id: 'run', taskId: 'task', executionMode: 'direct' } as any, segment,
        { id: 'task', executionMode: 'direct' } as any);
    assert.match(direct.description, /open project immediately/);
    assert.doesNotMatch(direct.description, /candidate|promotion/);
    const isolated = lockedWorkMode({ id: 'run', taskId: 'task', executionMode: 'isolated' } as any,
        { ...segment, executionMode: 'isolated' }, { id: 'task', executionMode: 'isolated' } as any);
    assert.match(isolated.description, /separate candidate until reviewed and accepted/);
    assert.equal(lockedWorkMode({ id: 'run', taskId: 'task', executionMode: 'direct' } as any,
        { ...segment, executionMode: 'isolated' }).mode, undefined);
    assert.equal(lockedWorkMode({ id: 'run', taskId: 'task' } as any, segment).mode, undefined);
    assert.equal(lockedWorkMode({ id: 'run', taskId: 'task', executionMode: 'direct' } as any,
        { runId: 'run', taskId: 'task' } as any).mode, 'direct');
});

test('terminal Work review enables on typed text and blocks pending or unselected sends', () => {
    assert.equal(workSegmentReviewEnabled('  next step  ', false, false, false, false), true);
    assert.equal(workSegmentReviewEnabled('  ', false, false, false, false), false);
    assert.equal(workSegmentReviewEnabled('next', true, false, false, false), false);
    assert.equal(workSegmentReviewEnabled('next', false, true, true, true), false);
    assert.equal(workSegmentReviewEnabled('next', false, true, false, false), false);
    assert.equal(workSegmentReviewEnabled('next', false, true, false, true), true);
});

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
    assert.match(widget, /this\.content\.append\(region\);\s*if \(runSteerComposer\) this\.content\.append\(runSteerComposer\);\s*if \(followUpReview\) this\.content\.append\(followUpReview\);\s*if \(conversationComposer\) this\.content\.append\(conversationComposer\);\s*if \(runDetailsControl\)/);
    assert.match(widget, /prompt\.placeholder = 'Continue this Work conversation…'/);
    assert.match(widget, /if \(!session\) runSteerComposer = steer/);
    assert.match(widget, /controller\.openFollowUp\(\)/);
    assert.match(widget, /this\.composerActionButton\(\(\) => \{[\s\S]*?run\.status === 'running' \? 'stop' : 'send', run\.status === 'running' \? 'Stop Work' : 'Send steering'/);
    assert.match(css, /\.dope-chat-composer \{[^}]*width: calc\(100% - 24px\)/s);
    assert.match(widget, /scroll\.append\(conversation\)/);
    assert.match(widget, /runDetailsBody\.append\(segments\)/);
    assert.match(widget, /runDetailsBody\.append\(activity\)/);
    assert.match(frontend, /id: 'dope\.work\.refresh'/);
    assert.match(frontend, /id: 'dope\.work\.fork'/);
    assert.match(widget, /session\.segments\.at\(-1\)\?\.runId === run\.id/);
    assert.match(widget, /shouldSendChatInput\(event\)/);
    assert.match(widget, /element instanceof HTMLTextAreaElement && selection\)[\s\S]*?element\.setSelectionRange\(selection\[0\], selection\[1\]\)/);
    assert.match(widget, /input\.maxLength = 16000/);
    assert.match(css, /> form\.dope-work-conversation-composer \{[^}]*min-width: 0/s);
    assert.match(widget, /form\.className = 'dope-work-conversation-composer dope-chat-composer'/);
    assert.match(widget, /const prompt = document\.createElement\('textarea'\); prompt\.rows = 1/);
    assert.match(widget, /inputWrap\.append\(prompt\); form\.append\(inputWrap, toolbar\)/);
    assert.match(widget, /toolbar\.className = 'dope-chat-composer-toolbar'/);
    assert.match(css, /\.dope-chat-composer:focus-within \{[^}]*var\(--theia-focusBorder\)/s);
    assert.doesNotMatch(css, /\.dope-work-segment-boundary \{/);
    assert.match(widget, /latest\.setAttribute\('aria-label', 'Scroll to latest'\)/);
});

test('submitted Work opens in the normal transcript and then yields to saved evidence', async t => {
    const browserPath = process.env.CHROME_BIN ?? '/usr/bin/google-chrome';
    if (!existsSync(browserPath)) { t.skip('Chrome unavailable'); return; }
    const bundle = await build({
        entryPoints: ['packages/theia-extension/src/browser/work-conversation-presentation.ts'],
        bundle: true, write: false, platform: 'browser', format: 'iife', globalName: 'DopeWork',
        plugins: [{ name: 'presentation-link-policy', setup(plugin) {
            plugin.onResolve({ filter: /chat-panel-presentation$/ }, () => ({ path: 'link-policy', namespace: 'test' }));
            plugin.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: `export const safeChatLink = () => false;` }));
        } }]
    });
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'], executablePath: browserPath });
    try {
        const page = await browser.newPage();
        await page.setContent('<main id="work"></main>');
        await page.addScriptTag({ content: bundle.outputFiles[0].text });
        const result = await page.evaluate(() => {
            const host = document.querySelector('#work')!;
            const prompt = '<script>My Work request</script>';
            const pending = (window as any).DopeWork.renderWorkConversation(undefined, [], undefined, prompt);
            host.replaceChildren(pending);
            const before = { label: pending.getAttribute('aria-label'),
                prompt: pending.querySelector('[aria-label="Work request"]')?.textContent,
                status: pending.querySelector('.dope-work-system')?.textContent,
                unsafeNodes: pending.querySelectorAll('script, img, [onerror]').length };
            const saved = (window as any).DopeWork.renderWorkConversation(undefined, [
                { runId: 'run', sequence: 1, at: '2026-11-25T00:00:01.000Z',
                    kind: 'message', text: 'Started', truncated: false }
            ], undefined, prompt, undefined, [{ id: 'run', status: 'running' }]);
            host.replaceChildren(saved);
            return { before, after: {
                label: host.querySelector('section')?.getAttribute('aria-label'),
                promptCount: host.querySelectorAll('[aria-label="Work request"]').length,
                response: host.querySelector('[aria-label="Coding Agent"]')?.textContent,
                startingNote: host.textContent?.includes('Starting Work…') } };
        });
        assert.deepEqual(result.before, {
            label: 'Saved Work conversation', prompt: '<script>My Work request</script>',
            unsafeNodes: 0
        });
        assert.equal(result.after.label, 'Saved Work conversation');
        assert.equal(result.after.promptCount, 1);
        assert.match(result.after.response ?? '', /Started/);
        assert.equal(result.after.startingNote, false);
    } finally { await browser.close(); }
});

test('saved Work renderer separates user and agent messages, condenses tools, and keeps debug events out of conversation', async t => {
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
    const css = await readFile('packages/theia-extension/src/browser/dope.css', 'utf8');
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'], executablePath: browserPath });
    try {
        const page = await browser.newPage();
        await page.setContent('<main id="work" class="dope-chat-panel dope-chat-content-work" ' +
            'style="--theia-errorForeground:#f48771;--theia-foreground:#ddd;--theia-widget-border:#666"></main>');
        await page.addStyleTag({ content: css });
        await page.addScriptTag({ content: bundle.outputFiles[0].text });
        const result = await page.evaluate(() => {
            const at = (second: number) => `2026-11-24T00:00:0${second}.000Z`;
            const entries = [
                { runId: 'run', sequence: 1, at: at(1), kind: 'work', toolId: 'read', toolName: 'Read', phase: 'requested' },
                { runId: 'run', sequence: 2, at: at(2), kind: 'reasoning', text: 'Checking the file', truncated: false },
                { runId: 'run', sequence: 3, at: at(2), kind: 'reasoning', text: 'Then reading it', truncated: false },
                { runId: 'run', sequence: 4, at: at(3), kind: 'message', text: '<img src=x onerror=alert(1)>', truncated: false },
                { runId: 'run', sequence: 5, at: at(4), kind: 'work', toolId: 'read', toolName: 'Read', phase: 'completed' }
            ];
            const session = { status: 'recovery-required', messages: [
                { id: 'exact-id', text: '<script>alert(1)</script>',
                    queuedAt: at(0), status: 'delivered', deliveredAt: at(2) },
                { id: 'uncertain-id', text: 'Continue', queuedAt: at(5), status: 'delivering' }
            ] };
            const host = document.querySelector('#work')!;
            const steering = { entries: [{ requestedAt: at(2), request: { kind: 'focus', text: 'Please focus on the result' },
                acknowledgement: { status: 'unsupported' } }] };
            host.append((window as any).DopeWork.renderWorkConversation(undefined, entries, session,
                'Initial <script>instruction</script>', steering));
            const segmented = (window as any).DopeWork.renderWorkConversation(undefined, [
                { runId: 'first', sequence: 1, at: at(1), kind: 'message', text: 'Earlier final', truncated: false },
                { runId: 'second', sequence: 1, at: at(3), kind: 'message', text: 'Later final', truncated: false }
            ], { messages: [], segments: [
                { runId: 'first', startedAt: at(0), prompt: 'First request' },
                { runId: 'second', startedAt: at(2), prompt: 'Second request' }
            ] }, 'First request', undefined, [
                { id: 'first', status: 'completed', startedAt: at(0), endedAt: at(1),
                    reviewDecision: { kind: 'reject' } },
                { id: 'second', status: 'failed', startedAt: at(2), endedAt: at(4),
                    outcome: { code: 'provider-error', summary: 'Provider request failed' } }]);
            const failed = (window as any).DopeWork.renderWorkConversation(undefined, [
                { runId: 'denied', sequence: 1, at: at(1), kind: 'work', toolId: 'tool-1',
                    toolName: 'read_file', phase: 'denied' },
                { runId: 'provider', sequence: 1, at: at(3), kind: 'marker', code: 'run-ended' }
            ], { messages: [], segments: [
                { runId: 'denied', startedAt: at(0), prompt: 'Denied request' },
                { runId: 'provider', startedAt: at(2), prompt: 'Next request' }
            ] }, 'Denied request', undefined, [
                { id: 'denied', status: 'failed', startedAt: at(0), endedAt: at(2),
                    outcome: { code: 'authority-denied', summary: 'Execution authority denied' } },
                { id: 'provider', status: 'failed', startedAt: at(2), endedAt: at(4),
                    outcome: { code: 'provider-error', summary: 'Provider request failed' } }
            ]);
            host.append(segmented);
            host.append(failed);
            const emptyLastSegment = (window as any).DopeWork.renderWorkConversation(undefined, [
                { runId: 'earlier', sequence: 1, at: at(1), kind: 'message', text: 'Earlier answer', truncated: false }
            ], { messages: [], segments: [
                { runId: 'earlier', startedAt: at(0), prompt: 'Earlier request' },
                { runId: 'empty-last', startedAt: at(2), prompt: 'Unanswered request' }
            ] }, 'Earlier request', undefined, [
                { id: 'earlier', status: 'completed', startedAt: at(0), endedAt: at(1) },
                { id: 'empty-last', status: 'cancelled', startedAt: at(2), endedAt: at(4) }
            ]);
            host.append(emptyLastSegment);
            const canceledWithAnswer = (window as any).DopeWork.renderWorkConversation(undefined, [
                { runId: 'canceled', sequence: 1, at: at(1), kind: 'message', text: 'Partial answer', truncated: false }
            ], undefined, 'Request', undefined, [
                { id: 'canceled', status: 'cancelled', startedAt: at(0), endedAt: at(4) }
            ]);
            host.append(canceledWithAnswer);
            const first = host.querySelector('section')!;
            const chatReference = document.createElement('section');
            chatReference.className = 'dope-chat-transcript';
            const referenceAnswer = document.createElement('article');
            referenceAnswer.className = 'dope-chat-message dope-chat-message-assistant';
            const referenceContent = document.createElement('div');
            referenceContent.className = 'dope-chat-message-content dope-chat-final-answer';
            referenceContent.textContent = 'Reference answer';
            referenceAnswer.append(referenceContent);
            const referenceUser = document.createElement('article');
            referenceUser.className = 'dope-chat-message dope-chat-message-user';
            const referenceBubble = document.createElement('div');
            referenceBubble.className = 'dope-chat-message-content';
            referenceBubble.textContent = 'Reference request';
            referenceUser.append(referenceBubble);
            chatReference.append(referenceAnswer, referenceUser); host.append(chatReference);
            const workAnswer = segmented.querySelector<HTMLElement>('.dope-work-final-answer')!;
            const workAnswerContent = workAnswer.querySelector<HTMLElement>('.dope-chat-final-answer')!;
            const workNextUser = segmented.querySelector<HTMLElement>('[aria-label="New Work request"]')!;
            const workBubble = workNextUser.querySelector<HTMLElement>('.dope-chat-message-content')!;
            const style = (element: HTMLElement) => {
                const computed = getComputedStyle(element);
                return [computed.paddingTop, computed.marginTop, computed.borderTopWidth,
                    computed.borderTopColor, computed.borderRadius];
            };
            const infoButton = segmented.querySelector<HTMLButtonElement>('.dope-chat-response-info-button')!;
            infoButton.click();
            return { childText: [...first.children].map(child => child.textContent?.trim()),
                segmentText: [...segmented.children].map(child => child.textContent?.trim()),
                segmentOrder: [...segmented.children].map(child => child.getAttribute('aria-label') ??
                    child.getAttribute('role') ?? child.tagName),
                segmentedActivityOpen: [...segmented.querySelectorAll('details.dope-work-run-activity')]
                    .every(node => (node as HTMLDetailsElement).open),
                firstSegmentActivityText: segmented.querySelector('details.dope-work-run-activity')
                    ?.querySelector('.dope-work-run-activity-body')?.textContent,
                firstActivityText: first.querySelector('.dope-work-run-activity-body')?.textContent,
                userTimes: [...segmented.querySelectorAll('.dope-work-message-user time')]
                    .map(node => node.getAttribute('datetime')),
                answerTimes: [...segmented.querySelectorAll('.dope-chat-response-footer time')]
                    .map(node => node.getAttribute('datetime')),
                copyButtons: segmented.querySelectorAll('[aria-label="Copy Response"]').length,
                infoButtons: segmented.querySelectorAll('.dope-chat-response-info-button').length,
                infoExpanded: infoButton.getAttribute('aria-expanded') === 'true' &&
                    !segmented.querySelector('.dope-chat-response-info')?.hasAttribute('hidden'),
                failedText: [...failed.children].map(child => child.textContent?.trim()),
                failedLabels: [...failed.querySelectorAll('[aria-label]')].map(child => child.getAttribute('aria-label')),
                failedTools: failed.querySelectorAll('.dope-work-tool').length,
                separators: segmented.querySelectorAll('[role=separator]').length,
                failedSystemAnswers: failed.querySelectorAll('.dope-work-system-answer').length,
                emptyLastOrder: [...emptyLastSegment.children].map(child => child.getAttribute('aria-label') ?? child.tagName),
                emptyLastSystemAnswer: emptyLastSegment.querySelector('.dope-work-system-answer')?.textContent,
                canceledAnswerText: [...canceledWithAnswer.querySelectorAll('.dope-work-final-answer')]
                    .map(node => node.textContent),
                canceledSystemAnswers: canceledWithAnswer.querySelectorAll('.dope-work-system-answer').length,
                answerStyle: style(workAnswerContent), referenceAnswerStyle: style(referenceContent),
                bubbleStyle: style(workBubble), referenceBubbleStyle: style(referenceBubble),
                workSegmentGap: workNextUser.getBoundingClientRect().top - workAnswer.getBoundingClientRect().bottom,
                chatMessageGap: referenceUser.getBoundingClientRect().top - referenceAnswer.getBoundingClientRect().bottom,
                systemAnswerColor: getComputedStyle(failed.querySelector<HTMLElement>(
                    '.dope-work-system-answer > .dope-chat-final-answer')!).color,
                unsafeNodes: host.querySelectorAll('img, script, [onerror]').length,
                toolCount: first.querySelectorAll('.dope-work-tool').length,
                toolStatus: first.querySelector('.dope-work-tool')?.getAttribute('data-status'),
                userCount: first.querySelectorAll('.dope-work-message-user').length,
                activityCount: first.querySelectorAll('.dope-work-event').length,
                reasoningCount: first.querySelectorAll('.dope-work-reasoning').length,
                toolDisclosures: first.querySelectorAll('details.dope-work-tool').length,
                reasoningDisclosures: first.querySelectorAll('details.dope-work-reasoning').length,
                call: first.querySelector('.dope-work-tool-call')?.textContent,
                toolSummary: first.querySelector('.dope-work-tool summary')?.textContent };
        });
        assert.equal(result.unsafeNodes, 0);
        assert.match(result.childText[0] ?? '', /Initial <script>instruction<\/script>/);
        assert.match(result.childText[1] ?? '', /<script>alert\(1\)<\/script>Delivered/);
        assert.match(result.firstActivityText ?? '', /Read · Completed.*Checking the file.*Then reading it/s);
        assert.match(result.childText[3] ?? '', /Please focus on the result.*unsupported/s);
        assert.match(result.childText[4] ?? '', /<img src=x onerror=alert\(1\)>/);
        assert.match(result.childText[5] ?? '', /Delivery unconfirmed · recovery required/);
        assert.doesNotMatch(result.childText.join(' '), /Message ID|exact-id|uncertain-id/);
        assert.equal(result.toolCount, 1);
        assert.equal(result.toolStatus, 'completed');
        assert.equal(result.userCount, 4);
        assert.equal(result.activityCount, 0);
        assert.equal(result.reasoningCount, 1);
        assert.equal(result.toolDisclosures, 1);
        assert.equal(result.reasoningDisclosures, 0);
        assert.equal(result.call, 'Read()');
        assert.equal(result.toolSummary, '⚙ Read · Completed');
        assert.equal(result.separators, 0);
        assert.deepEqual(result.answerStyle, result.referenceAnswerStyle);
        assert.deepEqual(result.bubbleStyle, result.referenceBubbleStyle);
        assert.equal(result.workSegmentGap, result.chatMessageGap);
        assert.equal(result.systemAnswerColor, 'rgb(244, 135, 113)');
        assert.equal(result.segmentedActivityOpen, true);
        assert.doesNotMatch(result.firstSegmentActivityText ?? '', /Earlier final|Candidate decision/);
        assert.deepEqual(result.segmentOrder,
            ['Work request', 'DETAILS', 'Coding Agent', 'New Work request', 'DETAILS', 'Coding Agent']);
        assert.deepEqual(result.userTimes, ['2026-11-24T00:00:00.000Z', '2026-11-24T00:00:02.000Z']);
        assert.deepEqual(result.answerTimes, ['2026-11-24T00:00:01.000Z', '2026-11-24T00:00:03.000Z']);
        assert.equal(result.copyButtons, 2);
        assert.equal(result.infoButtons, 2);
        assert.equal(result.infoExpanded, true);
        assert.doesNotMatch(result.segmentText.join(' '), /Run first|Run second|2026-11-24T|Saved outcome/);
        assert.equal(result.failedTools, 1);
        assert.equal(result.failedSystemAnswers, 2);
        assert.equal(result.failedLabels.filter((label: string) => label === 'Coding Agent').length, 2);
        assert.match(result.failedText.join(' '), /Error 2s.*Agent run failed: Execution authority denied.*Agent run failed: Provider request failed/s);
        assert.deepEqual(result.emptyLastOrder,
            ['Work request', 'DETAILS', 'Coding Agent', 'New Work request', 'DETAILS', 'Coding Agent']);
        assert.match(result.emptyLastSystemAnswer ?? '', /Work canceled\./);
        assert.equal(result.canceledSystemAnswers, 1);
        assert.match(result.canceledAnswerText.join(' '), /Partial answer.*Work canceled\./s);
    } finally { await browser.close(); }
});
