# ADR 0026 — AI Center and role-based model routing

Status: Accepted
Date: 2026-10-03

## Context

Product Phase 7 already introduces the provider-independent Model Runtime, an application-level Model Connections registry, durable Dope-owned Chats, per-message connected-model selection, and per-Chat model/context policy. That is the correct substrate for general AI use, but it does not yet give the developer one coherent place to manage every AI connection or express which connected models should normally serve different kinds of work.

Dope also has later features with materially different execution needs. Foreground Chat should remain directly steerable. Software Map synthesis has explicit provider/evidence-egress authority. Product Phase 10 needs high-volume local-first background semantic maintenance with no silent hosted fallback. Product Phase 8 Scoped Delegation needs a coding-agent role without making one provider the product architecture.

If each feature owns provider configuration or hard-codes one model, Dope will accumulate duplicated setup, inconsistent connection state, and routing logic that is difficult to evolve. If global defaults are allowed to imply feature authority, a harmless connection preference could accidentally authorize repository evidence to leave the machine or cause background work to incur hosted cost.

## Decision

### Phase 7 is split into three ordered slices

Phase 7 remains one product phase and one `0.7.x` package family:

1. **Phase 7A — AI Presence**: durable Chats/ChatPanels, provider-independent conversational Model Runtime, application Model Connections registry, Local/Gemini/OpenAI adapters, per-message model selection, per-Chat settings, bounded context, and read-only Ask/Explain/Trace/Find Related.
2. **Phase 7B — AI Center**: one global connection/model management surface over the Phase 7A registry, plus secure configuration, model inventory, health/readiness and testing.
3. **Phase 7C — AI Roles & Routing**: global role policies, deterministic capability/constraint-aware resolution, bounded fallback and role-aware consumers.

P1-P12 plus the bounded P12 blocker correction are the recorded Phase 7A implementation/qualification path. P13 has executed at `0.7.13` as an evidence-only **Not Qualified** audit because 7B/7C were still missing; it is not the final Phase 7 closeout. The bounded `c7-chat-conversation-ux` correction is Green/Qualified at unchanged `0.7.13`. Continue with `/prompt-ass -> /prompt-plan -> /prompt-write p7` for the contiguous 7B continuation, then 7C and exactly one later final Phase 7 closeout.

7B/7C are forward product capability, not bounded defect repair, and must not be disguised as a correction stack.

## Phase 7B — AI Center

### AI Center is the canonical global control plane

**AI Center** is the canonical user-facing name for global AI connection management.

The current bottom-left account/profile action becomes an **AI** launcher with an AI-specific icon. Activating it opens or reveals one singleton/revealable AI Center center-workspace tab. Account/profile management belongs under ordinary Settings.

AI Center uses a two-pane **connection list + selected connection detail** layout.

The connection list is the primary navigation surface. Each row shows only compact scan-level information:
- provider/runtime;
- user-facing alias/name;
- normalized status;
- usable model count/readiness summary.

The selected connection detail owns:
- safe configuration;
- credential source/status;
- connection health;
- discovered/known models and capability detail;
- Refresh/Reconnect;
- Test Connection;
- Disable and Remove.

Models do not remain broadly expanded beneath every connection by default.

The bottom-left AI launcher stays visually quiet while healthy. It may show restrained non-color-only warning treatment only for actionable connection/routing problems that currently require developer action. Ordinary success does not receive a permanent green indicator, spinner or model count.

The no-connection state is an intentional onboarding surface with a clear **Add Connection** action and concise Local-versus-hosted orientation.

### Connections have immutable Dope-owned identity

Every `AIConnection` receives an immutable Dope-owned ID at creation.

Connection identity is independent from:
- provider/runtime type;
- endpoint;
- display alias;
- credentials;
- model inventory;
- readiness.

Editing those properties does not create a new connection identity.

Multiple simultaneous connections of the same provider/runtime type are allowed. Duplicate-looking provider+endpoint configurations may produce a warning but are not forbidden.

