# /prompt-plan — Phase 9B Implementation Plan

**Status:** PLANNED / SEVEN-PROMPT STACK / NOT OWNER-ACTIVATED
**Entry:** `0.9.6` source checkpoint `6b51ee96bcdc4ca185292f594c1886de81b149e8`, 9A evidence closeout `bb266b34796bdb5a390e0e8e263cd8caf45701d8`. Actual manifests stay `0.9.6` until a separate owner activation and P1.
**Version targets:** P1–P7 `0.9.7`–`0.9.13`, 13 root/app/package manifests plus pinned internal `@dope/*` references advanced by the assigned prompt. Runner checks but does not bump. Sole manual closeout P7.

## Concrete seams

**P1 — contracts/migration.** Update `packages/contracts/src/developer-session.ts` and `developer-session-service.ts` with strict v2 SessionArtifactRef union (Chat, PlanningMap, WorkItem composite, AgentTask, AgentRun composite, AgentSequence, Project Mind decision/idea), stable duplicate keys, bounded links, and normalized v1-to-v2 parser. Preserve IDs, canonical root/project binding, revisions, timestamps, status, notes and closeout. Read-only normalization; reject unsupported/corrupt data. Update `test/unit/developer-session-contracts.test.ts` rather than dropping 9A tests.

**P2 — store v2 compatibility.** Update `packages/theia-extension/src/node/developer-session-store.ts` and existing 9A tests: accept v1 on read as v2 in memory without rewriting files, persist v2 only on an explicit locked revision-checked mutation, preserve 9A lifecycle and fail-closed path/project/corruption semantics. No silent rebind or migration on attach/read. Verify no-write read and restart.

**P3 — Chat/Planning read-only resolution.** Add small resolver module under `packages/theia-extension/src/node/`. For Chat use a safe non-recovering metadata path, not `ChatRepository.read()`, which may write recovery. For Planning use safe owner reads, mapId+workItemId, actual map/work status and evidence-backed semantic basis. Return resolved/missing/stale/unavailable without mutating Chat/Planning, rebase or canonical architecture. Avoid loading chat transcripts into Session response.

**P4 — Agent/Project Mind resolution.** Resolve AgentTask, AgentRun (matching taskId), AgentTaskSequence and Project Mind decision/idea by existing owner stores, validating project and relationships. Expose bounded status, validation pass, review decision and accepted promotion as distinct facts; never mark WorkItem complete from a run. Missing Project Mind returns missing/unavailable truth without initialization. No model/provider calls.

**P5 — membership and RPC.** Add `attach-link`/`detach-link` operations to SessionService and DeveloperSessionStore, using 9A collection/session revisions and existing per-connection projectHandle. Attach checks owner existence in canonical project; duplicate idempotent, shared references allowed, closed session immutable. Detach membership only. Resolve linked refs in one compact backend read operation; no new UI, new agent execution or mutable inverse indexes. Race after attach is reported on subsequent resolution.

**P6 — bounded cross-store integration.** Build one deterministic test fixture for v1 migration, multiple sessions/links, restart, A/B isolation, missing/stale/unavailable and owner-store byte-unchanged reads, plus PlanningMap -> WorkItem -> existing AgentTask/Run -> validation/review projection using genuine owner records. Prove session never calls execution or grants authority. Register new tests exactly once in root `test:product` and run focused tests only. Prepare disposable project fixture and explicit real-run checklist for P7; deterministic fixture alone is not a real live run.

**P7 — manual scoped closeout.** After P6 `0.9.12` checkpoint, advance all 13 manifests/internal pins to `0.9.13` in a separate legitimate source/version checkpoint before evidence-only closeout. Perform one **real** authorized PlanningMap -> WorkItem -> AgentTask/AgentRun -> frozen Dope-owned validation/review replay on a disposable project, with explicit developer consent and normal ExecutionGrant. Resolve resulting links from Session after backend restart. Reuse a configured local agent when possible; hosted requires explicit separate egress consent; no silent fallback. If live evidence cannot be obtained, mark 9B Not Green with exact gap. Review focused tests and 9A regressions; do not rerun broad aggregate absent invalidation. Write `docs/tasks/p9b/closeout.md` with exact SHA, scope, failures and pending 9C–9E. Do not close Phase 9 or activate 9C.

## Guardrails and efficiency

No cross-store transaction, copied authoritative state, automatic WorkItem completion, new AgentTask origin, implicit AI context, automatic agent execution, source/Git mutation by Session, or canonical map adoption. Do not rewrite Phase 5/8 historical closeouts. No new package if the existing contracts/Theia boundary suffices.

P1–P5 <=8-minute target including focused tests (10-minute soft, 15-minute hard). P2–P5 security must not be deferred. P6 integration and P7 real replay may exceed ordinary budget. Compile only touched package `lib` dependencies when tests import them. No per-prompt `npm run check`, `npm test`, browser/Electron/native packaging or full Phase 9 GUI. 9E owns exact-source full aggregate and Dope Builds Dope GUI.

## Activation

**9B NOT OWNER-ACTIVATED.** Do not run `npm run codex:phase -- p9b` or advance manifests until a separate explicit owner decision records 9B activation (proposed `docs/planning/p9/phase-9b-activation.md`). 9A is bounded Green at `0.9.6`, Phase 9 overall remains open/not qualified, 9C–9E and Phase 10 inactive.
