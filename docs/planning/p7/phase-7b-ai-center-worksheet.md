# Product Phase 7B — AI Center Planning Worksheet

Status: OPEN PLANNING WORKSHEET  
Date: October 3, 2026  
Target slice: Product Phase 7B — AI Center  
Assumption: Product Phase 7A is fully implemented and qualified before this worksheet is resolved.

## Purpose

Resolve the ten highest-leverage product, state-ownership, security and interaction questions for the Phase 7B AI Center before decomposing 7B into its implementation plan and prompt continuation.

This worksheet assumes all Phase 7A capabilities already exist and are working: durable Chats/ChatPanels, the provider-independent conversational Model Runtime, the application-level Model Connections registry, Local/Gemini/OpenAI adapters, connected-model inventory, per-message model selection, per-Chat settings, bounded context composition and read-only AI Presence.

This worksheet does **not** implement or fully design Phase 7C role routing. It may define the connection/model contracts and UI seams that 7C will consume so Phase 7B does not need to be rewritten later.

Resolved answers should be promoted into ADR 0026, the Phase 7 plan, architecture/product contracts, roadmap text, or a follow-on ADR if a decision is broad enough to outlive the implementation stack.

## Already locked

The following are not open questions unless explicitly revisited through the normal decision process:

- **AI Center** is the canonical user-facing name for global AI connection management.
- Phase 7B follows Phase 7A and reuses the Phase 7A application Model Connections registry rather than creating a second provider store.
- The current bottom-left account/profile action becomes an **AI** launcher with an AI-specific icon.
- Activating the AI launcher opens or reveals a dedicated center-workspace AI Center surface.
- Account/profile management moves under ordinary Settings.
- AI Center manages Local/LM Studio, OpenAI, Gemini and future provider/runtime connections through provider-neutral application contracts.
- A provider/runtime **connection** and a **model** are distinct concepts.
- Global connection inventory and safe non-secret configuration are user/application state by default, not project truth.
- Connection configuration does not belong in project-local `.dope/`.
- Credentials/tokens are secret application/runtime state and never belong in `.dope/`, Chat persistence, logs, project provenance or ordinary plaintext preference storage.
- Persistent credentials, when supported, require an appropriate secure-storage boundary such as OS-backed credential storage.
- AI Center preference does not grant feature-level authority or data-egress consent.
- Software Map Analyze Project/Search Deeper retain their explicit provider/readiness/evidence-egress authority under ADR 0022.
- Phase 8 background alignment remains local-only/no-hosted-fallback under ADR 0023.
- Phase 7C will add `AIRolePolicy`; 7B should be role-ready without prematurely implementing role assignment/routing.
- Phase 7 remains read-only with respect to general project mutation.

## Decision worksheet

### Q1 — What is the default AI Center information architecture and interaction model?

**Why it matters**

AI Center will become the one place developers expect to understand and manage every AI runtime available to Dope. If the first screen is too provider-centric, too dense or spread across several nested settings pages, connection management will become harder as providers and models grow.

**Questions to resolve**

- Is the primary view a connection list with a detail pane, provider cards, or a table?
- What information is visible without opening a connection?
- Should models be expanded inline beneath each connection or live in the detail view?
- Where do connection actions such as Add, Configure, Refresh, Test, Disable and Remove live?
- Does the AI Center open as a single reusable center tab or allow multiple instances?
- What empty state appears when no connections exist?
- Which information belongs in AI Center versus ordinary Settings?
- How much status belongs on the bottom-left AI launcher itself?

**Current leaning**

Use one singleton/revealable center-workspace AI Center with a compact connection list on the left and selected-connection/model details on the right or main body. Show provider/runtime name, connection status and a concise model count/readiness summary at list level; keep detailed model capability/configuration information in the selected connection view. Keep the launcher quiet when healthy and use restrained status decoration only for actionable connection problems.

**Decision**

Locked: AI Center is a **singleton/revealable center-workspace tab** using a two-pane **connection list + selected connection detail** layout.

