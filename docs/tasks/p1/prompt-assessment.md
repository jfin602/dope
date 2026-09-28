# Product Phase 1 Prompt Assessment

Status: READY FOR EXECUTION

Phase: 1 — IDE Alive  
Execution folder: `p1`  
Activation baseline: `0.1.0`  
Parent qualified closeout: `425b89d222e1542815af9e38aaa21a4e5a472cb7`

## Assessment conclusion

Use a compact six-prompt stack:
- P1 — productize the native Electron shell, defaults, branding and dark-first theme behavior.
- P2 — complete ordinary IDE workflows not deeply productized in P0, especially integrated tests, preferences and keybindings.
- P3 — harden restart/restoration and extension/preference persistence.
- P4 — prove fresh-environment Linux packaging and normal launch.
- P5 — one direct native Electron dogfooding/manual GUI qualification on the real Dope repository.
- P6 — evidence-only Phase 1 closeout.

P1-P4 are runner-owned. P5 is the single manual/native GUI handoff. P6 is closeout.

## Current-source findings

The qualified source already contains:
- `apps/electron` and `apps/browser` Theia 1.75 applications;
- shared `@dope/theia-extension`;
- a `WindowTitleService` rebind and shell-size customization;
- P0 Project Mind/Planning spike widgets;
- Dope-owned BUILD/PLAN `WorkspaceMode`;
- theme-token-aware custom CSS with fixed accent colors only for BUILD/PLAN identity;
- packaged plugin path handling in the Electron entrypoint;
- baseline, WorkspaceMode and Note persistence tests;
- 90 bundled VS Code built-in plugins in the qualified package flow.

The current default workbench auto-opens Project Mind and PLAN foregrounds the spike Planning surface. Phase 1 should make unfinished later-phase surfaces non-intrusive rather than promoting them.

The manifests include Problems/markers, debugger, preferences/keymaps and VS Code extension support. They do not currently express a dedicated integrated test-surface dependency, so P2 must inspect the supported Theia 1.75 testing composition before choosing implementation details.

There is no explicit dark/default-theme policy in source yet.

## Stability questions

1. User-visible behavior at risk: startup, layout, theme, workspace restoration, editor behavior, extension loading, testing, SCM, terminal/debugging, packaging and native usability.
2. Product/architecture invariants: Theia remains substrate; Electron is product shell; browser is secondary; Project Mind/Planning remain deferred; preferences are not canonical project-domain state; no AI/provider runtime.
3. Integrated-only evidence: native Electron interaction, theme override persistence, extension persistence and real dogfooding require P5 direct use.
4. Baseline: package `0.1.0`, Theia 1.75.0, Node 24, qualified P0 closeout `425b89d...`.
5. Durable knowledge: Phase 1 evidence files, artifact identity, native dogfooding, coupling changes and closeout.
6. UI/framework canonical-state risk: theme/layout/widget/test/extension UI state remains presentation/preferences state.
7. Provider/model coupling risk: none belongs in Phase 1.

## Model routing

- P1-P5: GPT-6 Sol High
- P6: GPT-6 Sol Medium
- No XHigh is planned.
