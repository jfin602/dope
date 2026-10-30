# Pi Chat continuity recovery — cycle 3 (2026-10-30)

**Status: PASS under the owner's connected-browser equivalence decision; final disposition in `final-disposition.md`.** This cycle keeps the cycle-2 context and empty-Roadmap repairs and adds one opt-in, content-redacted trace at the exact Pi Chat handoff. No new conversation store or provider route was added.

## Source and environment

- HEAD `2c4c1028f601e8507a8bee418e5b7efe616566de`, with uncommitted recovery source/tests/evidence only; product version `0.12.7`. Final code diff SHA-256 `d62312c00309856348c749db4d3427381ab63226d36fdff0af5e464cfa23239f`; the six modified code/test files and this evidence directory are the only Dope worktree changes. The disposable fixture has only untracked `.dope/` Chat state; tracked fixture source is unchanged.
- Bundled Pi `1.4.0`; pinned Dope connection `21d03643-2aca-407e-b090-af59979b6c2f`; LM Studio `qwen3-coder-30b-a3b-instruct@q4_k_m`, loaded 32768-token context, CPU, parallel 4. No model or quantization change.
- Running rebuilt Chrome/backend bundle SHA-256: frontend `e1d2e3e143dba93a037b2c1428bbc76fd12792f013fddcad00be6c094afdf988`; backend `1791163504bd2a95066b064239298db165efe676abcfd3a2af415a441c686f1b`. Server was started with `DOPE_PI_CHAT_CONTEXT_TRACE=1`; absent that flag, no trace is written. The trace logs only message roles, byte counts, content SHA-256 and model ID, without prompt content or credentials.

## Actual Pi handoff evidence

For saved Rust Chat `71ebe017-e50f-41e4-8204-49fae79efd80`, the first final-source request after closing/reopening Chat logged 17 handoff messages: one system instruction, 15 matching saved prior user/complete-assistant messages, and the current user message with automatic context. A read-only comparison against the canonical saved Chat matched 15 of 16 prior message hashes. The unmatched entry was the cancelled assistant; its hash was absent from the Pi handoff. The trace preserved chronological user/assistant ordering and exact selected local model ID. This is direct evidence for the request Dope handed to Pi, while the separate synthetic fetch test establishes the Pi worker's provider-body mapping. It is not an independent network capture of the live LM Studio HTTP body.

The next request after browser reload logged 19 messages and 4,350 total message bytes at the same handoff. The initial 17-message trace was about 1,500 of 8,192 estimated Chat input tokens in the UI. The conversation did not approach the 32,768-token loaded model limit; no compaction or near-limit truncation is claimed.

## Connected Chrome scenarios

### A. Saved Chat reopening

The Chat sidebar was closed, visually absent, then reopened. The only existing docked ChatPanel returned to its saved Chat list; the Rust Chat reopened with all prior ordered messages, including the cancelled entry. The follow-up asked for the original two numerical edge-case inputs and completed as `-5 105` with exact local model provenance. The direct Pi trace above includes the saved history and excludes the cancelled assistant.

### B. Browser reload

The actual connected Chrome tab was reloaded. The Rust Chat reappeared with its saved transcript and pinned exact local model. A follow-up asking for the later extra parameter completed as `max_bound: i32`, with exact local provenance. The next Pi trace grew to 19 ordered messages, including prior completed pairs. No duplicate messages appeared after reload.

### C. Model connection interruption/recovery

Only the Dope AI Center LM Studio connection was temporarily disabled; LM Studio itself was left running so unrelated clients were not interrupted. Chrome showed `Health: disabled`, `Lifecycle: disabled`, `Selected model unavailable`, and a disabled Send button while the saved Chat remained visible. The same connection was enabled again; Chrome showed `ready · 1 usable model` and the original pinned model returned without fallback. `Which language and platform did we choose for the function? Answer with those two terms only.` completed as `Rust Linux` with exact local provenance. Its Pi handoff trace contained 21 ordered messages and 4,494 message bytes, including the saved history. This proves a Dope-connection interruption, not a stopped LM Studio process.

### D. Different saved Chats

Chrome created a second saved Chat, `fdde1a38-97f5-4d3d-8ed3-77945b1e84bb`, with conflicting fictional facts: Silver Heron/fox versus the existing `ad7cd24d-012e-412f-9739-14d360e1cf0d` Copper Lantern/otter Chat. The first Silver Heron turn completed on the exact local model and acknowledged both facts, but added unsolicited project commentary.

The test backend stopped during the final-check interval, leaving Chrome briefly `Offline`; no cause is assigned to product code. It was restarted from the same bundle hashes. A subsequent Copper Lantern request in Chrome did not complete when the Chrome debugger detached. On reopening in the Codex in-app browser, Dope had saved its user turn and marked the assistant `failed · Interrupted before completion` rather than presenting a fabricated completion or duplicate. The interrupted Chrome attempt remains recorded; the owner subsequently accepted the Codex in-app browser result as equivalent for this qualification.

The owner then explicitly directed use of the Codex in-app browser to avoid external Chrome memory pressure. In that browser, a fresh Copper Lantern follow-up completed as `Copper Lantern otter mascot`, exact local provenance. The corresponding Pi handoff trace contained six complete saved Copper messages, the earlier failed user turn, and the current user turn in chronological order; it excluded the failed assistant and matched no Silver Heron message hash. After switching to the Silver Heron saved Chat, its follow-up completed: `The fictional project name is Silver Heron, and its mascot is a fox.`, again with exact local provenance. Its Pi handoff trace contained only the Silver Heron user/assistant pair and current user turn, with no Copper Lantern message hash. This is direct isolation evidence at Dope's Pi handoff in the in-app browser. No independent live LM Studio HTTP capture is claimed.

### E. Longer conversation and context growth

The Rust Chat contains 22 ordered saved messages: ten complete user/assistant pairs and one cancelled pair. Requests grew from 17 to 19 to 21 handoff messages across reopen, reload, and connection recovery. The relevant recent design and edge-case decisions remained available. Its handoff remained far below the 32,768-token loaded model context and did not trigger compaction; synthetic near-limit compaction is tested separately by the focused Pi suite and is not claimed as live-browser behavior.

### F. No-tool/source safety

The final `npm run test:pi-runtime` passed 9/9, including the no-tool provider-body assertion and a tool-call-like output denial. The disposable fixture's tracked source stayed unchanged (`git status --short` only `?? .dope/`). No live Work run, candidate review, source edit, hosted fallback, or second ChatPanel was observed. The trace flag is opt-in; its persisted records contain roles, byte lengths, SHA-256 and model ID, not conversation text or credentials.

## Final focused checks

After the in-app-browser isolation replay, four focused Chat/Roadmap tests passed 4/4, `npm run test:pi-runtime` passed 9/9, `npm run typecheck` passed, and the browser build finished with zero errors. `git diff --check` passed. The resulting frontend/backend hashes match the running source hashes above. The original broader composer/context-budget failures noted in cycle 2 were not rerun or relabeled as passing. No full project suite or Pi Work qualification was run.