The connection list is the primary navigation surface. Each connection row shows only compact scan-level information: provider/runtime, user-facing alias/name, normalized status, and usable model count/readiness summary. Models do not remain broadly expanded beneath every connection; they are shown inside the selected connection detail so the center remains readable as providers and model inventories grow.

The selected connection detail owns configuration, credential source/status, connection health, discovered/known models, model capabilities, refresh/reconnect, Test Connection, Disable and Remove actions.

The bottom-left **AI** launcher reveals/focuses the existing AI Center rather than opening duplicate instances. Healthy state stays visually quiet. The launcher may show a restrained non-color-dependent warning/status treatment only when an actionable connection problem needs attention; ordinary success does not receive a permanent green indicator, spinner or model count.

The no-connection state is an intentional onboarding surface with a clear **Add Connection** action and concise Local-versus-hosted orientation.

Ordinary application/account settings remain outside AI Center. Account/profile management belongs under Settings. AI Center is organized around **connections**, not permanent provider tabs, so multiple connections of the same provider/runtime type remain a natural product shape.

---

### Q2 — What is the exact lifecycle and stable identity model for an AI connection?

**Why it matters**

Phase 7A already has a connection registry. Phase 7B must make connection creation/editing/removal visible without invalidating references, producing duplicate runtime entries, or coupling identity to a mutable endpoint/name.

**Questions to resolve**

- What creates a new `AIConnection` identity?
- Is connection identity independent from provider type, endpoint URL and display name?
- Can the same provider type have multiple simultaneous connections?
- Can two Local connections point at different LM Studio/Ollama/OpenAI-compatible endpoints?
- What counts as a duplicate connection?
- What are the lifecycle states: configured, disabled, unavailable, removed, invalid, reconnecting?
- Does Disable preserve all metadata and model history while preventing new executions?
- What happens when a connection or model referenced by Chat history/provenance is later removed?
- Is removal destructive or should a tombstone/retired identity remain for historical provenance?

**Current leaning**

Use stable Dope-owned connection IDs independent from provider, endpoint and display label. Permit multiple connections of the same provider/runtime type where configuration differs. **Disable** should be reversible and preserve identity. Removal should stop future use while historical Chat/provider provenance remains readable by stored execution metadata rather than requiring the live connection to exist.

**Decision**

Locked: every `AIConnection` receives an **immutable Dope-owned connection ID** at creation. Identity is independent from provider/runtime type, endpoint, display name, credentials, model inventory and readiness state. Editing any of those properties does not create a new connection identity.

Multiple simultaneous connections of the same provider/runtime type are allowed. Examples include separate Personal/Work OpenAI connections, several Local/LM Studio endpoints, or multiple OpenAI-compatible servers. Dope may warn when a new configuration appears to duplicate an existing provider+endpoint combination, but duplicate-looking connections are not forbidden because credentials, aliases and future policy may differ.

Durable lifecycle and runtime readiness are separate concerns. A configured connection continues to exist when its endpoint is offline, authentication fails or no models are currently usable.

The persistent lifecycle distinguishes at least:
- **Enabled/configured** — eligible for ordinary use when runtime readiness permits;
- **Disabled** — reversibly excluded from new execution while preserving ID and configuration;
- **Removed** — no longer part of the active connection registry/configuration.

Runtime/application status such as Checking, Refreshing, Reconnecting, Unavailable, Needs Authentication or Invalid Configuration does not replace connection identity.

**Disable** is reversible and preserves connection identity, non-secret configuration and references. **Remove** deletes active configuration and makes the connection ineligible for new use, but it must never invalidate or rewrite historical execution provenance.

Historical assistant/model execution records therefore persist enough descriptive provenance to remain understandable without the live connection registry. At minimum they retain the stable connection ID plus provider/model identity and useful execution-time display metadata. If the live connection no longer exists, historical UI may identify it as a removed connection while still showing which provider/model actually produced the execution.

