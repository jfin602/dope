# Correction 6 Implementation Plan — Flow Overview Priority

Status: **APPROVED / PROMPTS WRITTEN / READY FOR EXECUTION**
Correction folder: `c6-flow-overview-priority`
Required unchanged package version: `0.6.7`
Activation source: `59573b0dd66935fc78ec1eb0cc34f60644e4f000`
Docs authority baseline: `0ee68113d251faf61a636df317935902dfaa918b`
Assessment: `prompt-assessment.md`

## Shared preflight

Every prompt reads BOOT/AGENTS, current Phase 6 authority, this correction README/assessment/plan, original P7 evidence and exact current Flow query/projection/controller/widget source/tests.

Require:
- package version exactly `0.6.7`;
- activation source reachable;
- P7 remains Not Green historical evidence;
- P8 remains blocked;
- accepted Adaptive SEO reference unchanged;
- no root `package-lock.json`;
- Theia 1.75.0 and Electron 42.8.1 unchanged.

## Shared correction laws

1. Flow physical truth and extractor evidence remain authoritative; this correction repairs bounded query/presentation semantics.
2. Overview budgets count visible semantic Flow after architecture reduction.
3. Determinism does not mean lexical-ID admission priority.
4. Shared endpoint identity is not architecture-scope ownership.
5. Behavioral anchors survive truncation ahead of interior detail.
6. Equivalent overview interactions collapse only when semantically compatible and retain all origins/evidence.
7. Trace validity is checked by project/generation/focus/identity, not overview membership.
8. Truncation stays honest but default presentation is bounded.
9. Keep hard limits 100 nodes / 200 facts / 32 hops.
10. Keep version exactly `0.6.7`.

## P1 — Query/scope/overview repair

### A. Separate fact focus from endpoint provenance

Refactor the focus helper so endpoint `anchorNodeId` is not used as generic architecture ownership for deciding whether every fact touching that endpoint belongs to a scope.

For a fact:
- code/node -> endpoint: scope comes from the code/node side;
- endpoint -> code/node: scope comes from the code/node side;
- code/node -> code/node: include according to the current focus/context rules for those nodes;
- endpoint-only relationships, if any, require direct evidenced relevance rather than inherited anchor ownership.

Endpoint `anchorNodeId` remains provenance/source-navigation metadata.

Coverage/diagnostic filtering may use the final relevant visible set, but must not reintroduce shared-endpoint scope leakage.

### B. Build semantic overview before applying visible budgets

Keep directional trace traversal over raw proven facts.

For **untraced System overview**:
1. select raw facts fact-relatively relevant to the System;
2. map code participants to their visible Subsystem identity;
3. keep derived endpoints as endpoints;
4. drop same-Subsystem interior implementation interactions from the overview;
5. create compatible semantic aggregate candidates;
6. collapse equivalent candidates;
7. prioritize behavior anchors;
8. apply 100-visible-participant / 200-visible-interaction bounds;
9. return explicit truncation/frontier metadata.

The returned overview should not require hidden raw origins to consume the visible budget. Aggregate origins/evidence retain inspectability.

For **Subsystem overview**:
- map to Components when real Components exist;
- when Components do not exist, bounded code detail may remain visible;
- still scope facts fact-relatively;
- still prioritize Inputs/Outputs/state/external boundaries ahead of interior invocation volume;
- preserve truthful truncation.

### C. Explicit deterministic overview priority

Use a stable priority independent from Flow fact ID lexical ordering.

Preferred classes:
1. `receives` / Input anchors;
2. `responds` / Output anchors;
3. `reads`, `writes`, `calls-external`, `publishes`, `consumes`;
4. cross-visible-scope `invokes`;
5. interior implementation `invokes`.

Within a class use deterministic stable tie-breaking.

This ordering is a bounded overview selection policy, not a claim that one interaction kind is more important in physical truth.

Invariant: if the focused scope contains evidenced HTTP Inputs, a truncated overview cannot remove every Input.

### D. Compatible aggregate collapse

Group overview interactions only when these match:
- visible source ID;
- visible target ID;
- interaction kind;
- normalized enrichment kind/label semantics;
- async/retry/error semantics.

The aggregate:
- retains sorted union of `originFlowFactIds`;
- retains sorted union of physical evidence IDs;
- retains compatible enrichment evidence;
- retains compatible behavior evidence;
- gets a deterministic ID from the visible semantic signature, not from first-seen origin.

Do not merge incompatible annotations or kinds.

