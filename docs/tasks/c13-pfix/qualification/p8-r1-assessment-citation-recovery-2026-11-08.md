# c13-pfix P8-R1 — assessment citation and failure recovery, 2026-11-08

**Disposition: PASS for this headless correction.** This does not change the P8 **NOT GREEN** result or qualify the real-model authoring chain. Product version remains `0.13.11`; no Phase 13, Work, Roadmap, or canonical prompt publication occurred.

## Exact source

- Entry HEAD: `47d17b150d720c18a577a357f7e2525d51632281`, clean.
- Final verified product/test HEAD: `0524674964356be5cc28e5a203ac4d82c2101961` (`c13-pfix/P8-R1: Resolve assessment citations from brokered reads and persist diagnostics`). The report is a separate documentation commit; its final commit is recorded in the task handoff.
- Read BOOT, AGENTS, workflow, ADR 0056, the named-chain contract and P8 report. Inspected the P1–P7 source, P8 card correction, and the saved P8 fixture at `/tmp/dope-pfix-p8-clamp-lks2pI`.

## Original failure cause

The saved connected-browser run had five successful `read_file` calls and five file source refs. The first `src/clamp.js` read covered bytes `0–298` and carried source identity `cbf7b0f869f07dc1835ac5a09706b9b5e7184ae1d5e4c385c02d8ffd45d44431`. The model's first citation set `start:0,end:298` on a 130-byte quote. More decisively, its quote contained literal backslash-plus-`n` characters where the read source contained a newline. The quote was **not** in the brokered bytes. The other five model quotes were present in their cited fixture files, but each used the whole read range instead of the quotation range. The model also returned `tiers` as an array, contrary to the required object; that would have caused a later validation failure. The observed denial was therefore correct. The model-facing transport metadata contract made valid citations unnecessarily hard and did not prevent this fabricated quote.

Before: every model finding required `{claim,path,start,end,sourceHash,quote}`. After: the model supplies `{claim,path,quote}` and an object with `T1`, `T2`, `T3` strings. Dope searches only successful brokered `read_file` bytes for an exact UTF-8 quote, requires one distinct observed occurrence, checks its page against the saved tool ref and full-file source identity, and writes the computed byte offsets and source hash into the authoritative Assessment record. A repeated quote needs a longer unique excerpt. Listed/searched-only files, unobserved portions of truncated pages, wrong paths or hashes, and ambiguous matches remain denied. The existing pre-validation `verifyPromptSourceRefs` checks current file identity and source drift; it is unchanged. The hash is the broker's project/path-bound identity derived from the full-file SHA-256, rather than a hash of the excerpt.

The saved P8 first quote is still denied under the repaired contract. A corrected exact quote from that same read is accepted with Dope-computed offsets and source identity. This tests the original failure without changing its fixture into an unrelated example. No second citation system or metadata-producing model call was added.

## Durable failure and presentation

The failed-turn branch previously assigned `diagnostic = undefined`, reducing assessment validation failures to `Conversation failed`. It now maps `ASSESSMENT_*` validation codes to bounded, fixed, recovery-oriented text in the existing `execution.failure`. It does not save raw model output, source excerpts, paths, tokens, stack traces, or provider payload. Cancellation, storage, runtime and ordinary provider failures retain their separate existing handling. The existing `currentPromptDraft` projection reads that saved failure and associates it with the owner-named Assessment stage after a fresh backend read. No diagnostics store or second card was added.

The P8 card position is unchanged: inside the originating assistant response, above Copy/details/date. The presentation regression asserts that the saved card anchors there and the duplicate error bubble is removed. The previous connected-browser P8 report verified that placement live; this headless correction did not repeat a browser observation.

## Focused verification

- `corepack yarn workspace @dope/theia-extension build`: passed.
- `node --test test/unit/prompt-authoring-stage.test.ts test/unit/chat-backend.test.ts test/unit/chat-presentation.test.ts`: **60/60 passed**. Covers ASCII and multibyte UTF-8 offsets, first and late pages, multiple files, source identity, unobserved/ambiguous quotes, wrong path/hash, P8 citation reproduction, persisted failed Assessment and backend restart, named identity, protected publication, and card placement.
- `node --test test/unit/chat-repository.test.ts test/unit/prompt-draft-store.test.ts test/unit/chat-panel.test.ts`: **71/71 passed**. Covers saved execution and draft recovery, owner/source/lease guards, and Chat presentation.
- `git diff --check`: passed.
- The fixture produced no validated Assessment, canonical task files, Work Run, or Roadmap effect in the failure integration test. The existing Plan/Write and protected publisher integration test passed unchanged in behavior.

## Remaining independent qualification

No live GPT-OSS retry, browser interaction, native Electron observation, successful ten-step Plan/Write, or final proposal publication was performed here. P8 remains NOT GREEN; P8-R1's PASS is limited to this repaired headless boundary. A separately initiated real-model connected-browser qualification must verify the updated schema end to end, including the model's `tiers` object, content quality, restart presentation, and downstream stages. Historical P6/R2 NOT GREEN, R3B PARTIAL, and other Phase 13 gates retain their recorded status.