Persistent lifecycle and transient readiness are separate.

Persistent lifecycle includes:
- **Enabled/configured**;
- **Disabled** — reversible exclusion from new execution while preserving ID/configuration;
- **Removed** — no longer active/configured.

Runtime/application status such as Checking, Refreshing, Reconnecting, Unavailable, Needs Authentication or Invalid Configuration does not replace identity.

Removing a connection never rewrites historical execution provenance.

### Application-global means one logical machine-local authority

The connection registry is **machine-local, application-global, and shared across all Dope projects/windows for the same OS user/Dope installation**.

This is one **logical registry authority**, not a requirement that all windows literally share one physical Theia backend process. The implementation must preserve the same behavior across whichever Electron/Theia process topology exists.

Requirements:
- no registry state beneath project-local `.dope/`;
- opening/copying/cloning/moving/deleting a repository never changes connection inventory;
- registry remains usable with no project open;
- multiple Dope windows/processes observe one logical state;
- mutation is revisioned/concurrency-safe;
- stale writes reject/reload instead of silently overwriting;
- cross-process mutation exclusion is required where more than one backend process can write;
- accepted updates propagate to other open windows without restart.

Cross-machine/account synchronization is deferred. Non-secret configuration should remain structurally export/import-ready for a future feature, but 7B does not need to ship sync/import/export.

### Credential sources and secure persistence

AI Center supports three credential-source classes where authentication is applicable:

- **Environment**;
- **Session-only** runtime memory;
- **OS secure storage**.

There is no plaintext persistent fallback. If secure storage is unavailable/inaccessible/unsupported, persistent secret entry is unavailable rather than downgraded to an ordinary file or preference.

AI Center displays credential source/status but not the secret value. Securely stored credentials are managed through Replace/Remove rather than routine Reveal/Copy.

Credential lifecycle is independent from connection lifecycle. Removing a credential leaves the connection configured and moves it to the appropriate unauthenticated state.

The same secret abstraction applies to hosted and authenticated Local/OpenAI-compatible runtimes.

Secrets must never enter:
- `.dope/`;
- Chat/message/execution persistence;
- routing provenance;
- ordinary plaintext application preferences;
- logs/diagnostics;
- telemetry/event payloads;
- cache keys;
- raw user-visible provider errors;
- clipboard/debug exports.

### Shared Add Connection shell; bounded provider-specific setup

AI Center provides one universal **Add Connection** flow and common management shell.

AI Center/core owns:
- identity;
- alias/name;
- lifecycle;
- persistence/revision/concurrency;
- credential references/secure-secret boundary;
- normalized status/readiness;
- Test Connection orchestration;
- Save/Cancel/Remove;
- navigation/detail presentation.

Provider/runtime adapters may contribute bounded provider-specific behavior:
- setup fields;
- field validation;
- credential requirements;
- disclosures;
- discovery hooks/capabilities;
- connection/test transport hooks;
- bounded custom setup UI when ordinary fields are insufficient.

**Provider adapters may customize how a connection is configured, but not what a connection is.**

**OpenAI** and **OpenAI-compatible** are distinct provider/runtime types even when they share a wire protocol.

Local runtimes may offer best-effort known-endpoint detection and a one-action **Use detected runtime** path. Manual configuration always remains available.

### Model identity, discovery and inventory

Model inventory is connection-scoped and capability-driven. Adapters may support:
- automatic discovery;
- explicit configured inventory;
- bounded hybrid behavior.

Stable model identity is:

```text
AIModel identity = connectionId + providerModelKey
```

Display labels, availability and capability metadata may change without changing identity.

Refresh/discovery occurs at bounded lifecycle events:
- connection creation;
- relevant configuration changes;
- reconnect or runtime inventory-change signal where supported;
- explicit **Refresh Models**;
- optional stale-while-revalidate AI Center refresh.

Do not continuously poll merely because AI Center is open.

