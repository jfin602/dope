# Forward correction plan — Assessment failures and Managed / Unmanaged context

**Date:** 2026-11-09. **Status:** owner-requested plan update; documentation only, NOT IMPLEMENTED / NOT RUN / NOT QUALIFIED by this update. **Product version:** `0.13.11` unchanged. **Inspected evidence HEAD:** `d60df6b6854424fcaa5418353a6f63f506ddac98`. The three R11 runs used unchanged product source `868e428d7e7e85589dce0c9133db5e8d87bc767c`.

This is the forward correction plan for the owner's Chat settings decision: replace numeric input/output fields with one per-Chat **Context limits: Managed / Unmanaged** toggle; Managed chooses budgets by actual message, command, stage and tool operation; Unmanaged delegates context management to Pi within real model/provider capacity. The owner has now asked to incorporate the supplemental 32K/64K evidence. These are planned changes, not a claim that the current settings or runtime already implement them.

The immediate ordering is **precise failure attribution → consistent operation policy and targeted repairs → a complete protected Assessment → qualification of both context modes → capacity comparison only if a remaining question requires it**. The settings feature is retained; it is not presented as an established cure for the recorded failures.

## 1. Evidence and conclusions

Read the [original R11 report](qualification/p8-r11-context-output-capacity-2026-11-09.md), [supplemental benchmark](qualification/p8-r11-supplemental-32k-64k-benchmark-2026-11-09.md), and [R10 continuation report](qualification/p8-r10-pi-continuation-recovery-2026-11-09.md). Preserve all historical reports and executed prompts unchanged.

| Observed run | Dope input / output allowance | Source coverage | Stage outcomes | Last acknowledged broker result | Result / elapsed |
| --- | --- | --- | --- | --- | --- |
| 16,384 context | 8,192 / 2,048 | 4/5; entire late guide | 4 accepted, 4 rejected | Final guide read, request 3 / tool 16 | `tool_protocol_unknown`; 87.7 s |
| 32,768 context | 8,192 / 4,096 | 4/5; entire late guide | 3 accepted, 1 rejected, 1 idempotent | Final guide read, request 3 / tool 16 | `tool_protocol_unknown`; 85.8 s |
| 65,536 context | 8,192 / 4,096 | 1/5; clamp source only | 1 accepted, 0 rejected | `search_paths`, request 3 / tool 6 | `tool_protocol_unknown`; 36.3 s |

All three used the same product source, served artifacts and tracked fixture bytes. The supplemental runs were separately owner-authorized after the original R11 stop. Loaded context was verified at 32K and 64K, including refreshing the initially stale 64K AI Center display. No memory-exhaustion or resource-limit code was observed; coarse RAM readings do not establish peak memory. The original 16K load was restored.

**Established:** more configured capacity did not complete either observed supplemental Assessment. No run had an output-limit pause, Continue decision, successful `assessment_finish`, or sealed Assessment. Provider input/output/reasoning usage and the underlying worker exceptions were not saved: they remain UNKNOWN, not zero.

**Not established:** exact root cause; whether the three failures share a cause; active request context occupancy; adequacy of a 4,096 output allowance for a successful Assessment; suitable Managed preset numbers; a speed or quality advantage for any context size. The 16K comparison changes both context and output allowance. The single 32K/64K runs hold output allowance fixed but end in an unresolved failure after different amounts of work.

**These runs did not test Unmanaged.** They retained the 8,192 Dope input budget and existing runtime quotas. Larger loaded context does not itself disable application budgeting. Do not equate cumulative token usage, an input budget, or a loaded maximum with actual current context occupancy.

R10 repaired a reproduced second-Continue worker-disposal defect and observed ordinary Chat continuation. It did not establish R9's original first-Continue cause or live protected Assessment continuation. Carry that scoped evidence forward without merging distinct failure histories.

## 2. Source-supported failure candidates

At the inspected source, [worker.mjs](../../../packages/pi-runtime/worker.mjs) contains:

- Assessment-specific limits of 128 tool executions and 64 model calls.
- A separate generic Chat-tools check that aborts on the seventeenth `tool_execution_start`.
- A shared completion error for attempted tools, missing assistant, error/aborted stop reasons, unsupported finish reasons and remaining tool-call content.
- Message-text classification that maps that shared error to `tool_protocol_unknown` because it contains the words `tool call`.

The generic 16-tool check conflicts with the larger Assessment allowance. Its failure path is a concrete, testable source defect candidate and matches the 16K/32K last-acknowledged-tool-16 pattern. **Do not assign it as the historical cause without reproduction and matching evidence.**

The 64K run's last acknowledgement is tool 6, following a denied read and successful discovery operations. That is a second failure signature to investigate. A receipt is not a complete log of attempted tool-start events, so it neither identifies a failing next operation nor establishes a definitive tool-start count. Do not force this run into the tool-16 explanation.

The [host](../../../packages/theia-extension/src/node/pi-runtime-host.ts) computes `brokerResultAcknowledged` from the absence of an active tool plus a valid earlier receipt. It establishes prior delivery acknowledgement, not subsequent model or worker success. The [conversation adapter](../../../packages/theia-extension/src/node/pi-conversation-runtime.ts) currently presents the broad unknown code as a transport stop. Consequently, the saved code alone is **not proof of a wire-transport defect**.

## 3. Required diagnostics and decisive reproductions

Use the existing Chat execution, tool-event and failure records. Add no parallel diagnostics database or compulsory diagnostic model call.

Persist bounded structured failure metadata at its origin and carry it through worker → host → adapter → Chat:

- Stable cause code and origin/stage, distinguishing a policy limit, broker denial/failure, invalid model call, genuine reply/protocol defect, provider failure, missing/invalid final assistant, cancellation and compaction failure.
- Execution/request correlation; last acknowledged operation separately from the current or failing operation.
- Tool starts, actually executed tools, model-call count, resolved operation profile, applicable boundary, configured limit and observed value.
- Final assistant presence, stop reason and content-type flags where available.
- Actual request output allowance, loaded capacity and resolved reasoning setting, rather than only the UI label Auto.
- Per-call provider usage/finish metadata when available, retained even if a later operation fails. Missing values remain unknown; estimates must be labeled and distinct from provider measurements.

Do not persist raw prompts, tool arguments, file bodies, credentials, arbitrary exception text or reasoning to obtain those fields. Use typed cause enums and validated metadata, not a broad regular expression over generic error prose. Keep raw prior reports unchanged.

### Reproduction A — more than 16 productive operations

Use the actual bundled worker and host against the existing deterministic local mock-provider/SSE pattern. Open a protected Assessment session and issue more than 16 distinct valid operations with exactly one acknowledgement each. Vary arguments/results so the fixture does not trigger the separate unchanged-evidence loop guard.

Record the pre-repair seventeenth-start behavior and emitted failure frame. After repair, prove the permitted Assessment reaches its actual resolved boundary and can complete. Also exercise the configured boundary plus one and require a specific policy-limit outcome. The unknown transport label must not be the result of a normal application budget decision.

### Reproduction B — early failure with an earlier acknowledged result

Exercise the denied-read → valid discovery sequence separately and inject distinct completion failures after six acknowledged calls. Prove that failure provenance identifies the actual condition and retains the previous receipt without blaming its successful operation. This tests the diagnostic gap; it does not manufacture the historical 64K cause.

Preserve malformed/unmatched/duplicate reply, failed/denied broker result, cancellation and worker-loss cases. At least one classification test must traverse the real worker's emitted failure frame and host mapping; a direct `dispatch()` test alone omits the outer error classifier. If the real early failure remains unreproduced, retain UNKNOWN and collect an accurately classified result in the later targeted live gate.

## 4. Context-mode product contract

### Settings

