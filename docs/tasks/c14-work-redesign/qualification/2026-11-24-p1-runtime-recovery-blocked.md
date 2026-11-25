# P1 manual runtime recovery assessment — BLOCKED

Date: 2026-11-24 UTC. Source: `d92c6a09b4996afc7023bc7f47e577ed075ccb39` on `main`; package version `0.13.11`; working tree clean before this assessment. This report is separate from, and does not amend, the original failed runner record at `.codex-runs/c14-work-redesign/2026-11-24T23-13-11-428Z/`.

## Finding

The installed `@earendil-works/pi-coding-agent` 1.4.0 SDK supports repeated `AgentSession.prompt()` calls and queued `steer()`/`followUp()` input. It does **not** expose a resumable suspension operation. `abort()` ends the active run. Its event listeners are awaited and could provide a cooperative boundary, but Dope has no durable control path to request that boundary while Work is running.

The current Dope Work architecture cannot safely claim the requested session behavior from a worker-only change:

- `packages/pi-runtime/worker.mjs` uses `SessionManager.inMemory`, rejects a second Work turn with `sessionConsumed`, and rejects every non-tool-result request while a Work request is active (`activeRequest`). It has no message ID, receipt, interrupt-request, or resume protocol.
- `packages/theia-extension/src/node/pi-runtime-host.ts` exposes only `runWork()` and `closeSession()` for Work. `packages/theia-extension/src/node/pi-work-execution.ts` releases the host in the first turn's `finally` block; its execution handle offers `cancel` and `terminate`, both of which dispose the host.
- `packages/theia-extension/src/node/agent-execution-runtime.ts` treats the first adapter result as the end of the AgentRun. It freezes, validates, and either promotes or holds the candidate, then releases the active execution and isolated workspace. Fresh attachment reconciles an abandoned running run as `interrupted`; it does not restore the Pi session.
- `packages/agent-core/src/contracts.ts` defines no `interrupt-requested` or `paused` run status and no Work message ledger. `packages/agent-core/src/node/agent-store.ts` persists runs/events/transcripts under their current transition and immutability rules. The service contract has no queue, interrupt, or resume calls.

Removing `sessionConsumed` alone would allow a second SDK prompt only while the worker remains open. It would leave no durable message receipt, no safe pause confirmation, no restart recovery, and no protection against a second worker or duplicate broker effects. Treating `cancel` or `terminate` as Pause would falsely label a terminated Pi run as resumable. A correct repair needs a persisted session and message owner, an idempotent delivery handshake, a control channel admitted while a Work turn is active, an awaited safe-boundary pause, and integration with the existing grant, broker, candidate, and restart reconciliation rules. Those are prerequisite runtime and storage changes, not a safe one-line Pi adapter fix.

## Verification and runner state

- `npm run codex:phase:validate -- c14-work-redesign`: PASS; prompt grammar valid and P4 remains manual.
- No implementation tests or builds were run because no implementation was made. No runtime behavior is qualified.
- No implementation commit or `PHASE_VERDICT: PASS` receipt exists. The runner's supported continuation detection in `scripts/codex-phase-core.mjs` reads reachable Git commit subjects; `scripts/codex-phase.mjs` then requires a valid verdict in the matching commit body. There is no supported external checkpoint import or P1 skip switch. Creating the exact P1 subject or changing `.codex-runs` metadata now would fabricate completion.
- P2 is **not** safe to start. A normal `npm run codex:phase -- c14-work-redesign` will retry P1 after its ordinary preflight. It cannot legitimately advance to P2 until a source-bound P1 implementation passes and receives a truthful runner-recognized commit.

## Disposition

**P1: BLOCKED.** Preserve the original failed run and this separate assessment. No product source, version, runner ledger, or prompt file was changed. Before a P1 PASS, implement and test the persisted Work session owner and supported worker control/delivery protocol against real Pi turns, then complete candidate and permission regression checks and create the runner-compatible implementation commit. Do not run P2, P3, or P4 from this result.
