# Dope Roadmap

Status: ACTIVE ROADMAP
Current stage: mandatory correction `c4-architecture-discovery` at unchanged `0.4.6` before Phase 5; Product Phase 4 is QUALIFIED/GREEN at committed `fac88712bb55176d3d6d54fbe6034de8b0f801ff`

Phase 2 P6 `0.2.6` remains **Not Qualified** as an evidence audit. The owner explicitly accepted the retained gaps for sequencing and closed Phase 2 without relabeling them Green. Phase 3 is therefore authorized from `0.3.0`; see `docs/planning/p3/activation.md`.

This roadmap deliberately starts small.

Dope's long-term vision is an integrated development environment spanning coding, project knowledge, planning, research, architecture, AI collaboration, validation, and durable development context. The initial roadmap does not attempt to build that whole vision at once.

The sequencing rule is:

Theia
-> IDE
-> Project Mind
-> Planning Foundation
-> remove Phase 3 Planning instruments
-> Physical Map
-> sMap initialization + architecture synthesis + developer-authority correction
-> Visual Software Planning
-> AI Presence
-> Scoped Delegation
-> Development Sessions

Each stage should make Dope more useful to the developer before the next layer of AI is added.

## Progressive self-development qualification

Dope should increasingly be developed inside Dope as the roadmap advances.

This is a cross-phase qualification ladder, not an additional phase and not permission to pull later capabilities forward.

| Roadmap stage | Self-development qualification |
| --- | --- |
| Foundation Spike 0 | External bootstrap. Qualify the substrate with existing external tools. Self-hosting is not required. |
| Product Phase 1 — IDE Alive | Dope as editor. Open and work on the Dope repository comfortably inside Dope using ordinary IDE capabilities. |
| Product Phase 2 — Project Mind | Dope understands Dope. Its own decisions, notes, questions, ideas, and durable project context are useful through Project Mind. |
| Product Phase 3 — Planning Foundation | Dope plans Dope. A real Dope feature can move from thought/decision into a live Plan and Tasks without leaving Dope. |
| Product Phase 4 — Physical Map | Dope maps Dope. Its lower-level semantic relationships, declared boundaries and evidence-backed current-state graph can be explored. |
| Correction c4 — Architecture Discovery | Dope initializes Dope's sMap deliberately. Deterministic evidence feeds bounded LLM architecture synthesis, the developer corrects/accepts Systems/Subsystems/Components, and implementation realization/drift is visible. |
| Product Phase 5 — Visual Software Planning | Dope designs Dope. A developer can semantically zoom through canonical and physical architecture, branch into a target Planning Map, derive the necessary work from graph transformations, and reconcile implementation back to reality. |
| Product Phase 6 — AI Presence | AI understands Dope through Dope-owned project state, Software Map context and provider-independent read-only assistance. |
| Product Phase 7 — Scoped Delegation | Dope changes Dope. A bounded Dope task can be delegated through the ordinary authority, review, ChangeSet, and validation path. |
| Product Phase 8 — Development Sessions | Dope Builds Dope. A real Dope feature can travel end-to-end through durable project understanding, architectural planning, implementation, reconciliation, validation, review, and session closeout inside Dope. |

Self-development never receives privileged authority.

Dope must remain repairable with conventional external editor, terminal, Git, build, test, and recovery tooling even after the self-development milestone is reached.

Dogfooding Dope on its own repository is a necessary product qualification, not proof that the product generalizes to every stack.

## Foundation Spike 0 — Theia substrate qualification

Status: **QUALIFIED / OWNER-CLOSED** at package `0.0.6`, closeout commit `425b89d222e1542815af9e38aaa21a4e5a472cb7`.

Purpose:
- prove or reject Theia as Dope's IDE/workbench substrate
- prove domain/presentation boundaries
- prove serious commodity IDE capability
- prove custom Dope UI and layout control
- prove typed frontend/backend communication
- prove minimal Dope-owned persistence and restart restoration
- stress customization and service rebinding
- prove Linux packaging

