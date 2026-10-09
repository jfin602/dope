# Phase 8D — General Scoped Delegation Plan

Status: **ACTIVE / P13 NOT GREEN — IMPLEMENTATION COMMITTED THROUGH P12; FINAL QUALIFICATION FAILED**
Owner activation: 2026-10-09
Baseline: `0.8.20`; continuation: `0.8.21` through `0.8.33`
Execution folder: `docs/tasks/p8d/`
Authority: ADR 0031 and 0017/0027/0028/0029/0030; Product Model, Architecture, Stability, roadmap.

## Purpose and entry

Generalize qualified 8A–8C and Green c8-work-mode direct Work/Prompt Stack execution to developer-controlled WorkItem delegation, scoped HUMAN/AI/SHARED ownership, safe review/steering and bounded Software Map impact. Real Adaptive SEO Prompt Stack Green and c8-work-mode P9 Green at unchanged 0.8.20 clear the prerequisite; historical failures remain in their closeouts. Owner activation alone did not qualify 8D. P1–P12 implementation later landed in committed source at `0.8.32`; the reported P13 GUI/aggregate gate remained Not Green. See current status and outstanding gates below.

## Current implemented-versus-qualified status (2026-10-09)

P13 (2026-10-09) is **NOT GREEN**, based on the owner's uncommitted local `0.8.33` qualification report. The committed GitHub code reaches P12 at `0.8.32` (`09fe3bcd`). Task creation/reopen is observed; no existing-task Start action or WorkItem-approved validation policy is wired end to end, so real Codex execution and downstream acceptance, review, steering, ProposedAction, map impact and held-review restart are unqualified. `npm run check` did not pass on the P13 candidate. Local `docs/tasks/p8d/closeout.md` and its logs/snapshots are **not present in the reviewed GitHub tree**; do not infer their hashes, commit their contents, or treat the doc alignment as P13 repair.

### Explicit outstanding P13 qualification gates

1. **Launch existing AgentTask:** Planning `Launch Work` currently calls `launchWorkItem` to persist an AgentTask. Its Work detail presents pending-task instructions but has no explicit **Start task** control; the New Work composer creates a *different direct* AgentTask. Wire a developer-controlled accepted ExecutionGrant and real `AgentRuntimeService.start` to the **persisted WorkItem-origin task ID**, preserving the fixed authority ceiling and existing direct Work/Prompt Stack paths.
2. **Validation contract:** Planning `launchWork()` currently supplies `completion: { validation: [], requireValidationPass: false }`. `workReviewCanAccept` and backend acceptance require at least one matching passed Dope-owned validation target. Add explicit developer-approved validation configuration at WorkItem task start or earlier, enforce nonempty required validation without weakening the review gate; do not silently turn acceptance into a no-validation operation.
3. **Real execution and review:** Qualify real Codex AgentRun, sandboxed candidate creation, frozen fingerprint, Dope-owned validation, held review, explicit accepted and rejected candidates, authoritative project-scope effects, restart/reopen, ProposedAction denial, steering truth and affected-map receipt using a disposable Git project. A persisted task is not a run.
4. **Exact-candidate aggregate:** Repair the reported baseline test blocker without suppressing tests, then achieve one passing `npm run check` on the final exact source candidate (including product and Electron stages). Preserve failed observations and avoid claiming passing aggregate from focused tests or browser build. Final P13 closeout must establish exact source SHA/diff identity; local `0.8.33` is not yet committed.
5. **Historical preservation / progression:** Preserve 8A–8C, `c8-work-mode`, the completed Adaptive SEO Prompt Stack and the developer's local P13 evidence. Do not activate 8E or relabel 8D Green until *all* required P13 gates are verified.

## Historical starting-source boundaries (pre-P1, inspected 2026-10-09)

- `packages/visual-planning/src/index.ts` defines strict WorkItem and PlanningMap schema; `work.ts` owns WorkItem transition/split/merge, `service.ts` revisioned planning operations. WorkItem lacks delegated ownership/task links and review lifecycle.
- `packages/agent-core/src/contracts.ts` already accepts `AgentOrigin.kind: work-item` and optional `planningMapId` but has no complete WorkItem orchestration, typed steering or review hold. `authority.ts` enforces the fixed Phase 8B grant. `execution.ts` offers start/cancel/terminate, not guaranteed in-flight steering.
- `packages/contracts/src/agent-runtime-service.ts` exposes createTask/start/read/list/stop and Prompt Stack sequence operations but not WorkItem delegation/accept/reject/steering service operations. `packages/visual-planning/src/service.ts` remains a separate project-revisioned service.
- Theia backend Agent Runtime and Visual Planning adapters must be re-inspected for exact methods/tests before implementation. Keep Dope-owned frozen candidate validation, Promotion, Git/dirty state, provider-neutral transcripts and frontend project binding intact.

