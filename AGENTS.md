# Dope Agent Guide

Repository: jfin602/dope

Read BOOT.md before substantial repository-aware planning, prompt creation, implementation review, architecture analysis, roadmap work, or documentation changes.

## Role split

ChatGPT should primarily investigate, reason, design, plan, decompose work, review implementation output, and validate claims/evidence.

Implementation agents should execute already-resolved, bounded plans and verify their work.

Dope must preserve the developer as the protagonist. Automation exists to increase capability without hiding engineering understanding or project truth.

## Before recommending implementation

1. Identify the current roadmap/task scope.
2. Read the narrowest relevant product, architecture, workflow, stability, and planning authority.
3. Inspect current source and tests.
4. Identify affected systems/subsystems/components where architecture authority exists, then trace affected producers, consumers, state owners, and presentation adapters. Until the Physical Map exists for the target, state intended boundaries explicitly rather than inventing Software Map evidence.
5. Identify behavior and architectural boundaries the current authority explicitly preserves. Do not treat an earlier internal phase as a compatibility contract by default.
6. Choose the smallest safe implementation boundary.
7. Define focused implementation validation and separately identify broader integration/qualification evidence. Do not execute broader evidence in an ordinary implementation prompt unless its assigned validation tier requires it.
8. Identify only the persistence, authority, process, filesystem, network, provider, UI, and framework failure modes applicable to capabilities that exist in the current phase.
9. Separate product/domain logic from Theia UI integration and provider-specific code.
10. Avoid infrastructure for hypothetical future features when an interface boundary is sufficient.

## Phase and gate scope

**Current roadmap scope:** Product Phase 5 remains owner-closed for sequencing with P11 Not Green and P12 unexecuted. Product Phase 6 — Flow is OWNER-CLOSED FOR SEQUENCING at `0.6.8`, while its P8 audit remains Not Qualified. Product Phase 7 is **OWNER APPROVED / QUALIFIED / CLOSED at the actual `0.7.31` source**; the planned `0.7.32` closeout version did not materialize and must not be invented. Phase 7A/c7 history, Phase 7B Qualified/Closed evidence and Phase 7C Green integrated/final audit remain retained. Before Phase 8, execute and qualify the written bounded post-closeout correction `c7-chat-project-grounding` at unchanged `0.7.31`. It may add only deterministic read-only project grounding (list/read/search/query), visible Auto context and fail-closed evidence rules. It must not add write/process/Git/network/delegation authority.

Product Phase 5 — Visual Software Planning is **OWNER-CLOSED FOR SEQUENCING**. Its retained P11 result is Not Green and P12 was not executed; see `docs/tasks/p5/closeout.md`. Product Phase 6 — Flow is owner-closed for sequencing at `0.6.8`; P8 remains Not Qualified. Product Phase 4 — Physical Map remains Qualified/Green at committed `0.4.6` (`fac88712bb55176d3d6d54fbe6034de8b0f801ff`) for its approved core scope. Architecture-discovery follow-ons remain historical evidence; `c4-smap-storage` and `c4-color-theme` remain GREEN / QUALIFIED at unchanged `0.4.6`.

ADR 0008 remains the Software Map terminology/workbench-placement authority. ADR 0009 as amended by ADR 0010/0011/0012 requires deterministic, source-backed architecture evidence and hierarchy-first bounded synthesis. ADR 0017 owns the Phase 5 planning boundary: Planning Maps reference canonical/physical identities, express explicit target transformations, derive bounded WorkItems, require explicit target adoption, detect stale bases, and reconcile fresh Physical Map reality after implementation. ADR 0023 owns the future Phase 10 Living Software Knowledge Model boundary: deterministic-first impact analysis, local-first bounded background semantic checks, explicit hosted escalation, resource-aware scheduling, durable drift findings and no silent canonical mutation. ADR 0024 establishes **Architecture** as the canonical user-facing structural term and defines permanent **Edit Architecture** behavior; hierarchy remains a technical structural/synthesis term.

