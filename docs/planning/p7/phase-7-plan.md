# Product Phase 7 — AI Presence Plan

Status: **QUALIFIED / CLOSED AT ACTUAL 0.7.31 / POST-CLOSEOUT c7-chat-project-grounding APPROVED BEFORE PHASE 8**
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

### c7-chat-conversation-ux — Phase 7A correction gate

P1-P12 and the bounded P12 blocker correction are retained Phase 7A history. P13 is the evidence-only `0.7.13` **Not Qualified** audit and remains truthful history. Before the bounded 7B/7C continuation, apply and qualify `c7-chat-conversation-ux` at unchanged `0.7.13`.

This correction owns presentation and Chat organization only: fixed header + scrolling transcript + fixed unified composer; right-aligned developer bubbles; neutral unboxed safe-Markdown assistant output; compact response metadata; bottom-follow streaming that respects manual scroll-away; one durable editable ten-color Chat identity shown in Select Chat and reused by developer bubbles, including deterministic migration/defaulting for older Chats; and visible Chat launcher actions in both left and right side workbench toolbars that reveal the respective side's Select Chat surface without duplicate launcher panels.

It preserves explicit per-turn model selection, no silent provider/model fallback, read-only Phase 7 tools, durable provenance, context composition, ownership/restoration and provider independence. Historical P9/P12/P13 evidence is not rewritten.

Side launchers reuse the existing left/right Chat open commands as the preferred visible entry path. Those side commands should reveal/focus one launcher ChatPanel per side in Select Chat state; center/bottom command-palette opening remains available. Returning an active side launcher to Select Chat releases ownership through the normal ChatPanel path.

### Phase 7B — AI Center

After Phase 7A implementation/evidence:
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
- keep model health/readiness separate from per-request execution eligibility: a known cold/unloaded Local model may remain visible, but unknown loaded context capacity cannot satisfy `usableOnly`/minimum-context execution until load/preflight establishes a safe runtime limit.

### Phase 7C — AI Roles & Routing

After AI Center:
- add global `AIRolePolicy` configuration over connected models;
- initial roles are **Interactive**, **Deep Reasoning**, **Background**, **Software Map**, and **Coding Agent**;
- roles express preferred targets, permitted fallbacks, required capabilities and constraints rather than one fixed model alias;
- features may request a role + constraints instead of hard-coding provider names;
- explicit user model choices remain authoritative and do not silently fall back;
- feature privacy/egress/locality/authority constraints cannot be weakened by global preferences;
- Phase 10 Background execution must be local-only with hosted fallback forbidden;
- Software Map preference does not replace ADR 0022's explicit provider/readiness/evidence-egress authority;
- use five fixed role IDs with deterministic preferred + ordered fallback routing, typed hard constraints vs soft preferences and no dynamic score ranking;
- migrate Chat model policy so existing 7A Chats preserve exact defaults while new 7C Chats default to Follow Interactive;
- keep role fallback bounded/conservative, preserve unresolved target intent, and record durable routing provenance with a Why this model? explanation;
- global role policy may restrict egress but never grant feature/user egress consent.

Phase 7B is **Qualified / Closed at `0.7.23`**. The written `p7c` continuation now owns Phase 7C implementation/qualification and its final P9 owns the one later Product Phase 7 closeout. Do not disguise 7C as a correction stack.

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

### Conversation shell, composer and model selection
- Chat mode uses a fixed top bar, independently scrolling transcript and fixed bottom composer.
- Back, Chat title and the right-justified settings action remain visible while the transcript scrolls.
- The multiline input and bottom controls are one unified composer surface; context/tool actions, behavior shortcuts, compact model selector and Send/Stop/Retry remain inside it.
- Developer turns render as right-aligned Chat-color bubbles; assistant turns render as neutral unboxed formatted Markdown/document text without repetitive visible role-name headers.
- Normal execution/provenance/context metadata is compact and secondary to answer text; failed/cancelled/interrupted state remains obvious and inspectable.
- Streaming auto-follows only while the developer remains at/near the bottom. Manual upward scrolling is respected until the developer returns/jumps to latest.
- Model selection remains per submitted message; one Chat may mix providers/models and actual execution provenance stays durable.
- No silent fallback to another model/provider after explicit selection.

