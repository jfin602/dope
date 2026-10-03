# Product Phase 6 — Flow Plan

Status: **OWNER-CLOSED FOR SEQUENCING / P8 NOT QUALIFIED**
Baseline: `0.6.0`
Activation baseline: `710edb362f9881ab41215705db4f08d8daca6293`
Execution folder: `p6`

Authority:
- ADR 0020 as amended by ADR 0021;
- Phase 6 activation;
- Software Map / Physical Map contracts;
- current PRODUCT-MODEL / ARCHITECTURE / stability contract;
- Phase 5 owner closeout as sequencing entry disposition.

## Objective

Make Dope explain evidence-backed application execution through implemented software without requiring a model provider.

North-star question:

> Can I pick a System and follow what actually happens from an entry point through internal calls, state and external boundaries to an output—and can Dope prove every representative hop?

## Product invariants

1. Flow is a Physical Map projection, not a fourth canonical map.
2. Flow is application-level execution/behavioral flow, not a compiler CFG.
3. Stable System / Subsystem / Component / Code identities are shared between Architecture and Flow.
4. Flow is rebuildable derived state; no new required Flow persistence store is introduced.
5. Every rendered Flow hop has dedicated deterministic evidence or recorded-runtime evidence.
6. A deterministically resolved invocation is valid Flow evidence even when payload/data lineage is unknown.
7. `import`, `reference` and architecture `depends-on` facts alone do not prove execution.
8. Data/type/schema/event semantics are optional enrichment and require separate evidence.
9. Unknown payload or missing execution hops remain unknown/missing rather than inferred for visual completeness.
10. Flow roles are projection semantics, not canonical architecture node kinds.
11. Flow queries are bounded and generation/project guarded.
12. Directional layout is presentation state and does not imply one concrete runtime request executed every reachable edge.
13. Phase 6 works with no model provider.
14. AI Presence, Agent Mind, tool authority and delegation remain Phase 7+.

## Domain model

### PhysicalFlowFact

Introduce a language-independent derived physical-flow fact inside `@dope/software-map`.

A fact represents one evidence-backed application-level execution interaction and owns:
- deterministic stable ID for unchanged evidence/input;
- typed interaction semantic;
- source and target identity references;
- evidence IDs;
- optional origin Flow fact IDs when an aggregate summarizes lower-level interactions;
- optional evidenced data/type/schema/event annotation;
- optional async/boundary attributes where useful;
- explicit unknown/unsupported detail where applicable.

Source/target may reference existing Software Map nodes or stable derived physical endpoints such as an inbound route boundary, store, queue or external service. Derived endpoints do not become canonical architecture nodes.

Initial Phase 6 interaction semantics are locked as:
- `receives`;
- `invokes`;
- `reads`;
- `writes`;
- `calls-external`;
- `publishes`;
- `consumes`;
- `responds`.

Do not add `returns` as a separate base interaction in Phase 6. Return information normally enriches `invokes` or an explicit output/response boundary.

A deterministically resolved project-code call remains valid `invokes` Flow even when it has zero arguments and its return value is unused, provided it is a real application execution step.

Data/type/schema/event information upgrades a Flow interaction only when separately evidenced. Serialization/deserialization is initially Processing metadata/annotation, not its own interaction, unless it represents a distinct meaningful execution component.

### Snapshot ownership

`PhysicalFlowFact[]` is first-class rebuildable state on `PhysicalMapSnapshot`.

Static Flow facts publish atomically with the same Physical Map project identity, analysis generation, and source/config/canonical input fingerprint as graph nodes and structural relationships. Phase 6 does not add a separate Flow index or independent generation counter.

Flow queries and aggregation operate from the published snapshot first. Add a separate index only if later measured scale/performance evidence requires one.

Future recorded-runtime observations should reuse the same Flow fact/evidence domain with explicit runtime evidence/observation identity. They must not silently redefine the current static source/config/canonical input fingerprint contract or create a second Flow authority.

### Derived Flow endpoints

Non-architectural Flow participants are first-class derived Physical Map records separate from `GraphNode`.

Examples include inbound/outbound HTTP boundaries, datastores, queues/topics/jobs, external services/APIs, file/blob storage and client/browser boundaries where evidenced.

Endpoint IDs are deterministic normalized identities built only from properties Dope can prove, such as protocol, HTTP method/path, logical datastore/connection identity, directly known table/entity, queue/topic/job name, or external service/host/path.

