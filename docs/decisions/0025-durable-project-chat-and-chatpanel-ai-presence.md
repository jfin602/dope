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

## Amendment — c7-chat-conversation-ux (2026-10-03)

The Phase 7A direct Chat qualification and later evidence audit exposed a presentation/organization problem without changing the underlying Chat/runtime authority: the current transcript/composer is functionally valid but reads like an IDE utility/log surface rather than a familiar AI conversation. This amendment supersedes the earlier presentation-only requirement that the composer toolbar be a visually separate second row. It does **not** change per-turn model authority, persistence, context provenance, read-only tool scope, cancellation/retry semantics, or the no-silent-fallback rule.

### Persistent conversation shell

Chat mode has three persistent regions inside each ChatPanel: a fixed top bar containing Back, the Chat title and right-justified Chat settings; one independently scrolling transcript; and one fixed bottom composer. The header and composer never leave view when the transcript scrolls, regardless of ChatPanel workbench placement.

The multiline message field and its bottom control row form one visual composer surface. Context/tool controls, Ask / Explain / Trace / Find Related, the compact model selector and Send/Stop/Retry remain separate controls semantically, but are visually integrated inside the composer rather than rendered as a detached form row. Selected context may appear as compact removable chips/rows associated with that composer.

### Conversation-first transcript

Developer messages render as right-aligned bubbles. Assistant responses render as unboxed document text. Repetitive visible role labels such as **You** and **Assistant** are removed from ordinary turns while accessible semantics still identify roles.

Assistant content is rendered as formatted Markdown/document content, including headings, emphasis, lists, links, inline/fenced code, blockquotes and tables where supported. Rendering must prevent raw/unsafe model-authored HTML or script from becoming an injection path.

Execution status, timestamps, provider/model provenance, context usage and similar response data remain available but visually secondary. Normal completed answers use compact metadata/disclosure rather than full-width metadata blocks. Failed/cancelled/interrupted state remains clearly visible and inspectable.

While an assistant response streams, ChatPanel follows the newest content only while the developer remains at/near the transcript bottom. Manual upward scrolling disables forced auto-follow until the developer explicitly returns to latest; a compact jump-to-latest affordance may restore following.

### Durable Chat color identity

Every Chat owns one organizational color from the existing bounded ten-color palette: **blue, cyan, teal, green, yellow, orange, red, pink, purple, indigo**.

Chat color is durable Chat metadata alongside identity/title/folder/timestamps, not model/context policy inside `ChatSettings`, and has no product-defined semantic meaning.

- New Chats receive one palette color at creation and persist it immediately.
- Default assignment is deterministic/distributed from stable Chat identity so restart, panel location or ordering cannot reshuffle it.
- Existing persisted Chats without color receive a deterministic color from stable Chat identity during ChatRepository migration/defaulting and persist it.
- Select Chat shows a small color swatch/dot beside each Chat title.
- Developer message bubbles use that Chat color with automatically readable foreground contrast; assistant responses stay neutral.
- Chat settings exposes the same visual ten-color picker so the developer can deliberately change color.
- Rename, folder move, automatic-title generation, panel relocation and restart preserve the selected color.

Color is presentation/organization metadata only. It does not affect model routing, context selection, canonical Project Mind/Architecture/Planning truth, last-interacted ordering or provider/runtime behavior.

### Side toolbar Chat launchers

Chat is directly discoverable from both side workbench toolbars without requiring the Command Palette.

- The left primary toolbar/activity bar exposes a Chat action that opens/reveals a left-side ChatPanel in **Select Chat** state.
- The right secondary toolbar/activity bar exposes the same Chat action for the right-side ChatPanel.
- Repeated activation is idempotent per side: reveal/focus the existing side launcher panel rather than accumulating duplicate panels.
- If that side launcher panel currently owns an active Chat, activating the toolbar action returns it to **Select Chat** through the normal ChatPanel navigation path, releasing live Chat ownership normally.
- Existing command-palette Chat commands remain available. Center/bottom ChatPanel opening remains supported.
- Toolbar launchers do not weaken the one-live-owner-per-Chat rule and do not create a second Chat repository or panel state.
- Use supported Theia workbench/view/shell contribution APIs. Do not use DOM injection or private-shell patching merely to place the actions.
- The toolbar icon uses ordinary Theia active/focus styling. Per-Chat organizational color never tints the global Chat launcher.

### Qualification amendment

A bounded `c7-chat-conversation-ux` correction at unchanged `0.7.13` must add focused regression coverage plus direct GUI evidence for the persistent shell, unified composer, safe Markdown transcript, compact metadata, scroll-follow behavior, color assignment/migration/editing and selector/bubble color continuity. Historical P9 implementation text, P12 qualification records and the P13 evidence-only Not Qualified closeout remain unchanged; successful correction evidence supplements them rather than rewriting them.

## Amendment — c7-chat-project-grounding (2026-10-05)

