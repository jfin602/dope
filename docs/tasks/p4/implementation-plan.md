# Product Phase 4 Implementation Plan

Status: APPROVED / READY FOR EXECUTION
Activation source/package baseline: `93a2b3152066029d28dabf73e5672e0663599e22`, `0.4.0`
Authority: `docs/planning/p4/phase-4-plan.md`, `docs/planning/p4/activation.md`, ADR 0007

## Preflight for every prompt

Read BOOT, AGENTS, Phase 4 activation/plan, ADR 0007, PRODUCT-MODEL, ARCHITECTURE, roadmap, workflow/stability authority, this plan and all prior p4 source/evidence.

Require:
- reachable activation source `93a2b3152066029d28dabf73e5672e0663599e22`;
- explicit owner Phase 4 activation;
- coherent expected predecessor version;
- clean intended Git state;
- Node 24;
- no root `package-lock.json`;
- Theia exactly 1.75.0 and Electron 42.8.1.

P1-P4 are runner-owned and must not commit. P5 is manual direct GUI qualification. P6 is evidence-only.

Phase 3 Planning is historical and absent. No prompt may add compatibility/migration/dual state for it.

## P1 — Physical Software Model contracts and core (`0.4.1`)

### Package boundary

Add one real framework-independent package:
- `packages/software-model/package.json`
- `packages/software-model/tsconfig.json`
- focused `src/` modules plus `src/index.ts`.

The package must import neither Theia nor provider/model SDKs.

Add it to root workspaces/build/typecheck/product-test ordering and baseline manifest/version assertions. All existing and new internal package versions/references advance coherently to `0.4.1`.

### Architecture declaration

Define strict schema/versioned types and parser for developer-authored architecture state, expected at `.dope/architecture.json`.

Initial required semantics:
- one or more Systems with stable explicit IDs, names and purpose;
- Subsystems nested/linked to one System, with stable explicit IDs, name/purpose and normalized project-relative owned roots/selectors;
- optional declared Components nested/linked to one Subsystem with stable explicit IDs and owned roots/selectors;
- optional Subsystem `allowedDependencies` and `forbiddenDependencies` by stable Subsystem ID;
- globally unique architecture IDs;
- no absolute paths, backslashes, NUL, `.`/`..` traversal or empty ownership segments;
- ambiguous equal-specificity ownership is an error, not a guess.

Do not put a second persistent Project UUID in the declaration.

### Model contracts

Implement language-independent contracts for:
- Project/System/Subsystem/Component/CodeEntity nodes;
- node identity/kind and architecture ownership;
- typed directed relationships;
- evidence/provenance records;
- analyzer/analysis errors and completeness status;
- normalized Physical Software Model snapshot/generation identity;
- architecture violations;
- renderer-independent query request/result types.

Reserve evidence distinctions for declaration, deterministic syntax/structure, semantic resolution, aggregate derivation, runtime observation and inference, but only producers actually implemented in this phase may claim their evidence class.

### Pure graph/query/rule core

Implement pure deterministic helpers for:
- duplicate/invalid identity rejection;
- normalized insertion and relationship deduplication;
- deterministic ordering/serialization for tests;
- architecture ownership selection by explicit declaration roots;
- unassigned entities;
- direct/incoming/outgoing relationship queries;
- hierarchy/descendant queries;
- dependency aggregation while retaining originating lower-level edge/evidence IDs;
- Subsystem rule validation with explicit forbidden and optional allow-list semantics.

No filesystem, TypeScript compiler or Theia imports in this pure core.

### Tests

Add focused permanent `test/unit/software-model.test.ts` (or equivalent) covering malformed/future declaration schema, duplicate IDs, unsafe roots, ownership ambiguity/specificity, deterministic identities/order, evidence requirements, relationship dedupe, unassigned entities, aggregation provenance, query determinism and allowed/forbidden dependency violations.

## P2 — deterministic TypeScript/JavaScript analysis (`0.4.2`)

### Packages

Add:
- `@dope/code-analysis` for language-independent analyzer/discovery/orchestration interfaces;
- `@dope/code-analysis-typescript` for the TypeScript/JavaScript adapter.

Add real workspaces/build/typecheck/test ordering and baseline coherence. All packages/apps advance coherently to `0.4.2`.

`@dope/code-analysis-typescript` must declare TypeScript `5.9.3` as a runtime dependency because it uses the compiler API at runtime.

No Theia imports in either analyzer package.

### Analyzer behavior

Use TypeScript compiler/project/module-resolution/type-checker semantics where authoritative.

Discover supported local repository TypeScript/JavaScript projects from tsconfig/jsconfig configuration, including referenced/composite projects where present.

Respect compiler inclusion/exclusion and avoid scanning `node_modules`, build outputs or generated/vendor files outside configured project source.

