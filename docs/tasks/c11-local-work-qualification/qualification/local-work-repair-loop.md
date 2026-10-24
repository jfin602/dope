# Phase 11 local Work execution qualification — 2026-10-24

## Scope and source

This is a browser/backend qualification of Dope's local Coding Agent Work path on a disposable TypeScript project. It does not relabel earlier Phase 11, Bridge, native Electron GUI, or hosted-provider results. The owner's loaded model clarification identified `qwen3-coder-30b-a3b-instruct@q4_k_m` as the intended model. No global Coding Agent role, model context, provider, product version, or Dope Git history was changed.

- Dope repository: `/home/jfin/dev/dope`, `main` at `503dae3773ab768719c0a2e1d3e4fef5e7c41cde`, version `0.11.8`.
- Product/test tracked diff SHA-256 before this report: `08df0b6b0c4f9cdc682a5a8aaa350054bdeabe340180f197294a521762ddcc38` (`git diff --binary | sha256sum`). Existing Work reconnection edits and untracked recovery evidence were present before this campaign and preserved.
- Browser: real Codex in-app browser against local Dope/Theia backend on `127.0.0.1:3137`; project roots were disposable Git repositories under `/tmp`.
- Provider: LM Studio at `http://127.0.0.1:1234/v1`; Dope connection `98c9cf59-9550-4e91-a63f-141f990d5913`, alias `local`, provider/model ID `qwen3-coder-30b-a3b-instruct@q4_k_m`, loaded context `32768`. AI Center reconnect and live synthetic tool probe established `agentExecution: yes (adapter-known)`. All actual runs recorded `runtimeKind: local`, `adapterId: local-lm-studio`, and this exact connection/model. No hosted run or fallback occurred.
- The global Coding Agent role pointed at a hosted Codex target, so direct Work used its existing exact target selector. The Prompt Stack path required a bounded exact-target selector repair.

## Starting evidence and fixture

Previous Work Experience evidence established restoration and UI behavior in its own scope, while its local candidate validation, candidate review, and checkpoint were unqualified. This campaign retained that evidence and the already dirty Dope tree.

The initial fixture `/tmp/dope-local-work-v6s0Q8` was a clean Git project at `1514fcfef4d588390d69d967bd19ce9c7b00f7e9`, version `0.0.0`, with `src/math.ts`, `test/math.test.ts`, and an offline `npm test` script (`node --test test/math.test.ts`). Its baseline test passed 1/1. The stack fixture `/tmp/dope-local-review-reject-b` added only two committed, runner-compatible disposable P1/P2 prompts and began at `c78bac72ca904335878fd00112a392dfde2a21d9`, clean. P1 implements `clamp`; P2 is a separate manual closeout gate. Dope's `.dope/` state was excluded from fixture Git, preserving clean-basis checks.

## Repair cycles and real runs

