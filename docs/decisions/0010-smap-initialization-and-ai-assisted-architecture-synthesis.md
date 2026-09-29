# ADR 0010 — sMap initialization and AI-assisted architecture synthesis

Status: Accepted
Date: 2026-09-29
Amends: ADR 0009
Complements: ADR 0004, ADR 0006, ADR 0008

## Context

ADR 0009 established the correct authority boundary for the Software Map: implementation evidence is derived, canonical architecture is developer-owned, and the developer must be able to correct detected Systems, Subsystems and Components.

Its initial discovery design still assumed that architecture-scale candidates would be produced deterministically and could be discovered whenever canonical architecture was absent.

That is too rigid for the range of frameworks and repository structures Dope is intended to understand. Architecture is partly an interpretation of deterministic evidence: entrypoints, package topology, dependency direction, framework registration, runtime boundaries, routes, schemas, services and naming conventions may all matter differently across stacks.

A first-time project also needs an explicit onboarding contract. Opening a repository in Dope must not silently create an architectural interpretation or project-local sMap state.

## Decision

### Initial sMap analysis is explicit and opt-in

Dope distinguishes an **uninitialized sMap** from an initialized Software Map.

When a project that has never initialized sMap is opened, Dope may detect that initialization is absent and offer an **Analyze Project?** choice.

- **Yes** starts the initial sMap analysis workflow.
- **No** leaves the project usable without building an sMap.
- Declining does not create canonical architecture, derived map state or project-local acceptance state merely to record the refusal.
- The sMap surface remains available. Its uninitialized empty state exposes an **Analyze Project** action that opens the same initialization flow later.

Dope must not repeatedly treat a prior decline as project architecture state. If the product suppresses repeated prompts for convenience, that suppression is user/workspace presentation state rather than canonical project state.

### Initialization lifecycle

The Software Map application/domain layer must distinguish at least:

`uninitialized -> analyzing -> review_required -> initialized`

This lifecycle is conceptually separate from the mere existence of `.dope/architecture.json`.

The persistence representation for initialization status is an implementation decision for the correction stack, but it must not conflate:
- an architecture declaration file;
- a generated proposal;
- developer acceptance;
- disposable derived analysis.

Until an explicit resumable-draft contract is deliberately introduced, cancellation or failure before acceptance returns the project to `uninitialized`. Review output may exist transiently while the review flow is active, but it is not canonical architecture.

### Deterministic evidence first

The existing deterministic analyzers remain the evidence authority.

They collect and normalize facts such as:
- repository/workspace/package topology;
- build and configuration boundaries;
- executable/deployable/runtime entrypoints;
- imports, exports and semantic symbol relationships;
- dependency direction and cohesion signals;
- framework registrations;
- routes, jobs, schemas and service/DI structure where explicit extractors support them;
- source locations and provenance;
- later recorded runtime observations.

These facts may identify strong architecture signals, but they do not by themselves become developer-owned Systems, Subsystems or Components.

### LLM-assisted architecture synthesis

For an existing project, the initial architecture proposal is synthesized by a bounded LLM capability over deterministic evidence.

The forward initialization pipeline is:

Repository / configuration evidence
-> deterministic language/framework analysis
-> normalized evidence graph
-> bounded architecture-synthesis request
-> proposed Systems / Subsystems / Components
-> developer review and correction
-> explicit acceptance
-> canonical architecture
-> Physical Map realization and drift reconciliation

The LLM may propose:
- System, Subsystem and Component boundaries;
- names and responsibilities;
- containment;
- likely relationships;
- confidence/uncertainty;
- evidence references supporting each proposal.

LLM output is a **proposal class**. It is neither deterministic physical fact nor canonical architecture.

Every proposed architectural element must retain enough provenance to explain which repository evidence was supplied or cited as its basis.

### Developer acceptance remains the authority transition

The developer is the final source of truth for architecture.

During initial review the developer must be able to confirm or correct the proposal, including rename, reparent, merge, split, add, remove, replace or ignore operations as appropriate.

The proposal becomes canonical architecture only through explicit developer acceptance.

Subsequent analysis reconciles physical implementation against that canonical architecture. It may report drift, detected-only structure or unassigned implementation, but it does not silently rewrite the developer's architecture.

### Greenfield/manual initialization

A model is not required to define architecture manually.

For a fresh or intentionally manually-authored project, the developer may establish Systems, Subsystems and Components before implementation exists. That path can initialize sMap directly through developer-authored canonical architecture.

Declared architecture without implementation remains declared-only until deterministic evidence realizes it.

If no architecture-synthesis model capability is available for a brownfield project, Dope must not invent an opaque fallback as canonical truth. The user may configure a supported provider or initialize the architecture manually.

### Bounded early model capability

This decision intentionally introduces one narrow model-backed capability before Product Phase 6:

`architecture evidence -> structured architecture proposal`

This does **not** activate general AI Presence.

Correction `c4-architecture-discovery` may introduce only the provider-independent infrastructure necessary for this bounded synthesis path. It must not introduce:
- Agent Mind;
- chat-first interaction;
- provider-owned canonical state;
- tool execution;
- autonomous source mutation;
- ownership/delegation;
- ProposedAction;
- DevelopmentSession;
- Phase 5 Planning Map behavior.

Provider-specific request/response formats stay behind adapters. The Software Map domain consumes and produces Dope-owned contracts.

OpenAI/Codex may serve as the first reference implementation consistent with ADR 0006, but no provider becomes part of the sMap domain model.

## Correction gate

The mandatory pre-Phase-5 correction remains named `c4-architecture-discovery` and remains at unchanged package version `0.4.6`.

ADR 0010 broadens that correction's governing scope. It must now add:
- explicit uninitialized/analyzing/review-required/initialized sMap lifecycle;
- opt-in first analysis and a reusable Analyze Project entry point from the sMap surface;
- deterministic architecture evidence production;
- bounded provider-independent LLM architecture synthesis;
- structured proposal provenance;
- developer review/correction and explicit acceptance;
- manual/greenfield initialization;
- canonical-versus-physical realization and drift reconciliation;
- permanent regression coverage proving that declining analysis does not build or establish an sMap.

The correction must preserve the qualified Phase 4 analyzer/evidence/query substrate and must not rewrite historical Phase 4 qualification artifacts.

## Consequences

- Dope can adapt initial architecture synthesis to unfamiliar frameworks without making the LLM authoritative.
- Opening a repository does not silently create a Software Map.
- The first sMap experience becomes a deliberate architecture onboarding workflow rather than an opaque background index.
- Deterministic analysis remains inspectable evidence beneath AI interpretation.
- The developer can correct the initial proposal before any architecture becomes canonical.
- Greenfield projects remain fully supported without an LLM.
- General AI Presence, delegation and mutation remain behind their existing roadmap gates.
