# Manual P9 linked Markdown — cycle 2

Date: 2026-10-13. Result: **FAIL initially; repaired Phase 4 label and observed PASS on replay.** A separate historical correction label remained unresolved for cycle 3. No Phase 10 closeout.

## Entry and earliest unresolved check

- Actual product source at entry: `9c3fbc418e8572880f2899a4e84a4196068ae24d`, package `0.10.16`. The cycle-1 source repair was committed; qualification evidence files were untracked work in progress. `yarn.lock`, all manifests/internal pins and absence of root `package-lock.json` were unchanged. Original P16 and c10 P19 remained Not Green; cycle 1’s observed handoff and recovery proof was retained.
- Reused the one Git-backed disposable project after archiving its cycle-1 simple source/index. Copied the actual repository `docs/roadmap/mvp-roadmap.md` and its available supporting closeouts/planning files into that fixture, leaving the main project untouched. Accepted source: 105,194 bytes, SHA-256 `e380d57e0c1ec0b8d84982cb0199450dfd2967d101e4b08ab2ee1f81258800ba`. The actual UI preview reported 31 checkpoints, 75 source files and 7 Not Green entries. Controlled reset affected only disposable `.dope/roadmap.json`.
- Earliest live failure: Phase 4 displayed **Not implemented**, despite the source and `docs/tasks/p4/closeout.md` saying Qualified/Green. The closeout’s first Decision line ends by saying Phase 5 was not activated. The parser classified the whole line with its `not activated` phrase and lost the scoped Qualified/Green decision. See [UI before](evidence/cycle-2-phase4-before.png) and [index before](evidence/cycle-2-full-import-before.json). This was a wrong historical gate label in the actual browser import.

## Repair and replay

Committed source checkpoint `b1d225240b95ebbc88c1b1c6dd722760188c6c96` applies the existing verdict extractor to a closeout evidence line before classifying its status. A focused Phase 4 regression asserts the qualified decision and evidence. Rebuilt `@dope/project-intelligence` and `@dope/browser`; focused roadmap-status-truth, roadmap-import and roadmap-create-sync-integration tests passed **11/11**. No full aggregate was run.

After rebuilding and restarting the real browser backend, a controlled disposable index reset allowed the exact same full source bytes to be reimported and accepted via UI. Phase 4 now displayed **Green** in the new contextual Roadmap UI [screenshot](evidence/cycle-2-phase4-after.png). Owner revision 1 was synced with 31 stable checkpoint records and 75 linked source files [index](evidence/cycle-2-full-import-after.json). Observed labels included Phase 5 Not Green, Phase 6 Owner-closed for sequencing, Phases 7–9 Green, Phase 10 Not Green, Phase 11 Not implemented, and Phase 12 Unknown/read-only. No historical P16/P19 outcome was promoted.

Cycle 2 did not change the actual roadmap Markdown in the main repository. The remaining `c4-color-theme` discrepancy was already visible in the full replay and became the earliest unresolved check for cycle 3.
