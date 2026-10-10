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


### Phase 7A — Durable Chat and AI Presence

Phase 7 introduces Dope-owned durable conversational context without redefining Project Mind.

`Chat` is a stable project-scoped conversation identity. `ChatMessage` records visible developer/assistant/tool-event conversation content and execution provenance. `ChatSettings` records persistent per-Chat context/model policy. These are durable project context, but they are not `ProjectArtifact` variants and do not automatically become canonical Decisions, Architecture, Planning intent or implementation truth.

Chats persist beneath `.dope/chats/` in a readable, versioned representation. User-created nested folders organize Chats and serve as the saved-chat selection hierarchy. A Chat ID, not its path, is identity; moving a Chat or folder preserves conversation identity. Created/updated/last-interacted timestamps are durable. Automatic titles are editable, and explicit user titles cannot be overwritten by later automatic generation.

Each Chat also owns one durable **organizational color** from the bounded ten-color palette (blue, cyan, teal, green, yellow, orange, red, pink, purple, indigo). Color is Chat metadata rather than behavioral `ChatSettings`; it carries no product-defined semantic meaning. New Chats receive and persist a deterministic/distributed assignment from stable Chat identity. Existing Chats without color receive one through deterministic schema migration/defaulting. The developer may change it from Chat settings. Rename, folder move, panel relocation and restart preserve it.

A Dope Chat is provider-independent. One Chat may contain assistant turns executed by different connected models/providers. Each submitted turn snapshots the selected model and composed context, and each completed/failed assistant execution records the actual provider/model provenance necessary for inspection. Provider-native response/session/context IDs remain adapter metadata.

The ChatPanel presentation is conversation-first without making Dope chatbot-first. Chat mode keeps a fixed top bar and fixed bottom unified composer around one scrolling transcript. Developer turns use right-aligned bubbles keyed to the Chat color; assistant turns are neutral unboxed formatted Markdown/document output. Role names and execution metadata do not dominate every turn. Status/provenance remain available in compact secondary presentation, and streaming follows the bottom only while the developer has not intentionally scrolled away.

**Select Chat** is a compact conversation/folder browser: readable primary chat titles, secondary timestamps, stable organizational color dots, legible hierarchy and accessible selected/focused states. Folder creation, chat creation, rename and move remain available, but persistent per-row utility-button clutter must not dominate the list. Selection, folder expansion, per-Chat color and Chat ownership behavior remain distinct and durable as already specified. The visual grammar follows AI Center and ADR 0030, including the current `#336699` Dope Dark primary accent rather than the historical orange-as-primary allocation.

All created/used Chats are retained unless an explicit future lifecycle action removes/archives them. Other saved Chats form an available context corpus, not automatic prompt payload. Retrieval/attachment must be bounded and visible. Turn context may record references to editor selections, files, Project Mind artifacts, Architecture/Physical Map/Flow identities, Planning state and saved-chat excerpts that were supplied to the model. Hidden provider chain-of-thought is not durable product state.

Per-Chat settings may define eligible automatic context sources, context/history budget/strategy, and model-specific preferences supported by capabilities. Phase 7A stores an exact default model; Phase 7C extends the forward model policy to **Exact model** or **Follow Interactive role**, preserving existing exact defaults while new role-following Chats default to Interactive. Per-message exact-model controls may override the persistent policy for one turn without silently rewriting it. Credentials, provider endpoints and global model connections remain application/runtime configuration outside the Chat.

Chat is an interface for understanding and proposing project work. Promotion into Project Mind or other canonical domains remains explicit developer-controlled behavior.


#### Verified project grounding

Post-Phase-7 correction `c7-chat-project-grounding` strengthens the read-only Chat context boundary so basic repository/map questions are evidence-backed without requiring manual attachment every time.

