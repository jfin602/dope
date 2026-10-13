# Product Phase 5 — Visual Software Planning Task Stack

Status: **OWNER-CLOSED FOR SEQUENCING — P11 REMAINS NOT GREEN; P12 UNEXECUTED**
Activation source/package baseline: `016bd8780e89081dfdb5746eae981183dc945baa`, root `0.5.0`
Theia: `1.75.0`; Electron: `42.8.1`; React: `19.2.8`; Node: 24
Authority: Phase 5 activation/plan, resolved visual workflow worksheet, ADR 0017

## Stack

| Prompt | Version | Boundary | Tier | Model | GUI |
| --- | --- | --- | --- | --- | --- |
| P1 | `0.5.1` | visual-planning domain core | T1 | GPT-6 Sol High | no |
| P2 | `0.5.2` | planning persistence/service/backend | T2 | GPT-6 Sol High | no |
| P3 | `0.5.3` | center Physical Map canvas | T1 | GPT-6 Sol High | no |
| P4 | `0.5.4` | semantic navigation + focused tabs | T1 | GPT-6 Sol High | no |
| P5 | `0.5.5` | Planning Map overlay/lifecycle/branching | T2 | GPT-6 Sol High | no |
| P6 | `0.5.6` | typed visual transformations + undo/redo | T1 | GPT-6 Sol High | no |
| P7 | `0.5.7` | WorkItems + work projection | T1 | GPT-6 Sol High | no |
| P8 | `0.5.8` | bounded Adopt Target | T2 | GPT-6 Sol High | no |
| P9 | `0.5.9` | localized stale state + explicit rebase | T2 | GPT-6 Sol High | no |
| P10 | `0.5.10` | reconciliation + explicit map completion | T2 | GPT-6 Sol High | no |
| P11 | `0.5.11` | mapped Adaptive SEO GUI loop; Dope host/restart/package qualification | T3 | GPT-6 Sol High | yes |
| P12 | `0.5.12` | evidence-only closeout | T3 | GPT-6 Sol Medium | no |

## Execution

Validate first:

`npm run codex:phase:validate -- p5`

Run implementation prompts:

`npm run codex:phase -- p5 --closeout`

The runner owns P1-P10 commits and stops for P11 because direct browser GUI evidence is required. Historical execution routing is retained below for audit. The owner closeout supersedes further P11/P12 execution for sequencing; P12 was not run.

## Owner closeout disposition — 2026-10-02

The owner explicitly closed Product Phase 5 for sequencing from the retained `0.5.11` implementation despite P11 remaining Not Green and P12 never executing.

This is a sequencing waiver, not retroactive qualification. The P11 evidence file remains authoritative for the failed/interrupted qualification attempts, including the final interrupted clean replay. All c5 fixes and readability work remain retained implementation.

Routing:

`Phase 5 owner-close -> coherent 0.6.0 successor baseline -> Phase 6 Data Flow planning`

Do not relabel P11/P12 Green. Any retained Phase 5 gap is revisited only when it materially blocks Phase 6 or later qualification.
## Product boundary

Phase 5 proves the human-driven loop:

```text
Physical Map
-> Planning Map
-> PlannedTransformations
-> WorkItems
-> ordinary implementation
-> re-analysis
-> reconciliation
```

No general AI Presence, Agent Mind, ProposedAction, model-driven implementation, mutation authority or delegation belongs in this stack.

## Canvas substrate

Use `@xyflow/react@12.11.6` inside `@dope/theia-extension` presentation only. Dope-owned planning/architecture semantics remain independent from React Flow.

Do not add an automatic layout engine in this stack unless direct evidence during execution proves the deterministic architecture-first layout inadequate and the owner approves a bounded correction.

## Records

Planning:
- `prompt-assessment.md`
- `implementation-plan.md`

P11:
- `P11-visual-planning-dogfooding-evidence.md`

P12:
- `closeout.md`