Phase 7B does not require a user-visible deleted-connections graveyard. Historical provenance is durable in the owning Chat/execution record; active connection management remains uncluttered.


---

### Q3 — What is the persistence scope for connection metadata across projects, windows and machines?

**Why it matters**

ADR 0026 says connections are user/application state rather than project state, but implementation still needs a concrete scope. A connection configured in one project should probably be available in another project on the same Dope installation, while copying a repository must never copy credentials or silently configure a hosted provider.

**Questions to resolve**

- Are connections global to one OS user + Dope installation?
- Do all open Dope windows/processes share the same connection registry?
- How are concurrent edits from two windows serialized or reconciled?
- Does a connection survive application restart even if no project is open?
- Is connection configuration intentionally machine-local in 7B?
- Is account/cloud synchronization of connections deferred?
- What non-secret metadata, if any, should be exportable/importable?
- How are stale references handled if application-global state is reset?

**Current leaning**

Make Phase 7B connection metadata **machine-local, application-global, and shared across projects/windows for the same OS user/Dope installation**. Use one backend-owned registry/state authority with frontend projections. Defer account/cloud synchronization. Repository copy/clone must have zero effect on AI connection inventory.

**Decision**

Locked: the Phase 7B connection registry is **machine-local, application-global, and shared across all Dope projects/windows for the same OS user/Dope installation**.

Connections are not project state. Opening, copying, cloning, moving or deleting a repository has no effect on the global AI connection inventory, and no connection metadata is stored beneath project-local `.dope/`.

One backend-owned application registry is the authoritative state owner. All frontend windows and projects observe that same registry. Adding, editing, disabling, removing or refreshing a connection in one window publishes the updated state to other open Dope windows without requiring restart.

Application-global connection state is revisioned and concurrency-safe rather than ordinary last-writer-wins preference data. Mutations carry the expected current revision; stale concurrent writes are rejected/reloaded instead of silently overwriting a newer connection edit.

AI Center and the connection registry remain usable when no project is open. Provider/runtime configuration therefore belongs to the Dope application lifecycle rather than any workspace lifecycle.

Phase 7B intentionally **defers account/cloud synchronization across machines**. A laptop and desktop may have independent connection registries even for the same developer. Future sync or migration can be added later without changing the project-state boundary.

Non-secret connection configuration should remain structurally export/import-ready for a future feature, but Phase 7B does not need to ship cross-machine export/import. Any future profile transfer may include safe fields such as provider/runtime type, display alias, endpoint, enabled state and non-secret options, but never API keys/tokens or other credential material.

Application-global availability does not imply project execution authority. A project may see that a connection exists, but feature-specific privacy/egress/consent rules still govern whether project data may be sent through it.


---

### Q4 — What credential and secret-storage experience does AI Center provide?

**Why it matters**

AI Center is the first centralized place where hosted credentials may be configured persistently. The product needs a secure and understandable experience without making credential storage mandatory for users who prefer environment variables or session-only keys.

**Questions to resolve**

- Which secret sources are supported in 7B: environment variables, session-only entry, OS secure storage?
- Is OS secure storage required before persistent API-key entry is offered?
- What happens if the platform secure store is unavailable or locked?
- Can the user see whether a credential comes from environment, session or secure storage without revealing the secret?
- Are secrets write-only after entry, or can they be revealed/copied?
- How does Rotate/Replace credential work?
- How are secrets removed independently from deleting the connection?
- Do Local/OpenAI-compatible runtimes support optional auth tokens through the same secret mechanism?
- What must be scrubbed from errors, diagnostics and logs?

**Current leaning**

Support three explicit credential sources where applicable: **environment**, **session-only**, and **OS secure storage**. Never silently fall back to plaintext persistence. Show credential source/status but not the secret value. Treat persistent stored secrets as replace/remove operations rather than routinely revealable fields. If secure storage is unavailable, persistent secret entry is unavailable rather than downgraded to plaintext.

**Decision**

Locked: AI Center supports exactly three credential-source classes where authentication is applicable:

- **Environment** — a provider/runtime-specific environment variable or equivalent backend environment source supplies the credential;
- **Session-only** — the developer enters a credential that remains only in runtime memory for the application/backend session;
- **OS secure storage** — persistent credential material is stored through an appropriate operating-system-backed secure-store/keyring boundary.

There is **no plaintext persistent fallback**. If OS secure storage is unavailable, inaccessible or unsupported, AI Center may still use environment or session-only credentials, but persistent secret entry is unavailable rather than silently degrading to ordinary files/preferences.

AI Center shows credential **source and status**, not the secret value. Environment-backed credentials identify the supplying environment key/source when useful without revealing its contents. Securely stored credentials are treated as write-mostly state: normal management actions are **Replace Credential** and **Remove Credential**, not routine Reveal/Copy of the full secret.

Credential lifecycle is independent from connection lifecycle. Removing a credential does not remove the `AIConnection`; the connection remains configured and transitions to an appropriate unauthenticated/Needs Authentication state. Removing the whole connection remains a separate explicit action.

The same credential abstraction applies to hosted and authenticated Local/OpenAI-compatible runtimes rather than creating separate token-storage systems per provider.

Secrets must never be written or exposed through:
- project-local `.dope/`;
- Chat/message/execution persistence or provenance;
- ordinary plaintext application preferences;
- logs or diagnostics;
- telemetry/event payloads;
- cache keys;
- user-visible raw provider errors;
- clipboard/debug exports.

Phase 7B does not need to persist identifying fragments such as the last four characters of a key unless a concrete implementation/security need later justifies it. Credential source + configured/available status is sufficient for the default product experience.


---

### Q5 — How much provider-specific onboarding should AI Center expose inside one shared connection flow?

**Why it matters**

Provider independence does not mean every provider has identical setup. Local runtimes need endpoint/discovery controls; OpenAI/Gemini need authentication and may have different model-discovery semantics. Too much generic abstraction makes setup confusing, while fully custom provider pages recreate fragmented configuration.

**Questions to resolve**

- Does **Add Connection** first choose a provider/runtime type and then open a provider-specific form?
- Which fields are common across all connections?
- Which provider-specific fields are allowed?
- Should Local runtime onboarding auto-detect common endpoints before asking for manual configuration?
- Should OpenAI-compatible custom endpoints be a distinct connection type from OpenAI?
- How are provider-specific disclosures shown without letting adapters own product state?
- Can adapters contribute setup schema/UI while the registry retains state ownership?
- What is the fallback when a future provider needs a setup primitive not anticipated in 7B?

**Current leaning**

Use one shared **Add Connection** flow with a provider/runtime picker and a common connection shell, while allowing bounded provider-specific setup fields/disclosures behind adapter-owned configuration descriptors. Keep lifecycle/identity/status/actions consistent across providers. Avoid forcing Local and hosted providers into identical forms.

**Decision**

Locked: AI Center provides one universal **Add Connection** workflow and one common connection-management shell. The developer first chooses a provider/runtime type, then configures that connection inside the shared AI Center lifecycle.

AI Center/core owns the cross-provider product contract:
- immutable connection identity;
- display alias/name;
- enabled/disabled/removed lifecycle;
- persistence and revision/concurrency behavior;
- credential-source references and secure-secret boundaries;
- normalized status/readiness projection;
- Test Connection orchestration;
- Save/Cancel/Remove interaction;
- AI Center navigation and selected-connection detail.

Provider/runtime adapters may contribute only the configuration behavior that genuinely differs:
- bounded provider-specific fields;
- field validation;
- credential requirements;
- provider-specific disclosures;
- model-discovery hooks/capabilities;
- connection/test transport hooks;
- a bounded custom setup component when a future provider cannot be represented clearly by ordinary fields.

The architectural rule is: **provider adapters may customize how a connection is configured, but not what a connection is**. Provider adapters do not own connection identity, persistence, lifecycle, global navigation or a separate provider store.

