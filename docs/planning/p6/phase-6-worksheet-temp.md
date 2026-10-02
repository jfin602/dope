# Product Phase 6 — Data Flow Temporary Decision Worksheet

Status: **TEMPORARY WORKSHEET — NOT PRODUCT AUTHORITY**
Date: 2026-10-02
Baseline: `0.6.0`
Phase: Product Phase 6 — Data Flow
Authority to consult: ADR 0020, `docs/planning/p6/phase-6-plan.md`, current Software Map / Physical Map contracts

Purpose: resolve the ten highest-leverage open decisions before writing the executable P1-P8 prompt stack.

This file is intentionally temporary. Answers should be promoted into the appropriate product/architecture/phase-plan documents during the next documentation update, then this worksheet can be removed.

---

## Q1 — What exactly counts as a Data Flow hop?

The phase already locks one negative rule:

`import != call`
`reference != value flow`
`dependency != data flow`

The remaining question is the positive definition. We need a small set of physical interactions that are strong enough to say "information moved" without drifting into speculative program analysis.

Candidate minimum:
- resolved internal function/method invocation;
- inbound request/event boundary -> handler;
- handler/processing -> response/output boundary;
- persistence read/write;
- supported external client request/response;
- supported producer/consumer event relationship.

Questions to resolve:
- Is a resolved call always a flow hop, or only when arguments/return/data-bearing values are involved?
- Is control-only invocation useful enough to include?
- Do serialization/deserialization steps become their own hop or metadata on a hop?

**Decision:**

**Why:**

---

## Q2 — Where should physical flow live in the domain model?

The current Physical Map snapshot owns graph nodes, structural relationships, evidence and violations. Phase 6 could either:
- add first-class `PhysicalFlowFact[]` to the published snapshot/result;
- keep analyzer flow facts in analysis results and derive/query them separately;
- or introduce another rebuildable flow index attached to the same generation.

The choice affects snapshot size, query cost, generation safety, testing, and whether future analyzers can contribute flow without coupling to presentation.

Questions to resolve:
- Should flow facts be part of `PhysicalMapSnapshot`?
- Should flow facts share the same generation/input fingerprint as architecture relationships?
- Is a separate in-memory flow index warranted, or unnecessary complexity now?

**Decision:**

**Why:**

---

## Q3 — How are non-architectural flow endpoints represented and identified?

Real flows need things that are not canonical Systems/Subsystems/Components:
- HTTP ingress/egress;
- PostgreSQL or another store;
- queue/topic/job boundary;
- external service/API;
- file/blob/object storage;
- possibly a user/browser/client boundary.

We need stable, deterministic identities without turning these into canonical architecture.

Questions to resolve:
- Are these typed derived endpoint records separate from GraphNode?
- Can multiple code sites intentionally resolve to the same external/store endpoint?
- What information participates in endpoint identity: protocol, host/service, route, DB logical name, queue name?
- What happens when only a generic "external HTTP" or "database" boundary is knowable?

**Decision:**

**Why:**

---

## Q4 — What exact Adaptive SEO patterns are in the initial supported vertical slice?

P3 is intended to qualify real deterministic flow extraction against Adaptive SEO rather than implement every Node framework.

Likely categories:
- Express-style routes/request/response;
- PostgreSQL query/read/write boundaries;
- internal service/function calls;
- external HTTP/client calls where present;
- jobs/events/queues if the real code gives a clean deterministic example.

Questions to resolve:
- Which concrete libraries/patterns in Adaptive SEO are mandatory for Phase 6 Green?
- Do we include worker/job flows in the initial slice or defer them?
- Do we support only direct library calls, or wrapper/helper abstractions used by Adaptive SEO too?
- What minimum second fixture prevents us from accidentally hardcoding Adaptive SEO?

**Decision:**

**Why:**

---

## Q5 — How far should static call/path stitching go?

A useful Data Flow view needs more than isolated call facts, but blindly walking the call graph risks pretending that all possible calls form one real data path.

Possible bounds:
- direct calls only;
- direct calls plus deterministic path stitching through resolved project calls;
- bounded multi-hop traversal from known input/output boundaries;
- limited interprocedural propagation using argument/return relationships.

Questions to resolve:
- What is the maximum supported path depth or traversal budget?
- How do recursion/cycles terminate?
- Do callbacks, promises and async/await count as ordinary call continuity when statically resolvable?
- How do we distinguish "reachable call path" from "data-bearing path"?

