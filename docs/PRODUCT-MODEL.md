# Dope Product Model

Status: INITIAL DOMAIN CONTRACT

This document defines product concepts independently from Theia, Theia AI, any model provider, and any specific persistence backend.

The full vocabulary is intentionally broader than the initial implementation roadmap. A concept being defined here does not authorize building it early.

## Project Mind

Project Mind is the developer-facing durable structured knowledge of one software project.

Project Intelligence is the internal domain/service boundary that implements Project Mind.

Earlier foundation planning used the phrase Project Brain. Project Mind is the preferred product-facing term going forward.

Project Mind is not:
- chat history
- Theia workspace state
- Theia AI state
- provider-native memory
- a model's private context

The GUI renders it. Future agents consume and update it under explicit rules. It persists independently.

## Base artifact

ProjectArtifact is the common durable identity for project knowledge.

Minimum conceptual fields:
- id
- type
- title
- status
- createdAt
- updatedAt
- provenance
- links/relationships
- optional project/session/task scope

Provenance must distinguish:
- developer-authored
- AI-proposed
- AI-generated and developer-accepted
- derived from repository/runtime evidence
- imported state

Derived state must never silently become developer-authored truth.

## Staged artifact introduction

The initial roadmap deliberately introduces the model in layers.

### Phase 2 — Project Mind core

Initial first-class artifacts:
- Note
- Idea
- Question
- Decision

These must be useful with no model configured.

Phase 2 is approved/activated by the explicit owner sequencing waiver in `docs/planning/p2/activation.md`, with Phase 1 Not Qualified truth preserved. The concrete scope and migration policy are in `docs/planning/p2/phase-2-plan.md`.

Phase 2 artifacts have stable UUID identity, type, title, content, schema version, created/updated timestamps, provenance, status and links. The collection has stable project identity and a monotonically increasing document revision. Revision checking belongs to save consistency, not developer-session state. Archive/unarchive is reversible and preserves identity/links; no hard-delete UI is required.

Initial lifecycle values:
- Note: `active`.
- Idea: `captured`, `parked`.
- Question: `open`, `answered`, with an answer recorded when answered.
- Decision: `proposed`, `accepted`, `superseded`, `rejected`; supersession links to the replacement Decision.

Archive state is separate from these type-specific statuses. Changes are explicit developer actions validated by Project Intelligence. A Note/Idea/Question does not silently become a different artifact; create a linked artifact when the developer records a resulting Decision. No transition creates a Plan, Task or executable work in Phase 2.

Decision content records the decision, context, rationale, consequences, alternatives and revisit conditions. A proposed draft may be incomplete; acceptance requires a non-empty decision, context and rationale, and visible fields for the remaining considerations. Unknown/unassessed considerations remain honestly labeled, not fabricated.

Phase 2 authorship is developer-authored, with explicit migration metadata for imported legacy state. Preserve existing developer provenance during migration. The broader provenance vocabulary remains reserved for its actual producers; no AI authorship controls/runtime are introduced merely to fill the schema.

Links identify an artifact in the same project or a project-relative file, with an optional positive one-based line. Relations are `related` between distinct artifacts, `answers` from a Note/Decision to a Question, and `supersedes` from the replacement accepted Decision to the old superseded Decision. Supersession updates status/link atomically; incoming links provide replacement navigation. New artifact links must target existing artifacts; archived targets remain accessible. Missing referenced files are represented as unavailable references. Never use a file reference to perform mutation or follow a path outside the project. File references do not introduce symbol indexing or semantic architecture state.

The legacy spike Note has no historical timestamps. Its migrated creation/update timestamps are explicitly unknown (`null`), with a recorded migration time and source schema/path. New artifacts have actual timestamps; subsequent updates retain unknown creation time and record the real update time. Reopening, moving the containing folder or reconstructing a UI does not regenerate artifact/project identities.

### Phase 3 — Planning

Historical implemented model at `0.3.6`. This section records what Phase 3 qualified; it is not a compatibility promise or required ontology for Product Phase 5 and later. Correction `c3-remove-planning-instruments` has removed this live model before Phase 4 activation.

Phase 3 added:
- Plan
- PlanStep
- Task

Plans are live control structures, not static memos, and remain fully useful with no model configured.

