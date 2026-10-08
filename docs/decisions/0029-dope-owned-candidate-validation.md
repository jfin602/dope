# ADR 0029 — Dope-owned candidate validation boundary

Status: Accepted
Date: 2026-10-08
Complements: ADR 0027, ADR 0028
Correction: `c8-candidate-validation`

## Context

The Phase 8C exact-fixture closeout proved sequential AgentTask execution, isolated candidate work, Dope-owned promotion/checkpoints, manual gates and restart reconciliation. A later real Adaptive SEO dogfood qualification exposed a project-general validation gap that the earlier fixture did not exercise.

The authoritative Adaptive SEO workspace passes `npm run check`. The same candidate source, when validation is required inside the reference Coding Agent sandbox, fails because real tests legitimately require temporary filesystem state and an ephemeral loopback HTTP fixture. The provider sandbox intentionally denies ambient `/tmp` and network capabilities.

Widening the provider sandbox would collapse two different trust boundaries:

- model-controlled execution, which should remain tightly restricted; and
- developer-approved project validation, which may legitimately need ordinary local test infrastructure.

Required validation also cannot depend on whether the provider happened to run an equivalent command. A completion policy is a Dope-owned correctness gate.

## Decision

### Required validation is Dope-owned

A required `CompletionPolicy.validation` target is executed by a Dope-owned **CandidateValidationRunner** after provider execution finishes and before authoritative promotion.

Provider/model command activity may remain useful AgentRun evidence, but it does not satisfy a required validation target.

The canonical flow is:

```text
AgentExecutionAdapter
    -> isolated ExecutionWorkspace
    -> freeze candidate identity + CandidateDelta
    -> CandidateValidationRunner
    -> verify frozen candidate identity
    -> Authority / ExecutionGrant
    -> ToolExecutor
    -> authoritative project
    -> later workflow checkpoint
```

A required validation PASS is a promotion precondition whenever the task policy requires validation.

### Validation runs against the exact candidate basis

Dope freezes the candidate identity after provider execution. Validation runs in a Dope-owned **ValidationWorkspace** derived byte-for-byte from that frozen candidate.

The ValidationWorkspace may be an ephemeral copy, overlay or equivalent isolated view. It exists so test/build processes can create disposable artifacts without changing the promotable candidate itself.

Before promotion Dope re-verifies that the original frozen candidate still matches the recorded candidate identity and CandidateDelta. If it changed, validation is invalid and promotion blocks.

The authoritative project is never the validation target for candidate qualification.

### Provider sandbox remains restrictive

This ADR does not widen the AgentExecutionAdapter sandbox.

The provider remains denied:
- network;
- ambient/private user state;
- host or authoritative-project mutation outside the ExecutionWorkspace;
- authoritative Git control;
- system/package-administration effects;
- ambient host temporary state except what the provider profile already explicitly permits.

Validation is a separate Dope process boundary.

### Bounded validation process profile

CandidateValidationRunner receives only the capabilities required to execute the developer/task-approved validation command.

It may receive:
- the ValidationWorkspace;
- an isolated private `HOME`;
- a private temporary directory with bounded lifetime and quota;
- `TMPDIR` pointing at that private temporary storage;
- a private `/tmp` view for software that hard-codes `/tmp`;
- the project toolchain/dependencies already required to execute the approved command;
- a private network namespace with loopback enabled.

It does not receive:
- developer credentials or private home state;
- authoritative-project write authority;
- authoritative Git write/history authority;
- LAN or Internet egress;
- host loopback services;
- system/package-administration authority.

Loopback means only processes inside the same private validation network namespace may communicate through `127.0.0.1` / `::1`.

If Dope cannot prove the required private-temp or private-loopback boundary on the current platform, a validation needing that capability fails closed. It must not silently fall back to unrestricted host networking or host temporary state.

### Approved command ownership

The validation command comes from Dope-owned task/completion policy and developer-visible configuration. Repository or provider output cannot silently widen it.

The runner may spawn the process tree needed by that exact command, but this is not a generic provider shell capability.

### Durable terminal evidence

Every required validation target reaches one explicit terminal state:

- `passed`;
- `failed`;
- `cancelled`;
- `not-started` with an explicit reason.

A required validation without a durable terminal result is not promotable.

Bounded durable evidence includes:
- target kind/label;
- approved command;
- candidate/ValidationWorkspace identity;
- candidate fingerprint;
- duration or start/end time;
- terminal status;
- exit code when started;
- bounded stdout/stderr or bounded summaries with truncation markers;
- cancellation/failure/not-started reason where applicable.

Never persist secrets, arbitrary full environment dumps, hidden model reasoning or unbounded process output.

### Cancellation, timeout and cleanup

Dope owns the validation process tree.

Cancel, timeout or runtime teardown must:
- terminate the validation process tree;
- persist a truthful terminal result;
- prevent promotion;
- destroy the private temp/network/validation workspace after bounded evidence is retained.

No validation child process may outlive the owning run.

### Checkpoint relationship

Phase Stack checkpoint eligibility requires:
- provider execution completed;
- required Dope-owned candidate validation passed;
- candidate identity remained stable;
- CandidateDelta passed Authority;
- promotion succeeded;
- existing Git/version/worktree/checkpoint invariants passed.

The model/provider never owns validation authority, promotion authority or checkpoint authority.

## Qualification

The `c8-candidate-validation` correction must prove at minimum:

- private temporary files work;
- hard-coded `/tmp` works only inside the validation boundary;
- a private loopback server/client fixture works;
- host loopback is unreachable;
- external network remains unreachable;
- private user/secrets state remains unreachable;
- authoritative project cannot be mutated by validation;
- timeout/cancel terminates the process tree;
- stdout/stderr evidence is bounded and durable;
- provider-run commands cannot satisfy required validation;
- changed frozen candidate identity blocks promotion;
- failed/cancelled/not-started required validation never promotes or checkpoints;
- a real Adaptive SEO P1 candidate passes `npm run check` through CandidateValidationRunner;
- the existing Adaptive SEO phase-stack smoke qualification then proceeds through P2, P3 manual/browser gate, restart, P4 closeout and completed reopen.

## Consequences

- The historical Phase 8C closeout remains truthful for its exact qualified fixture. It is not rewritten or relabeled.
- The later Adaptive SEO dogfood failures remain retained evidence of a project-generalization gap.
- Phase 8D is gated on `c8-candidate-validation` plus a Green resumed Adaptive SEO phase-stack qualification.
- The provider sandbox remains a coarse host-security ceiling and is not widened to make project tests pass.
- Required validation becomes provider-independent and reproducible across future coding-agent adapters.
