# /prompt-ass — c13-output-limit: Chat generation-limit continuation

**Date:** 2026-11-06. **Entry:** product 0.13.8, product source `079f9a8`; approved docs-only authority [ADR 0052](../../decisions/0052-chat-generation-limit-continuation.md) and [contract](../../planning/p13/chat-output-limit-continuation-contract.md). **Status:** assessment only; no product implementation, runner execution, browser qualification, version or phase advance.

## Evidence-led defect

Independent FireLaunch comprehension qualification: `/home/jfin/dev/firelaunch`, GPT-OSS 20B, model context 16,384, per-generation limit 2,048; 3m32s; four successful broker tool calls, only two partially-read documents; `finishReason=length`, 2,041 provider-reported final tokens and provider final text present, but assistant content empty. **NOT GREEN 10/100** is the delivered-answer baseline; neither latent comprehension nor context overflow is established. The source's default Chat output reserve is 1,024, raised to at least 2,048 when reasoning is active. Separate document-coverage failure remains open and must not be silently fixed by this correction.

## Inspected source and exact owners

- `packages/chat/src/index.ts`: `AssistantStatus`, `ChatExecution`, `ChatSettings`, strict parse/lifecycle invariants. `packages/chat/src/node/chat-repository.ts`: default context reserve and active `finish-assistant` write-once terminal mutation; ordinary saved conversational content is complete-only. `packages/chat/src/service.ts` and `packages/contracts/src/model-runtime.ts`: backend RPC/event and provider result shapes.
- `packages/pi-runtime/worker.mjs`: Pi 1.4.0 isolated in-memory sessions, Chat tool protocol, `sessionConsumed`, reasoning/activity separation, provider output/length handling, native guarded compaction, bounded 16 Chat tool calls. In Chat tool mode, final text is only emitted on successful stop. `packages/theia-extension/src/node/pi-runtime-host.ts` supervises the worker/request stream and has a 900-second turn request timeout; `pi-conversation-runtime.ts` creates/releases the host per turn and throws on any `finishReason !== stop`. `pi-model-bridge.ts` binds measured model context and maximum output.
- `packages/theia-extension/src/node/chat-backend.ts`: sends per-turn `planningOutput`, owns project broker/SourceRefs/toolEvents, sequence/delta projection and failure path saving `content: ''`. `packages/theia-extension/src/browser/chat-panel-controller.ts` owns run/cancel, lease and project changes; `chat-panel-widget.ts` owns existing composer/settings/stream UI, activity and scroll. Reuse current settings persistence/visual tokens rather than add a second system.
- `packages/theia-extension/src/node/chat-project-grounder.ts` already does bounded 4,096-byte exact paging with source-hash continuity and legacy clipped reads. Not a target of this correction.
- Existing test seams: `test/unit/pi-runtime.test.mjs` has offline SSE fixtures and imports compiled extension `lib`; `test/unit/chat.test.ts`, `chat-repository.test.ts`, `chat-backend.test.ts`, `chat-panel.test.ts` cover domain, persistence, API and UI, frequently importing built `lib`.

## Safety/compatibility requirements

Preserve the Pi/broker tool boundary, no expanded file access, no re-executed commands, Ask/Allow command approvals, immutable model/project/lease, compaction provenance, exact usage availability, separate reasoning, clean-copy/history isolation, protected Roadmap outcomes and older saved Chats. Distinguish saved incomplete answer from canonical final and from provisional activity. Terminate stale/resume-after-restart truthfully; never claim same-session continuation after worker/session loss. Output cap is not context ceiling. Policies: Ask default, Allow bounded automatic, Cancel retain incomplete. Final answer usually ~1,000 tokens or less as guidance, not a hard cap; respect detailed requests.

## Prompt decomposition and validation classes

| Prompt | Primary owner | Tier | Time target |
| --- | --- | --- | --- |
| P1 | Chat typed states and partial persistence | T1 | <=8 minutes |
| P2 | Pi worker length/partial event capture | T1 | <=8 minutes |
| P3 | Pi same-session resumed segment, no replay | T1 | <=8 minutes if bounded; stop/split on excess |
| P4 | Pi host/adapter pause/resume protocol and lifecycle | T1 | <=8 minutes |
| P5 | Backend continuation owner, lease and persisted actions | T2 | narrowly bounded; no browser |
| P6 | Chat Ask/Allow/Cancel setting and bounded policy | T1 | <=8 minutes |
| P7 | Controller/composer notification, accessible controls | T1 | <=8 minutes |
| P8 | Concise final-answer guidance and truthful usage | T1 | <=8 minutes |
| P9 | Headless integrated adversarial/regression checks | T2 | integration-only; no browser |
| P10 | Real Codex browser + FireLaunch independent regrade | T3 | **manual final closeout only** |

Explicit dependencies: P1 before P5/P6/P7; P2 -> P3 -> P4 -> P5; P5 -> P6/P7; P8 after provider semantics stabilize; P9 after P1–P8; P10 only after P9 and owner handoff. If source proves Pi cannot continue safely, record BLOCKED rather than substitute a fake retry.

## Deferred and risk disposition

Do **not** alter docs discovery/search/paging/compaction strategy, Work generation policy, Roadmap generation control, FireLaunch source/docs, or user-facing model defaults beyond this specific policy. Key risks: Pi session lifecycle, repeated output/duplication, stalled leases/timeouts, output/reasoning classification, inconsistent persisted state, unbounded auto continuation, project/model changes and lost in-memory sessions. Each gets a focused test at its owning checkpoint plus cross-boundary replay at P9/P10. Prior P13/P12 NOT GREEN findings remain.

## Prompt Efficiency Gate (assessment)

Single-owner slices follow actual code boundaries. No implementation prompt requires browser, repository clone, packaging, root aggregate or mandatory summarizer call. Use existing focused tests with just the changed compiled package(s); reserve cross-module tests for P9 and live model/UI for P10. GPT-6 Sol Medium for routine typed settings/UI, High for Pi lifecycle, backend authority and integration. Reassess any P3/P5 implementation that would exceed the 8-minute target before widening its prompt. Final authored prompt audit must verify all P*.txt grammar and no duplicate expensive command invocations.
