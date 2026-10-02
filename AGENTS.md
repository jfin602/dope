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

**Current roadmap scope:** Product Phase 5 is owner-closed for sequencing with P11 still Not Green and P12 unexecuted. The owner waiver preserves all missing evidence rather than converting it to Green. Product Phase 6 — Flow is **ACTIVE / PROMPTS WRITTEN / READY FOR EXECUTION** from coherent `0.6.0` baseline `710edb362f9881ab41215705db4f08d8daca6293` under ADR 0020 as amended by ADR 0021 and `docs/planning/p6/phase-6-plan.md`. The approved P1-P8 executable stack is written under `docs/tasks/p6/`; validate it with `npm run codex:phase:validate -- p6` before execution.

Product Phase 5 — Visual Software Planning is **OWNER-CLOSED FOR SEQUENCING**. Its retained P11 result is Not Green and P12 was not executed; see `docs/tasks/p5/closeout.md`. Product Phase 6 — Flow is the current planning scope from `0.6.0`. Product Phase 4 — Physical Map remains Qualified/Green at committed `0.4.6` (`fac88712bb55176d3d6d54fbe6034de8b0f801ff`) for its approved core scope. Architecture-discovery follow-ons remain historical evidence; `c4-smap-storage` and `c4-color-theme` remain GREEN / QUALIFIED at unchanged `0.4.6`.

ADR 0008 remains the Software Map terminology/workbench-placement authority. ADR 0009 as amended by ADR 0010/0011/0012 requires deterministic, source-backed architecture evidence and hierarchy-first bounded synthesis. ADR 0017 owns the Phase 5 planning boundary: Planning Maps reference canonical/physical identities, express explicit target transformations, derive bounded WorkItems, require explicit target adoption, detect stale bases, and reconcile fresh Physical Map reality after implementation.

Phase 5's retained implementation includes center-workspace Physical/Planning Maps, graph-native planning state, project-local Planning Map persistence, explicit target adoption/rebase and deterministic reconciliation. Its owner closeout is not a qualification claim.

Phase 6 may add only provider-free Flow projection capabilities authorized by ADR 0020 as amended by ADR 0021: evidence-backed directional Flow over existing Physical Map identities, source/provenance inspection and Architecture/Flow view switching. It must not create a separate canonical Flow database or pull Phase 7 AI Presence, Agent Mind, ProposedAction, tool authority or delegation forward.

Only the narrow provider-independent sMap synthesis boundary and reference adapters already authorized by ADR 0010/0011/0013 remain valid before Phase 7. Phase 5 visual planning remains retained owner-closed implementation with no model requirement. Product Phase 6 Flow is provider-free and current. General AI Presence begins only in Product Phase 7.


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
- Architecture and Flow projections share stable Software Map identity, focus, selection and source-navigation context.
- Initial Phase 6 uses deterministic layered directional layout; do not add an automatic layout-engine dependency unless qualification demonstrates a concrete need.
- Phase 6 may deepen TypeScript/JavaScript and bounded framework extractors for the Adaptive SEO qualification slice. It does not promise whole-program taint/data-lineage completeness or cross-language completeness.

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