For project facts, **verified** means the relevant current project evidence was actually supplied to the model for that turn. A model may interpret supplied evidence, but it may not present an unobserved repository path, directory, source fact, Architecture identity, Physical Map fact or Flow fact as inspected/known.

Grounding is deterministic and bounded: project-relative directory listing, project-file reading, path/file search, text search, Architecture query, Physical Map query and Flow query. Automatic evidence is shown as **Auto context** and persists with normal turn provenance. Missing/stale/out-of-project evidence produces an explicit limitation rather than a guess.

This correction does not add mutation or delegation. Write/process/Git/network authority begins only in the later Scoped Delegation phase.

### Phase 7B-7C — AI Center, connections and role policy

`AIConnection` is a machine-local/application-global provider/runtime connection identity. Its Dope-owned ID is immutable across endpoint, alias, credential, readiness and model-inventory changes. Enabled/Disabled/Removed lifecycle is distinct from transient health.

`AIModel` is connection-scoped identity formed from connection ID + provider model key. Display labels and current capability/readiness may change without changing identity.

The application registry is one logical revisioned authority shared across projects/windows for one OS user/Dope installation. It is not project state and does not live in `.dope/`. Cross-machine sync is deferred.

Connection secrets use Environment, Session-only or OS secure storage. There is no plaintext persistent fallback.

**AI Center** is the singleton user-facing management surface opened from the bottom-left AI launcher. It projects the shared registry and owns connection/model management. Account/profile management belongs under Settings.

`AIModel` carries normalized local/hosted classification, capabilities, limits, readiness and metadata source/quality sufficient for provider-neutral eligibility queries. Unknown capability support does not satisfy hard requirements.

`AIRolePolicy` is user/application routing policy. Initial fixed roles are:
- Interactive;
- Deep Reasoning;
- Background;
- Software Map;
- Coding Agent.

Initial 7C has no arbitrary custom roles.

A role policy contains a preferred exact/constraint target plus ordered fallback entries. Routing is deterministic rather than score-ranked. Hard constraints and soft preferences are separate; locality is represented as one typed constraint such as any/local-only/hosted-only.

Role policy may restrict egress but cannot grant egress authority. Feature/request constraints only narrow policy.

Chat model policy after 7C is either:
- **Exact model**; or
- **Follow Interactive role**.

Existing Phase 7A exact defaults remain exact on migration. New Phase 7C Chats default to Follow Interactive. Per-message model choice remains an exact one-turn override.

Role-policy health is derived (for example Ready, Using fallback, Needs configuration, Broken, Unavailable), not independent canonical state.

Live policy references to removed targets may retain bounded non-secret last-known descriptors for explanation/repair without retaining active connection configuration or credentials.

Every routed execution records compact immutable `RoutingProvenance` sufficient to explain requested role/resolution source, effective hard constraints, policy revision, preferred/actual target and bounded fallback attempts. A user-facing **Why this model?** projection may render that provenance.

Initial feature bindings are:
- role-following Chat -> Interactive;
- explicit heavy foreground analysis -> Deep Reasoning;
- Analyze Project/Search Deeper -> Software Map default-target policy while keeping explicit run authority;
- Phase 10 maintenance -> Background + hard local-only/no-hosted-fallback;
- Phase 8 delegation -> Coding Agent when that consumer ships.

Connection/model configuration and role policy are application state. They never become canonical project truth merely because a project uses them.


### Phase 7-10 — AI collaboration, delegation, sessions and knowledge alignment

Introduce or activate:
- AgentWorkingState / Agent Mind
- Living Software Knowledge Model alignment state
- KnowledgeAssertion / AlignmentFinding
- ownership and delegation
- ProposedAction
- ChangeSet
- Validation integration

