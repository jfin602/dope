# Chat copy and selection: three-cycle qualification

**Date:** 2026-10-28
**Branch:** `codex/c11-chat-copy-selection`
**Base:** `cf24b7ac` on an already dirty working tree
**Verdict:** **NOT GREEN**. This records exactly three primary cycles; no additional cycle is claimed.

## Repair scope

The existing ChatPanel now leaves response text, links, disclosures and code to normal browser selection; empty-area drag and deliberate Space-pan use the existing drag handler. Touch pointers use native vertical scrolling. Each assistant turn has a neutral Copy Response control with a brief success state, and the existing Chat menu has Copy Transcript. Both copy actions project structured user/assistant turns, including readable planning outcomes, without copying inspectable raw planning JSON, diagnostics or message metadata. The panel keeps a single saved Chat and its existing renderer.

Pre-existing edits in `chat-panel-presentation.ts` and `chat-panel-widget.ts`, and other dirty files, were excluded from this repair commit. A disposable eight-message saved Chat fixture was used for browser qualification. It included Markdown, a link, fenced code, a long answer, planning no-action, a failed planning turn with `RAW_FAILURE_SENTINEL`, and model metadata `TRACE_SENTINEL_MODEL`. The fixture was validated with the Chat parser. No real model generation was available in that fixture.

## Cycle 1 — FAIL (qualification incomplete)

Inspected the ChatPanel gesture and rendering paths and implemented selection arbitration, both copy controls, structured copy projections, and focused tests. In Codex Browser, a drag across response text selected `Answer\nItem 1: This line provides enough`; Ctrl+C and a controlled paste returned that selection. Copy Response pasted the full Markdown answer including its fenced code block. Copy Transcript pasted eight speaker-separated turns without the raw planning JSON or model metadata. Empty-area drag moved scrollTop from 286 to 386; wheel moved it from 386 to 1106. The focused ChatPanel tests passed 37/37. The browser controller did not provide a usable held Space+drag gesture, so that required interaction was not qualified.

## Cycle 2 — PASS for the exercised formatting and isolation gate

The first projection omitted the user-facing summary on failed planning turns; repaired it. Rebuilt the browser and reran 37/37 focused ChatPanel tests. Copy Response on a planning no-action turn pasted a readable `No planning action · No change` summary. On the failed turn it pasted the readable failure summary/questions, excluding `RAW_FAILURE_SENTINEL`. Copy Transcript from the expanded-debug fixture pasted 2,356 characters across eight speaker-separated turns, including fenced code, without `RAW_FAILURE_SENTINEL`, `TRACE_SENTINEL_MODEL`, or the raw planning JSON. Dragging across multiline code selected `const answer = 42;\nconsole.log(an`, and Ctrl+C pasted the same text. Clicking a visible copy control left scrollTop at 2688 before and after. The same test fixture contained long messages and enough turns for substantial scrolling.

## Cycle 3 — FAIL (final product qualification incomplete)

Used the actual command palette to open ChatPanel in left, right, center and bottom placements. Right, center and bottom copy/paste checks retained the Markdown heading or fenced code and speaker-separated transcript, with no model or raw debug sentinel; the left placement had been exercised in Cycles 1 and 2. Normal and planning turns used the same ChatPanel path, and the panel was switched between placements. A separate Work transcript renderer reuses the Markdown renderer and message-content class, but its live transcript could not be qualified: the temporary project could not attach a Phase Stack, and the Dope repository had no saved Work runs. Held Space+drag and touch/touchpad scrolling were likewise not performable through the available Codex Browser controls. Mouse selection, empty-area drag, wheel scrolling and actual clipboard paste were observed.

The initial final `npm run check` found one new test failure (672/673 product tests): the copy helper compared two absent message IDs and dereferenced an absent stream. The helper and corresponding response button were guarded. A second run passed that test but the Work dirty-basis test rejected the staged repair, as designed. The repair was then committed, leaving the staging area clear. A third run passed the copy and dirty-basis tests; one unrelated Roadmap Chat test failed during temporary-directory cleanup with `ENOTEMPTY` (672/673 product tests). That test passed when rerun with the focused suite.

## Final verification and limits

Automated result: final typecheck passed; 44/44 focused ChatPanel, presentation, Roadmap Chat context and dirty-basis tests passed; final browser and Electron production builds finished with zero errors. The aggregate `npm run check` did not pass because of the third-run `ENOTEMPTY` cleanup failure. The browser build also passed in Cycle 2 before the final small stream guard. Browser evidence is from the disposable fixture and real clipboard paste, not a mocked clipboard. No independent native Electron GUI qualification, real model-generated Chat, live Work transcript, physical touch, touchpad gesture, or browser-held Space-pan was obtained. Therefore the final gate cannot be marked Green. This report does not change Phase 11 or product version `0.11.8`.
