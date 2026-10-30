# P12 Pi Chat continuity — final disposition (2026-10-30)

**P12 PI CHAT CONTINUITY — CHROME QUALIFIED.** All ten bounded Chat gates pass. The final different-Chat replay finished in the Codex in-app browser after the owner directed a switch away from external Chrome, and the owner explicitly accepted Codex browser and Chrome results as interchangeable for this qualification. This is an exact-source Chat disposition, not Phase 12 or Pi Work qualification.

## Exact source and scope

- Product HEAD `2c4c1028f601e8507a8bee418e5b7efe616566de`; product version `0.12.7` unchanged. The uncommitted code diff (`git diff --binary`) SHA-256 is `d62312c00309856348c749db4d3427381ab63226d36fdff0af5e464cfa23239f`. No commit, push, deployment, version bump, reset, stash, or clean occurred.
- Six modified code/test files: `packages/theia-extension/src/node/chat-context-composer.ts`, `packages/theia-extension/src/browser/chat-planning-selection.ts`, `packages/theia-extension/src/node/pi-conversation-runtime.ts`, `test/unit/chat-context-composer.test.ts`, `test/unit/roadmap-chat-panel.test.ts`, and `test/unit/pi-runtime.test.mjs`. The four files in this evidence directory are untracked. The disposable fixture's tracked source is unchanged; its only `git status --short` entry is `?? .dope/` for saved Chat state.
- Bundled Pi `@earendil-works/pi-coding-agent` `1.4.0`; AI Center connection `21d03643-2aca-407e-b090-af59979b6c2f`; exact local LM Studio model `qwen3-coder-30b-a3b-instruct@q4_k_m`. `lms ps` confirmed loaded context `32768`, parallel `4`, local CPU device during qualification. No model, quantization, provider default, or hosted fallback change.
- Final built frontend SHA-256 `e1d2e3e143dba93a037b2c1428bbc76fd12792f013fddcad00be6c094afdf988`; backend SHA-256 `1791163504bd2a95066b064239298db165efe676abcfd3a2af415a441c686f1b`. The running backend was restarted from these bundles after an unexpected test-server stop; subsequent final browser observations used the same source. The opt-in `DOPE_PI_CHAT_CONTEXT_TRACE=1` records only roles, byte lengths, content hashes, and model ID at the Dope→Pi handoff.

## Failure mechanism and repairs

Cycle 1 found **no confirmed missing-history transport defect**. Dope owns the saved Chat and rehydrates an ephemeral, tool-free Pi session for each request. The Copper Lantern/otter Chrome Chat recalled both facts over two follow-ups, but exact live handoff tracing was unavailable then. Qwen added unsupported game speculation.

Cycle 2 found an unconditional ordinary-Chat instruction that encouraged recommendation/planning prose even for factual recall. It now asks for direct factual answers and reserves the approach/word-count preference for advice requests. Navigating to an empty schema-2 Roadmap exposed a separate revision-zero implicit selection that blocked a Chat draft with a stale-context error; the guard now follows only a positive Roadmap revision. The six-turn Rust/Linux conversation, navigation/reopen, explicit cancellation, and next completed turn passed in connected Chrome. One intermediate answer missed the requested one-sentence format; the later question about the “settled” function could refer to either the original or revised signature. Those are model/output consistency limits, not evidence of dropped saved turns.

Cycle 3 added the opt-in redacted Pi handoff trace. For the saved Rust Chat it directly matched the canonical complete prior messages in order, excluded the cancelled assistant, and grew from 17 to 19 to 21 messages across Chat reopening, browser reload, and a Dope-only LM Studio connection disable/re-enable. The local model answered `-5 105`, `max_bound: i32`, and `Rust Linux` after those respective events. This traces Dope's actual handoff to Pi; it is **not** an independent capture of the live LM Studio HTTP body. A deterministic Pi provider-body test separately verifies previous pairs, order, exact model, and absence of tool definitions.

During the two-Chat replay the test backend stopped unexpectedly, then the external Chrome debugger detached during a Copper Lantern request. The request was saved with a failed assistant (`Interrupted before completion`), not a fabricated answer or duplicate. No product-code cause for the server stop or Chrome detachment was established. The owner directed continuation in the Codex in-app browser to reduce external Chrome memory use. There, Copper Lantern/otter and Silver Heron/fox each completed correctly on the same local model. The respective Pi handoff hashes matched only that Chat's saved messages, with no cross-Chat match. The owner accepted the in-app browser result as equivalent for the final browser gate; the interrupted Chrome attempt remains historical evidence.

## Gate results

| Gate | Verdict | Direct evidence and limit |
|---|---|---|
| C1 Initial local Qwen Chat | **PASS** | Fresh Copper Lantern and Rust Chats completed in connected Chrome with exact local model provenance. |
| C2 Prior context delivered | **PASS** | Redacted live Dope→Pi handoff hashes matched saved prior user/complete-assistant messages in order; deterministic provider-body test passed. No independent live LM Studio HTTP capture. |
| C3 Sequential history | **PASS** | Six Rust/Linux Chrome turns completed; 22 saved messages ultimately retained ten complete pairs and one cancelled pair. 17→19→21 message handoff growth had no observed duplicate or recent-turn truncation. No live near-limit compaction claim. |
| C4 Saved Chat reopening | **PASS** | Chrome closed/reopened the single docked ChatPanel; `-5 105` grounded follow-up completed from the same saved Chat. |
| C5 Browser reload | **PASS** | Chrome reload restored transcript/model; `max_bound: i32` follow-up completed and prior messages were in the Pi handoff. |
| C6 Model interruption/reconnection | **PASS, scoped** | Dope AI Center connection disabled showed unavailable/Send disabled, then re-enabled the same model; `Rust Linux` completed without fallback. LM Studio process itself was not stopped. |
| C7 Different Chats isolated | **PASS** | Copper Lantern/otter and Silver Heron/fox completed after alternation in the Codex in-app browser. Each live handoff matched its own saved-message hashes and none from the other Chat. |
| C8 Cancellation recovery | **PASS** | Explicit Chrome cancellation saved `cancelled`; the next same-Chat turn completed. Later interrupted Chrome request saved `failed` and a new in-app-browser follow-up completed. |
| C9 No unauthorized tools/writes/fallback | **PASS, observed scope** | No live Work run or source edit; fixture tracked source unchanged. Pi no-tool test 9/9 suite passed; Chat traces and UI showed local model only. Whole-host network was not inspected. |
| C10 Final implementation in connected browser | **PASS** | External Chrome exercised final-source reopen/reload/connection recovery; the Codex in-app browser completed final two-Chat isolation on the same source. The owner explicitly accepts these browser results as interchangeable. |

## Final checks and remaining limits

After the final in-app-browser replay, four focused Chat/Roadmap tests passed **4/4**, the Pi runtime suite passed **9/9**, typecheck passed, the browser build finished with zero errors, and `git diff --check` passed. The broader composer/context-budget failures recorded in cycle 2 were not repaired or relabeled. The model's unsolicited project/game commentary and one format miss remain visible reliability limits. The live Rust discussion stayed well below the loaded 32,768-token context; no live compaction result is claimed.

The original P12 P8 remains **NOT GREEN**. Pi Work, candidate review, and Work History remain **NOT QUALIFIED**; native AppImage is **PENDING**; overall Phase 12 remains **OPEN**. The next qualification work belongs to those separate P12 scopes under their own owner-approved entry. This Chat disposition does not authorize a Pi Work run or broader P12 closeout.
