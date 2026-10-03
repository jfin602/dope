# Product Phase 6 — Flow Task Stack

Status: **P7 NOT GREEN / P8 BLOCKED / c6-flow-projection-contract ACTIVE**
Activation baseline: `710edb362f9881ab41215705db4f08d8daca6293`
Package baseline: `0.6.0`
Authority: ADR 0020 as amended by ADR 0021, Phase 6 activation/plan

## Approved decomposition

| Prompt | Version | Boundary | Tier | Model | GUI |
| --- | --- | --- | --- | --- | --- |
| P1 | `0.6.1` | physical Flow domain/evidence contracts | T1 | GPT-6 Sol High | no |
| P2 | `0.6.2` | generic TypeScript deterministic invocation Flow | T1 | GPT-6 Sol High | no |
| P3 | `0.6.3` | Adaptive SEO HTTP/persistence/external boundary extraction | T2 | GPT-6 Sol High | no |
| P4 | `0.6.4` | bounded Flow query/aggregation/generation guards | T2 | GPT-6 Sol High | no |
| P5 | `0.6.5` | directional Flow projection/layout | T1 | GPT-6 Sol High | no |
| P6 | `0.6.6` | Architecture/Flow UI + provenance/source navigation | T2 | GPT-6 Sol High | no |
| P7 | `0.6.7` | Adaptive SEO direct Flow qualification + release evidence | T3 | GPT-6 Sol High | yes |
| P8 | `0.6.8` | evidence-only closeout | T3 audit | GPT-6 Sol Medium | no |

## Current gate

P1-P6 are implemented. P7 remains Not Green on `0.6.7`; P8 is not eligible.

The retained evidence chain is:

1. Original P7 proved the real GET opportunities Flow facts existed, but overview budgeting/scope prevented the GUI from exposing the behavior.
2. `c6-flow-overview-priority` repaired the overview/query semantics and a later GUI replay exposed the intended HTTP Input -> handler -> `AdaptiveRepository.list` -> three PostgreSQL reads -> response branches.
3. `c6-map-canvas-priority` implemented the canvas-first shell, compact toolbar and floating inspection overlay, but its P3 replay at `d4f17c7338196aaf78f5851dce42622527c166e4` was Not Green.
4. That P3 failure is now isolated to the presentation projection boundary: overview queries publish visible relationships in `FlowQueryResult.aggregates`, while `projectFlowMap()` still begins from raw `facts`. Adaptive Recommendations therefore reported 27 summarized relationships in inspection while rendering 0 canvas participants / 0 edges.

The active correction is:

`docs/tasks/c6-flow-projection-contract/`

It keeps version `0.6.7` unchanged and repairs only the query-result -> canvas relationship-selection contract plus the stale backend overview assertion. System/SubSystem overview must project `aggregates`; detail/trace must project raw `facts`.

The historical `c6-map-canvas-priority/closeout.md` remains Not Green evidence. If the projection correction and focused supplemental GUI replay are Green, map-canvas may close Green by supplemental evidence and Phase 6 returns to a fresh P7 requalification.

The packaged AppImage controlled-shutdown failure remains a separate unresolved P7 blocker and is outside the projection correction.

## Locked truth rules

```text
import != invocation
reference != invocation
dependency != execution flow
```

A deterministically resolved invocation is valid Flow evidence even when payload semantics are unknown.

Data/type/schema/event annotations require separate evidence.

## Prompt files

- `P1-flow-contracts.txt`
- `P2-typescript-invocation-flow.txt`
- `P3-adaptive-seo-boundaries.txt`
- `P4-flow-query-aggregation.txt`
- `P5-flow-projection-layout.txt`
- `P6-flow-ui-integration.txt`
- `P7-flow-dogfooding.txt`
- `P8-flow-closeout.txt`
