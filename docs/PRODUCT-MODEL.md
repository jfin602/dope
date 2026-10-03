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

For an existing uninitialized project, the correction first resolves optional bootstrap documentation. Root `MODULES.md` is the preferred architecture seed when present; root `README.md` remains secondary project orientation. If `MODULES.md` is absent, Dope recommends creating it but allows **Continue with README** when README exists or **Analyze repository anyway** when neither file exists. The correction then uses deterministic repository, semantic and framework analysis as the evidence substrate, plus deterministic provenance-bearing claims from eligible repository documentation. The provider-independent LLM synthesis capability proposes Systems, Subsystems and Components from those inputs. The generated structure is proposal state, not physical fact and not canonical architecture.

Documentation expresses what the project says about itself; implementation/runtime evidence establishes observed current behavior. `MODULES.md` is a strong documented prior for intended System -> Subsystem boundaries, not physical proof. A documented claim may guide discovery or create an unresolved question but cannot by itself establish implemented architecture. Review should make **Observed**, **Documented** and **Inferred** support distinguishable, and historical task/qualification/expected-answer material is excluded from synthesis by default.

After explicit acceptance, `.dope/architecture.json` is the canonical developer-owned architecture. `MODULES.md` is not continuously synchronized and later edits must not silently reshape canonical state. A future reconcile/import/export workflow, if added, requires explicit developer review.

Developer-authored architecture remains canonical. The developer reviews and may confirm, rename, reparent, merge, split, add, remove, replace or ignore proposed boundaries. Only explicit acceptance establishes canonical architecture. Subsequent analysis reports how implementation realizes or diverges from that authority instead of silently rewriting it.

A fresh project may initialize sMap manually by defining canonical architecture before implementation exists. The TypeScript semantic analyzer remains the lower-level evidence engine; AI synthesis interprets evidence above it rather than replacing semantic source analysis.

ADR 0011 sets the first reference synthesis path to local LM Studio with Qwen3-Coder-30B-A3B-Instruct so the core sMap initialization workflow does not require a paid API. The selected synthesis connection/model, endpoint, authentication and runtime/load settings are user/application state rather than canonical project state.

Before the first real synthesis request, provider/runtime orchestration performs readiness checks using synthetic non-project prompts: a structured-output capability probe during setup and a warm-up immediately before project evidence would be submitted. Warm-up failure prevents ArchitectureEvidencePacket submission.

### Phase 5 — Visual Software Planning

Active from baseline `0.5.0`. Design the planning/work model from the Physical Map outward rather than adapting the graph to Phase 3 Planning.

Introduce:
- physical architecture projections with semantic zoom;
- durable Planning Maps that reference canonical/physical identities;
- PlannedTransformations for `add`, `modify`, `remove`, `move`, `split`, `merge`, `redirect relationship` and `change contract`;
- graph-derived WorkItems with dependencies, requirements/constraints, acceptance criteria, validation targets and working-set references;
- explicit target adoption into canonical architecture;
- stale-plan detection and conflict-aware explicit rebase when canonical/physical inputs change;
- target-versus-physical reconciliation after deterministic re-analysis;
- project-local versioned planning persistence at `.dope/planning-maps.json`;
- a new planning/work ontology designed with no Phase 3 Planning runtime present.

The forward ontology is **PlanningMap -> PlannedTransformation -> WorkItem**. Phase 5 does not resurrect `Plan -> PlanStep -> Task`. The Phase 3 domain, `.dope/planning.json`, RPC, UI and associated tests remain historical and removed.

Visual software planning remains useful with no model configured. A diagram is a projection of project state, not an independent source of architectural truth. Canvas coordinates, viewport, semantic LOD, focus, selection, relationship visibility, explicit node-color preferences and tab/layout state are presentation state. Automatic Architecture colors, parent-color inheritance and Flow directional coloring are derived presentation state. Project-scoped explicit color preferences may survive restart, but clearing them returns to deterministic Automatic resolution; deleting/resetting presentation state must not change canonical architecture, Physical Map evidence/realization, Planning Map transformations, staleness or reconciliation. A Flow projection may temporarily render a shared architecture identity with a different directional treatment without changing that identity or its ordinary Architecture color preference.

#### Locked Phase 5 visual semantics

Phase 5 presentation and lifecycle semantics are:

