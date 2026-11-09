# /prompt-plan — c13-context-recovery

**Date:** 2026-11-09. **Task source:** [assessment](prompt-assessment.md), [owner forward correction](../c13-pfix/context-policy-correction-plan.md) and R9–R11 historical evidence. **Entry:** repo `c32eb290`, unchanged package version `0.13.11`. **Status:** source-grounded authoring plan, not product implementation or a qualification claim.

## Architecture and data flow

Trusted Chat command dispatcher + persisted Chat settings → ChatContextComposer → ChatBackend turn request → PiModelBridge binds exact loaded model/window → PiConversationRuntime → PiRuntimeHost/worker → Pi 1.4.0 → LM Studio. Brokered tool requests return via host → checked Dope source/owner broker → worker tool receipt → Pi; staged Assessment data remain Dope-owned noncanonical records. The only valid `assessment_finish` creates a sealed Assessment and unlocks Plan.

Add one **resolved operation-policy snapshot** (mode, trusted operation/stage, model identity/window, next-call generation limit if Managed, input composition policy, tool page/output rules and legitimate run limits). The selector runs **after trusted slash dispatch**; model-authored wording and plain quoted slash names cannot select a profile. Keep one resolver as source of discretionary preset constants, with explicit worker-side validation and invariant enforcement. Historical numeric fields are read for migration only, not hidden budgets.

- **Managed:** normal Chat concise; investigation, `/docs-review`, `/prompt-ass`, `/prompt-plan`, `/prompt-write`, `/gen-roadmap` and `/roadmap` get stage-specific capacity-fitting allowances. Output for each model call must be large enough for its actual known stage; bounded tool results are pageable and never treated as full source coverage.
- **Unmanaged:** bypass Dope-specific token/input quotas, arbitrary aggregate model/tool counts and auto-segment ceiling. Pi runs native context handling inside actual loaded/provider capacities; a necessary wire/frame/storage cap uses paging/streaming and an explicit noncontext error. Do not unset broker tool allowlists, typed stage schemas, authority grants, cancellation or repeated identical-action protection.
- **At length:** respect separately saved Ask/Allow/Cancel choice; preserve R10 same-worker/iterator lease and validated novel continuation; no replay of prior broker effects; Pi native safe threshold compaction stays available. If overflow replay cannot be proven effect-safe, fail explicitly instead of secretly retrying.

## Source ownership / task order

| Step | Source owner / producer-consumer | Focused change and evidence |
| --- | --- | --- |
| P1 | `worker.mjs` | Typed internal failure origin; pre/post tool-17 deterministic provider fixture; no raw exception leak. |
| P2 | `pi-runtime-host.ts` → `pi-conversation-runtime.ts` → Chat execution | Propagate precise policy/model/broker/worker failure vs existing receipt; update validated saved diagnostic without weakening sanitation. |
| P3 | Small policy owner (existing contracts/Chat runtime seam) | Versioned resolver: trusted stage + model capabilities → effective budget; strict provenance, no model/prompt-text selection. |
| P4 | `worker.mjs` consumes resolved contract | Remove contradictory generic 16-tool enforcement in protected mode; correct true boundary+1 outcome; preserve duplicate/loop guards. |
| P5 | `packages/chat/src/index.ts` + repository | Persist mode Managed default, parse/migrate historic numeric records, snapshot per execution; tolerate old Chat files. |
| P6 | `chat-context-composer.ts` + `chat-backend.ts` | Apply resolved input/history/context and generation request for each real command; no stale numeric overrides. |
| P7 | `pi-model-bridge.ts`, adapter/worker binding | Capacity-fitted, exact-model output ceiling and no hidden 4K/8K default in Unmanaged; reject real over-capacity requests accurately. |
| P8 | Existing Chat tool broker and protected staging owner, worker tool reply | Per-operation read/list/search/status/stage paging and bounded receipts; complete late source pages/large prompt steps without implicit truncation. |
| P9 | `pi-runtime-host.ts` + `worker.mjs` result frames; Chat answer projection | Distinguish wire frame integrity from aggregate output; stream/chunk persisted complete or explicitly incomplete content, no silent lost tail. |
| P10 | Pi worker, adapter, backend continuation | T2 compaction/length/restore effects and stale cancellation; no resumed command replay, preserve R10 same-session ownership. |
| P11 | `chat-panel-widget.ts` + existing Chat controller/presentation and affected integration tests | Remove numeric fields, implement toggle/helper, Save/reload and verify ordinary vs protected effective policies in one T2 matrix. |
| P12 | Real connected Codex in-app browser on served candidate | Manual T3: exact-source five-file Assessment and mode matrix; scope verdict only. |