AI Presence begins in Phase 7A through the Dope-owned durable Chat/ChatPanel and context-composition boundary defined by ADR 0025. Phase 7B centralizes global connection/model management in AI Center, and Phase 7C adds role policies/routing under ADR 0026. AI Presence may consume Dope-owned architecture, Flow, planning, Project Mind, editor/project and bounded saved-Chat context without making conversation canonical truth. Phase 8 consumes that provider-independent, role-aware runtime for Scoped Delegation / Coding Agent work. Phase 9 adds durable Development Sessions over intent, WorkItems, agent runs and validation. Phase 10 then maintains the Living Software Knowledge Model through deterministic-first, local-first background alignment using Phase 8 change provenance and Phase 9 session context; alignment findings never silently mutate source, documentation, contracts or canonical architecture.

Before Phase 7 general AI Presence, correction `c6-branch-seam` establishes only the minimal Model Runtime/provider-session boundary already needed by existing sMap synthesis. Software Map authority, sMap synthesis strategy and provider execution are separate concerns: Local and hosted synthesis share final evidence/proposal/validation/acceptance semantics but may use different model-appropriate prompt packing and stage strategies. This correction is infrastructure reuse, not early Agent Mind/chat/delegation scope.

Local sMap synthesis and Phase 7 Local AI Presence are also different capabilities. A Local sMap strategy may be developed in parallel after the seam without making LM Studio/Qwen the general Agent Runtime or forcing the hosted sMap strategy to inherit Local-model constraints.

### Phase 9 — Development Sessions

**Design approved, 9A owner-activated 2026-10-10, not yet qualified.** Introduce an optional, project-scoped DeveloperSession as a durable organizational workspace linking existing Chats, Planning Maps/WorkItems, AgentTasks/AgentRuns/Prompt Stacks, decisions and validation. Membership is not ownership, task origin, permission or canonical truth. Sessions must work without AI and cannot silently start work. See ADR 0033 and `docs/planning/p9/phase-9-plan.md`.

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

**Historical only:** this Plan/PlanStep/Task vocabulary belongs to removed Phase 3 `0.3.6` Planning and is **not** the Phase 9 session ontology. Current planning is `PlanningMap -> PlannedTransformation -> WorkItem`; execution is `AgentTask -> AgentRun`. Phase 9 links these records without reviving Phase 3 Plan/Task. See ADR 0017 and ADR 0033.

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

A durable, **optional** organizational workspace for one development effort within one canonical project. A project may contain many sessions; Chat, Planning and Work remain fully usable outside them. Phase 9A is owner-activated for implementation under `docs/planning/p9/activation.md`, but session behavior is not yet qualified and 9B–9E remain inactive.

Owned state: stable session ID, project identity, version/revision, title, objective, timestamps, lifecycle `active | paused | closed`, bounded developer notes/next actions and explicit closeout. Proposed persistence: versioned, atomic `.dope/development-sessions.json`, independently recoverable without a running Dope UI.

Membership consists of **typed references**, not copies: multiple Chat IDs, Planning Map IDs, WorkItems identified by map ID + WorkItem ID, AgentTask/AgentRun/AgentTaskSequence IDs, and optionally Project Mind decision/idea and Software Map IDs. An artifact may appear in multiple sessions without duplicate execution or conflicting ownership. The session resolves status, activity and validation from the existing authoritative stores; missing/deleted/stale links remain visibly unresolved rather than silently retargeted.

A session answers what we intended, what the developer and agents actually did, what was validated, which decisions were accepted, what changed and what remains unresolved/deferred. WorkItem completion, AgentRun completion and Dope-owned validation pass are **different facts**. Session status does not complete WorkItems, cancel AgentRuns, adopt target architecture, mutate source, change Git or confer an ExecutionGrant. Session membership does not rewrite AgentTask `origin` (including reserved `future-session`).

Session opening/navigating focuses existing Chat/Planning/Work surfaces under their normal single-panel ownership rules. Attaching an artifact does not silently add it to model context; future session-aware context requires explicit bounded project-scoped selection and applicable provider/egress consent. Close/reopen records outcomes without changing linked artifact lifecycles.

