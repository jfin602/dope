# Product Phase 6 Implementation Plan

Status: **APPROVED / READY FOR PROMPT WRITING**
Activation source/package baseline: `710edb362f9881ab41215705db4f08d8daca6293`, `0.6.0`
Authority: ADR 0020 as amended by ADR 0021, Phase 6 activation/plan, PRODUCT-MODEL, ARCHITECTURE and stability contract

## Preflight for every prompt

Read BOOT, AGENTS, current Phase 6 authority, ADR 0021, PRODUCT-MODEL, ARCHITECTURE, roadmap, workflow/stability authority, this assessment/plan and all prior `p6` source/evidence.

Require:
- reachable Phase 6 activation transition `710edb362f9881ab41215705db4f08d8daca6293`;
- coherent expected predecessor version;
- clean intended Git state;
- Node 24;
- no root `package-lock.json`;
- Theia exactly `1.75.0`;
- Electron exactly `42.8.1`;
- TypeScript runtime `5.9.3`.

P1-P6 are runner-owned and must not commit. P7 is browser/manual direct qualification. P8 is evidence-only closeout.

Every implementation prompt advances root, browser/electron apps, all live internal package manifests, internal `@dope/*` references and baseline version assertions coherently to its assigned `0.6.x` target.

Phase 5 is owner-closed for sequencing with P11 Not Green/P12 unexecuted. Preserve that evidence. Do not treat Phase 6 success as retroactive Phase 5 qualification.

No prompt may add general AI Presence, Agent Mind, mutation authority/delegation, a required model provider, a separate durable Flow store, a compiler CFG, Planning Map Flow editing or Phase 3 compatibility.

## P1 — Physical Flow contracts, endpoints and snapshot truth (`0.6.1`) — T1

Extend `@dope/software-map`; do not create a new Flow package.

Add language-independent contracts for:
- `PhysicalFlowFact`;
- `PhysicalFlowEndpoint`;
- interaction kind union exactly `receives | invokes | reads | writes | calls-external | publishes | consumes | responds`;
- endpoint kinds sufficient for HTTP/input-output/store/queue-event/external/client-style derived boundaries without turning them into GraphNodes;
- optional evidence-backed data/type/schema/event enrichment;
- Flow coverage/diagnostic records separate from overall Software Map `AnalysisStatus`;
- optional async/retry/error metadata without adding new base interaction kinds;
- aggregate `originFlowFactIds`;
- Flow query/result DTO foundations needed by later prompts.

Extend `PhysicalMapSnapshot` with first-class Flow facts, endpoints and Flow diagnostics/coverage.

Add deterministic ID helpers:
- stable endpoint identity from normalized evidenced properties;
- stable Flow fact identity from semantic kind/source/target plus bounded discriminator;
- deterministic source-backed anonymous callable identity support needed by callback-based Flow without pretending the callback is a named symbol.

Extend `createSnapshot` validation/dedupe/order:
- node-or-endpoint source/target references must exist;
- Flow facts require dedicated deterministic/runtime evidence;
- aggregate origins must exist and cannot self-reference;
- runtime facts/annotations obey existing runtime evidence requirements;
- duplicate IDs merge only compatible evidence, conflicting semantic identities fail;
- endpoint equivalence is conservative;
- Flow diagnostics are deterministic/safe.

Do not emit any Flow yet.

Tests:
- focused `test/unit/software-map-flow.test.ts` (or equivalent);
- invalid refs/evidence/origins;
- stable IDs/order/dedupe;
- endpoint non-merge cases;
- anonymous callable identity;
- runtime evidence;
- optional annotation validation;
- snapshot clone/equality with empty Flow arrays.

Add the new test to real aggregate product composition.

## P2 — Generic TypeScript invocation Flow (`0.6.2`) — T1

Extend the existing analyzer rather than adding a parallel parser.

`CodeAnalysisResult` gains dedicated Flow fact/endpoint/diagnostic outputs. Do not reuse synthesis `FrameworkFact` as execution truth.

Using the existing TypeScript Program/checker:
- identify the enclosing named callable or deterministic anonymous function/arrow callable for supported `CallExpression` sites;
- resolve the called symbol through aliases to a project-owned declaration;
- emit `invokes` from caller callable/module to target callable when deterministic;
- support methods/functions and stable callback identities;
- include zero-argument/unused-return calls;
- treat async/await as metadata/continuity only when the target resolves;
- do not turn import/reference/property access alone into invocation;
- do not emit project `invokes` for unresolved/external library calls;
- preserve precise semantic evidence spans;
- dedupe multiple analysis passes deterministically.

Direct cheap enrichment may include useful checker-resolved argument/return type names; suppress broad/low-information types according to Phase 6 authority.

Add/extend analyzer fixtures for named function/method calls, alias imports, inline arrow callbacks, async, zero-arg/unused return, recursion/cycle, unresolved/external call and negative import/reference-only cases.

Tests prove repeat determinism, evidence spans, caller/target identity and no false structural Flow.

## P3 — Adaptive SEO boundary extraction (`0.6.3`) — T2