Multiple observations share an endpoint only when deterministic evidence establishes endpoint equivalence. When identity is uncertain, retain a narrower source-scoped or connection-scoped derived endpoint rather than collapsing observations into a generic shared node.

Each endpoint retains originating code/evidence references so Flow can place the interaction in architectural context. Derived endpoints never become canonical System / Subsystem / Component / CodeEntity records merely for visualization.

### FlowRole

Projection roles:
- Input;
- Boundary;
- Processing;
- Store;
- External;
- Output.

A single identity may have different roles in different focused projections. Roles are never written into canonical architecture.

## Evidence rules

Permanent negative invariant:

```text
import != invocation
reference != invocation
dependency != execution flow
```

An import/reference/dependency may help locate candidates or explain architecture, but no Flow edge is emitted from that fact alone.

A deterministically resolved project-code call may emit an `invokes` Flow fact without proving argument/return lineage.

Physical Flow is backed by deterministic syntax/semantic/framework evidence or explicit recorded runtime observation. AI output remains explanation/proposal only.

Payload/type/schema/event labels appear only when separately supported by evidence. Unknown remains unknown.

## Analyzer plan

### Generic TypeScript invocation

Use TypeScript compiler/type-checker semantics to resolve supported `CallExpression` targets into project code. Emit physical invocation Flow facts when the call target is deterministically resolved.

Do not turn general identifier references into calls.

This phase does not require whole-program argument/return propagation before an invocation can appear in Flow.

### Adaptive SEO boundary vertical slice

Phase 6 Green requires deterministic support for four real Adaptive SEO categories:

1. **Express 5 request/response boundaries**
   - detect route registration and request/response boundaries through the actual registration helpers used by the repository, not only route declarations written directly in `app.ts`;
   - preserve route method/path evidence and handler/source provenance.

2. **PostgreSQL through the real repository abstraction**
   - support Adaptive SEO's `Database` / `QueryExecutor` path, not only direct `pg.Pool.query` calls;
   - classify deterministic query operations as `reads` or `writes` where the SQL/evidence supports that distinction;
   - transactions remain interactions with the same underlying store boundary rather than a second datastore identity.

3. **External HTTP/client boundaries**
   - support deterministic raw Node `http`/`https` interactions used by the collection path;
   - support identifiable provider/client calls where the real target can be established, including calls behind bounded helper wrappers;
   - wrappers must not erase the external boundary.

4. **Generic resolved internal invocation**
   - P2 invocation Flow connects route, service, repository and boundary interactions into one execution path.

Worker/job/event Flow is valuable secondary scope and may be implemented when it falls naturally out of the same extractor architecture, but it is not mandatory for the primary P7 Green path.

Add at least one small synthetic TypeScript fixture that exercises the same supported concepts with different names, routes, classes and file layout. This is a permanent anti-hardcoding guard.

Extractor contracts must be replaceable and evidence-backed. Do not hardcode Adaptive SEO file paths, IDs or expected answers.

## Data/type/schema enrichment

Phase 6 supports direct, low-cost semantic enrichment only when evidence is explicit.

Allowed initial enrichment includes:
- useful TypeScript argument/return type names when directly resolved;
- HTTP method/path as boundary metadata;
- explicit request/response schema identity;
- event/topic identity and schema;
- directly evidenced persistence entity/table names.

Suppress broad or low-information types such as `unknown`, `object`, generic record shapes, and framework plumbing types from the main Flow canvas unless they materially aid understanding.

Field-level lineage, property/alias tracking, inferred DTO transformations, taint propagation, and guessed schema relationships are out of scope.

Unknown data is represented by absence of a data annotation on the canvas. Edge inspection may explicitly report that data semantics are not resolved.

## Query model

Add a provider-independent generation-scoped Flow query over the published Physical Map.

The query must:
- be focused/bounded by System or Subsystem context;
- aggregate lower-level Flow facts to the active architectural detail level;
- retain origin/evidence traceability;
- preserve branches, joins, cycles and external round trips;
- expose explicit unknown/truncated/unsupported state;
- use deterministic ordering/stable IDs;
- reject stale project/generation publication;
- distinguish a static possible execution path from future recorded-runtime observed paths.

### Architecture-scope Flow aggregation