P1–P9 are T1 and should remain targeted; P10/P11 T2 integration; P12 T3 manual and final. Some P11 UI/unit work is small but its combined integration gate is the explicit T2 exception. If a prompt exceeds ≤8 minutes for ordinary implementation, reduce its surface and report partial rather than silently omitting guards.

## Implementation contracts and negative cases

**Failure causality:** a worker policy abort after tool 16 must no longer serialize as `tool_protocol_unknown`. Emit a bounded origin/cause code and tool-start/ack counts with last acknowledged operation separately from failed attempt. R11 64K tool 6 must remain UNKNOWN unless directly reproduced. A previous successful ACK does not prove the next model call or transport succeeded.

**Setting migration:** every current Chat parser/serializer and saved Chat source must roundtrip. Preserve history and saved-chat retrieval choices, model/permissions/reasoning options, and the independent limit policy. Ensure no live request takes previously saved `maxInputTokens`/`reservedOutputTokens` as override. Snapshot Managed/Unmanaged at Send; mid-turn Save affects only future turn.

**Tool results:** source paging uses successful offset/hash read receipts. Do not drop, truncate without marking, or count overlapping pages as complete. Separate source reading from material changes: no new publisher or canonical write authority. Typed stage-content limits and file integrity remain guarded. An Unmanaged large output may need reliable chunks rather than an arbitrary oversized protocol record.

**Model/headroom:** no auto-changing LM Studio model context or reasons. Actual input/current-call output must fit loaded/model context, with explicit reserve for system/tools and provider constraints. Token estimates are estimates; cumulative usage is not active context. Compaction summaries are advisory and require revalidation before source/effect claims.

**UI:** one accessible **Context limits: Managed / Unmanaged** control in the current settings sheet. No numeric inputs anywhere, no extra preset picker. Managed default. Descriptive helper line, focus/narrow/reduced motion/alternate theme. Remain in existing Chat, not global AI Center. Existing Ask/Allow/Cancel is a separate generation-boundary preference.

## Testing and build precision

Repo `package.json` shows `npm run check` composes broad typecheck, tests and browser/Electron builds; `npm run test:product` itself invokes broad extension build. **Do not use either by default for P1–P9.** Most extension TypeScript tests import compiled `packages/*/lib`; `pi-runtime.test.mjs` and `pi-transport-fault-matrix.test.mjs` import worker source and compiled extension host. Rebuild changed `@dope/chat` / `@dope/contracts` / `@dope/theia-extension` outputs in dependency order before affected `lib` tests; worker-only source fixture does not require full browser build. Verify actual imports before tests.

Primary files are verified to exist: `test/unit/pi-runtime.test.mjs`, `pi-transport-fault-matrix.test.mjs`, `pi-conversation-runtime.test.ts`, `pi-model-bridge.test.ts`, `chat-context-composer.test.ts`, `chat-backend.test.ts`, `chat.test.ts`, `chat-repository.test.ts`, `chat-panel.test.ts`, `prompt-authoring-stage.test.ts`, `prompt-draft-store.test.ts`, `incremental-proposal-controller.test.ts`. Adapt only the smallest tests directly affected at each step. T2 P10/P11 uses an explicit consolidated targeted matrix; T3 P12 owns browser build and direct live proof. `git diff --check` at applicable checkpoints.

### T3 conditions, not automatic execution

First use restored 16K local GPT-OSS 20B and a fresh tracked-clean disposable **five-file** fixture matching R11. Require all five fully read, guide late section verified, all Assessment categories and T1/T2/T3 staged, actual `assessment_finish`, one sealed record, and correct Plan availability. Also test Managed vs Unmanaged runtime requests, short Chat, substantial protected workflow, reload and Stop. No repeat 32K/64K sweep until protected completion is reliable and a matched capacity experiment remains worthwhile. Capture exact served bundle/hash, model and actual reasoning, effective budget, per-call provider usage if available, duration and honest evidence cases.

No Work Run, Roadmap Gate award, canonical doc/prompt publish, reactivation of c13-pfix or phase progression. Explicit owner action required to execute the authored stack.

## Prompt Efficiency Gate conclusion

Separated origin diagnostics (P1), propagation (P2), resolver (P3), enforcement (P4), schema (P5), composition (P6), model binding (P7), tool result (P8), streaming (P9), recovery (P10), UI/integration (P11), manual closeout (P12). Lowest suitable Sol Medium for narrow data/UI; High for unsafe replay, provider boundary and security integration. One final P12 closeout with Browser required yes; P1–P11 Browser required no. T2 and T3 are intentional aggregate/manual exceptions. No repeated generic builds or model tuning. Read ADR 0016 latest and ADR 0037 for UI task, apply semantic tokens and preserve keyboard/narrow behavior. Source and tests were inspected for authoring only; no implementation or test run claimed.
