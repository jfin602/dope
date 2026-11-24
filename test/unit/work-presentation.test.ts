import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const widget = await readFile(new URL('../../packages/theia-extension/src/browser/chat-panel-widget.ts', import.meta.url), 'utf8');
const css = await readFile(new URL('../../packages/theia-extension/src/browser/dope.css', import.meta.url), 'utf8');
const tooltip = await readFile(new URL('../../packages/theia-extension/src/browser/dope-tooltip.ts', import.meta.url), 'utf8');
const frontend = await readFile(new URL('../../packages/theia-extension/src/browser/frontend-module.ts', import.meta.url), 'utf8');

test('Select Work has distinct truthful groups and compact accessible row anatomy', () => {
    assert.match(widget, /const groups = workRows\(controller\.tasks, controller\.runs, controller\.phase\.sequences\)/);
    assert.match(widget, /\['Running', groups\.running\]/);
    assert.match(widget, /\['History', groups\.history\]/);
    assert.match(widget, /label\.textContent = 'Prompt Stacks'/);
    assert.match(widget, /button\.className = 'dope-work-row'/);
    assert.match(widget, /title\.className = 'dope-work-row-title'; title\.textContent = row\.title/);
    assert.match(widget, /meta\.className = 'dope-work-row-meta'/);
    assert.match(widget, /meta\.append\(time, state\)/);
    assert.match(widget, /state\.dataset\.dopeTooltip = row\.activity/);
    assert.match(widget, /button\.dataset\.dopeTooltip = workTitlePreview\(row\.fullTitle/);
    assert.match(css, /\.dope-tooltip \{/);
    assert.match(widget, /menu\.append\(menuEntry\('Open Work'/);
    assert.match(widget, /menuEntry\('Copy ID'/);
    assert.match(css, /dope-work-status-pill\[data-status="completed"\]/);
    assert.match(css, /dope-work-status-pill:is\(\[data-status="failed"\]/);
    assert.match(widget, /progress\.textContent = row\.stack/);
    assert.match(widget, /button\.setAttribute\('aria-current'/);
    assert.match(widget, /cue\.setAttribute\('aria-hidden', 'true'\)/);
    assert.match(css, /button\.dope-work-row:focus-visible|\.dope-chat-panel button:focus-visible/);
    assert.match(css, /button\.dope-work-row\[aria-current="true"\]/);
    assert.match(css, /dope-work-row\[data-status="running"\]/);
    assert.match(css, /data-status="blocked"/);
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
    for (const control of ['Start', 'Resume', 'Stop', 'Open Transcript', 'Verify manual gate',
        'Verify checkpoint', 'Reconcile repository', 'Continue with dirty worktree']) {
        assert.ok(widget.includes(`'${control}'`) || widget.includes(`? '${control}'`), control);
    }
    assert.match(widget, /diagnostics\.className = 'dope-work-diagnostics'/);
    assert.match(widget, /provenance\.className = 'dope-work-diagnostics'/);
    assert.match(widget, /files\.className = 'dope-work-diagnostics'/);
    assert.match(widget, /phase\.run\.authorityDecision && !phase\.run\.authorityDecision\.allowed \? 'dope-work-warning'/);
    assert.match(widget, /sequence\.gateMessage\) detail\(sequence\.gateMessage, 'dope-work-warning'\)/);
    assert.match(widget, /acceptLabel\.append\(accept, ' Accept project execution grant'\)/);
    assert.match(widget, /start\.disabled = !controller\.canStart/);
    assert.match(widget, /start\.disabled = !phase\.canStart/);
    assert.match(css, /\.dope-work-composer textarea \{[^}]*resize: none/);
    assert.match(css, /\.dope-chat-panel button:disabled/);
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