**OpenAI** and **OpenAI-compatible** are distinct runtime/provider types. OpenAI-compatible endpoints must not be represented as if they are OpenAI merely because they share a wire protocol. This provides a clean path for self-hosted gateways, enterprise proxies, local servers and future compatible runtimes.

Local runtime onboarding may perform best-effort detection of well-known local endpoints and offer a one-action **Use detected runtime** path. Detection is convenience only; manual endpoint/configuration entry always remains available.

Phase 7B does not require all provider onboarding to be generated from a static schema. The adapter contract should support simple declarative fields by default while permitting bounded provider-specific presentation when necessary without leaking provider ownership into AI Center core.


---

### Q6 — How should model discovery, inventory refresh and model identity behave?

**Why it matters**

AI Center is only trustworthy if the displayed model inventory matches what the connection can actually execute. Local model lists can change frequently; hosted providers may expose incomplete or expensive discovery APIs; some providers may require explicit configured model IDs.

**Questions to resolve**

- Which providers support automatic discovery versus configured inventory?
- When is discovery triggered: Add, open AI Center, manual Refresh, periodic background refresh, connection reconnect?
- How stale can discovered inventory become before the UI marks it stale?
- Are previously known models retained when temporarily unavailable?
- How is a stable `AIModel` identity formed when providers rename/version models?
- Can users hide/disable individual discovered models without altering provider inventory?
- Are unavailable models still visible for historical provenance?
- How are context limits/capabilities refreshed when provider metadata changes?
- Should the Chat composer show only Ready/usable models while AI Center shows the broader inventory?

**Current leaning**

Treat provider discovery as capability-driven. Refresh automatically at bounded lifecycle points such as successful connection/config change/reconnect, plus an explicit manual **Refresh Models** action. Avoid constant polling. Preserve stable Dope model identity as `connectionId + provider model key`, retain unavailable historical entries as non-usable metadata where useful, and expose only currently usable models to normal Chat selection.

**Decision**

Locked: model inventory is **connection-scoped and capability-driven**. Phase 7B supports automatic discovery, explicit configured inventory, or a bounded hybrid depending on the provider/runtime adapter rather than pretending every provider exposes the same model-list API.

A model's stable Dope identity is formed from the immutable connection identity plus the provider/runtime's stable model key:

```text
AIModel identity = connectionId + providerModelKey
```

Display names, aliases, provider marketing labels, availability and capability metadata may change without changing that identity. The same provider-facing model exposed through two different connections is intentionally two distinct Dope model targets.

Model discovery/refresh occurs at bounded lifecycle points:
- connection creation;
- relevant connection/configuration changes;
- successful reconnect or runtime inventory-change signal where supported;
- explicit **Refresh Models**;
- optional stale-while-revalidate behavior when AI Center opens and cached inventory is old enough to justify refresh.

Do not continuously poll provider inventories merely because AI Center exists or receives focus.

Previously known models are not immediately erased when temporarily unavailable or absent from a later discovery response. AI Center may retain them as known non-usable entries with states such as Unavailable / No longer discovered / Unknown and useful last-observed metadata. This preserves understandable Chat/default/future-role references while keeping provider inventory truth visible.

AI Center may show the broader known/discovered inventory. Ordinary execution consumers such as the Chat composer receive only models that are currently **usable and enabled in Dope**.

Phase 7B may support a user/application preference that disables/hides an individual discovered model from ordinary Dope selection without pretending the provider stopped exposing that model. Provider inventory and Dope eligibility are separate facts.

Providers/runtimes without safe/reliable generic model discovery may use explicit configured model IDs. The adapter validates/configures those models through its supported runtime path rather than fabricating discovery.

Capability/context metadata retains source/quality where relevant—for example provider-reported, adapter-known, explicitly configured or unknown. Dope must not present inferred/configured limits as universally authoritative provider facts.


---

### Q7 — What is the connection/model health and readiness state machine?

**Why it matters**

