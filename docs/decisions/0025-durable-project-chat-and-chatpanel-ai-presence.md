# ADR 0025 — Durable project Chat and ChatPanel AI Presence

Status: Accepted
Date: 2026-10-03
Complements: ADR 0004, ADR 0006, ADR 0022, ADR 0024

## Context

Product Phase 7 introduces general AI Presence after Dope already has useful IDE, Project Mind, canonical Architecture, Physical Map, Planning Map and Flow surfaces. The product needs conversation to be useful across sessions without making the IDE subordinate to a provider-native chat product.

Existing authority already requires provider independence and states that Project Mind is not chat history. ADR 0022 deliberately established only the minimal reusable Model Runtime seam before Phase 7 and explicitly deferred chat/session product state. Phase 7 is therefore the correct boundary for a Dope-owned durable conversational domain.

The developer also needs Chat to behave like a native workbench surface rather than one fixed right sidebar: several Chat surfaces may be useful simultaneously, and the same saved conversation should remain available regardless of where a panel is placed.

## Decision

### Chat is durable Dope-owned project context

Every created/used Dope Chat is durable project context persisted beneath `.dope/chats/` unless a future explicit lifecycle action says otherwise. Dope does not automatically prune Chats.

Chat is distinct from Project Mind and other canonical project domains. A conversation may contain useful reasoning, proposals and conclusions, but transcript content does not become a Decision, Architecture declaration, Planning transformation, implementation fact or validation result merely because it was persisted. Promotion into those domains is explicit and developer-controlled.

Provider-native chat/session/response/context identity is never the canonical Chat identity.

### Identity, folders and metadata

Each Chat has a stable Dope-owned ID independent from filesystem location. `.dope/chats/` may contain user-created nested folders used as the primary organization and selection hierarchy. Moving/renaming a Chat or folder preserves Chat identity.

Each Chat records at least title, title source, created time, updated time and last-interacted time. Chats are ordered by real conversational interaction, not merely by being viewed, restored or scrolled.

A new Chat may begin with a placeholder title. Dope may generate an automatic title after meaningful conversation without blocking the turn. Once the developer explicitly edits the title, automatic title generation may not overwrite it.

The storage representation is readable, versioned and provider-neutral. Exact file/bundle layout is an implementation detail owned by ChatRepository, but it must support safe identity, migration/recovery and external inspection with writers stopped.

### ChatPanel is reusable presentation

`ChatPanel` is the reusable workbench presentation type for Chat. Instances may exist in left, right, center or bottom Theia shell areas, with multiple instances open simultaneously.

Each ChatPanel has two primary states:
- **Select Chat** — renders the shared project Chat/folder hierarchy and new-chat/folder organization actions;
- **Chat** — renders one Chat, its top bar/settings, transcript and composer.

All ChatPanels use the same project ChatService/ChatRepository. Panel state never forks conversation state.

A specific Chat may have at most one live ChatPanel owner/composer at a time. Selecting a Chat already open elsewhere reveals/focuses its current panel instead of opening a duplicate writer. Closing that panel, returning it to Select Chat or switching it to another Chat releases ownership. Cross-process/project-window consistency requires backend revision/locking/lease protection in addition to this frontend registry.

Workbench layout/restoration may remember panel location and referenced Chat ID, but conversation persistence belongs to `.dope/chats/`. If restoration attempts duplicate ownership, one panel wins deterministically and the other falls back to Select Chat.

### Composer toolbar and per-message model choice

Every Chat composer has a persistent second row below the text-entry area. This row owns context/tool controls, a compact connected-model selector and send/cancel/retry state.

The selected model is snapshotted when Send is pressed and determines which connected Model Runtime target receives that message and its composed context. One Dope Chat may therefore contain turns executed by different providers/models.

Every assistant execution records durable actual provider/model provenance sufficient for later inspection. Historical provenance is immutable with respect to later model selection changes.

Explicit model choice is developer authority. If the selected model is unavailable, times out, fails or cannot satisfy the request, Dope surfaces the failure. It does not silently route the request/project context to another provider/model. Retrying with another model requires explicit developer action.

The selector lists usable connected models through Model Runtime capability discovery. Chat/domain logic must not spread provider-name conditionals.

### Per-Chat settings

Every open Chat exposes a right-justified settings cog in its top bar. These settings belong to the Chat identity and persist with it across panel relocation/restart.