Phase 5's retained implementation includes center-workspace Physical/Planning Maps, graph-native planning state, project-local Planning Map persistence, explicit target adoption/rebase and deterministic reconciliation. Its owner closeout is not a qualification claim.

Phase 6 may add only provider-free Flow projection capabilities authorized by ADR 0020 as amended by ADR 0021: evidence-backed directional Flow over existing Physical Map identities, source/provenance inspection and Architecture/Flow view switching. It must not create a separate canonical Flow database or pull Phase 7 AI Presence, Agent Mind, ProposedAction, tool authority or delegation forward.

Only the narrow provider-independent sMap synthesis boundary and reference adapters authorized by ADR 0010/0011/0013 were valid before Phase 7. ADR 0022 authorized the bounded `c6-branch-seam` correction at `0.6.7`; it did not activate general AI Presence. Phase 5 visual planning and Phase 6 Flow remain retained owner-closed implementation, with their qualification gaps preserved. Phase 7A/7B/7C are complete under ADR 0025/0026. Product Phase 8 is **OWNER-ACTIVATED at coherent `0.8.0`** under ADR 0027. The owner explicitly waived the retained Not Green `c7-chat-project-grounding` gaps for sequencing on 2026-10-05 without relabeling them Green. Phase 8A execution is canonical in `docs/tasks/p8a/` and owns Codex AI Center connection/runtime only; repository mutation remains deferred to Phase 8B. Phase 8 uses Codex App Server as the first reference AgentExecutionAdapter, proves AgentTask/AgentRun and sequential prompt-stack execution first, then general WorkItem delegation and local coding-agent compatibility. Product Phase 9 is Development Sessions, and Product Phase 10 is the Living Software Knowledge Model. ADR 0023 does not authorize Phase 10 background alignment before that phase is activated.


### Phase 8 planning laws

- The external Codex phase runner is a behavioral reference/development tool, never the Dope product runtime.
- AgentTask is the execution primitive; WorkItem may create AgentTasks but is not required for prompt-stack/direct execution.
- AgentRun records observable execution/provenance/validation, not hidden chain-of-thought.
- AgentTaskSequence owns ordered progression/stop/resume semantics.
- AI Center owns Codex connection/auth/model inventory; Agent Runtime owns task execution.
- Codex App Server + ChatGPT-plan auth is the first reference coding-agent adapter and is classified hosted.
- Coding Agent routing requires an explicit agent-execution capability; provider name alone is insufficient.
- Dope Authority owns the ExecutionGrant. Routine in-grant effects need no repeated approval; out-of-grant effects pause/escalate.
- Dope owns commits/checkpoints for the initial phase-stack workflow.
- No silent ChatGPT-plan -> OpenAI API-key billing fallback.
- Reference harness qualification precedes local coding-agent qualification.


### Phase 6 Flow laws

- Flow is derived Physical Map truth, not canonical architecture and not a new persisted map.
- Flow means application-level execution/behavioral flow, not compiler basic-block/control-flow graphs.
- `import`, `reference`, or architecture `depends-on` alone is never sufficient proof of execution flow.
- A deterministically resolved invocation is valid Flow evidence even when its payload/arguments are not semantically traced.
- A rendered Flow hop requires a dedicated deterministic physical interaction with traceable evidence or an explicit recorded runtime observation. Data/payload semantics are optional enrichment and require their own evidence.
- Flow roles such as Input / Boundary / Processing / Store / External / Output are projection roles and may vary by focused path; they are not new architecture node kinds.
- Unknown payload/path details remain unknown; analyzers must not infer a missing hop simply to complete a path.
- Flow queries are generation-scoped and bounded. Late results from another project/generation cannot publish into the current projection.
- Architectural Flow aggregation requires continuous evidenced origin paths and must never bridge an unsupported/missing hop.
- Static Flow means possible evidence-backed execution; future runtime Observed Flow is a distinct claim.
- Partial/unsupported/truncated Flow coverage must be explicit rather than visually presented as complete.
- System/Subsystem overview budgets count the semantic Flow actually rendered, not hidden raw implementation detail.
- Shared Flow endpoints do not confer architecture-scope ownership on every fact that uses them; focus membership is fact-relative.
- If a focused scope has evidenced Inputs, truncation may remove interior detail but must not remove every evidenced Input.
- A valid Flow trace is not dependent on the selected identity surviving the current overview truncation.
- Architecture and Flow projections share stable Software Map identity, focus, selection and source-navigation context.
- Initial Phase 6 uses deterministic layered directional layout; do not add an automatic layout-engine dependency unless qualification demonstrates a concrete need.
- Phase 6 may deepen TypeScript/JavaScript and bounded framework extractors for the Adaptive SEO qualification slice. It does not promise whole-program taint/data-lineage completeness or cross-language completeness.

