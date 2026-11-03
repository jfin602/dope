# P6 recovery qualification — NOT GREEN

Date: 2026-11-02 America/Chicago. Product version: `0.12.7`. Tested committed HEAD: `76ae4005cb9ef58c0f763b9f99dbf8afb9e9b6c9` (P6 `8544824bf956524a92efe76d0e2ce7ab6cf937e6`, followed by P7). The tested product includes an uncommitted correction to `packages/theia-extension/src/browser/roadmap-canvas-widget.ts` (SHA-256 `b87e5832f0d66478f579ae24aaacca69e51ed5462c4dd06e8fec05eb0dd511db`) and an uncommitted semantic-zoom assertion update (SHA-256 `0f909476af5f2e575232bdfeefe13b193887b2de6e4a8ee18d1ed809c07eb042`). Combined product/test diff SHA-256: `c5316d9752630f3f236d3e17ce8d4c37cc06df8f526a3bbf5965690d722b5fba`. Browser bundle SHA-256: `3889b61449b21cf892a812d9ade8f700312df4340e1da33408f96e1df24ad859`. No qualification checkpoint or version commit was made.

The original P6 NOT GREEN statement remains in the P6 commit message. This report does not replace it.

## Connected Chrome observations

In a disposable schema-2 project with four stored revisions and a linked `ROADMAP.md`, the actual Roadmap canvas saved a Phase title, Gate title, multiline Gate purpose, Criterion title, Correction title, and multiline Correction text through their pencil controls. Empty Criterion requirement displayed a nearby required-field alert. Cancel and Escape discarded the typed draft. A nested Criterion Escape initially collapsed the enclosing disclosure and lost focus; the uncommitted correction stops event propagation and returns focus to its pencil. The rebuilt browser replay confirmed that the disclosure stayed expanded and focus returned to `Edit Criterion requirement`.

While a Phase objective draft was open, a separate verified owner transaction advanced the canonical Roadmap from R10 to R11. Save failed with a stale-revision message, and the browser retained the exact typed draft until explicit Cancel. This did not write the stale draft. The narrow 800×600 browser view retained the canvas controls and historical strip; accessible names were present on the observed pencil and toolbar buttons. A screen-reader session and touch interaction were not observed.

The linked Markdown fixture deliberately did not match the serializer's full canonical output, so its visible `conflict` status is fixture provenance, not evidence of a product sync defect. First-time link, import, relink, conflict repair, and crash recovery were not replayed in this browser session.

## Source and regression checks

The canvas's one, Phase-group, selected, and all-remaining proposal controls call the same `nativeProposalBridge` owner as the Chat proposal; focused backend and presentation regressions passed. The exact same-proposal decision sequence was **not** exercised in connected Chrome, so counts, dependency warnings, and applied-only History remain browser evidence gaps.

`node --test` focused P6/P7/semantic-zoom regressions passed 25/25, and adjacent native-stage, proposal, Chat, archive, and store regressions passed 28/28. `npm run typecheck`, `npm run build:browser`, `git diff --check`, and `npm run build:electron` passed on the tested source. The earlier Electron failure was a host setup gap: `libsecret-1.pc` was absent. After the owner installed `libsecret-1-dev`, `pkg-config` resolved libsecret 0.21.4 and Electron built with no application dependency change. The native Electron GUI was not operated.

The former semantic-zoom assertion expected a `displayedCount` string that no longer exists. The updated assertion checks the current requirement: the same `roadmapVisibleGraph` feeds the canvas and implementation summary, with no redundant checkpoint-count narration. It passes without changing product behavior.

## Decision and required recovery

**P6 NOT GREEN.** `renderCreate()` still presents the large manual draft editor, including creation of Phase, Gate, Criterion, and Correction structure, preview/accept, parent attachment, and draft Undo/Redo. Existing canvas pencils edit stored fields but do not replace all of those creation and relationship capabilities. Removing the form now would remove supported functionality. The same-proposal browser decision sequence, first-link and recovery interactions, touch, and screen-reader operation also remain unverified. Finish the canvas replacement and preserve those capabilities, then replay the full P6 matrix on that exact source. Do not treat the P6 commit or this report as a passing prerequisite for P8.
