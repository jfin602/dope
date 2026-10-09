# Phase 8D Implementation Plan — focused slices

Status: **HISTORICAL P1–P13 EXECUTION PLAN; P1–P12 COMMITTED / P13 NOT GREEN (UNCOMMITTED LOCAL EVIDENCE)**
Baseline `0.8.20`; continuation P1-P13 `0.8.21`–`0.8.33`.

This document records the **approved implementation plan, not a new run request or a Green claim**. GitHub commits P12 at `0.8.32` (`09fe3bcd`); the owner reports a P13 `0.8.33` uncommitted local worktree and Not Green closeout. Domain/runtime services exist, but WorkItem-created tasks cannot be started from the Work GUI; Planning launch passes an empty required-validation list, preventing developer acceptance under existing review rules. The final aggregate did not pass. Consult `docs/planning/p8/phase-8d-plan.md` for current repair gates; do not regenerate or rerun P1–P12.

## Source ownership
Visual Planning: `packages/visual-planning/src/index.ts`, `work.ts`, `service.ts`, `node/planning-store.ts`; Theia `visual-planning-backend.ts`, `planning-map-controller.ts`, `planning-work-projection.ts`. Agent: `packages/agent-core/src/contracts.ts`, `authority.ts`, `execution.ts`, `node/agent-store.ts`, `node/candidate-validation.ts`; RPC `packages/contracts/src/agent-runtime-service.ts`; Theia `agent-runtime-backend.ts`, `agent-execution-runtime.ts`, `agent-run-controller.ts`, `work-selection-controller.ts`. Software Map identity uses existing deterministic evidence, no new synthesis.

## Ordered scope and exact focused validation
### P1 — 0.8.21 — WorkItem ownership schema and legacy defaults (T1)
Extend only Visual Planning `WorkItem` types, parser and defaults with HUMAN/AI/SHARED assignment plus bounded delegable/human-reserved paths. Preserve existing WorkItem status/identity, PlanningMap basis and old serialized maps; reject contradictory scopes/path escapes. Do not add runtime/service/UI.
Validation: Compile only changed `@dope/visual-planning` once for tests importing `lib`, then `node --test test/unit/planning-work.test.ts` with focused old-map/ownership assertions. No extension build or storage/restart suite.

### P2 — 0.8.22 — AgentTask WorkItem origin and review metadata (T1)
In `packages/agent-core/src/contracts.ts`, add strict portable WorkItem origin snapshot (project/map/WorkItem/revision/basis/scope) and opt-in review-required task policy. Preserve legacy direct/phase-stack Task parsing. Do not add ProposedAction or steering models yet.
Validation: Compile changed `@dope/agent-core` once, then `node --test test/unit/agent-core.test.ts` for origin/review/legacy parser. No broader build.

### P3 — 0.8.23 — Revision-safe WorkItem to AgentTask launch service (T2)
At existing Planning/Agent Runtime typed backend boundary, derive a bounded AgentTask from a developer-selected WorkItem with expected project/map revision. Enforce HUMAN denial and SHARED human-reserved paths; same request key cannot create duplicate task. Persist source link on AgentTask, derive reverse link by querying AgentStore; no second mutable link store or auto-execution.
Validation: Compile only changed dependencies if needed for `lib` tests; run one new focused `test/unit/workitem-delegation.test.ts` for valid, duplicate, stale and reserved-scope cases. Leave restart/cross-project matrix to P12.

### P4 — 0.8.24 — WorkItem frozen candidate review hold (T2)
Only for WorkItem-origin review-required tasks, insert a durable review-ready hold between the existing frozen CandidateDelta plus ADR 0029 validation and ADR 0028 promotion. Persist bounded diff/fingerprint/validation evidence; failed validation never yields executable review. Keep direct Work/Prompt Stack auto-promotion unchanged.
Validation: Compile affected agent/runtime packages only if test imports compiled code. Run one `test/unit/agent-delegation-review.test.ts` with hold, validation failure and direct-origin unaffected. Defer restart/adversarial matrix.

### P5 — 0.8.25 — Explicit safe candidate accept or reject (T2)
Expose one revision-checked developer decision on P4 held candidate. Accept re-verifies candidate hash, required validation, grant, delegated scope, authoritative path and Git basis before existing Dope-owned all-or-blocked promotion. Reject applies nothing. Decisions persist idempotently; no WorkItem auto-completion or Git stage.
Validation: Extend and run only `test/unit/agent-delegation-review.test.ts` for accept/reject/stale/double accept. Build changed compiled packages once as necessary. P12 covers broad races/path escape.

### P6 — 0.8.26 — Blocked ProposedAction records without new permission (T1)
Persist a small versioned blocked/consequential ProposedAction with source task, target/effect, required authority, rationale and developer acknowledgement/rejection. Fixed initial ExecutionGrant remains untouched; acknowledgement cannot execute delete/rename/Git/network/secret/outside-root. Do not create approval spam for routine in-grant changes.
Validation: One focused action parser/denied-effect test (`test/unit/agent-proposed-action.test.ts`), build only changed compiled package as necessary. No repeat of candidate acceptance tests.