### c6-smap-outline presentation laws

- The left sMap inspector remains the deep hierarchy, responsibility, relationship, evidence, source-navigation and diagnostics surface defined by ADR 0008.
- Architecture hierarchy rows are outline/navigation rows, not a grid of filled primary-action buttons. Brand orange is an interaction/selection accent, not the background of every node.
- Labels are type-first and human-scannable: `system - Name`, `subsystem - Name`, `component - Name`, and for code at minimum `file - project/relative/path`; deeper code kinds may use the same grammar where useful.
- Important names and paths must remain readable. Prefer wrapping over ellipsis/truncation.
- Fresh inspector state starts with every expandable architecture branch collapsed.
- Shared architecture selection remains owned by the existing Software Map controller identity. Do not add an inspector-only selected architecture ID.
- When the center map selects an architecture identity, the inspector opens only the missing ancestor chain required to reveal it, scrolls it into view, and marks it selected. Preserve unrelated branches the user manually expanded rather than collapsing them as a side effect.
- Sidebar row selection must continue to drive the same shared architecture selection observed by the center map.
- Disclosure and selection are distinct interactions: the chevron/disclosure toggles expansion, while the row label selects. Preserve keyboard access, focus-visible treatment, and non-color state cues.
- Expanded/collapsed state is workbench presentation state only. Do not write it into `.dope/`, Software Map DTOs, architecture declarations, Flow state, Planning state, or project persistence.
- Compacting `Open Physical Map` / `Refresh Software Map` is allowed as presentation cleanup, but must not introduce a new toolbar/domain architecture or remove existing inspector diagnostics/details/evidence/source behavior.

### c6-edit-architecture laws

- **Architecture** is the canonical user-facing name for System -> Subsystem -> Component structure/editing. Do not introduce Edit Hierarchy or a competing Hierarchy workspace/mode. Technical uses such as hierarchy-first synthesis remain valid.
- The existing center Architecture Review becomes permanent **Edit Architecture** and is reused for both initial proposal acceptance and accepted canonical architecture editing.
- On initialized projects, the left Software Map compact action group exposes **Edit Architecture** beside Open Physical Map and Refresh Software Map.
- Edit Architecture owns independent selection, expansion, scroll/focus, Search Deeper preview and unsaved draft state. Do not synchronize those states with Physical Map, Flow or the left Architecture outline.
- The existing c6-smap-outline left-outline <-> center-map shared Software Map selection remains unchanged.
- Accepted-map editing is draft-first. Typing, structural edits and accepted refinements must not write `.dope/architecture.json`.
- **Save Architecture** is the explicit canonical write boundary, uses deterministic validation plus stale/conflict protection, and then triggers ordinary deterministic Software Map analysis/reconciliation. It must not automatically run full synthesis.
- Search Deeper on accepted Systems/Subsystems starts from the current edited branch, previews first, preserves unrelated manual edits, rejects stale branch results and changes only the draft until Save Architecture.
- Manual Architecture editing remains provider-independent; Search Deeper requires an explicitly ready provider only when invoked.
- Do not add architecture revision/history UX or durable accepted-map edit sessions in this correction.
- `c6-edit-architecture` follows `c6-smap-outline` where their left action-row work overlaps. `c6-branch-seam` remains independent.


### c6-smap-sidebar-density presentation laws

