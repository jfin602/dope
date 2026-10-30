# Pi Chat continuity recovery — cycle 2 (2026-10-30)

**Status: bounded multi-turn PASS; exact live Pi handoff remains an evidence gap.** This cycle did not reproduce the earlier content contradiction. It found a direct-answer prompt issue and an empty-Roadmap selection defect during navigation. Neither was evidence that Dope had dropped saved Chat turns.

## Source and environment

- HEAD `2c4c1028f601e8507a8bee418e5b7efe616566de`; uncommitted changes are `chat-context-composer.ts`, `chat-planning-selection.ts`, and their focused tests `chat-context-composer.test.ts`, `roadmap-chat-panel.test.ts`, `pi-runtime.test.mjs`, plus this recovery evidence. No owner files were reset or committed. Source diff SHA-256 at the final browser build: `19956a6c6ef46e84099721a2591f56a191c8f736a2f8b2f71872091c43a32a28`. Product version `0.12.7`.
- Bundled Pi `1.4.0`; selected connection `21d03643-2aca-407e-b090-af59979b6c2f`, exact local `qwen3-coder-30b-a3b-instruct@q4_k_m`, loaded LM Studio context `32768`, CPU, parallel `4`. No hosted routing or quantization change.
- Final cycle-2 browser build: backend `4081c856ddd6802e933a99cfb7c56f47745cd2298418575105b312ca26ce3301`, frontend `e1d2e3e143dba93a037b2c1428bbc76fd12792f013fddcad00be6c094afdf988` (SHA-256 of local bundles). Backend restarted and Chrome loaded this frontend for the cancellation and repaired-navigation check.

## Diagnosis and changes

- A fresh pre-repair Rust/Linux Chat answered an explicit one-sentence acknowledgment with a multi-sentence implementation plan. The universal ordinary-Chat instruction previously requested a recommendation, ordered approach and deliverable even for simple factual or recall questions. The instruction now directs a direct factual answer and reserves a practical approach and 100–170-word soft preference for advice requests. It retains the established source-truth and software-planning instructions.
- Saved Chat `71ebe017-e50f-41e4-8204-49fae79efd80` was used for six sequential turns. A read-only composer replay before turn 3 yielded prior user/assistant pairs in chronological order, then the current user turn, at about 355 of 8192 estimated input tokens before automatic grounding. The deterministic Pi request test was expanded to assert two prior pairs, correct role/content order, exact model identity and no tool definitions. This is provider-body evidence in a synthetic fetch, not a capture of this live LM Studio request.
- After navigating to the empty schema-2 Roadmap and reopening the Chat, submission failed with `Stale or foreign Roadmap context; select it again`. The Roadmap canvas showed `No Roadmap yet`; its revision-zero index nevertheless became an implicit active Chat selection, which the backend correctly rejected. `ChatPlanningSelection` now follows a schema-2 Roadmap only after revision is positive. The empty-Roadmap regression test passes. The rebuilt Chrome UI then showed `Following active selection: none` for the same saved Chat, so the guard fixed the observed navigation failure without weakening the backend owner check.

## Connected Chrome observations

1. Established Rust, Linux, concise explanations and `clamp_score` bounds 0–100. Qwen acknowledged the facts but used two sentences despite the one-sentence request; this was an intermediate prompt build and remains a model-format miss.
2. Asked for minimal design: `fn clamp_score(score: i32) -> i32 { score.clamp(0, 100) }` and negative-edge test. Complete, local provenance.
3. Requested upper-edge revision: same signature and implementation; tests `-5 → 0` and `105 → 100`. Complete, local provenance.
4. Asked original language/platform: `Rust Linux`. Complete, local provenance.
5. Asked earlier design summary: built-in `clamp`, bounds 0–100, both lower and upper edge cases. Complete, local provenance.
6. Returned to original function for configurable bound: `fn clamp_score(score: i32, max_bound: i32) -> i32 { score.clamp(0, max_bound) }`, test `150` with bound `100` returns `100`; Linux named. Complete, local provenance.

The same saved Chat showed 12 ordered complete messages after navigating away to Roadmap and reopening. The empty-Roadmap defect blocked one *additional* draft turn before repair; it did not append a user or assistant message. After the final browser rebuild and restart, the existing Chat reopened with all 12 messages. AI Center first reported model readiness unknown; `Refresh Models` restored the same local model and pinned Chat selection without fallback. A long seventh turn was submitted and cancelled in Chrome: one user message and one assistant message with `cancelled` status were saved, with no completed answer. A normal follow-up then completed in the same Chat, yielding 16 ordered saved messages.

## Focused checks and limits

- Final targeted tests: four direct-answer/planning/empty-Roadmap cases passed; Pi runtime 9/9 passed; extension and browser builds succeeded. Existing backend Chat ownership/restart focused cases passed 3/3 earlier in the cycle.
- A broader composer run passed 15/18. One automatic-reference hash test expected a source excerpt that the current small budget omitted. Two initially failed because condensed prompt wording omitted established phrases; the phrases were restored and their targeted tests passed. A separate grounded-turn batch had six budget failures. These budget fixtures were not counted as Chat qualification passes and were not changed to fit the implementation.
- The live Pi/LM Studio request body was not recorded; correct history delivery is supported by source tracing, read-only composition, synthetic provider-body capture and Chrome responses, but remains an exact-request evidence gap for this cycle.

## Post-cancellation follow-up

`After that cancellation, which Rust function and implementation choice did we settle on? Answer in one sentence.` → `We settled on using Rust's built-in clamp method with the signature fn clamp_score(score: i32) -> i32 { score.clamp(0, 100) } for its clean, efficient implementation.` Chrome marked the turn complete with the exact pinned local model. The answer recalled the original signature rather than the later configurable-bound revision; the question was ambiguous about which choice was final, so this is not evidence of a lost turn. The cancelled answer was not treated as completed history.