System/Subsystem Flow aggregation is path-preserving rather than relationship-counting.

An architectural aggregate may exist only when lower-level Flow facts form one continuous evidenced execution path between the relevant architectural scopes. Every aggregate retains `originFlowFactIds` and evidence/provenance for the lower-level facts that justify it.

If the lower-level path contains an unsupported or missing hop, the aggregate projection preserves that gap. It must not draw a connector merely because source and target scopes both participate somewhere in the broader execution graph.

Preserve meaningful branch/fan-out/join shape during aggregation. Repeated equivalent lower-level interactions may collapse visually, but materially different interaction kinds such as `reads`, `writes`, `invokes`, and `calls-external` remain distinct when merging them would erase behavior.

Optional data/type/schema annotations are never combined into an invented shared payload. Aggregation may summarize only what the origin facts actually support.

### Static execution-path stitching

Flow queries stitch deterministic multi-hop execution only across proven Flow facts.

The query layer supports:
- downstream traversal from known input/boundary or selected nodes;
- upstream traversal for callers/producers/state dependencies;
- cycle/recursion termination with visited node/edge guards;
- `async`/`await` continuity when the target is deterministically resolved;
- callbacks/promises only when the callback/binding target is deterministic;
- producer/consumer continuation only when event/queue/topic identity is deterministically established.

Phase 6 does not require argument/return propagation for path construction. Such information remains optional enrichment.

Default query budgets are:
- at most 100 visible Flow nodes;
- at most 200 Flow edges;
- at most 32 hops on one path.

When a budget is exceeded, the query exposes explicit truncated/continue-deeper state. It must not silently drop reachable Flow while presenting the result as complete.

Static deterministic results are labeled **Static Flow**: evidence-backed possible execution relationships. Reserve **Observed Flow** for future runtime-observed execution so statically reachable branches are not presented as proof of one concrete request path.

React Flow/browser presentation must not own Flow discovery, aggregation or truth.

## Projection and layout

The initial Flow projection is directional and normally left-to-right.

Use deterministic layered layout implemented in Dope presentation/projection code. Support:
- entry lanes;
- processing/invocation;
- stores/external boundaries;
- outputs;
- fan-out/branch;
- joins;
- explicit cycles/back-edges.

Do not add Dagre/ELK or another automatic layout dependency in the initial stack. A future bounded correction may add one only if real qualification shows the deterministic layout is inadequate.

### Directional color reinforcement

Flow may use the shared curated map palette as projection-specific directional reinforcement instead of strictly inheriting Architecture parent colors. Map visible source -> downstream layers deterministically through the bounded palette so the eye can follow progression from Inputs toward later Processing, Store/External and Output stages; nearby layers may share a color when the visible path is deeper than the palette. Branches at the same approximate downstream stage may share treatment, joins adopt the later-stage treatment, and cycles/back-edges remain explicitly directional rather than being represented as a false linear gradient.

Color never establishes Flow truth or ordering by itself. Direction must remain readable through deterministic layout, arrowheads, routing, labels, trace/selection treatment and other non-color cues. Optional node/edge tinting may reinforce the progression, but must stay subordinate to those cues and remain readable in supported themes and color-vision-deficiency use cases. Flow projection coloring must not mutate the shared architecture identity or its persisted Architecture color preference; any future explicit Flow-only override is separate presentation state.

## Non-linear and asynchronous Flow grammar

Branches/fan-out and joins/fan-in are represented by graph topology rather than new base interaction kinds.

Ordinary `async`/`await` or Promise continuation is an attribute/visual treatment on an existing Flow interaction when the continuation target is deterministically resolved.

Real asynchronous handoffs such as queue/topic/job/event boundaries use explicit derived Flow endpoints and `publishes` / `consumes` interactions.

Cycles remain explicit back-edges in the otherwise directional layout.

Retries and optional/error paths appear only when deterministic evidence proves them. Represent them as metadata/visual semantics on the relevant Flow facts/path rather than adding new Phase 6 base interaction kinds.

External round trips remain one `calls-external` interaction. Awaited/consumed response evidence may enrich that interaction; do not add a reverse `returns` edge merely for visual symmetry.

P7 must demonstrate at least one real branch/fan-out or join in Adaptive SEO. Retries, cycles, and rarer async shapes may be fixture-qualified rather than mandatory in the real dogfood path.