### P7 — 0.8.27 — Durable steering with truthful acknowledgement (T2)
Add version-checked developer steering request and persisted acknowledgement to Agent Runtime service/store. If adapter lacks active-turn steering, report queued/unsupported and require explicit stop/new task; never silently restart provider, alter grant or frozen candidate. Scope request to project/task/run.
Validation: One focused `test/unit/agent-steering.test.ts` for unsupported turn, stale revision, terminal-run block. Build only changed compiled package(s) if needed. P12 covers cancel/restart races.

### P8 — 0.8.28 — Bounded applied-change Software Map impact (T2)
After *authoritative promotion only*, link actual changed project paths and current deterministic evidence to affected Software Map IDs, or mark unknown. Persist bounded project/generation/decision-scoped impact receipt. No background synthesis, PlanningMap rebase, canonical edits or local model calls.
Validation: One focused `test/unit/agent-map-impact.test.ts` for resolved, unknown and stale generation. Compile only changed compiled package(s) when needed. P12 owns broader regressions.

### P9 — 0.8.29 — Planning WorkItem ownership and launch UI (T1)
In existing Planning WorkItem controller/projection, show ownership/reserved scope and developer Launch Work action through typed P3 service; navigate to linked AgentTask. Disable for HUMAN, stale or invalid scope. No canvas redesign or review UI.
Validation: One changed extension build if compiled test requires it; run only `test/unit/planning-map-ui.test.ts` or a narrower changed controller test. No browser/packaging.

### P10 — 0.8.30 — Work candidate review diff and accept/reject UI (T1)
Reuse existing Work detail, transcript and validation summary; add held candidate diff disclosure plus explicit Accept/Reject and truthful pending/stale/terminal control eligibility. Preserve Stop vs Close and separate Chat/Work. Do not add steering/actions/map view yet.
Validation: One changed extension build if compiled tests require it; run `test/unit/agent-run-ui.test.ts` or a narrower Work review test, not both by default. No broad UI matrix.

### P11 — 0.8.31 — Work steering, blocked action and map impact UI (T1)
Expose existing steering request/acknowledgement, blocked ProposedAction and affected/unknown map IDs in compact Work detail controls. Avoid fake live steering or permission escalation; preserve candidate review and alternative themes. No new backend authority.
Validation: One changed extension build if required by compiled tests; run `test/unit/work-integration.test.ts` or one focused new controls test. Browser/manual multi-panel proof belongs to P13.

### P12 — 0.8.32 — Focused delegation integration and legacy regression (T2)
Run a bounded set of new/changed delegation/review/steering/map tests plus directly affected existing direct-Work/Prompt Stack suite. Check narrow scoped safety, frozen review, stale basis and idempotency; fix actual defects only. Register any new test files exactly once in root `test:product` so final aggregate covers them.
Validation: One targeted `node --test` invocation of changed test files and at most one existing directly affected regression suite. No unconditional build; only compile if changed source requires it. No `npm test`, `npm run check`, browser/Electron build, packaging or restart suite.

### P13 — 0.8.33 — Phase 8D live GUI qualification and closeout (T3)
On exact 0.8.33 source, use real Dope GUI/Codex and disposable Git workspace. Launch two WorkItem-derived tasks, accept one frozen validated candidate and reject another; verify project writes and separate WorkItem completion. Exercise HUMAN/SHARED scope, denied ProposedAction, truthful steering, map impact and held-review restart. Read-only reopen old direct Work and Adaptive SEO Prompt Stack. Record exact IDs, SHAs, evidence and 8D GREEN/NOT GREEN; do not activate 8E.
Validation: Run `npm run check` exactly once (already includes full typecheck, product tests and browser/Electron builds), then only missing focused tests if any; no separate `npm test` or repeated build. Run `npm run codex:phase:validate -- p8d` once, plus cheap diff/version/no-lock checks.


## Efficiency / qualification
P1–P11: <=8-minute implementation + necessary focused validation target, 15-minute maximum. Run only tests added/changed and directly affected existing tests. Unit tests commonly import compiled `lib/`, so one build of **changed** packages is necessary when tests otherwise run stale output. No unconditional `build:extension`, root tests/typecheck, browser/Electron builds, packaging or restart suite. P12: bounded cross-package integration, register new test files in the existing `test:product` list. P13: manual T3 and **one** exact-candidate `npm run check` (already builds and tests); no additional `npm test` or repeated build. `git diff --check` remains cheap. All failures remain truthful.

WorkItem-origin snapshot on AgentTask is the canonical linkage; inverse WorkItem->task query is derived from AgentStore rather than duplicated mutable cross-store state.

Maintain project/root basis checks, human-reserved working-set constraints, frozen-candidate validation and unchanged grant at accept, idempotent decisions and no automatic WorkItem/architecture completion. T3 live provider/GUI evidence stays P13, with explicit Green/Not Green and no 8E activation.
