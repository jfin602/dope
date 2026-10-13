# Cycle 1 — execution-root command transcript repair

Date: 2026-10-08. Starting committed source: `2d3a73430bc2f41a2f6b89d94bb4a4054db523b3` (`24c96a03c9f0d2fa845cac5a44128ddda971a6a0` tree). Version remains `0.8.20`.

## First failing gate and reproduction

Gate A failed again in a fresh disposable Git project using the real Codex App Server adapter and Dope AgentExecutionRuntime. Codex reported a permitted `printf hello` command with exit 0. Dope stored command evidence but ended `authority-denied` and stored no command transcript row. The authoritative Git HEAD did not change. The prior P9 run `630fe5d9-8893-4333-aced-384d8243328c` showed the same command-evidence/empty-transcript pattern.

The provider adapter emits `cwd: relative(executionRoot, commandCwd)`. For a command at the execution root this is the empty string. AgentTranscript requires the explicit root identity `.`. Its append rejected the command; the runtime's failed observation-write path classified that failure as authority denial and interrupted the run. This was an adapter path-contract bug, not evidence of an unauthorized provider effect or a reason to widen the sandbox.

## Bounded repair and focused evidence

The Codex adapter now emits `cwd: '.'` for the execution root. The adapter assertion and a durable-runtime transcript regression check that root commands complete, retain their command row/output and do not become authority-denied. The affected extension package built; `codex-agent-execution` and `agent-execution-runtime` focused tests passed **42/42**. No permission, grant, sandbox, validation or promotion rule changed.

The real replay at [cycle-1-live-command.json](cycle-1-live-command.json) completed run `b18e591f-064b-4b58-bc09-1cc608ca1358` under the accepted default grant. Its command row has stable ID, root cwd `.`, chronological start/completion, exit 0 and 25 ms duration. The provider did not supply split stdout/stderr fields, and Dope's UI explicitly reports output as unrecorded in that case. The source also passed a separate real candidate replay at [cycle-1-live-candidate.json](cycle-1-live-candidate.json): Dope froze a one-file create delta, ran its own required `test -f candidate.txt` in ValidationWorkspace (passed, exit 0), accepted the delta, promoted only `candidate.txt`, and left Git HEAD unchanged. Those replays used fresh disposable projects and retained their `.dope/agent` records.

## Disposition

Gate A is green. Gate B's real command identity/status and durable transcript are proven. Gate C is proven through the real Dope runtime but still requires GUI integration context. Gate E requires real output text in the center transcript; the installed Codex protocol supplies `aggregatedOutput` while the adapter currently reads only split `stdout`/`stderr`. This is the next bounded repair. GUI/restart, Adaptive SEO preservation and the final exact-candidate aggregate remain open. No historical Not Green record is relabeled.