## UI integration

The existing center Physical Map workspace gains complementary projection modes:

`[ Architecture ] [ Flow ]`

Do not create an independent Flow state owner/widget hierarchy.

Switching mode preserves:
- workspace/project;
- selected/focused architecture identity;
- System/Subsystem focus;
- source navigation context.

Flow edges are inspectable. Edge inspection exposes interaction kind, evidence/provenance, optional data annotation and ordinary source navigation.

## Flow UX

The default Flow experience is **overview first, path exploration second**.

When the developer switches to `Flow` at System scope, show a quiet architecture-level overview containing:
- major Inputs;
- major Outputs;
- participating architectural scopes;
- Stores;
- External endpoints;
- high-level evidenced Flow connections.

Do not render every code-level invocation in the initial System view.

Selecting an Input or Flow participant highlights its relevant Static Flow path/neighborhood. Other known Flow remains visually subdued by default for orientation rather than disappearing completely.

Provide explicit exploration controls:
- `Trace downstream`;
- `Trace upstream`;
- `Clear trace`.

Known Inputs should be easy to discover and act as natural behavioral entry points.

Code-level invocation detail is progressively disclosed as the developer focuses from System -> Subsystem -> Component -> Code. The Flow surface should preserve the same progressive-disclosure mental model as the rest of sMap and avoid becoming an unbounded call-graph hairball.

### Enforceable overview density

At System scope, the query projects code into its accepted Subsystem (or its directly owning System); code without accepted ownership remains an explicitly labeled unassigned group. Invocation facts involving that group stay available for trace but do not draw architectural connectors without an accepted owner; their count is explicit and is not called truncation. HTTP Inputs and Outputs group by direction at the System boundary; their individual routes reappear at Subsystem scope. Distinct Stores, external services and other resource identities remain distinct. For each ordered pair of visible participants and interaction kind, the System canvas receives one relationship with all direct origin facts and separate detail-semantic variants. No relationship is inferred merely because two areas touch a shared participant.

At Subsystem scope, accepted Components take precedence; otherwise code collapses to its evidenced file identity, while HTTP routes and resource identities remain individually inspectable. Directional traces return the underlying physical interactions. Group members and relationship origins provide drill-down to those facts.

These are semantic bounds rather than a count chosen to clip the canvas. The existing 100 participant / 200 relationship hard limits apply after projection; exhaustion is reported as truncation. Intentional aggregation is reported separately and never changes analysis coverage status.

## Persistence

No `.dope/flow.json` is introduced.

Physical Flow facts/projections are derived from source/config/canonical inputs and supported runtime observations. Restart/copy qualification rebuilds equivalent Flow rather than recovering a separate persisted Flow authority.

## Phase stack

| Prompt | Version | Boundary | Tier | Model | GUI |
| --- | --- | --- | --- | --- | --- |
| P1 | `0.6.1` | physical Flow domain/evidence contracts, deterministic IDs | T1 | GPT-6 Sol High | no |
| P2 | `0.6.2` | generic TypeScript deterministic invocation Flow | T1 | GPT-6 Sol High | no |
| P3 | `0.6.3` | Adaptive SEO boundary extractors: supported HTTP/persistence/external/event slice | T2 | GPT-6 Sol High | no |
| P4 | `0.6.4` | Flow query/path aggregation, generation guards and diagnostics | T2 | GPT-6 Sol High | no |
| P5 | `0.6.5` | pure directional Flow projection and deterministic layered layout | T1 | GPT-6 Sol High | no |
| P6 | `0.6.6` | Architecture/Flow UI, edge inspection, source navigation and focus identity | T2 | GPT-6 Sol High | no |
| P7 | `0.6.7` | direct Adaptive SEO Flow qualification plus exact-candidate T3 evidence | T3 | GPT-6 Sol High | yes |
| P8 | `0.6.8` | evidence-only Phase 6 closeout | T3 audit | GPT-6 Sol Medium | no |

## Validation discipline

P1/P2/P5 use T1 focused tests and affected builds only.

P3/P4/P6 are T2 because they cross analyzer/query/application/presentation boundaries.

P7 owns direct real-GUI and broad exact-candidate evidence:
- Adaptive SEO Flow direct interaction;
- focused Phase 6 suites;
- current `npm run check`;
- restart integration;
- browser/Electron builds;
- Linux AppImage/package inspection and native launch;
- phase prompt validation;
- diff/version/no-root-lock coherence.

