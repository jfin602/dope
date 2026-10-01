# Correction 5 — acceptance debug machinery closeout

Status: **GREEN — MACHINERY ONLY**
Candidate: P1 `09585e1920533f3f6844da924ae4ad6ca6c72571` + P2 `ee3ad30f94a1dec7681c8bf19a50c05e08659661` (pre-task HEAD).
Package version: unchanged `0.5.11` in the root, both apps, and all seven live internal packages. P11 remains paused / Not Green; P12 is unexecuted.

## Gates

| Gate | Result | Evidence |
| --- | --- | --- |
| A. Compatibility | Green | The schema-1 regression removes the new revision field from a persisted `review_required` run, then a fresh backend loads it at revision 0. |
| B. Mutable durability | Green | The regression persists an invalid edited review and recovers the exact draft/revision across fresh backends. A separate temporary fixture also reopened the edited draft at revision 1 through a fresh backend and controller. |
| C. Stable complete diagnostics | Green | The domain regression checks combined blockers, stable ordering and all duplicate-root claimants. The temporary restart fixture compared the full blocker objects before/after reopen and against checker JSON; the conflict named all three claimants. |
| D. Provider independence | Green | Fresh backend/controller reopen and `npm run smap:review:check -- <temporary fixture> --json` succeeded in reporting the review without configuring or calling a provider. The checker regression verifies no project-file write. |
| E. Concurrency/isolation | Green | The revision regression rejects stale saves after a newer save and rejects a project-B handle/review attempting to change project A. |
| F. Lifecycle | Green | Focused regressions show explicit cancellation removes `.dope/smap-analysis.json`; a separate valid review accepts through the production path, removes analysis work, and creates accepted initialization state. |
| G. Scope/regression | Green | P1/P2 source changes are limited to review storage/service/controller, shared diagnostics, UI/backend preflight, and the offline checker. No synthesis/evidence/root-materialization implementation or ownership auto-repair changed. No Adaptive SEO run or version advance occurred. |

## Validation

- `node --test test/unit/software-map-initialization.test.ts test/unit/software-map-index-backend.test.ts test/unit/software-map-ui.test.ts test/unit/smap-review-diagnostics.test.ts`: **49 passed, 0 failed**.
- Temporary project-local schema-1 fixture audit: fresh backend/controller draft and revision recovery, exact diagnostic equality, all root claimants, provider-free checker: **passed**. The temporary fixture was removed.
- `npm run codex:phase:validate -- c5-smap-acceptance-debug-loop`: **VALID**; P1/P2/P3 remain assigned unchanged `0.5.11`.
- `git diff --check`: **passed**. No root `package-lock.json`, `npm-shrinkwrap.json`, or `pnpm-lock.yaml` appeared; the existing tracked `yarn.lock` is unchanged.

Next: run the actual iterative Adaptive SEO acceptance-debug loop **outside this correction folder** using the preserved review, then resume P11 only after real **Accept Architecture** succeeds. P12 remains blocked until P11 completes.
