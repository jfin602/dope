# /prompt-plan — c13-output-limit (runner-compatible correction)

**Entry:** approved [ADR 0052](../../decisions/0052-chat-generation-limit-continuation.md), [detailed contract](../../planning/p13/chat-output-limit-continuation-contract.md), 0.13.8 unchanged. **Source:** remote product `079f9a8`, docs-only current head. **Status:** plan only; no implementation, tests, runner or real-browser verification performed.

## Chosen architecture

Build on Dope's one saved Chat/assistant execution and Pi 1.4.0 worker. Current path is ChatBackend -> Models -> piConversation -> PiRuntimeHost -> worker dispatch('turn') -> Pi session -> provider. Tool results are brokered in the opposite direction, and answer completion returns through the same stack. At a provider `length` stop, preserve exact emitted final text and typed activity with the same execution ID; transition to a truthful paused state; accept a checked Stop/Continue decision or apply snapshotted policy; continue **inside the retained Pi session**, not by rerunning original user text. Only a successful stop promotes concatenated final text to canonical answer. Pause/stop/interrupted partials are durable but excluded from normal prompt context and clean final copy. A lost worker cannot be silently resumed; mark interrupted. Keep a conservative cap on automatically resumed segments, protect leases, and ensure tool executions remain fresh brokered events rather than replays.

## Source and consumer map

| Seam | Producer -> consumer | Focused evidence |
| --- | --- | --- |
| Typed Chat states | `packages/chat/src/index.ts`, `service.ts` -> repository, backend, UI | `test/unit/chat.test.ts`, `chat-repository.test.ts` |
| Pi length/segments | `packages/pi-runtime/worker.mjs` -> host, `pi-conversation-runtime.ts` | `test/unit/pi-runtime.test.mjs` with offline OpenAI-compatible SSE, no live model |
| Host/connection | `pi-runtime-host.ts`, `pi-model-bridge.ts`, provider/runtime contracts -> backend | `test/unit/pi-runtime.test.mjs`, `chat-backend.test.ts` |
| Backend owner/choices | `chat-backend.ts`, service operation/leases -> repository + UI controller | `chat-backend.test.ts`, `chat-repository.test.ts` |
| Settings/policies | `ChatSettings`, repository defaults, widget sheet -> effective turn policy | `chat.test.ts`, `chat-repository.test.ts`, `chat-panel.test.ts` |
| Banner/partial display | `chat-panel-controller.ts`, `chat-panel-widget.ts`, shared presentation/theme | `chat-panel.test.ts` and final T3 |
| Answer economy | selected Pi/Chat prompt owner, without extra calls; metric fields | `pi-runtime.test.mjs`, `chat-backend.test.ts` |

**Build truth:** TS tests often import `packages/*/lib/`, so compile changed `@dope/chat`, `@dope/contracts` (when changed), and `@dope/theia-extension` in dependency order *before* tests that import those outputs. Pi worker is source-imported by its fixture, but the same suite uses extension `lib`; do not run it against stale outputs. `npm run test:product` already rebuilds extension and contains extensive unrelated tests; omit it from ordinary P1–P8. No repeated full `npm run check`/packaging; assess final aggregate only at manual P10 if justified and dedupe commands.

## Ordered checkpoints

**P1 — State and persistence (T1).** Add explicit paused/incomplete execution/partial answer schema, safe migrations, authoritative offset/order/idempotency checks. Keep complete-only content context. Extend repository operations for start/pause/append/stop without accepting stale writes. Test old records, dirty ownership, no phantom completion.

**P2 — Worker length capture (T1).** Return provider length + bounded partial answer/usage when available rather than treating as opaque failure. Keep reasoning/answer classification and output caps. Test length with zero final, partial final, and proper stop using offline fixtures. No continuation yet; fail closed elsewhere until P3/P4 wire it.

**P3 — Same-session continuation (T1).** Add bounded segment resume using the retained Pi session; never replay original prompt or tools; capture segment boundaries and appends, enforce model and policy identity, cancellation/compaction/truncation. Test two-part final, second length, broker call count unchanged; fail safely if native behavior unsupported.

**P4 — Worker/host/adapter protocol (T1).** Expose typed `paused`, `resume`, `stop` across worker RPC/host and `piConversation`; retain worker until resolution; bound idle timers, queue and provider byte/token ceilings. Ensure generation lineage one assistant/execution. Test request ordering, lost-host stop, and release.

**P5 — Backend lifecycle (T2).** Bind pause/stop/resume to Chat lease, root, model and assistant ID; persist partial and source/tool receipts; route one owner choice to same runtime; handle fresh turn/project switch/restart without stale actions. Do not rewrite Roadmap/Work authority. Focused backend/repository tests including command non-replay and context exclusion.

**P6 — Chat policies (T1).** Add Ask (default)/Allow/Cancel persisted per Chat with migration. Snapshot at Send, bound automatic segments/cumulative output; fall back to explicit incomplete/blocked outcome at ceiling; never re-authorize tools. Test all policies and reload.

**P7 — Composer and transcript UI (T1).** Add compact nonmodal Stop/Continue notice immediately above composer, truthful incomplete answer label, accessible keyboard/focus/narrow behavior; reuse `--theia-*`/`--dope-*` tokens and existing sheet, preserve drafts and scroll; no extra UI framework. UI structural tests now; visual T3 later.

**P8 — Answer target and metrics (T1).** Provide concise ordinary-answer goal (~1,000 tokens, usually <2,000) without hard cutoffs or extra model summarization; preserve explicit detailed requests and reasoning capability. Expose measured vs unavailable per-segment usage and terminal status; tests for prompt scope and no unexpected provider calls.

**P9 — Headless integration (T2).** One bounded cross-module matrix with fake provider/worker: length in thinking and answer, Ask/Allow/Cancel, sequential and concurrent clicks, cancel/progress, project/model switch, crash/interrupted, no duplicate answers/tools, compaction and source identity, older Chat reads, unchanged Roadmap/work authority. Small directly affected builds/tests; repeat only tests invalidated by fixes. No browser/FireLaunch.

**P10 — Manual browser closeout (T3).** Last, never in ordinary runner. Verify exact served build, real GPT-OSS 20B and UI/policy/restart/narrow/keyboard paths; rerun same FireLaunch prompt read-only, no copy/clone, record actual score, call/byte/token/time metrics. Manual owner verdict and carried gaps. No automatic p13 advancement.

## Efficiency gate / command plan

P1/P6: `corepack yarn workspace @dope/chat build` then focused Chat tests. P2/P3: `npm run check:pi-runtime` (when Pi adapter/bundle changes) then offline fixture; extension `lib` may need a minimal extension build if tests import changed host output. P4/P5/P7/P8: build only directly changed package outputs, then one appropriate targeted node test group. P9 T2 consolidates affected cross-package/adversarial tests and avoids duplicate aggregate nesting. P10 owns actual browser and optional final aggregate/source verification. Every runner prompt must use the exact correction TASK/version/model/Browser-required metadata and meet <=8-minute ordinary implementation target; no self-commits.

## State, blockers and report

All steps are **authored/not run** until separate owner Run. If same-session native Pi continuation, safe leases, bounded output, or lossless noncanonical partial persistence is impossible on current source, STOP and report exact blocker; do not silently broaden scope or claim a successful continuation. FireLaunch baseline remains NOT GREEN 10/100 and Phase 13 remains open. Manual P10 must remain the unique closeout and must not be automatically executed.
