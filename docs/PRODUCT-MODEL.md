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

Add:
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

### Phase 4 — Physical Software Model

Introduce the evidence-backed software model and deterministic code-analysis foundation.

Initial scope is TypeScript/JavaScript-first and establishes:
- System, Subsystem and Component architecture identities;
- language-independent graph nodes/relationships;
- deterministic source evidence and provenance;
- language-specific semantic analysis behind adapters;
- declared subsystem boundaries and dependency rules;
- queryable physical architecture independent from visualization.

The extracted physical graph is rebuildable derived state. Developer-authored System/Subsystem declarations and architecture constraints are canonical project architecture state.

### Phase 5 — Visual Planning

Connect the physical software model to the planning experience.

Introduce:
- physical architecture projections with semantic zoom;
- planning graphs that reference physical nodes;
- proposed graph transformations for add/modify/remove/move/split/merge/relationship changes;
- linkage from planning transformations to Plans/PlanSteps/Tasks;
- target-versus-physical reconciliation after implementation.

Visual planning remains useful with no model configured. A diagram is a projection of project state, not an independent source of architectural truth.

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

A live control structure.

A Plan has explicit objective/context, status, ordered PlanSteps, a visible revision, links to supporting Project Mind knowledge/files and append-only mutation history. Plan edits are explicit saved mutations rather than hidden derivation from chat or editor state.

Initial status transitions are intentionally small:
- `draft -> active | superseded`
- `active -> completed | superseded`
- `completed -> active` only through explicit reopen
- `superseded` is historical/terminal in Phase 3

Changing a step, task, assumption-like plan text or order updates canonical Planning state. No step status automatically starts code execution.

### PlanStep

An ordered unit inside a Plan.

Initial statuses are `pending`, `active`, `blocked`, `complete`, `skipped` and `superseded`. Blocking requires a visible reason. Reopening or unblocking is explicit. Multiple steps may be active when the developer chooses; Phase 3 does not impose a synthetic single-active-step scheduler.

Tasks reference their parent Plan and PlanStep; the step does not duplicate task membership in a second canonical list.

### Task

A bounded developer-owned unit of executable work.

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

### PhysicalSoftwareModel

The evidence-backed representation of implemented software.

The model is organized primarily as:

Project
-> System
-> Subsystem
-> Component
-> CodeEntity

It also contains typed relationships, evidence/provenance and optional runtime observations. The model is independent from any particular diagram layout.

Physical source facts are deterministic or explicitly labeled otherwise. Runtime facts are observations. Inferred semantics remain inferred. Developer-authored target architecture and agent proposals never silently become physical state.

### System

A major independently meaningful software, runtime or product boundary.

A System can own Subsystems and relationships to other Systems. Repository layout does not define System identity by itself.

### Subsystem

The primary modular architecture unit.

A Subsystem has stable identity, purpose, owned implementation, public contracts, allowed dependencies, forbidden dependencies, entry points, owned data, tests and child Components as applicable.

Subsystem declarations express intended modular architecture. The physical analyzer validates implemented relationships against those declarations rather than treating directories as architecture by default.

### Component

A cohesive implementation unit within a Subsystem.

Components bridge architecture-scale reasoning and lower-level modules/files/symbols.

### CodeEntity

A language/framework-level implementation entity such as module, file, class, interface, function, method, symbol, endpoint, job, schema or similar analyzer-defined object.

Language-specific analyzers map their native semantics into Dope-owned CodeEntity and relationship contracts.

### SoftwareModelEvidence

Provenance for a physical node or relationship.

Evidence classes include:
- deterministic source syntax/structure;
- semantic symbol/type/reference resolution;
- deterministic framework extraction;
- developer-authored architecture declaration;
- recorded runtime observation;
- inferred semantic relationship.

Evidence records enough source/runtime identity to explain why Dope believes a physical relationship exists.

### PlanningGraph

A target/proposal graph that references PhysicalSoftwareModel identities.

Existing physical nodes are referenced, not duplicated. Proposed nodes and relationships remain visibly planned.

### PlannedTransformation

A proposed architectural change against the physical model.

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

A comparison between a planning target and the newly analyzed physical model after implementation.

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