Replace **Input token budget** and **Output token reserve** with one **Context limits: Managed / Unmanaged** control, default Managed. No numeric inputs in Advanced and no preset dropdown. One short helper sentence describes the selected state.

Persist the mode per Chat and snapshot it with the active execution. Settings changes affect the next turn. Existing Chats remain readable and normalize to Managed; obsolete numeric fields must not remain hidden live overrides. Preserve existing selected model, history and source permissions through their current owners.

Use the existing Chat settings sheet, semantic theme tokens, accessible control labels/focus and narrow-layout behavior in [the Chat visual contract](../../ui/chat-panel-visual-contract.md) and [ADR 0016](../../decisions/0016-dope-dark-visual-identity.md). This is a small control replacement, not a second settings surface.

### One resolved policy

Resolve a versioned operation policy once from trusted command/stage metadata and actual selected-model capabilities, with deterministic per-operation adjustments where needed. Send that resolved contract through the composer, backend, model bridge, host and worker. Keep preset constants and their precedence in one owner; the worker validates the received policy rather than applying unrelated hidden constants.

Select protected profiles only after normal command dispatch. A slash command mentioned in prose or a code block must not change command routing or select a privileged execution profile. Budget selection grants no tool authority.

Separate at least: input composition allowance, next model-call output allowance, tool-result page/byte allowance, staged document/prompt size, and any discretionary whole-run budget. Record which one caused a stop. A tool-result page limit is not a total-source-inspection limit.

### Managed profiles

| Trusted operation | Intended budget shape |
| --- | --- |
| Ordinary Chat | Modest generation, adjusted for reasoning capability and explicit requests for detail. |
| Project investigation | More productive source/tool turns and relevant context than a short answer. |
| `/docs-review` | Source reading plus adequate generation/staging for each changed document. |
| `/prompt-ass` | Required file pages, compact findings and all Assessment categories; no inherited ordinary-Chat tool cutoff. |
| `/prompt-plan` | Larger structured planning allowance for dependencies, acceptance and T1/T2/T3 validation. |
| `/prompt-write` | Generous per-prompt/per-file output, incremental staging and completion of the requested stack. |
| `/gen-roadmap` | Current Phase-generation call, preserving sequential generation. |
| `/roadmap` edit | Selected elements and proposed operations. |

Status receipts stay small. Reads use source-bound paging, searches/listings use bounded pages, and substantial prompt/document operations receive adequate payload space. Allow complete required source inspection through additional pages. Generation allowance is chosen before the next inference using known stage metadata; returned tool content is sized after the tool operation is known.

The failed benchmark does not calibrate numerical presets. Document initial candidate values and capacity-fitting rules during the scoped policy work and qualify them against successful tasks. Do not declare 4,096, 32K or 64K a proven recommendation. Budgeting must respect actual loaded/model capacity and preserve task instructions and required evidence rather than silently clipping them.

### Unmanaged semantics

Bypass Dope's discretionary input/output quotas, generic tool/model-call quotas and cumulative generation/continuation ceilings. Use Pi's native context handling and supported recovery within the actual model/provider capacity. No fallback to an old 2,048-token allowance, bridge-only 4K/8K artificial cap, or fixed segment/output allowance under another name.

This does not change the loaded model automatically or imply infinite provider capacity. Keep user cancellation, source/owner identity, tool permission checks, reviewed publication and malformed-payload protections. Explicit stalled/unchanged-evidence handling and justified I/O/idle protections must identify their own purpose, not masquerade as token exhaustion.

Audit the existing compaction suppression and `willRetry` rejection rather than simply deleting all guards. Qualify Pi-supported continuation with retained receipts and fresh broker checks; no hidden restart of the original request or reauthorization of prior effects. Preserve the repaired R10 iterator ownership.

Keep the existing separately saved Ask/Allow/Cancel continuation preference for genuine unhandled provider length stops. Selecting Unmanaged must not silently change that preference, nor may Allow reintroduce Managed cumulative quotas. Native Pi recovery should be handled before Dope reports a terminal incomplete result where supported.