The spike does not need to prove model integration, Agent Mind execution, tool calling, autonomous mutation, or the future shared coding loop.

Minimal Project Mind and Planning surfaces may use spike data to prove that Dope-owned product views fit naturally inside Theia.

Authority:
- docs/THEIA-SPIKE.md
- docs/planning/foundation-spike-0/decision-record.md
- docs/planning/foundation-spike-0/qualification-plan.md

Package family: 0.0.x

The gate is closed: Theia 1.75.0 is the qualified initial substrate. Upgradeability remains a design requirement and will be qualified on the first natural Theia upgrade rather than through synthetic Phase 0 work.

## Product Phase 1 — IDE Alive

Status: **NOT QUALIFIED — OWNER AUTHORIZED PHASE 2 SEQUENCING**

P6 closeout is **Not Qualified** at `dac6e57275134fc610d8c0c6e2620a90d7d58c2f` (`0.1.6`). The subsequent explicit owner sequencing waiver permits Phase 2 entry without changing this qualification result; see `docs/planning/p2/activation.md`.

Purpose:
Make Dope a serious native development environment before differentiating it with production project intelligence or AI.

Package family: `0.1.x`  
Activation baseline: `0.1.0`

Initial scope:
- production Electron application as the primary user-facing shell
- repository/workspace opening
- editor and language tooling
- Explorer and search
- terminal
- Git/SCM and diff workflows
- debugger
- Problems
- test discovery/execution integration
- preferences and keybindings
- extension installation/use and restart persistence
- Dope branding and sensible default workbench layout
- dark-first default theme with persistent user-controlled theme override
- reliable startup, restart, editor/workbench and workspace restoration
- reproducible Linux AppImage packaging/launch
- direct interactive Theia GUI dogfooding using the Dope repository itself (browser-hosted workbench or Electron)

Presentation rule:

Dope prefers dark mode. First-run/default presentation should be dark and Dope-owned surfaces should be designed/qualified dark-first. Developers remain free to select light mode or compatible custom themes; an explicit user choice persists and overrides the default.

The browser application remains useful for development, debugging, automated qualification, and direct interactive P5 workbench qualification. P4 separately qualifies the packaged Electron artifact and native launch. Headless/CDP-only browser evidence is not sufficient.

The existing Foundation Spike Project Mind Note and Planning views remain provisional spike artifacts. Phase 1 may make them non-intrusive, but must not turn them into production Phase 2/3 features.

Exit condition:

P4 proves the packaged Dope desktop application can be built and launched normally, and P5 proves through direct interaction with the real Theia GUI—browser-hosted or Electron—that a developer can perform the normal development loop on the Dope repository: navigate, edit, search, run commands and tests, inspect diagnostics, use Git/diffs, debug, install/use extensions, restart, and resume without another IDE.

This is the first self-development milestone: **Dope as editor**.

## Product Phase 2 — Project Mind

Status: **OWNER-CLOSED FOR SEQUENCING — P6 AUDIT REMAINS NOT QUALIFIED**

Execution folder: `p2`. Activation source `a7bf2cf4e5b6a7ce70dec8e5989ddee17dae4781`, package `0.2.0`; prompt versions `0.2.1`–`0.2.6`. The `0.2.6` closeout remains Not Qualified. On September 28, 2026 the owner explicitly accepted the unresolved evidence gaps for sequencing, closed Phase 2, and authorized Phase 3 from `0.3.0`. This is an owner waiver/phase disposition, not retroactive Green evidence. Historical authority remains `docs/planning/p2/phase-2-plan.md` and `docs/tasks/p2/closeout.md`.

Purpose:
Give the project durable memory that is useful to the developer before AI is required.

Initial artifact scope:
- Note
- Idea
- Question
- Decision

Foundation scope:
- ProjectArtifact identity
- relationships/links
- provenance
- persistence and migration discipline
- Project Mind navigation
- basic artifact search
- project reopen continuity