A session is **not** a raw transcript, agent runtime, replacement Planning Map or new task system. See ADR 0033 and `docs/planning/p9/phase-9-plan.md`.

### Research

A structured investigation retaining question, alternatives, evidence, project constraints, unknowns, sources, conclusions, and limitations.

Research remains part of the vision but is deferred beyond the initial Project Mind scope.

### SoftwareMap (sMap)

The umbrella architecture representation for one software project.

The Software Map is the product concept. Its normalized graph is an implementation/query substrate, not the user-facing name. The map remains independent from Theia, diagram libraries and AI/model providers.

**Architecture** is the canonical user-facing term for the System -> Subsystem -> Component structural organization and its editing surface. **Hierarchy** remains valid as a technical description of tree shape, traversal and hierarchy-first synthesis, but it is not a competing product workspace, mode or primary action name. The umbrella feature remains Software Map; Architecture does not replace the Software Map product term.

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

A WorkItem may later produce one or more AgentTasks, but the WorkItem is not the coding-agent execution primitive. The same AgentTask substrate must also support prompt-stack and direct developer execution without manufacturing fake WorkItems.

WorkItems are implementation planning state, not architecture authority. Editing or completing one does not silently alter the PlanningMap target, canonical architecture or Physical Map.

### Phase 8D — WorkItem delegation and developer review

Owner-activated 2026-10-09. WorkItems remain Visual Planning artifacts, not AgentTasks, provider conversations or blanket grants. One WorkItem may explicitly create multiple AgentTasks with immutable origin references and durable project/map/WorkItem/task/run links. Existing direct Work and Prompt Stacks do not require WorkItems. WorkItem requirements, working set, acceptance and validation constrain delegated tasks; they never widen an ExecutionGrant. WorkItem completion is an explicit developer transition, never inferred from AgentRun completion, promotion or validation.

Ownership is HUMAN / AI / SHARED with explicit delegated and human-reserved portions in SHARED. Assignment is *not* filesystem/process/Git/network authority. Human-reserved paths cannot be delegated or promoted even when an existing broad grant permits project create/modify; enforce the stricter scoped intersection at derivation and promotion. Stale PlanningMap/WorkItem revision, project basis or transformation references block or demand developer reconciliation instead of silently retargeting the task.

WorkItem-origin tasks add a **review-required candidate policy**: after provider execution, freeze CandidateDelta, perform ADR 0029 required validation against that frozen basis, then present the real diff/results for explicit developer accept/reject before ADR 0028 promotion. Accept re-verifies candidate fingerprint, project/Git/path basis, approved grant, narrowed delegated scope and required validation. Reject applies nothing and preserves inspectable evidence. Both are idempotent/restart-safe; accepting a candidate does not complete the WorkItem. Direct Work and Prompt Stack promotion/checkpoint semantics remain unchanged.

Consequential ProposedActions carry stable origin, actor, intent, effect/target, expected impact, requested authority, evidence and durable decision. A developer's review/approval is not an executable grant by itself: the fixed initial denial of delete/rename, Git history/writes, network, secrets and outside-root effects stays enforced until a separately approved and qualified policy can represent those permissions. No one-ProposedAction-per-authorized-file approval spam.

Typed steering is versioned state with durable request and applied/rejected/pending/unsupported acknowledgement. Unsupported mid-turn steering must be displayed truthfully and handled at an explicit safe task boundary. Steering never changes an accepted grant, frozen candidate or previously recorded run. Applied changes may produce scoped Software Map identity/staleness evidence, with unknown identities labeled unresolved and developer-invoked targeted refresh. Continuous automated alignment remains Phase 10.

### Phase 8E — Local coding-agent execution compatibility (owner-activated; not qualified)

