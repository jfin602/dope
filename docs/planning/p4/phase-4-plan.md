# Product Phase 4 — Physical Map Plan

Status: OWNER APPROVED — ACTIVE
Package baseline: `0.4.0`
Execution folder: `p4`
Authority: ADR 0007, PRODUCT-MODEL, ARCHITECTURE, roadmap and Phase 4 activation

Amended September 29, 2026 by ADR 0008: canonical product terminology is **Software Map (sMap)** / **Physical Map** / **Planning Map**, and the default Phase 4 inspector belongs in the left primary sidebar behind its own Activity Bar button. The in-flight P5 qualification may finish against the pre-amendment implementation; a post-P5 correction must bring live names and placement into conformance before P6 closeout.


## Objective

Make implemented software architecture a deterministic, evidence-backed, queryable part of Dope before visual planning or AI is introduced.

The developer must be able to answer:

- what Systems, Subsystems, Components and code entities exist;
- which implementation belongs to which declared modular boundary;
- which dependencies exist between those boundaries;
- exactly what source evidence caused Dope to believe each physical relationship;
- where implementation violates developer-authored architecture constraints.

The Physical Map must remain useful with no model provider configured.

## Core product boundary

The primary hierarchy is:

Project
-> System
-> Subsystem
-> Component
-> CodeEntity

Subsystem is the primary modular architecture boundary. A folder is not a Subsystem merely because it exists.

Phase 4 describes current implemented reality. It does not design target state.

## State model

### Canonical developer-authored architecture state

Introduce one readable project-local architecture declaration, expected at `.dope/architecture.json`.

It owns stable developer-authored identity and intent for:
- Systems;
- Subsystems;
- Components where explicitly declared;
- purpose/description;
- owned implementation selectors or roots where needed;
- public/entry contracts where represented;
- allowed dependencies;
- forbidden dependencies;
- other bounded architecture constraints required by this phase.

Do not force every code entity into a declaration. Unknown/unassigned implementation remains visibly unknown/unassigned rather than being fabricated from folder names.

The declaration format must be strictly parsed, versioned, recoverable outside Dope and protected from unsafe path interpretation.

### Derived physical state

The extracted software graph and search/index structures are rebuildable derived state.

Derived state may be cached only if implementation evidence requires it, and any cache must be disposable/reconstructable from source plus canonical architecture declarations.

A cache must not become the sole owner of stable developer-authored architecture identity.

## Package boundaries

Create packages only when real code lands.

Expected Phase 4 boundaries:

- `@dope/software-map`: language-independent graph contracts, identity/evidence types, architecture declarations/rules, graph construction/query/validation semantics.
- `@dope/code-analysis`: repository/workspace discovery and analyzer orchestration contracts; no TypeScript-specific ontology.
- `@dope/code-analysis-typescript`: deterministic TypeScript/JavaScript analyzer adapter using TypeScript compiler/project semantics where authoritative.
- existing `@dope/theia-extension`: typed backend attachment/orchestration and presentation only.

Do not place Theia imports in software-map or analyzer domain packages.

Do not create a rendering/diagram package in Phase 4.

## Identity rules

Developer-authored System/Subsystem/declared Component IDs are stable explicit IDs from canonical architecture state.

Derived CodeEntity identity must be deterministic for the same semantic entity within the same project/revision inputs. Do not generate random UUIDs during each analysis pass.

Identity design must distinguish at least:
- declared architecture identity;
- source/module/file identity;
- symbol/entity identity where semantic resolution supports it;
- analyzer/framework-specific entity kind without making TypeScript kinds canonical product ontology.

Renames/moves may legitimately change derived identity unless a deterministic stronger identity exists. Do not invent false continuity.

## Physical graph

The language-independent graph owns typed nodes, typed directed relationships and evidence/provenance.

Minimum useful physical relationships for this phase:
- architecture containment/ownership;
- file/module containment;
- import/dependency;
- export/public exposure where deterministically known;
- semantic symbol reference;
- inheritance/implementation where deterministically known;
- aggregated Component/Subsystem/System dependency edges derived from lower-level evidence.

Do not require a complete dynamic call graph.

Framework concepts such as routes/jobs/schemas may be added only through explicit deterministic extractors and must still map into Dope-owned graph contracts.

## Evidence and provenance

Every derived physical node/relationship that can affect architectural interpretation must be explainable.

Evidence records enough information to trace the fact back to its producer, including as applicable:
- evidence class;
- analyzer/extractor identity/version;
- project-relative source path;
- source span or semantic symbol location;
- originating lower-level relationship(s) for aggregated architecture edges;
- recorded runtime observation identity if runtime evidence is later introduced;
- inference label if a non-physical inferred relationship is exposed.

Source-derived deterministic facts and developer-authored declarations must never be conflated.

## TypeScript/JavaScript analyzer

The first analyzer is TypeScript/JavaScript-first because Dope is the first dogfood repository.

Use TypeScript project/compiler/type-checker/module-resolution semantics where they provide authoritative deterministic information.

Support realistic repository discovery:
- root/project tsconfig files;
- referenced/composite projects where present;
- TypeScript and JavaScript source accepted by the configured project;
- workspace/package boundaries as repository metadata, not automatic architecture boundaries;
- generated/vendor/excluded files according to project/compiler configuration.

Analyzer failures must be explicit and partial results must not silently masquerade as complete analysis.

## Indexing and invalidation

Phase 4 must support repeat analysis without requiring application restart.

Prefer a simple deterministic rebuild first. Add incremental invalidation only where it materially improves the actual repository workflow and remains testable.

