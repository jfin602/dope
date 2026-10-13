# Product Phase 4 Prompt Assessment

Status: APPROVED / READY FOR EXECUTION
Activation source/package baseline: `93a2b3152066029d28dabf73e5672e0663599e22`, `0.4.0`
Authority: `docs/planning/p4/phase-4-plan.md`, ADR 0007

## Conclusion

Use six ordered prompts.

The corrected source is ready for a clean Physical Software Model phase. The strict dependency chain is:

software-model contracts/core
-> language analysis
-> architecture loading/index/rules/query/backend
-> production inspector + integrated/package evidence
-> direct GUI dogfood
-> evidence closeout.

Do not collapse the TypeScript adapter into the language-independent domain. Do not begin with a graph rendering library. Do not reintroduce Phase 3 Planning to provide work/task concepts. Do not pull Phase 5 target-state planning or Phase 6 AI into this stack.

| Prompt | Boundary | Primary evidence | Routing |
| --- | --- | --- | --- |
| P1 | one real `@dope/software-model` package | declaration parsing, stable identity, graph/evidence/query/rule semantics | GPT-6 Sol High |
| P2 | `@dope/code-analysis` + `@dope/code-analysis-typescript` | compiler/project discovery, imports/exports/references/inheritance, deterministic evidence | GPT-6 Sol High |
| P3 | local architecture loader + in-memory index/coordinator + service/backend | project containment, incremental-vs-clean equivalence, aggregation, violations, typed query transport | GPT-6 Sol High |
| P4 | focused Theia inspector + integrated restart/reanalysis/package | stale-workspace safety, source navigation, restart rebuild and exact AppImage evidence | GPT-6 Sol High |
| P5 | actual developer inspection workflow | direct GUI on Dope, evidence tracing, controlled violation and stale-edge removal | GPT-6 Sol High |
| P6 | evidence audit only | exact-candidate Green/Not Green/Evidence Gap closeout | GPT-6 Sol Medium |

P1-P4 are runner-owned. P5 is the browser/manual handoff. P6 is final closeout. Versions are exactly `0.4.1` through `0.4.6`.

## Current source findings

- Current production packages are only `@dope/contracts`, `@dope/project-intelligence` and `@dope/theia-extension`; the Phase 3 Planning package/runtime is gone.
- Root `0.4.0` build/typecheck/test scripts currently build contracts -> Project Intelligence -> Theia extension. New Phase 4 packages must be added to real workspace/build/typecheck/product-test ordering as they land.
- `test/unit/theia-baseline.test.ts` owns current package-version/composition coherence and must expand when new workspaces are real.
- `@dope/project-intelligence` demonstrates the desired pattern: framework-independent pure domain at its package root with a separate Node adapter under `src/node`.
- `ProjectMindStore.root()` and path checks provide prior art for canonical local-folder/symlink containment, but Phase 4 should not copy Project Mind whole-snapshot mutation machinery because `.dope/architecture.json` is developer-authored through the ordinary editor in this phase.
- `frontend-module.ts` and `backend-module.ts` are the typed Theia RPC registration seams.
- `ProjectMindBackend` demonstrates per-connection root/handle binding and disposal. Software Model transport should preserve the same project-switch/handle discipline without coupling model identity to a Theia widget.
- `ProjectMindController` demonstrates generation/request guards against late async results after workspace switches. Software Model analysis/query UI needs equivalent stale-result protection.
- `dope-workbench.ts` still contains the Project Mind widget and is already sizable; the Software Model inspector should use focused controller/widget files rather than substantially growing that file.
- `test/integration/restart.test.mjs` already launches real Theia/Electron under Xvfb, validates process replacement and exercises Project Mind through typed services. P4 should extend this harness for analysis/rebuild/restart rather than create a parallel process framework.
- The current root has TypeScript `5.9.3`; the TypeScript analyzer uses compiler/project APIs at runtime and should declare its runtime TypeScript dependency explicitly.

## Architecture and identity decisions

### No second persistent Project identity

Phase 4 must not invent a competing project UUID allocator.

The canonical architecture declaration is root-local and owns stable architecture object IDs, not a second Project identity. When existing Project Mind identity is useful for service metadata it may be observed, but Physical Software Model correctness must not require writing or mutating Project Mind.

### Architecture ownership is explicit