Add a dedicated Flow extractor seam in `@dope/code-analysis-typescript`. Keep it separate from the existing Theia/Inversify architecture-synthesis framework extractor.

Before implementation inspect the current accepted Adaptive SEO source patterns; do not hardcode repository paths, symbol names or expected IDs.

Required supported slice:

### Express 5

Recognize supported route registration semantics such as `Application`/Router HTTP methods from type/import evidence, including registrations inside helper functions.

For deterministic literal routes:
- create stable inbound/outbound HTTP endpoints using method/path;
- map the route to the actual handler callable, including inline callbacks, not the startup registration function;
- emit `receives` into the handler;
- detect supported `response.status(...).json/send/end` style output from that handler and emit `responds`;
- preserve method/path/source evidence;
- middleware/framework plumbing may remain outside the base path unless deterministic support is intentionally added.

### PostgreSQL

Recognize Adaptive SEO's real `Database` / `QueryExecutor` abstraction by semantic type/call evidence, including transaction executors.

Emit:
- `reads` for deterministic read SQL;
- `writes` for deterministic insert/update/delete-style SQL;
- one conservative datastore endpoint identity for proven-equivalent connection/store use;
- directly parseable table/entity annotation only when safe.

Do not require direct `pg.Pool.query` call sites.

### External boundaries

Recognize:
- raw Node `http`/`https` request calls through import/type evidence;
- identifiable external client calls where library/type semantics prove the service boundary, including the current Google GenAI usage;
- wrapper/helper calls must not hide the actual external call.

Emit `calls-external` with the strongest deterministic endpoint identity available; use source-scoped endpoint identity when host/service cannot be proven.

### Diagnostics and anti-hardcoding

Emit Flow-specific unsupported/unresolved diagnostics when a candidate supported surface cannot be deterministically continued.

Add at least one small synthetic TypeScript fixture with different names/routes/classes/layout exercising Express + DB wrapper + external call, proving extraction is semantic rather than Adaptive SEO path hardcoding.

Worker/job/event support may land if naturally reusable but is not mandatory for P3/P7 Green.

## P4 — Flow query, path stitching, aggregation and diagnostics (`0.6.4`) — T2

Add provider-independent Flow query contracts/helpers under `@dope/software-map` and expose them through the existing `SoftwareMapService`/`SoftwareMapBackend`.

Do not create an independent backend/state owner.

Query capabilities:
- System/Subsystem focused overview;
- trace from selected GraphNode/endpoint;
- upstream/downstream direction;
- deterministic sorting;
- exact project/generation guard;
- explicit Flow coverage/unsupported diagnostics;
- explicit truncation/continue-deeper metadata.

Default hard budgets:
- 100 visible nodes/endpoints;
- 200 facts/edges;
- 32 hops per path.

Path stitching:
- only proven Flow facts;
- visited node/fact guards for recursion/cycles;
- callbacks/promises only when target identity is deterministic;
- producer/consumer continuity only with deterministic queue/event identity;
- no argument/return propagation required.

Aggregation:
- System/Subsystem edge only from a continuous evidenced lower-level origin path;
- preserve `originFlowFactIds` + evidence;
- never bridge an unsupported/missing hop;
- preserve meaningful branch/join topology;
- keep materially different `reads`/`writes`/`invokes`/`calls-external` semantics distinct;
- never invent one shared payload from different annotations.

Static results are explicitly Static Flow/possible execution. Future Observed Flow is not implemented.

Backend tests cover project isolation, stale generation, pagination/bounds, path cycles, aggregation provenance/gaps and diagnostics.

## P5 — Pure Flow projection and directional layout (`0.6.5`) — T1

Add a focused pure browser/presentation adapter such as `flow-map-projection.ts`; do not overload canonical Flow/query contracts with canvas geometry.

Input: bounded Flow query result + needed architecture identity/presentation focus.

Output: React-Flow-neutral canvas projection objects with:
- Input/Boundary/Processing/Store/External/Output roles;
- deterministic left-to-right layers;
- stable order for unchanged input;
- high-level System overview by default;
- path highlight/subdued-context state;
- branch/fan-out and join topology;
- explicit cycle/back-edge representation;
- async/retry/error visual metadata only where facts prove it;
- complete labels without semantic truncation that changes identity.

Do not add Dagre/ELK.

Keep geometry disposable; no coordinates enter Physical Map snapshots or project state.

Focused tests prove determinism, branch/join, cycles, context/highlight behavior, endpoint roles, long labels and no mutation of input state.

## P6 — Architecture/Flow UI integration (`0.6.6`) — T2

Integrate Flow into the existing center Physical Map surface.

Add `[ Architecture ] [ Flow ]` only for Physical Map tabs. Planning Map tabs remain their existing planning experience and do not gain Flow editing.

Reuse the existing Physical Map controller/shared Software Map publication:
- preserve workspace, focus, selection and source-navigation identity across mode switches;
- generation/project guard every Flow query;
- cancel/ignore late results after project/mode/focus/trace changes;
- no separate Flow service/widget authority.

