# Phase 8D — General Scoped Delegation Plan

Status: **ACTIVE / APPROVED FOR IMPLEMENTATION; NOT QUALIFIED**
Owner activation: 2026-10-09
Baseline: `0.8.20`; continuation: `0.8.21` through `0.8.33`
Execution folder: `docs/tasks/p8d/`
Authority: ADR 0031 and 0017/0027/0028/0029/0030; Product Model, Architecture, Stability, roadmap.

## Purpose and entry

Generalize qualified 8A–8C and Green c8-work-mode direct Work/Prompt Stack execution to developer-controlled WorkItem delegation, scoped HUMAN/AI/SHARED ownership, safe review/steering and bounded Software Map impact. Real Adaptive SEO Prompt Stack Green and c8-work-mode P9 Green at unchanged 0.8.20 clear the prerequisite; historical failures remain in their closeouts. Phase 8D is active but not implemented/qualified by that decision.

## Existing source boundaries (inspected 2026-10-09)

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