Previously known models may remain visible as known non-usable entries such as Unavailable / No longer discovered / Unknown with useful last-observed metadata. Ordinary execution consumers receive only models that are currently usable and enabled in Dope.

A user/application preference may hide/disable an individual discovered model from ordinary Dope selection without pretending the provider stopped exposing it.

Providers without reliable discovery may use configured model IDs.

Capability/limit metadata retains source/quality such as provider-reported, adapter-known, configured or unknown. Unknown never becomes an invented authoritative fact.

### Health/readiness is normalized but separate from identity

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

Connection Ready means configuration/authentication/transport/basic runtime readiness is sufficient for ordinary use. It does not imply every model completed a fresh inference test.

Model Ready means known/configured, connection usable, enabled in Dope and not currently reported unavailable.

Local warm/load residency is separate from connection/model health. A known Local model may remain visible and healthy while cold/unloaded, but per-request execution eligibility is capability/limit-specific. Any request whose safety depends on a loaded limit, including bounded project context or a hard minimum-context requirement, must first establish the actual loaded runtime capacity. Unknown or unloaded capacity does not satisfy a hard minimum-context or `usableOnly` eligibility requirement; load/preflight may make the same immutable model identity eligible without rewriting policy.

Health updates come from bounded lifecycle events, explicit Refresh/Test, stale revalidation and real execution outcomes rather than continuous polling.

A single transient request failure does not automatically create persistent launcher warning state.

### Test Connection proves only the minimum conversational path

**Test Connection** answers: **can Dope successfully execute a minimal conversational request through this connection right now?**

The default test:
- validates current safe configuration;
- validates credential availability without exposing it;
- reaches the provider/runtime;
- selects one currently usable/default model;
- sends one tiny synthetic conversational request containing zero project data;
- receives/parses a valid completion;
- may record ephemeral safe latency/basic usage metadata.

Hosted tests may consume minimal quota/tokens and must disclose that. Local tests may incidentally load a model, but that is not a durable warm-residency guarantee.

A successful generic test does not prove:
- structured output;
- streaming semantics;
- tool calling;
- large-context behavior;
- reasoning controls;
- Software Map readiness/quality;
- feature-specific capability contracts;
- durable warm state.

Software Map keeps its stronger ADR 0022 run-level provider/model selection, disclosure, feature probe/readiness, warm-up and evidence-egress authorization.

Test results are ephemeral and invalidated/staled by relevant configuration, credential, model or runtime changes.

### AI Center becomes the sole global connection owner

AI Center owns global provider/runtime connection configuration. Features own execution consent and feature-specific strategy, not duplicate global connection stores.

Chat/no-model setup routes into AI Center and returns to the originating surface after repair.

Software Map consumes the centralized connection/model inventory but retains:
- explicit run-level target authority;
- hosted evidence-egress disclosure/consent;
- feature-specific structured-output probe/readiness;
- warm-up;
- synthesis strategy.

When a feature needs missing connection setup, it routes to **Add / Configure in AI Center** rather than embedding another global provider configuration store.

If Phase 7A connection state already matches this ownership model, migration is a no-op. Otherwise 7B performs one deterministic migration preserving stable identity where possible and never copying secret material into plaintext/new stores.

Old feature-specific global provider configuration is retired rather than bidirectionally synchronized forever.

### 7B is role-ready without implementing routing

Every connection/model exposes stable identity plus normalized role-eligibility metadata:
- enabled/usable/readiness;
- explicit **local vs hosted** classification;
- known capabilities such as text generation, streaming, structured output, reasoning controls, tool support and cancellation;
- known relevant limits;
- capability/limit source quality.

Local/hosted classification is explicit metadata; 7C does not infer it from provider names.

7B exposes a provider-neutral eligibility query seam conceptually equivalent to:

```text
findEligibleModels({
  requiredCapabilities,
  locality,
  minimumContext,
  enabledOnly,
  usableOnly,
  ...
})
```

