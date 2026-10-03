# Product Phase 7 Implementation Plan

Status: **ACTIVE / PROMPTS WRITTEN / READY FOR EXECUTION**
Activation source/package baseline: `59c7f72a29dcdecdf9b908176754bfd02179b004`, `0.7.0`
Authority: Phase 7 plan/activation, ADR 0004, ADR 0006, ADR 0022, ADR 0025, PRODUCT-MODEL, ARCHITECTURE, stability contract, prompt assessment

## Preflight for every prompt

Read BOOT, AGENTS, current Phase 7 authority, this assessment/plan, all prior `p7` source/evidence and the directly affected current source/tests.

Require:
- reachable activation baseline `59c7f72a29dcdecdf9b908176754bfd02179b004`;
- coherent expected predecessor version;
- clean intended Git state;
- Node 24;
- no root `package-lock.json`;
- Theia exactly `1.75.0`, Electron `42.8.1`, React `19.2.8`.

Do not relabel retained Phase 5/6 evidence. Do not introduce mutation/delegation or Phase 8 background alignment.

## P1 — Chat domain core (`0.7.1`) — T1

Create `packages/chat` / `@dope/chat` as a framework/provider-independent package.

Define strict versioned contracts/parsers/helpers for Chat, ChatMessage/turn lifecycle, ChatSettings/context/model policy, context references, title source, folder/path metadata, provider/model execution provenance and deterministic ordering.

Stable Chat/message IDs are independent from path/provider/widget. Roles/statuses must support visible developer/assistant/system-tool-event conversation and pending/streaming/complete/failed/cancelled assistant lifecycle without hidden reasoning.

Pure helpers own title-edit rules, last-interaction ordering, folder/path validation, context-policy limits and safe transcript/query projections. No filesystem, Theia or provider code.

Add package/workspace/build wiring and focused `chat.test.ts`. Advance all live manifests/internal references coherently to `0.7.1`.

## P2 — persistence, service and backend (`0.7.2`) — T2

Add project-local ChatRepository/store beneath `.dope/chats/` with readable versioned persistence, nested organization folders, stable identity across moves, atomic writes, expected revision, root/path/symlink containment, corrupt/future fail-closed behavior, project isolation, stale/abandoned lock recovery and safe external inspection.

Add ChatService contracts and dedicated Theia backend/RPC attachment. Operations cover attach/list/read/create folder/create chat/move/rename/update settings/begin user+assistant turn/complete/fail/cancel assistant turn/search saved Chats/claim-release live Chat ownership.

Persist lifecycle boundaries rather than every streaming token. On restart, interrupted in-flight assistant turns become visibly interrupted/failed rather than complete.

Use a safe lease/revision mechanism so another process/window cannot become a second writer to the same Chat without detection. Do not put credentials in Chat state.

Add `.dope/chats/` physical-analysis isolation regression coverage. Advance to `0.7.2`.

## P3 — ChatPanel shell and selector (`0.7.3`) — T2

Create focused `chat-controller.ts`, `chat-panel-widget.ts` and related presentation helpers/CSS; do not grow Project Mind/Software Map widget owners.

Register a multi-instance ChatPanel WidgetFactory and supported commands/actions for opening a new panel in left/right/main/bottom shell areas.

Implement Select Chat mode over the shared ChatService: nested folders, chat titles/dates, last-interaction order, New Chat, New Folder, rename/move operations and selecting a Chat into that panel.

Implement basic Chat mode top bar/transcript placeholder using durable messages, including right-justified settings-cog seam but defer the full composer/runtime controls to P6.

Use dark-first theme tokens, keyboard/focus semantics and project/workspace guards. Advance to `0.7.3`.

## P4 — panel ownership and restoration (`0.7.4`) — T2

Implement one-live-panel-owner-per-Chat semantics across all ChatPanel instances.

Selecting an already-open Chat must reveal/focus its existing panel. Returning a panel to Select Chat, switching it or closing/disposal releases ownership. Coordinate frontend ownership with P2 backend claim/lease so another project window/process cannot silently write the same Chat.

Use supported Theia state/widget restoration seams so panel area/mode/chat ID can restore without storing conversation in layout state. Duplicate stale restoration resolves deterministically: one owner, other panel Select Chat.

Guard workspace switch, late load/events, disposal and stale revisions. Advance to `0.7.4`.

## P5 — conversational Model Runtime and Model Connections (`0.7.5`) — T2

Extend `@dope/contracts` Model Runtime with future-extensible provider/model descriptors, connected-model capability discovery and conversational streaming request/event/result types while preserving existing structured generation used by sMap.