“Connected” is too vague. A provider endpoint may be reachable while authentication fails; a model may be listed but unloaded; a Local runtime may be offline; a hosted model may reject a probe. AI Center needs statuses that are actionable without becoming a noisy monitoring dashboard.

**Questions to resolve**

- Which states belong to the connection versus individual models?
- What is the minimum state vocabulary: Unknown, Checking, Ready, Degraded, Unavailable, Auth Required, Disabled?
- What evidence is required to claim Ready?
- Does discovery success imply model readiness?
- How does Local model loaded/unloaded state appear?
- When is health invalidated after endpoint/auth/model changes?
- Should AI Center perform periodic checks while open? while closed?
- How does reconnection/backoff work?
- Which failures create launcher-level warning decoration?
- How much provider error detail is safe/useful to expose?

**Current leaning**

Use a small normalized state machine with provider-specific detail behind it. Connection readiness and model usability should be separate. Prefer **event/lifecycle-triggered validation plus user-requested refresh** over continuous polling. Only persistent/actionable problems should decorate the AI launcher; transient checks should stay inside AI Center.

**Decision**

Locked: connection health and individual model usability are separate normalized state machines. Provider/runtime-specific detail may be retained beneath them, but AI Center presents one consistent health vocabulary.

Connection states are:

- **Unknown**
- **Checking**
- **Ready**
- **Degraded**
- **Needs Authentication**
- **Unavailable**
- **Invalid Configuration**
- **Disabled**

Model states are:

- **Unknown**
- **Ready**
- **Unavailable**
- **Disabled**

Connection **Ready** means the configured connection is currently usable at the application/runtime level: configuration is valid, required authentication is available, the transport/provider is reachable, and the basic registry/runtime handshake or equivalent readiness evidence succeeds. It does **not** imply every model has completed a fresh inference test.

Model **Ready** means the model is known/configured, its connection is usable, it is not disabled in Dope, and the provider/runtime does not currently report it unavailable. Mandatory fresh inference is not required merely to show a model as usable.

**Degraded** is reserved for meaningful partial usability—for example a connection remains usable while model discovery/refresh or another important non-fatal capability is impaired. Minor informational warnings do not automatically degrade the entire connection.

Local model residency/warm state is separate from usability. A known Local model may be **Ready / not loaded** or equivalent. Unloaded/cold does not mean unavailable; explicit feature warm-up or ordinary execution may load it later.

Health/readiness is updated from bounded events rather than continuous background polling:
- application/registry initialization where justified;
- connection/configuration changes;
- credential-source changes;
- reconnect/runtime inventory-change signals where supported;
- explicit Refresh/Test actions;
- stale-while-revalidate AI Center refresh where justified;
- real model execution success/failure.

Actual executions are valid health evidence and should update registry state rather than triggering redundant probes immediately afterward.

A single transient request timeout/failure does not automatically produce persistent launcher warning state. The bottom-left AI launcher shows restrained, non-color-only warning decoration only for **persistent/actionable connection problems**, such as missing/rejected credentials, invalid configuration, or no usable enabled connection where user action is required.

AI Center uses normalized user-facing error summaries while retaining safe provider-specific diagnostic detail where useful. Raw upstream/provider error payloads must not bypass secret redaction or become the primary status language.


---

### Q8 — What exactly does **Test Connection** prove, and how does it differ from discovery, probe and warm-up?

**Why it matters**

Dope already has Software Map probe/warm-up semantics and 7A runtime readiness. A vague Test button could accidentally send project data, incur unexpected cost, load a large local model, or duplicate existing checks without telling the user what was proven.

**Questions to resolve**

- Does Test Connection only verify transport/auth, or does it execute a tiny model request?
- Is testing per connection or per model?
- Does a successful test prove streaming, structured output, cancellation or only basic text generation?
- May testing incur hosted token cost?
- Must all test payloads be synthetic and contain zero project data?
- Does testing a Local model intentionally warm/load it?
- If a test warms a model, is that reported as an incidental runtime effect rather than durable readiness?
- How long is a test result considered valid?
- How are capability-specific tests exposed without creating a diagnostic maze?
- Should sMap structured-output probe/warm-up remain feature-owned even if AI Center can test the same connection?

