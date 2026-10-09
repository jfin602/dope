# Phase 8D Implementation Plan — General Scoped Delegation

Status: **READY FOR EXECUTION (documentation/planning only; no implementation claim)**
Execution folder: `docs/tasks/p8d`; starting version `0.8.20`; P1–P10 `0.8.21`–`0.8.30`.

## Current source and affected boundaries

**Visual Planning producer:** `packages/visual-planning/src/index.ts` (`WorkItem`, strict parser, schema), `work.ts` (put/split/merge/status), `service.ts` (revisioned Planning operations), `node/planning-store.ts` (project-local store). `packages/theia-extension/src/node/visual-planning-backend.ts` and `browser/planning-map-controller.ts` plus `planning-work-projection.ts` consume it. Tests: `planning-work.test.ts`, `visual-planning-storage.test.ts`, `planning-map-ui.test.ts`.

**Agent Runtime producer:** `packages/agent-core/src/contracts.ts` (task origin, run and candidate), `authority.ts` (fixed ExecutionGrant), `execution.ts` (provider start/cancel), `node/agent-store.ts`, `node/candidate-validation.ts`, `node/execution-workspace.ts`. `packages/contracts/src/agent-runtime-service.ts` is RPC; `packages/theia-extension/src/node/agent-execution-runtime.ts` and `agent-runtime-backend.ts` own orchestration; `codex-agent-execution.ts` adapts reference agent. Tests: `agent-core.test.ts`, `agent-store.test.ts`, `agent-execution-runtime.test.ts`, `agent-execution-workspace.test.ts`, `work-integration.test.ts`.

**Presentation:** `packages/theia-extension/src/browser/agent-run-controller.ts`, `work-selection-controller.ts`, `agent-transcript-widget.ts`, `planning-map-controller.ts` and `dope.css`; preserve the Green ADR 0030 semantic theme and separate Chat/Work module identity.

**Software Map consumer:** existing `packages/software-map` Physical Map/evidence queries and `packages/theia-extension/src/node/software-map-backend.ts` own observed identities; PlanningMap rebase/reconciliation uses separate developer authority. Do not mutate either based on unqualified candidate work.

## Implementation order / acceptance by prompt

### P1 — 0.8.21 — T1 — WorkItem ownership and portable delegation contracts
Define provider-independent Phase 8D WorkItem ownership/linkage and durable review/action/steering DTO contracts, with strict parser/migration rules before wiring execution.

Ownership: Visual Planning contracts/services with minimal typed Agent link.
Tests: T1: build only touched domain/contracts packages and add focused parser/migration/transition tests for legacy maps, invalid scopes, cross-project IDs, duplicate links, owner state and strict unknown/future schema. `git diff --check`; no broad aggregate.

### P2 — 0.8.22 — T2 — Revision-safe WorkItem to AgentTask delegation
Create explicit Planning -> Agent Runtime delegation with durable, idempotent task links and no new execution primitive.

Ownership: Visual Planning contracts/services with minimal typed Agent link.
Tests: T2: one focused backend/service integration suite covering accepted derivation, one WorkItem -> multiple distinct tasks over time, duplicate request, interrupted partial linkage, stale map revision, missing WorkItem, cross-project and HUMAN/SHARED denial; affected package builds and `git diff --check`.

### P3 — 0.8.23 — T2 — Frozen candidate review hold after validation
For WorkItem-origin tasks only, persist a review-ready candidate hold between qualified ADR 0029 validation and ADR 0028 promotion.

Ownership: Agent Runtime and typed service boundary.
Tests: T2: focused runtime integration tests for valid review hold, required validation failure, provider no-change, denied delete/rename, frozen candidate mutation, interruption/restart and direct/sequence unchanged auto-promotion; one affected runtime build and `git diff --check`.

### P4 — 0.8.24 — T2 — Accept or reject reviewed candidate safely
Finish review-required WorkItem execution with explicit durable developer accept/reject and exact-basis Dope-owned promotion.

Ownership: Agent Runtime and typed service boundary.
Tests: T2: real isolated candidate fixture for accept, reject, concurrent/double accept, stale Git/HEAD, changed frozen bytes, denied path/human-owned file, required validation failure and backend restart. Verify untouched project on rejected/blocked paths; affected integration tests and `git diff --check`.

