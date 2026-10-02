# Product Phase 6 — Data Flow Task Stack

Status: **PLANNED / PROMPTS NOT YET WRITTEN**
Activation baseline: `710edb362f9881ab41215705db4f08d8daca6293`
Package baseline: `0.6.0`
Authority: ADR 0020, Phase 6 activation/plan

## Approved decomposition

| Prompt | Version | Boundary | Tier | Model | GUI |
| --- | --- | --- | --- | --- | --- |
| P1 | `0.6.1` | physical-flow domain/evidence contracts | T1 | GPT-6 Sol High | no |
| P2 | `0.6.2` | generic TypeScript call flow | T1 | GPT-6 Sol High | no |
| P3 | `0.6.3` | supported Adaptive SEO boundary extractors | T2 | GPT-6 Sol High | no |
| P4 | `0.6.4` | bounded flow query/aggregation/generation guards | T2 | GPT-6 Sol High | no |
| P5 | `0.6.5` | directional projection/layout | T1 | GPT-6 Sol High | no |
| P6 | `0.6.6` | Architecture/Data Flow UI + provenance/source navigation | T2 | GPT-6 Sol High | no |
| P7 | `0.6.7` | Adaptive SEO direct qualification + release evidence | T3 | GPT-6 Sol High | yes |
| P8 | `0.6.8` | evidence-only closeout | T3 audit | GPT-6 Sol Medium | no |

## Current action

Run `/prompt-ass + /prompt-plan + /prompt-write p6` to turn this approved decomposition into executable prompts.

No implementation prompt is authorized merely by this README; validate the written stack before execution.

## Locked truth rule

`imports`, `references` and architecture dependency edges are not Data Flow evidence by themselves. Every Data Flow hop must retain dedicated deterministic or recorded-runtime evidence.