| Cycle | Observed failure and correction | Focused result and GUI replay |
| --- | --- | --- |
| 1 | Direct run `bd6975df-4217-41ff-8b14-7944757dfc33` changed `src/math.ts` in its candidate, then failed before the second edit and before validation. LM Studio returned a valid multiline `edit` call, but the transport counted its serialized tool arguments against a 512-byte final-answer display reserve. Essential tool payloads now use the bounded input/total budget in `local-context-budget.ts` and `local-tool-turn.ts`. | Focused local tool/context tests passed; the next GUI run reached both edits. The first run remains `provider-error`, validation `not-started`, no promotion. |
| 2 | Direct run `69308510-62d2-4459-900c-e328d475faa5` edited both candidate files, then requested model-side `process` for `npm test`. The broker denied that command; Dope-owned validation never started. With no approved model-side commands, the local transport now omits `process` and tells the model Dope runs the required check after its final answer. Broker denial was retained. | 60/60 focused runtime/tool tests passed. GUI replay `c461e405-8dbc-4906-90a1-93ce635a2c0f` completed on the exact local target, applied `src/math.ts` and `test/math.test.ts`, and saved Dope-owned `npm test` PASS, exit 0, 4/4 tests, candidate fingerprint `4fd0a4722ade39bde88c936894210edfc58f606242073318fb8d3e41fd1fb95f`. Direct Work correctly had no candidate review or Git checkpoint requirement. |
| 3 | The discovered Prompt Stack opened but its Start path used only `follow-coding-agent`, which would select the global hosted role. Added exact task-scoped model selection in the existing Phase Stack controller/UI, fresh target verification at Start, and explicit hosted-data authorization if a hosted target is chosen. | 8/8 focused stack UI tests passed. In GUI, the exact local Qwen option appeared after AI Center reconnect/probe and browser refresh; the global role stayed unchanged. |
| 4 | The first exact-local stack Start stopped before a run: the immutable prompt's recommended hosted `high` reasoning setting was copied into the exact local task, which the local adapter correctly rejects. For exact target selection, the task omits that unsupported control while retaining the prompt recommendation as metadata and its immutable text. | Targeted regression passed 1/1. Fresh stack run `757906b6-1d59-4490-856e-94b4d36d9298` reached a validated held candidate. It was rejected in the GUI: no project bytes promoted and Git stayed clean. Separate retry `3f9e8fe5-2c6f-42e4-8fe5-8ea265d9fd0f` reached a second held candidate, passed Dope-owned `npm test` (exit 0, 4/4), and was accepted in the GUI. Candidate fingerprint: `df570832735de8c17151a4d9fb870ee09162f23dcb5a116c0b77c29f726ccf57`. Exact two-file promotion followed acceptance. |
| 5 | A pre-existing validation test assumed a sandboxed process could connect to its own loopback listener and expected only the word `infrastructure` for a missing namespace tool. This host denied self-connect, and the runner truthfully said `Validation namespace unavailable`. The test now checks the required host/external denials without requiring sandbox self-connect and accepts both accurate unavailability wordings. Production isolation stayed unchanged. | Focused candidate-validation suite passed 3/3, including pass/fail, bounded output, cancellation, process reaping, and unavailable infrastructure. |

### Candidate review and checkpoint

For the rejected stack run, Work displayed the candidate diff for exactly `src/math.ts` and `test/math.test.ts`, Dope validation PASS, Accept and Reject controls, and “No changes applied.” After Reject, the saved decision was `reject`; the authoritative Git tree remained clean at `c78bac7`. History reopened that rejected decision after a backend restart.

For the accepted retry, Work displayed the same two changed paths and passing validation before acceptance. Accept promoted only those paths. The sequence then showed `checkpoint-pending` with 0/1 checkpoints; the separate **Verify checkpoint** control produced `69fd65a532945b6e8d43de4dae622591b334231e`, whose commit touches only the two source/test files. Git was clean afterward. The sequence advanced to P2 `waiting-manual`, with 1/1 checkpoint and owner qualification **not recorded**. No automatic manual qualification was claimed or triggered.

Run and sequence records are retained at:

- `/tmp/dope-local-work-v6s0Q8/.dope/agent/runs/{bd6975df-4217-41ff-8b14-7944757dfc33,69308510-62d2-4459-900c-e328d475faa5,c461e405-8dbc-4906-90a1-93ce635a2c0f}/`
- `/tmp/dope-local-review-reject-b/.dope/agent/runs/{757906b6-1d59-4490-856e-94b4d36d9298,3f9e8fe5-2c6f-42e4-8fe5-8ea265d9fd0f}/`
- `/tmp/dope-local-review-reject-b/.dope/agent/sequences/6d5253aa-4c07-4953-b903-04ab1c7c8c28.json`
- Browser/backend logs: `/tmp/dope-local-work-backend-cycle2.log`, `/tmp/dope-local-review-reject-b-backend.log`, `/tmp/dope-local-review-restart.log`; LM Studio live request/response evidence in `/home/jfin/.lmstudio/server-logs/2026-10/2026-10-24.1.log`. Browser accessibility observations in this task showed the Start grant/model/validation controls, held candidate diff, Accept/Reject decisions, checkpoint action, restored History and transcripts. These records are local, disposable qualification evidence.

## L1–L10 result

