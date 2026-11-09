# /prompt-ass — c13-context-recovery

**Date:** 2026-11-09. **Source basis:** committed repository at `c32eb29031ef2e69e3e5634058ba4c4f27ecf102` (product code inherited from `868e428d7e7e85589dce0c9133db5e8d87bc767c`), version `0.13.11`. **State:** assessed for prompt authoring only; not implemented or qualified. **User request:** `/prompt-ass + /prompt-plan + /prompt-write c13-context-recovery`.

## Objective and observed failure

Restore reliable protected Chat/Pi execution and replace the two numeric Chat context inputs with a single per-Chat **Context limits: Managed / Unmanaged** control. Managed chooses effective request, generation, and tool-result budgets by trusted command/stage and actual model capacity. Unmanaged delegates context management to Pi within loaded/provider limits instead of retaining hidden Dope discretionary quotas. Preserve exactly sourced tool evidence, drafts, continuation and approvals.

The original 16K Assessment (2,048 output tokens) and supplemental 32K/64K Assessments (4,096 output tokens) all failed with saved `tool_protocol_unknown`, no output-limit pause, no `assessment_finish` and no sealed Assessment. Coverage: **16K 4/5, last acknowledged tool 16; 32K 4/5, tool 16; 64K 1/5, tool 6.** All had a saved 8,192 input budget, same product and fixture bytes; underlying exception and failed-run provider usage were not recorded. A longer loaded context is not an Unmanaged test. Do **not** rank capacity from incomplete attempts. Source: [R11 report](../c13-pfix/qualification/p8-r11-context-output-capacity-2026-11-09.md), [R11 supplement](../c13-pfix/qualification/p8-r11-supplemental-32k-64k-benchmark-2026-11-09.md), [forward correction plan](../c13-pfix/context-policy-correction-plan.md).

Inspected `packages/pi-runtime/worker.mjs`: protected Assessment permits 128 tools / 64 model calls, yet a generic Chat-tools counter aborts on tool start 17. The worker's shared completion failure includes "tool call", and text-pattern classification maps it to `tool_protocol_unknown`. This is a **testable candidate** for the two tool-16 signatures, **not proven historical attribution**. The earlier tool-6 failure is distinct. `pi-runtime-host.ts` last-acknowledged receipts prove earlier delivery, not that the next model turn succeeded.

## Scope and preservation

In scope: typed worker-origin failure classification and safe per-call diagnostics; host/adapter Chat persistence; one trusted context-policy resolver; internal operation-aware presets and tool paging; no-hidden-quota Unmanaged behavior; legacy Chat setting migration and execution snapshot; model bridge/worker coordination; Pi threshold compaction and effect-safe output continuation; the existing settings sheet; deterministic regression and manual browser proof.

Out of scope: changing model weights or LM Studio load; global context defaults; guaranteed 64K superiority; a new agent/context manager; new root/database/publisher; bypassing broker/source/owner/permission checks; weakening incremental Assessment citations or `assessment_finish`; Work grants/canonical edits, Roadmap GREEN, retroactive reclassification of R9–R11; executing or rewriting `c13-pfix` P1–P8 or active Phase 13 R3B.

Hard invariants: protected command selected only by trusted dispatcher; mere quoted slash text must never invoke skills; no implicit source/body reads or egress; page reads use hash-bound continuation; tool denial remains denial; prior effects are not replayed; incomplete answer/draft never promoted to accepted Chat text/Plan/Work without verified finish; per-Chat selected/actual model and lease cannot drift; real provider/model/window limits always apply even in Unmanaged. Separate Ask/Allow/Cancel generation-boundary preference remains.

## Dependencies and source boundaries