Phase 3 keeps Planning as a domain beside Project Intelligence rather than turning Plans/Tasks into ProjectArtifact variants. Planning may reference stable Project Mind artifact IDs and project-relative files. The referenced knowledge remains owned by Project Mind.

Initial Plan fields:
- stable UUID `id`
- `title`
- `objective`
- `context`
- `status`: `draft | active | completed | superseded`
- ordered `steps`
- human-visible positive integer `revision`
- developer provenance and created/updated timestamps
- links to Project Mind artifacts and project-relative files

Initial PlanStep fields:
- stable UUID `id`
- `title`
- `body`
- `status`: `pending | active | blocked | complete | skipped | superseded`
- optional visible `blockedReason`
- created/updated timestamps
- order is defined by the containing Plan's step array

Initial Task fields:
- stable UUID `id`
- parent `planId` and `stepId`
- `title`
- `objective`
- `requirements[]`
- `constraints[]`
- `status`: `pending | active | blocked | complete | cancelled`
- Project Mind links
- project-relative working-set file links
- optional completion and developer-entered validation notes
- created/updated timestamps

Task completion does not imply a future Validation artifact exists or that tests passed. Phase 3 notes are human-entered planning context, not a substitute for Phase 5/6 validation provenance.

Every explicit successful planning mutation increments the planning document revision. Mutations affecting a Plan, its steps or its tasks increment that Plan's human-visible revision and append a concise history entry with timestamp, developer actor, affected IDs and operation summary. History records accepted saves/status/reorder/structure changes; it is not keystroke logging or a general event-sourcing subsystem.

Planning uses the stable Project Mind `projectId`. It does not allocate a competing identity. A project without canonical Project Mind identity must satisfy that prerequisite before Planning can create canonical state.

No AI ownership, Agent Mind, model/provider state, ProposedAction or mutation authority is introduced in Phase 3.

### Phase 4 — Physical Map

Correction `c3-remove-planning-instruments` closed at unchanged `0.3.6`, and Product Phase 4 subsequently qualified its approved Physical Map substrate at `0.4.6`.

Phase 4 established the evidence-backed Software Map core and deterministic TypeScript/JavaScript-first source analysis:
- language-independent graph nodes/relationships;
- deterministic source evidence and provenance;
- language-specific semantic analysis behind adapters;
- canonical developer-authored System, Subsystem and Component identities/constraints;
- queryable physical relationships independent from visualization.

ADR 0009 adds a mandatory post-Phase-4 correction before Phase 5, and ADR 0010 amends its initialization/discovery path.

A project whose sMap has never been initialized is explicitly uninitialized. Opening it may offer **Analyze Project?**, but Dope does not build the map unless the developer opts in. Declining leaves the project usable without an sMap; the sMap surface exposes an **Analyze Project** action so the same flow can be started later.

For an existing project, the correction uses deterministic repository, semantic and framework analysis as the evidence substrate, then passes bounded architectural evidence through a provider-independent LLM synthesis capability to propose Systems, Subsystems and Components. The generated structure is proposal state, not physical fact and not canonical architecture.

Developer-authored architecture remains canonical. The developer reviews and may confirm, rename, reparent, merge, split, add, remove, replace or ignore proposed boundaries. Only explicit acceptance establishes canonical architecture. Subsequent analysis reports how implementation realizes or diverges from that authority instead of silently rewriting it.

A fresh project may initialize sMap manually by defining canonical architecture before implementation exists. The TypeScript semantic analyzer remains the lower-level evidence engine; AI synthesis interprets evidence above it rather than replacing semantic source analysis.

### Phase 5 — Visual Software Planning

Design the planning/work model from the Physical Map outward rather than adapting the graph to Phase 3 Planning.

Introduce:
- physical architecture projections with semantic zoom;
- Planning Maps that reference physical nodes;
- proposed graph transformations for add/modify/remove/move/split/merge/relationship changes;
- graph-derived work decomposition, dependencies, acceptance criteria and validation targets;
- target-versus-physical reconciliation after implementation;
- a new planning/work ontology designed with no Phase 3 Planning runtime present.

Phase 5 does not assume Plan -> PlanStep -> Task is the final ontology. The Phase 3 domain, `.dope/planning.json`, RPC, UI and associated tests have already been removed by the pre-Phase-4 correction. Phase 5 starts from the software graph and introduces only the work concepts the visual map workflow actually requires.

