# Foundation Spike 0 Task Stack

Status: READY FOR EXECUTION

Phase: 0 — Theia substrate qualification  
Execution folder: `p0`  
Baseline package: `0.0.0`  
Baseline main: `e90164da659b21a3d24e87b7ce3ff2a7f995cace`

Current authority:
- `BOOT.md`
- `AGENTS.md`
- `docs/THEIA-SPIKE.md`
- `docs/ARCHITECTURE.md`
- `docs/stability-contract.md`
- `docs/planning/foundation-spike-0/decision-record.md`
- `docs/planning/foundation-spike-0/qualification-plan.md`
- `docs/tasks/p0/prompt-assessment.md`
- `docs/tasks/p0/implementation-plan.md`

## Stack

- P1 / `0.0.1` — Theia 1.75 browser + Electron application foundation and commodity IDE composition.
- P2 / `0.0.2` — Dope workbench surfaces, BUILD/PLAN boundary, branding, customization stress and coupling ledger.
- P3 / `0.0.3` — typed backend plus minimal Dope-owned Project Mind persistence and restart reconstruction.
- P4 / `0.0.4` — baseline GUI/tooling/extension/restart qualification on Theia 1.75.
- P5 / `0.0.5` — Linux package and packaged desktop qualification.
- P6 / `0.0.6` — Theia 1.75 -> 1.76 upgrade and bounded repair ledger.
- P7 / `0.0.7` — upgraded GUI/package qualification and final gate matrix.
- P8 / `0.0.8` — evidence-only Foundation Spike closeout.

P1-P7 use GPT-6 Sol High. P8 uses GPT-6 Sol Medium.

Browser/GUI handoffs:
- P4
- P5
- P7

## Execution

Validate grammar:

`npm run codex:phase:validate -- p0`

Run until each manual browser gate:

`npm run codex:phase -- p0`

After a browser-required prompt is completed manually, commit exactly once with that prompt's version as the commit subject and leave the tree clean, then rerun the normal phase runner to resume.

After P7 is committed, either run P8 manually or:

`npm run codex:phase -- p0 --closeout`

The runner owns staging/commits for non-browser prompts.

## Qualification target

The stack proves or rejects:
- serious IDE basics;
- custom Dope UI/layout;
- typed frontend/backend seams;
- minimal Dope-owned persistence;
- restart restoration;
- customization/rebinding without broad private coupling;
- VS Code/Open VSX tooling compatibility;
- Linux Electron packaging;
- one real Theia upgrade.

It explicitly does not qualify AI.
