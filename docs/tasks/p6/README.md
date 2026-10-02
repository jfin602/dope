# Product Phase 6 — Flow Task Stack

Status: **P7 NOT GREEN / P8 BLOCKED / c6-map-canvas-priority ACTIVE**
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

The original P7 run proved valid source-backed GET opportunities Flow but failed because the bounded System/Subsystem overview omitted the HTTP Input and leaked unrelated calls through shared PostgreSQL endpoint anchoring. That failure remains preserved in `P7-flow-dogfooding-evidence.md`.

Correction `c6-flow-overview-priority` repaired the overview/query path sufficiently for the subsequent direct GUI requalification to expose the intended behavior: GET opportunities traced from the HTTP Input through the handler and `AdaptiveRepository.list` to three PostgreSQL reads and three response branches, with representative source evidence and explicit partial coverage. The same 5-participant, 8-interaction trace rebuilt after restart.

That requalification is still Not Green for two separate reasons:
- the focused Subsystem canvas is too dim to read immediately;
- the packaged AppImage reaches ready state but fails controlled shutdown.

The active presentation correction is:

`docs/tasks/c6-map-canvas-priority/`

It keeps version `0.6.7` unchanged and is narrowly responsible for the canvas-first map shell, unified icon toolbar, floating/minimizable selection details and immediate map readability. It must not change Flow truth, query semantics, extraction, aggregation, budgets, canonical architecture or Planning Map semantics.

The native controlled-shutdown failure is outside this presentation correction and remains an independent P7 blocker that must be resolved or separately requalified before P8.

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
