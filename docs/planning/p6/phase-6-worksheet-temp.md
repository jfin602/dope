# Product Phase 6 — Flow Temporary Decision Worksheet

Status: **TEMPORARY WORKSHEET — NOT PRODUCT AUTHORITY**
Date: 2026-10-02
Baseline: `0.6.0`
Phase: Product Phase 6 — Flow
Authority to consult: ADR 0020 as amended by ADR 0021, `docs/planning/p6/phase-6-plan.md`, current Software Map / Physical Map contracts

Purpose: resolve the ten highest-leverage open Flow decisions before writing the executable P1-P8 prompt stack.

This file is intentionally temporary. Lock one answer at a time. Promote resolved answers into product/architecture/phase authority, then remove this worksheet before Phase 6 closeout.

---

## Q1 — What exactly counts as a Flow hop, and what evidence upgrades that hop with data semantics?

Flow is now broader than strict data lineage.

Locked negative rule:

```text
import != invocation
reference != invocation
dependency != execution flow
```

ADR 0021 also locks one positive rule: a deterministically resolved project-code invocation may be a Flow hop even when payload semantics are unknown.

Candidate base interaction semantics:
- receives;
- invokes;
- reads;
- writes;
- calls-external;
- publishes;
- consumes;
- responds.

Questions to resolve:
- Which interaction kinds belong in the initial Phase 6 contract?
- Do we model `returns` as a separate interaction or keep return/data information on `invokes`/output boundaries?
- Is a resolved zero-argument/unused-return call still useful Flow if it is a real execution step?
- Which extra evidence upgrades an execution edge with argument/type/payload/schema information?
- Is serialization/deserialization a Processing node/annotation or a separate Flow interaction?

**Decision:** Lock the initial Flow interactions as receives, invokes, reads, writes, calls-external, publishes, consumes, and responds. Do not add a separate returns interaction. A deterministically resolved project call counts as invokes even with no arguments or used return. Data/type/schema details are optional enrichment only when separately evidenced. Serialization/deserialization is Processing metadata unless it is a distinct meaningful execution component.

**Why:** This keeps Phase 6 focused on useful execution behavior first while allowing richer data semantics to be layered on without requiring full data-lineage analysis.

---

## Q2 — Where should physical Flow live in the domain model?

The current Physical Map snapshot owns graph nodes, structural relationships, evidence and violations.

Options:
- add first-class `PhysicalFlowFact[]` to the published snapshot/result;
- keep analyzer Flow facts in analysis results and derive/query them separately;
- introduce a rebuildable in-memory Flow index attached to the same generation.

Questions to resolve:
- Should Flow facts be part of `PhysicalMapSnapshot`?
- Should Flow share the same generation/input fingerprint as structural relationships?
- Is a separate in-memory Flow index useful or needless complexity at current scale?
- Where should future recorded-runtime Flow observations enter?

**Decision:** Make `PhysicalFlowFact[]` first-class derived state on `PhysicalMapSnapshot`. Static Flow facts share the snapshot's existing project identity, analysis generation, and source/config/canonical input fingerprint. Do not add a separate Flow index in Phase 6; query and aggregate from the published snapshot first. Future recorded-runtime Flow should enter the same Flow fact/evidence model with explicit runtime evidence/observation identity rather than becoming a second Flow domain or silently changing the meaning of the current static input fingerprint.

**Why:** Flow is part of Physical Map truth and should publish atomically with the same analyzed software state as nodes/relationships. Keeping one snapshot avoids mixed-generation architecture/Flow views and reduces state ownership complexity. A separate index is premature until real scale/performance evidence requires it. Runtime observations can later enrich the same domain without making Phase 6 design depend on a tracing system that does not yet exist.

---

## Q3 — How are non-architectural Flow endpoints represented and identified?

Real Flow needs physical endpoints that are not canonical architecture:
- HTTP ingress/egress;
- PostgreSQL or another store;
- queue/topic/job boundary;
- external service/API;
- file/blob/object storage;
- user/browser/client boundary where evidenced.

Questions to resolve:
- Are endpoints typed derived records separate from `GraphNode`?
- Can several code sites intentionally resolve to one store/external endpoint?
- What participates in deterministic endpoint identity: protocol, host/service, route, DB logical name, queue name?
- What identity do we use when only generic "external HTTP" or "database" is knowable?
- How do endpoints map back to the owning architecture context without becoming canonical nodes?

**Decision:** Represent non-architectural Flow endpoints as first-class derived Physical Map records separate from `GraphNode`. Give each endpoint a deterministic normalized identity based only on evidenced endpoint properties such as protocol, HTTP method/path, logical datastore/connection identity, table/entity when directly known, queue/topic/job name, or external service/host/path. Multiple observations may share one endpoint only when Dope can deterministically establish they are the same endpoint; otherwise keep narrower source-scoped or connection-scoped endpoint identities. Every endpoint retains links to its originating code/evidence so Dope can place its use in architectural context without making the endpoint a canonical System/Subsystem/Component/CodeEntity.

