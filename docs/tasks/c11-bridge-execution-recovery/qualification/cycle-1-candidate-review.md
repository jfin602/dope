# Cycle 1 — candidate review before phase-stack promotion

**Verdict: BLOCKED for live qualification; bounded source repair and focused tests passed.** Date: 2026-10-18 America/Chicago. Starting and ending Git HEAD: `12a2df3b7f922f9cc5f76493b30e3d0d4a0d2f15`; product version `0.11.8`. The checkout started clean. Product/test changes are uncommitted. The pre-evidence `git diff --binary` SHA-256 is `149923bd63c3df20b80feacdcfe6642f97de807c63e4d6c9d09cee9204c29181`; no product commit was made.

## Observation and repair

The preserved [prior qualification](../../c11-planning-bridge/qualification/2026-10-18-stack-authoring-execution.md) directly observed phase-stack P1 promotion before candidate accept/reject review. Source inspection found that `AgentExecutionRuntime` gated review on `origin.kind === 'work-item'`, while phase-stack preparation omitted `reviewPolicy`. Sequence observation mapped only a completed run to `checkpoint-pending`; Work displayed review controls only for WorkItems.

Newly prepared phase-stack tasks now require Dope validation and the existing review policy. The runtime freezes the candidate, validates it, and holds it before promotion. The existing accept/reject API, frozen fingerprint, grant and Git-basis checks are reused. A generated prompt's delegable and human-reserved paths are checked at hold and again at acceptance; legacy authored prompts without structured scope remain readable and continue to rely on grant/path protections. Sequence state has a distinct `candidate-review-pending` blocker. Checkpoint creation and recovery require an accepted review for tasks with required review policy. Work exposes the held phase-stack candidate through its existing diff and review surface. Historical tasks/runs and the old fixture prompts were not changed.

Changed files for this cycle: `packages/agent-core/src/contracts.ts`, `packages/agent-core/src/sequence.ts`, `packages/agent-core/src/node/sequence-reconciliation.ts`, `packages/agent-core/src/node/sequence-checkpoint.ts`, `packages/theia-extension/src/node/agent-execution-runtime.ts`, `packages/theia-extension/src/node/agent-runtime-backend.ts`, `packages/theia-extension/src/browser/work-selection-controller.ts`, `packages/theia-extension/src/browser/chat-panel-widget.ts`, and `test/unit/agent-execution-runtime.test.ts`.

## Focused evidence

- Rebuilt `@dope/theia-extension`; TypeScript typecheck passed.
- Focused `agent-execution-runtime.test.ts` and `phase-stack-composer.test.ts`: 41/41 passed before the final two test-only additions. A later targeted replay of review/replay/source-drift cases passed 4/4.
- A validated phase-stack candidate remained absent from authoritative files until explicit test acceptance. The accepted candidate reached `checkpoint-pending` only after promotion. Rejection left zero applied files and no checkpoint; wrong fingerprint and authored prompt drift were denied. An authored reserved-path candidate was denied. Replayed acceptance returned the recorded decision without a second promotion.
- The earlier WorkItem review tests passed in the first focused aggregate. A repeated full product check passed 772/772 with typecheck, browser build and Electron build on the final code/test candidate; see Cycle 5.

## Live browser and remaining gate

The fresh local browser at `http://127.0.0.1:3000/#/tmp/dope-bridge-qual-1VgRWq` loaded the **historical** started `c11-severity-filter` sequence. It showed P2 of 3, `blocked · validation-failed`, one P1 checkpoint, and a disabled Resume until a new grant. This confirms the old record is still visible; it is **not** a live replay of a new review hold. No Work Run, grant, accept or reject was operated in this cycle. The independently operated native Electron GUI was not observed. The referenced `recovery-contract.md` and work-experience contract were absent from this checkout at preflight.

**Next action:** With the approved contract available, create a separate correctly linked disposable stack; have the developer explicitly start a bounded Work task, inspect its held candidate, and separately accept or reject it in the real browser. Preserve the old started sequence and checkpoint.
