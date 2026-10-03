# Product Phase 7 — AI Presence Plan

Status: **ACTIVE / PROMPTS WRITTEN / READY FOR EXECUTION**
Activation baseline: coherent `0.7.0` at commit `59c7f72a29dcdecdf9b908176754bfd02179b004`
Version transition: coherent `0.7.0` activation is complete; executable prompts use `0.7.1` through `0.7.9`
Primary decision: ADR 0025

## Goal

Make AI a durable, movable, provider-independent collaborator inside Dope while keeping the software project—not chat—as the center of gravity.

A developer should be able to create and organize project Chats, open different Chats in different workbench areas, choose which connected model receives each message, configure per-Chat context/model policy, reuse bounded project and saved-chat context, and return after restart without depending on provider-native session state.

Phase 7 remains read-only with respect to general project mutation. It prepares the collaboration/runtime/context foundation that later Scoped Delegation can use without granting mutation authority early.

## Locked product contracts

### Durable Chat
- Every created/used Chat is persisted beneath `.dope/chats/`; no automatic pruning.
- Chat ID is stable identity; folder/path is organization only.
- Nested user folders are supported and form the primary Select Chat hierarchy.
- Chat metadata includes title/title-source, created/updated/last-interacted timestamps.
- Automatic titles are user editable; explicit user title wins permanently over later automatic generation.
- Last-interacted ordering changes on real conversation activity, not view/scroll/panel restoration.
- Chat transcript is durable project context but not canonical Project Mind/Architecture/Planning/implementation truth.

### ChatPanel
- Reusable `ChatPanel` may be opened in left, right, center or bottom shell areas.
- Multiple ChatPanels may coexist and share one project Chat repository.
- Two primary states: Select Chat and Chat.
- Selecting a Chat from a selector opens it in that panel unless the Chat already has a live owner.
- The same Chat cannot be open as an active composer in multiple ChatPanels. Selecting an already-open Chat focuses/reveals the owner.
- Panel layout/restoration is presentation state; `.dope/chats/` owns conversation durability.

### Composer and model selection
- Composer has a persistent second bottom toolbar row.
- Toolbar includes context/tool controls, compact connected-model selector and send/cancel/retry state.
- Model selection is per submitted message. The selected connected model at Send time receives that message/context.
- One Chat may mix turns from Local, Gemini, OpenAI or future providers.
- Actual provider/model provenance is durable per assistant execution.
- No silent fallback to another model/provider after explicit selection.

### Per-Chat settings
- Right-justified cog in Chat top bar.
- Settings belong to Chat identity, not ChatPanel instance/location.
- Persistent context policy may govern eligible sources, history/retrieval/context budget/strategy.
- Persistent model policy may define default model and supported model-specific controls.
- Per-turn composer overrides do not silently rewrite Chat defaults.
- Provider credentials/endpoints/global connection inventory remain application/runtime configuration.

### Context
- Active Chat history is direct context subject to budgeting.
- Other saved Chats remain available through explicit attachment/search/bounded retrieval, not bulk automatic injection.
- Context sources may include editor/selection/files, Project Mind, Architecture, Physical Map, Flow and Planning Maps/WorkItems.
- Turn provenance records useful supplied project references; hidden chain-of-thought is not persisted.
- `.dope/chats/` stays outside generic Software Map analysis/input fingerprints and Planning Map semantic basis.

### Authority boundary
- Phase 7 tools are read/context operations.
- AI may Ask / Explain / Trace / Find Related and suggest future knowledge/planning changes.
- Conversation output does not silently mutate canonical project state.
- General filesystem/process/Git/network mutation and autonomous execution remain deferred to Phase 9 Scoped Delegation.

## Architecture direction

Use clear ownership boundaries rather than one large Theia chat widget:

```text
ChatPanel(s)
    -> ChatService
        -> ChatRepository -> .dope/chats/
        -> Context Composer -> Dope project/domain readers
        -> Model Runtime -> provider adapters
```

The current ADR 0022 Model Runtime seam should be extended, not replaced. sMap synthesis strategy remains separate from general conversational orchestration. Provider adapters do not own Chat identity, settings, context policy or product semantics.

## Prompt-planning workstreams

The subsequent `/prompt-ass` should choose the smallest coherent prompt count and preserve the ordinary <=8-minute target / 15-minute hard budget. Expected workstreams are:

1. **Chat contracts + persistence** — framework-independent Chat/message/settings/folder contracts, safe `.dope/chats/` repository, identity/revision/migration/recovery/project isolation and analysis exclusion.
2. **Chat application service** — queries/events/title/order/move/settings operations plus cross-process conflict/write ownership.
3. **ChatPanel shell + selector** — reusable multi-area panel, Select Chat/Chat modes, folder hierarchy and core keyboard/dark-first behavior.
4. **Panel ownership/restoration** — one-live-panel-per-Chat registry, focus-existing semantics and deterministic restart/layout conflict recovery.
5. **Model Runtime conversational extension** — connected-model enumeration, chat generation/streaming/cancellation, capabilities, normalized error/usage/provenance and no-silent-fallback behavior.
6. **Composer + Chat settings** — two-row composer, per-turn model/context controls, top-bar settings cog and persistent per-Chat policy.
7. **Context composition** — bounded editor/project/Project Mind/Architecture/Physical Map/Flow/Planning/saved-chat context with visible/auditable provenance.
8. **AI Presence behaviors** — Ask / Explain / Trace / Find Related through the common Chat pipeline rather than separate state owners.
9. **Integration/qualification** — exact candidate persistence/restart/project isolation/multi-panel/multi-model/failure/GUI/package evidence.

Do not assume these are final P1-P9 boundaries. `/prompt-ass` owns decomposition after source/test inspection and should merge/split workstreams to keep implementation coherent and fast.

## Validation strategy

### T1 implementation evidence
- pure Chat domain/repository/service tests;
- focused panel/controller/state tests;
- Model Runtime adapter/capability/error tests;
- context-composition/provenance tests;
- `.dope/chats` source-analysis isolation regression coverage;
- affected package typecheck/build only where justified;
- version/framework/internal-reference and `git diff --check` guards.

### T2 integration evidence
- frontend/backend Chat persistence and events;
- multiple ChatPanel instances over one repository;
- live-owner/focus-existing behavior;
- restart restoration and stale panel state;
- real connected reference-provider streaming/cancellation/failure where environment is available;
- context composition across existing Dope domain services.

### T3 qualification
Use the real Dope repository and the packaged/native path where applicable. Directly prove:
- create several Chats and nested folders; automatic title then user edit;
- move a Chat between folders without identity/history loss;
- open multiple ChatPanels in different workbench areas;
- prevent one Chat from being actively duplicated across panels;
- configure per-Chat settings and preserve them after restart;
- send successive turns in one Chat to at least two connected models when the qualification environment has them configured; if only one is available, the missing cross-provider direct evidence is an explicit Evidence Gap rather than mocked Green;
- inspect durable actual provider/model provenance;
- exercise selected-model failure with no silent fallback;
- use real current-file/editor plus Architecture/Flow/Project Mind/Planning or saved-Chat context and inspect the recorded context references;
- restart/reopen and recover Chats/folders/settings/history/order;
- verify a second local project cannot see/mutate the first project's Chats;
- verify Chat writes do not change Software Map physical input identity or stale Planning Maps;
- preserve existing Phase 5/6 qualification history rather than inferring it Green from Phase 7.

## Non-goals

- no mutation-capable AI/tool execution;
- no ProposedAction/Authority/Tool Runtime implementation merely to support Chat;
- no autonomous coding loop;
- no Phase 8 background drift/alignment monitoring;
- no requirement that provider-native sessions survive or be canonical;
- no automatic conversion of chat output into Project Mind/Architecture/Planning;
- no automatic injection of the entire saved-chat archive into prompts;
- no ChatPanel-specific copy of Chat persistence;
- no silent model/provider fallback.

## Exit condition

Phase 7 is qualified when durable project Chats and ChatPanels are useful as a real provider-independent AI Presence surface: persistence, organization, multi-panel projection, model selection/provenance, per-Chat settings, bounded project context, read-only assistance, restart/project isolation and provider-failure behavior all work together on an exact candidate without turning chat or provider state into canonical project truth.

Prompt assessment, implementation planning and `p7` writing are complete. Validate with `npm run codex:phase:validate -- p7`, then execute through the runner. P8 is the direct browser/provider qualification handoff and P9 is evidence-only closeout.
