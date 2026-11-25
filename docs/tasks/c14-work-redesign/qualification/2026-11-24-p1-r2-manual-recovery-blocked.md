# c14 Work redesign P1-R2 manual recovery — BLOCKED

Date: 2026-11-24 America/Chicago (2026-11-25 UTC). Starting HEAD: `d92c6a09b4996afc7023bc7f47e577ed075ccb39` on `main`; product version `0.13.11`. Source is the uncommitted P1 implementation plus the changes described here. The earlier runner record under `.codex-runs/c14-work-redesign/2026-11-24T23-13-11-428Z/` and both earlier BLOCKED reports remain unchanged. No P1 checkpoint commit was made.

## Scope and repair

The owner's [P1-R2 scope amendment](../scope-amendment-2026-11-24.md) defers Interrupt Requested → Paused → Resume and makes whole-turn FIFO delivery acceptable. Forward Work contract, stack README/plan and workflow routing now point to that decision. Authored P1–P4 prompts remain historical and unchanged.

The partial implementation already contained a durable WorkSession ledger, sequential Pi SDK prompts in one worker and candidate workspace, exact message-ID acknowledgment, and explicit Finish. This recovery removed the partial Interrupt/Resume service and status path, made retry of the same message ID/text idempotent across revision races while rejecting changed text, and blocked forged direct-to-Delivered messages in store updates. A new controlled local-model test drives the real supervised Pi worker through the Work adapter: one brokered read is held while the follow-up is queued, then the second prompt receives an exact acknowledgment in the same worker. Its second model request contains the first assistant answer and original user turn. The worker is not released on ordinary turn completion; Finish releases it. The source project is unchanged by the candidate read.

## Verification on this source

- `npm run typecheck` — PASS; affected package builds and Theia extension type check.
- `corepack yarn workspace @dope/theia-extension build` — PASS; refreshed compiled code used by tests.
- `node --test --test-reporter=dot test/unit/pi-runtime.test.mjs test/unit/pi-transport-fault-matrix.test.mjs test/unit/pi-work-execution.test.ts test/unit/pi-work-conversation.test.ts test/unit/agent-store.test.ts test/unit/local-agent-integration.test.ts test/unit/work-restore-recovery.test.ts test/unit/work-integration.test.ts` — PASS after correcting a new test assertion; all focused tests in the command passed.
- `node --test test/unit/pi-work-conversation.test.ts` — PASS; real supervised worker and Work adapter, local HTTP model fixture, brokered tool hold, same-session context and exact acknowledgment.
- `node --test --test-reporter=dot test/unit/agent-store.test.ts` — PASS; includes direct-to-Delivered rejection.
- `npm run check:pi-runtime` — PASS; installed Pi 1.4.0 integrity check.
- `npm run codex:phase:validate -- c14-work-redesign` — PASS; prompt grammar and manual P4 routing.
- `git diff --check` — PASS.

The first focused aggregate failed only because the newly added forged-message assertion expected a transition error while the parser correctly rejected the invalid message order earlier. The assertion was moved to a valid-order direct-to-Delivered case and the focused aggregate then passed. The first attempt at the supervised adapter fixture did not select the approved read tool in its local bridge; after fixing that test setup, the real worker test passed. These were test construction failures, not product qualification receipts.

## Unmet P1 acceptance gates

1. **Restart continuation is not verified or implemented.** Pi still uses `SessionManager.inMemory`. `AgentExecutionRuntime.reconcile()` marks an abandoned running Work session `recovery-required` and interrupts the AgentRun. It does not restore a verified Pi context or candidate checkpoint and provides no deliberate verified continuation path. A Delivering message is correctly held from automatic reinjection, but safe recovery cannot be claimed.
2. **Post-review follow-up is missing.** Finish ends the original AgentRun and releases its workspace. WorkSession becomes terminal `completed`. After Accept/Reject there is no linked new immutable AgentRun segment with the same session identity, a checked new source/candidate basis, and a fresh grant constrained by the original model/tool/sandbox ceiling.
3. **Full runtime/store integration proof is missing.** The real worker/adapter test proves safe whole-turn queueing and context, while store tests prove persistence/transition checks. No single integration test drives the actual Work service and AgentExecutionRuntime through concurrent submissions, restart/lost acknowledgment, Finish validation and review hold, Stop evidence, and later follow-up. Existing general Work regressions do not substitute for that source-bound path.
4. **The exposed P1 API is incomplete.** `startWorkSession`, `submitWorkMessage` and `finishWorkSession` exist for the partial implementation, but they are not a supported P2 lifecycle until the gates above pass. There is no P2 panel or browser claim here.

These are required functional and safety behaviors. **P1-R2 is BLOCKED, not PASS.** Do not create the exact P1 subject or a `PHASE_VERDICT: PASS` body, run P2/P3/P4, or infer product Gate GREEN. `scripts/codex-phase-core.mjs` recognizes only a reachable exact P1 subject and `scripts/codex-phase.mjs` also requires the passing verdict; read-only Git history contains no such subject. A normal `npm run codex:phase -- c14-work-redesign` cannot safely start P2 and would retry P1. Keep the uncommitted partial work for the next recovery pass, with no `.codex-runs` or runner metadata edits.