Visual software planning remains useful with no model configured. A diagram is a projection of project state, not an independent source of architectural truth.

### Phase 6-7 — AI collaboration and delegation

Introduce or activate:
- AgentWorkingState / Agent Mind
- ownership and delegation
- ProposedAction
- ChangeSet
- Validation integration

### Phase 8 — Development Sessions

Introduce durable DeveloperSession as the cross-time development unit.

### Later expansion

Defer until the product earns the complexity:
- Research as a dedicated workflow/artifact
- advanced semantic project search
- richer conceptual ChangeSet history

## Core artifact semantics

### Note

Durable developer or AI-assisted thought.

A Note may preserve raw thought, structured hypothesis, reason, open question, and next investigation.

### Idea

A useful observation that is not active work.

An Idea does not automatically become work. It can later become a Note, Decision, Plan input, Task, or Research subject.

### Question

A durable unresolved question linked to code, decisions, plans, tasks, notes, or later research.

### Decision

Institutional memory for an architectural, product, or engineering choice.

Minimum useful shape:
- decision
- status
- context
- rationale
- consequences
- alternatives considered
- revisit conditions
- evidence/affected-artifact links

Later AI should be able to detect conflict with an accepted Decision.

### Plan

Phase 3 historical planning semantics. A Plan is a live control structure in the `0.3.6` implementation; the live concept is intentionally removed by the pre-Phase-4 correction and may or may not return in the Phase 5 ontology.

A Plan has explicit objective/context, status, ordered PlanSteps, a visible revision, links to supporting Project Mind knowledge/files and append-only mutation history. Plan edits are explicit saved mutations rather than hidden derivation from chat or editor state.

Initial status transitions are intentionally small:
- `draft -> active | superseded`
- `active -> completed | superseded`
- `completed -> active` only through explicit reopen
- `superseded` is historical/terminal in Phase 3

Changing a step, task, assumption-like plan text or order updates canonical Planning state. No step status automatically starts code execution.

### PlanStep

Phase 3 historical planning semantics. An ordered unit inside a Plan in the `0.3.6` implementation; the live concept is intentionally removed by the pre-Phase-4 correction.

Initial statuses are `pending`, `active`, `blocked`, `complete`, `skipped` and `superseded`. Blocking requires a visible reason. Reopening or unblocking is explicit. Multiple steps may be active when the developer chooses; Phase 3 does not impose a synthetic single-active-step scheduler.

Tasks reference their parent Plan and PlanStep; the step does not duplicate task membership in a second canonical list.

### Task

Phase 3 historical planning semantics. A bounded developer-owned unit of executable work in the `0.3.6` implementation; the live concept is intentionally removed by the pre-Phase-4 correction and the graph-centered work model is free to define something different.

A Task links objective, requirements, constraints, parent Plan/PlanStep, Project Mind context, project-relative working-set files, status, completion notes and developer-entered validation notes. It does not require AI ownership and has no AI owner field in Phase 3.

Initial status transitions support explicit pending/active/blocked/complete/cancelled progression and deliberate reopen/restore actions. Task status never follows BUILD/PLAN presentation mode automatically.

Opening a Task's file link uses the ordinary editor. Implementation remains ordinary coding until later AI phases add scoped delegation.

### DeveloperSession

A durable representation of one development session.

It should answer:
- what were we trying to do
- what changed
- what did the developer do
- what did AI do
- what decisions were made
- what remains unresolved
- what validation exists
- what ideas were captured

A session is not a raw transcript.

### Research

A structured investigation retaining question, alternatives, evidence, project constraints, unknowns, sources, conclusions, and limitations.

Research remains part of the vision but is deferred beyond the initial Project Mind scope.

### SoftwareMap (sMap)

The umbrella architecture representation for one software project.

The Software Map is the product concept. Its normalized graph is an implementation/query substrate, not the user-facing name. The map remains independent from Theia, diagram libraries and AI/model providers.

The Software Map deliberately separates:
- **Canonical Architecture** — developer-owned System / Subsystem / Component identity, purpose, boundaries, contracts and constraints. It may exist before code.
- **Detected Architecture** — rebuildable evidence-backed candidate System / Subsystem / Component structure derived from repository, semantic, framework and runtime evidence.
- **Physical Map** — current implementation evidence mapped against canonical architecture, including detected-only structure, realization and drift.
- **Planning Map** — proposed target state and transformations that reference canonical/physical identities rather than copying current architecture.

