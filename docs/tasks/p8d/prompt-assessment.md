# Phase 8D Prompt Assessment — Eight-minute optimization

Status: **HISTORICAL PRE-EXECUTION OPTIMIZATION REVIEW; P13 NOW NOT GREEN**
Date: 2026-10-09. Baseline `0.8.20`; P1-P13: `0.8.21`–`0.8.33`.

This assessment is the original prompt-efficiency plan; it is not a current qualification result. P1–P12 are committed at `0.8.32` (`09fe3bcd`). The owner reports P13 at an uncommitted local `0.8.33` as Not Green due to missing saved-WorkItem-task Start control, missing nonempty Dope validation policy, and no passing full aggregate. Preserve the original assessment as planning history and refer to the roadmap/8D plan for current truth.

The original P1 overloaded WorkItem migration with Action/Steering/Review contracts; the old P8 overloaded Planning launch, Work candidate review and steering/action/impact UI. Split those into P1/P2 and P9/P10/P11. No capability removed and no new permission granted. P12 owns integration; P13 owns real reference-agent GUI and aggregate.

- P1 (T1, Sol Medium): WorkItem ownership schema and legacy defaults
- P2 (T1, Sol High): AgentTask WorkItem origin and review metadata
- P3 (T2, Sol High): Revision-safe WorkItem to AgentTask launch service
- P4 (T2, Sol High): WorkItem frozen candidate review hold
- P5 (T2, Sol High): Explicit safe candidate accept or reject
- P6 (T1, Sol High): Blocked ProposedAction records without new permission
- P7 (T2, Sol High): Durable steering with truthful acknowledgement
- P8 (T2, Sol High): Bounded applied-change Software Map impact
- P9 (T1, Sol Medium): Planning WorkItem ownership and launch UI
- P10 (T1, Sol Medium): Work candidate review diff and accept/reject UI
- P11 (T1, Sol Medium): Work steering, blocked action and map impact UI
- P12 (T2, Sol High): Focused delegation integration and legacy regression
- P13 (T3, Sol High): Phase 8D live GUI qualification and closeout

## Test/build economy and preservation
P1–P11: <=8-minute implementation + necessary focused validation target, 15-minute maximum. Run only tests added/changed and directly affected existing tests. Unit tests commonly import compiled `lib/`, so one build of **changed** packages is necessary when tests otherwise run stale output. No unconditional `build:extension`, root tests/typecheck, browser/Electron builds, packaging or restart suite. P12: bounded cross-package integration, register new test files in the existing `test:product` list. P13: manual T3 and **one** exact-candidate `npm run check` (already builds and tests); no additional `npm test` or repeated build. `git diff --check` remains cheap. All failures remain truthful.

WorkItem-origin snapshot on AgentTask is the canonical linkage; inverse WorkItem->task query is derived from AgentStore rather than duplicated mutable cross-store state.

Sol Medium for narrow pure-schema/UI prompts, Sol High for authority, persistence, orchestration, integration and final qualification. Direct Work/Prompt Stacks, fixed grant, Dope-owned frozen validation, explicit WorkItem completion and bounded Software Map impact remain invariant. No Phase 8E, Phase 9 or Phase 10 pull-forward. Exact times are targets, not measured guarantees.