### E. Projection consumes semantic overview

Adjust `projectFlowMap()` only as needed so System overview consumes query-produced aggregates directly rather than requiring each aggregate's raw origin to be present in `result.facts`.

Trace projections continue to use raw trace facts.

Do not move domain truth into projection code.

### F. Decouple trace request from overview survival

In `PhysicalMapController.refreshFlow()`, when a selected Flow identity and direction exist, issue the directional query based on the retained selected identity/current focus rather than requiring the ID to exist in the just-fetched overview.

Let the existing backend/query generation/project/focus validation fail closed.

Retain race guards for project, generation, mode, focus, trace and disposal.

### G. Bound truncation presentation

Default coverage text should communicate:
- `Coverage: truncated`;
- continuation-point count;
- a short bounded/collapsible preview only if useful.

Do not inline the full `continueFromIds` list.

The underlying query result keeps exact continuation IDs.

## P1 permanent tests

Extend focused tests with:
- >100 raw participant starvation fixture preserving HTTP Input;
- shared-store A/B/C scope fixture with endpoint anchored to the wrong scope;
- compatible aggregate collapse + all origins;
- read/write non-collapse;
- incompatible enrichment/behavior non-collapse;
- direct trace despite overview omission;
- System semantic budget measured after reduction;
- Subsystem boundary priority without Components;
- bounded truncation UI;
- deterministic repeat output.

Retain existing cycle, bounds, generation/project, branch/join, source-inspection and race tests.

## P1 validation

T2:
- `test/unit/software-map-flow-query.test.ts`;
- `test/unit/flow-map-projection.test.ts`;
- `test/unit/physical-map-flow-ui.test.ts`;
- any directly affected Software Map backend/index tests;
- software-map build;
- Theia-extension build;
- browser build if presentation source changes;
- correction prompt validation;
- unchanged-version/no-root-lock;
- `git diff --check`.

No AppImage/native/manual Adaptive SEO replay in P1.

## P2 — Direct qualification and correction closeout

### Fresh specimen

Recreate `/tmp/adaptive-seo-dope-p7` from `/home/jfin/dev/adaptive-seo-dope`.

Record accepted architecture/sMap hashes and source/copy Git status. Do not regenerate or reaccept architecture.

### Required GUI replay

In the actual Dope GUI:
1. open Adaptive SEO Service Flow at System scope;
2. prove a quiet overview with discoverable HTTP Inputs;
3. focus Adaptive Recommendations and prove unrelated shared-store callers do not flood the view solely through PostgreSQL;
4. select GET opportunities;
5. Trace downstream and inspect the continuous evidenced path;
6. Trace upstream from a middle participant where applicable;
7. Clear trace;
8. inspect representative `receives`, `invokes`, `reads` and `responds` edges;
9. open representative edge source;
10. observe the three-read fan-out and response branching;
11. verify truncation summary is truthful and usable;
12. switch Architecture -> Flow -> Architecture preserving focus/selection/source context.

### Restart/isolation

Repeat restart/reanalysis and second-project isolation required by P7. Confirm no persisted Flow authority appears.

### Exact-candidate T3

Because P1 changes query/UI production code, refresh:
- focused Phase 6 tests;
- `npm run check`;
- `npm run test:restart`;
- `npm run codex:phase:validate -- p6`;
- `npm run codex:phase:validate -- c6-flow-overview-priority`;
- Linux AppImage package/inspection/native launch and controlled close;
- exact unchanged `0.6.7` coherence, Theia/Electron/no-root-lock;
- `git diff --check`.

Do not automatically absorb inherited file-search `ENOTDIR`.

### Closeout

Write `docs/tasks/c6-flow-overview-priority/closeout.md` and update this correction README.

Audit:
A. fact-relative scope;
B. semantic-before-budget overview;
C. behavioral anchor priority;
D. aggregate collapse/provenance;
E. trace independence;
F. bounded truncation UX;
G. real Adaptive SEO replay;
H. restart/release/package/native evidence.

If any material gate fails, record Not Green and do not repair in P2.

If Green, route back to Phase 6 qualification: preserve original P7 Not Green evidence, record fresh successful correction evidence, and make P8 eligible only if the current phase workflow explicitly accepts the corrected P7-equivalent replay as the qualification handoff.

## Exit

The correction is Green only on a final unchanged-`0.6.7` candidate that makes the real GET opportunities behavior discoverable, traceable and inspectable without unrelated shared-store scope leakage or hidden overview-budget starvation.