P8 is evidence-only. It must not repair P7 failures.

## Flow coverage and trust diagnostics

Flow must never imply completeness beyond supported/evidenced execution surfaces.

The query/UI contract exposes explicit diagnostics for:
- unsupported interaction/framework patterns encountered;
- unresolved deterministic continuations;
- query/path truncation;
- evidence gaps that prevent continuity.

Missing data/type/schema annotations are acceptable when execution Flow itself is evidenced. Unsupported boundaries outside the qualified slice are acceptable when surfaced explicitly.

A missing or invented execution hop inside the chosen qualification path, stale-generation publication, hidden truncation, or a rendered connector that bridges an evidence gap is Not Green.

## P7 dogfood target

Use a fresh disposable copy of the mapped accepted Adaptive SEO workspace. Keep the accepted reference unchanged.

Directly prove:
- focus a representative System;
- Architecture -> Flow switch;
- one real continuously evidenced Adaptive SEO behavior from inbound HTTP boundary -> resolved internal execution -> persistence and/or external-service boundary -> output/response boundary;
- representative edge provenance and source navigation;
- Subsystem focus without identity fork;
- at least one real branch/fan-out or join inside the qualified behavior;
- explicit partial/unsupported/truncated diagnostics where applicable;
- Flow -> Architecture return with focus/selection preserved;
- no model/provider required.

Payload/type/schema labels are enrichment where evidenced, not a prerequisite for the base execution path.

Missing or invented execution hops inside the chosen qualification behavior are Not Green. A controlled fixture may supplement cycles/retries/rare shapes but cannot replace the real Adaptive SEO execution path.

## Explicit non-goals

Phase 6 does not implement:
- compiler CFG/basic-block visualization;
- whole-program variable/taint analysis;
- arbitrary cross-language lineage;
- exhaustive SQL/table/column lineage;
- mandatory runtime tracing;
- AI-generated missing hops or Flow explanations as physical truth;
- Planning Map Flow editing;
- persisted Flow database/state;
- general AI Presence / Agent Mind;
- mutation/tool authority or delegation;
- a framework upgrade;
- arbitrary Node/DB framework coverage.

## Execution readiness

All ten Flow decisions are promoted into authority. The executable P1-P8 stack, prompt assessment and implementation plan are written under `docs/tasks/p6/`.

Validate with `npm run codex:phase:validate -- p6` before execution.
## P7 correction gate — Flow overview priority

P7 at `0.6.7` proved that physical Flow extraction can recover a real Adaptive SEO GET opportunities path, but the user-visible bounded overview failed qualification.

Correction `c6-flow-overview-priority` is mandatory before P8 and keeps version exactly `0.6.7`.

Locked correction rules:
- overview budgets apply after semantic scope reduction/aggregation so hidden implementation facts do not consume the visible budget;
- overview admission uses explicit behavioral priority rather than Flow fact ID lexical order;
- evidenced Inputs are behavioral anchors: a truncated focused scope must not lose every evidenced Input;
- shared derived endpoints do not own architecture scope; scope inclusion is determined per Flow fact from its code-side participant(s);
- equivalent visible interactions may collapse only when source, target, interaction kind, enrichment and behavior semantics are compatible, retaining every `originFlowFactId`/evidence;
- a valid selected Flow identity may be traced directly within its focus even if absent from the current truncated overview;
- default truncation UI summarizes continuation count instead of printing an unbounded wall of raw IDs.

The correction does not change the 100-node / 200-fact / 32-hop hard limits, Flow ontology, Adaptive SEO accepted architecture, extractor truth, provider boundary or layout-engine policy.

Original `docs/tasks/p6/P7-flow-dogfooding-evidence.md` remains historical Not Green evidence and must not be rewritten as Green.
## Phase 6 presentation correction — sMap outline

A direct review of the left Software Map inspector at `0.6.7` found that its current presentation undermines the navigation role already assigned by ADR 0008: every hierarchy node is styled like a filled action button, branches are effectively expanded by default, and center-map selection does not yet reveal the corresponding tree path.

Correction `c6-smap-outline` is approved at unchanged `0.6.7`.

