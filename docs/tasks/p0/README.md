# Foundation Spike 0 Task Stack

Status: COMPLETE / GREEN — Foundation Spike 0 substrate qualified; bounded Evidence Gaps in `closeout.md`

Phase: 0 — Theia substrate qualification  
Execution folder: `p0`  
Original baseline package: `0.0.0`  
Final P5 committed candidate: `6624e146683b6cbfe507325438f2edf19fe20d97` (`0.0.5`)
P6 closeout package: `0.0.6` (runner-owned commit pending)

## Stack

- P1 / `0.0.1` — Theia 1.75 browser + Electron application foundation. **COMPLETED**
- P2 / `0.0.2` — Dope workbench surfaces, BUILD/PLAN, branding and customization stress. **COMPLETED**
- P3 / `0.0.3` — typed backend + minimal Project Mind persistence. **COMPLETED**
- P4 / `0.0.4` — Foundation IDE GUI/tooling/extension/restart qualification. **COMPLETED**
- P5 / `0.0.5` — Linux Electron package/build/launch smoke. **COMPLETED**
- P6 / `0.0.6` — evidence-only Foundation Spike closeout. **COMPLETE; COMMIT RUNNER-OWNED**

P1-P5 use GPT-6 Sol High. P6 uses GPT-6 Sol Medium.

## Execution

Validate grammar:

`npm run codex:phase:validate -- p0`

P1-P5 are in Git history. The phase runner owns the P6 implementation commit; see `closeout.md` for executed evidence and remaining gaps.

## Qualification target

The stack proves or rejects:
- serious IDE basics;
- custom Dope UI/layout;
- typed frontend/backend seams;
- minimal Dope-owned persistence;
- restart restoration;
- customization/rebinding without broad private coupling;
- VS Code/Open VSX tooling compatibility;
- viable Linux Electron packaging/launch.

It explicitly does not qualify AI or perform a synthetic Theia upgrade.

Next required action: post-spike `/docs-review`, followed only after approval by Phase 1 activation at package baseline `0.1.0`. No Phase 1 implementation is approved by this closeout.