This returns eligible targets; it does not rank/choose them or apply role policy.

User aliases are allowed, but future policy references immutable IDs.

7B does not implement role assignments, role fallbacks, automatic target selection, feature-to-role routing, role policy persistence or a placeholder Roles UI.

## Phase 7C — AI Roles & Routing

### Five fixed built-in roles

Initial 7C has exactly five stable role IDs:

- **Interactive** — normal foreground AI assistance where responsiveness is primary.
- **Deep Reasoning** — deliberately heavier foreground reasoning for difficult analysis where extra latency/cost is acceptable.
- **Background** — non-interactive work; individual consumers may add stronger constraints.
- **Software Map** — model-assisted sMap/architecture work such as Analyze Project and Search Deeper.
- **Coding Agent** — delegated/tool-using coding work, configurable before Product Phase 8 consumes it.

Users configure policies but cannot create, delete or rename role types in initial 7C.

Role identity describes workload intent. Model-specific reasoning effort remains a separate execution setting after target selection.

### Routing is deterministic and ordered

Each `AIRolePolicy` contains one preferred target followed by an ordered fallback sequence.

A policy entry may be:
- an exact immutable `connectionId + modelId`; or
- a bounded constraint target representing eligible models satisfying declared requirements.

Given unchanged inventory, role policy and request constraints, routing resolves the same target.

Initial 7C does not dynamically score/rank based on latency, price, benchmarks, provider reputation, historical success rate or popularity.

When multiple models satisfy one constraint entry, resolution uses explicit user ordering where available; otherwise it uses one documented stable ordering over immutable IDs.

Temporary fallback never rewrites preference. When the preferred target becomes eligible again, routing returns to it.

### Hard constraints and soft preferences are distinct

Initial hard constraints include:
- required capabilities;
- locality;
- evidence/data-egress allowance supplied by the initiating feature authority;
- minimum known context when genuinely required;
- enabled/usable state;
- other feature-authority constraints.

Locality is represented as a normalized typed constraint such as:
- **any**;
- **local-only**;
- **hosted-only**.

Do not encode mutually contradictory independent booleans such as `localOnly=true` plus `hostedRequired=true`.

Unknown capability support does not satisfy a hard requirement.

Feature/request constraints combine with global role policy only by **narrowing/intersection**. They may strengthen the effective request but may never weaken a higher-authority restriction.

A critical authority rule: **global role policy can restrict egress but cannot grant feature egress consent**. Any execution that requires hosted project-data transfer must already be authorized by the initiating feature/user flow. An `AIRolePolicy` setting alone never creates permission to send project evidence off-device.

Soft preferences may include prefer-local, prefer-hosted, prefer-reasoning-capable or prefer-larger-context. They only resolve ambiguity inside an already eligible constraint entry and never reorder the explicit policy sequence.

Generalized cost/latency optimization is deferred.

### Fallback is bounded and conservative

Automatic fallback applies only to role-routed requests whose feature/policy already authorizes fallback, before meaningful output is accepted, and only to candidates satisfying all effective hard constraints.

Fallback may advance for pre-execution failures such as:
- disabled target;
- unavailable connection/model;
- target no longer eligible;
- required capability no longer satisfied.

It may advance for bounded transient failures where allowed, such as:
- rate limiting;
- temporary provider/runtime unavailability;
- transport failure;
- timeout before useful output.

Generic role routing does not fallback for:
- user cancellation;
- explicit developer-selected model;
- authentication failure;
- invalid connection configuration;
- newly required egress/consent not already authorized before execution;
- meaningful partial output already delivered;
- content/policy rejection;
- feature-semantic failures such as invalid Software Map structured output where the owning feature must decide retry semantics.

Each candidate is attempted at most once per role resolution. Provider-specific retries remain separately bounded and cannot restart the fallback sequence indefinitely.

### Override scopes remain small

Precedence is:

```text
explicit per-turn / explicit feature exact model
    -> persistent Chat model policy
    -> feature-requested role + stronger constraints
    -> global application-wide role policy
```

After 7C, Chat model policy supports:
- **Exact model**; or
- **Follow Interactive role**.

Existing 7A Chats preserve/migrate their exact default model policy. New Chats default to Follow Interactive.

An unconfigured/broken Interactive role does not prevent a developer from explicitly selecting an exact usable model for a turn.

Per-message composer choice remains exact-model and one-turn only. There is no ordinary per-message role selector in initial 7C.

No generic project/workspace/window role override layer is added in initial 7C.

Lower-scope choices never mutate higher-scope policy.

### Unconfigured/broken roles fail explicitly and repairably

Dope may recommend eligible role assignments but never silently creates or rewrites enduring role policy.

Derived role health may include:
- **Ready**;
- **Using fallback**;
- **Needs configuration**;
- **Broken**;
- **Unavailable**.

If no eligible target exists, Dope does not pick an arbitrary usable model. The requesting feature fails clearly and deep-links to the relevant role in AI Center.

Unconfigured future roles such as Coding Agent before Phase 8 do not create global warnings merely because they exist.

### Roles is a first-class AI Center surface

Phase 7C adds **Roles** beside Connections and Models.

The default role list shows each fixed role with:
- canonical name;
- short purpose;
- preferred target;
- fallback count;
- important global constraints/preferences;
- derived health.

Selecting a role opens a focused editor for:
- preferred exact/constraint target;
- ordered fallback entries;
- editable global constraints/preferences;
- eligible targets and ineligibility explanations.

Fallback ordering supports both pointer drag/reorder and keyboard-accessible move controls.

Feature-imposed requirements/authority appear read-only and cannot be weakened from the global role editor.

Coding Agent is visible/configurable but marked **No active consumer yet** until Product Phase 8.

### Feature-to-role bindings

Initial bindings are:

- ordinary/new role-following Chat -> **Interactive**;
- deliberate explicit heavy foreground analysis -> **Deep Reasoning**;
- Analyze Project -> **Software Map** default-target policy;
- Search Deeper -> **Software Map** default-target policy;
- Product Phase 10 continuous semantic maintenance -> **Background** with hard local-only/no-hosted-fallback constraints;
- Product Phase 8 delegated coding/tool execution -> **Coding Agent** when that consumer ships.

Deep Reasoning is not chosen by a hidden difficulty classifier in initial 7C.

Software Map role supplies default/eligible candidates but does not replace run-level exact target authority, disclosure, probe/warm-up or synthesis strategy.

Roles are not mandatory indirection for every internal model call. Tiny/specialized calls may reuse a parent exact target or a feature-owned exact execution contract.

Automatic Chat title generation continues to use the same actual selected model/provider as the triggering successful exchange unless separately redesigned; it does not invoke a new role selection merely for naming.

### Routing provenance is durable and explainable

Every routed execution records compact provider-neutral provenance:
- requested role, when applicable;
- resolution source;
- relevant non-secret effective hard constraints;
- role-policy identity/revision;
- preferred candidate;
- actual immutable connection/model IDs;
- execution-time display/provider/model metadata;
- bounded fallback attempt/results.

Historical routing provenance is immutable under later policy/connection/capability changes.

The UI exposes a concise **Why this model?** explanation showing role/resolution source, relevant hard constraints, preferred/selected target and bounded fallback reason/path.

Routing provenance never exposes secrets, hidden chain-of-thought or undisclosed private scoring.

### Changing inventory preserves policy intent

Inventory/capability changes affect eligibility, not what the developer configured.

Role targets may become Unavailable, Disabled, Removed or Ineligible while remaining visible policy references.

When valid later fallbacks remain eligible, routing may use them without promoting them into the preferred slot.

If the preferred target becomes eligible again, deterministic routing returns to it.

Capability changes re-evaluate eligibility without rewriting policy.