### P5 — 0.8.25 — T1/T2 — Consequential ProposedAction without privilege escalation
Make blocked consequential changes inspectable and developer-reviewable without widening the fixed Phase 8B ExecutionGrant.

Ownership: Agent Runtime and typed service boundary.
Tests: T1/T2: focused pure state tests plus narrow integration for denied delete/rename, human-reserved file, replay and unchanged in-grant promotion. Prove a model/provider cannot approve or execute an action via stored proposal; `git diff --check`.

### P6 — 0.8.26 — T2 — Durable steering with safe runtime acknowledgement
Allow developers to steer delegated work while reporting actual applied/pending/unsupported state rather than pretending every provider can change a live turn.

Ownership: Agent Runtime and typed service boundary.
Tests: T2: focused lifecycle tests for supported safe-boundary apply, unsupported in-flight steer, cancellation races, restart pending state, stale revision, cross-project/run isolation, no automatic rerun; affected tests/build and `git diff --check`.

### P7 — 0.8.27 — T2 — Bounded post-promotion Software Map impact
Link applied WorkItem candidate effects to existing Software Map identities and localized staleness without Phase 10 background alignment.

Ownership: Software Map impact adapter and planning link.
Tests: T2: focused impact tests for matched file/branch, unrelated change, missing/unknown nodes, stale project/map generation, restart receipt, double promotion and cross-project isolation. Regressions for PlanningMap staleness source of truth; affected packages/tests and `git diff --check`.

### P8 — 0.8.28 — T1/T2 — Planning and Work delegation, review and steering UI
Surface explicit WorkItem delegation/ownership, held candidate review, ProposedAction, steering and bounded map impact in the existing GUI without new canonical UI state.

Ownership: Theia presentation adapters.
Tests: T1/T2: focused controller/presentation tests for HUMAN/AI/SHARED, disabled actions, real held review and validation, stale basis, Stop versus close, unsupported steering, narrow panel accessibility and saved-state reopening. Build only affected frontend packages; defer direct GUI/T3 to P10.

### P9 — 0.8.29 — T2 — Delegation and legacy execution integration regressions
Exercise end-to-end backend seam failures and preserve the qualified direct Work and Prompt Stack behavior on the final implementation candidate.

Ownership: Integrated backend/frontend fixture tests.
Tests: T2: bounded changed-package build, focused cross-package integration/regression suites over affected files, `git diff --check`, package-version/internal-reference/root-lock checks. Do not run full `npm run check` or live GUI; reserve those for P10.

### P10 — 0.8.30 — T3 — Phase 8D live delegation GUI qualification and closeout
Directly qualify Phase 8D with real Dope GUI/reference-Codex delegated work, exact-candidate safety and historical non-regression; close 8D only.

Ownership: Evidence-only manual qualification.
Tests: T3 only: real qualified Coding Agent and GUI, disposable project, one final exact-candidate aggregate and prompt validator, relevant restart/security evidence. If failed, record NOT GREEN; no invented success. Do not manually commit implementation source; closeout uses a separately reviewed manual evidence checkpoint.


## Non-negotiable risk controls

- Exact WorkItem/map expected revision and project identity; human-reserved scope narrowing at both task derivation and promotion, without provider-only enforcement.
- Frozen candidate and required validation pass before review-ready, then unchanged frozen candidate, grant, Git/worktree basis and path checks before promotion. Reject never touches authoritative project.
- WorkItem-origin review-only policy must not change direct Work or Prompt Stack promotion/Dope-owned checkpoints. Automatic completion and architecture adoption are prohibited.
- ProposedAction denied effects stay denied under fixed 8B profile; steering acknowledges actual capability and preserves cancellation/restart truth.
- Map impact uses changed paths and validated evidence for deterministic identity matches only; unknown/unmapped state explicit; no background model or Phase 10 drift engine.

## Qualification and exit

P9 integrated test must retain old direct/sequence behavior. P10 is manual T3; require live hosted Codex agent, disposable repository, real WorkItem two runs with accepted/rejected candidates, HUMAN/AI/SHARED evidence, steering truth, denied escalation, restart and map effects, one final complete `npm run check` and p8d validator. Record final GREEN or NOT GREEN without upgrading Phase 8/8E status. Prompt files are executed by the external runner but Dope product must not import that runner lifecycle.