**Current leaning**

Make **Test Connection** a bounded synthetic no-project-data check that proves transport/auth plus the minimum conversational execution contract used by general AI Presence. Allow optional per-model capability tests only when useful. Clearly disclose hosted calls/cost and possible Local model loading. Do **not** let AI Center testing replace feature-specific Software Map probe/warm-up or evidence-egress approval.

**Decision**

Locked: **Test Connection** answers one bounded question: **can Dope successfully execute a minimal conversational request through this connection right now?**

The default test:
- validates current connection configuration;
- validates required credential availability without exposing secret material;
- reaches the provider/runtime;
- selects one currently usable/default model for that connection;
- executes one tiny synthetic conversational text request containing **zero project data**;
- verifies that a valid completion can be received and parsed;
- may record useful ephemeral latency/basic usage metadata when available.

Hosted tests are real provider calls and may consume a very small amount of quota/tokens; AI Center should disclose that plainly. Local tests may incidentally load a model into memory, but that incidental effect is not a durable warm-residency guarantee.

The default action is connection-level. AI Center may additionally expose a bounded **Test Model** action for a specific model where useful, but Phase 7B does not become a generalized capability-diagnostics laboratory.

A successful generic Test Connection proves only the minimum general conversational execution path. It does **not** by itself prove:
- structured output;
- streaming semantics;
- tool calling;
- large-context behavior;
- reasoning-control support;
- Software Map synthesis quality/readiness;
- feature-specific capability contracts;
- durable model warm/load state.

Software Map keeps its own stronger ADR 0022 workflow, including explicit provider/model choice, synthetic structured-output probe where required, warm-up, and evidence-egress authorization before project evidence is sent. AI Center Test Connection never substitutes for that flow.

Test results are **ephemeral runtime evidence**, not canonical or permanent connection truth. AI Center may show last-tested time/result and safe latency/error information, but relevant connection configuration, credential or model changes invalidate the prior result. Reconnect/runtime changes or sufficient age may mark it stale.

Normalized result classes are at least **Passed**, **Failed**, and **Cancelled**, with safe reasons such as Authentication failed, Provider unavailable, Model unavailable, Request rejected, Invalid response, or Timed out.

If no usable model exists, Test Connection reports that condition rather than claiming transport-only success.


---

### Q9 — How should Phase 7B converge existing 7A and Software Map setup surfaces without breaking feature-specific consent?

**Why it matters**

By 7B, Chat and Software Map may already have provider setup/configuration paths. AI Center should eliminate duplicated global connection ownership, but some feature-local UI remains necessary because Software Map has explicit evidence-egress and readiness semantics.

**Questions to resolve**

- Which existing 7A connection setup UI is removed, redirected or reduced to “Open AI Center”?
- Does the Chat no-model state link directly into AI Center and return to the originating Chat afterward?
- Does Analyze Project reuse an already configured AI Center connection while preserving explicit provider choice and disclosure?
- Can Analyze Project still add/configure a missing connection inline, or should it always open AI Center?
- How are Local/Gemini connection IDs migrated from any pre-7B application state?
- Must migration preserve selected model/readiness metadata?
- What happens if existing provider-specific settings conflict with the centralized registry?
- Which settings remain feature-local because they describe synthesis strategy rather than connection configuration?

**Current leaning**

Centralize **global connection ownership** in AI Center while retaining feature-local execution consent and strategy. Chat setup routes should become AI Center links/embeds rather than separate connection stores. Software Map should consume AI Center connections/models but continue to own Analyze Project/Search Deeper provider choice, disclosure, probe/warm-up and synthesis strategy. Use an explicit one-time migration from 7A application connection metadata if the implementation shape requires it.

**Decision**

TBD.

---

### Q10 — What role-ready contracts and UI seams must 7B ship so 7C can be added without rewriting AI Center?

**Why it matters**