- Worker/provider: `packages/pi-runtime/worker.mjs`.
- Host/adapter: `packages/theia-extension/src/node/pi-runtime-host.ts`, `pi-conversation-runtime.ts` and `pi-model-bridge.ts`.
- Request composition: `chat-context-composer.ts`, `chat-backend.ts`.
- Chat types/storage: `packages/chat/src/index.ts`, `packages/chat/src/node/chat-repository.ts`.
- UI: `packages/theia-extension/src/browser/chat-panel-widget.ts`, existing controller/presentation and theme styles.
- Assessment contract: existing incremental Assessment/proposal owner, `assessment_status`, `assessment_stage`, `assessment_finish`. R10 repaired iterator generation ownership; do not regress it.
- Relevant tested fixtures exist in `test/unit/pi-runtime.test.mjs`, `pi-transport-fault-matrix.test.mjs`, `pi-conversation-runtime.test.ts`, `pi-model-bridge.test.ts`, `chat-context-composer.test.ts`, `chat-backend.test.ts`, `chat.test.ts`, `chat-repository.test.ts`, `chat-panel.test.ts`, `prompt-authoring-stage.test.ts` and `prompt-draft-store.test.ts`. Tests importing generated `lib/` require a fresh affected-package build before execution.

## Proposed decomposition (not executed)

| Prompt | Primary coherent responsibility | Tier |
| --- | --- | --- |
| P1 | Worker origin codes and before/after 17th-tool reproduction | T1 |
| P2 | Host/adapter propagation and safe saved failure details | T1 |
| P3 | Shared trusted command/stage budget resolution | T1 |
| P4 | Worker counters and enforcement use resolved policy | T1 |
| P5 | Persist Managed/Unmanaged and snapshot/migrate old Chat settings | T1 |
| P6 | Composer/backend request-budget integration | T1 |
| P7 | Pi bridge/worker capacity and provider request agreement | T1 |
| P8 | Tool output/paging and protected staging sizes | T1 |
| P9 | Result framing/large output retention | T1 |
| P10 | Effect-safe Pi compaction/continuation integration | T2 |
| P11 | Settings toggle and policy integration qualification | T2 |
| P12 | Independent manual Codex browser closeout | T3 |

**Rationale for P11:** small UI change plus a dedicated cross-owner integration matrix, not a mixed implementation prompt. P11 must clearly separate the UI-focused changes from the heavier test matrix. P1–P9 are small independent boundaries targeting ≤8-minute implementation + focused tests, 10-minute soft / 15-minute hard budget; P10 T2 may exceed ordinary budget only for warranted integration. P12 independent manual T3 may be longer. No assumption that these are measured durations.

## Risks, limits and evidence needs

- Misdiagnosing `tool_protocol_unknown` as a transport error and hiding a policy stop.
- Replacing one hidden cap with another (bridge 4K/8K, generic tool 16, aggregate 64 KiB, 12K tool result).
- Overlong Unmanaged execution/host memory/CPU overhead; preserve user Stop, explicit stalled-loop handling, queue/protocol integrity and observable resource failures. These protections must not masquerade as context budgets.
- Unsound Pi overflow retry after a tool may have changed candidate state; retain source/effect receipts and no replay.
- Persisted old Chats or mid-turn setting changes altering active request.
- Incorrect tool-result compression; pagination must not waive requirement for late pages.
- Resource considerations: last R11 report observed no swap, limited available RAM and low free disk; never assume 64K is a safe/default load or perform a context sweep as part of ordinary T1.
- High-stakes authorization: user-visible toggle changes budgeting only, not permission or publication authority.

**Evidence:** unit/worker-frame reproduction of tool 17; distinct early failure after an acknowledged result; exact policy validation and model capacity; persisted cause/usage (unknown when unavailable); split operation tool reads; nonreplayed effects; successful guarded five-file `assessment_finish` on one fixed served candidate; independent Managed and Unmanaged browser observations, reload/cancellation; exact Git/source/model/served hashes and genuine partial vs completion states.

## Prompt Efficiency Gate

One concern per P1–P9; split diagnostic origin vs propagation, policy resolver vs worker enforcement, schema vs runtime, bridge vs tool paging, and output result framing vs compaction. Use shortest changed-package builds and focused tests (source and compiled-import seams checked); P10 is shared T2, P12 manual T3. No repeated blanket `npm run check`/`npm test` across ordinary prompts. Sol Medium for localized storage/UI changes; Sol High for worker protocol, authority-sensitive coordination and recovery; no XHigh default. The single final closeout is manual/browser-required. UI follows current restrained-orange ADR 0016, Chat visual contract, ADR 0037, keyboard/narrow/theme semantics. No tests, builds, inference, time measurements or source mutations were performed by authoring.
