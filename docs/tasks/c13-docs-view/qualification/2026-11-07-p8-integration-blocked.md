# P8 Documents cross-boundary integration — blocked

**Disposition: BLOCKED / NOT GREEN.** Pre-task and final inspected HEAD: `a3572eb9fd0b40f527ffd9ccad19253878e1dd88`. Product package version: `0.13.11` throughout. No commit, Work Run, grant, Roadmap Gate decision, or P9 browser qualification was made.

## Source and dirty basis

P1–P6 committed the Documents shell, filtered tree, safe preview, native editor entry, complete Docs compare projection, and shared Chat/viewport review. P7 committed only [its dependency finding](2026-11-07-p7-r3b-dependency-blocked.md). The execution began with intentional uncommitted edits in `test/unit/documents-workspace.test.ts` and `test/unit/planning-stack-publication.test.ts`; both were retained. The latter fixture's no-checkout clone needed an initialized sparse worktree for bounded Git evidence. I removed only its temporary console diagnostic.

Source inspection confirmed that `finishedPromptStack` still saves the R3A stack in assistant text. No native pending prompt-stack proposal, Chat decision interface, or distinct R3B publisher exists. The older Planning Bridge publisher requires its own linked Planning Map and approvals, so it cannot stand in for R3B. Consequently P7's draft review, separate guarded publication, and saved/published stack integration cannot be qualified here.

## Integration repair

`DocumentsWidget.refreshReview()` now marks a displayed compare historical and disables approval when the originating Chat owner no longer has that exact pending proposal. Previously the viewport could keep showing **Pending** after Chat applied or rejected it. The change waits through an active decision and retains the read-only diff.

## Bounded verification

Commands, in order:

1. `corepack yarn workspace @dope/chat build && corepack yarn workspace @dope/theia-extension build` — passed; Chat was rebuilt because P6 changed its source.
2. `node --test test/unit/documents-*.test.ts test/unit/chat-panel.test.ts test/unit/documentation-review.test.ts test/unit/documentation-application.test.ts test/unit/phase-stack-ui.test.ts test/unit/planning-stack-publication.test.ts test/unit/roadmap-chat-panel.test.ts test/unit/roadmap-task-discovery.test.ts` — passed before the repair.
3. `corepack yarn workspace @dope/theia-extension build` — passed after the repair.
4. The same focused `node --test` command — passed on final source: **12 test files, 12 passed, 0 failed, 0 skipped** (Node `v24.21.0`). `git diff --check` passed.

The focused source tests cover filtered tree and keyboard structure; Markdown/text preview; native edit and external conflict guards; multi-file original/proposed/source diff; exact Docs proposal handoff, review, application, stale and unsafe paths, partial recovery, applied-only History; existing Planning Bridge publication safeguards; Chat and Roadmap presentation; and Work stack discovery. The source repair is build verified, with rendered behavior reserved for P9. No `npm run check`, aggregate `npm test`, packaging, or browser run was used.

## Remaining gate

Native R3B must first provide the saved pending prompt-stack proposal, originating Chat card/decision authority, and separate guarded publisher. Then P7 and the prompt-stack portion of P8 need source-bound rerun, including draft/published file browsing, P ordering, digest/project/source guards, restart and duplicate decisions, and no automatic Work/Grant/Gate effect. P9 remains a separate manual connected-browser gate and is not entered on this result.
