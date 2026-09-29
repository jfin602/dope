# Correction 4 — sMap Terminology and Workbench Placement

Status: COMPLETE / GREEN — P6 ELIGIBLE AFTER CLOSEOUT HANDOFF
Correction folder: `c4-tweaks`
Required unchanged version: `0.4.5`
Prompt-authoring source: `1032a20e51a1258fcd1dc4a03ba8ba6c80a0435d`
Execution baseline: exact successful Product Phase 4 P5 handoff
Theia: `1.75.0`; Electron: `42.8.1`; Node: 24
Authority: ADR 0008 and current Phase 4 authority

This correction implements the September 29 Software Map terminology/workbench-placement decision discovered during P5 direct use.

It is a mandatory gate between successful P5 and Phase 4 P6 closeout.

## Stack

| Prompt | Version | Work | Model | Browser |
| --- | --- | --- | --- | --- |
| P1 | `0.4.5` unchanged | Clean-break live rename to Software Map/sMap/Physical Map terminology + permanent terminology guard | GPT-6 Sol High | no |
| P2 | `0.4.5` unchanged | Dedicated left Activity Bar/primary-sidebar sMap placement + restart/package/direct browser requalification | GPT-6 Sol High | yes |
| P3 | `0.4.5` unchanged | Evidence-only correction closeout | GPT-6 Sol High | no |

## Entry gate

Do not execute until:
- P5 has completed successfully and is committed as exact `0.4.5`;
- P5 direct GUI evidence is present;
- ADR 0008/current authority is reconciled into the same history;
- intended Git state is clean.

An incomplete P5 checkpoint is not a valid correction baseline.

## Required correction

The live current product must:
- use **Software Map (sMap)** as the architecture feature name;
- use **Physical Map** for implemented/current reality;
- reserve **Planning Map** for Phase 5 proposed/target state;
- remove live `packages/software-model`, `@dope/software-model` and architecture-feature SoftwareModel/PhysicalSoftwareModel naming without compatibility scaffolding;
- keep graph terminology where it describes graph data structures/queries;
- expose sMap through its own **left Activity Bar** button and **left primary-sidebar** inspector;
- stop using the right secondary sidebar as the sMap default;
- preserve the center workspace for editors now and Phase 5 map canvases later;
- retain all Phase 4 deterministic analysis/evidence/query behavior.

Historical prompts/evidence and ADR 0007 historical wording are not cosmetic rename targets.

## Execution

Validate:

`npm run codex:phase:validate -- c4-tweaks`

Run implementation prompts:

`npm run codex:phase -- c4-tweaks`

The runner may execute P1. P2 is browser-required and must be completed with direct workbench interaction. P3 is the manual evidence-only correction closeout.

All prompts keep package version exactly `0.4.5`.

## Exit

The correction gate clears only when:
- canonical live sMap terminology is clean and permanently guarded;
- the dedicated sMap Activity Bar contribution defaults to the left primary sidebar;
- no ghost legacy Software Model view/package remains;
- representative Physical Map behavior still works;
- restart/project isolation remain coherent;
- a corrected `0.4.5` package is built/inspected;
- direct browser evidence covers the changed layout;
- no Phase 5 visual-map or AI scope was pulled forward.

Green/qualified decision: `docs/tasks/c4-tweaks/closeout.md` at corrected P2 candidate `a4bf000da5d4989599e592dba1b0f955bb364e38`. After the runner commits this closeout, return to Product Phase 4 P6. P6 must use this exact correction closeout as its predecessor gate and retain P5 direct evidence for underlying Physical Map behavior; this correction does not close Phase 4.
