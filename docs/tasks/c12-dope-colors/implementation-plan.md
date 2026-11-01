# /prompt-plan — c12-dope-colors

**Plan:** 2026-11-01. **Basis:** [assessment](prompt-assessment.md), [ADR 0043](../../decisions/0043-dope-colors-project-identity.md), unchanged product `0.12.7`; source reviewed on main `2ffa61b6e0ed79e7f9259e866f2b605c3fdfd9b1`. Five bounded runner implementation gates, then one **manual Chrome closeout**. Not executed.

## Dependencies and execution order

| Gate | Work | Acceptance evidence |
| --- | --- | --- |
| P1 | Introduce immutable curated palette seed/derived tone helper, scoped `dope-dark` CSS variables and responsive semantic separation | Unit tests for every palette/tone, semantic Roadmap status constants, no cross-theme Dope accent fallback |
| P2 | Implement one validated local preference/controller seam (global + per-project) and active theme/project resolver | Race/late-load, stable identity/fallback, sync between windows, versioned persistence, no canonical writes |
| P3 | Add skippable first eligible Dope Dark appearance choice and global settings entry using existing workbench UI | Nonblocking/dismiss/persist, keyboard, theme gate, default orange, no alternate-theme mutation |
| P4 | Add optional per-project chooser on open/create, project settings Inherit/override/reset, restrained window cue | Two different windows, same-project propagation, switching, non-color names, no OS-titlebar fiction |
| P5 | Exercise complete deterministic matrix, repair narrow source-specific defects, run relevant builds | Eight palettes, WCAG AA, semantic isolation, multiwindow/reload, alternate theme switch and no leakage |
| P6 | Manual connected Codex Chrome and separately owner-native Electron result | Real two-window interactions/screenshots and negative theme tests, exact-source closeout PASS/FAIL/GAP |

## P1 — centralized theme and status separation (T1)

Inspect `dope-theme.ts`, `dope.css`, `frontend-module.ts`, `test/unit/dope-theme.test.ts` and Roadmap status projection/styling. Add a central curated named-palette/tone layer with stable IDs, validated values, derived contrast-tested foreground/hover/pressed/focus/selection. Preserve `#FF7A1A` orange default and neutral `#1F1F1F` workbench. Map only intentional action/selection tokens; no new complete theme. Independent status variables must not depend on chosen accent (currently `--dope-roadmap-planned` and `--dope-roadmap-active` use `--dope-deep`/`--dope-highlight`). Fix any alternate-theme literal fallback that would still inject Dope Orange. Update existing exact-hex tests rather than deleting them; assert semantic and contrast invariants. P1 does **not** add preferences or visible setup UI.

## P2 — persisted preference authority and window lifecycle (T1)

Create a minimal frontend presentation controller/service, reusing Theia's supported theme/preferences APIs and existing validated project identity. Global user-default persists once; per-project choice is a user-local override keyed by stable project identity, with schema validation and `inherit` represented as no override. Avoid canonical `.dope/` writes, path-only durability, phantom initialization, model calls or a standalone settings server. Implement a narrowly documented uninitialized/missing-ID fallback to global until safely reconciled. Subscribe to theme/workspace/identity and preference changes; late reads cannot repaint a newly attached project or inactive theme. Implement cross-window refresh/notify with the actual supported API and tests; do not claim `StorageService` sync without evidence. Inactive non-`dope-dark` theme clears token overrides; retained choices restore upon reactivation. P2 UI is absent; expose a tested controller API for P3/P4.

## P3 — global first eligible experience (T2)

Use existing Theia/Dope workbench presentation and settings entrypoints, not a second UI shell. Prompt once on first eligible Dope Dark use (orange selected; Skip available), never gate opening editor/files or trigger on other themes. Present curated swatches with labels, keyboard/focus screenreader semantics and a non-color selection mark. Provide discoverable Dope Appearance in existing settings/menu, reading/writing P2. On non-Dope themes, controls hidden or disabled with "Requires Dope Dark"; no forced switch or stored-preference erasure. Qualify dismiss/reopen/persistence and no startup flash. Do not add project UI here.

## P4 — optional project selection and per-window cue (T2)

At existing project creation/open UX make color choice optional/nonblocking and provide a project appearance action in the existing workbench. Offer Inherit Global and explicit curated presets, reflecting current global and resolved override, with immediate preview only in owning Dope Dark window. Add compact colored identity marker near real project name in the existing Dope-owned workbench/title/header region; optionally a restrained border/accent stripe if it does not repaint Theia/OS titlebar. Do not auto recolor every tab/panel or break docking, menus, editor or status bar. Project switching and no-project state remove stale identity; multiple project windows show distinct colors; same-project windows synchronize preference changes. Non-Dope themes show **zero** new cue/override.

## P5 — deterministic integration and regression (T2)

On exact P1-P4 source, run focused `dope-theme`/new color preference/UI tests, `smap-presentation-state` and Roadmap status relevant tests. Exercise an 8x token matrix (base/hover/pressed/on-color/select/focus) with tested AA computed-style or equivalent, double-window different/same project, global change inherited vs overridden, clear/reset, restore, theme off/on, theme changed mid-load, corrupt store, uninitialized ID, project root move/rename/reopen and no canonical writes. Preserve clear selected/focus labels and keyboard. Run `git diff --check`, affected typecheck and browser/Electron builds; run one final `npm run check` if coherent and within bounded gate, report whether skipped if time/safety. Scope only minimal fixes that emerge; stop for substantive architectural work rather than silently growing scope. No headless unit test earns live GUI Green.

## P6 — manual real UI qualification (T3)

With owner-approved execution complete and a source fingerprint, operate actual Chrome through Codex connected browser (not generic screenshots or simulated widget). In disposable multi-project workbench, show first-run/global settings, two windows project identifiers, inheritance and overrides, return after reload/restart, all 8 colors, keyboard/focus and non-color identifiers, semantic Gate status and unaffected Chat/map colors, and multiple non-Dope themes with absolutely no Dope Colors effect. Capture screenshots/computed styles/events and exact git SHA/version. Owner performs independent packaged native Electron/AppImage window validation if available; if not, mark native evidence GAP rather than Chrome=Electron. Final `closeout.md` can be authored at genuine P6 execution with per-gate PASS/FAIL/GAP and remaining blockers; no current Green.

## Safety and qualification contract

Every prompt reads `BOOT.md`, `AGENTS.md`, `docs/workflow.md`, current ADRs, stack README/assessment/plan, its previous committed gate results and current checkout. Respect owner dirty files; no reset/stash/clean, force-pull, self-commit, dependency/manifest/version change, concurrent stacks or `/activate`. Runner owns passing checkpoints P1–P5. Final P6 is manual; `npm run codex:phase:validate -- c12-dope-colors` before any separate owner-authorized Run. Target <=8m each, soft 10m, hard 15m; on unsafe scope drift STOP/NOT GREEN with precise evidence. Preserve existing Phase 12 Pi/Planning/Docs/Chat/Gate authority and all historical qualification truth.
