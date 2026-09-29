# ADR 0012 — Hierarchical sMap synthesis, visible analysis progress and qualification budget

Status: Accepted
Date: 2026-09-29
Amends: ADR 0010, ADR 0011
Complements: ADR 0009

## Context

The first real Dope-on-Dope synthesis work exposed two separate limits in the initial c4 architecture-discovery design.

First, the complete deterministic packet can exceed a locally loaded model context. A real request reached LM Studio only after successful warm-up, but a roughly 95,870-token synthesis request exceeded the selected Qwen runtime's then-loaded 32,768-token context.

Second, and more importantly, technically successful synthesis output has not been reliable enough at the primary product objective: identifying credible top-level Systems. The model is being asked to reason simultaneously about repository-wide architecture and large amounts of lower-level source evidence. Increasing context alone would make larger requests possible without guaranteeing better architectural judgment.

The Software Map exists to organize software primarily as Project -> System -> Subsystem -> Component -> Code. If System boundaries are materially wrong, valid JSON, successful transport and resolvable evidence references are not sufficient qualification.

The local Qwen development configuration is being raised to a 65,536-token loaded context to provide headroom. That runtime choice must not become a product invariant or an excuse to routinely fill the entire window.

## Decision

### Architecture quality is a first-class gate

Initial sMap synthesis is qualified only when it produces materially credible architecture, especially System boundaries.

A technically successful request is not a successful architecture-analysis result merely because the request fits the provider context, the model returns valid structured JSON, the response passes schema validation, or every evidence reference resolves.

Controlled architecture fixtures and the real Dope repository must be reviewed for the quality of System / Subsystem boundaries. Materially incorrect System discovery is Not Green.

### System discovery is explicitly repository-global

A System is a major independently meaningful software, runtime or product responsibility with a coherent architectural boundary and enough owned behavior to contain lower-level structure.

Packages, directories, libraries, persistence mechanisms, frameworks, UI panels and dependency clusters are evidence. They are not Systems merely because they are separately named or structurally isolated.

System discovery therefore receives a compact repository-global view before the workflow descends into local detail.

### Hierarchy-first bounded synthesis

The intended brownfield synthesis workflow becomes:

1. deterministic repository / semantic / framework evidence collection;
2. deterministic global repository skeleton and evidence planning;
3. repository-global **System Discovery**;
4. **System Challenge** that explicitly tests candidates for merge, split, rejection and incorrect promotion of infrastructure/detail;
5. per-System **Subsystem Discovery**, with Component refinement where the evidence and current scope justify it;
6. cross-System architecture reconciliation;
7. targeted uncertainty verification over small evidence scopes when boundaries remain ambiguous;
8. final ArchitectureProposal assembly and validation;
9. developer review/correction and explicit acceptance.

The workflow is bounded. It is not an open-ended autonomous agent loop.

The first implementation is multi-call, not multi-model. The same selected synthesis provider/model may perform all stages. Model voting, majority consensus, agent debate and recursive unlimited decomposition are out of scope unless separately approved later.

### Complete evidence remains deterministic; model views are bounded projections

The complete ArchitectureEvidencePacket remains the deterministic, independently inspectable evidence authority for a given repository analysis.

Dope may derive deterministic bounded synthesis slices/views from that packet for individual stages. A slice preserves the original evidence identifiers and provenance, records its parent packet identity/fingerprint, contains whole normalized evidence items rather than arbitrary mid-item string truncation, is reproducible from the same packet plus the same planner/version/budget inputs, and cannot manufacture evidence or promote model interpretation into evidence.

The deterministic evidence planner should favor repository skeleton, runtime/deployable boundaries, framework/application bootstraps, dependency communities, public contracts, data/state ownership and other high-signal evidence appropriate to the stage.

The model does not get authority to silently choose arbitrary hidden context for another model call. Bounded `needsMoreEvidence` requests remain allowed under ADR 0010, but Dope validates and satisfies them deterministically.

Intermediate model outputs are proposal/candidate artifacts only. Final proposal evidence references resolve against the complete parent evidence packet even when the reasoning was performed over multiple bounded slices.

### Context capacity is capability input, not a target

The synthesis orchestrator obtains context/input capability from the configured provider/model adapter.

No Software Map contract hardcodes 32,768, 65,536, 131,072 or another model context value.

The current local Qwen development/qualification setup uses a 65,536-token loaded context. That is headroom for qualification, not the preferred request size and not project state.

Every model call reserves space for system/instruction text, structured response/output and safety/provider overhead. Dope should prefer substantially smaller focused requests when the task can be solved with less evidence.

> Available context is headroom, not a target.

Repository growth may increase deterministic evidence volume and may increase the number of bounded analysis calls. It must not create an unbounded direct relationship between repository size and the maximum size of one model request.

### Visible analysis progress is a product requirement