The completed Phase 7 Chat/runtime/routing work exposed a grounding gap that is separate from coding-agent authority: an ordinary Chat turn may contain only recent Chat history, manually attached typed context and the developer's sentence. A repository question such as "what is in test/?" therefore has no guaranteed repository evidence unless the developer manually attached it. A model may then produce a plausible but unverified path or file claim.

This post-Phase-7 correction strengthens Chat's existing observation/context boundary without adding mutation, process, Git, network or delegation authority.

### Project facts require supplied evidence

Dope must not represent a repository file, directory, symbol, Architecture entity, Physical Map fact, Flow fact or other project state as inspected or verified unless current project evidence for that fact was supplied to the model for the turn.

When required evidence is unavailable, stale, out of bounds or cannot be retrieved within the correction's deterministic limits, Chat must surface that limitation rather than inventing project facts.

This is a product contract, not merely prompt wording. Model-facing instructions should reinforce it, but correctness depends on the grounding boundary supplying auditable evidence and failing closed.

### Deterministic project grounding

Before normal project Chat execution, a backend-owned project-grounding boundary may add bounded automatic context when the developer's question clearly requires repository or map facts.

Initial read-only grounding primitives are limited to:
- list a project-relative directory;
- read a bounded project-relative file;
- find project-relative paths/files by bounded deterministic query or pattern;
- perform bounded project text search;
- query canonical Architecture;
- query the current Physical Map;
- query current Flow.

These are context-retrieval operations, not general model-controlled tools. The model does not receive arbitrary filesystem APIs and does not choose unrestricted host paths.

Grounding should prefer deterministic intent/path cues for obvious repository questions before introducing broader semantic retrieval. Advanced semantic project search may be added later when it has its own evidence and performance contract.

### Project-root containment

Every filesystem grounding request is anchored to the Chat connection's already-attached canonical project root.

Public grounding inputs are project-relative. Absolute paths and traversal outside the active project are rejected. Filesystem reads resolve the requested path against the canonical project root, use realpath containment and reject symlink escapes.

Generic filesystem grounding must not read `.dope/` implementation/work-state files. Project Mind, Architecture, Physical Map, Flow, Planning and Chat state continue to enter context through their typed domain readers.

A project switch invalidates automatic grounding state. Evidence retrieved for one project may never be reused for another project merely because a path string matches.

### Small always-on orientation

A project Chat may receive a tiny deterministic orientation block even when no deeper retrieval is triggered. It should identify only non-sensitive current project facts useful for interpretation, such as:
- that the turn is attached to the current Dope project;
- Architecture available/unavailable;
- Physical Map available/current-generation/unavailable;
- optionally a bounded top-level repository outline when inexpensive.

The model does not need the developer's absolute machine path to answer ordinary repository questions. Grounding and provenance use project-relative identities.

### Visible automatic context

Automatically retrieved evidence is visible to the developer as Auto context rather than hidden prompt stuffing.

Automatic references use the same auditable principles as manually attached context: project-relative identity, context kind, bounded size/token accounting, content hash where content is supplied, and project/generation identity for map-derived evidence.

Automatic grounding references persist with the turn so later inspection can answer what evidence the model actually received. They remain non-canonical observations and do not become Project Mind, Architecture or validation truth.

### Ownership

The grounding implementation belongs on the backend beside Chat context composition, not inside ChatPanel presentation code.

The intended shape is:

```text
ChatPanel
    -> ChatService
        -> Project Grounding
            -> bounded repository reader/search
            -> Architecture reader
            -> Physical Map / Flow query
        -> Context Composer
        -> Model Runtime / role routing
```

SoftwareMapIndex remains the source of current Physical Map/Flow state. It is not stretched into a generic repository-search index merely to support Chat.

### Authority boundary

This correction authorizes only observation:
- list;
- read;
- search;
- query.

It does not authorize:
- write/patch/delete;
- process execution;
- Git mutation;
- arbitrary network actions;
- coding-agent delegation;
- any other Phase 8 mutation authority.

The correction therefore remains compatible with Phase 7's read-only collaboration boundary even though it is applied after Phase 7 closeout.

### Qualification amendment

The bounded `c7-chat-project-grounding` correction runs at unchanged `0.7.31` and must directly prove:
- repository-root and nested-directory questions such as root and `test/`;
- existing and nonexistent project-relative paths;
- bounded source lookup for an implementation question;
- canonical Architecture questions;
- current Physical Map/Flow questions;
- explicit failure for `../`, absolute external paths, symlink escape and stale/nonexistent map identities;
- visible/persisted Auto context provenance;
- project-switch isolation;
- unchanged manual context behavior and Chat history budgeting;
- no change to Physical Map input fingerprints or canonical project state;
- no mutation/process/Git/network authority.

A successful correction supplements the completed Phase 7 evidence. It does not rewrite historical P12/P13 results or reopen the qualified 7B/7C routing decisions.