- Physical Map opens at Systems + immediate Subsystems by default; a farther semantic LOD may collapse to Systems only, while Components/Code appear only through bounded semantic zoom/focus so the whole repository does not explode into implementation detail.
- The center map is the primary workspace. Architecture and Flow should give the diagram the maximum practical canvas area; map controls use one compact shared toolbar, while selection/details UI overlays the canvas rather than permanently reserving a large region above it.
- Map toolbar controls are icon-first where the action has a clear visual representation. Every icon control retains a descriptive tooltip, accessible name, keyboard operation and non-color active/disabled state. Ambiguous Dope-specific actions must remain explicitly explained rather than becoming unexplained glyphs.
- Immediate map selection inspection may use a floating overlay with expanded, compact and minimized states. Changing overlay state must preserve selection/focus/trace/source context and should not force graph re-layout. The left sMap inspector remains the deeper provider-free hierarchy/evidence/source-navigation surface and is not replaced by the overlay.
- A label may disappear at a deliberately lower semantic LOD, but every map-visible System, Subsystem, Component, code identity, path or name is rendered completely. Prefer wrapping, path-aware breaks, node growth and layout reflow over ellipsis, clipping or shortening.
- Visual identity uses hierarchy, containment, scale, shape, iconography and edge semantics before color.
- Dependency relationships are progressively disclosed: containment remains the quiet default; selection/focus promotes the relevant typed neighborhood; simplified cross-boundary dependencies remain visible while focused; unrelated edges remain hidden or subdued.
- Geometric zoom coexists with explicit Focus / Up / Fit Architecture navigation. Breadcrumbs preserve the current Project -> System -> Subsystem -> Component context.
- Selection stays synchronized with the left sMap inspector, which provides deterministic/canonical responsibility, children, incoming/outgoing relationships, evidence, source and diagnostics without requiring a model.
- Systems, Subsystems, Components and supported branches may open as separate focused map tabs over the same shared state.
- Developers may assign a node one color from a small curated theme-aware palette and reset it to default. The choice persists per project as workbench presentation metadata, applies consistently to Physical/Planning projections of the same identity, and is never consumed as architecture/evidence/planning meaning.
- Planning Map editing defaults to a physical-versus-target overlay/diff with Current / Target / Diff modes.
- Direct manipulation creates typed PlannedTransformations only when intent is unambiguous; rich operations use explicit editors.
- Unadopted planning edits support domain undo/redo.
- A project may own multiple Planning Maps and explicit alternative branches.
- PlanningMap lifecycle is `draft | active | completed | superseded | archived`.
- Incompatible overlapping active Planning Maps surface explicit conflicts; there is no Phase 5 auto-merge.
- PlannedTransformations are the source of graph-derived WorkItem suggestions; the developer explicitly accepts/reshapes those suggestions.
- WorkItems are a separate work projection linked bidirectionally to transformations and architecture.
- Adopt Target supports coherent partial slices and preserves the remaining still-planned target.
- Staleness is tracked at map, branch and transformation granularity.
- Rebase is an explicit three-way old-basis/current-reality/target-intent operation.
- Reconciliation is transformation-centered and preserves intended versus realized outcome.
- A PlanningMap enters `completed` only through explicit developer closeout after every transformation is resolved, accepted as intentionally different, deferred or abandoned.

### Phase 6 — Flow

Introduce a provider-free **Flow projection** over the Physical Map so Dope can explain what happens through implemented software, not only how it is structurally organized.

Flow is application-level execution/behavioral understanding, not a compiler basic-block CFG. It reuses stable System / Subsystem / Component / CodeEntity identity and adds evidence-backed physical interactions plus derived boundary endpoints.

Initial base interaction semantics are:
- `receives`;
- `invokes`;
- `reads`;
- `writes`;
- `calls-external`;
- `publishes`;
- `consumes`;
- `responds`.

A deterministically resolved project-code invocation is useful Flow even when argument/return lineage is unknown. Data/type/schema/event detail is optional enrichment and appears only when independently evidenced.

Derived Flow endpoints such as HTTP boundaries, stores, queues/topics/jobs, external services and clients are physical projection participants, not canonical architecture nodes.

**Static Flow** represents evidence-backed possible execution relationships. A future **Observed Flow** may add recorded-runtime path evidence; static reachability must never be presented as proof that one concrete request took every reachable branch.

