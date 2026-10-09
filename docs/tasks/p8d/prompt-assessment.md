# Phase 8D Prompt Assessment — General Scoped Delegation

Status: **OWNER APPROVED / READY FOR WRITTEN STACK**
Date: 2026-10-09
Starting version: `0.8.20`; assigned versions `0.8.21`–`0.8.30`
Authority: ADR 0031; Phase 8D plan; ADR 0017, 0027, 0028, 0029, 0030.

## Preserved behavior

- Visual Planning owns PlanningMap/WorkItem state. AgentTask remains the execution primitive for WorkItem-origin, direct Work and Prompt Stack tasks; do not require fake WorkItems for older entry paths.
- Candidate work stays in isolated ExecutionWorkspace, then ADR 0029 frozen Dope-owned validation and ADR 0028 Authority/ToolExecutor promotion. Initial grant denies delete/rename, Git writes/history, network/secrets/private/outside-root and system effects; no implicit widening.
- Direct Work in-grant promotion, Prompt Stack progression/Dope-owned checkpoints/manual gates, transcript, restart and independent Chat/Work module behavior remain unchanged.
- Project-local `.dope/planning-maps.json` and `.dope/agent/` remain independent durable stores. No guaranteed cross-store transaction; use stable IDs, revision guards and idempotent reconciliation.

## Decomposition and dependency order

1. P1 defines portable ownership, delegation links, review, actions and steering contract/migration before backend work (T1).
2. P2 connects WorkItem to one-or-many AgentTasks via revisioned service and durable idempotent linkage (T2).
3. P3 inserts frozen-candidate review hold after Dope-owned validation for WorkItem-origin tasks only (T2).
4. P4 implements explicit accept/reject/revalidate/Dope-owned promotion with exact replay protection (T2).
5. P5 adds consequential ProposedAction decision state while keeping denied effects ineligible (T1/T2).
6. P6 adds revision-checked durable steering and truthful safe-boundary capability handling (T2).
7. P7 links only applied accepted effects to bounded Software Map identities/staleness (T2).
8. P8 projects delegation/ownership/review/steering/map impact into existing Planning and Work UI (T1/T2).
9. P9 integrates adverse cases, restart and existing direct/sequence regression without full aggregate (T2).
10. P10 exclusively owns real reference-Codex GUI and exact-candidate T3 closeout (manual Browser yes).

## Design tensions

- Current WorkItem parser is strict; any extension requires explicit migration/defaulting without rewriting unrelated Planning basis.
- Current AgentRuntime has `origin: work-item` but no durable WorkItem launch/review/steer service. Add typed seam rather than new runtime.
- Fixed Phase 8B grant does not model broadened permissions; ProposedAction records requests but does not make denied actions executable.
- Existing direct Work auto-promotes in-grant candidates. Review hold must be origin/policy-selective or it regresses the qualified workflow.
- Provider interface has cancel/terminate but no guaranteed live steering capability. Report unsupported/queued honestly, preserving developer intent; do not inject unapproved live commands.
- Software Map evidence may not resolve every changed file to a stable ID. Explicit unknown is superior to fabricated map impact.
- WorkItem completion and Planning Target adoption/reconciliation are developer-controlled and cannot follow automatically from a run or review decision.

## Routing and validation economy

All prompts use **GPT-6 Sol High** because even presentation work consumes authority-sensitive shared state. Target <=8 minutes per T1/T2 implementation and <=15 minutes maximum; split implementation further only when measured necessity emerges, not speculatively. Each prompt states minimal affected test/build commands; P9 owns bounded cross-package T2, P10 the only full aggregate, validator and real GUI. P10 manual browser closeout is exactly one final closeout.

## Deferred

8E local coding-agent compatibility, Phase 9 DeveloperSessions, Phase 10 continuous source/docs/map background alignment, partial per-effect promotion, automatic permission escalation, arbitrary parallel/multi-agent orchestration.
