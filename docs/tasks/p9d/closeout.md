# Final Phase 9 / p9d P13 closeout — NOT GREEN

**Date:** 2026-10-12 (America/Chicago)
**Disposition:** **PHASE 9 NOT GREEN / NOT QUALIFIED.** This is the sole manual final Phase 9 qualification attempt, not owner closure or Phase 10 activation.
**Exact source/version candidate:** `0.9.35` / `7fdf7b3f43d695e12fa3390f7fbad63d90e5cfa5` (`0.9.35`).
**Predecessor:** committed `0.9.34` / `bbb771ac037f9a0c38955b5ff16adddcf86f1a97`; preflight worktree clean.
**Authority:** ADR 0034 and separate owner-approved `docs/planning/p9/phase-9d-activation.md`.

## Candidate and validation

P13 advanced all 13 root/app/package manifests and pinned internal `@dope/*` references from `0.9.34` to `0.9.35` in the separate, real source/version commit above, before this evidence-only document. No product source changed in that commit. `yarn.lock` and unrelated dependencies were untouched, no root `package-lock.json` exists, and `git diff --check` passed. The product worktree was clean immediately after the commit and after GUI inspection. P1–P12 source had already been committed through `0.9.34`.

Exactly one full `npm run check` was attempted on the committed `0.9.35` source. The package typecheck completed and the runner tests advanced to the baseline tests. **The aggregate exited 1 in `test:baseline`**: `test/unit/pre-phase4-clean-baseline.test.ts` rejects `PlanningStore` in `packages/theia-extension/src/node/history-backend.ts`. That backend imports the Phase 5 `@dope/visual-planning` store; the retained negative guard's allowlist names several Phase 5 consumers but not this new History consumer. The focused reproduction `node --test test/unit/pre-phase4-clean-baseline.test.ts` failed the same single assertion. This is a stale guard conflict, not evidence that the removed Phase 3 Planning runtime returned. The full aggregate did **not** reach `test:local-install`, `test:product`, `test:ide`, or its browser/Electron build steps; none is claimed as aggregate-passed. Separately, `corepack yarn workspace @dope/browser build` and `corepack yarn workspace @dope/electron build` each exited 0 on the same source. No second full aggregate was run.

A separate focused `node --test` invocation of `history-local-understanding`, `developer-session-frontend-retirement`, `developer-session-backend-retirement`, and `history-integration` passed **12/12 tests**. These headless tests cover read-only owner projections, project-specific focus, Session production-wiring absence, explicit local-only model routing/registry denial, consent and stale preview rejection, and owner/Git sentinels. They do not establish the required live GUI or connected local-model result.

## Direct browser GUI observation

The built Theia browser app was started on `127.0.0.1:3000` with the actual Dope repository. A second browser tab opened a fresh disposable Git project at `/tmp/dope-p9d-p13-gui-kHHVcA` with one committed `example.ts`. These were direct browser workbench actions, not screenshots of a fixture.

- On both projects, the right toolbar visibly contained Chat, Work and History, with no left Sessions launcher. Clicking History opened the right-side panel. Repeated opening on Dope retained one `#dope-history` panel.
- **History stayed at `Loading History…`** on both projects. The browser console reported `Error: Another channel with the id '/services/dope/history' is already open.` The current frontend module creates separate History and HistoryFocus service proxies for that same path; this is a plausible source-level cause, not a confirmed repair.
- Reloading the disposable workbench restored the History panel but left it loading and produced the same duplicate-channel console error. The disposable Explorer still displayed its project file; this is limited evidence that ordinary project navigation remained available.
- Because the panel never populated, the required live chronology, factual Git commit versus dirty snapshot, one-click exact owner continuation, keyboard and dark/light behavior of the loaded panel, stale/missing cases, and live A/B isolation of populated History **were not observed**. A single right-panel instance alone is insufficient for those gates.

The GUI showed no History-triggered AgentRun or review action, and Git status remained clean after the attempted reads. The failed History load prevents a stronger live no-write, no-execution, or no-egress claim. Focused headless tests provide only their stated bounded authority evidence.

## Legacy recovery and local explanation

The user-invoked standalone `scripts/export-legacy-development-sessions.mjs` CLI was exercised directly with fresh v1 and v2 `.dope/development-sessions.json` fixtures. Both invocations exited 0, returned the expected author note and matching source SHA-256, and left the original legacy file and an owner sentinel byte-identical. The retired Session frontend/backend production guards passed in the focused suite. No legacy user data was deleted, rewritten, or silently migrated.

No genuine connected eligible local-model explanation was produced. History never exposed its evidence selection/preview/confirmation controls, and no local model endpoint was listening on the reference `127.0.0.1:1234` port during this run. The local-only denial/failure behavior passed focused simulated-provider tests, but a live connected provider and hosted-egress denial were **not** independently exercised. Do not treat fixture completion as local-model qualification.

## Decision and remaining scope

**NOT GREEN.** The exact candidate fails the full aggregate, and direct real GUI use exposes a blocking History RPC failure. The live chronological owner projection, exact continuation, restart and A/B behavior beyond the loading state, genuine local explanation, and independent authority/egress proof remain Evidence Gaps. A correction should resolve the duplicate History channel and the Phase 5/Phase 3 guard conflict, then qualify the repaired exact source in a new explicitly scoped gate. This closeout does not silently alter the committed `0.9.35` product source or relabel missing evidence as passed.

Historical 9A and 9B remain Green only for their bounded `0.9.6` and `0.9.13` scopes. Original Session 9C P10 remains superseded/unexecuted and unqualified. Phase 5 P11 Not Green/P12 unexecuted and Phase 8 owner-closed Green remain unchanged. There is no p9e. Owner closure and Phase 10 activation each require a separate owner decision; Phase 10 remains inactive.