The existing Local Model connection in AI Center supports inference for Chat/synthesis, but is **not** itself an eligible coding-agent harness. With 8E now owner-activated for implementation (2026-10-10), a real Local Coding Agent adapter may execute an ordinary `AgentTask` only after observed `agentExecution` capability, sufficient loaded-context capacity and a Dope-owned isolated tool-broker contract have been qualified. Local and hosted runs share the same AgentTask, AgentRun, WorkItem, AgentTaskSequence, ExecutionGrant, frozen CandidateDelta, required Dope-owned validation, developer review, authority, source provenance and restart rules.

Local provider names, model IDs, native sessions, tool schemas and context buffers are adapter/application state, not new canonical Project Mind or Agent Mind objects. Model tool-call requests do not confer filesystem, process, network, Git, private-state or approval authority. The local adapter can refuse unsupported operations and report capacity/turn/tool limits truthfully; it must not silently change model/provider, upload project code, forge consent or modify authoritative project files outside existing Authority/ToolExecutor.

This is an **owner-activated but unqualified design**, not evidence that 8E, local tool execution or local-model parity is implemented or qualified. See ADR 0032 and `docs/planning/p8/phase-8e-plan.md`.

### AgentTask

A provider-independent bounded unit of delegated execution.

An AgentTask may originate from:
- one imported phase/correction prompt;
- a WorkItem;
- a direct developer coding request;
- a future DeveloperSession workflow.

Initial durable fields include:
- stable Dope task ID and schema version;
- created timestamp;
- objective and executable instructions;
- canonical project/root identity;
- model policy: Follow Coding Agent or exact immutable connection/model target;
- model execution controls such as reasoning effort where supported;
- authority requirements;
- bounded validation/completion policy;
- origin kind;
- optional links to WorkItems/Planning transformations/project knowledge.

An AgentTask is not a provider-native thread, response or session. It does not become a WorkItem merely because both describe bounded work.

### AgentRun

One concrete execution attempt of an AgentTask.

Initial durable execution state includes:
- stable run ID and AgentTask identity;
- status: pending / running / blocked / cancelling / cancelled / failed / completed / interrupted;
- requested model/role policy plus actual immutable connection-model-runtime provenance;
- ExecutionGrant identity/revision;
- start/end timestamps;
- starting project identity, Git HEAD and clean/dirty basis;
- ExecutionWorkspace identity/basis sufficient to understand candidate work without treating it as canonical project truth;
- provider-neutral activity/tool/file/process events;
- a durable ordered user-visible agent transcript containing sanitized provider-visible agent messages and structured command entries;
- structured command history with stable command identity, relative cwd, timing, terminal status/exit code and bounded output evidence where retained;
- CandidateDelta summary with classified create/modify/delete/rename effects;
- authority decision and applied authoritative change summary;
- affected project-relative files;
- provider command evidence plus Dope-owned required candidate-validation results with explicit frozen-candidate/ValidationWorkspace basis;
- bounded diff/change summary;
- checkpoint/commit identity only where a later workflow explicitly owns one;
- failure/cancel/interruption/recovery state;
- provider-native recovery handles only as non-canonical adapter metadata.

Phase 8B persists tasks/runs as inspectable project work state beneath `.dope/agent/`, with operational run events and a presentation-grade transcript appendable as bounded JSONL. Secrets, raw hidden reasoning, arbitrary environment dumps and unbounded provider payloads are forbidden from durable run state.

AgentRun is durable enough to inspect and resume/reconcile work across application restart. Provider-visible agent messages are durable user-facing execution output, but they are non-canonical project truth. Hidden reasoning, provider-internal traces and raw provider payloads are not transcript content.

### AgentRun transcript and command history

An explicitly opened center AgentRun transcript tab presents one durable execution transcript in chronological order. Work panel detail controls and observes the same run.

