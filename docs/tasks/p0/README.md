# Foundation Spike 0 Task Stack

Status: IN EXECUTION — P1-P3 COMPLETE / P4 NEXT

Phase: 0 — Theia substrate qualification  
Execution folder: `p0`  
Original baseline package: `0.0.0`  
Current committed package: `0.0.3`  
Current main at scope revision: `2e6efe76284611aa5c459a2b816daff8e4b9f93f`

## Stack

- P1 / `0.0.1` — Theia 1.75 browser + Electron application foundation. **COMPLETED**
- P2 / `0.0.2` — Dope workbench surfaces, BUILD/PLAN, branding and customization stress. **COMPLETED**
- P3 / `0.0.3` — typed backend + minimal Project Mind persistence. **COMPLETED**
- P4 / `0.0.4` — Foundation IDE GUI/tooling/extension/restart qualification. **NEXT / GUI HANDOFF**
- P5 / `0.0.5` — Linux Electron package/build/launch smoke. **RUNNER-OWNED**
- P6 / `0.0.6` — evidence-only Foundation Spike closeout.

P1-P5 use GPT-6 Sol High. P6 uses GPT-6 Sol Medium.

## Execution

Validate grammar:

`npm run codex:phase:validate -- p0`

The runner will detect P1-P3 from Git history and package `0.0.3`, then stop at P4:

`npm run codex:phase -- p0`

Run P4 in the GUI/browser-capable Codex environment. After successful completion:
- commit once with exact subject `0.0.4`;
- leave the tree clean.

Then resume:

`npm run codex:phase -- p0`

The runner owns P5 and will stop before the final closeout.

Run closeout when ready:

`npm run codex:phase -- p0 --closeout`

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

If P6 qualifies the substrate, the next required action is post-spike `/docs-review`, followed by Phase 1 activation at package baseline `0.1.0`.
