# Phase 9 — Clean 0.9.0 Baseline

**Status: VERSION BASELINE ESTABLISHED / PHASE 9A SUBSEQUENTLY OWNER-ACTIVATED (2026-10-10)**
**Date:** 2026-10-10
**Baseline commit:** `e250a07c9b4b7ec29fd178a22036094307237b23`
**Qualified predecessor:** Phase 8 Green / owner-closed on exact `0.8.47` product source `bcc5cb8b9f7ee565bf443122ca18b92beb6e0d06`; evidence closeout `304d429f866976307a70559cf29c98d8c0276ce5`.

## Owner decision and bounded change

The owner requested **"create the clean 0.9.0 baseline"** after approving the Phase 9A prompt assessment, plan and six-prompt stack. This authorizes the **version baseline only**, not Phase 9 implementation activation, any AgentTask, 9A qualification or automatic progression to 9B–9E.

The baseline commit changes exactly **13** root/app/package `package.json` manifests from `0.8.47` to `0.9.0`, including all **20** pinned internal `@dope/*` dependency references (**33** version fields/references total). No application/source files, `yarn.lock`, `package-lock.json`, build artifacts, tests or Phase 8 evidence were changed by that version-only commit. The source functionality is still the Phase 8 qualified implementation; a new version marker is **not** a fresh Phase 9 product qualification.

## Execution gate

- Phase 9 design: approved under ADR 0033 and `docs/planning/p9/phase-9-plan.md`.
- Phase 9A stack: authored at `docs/tasks/p9a/`, P1–P6 targeting `0.9.1`–`0.9.6`.
- Phase 9 implementation: **NOT OWNER-ACTIVATED**. An explicit separate owner decision must authorize P1 execution. Do not confuse baseline creation with activation.
- When activated, the runner must begin from the coherent `0.9.0` Git-proven baseline, then P1 advances all 13 manifests and pinned internal dependencies to `0.9.1` during implementation. The runner checks versions but does not bump them.
- Preserve existing local work: verify Git status, reconcile/sync the remote commit without overwriting dirty files, and run `npm run codex:phase:validate -- p9a` before `npm run codex:phase -- p9a` **only after activation**.

## Evidence limits

The version-only commit was checked for consistent manifests/internal references and unrelated data preservation. It did not run `npm run check`, GUI qualification, tests or a build. The last qualified product source remains `0.8.47` / `bcc5cb8`; historical Phase 5 P11 Not Green/P12 unexecuted and Phase 8 Green remain unchanged.

**Subsequent owner decision (2026-10-10):** The owner explicitly activated Phase 9 for 9A P1–P6 only after the baseline was created; see `docs/planning/p9/activation.md`. The original baseline-only approval above remains historical context. No manifest change is made by the activation, and 9B–9E are not authorized.
