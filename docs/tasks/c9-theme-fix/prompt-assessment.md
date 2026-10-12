# /prompt-ass — c9-theme-fix

**Status:** ASSESSED / ACCEPTED FOR PROMPT WRITING / NOT IMPLEMENTED
**Date:** 2026-10-12
**Source:** `jfin602/dope` GitHub `main` source `e11b72fe35f86f1700861101184760b80254c659`, package `0.9.23`; docs baseline `6e76285616eb73e9d65ee2e56cb16ef5b6bd9d83`.
**Authority:** ADR 0016 (October 12 current amendment), ADR 0030, `docs/ARCHITECTURE.md`, `docs/workflow.md`, `AGENTS.md`.

## Decision and prompt sizing

Use **one T1 implementation prompt + one T3 manual browser/GUI closeout**. This is a central palette correction, not a design-system re-creation or an all-panel CSS rewrite. Ordinary P1 has one clear owner and should fit the <=8-minute implementation+focused-validation target; P2 alone can exceed normal duration for genuine GUI and aggregate qualification.

| Prompt | Responsibility | Tier | Model | Dependency |
| --- | --- | --- | --- | --- |
| P1 | Amend Dope Dark central token/semantic mapping and permanent `dope-theme.test.ts` guards | T1 | GPT-6 Sol High | Current theme authority and live source |
| P2 | Visually inspect real user-facing surfaces, focused contrast/theme leakage, one aggregate and truthful closeout | T3/manual | GPT-6 Sol High | P1 exact source checkpoint |

No extra P1 package build: CSS and source-string test edits do not change TypeScript output or package boundaries. Keep any necessary TS/theme registration repair tightly justified. No repeated aggregate in P1.

## Source evidence and consumers

- `packages/theia-extension/src/browser/dope.css` lines approximately 265-328 owns `.dope-dark` tokens. At review it still maps `--dope-primary: #336699`, `--dope-on-primary: #FFFFFF`, `--dope-action-*`, `--theia-button-*`, `--theia-statusBar-*`, tab/list/focus/selection/badge/progress/link tokens. At 330-355 the Git status segment is filled using `--dope-primary` while diagnostics use separate semantic colors. At 358-384 active buttons and opt-in `.dope-action-primary` are styled. Selection/focus must be subtle enough to avoid orange-washing.
- `packages/theia-extension/src/browser/dope-theme.ts` registers `dope-dark` with `body.dope-dark` activation/deactivation. Frontend registration/default theme already exists and is not a redesign target.
- `test/unit/dope-theme.test.ts` explicitly asserts blue, white on-primary and the *absence* of the historical orange hexes, while guarding theme deactivation, status diagnostics, semantic token ownership and browser/Electron defaults. Modify authority-sensitive assertions rather than deleting guards. Preserve source-string security/compatibility checks.
- `dope.css` later contains ten independent per-Chat colors and map/Flow role colors; these are intentional feature semantics, not competing global brand hexes.
- AI Center is the compact neutral-controls reference (ADR 0030). Select Chat/Work, AgentRun, sMap, Physical Map, Planning Map, Project Mind, and pending History should inherit semantic tokens without copying brand values into widget CSS.

## Risks / safeguards

1. **Contrast:** orange primary `#FF7A1A` with its dark foreground needs checks in ordinary, hover `#FFB15C`, and deep pressed `#C75100` states. Do not retain white-on-bright-orange; allow a separate readable pressed foreground if warranted by measured contrast. Also review badges, selected text, activity/tab accents, links and focus visibility.
2. **Overuse regression:** changing `--dope-primary` affects many inherited `--theia-*` maps. Evaluate whether badges, global focus/selection or default nav become visually noisy. Keep neutral button backgrounds and input borders; primary-filled buttons must stay intentional opt-ins. Keep status text neutral, only bounded Git fill.
3. **Theme isolation:** central `.dope-dark` scoped tokens must deactivate on a non-Dope selected theme. Do not recolor extension/syntax/error/warning/success/SCM semantics globally.
4. **Unrelated colors:** Chat organization and user map/Flow overrides must not be overwritten or homogenized. Keep accessible non-color cues.
5. **Version collision:** GitHub main is `0.9.23` while owner-activated `p9d` is progressing. This fixed-version correction may be run now only on coherent `0.9.23`; if p9d moved ahead locally, retarget all c9 prompt version fields via a docs-only update before execution. Never force reset/downgrade, relabel p9d P1, or run two mutating stacks simultaneously.

## Explicit deferrals

No general shell redesign, panel archetype library, broad CSS style sweep, event/persistence migration, AgentRun/Chat/Work/History semantics, active phase restructuring, status-bar geometry, new default-theme identity, model provider test, AppImage packaging or native release qualification. An unrelated visibly inconsistent panel may be recorded as follow-up rather than swept into P1.

## Evidence distribution and prompt efficiency audit

- **P1/T1:** `node --test test/unit/dope-theme.test.ts`, `git diff --check`, coherent unchanged version/manifests and no root package-lock. No extension build if no changed TS; no broad `npm run check`, browser build, restart or package.
- **P2/T3:** one final-candidate `npm run check` (contains `test:baseline` with `dope-theme.test.ts`, extension/browser/Electron builds) + only genuinely missing focused tests; direct browser-hosted or Electron GUI visual sampling, narrow-pane/alternate-theme and contrast observations; one evidence closeout. Do not repeat aggregate for an unchanged checkpoint.
- **Single responsibility / time:** P1 is a central theme CSS/test patch, not a panel refactor. P2 manual real GUI can legitimately exceed ordinary prompt budget.
- **UI Design Compliance Gate:** both prompts read current ADR 0016 and ADR 0030, use shared semantic tokens, and explicitly protect neutral controls, dark status bar, accessible focus, alternative themes and preserved feature colors.
- **Runnable grammar:** c9 correction, contiguous P1-P2, one final P2 *closeout*, fixed unchanged `0.9.23` at writing, browser flags, approved GPT-6 Sol High, historical evidence unchanged. If version differs at execution, halt and retarget coherently before running.
