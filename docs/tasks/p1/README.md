# Product Phase 1 — IDE Alive Task Stack

Status: READY FOR EXECUTION

Phase: 1 — IDE Alive  
Execution folder: `p1`  
Activation baseline: `0.1.0`  
Theia baseline: `1.75.0`

## Stack

- P1 / `0.1.1` — Electron product shell, branding and dark-first default.
- P2 / `0.1.2` — ordinary IDE workflow completeness including integrated tests/preferences/keybindings.
- P3 / `0.1.3` — restoration and user/extension preference persistence.
- P4 / `0.1.4` — fresh-environment Linux package and normal launch.
- P5 / `0.1.5` — direct native Electron Dope-on-Dope dogfooding. **MANUAL GUI HANDOFF**
- P6 / `0.1.6` — evidence-only Phase 1 closeout.

P1-P5 use GPT-6 Sol High. P6 uses GPT-6 Sol Medium.

## Execution

Validate: `npm run codex:phase:validate -- p1`

Run: `npm run codex:phase -- p1`

The runner owns P1-P4 and stops at P5. After successful P5 execution, commit once with exact subject `0.1.5`, leave the repository clean, then resume with `npm run codex:phase -- p1 --closeout`.

## Qualification target

Phase 1 is Green only when the packaged Electron application supports an ordinary development loop on the Dope repository without another IDE. Browser-only evidence is insufficient.

Production Project Mind, Planning and AI remain out of scope.