The default product experience is System-level overview first and path exploration second. Inputs act as natural behavioral entry points; selection/tracing highlights relevant execution while unrelated known Flow stays subdued for orientation. Code-level invocation detail is progressively disclosed through System -> Subsystem -> Component -> Code focus.

Flow is rebuildable derived Physical Map state, not a fourth durable map or architecture authority. Unknown payloads, unsupported execution surfaces, truncation and missing hops remain visibly unknown/partial rather than being invented for completeness.


### Phase 7-9 — AI collaboration, knowledge alignment and delegation

Introduce or activate:
- AgentWorkingState / Agent Mind
- Living Software Knowledge Model alignment state
- KnowledgeAssertion / AlignmentFinding
- ownership and delegation
- ProposedAction
- ChangeSet
- Validation integration

AI Presence begins in Phase 7 and may consume Dope-owned architecture, Flow, planning and project context. Phase 8 uses that provider-independent runtime to maintain a Living Software Knowledge Model through deterministic-first, local-first background alignment. Scoped Delegation follows in Phase 9; Phase 8 findings never silently mutate source, documentation, contracts or canonical architecture.

Before Phase 7 general AI Presence, correction `c6-branch-seam` establishes only the minimal Model Runtime/provider-session boundary already needed by existing sMap synthesis. Software Map authority, sMap synthesis strategy and provider execution are separate concerns: Local and hosted synthesis share final evidence/proposal/validation/acceptance semantics but may use different model-appropriate prompt packing and stage strategies. This correction is infrastructure reuse, not early Agent Mind/chat/delegation scope.

Local sMap synthesis and Phase 7 Local AI Presence are also different capabilities. A Local sMap strategy may be developed in parallel after the seam without making LM Studio/Qwen the general Agent Runtime or forcing the hosted sMap strategy to inherit Local-model constraints.

### Phase 10 — Development Sessions

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
- **Architecture Evidence** — deterministic/reproducible source, semantic, framework and recorded-runtime facts packaged as an independently verifiable ArchitectureEvidencePacket.
- **Architecture Proposal** — provider-independent final structured interpretation over one logical evidence packet into proposed Systems / Subsystems / Components. It may be assembled through multiple bounded hierarchy-first synthesis stages over deterministic evidence views, with temporary proposal identity, numeric confidence, rationale, machine-verifiable evidence references and human-readable evidence explanations.
- **Canonical Architecture** — developer-owned System / Subsystem / Component identity, purpose, boundaries, contracts and constraints. It may exist before code.
- **Physical Map** — current implementation evidence mapped against canonical architecture, including proposal/detected-only structure, realization and drift.
- **Planning Map** — proposed target state and transformations that reference canonical/physical identities rather than copying current architecture.

AI interprets evidence; it does not create evidence. Synthesis proposes; the developer confirms or corrects. A structured proposal never silently becomes architectural authority, and a developer declaration never erases contradictory implementation evidence.

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

### FlowProjection

A read-only, evidence-backed behavioral/execution projection of the Physical Map for a selected architectural scope.

It answers **what happens through implemented software** while preserving the same underlying System / Subsystem / Component / CodeEntity identities used by the Architecture projection. Initial scope is System-first with Subsystem focus.

A FlowProjection may include derived physical endpoints for HTTP ingress/egress, stores, queues/topics/jobs, external services/APIs and clients where evidence supports their identity. These endpoints do not become canonical architecture nodes.

Base interaction semantics are `receives`, `invokes`, `reads`, `writes`, `calls-external`, `publishes`, `consumes` and `responds`. A resolved invocation can exist without proven payload lineage. Optional data/type/schema/event annotations require separate evidence.

Branches and joins are graph topology. Ordinary async continuation may be interaction metadata; a real queue/event/job handoff is represented by a derived boundary endpoint. Cycles remain explicit. Directional layout is a comprehension aid and must not imply synchronous, strictly linear or runtime-observed execution.

Architectural aggregation may summarize only continuous evidenced origin paths and retains lower-level provenance. Missing execution hops remain gaps; aggregation cannot bridge them merely to make a cleaner diagram.

The default Flow UX opens as a quiet architecture-level overview, then uses selection and upstream/downstream tracing for path exploration with progressive disclosure of code-level detail.

Static Flow is reconstructible from deterministic/reproducible Physical Map evidence. Future recorded-runtime observations may enrich the same domain as Observed Flow. AI may later explain Flow, but AI output does not silently establish physical Flow truth.