Bounded product behavior:
- create/read/edit/archive multiple artifacts in one local project;
- explicit Question answering and Decision acceptance/supersession;
- Ideas remain captured knowledge without automatic scope expansion;
- visible artifact relationships and project-relative file references, including unavailable targets;
- unsaved-draft preservation and visible save/conflict/error states;
- readable project-local storage, explicit legacy Note migration and external recovery;
- cross-process mutation exclusion, revision conflicts and project isolation;
- dark-first, keyboard-accessible presentation with supported light override.

Remote/multi-root Project Mind, Planning/Tasks, AI, semantic search, Sessions and synchronization remain deferred.

Product naming:
- Project Mind is the developer-facing concept.
- Project Intelligence is the internal domain/service boundary that implements it.

Exit condition:

Using Dope should leave the project easier to understand when it is reopened, even with no model configured. Direct GUI qualification must create/use all four artifact types, link/search them, restart/reopen and recover the same saved knowledge. Use actual Dope knowledge and a second local project to qualify isolation. Migration, corruption/conflicts, external recovery, framework independence, and the resulting Electron package also require evidence. Supplemental headless checks do not replace the interactive pass.

## Product Phase 3 — Planning

Status: **QUALIFIED FOR APPLICABLE SCOPE — `0.3.6`** (`docs/tasks/p3/closeout.md`). This is historical qualification, not a forward compatibility contract. Its live Planning instruments must be removed by the mandatory correction gate before Phase 4.

Execution folder: `p3`. Activation baseline: package `0.3.0`; prompt versions `0.3.1`–`0.3.6`. Authority: `docs/planning/p3/phase-3-plan.md` and `docs/planning/p3/activation.md`.

Purpose:
Make planning and implementation part of one durable project state rather than separate markdown files or chat workflows.

Initial scope:
- Plan with objective, context, status and human-visible revision;
- ordered PlanStep records with live status and explicit blockers/reasons;
- bounded Task records attached to a PlanStep;
- append-only planning history for explicit accepted mutations, not keystroke/event sourcing;
- links from Plans/Tasks to Project Mind artifacts and project-relative files;
- a real Planning workspace plus Task detail;
- bounded Project Mind -> Planning bridge actions, including creating a Plan from a Decision;
- ordinary editor navigation from Task/Plan working-set links;
- restart/reopen continuity, conflict protection and local-project isolation.

Plans are live control structures, not static memos. BUILD/PLAN mode remains presentation state and must never silently mutate Plan, PlanStep or Task status.

Phase 3 deliberately remains human-first. It has no model runtime, Codex/OpenAI product integration, local-model runtime, Agent Mind, ProposedAction, tool calling, AI ownership or mutation authority. ADR 0006 makes Codex/OpenAI the first reference provider when AI Presence begins in Phase 6; it does not pull AI into Phase 3.

Planning uses the existing Project Mind `projectId` as the project identity. Phase 3 does not create a competing project identity allocator. If a local project has no canonical Project Mind identity yet, Planning must surface that prerequisite rather than silently creating unrelated identity state. Planning persists separately in readable `.dope/planning.json` and validates identity against Project Mind.

Exit condition:

Using the real Dope repository with no model configured, a developer can move from genuine thought/Decision -> Plan -> ordered PlanSteps -> Tasks -> ordinary coding, revise and progress the plan explicitly, follow linked knowledge/files, restart/reopen and recover the same planning state/history, and demonstrate isolation in a second local project.

This is the first major product milestone:

Real IDE
+
Project Mind
+
Live Planning

## Mandatory pre-Phase-4 correction — `c3-remove-planning-instruments`

Status: **COMPLETE — GREEN / QUALIFIED FOR SEQUENCING at unchanged `0.3.6`** (`docs/tasks/c3-remove-planning-instruments/closeout.md`)

Version semantics: correction stack at unchanged package version `0.3.6`. This is not Product Phase 4 and must not advance roadmap versioning.

Purpose:
Remove the complete Phase 3 Planning product/runtime vertical slice so the Physical Map starts from a clean repository rather than beside obsolete planning architecture.