A temporarily missing model that reappears with the same stable identity resumes its policy relationship automatically.

A genuinely recreated connection/model with a new immutable ID does not silently inherit the old role reference merely because provider/endpoint/name look similar. Dope may recommend a likely replacement; developer acceptance is explicit.

For unresolved live policy references to removed targets, preserve a bounded **last-known non-secret descriptor/tombstone** sufficient to render what the target was:
- immutable IDs;
- provider/runtime type;
- connection alias at removal;
- provider model key/model display label at removal where useful.

This descriptor is not an active connection/model and contains no credentials, secret references or executable configuration.

Role policy uses the same logical machine-local/application-global revision/concurrency/update model as connection state.

Full role-policy edit history/undo is deferred. Execution provenance still records the policy revision used.

## Authority boundaries preserved

Connection availability, role preference and feature authority remain separate:

```text
What connections/models exist?
    -> AI Center / registry

Which model is preferred for a kind of work?
    -> AIRolePolicy

May this feature send this project data through this target now?
    -> feature/user authority
```

Explicit model choice never silently falls back.

Global role policy never grants mutation authority.

Global role policy never grants project-data egress permission that the initiating feature/user flow does not already possess.

Software Map ADR 0022 and Phase 10 ADR 0023 remain authoritative over their stronger feature constraints.

## Consequences

- Phase 7A remains independently implementable/qualifiable before AI Center.
- Phase 7B centralizes provider/runtime configuration without duplicating feature consent or strategy.
- Phase 7C adds predictable routing without an opaque model-ranking system.
- Local models can be first-class Background targets without making Local the only runtime.
- Hosted models can be preferred for difficult foreground work without becoming silent privacy-sensitive fallbacks.
- Existing 7A exact Chat defaults remain valid through migration.
- New role-following Chats can evolve with global Interactive policy.
- Later Product Phase 8/10 consumers receive stable role contracts without provider coupling.
- Routing remains inspectable through durable provenance and Why this model? explanations.

## Non-goals

This decision does not:
- add mutation/delegation authority to Phase 7;
- make connection/role state canonical project truth;
- allow silent provider fallback after explicit model selection;
- allow role policy to grant evidence-egress consent;
- require identical provider capabilities;
- add custom roles in initial 7C;
- add dynamic cost/latency/benchmark ranking in initial 7C;
- add generic project/window role overrides;
- add full role-policy edit history/undo;
- move Phase 10 alignment behavior into Phase 7.

## Revisit when

Revisit custom roles, project-specific role policy, dynamic cost/latency/quality routing, policy history or richer optimization only after real usage demonstrates a need that the fixed deterministic policy cannot express cleanly.

Preserve the separation between connection inventory, routing preference, feature authority and canonical project state.

## Amendment — Codex agent-runtime connections for Phase 8 (2026-10-05)

Product Phase 8 consumes the existing **Coding Agent** role and extends AI Center with a first-class **Codex agent-runtime connection**. This does not reopen Phase 7 qualification or turn Codex into Dope's canonical agent ontology.

### Codex is distinct from generic OpenAI API

AI Center treats these as different connection/runtime types:

- **OpenAI** — generic hosted Model Runtime connection using ordinary OpenAI API credentials/billing;
- **Codex** — coding-agent runtime using Codex App Server and, when authorized, Sign in with ChatGPT / ChatGPT-plan usage.

A Codex connection is not an `openai` connection with a hidden mode flag. Authentication, usage, process lifecycle and agent execution semantics differ enough to require an explicit runtime type.

The provider-neutral capability model gains an agent-execution capability such as **`agentExecution`**. Phase 8 requests the Coding Agent role with that hard capability. A connection that only supports ordinary conversational generation does not satisfy that request merely because its underlying provider is OpenAI.

Codex agent models need not appear in ordinary Chat or Software Map pickers unless the same connection explicitly supports those generic feature contracts. Product surfaces select by capability, not provider name.

### Hosted classification

