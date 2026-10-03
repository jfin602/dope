# Correction 6 — Flow Projection Contract

Status: **APPROVED / MANUAL ONE-OFF READY**
Correction folder: `c6-flow-projection-contract`
Required unchanged version: `0.6.7`
Activation source: `0cd080b12a71f67a78ae53ea3d3da8523894454c`
Phase context: `c6-map-canvas-priority` P3 Not Green / Product Phase 6 P7 Not Green / P8 blocked
Authority: current Phase 6 plan, Flow query contracts, `docs/tasks/c6-map-canvas-priority/closeout.md`, and the retained P7 evidence chain

## Purpose

Repair the bounded query-result -> canvas projection mismatch proven by the map-canvas P3 replay.

The query layer already exposes the correct semantic relationship set:
- System/SubSystem overview relationships in `FlowQueryResult.aggregates`;
- detail/trace relationships in `FlowQueryResult.facts`;
- semantic level in `FlowQueryResult.projectionLevel`.

The current projector still begins from `result.facts`, so an aggregate-only overview can truthfully report summarized relationships while rendering no Flow edges.

## Proven failure

On candidate `d4f17c7338196aaf78f5851dce42622527c166e4`:

- Adaptive SEO Service inspection reported 31 summarized relationships while the canvas rendered 0 edges;
- Adaptive Recommendations inspection reported 27 summarized relationships while the canvas rendered 0 participants / 0 edges;
- the focused projection regression reproduced an aggregate-only overview returning no canvas edges;
- `software-map-index-backend.test.ts` still expected an overview `invokes` relationship in `facts`, which is stale under the current overview contract.

The original map-canvas P3 Not Green closeout remains historical evidence.

## Locked correction law

The query layer decides **which relationships are visible**.

The projector decides **how those relationships are laid out**.

Use `projectionLevel` as the authoritative presentation contract:

```text
system overview    -> project aggregates
subsystem overview -> project aggregates
detail / trace     -> project facts
```

Do not re-run semantic aggregation inside `projectFlowMap()`.

Do not require raw overview origin facts to remain in `result.facts` merely so the projector can discover the already-produced aggregates.

## Provenance and trace requirements

Overview aggregate edges must preserve and expose:
- `originFlowFactIds`;
- `originParticipants`;
- `projectionVariants`;
- evidence IDs;
- compatible enrichment;
- compatible async/retry/error metadata.

Trace emphasis must continue to recognize raw traced fact IDs contained by an aggregate's `originFlowFactIds`.

When a directional/detail result is returned, the canvas must render raw `facts`, not substitute overview aggregates.

A true empty Flow result remains empty; the projector must not fabricate participants or edges.

## Scope guard

Do not change:
- TypeScript Flow extraction;
- Express/PostgreSQL/external boundary extraction;
- overview aggregation policy;
- Flow hard limits;
- endpoint grouping semantics;
- `FlowProjectionRelationship` meaning;
- canonical architecture or accepted Adaptive SEO `.dope/` state;
- map toolbar/overlay architecture except where required to consume the repaired projection;
- Planning Map domain semantics;
- Flow persistence;
- Phase 7 AI scope;
- package version;
- the packaged AppImage controlled-shutdown defect.

The existing `projectionLevel` field is sufficient. Do not add another DTO field merely for this correction.

## Permanent regression requirements

Cover at least:

1. aggregate-only System overview renders participants/edges;
2. aggregate-only Subsystem overview renders participants/edges;
3. detail trace renders raw facts instead of aggregates;
4. raw trace IDs activate matching aggregate edges through `originFlowFactIds`;
5. aggregate origins/participants/variants/enrichment/behavior survive projection;
6. true empty Flow remains empty;
7. backend overview assertions use `aggregates`, while detail/trace assertions continue to use `facts`;
8. identical inputs remain deterministic.

## Execution

This correction is deliberately one manual one-off prompt:

`one-off-flow-projection-contract.txt`

Use **GPT-6 Sol High** with browser/manual capability. Do not run this correction through `codex:phase`.

The one-off performs:
- the bounded projector repair;
- focused permanent regression updates;
- correction of the stale backend assertion;
- focused validation;
- `npm run check`;
- a fresh replay of the blocked map-canvas P3 Flow checks on a disposable Adaptive SEO workspace;
- correction closeout.

## GUI replay boundary

Do not repeat already-passed map-canvas evidence unnecessarily.

After automated Green, directly recheck:
- Adaptive Recommendations overview actually renders its summarized Flow;
- GET opportunities Input discovery and downstream/upstream/clear trace;
- handler -> `AdaptiveRepository.list` -> three PostgreSQL reads -> response branches;
- focused Flow readability;
- Flow edge evidence/source inspection in the floating overlay;
- expanded/compact/minimized overlay state while a real Flow selection/trace exists;
- alternate-theme Flow readability;
- short Architecture/Planning shell smoke regression.

## Exit

Green requires:
- focused projection/backend tests Green;
- `npm run check` Green;
- aggregate-only overview visible in the real GUI;
- the required GET opportunities behavior replayed continuously;
- Flow readability and edge inspection directly observable;
- map-canvas overlay behavior still stable with real Flow content;
- package still exactly `0.6.7`.

If Green:
- close this correction Green;
- add supplemental successful replay evidence to the map-canvas correction without rewriting its original Not Green closeout;
- mark `c6-map-canvas-priority` Green by supplemental evidence;
- route to a fresh Phase 6 P7 requalification;
- keep P8 blocked until P7 itself is Green.

The packaged AppImage controlled-shutdown failure remains a separate P7 blocker.
