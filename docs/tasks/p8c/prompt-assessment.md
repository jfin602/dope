# Phase 8C Prompt Assessment — Sequential Task / Phase-Stack Execution

Status: **APPROVED FOR PROMPT WRITING**
Date: 2026-10-06
Starting version: `0.8.13`
Planned versions: `0.8.14` through `0.8.20`

## Preserved behavior

- Phase 8B AgentTask/AgentRun/ExecutionGrant identity and persistence remain canonical.
- ADR 0028 remains the only mutation path: provider -> ExecutionWorkspace -> CandidateDelta -> Authority/ToolExecutor -> authoritative project.
- Coding Agent role/exact target semantics, no billing fallback, sandbox host ceiling, cancellation and restart truth remain unchanged.
- External `scripts/codex-phase*.mjs` remains development tooling and behavioral reference, not product runtime.

## Required 8C capabilities

1. Provider-neutral AgentTaskSequence with strict schema/state transitions.
2. PhaseStackAdapter matching existing prompt grammar and version rules.
3. Immutable imported stack snapshot/fingerprint so source drift cannot silently rewrite active work.
4. Durable `.dope/agent/sequences/` persistence.
5. Git/version/worktree reconciliation that blocks ambiguous resume.
6. Explicit clean-vs-dirty start semantics.
7. Sequential AgentTask execution through the qualified 8B runtime.
8. Narrow bounded capacity retry preserving same task/workspace candidate state.
9. Dope-owned scoped stage/commit checkpoint after promotion/validation.
10. Manual/browser and final closeout gates.
11. Restart/reopen without duplicate task execution or duplicate commits.
12. Small workbench UI over the sequence domain.

## Key risks

- Sequence state vs Git truth: persisted progress can become stale after external history changes. Never trust either representation alone.
- Dirty-tree attribution: pre-existing developer changes must be explicitly accepted and fingerprinted; unrelated later changes must block checkpoint.
- Checkpoint scope: the external runner uses broad staging behavior; the product must stage only owned/accepted files and exclude `.dope/agent/**` runtime state.
- ExecutionWorkspace basis: qualified 8B currently assumes a clean Git-derived basis. 8C must extend it deliberately for explicitly accepted dirty state without bypassing promotion safety.
- Capacity retry: retry must reuse the same logical task/workspace only for narrowly recognized capacity failures and must not promote partial work between attempts.
- Manual gates: UI actions cannot substitute for browser/manual evidence; continuation is proven through external Git/version truth.
- Prompt source drift: imported stack changes after sequence creation must block rather than reinterpret history.
- Checkpoint duplication: restart/resume must detect a recorded/reachable checkpoint before any new commit attempt.

## Prompt decomposition

### P1 — T1 — Domain + import
Add AgentTaskSequence contracts/state plus PhaseStackAdapter parser/import snapshot. Pure/provider-free.

### P2 — T2 — Persistence + reconciliation
Persist sequences and reconcile sequence/Git/version/worktree/stack truth. No execution yet.

### P3 — T2 — Sequential execution + retry
Create phase-stack AgentTasks, drive the existing runtime one task at a time, add bounded capacity retry and stop-on-failure.

### P4 — T2 — Dirty basis + checkpoint authority
Extend ExecutionWorkspace/start basis for explicit dirty continuation and implement exact-scope Dope-owned checkpoint commits.

### P5 — T2 — Manual/browser gates
Persist and reconcile browser/manual/final closeout gates, including safe external completion recognition.

### P6 — T1/T2 — UI
Add a minimal sequence workbench that reuses Agent Run detail.

### P7 — T3 — Qualification
Real Dope stack with two implementation checkpoints, manual gate, restart/resume and adversarial sequence/Git cases.

## Model routing

P1-P5 and P7 use GPT-6 Sol High because they change durable execution, authority, Git or restart semantics. P6 uses GPT-6 Sol Medium because it is presentation over stable contracts.

## Deferred

- WorkItem -> AgentTask/Sequence delegation and rich ProposedAction review: 8D.
- Local coding-agent compatibility: 8E.
- DevelopmentSession: Phase 9.
- Continuous alignment: Phase 10.
