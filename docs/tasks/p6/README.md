# Product Phase 6 — Flow Task Stack

Status: **PROMPTS WRITTEN / READY FOR VALIDATION + EXECUTION**
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

## Executable stack

Prompt assessment, implementation planning and P1-P8 prompt writing are complete.

Validate before execution:

`npm run codex:phase:validate -- p6`

Then run:

`npm run codex:phase -- p6`

or implementation plus closeout:

`npm run codex:phase -- p6 --closeout`

P7 is the browser/manual handoff. P8 is evidence-only closeout.

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
