# Phase 8C Implementation Plan — Sequential Task / Phase-Stack Execution

Status: **READY FOR EXECUTION**
Starting version: `0.8.13`
Execution folder: `p8c`

## Existing producers / consumers

- `scripts/codex-phase-core.mjs`: behavioral reference for grammar, version progression, completed-prefix detection, capacity retry and commit subjects.
- `@dope/agent-core`: AgentTask/AgentRun/ExecutionGrant/CandidateDelta and node persistence/execution-workspace primitives.
- `AgentExecutionRuntime`: qualified direct-run lifecycle and ADR 0028 promotion.
- `AgentRuntimeBackend` / `AgentRuntimeService`: current frontend/backend task/run boundary.
- Agent Run controller/widget: existing task/run observability surface.

Do not make product code depend on the external runner process.

## Proposed ownership

`@dope/agent-core`: AgentTaskSequence contracts/parsers/state transitions; normalized PhaseStack snapshot contracts/parser helpers; provider-free sequence reconciliation decisions; node sequence store; dirty-basis/checkpoint-scope value objects and pure validation.

`@dope/contracts`: sequence frontend/backend DTO/service boundary.

`@dope/theia-extension` node: PhaseStack file loading/import adapter; sequence coordinator over AgentExecutionRuntime; Git history/version/worktree evidence; bounded capacity retry timing; Dope-owned staging/commit/checkpoint verification; manual gate reconciliation.

`@dope/theia-extension` browser: sequence controller/widget/contribution; reuse Agent Run details/events where practical.

## P1 — 0.8.14 — AgentTaskSequence + import — T1

Create strict sequence and imported-entry contracts. Implement phase/correction prompt grammar equivalent to current runner rules without importing runner process lifecycle. Snapshot exact normalized prompt content and deterministic fingerprint. Browser-required entries and final closeout classify as manual gates. Tests cover grammar/version/closeout/model/browser rules and stack fingerprint drift.

## P2 — 0.8.15 — Persistence + resume reconciliation — T2

Persist `.dope/agent/sequences/<id>.json` atomically with locking/serialization. Add Git/version/worktree/stack reconciliation. Detect completed prefix from stored checkpoint SHAs plus reachable history; never infer a later task complete over a missing earlier task. Corrupt/future state fails untouched. Add service operations for create/import/read/list/reconcile.

## P3 — 0.8.16 — Sequence coordinator + capacity retry — T2

Drive only the current executable sequence entry through AgentExecutionRuntime. Create phase-stack-origin AgentTask from snapshotted prompt metadata. Stop on run failure/cancel/interruption/authority block. Add narrow capacity retry with same task/workspace candidate state; no promotion/checkpoint between attempts. Competing sequence/direct mutation runs remain rejected.

## P4 — 0.8.17 — Dirty basis + checkpoint authority — T2

Extend 8B's clean-only execution workspace/basis path to explicitly accepted dirty state. Snapshot exact dirty files/hashes/status before task and derive execution workspace from those bytes safely. After Green promotion/validation, compute exact checkpoint scope = accepted dirty basis + task-applied authoritative files. Detect unrelated later worktree changes and fail closed. Stage only exact scope, exclude `.dope/agent/**`, enforce version/root-lock/internal-reference invariants, commit with deterministic subject/body, verify HEAD/commit, then record checkpoint.

## P5 — 0.8.18 — Manual/browser gates — T2

Persist waiting-manual state for Browser-required entries and final closeout. Surface exact snapshotted prompt. Do not execute it through Coding Agent. Resume requires Git/version/checkpoint evidence consistent with the gate and next entry. Detect external completion without trusting a button press. Restart preserves the same gate.

## P6 — 0.8.19 — Sequence workbench — T1/T2

Add Import/Open Stack and sequence list/current state over the stable service. Show entries, model/reasoning/version, manual gate, checkpoint SHA, Git/version basis, blocked reason, Start/Resume/Stop. Reuse Agent Run detail rather than duplicate activity/diff logic. No DevelopmentSession/WorkItem UX.

## P7 — 0.8.20 — T3 closeout

Use a real Dope stack with a real eligible hosted Coding Agent. Require two automated implementation tasks with Dope-owned commits, stop at real browser/manual gate, restart/reopen same gate, reconcile an externally completed manual checkpoint and resume. Directly qualify validation failure, cancellation, authority block, capacity retry, unexpected HEAD movement, dirty continuation, stack-source drift and duplicate-checkpoint prevention.

## Validation economy

P1 uses focused pure tests/build. P2-P5 run only affected integration surfaces. P6 runs focused browser/controller tests and affected build. P7 alone owns full `npm run check`, stack validator and live/native/browser dogfood.