**Why:** External/store/boundary concepts are real physical participants in Flow but are not architecture declarations or code entities. Keeping them separate preserves ontology truth and avoids creating fake Components just for visualization. Conservative endpoint equivalence prevents unrelated calls from collapsing into misleading generic Database/External nodes while still allowing real shared services/stores to converge to one stable endpoint when evidence proves identity.

---

## Q4 — What exact Adaptive SEO execution patterns are in the initial supported vertical slice?

P3 should qualify real deterministic Flow against Adaptive SEO rather than implement every Node framework.

Likely categories:
- Express-style routes/request/response;
- PostgreSQL query/read/write boundaries;
- internal service/function invocation;
- external HTTP/client calls where present;
- jobs/events/queues if the real code offers a clean deterministic example.

Questions to resolve:
- Which concrete Adaptive SEO libraries/wrappers must Phase 6 support?
- Are worker/job flows part of initial Green or deferred?
- Do we support wrapper/helper abstractions used by Adaptive SEO, not only direct library calls?
- What minimum second fixture prevents Adaptive SEO hardcoding?

**Decision:** Phase 6 Green requires deterministic support for four categories in the real Adaptive SEO vertical slice: (1) Express 5 request/response boundaries, including route registration through helper functions rather than only direct declarations in `app.ts`; (2) PostgreSQL access through Adaptive SEO's real `Database` / `QueryExecutor` abstraction, classifying deterministic query operations as `reads` or `writes` and treating transactions as the same store boundary; (3) deterministic external HTTP/client boundaries, including raw Node `http`/`https` use and identifiable provider/client calls even when wrapped by helper functions; and (4) generic resolved internal invocation from P2 to connect those boundaries into an execution path. Worker/job/event Flow is useful secondary scope and may land when naturally supported, but it is not mandatory for the primary P7 Green path. Require one small synthetic TypeScript fixture using the same supported concepts with different names, routes, classes, and layout to guard against Adaptive SEO hardcoding.

**Why:** These four categories are enough to demonstrate a real application behavior from HTTP input through internal execution to persistence and/or an external boundary and back to output. Supporting the repository's actual helper/wrapper abstractions is necessary for architectural usefulness; direct-library-only detection would disappear at the places where the real application structure matters. Deferring worker/job Flow from the mandatory first path keeps P3 bounded while preserving it as a valid follow-on/secondary qualification surface.

---

## Q5 — How far should static execution-path stitching go?

A useful Flow view needs more than isolated invocation facts, but a static reachable path is not proof that one runtime request executed every branch.

Possible bounds:
- direct interactions only;
- deterministic multi-hop traversal through resolved project calls;
- bounded traversal from known input/output boundaries;
- limited callback/promise/async continuity when statically resolvable.

Questions to resolve:
- Maximum path depth/node/edge budget?
- How do recursion/cycles terminate?
- How do callbacks, promises and async/await join the execution path?
- How do we label static possible paths versus future recorded-runtime observed paths?
- Do we need any argument/return propagation in Phase 6 path stitching, or only as optional annotation?

**Decision:** Stitch deterministic multi-hop execution paths only across proven Flow facts. Support upstream and downstream traversal from a known boundary or selected node; terminate recursion/cycles with visited node/edge guards. Treat `async`/`await` as ordinary execution continuity when the target is deterministically resolved. Include callbacks, promises, and producer/consumer event continuation only when the callback/binding or event identity is deterministically established. Phase 6 path stitching does not require argument/return propagation; those remain optional enrichment. Bound each query to 100 visible Flow nodes, 200 Flow edges, and 32 hops on one path. When a budget is exceeded, expose explicit truncated/continue-deeper state instead of silently dropping Flow. Label deterministic static results as Static Flow: evidence-backed possible execution relationships. Reserve Observed Flow for future runtime-observed execution.

**Why:** Multi-hop stitching is necessary for Flow to explain real behavior, but exhaustive whole-program traversal would create unreadable graphs and misleading certainty. Explicit budgets keep query cost and UI density bounded, while truncation preserves truth. Separating Static from future Observed Flow prevents a statically reachable branch from being presented as proof that one concrete runtime request executed it.

---

## Q6 — How much data/type/schema enrichment should Flow attempt?

Data semantics now enrich Flow rather than gate it.

Possible initial levels:
1. no data labels;
2. direct TypeScript argument/return type name;
3. explicit HTTP request/response/event schema identity;
4. persistence entity/table label;
5. richer field-level lineage.