### LivingSoftwareKnowledgeModel

The evidence-linking and alignment layer over the Software Map.

The Living Software Knowledge Model is not a second architecture database and does not replace canonical architecture or the Physical Map. It connects stable Software Map identities to the representations that describe or constrain them, including source/runtime evidence, documentation, ADRs, API/interface contracts and schemas, then tracks whether those representations still agree.

A knowledge relationship preserves provenance and classification. At minimum Dope distinguishes:
- **Observed** implementation/runtime evidence;
- **Documented** descriptive claims about current behavior/structure;
- **Normative** contracts, schemas and accepted architectural decisions;
- **Planned/Future** statements that must not be treated as current-state drift;
- **Historical** material retained for context but excluded from current-state alignment unless explicitly requested.

Deterministic evidence remains authoritative for mechanically provable facts. Model interpretation is permitted only as derived semantic analysis and cannot silently become physical evidence or canonical truth.

### KnowledgeAssertion

A bounded claim linked to one or more Software Map identities and the evidence that currently supports or constrains it.

A KnowledgeAssertion carries stable identity, assertion/classification kind, subject identities, provenance/evidence references, dependency fingerprints, the last validated basis and a current alignment status. Assertions may be extracted from documentation/contracts or created by deterministic analyzers, but extraction does not make their content true.

Changing an evidence dependency invalidates only the assertions that depend on it. Unaffected assertions remain valid without redundant model calls.

### AlignmentFinding

A durable, evidence-backed disagreement or uncertainty produced by alignment analysis.

Representative states include observation, potential drift, confirmed drift, regression, contract violation, needs review and resolved. A finding records affected Software Map identities, implicated representations, evidence references, severity/confidence where applicable, last checked basis and developer acknowledgement/resolution state.

A model result may create or update an AlignmentFinding; it never directly rewrites canonical architecture, source, documentation or contracts.

Background semantic maintenance is local-first. Deterministic analysis narrows affected assertions before model work, and model-facing requests are compact structured micro-checks over the smallest sufficient evidence package. Hosted inference is explicit developer-controlled escalation only; uncertainty in a local check does not authorize silent hosted execution.

Background scheduling, debounce state, transient queues, provider sessions and model residency are execution state rather than canonical project knowledge. Foreground developer work has resource priority over background inference.

### PlanningMap

The durable developer-owned target/proposal map that references canonical and PhysicalMap identities. Existing physical nodes are referenced, not duplicated. Proposed nodes and relationships remain visibly planned. A planned new System/Subsystem/Component may reserve an intended future canonical ID, but that ID remains target intent until explicit adoption.

Each PlanningMap records stable map/project identity, title/objective/status, the canonical architecture revision/fingerprint it branched from, the Physical Map input fingerprint/generation basis it branched from, PlannedTransformations, WorkItems, and revision/history sufficient for explicit mutation/conflict handling.

If the underlying canonical architecture or Physical Map basis changes, the PlanningMap becomes **stale**. Rebase is explicit and exposes conflicts such as removed targets, changed parents, replaced identities, changed dependency contracts and already-realized transformations.

Planning Maps persist in versioned project-local `.dope/planning-maps.json`. Historical Phase 3 `.dope/planning.json` is not migrated or reused. Viewport, node coordinates, selection, collapsed groups, tab state and panel layout are presentation state.

Editing a PlanningMap never directly mutates `.dope/architecture.json`. **Adopt Target** is an explicit developer action through the canonical architecture boundary.

### PlannedTransformation

A proposed architectural change against the PlanningMap's referenced current/canonical basis.

Initial operations are:
- add;
- modify;
- remove;
- move;
- split;
- merge;
- redirect relationship;
- change contract.

A transformation retains affected current/canonical identity where applicable, proposed target state and the references needed to explain the change.

### WorkItem

A bounded actionable implementation unit attached to one or more PlannedTransformations.

A WorkItem may contain stable identity/title/objective, transformation references, dependencies, requirements/constraints, acceptance criteria, validation targets, project-relative working-set references, status and completion notes.

WorkItems are implementation planning state, not architecture authority. Editing or completing one does not silently alter the PlanningMap target, canonical architecture or Physical Map.

### Reconciliation

A comparison between a Planning Map target and the newly analyzed Physical Map after implementation.

Useful outcomes include:
- implemented as planned;
- implemented differently;
- not implemented;
- unexpected implementation discovered.