Add a dedicated application-level Model Runtime service/registry and Model Connections configuration outside project Chat state. Persist only non-secret connection preferences where safe. Credentials come from supported environment configuration or session-only secret entry; never `.dope/` or ordinary plaintext workbench persistence.

Implement/refactor conversational provider adapters for OpenAI Responses API, Local/LM Studio and Gemini. Keep provider SDK/wire/session IDs behind adapters. Dope supplies transcript/context; provider conversation state is optional adapter optimization only and never required for continuity.

Normalize streaming text, completion, usage, cancellation and safe failure classes. No silent fallback. Preserve sMap synthesis behavior/tests and its separate provider selection.

Expose typed frontend model inventory/connection readiness needed by Chat. Advance to `0.7.5`.

## P6 — composer, per-turn model selection and Chat settings (`0.7.6`) — T2

Complete Chat mode transcript/composer.

Composer always has a text area plus persistent second bottom toolbar row with context/tool seam, compact usable-connected-model selector and send/cancel/retry controls.

Per-turn model selection snapshots on Send and does not rewrite the Chat default. After the turn, selector returns to the persistent Chat default unless the developer sets a new default through settings.

Right-justified settings cog opens per-Chat model/context settings owned by Chat identity: default model, supported reasoning/model controls, allowed context sources, history/context budget and saved-chat retrieval permission. Global provider connection management is linked but not stored in the Chat.

Send persists the developer message/assistant pending execution before runtime submission; stream deltas render live; complete/fail/cancel commits honest durable status/provenance. Retry explicitly creates a new execution attempt and may use a newly selected model only by developer choice.

Advance to `0.7.6`.

## P7 — bounded project context and read-only AI Presence (`0.7.7`) — T2

Implement Context Composer over typed ChatContextRef/provenance.

Support explicit/bounded current file, current selection, project-relative file, Project Mind artifact, canonical Architecture identity, Physical Map/Flow evidence/query context, Planning Map/WorkItem and saved-Chat excerpts. Frontend captures editor/selection; backend validates workspace/path and resolves domain IDs through existing authorities.

Enforce per-Chat allowed-source and token/history budgets using selected model capabilities/estimation where available and conservative fallback otherwise. Active Chat history is direct context under budget; other saved Chats use bounded deterministic search/selection, never wholesale injection.

Wire toolbar context actions plus Ask / Explain / Trace / Find Related read-only behaviors through the same Chat send/runtime path. Model narration cannot create physical/canonical facts.

After first successful exchange, generate an automatic title with the same selected model in a small non-blocking request; no provider fallback. Deterministic first-user-message fallback applies on failure. `titleSource=user` is immutable against auto updates.

Persist context-reference provenance on the turn, not hidden reasoning. Advance to `0.7.7`.

## P8 — direct AI Presence dogfooding and qualification (`0.7.8`) — T3

Use fresh disposable copies of the Dope repository and a second local project. Directly qualify durable Chat folders/title/edit/move, several ChatPanels in different areas, duplicate-open prevention, settings, per-turn model switching, selected-model failure/no fallback, real bounded Dope context, saved-chat retrieval, restart recovery and project isolation.

Use at least two genuinely connected models in one Chat when the environment provides them. If only one can be configured, record the cross-model direct gate as Evidence Gap; do not fake it with mocks.

Prove `.dope/chats/` changes do not affect Software Map physical input identity or Planning staleness.

Run the Phase 7 focused suites, `npm run check`, `npm run test:restart`, `npm run codex:phase:validate -- p7`, Linux AppImage/package/native launch/normal close and exact version/framework/no-root-lock checks. Record `P8-ai-presence-dogfooding-evidence.md` and create the manual `0.7.8` commit only for a coherent completed candidate/evidence checkpoint.

## P9 — evidence-only closeout (`0.7.9`) — T3

Advance coherence only to `0.7.9`, audit A-H Phase 7 evidence, create `closeout.md`, and update README. Do not repair behavior in closeout and do not create Phase 8 prompts.

Reuse valid P8 direct/aggregate/package evidence; rerun only focused tests/builds/version/phase validation invalidated by the `0.7.9` transition.

If Qualified, report eligible for owner `/closeout phase 7` and subsequent Phase 8 docs review. If Not Qualified, preserve blockers and route a bounded Phase 7 correction.

## Expected production shape after P7

```text
@dope/chat
  Chat / ChatMessage / ChatSettings / context refs
  project-local ChatRepository + typed ChatService

@dope/contracts
  provider-neutral structured + conversational Model Runtime contracts

@dope/theia-extension
  Chat backend + context adapters
  application Model Connections / provider adapters
  multi-instance ChatPanel + controller/composer/settings
```

No provider-native canonical conversation, no Agent mutation authority, no general Tool Runtime execution and no Phase 8 background alignment.