Initial analysis may take noticeable time. The sMap UI must therefore expose meaningful high-level progress instead of an opaque spinner.

At minimum, the user can see the current analysis stage, the purpose/type of the current model call when a model call is active, the current subject when applicable, completed and remaining known stages, deterministic unit counts when a denominator is actually known, elapsed analysis time, and visible retry/failure/recovery state.

Representative user-facing stages include Collecting repository evidence, Building architecture skeleton, Discovering Systems, Challenging System boundaries, Discovering Subsystems — <System>, Reconciling architecture, Verifying uncertain boundaries, and Preparing sMap for review.

Dope must not invent precise percentage-complete values when future calls or verification work are not yet knowable. Stage progress and known unit counts are preferred.

Provider/model names may be shown as ordinary execution metadata. Raw prompts, hidden chain-of-thought and private model reasoning are not progress UI.

### Progress is emitted by the orchestration contract

The synthesis/application layer should expose typed workflow events rather than making the UI infer state from provider logs.

The contract should support events equivalent to analysis started/completed/failed/cancelled; evidence collection started/completed; evidence planning/skeleton started/completed; System Discovery started/completed; System Challenge started/completed; per-System Subsystem Discovery started/completed; reconciliation started/completed; targeted verification started/completed; and provider call retry/failure/recovery where applicable.

Safe event metadata may include stage, status, subject, completed units, total known units, provider/model label, attempt, elapsed time and a concise user-facing message.

This same event stream should support browser and Electron presentation and remain provider-independent.

### Eight-minute initial-analysis objective

The qualified initial Dope-on-Dope sMap analysis has a hard optimization objective of **8 minutes or less end to end** on the defined development qualification configuration.

This is a qualification/performance requirement, not a production runtime timeout.

If a run exceeds eight minutes, Dope does not automatically cancel, truncate or force a lower-quality result; the run may continue to completion so output quality, stage timing and bottlenecks remain observable; the performance gate is Not Green for that run; and collected timing evidence is used to optimize the pipeline.

Architecture quality must not be weakened merely to satisfy the time objective.

Optimization mechanisms may include deterministic evidence prioritization, bounded packets, avoiding redundant calls, safe parallelism between genuinely independent work, caching and incremental reuse.

Every deterministic stage and model call required for qualification records elapsed time so the eight-minute budget can be attributed rather than guessed.

### Caching and incremental identity

Bounded synthesis work should be cacheable/reusable using deterministic identity that includes at least parent evidence packet/slice identity, synthesis stage and stage version, synthesis contract/prompt version, and selected provider/model identity where output compatibility depends on it.

Unchanged analysis input should not require re-running identical expensive calls merely because the UI is reopened.

Caching is an optimization and derived state. It does not change the project-local canonical-authority rules or the persistence boundary defined elsewhere.

### Qualification expectations

The hierarchical correction must prove at least:
- known architecture fixtures produce credible System boundaries and do not promote ordinary infrastructure/directories/packages to Systems without architectural justification;
- System Challenge can merge, split or reject initial candidates;
- per-System descent produces Subsystems in the context of an already-established candidate System instead of rediscovering the whole repository at every level;
- all final proposal evidence references resolve to deterministic parent evidence;
- repeated unchanged deterministic planning/slicing is stable;
- no individual model request exceeds the configured provider/model budget;
- the real Dope repository produces architecture that passes explicit human review for material System-boundary quality;
- the user can see live stage/call-purpose progress throughout a real analysis;
- the qualification run records stage/call timing and completes in eight minutes or less to be Green on performance;
- runs that exceed eight minutes continue for evidence rather than being hard-cancelled;
- developer correction/acceptance remains the only transition to canonical architecture.

## Correction gate

Do not rewrite the already-running `c4-smap-synth` P6-P8 prompts to retrofit this decision.

After the current `c4-architecture-discovery` / `c4-smap-synth` stack closes, run mandatory correction `c4-smap-hierarchical-synthesis` at unchanged package version `0.4.6`.

That correction must establish the hierarchy-first synthesis orchestration, bounded evidence planning, visible progress contract/UI, timing instrumentation, architecture-quality gates and eight-minute qualification objective described here.

Only after `c4-smap-hierarchical-synthesis` closes Green may the queued `c4-smap-storage` correction execute. Product Phase 5 remains blocked until both follow-on corrections are Green.

## Consequences

- The Software Map optimizes for correct architectural interpretation rather than maximum prompt size.
- Larger repositories can consume more total analysis work without forcing one giant request.
- The developer can see what Dope is doing while analysis is active and where time is being spent.
- Provider context expansion improves headroom without becoming an architectural dependency.
- Real architectural quality and end-to-end time become explicit qualification evidence.
- The complete deterministic evidence set remains inspectable and source-backed even when models consume smaller focused views.