If incremental indexing is implemented:
- define invalidation inputs explicitly;
- produce the same normalized result as clean rebuild for the same source state;
- avoid stale relationships after delete/rename/config changes;
- expose analysis status/errors instead of returning silently stale truth.

## Architecture validation

Developer-authored dependency rules are checked against extracted physical relationships.

A violation is first-class queryable output with:
- violated rule/constraint identity;
- source and target architecture identities;
- offending physical relationship(s);
- evidence/source navigation;
- deterministic explanation.

Rules must not be satisfied or violated merely from directory adjacency.

At minimum qualify representative allowed and forbidden Subsystem dependencies on the Dope repository or a controlled fixture.

## Query boundary

Queries are independent from visualization.

Provide bounded APIs for:
- architecture hierarchy;
- node/entity detail;
- ownership/containment;
- direct and aggregated dependencies;
- incoming/outgoing relationships;
- evidence/provenance;
- architecture violations;
- source-location resolution;
- analysis status/errors.

The query layer should support Phase 5 visualization later without adopting a graph-canvas schema now.

## Theia integration

The Theia layer attaches a supported local project, triggers/observes analysis and exposes typed query operations.

Phase 4 presentation is an inspector, not a design canvas.

Default placement is part of the product contract:
- expose a dedicated **sMap** Activity Bar button;
- open the Software Map inspector in the **left primary sidebar**;
- leave the **right secondary sidebar** available by default for future Agent Mind/chat/AI interaction;
- keep the center workspace available for editors now and the Phase 5 Physical Map / Planning Map visual canvases later;
- permit ordinary user rearrangement as presentation state.

Required user-visible capabilities:
- navigate System -> Subsystem -> Component -> relevant code;
- inspect purpose/identity and ownership;
- inspect incoming/outgoing dependencies;
- inspect relationship evidence;
- inspect architecture violations;
- jump to source;
- refresh/reanalyze current repository;
- distinguish loading, partial/error, empty/unassigned and stale/reanalysis states honestly;
- remain usable in dark default and explicit light theme.

Do not introduce target-state editing, drag/drop architecture design or planning transformations.

## Persistence/recovery

Canonical `.dope/architecture.json` must be readable and externally recoverable.

If Phase 4 adds any derived cache/index on disk, document:
- that it is disposable;
- cache schema/version;
- rebuild procedure;
- corruption handling;
- containment/symlink discipline;
- how stale/incompatible cache is rejected or rebuilt.

Do not put derived graph snapshots into `.dope/project-mind.json`.

## Post-P5 correction gate

The Phase 4 P5 prompt/evidence may retain the legacy Software Model naming and current right-side placement because it was already in flight when ADR 0008 was accepted. Do not rewrite historical/in-flight qualification artifacts merely to make them look newer.

After P5, before P6 closeout, execute a bounded correction at the unchanged then-current package version. It must:
- rename live `@dope/software-model` / `software-model` package, symbol, command, view and UI terminology to the Software Map/sMap vocabulary;
- move the inspector to the dedicated left Activity Bar/primary-sidebar surface;
- install permanent regression guards for both terminology and default placement;
- preserve all Phase 4 graph/evidence/query behavior;
- avoid implementing the Phase 5 visual canvas or Planning Map editing.

## Dogfooding

The direct GUI qualification target is the real Dope repository.

The phase must demonstrate:
- a meaningful declared architecture for Dope sufficient to exercise Systems/Subsystems/Components;
- representative TypeScript relationships traced to source evidence;
- navigation from architectural node to source;
- at least one representative dependency aggregation;
- at least one controlled or genuine architecture-rule violation with evidence, followed by restoration/repair where a controlled probe is used;
- reanalysis after a controlled source/config change and no stale relationship;
- restart/reopen usability where applicable;
- preservation of Project Mind, ordinary IDE behavior and unrelated Git state.

Dogfooding Dope does not prove the ontology is Theia/TypeScript-specific. Tests must include language-independent graph/domain fixtures separate from the TypeScript adapter.

## Validation

Permanent focused coverage must include:
- strict architecture declaration parsing/identity/rules;
- deterministic graph identity and relationship construction;
- evidence completeness;
- graph queries and aggregated dependencies;
- TypeScript module/symbol resolution across representative fixtures;
- excluded/generated/config-change handling;
- clean rebuild determinism;
- incremental-vs-clean equivalence if incremental indexing is added;
- architecture violation correctness/evidence;
- local-project isolation/containment for canonical architecture state;
- backend attach/query lifecycle;
- presentation race/stale-project guards for async analysis/query results.

Integrated evidence must separately cover real Dope analysis, GUI navigation, restart/reopen and package/native composition as assigned by the task stack.

## Explicit non-goals

Phase 4 does not implement:
- Phase 3 Plan/PlanStep/Task or any compatibility adapter;
- PlanningMap / PlannedTransformation;
- editable architecture diagrams;
- graph-derived tasks/work decomposition;
- AI classification/inference as physical truth;
- provider/model runtime;
- Agent Mind;
- authority/tool execution/delegation;
- DevelopmentSession;
- semantic project-wide AI search;
- multi-language completeness;
- remote/multi-root collaboration;
- database/graph-database infrastructure merely for future scale;
- Theia upgrade.

## Exit condition

Using the actual Dope repository with no model provider configured, the developer can inspect an evidence-backed current-state model organized by Systems/Subsystems/Components, trace representative relationships to deterministic source evidence, identify representative declared-boundary violations and navigate to the responsible source through a bounded inspection UI.

The resulting contracts are renderer-independent and provider-independent, and the extracted graph remains rebuildable derived state.
