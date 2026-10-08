# Product Phase 8C — Sequential Task / Phase-Stack Execution Plan

Status: **APPROVED / CURRENT SLICE**
Date: 2026-10-06
Execution folder: `p8c`
Starting product version: `0.8.13`
Expected first implementation version: `0.8.14`
Qualified 8B product/test source: `bd0b6ff`
8B docs-only closeout: `c11756e`
Primary authority: ADR 0027, ADR 0028, PRODUCT-MODEL, ARCHITECTURE, Phase 8 roadmap/plan, repository workflow

## Entry state

Phase 8B is Green / Qualified for the corrected direct AgentTask scope.

Retained substrate:
- AgentTask / AgentRun / ExecutionGrant;
- Coding Agent role resolution and exact targeting;
- isolated ExecutionWorkspace;
- CandidateDelta classification;
- Dope-owned authoritative promotion;
- validation/change evidence;
- cancellation/restart interruption;
- project-local Agent state;
- Agent Run UI.

8C must consume these contracts rather than create a second execution path.

## Goal

Replace the high-value sequential behavior of the external phase runner inside Dope while keeping the external runner as development tooling and behavioral reference.

A developer can import a real phase/correction prompt stack, execute implementation prompts sequentially through Agent Runtime, receive Dope-owned checkpoint commits, stop at manual/browser gates, restart the application and resume safely from durable state plus Git truth.

## AgentTaskSequence

Add a strict versioned provider-neutral sequence contract.

Minimum state:
- stable sequence ID/schema/revision;
- createdAt;
- canonical project identity/root reference;
- source stack project-relative path;
- source stack fingerprint;
- normalized immutable imported prompt snapshot;
- mode: phase/correction;
- phase/folder identity;
- version policy;
- ordered sequence entries;
- generated AgentTask IDs where executable;
- AgentRun IDs by attempt;
- checkpoint SHA by completed executable task;
- status and current entry;
- current accepted HEAD/version/worktree basis;
- explicit dirty-tree basis when opted in;
- manual-gate state;
- blocked/failure/interruption reason;
- timestamps/revision needed for safe persistence.

Sequence state never treats provider-native thread IDs as identity.

## PhaseStackAdapter

Consume the existing task grammar without shelling out to the runner. Preserve contiguous P1..Pn, exactly one final closeout, phase/correction mode, target-version progression or unchanged correction version, recommended GPT-6 Sol configuration/reasoning, Browser required yes/no, task title and prompt body.

Prefer extracting/sharing pure grammar from `scripts/codex-phase-core.mjs` if ownership/dependency direction stays clean. Do not import Node runner process lifecycle into product domain.

Import snapshots the normalized stack and stores a deterministic fingerprint. Later source changes do not rewrite an active sequence.

## Persistence

Project-local:

```text
.dope/agent/
  sequences/<sequence-id>.json
  tasks/...
  runs/...
```

Requirements: atomic/serialized updates, strict parser/versioning, safe project containment, corruption/future schema fails closed without rewriting evidence, copying the project preserves sequence history, and no tokens/hidden reasoning/arbitrary env/raw provider payloads.

## Resume truth

At import/start/reopen/resume, reconcile sequence state with reachable Git history, stored checkpoint SHAs, current HEAD, root package version, expected stack version progression, authoritative worktree basis and source stack fingerprint.

Git proves checkpoint reality. Sequence persistence explains imported intent/progress. Neither may silently overwrite the other. Block on ambiguity.

Reuse/extract the external runner's completed-prefix behavior where appropriate, including missing earlier prompt with later matching checkpoint, duplicate ambiguous correction checkpoint, phase version mismatch and correction unchanged-version mismatch.

## Dirty-tree policy

Default: require clean worktree before starting the next sequence task.

Explicit developer dirty-tree continuation captures the exact accepted dirty basis before task, shows that checkpoint ownership will include those accepted changes if the task succeeds, derives ExecutionWorkspace from that exact basis, does not reinterpret later unrelated dirty changes as accepted, and blocks if external worktree changes invalidate the owned basis before checkpoint.

## Task execution

For each executable entry: reconcile truth; create/load phase-stack-origin AgentTask; preserve imported model/reasoning metadata; require compatible ExecutionGrant/hosted authorization; run through qualified 8B Agent Runtime; collect terminal run/validation/promotion evidence; enter checkpoint only if Green; otherwise stop at the same entry.

One active sequence mutation task per project is sufficient.

## Capacity retry

8C owns bounded retry for narrowly recognized provider capacity failures. Reuse the same sequence entry / AgentTask and preserve the same ExecutionWorkspace/partial candidate work when safe. Do not promote/checkpoint between attempts. Stop interrupts retry wait. Exhaustion blocks the sequence with evidence and no authoritative promotion. Do not turn arbitrary provider failure into retry/fallback.

## Checkpoint ownership

8C is the first product slice allowed to perform Git stage/commit for the phase-stack workflow.

Checkpoint preconditions: expected pre-task HEAD unchanged; AgentRun completed; authoritative promotion succeeded; required validation passed; package version correct; internal version references coherent; no forbidden root lock; accepted worktree/checkpoint scope exact; no ambiguous external Git/worktree change.

