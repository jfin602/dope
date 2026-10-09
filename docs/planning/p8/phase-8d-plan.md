# Phase 8D — General Scoped Delegation Plan

Status: **ACTIVE / APPROVED FOR IMPLEMENTATION; NOT QUALIFIED**
Owner activation: 2026-10-09
Baseline: `0.8.20`; continuation: `0.8.21` through `0.8.30`
Execution folder: `docs/tasks/p8d/`
Authority: ADR 0031 and 0017/0027/0028/0029/0030; Product Model, Architecture, Stability, roadmap.

## Purpose and entry

Generalize qualified 8A–8C and Green c8-work-mode direct Work/Prompt Stack execution to developer-controlled WorkItem delegation, scoped HUMAN/AI/SHARED ownership, safe review/steering and bounded Software Map impact. Real Adaptive SEO Prompt Stack Green and c8-work-mode P9 Green at unchanged 0.8.20 clear the prerequisite; historical failures remain in their closeouts. Phase 8D is active but not implemented/qualified by that decision.

## Existing source boundaries (inspected 2026-10-09)

- `packages/visual-planning/src/index.ts` defines strict WorkItem and PlanningMap schema; `work.ts` owns WorkItem transition/split/merge, `service.ts` revisioned planning operations. WorkItem lacks delegated ownership/task links and review lifecycle.
- `packages/agent-core/src/contracts.ts` already accepts `AgentOrigin.kind: work-item` and optional `planningMapId` but has no complete WorkItem orchestration, typed steering or review hold. `authority.ts` enforces the fixed Phase 8B grant. `execution.ts` offers start/cancel/terminate, not guaranteed in-flight steering.
- `packages/contracts/src/agent-runtime-service.ts` exposes createTask/start/read/list/stop and Prompt Stack sequence operations but not WorkItem delegation/accept/reject/steering service operations. `packages/visual-planning/src/service.ts` remains a separate project-revisioned service.
- Theia backend Agent Runtime and Visual Planning adapters must be re-inspected for exact methods/tests before implementation. Keep Dope-owned frozen candidate validation, Promotion, Git/dirty state, provider-neutral transcripts and frontend project binding intact.

## Approved ordered stack

| Prompt | Version | Boundary | Tier | Model | Browser |
| --- | --- | --- | --- | --- | --- |
| P1 | 0.8.21 | WorkItem ownership/link plus review/action/steering portable contracts and migrations | T1 | GPT-6 Sol High | no |
| P2 | 0.8.22 | Planning WorkItem -> AgentTask delegation service; durable bidirectional linkage | T2 | GPT-6 Sol High | no |
| P3 | 0.8.23 | WorkItem candidate review hold after frozen Dope-owned validation | T2 | GPT-6 Sol High | no |
| P4 | 0.8.24 | Accept/reject; rechecks, Dope-owned promotion and replay safety | T2 | GPT-6 Sol High | no |
| P5 | 0.8.25 | Consequential ProposedAction lifecycle with fail-closed fixed grant | T1/T2 | GPT-6 Sol High | no |
| P6 | 0.8.26 | Typed steering and capability-aware acknowledgement/recovery | T2 | GPT-6 Sol High | no |
| P7 | 0.8.27 | Bounded Software Map impact and post-accept staleness | T2 | GPT-6 Sol High | no |
| P8 | 0.8.28 | Planning/Work delegation, ownership, review, steering and map-impact UI | T1/T2 | GPT-6 Sol High | no |
| P9 | 0.8.29 | Cross-package adverse-case/restart/direct-Work/Prompt-Stack regression | T2 | GPT-6 Sol High | no |
| P10 | 0.8.30 | Direct GUI/reference-Codex qualification, final evidence and closeout | T3 | GPT-6 Sol High | yes |

## Boundary laws

WorkItem is Visual Planning intent, AgentTask is execution. Developer explicitly launches bounded tasks; HUMAN and human-reserved SHARED paths cannot be agent-promoted even if the broad existing project grant permits writes. Derivation is immutable/revision-checked and a WorkItem can remain open after AgentRun completion. Keep PlanningMap at `.dope/planning-maps.json` and agent records at `.dope/agent/`, with idempotent link repair rather than a false atomic cross-store transaction.

Only WorkItem-origin tasks opt into review-before-promotion; direct Work and Prompt Stacks remain qualified under accepted in-grant promotion/checkpoint law. Freeze candidate, validate through ADR 0029 then await explicit developer approval/rejection. Accept rechecks candidate fingerprint, grant, delegated scope, project/Git basis and validation. Reject applies nothing, and duplicate/restarted decisions cannot double apply. Existing fixed-grant deny classes remain denied; ProposedAction cannot enlarge them.

Steering is versioned/persisted with pending/applied/rejected/unsupported acknowledgement and safe turn boundaries; unsupported live-steer is never claimed applied. Applied diffs link to affected Software Map identities/evidence and scoped staleness; unknown identity is reported, not invented. No automatic global synthesis or canonical mutation.

## Evidence and exclusions

P1 pure parsing/migration tests; P2 linkage stale revision/project isolation/duplicates/partial write recovery; P3-P4 frozen validation, negative reviews, intervening HEAD, denial, atomic promotion and restart; P5 denied consequential actions; P6 steering lifecycle and missing adapter capability; P7 changed-path/evidence and unknown IDs; P8 narrow panels, keyboard/focus, provenance and restart; P9 full affected integrations and legacy direct/Prompt Stack regression. P10 alone owns real GUI/T3 with reference hosted Codex, actual candidate/validation, at least two WorkItem-derived tasks, accept/reject, HUMAN/AI/SHARED, escalation-denied, steering truth, map impact and restart, plus one exact-candidate `npm run check` and `npm run codex:phase:validate -- p8d`. Failed prerequisites are Not Green; no fabricated live evidence.

Ordinary prompts target <=8 minutes and a 15-minute maximum, use one appropriate affected test/build group and `git diff --check`, not repeated aggregate tests. No extra session/local-model/multi-agent/Phase-10 work; Phase 8E and full Phase 8 closure are separate owner decisions.
