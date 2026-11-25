# P1 manual implementation attempt — BLOCKED

Date: 2026-11-24 America/Chicago. Starting HEAD: `d92c6a09b4996afc7023bc7f47e577ed075ccb39`; product version `0.13.11`. This report follows the separate pre-implementation assessment, `2026-11-24-p1-runtime-recovery-blocked.md`. The original runner failure at `.codex-runs/c14-work-redesign/2026-11-24T23-13-11-428Z/` remains untouched. The implementation described here is **uncommitted** and does not qualify P1.

## Implemented and verified in the working tree

- The embedded Pi 1.4.0 worker now accepts sequential Work prompts within one live SDK session. A follow-up carries an exact message ID, and a `message_accepted` event is emitted only after Pi reports that the prompt started. Duplicate IDs are rejected within that worker.
- A Dope-owned `WorkSession` record persists sealed model, tool-selection and sandbox binding hashes, status, ordered message IDs, and Queued/Delivering/Delivered states under `.dope/agent/work-sessions`. Store updates use revision checks and prohibit reversing delivery or altering sealed fields. The new service offers read, submit, interrupt, resume, finish, and start-session calls.
- The Pi Work adapter retains its worker and candidate workspace across ordinary sequential turns. Dope queues messages while a turn runs and schedules them after that turn settles. Interrupt requests become Paused only after the whole Pi prompt and its brokered tools settle. Stop still terminates the host. Finish enters the existing candidate freeze, validation, and guarded review path.
- An actual supervised Pi worker against a controlled local HTTP model returned two turns on the same process with the first turn's messages in the second model request. It emitted the exact second message acknowledgment and rejected reuse of that ID. Store restart tests verified message persistence and monotonic delivery.

## Unmet P1 gates

1. **No live worker control channel during a Pi turn.** `accept()` in `packages/pi-runtime/worker.mjs` still rejects every non-tool-result request while `activeRequest` is true. The service can persist Running messages, but the adapter delivers them only after `host.runWork()` returns. It has not proved delivery at an intermediate Pi boundary or Pi's `steer()`/`followUp()` queue while tool work is active. The current whole-prompt boundary is safe for completed operations, but it does not satisfy the requested worker/host protocol.
2. **No verified restart restoration.** The Pi session still uses `SessionManager.inMemory`. On backend restart, `AgentExecutionRuntime.reconcile()` marks an unfinished Work session `recovery-required` and interrupts the AgentRun. This prevents duplicate message or tool replay, but cannot resume the same Pi context or candidate workspace. A message left Delivering remains uncertain and is not injected automatically; no owner-approved reconciliation path is implemented.
3. **No completed-session follow-up.** Finish releases the Pi host and isolated workspace, and the Work session becomes terminal `completed`. There is no linked new AgentRun segment under the same Work session, or verified new candidate/source basis after review. Completed sessions therefore cannot take the required later follow-up.
4. **Runtime integration proof is incomplete.** The real-worker test proves sequential SDK context and acknowledgment. The full Work adapter/service path lacks a controlled real-worker test of a message submitted during an active tool, Interrupt Requested to Paused, resume, Stop distinction, restart, and candidate review. Existing passing tests do not establish these conditions.

These gates are functional and safety requirements, so a PASS receipt or runner-compatible P1 commit would be false. The partial code must not be treated as permission to start P2.

## Checks executed on this working tree

- `npm run typecheck` — PASS.
- `node --test --test-reporter=dot test/unit/pi-runtime.test.mjs test/unit/pi-transport-fault-matrix.test.mjs test/unit/pi-work-execution.test.ts test/unit/agent-store.test.ts test/unit/local-agent-integration.test.ts test/unit/work-restore-recovery.test.ts test/unit/work-integration.test.ts` — PASS.
- `node --test --test-name-pattern='real embedded Work worker retains' test/unit/pi-transport-fault-matrix.test.mjs` — PASS after correcting the test's OpenAI message-content assertion; real supervised worker and local model fixture.
- `node --test --test-name-pattern='Work session messages survive' test/unit/agent-store.test.ts` — PASS.
- `npm run check:pi-runtime` — PASS; Pi 1.4.0 integrity lock verified.
- `npm run codex:phase:validate -- c14-work-redesign` — PASS; prompt grammar valid, P4 manual.
- `git diff --check` — PASS.

## Runner and disposition

`scripts/codex-phase-core.mjs` detects P1 by its exact reachable Git subject; `scripts/codex-phase.mjs` requires a valid single verdict in the matching commit body. No commit with subject `c14-work-redesign/P1: Durable Work session lifecycle and interventions` exists on current history. No `PHASE_VERDICT: PASS` was written. **P1 is BLOCKED, and `npm run codex:phase -- c14-work-redesign` cannot safely start P2.** The current source changes remain uncommitted for repair; the original report and runner records remain intact.