## Approved ordered stack — 8-minute optimization (2026-10-09)

The original P1 combined too many contracts and P8 combined several GUI workflows; they were split into separate coherent implementation seams. P1–P11 target <=8 minutes including their necessary focused testing (15-minute maximum); P12 is the bounded T2 integration gate; P13 is the sole manual T3 GUI/real-Codex qualification gate.

| Prompt | Version | Scope | Tier | Model | Browser |
| --- | --- | --- | --- | --- | --- |
| P1 | 0.8.21 | WorkItem ownership and migration | T1 | GPT-6 Sol Medium | no |
| P2 | 0.8.22 | AgentTask delegation metadata | T1 | GPT-6 Sol High | no |
| P3 | 0.8.23 | Revision-safe task creation and derived inverse links | T2 | GPT-6 Sol High | no |
| P4 | 0.8.24 | Validated candidate review hold | T2 | GPT-6 Sol High | no |
| P5 | 0.8.25 | Review accept/reject and promotion | T2 | GPT-6 Sol High | no |
| P6 | 0.8.26 | Blocked ProposedAction records | T1 | GPT-6 Sol High | no |
| P7 | 0.8.27 | Durable safe steering acknowledgement | T2 | GPT-6 Sol High | no |
| P8 | 0.8.28 | Bounded Software Map impact receipt | T2 | GPT-6 Sol High | no |
| P9 | 0.8.29 | Planning delegation UI | T1 | GPT-6 Sol Medium | no |
| P10 | 0.8.30 | Work candidate review UI | T1 | GPT-6 Sol Medium | no |
| P11 | 0.8.31 | Work steering/action/impact UI | T1 | GPT-6 Sol Medium | no |
| P12 | 0.8.32 | Focused integration/regression and test registration | T2 | GPT-6 Sol High | no |
| P13 | 0.8.33 | Real GUI/agent closeout | T3 | GPT-6 Sol High | yes |

Changed-package build only when compiled `lib/` is required by focused tests; no blanket `build:extension`, root `npm test`, `npm run check`, browser/Electron build, package/install or broad restart suite in P1–P12. P12 adds new test files to existing `test:product` once. P13 runs one exact-candidate `npm run check` which already builds/types/checks and tests, with only tests omitted from that command separately (ideally none). Cheap `git diff --check` stays. No security checks may be skipped merely to fit a time budget.

The AgentTask WorkItem origin/snapshot is the canonical persisted link; query AgentStore for inverse WorkItem task lists to avoid duplicate mutable cross-store pointers.

## Boundary laws

WorkItem is Visual Planning intent, AgentTask is execution. Developer explicitly launches bounded tasks; HUMAN and human-reserved SHARED paths cannot be agent-promoted even if the broad existing project grant permits writes. Derivation is immutable/revision-checked and a WorkItem can remain open after AgentRun completion. Keep PlanningMap at `.dope/planning-maps.json` and agent records at `.dope/agent/`, with idempotent link repair rather than a false atomic cross-store transaction.

Only WorkItem-origin tasks opt into review-before-promotion; direct Work and Prompt Stacks remain qualified under accepted in-grant promotion/checkpoint law. Freeze candidate, validate through ADR 0029 then await explicit developer approval/rejection. Accept rechecks candidate fingerprint, grant, delegated scope, project/Git basis and validation. Reject applies nothing, and duplicate/restarted decisions cannot double apply. Existing fixed-grant deny classes remain denied; ProposedAction cannot enlarge them.

Steering is versioned/persisted with pending/applied/rejected/unsupported acknowledgement and safe turn boundaries; unsupported live-steer is never claimed applied. Applied diffs link to affected Software Map identities/evidence and scoped staleness; unknown identity is reported, not invented. No automatic global synthesis or canonical mutation.

## Evidence and exclusions

P1/P2 targeted contract tests, P3 bounded delegation service test, P4/P5 frozen validation and accept/reject tests, P6 blocked action test, P7 steering test, P8 map impact test, P9–P11 focused UI/controller tests. P12 covers bounded cross-system, restart/scope/authority and direct Work/Prompt Stack regressions and registers new tests in `test:product`. P13 alone owns direct hosted Codex/Dope GUI qualification, two WorkItem-derived tasks with accepted/rejected candidates, HUMAN/AI/SHARED, denied escalation, steering, map impact/restart, one exact-candidate `npm run check` and one `npm run codex:phase:validate -- p8d`. Failed prerequisites are Not Green; no fabricated live evidence.

Ordinary prompts target <=8 minutes and a 15-minute maximum, use one appropriate affected test/build group and `git diff --check`, not repeated aggregate tests. No extra session/local-model/multi-agent/Phase-10 work; Phase 8E and full Phase 8 closure are separate owner decisions.