- This is a follow-on to the Green `c6-smap-outline`; do not reopen or rewrite its closeout.
- Remove the redundant large body `Software Map` heading from the initialized inspector while preserving the sMap Activity Bar/view identity and accessibility naming.
- The initialized control block uses compact `SMAP CONTROLS`; normal published generation/completeness/node/violation state is condensed to one line while actionable partial/error diagnostics remain separately visible.
- `OPEN` and `REFRESH` share the first compact row. The second row is the `EDIT ARCHITECTURE` seam. If the real Edit Architecture capability exists, style that real action. Otherwise do not ship an enabled no-op or invent editing behavior.
- Horizontal width is a first-class constraint: reduce nested list indentation and disclosure/spacer gutter materially without flattening parent/child hierarchy or truncating identity text.
- Entity-kind coloring is stable sidebar presentation semantics. Prefer coloring the existing type token/prefix for System, Subsystem, Component and supported code kinds rather than adding wide badges or painting the whole row.
- Sidebar kind colors are independent from `c6-map-color-grammar` node/branch hue, inheritance and explicit overrides. Do not mirror user node-color preferences into the kind token and do not persist sidebar kind colors.
- Selection/focus remains a separate stronger state with non-color cues. Future warning/status icons must remain a separate semantic channel.
- Row composition may support future warning/status icons, but absent future markers must consume no reserved horizontal width today.
- Preserve the Green outline laws: collapsed fresh state, disclosure separate from selection, shared `SoftwareMapController.selectedId`, center-map ancestor reveal/scroll, preserved unrelated manual expansion, sidebar-to-map selection, full wrapping, presentation-only expansion state, deep inspector diagnostics/evidence/source behavior.
- This correction must not change canonical architecture, Software Map evidence/query truth, Flow semantics, Planning semantics, Edit Architecture domain/save/Search Deeper behavior, synthesis/provider/runtime behavior, project persistence, or package version.

Qualification requirements are phase-aware.

A future invariant does not authorize premature implementation.

Do not introduce a subsystem solely so its eventual stability requirements can be tested.

For Foundation Spike 0, review and implementation scope is limited to:
- commodity IDE behavior
- Theia coupling
- custom Dope views and layout
- typed frontend/backend seams
- minimal Dope-owned persistence
- restart restoration
- extension/tooling compatibility
- Linux packaging

Foundation Spike 0 must not add actual model integration, Agent Mind runtime behavior, tool execution, authority execution, editor-agent mutation, scoped delegation, or ambient intelligence unless the approved Phase 0 authority is explicitly changed first.

## Product laws

