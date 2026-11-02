# C3-B — Safe continuation and interrupted Work

**Disposition: PARTIAL.** The unsafe automatic retry is closed for Pi Work and partial candidate bytes are retained on an orderly failed/cancelled run. The existing Work API cannot safely resume that exact stopped candidate, so C3-B deterministic Green is not claimed.

## Source and entry

- Date: 2026-11-02. Entry `main` HEAD `1b9ebb1a59495bc624bbc495bf9a2a1c12c68990`, version `0.12.7`, clean working tree. Final committed HEAD and version are unchanged; the product, tests and this report are uncommitted.
- Read `AGENTS.md`, `BOOT.md`, `docs/workflow.md`, C0 baseline/risk, C1 closeout, C2-R6, C3-A, the Pi worker and Work/Chat execution, grant, candidate, store and transcript source.
- C3-A's work was committed into the entry HEAD. Its 41/41 deterministic result and unobserved live compaction retain their original provenance.

## Interruption audit

| Case | Existing behavior and authority | Current result |
| --- | --- | --- |
| Proactive compaction | Pi compacts between turns, retains its active session and emits a factual compaction event; the broker still checks source, model, workspace and grant per tool. | Unchanged. A summary is advisory, not evidence of effects. |
| Failed compaction / overflow | The worker rejects `willRetry` overflow compaction to avoid replay. A failed compaction event is recorded when emitted. | Run stops; a specific compaction failure message now directs inspection. No overflow retry is enabled. |
| Cancellation / disconnect | Stop aborts the adapter; restart reconciliation marks abandoned runs interrupted and closes unfinished transcript commands as interrupted. Neither path starts Pi. | The orderly terminal path records the candidate delta and, where bounded snapshot succeeds, its changed bytes. A backend crash may leave only the recorded transcript and Git evidence; the live workspace is disposable. |
| Tool failure | Broker status and work observations distinguish requested, completed, failed, denied and cancelled calls. A requested command may have an uncertain outcome if interrupted before its final broker result. | No model statement or partial final response is promoted to tool evidence. |
| Candidate edits | Work operates in an isolated ExecutionWorkspace. The runtime freezes and hashes its delta at settlement; required Dope validation and review gate promotion. | Failed/cancelled runs retain changed bytes in the existing run directory as `partial-candidate`, separately from `review-candidate`. These bytes are evidence only; they cannot be accepted or promoted through the review API. The canonical project is untouched by this archive. |
| Capacity retry | Prior phase-stack logic restarted an adapter up to three times in the same candidate after a capacity error, without checking for a prior tool call. This could repeat a command whose result was lost, even if the candidate fingerprint did not change. | Automatic retry is now limited to `pi-local-work`, no observed tool request, unchanged candidate fingerprint and unchanged active source basis. Any tool request, including a read, stops automatic retry. Other adapters stop on capacity failure. The bounded pre-tool Pi retry remains. |

## Changes and recovery boundary

- `AgentExecutionRuntime` records the initial candidate fingerprint and whether a tool was requested. Before a capacity retry it checks the adapter identity, zero tool requests, current candidate fingerprint and active Git/project basis. This blocks a command with uncertain outcome even when it leaves no file diff. Existing cancellation and authority denial already block retries.
- On orderly terminal failure/cancellation, the runtime freezes the candidate, persists its delta/fingerprint and asks `AgentStore` to copy changed bytes beneath that run. The store verifies each file against the delta SHA-256 and enforces its existing 32 MiB per-file / 64 MiB aggregate bound. Snapshot failure is recorded as an event; the delta hashes remain, but bytes are not claimed retained.
- The existing run/task/grant/project/model identities, validation records, transcript and History remain authoritative. Requested or interrupted commands are not marked completed. Dope validation remains separate from Pi `run_command`. No candidate is promoted from a failed run.
- The worker's native compaction and Chat reconstruction were not changed. Ordinary Chat still uses saved conversation history and the protected `/roadmap` Skill/current selected source checks. Non-reasoning Pi still uses the same tool and compaction path. No additional memory store, grant or retry engine was added.

## Safe continuation limitation

A stopped run requires a new user action. The current `startSequence` can create another run after a stopped phase-stack run, but it creates a fresh ExecutionWorkspace from the current Git basis; it does **not** restore the archived partial candidate into that workspace. Direct/WorkItem paths have their own task/run restrictions. The archived candidate has no reviewed continuation API, current grant reauthorization workflow or model-request context builder. Treating a new run as an exact resume would be false. The user should inspect the stopped run's transcript, candidate delta and retained bytes, verify current Git/project/grant/model state, then start an authorized new task or sequence attempt and reapply only the verified work needed. No prior command is rerun automatically. A rejected candidate retains its established review semantics.

The existing fixed ExecutionGrant has no expiration field. “Expired authority” cannot be tested or claimed without changing that contract. Revocation, foreign project, model drift, source drift, cancellation and candidate review checks remain in their existing paths; C3-B did not loosen them.

## Qualification and remaining evidence

Focused deterministic Pi worker, Work execution, History and agent runtime tests passed **67/67**. They cover a capacity failure after a candidate edit, hash-backed retention without canonical promotion, a requested Pi command with uncertain result and no automatic retry, bounded pre-tool capacity retry, stop during retry wait, and existing authority/review/history cases. The Pi worker cases also exercise native compaction, protected current-turn constraints and non-reasoning tool use. `npm run build:extension` and `git diff --check` passed. No full repository suite, live inference, browser or native Electron replay was run.

The blocking design work for C3-B Green is a reviewed stopped-run continuation route that verifies archived candidate bytes against current source, grant, project, model and effect history; exposes a deliberate user action; and supplies Pi a bounded verified task context without replaying uncertain effects. Backend-crash preservation of a workspace in flight is also unproven. These gaps must stay explicit rather than being represented as a successful resume.