Reconciliation never promotes intent into physical truth merely because a WorkItem is marked complete. Useful outcomes are retained rather than auto-resolved: implemented as planned, implemented differently, not implemented, and unexpected implementation.

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

For Software Map state, project locality is part of the product contract. Durable sMap state lives beneath the repository's `.dope/` directory: canonical architecture in `.dope/architecture.json`, durable initialization/version/state metadata in `.dope/smap.json`, and any additional persisted sMap artifacts beneath an explicitly versioned `.dope/` sMap namespace. Repository + `.dope/` must be sufficient to recover the durable Software Map.

Phase 8 durable knowledge-alignment state is also project-local and recoverable with the repository. Persisted alignment state may include assertion identity, evidence dependencies/fingerprints, last validated basis, open findings and acknowledgement/resolution state. Rebuildable deterministic indexes, transient scheduler queues, prompt payloads, provider response/session IDs and local-model residency remain disposable execution/cache state.

Machine-local application state may hold presentation preferences, provider configuration or disposable caches, but it must not be required to recover canonical architecture, determine whether the sMap is initialized or reconstruct other durable sMap truth. Persisting derived evidence or alignment findings does not make either canonical.

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


## Architecture Review Work State

Architecture Review Work State is the developer-editable, pre-acceptance representation of a synthesized Software Map architecture proposal.

It is distinct from canonical architecture, accepted initialization, Physical Map truth, provider/model session state and presentation layout.

A review work state may be persisted project-locally so the developer can restart Dope and continue the same review without regenerating the sMap. It carries a stable review identity, a mutable draft revision and enough source association to reject stale acceptance.

The draft is allowed to be temporarily invalid. Dope surfaces deterministic **acceptance blockers** such as invalid/duplicate IDs, invalid containment, unsafe or missing roots and ambiguous exact root ownership. Persisting a blocker does not accept it, and diagnostics never silently decide the architecture for the developer.

Explicit developer acceptance remains the only transition from review work to canonical `.dope/architecture.json` plus accepted `.dope/smap.json`. Explicit cancellation discards the unaccepted work.

## Product Phase 6 — Flow model

Flow is intentionally broader than strict data lineage. It answers **what happens through this software** using application-level invocation, boundary, state and external-interaction evidence. It is not a compiler CFG/basic-block visualization. Data/type/schema labels progressively enrich Flow only when Dope can prove them.

Flow is a **derived Physical Map projection** over existing Software Map identities and evidence.

The durable conceptual shape is:

```text
Software Map
  Canonical Architecture
  Physical Map
    Architecture projection
    Flow projection
  Planning Maps
```

Flow does not introduce a canonical `DataFlowMap` artifact or a `.dope/data-flow.json` store.

### Physical flow facts

Phase 6 introduces a presentation-independent physical-flow fact/query vocabulary inside the Software Map boundary. A physical flow fact represents one evidence-backed application-level execution interaction. It need not prove payload lineage. It may reference existing architecture/code identities and may use stable derived endpoint identities for real external/store/boundary concepts that are not canonical architecture nodes.

Representative flow semantics include:
- inbound input/request/event;
- internal invocation/call;
- transformation/processing;
- persistence read;
- persistence write;
- external request/round trip;
- response/output;
- producer/consumer event relationships where deterministic support exists.

Each physical flow fact retains direct evidence/provenance. Optional payload/type/schema/event metadata is present only when deterministic or recorded-runtime evidence establishes it.

**Structural dependency is not execution evidence.** An import, reference or aggregate dependency can help discover candidates, but it cannot by itself produce a Flow hop. A deterministically resolved invocation can.

### Projection roles

`Input`, `Boundary`, `Processing`, `Store`, `External` and `Output` describe how an entity participates in a selected Flow projection. They are contextual projection roles, not replacements for System / Subsystem / Component / Code identity.

### Uncertainty

Flow preserves uncertainty. An evidence-backed interaction with unknown payload remains visible as unknown payload. A missing hop remains a gap; the UI must not invent a connector to make a path look complete.

### Scope and identity

Initial Flow is System-first with Subsystem focus. The whole repository is not expanded into every flow detail by default. Architecture <-> Flow switching preserves stable selected/focused Software Map identity and source-navigation context.

### Provider boundary

Phase 6 is fully useful without a model provider. AI may later explain physical flow in Phase 7, but model output cannot silently create physical flow facts.
