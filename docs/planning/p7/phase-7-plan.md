# Product Phase 7 — AI Presence Plan

Status: **ACTIVE / PHASE 7A P1-P12 WRITTEN / PHASE 7B-7C RESOLVED + PROMOTED**
Activation baseline: coherent `0.7.0` at commit `59c7f72a29dcdecdf9b908176754bfd02179b004`
Package family: `0.7.x`
Primary decisions: ADR 0025 and ADR 0026
Resolved planning history: `phase-7b-ai-center-worksheet.md`, `phase-7c-ai-roles-routing-worksheet.md`

## Goal

Make AI a durable, movable, provider-independent collaborator inside Dope while keeping the software project—not chat—as the center of gravity.

A developer should be able to create and organize project Chats, open different Chats in different workbench areas, choose which connected model receives each message, configure per-Chat context/model policy, reuse bounded project and saved-chat context, and return after restart without depending on provider-native session state.

Phase 7 also establishes one user-global **AI Center** for provider/runtime connections and a policy-based role-routing layer so later features can request appropriate AI capability without inventing their own provider configuration. Phase 7 remains read-only with respect to general project mutation. It prepares the collaboration/runtime/context/routing foundation that later Scoped Delegation can use without granting mutation authority early.

## Phase 7 sequencing

Phase 7 is one roadmap phase with three ordered slices:

### Phase 7A — AI Presence

The existing P1-P12 stack owns:
- durable Chat domain/persistence/service;
- reusable ChatPanel and saved-chat organization;
- one-live-panel-per-Chat ownership/restoration;
- conversational Model Runtime extension;
- application-level Model Connections registry;
- Local/Gemini/OpenAI conversational adapters;
- per-message model selection and per-Chat settings;
- bounded project/saved-chat context composition;
- read-only Ask / Explain / Trace / Find Related behavior;
- direct GUI/live-provider/restart/package qualification.

### Phase 7B — AI Center

After 7A qualification:
- repurpose the bottom-left account/profile action into an **AI** launcher;
- open/reveal a dedicated center-workspace **AI Center**;
- move account/profile management under Settings;
- project the existing Model Connections registry as one global connection-management surface;
- manage Local/LM Studio, OpenAI, Gemini and future connections in one place;
- expose discovered models, capabilities, readiness/health, refresh/reconnect and connection testing;
- persist only safe non-secret user/application configuration;
- keep credentials/tokens out of `.dope/`, Chat state and ordinary plaintext preferences;
- design the UI/contracts as role-ready without creating a second provider registry;
- use one logical machine-local/application-global revisioned registry across projects/windows/processes;
- use Environment / Session-only / OS secure-storage credentials with no plaintext fallback;
- preserve immutable connection/model identity, bounded model discovery, normalized health and synthetic zero-project-data Test Connection semantics.

### Phase 7C — AI Roles & Routing

After AI Center:
- add global `AIRolePolicy` configuration over connected models;
- initial roles are **Interactive**, **Deep Reasoning**, **Background**, **Software Map**, and **Coding Agent**;
- roles express preferred targets, permitted fallbacks, required capabilities and constraints rather than one fixed model alias;
- features may request a role + constraints instead of hard-coding provider names;
- explicit user model choices remain authoritative and do not silently fall back;
- feature privacy/egress/locality/authority constraints cannot be weakened by global preferences;
- Phase 8 Background execution must be local-only with hosted fallback forbidden;
- Software Map preference does not replace ADR 0022's explicit provider/readiness/evidence-egress authority;
- use five fixed role IDs with deterministic preferred + ordered fallback routing, typed hard constraints vs soft preferences and no dynamic score ranking;
- migrate Chat model policy so existing 7A Chats preserve exact defaults while new 7C Chats default to Follow Interactive;
- keep role fallback bounded/conservative, preserve unresolved target intent, and record durable routing provenance with a Why this model? explanation;
- global role policy may restrict egress but never grant feature/user egress consent.

The currently written P13 evidence-only closeout predates ADR 0026 and is **superseded / must not execute as the final Phase 7 closeout**. After P12, regenerate the contiguous P13+ continuation and exactly one new final closeout using `/prompt-ass -> /prompt-plan -> /prompt-write p7`. Do not disguise 7B/7C as a correction stack.

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