Flow default:
- quiet System-level overview of Inputs/Outputs/participating scopes/Stores/External endpoints;
- no all-call hairball.

Interaction:
- selecting an Input/participant highlights relevant Static Flow while unrelated Flow stays subdued;
- `Trace downstream`;
- `Trace upstream`;
- `Clear trace`;
- progressive detail through System -> Subsystem -> Component -> Code focus;
- Architecture -> Flow -> Architecture round-trip preserves identity/context.

Flow edges become inspectable:
- interaction kind;
- endpoint/source/target identity;
- optional data annotation;
- origin Flow facts/evidence/provenance;
- explicit unresolved/unsupported/truncated state;
- jump to ordinary source for representative evidence.

Keep Flow read-only.

Add focused controller/projection/widget tests for mode switching, tracing, edge evidence/source intent, project/generation races, diagnostics, theme/keyboard semantics and Planning Map non-interference.

## P7 — Direct Adaptive SEO Flow qualification (`0.6.7`) — T3

Browser/manual gate.

Primary mapped reference: `/home/jfin/dev/adaptive-seo-dope` remains immutable.

Immediately before qualification create a fresh disposable `/tmp/adaptive-seo-dope-p7` from that accepted reference, including accepted `.dope/` state. Record Git state and `.dope/` inventory/hashes. Do not regenerate/reaccept its architecture merely for this phase.

Using the actual Dope GUI with no model/provider required for Flow, prove one continuously evidenced real Adaptive SEO behavior:
- inbound HTTP boundary;
- resolved internal invocation chain;
- persistence and/or deterministic external-service interaction;
- output/response boundary;
- at least one real branch/fan-out or join.

Directly inspect representative Flow edges, provenance and jump-to-source.

Exercise:
- System overview;
- Input discovery;
- Trace downstream/upstream/clear;
- Subsystem/Component progressive focus;
- Architecture -> Flow -> Architecture context preservation;
- explicit coverage/unsupported/truncated state;
- a controlled supported fixture for cycles/retries/rare async shape where real Adaptive SEO does not provide one.

Prove restart/reopen + fresh analysis reconstructs equivalent stable Flow IDs/semantics without persisted Flow state. Prove second-project/workspace isolation and no late result leakage.

Use the Dope repo separately as host/regression fixture: ordinary Physical/Planning Map and Project Mind remain usable.

Run exact-candidate T3 evidence without redundant reruns:
- focused Phase 6 suites;
- `npm run check`;
- `npm run test:restart`;
- `npm run codex:phase:validate -- p6`;
- Linux AppImage packaging/inspection/native launch;
- version/Theia/Electron/no-root-lock coherence;
- `git diff --check`.

Because `npm run check` already includes browser/Electron builds, do not rerun those builds separately unless invalidated.

Record direct evidence in `docs/tasks/p6/P7-flow-dogfooding-evidence.md`.

A missing/invented hop in the chosen behavior, stale-generation rendering, hidden truncation or unsupported completeness claim is Not Green. Missing payload annotations are acceptable when execution continuity is evidenced.

After Green evidence, set coherent `0.6.7` and create the manual version commit required by the runner handoff.

## P8 — evidence-only closeout (`0.6.8`) — T3 audit

Audit the exact successful/authorized P7 handoff. Do not repair product behavior.

Assess:
A. Flow domain/snapshot truth, identity and evidence;
B. generic TypeScript invocation correctness;
C. Adaptive SEO HTTP/persistence/external extraction + anti-hardcoding fixture;
D. path stitching, bounds, diagnostics and aggregation provenance;
E. directional projection/non-linear grammar;
F. Architecture/Flow UI, tracing, edge inspection/source and async guards;
G. direct Adaptive SEO behavior usefulness + restart/isolation;
H. regression/release/package/native evidence and provider-free boundary.

Advance all live versions/references coherently to `0.6.8`.

Because P7 owns broad T3 evidence, rerun only focused Phase 6 tests/affected typecheck-build needed by version composition, phase validation, version/no-root-lock checks and `git diff --check`. Repeat broad GUI/restart/package evidence only if the closeout transition invalidates it.

Create `docs/tasks/p6/closeout.md` with exact identities, A-H Green/Not Green/Evidence Gap table, residual gaps and final Qualified/Not Qualified decision. Update the p6 README truthfully.

## Expected production shape after P6

```text
@dope/software-map
  PhysicalMapSnapshot
    architecture nodes/relationships/evidence
    Flow facts/endpoints/diagnostics
  Flow query/path/aggregation contracts

@dope/code-analysis
  language-independent analyzer result including physical Flow outputs

@dope/code-analysis-typescript
  deterministic TypeScript invocation extraction
  bounded Express/PostgreSQL/external Flow extractors

@dope/theia-extension
  existing Software Map backend
  existing Physical Map state owner
  Architecture | Flow center projection
  tracing + edge evidence/source navigation
```

No Flow persistence database, no Agent Runtime, no model-required Flow, no AI mutation and no Planning Map Flow editing.
