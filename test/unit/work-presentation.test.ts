import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const widget = await readFile(new URL('../../packages/theia-extension/src/browser/chat-panel-widget.ts', import.meta.url), 'utf8');
const css = await readFile(new URL('../../packages/theia-extension/src/browser/dope.css', import.meta.url), 'utf8');
const tooltip = await readFile(new URL('../../packages/theia-extension/src/browser/dope-tooltip.ts', import.meta.url), 'utf8');
const frontend = await readFile(new URL('../../packages/theia-extension/src/browser/frontend-module.ts', import.meta.url), 'utf8');

test('Select Work retains truthful activity groups in its organized compact rows', () => {
    assert.match(widget, /const groups = workRows\(controller\.tasks, controller\.runs, controller\.phase\.sequences\)/);
    assert.match(widget, /renderWorkList\(\[\.\.\.groups\.running, \.\.\.groups\.history\], rowButton\)/);
    assert.match(widget, /button\.className = 'dope-chat-select dope-work-row'/);
    assert.match(widget, /title\.className = 'dope-work-row-title'; title\.textContent = displayTitle/);
    assert.match(widget, /state\.setAttribute\('aria-label', `\$\{row\.status\}: \$\{row\.activity\}`\)/);
    assert.match(widget, /button\.dataset\.dopeTooltip = workTitlePreview\(displayTitle\)/);
    assert.match(css, /\.dope-tooltip \{/);
    assert.match(widget, /menu\.append\(menuEntry\('Open Work'/);
    assert.match(widget, /menuEntry\('Copy ID'/);
    assert.match(widget, /button\.setAttribute\('aria-current'/);
    assert.match(widget, /cue\.dataset\.color = this\.workList\.color\(rowKey\); cue\.setAttribute\('aria-hidden', 'true'\)/);
    assert.match(css, /button\.dope-work-row:focus-visible|\.dope-chat-panel button:focus-visible/);
    assert.match(widget, /state\.dataset\.status = row\.status/);
});

test('one app-wide tooltip presenter styles title attributes with top-level CSS controls', () => {
    assert.match(frontend, /bind\(FrontendApplicationContribution\)\.toService\(DopeTooltipContribution\)/);
    assert.match(tooltip, /closest\('\[title\], \[data-dope-tooltip\]'\)/);
    assert.match(tooltip, /target\.removeAttribute\('title'\)/);
    assert.match(tooltip, /target\.setAttribute\('title', this\.originalTitle\)/);
    assert.match(tooltip, /setAttribute\('role', 'tooltip'\)/);
    assert.match(css, /:root \{[^}]*--dope-tooltip-background:[^}]*--dope-tooltip-max-width:/s);
    assert.match(css, /\.theia-tooltip \{[^}]*var\(--dope-tooltip-background\)/s);
    assert.match(css, /\.dope-chat-skill-tooltip \{[^}]*var\(--dope-tooltip-background\)/s);
});

test('Prompt Stack discovery preserves folder refresh, invalid warnings, and stored identity', () => {
    assert.match(widget, /root\.value = controller\.phase\.tasksRoot/);
    assert.match(widget, /controller\.phase\.setTasksRoot\(root\.value\); void controller\.scan\(\)/);
    assert.match(widget, /id: stack\.sequenceId \?\? stack\.folderName/);
    assert.match(widget, /controller\.phase\.busy \|\| !stack\.valid && !stack\.sequenceId/);
    assert.match(widget, /stack\.error \?\? 'Invalid Prompt Stack\.'/);
    assert.match(widget, /this\.button\('', \(\) => this\.selectWork\(row\.selection\)\)/);
});

test('Work controls and critical blockers remain visible; verbose evidence is disclosed', () => {
    for (const control of ['Start Work', 'Resume Work', 'Stop', 'View Work conversation', 'Queue message',
        'Finish Work', 'Verify manual gate',
        'Verify checkpoint', 'Reconcile repository', 'Continue with dirty worktree']) {
        assert.ok(widget.includes(`'${control}'`) || widget.includes(`? '${control}'`), control);
    }
    assert.match(widget, /diagnostics\.className = 'dope-work-diagnostics'/);
    assert.match(widget, /provenance\.className = 'dope-work-diagnostics'/);
    assert.match(widget, /files\.className = 'dope-work-diagnostics'/);
    assert.match(widget, /phase\.run\.authorityDecision && !phase\.run\.authorityDecision\.allowed \? 'dope-work-warning'/);
    assert.match(widget, /sequence\.gateMessage\) detail\(sequence\.gateMessage, 'dope-work-warning'\)/);
    assert.doesNotMatch(widget, /Review (?:fixed )?project execution grant|Accept project execution grant/);
    assert.doesNotMatch(widget, /dope-work-grant-accept|Accept this model, selected tools, sandbox permissions/);
    assert.match(widget, /heading\.textContent = 'Tools for this Work'/);
    assert.match(widget, /effective\.textContent = `Effective tools:/);
    assert.match(widget, /start\.disabled = !controller\.canStart/);
    assert.match(widget, /start\.disabled = !phase\.canStart/);
    assert.match(css, /\.dope-chat-composer textarea \{[^}]*resize: none/);
    assert.match(css, /\.dope-chat-panel button:disabled/);
});

test('Prepare Work keeps editable settings above a fixed Chat-style composer', () => {
    assert.match(widget, /this\.composingWork && !this\.panel\.work && !this\.workStartingPrompt \? 'PREPARE WORK'/);
    assert.match(widget, /settings\.className = 'dope-work-prepare-settings'/);
    assert.match(widget, /composer\.className = 'dope-chat-composer dope-work-prepare-composer'/);
    assert.match(widget, /form\.append\(settings, composer\)/);
    assert.match(widget, /controller\.setValidation\(validation\.value, false\)/);
    assert.match(widget, /settings\.append\(\.\.\.\(unavailable \? \[readiness\] : \[\]\), toolSection, validationLabel,/);
    assert.match(widget, /validationLabel\.append\('Validation command \(optional\)', validation\)/);
    assert.match(widget, /toolbar\.append\(more, modelPicker, start\)/);
    assert.match(widget, /menuAction\('Tools for this Work', 'tools', \(\) => toolSection\)/);
    assert.match(widget, /this\.aiCenter\?\.openFromWork\(this\.id\)/);
    assert.match(widget, /codicon\(start\.disabled \? 'circle-slash' : 'arrow-up'\)/);
    assert.match(css, /\.dope-work-prepare-settings \{[^}]*flex: 1;[^}]*overflow: auto/);
    assert.match(css, /\.dope-work-composer > \.dope-work-prepare-composer \{/);
    assert.match(widget, /readiness\.className = 'dope-chat-error-bubble dope-work-prepare-readiness'/);
    assert.match(css, /\.dope-chat-error-bubble \{[^}]*border: 1px solid var\(--theia-errorForeground/);
    assert.match(css, /\.dope-chat-content-work \.dope-work-prepare-readiness button:not\(\.dope-work-primary\) \{[^}]*background: var\(--theia-errorForeground/);
    assert.match(css, /button\.dope-chat-composer-more:not\(\.dope-work-primary\) \{ border: 0; background: transparent; \}/);
    assert.match(css, /button\.dope-work-prepare-submit:disabled \{[^}]*background: transparent; border: 0/);
});

test('sending Work enters the full conversation layout without a separate starting page', () => {
    assert.match(widget, /if \(!work && this\.workStartingPrompt\) \{[\s\S]*?renderWorkConversation\(this\.markdown, \[\], undefined,\s*this\.workStartingPrompt\)/);
    assert.match(widget, /activity\.className = 'dope-chat-stream-activity dope-work-run-activity'/);
    assert.match(widget, /composer\.className = 'dope-work-conversation-composer dope-chat-composer'/);
    assert.doesNotMatch(widget, /region\.setAttribute\('aria-label', 'Starting Work'\)/);
    assert.match(css, /button\.dope-chat-composer-submit:not\(\.dope-work-primary\):hover:not\(:disabled\) \{\s*background: transparent; border-color: transparent;/);
});

test('Work detail uses the P1 projection and preserves guarded controller callbacks', () => {
    assert.match(widget, /const view = controller\.view\(work\)/);
    assert.match(widget, /view\.status/);
    assert.match(widget, /view\.validation/);
    assert.match(widget, /view\.current\.number/);
    assert.match(widget, /view\.qualification|Owner qualification: not recorded/);
    assert.match(widget, /phase\.canStart\);/);
    assert.match(widget, /void phase\.start\(\)/);
    assert.match(widget, /void phase\.stop\(\)/);
    assert.match(widget, /void phase\.continueDirty\(\)/);
    assert.match(widget, /void phase\.checkpoint\(\)/);
    assert.match(widget, /void phase\.reconcile\(\)/);
    assert.match(widget, /void controller\.decideCandidate\('accept'\)/);
    assert.match(widget, /workReviewCanAccept\(run, controller\.selectedTask\)/);
    assert.match(widget, /void controller\.startSelectedWorkItemTask\(\)/);
    assert.match(widget, /controller\.authorizeHostedProjectData\(hosted\.checked\)/);
    assert.match(widget, /this\.panel\.workspace === project && controller\.project === project/);
    assert.match(css, /button\.dope-work-primary/);
});