- The developer is the protagonist; the agent is an augmenting collaborator.
- The development session, not the prompt, is the fundamental unit.
- Durable Project Mind / Project Intelligence is authoritative product state; chat history is not.
- Agent Mind is structured working state, not raw hidden chain-of-thought.
- Continuous steering must update shared task state without requiring mental restarts.
- Observation authority and mutation authority are distinct.
- Automation is scoped by ownership; it is not a global mode.
- Conceptual changes must be inspectable before raw diffs are the only explanation.
- Ideas, research, decisions, plans, tasks, validation, and architecture are first-class project knowledge.
- The software map is organized primarily as System -> Subsystem -> Component -> Code; subsystems are first-class modular boundaries, not merely folders.
- Deterministic analysis produces verifiable architecture evidence; bounded synthesis interprets it into candidate Systems / Subsystems / Components. A folder, package or cluster is evidence, not automatic architecture.
- Brownfield synthesis is hierarchy-first: build a global repository skeleton, discover Systems, explicitly challenge merge/split/reject boundaries, then descend per System into Subsystems/Components and reconcile/verify uncertainty. The complete deterministic evidence set remains authoritative while individual model calls consume bounded source-backed views.
- Initial sMap analysis must expose meaningful user-visible stage/call-purpose progress and elapsed time rather than an opaque spinner. Do not fabricate percentage-complete when remaining work is not yet deterministically knowable.
- The qualification optimization objective is a useful initial Dope-on-Dope sMap in 8 minutes or less on the defined development configuration. Eight minutes is not a production timeout: slower runs continue for evidence but are Not Green on performance, and architecture quality may not be weakened merely to hit the target.
- Provider/model context capacity is capability input, not a prompt-size target. The current local Qwen qualification setup uses 65,536 loaded context as headroom; no Software Map contract hardcodes that value.
- The developer is the final source of truth for canonical architecture. Architecture may be defined before code; synthesis proposes from deterministic evidence, the developer confirms/corrects, and analysis reports realization or drift.
- Physical software facts require deterministic source evidence or recorded runtime observation with provenance; AI interpretation and planning proposals remain distinct from physical truth.
- Durable Software Map state is project-local: repository + `.dope/` must be sufficient to recover it. `.dope/architecture.json` owns canonical architecture, `.dope/smap.json` owns durable initialization/version/state metadata, and any additional persisted sMap artifacts remain beneath versioned `.dope/` storage. Machine-local caches may never be required project truth.
- Unaccepted architecture-review work may also persist project-locally under `.dope/` as non-canonical, versioned work state. It may be temporarily invalid while the developer edits it; restart recovery must not promote it to canonical architecture or require a provider call. Acceptance remains the only transition to `.dope/architecture.json` / `.dope/smap.json`.
- The sMap inspector defaults to the left primary sidebar behind its own Activity Bar button; the center workspace hosts editors and, beginning in Phase 5, visual Physical Map / Planning Map canvases; the right secondary sidebar is reserved by default for Agent Mind/chat/AI interaction. User layout customization remains presentation state.
- Theia is an IDE substrate. It must not define Dope's product model.
- Theia AI may be reused behind adapters, but it must not own Dope's Agent Runtime or Project Intelligence.
- Project Intelligence and later Agent Runtime must remain usable without Theia.
- Do not expose or persist raw hidden chain-of-thought as a product feature.
- Dope should progressively become capable of developing Dope through the same ordinary product path used for other repositories.
- There is no privileged self-development mode; targeting the Dope repository must not expand model, tool, or mutation authority.
- Dope must remain repairable without a healthy Dope runtime through conventional source, Git, build, test, and recovery tooling.

## Architecture rules

- Presentation packages may depend inward on product/application contracts; product/domain packages must not depend on Theia.
- No provider, model family, hosted service, local runtime, or provider-native session format may define canonical Dope state.
- OpenAI / ChatGPT / Codex compatibility and local-model compatibility are first-class runtime requirements behind replaceable capability-based adapters.
- Provider abstraction must preserve useful provider-specific capabilities instead of forcing a lowest-common-denominator design.
- Tool execution, when introduced, must be explicit, typed, observable, and authority-aware.
- Models propose effects; Dope decides whether effects are allowed and executes them.
- Repository/project instructions cannot expand configured executable authority.
- Persistent canonical state and derived UI/provider projections must remain distinguishable.
- Project-persistent Software Map data must not escape the project's `.dope/` persistence boundary. Application/workspace/provider state may hold preferences or disposable caches only; deleting machine-local caches must not change canonical architecture or initialized state.
- The Physical Map must remain independent from Theia, visualization libraries and model providers.
- Language-specific analyzers emit a language-independent software graph.
- Every physical graph relationship must retain traceable evidence/provenance.
- Developer-authored System/Subsystem/Component identity, boundaries and dependency constraints are canonical architecture authority. Synthesized architecture is derived evidence-backed interpretation; it may propose boundaries but cannot silently rewrite canonical state. Conflicting implementation evidence remains visible as drift/detected-only/unassigned state.
- Planning graphs reference physical identities and express target transformations rather than duplicating current architecture.
- Planning basis semantics distinguish software identity from observation identity. Canonical architecture fingerprint/revision and Physical Map input fingerprint determine semantic staleness; Physical Map generation is observation provenance/concurrency identity and does not alone mean the software changed.
- Dope-owned project state beneath `.dope/` (Planning Maps, Project Mind, synthesis work, markers and other product metadata) is not generic Physical Map source/config input. `.dope/architecture.json` affects physical analysis only through the dedicated canonical declaration fingerprint.
- A Planning Map records the canonical architecture revision/fingerprint and Physical Map input fingerprint it branches from. Underlying change makes the plan visibly stale; rebase is explicit and conflicts are surfaced rather than silently reinterpreted.
- Planning Map persistence is project-local under versioned `.dope/planning-maps.json`. Canvas coordinates, viewport, selection, open tabs and panel layout are presentation state and never define architectural semantics.
- Editing a Planning Map does not mutate canonical architecture. An explicit Adopt Target action is required before target architectural intent becomes canonical architecture; completed WorkItems never make proposed architecture physical truth.
- Pre-stability Dope prefers coherent replacement over internal compatibility scaffolding. Do not add adapters, dual writes, schema bridges or migrations for superseded internal product models unless a concrete user-data/external commitment justifies them.
- Phase 3 Plan/PlanStep/Task, `.dope/planning.json`, Planning RPC/UI, PLAN mode and associated tests are historical implementation details already removed by `c3-remove-planning-instruments`; Phase 4 must not reintroduce them or compatibility scaffolding.
- Prefer standard framework extension points over shell internals; isolate unavoidable deep Theia coupling.
- Forking Theia is a last resort and a failed-spike signal unless explicitly accepted.
- Preserve upgradeability as a design property; qualify it when a real framework upgrade is undertaken rather than forcing synthetic upgrade work into an unrelated phase.