Checkpoint scope is authorized task-applied files plus explicitly accepted pre-existing dirty-basis changes. Exclude `.dope/agent/**` runtime metadata from ordinary implementation commits. Do not use ambient `git add -A` without scope verification.

Commit subject: Phase = exact target version. Correction = `<stack-folder>/P<n>: <task title>`.

Commit body is a bounded Dope-owned summary based on task/run/validation/applied evidence. Do not copy raw model final response as authoritative Git metadata.

Verify resulting commit and HEAD before recording checkpoint and advancing.

## Manual/browser and closeout gates

Imported `Browser required: yes.` entries are manual gates. The final closeout entry is always manual for 8C.

Manual-gate state retains the exact snapshotted prompt and expected version/model metadata. Resume after a manual gate requires external evidence expressed through repository/Git/version truth. A UI Resume action never fabricates completion. No later prompt starts while the gate is unresolved.

## Restart

On backend/application restart: reconcile stale AgentRun first; load sequence; re-read stack source fingerprint; re-read Git/version/worktree; verify stored checkpoints; identify exactly one safe next state. Do not auto-run merely because the application reopened. No duplicate checkpoint may be created for an already completed entry.

## UI

Add the smallest sequence workbench surface over stable contracts: import/open stack; sequence/task list; current task/manual gate; task model/reasoning/version; current status; Git/version basis; checkpoint SHA; Start/Resume/Stop; blocked reason; validation/checkpoint result.

Reuse Agent Run details rather than duplicating activity/diff/event presentation.

## Qualification

Focused/T2: parser/import; sequence schema/store; resume reconciliation; capacity retry; dirty-basis handling; checkpoint scope/commit; manual gate state; UI wiring.

T3 closeout: real Dope stack; at least two automated implementation tasks; real Dope-owned checkpoint commits; real manual/browser gate; application restart and same-gate reopen; external/manual checkpoint reconciliation and safe resume; validation failure; cancellation; authority block; capacity retry; unexpected HEAD movement; explicit dirty-tree continuation; source-stack drift; duplicate-checkpoint prevention.

## Non-goals

Do not implement WorkItem -> AgentTask delegation; HUMAN/AI/SHARED ownership UX; rich ProposedAction escalation/review; DevelopmentSession; local-agent compatibility qualification; continuous knowledge alignment; multi-agent orchestration; generic Git client replacement.

## Exit condition

8C is Green when a real phase/correction stack can execute sequentially inside Dope using the qualified 8B authority path, create verified Dope-owned checkpoints, stop honestly at failures/manual gates, and reopen/resume from durable sequence state plus Git truth without duplicate or ambiguous execution.


## Post-closeout amendment — external candidate-validation generalization gate (2026-10-08)

Phase 8C remains historically **GREEN / QUALIFIED / CLOSED** for the exact `0.8.20` fixture recorded in `docs/tasks/p8c/closeout.md`.

Later real Adaptive SEO dogfooding exposed a broader project-validation requirement that the original fixture did not exercise. Adaptive SEO's authoritative source passes `npm run check`; the same candidate source fails when required validation is constrained to the Coding Agent provider sandbox because its unit suite legitimately needs temporary filesystem state and an ephemeral loopback HTTP fixture.

This does not authorize widening the provider sandbox. ADR 0029 introduces a separate Dope-owned CandidateValidationRunner over a frozen candidate, with bounded private temp and private-loopback capabilities and durable terminal validation evidence.

Sequencing is therefore:

```text
historical Phase 8C closeout
-> c8-candidate-validation
-> resume real Adaptive SEO c4-dope-phase-stack-smoke qualification
-> Green
-> Phase 8D
```

The failed external qualification loops remain retained evidence. No P1 checkpoint was created before this architecture stop, and P2-P4/manual-restart gates remain unqualified in that external project until the resumed smoke run clears them.

## Post-closeout amendment — Prompt Stack and Work presentation (2026-10-08)

The real Adaptive SEO `c4-dope-phase-stack-smoke` Prompt Stack qualified **GREEN in Cycle 2 of 5**, including Dope-owned P1/P2 checkpoints, P3 browser/manual 48/48, P4 closeout, restart and completed reopen. The earlier architecture-stop Cycle 1 remains Not Green evidence. The Phase 8C original fixture closeout also remains historically Green for its exact source.

**Prompt Stack** is the canonical user-facing name for both phase and correction stacks; phase/correction remains version/checkpoint metadata. The former Phase Stack workflow is displayed under **Work** mode. Select Work auto-discovers project-local Prompt Stacks from `docs/tasks/` by default, without reintroducing a user-facing Import Stack lifecycle. Work detail projects existing AgentTaskSequence, task, run and manual-gate truth. It derives its title from the snapshotted entry title and must not rename historical runs when the sequence advances.

No stack source grammar, fingerprint, durable sequence ID, checkpoint subject, accepted dirty basis, Git/version reconciliation, authority, manual gate or historical evidence changes. Legacy Phase Stack commands and links should route compatibly to Work. This post-closeout presentation correction is `c8-work-mode`, not a requalification/rewrite of the original 8C authority contract.