### Per-Chat settings and organizational color
- Right-justified cog remains in the fixed Chat top bar.
- Behavioral settings belong to Chat identity, not ChatPanel instance/location.
- Persistent context and model policy behavior remains unchanged; per-turn overrides do not rewrite Chat defaults.
- Each Chat also owns durable organizational color metadata from blue, cyan, teal, green, yellow, orange, red, pink, purple, indigo.
- New Chats receive a deterministic/distributed color from stable Chat identity; existing Chats without color are deterministically assigned/persisted during migration/defaulting.
- Select Chat shows the color beside the title; developer bubbles use it with readable foreground contrast; assistant content remains neutral.
- Color is editable through a visual ten-color picker in Chat settings, but is Chat metadata rather than model/context `ChatSettings` policy and has no built-in semantic meaning.
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
- General filesystem/process/Git/network mutation and autonomous execution remain deferred to Phase 8 Scoped Delegation.

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

ADR 0022 Model Runtime remains the provider execution seam. sMap synthesis strategy remains separate from general conversational orchestration. ADR 0026 adds the global AI Center/role-policy layer without allowing it to bypass Software Map or Phase 10 authority constraints. Provider adapters do not own Chat identity, settings, context policy, role policy or product semantics.

## Validation strategy

### Phase 7A
P1-P12 and the P12 blocker correction are retained Phase 7A implementation/evidence; P13 records the full Phase 7 audit as **Not Qualified** because 7B/7C remain outstanding. Before 7B/7C continuation, `c7-chat-conversation-ux` must receive focused regression evidence and direct GUI qualification for the fixed shell, unified composer, safe Markdown transcript, compact metadata, scroll-follow behavior, deterministic Chat-color migration/assignment, selector indicator, settings edit and bubble continuity. Passing this correction does not relabel earlier P12/P13 evidence or qualify 7B/7C.

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
- Phase 10-compatible Background constraints reject hosted fallback;
- Chat/model provenance records actual execution target after role resolution.

### Final Phase 7 qualification
The final closeout may occur only after 7A, 7B and 7C are implemented/qualified on one coherent `0.7.x` candidate without turning Chat, connection state, role policy or provider state into canonical project truth.

## Non-goals

- no mutation-capable AI/tool execution;
- no ProposedAction/Authority/Tool Runtime implementation merely to support Chat/routing;
- no autonomous coding loop;
- no Phase 10 background drift/alignment monitoring itself;
- no requirement that provider-native sessions survive or be canonical;
- no automatic conversion of chat output into Project Mind/Architecture/Planning;
- no automatic injection of the entire saved-chat archive into prompts;
- no ChatPanel-specific copy of Chat persistence;
- no feature-owned duplicate provider registry;
- no silent model/provider fallback after explicit selection;
- no global preference that bypasses privacy/egress/locality/authority constraints.



## Post-closeout correction — c7-chat-project-grounding

The final Phase 7 audit was executed after the Green `0.7.31` integrated 7C qualification, but the planned `0.7.32` version/documentation transition did not materialize. Repository truth therefore records Product Phase 7 as **Qualified / Closed at the actual `0.7.31` source**; no `0.7.32` candidate or package is invented.

Before Phase 8, apply one bounded correction at unchanged `0.7.31` to fix a Chat grounding defect discovered in direct use: ordinary repository/map questions are not automatically supplied current project evidence and may invite model-fabricated file/path claims.

The correction adds a backend-owned Project Grounding layer with bounded project-relative directory listing, file reading, path/file search, text search and typed Architecture/Physical Map/Flow queries. Automatic evidence is visible/persisted as Auto context. Project-root realpath containment, project-switch isolation and stale-map rejection are mandatory.

The correction remains observational only and does not authorize writes, process execution, Git mutation, arbitrary network actions or delegation.

After this correction is Green, Phase 8 Scoped Delegation starts from a fresh docs review. Historical P12/P13 and prior Phase 7 qualification records remain unchanged.

## Exit condition

Phase 7 is qualified when durable project Chats/ChatPanels, one global AI Center, and policy-based AI role routing work together as a provider-independent read-only AI collaboration substrate. The developer can manage connections/models centrally, explicitly steer individual turns, define default roles without hard-coding providers, preserve Software Map and background privacy authority, and recover across restart/project/provider failures without provider or routing state becoming canonical project truth.

P1-P12 and the P12 blocker correction are retained Phase 7A history; P13 recorded an evidence-only Not Qualified audit. Next use `/prompt-ass -> /prompt-plan -> /prompt-write c7-chat-conversation-ux` at unchanged `0.7.13`. After that correction is qualified, continue bounded Phase 7B/7C implementation, integrated qualification and a later final Phase 7 closeout. Do not rewrite the P13 evidence record to manufacture Green.