Questions to resolve:
- What is the minimum useful enrichment for Phase 6?
- Should broad/generic TypeScript types be shown?
- Should HTTP method/path be boundary metadata regardless of payload knowledge?
- Should SQL table/entity names be shown when directly parseable?
- What UI language represents unknown data without making Flow look broken?

**Decision:** Phase 6 supports direct, low-cost semantic enrichment only when evidence is explicit. Show useful TypeScript argument/return type names, HTTP method/path and explicit request/response schema identity, event/topic identity and schema, and directly evidenced persistence entity/table names. Suppress broad or low-information types such as `unknown`, `object`, generic records, and framework plumbing types from the main Flow canvas unless they materially aid understanding. HTTP method/path is boundary metadata even when payload semantics are unresolved. Field-level lineage, alias/property tracking, inferred DTO transformations, taint propagation, and guessed schema relationships are out of scope. Unknown data is represented by the absence of a data annotation on the canvas; edge inspection may state that data semantics are not resolved.

**Why:** This gives developers meaningful context where the analyzer can prove it without turning Phase 6 into a data-lineage project. Keeping unknowns quiet on the canvas preserves readability, while explicit inspection text keeps uncertainty honest.

---

## Q7 — How should code-level Flow aggregate to System/Subsystem views without inventing continuity?

Default Flow must remain readable at architecture scope while evidence originates at code/symbol/boundary level.

Aggregation risks:
- merging unrelated invocation paths;
- hiding gaps between independently evidenced segments;
- losing branch/join shape;
- duplicating many same-boundary interactions;
- suggesting data continuity where only execution continuity is known.

Questions to resolve:
- When may multiple lower-level interactions collapse into one architecture Flow edge?
- Must an aggregate preserve one continuous origin path?
- How do multiple interaction kinds between the same source/target appear?
- When should gaps split the visual path?
- How are optional data annotations combined without inventing one payload?

**Decision:**

**Why:**

---

## Q8 — What should the Flow UX optimize for: path exploration or whole-scope overview?

The concept is System-first with Subsystem focus and progressive disclosure.

Possible primary experiences:
- show all high-level Flow in the focused System;
- start from selectable Inputs and trace downstream;
- start from the selected architecture node and show upstream/downstream neighborhood;
- combine a quiet overview with explicit path tracing.

Questions to resolve:
- What appears immediately after clicking **Flow**?
- How does the developer choose a behavior/input/path?
- Should unrelated Flow be hidden/subdued until selection?
- Should forward/backward tracing be explicit controls?
- At what detail level do code-level invocations appear?
- How do we prevent Flow from becoming another hairball?

**Decision:**

**Why:**

---

## Q9 — How should branches, joins, async boundaries, cycles and retries be represented?

Directional layout must not imply synchronous, linear execution.

Need visual grammar for:
- fan-out;
- join/fan-in;
- async handoff;
- queue/event boundary;
- retry/backoff;
- cycle/loop;
- external round trip;
- optional/error paths.

Questions to resolve:
- Which require distinct edge/node semantics in Phase 6?
- Is async a Flow-fact attribute, edge treatment or explicit boundary endpoint?
- How should cycles/back-edges appear without destroying left-to-right readability?
- Are retry/error paths required for P7, or fixture-only/deferred?
- How do we distinguish possible branch from observed runtime branch later?

**Decision:**

**Why:**

---

## Q10 — What evidence/completeness standard must P7 meet to call Flow trustworthy?

Phase 6 must not look complete when supported execution surfaces are partial.

Questions to resolve:
- What real Adaptive SEO behavior/path must be demonstrable end-to-end?
- Is one real input -> internal invocation -> persistence/external -> output path enough?
- Must the real project demonstrate branch/fan-out/join, or may a fixture supplement it?
- What diagnostics tell the developer which frameworks/interactions are unsupported?
- Should Flow expose a partial-analysis/coverage state separate from overall Software Map completeness?
- Which missing execution evidence is Not Green versus acceptable explicit unknown?
- Are data annotations optional for Green if the execution path itself is fully evidenced?

**Decision:**

**Why:**

---

## Resolution checklist

Before `/prompt-write p6`, promote answers into authoritative Phase 6 docs:

- [x] Q1 Flow-hop semantics and data-enrichment threshold
- [x] Q2 domain/snapshot/index ownership
- [x] Q3 derived endpoint identity
- [x] Q4 Adaptive SEO supported patterns
- [x] Q5 execution-path stitching bounds
- [x] Q6 data/type/schema enrichment scope
- [ ] Q7 architecture aggregation semantics
- [ ] Q8 primary Flow UX
- [ ] Q9 non-linear/async visual grammar
- [ ] Q10 P7 completeness/qualification bar

After promotion into authority, remove this temporary worksheet.
