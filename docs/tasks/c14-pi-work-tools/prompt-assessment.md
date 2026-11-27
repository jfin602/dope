# Assessment — Pi Work tool broker replacement

**Date:** 2026-11-26. **Status:** source-inspected authoring assessment, not execution or qualification. [ADR 0060](../../decisions/0060-pi-native-work-tools-dope-controlled-operations.md) is the governing decision.

## Source and failure basis

At observed `0.14.0`, `packages/pi-runtime/worker.mjs` disables Pi built-ins with `noTools: 'all'`, supplies `workTools()` from `WORK_TOOLS`, and returns generic denied feedback. The installed `@earendil-works/pi-coding-agent@1.4.0` provides Pi `read`, `write` and `edit` definitions with injectable operations; its `write` performs `mkdir` then `writeFile`, while its `edit` performs separate access/read/write. Those seams **do not themselves prove** an atomic Dope authorization/journal/commit. P1 must inspect their actual exports, packaging and all effects before choosing an injected operation or thin adapter.

`packages/agent-core/src/work-tool-selection.ts` fixes the model-callable catalog to `read_file`, `list_files`, `edit_file`, `run_command` and `read_command_output` (plus a separately gated external MCP entry). `packages/agent-core/src/node/local-tool-contracts.ts` parses that protocol; `local-tool-broker.ts` runs fixed isolated read/list/edit scripts under the OS sandbox. `direct-work-journal.ts` checks `edit_file`, source and unsaved buffers but presently expects an existing safe parent and a create/modify operation. `packages/theia-extension/src/node/pi-work-execution.ts` maps worker names into that protocol. `pi-runtime-host.ts`, `pi-model-bridge.ts`, `agent-execution-runtime.ts` and Work selection UI bind the fixed names, results and lifecycle. Direct finalization contains a candidate-promotion failure label. These are seams to inspect, not an exhaustive call-site inventory.

The failed local run demonstrated successful first `index.html` creation, denied second create, repeated `src/main.ts` denial with absent `src/`, opaque model-facing replies, a missing terminal transcript receipt and misleading Direct final label. It did **not** establish that opening `index.html` revoked authority. The user wants Pi performance preserved without surrendering Dope's safety or user control.

## Task division

Eight runner-compatible prompts keep audit, Isolated file effects, Direct file effects, Pi adapter, selection/commands, feedback/lifecycle, integrated retirement and live qualification independently reviewable. P1–P7 are headless runner checkpoints; P8 is the sole independent browser/manual closeout. P1 writes a real audit report so the runner has a meaningful tracked checkpoint. The command tool is a deliberate compatibility exception: the current fixed effect ceiling cannot admit Pi's unrestricted Bash. Existing MCP and Chat tool routes remain separately authorized. Saved old Work runs/history stay readable; a new run must not silently reinterpret an old grant or group as a new Pi tool identity.

## Critical risks and gates

1. Pi `write`'s separate `mkdir` callback and `edit`'s separate read/write callbacks can cause partial or stale effects. All effectful callbacks must route into a whole Dope operation, or the tool needs a thin Pi-compatible adapter. No raw filesystem fallback.
2. Parent creation in Direct needs an advance journal, descriptor-safe traversal, ownership/reconciliation and selective revert; Isolated needs safe in-sandbox creation and no path escape. A fixture with missing `src/` must be a positive test.
3. Catalog migration changes tool names/schemas. Freeze exact new IDs and revisions, reject stale grants, review persisted selections, and cover all Work entry/retry paths. Do not auto-select newly registered Pi tools.
4. Recoverable conflicts and genuine authority denials must be distinguishable without leaking paths or contents. Every call needs a terminal transcript receipt, including cancellation/uncertain effects.
5. Direct completion must report applied bytes and validation truth; Isolated retains candidate promotion. A common exception handler must not relabel Direct failures as candidate failures.
6. Performance is empirical. Record same-model standalone Pi and Dope behavior under a disposable equivalent task; do not infer a win from shorter tool descriptions alone.
