# c8-work-mode - Source-aware implementation plan

Status: Approved documented correction; implementation not yet executed.
Current source inspected at `91adf5018c8c2e2e03a8c7609587cf77e0a28695`, Dope package `0.8.20`. Inspect current HEAD again before each edit.

## Current producers, consumers and state owners

- Codex adapter: `packages/theia-extension/src/node/codex-agent-execution.ts` observes `item/completed: agentMessage` but emits only "Agent message received". It has command start/completion IDs/command/exit; it does not retain provider-visible prose or a full command transcript.
- Runtime: `packages/theia-extension/src/node/agent-execution-runtime.ts` maps all observations to generic AgentRunEvent summaries and keeps temporary command correlation for commandEvidence. ADR 0029 CandidateValidationRunner now owns required validation; do not reuse provider-command matches as completion authority.
- Domain: `packages/agent-core/src/contracts.ts` defines AgentRunEvent summary (<=1000 chars); AgentStore in `packages/agent-core/src/node/agent-store.ts` writes bounded `events.jsonl` (10,000 events, <=2048 bytes each). Add independently versioned/strict `transcript.jsonl` with paginated read, bounded complete visible messages, command entries and explicit truncation, without bloating event summaries or `run.json`.
- RPC: `packages/contracts/src/agent-runtime-service.ts` and `packages/theia-extension/src/node/agent-runtime-backend.ts` expose readEvents/run/task/sequence. Add safe transcript paging separate from operational events; notify existing event clients or a bounded compatible transcript update.
- Agent Run UI: `packages/theia-extension/src/browser/agent-run-controller.ts` reads at most four 100-event pages and drops all but latest 300. `agent-run-widget.ts` is a singleton main-area widget with direct-task form, runs list, and flat Activity list. It must not remain the sole Work UI.
- Prompt Stack UI: `phase-stack-controller.ts` owns `tasksRoot='docs/tasks/'`, listTaskStacks/openTaskStack, dirty confirmation, execution/grant/manual gate/checkpoint logic. `phase-stack-widget.ts` renders that as a separate singleton main-area view. Move presentation to Work without copying authority/state-machine logic.
- Chat panels: `chat-panel-widget.ts` implements StatefulWidget, fixed header/transcript/composer, safe Markdown, scroll-follow, selection restoration. `chat-panel-controller.ts` owns ChatOpenOwners/single Chat lease. `chat-panel-presentation.ts` exposes areas, fixed left/right launcher instance IDs and scroll helpers.
- Theia wiring: `frontend-module.ts` binds Chat launcher views and main-area AgentRun/PhaseStack contributions. `agent-run-contribution.ts` and `phase-stack-contribution.ts` expose old command IDs. Add Work launchers and legacy aliases while preserving current navigation commands.
- Tests: `test/unit/agent-core.test.ts`, `agent-store.test.ts`, `agent-run-ui.test.ts`, `codex-agent-execution.test.ts`, `chat-panel.test.ts`, `chat-presentation.test.ts`, `phase-stack-ui.test.ts`, `phase-stack-discovery.test.ts`, `agent-sequence-persistence.test.ts`, plus focused runtime/validation tests.

## Component boundaries

### A. Transcript identity and store (P1)
Define `AgentTranscriptEntry` (agent-visible message, command lifecycle/one logical command, small system marker), stable per-run sequence, bounded transcript storage, normalized command text/relative cwd and optional bounded stdout/stderr, explicit truncation markers. Strict parser, append/update or append-only progression and read pagination must preserve chronological order/dedupe without rewriting older legacy run records. Prefer append-only event revisions that reconstruct command rows, rather than mutable JSONL in place. Existing events remain operational diagnostics.

### B. Provider adapter (P2)
Map only genuine visible `agentMessage` payload content; never `reasoning` or hidden summaries. Where Codex emits incremental updates, reconstruct/dedupe by safe item ID without duplicating final text. Normalize command start/completed/cancelled with stable IDs, scoped cwd, bounded exposed output where available; enforce redaction/bounds and deny unsafe provider extra tool requests as already. Provider event ceiling and cancellation unchanged.

