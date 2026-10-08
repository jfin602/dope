# ADR 0028 — Isolated agent execution and authoritative mutation boundary

Status: Accepted
Date: 2026-10-06
Complements: ADR 0003, ADR 0004, ADR 0006, ADR 0027
Supersedes: the Phase 8B assumption that a provider sandbox may write the authoritative project root directly when its coarse sandbox appears to match the ExecutionGrant

## Context

Phase 8B qualification stopped after Cycle 1 with a real authority-enforcement contradiction.

The reference Codex sandbox could be made to start by restoring read visibility for its resolved executable while retaining the intended filesystem/network profile. In that executing sandbox:
- ordinary project writes succeeded;
- tested outside-project, private-state, Git-control, project-secret, network and system canaries were denied;
- deletion of a tracked file inside the writable project succeeded.

The fixed Phase 8B grant simultaneously allowed project workspace mutation and denied destructive project effects. A raw filesystem `write` capability cannot reliably distinguish "modify this project file" from "delete this project file". Prompt instructions and post-hoc provider narration are not authority enforcement.

This exposes a broader architectural mismatch with ADR 0003 and ARCHITECTURE.md: the provider had been given direct write access to developer-owned project state even though Dope's intended authority path places authoritative effects behind Dope-owned Authority and ToolExecutor.

## Decision

### Provider execution is candidate work, not authoritative mutation

A mutation-capable AgentExecutionAdapter runs against an isolated **ExecutionWorkspace**, not the authoritative developer project root.

The ExecutionWorkspace is a disposable or recoverable execution view derived from an immutable starting project basis. Its implementation may be a copy, overlay, snapshot, worktree-like substrate without authoritative Git control, or another equivalent isolation mechanism. The product contract is behavioral:

- provider/model file writes and project-local processes target the ExecutionWorkspace;
- provider/model processes cannot write the authoritative project root;
- provider/model processes remain bounded by coarse host-security rules for network, secrets/private state, outside-workspace effects, Git control, system/package administration and other host effects;
- operations such as create, modify, rename and delete may occur inside the ExecutionWorkspace because they are not yet authoritative project effects.

The provider may destroy disposable execution state. It may not thereby destroy developer-owned project state.

### CandidateDelta is the promotion boundary

After execution, Dope deterministically compares the ExecutionWorkspace with its starting basis and produces a provider-neutral **CandidateDelta**.

CandidateDelta classifies authoritative project effects explicitly, at minimum:
- create;
- modify;
- delete;
- rename/move when deterministically proven.

If rename/move cannot be proven safely, classification is conservative. It may degrade to create + delete rather than invent identity.

CandidateDelta is evidence/proposed work. It is not automatically applied project truth.

### ExecutionGrant authorizes authoritative effects explicitly

ExecutionGrant remains the useful one-time approval boundary, but its mutation semantics are split into two layers.

Execution-workspace authority:
- read/write/process/test/build inside the isolated workspace: allowed for the initial coding task;
- network: denied;
- secrets/private user state: denied;
- outside-execution-workspace effects: denied;
- authoritative Git control/history writes: denied;
- system/package-administration effects: denied.

Authoritative project promotion:
- create: allowed by the initial Phase 8B grant;
- modify: allowed by the initial Phase 8B grant;
- delete: denied by default;
- rename/move: denied by default;
- Git write/history mutation: denied in 8B.

A generic `project-write` bit plus an independent `destructive=false` bit is not a sufficient authoritative permission model and must not remain the final 8B contract.

### Dope owns promotion

Only Dope-owned Authority + ToolExecutor may promote CandidateDelta effects into the authoritative project.

Before promotion Dope must:
- validate project/path containment and reject symlink/path escape;
- verify the authoritative project still matches the accepted starting basis for affected paths and required Git identity;
- classify the complete candidate delta;
- verify every authoritative effect is allowed by the accepted ExecutionGrant.