| Gate | Result | Evidence / limit |
| --- | --- | --- |
| L1 Local model readiness | PASS | Exact loaded Qwen ID, 32,768 context, AI Center tool probe, local provenance on all real runs. |
| L2 Work creation | PASS | GUI task instructions, exact model, `npm test`, project identity, grant, Start. |
| L3 Execution authority | PASS | Direct Work showed allowed project read/write/process/test/build and denied network, secrets, outside-root, destructive Git/history and system effects. Start was disabled before grant. The second pre-repair run demonstrated broker denial of an unapproved model-side command without promotion. |
| L4 Real code modification | PASS | Qwen edited `src/math.ts` and `test/math.test.ts` via Dope in direct and stack runs; candidate and applied paths stayed inside fixture. |
| L5 Required validation | PASS | Dope owner, real `npm test`, exit 0, saved 4/4 output and candidate fingerprint in direct and stack records. Initial failures stayed `not-started`; model prose alone never became PASS. |
| L6 Candidate review | PASS | Stack candidate held with diff, validation, explicit Reject and Accept. Rejection left Git clean; separate acceptance promoted exactly two files. Direct Work review is not required by its policy. |
| L7 Checkpoint/completion | PASS for applicable checkpoint | Stack checkpoint `69fd65a` verified separately after acceptance; P2 remains manual and owner qualification unrecorded. Direct Work correctly did not manufacture a checkpoint. |
| L8 Restart/continuity | PASS | Backend restart plus browser reload preserved direct run identity, transcript and validation. Later restart preserved stack P2, checkpoint SHA, the accepted transcript, and the separate rejected decision in History. No new run was started by reload. |
| L9 Negative/security | PASS in combined live and focused scope | Live unprobed model unavailable, denied model process command, rejected candidate, candidate held without promotion; focused runtime tests covered validation failure, stale candidate, prompt/basis drift, wrong identity, permission denial, interrupted backend and fail-closed no-fallback behavior. Native or whole-host egress was outside this browser/local scope. |
| L10 End-to-end UX | PASS in browser scope | Select/New Work, exact target, validation, grant, Start, live edit, saved validation, stack diff/Reject and retry/Accept, checkpoint and History reopen were all reached by GUI. After a fresh backend process, AI Center reconnect/probe and page refresh were needed for the exact target to repopulate. |

## Files changed by this campaign

- `packages/theia-extension/src/node/local-context-budget.ts`, `local-tool-turn.ts`, `local-agent-turn-loop.ts`, `local-agent-execution.ts`: bounded essential tool payloads and offered only approved local tools.
- `packages/theia-extension/src/browser/phase-stack-controller.ts`, `work-selection-controller.ts`, `chat-panel-widget.ts`: exact task-scoped target selection, fresh target check, and hosted-data authorization for the existing stack path.
- `packages/theia-extension/src/node/agent-runtime-backend.ts`: exact target tasks do not inherit unsupported prompt reasoning controls.
- Focused regressions in `test/unit/local-context-budget.test.ts`, `local-tool-turn.test.ts`, `local-agent-turn-loop.test.ts`, `phase-stack-ui.test.ts`, `agent-execution-runtime.test.ts`; sandbox-portability assertion correction in `candidate-validation.test.ts`.

Pre-existing edits in `package.json`, `frontend-module.ts`, the other `chat-panel-widget.ts` hunks, and Work reconnection tests/evidence were preserved. This campaign did not commit Dope or change `0.11.8`.

## Final exact-source check and verdict

`npm run check` was invoked **once** after the final GUI candidate on the tracked product diff above. It exited **0**. The final check log is `/tmp/dope-local-work-final-check.log`.

- Typecheck: PASS.
- Tests: **799/799 PASS, 0 fail** across runner 105, baseline 13, local-install 1, product 651 + 28, and IDE 1.
- Browser build: browser and node bundles finished with **0 errors**.
- Electron build: browser, node, and Electron bundles finished with **0 errors**. This is not independent native GUI proof.
- `git diff --check`: PASS; repository HEAD and version remained `503dae3773ab768719c0a2e1d3e4fef5e7c41cde` / `0.11.8`. The new report is untracked documentation and did not change the tracked diff fingerprint.

**Verdict: GREEN FOR LOCAL WORK QUALIFICATION in the real browser/backend/LM Studio scope.** Phase 11 as a whole remains open, native Electron GUI and hosted provider parity remain separate, and P2 manual qualification is intentionally not auto-completed. This establishes readiness for the next separately scoped “Dope Builds Dope” qualification, subject to its own project authority and evidence gates.
