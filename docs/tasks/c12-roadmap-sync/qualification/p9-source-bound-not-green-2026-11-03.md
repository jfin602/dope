# P9 integration attempt — NOT GREEN

Date: 2026-11-03 America/Chicago. Local entry HEAD: `b2f1609c40f5a96bf036efb52a365d98b2574f4a`; the working tree was clean at entry. Product version remains `0.12.7`. The owner waived the P6/P7 entry gate for this attempt; their recorded NOT GREEN outcomes remain unchanged. No runner checkpoint commit or P10 qualification was made.

No model/provider default, Work grant, generic shell permission, lockfile, or real owner project was changed. Every filesystem scenario below used disposable temporary roots.

## Source changes and verified scope

- Removed the unreachable schema-2 answer-parsed Gate mutation path from ChatBackend. Plain Chat may return a read-only answer or a checked focus hint; a mutation envelope is rejected. The current protected `/roadmap` native stage and saved proposal path remain the write route. The old response-parsed linked patch branch in ChatBackend was removed.
- Updated current Roadmap and Chat Help labels to describe Phase/Gate pencil editing, automatic linked sync, and the actual Chat title-bar controls. Pencil Save now returns focus to its button after a successful edit. Initial draft copy now describes one confirmed Markdown link and later automatic sync.
- Expanded a disposable tower-defense integration fixture: five Phases and six staged Gates with Criteria; selected Apply persists five Phases, five Gates and five Criteria in one owner revision while one Gate remains a distinct proposed ghost. It verifies first-link Markdown counts and bytes/hash, automatic linked sync, archive revisions, and a reviewed linked restore that reopens with matching source hash and the original counts.
- Updated stale source-assertion tests for the current empty Roadmap actions, historical drag guard, and context bar placement.

The uncommitted product/test diff SHA-256 (excluding this report) is `8fac797f2dfa942595015e6e22ba0a81dff25a2c9bb08e15a08bde3c16ce0b90`. Source SHA-256: ChatBackend `0d814d52bbdbb90a001cd847bd8af521c3bc854c5a504763dd8f4610c7841131`; local Roadmap answer validator `037d869d2dbb977e6aa5b5d032512c9e45af3382cab98749b8591f2d65347394`; canvas widget `2b044f2358bb6eb5d63324241d1cbb1015d64cb85571df2ec6968139c55eef03`. `git diff --check` passed.

## Verification and blockers

- Exact-candidate current native/Markdown/history/restore/Help and import/pool/spatial UI suite: 93/93 passed. The same suite including local-model tests passed 113/114; its sole failure was `ENOTEMPTY` during temporary Chat fixture cleanup. These checks use disposable roots or source assertions; they do not prove a live GUI.
- `npm run typecheck`, exact-candidate Theia extension `tsc --noEmit`, `npm run build:browser`, and `npm run build:electron` passed. Builds do not qualify Chrome or the native Electron GUI.
- `npm run check` stopped at the existing baseline theme palette assertion (12/13 baseline tests passed); the full check therefore did not reach its later stages. The exact-candidate `npm run test:product` run passed 715/721: one stale direct-Work expectation and five `ENOTEMPTY` temporary-directory cleanup races in saved Chat fixtures. Those results do not justify changing unrelated Work behavior or claiming Chat persistence is fully qualified.
- `renderCreate()` still holds the large manual Phase/Gate/Criterion/Correction creation and relationship form. Current canvas pencils edit accepted fields but do not replace all creation and relationship controls. Deleting the form would remove supported manual creation. Initial greenfield strategic creation and draft editing also still parse model text. Native Roadmap staging requires a revisioned owner, so revision-zero creation has no parity replacement. This is the mandatory P9 cleanup blocker, independent of the waived P6/P7 entry gate.

**P9 NOT GREEN.** Keep the form and initial draft path until a same-owner canvas creation/relation workflow and native revision-zero staging are implemented and tested. Re-run the project-wide gate on exact final source, then perform P10 in connected Chrome; verify saved Chat proposal rehydration, active-tab preview/focus, one/selected/all decisions, first link and conflict recovery, keyboard/narrow behavior, historical isolation, and linked reviewed restore. Native Electron GUI remains a separate owner observation. The runner must stop before P10.