## Review standard

Do not approve work merely because a happy-path demo works.

Review only concerns applicable to the current approved task and phase. Relevant examples include architectural boundaries, state consistency, persistence/restart behavior, Git dirty-state preservation, UI/domain leakage, Theia-internal coupling, validation evidence, and documentation drift.

Cancellation, model streaming, authority enforcement, malformed model/tool output, provider failure, AI ownership, and mutation safety become required review concerns only when the corresponding capabilities are introduced.

Do not report runtime, model, UI, extension, packaging, upgrade, or repository behavior as verified unless actually observed.

## Workflow

Documentation:

/docs-review
-> explicit approval
-> /docs-apply

Registries:

/issue <input>
-> add a complete Open Issue to `known-issues.md`

/feature <input>
-> add a complete Proposed Idea to `feature-ideas.md`

/resolve <ID>
-> resolve a plain issue ID or ship a `+ID` feature entry according to `docs/workflow.md`

Implementation:

/prompt-ass
-> /prompt-plan
-> /prompt-write <folder>

New executable task stacks use explicit GPT-6 Sol labels:
- GPT-6 Sol Medium by default;
- GPT-6 Sol High for materially harder, architecture-sensitive, risky, or broad work;
- GPT-6 Sol XHigh only exceptionally.

Do not author new Terra prompts. Do not silently remap old model labels.

### Execution and validation discipline

New executable prompts must follow the validation tiers in `docs/workflow.md`:
- T1 focused validation is the default for ordinary implementation;
- T2 is explicit affected-system integration;
- T3 is qualification/release/manual/package evidence.

Ordinary implementation prompts target <=8 minutes, have a 10-minute soft ceiling, and a 15-minute hard execution budget. Do not broaden validation merely to consume confidence margin. If the approved work plus T1 validation cannot reasonably fit, split the work during planning rather than turning one implementation prompt into a qualification pass.

Do not rerun a passing broad suite after every repair. Rerun the smallest test capable of proving the repair, then repeat only broader evidence the repair could have invalidated.

Permanent regression guards should normally be cheap and focused. A permanent guard does not imply whole-product qualification on every prompt.

Every correction stack must include a permanent regression guard for the defect class while that behavior remains authoritative. For `c3-remove-planning-instruments`, the permanent guard is negative: current production/package wiring must not reintroduce the removed Planning service/view/mode/storage or `@dope/planning` dependency. Historical docs may still contain those names. When an entire pre-stability subsystem is deliberately superseded, obsolete tests may be removed with the old implementation rather than fossilizing the replaced architecture.

Product authority lives in docs/project-overview.md plus docs/VISION.md, docs/PRINCIPLES.md, and docs/PRODUCT-MODEL.md. Architecture authority lives in docs/ARCHITECTURE.md. Qualification discipline lives in docs/stability-contract.md.
