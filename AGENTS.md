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
4. Identify affected systems/subsystems/components where architecture authority exists, then trace affected producers, consumers, state owners, and presentation adapters. Until the Physical Software Model exists for the target, state intended boundaries explicitly rather than inventing software-model evidence.
5. Identify behavior and architectural boundaries the current authority explicitly preserves. Do not treat an earlier internal phase as a compatibility contract by default.
6. Choose the smallest safe implementation boundary.
7. Define focused tests plus broader regression coverage.
8. Identify only the persistence, authority, process, filesystem, network, provider, UI, and framework failure modes applicable to capabilities that exist in the current phase.
9. Separate product/domain logic from Theia UI integration and provider-specific code.
10. Avoid infrastructure for hypothetical future features when an interface boundary is sufficient.

## Phase and gate scope

The current implementation phase is Product Phase 4 — Physical Software Model, activated from coherent package baseline `0.4.0`. Correction `c3-remove-planning-instruments` is complete and Green/qualified for sequencing; no live Phase 3 Planning subsystem remains.

Phase 4 is limited to deterministic current-state software modeling: language-independent graph contracts, developer-authored architecture declarations/constraints, TypeScript/JavaScript-first analysis, rebuildable indexing, evidence/provenance, architecture-boundary validation, renderer-independent query APIs and bounded inspection/navigation UI. Do not introduce target/planning graphs, editable architecture design, AI/provider runtime, Agent Mind, authority/delegation or Phase 3 compatibility scaffolding.

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
- The software model is organized primarily as System -> Subsystem -> Component -> Code; subsystems are first-class modular boundaries, not merely folders.
- Physical software facts require deterministic source evidence or recorded runtime observation with provenance; AI interpretation and planning proposals remain distinct from physical truth.
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
- The Physical Software Model must remain independent from Theia, visualization libraries and model providers.
- Language-specific analyzers emit a language-independent software graph.
- Every physical graph relationship must retain traceable evidence/provenance.
- Developer-authored System/Subsystem declarations and dependency constraints are architecture authority; extracted relationships validate against them.
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
