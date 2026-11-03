# P7 recovery qualification — NOT GREEN

Date: 2026-11-02 America/Chicago. Product version: `0.12.7`. Tested committed HEAD: `76ae4005cb9ef58c0f763b9f99dbf8afb9e9b6c9` (P7 checkpoint). The tested tree includes the uncommitted P6 keyboard correction and semantic-zoom assertion update identified in the [separate P6 recovery report](p6-recovery-2026-11-02-not-green.md); combined diff SHA-256 `c5316d9752630f3f236d3e17ce8d4c37cc06df8f526a3bbf5965690d722b5fba`, browser bundle SHA-256 `3889b61449b21cf892a812d9ade8f700312df4340e1da33408f96e1df24ad859`. The original [P7 NOT GREEN report](p7-source-bound-not-green.md) is preserved unchanged.

## Connected Chrome observations

Two disposable Roadmap projects were used; the canonical fixture held at least R1–R4 as verified stored snapshots and was advanced through R12 by explicit owner transactions. At R10, actual toolbar Undo displayed R9, then R8; Redo displayed R9, then current R10. The Phase, Gate, Criterion, and Correction content in the inspected snapshots matched the archived data. At R8, Compare with Current produced a structural change line for the Correction. Confirm Restore remained disabled. History mode removed pencil controls and disabled source, details, arrangement, and current proposal actions.

From R11, ten browser Undo activations reached the earliest stored R1. Each selected revision label and Phase/Gate title matched its snapshot. At the R1 boundary Undo was disabled, Redo remained enabled, Confirm Restore was disabled, and no pencils appeared. Keyboard Enter on focused Redo advanced R1→R2. At 800×600, the historical strip and toolbar remained reachable. The exact Criterion contents were checked in the four-revision integration fixture and the selected browser snapshots, but were not rechecked at every R1–R11 browser stop.

While the browser showed historical R10, a concurrent owner transaction created R12. Compare failed closed with `Current Roadmap advanced; refresh the comparison`; Refresh retained R10, changed the current label to R12, and invalidated the stale comparison. Switching projects and reloading returned to current mode. Ordinary Monaco code-editor Ctrl+Z reversed an unsaved edit in `NOTES.md`; the Roadmap toolbar had not intercepted it.

Canonical `.dope/roadmap.json` and linked `ROADMAP.md` bytes remained unchanged by SHA-256 comparison during the R10 Undo/Undo/Redo/Redo sequence and the R11→R1 history sweep. The later R11/R12 canonical changes were deliberate external owner transactions, not navigation. No historical restore was invoked or enabled.

## Source and regression checks

Source inspection confirms `presentChatProposal()` rejects historical preview replacement, the proposal bar hides in history, and proposal camera changes are skipped. The incoming-Chat-proposal case was **not** exercised in connected Chrome. Wrong-owner/bad-hash rejection, retained snapshot gaps, reduced motion, and native GUI behavior likewise have only focused source/integration coverage or remain unobserved in this browser recovery.

Focused `node --test` P6/P7/semantic-zoom regressions passed 25/25, adjacent regressions passed 28/28, and typecheck, browser build, `git diff --check`, and Electron build passed. The prior `libsecret-1.pc` failure was a host setup issue resolved by installing `libsecret-1-dev`; `pkg-config` reports libsecret 0.21.4. The Electron build completed with cached native modules; no independent Electron GUI session was run. The stale semantic-zoom source assertion was updated to check the current shared visible-graph behavior without product changes.

## Decision and runner boundary

**P7 NOT GREEN.** The central historical navigation and no-write browser sequence passed, but the required incoming Chat proposal isolation and full source-owner/corruption interaction matrix were not demonstrated in connected Chrome. P6 is separately NOT GREEN, so P8 must not start. Read-only completed-prefix inspection finds that the runner counts the P6 and P7 commit subjects and reports seven completed prompts with P8 next; this is a commit-history inference, not qualification. No PASS marker or recovery checkpoint was created. Resume only after both stages have source-bound GREEN evidence and the runner entry has been reconciled with that evidence; keep Confirm Restore disabled until the reviewed P8 implementation.
