# M2 Chat transcript polish — PARTIAL / NOT GREEN

**Basis:** `main` HEAD `7f1c3e30`, product version `0.12.7`. The owner explicitly superseded M1's progression gap for this M2 run. M1's original NOT GREEN report remains unchanged. M2 changes are uncommitted; no runner, Qwen inference, model setting change, or real owner workspace write occurred.

## Implementation

- Removed the separate assistant `Tool calls (N)` block and its exclusive CSS. The activity timeline remains the one visible tool trace. Durable broker receipts missing from a recovered stream are included once, after captured activity; their relative timing against reasoning cannot be reconstructed.
- Ordered assistant children as activity, final content, one Roadmap card, optional response info, and footer last. Response info opens above Copy/Info/time. The review card uses actual operation statuses for applied/rejected/pending counts and labels mixed outcomes `Partially applied`; Roadmap totals and warnings live under Details. Terminal successful cards omit an obsolete pending-review diagnostic.
- Preserved saved `execution.toolEvents`, metadata, original proposal JSON in optional info, copy with reasoning, Roadmap decision authority, source checks, and version.

## Verification

- Final `npm run build:browser`: PASS. Final local bundle SHA-256 `faa8fd2192cd1e45d4ae015f4d8d1a2a687a6a15d008acc2af1853d959cf7e4e`.
- Focused Chat presentation/activity/repository, Roadmap proposal, and source-bound apply/sync suites: **95/95 PASS**. `git diff --check`: PASS.
- Connected Codex Browser observed the previous exact served bundle `29f4a51abe726d027767929e93d6847cd26867fd76680976042f27f3daa0d547` with disposable saved Chat fixtures. Narrow and expanded Chat screenshots in this task's browser transcript show a compact actual reviewed result with one applied Gate operation and one rejected Gate operation. The fixture used real `roadmap_stage`, checked Apply and Reject, and linked Markdown; source bytes were unchanged on stage/reject and only the accepted Gate appeared after Apply. DOM inspection showed no separate tool list, one ordered tool stream, and a footer as the last child with Info open. Saved normal, no-reasoning tool-only, and failed tool turns survived reload. Keyboard Info toggle and the right-click Copy with Reasoning menu worked.

## Remaining qualification gaps

The final bundle was built after the browser pass to cover a partial recovered tool stream, so that exact bundle has **source tests but no connected-browser replay**. Browser cancelled/stale/pending live proposal cases, alternate theme, reduced motion, and live checked M1 canvas controls were not observed. Browser clipboard readback of Copy with Reasoning returned no text despite the UI's copied feedback, so clipboard contents are unverified. Independent Electron GUI remains unobserved. M2 is therefore **PARTIAL / NOT GREEN**; do not start M3 or claim broader Roadmap/Phase 12 qualification from this report.
