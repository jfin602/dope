# Pi provider recovery — cycle 2 (2026-10-30)

**Disposition: NOT GREEN for reliable Chat.** Two ordinary local Qwen turns completed in one saved Chat and survived navigation, but the follow-up contradicted the first answer. This cycle made no new product code change; it recovered Chrome control with a fresh tab and used a fresh saved Chat in the disposable fixture. It used the corrected, rebuilt cycle-1 source, not a mock or API substitute.

## Source and validation

- Source HEAD: `3073099d245d492a0ca34f5abd46a3298d2c442a`, dirty with the cycle-1 worker path repair, its test, and recovery evidence. Effective Dope version: `0.12.7`. Pi: `1.4.0`. Browser backend SHA-256: `31df4400001ce62c8c05bc4496f6ba159150b832963e97e364f9064c300f1de3` (same corrected build as the final cycle-1 test).
- AI Center connection `21d03643-2aca-407e-b090-af59979b6c2f` selected model `qwen3-coder-30b-a3b-instruct@q4_k_m` from local LM Studio, endpoint `http://127.0.0.1:1234/v1`, loaded context `32768` (`lms ps`). Neither Pi, model, nor LM Studio was updated.
- No additional defect justified a source edit. The prior failed turn was interrupted when the original Chrome control detached; a new connected Chrome tab and new saved Chat removed that interruption and failed-turn context from this replay.
- `npm run test:pi-runtime`: 8/8 PASS on the corrected source. No new build was needed because source bytes were unchanged after the verified cycle-1 build.

## Real Codex Chrome evidence

At `http://127.0.0.1:3000/#/tmp/dope-p8-ts-1bUVkx`, the same ChatPanel created a fresh saved Chat and explicitly selected `LM Studio · qwen3-coder-30b-a3b-instruct@q4_k_m` for each turn.

| Check | Observation | Result |
| --- | --- | --- |
| First ordinary turn | Asked for a definition of a post-discount shipping threshold. The assistant completed with a local Qwen provenance label and correctly defined it as a threshold checked after promotions. | PASS for transport/completion. |
| Follow-up in same Chat | Asked whether the discount is applied before checking the threshold. The assistant completed from the same local Qwen model, but answered `No` and described a pre-discount threshold, contradicting its first answer. | FAIL for reliable semantic continuity. |
| Saved Chat persistence | Navigated Back / Chats, reopened the same Chat, and both complete turns and model identities remained visible. | PASS. |
| Chat tool safety and source | The Pi no-tool session is enforced by the worker and its regression test; no Work tool or command was visible in Chat. Git showed no tracked source/test change in the fixture; only `.dope/` state was untracked. | PASS within these observations; no network trace was attached. |
| Cancellation | A third turn was started and the UI exposed Cancel. Two accessibility clicks met a rapidly replaced streaming node; by the time a stable locator was tried, the turn had completed. | NOT OBSERVED as a successful cancellation. |
| Offline/reconnect | AI Center remained ready. No new offline transition was induced in this cycle. | NOT OBSERVED. |
| Work broker | No new Work run in this cycle. | NOT OBSERVED. |

The third Chat turn completed from Qwen and explained both shipping policies. It did not repair the contradictory prior turn. The model also referred to a `browser app project` despite the selected disposable checkout fixture; the origin of that wording was not established. No screenshot was exported and no no-egress claim was made.

## Remaining failures

The provider bridge can complete and retain two turns; this does not prove dependable contextual answers. There is no confirmed adapter defect behind the contradictory wording, so no speculative prompt or history rewrite was made. The P8 post-tool Work failure, cancellation, offline recovery, and candidate review still need direct evidence. Cycle 3 proceeds with a fresh disposable coding run and the existing Dope grant/review workflow.