Codex App Server may run as a local child process and may execute local repository tools, but its model inference uses hosted OpenAI service. For routing, privacy and evidence-egress purposes a ChatGPT-plan Codex connection is therefore **hosted**.

Running the harness locally never converts hosted inference into a local-model connection.

### ChatGPT-plan authentication

The initial Codex connection supports **Continue with ChatGPT / Sign in with ChatGPT** for eligible ChatGPT-plan usage.

AI Center owns the safe account/session projection:
- immutable Dope connection identity;
- account label / verified non-secret identity needed for selection;
- issued OAuth client identity / stable host identity where required by the provider flow;
- granted-plan-usage status;
- sign-in / reauthorize / sign-out lifecycle;
- connection health and current model catalog.

Access, refresh and retained ID tokens are secrets. They never enter the AI registry, `.dope/`, AgentTask/AgentRun persistence, routing provenance, logs, analytics, support transcripts or browser storage. Dope keeps them only in protected runtime/OS-secure storage with no plaintext application-preference fallback.

Refresh for one account/session is serialized across Dope processes so rotating refresh credentials cannot be raced. Temporary network/provider failures do not erase otherwise valid credentials. Confirmed terminal/revoked credentials move the connection to a repairable authentication state.

Provider-specific OAuth/token mechanics remain adapter facts. Dope domain contracts retain only non-secret connection/auth status and identity.

### Multiple Codex accounts

The existing rule permitting multiple connections of the same provider/runtime applies to Codex. Personal/work or otherwise separate ChatGPT accounts may be represented as distinct immutable Dope connection IDs.

Switching accounts refreshes account-specific model inventory and never rewrites historical execution provenance.

### Model discovery and entitlement

The Codex adapter may use App Server discovery and/or the provider's account-specific model catalog. Discovery is a catalog, not proof that every model can execute for the selected account.

AI Center preserves Known / Ready / Unavailable / Unknown semantics. A successful inference on the selected account/model is the authoritative execution check for that request.

### Test Connection

Codex **Test Connection** remains a zero-project-data connectivity test.

It may:
- validate secure account/session availability;
- start/initialize Codex App Server;
- use one selected/usable agent model;
- run one tiny synthetic task in a scratch/empty working directory with mutation authority disabled;
- observe successful completion;
- tear down or return the process to the normal idle policy.

It does not prove repository mutation authority, process/Git permissions, phase-stack execution or Phase 8 qualification.

### Usage presentation

AI Center states that the connection uses the user's authorized ChatGPT Work/Codex plan allowance (and provider-managed credits where explicitly authorized by that account flow). Dope does not invent a local remaining-usage meter when the provider has not supplied an authoritative API.

AI Center may link the developer to ChatGPT usage/settings for app usage and limits.

Failure of a ChatGPT-plan Codex connection never silently changes billing paths to a generic OpenAI API-key connection. Any such fallback must be an independently configured Coding Agent role target and already satisfy feature authority.

### App Server lifecycle

AI Center owns connection/auth/runtime readiness; Phase 8 Agent Runtime owns active execution.

The Codex adapter may lazily start App Server on first test or AgentRun, initialize it, retain the provider-native thread/session handle only as adapter recovery metadata, stop it after bounded idle/application shutdown, and restart it after token refresh. A resumed Dope AgentRun may use provider-native resume facilities, but provider-native thread identity never becomes AgentTask or AgentRun identity.

### Phase 8 ownership split

AI Center owns:
- Codex connection identity;
- ChatGPT-plan authentication;
- model inventory;
- runtime availability/health;
- Coding Agent role target eligibility.

Phase 8 owns:
- AgentTask / AgentRun / AgentTaskSequence;
- repository/workspace scope;
- mutation/process/Git authority;
- tool/effect visibility;
- diffs and validation;
- checkpoint/commit policy;
- cancellation/steering/recovery;
- sequential task execution.

A global Codex connection or Coding Agent role never grants mutation authority by itself.

