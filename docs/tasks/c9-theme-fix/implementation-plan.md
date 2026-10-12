# /prompt-plan — c9-theme-fix

**Status:** SOURCE-INSPECTED / PLANNED / TASKS WRITTEN / EXECUTION PENDING
**Date:** 2026-10-12
**Inspected baseline:** `e11b72fe35f86f1700861101184760b80254c659` source at `0.9.23`; ADR/workflow updates `6e76285616eb73e9d65ee2e56cb16ef5b6bd9d83`.
**Authority:** ADR 0016 October 12 amendment + ADR 0030. See `prompt-assessment.md`.

## Source and state seams

Theme owner: `packages/theia-extension/src/browser/dope.css` central `.dope-dark` token block and scoped Git/actions rules. Theme registration: `packages/theia-extension/src/browser/dope-theme.ts` and `frontend-module.ts` (read/guard; unchanged unless a demonstrated issue). Test owner: `test/unit/dope-theme.test.ts`, which reads actual source strings and checks both `apps/browser/package.json` and `apps/electron/package.json` default theme config. No domain stores, backend contracts or provider work.

Token consumers: shared `--theia-*` controls, selectors, menus, status bar, editor UI, map/Flow and Chat/Work/AI Center panels. Theia's supported `ThemeService` and `body.dope-dark` isolation are retained. Independent user Chat/map palette and semantic diagnostic colors are untouched. New literal brand hexes reside centrally only.

## P1 — Central restrained-orange theme and regression (T1)

**Expected changed files only:** `dope.css`, `test/unit/dope-theme.test.ts`; inspect directly affected selectors before editing and justify any additional file.

1. Set global Dope Dark references: background `#1F1F1F`; orange primary `#FF7A1A`, hover/highlight `#FFB15C`, deep pressed `#C75100`; neutral controls `#303030` and neutral border `#484848`. Use centrally named tokens for derived values; do not scatter literals.
2. Ensure primary filled controls use a contrast-tested dark foreground, with a separate contrasting pressed foreground as needed. For hover/pressed and selected text, verify accessible contrast against intended backgrounds (target WCAG AA normal text 4.5:1 and nontext visual cues 3:1 where applicable), using honest calculations/inspections. Do not fake a contrast pass based on raw hex alone.
3. Keep `--theia-button-background`, secondary buttons and `--theia-input-border` neutral. Avoid a permanent orange outline on ordinary inputs/rows; keep `focus-visible` sufficiently distinguishable and tab/list/selection low-noise. Review derived menu/list/background, badge and status emphasis so broad color mappings do not flood the interface.
4. Keep neutral full-width status bar and exactly the bounded Git brand segment (with readable foreground); preserve severity/SCM/syntax semantic colors. Preserve map/Flow and ten Chat organizational hues.
5. Keep `dope-dark` registration/default and explicit alternate-theme deactivation exactly as qualified. If a rare scoped selector must be adjusted to prevent orange-washing, modify only central presentation CSS and test that rule.
6. Update the old blue-specific test assertions and forbidden-orange rule to **require** centrally defined restrained orange, neutral utility controls, no duplicate widget brand hexes, theme deactivation, status bar semantic colors, and intended opt-in primary action behavior. Do not remove test coverage to obtain Green.

**T1 gate:** `node --test test/unit/dope-theme.test.ts`, `git diff --check`, unchanged coherent manifest version `0.9.35` and no root `package-lock.json`. CSS/test-only change needs no extension compilation. If a necessary TS seam changes, run the smallest affected extension typecheck/build and explain. No `npm run check`, full build, browser, AppImage or provider calls.

**Boundary:** P1 makes no UI component ownership/layout/domain changes; do not move or change the History/Session/Chat/Work/Map flows.

## P2 — Real GUI qualification and closeout (T3 / manual)

1. Verify exact P1 commit/source fingerprint, unchanged coherent `0.9.35`, intended diff and no unrelated dirty changes; validate stack grammar. Do not treat a theme test as visual evidence.
2. Run `npm run check` **once** on the final coherent candidate. It already exercises `test:baseline` (`dope-theme.test.ts`) and package/browser/Electron build; avoid separately duplicating these checks. Run genuinely missing focused presentation tests only if needed.
3. In real browser-hosted or Electron Theia, sample AI Center, one Chat/Work panel, one Map/Planning panel and ordinary workbench/status chrome strictly for color-token/contrast/alternate-theme leakage. Do **not** conduct the comprehensive Phase 11 usability audit.
4. Verify restrained-orange primary actions, bright hover/deep pressed readable text and subdued neutral secondary controls; subdued yet visible keyboard focus/selected states; no orange-washed input borders, panels, status text, every row or every button. Check contrast and compact layout in narrow panes. Compare computed style or equivalent when practical rather than inferring from source alone.
5. Switch to another compatible theme and verify `body.dope-dark` deactivation and no orange Dope override leakage, then return to Dope Dark. Confirm independent Chat organizational colors, user map colors, semantic error/warning/success/syntax/SCM cues.
6. Preserve project isolation, Chat/Work and map state; do not start destructive/live agents or mutate reference projects to inspect theme. If required surface inaccessible or evidence is missing, record it explicitly.
7. Record exact SHA/version, focused and aggregate outcomes, real screenshots/observations, theme override results, contrast/remaining faults and **GREEN / NOT GREEN** in `docs/tasks/c9-theme-fix/closeout.md`. Update stack README status. Keep historical theme qualification unchanged. A material discovered styling defect yields Not Green and a bounded subsequent correction, not a broad in-gate rewrite. A tiny necessary T3 repair invalidates prior evidence and demands targeted rechecks/reproducible candidate identity.

**No AppImage/native package requirement** for a CSS-only correction unless packaging behavior is changed. P2 is the single final manual closeout; no independent third audit.

## Execution and integration safety

The original c8 blue implementation Green remains historical evidence. Do not rewrite c8 sources, old prompt stacks, or closeouts. p9d is separately activated with fixed per-prompt version increments and must not overlap on one worktree. This correction now targets unchanged `0.9.35`; if a live checkout is newer, retarget both prompts before running. Do not alter Phase 9 source or history to satisfy c9 runner grammar.

## Execution clarification — 2026-10-12 after Phase 9 Green

This originally drafted correction now uses **unchanged version `0.9.35`** (Phase 9 qualified source `af3447c`; GitHub main `adf5c073` theme CSS/test rechecked). Earlier `0.9.23` dates/source claims remain historical planning context, not executable version metadata. The task remains **palette/theme-only**: no every-panel human usability redesign, now separately planned as Phase 11 (ADR 0037). Verify actual checkout source and worktree before mutation.