ADR 0026 intentionally separates 7B connection management from 7C role routing. If AI Center bakes in assumptions that “default model” is one global setting, or if connections/models lack stable capability metadata, 7C will immediately require a redesign.

**Questions to resolve**

- Which stable connection/model identifiers and capability fields must 7B expose to future `AIRolePolicy`?
- Does 7B show a disabled/coming-later **Roles** section, or keep role UI completely absent until 7C?
- Should connection/model detail already expose locality/hosted classification and egress-relevant metadata?
- What capability vocabulary is required before 7C: streaming, structured output, reasoning controls, context limits, local/hosted, tool support?
- Does 7B need an API for “list eligible models matching constraints” without actually assigning roles?
- How are future role policies insulated from mutable display names?
- Should models/connections support user-friendly aliases before roles exist?
- What must remain explicitly deferred so 7B does not accidentally implement routing?
- Which 7B tests should prove that future role policy can reference connections/models without provider-specific conditionals?

**Current leaning**

Ship stable connection/model identities, normalized capabilities, locality/hosted metadata and a provider-neutral query seam sufficient for 7C to resolve eligible targets. Do **not** implement global role assignments or fallback routing in 7B. Prefer no active Roles UI until 7C unless a small read-only “Roles coming next” placeholder materially improves discoverability. The 7B domain/API should be role-ready even if the UI is not.

**Decision**

TBD.

## Secondary implementation questions

These matter during 7B decomposition but should not displace the ten product decisions above.

| Area | Questions |
| --- | --- |
| Connection ordering | User-defined order, provider grouping, recent use, alphabetical, or status-first? |
| Naming | Automatic provider/runtime names only, or editable connection aliases? |
| Diagnostics | What bounded logs/last-error timestamps are visible without creating a full provider console? |
| Accessibility | Keyboard navigation, status semantics, screen-reader labels, non-color health indicators. |
| Offline UX | How should AI Center behave when hosted network access is unavailable but Local is healthy? |
| Multi-window updates | How quickly do connection/configuration changes propagate to another open Dope window? |
| Removal safety | Which warnings appear when a connection is currently selected by open Chats or active feature state? |
| Usage metadata | Should 7B show only readiness, or also provider-reported latency/token usage summaries from 7A? |
| Future providers | What adapter contract allows new providers to add setup fields without editing AI Center core? |
| Import/export | Is non-secret connection-profile export useful in 7B, or explicitly deferred? |

## Decisions to settle before Phase 7B prompt decomposition

All ten primary questions should be resolved before the final Phase 7B `/prompt-ass -> /prompt-plan -> /prompt-write p7` continuation is generated.

The most architecture-sensitive decisions are:

1. connection identity/lifecycle;
2. application-global persistence and multi-window ownership;
3. secret-storage behavior;
4. provider-specific onboarding boundary;
5. model discovery/identity;
6. readiness/health semantics;
7. Test Connection versus feature-specific probe/warm-up;
8. migration/convergence of existing setup surfaces;
9. role-ready contracts without premature routing.

The visual layout should follow these ownership/security/runtime decisions rather than define them.

## Relationship to existing authority

This worksheet is subordinate to:

- `docs/decisions/0004-model-provider-independence.md`
- `docs/decisions/0022-smap-synthesis-model-runtime-seam.md`
- `docs/decisions/0023-living-software-knowledge-model-and-local-first-background-alignment.md`
- `docs/decisions/0025-durable-project-chat-and-chatpanel-ai-presence.md`
- `docs/decisions/0026-ai-center-and-role-based-model-routing.md`
- `docs/planning/p7/activation.md`
- `docs/planning/p7/phase-7-plan.md`
- `docs/ARCHITECTURE.md`
- `docs/PRODUCT-MODEL.md`
- `docs/stability-contract.md`
- `docs/roadmap/mvp-roadmap.md`

Resolved answers should be promoted into those authorities through `/docs-review -> /docs-apply`. The worksheet remains planning context rather than competing canonical product authority.