Audit transport/storage boundaries such as the 64 KiB answer check and 12,000-byte tool reply bound. Where an integrity boundary remains necessary, page/stream content and preserve complete artifacts. Never advertise Unmanaged while silently discarding results or throwing a misleading context error at a different hidden quota.

## 5. Ordered implementation responsibilities

These are planning work packages, **not authored executable prompts or permission to Run**. Preserve original P1–P8 and earlier recovery prompts. Split any package that cannot meet the ordinary <=8-minute implementation/focused-validation target; shared T2 and final manual T3 retain their intended broader scope.

| Order | Tier | Responsibility and done condition |
| --- | --- | --- |
| 1 | T1 | Failure attribution and deterministic reproductions A/B. Preserve causes through the real worker/host boundary, distinguish policy from protocol, and retain acknowledged receipts on later failure. |
| 2 | T1 | Shared operation-policy resolver and validated worker contract. Resolve mode/command/stage/capacity and eliminate contradictory generic enforcement. Prove productive Assessment passes tool 16 when its policy permits it, with a precise result at the actual boundary. |
| 3 | T1 | Chat mode schema, old-record normalization and execution snapshot. Old numeric values become inactive; settings changes cannot alter a running turn. |
| 4 | T1 | Runtime input/output and tool-budget wiring for both modes. Every affected layer honors the same policy; operation paging and staging complete required work without a hidden ordinary-Chat quota. |
| 5 | T2 | Pi compaction/recovery, continuation and result-retention integration. Preserve R10 lease ownership, partial/staged progress, source/permission checks and no effect replay. Reconcile necessary transport/storage bounds instead of moving failure later. |
| 6 | T1 | Replace numeric fields with the one persisted toggle in the existing settings sheet. Verify state/helper text, Save, reload, keyboard/narrow/theme and next-turn semantics. |
| 7 | T2 | Consolidated affected integration. Actual requests differ appropriately for ordinary Chat vs prompt commands; Unmanaged bypasses old overrides/quotas; precise failures, cancellation, project/model drift and existing protected publication boundaries remain correct. |
| 8 | T3, manual | Final connected Codex-browser qualification on an identified served candidate. First complete a five-file protected Assessment, then prove both mode behaviors and the settings UI. Keep capacity tuning conditional and separate from feature qualification. |

Dependencies: 1 supplies truthful failures for 2 and later steps; 2/3 feed 4; 4 feeds 5; 3/4 feed 6; 5/6 feed 7; 7 precedes the sole final manual gate. Do not delay a necessary failure/authority regression until final qualification.

## 6. Source owners and focused validation

| Boundary | Existing owner/source | Narrow existing tests to extend when affected |
| --- | --- | --- |
| Worker lifecycle, counts, completion and error frame | `packages/pi-runtime/worker.mjs` | `test/unit/pi-runtime.test.mjs`, `pi-transport-fault-matrix.test.mjs` |
| Host acknowledgement, failure propagation and retained lease | `pi-runtime-host.ts`, `pi-conversation-runtime.ts` | `pi-runtime.test.mjs`, `pi-conversation-runtime.test.ts` |
| Selected capacity and request budgets | `pi-model-bridge.ts`, `chat-context-composer.ts`, `chat-backend.ts` | `pi-model-bridge.test.ts`, `chat-context-composer.test.ts`, `chat-backend.test.ts` |
| Settings, execution diagnostics and persistence | `packages/chat/src/index.ts`, `packages/chat/src/node/chat-repository.ts` | `chat.test.ts`, `chat-repository.test.ts` |
| Settings control and projections | `chat-panel-widget.ts`, controller/presentation | `chat-panel.test.ts`, `chat-presentation.test.ts` |
| Required source coverage and guarded Assessment finish | existing prompt draft / incremental Assessment owners | `prompt-draft-store.test.ts`, `prompt-authoring-stage.test.ts`, `incremental-proposal-controller.test.ts` |

