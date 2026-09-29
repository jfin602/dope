# Correction 3 — Remove Phase 3 Planning Instruments

Status: READY FOR EXECUTION
Correction folder: `c3-remove-planning-instruments`
Baseline: `68a51e78233f0a81bf295fb06e591fb508149bf0`
Required unchanged version: `0.3.6`
Theia: `1.75.0`; Electron: `42.8.1`; Node: 24

This correction is the mandatory gate between the qualified historical Phase 3 Planning implementation and Product Phase 4 — Physical Software Model.

It intentionally removes the live Phase 3 Planning subsystem rather than preserving compatibility.

## Stack

| Prompt | Version | Work | Model | Browser |
| --- | --- | --- | --- | --- |
| P1 | `0.3.6` unchanged | Atomic removal of Planning domain/runtime/UI/PLAN mode/data/test/build wiring | GPT-6 Sol High | no |
| P2 | `0.3.6` unchanged | Negative guards + surviving Project Mind/IDE/restart/package/direct browser qualification | GPT-6 Sol High | yes |
| P3 | `0.3.6` unchanged | Evidence-only correction closeout | GPT-6 Sol High | no |

## Required removal

The correction removes the current:
- `@dope/planning` package;
- Plan/PlanStep/Task Planning contracts and RPC;
- Planning persistence/backend;
- Planning controller/widget/view/menu/commands;
- Project Mind Planning bridges;
- BUILD/PLAN workspace mode and PLAN-specific presentation;
- Planning-specific tests/restart coverage;
- tracked `.dope/planning.json`;
- live Planning storage guide.

Historical `docs/planning/p3/**`, `docs/tasks/p3/**` and Git history remain.

## Execution

Validate:

`npm run codex:phase:validate -- c3-remove-planning-instruments`

Run implementation prompts:

`npm run codex:phase -- c3-remove-planning-instruments`

The runner can execute P1. P2 is browser-required and must be completed with the actual browser-capable workbench qualification in its prompt. P3 is the manual final correction closeout.

Correction prompts must leave package version `0.3.6` unchanged.

## Exit

The gate clears only when:
- current production/package wiring contains no Phase 3 Planning subsystem;
- the permanent negative guard prevents accidental resurrection;
- Project Mind and ordinary IDE behavior remain usable;
- surviving aggregate/restart/build/package checks pass;
- historical Phase 3 evidence remains intact.

After closeout, run post-correction `/docs-review` before Product Phase 4 activation.