Detection proposes; the developer confirms or corrects. A detector never silently becomes architectural authority, and a developer declaration never erases contradictory implementation evidence.

### PhysicalMap

The evidence-backed representation of implemented software and its realization of canonical architecture.

The Physical Map is organized primarily as:

Project
-> System
-> Subsystem
-> Component
-> CodeEntity

Architecture-scale nodes may be canonical, detected candidates, or a reconciliation of both. The map must distinguish at least:
- **declared-only** — canonical architecture exists but implementation has not yet realized it;
- **detected-only** — implementation evidence suggests an architectural boundary not yet accepted into canonical architecture;
- **realized** — implementation evidence supports the canonical boundary;
- **drifted** — implementation materially disagrees with canonical ownership/boundaries/contracts;
- **unassigned** — implementation is known but not meaningfully mapped yet.

It also contains typed relationships, evidence/provenance and optional runtime observations. The Physical Map is independent from any particular diagram layout.

Physical source facts are deterministic or explicitly labeled otherwise. Runtime facts are observations. Architecture discovery is derived interpretation with evidence. Developer-authored canonical architecture remains authoritative for architectural identity and intent, while conflicting physical evidence remains visible as drift rather than being discarded.

### System

A major independently meaningful software, runtime or product boundary.

Systems should be discoverable from deterministic evidence such as applications, deployable/runtime units, entrypoints, workspace topology, process boundaries and framework bootstraps. Repository layout alone does not define System identity.

The developer owns canonical System identity and may define it before implementation or correct a detected candidate.

### Subsystem

The primary modular architecture unit.

A Subsystem has stable canonical identity, purpose, owned implementation, public contracts, allowed dependencies, forbidden dependencies, entry points, owned data, tests and child Components as applicable.

Subsystem discovery may combine deterministic evidence such as dependency cohesion/direction, package or workspace boundaries, public exports, entrypoints, framework registration and runtime/process boundaries. A directory or cluster is evidence, not authority.

Developer confirmation/correction establishes canonical Subsystem identity. Analysis then validates implementation against it and surfaces drift.

### Component

A cohesive implementation unit within a Subsystem.

Components bridge architecture-scale reasoning and lower-level modules/files/symbols. Components may be detected from finer-grained cohesive implementation evidence, but canonical Component structure remains developer-owned and may exist before code.

### CodeEntity

A language/framework-level implementation entity such as module, file, class, interface, function, method, symbol, endpoint, job, schema or similar analyzer-defined object.

Language-specific analyzers map their native semantics into Dope-owned CodeEntity and relationship contracts.

### SoftwareMapEvidence

Provenance for a physical node or relationship.

Evidence classes include:
- deterministic source syntax/structure;
- semantic symbol/type/reference resolution;
- deterministic framework extraction;
- developer-authored architecture declaration;
- recorded runtime observation;
- inferred semantic relationship.

Evidence records enough source/runtime identity to explain why Dope believes a physical relationship exists.

### PlanningMap

The target/proposal map that references PhysicalMap identities. Its implementation may use graph structures internally, but the product concept is the Planning Map.

Existing physical nodes are referenced, not duplicated. Proposed nodes and relationships remain visibly planned.

### PlannedTransformation

A proposed architectural change against the Physical Map.

Initial conceptual operations include:
- add;
- modify;
- remove;
- move;
- split;
- merge;
- redirect relationship;
- change contract.

The exact executable mapping is phase-owned; the important invariant is that planning expresses transformations of reality rather than maintaining an unrelated drawing.

### Reconciliation

A comparison between a Planning Map target and the newly analyzed Physical Map after implementation.

Useful outcomes include:
- implemented as planned;
- implemented differently;
- not implemented;
- unexpected implementation discovered.

Reconciliation never promotes intent into physical truth merely because a Plan or Task is marked complete.

### ChangeSet

A conceptual representation of a software change: purpose, architecture changes, behavior changes, preserved invariants, unchanged surfaces, affected files/symbols, validation, and relationships to Task/Plan/Decision.