Required removal:
- `@dope/planning` package and root/package build/typecheck dependency wiring;
- Planning DTO/service contracts (`Plan`, `PlanStep`, `Task`, operations/history/document, service/client/path);
- Planning store/backend/RPC registration;
- Planning controller/widget/file navigation/view/menu/command;
- Project Mind related-Plan/create-from-Decision/show-Plan bridges;
- BUILD/PLAN mode, `WorkspaceMode.PLAN`, PLAN-specific local storage/title/status/CSS behavior;
- Planning-specific unit/storage/UI/restart tests;
- repository `.dope/planning.json` and live Planning storage documentation that only documents the removed runtime.

Required preservation:
- Phase 3 plans, prompts, closeout and evidence documents as history;
- Project Mind domain/persistence/UI and its repository `.dope/project-mind.json`;
- ordinary editor, terminal, SCM, debugger, search, Problems, tests, extensions, preferences/themes and packaging behavior;
- repository workflow and correction/phase runner semantics.

Exit condition:

At unchanged `0.3.6`, aggregate surviving checks/builds pass; Project Mind and ordinary IDE behavior remain usable; package/build graphs no longer depend on `@dope/planning`; and negative guards prove no production Planning service/view/mode/storage wiring or repository `.dope/planning.json` remains. The correction closeout must explicitly clear this gate before Phase 4 activation.

## Product Phase 4 — Physical Map

Status: **QUALIFIED/GREEN — committed `0.4.6` at `fac88712bb55176d3d6d54fbe6034de8b0f801ff`** (`docs/tasks/p4/closeout.md`)

Execution folder: `p4`. Activation baseline: package `0.4.0`; implementation prompts advance through `0.4.1`–`0.4.6`. Authority: `docs/planning/p4/phase-4-plan.md` and `docs/planning/p4/activation.md`.

Purpose:
Make current software architecture a deterministic, explorable part of the development environment before AI is asked to reason over it.

Prerequisite — satisfied:
- `c3-remove-planning-instruments` closed Green/qualified enough for sequencing at unchanged `0.3.6`;
- no live Phase 3 Planning subsystem remains;
- coherent Phase 4 package baseline is `0.4.0`.

Initial scope:
- clean implementation independent from any historical Phase 3 Planning contracts;
- no compatibility adapter, migration or dual-state requirement for Phase 3 Planning;
- language-independent Physical Map
- Project -> System -> Subsystem -> Component -> Code hierarchy
- explicit subsystem identity, purpose, ownership and dependency constraints
- TypeScript/JavaScript-first deterministic semantic analysis
- repository/workspace discovery and incremental indexing
- nodes/relationships for modules, files, symbols and relevant framework concepts
- evidence/provenance for every physical relationship
- declared-versus-observed architecture validation
- query APIs independent from diagram rendering
- no AI requirement

Physical source facts come from deterministic analyzers. Runtime relationships, when introduced, are recorded observations. Inference and proposals remain separately labeled.

September 29 amendment / pre-closeout correction gate:
- ADR 0008 makes **Software Map (sMap)**, **Physical Map**, and **Planning Map** the canonical product vocabulary.
- The current P5 qualification may finish against the pre-decision implementation.
- After P5 and before P6 closeout, a bounded Phase 4 correction must rename the live feature/package/symbol/UI vocabulary and move the inspector to a dedicated left Activity Bar/primary-sidebar surface.
- The right secondary sidebar remains reserved by default for future Agent Mind/chat.
- The Phase 5 center-workspace visual map canvas remains deferred; the correction must not pull it into Phase 4.

Exit condition:

Using the real Dope repository, the developer can inspect an evidence-backed current-state model organized by systems/subsystems/components, trace representative relationships back to source evidence, and detect representative subsystem-boundary violations without any model provider configured.