For the initial 8B correction, promotion is **all-or-blocked at the candidate-delta authority gate**: if any candidate effect is outside the grant, Dope promotes none of the candidate delta and records the blocked effects. This avoids silently applying only a subset of a model-generated change whose validation may depend on the rejected portion.

If the complete delta is authorized, ToolExecutor applies only the classified create/modify effects using Dope-owned filesystem operations and records applied-change evidence. 8B still does not stage or commit.

Richer per-effect escalation/partial acceptance may be added later through ProposedAction/review UX; it is not required to restore the 8B core.

### Validation basis is explicit

Provider/model commands executed inside the ExecutionWorkspace are observable candidate-work evidence. They may include tests or builds, but they do not satisfy a required Dope CompletionPolicy validation target merely because the provider reports or emits an equivalent command.

ADR 0029 adds the canonical required-validation boundary:

- provider execution finishes inside the isolated ExecutionWorkspace;
- Dope freezes candidate identity and derives CandidateDelta;
- Dope-owned CandidateValidationRunner executes required validation against an isolated ValidationWorkspace derived from that frozen candidate;
- required validation must reach a durable terminal result;
- promotion remains blocked unless required validation passes and the frozen candidate identity is unchanged;
- Authority + ToolExecutor remain the only authoritative promotion path.

The provider sandbox remains unchanged and restrictive. CandidateValidationRunner has a separate, bounded local-test profile that may provide private temporary storage and private loopback networking without granting LAN/Internet egress, host-loopback access, private user state, authoritative-project writes, Git writes or system/package administration.

AgentRun distinguishes:
- provider command/activity evidence;
- frozen candidate identity and CandidateDelta;
- Dope-owned required candidate validation;
- authority decision;
- applied authoritative change;
- any later authoritative validation.

A successful provider-run test does not imply required validation passed, and a successful candidate validation does not imply promotion occurred.

### Cancellation and interruption

Cancellation stops provider execution inside the ExecutionWorkspace.

Partial execution changes may be summarized/preserved as candidate evidence, but cancellation does not automatically promote them into the authoritative project. No auto-revert of the authoritative project is needed because unpromoted provider effects never reached it.

After restart, an orphaned active run becomes interrupted unless safe continuation is explicitly proven. Automatic continuation remains out of Phase 8B.

### Provider sandbox remains a coarse security ceiling

Provider-specific sandboxes remain required, but they enforce the host boundary, not fine-grained authoritative project semantics.

The reference adapter must still fail closed if it cannot enforce required host restrictions such as:
- no network;
- no secrets/private user state;
- no outside-execution-workspace effects;
- no authoritative Git-control/history mutation;
- no system/package-administration effects.

Dope must not infer fine-grained project authority from a provider's `workspace-write` label.

Provider-specific sandbox/profile mechanisms remain adapter details and may evolve without changing CandidateDelta/ExecutionGrant/ToolExecutor semantics.

### Relationship to ProposedAction

ExecutionGrant still prevents per-operation approval spam.

Routine authoritative create/modify effects already covered by the grant may be promoted without creating one ProposedAction per file.

A denied delete/rename or other consequential effect remains blocked in the initial 8B core. Later UX may materialize a ProposedAction to request explicit additional authority. A model cannot self-approve that escalation.

## Consequences

- Phase 8B remains Not Green until this boundary is implemented and requalified.
- The current direct-write Codex mutation adapter is not the final authority architecture.
- The Phase 8A Test Connection remains unchanged and read-only.
- AgentTask, AgentRun, Coding Agent role resolution, provider independence and project-local run persistence remain valid.
- AgentRun gains execution-workspace/candidate/applied-change provenance.
- The authoritative project can remain unchanged after failed, cancelled, interrupted or unauthorized provider work.
- Phase 8C remains gated until a corrected 8B candidate is Green.
- The correction is named `c8-agent-authority-boundary`.