ChangeSet is the bridge from concept to raw diff.

### Validation

Durable correctness/qualification evidence retaining command/procedure, environment, result, observed failures, scope, timestamp, evidence links, and status: Green, Not Green, or Evidence Gap.

A later pass must not erase historical failures.

## Knowledge lifecycle

Observation
-> Idea
-> Explore / Research
-> Decision
-> Plan
-> Task
-> Implementation
-> Validation
-> Project Knowledge

This is not mandatory linear flow. Artifacts can branch, merge, and link.

## Agent Mind

Agent Mind is the structured visible working state of an active AI collaborator/session.

AgentWorkingState may contain:
- objective
- currentStep
- plan[]
- assumptions[]
- decisions[]
- questions[]
- risks[]
- uncertainties[]
- workingSet[]
- ownership[]
- pendingActions[]
- validationState
- status
- lastUpdatedAt

This state is not raw chain-of-thought.

It is product-facing execution state intended for inspection, steering, persistence, and UI rendering.

Agent Mind is introduced when AI Presence becomes real; it is not required to make Project Mind or Planning useful.

## Ownership and delegation

Ownership is explicit and scoped.

Initial values:
- HUMAN
- AI
- SHARED

Ownership can apply to task, plan step, subsystem, file/symbol, validation step, or review responsibility.

Observation rights and mutation rights are separate dimensions.

## ProposedAction

A model does not mutate the environment directly.

It creates or contributes to a ProposedAction with actor, intent, action type, target, expected effect, required authority, originating task/step, evidence/justification, and state.

Possible states:
- proposed
- approved
- rejected
- executing
- succeeded
- failed
- uncertain

The Authority layer decides whether execution is permitted.

## Live steering

Steering is a state transition, not merely another prompt.

A steering action may change objective, edit plan steps, change ownership, add/remove constraints, accept/reject an assumption, stop delegation, preserve a tangent as an Idea, reclassify behavior as intentional, or alter validation expectations.

Future Agent Runtime consumes updated canonical state.

## Provider independence

No canonical Project Mind, Plan, Task, Agent Mind, Session, Decision, ChangeSet, or Validation object may require one provider's native schema.

Provider-native response IDs, conversation/session identifiers, context handles, tool formats, and capability metadata are adapter state unless explicitly promoted through a Dope-owned contract.

Switching model/provider must not require rebuilding canonical project state from chat history.

## Self-development and product-model neutrality

The Dope repository is a canonical dogfood project, not a special product-domain case.

A future "Dope Builds Dope" workflow should use ordinary artifacts and relationships:

Idea / Question
-> Decision
-> Plan
-> Task
-> ChangeSet
-> Validation
-> DeveloperSession

No ProjectArtifact, Plan, Task, Agent Mind, ProposedAction, ChangeSet, Validation, or Session receives extra authority merely because the target repository is Dope.

The same model must remain useful for projects with different languages, frameworks, build systems, repository layouts, and development practices.

## Search model

Project-wide search should eventually span code, notes, ideas, questions, research, decisions, plans, tasks, architecture, sessions, changesets, and validation/tests.

Semantic questions resolve against durable project state with provenance.

Advanced semantic search is deferred beyond the initial roadmap.

## Persistence rules

Canonical product artifacts survive application restart.

Persistence backend is an adapter decision.

Foundation Spike 0 proves a minimal durable implementation without prematurely locking the long-term backend.

The persistence representation must preserve stable IDs, schema version, provenance, relationships, timestamps, and a migration path.

Canonical project knowledge must also have a documented recovery path that does not depend on a healthy Dope GUI. The exact mechanism may evolve, but irreplaceable project truth must not exist only in an opaque form that requires Dope itself to decode or repair.

## Derived versus canonical state

Never silently promote derived UI/framework/provider state into canonical project truth.

Theia layout is presentation state.

Theia AI or provider chat sessions are framework/provider state.

Model narration is provisional.

Architecture extraction is evidence with provenance, not infallible truth.

## Build + Think relationship

BUILD and THINK objects link through the same model.

A Task may link to a Decision.

A future ChangeSet may implement a Plan step.

A Validation may qualify work.

An Idea may be captured while debugging.

A future Research artifact may resolve a Question that updates a Decision.

A Session eventually ties these together without making transcript text the source of truth.