Subsystem/Component ownership must use normalized project-relative source roots/selectors from the developer-authored declaration.

Folders/packages are evidence about repository layout, not automatic architecture identities.

When no declaration owns a file/entity, expose it as unassigned/unknown. When declarations conflict ambiguously, report a declaration error rather than choosing arbitrarily.

### Derived identity is deterministic, not falsely stable

Declared System/Subsystem/Component IDs are explicit and stable.

Source/module/symbol identities are deterministic from normalized project-relative semantic identity and analyzer information. Do not mint random UUIDs on each analysis. Do not claim a rename is the same entity unless the analyzer has deterministic evidence for that continuity.

### Default dependency rule posture

Initial architecture rules operate at Subsystem boundaries.

Explicit forbidden dependencies are violations. If a Subsystem declares an allow-list, cross-Subsystem dependencies outside that list are violations. Same-Subsystem dependencies remain internal. No undeclared global whitelist is invented.

Every violation points to the offending lower-level physical relationships/evidence.

## Incremental indexing decision

Roadmap scope requires incremental indexing, but Phase 4 does not need a persistent graph database.

Use an in-memory per-project index with deterministic source/config fingerprints:

- unchanged analyzable units may reuse prior results;
- changed/added/deleted source invalidates affected results;
- tsconfig/project-reference/architecture-declaration topology changes may deliberately trigger a clean rebuild;
- every incremental result must equal a clean rebuild for the same source state;
- process restart simply rebuilds derived state.

No on-disk derived cache is required unless implementation evidence proves it necessary. If one is introduced, it is disposable and must receive explicit recovery/corruption coverage.

## Applicable risks

- **Ontology leakage:** TypeScript syntax kinds, Theia widget concepts or graph-library structures becoming canonical product types.
- **False physical truth:** folder heuristics, AI inference or unresolved imports being presented as deterministic architecture.
- **Identity drift:** random IDs, path normalization inconsistencies, duplicate declaration IDs or ambiguous ownership.
- **Evidence loss:** aggregated Subsystem dependencies without traceable originating imports/references.
- **Analyzer completeness:** tsconfig references, JS/TS mix, path aliases, generated/excluded files, unresolved modules and analyzer failures.
- **Stale index:** delete/rename/config changes leaving relationships that a clean rebuild would remove.
- **Rule semantics:** forbidden/allow-list behavior applied to the wrong level or hiding the concrete offending edge.
- **Filesystem safety:** unsafe/symlinked `.dope/architecture.json`, absolute/traversal ownership roots, corrupt/future schema.
- **Async presentation:** analysis/query results from project A rendering in project B; refresh that appears successful while serving old generation.
- **Performance:** real Dope analysis blocking the frontend or rebuilding excessively.
- **Regression:** Project Mind, ordinary IDE startup, package composition and restart behavior must remain intact.
- **Scope creep:** diagram editor, target graph, tasks, AI/provider runtime, framework upgrade or Phase 3 compatibility.

## Stability answers

1. Behavior at risk: Project Mind, ordinary IDE/restart/package behavior, current root/package build graph, new architecture state and analyzer/index results.
2. Invariants: physical model is deterministic/evidence-backed; declarations are canonical while extracted graph is derived; software-model/analyzer packages have no Theia/provider dependency; Phase 3 Planning stays absent.
3. Integrated-only evidence: analysis of the real Dope repository, repeated reanalysis after source changes, GUI evidence/source navigation, process restart rebuild and packaged application composition/native readiness.
4. Baseline: exact activation source `93a2b3152066029d28dabf73e5672e0663599e22`, coherent `0.4.0`.
5. Durable knowledge: Phase 4 contracts/plan, architecture declaration, any storage/recovery guide, P4 package/restart record, P5 dogfood record and P6 closeout.
6. UI-state risk: selection, expansion, filters and loading status remain presentation state; they are not graph truth.
7. Provider coupling: zero product provider dependency in Phase 4.

## Deferred

Visual layout/rendering engine, PlanningGraph/PlannedTransformation, work decomposition/tasks, AI/model/provider adapters, Agent Mind, ownership/delegation, ProposedAction, authority/tool execution, DevelopmentSession, semantic AI search, multi-language completeness, graph database, remote/multi-root collaboration and Theia upgrade.
