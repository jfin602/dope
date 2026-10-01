# Product Phase 5 — Visual Software Planning Task Stack

Status: READY FOR EXECUTION
Activation source/package baseline: `016bd8780e89081dfdb5746eae981183dc945baa`, root `0.5.0`
Theia: `1.75.0`; Electron: `42.8.1`; React: `19.2.8`; Node: 24
Authority: Phase 5 activation/plan, resolved visual workflow worksheet, ADR 0017

## Stack

| Prompt | Version | Boundary | Tier | Model | GUI |
| --- | --- | --- | --- | --- | --- |
| P1 | `0.5.1` | visual-planning domain core | T1 | GPT-6 Sol High | no |
| P2 | `0.5.2` | planning persistence/service/backend | T2 | GPT-6 Sol High | no |
| P3 | `0.5.3` | center Physical Map canvas | T1/T2 | GPT-6 Sol High | no |
| P4 | `0.5.4` | semantic navigation + focused tabs | T1/T2 | GPT-6 Sol High | no |
| P5 | `0.5.5` | Planning Map overlay/lifecycle/branching | T2 | GPT-6 Sol High | no |
| P6 | `0.5.6` | typed visual transformations + undo/redo | T1/T2 | GPT-6 Sol High | no |
| P7 | `0.5.7` | WorkItems + work projection | T2 | GPT-6 Sol High | no |
| P8 | `0.5.8` | bounded Adopt Target | T2 | GPT-6 Sol High | no |
| P9 | `0.5.9` | localized stale state + explicit rebase | T2 | GPT-6 Sol High | no |
| P10 | `0.5.10` | reconciliation + explicit map closeout | T2 | GPT-6 Sol High | no |
| P11 | `0.5.11` | direct visual dogfood/restart/package qualification | T3 | GPT-6 Sol High | yes |
| P12 | `0.5.12` | evidence-only closeout | T3 | GPT-6 Sol Medium | no |

## Execution

Validate first:

`npm run codex:phase:validate -- p5`

Run implementation prompts:

`npm run codex:phase -- p5 --closeout`

The runner owns P1-P10 commits and stops for P11 because direct browser GUI evidence is required. After P11 is completed and committed, resume P12 closeout from the exact qualified candidate.

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