Emit deterministic language-independent nodes/relationships/evidence for representative:
- source files/modules;
- exported symbols;
- class/interface/function/method or equivalent useful CodeEntity kinds;
- imports/module dependencies;
- exports/public exposure;
- semantic symbol references where resolved;
- extends/implements/inheritance relationships.

Unresolved imports/references are explicit analysis diagnostics; do not fabricate resolved physical edges.

### Identity/evidence

Normalize project-relative paths.

Derived IDs must be stable for identical project inputs and deterministic semantic identity. Evidence must retain project-relative source path and precise source span/semantic location where applicable.

TypeScript SyntaxKind numeric values or ts.Node objects must not escape as canonical graph ontology.

### Fixtures/tests

Add dedicated analyzer fixtures with:
- multiple files/modules;
- path alias/module resolution;
- JS + TS where configured;
- imports/exports;
- interface/class inheritance;
- symbol references;
- excluded/generated source;
- unresolved import;
- at least one referenced/multi-tsconfig case if current compiler setup supports it cleanly.

Add `test/unit/code-analysis-typescript.test.ts` proving deterministic repeat output, source spans, resolution, exclusion and explicit diagnostics.

Do not analyze the real Dope repository as the only test.

## P3 — architecture loading, index/rules/query service and backend (`0.4.3`)

### Canonical architecture loader

Add a Node adapter under the software-model/code-analysis boundary to read `.dope/architecture.json` from one supported local project root.

Dope does not write the declaration in Phase 4. The developer edits it through the ordinary editor/Git.

Safety:
- canonical local file root;
- reject symlinked/unsafe `.dope` or architecture file;
- strict schema parser;
- preserve corrupt/future files untouched;
- missing architecture file is valid and yields an unassigned physical model with no declared-boundary rules;
- no Project Mind mutation and no second Project identity allocator.

Create/update `docs/software-model-storage.md` documenting canonical architecture state, ordinary-editor/Git workflow, missing/corrupt/future behavior, path safety, external recovery and the fact that derived graph/index state is rebuildable and not persisted in this phase.

### In-memory index/coordinator

Implement one backend-side per-project analysis coordinator/index.

Required behavior:
- clean full analysis;
- source/config fingerprinting;
- bounded incremental reuse for unchanged analyzable units;
- add/change/delete invalidation;
- clean-rebuild fallback for tsconfig/project-reference/architecture topology changes;
- incremental result exactly equals clean rebuild for identical final source state;
- generation/status/diagnostic tracking;
- no on-disk graph cache.

Avoid concurrent analyses committing out of order. A superseded generation may finish internally but must not replace the newest requested result.

### Model assembly/rules

Combine declaration hierarchy + analyzer output:
- assign CodeEntities/files to declared Components/Subsystems by normalized ownership roots;
- keep unmatched content unassigned;
- derive architecture containment;
- aggregate low-level dependencies upward;
- run Subsystem dependency rules;
- retain the concrete originating physical edge/evidence IDs for each aggregate dependency/violation.

### Typed service/backend

Add framework-independent service/client contracts, preferably owned by `@dope/software-model`, with a path/symbol independent from Theia.

Expose bounded operations:
- attach one local project and return handle/status;
- analyze/reanalyze;
- hierarchy;
- node detail;
- incoming/outgoing/direct/aggregated dependencies;
- evidence;
- violations;
- source-location resolution;
- analysis diagnostics/status.

Register the service in existing Theia backend module using a per-connection backend object. Bind every request to the attached canonical root/handle and reject later root redirection.

Notify clients of analysis generation/status changes as needed.

### Tests

Add focused tests for:
- missing/valid/corrupt/future/unsafe architecture declaration;
- two roots and handle isolation;
- duplicate concurrent analyze generation ordering;
- changed/added/deleted file invalidation;
- config/declaration change full rebuild fallback;
- incremental-vs-clean equivalence;
- aggregate dependency/evidence preservation;
- exact rule violations;
- service query determinism and invalid handle/disposal.

Extend real aggregate product tests.

## P4 — production inspector, restart/reanalysis and package qualification (`0.4.4`)

### Focused presentation

Add focused files rather than substantially extending `dope-workbench.ts`, expected as:
- `software-model-controller.ts`;
- `software-model-widget.ts` or similarly bounded view code.

Register a real Software Model view/command/widget through `frontend-module.ts`.

The inspector is not a graph editor.

### Required UI

Provide:
- explicit Analyze/Refresh;
- analysis status/generation/errors;
- System -> Subsystem -> Component -> relevant code hierarchy;
- visible unassigned/unknown implementation;
- selected node identity/purpose/ownership;
- direct and aggregated incoming/outgoing dependencies;
- relationship evidence/source location;
- architecture violations with rule + offending edges;
- jump to source;
- honest missing architecture declaration/partial analysis/error/empty states;
- keyboard-operable controls;
- semantic dark-default/light-theme styling.

The UI may use a tree/list/details projection. Do not add graph layout/rendering libraries or target-state editing.