Per-Chat settings may include:
- model policy and supported model-specific reasoning/context preferences;
- eligible automatic context sources;
- conversation-history/context budget and compaction/retrieval strategy;
- whether bounded saved-Chat search/retrieval may contribute context;
- other conversation behavior that does not override project authority/security rules.

The composer controls the next turn. A per-message model/context override does not silently rewrite persistent Chat settings. Conversely, changing persistent settings does not rewrite historical message provenance.

Phase 7A initially persists an exact default model. ADR 0026 extends the forward Chat model-policy contract in Phase 7C so a Chat may either **pin an exact model** or **Follow Interactive role**. Existing Phase 7A exact defaults are preserved/migrated as exact policies; new Phase 7C Chats default to Follow Interactive. If Interactive is unconfigured/broken, the developer may still explicitly select an exact usable model for a turn.

Provider credentials, endpoints, connection setup and globally available model inventory remain application/runtime configuration rather than project Chat state.

### Context composition and saved-chat reuse

All Chats are durable and potentially useful, but all historical Chats are not injected into every request.

The active Chat supplies direct conversation context subject to an explicit budget/strategy. Other saved Chats are an available project context corpus accessed through explicit attachment, search or bounded retrieval. This keeps historical value without allowing the archive to consume the entire model context window.

Context composition may use existing Dope-owned sources such as current editor/selection, project-relative files, Project Mind artifacts, canonical Architecture, Physical Map, Flow, Planning Maps/WorkItems and selected saved-Chat excerpts. The resulting turn may retain auditable references describing what project context was supplied.

Dope does not persist hidden provider chain-of-thought. Visible transcript, structured tool/context provenance, provider/model execution metadata and explicit project references are sufficient product state.

### Storage and Software Map isolation

`.dope/chats/` is Dope project/work state and is excluded from generic repository source/config analysis. Chat writes do not change Physical Map input identity, trigger architecture re-analysis or stale Planning Maps. Chat context enters AI requests only through the dedicated Chat/context orchestration boundary.

### Phase 7 tool boundary

Phase 7 Chat tools are observational/contextual: add current file/selection, add project knowledge/map/planning context, search saved Chats and similar read-only operations.

Chat existence does not grant filesystem/process/Git/network mutation authority. General mutation, ProposedAction execution and autonomous delegation remain behind future Authority/Tool Runtime and Product Phase 9 Scoped Delegation.

## Architectural ownership

- Chat/domain contracts remain framework/provider-independent.
- ChatService owns conversation operations and events.
- ChatRepository owns project-local persistence, schema/revision/conflict/path safety.
- Context composition owns bounded translation of Dope project state into model-facing request context.
- Model Runtime owns connected-model discovery/capabilities/execution/cancellation/normalized errors/usage.
- Provider adapters own transport/auth/provider-specific wire/session metadata.
- ChatPanel and Chat Settings UI are Theia presentation adapters only.

## Consequences

- Chat becomes useful durable project context without replacing Project Mind.
- Multiple workbench Chat surfaces remain consistent because they project one shared repository.
- A project can continue one conversation across different providers/models.
- Privacy/cost/control are preserved because provider fallback is explicit rather than silent.
- Saved conversation can later support bounded retrieval without making every prompt carry the whole archive.
- Phase 7 can implement observable assistance without pulling mutation/delegation forward.

## Qualification direction

Phase 7 qualification must cover persistence/restart, folder moves, titles/timestamps/order, project isolation, malformed/conflict recovery, multiple ChatPanels, duplicate-open prevention, per-Chat settings, per-turn model routing/provenance, explicit provider failure/no fallback, bounded context provenance, `.dope/chats` analysis isolation and direct Dope-on-Dope GUI use.

The exact prompt stack and version transition are planned separately. Accepting this ADR at repository version `0.6.8` does not itself create `0.7.0` or implementation evidence.


## Amendment — ADR 0026

ADR 0026 extends Phase 7 after the initial AI Presence slice with the global AI Center and role-based model routing. ADR 0025 remains authoritative for Chat identity, persistence, ChatPanel behavior, per-message explicit model choice, per-Chat settings and no-silent-fallback semantics. Global connection inventory and role policy remain application/runtime concerns outside Chat state. Phase 7C extends ChatSettings from an exact default-model-only concept to an exact-or-Follow-Interactive model policy while preserving existing exact defaults. An explicit per-message exact model remains the highest Chat routing authority and continues to forbid silent fallback.
