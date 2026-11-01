# c12-dope-colors — Dope Dark-only global and project colors

**Owner decision:** 2026-11-01. **Status:** ASSESSED / PLANNED / PROMPTS AUTHORED ONLY — NOT RUN, IMPLEMENTED OR QUALIFIED. **Package:** `0.12.7` unchanged. **Reviewed GitHub main:** `2ffa61b6e0ed79e7f9259e866f2b605c3fdfd9b1` at authoring (remote only; owner local checkout/dirty state unobserved).

**Authority:** [ADR 0043 — Dope Colors](../../decisions/0043-dope-colors-project-identity.md), [ADR 0016 Dope Dark](../../decisions/0016-dope-dark-visual-identity.md), [Architecture](../../ARCHITECTURE.md), [Product Model](../../PRODUCT-MODEL.md), [assessment](prompt-assessment.md), [implementation plan](implementation-plan.md). This is a separate UX/theme correction, **not** Phase 12 Pi, Planning, Docs Skills, Chat/reasoning or broad roadmap qualification.

## Core product outcome

The user can choose a curated global default on first eligible Dope Dark launch (orange preselected, Skip available), change it later, and assign each project an override or **Inherit Global**. Two open project windows are immediately visually distinguishable. Accents use centralized, tested tonal interaction tokens while background stays neutral charcoal.

**Absolute activation rule: Dope Colors only works when the actual selected theme ID is `dope-dark`.** All third-party/light/high-contrast/non-Dope themes receive **no** Dope Colors token, border, window-header or widget overrides; Dope Colors controls are hidden/disabled with explanation. Saved choices become dormant and restore only when the user voluntarily returns to Dope Dark. Never switch themes automatically.

Preserve persistent user choice, stable project identity, distinct semantic error/warning/success/SCM/syntax/roadmap Gate-status colors, independent Chat organization and map/Flow node colors, existing Theia workbench and normal IDE usability. **Project color is a presentation preference, not canonical project metadata.**

## Prompt sequence

| Prompt | Execution | Responsibility | Evidence |
| --- | --- | --- | --- |
| [P1](P1-theme-palette-and-status.txt) | Runner, T1 | Curated tone resolver; centralized Dope Dark token mapping; semantic Roadmap/status separation | Contrast and token/theme-isolation regressions |
| [P2](P2-color-preference-controller.txt) | Runner, T1 | Durable global/project preferences, stable identity, per-window resolution, cross-window synchronization | Identity, race, restart, inheritance, theme-switch negative tests |
| [P3](P3-global-color-experience.txt) | Runner, T2 | Skippable first eligible launch and discoverable global appearance settings | Accessibility, dismissal/restart, alternate-theme disabling |
| [P4](P4-project-window-identity.txt) | Runner, T2 | Project create/open selection, project settings, restrained window identity cue | Two-project/same-project window, switching and non-color labels |
| [P5](P5-color-integration-regressions.txt) | Runner, T2 | End-to-end deterministic regression and targeted corrections; affected build checks | Eight palettes, contrast, no color leakage, two-window state |
| [P6](P6-manual-chrome-closeout.txt) | **MANUAL, connected Codex Chrome** | Real UI source-bound visual qualification and independent owner native disposition | Actual clicks, two windows, theme switching, screenshots, PASS/FAIL/GAP |

P1–P5 are separate bounded code/test steps. Each uses **GPT-6 Sol High**, target <=8 minutes, soft 10, hard 15; if scope cannot safely complete, STOP with exact blocker rather than fabricate completion. P6 is separate manual operation; never claim real GUI evidence from unit tests. The phase runner must stop before P6, and the operator must **not** invoke `--closeout` to automate the final GUI gate.

## Source and ordering safety

- Validate before any future Run: `npm run codex:phase:validate -- c12-dope-colors`.
- After a **separate explicit owner Run**, invoke `npm run codex:phase -- c12-dope-colors` on a clean, reconciled local source. Runner-owned passing commits only for P1–P5; prompts must not self-commit. **No `/activate` step.** Manual P6 is not run by the headless runner.
- Before execution inspect `git status`, exact local HEAD, version, current modified files and overlapping c12 stacks. Do not reset, stash, clean, override owner changes or force-pull. GitHub authoring cannot certify the owner working tree. Never run concurrent mutating stacks.
- Do not bump package versions, manifest pins, Pi/runtime/model/provider policies or dependencies without separate owner approval. Do not alter existing Roadmap source or canonical `.dope/` state just for appearance.
- Preserve prior historical qualification, including any existing Phase 12/Chat/Pi/Docs failures. No self-awarded Phase 12 GREEN.
- The source-backed final result distinguishes focused/code/build PASS, direct Chrome PASS and owner-native Electron **separate actual proof or GAP**. Any required unobserved gate remains Not Green/Evidence Gap.

## Out of scope

Free-form RGB/hex editor, new complete Theia themes, OS-native title-bar repainting, palette synchronization between machines, global rebrand, accessibility theme override, extra Chat/AI/Work feature, canonical project data changes, automatically generated project metadata and roadmap status remapping.