### Async safety

Controller/view must generation/project-guard:
- delayed attach;
- delayed analysis;
- delayed queries/evidence;
- workspace switches;
- refresh while analysis is active;
- disposal.

Late project A data must never render in project B.

### Dope declaration

Add a deliberately small, accurate repository `.dope/architecture.json` sufficient to dogfood real Systems/Subsystems/Components and dependency rules.

Base ownership on actual source/package boundaries. Do not force every repository file into architecture. Shared/tooling/unowned paths may remain unassigned.

Do not encode future Phase 5/6 architecture as if implemented.

### Integrated/restart

Extend `test/integration/restart.test.mjs` or an equally real integrated process test to prove:
- the real typed Software Model service can attach/analyze;
- architecture declarations are re-read after process replacement;
- derived graph is rebuilt rather than assumed persisted;
- a representative relationship/query and violation result survives by reanalysis;
- second-root isolation;
- Project Mind restart behavior remains Green;
- controlled source change -> refresh removes/adds expected relationship without stale edges.

Automated CDP/instrumentation is supplemental; it does not replace P5 direct GUI evidence.

### Package

Build/package exact `0.4.4` AppImage and record:
- source/pre-task identity;
- build environment/caches/plugins;
- executable/mode/size/hash;
- embedded versions/resources;
- new software-model/analyzer/backend/frontend package composition;
- normal native launch/readiness and controlled close where environment allows;
- what was not directly visually exercised.

Create `docs/tasks/p4/P4-software-model-restart-package-evidence.md`.

## P5 — direct Dope-maps-Dope dogfood (`0.4.5`)

Manual/browser-required qualification on the real Dope repository with no model provider configured.

Directly click/type/observe the actual Theia GUI.

Matrix:
- open Software Model inspector and analyze the real Dope repository;
- inspect declared System -> Subsystem -> Component hierarchy;
- inspect at least three representative code/source nodes across distinct implementation boundaries;
- trace at least three representative physical relationships to precise source evidence;
- inspect one aggregated Subsystem dependency and its originating lower-level edges;
- navigate from evidence/model node to ordinary source editor;
- inspect unassigned/unknown source rather than seeing it fabricated into architecture;
- exercise missing/invalid declaration behavior in a controlled disposable second root or reversible probe;
- create a controlled temporary TypeScript source import that violates a declared forbidden/allow-list boundary, refresh, directly observe the violation/evidence, restore/delete the probe, refresh and prove the violation/stale edge disappears;
- modify another controlled relationship and prove reanalysis updates without application restart;
- restart/reopen same workbench/backend/profile, reanalyze and recover equivalent useful architecture/model inspection;
- switch to a second local project and prove isolation, then return to Dope;
- keyboard operation and dark default/readable explicit light theme;
- preserve unrelated Git state and restore all temporary probes exactly.

Record exact source/version, architecture declaration hash/identity, inspected nodes/relationships/evidence, violation rule/edges, reanalysis/restart/isolation behavior, repairs and Git pre/post in `P5-physical-model-dogfooding-evidence.md`.

A required failure/gap blocks success absent a separate explicit audit waiver. Any bounded product repair requires permanent regression coverage, replay of the failed GUI step and fresh affected package evidence.

After Green applicable evidence, set coherent `0.4.5`, run focused/aggregate/restart/phase/no-root-lock/whitespace checks, and create exactly one manual commit with subject `0.4.5`. Runner agents do not commit.

## P6 — evidence-only closeout (`0.4.6`)

Audit the exact successful/authorized P5 handoff. Do not repair product behavior.

Assess:
A. language-independent model/declaration contracts and deterministic identity;
B. TypeScript/JavaScript analyzer correctness/completeness/evidence;
C. index/reanalysis determinism and incremental-vs-clean equivalence;
D. architecture ownership/aggregation/rule violations with provenance;
E. typed project isolation/query backend and production inspector async safety;
F. restart/rebuild/package/native composition;
G. direct Dope-on-Dope usefulness/evidence traceability with no provider.

Preserve historical Phase 1/2 evidence gaps and Phase 3/correction truth. Do not imply current software-model evidence repairs unrelated historical qualification gaps.

Set coherent `0.4.6`, rerun focused software-model/analyzer/UI tests, `npm run check`, `npm run test:restart`, `npm run codex:phase:validate -- p4`, version/Theia/no-root-lock checks and `git diff --check`.

Build/inspect the package as appropriate for the final candidate. A fresh build does not itself repeat prior direct GUI evidence.

Create `docs/tasks/p4/closeout.md` with exact identities, A-G table, physical model/analyzer/index/rules/UI/restart/package/dogfood evidence, residual gaps and Qualified/Not Qualified decision.

If Qualified, mark p4 README complete and route to post-Phase-4 `/docs-review`. Do not generate Phase 5 prompts in closeout.
