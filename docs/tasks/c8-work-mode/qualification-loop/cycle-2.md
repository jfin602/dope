# Cycle 2 — real combined command output

Date: 2026-10-08. Starting committed source: `951df43960c6ce838236043fc461db20c18541ce` (`cd2673b598bd85f8defcbb981156ba37cee23f5a` tree). Version remains `0.8.20`.

## First remaining gate and source

Gate E still required real command output in the center transcript. Cycle 1's permitted command completed, but its row explicitly said output was unrecorded. The installed Codex App Server 0.155.1 protocol defines `aggregatedOutput` as combined stdout/stderr on a command item; the adapter only read split `stdout` and `stderr` fields. This was an observation/projection gap, not an execution or sandbox failure.

## Repair and evidence

The adapter now captures the completed command's `aggregatedOutput` through its existing bounded/redacting visible-text filter. A provider-neutral combined `output` field passes through AgentExecutionEvent, durable AgentRun transcript, restart parsing and Work's expanded command detail, labeled `output (combined)` so it is not misrepresented as stdout. Split stdout/stderr remains supported, and missing output remains explicitly unrecorded. The new field is bounded to 4,000 bytes and applies the existing secret/private-path redaction.

Affected agent-core and extension packages built. The focused runtime, adapter, transcript-store and Work presentation set passed **49/49**. Additional targeted redaction/truncation assertions passed **19/19**; the overlapping tests were rerun only for those new assertions. No grant, approval, network, workspace or promotion rule changed.

[cycle-2-live-command.json](cycle-2-live-command.json) records real Dope AgentExecutionRuntime run `53b8b616-4202-42c1-ab7a-8cbb4b514042`: completed under the default accepted grant, with one chronological command ID, root cwd `.`, exit 0, 16 ms duration, and durable combined output `hello`. Authoritative Git HEAD remained unchanged. This is real provider command evidence, not a fixture. The source projection has not yet been observed in the actual center UI.

## Disposition

Gate B's live command and output record are green. Gate C's actual Dope validation and promotion evidence from Cycle 1 remains applicable; no candidate/validation/promotion code changed. Gate E's GUI/restart observation is next. Security/failure regressions, Adaptive SEO read-only preservation and final aggregate remain open. Historical P9 Not Green evidence remains preserved.
