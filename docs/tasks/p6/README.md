# Product Phase 6 — Flow Task Stack

Status: **P7 NOT GREEN / P8 BLOCKED / c6-flow-overview-priority ACTIVE**
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

P1-P6 are implemented. P7 ran on `0.6.7` and is Not Green; P8 is not eligible.

Direct analyzer evidence proved a real GET opportunities behavior, but System/Subsystem Flow overviews truncated before the HTTP Input appeared and shared PostgreSQL endpoint anchoring admitted unrelated focused-scope facts.

Active correction:

`docs/tasks/c6-flow-overview-priority/`

The correction keeps version `0.6.7` unchanged. Its single manual GPT-6 Sol High one-off prompt is `docs/tasks/c6-flow-overview-priority/one-off-flow-overview-priority.txt`. A successful correction must preserve the original P7 Not Green record, repair overview/query semantics, and directly replay the failed Adaptive SEO behavior before P8 may become eligible.
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