Its **agent messages** reuse the centered, width-constrained, unboxed assistant Chat document presentation and shared safe-Markdown styling (headings, lists, code blocks, inline code, links, tables, block quotes); no fabricated developer turns or user bubbles appear. Structured commands remain chronological, compact and collapsed by default with expandable bounded output and explicit status, exit, truncation and duration where recorded. System/validation/authority/checkpoint evidence remains compact and recognizable instead of impersonating agent prose. Independent scroll follow, manual scroll-away, jump-to-latest, restart restoration, pagination and explicit historical/no-transcript fallback remain intact. This is presentation reuse, not a change to AgentRun storage or authority.

The transcript may contain:
- sanitized provider-visible agent messages exactly as exposed to the developer;
- structured command entries correlated from command start/completion observations;
- compact Dope-owned system/evidence entries where they materially explain validation, file-change, authority, retry, cancellation or terminal state.

The transcript is not a provider-native conversation and does not depend on a provider thread/session surviving. Reopening a run after restart reconstructs the same retained transcript from Dope-owned state.

"Complete transcript" means all ordinary user-visible agent messages retained for the run within explicit safety/storage ceilings. Normal messages must not be replaced by occurrence-only summaries such as "Agent message received." If a hard transcript ceiling is reached, Dope records that truncation explicitly rather than silently presenting an incomplete transcript as complete.

Command history is structured evidence, not conversational prose. One logical command record should correlate command start and completion and retain, when available:
- stable command identity;
- sanitized command text;
- ExecutionWorkspace-relative cwd;
- start/end or duration;
- running/completed/stopped status;
- exit code;
- bounded stdout/stderr or bounded output summary with explicit truncation state.

Provider command history is distinct from CandidateValidation. A provider-run command may appear in the transcript and command evidence, but only Dope-owned CandidateValidation can satisfy a required CompletionPolicy validation target.

Durable transcript storage must never include hidden chain-of-thought, raw provider RPC payloads, credentials/tokens, arbitrary environment dumps or unbounded command output. Visible agent text is sanitized and bounded as user-facing output without reducing routine prose to generic summaries.


### Work module and Prompt Stack

**Work** is the developer-facing execution environment: a presentation of existing AgentTask, AgentRun and AgentTaskSequence state rather than a new canonical task entity, WorkItem or Chat. **Prompt Stack** names both phase and correction stacks. Their classifications, original prompt grammar, immutable snapshots/fingerprints and version/checkpoint laws remain unchanged.

**Select Work** separates truly active runs into Running and retains prior, pending, manual and blocked work in History. It automatically discovers Prompt Stacks under the configured project-relative tasks folder, default `docs/tasks/`, without a user-facing import lifecycle. Selecting a task/run/sequence opens Work detail in the Work panel with controls, progress, validation, candidate changes, authority and checkpoints. The center AgentRun transcript is an optional read-only detail opened explicitly from Work; it retains sanitized agent messages and collapsed commands.

Select Work uses the same quiet, responsive selection-row grammar as Select Chat: distinct Running, History and Prompt Stacks groups; readable task-derived titles; secondary model/status/activity/time details; clear active/hover/keyboard-focus states; and compact contextual actions. The Work detail surface prioritizes current state and meaningful controls while placing verbose technical/provenance diagnostics behind accessible disclosure. Presentation differences must not change run statuses, Prompt Stack discovery, control eligibility or project isolation.

A Work detail title uses the associated stable AgentTask: snapshotted Prompt Stack `entry.title` or direct `AgentTask.objective`, with a bounded fallback for historical missing records. The title never shifts when a Prompt Stack advances.

Chat and Work are separate toolbar-launched modules with no header mode toggle. They reuse panel conventions while preserving separate records, selections and authority. The same Work identity has at most one live Work panel owner per project; selecting it elsewhere focuses the existing panel. Other Work items may appear in other panels. Closing Work never cancels a running task; backend execution exclusion and grants are independent from UI ownership. Selecting Work leaves the independent center editor/visualization workspace unchanged.