Extension filenames in the table are under `packages/theia-extension/src/node/` except the browser settings/controller/presentation files. Confirm each affected producer/consumer before editing; introduce a small shared policy module only within the existing ownership boundary.

Both Pi test files import the worker source and compiled extension `lib`; build changed `@dope/chat` / `@dope/contracts` / extension outputs in actual dependency order before tests that consume them. Do not run against stale compiled output. For the first worker/classification slice, the initial focused pair is `node --test test/unit/pi-runtime.test.mjs test/unit/pi-transport-fault-matrix.test.mjs` after required affected builds; broaden only for a changed consumer or a concrete regression.

Use the [workflow](../../workflow.md) efficiency, T1/T2/T3, UI and human-usability gates. No blanket aggregate or Electron package build for every slice. No timing or successful test result is claimed by this plan.

## 7. Final live gates and capacity follow-up

Start with the restored 16K load unless a measured requirement justifies another configuration. Record actual loaded context, resolved mode/profile/output allowance, reasoning setting, source/artifact hashes, per-call usage where supplied, tool counts and terminal cause. Use fresh tiny disposable fixtures with the same tracked five files; no automatic large-repository clone or context-size sweep.

**Gate A — protected Assessment completion:** on one unchanged product candidate, actually inspect all five files, including the late guide bytes; stage all required Assessment categories, source-backed findings, scope and validation tiers; execute guarded `assessment_finish`; persist one sealed Assessment and correct Plan availability. Existing source hashes and staged work must remain truthful. File coverage alone is insufficient. More than 16 productive calls is mandatory deterministic coverage; do not pad the live run with useless calls just to reach a number.

**Gate B — both settings modes:** a successful Managed Assessment may satisfy Gate A and the Managed case together. Exercise Unmanaged on the same served candidate and comparable fixture, verifying effective runtime behavior rather than just a saved toggle. Include a short ordinary Chat, a substantial protected command, reload/persistence and cancellation. Genuine provider-length recovery and compaction require targeted evidence where affected; ordinary-Chat continuation does not alone qualify protected Assessment continuation.

If a required live case fails, retain the precise outcome and incomplete draft. Do not seal from partial coverage, loosen citations, skip `assessment_finish`, silently restart work or claim that a settings UI pass qualifies Assessment. An unreproduced historical cause remains unknown even if the current candidate later succeeds.

**Only after reliable completion, if capacity is still a concrete question:** perform a small matched comparison holding output allowance, source, task, reasoning configuration and success criteria fixed while varying loaded context. Change output allowance in a separate matched comparison. Use repeated successful workloads before ranking speed or choosing a default. A failed early run is not faster successful work. The feature does not require another automatic 16K/32K/64K sweep.

## 8. Disposition and relationship to existing work

The owner-directed context modes extend the earlier [ADR 0052](../../decisions/0052-chat-generation-limit-continuation.md) and [output-continuation contract](../../planning/p13/chat-output-limit-continuation-contract.md): retain truthful partial state and the owner continuation preference, while replacing discretionary fixed quotas with the resolved mode policy. Earlier implementation/qualification records keep their original meaning.

Preserve [ADR 0056](../../decisions/0056-named-prompt-authoring-chain.md), the [named-chain contract](../../planning/p13/named-prompt-authoring-chain-contract.md), existing approval/publisher owners and all R9/R10/R11 evidence. This plan does not fix or retrospectively classify any recorded run, start Plan/Write/publication/Work, advance a Gate/Phase, select a global model/context default or change product version.

**Current disposition:** protected Assessment and c13-pfix remain NOT GREEN. The [Phase 13 recovery sequence](../p13/recovery/implementation-plan.md) retains its separate handoff/evidence/final qualification obligations. Future executable prompts and their Run are separate work; this update only makes the correction plan concrete and evidence-backed.
