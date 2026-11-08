# Correction 13 / P5 — manual native editor closeout

**Disposition: NOT GREEN.** Manual connected Codex browser observation on 2026-11-07 America/Chicago (2026-11-08 UTC) found a **FAIL** in case A. Cases B and C are **BLOCKED** by unfinished P3/P4 replacement and native `/prompt-write` R3B. Case D is an **EVIDENCE GAP**. This is a P5 stop receipt, not a Phase 13, Roadmap Gate, Work, or Electron qualification.

## Exact source and test mode

| Item | Observation |
| --- | --- |
| Product HEAD before and after | `0d78dc88dbb97467e1a6abccfbba19845741b931` (`main`); product tree clean at entry. P3 and P4 HEAD subjects are runner markers, while their preserved receipts explicitly say BLOCKED. |
| Product version | Root, browser and Theia extension `0.13.11`; no manifest, internal pin or lockfile change. |
| Served build | Rebuilt from that HEAD with `@dope/theia-extension build` and `@dope/browser build`, both passed; no product source edits. `bundle.js` SHA-256 `a27e808983145f3feee0bcacc4c8d148d091eaa7a266e68f93b5eb5cdffae58f`; `bundle.css` SHA-256 `e449ebeb13b5b223f26d7a322ba256c5244928aab67e854ee119ce3693cbab89`. Both hashes matched fresh HTTP responses on port 3005. |
| GUI | Real connected Codex in-app browser, tab 3, `http://127.0.0.1:3005/#/tmp/dope-c13-native-p5-9gmijC`; normal 1280×720 viewport, dark theme. No independent Chrome or native Electron observation. |
| Model | No Dope model inference was invoked. The recommended `GPT-6 Sol High` configuration was not independently observable from the browser session and is not asserted as a product-test fact. |
| Disposable project | `/tmp/dope-c13-native-p5-9gmijC`, baseline commit `dd0f0f71ceedea0c3895331bab0886c6ccdf93a9`; opened through the Theia File picker. The owner product project was never used as the browser test project. |

I reviewed `BOOT.md`, `AGENTS.md`, `docs/workflow.md`, ADR 0054, the native editor contract, the correction assessment/plan, the preserved `c13-docs-view` P7/P8/P9 receipts and current P1–P4 source and blocked receipts. The older P9 report remains historical evidence for its own exact source, not this build.

## Manual browser cases

| Case | Verdict | Direct result and boundary |
| --- | --- | --- |
| **A — ordinary editors and replacement** | **FAIL** | The normal project Explorer and main editor strip appeared. Double-clicking real `docs/guide.md` opened editable Monaco Source, but there was no Source/Diff/Formatted footer and no formatted view. Opening real `notes/literal.txt` likewise showed no Source/Diff control. The command palette offered **Dope: Open Documents**; executing it opened a separate **Documents** main tab with another **Files / Document files** tree alongside the normal Explorer. This directly violates the replacement contract. No meaningful Diff basis, formatted rendering, save/undo/conflict, narrow/theme/touch or long-scroll qualification followed the failed entry gate. |
| **B — Docs proposal tabs and decisions** | **BLOCKED** | Current Docs card still routes review through `checkedDocumentationHandoff` to `DocumentsWidget.showDocumentationCompare` in `frontend-module.ts`. No user-facing file-link/Open All path calls `ProposalDocumentTabs`. The protected 2–4-file proposal, virtual tab, version/diff, decision, History and negative cases were not run; no approval or application identity exists for this P5 fixture. Prior `c13-docs-view` accept/reject results were not replayed or counted. |
| **C — native Prompt Stack card** | **BLOCKED** | The current `ChatPlanningActivity.kind` union has `documentation-proposal` but no native prompt-stack proposal kind. `/prompt-write` still emits an unpublished JSON draft via `finishedPromptStack`; no originating native card or guarded R3B publisher exists. The Planning Bridge publisher is a separate owner and was not substituted. No prompt files were published or discovered by Work. |
| **D — adjacent interaction** | **EVIDENCE GAP** | Normal Explorer click/double-click and editor-tab switching were observed. Keyboard focus, copy readback, alternate theme, narrow/touch scroll, reload/project-switch timing and Electron parity were not exercised after the failed replacement entry gate. |

### Browser captures and live DOM receipt

- [Markdown editor without document footer](p5-markdown-no-footer.jpg): real `guide.md` in the standard tab strip, no bottom controls. A read-only DOM inspection at this point returned zero `.dope-native-document-modes` and zero `.dope-native-document-formatted` nodes.
- [Text editor without document footer](p5-text-no-footer.jpg): real `literal.txt` in the standard tab strip, no Source/Diff controls. A read-only DOM inspection again returned zero footer nodes.
- [Old Documents viewport still reachable](p5-old-documents-viewport.jpg): the standard Explorer remains at left while the separate `Documents` main tab displays another `Files` tree and `Document files` outline.

The screenshots were captured through the connected Codex browser from the rebuilt port-3005 server. The live failure is stronger than the P1/P2 source-only tests: `NativeDocumentEditorWidgetFactory` is rebound in source, but its footer was absent in the actual opened file tabs. No cause beyond that observed mismatch is claimed here.

## File, approval and test receipts

The disposable project's four tracked files were unchanged before/after GUI observation (`git status` showed only generated, untracked `.dope/` state). SHA-256 at close: `docs/guide.md` `f470ee24a4388e9800b142f512014fb9c9183a166a17ff543b9fae350539eb87`; `docs/other.md` `b5b79e2b70a4030a0d207081f0982cccc59a5d906d506d1975b1dfc91cb4bc0c`; `notes/literal.txt` `6683db7388e84aed91525a987d67a5042427c7a165327964588f1bfb678a3f05`; `src/example.ts` `132b41c634193290389716fea5d6dd61039cf32c537cf6198f4f492d050a8a3a`. No P5 proposal ID, approval ID, application journal, Work grant or Run was created.

After rebuilding the extension, `node --test test/unit/native-doc-editor-modes.test.ts test/unit/native-doc-editor-proposal.test.ts` passed **9/9** on this same product HEAD. These tests include source-text assertions and model/unit checks; they do not establish real Theia widget activation or a user-facing proposal route. No final aggregate was run because the mandatory P3/P4/R3B prerequisites and the live A replacement check failed. `git diff --check` passed. Only this report and three JPEG receipts were added to the product worktree; no Git commit was made.

## Required recovery before another closeout

Complete and source-verify native R3B's retained prompt-stack proposal, originating card and guarded publisher; implement P3 navigation for **both** cards into the actual P2 virtual tabs; verify the P1 widget is used by real `.md`/`.txt` editor tabs; then run P4's integrated safety gate and retire the old Documents presentation outright. A fresh independent browser P5 should follow that final source. Preserve the earlier `c13-docs-view` and Phase 13 reports and their exact-source verdicts. Electron parity remains unobserved.

**Manual stop:** no version change, Git commit, Work Run, grant, Roadmap Gate GREEN or Phase closeout.
