# c14 Work redesign P1-R2 manual recovery — PASS for revised P1 runtime

Date: 2026-11-24 America/Chicago (2026-11-25 UTC). Starting source HEAD: `d92c6a09b4996afc7023bc7f47e577ed075ccb39`; product version `0.13.11`, unchanged. The earlier P1 BLOCKED reports and `.codex-runs/c14-work-redesign/2026-11-24T23-13-11-428Z/` remain historical evidence. This report qualifies only the revised P1 runtime, not the P2/P3 presentation and integration or manual P4 browser closeout.

## Owner scope and repair

The [dated scope amendment](../scope-amendment-2026-11-24.md) defers Interrupt Requested → Paused → Resume. Running submissions persist immediately as Queued; the same embedded Pi SDK session takes them in FIFO order after the current whole turn settles. Only an exact Pi message-ID acknowledgment makes a message Delivered. Stop terminates; Finish freezes the accumulated candidate, runs Dope validation and enters guarded review. No partial Interrupt/Resume API remains.

`WorkSession` is the durable conversation owner, with sealed model, permission, tool and sandbox ceiling; ordered message IDs; checked candidate snapshot; and linked immutable AgentRun segments. The live runtime serializes submission, delivery and acknowledgment writes. The worker retains one Pi session and isolated candidate workspace across ordinary turns. A safe turn boundary archives the candidate delta and changed bytes, verified by hash after restart. Finish holds review and rejects further messages. A post-review follow-up requires a new task and grant, original model and ceiling, a checked authoritative source HEAD, and a new isolated candidate. The Work session ID and earlier transcript/run evidence remain linked.

Fresh backend attachment marks an abandoned live session Recovery required and interrupts its run. Pending or Delivering messages remain visible and are never auto-injected. A deliberate continuation must supply the checked source basis and explicitly discard the uncertain candidate effects; it starts a new AgentRun and Pi session without replaying prior messages or tools. The last settled candidate snapshot and old transcript remain available as evidence. This is verified continuation, not process or Pi context restoration.

## Source-bound verification

- `npm run typecheck` — PASS after final permission-ceiling change.
- `corepack yarn workspace @dope/theia-extension build` — PASS after final code change; compiled modules used by tests.
- `node --test test/unit/work-session-runtime.test.ts test/unit/pi-work-conversation.test.ts test/unit/pi-work-execution.test.ts test/unit/pi-work-history.test.ts test/unit/pi-conversation-runtime.test.ts test/unit/pi-runtime.test.mjs test/unit/pi-transport-fault-matrix.test.mjs test/unit/agent-store.test.ts test/unit/work-tool-selection.test.ts test/unit/work-integration.test.ts test/unit/work-start-worktree.test.ts test/unit/work-restore-recovery.test.ts test/unit/work-recovery.test.ts test/unit/work-task-contract.test.ts test/unit/work-mcp-authorization.test.ts test/unit/local-agent-execution.test.ts test/unit/local-agent-tool-contracts.test.ts` — 132/132 PASS. The final permission-ceiling change was followed by a successful typecheck, extension build and targeted rerun; the broader 132-test result preceded that final additive guard.
- `node --test test/unit/work-session-runtime.test.ts test/unit/agent-store.test.ts test/unit/pi-work-conversation.test.ts` — 9/9 PASS on final source. The real supervised Pi worker/adapter test holds a brokered read while the next message waits, proves same-session context, exact acknowledgment and no early worker release. The real backend/runtime/store test proves concurrent same-ID retry without duplicate model turn, FIFO messages, Finish/validation/review hold, linked post-review follow-up, narrower tool ceiling, source mismatch and tool-expansion rejection, restart hold of uncertain delivery, explicit discard, no replay, and Stop evidence. Store tests prove checked candidate bytes and tamper rejection after restart.
- `npm run check:pi-runtime` — PASS; bundled Pi 1.4.0 integrity lock.
- `npm run codex:phase:validate -- c14-work-redesign` — PASS; P1–P3 implementation and manual P4 routing, unchanged `0.13.11`.
- `git diff --check` — PASS before this report was added.

The concurrent submission test initially exposed a real store-lock race. The runtime now orders submissions through its existing per-run serial writer; the final test passes. No historical failure report was altered.

## Limits and handoff

An interrupted turn may have effects after the last settled snapshot; the recovery path requires an explicit discard decision and fresh candidate from a verified source basis. It does not promise restoration of uncertain Pi context, candidate changes, or broker effects. The P1 checks use controlled local-model fixtures and headless services; P2/P3 UI integration and connected-browser qualification remain separate, and no product Roadmap Gate GREEN or phase completion is claimed.

With a truthful exact-subject P1 checkpoint commit and single `PHASE_VERDICT: PASS` body receipt, the runner can recognize P1 as complete and start P2 on the owner's next Run. This report does not authorize running P2 here.
