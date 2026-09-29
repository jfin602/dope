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
7. Define focused tests plus broader regression coverage.
8. Identify only the persistence, authority, process, filesystem, network, provider, UI, and framework failure modes applicable to capabilities that exist in the current phase.
9. Separate product/domain logic from Theia UI integration and provider-specific code.
10. Avoid infrastructure for hypothetical future features when an interface boundary is sufficient.

## Phase and gate scope

Product Phase 4 — Physical Map is Qualified/Green at committed `0.4.6` (`fac88712bb55176d3d6d54fbe6034de8b0f801ff`) for its approved scope. The current implementation gate is mandatory correction `c4-architecture-discovery` at unchanged `0.4.6`; after it closes, bounded correction `c4-smap-storage` at unchanged `0.4.6` is mandatory before Phase 5. Phase 5 is not activated.

ADR 0008 remains the Software Map terminology/workbench-placement authority. ADR 0009 as amended by ADR 0010/0011 requires deterministic, source-backed architecture evidence before bounded model synthesis proposes Systems, Subsystems and Components. The developer confirms or corrects proposals and owns canonical architecture; implementation is continuously reconciled against that decision.

The correction may modify Software Map/domain/analyzer/index/backend/inspector behavior needed for explicit initialization, deterministic evidence packets, bounded architecture synthesis, developer confirmation/correction, greenfield architecture-before-code and realization/drift state. It must preserve the existing lower-level TypeScript semantic analyzer/evidence substrate unless concrete defects require bounded repair.

Only the narrow provider-independent sMap synthesis boundary and local reference adapter authorized by ADR 0010/0011 may precede Phase 6. Do not introduce the Phase 5 visual Planning Map/work ontology, general AI Presence/Model Runtime, Agent Mind, authority/delegation or Phase 3 compatibility scaffolding in this correction.

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
- The developer is the final source of truth for canonical architecture. Architecture may be defined before code; synthesis proposes from deterministic evidence, the developer confirms/corrects, and analysis reports realization or drift.
- Physical software facts require deterministic source evidence or recorded runtime observation with provenance; AI interpretation and planning proposals remain distinct from physical truth.
- Durable Software Map state is project-local: repository + `.dope/` must be sufficient to recover it. `.dope/architecture.json` owns canonical architecture, `.dope/smap.json` owns durable initialization/version/state metadata, and any additional persisted sMap artifacts remain beneath versioned `.dope/` storage. Machine-local caches may never be required project truth.
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

Implementation:

/prompt-ass
-> /prompt-plan
-> /prompt-write <folder>

New executable task stacks use explicit GPT-6 Sol labels:
- GPT-6 Sol Medium by default;
- GPT-6 Sol High for materially harder, architecture-sensitive, risky, or broad work;
- GPT-6 Sol XHigh only exceptionally.

Do not author new Terra prompts. Do not silently remap old model labels.

Every correction stack must include a permanent regression guard for the defect class while that behavior remains authoritative. For `c3-remove-planning-instruments`, the permanent guard is negative: current production/package wiring must not reintroduce the removed Planning service/view/mode/storage or `@dope/planning` dependency. Historical docs may still contain those names. When an entire pre-stability subsystem is deliberately superseded, obsolete tests may be removed with the old implementation rather than fossilizing the replaced architecture.

Product authority lives in docs/project-overview.md plus docs/VISION.md, docs/PRINCIPLES.md, and docs/PRODUCT-MODEL.md. Architecture authority lives in docs/ARCHITECTURE.md. Qualification discipline lives in docs/stability-contract.md.