Closeout disposition: P5 directly qualified the pre-ADR behavior; `c4-tweaks` Green/qualified at unchanged `0.4.5` supplied the mandatory naming/left-sidebar correction before P6. P6 then qualified the approved Phase 4 scope and the runner committed it as `fac88712bb55176d3d6d54fbe6034de8b0f801ff`. Historical Phase 4 prompts/evidence remain truthful for that scope.

## Mandatory post-Phase-4 correction — `c4-architecture-discovery`

Status: **REQUIRED BEFORE PHASE 5 — docs authority locked; implementation stack pending**

Version semantics: unchanged package version `0.4.6`. This correction does not reopen or relabel Phase 4 qualification and must not advance Phase 5 versioning.

Authority: ADR 0009 as amended by ADR 0010.

Purpose:
Correct the architectural interpretation and first-use workflow of the Physical Map before the visual map is built. Phase 4 successfully established the lower-level language-independent graph, TypeScript semantic analyzer, provenance, query/index and inspector substrate. The correction now turns that substrate into an explicit sMap initialization workflow where deterministic evidence supports flexible AI synthesis without surrendering developer architectural authority.

Required behavior:
- preserve the existing TypeScript/JavaScript semantic analyzer as the lower-level evidence engine;
- detect when the current project has no initialized sMap without treating a missing declaration file as the entire lifecycle model;
- on first use, offer an explicit **Analyze Project?** choice rather than silently building the map;
- if the developer declines, build no sMap and create no canonical/derived project state merely to record the refusal;
- keep the sMap surface available in an uninitialized empty state with an **Analyze Project** action that invokes the same flow later;
- distinguish at least `uninitialized`, `analyzing`, `review_required` and `initialized`;
- collect deterministic repository/workspace/build topology, entrypoints, dependency structure, semantic relationships, framework registration and other explicit evidence with provenance;
- send bounded architecture evidence through a provider-independent LLM synthesis capability to propose Systems, Subsystems and Components;
- never treat a directory, package, dependency cluster or LLM response as architecture authority solely because it exists;
- retain evidence/derivation for every generated architecture proposal;
- make developer-authored architecture canonical authority: synthesis proposes, the developer reviews/corrects and explicitly accepts;
- support brownfield correction operations such as confirm, rename, reparent, merge, split, add, remove, replace or ignore without silently rewriting architecture;
- support greenfield/manual canonical System / Subsystem / Component definition before implementation exists and without requiring a model;
- distinguish declared-only, detected/proposed-only, realized, drifted and unassigned implementation state as applicable;
- preserve contrary physical evidence when it disagrees with canonical architecture and surface the difference as drift rather than silently redefining either side;
- keep derived analysis/proposals rebuildable or disposable and keep provider-specific formats outside Software Map domain contracts;
- introduce only the narrow architecture-synthesis model capability required by ADR 0010; keep general AI Presence, Agent Mind, chat, tool execution, mutation, delegation, Phase 5 visual canvas and Planning Map transformations out of this correction.

Minimum qualification:
- first opening an uninitialized project offers analysis rather than silently constructing an sMap;
- declining leaves the sMap uninitialized and produces no canonical architecture or derived map state; visiting sMap later exposes Analyze Project and can start the flow;
- accepting analysis runs deterministic evidence collection before LLM synthesis and every proposed architecture boundary is traceable to evidence;
- a proposal remains non-canonical until explicit developer acceptance;
- developer correction of at least one proposed boundary establishes canonical architecture and subsequent analysis honors that identity while still reporting contradictory implementation evidence;
- a greenfield/manual fixture can initialize canonical architecture with little/no implementation and no model configured, remaining visibly declared-only;
- the real Dope repository can complete the evidence -> synthesis -> review/correction -> acceptance workflow;
- failure/cancellation before acceptance leaves or returns the project to uninitialized unless a separately approved resumable-draft contract exists;
- repeated deterministic evidence extraction for the same inputs is stable and proposal inputs are explainable.

Exit condition:

At unchanged `0.4.6`, Dope can deliberately initialize sMap for an existing project through opt-in deterministic analysis plus bounded LLM synthesis, a developer can correct and explicitly establish canonical architecture, a greenfield project can initialize manually, and the Physical Map can explain how current implementation realizes or diverges from that authority. Only then may Product Phase 5 be planned/activated.

## Product Phase 5 — Visual Software Planning

Purpose:
Design the new planning/work system from the software graph outward and turn architecture understanding, intent and implementation into one visual workflow.

Initial scope:
- multi-tab central workspace for code and planning artifacts
- Physical Map diagrams as projections of the Software Map
- semantic zoom from canonical/detected systems -> subsystems -> components -> packages/modules/services -> files/symbols -> syntax/semantic relationships
- Planning Maps created from/referencing physical nodes
- explicit planned add/modify/remove/move/split/merge/relationship changes
- visible distinction between physical, planned, inferred and unknown state
- graph-derived work decomposition, dependencies, acceptance criteria and validation targets
- implementation targeting/working-set navigation from graph objects
- post-implementation re-analysis and target-versus-physical reconciliation
- no compatibility adapter or migration requirement for Phase 3 internal Planning state
- no AI requirement

Existing physical nodes are referenced rather than copied into planning diagrams. Phase 5 does not assume Plan -> PlanStep -> Task survives; the graph-centered design determines the future work ontology.

Exit condition:

A developer can start from the current physical Dope architecture, create a target architectural plan, connect its transformations to executable Planning state, implement work through ordinary IDE surfaces, re-analyze the repository and see whether the resulting physical software matches the plan.

This completes the core pre-AI product foundation:

Real IDE
+
Project Mind
+
Planning
+
Physical Map
+
Visual Planning

## Product Phase 6 — AI Presence

Purpose:
Introduce AI as an observable collaborator inside an already-useful development environment.

Initial scope:
- provider-independent Model Runtime
- first-class OpenAI/ChatGPT/Codex compatibility
- first-class local-model compatibility
- capability-based provider adapters
- Ask / Explain / Trace / Find Related
- read-only project and editor context
- Project Mind and active Plan context
- suggestions for notes, questions, ideas, and plan refinements
- structured Agent Mind for visible working state

Default posture:
observation and assistance before mutation.

Exit condition:

AI can understand and assist with the project without owning canonical product state or requiring Dope to become chat-first.

## Product Phase 7 — Scoped Delegation

Purpose:
Give AI bounded hands without giving away the developer's authorship or control.

Initial scope:
- HUMAN / AI / SHARED ownership
- explicit observation versus mutation authority
- ProposedAction
- implement/test/refactor actions
- diff/apply/reject flow
- conceptual ChangeSet review
- validation integration
- continuous steering while work is active

Exit condition:

A developer can delegate a bounded portion of work, see what the agent believes and intends, intervene during execution, and retain control over mutation.

## Product Phase 8 — Development Sessions

Purpose:
Make the development session durable for the developer, not only for the model.

Initial scope:
- persistent DeveloperSession
- current objective and active plan
- developer versus AI contribution history
- unresolved work
- decisions made
- validation state
- captured ideas
- reopen/resume context
- session closeout

Exit condition:

Returning to a project restores the developer's mental context well enough to continue without reconstructing the prior session from chat history.

## Deferred beyond the initial roadmap

These remain valid parts of the vision but must not block the initial product:
- dedicated Research workspace
- semantic project-wide search
- advanced ambient intelligence
- automatic Ideas capture
- sophisticated model routing
- multi-agent orchestration
- cloud/remote execution
- collaborative/team workflows
- remote project-state synchronization
- advanced conceptual ChangeSets
- autonomous long-duration development

## Sequencing discipline

Do not promote a later phase simply because its concepts already exist in PRODUCT-MODEL.md.

After Foundation Spike 0:
1. incorporate actual substrate findings
2. run /docs-review
3. revise architecture/product contracts if evidence requires it
4. obtain owner approval
5. decompose Product Phase 1

The roadmap should continue to prefer a smaller usable product over prematurely implementing the full vision.
