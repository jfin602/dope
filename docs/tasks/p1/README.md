# Product Phase 1 — IDE Alive Task Stack

Status: P6 CLOSED — PHASE 1 NOT QUALIFIED; P5 NOT GREEN

Phase: 1 — IDE Alive  
Execution folder: `p1`  
Activation baseline: `0.1.0`  
Theia baseline: `1.75.0`

## Stack

- P1 / `0.1.1` — Electron product shell, branding and dark-first default.
- P2 / `0.1.2` — ordinary IDE workflow completeness including integrated tests/preferences/keybindings.
- P3 / `0.1.3` — restoration and user/extension preference persistence.
- P4 / `0.1.4` — fresh-environment Linux package and normal launch.
- P5 / `0.1.5` — interactive Theia GUI Dope-on-Dope dogfooding (browser-hosted workbench or Electron). **MANUAL GUI HANDOFF**
- P6 / `0.1.6` — evidence-only Phase 1 closeout.

P1-P5 use GPT-6 Sol High. P6 uses GPT-6 Sol Medium.

## Execution

Validate: `npm run codex:phase:validate -- p1`

Run: `npm run codex:phase -- p1`

The runner owns P1-P4 and stops at P5. Normally a successful P5 produces the exact-subject `0.1.5` handoff. On September 28, 2026 the owner authorized P6 despite incomplete P5 qualification. The `0.1.5` marker records that owner-waived handoff from checkpoint `0ad3a75caf203857002481874aabe82d7d9e2f1c`, not Green evidence. P6's evidence-only result is **Not Qualified**; Phase 2 remains blocked. See `closeout.md` and `P5-native-dogfooding-evidence.md`. Next: correct and requalify the P5 interactive gaps before any Green claim.

## Qualification target

Phase 1 is Green only when P4 proves the packaged Electron application/build/native-launch path and P5 proves the ordinary development loop interactively in the real Theia GUI on the Dope repository. The P5 GUI may be browser-hosted or Electron; headless/CDP-only evidence is insufficient.

Production Project Mind, Planning and AI remain out of scope.