### AI connection and routing contracts
- `AIConnection`, `AIModel` and `AIRolePolicy` are distinct concepts.
- Connections and role policies are user/application state by default, not project truth.
- Features consume the shared Model Runtime/connection registry rather than owning independent provider inventories.
- Persistent secrets require a secure application/runtime boundary; they never live in `.dope/` or ordinary plaintext persisted state.
- Resolution precedence is explicit per-message/feature choice -> Chat policy where applicable -> feature-requested role + constraints -> global role policy -> permitted fallback.
- Role fallback is allowed only when the initiating policy permits it and all feature constraints remain satisfied.
- Connection/routing preference never grants feature-level evidence-egress or mutation authority.

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

Use clear ownership boundaries rather than one large Theia chat widget or feature-owned provider stores:

```text
AI Center
    -> Model Connections / Model Registry
        -> Model Runtime -> provider adapters
    -> Role Policies

ChatPanel(s)
    -> ChatService
        -> ChatRepository -> .dope/chats/
        -> Context Composer -> Dope project/domain readers
        -> Model Runtime / role resolution
```

ADR 0022 Model Runtime remains the provider execution seam. sMap synthesis strategy remains separate from general conversational orchestration. ADR 0026 adds the global AI Center/role-policy layer without allowing it to bypass Software Map or Phase 8 authority constraints. Provider adapters do not own Chat identity, settings, context policy, role policy or product semantics.

## Validation strategy

### Phase 7A
Use the already-written P1-P12 focused/integration/qualification plan. P12 is the direct GUI/live-provider/restart/package qualification handoff for the AI Presence slice.

### Phase 7B
Qualification must directly prove:
- the bottom-left AI launcher opens/reveals AI Center and account/profile management remains available under Settings;
- Local/OpenAI/Gemini connections are represented through one registry without duplicate ownership;
- model discovery/readiness/refresh/test state is accurate and recoverable;
- connection configuration is user/application scoped rather than copied with project `.dope/`;
- secrets are absent from project/Chat/plaintext preference persistence;
- existing Chat and sMap provider consumers still use the shared Model Runtime/registry seams.

### Phase 7C
Qualification must directly prove:
- role policies select compatible connected models by capability/constraint;
- explicit per-message choice wins and failure does not silently route elsewhere;
- permitted role fallback works only within policy constraints;
- Software Map preference does not silently authorize repository evidence transfer;
- Phase 8-compatible Background constraints reject hosted fallback;
- Chat/model provenance records actual execution target after role resolution.

### Final Phase 7 qualification
The final closeout may occur only after 7A, 7B and 7C are implemented/qualified on one coherent `0.7.x` candidate without turning Chat, connection state, role policy or provider state into canonical project truth.

## Non-goals

- no mutation-capable AI/tool execution;
- no ProposedAction/Authority/Tool Runtime implementation merely to support Chat/routing;
- no autonomous coding loop;
- no Phase 8 background drift/alignment monitoring itself;
- no requirement that provider-native sessions survive or be canonical;
- no automatic conversion of chat output into Project Mind/Architecture/Planning;
- no automatic injection of the entire saved-chat archive into prompts;
- no ChatPanel-specific copy of Chat persistence;
- no feature-owned duplicate provider registry;
- no silent model/provider fallback after explicit selection;
- no global preference that bypasses privacy/egress/locality/authority constraints.

## Exit condition

Phase 7 is qualified when durable project Chats/ChatPanels, one global AI Center, and policy-based AI role routing work together as a provider-independent read-only AI collaboration substrate. The developer can manage connections/models centrally, explicitly steer individual turns, define default roles without hard-coding providers, preserve Software Map and background privacy authority, and recover across restart/project/provider failures without provider or routing state becoming canonical project truth.

Execute the current P1-P12 Phase 7A stack only. Do **not** run the currently written P13 closeout. After P12, reassess the implemented connection/runtime surfaces and regenerate P13+ for AI Center, roles/routing, final integrated qualification and final Phase 7 closeout.