Locked correction rules:
- the inspector architecture surface is a compact hierarchical text outline, not a second visual map and not a wall of primary buttons;
- rows use type-first labels: `system -`, `subsystem -`, `component -`, and code-kind labels such as `file -`;
- full identity text remains readable; important names and source paths wrap rather than truncate;
- every expandable architecture branch starts collapsed on fresh inspector state;
- disclosure and selection are separate interactions with keyboard/focus accessibility;
- the existing Software Map controller selection remains the only shared architecture selection identity;
- center-map selection opens the missing ancestor chain, scrolls the row into view and marks it selected;
- automatic reveal preserves unrelated branches the user manually expanded;
- sidebar selection continues to drive the shared identity observed by the center map;
- expansion/collapse is presentation state only and never enters canonical architecture, `.dope/`, Flow state, Planning state or project persistence;
- `Open Physical Map` / `Refresh Software Map` may become compact secondary actions;
- hierarchy cleanup must preserve the inspector's existing diagnostics, relationships, evidence, source navigation, violations and unassigned implementation surface.

This correction does not change Flow extraction, Flow facts/endpoints, Flow query/aggregation, query budgets, canonical architecture, Physical Map evidence, Planning semantics, synthesis/provider runtime behavior or package version.

It is independent of `c6-branch-seam` and the Flow projection-contract repair. It does not rewrite retained Not Green evidence or unblock P8 by itself. Use the normal `/prompt-ass -> /prompt-plan -> /prompt-write c6-smap-outline` workflow before implementation.

## Phase 6 presentation correction — sMap sidebar density

The Green `c6-smap-outline` established the correct left-inspector hierarchy/navigation behavior, but direct follow-up review found remaining density/readability waste in the initialized sidebar: a redundant large body title, unstructured compact actions, a full status block, expensive nested indentation/gutter, and no stable visual distinction between entity kinds.

Correction `c6-smap-sidebar-density` is approved at unchanged `0.6.7` as a presentation-only follow-on.

Locked correction rules:
- remove the large body `Software Map` heading from the initialized inspector while preserving the Software Map view identity and accessibility naming;
- use compact `SMAP CONTROLS`;
- render `OPEN` and `REFRESH` inline on the first row;
- use the second row as the `EDIT ARCHITECTURE` action seam: style the real action if `c6-edit-architecture` is present, otherwise do not ship an enabled no-op or invent editing behavior;
- condense normal published generation/completeness/node/violation state to one compact `SYNTHESIS` line while keeping actionable partial/error diagnostics separately visible;
- materially reduce nested indentation and disclosure/spacer gutter without flattening the hierarchy or truncating important names/paths;
- visually distinguish System, Subsystem, Component and supported code/file kinds by stable kind-token/prefix color or another zero/near-zero-width treatment rather than wide pills or full-row fills;
- keep sidebar kind colors independent from `c6-map-color-grammar` node/branch color inheritance and explicit user overrides;
- preserve selection/focus as a separate stronger state with non-color cues;
- permit future warning/status icons without reserving empty width today;
- preserve every Green `c6-smap-outline` behavior: collapsed fresh state, separate disclosure/selection, shared map selection identity, center-map ancestor reveal/scroll, unrelated manual expansion preservation, sidebar-to-map selection, full wrapping and deep inspector evidence/source/diagnostic behavior.

This correction must not change canonical architecture, Software Map evidence/query truth, Physical Map/Flow truth, Planning semantics, map color persistence/override semantics, Edit Architecture domain/save/Search Deeper behavior, synthesis/model/provider behavior, `.dope/` persistence or package version.

Use one bounded manual **GPT-6 Sol High** one-off prompt with T2 focused validation plus targeted Adaptive SEO GUI evidence. Do not create a multi-prompt phase stack and do not rerun AppImage/full Phase 6 qualification solely for this correction.

`c6-smap-outline` remains Green historical evidence and is not reopened. `c6-edit-architecture` and `c6-branch-seam` remain independent approved follow-ons. This correction does not relabel retained P7 evidence or unblock P8 by itself.

## Exit condition

Phase 6 is qualified when, on one exact provider-free candidate, a developer can use the real Dope GUI to follow a meaningful evidence-backed application Flow through a real mapped project, prove every representative hop to source/provenance, preserve architectural identity/focus across projection modes, observe non-linear execution shape, and reconstruct equivalent derived Flow after restart/reanalysis—while aggregate/package/native evidence is Green for the designated T3 gate.
