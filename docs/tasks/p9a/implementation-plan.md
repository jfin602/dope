# /prompt-plan — Phase 9A Implementation Plan

Date: 2026-10-10
Status: **PLANNED / NOT ACTIVATED**
Qualified product source: Phase 8 `0.8.47` / `bcc5cb8`; the owner separately established coherent `0.9.0` baseline at `e250a07` (see `docs/planning/p9/baseline.md`). **Implementation activation remains pending** before P1. P1–P6 targets `0.9.1`–`0.9.6`.

## Concrete code ownership

**P1 — Domain and service contracts.** New `packages/contracts/src/developer-session.ts` and `developer-session-service.ts` with strict parser, bounded strings, stable ID, project binding, revision, timestamps, lifecycle `active | paused | closed`, empty membership placeholder only if necessary, and typed create/rename/objective/status/note/closeout operations. No new `@dope` package, AI, provider or Theia domain types. Confirm the canonical-root versus ProjectMind ID caveat: no Project Mind artifact may exist; Planning ID is not necessarily the same. Choose safe project-local identity semantics and document copy/reopen behavior without silently minting another project identity.

**P2 — Store.** New `packages/theia-extension/src/node/developer-session-store.ts` or the smallest existing Node persistence home. Versioned `.dope/development-sessions.json`, canonical file-root checks, no symlinked `.dope`/file/lock, bounded read/parse, missing-store empty state, atomic temp + fsync + rename + parent fsync, project-local lock and optimistic revision. No silent repair of malformed files, no writes outside session file/lock. Reuse patterns from `packages/project-intelligence/src/node/project-mind-store.ts`, `packages/visual-planning/src/node/planning-store.ts` and `packages/chat/src/node/chat-repository.ts`; do not copy their full implementations.

**P3 — Lifecycle.** Implement revision-checked create, rename, update objective, pause/resume, close/reopen, bounded notes/next actions and explicit closeout. Keep session/collection revisions monotonic and timestamps coherent. Invalid transitions, duplicate IDs, malformed data, stale writes and mutation of closed session without reopen fail closed. No typed artifact links, source changes, AI or WorkItem mutations.

**P4 — Backend RPC.** New `packages/theia-extension/src/node/developer-session-backend.ts` implementing the contracts service, one connection handler in `packages/theia-extension/src/node/backend-module.ts`. Project-scoped `attach/read/list/get/mutate`, opaque handle and disposed/stale attachment rejection. Reattach/project-switch must not leak old project's data; do not require a frontend widget or import Agent Runtime.

**P5 — Focused integration.** New tests `test/unit/developer-session-contracts.test.ts`, `developer-session-store.test.ts`, `developer-session-backend.test.ts` (combine if simpler). Exercise two sessions, no-AI, copy/reopen, distinct roots, optimistic stale write, malformed/symlink/foreign handle, simultaneous writers, crash-safe persistence and no mutations to Chat/Planning/Agent/Project Mind. Register each new test once in root `test:product`. Run one focused `node --test` invocation; compile only touched `@dope/contracts` then `@dope/theia-extension` when tests import `lib`. Do not run full aggregate.

**P6 — Scoped manual closeout.** Advance all 13 manifests and pinned internal dependency versions to `0.9.6` from proven P5 `0.9.5`, with a separate legitimate source/version checkpoint before evidence-only closeout. Audit exact Git basis, P1–P5 targeted test evidence, restart/project isolation and no-session truth; rerun only invalidated tests. Write `docs/tasks/p9a/closeout.md` with 9A Green/Not Green, explicit unqualified 9B–9E and Phase 9 still open. No real GUI/aggregate claim, no Phase 9B activation.

## Efficiency and version policy

Each P1–P5 prompt owns its target patch and must coherently update all 13 root/app/package manifests and pinned internal `@dope/*` dependency versions. Runner does not bump versions. The separately owner-approved coherent `0.9.0` transition has been committed; P1 must start only after a further explicit Phase 9 implementation activation and then advance to `0.9.1` during implementation. Preserve unrelated dependencies, `yarn.lock`, user worktree and historical evidence; no `package-lock.json`.

P1–P4 are narrow <=8-minute implementation-plus-focused-test targets, 10-minute soft/15-minute hard. P2 security may justify longer rather than weaker enforcement. P5 T2 integration and P6 manual evidence audit may exceed ordinary budget. `npm run check` already nests typecheck, product tests and browser/Electron builds, so reserve it and real GUI Dope Builds Dope for 9E. No repeated full build, broad tests or model calls in 9A. Tests import compiled `lib`; compile only changed packages when needed.

## Preserved authority

Sessions are optional, provider-free organizational records. Opening/closing them never creates an AgentTask, executes work, grants authority, changes WorkItem state, adopts architecture or mutates Git. The Phase 5 planning replay is deferred to 9B, not skipped; the original Phase 5 P11 Not Green/P12 unexecuted record remains historical. Phase 8 exact-source Green remains unchanged.

No Phase 9 implementation is authorized by this document alone.