### C. Runtime projection (P3)
Serialize durable AgentTranscriptEntry writes in observation order; correlate commands; append terminal status for incomplete commands on cancel/restart. Restrict data to safe visible content; mark limit/truncation honestly. Isolate transcript write failures so no covert grant escalation or falsely completed run. Project-local AgentStore owns all durable data; RPC reads paginated records. Preserve CandidateValidationRunner and strict completion semantics.

### D. Shared presentation ownership (P4)
Build a small shared panel mode/presentation wrapper around existing ChatPanel rather than copying 47K of Chat code. Two modes Chat/Work with selection retained separately. Stable panel IDs, same-Work owner registry keyed by project and stable selection identity, focus-on-collision, restore/project-switch generation guards, close/toggle not cancel. No second backend writer to Chat or Agent Runtime. Fixed left/right launchers remain functional.

### E. Work model/prompt list (P5)
Select Work lists durable AgentTask/Run and discovered `Prompt Stacks` via current listTaskStacks; default `docs/tasks/`, configurable/Refresh; reuse existing sequence and no Import action. Work navigation can open a sequence, task and run without conflicting owning presentations; stabilize Work identity keys, title helpers (entry snapshot or objective, then shortened run ID). Current sequence advancement never retitles historical runs. Maintain manual/browser gate and dirty acceptance.

### F. Work transcript UI (P6)
Work detail uses safe Markdown renderer, assistant text as unboxed document, command rows collapsed by default with command/status/exit/duration, bounded expandable output and clear truncation, compact inline file/validation/authority/checkpoint evidence. Keep operational diagnostics behind disclosure. Load first page through full history on demand/in bounded pages; do not truncate to in-memory 300-event tail. Use ChatScrollFollow/drag helpers with independent Work scroll state and jump-to-latest, stable across UI updates.

### G. Launcher, commands and direct-task entry (P7)
Left and right toolbar Work entry alongside Chat; command palette Work in each supported area; alias `dope.agentRun.open` and `dope.phaseStack.open` into corresponding Work sections. Existing Phase Stack Open Agent Run detail navigates to the selected Work transcript, not another singleton. Chat-like composer starts direct bounded task with unchanged Coding Agent model policy/explicit grant/validation requirements. Enter/Shift+Enter follows Chat when relevant; no mid-run steering.

### H. Integration (P8)
End-to-end focused tests across service/panel state: duplicate selection focus, switching modes, project switch, restoring duplicate panels, continuing active run while view closes, reconnect/read pagination, completed sequence and legacy task JSON compatibility. Migrate UI test assertions away from old user-visible labels without modifying historical evidence. Explicitly test that UI migration does not trigger AgentTaskSequence mutation or Git.

### I. Qualification (P9)
Manual real Electron/browser UI on a disposable fixture and read-only completed Adaptive SEO 4-checkpoint sequence. Verify 4 panel positions, Chat navigation preserved, Work title, full messages/command expansion, live follow, close/toggle/restart without cancel or duplicate. Do not rerun Adaptive SEO P1-P4 or create new commits. Execute full aggregate check on final source, focused regression and UI evidence; write truthful closeout.

## Hard invariants

No new provider sandbox permissions, network/secret access, project direct writes, Chat routing fallback, extra checkpoint authority, stack grammar/version changes, unbounded persisted text or rewriting of old `.dope/agent` records. Distinguish Dope-owned CandidateValidation results from provider command history; preserve historical checkpoint SHAs.

## Tier plan

P1 T1 domain/store; P2 T1 adapter; P3 T2 runtime/persistence RPC; P4 T2 panel owner; P5 T1 selectors; P6 T2 transcript UI; P7 T2 navigation/composer; P8 T2 cross-component regression; P9 T3 real GUI, restart, full check and closeout.

No ordinary prompt should run full `npm run check` or full packaging. Each implementation prompt must report tested evidence and hand off to the next.