Work may start direct tasks through a Chat-like composer, but Coding Agent model role, explicit ExecutionGrant, CandidateValidation and promotion rules apply. Chat's Interactive role, read-only conversation tools, service/storage identity and automatic live steering do not carry into Work.


### AgentTaskSequence

An ordered, durable orchestration of AgentTasks with explicit progression, checkpoint and stop/resume conditions.

The initial Phase 8C consumer is PhaseStackAdapter, which imports the existing repository prompt-stack grammar into a normalized immutable snapshot.

Initial durable sequence state includes:
- stable sequence ID/schema/revision;
- project identity/root reference;
- source stack project-relative path and fingerprint;
- phase/correction identity and version policy;
- ordered imported entries with prompt/model/reasoning/browser/closeout metadata;
- generated AgentTask IDs and AgentRun attempts;
- current entry and sequence status;
- completed checkpoint SHAs;
- current accepted Git/version/worktree basis;
- explicitly accepted dirty-tree basis where applicable;
- manual/browser gate state;
- blocked/failure/interruption reason.

Git history proves checkpoint reality; AgentTaskSequence state preserves imported intent and execution progress. Safe resume requires those representations to agree. Neither silently repairs the other.

Source-stack drift, unreachable/missing checkpoints, unexpected HEAD movement, invalid version progression or mismatched dirty basis block automatic continuation.

An executable sequence entry runs through ordinary AgentTask/AgentRun/ExecutionGrant and ADR 0028 authority. Sequence orchestration never grants a provider direct authoritative Git or filesystem mutation authority.

The initial phase-stack checkpoint is a Dope-owned effect after successful promotion and validation. Sequence advancement occurs only after the checkpoint commit is verified and recorded.

Browser-required prompts and the final closeout are manual gates. A gate remains pending until external repository/Git/version truth proves a coherent continuation; clicking Resume is not completion evidence.

AgentTaskSequence is not PlanStep reborn. It is execution orchestration. WorkItems may create tasks/sequences later, but the first product consumer is the proven sequential prompt workflow.
### CandidateValidation

A Dope-owned required validation attempt over one frozen candidate.

Required CompletionPolicy validation is not delegated to the coding-agent provider. Provider commands may prove that the agent ran a test while working, but only CandidateValidationRunner can satisfy a required validation target.

CandidateValidation records the approved target/command, frozen candidate identity/fingerprint, ValidationWorkspace identity, terminal status, bounded duration/output evidence and explicit failure/cancellation/not-started reason where applicable.

Required terminal states are:
- passed;
- failed;
- cancelled;
- not-started with explicit reason.

CandidateValidation executes in a disposable ValidationWorkspace derived from the frozen candidate, with isolated HOME and bounded private temporary storage. When the approved validation genuinely requires local HTTP/socket fixtures, it may receive a private network namespace with loopback only. It never receives LAN/Internet egress, host-loopback access, authoritative-project writes, Git-write authority, private user state or system/package-administration authority.

A required validation without a durable passing terminal result blocks promotion. Validation cannot silently mutate the promotable candidate; Dope re-verifies candidate identity before Authority evaluates CandidateDelta.

### ExecutionGrant

The developer-approved authority envelope for one AgentTask or AgentTaskSequence.

ADR 0028 separates provider execution authority from authoritative project mutation.

The grant defines:
- the accepted project identity/starting basis and observation scope;
- isolated ExecutionWorkspace read/write/process/test/build scope;
- authoritative project promotion scope: create, modify, delete and rename/move;
- Git actions/checkpoint policy;
- network, secrets/private-state, outside-workspace and system/package-administration authority;
- stop/escalation conditions.

Phase 8B's corrected initial grant allows ExecutionWorkspace read/write/process/test/build and authoritative project create/modify promotion. It denies authoritative delete/rename, Git writes/history changes, network, secrets/private state, outside-workspace effects and system/package-administration actions.