**Decision:**

**Why:**

---

## Q6 — How much payload/type/schema information should Phase 6 attempt?

ADR 0020 allows payload/type/schema/event identity only when evidence supports it.

Possible initial levels:
1. no payload labels at all;
2. symbol/type name when directly resolved;
3. request/response/event schema identity where explicit;
4. richer field-level lineage.

The richer levels rapidly approach data-lineage/taint-analysis work that Phase 6 explicitly does not require.

Questions to resolve:
- What is the minimum payload label worth showing in the first release?
- Should TypeScript type names be shown when resolvable but structurally broad?
- Should SQL table names or HTTP route parameters be labels?
- What exact UI text represents unknown payload without looking broken?

**Decision:**

**Why:**

---

## Q7 — How should code-level flow facts aggregate to System/Subsystem views without inventing continuity?

The default Data Flow experience should be readable at System/Subsystem scope, while evidence originates at code/symbol/boundary level.

Aggregation risks:
- merging unrelated parallel calls into one misleading "flow";
- hiding gaps between independently evidenced segments;
- losing branch/join information;
- duplicating many identical architectural edges.

Questions to resolve:
- When may multiple lower-level facts collapse into one architectural flow edge?
- Must an aggregate edge preserve a continuous origin path, or can it summarize all source->target flow facts?
- How are multiple distinct payloads/semantics between the same boundaries shown?
- Should gaps split a path visually instead of drawing one aggregate connector?

**Decision:**

**Why:**

---

## Q8 — What should the Data Flow UX optimize for: path exploration or whole-scope overview?

The current concept is System-first with Subsystem focus, but the interaction model is still open.

Possible primary experiences:
- show all known flow in the focused System;
- start from selectable Inputs and highlight one path at a time;
- start from selected architecture node and show upstream/downstream neighborhood;
- combine an overview with explicit path tracing.

Questions to resolve:
- What does the user see immediately after clicking **Data Flow**?
- How does the user choose a particular input/output/path?
- Should the default hide unrelated flow until selection?
- Should forward/backward tracing be explicit controls?
- How much detail appears before the view becomes another hairball?

**Decision:**

**Why:**

---

## Q9 — How should branches, joins, async boundaries, cycles and retries be represented?

A directional layout must not imply that execution is linear or synchronous.

We need a visual grammar for:
- fan-out;
- join/fan-in;
- async handoff;
- queue/event boundary;
- retry/backoff;
- cycle/loop;
- external round trip;
- optional/error paths.

Questions to resolve:
- Which of these need distinct edge/node semantics in Phase 6?
- Is an async boundary a role, edge attribute, or explicit derived endpoint?
- How should cycles/back-edges appear without destroying left-to-right readability?
- Are retry/error paths required for P7, or fixture-only/deferred?

**Decision:**

**Why:**

---

## Q10 — What evidence/completeness standard must P7 meet to call the Data Flow view trustworthy?

Phase 6 should not look complete when analyzer coverage is partial.

The P7 dogfood target is Adaptive SEO, but the exact acceptance bar needs to be explicit.

Questions to resolve:
- What real Adaptive SEO path must be demonstrable end-to-end?
- Is one real input -> processing -> persistence/external -> output path enough, or do we require multiple categories?
- Must the real project demonstrate a branch/fan-out or join, or can a controlled fixture supplement it?
- What coverage/diagnostic indicator tells the developer which flow surfaces are unsupported?
- Should the UI expose a "partial flow analysis" state analogous to Software Map analysis completeness?
- What missing evidence is a Not Green blocker versus an acceptable explicit unknown?

**Decision:**

**Why:**

---

## Resolution checklist

Before `/prompt-write p6`, the answers should be reflected in the authoritative Phase 6 docs where applicable:

- [ ] Q1 hop semantics
- [ ] Q2 domain/snapshot ownership
- [ ] Q3 derived endpoint identity
- [ ] Q4 Adaptive SEO supported patterns
- [ ] Q5 traversal/path-stitching bounds
- [ ] Q6 payload/schema scope
- [ ] Q7 aggregation semantics
- [ ] Q8 primary UX model
- [ ] Q9 non-linear/async visual grammar
- [ ] Q10 P7 completeness/qualification bar

After promotion into authority, remove this temporary worksheet.