A provider may delete or rename files inside disposable ExecutionWorkspace state; those operations become candidate effects only. Dope computes CandidateDelta, checks the entire candidate against the accepted grant and, in initial 8B, promotes none of it if any effect is unauthorized.

Routine authoritative effects already inside the grant execute without repetitive approval through Dope-owned ToolExecutor. Effects outside the grant are blocked and recorded in the first execution core; richer interactive grant escalation is deferred. Neither model output, provider metadata nor repository content can widen the grant.

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

A model does not receive ambient mutation authority.

A standing developer-approved ExecutionGrant may authorize routine bounded effects without creating a separate ProposedAction for every ToolExecutor promotion or test command. Provider/model writes inside an ExecutionWorkspace are candidate work, not authoritative effects. A model creates or contributes to a ProposedAction when an authoritative effect requires explicit consequential review or exceeds the standing grant. ProposedAction carries actor, intent, action type, target, expected effect, required authority, originating task/step, evidence/justification, and state.

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

No canonical Project Mind, Plan, Task, Agent Mind, Session, Decision, ChangeSet, or Validation object may require one provider's native schema. Dope-owned durable Chat identity/history/settings are likewise provider-independent even though Chat transcript is non-canonical project context.

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

Phase 10 durable knowledge-alignment state is also project-local and recoverable with the repository. Persisted alignment state may include assertion identity, evidence dependencies/fingerprints, last validated basis, open findings and acknowledgement/resolution state. Rebuildable deterministic indexes, transient scheduler queues, prompt payloads, provider response/session IDs and local-model residency remain disposable execution/cache state.

Machine-local application state may hold presentation preferences, provider configuration or disposable caches, but it must not be required to recover canonical architecture, determine whether the sMap is initialized or reconstruct other durable sMap truth. Persisting derived evidence or alignment findings does not make either canonical.

Canonical project knowledge must also have a documented recovery path that does not depend on a healthy Dope GUI. The exact mechanism may evolve, but irreplaceable project truth must not exist only in an opaque form that requires Dope itself to decode or repair.

## Derived versus canonical state

Never silently promote derived UI/framework/provider state into canonical project truth.

Theia layout is presentation state.

Theia AI or provider-native chat sessions are framework/provider state. Dope-owned Phase 7 `Chat` / `ChatMessage` / `ChatSettings` are durable project context, but the transcript remains non-canonical with respect to Project Mind, Architecture, Planning and implementation truth.

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

## Edit Architecture Workspace

**Edit Architecture** is the permanent center-workspace editor for developer-owned System -> Subsystem -> Component architecture.

During initial synthesis it edits the pending Architecture Proposal/Review draft and finishes with explicit **Accept Architecture** or decline. After initialization it starts from current canonical architecture, maintains an independent editable draft, and finishes with explicit **Save Architecture** or discard/cancel.

The accepted-map editor does not synchronize selection, expansion, scroll, focus or Search Deeper state with the Physical Map, Flow projection or left Software Map outline. Those surfaces share stable architecture data/identity, not transient editor presentation state. The existing left-outline <-> center-map shared selection remains a separate presentation contract.

Accepted-map edits are draft-first. Typing, add/remove/reparent operations and accepted Search Deeper refinements do not write canonical architecture. Save Architecture is the explicit canonical mutation boundary and must validate architecture, reject stale/conflicting writes, preserve stable identity where not intentionally changed, then trigger ordinary deterministic Software Map analysis/reconciliation. Saving does not automatically run full synthesis.

Search Deeper remains branch-local and preview-first for Systems and Subsystems. It operates from the current edited branch, preserves unrelated manual edits, rejects stale branch results, and requires an explicitly ready provider only when invoked. Accepting a refinement changes only the editor draft until Architecture is explicitly accepted/saved.

ADR 0024 owns this workspace and terminology contract. The first `c6-edit-architecture` correction does not add architecture revision browsing/history or durable post-acceptance edit-session persistence.


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
