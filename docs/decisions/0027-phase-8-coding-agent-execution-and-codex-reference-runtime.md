# ADR 0027 — Phase 8 coding-agent execution and Codex reference runtime

Status: Accepted
Date: 2026-10-05
Complements: ADR 0004, ADR 0006, ADR 0017, ADR 0025, ADR 0026

## Context

Product Phase 8 is the first phase that grants AI mutation/process/Git authority.

Dope is currently developed primarily through ordered prompt stacks executed by the repository's external phase runner. That workflow already proves useful product behavior: prompt ordering, model/reasoning selection, version/clean-tree checks, structured agent activity, validation, runner-owned commits, stop-on-failure, browser/manual handoff and Git-proven resume.

The agent beneath that runner is Codex CLI. For Dope to become the primary environment used to build Dope, the first coding-agent workflow should reproduce this high-value sequential loop inside the product rather than beginning with a more abstract WorkItem-only experience.

At the same time, the external runner is development tooling. It must not become Dope's product runtime or canonical agent ontology.

OpenAI now exposes Codex App Server as an embeddable coding-agent harness and supports Sign in with ChatGPT / authorized ChatGPT-plan usage for eligible open-source/local clients. This provides a capable reference agent while preserving the provider-independent product boundary established by ADR 0004/0006.

## Decision

### AgentTask is the execution primitive

Phase 8 introduces provider-independent:
- **AgentTask** — one bounded delegated execution request;
- **AgentRun** — one concrete execution attempt/result for an AgentTask;
- **AgentTaskSequence** — ordered orchestration of AgentTasks with progression/stop/resume rules;
- **ExecutionGrant** — developer-approved effect authority for a task/sequence.

A WorkItem may create one or more AgentTasks, but WorkItem is not required merely to execute a prompt stack or direct coding request.

AgentTask/AgentRun identity is Dope-owned and independent from provider-native thread/session/response IDs.

### The phase runner is a behavioral reference, not product runtime

The existing `scripts/codex-phase*.mjs` tooling remains external development infrastructure.

Phase 8 may reuse/extract pure prompt grammar or validation helpers when that reduces duplication, but the product does not architecturally become:

```text
Dope GUI -> spawn codex-phase.mjs
```

Instead:

```text
PhaseStackAdapter
    -> AgentTaskSequence
        -> Agent Runtime
            -> Coding Agent role
            -> Authority / ExecutionGrant
            -> AgentExecutionAdapter
```

The phase-stack adapter preserves the useful behavioral contract: task order, model/reasoning metadata, version policy, clean/Git preflight, validation, Dope-owned checkpoint commit, stop-on-failure, browser/manual gates and restart/resume.

### Codex App Server is the first reference AgentExecutionAdapter

The first reference coding-agent adapter is **Codex App Server**.

AI Center owns the global Codex connection/account/runtime configuration. Agent Runtime owns active task execution.

Conceptually:

```text
AI Center
    -> Codex connection
        -> secure ChatGPT-plan auth
        -> agent model inventory / health

Coding Agent role
    -> eligible target with agentExecution capability

Agent Runtime
    -> AgentTask / AgentRun
    -> ExecutionGrant
    -> CodexAgentAdapter
        -> codex app-server
```

Codex is a bootstrap/reference implementation, not a Dope dependency. Later local or other agent adapters consume the same Dope-owned contracts.

### Codex AI Center connection

Codex is a first-class agent-runtime connection distinct from generic OpenAI API.

Initial connection path supports Sign in with ChatGPT / authorized ChatGPT-plan usage where eligible.

The connection is **hosted** for egress/locality purposes even though App Server and repository tools run locally.

AI Center may expose non-secret account, issued-client/host identity, model inventory, auth status and usage-management links. Access/refresh/ID tokens remain protected secrets outside registry/project/browser/log/provenance state.

OAuth refresh for one session is serialized across processes. Rotating replacement credentials are updated atomically.

A Codex Test Connection runs a tiny zero-project-data task in a scratch/empty root with mutation disabled. It proves connection/runtime completion only.

Failure of this connection never silently changes billing path to an OpenAI API-key connection. Generic role fallback requires another independently configured eligible target and all feature authority.

### Agent execution capability

Provider-neutral connection/model eligibility gains **agentExecution** (name may be refined in implementation while preserving the semantic contract).

Coding Agent role consumers require that capability.

Provider name, toolCalling or conversationalText alone does not imply a full coding-agent harness.

Agent-execution connections need not appear in ordinary Chat or Software Map model selectors unless they separately satisfy those feature contracts.

### ExecutionGrant is the useful approval boundary

Before a task/sequence mutates the project, the developer accepts an ExecutionGrant covering:
- canonical repository/project root;
- read/observation scope;
- workspace mutation scope;
- process execution scope;
- Git permissions/checkpoint policy;
- network/secrets/destructive permissions;
- stop/escalation conditions.

Routine effects within the grant proceed visibly without repetitive confirmation. Effects beyond the grant pause for explicit escalation.

Model output, provider instructions, repository text and adapter metadata cannot expand authority.

### Reference harness tooling

Codex may internally coordinate file/process tooling.

The Codex adapter must map ExecutionGrant into the strongest supported sandbox/approval restrictions and surface observable file/command/tool activity into AgentRun.

If Codex cannot reliably constrain a capability to the Dope grant, that capability is unavailable through the adapter. The adapter never receives implicit unlimited host authority merely because Codex can technically perform an action.

Dope owns the authoritative checkpoint commit boundary for the initial phase-stack workflow, matching the current external runner's safety contract.

### Phase 8 sequencing

Phase 8 proceeds in this order:

1. **Codex reference connection** — AI Center auth/App Server/model health, no project mutation.
2. **Agent execution core** — AgentTask/AgentRun/ExecutionGrant and one bounded coding task.
3. **Sequential phase-stack execution** — replace the bulk external runner workflow inside Dope.
4. **General WorkItem delegation** — WorkItem-derived tasks, ownership, richer steering/review.
5. **Local coding-agent compatibility** — run representative identical tasks through the same contracts.

The capable reference harness is qualified before local models so agent architecture failures remain distinguishable from local-model capability failures.

### First dogfood milestone

The first substantial Phase 8 qualification is:

```text
open Dope repository
-> select/import real existing prompt stack
-> identify completed/pending tasks
-> run next task through Coding Agent
-> observe tool/file/command activity
-> run validation
-> review change
-> Dope creates/verifies checkpoint commit
-> advance
-> stop at manual/browser gate
-> restart Dope
-> resume at the same gate
```

This is intentionally prioritized before a polished generic delegation experience because it replaces the majority of the current development loop.

## Provider/session state

Provider-native Codex thread/session IDs may be persisted only as adapter recovery metadata linked to AgentRun. They are never canonical task identity, project truth or authority.

If the provider session is gone but the project/task/run state is recoverable, Dope must either reconstruct a new provider session from bounded durable state or fail clearly.

## Local models

Local coding-agent support is first-class but later in Phase 8 sequencing.

It must not require rewriting AgentTask, AgentRun, AgentTaskSequence, ExecutionGrant, validation or review semantics. Local adapters may have different context/tool strategies and capability limits.

## Qualification direction

Phase 8 qualification must include:
- secure Codex AI Center auth/runtime lifecycle and hosted classification;
- no silent API-key/billing fallback;
- authority enforcement;
- observable/cancellable single AgentTask;
- exact sequential prompt-stack behavior and Dope-owned checkpoints;
- manual/browser stop and restart resume;
- dirty-tree/concurrent-Git safety;
- WorkItem -> AgentTask delegation;
- local-agent compatibility against the same contracts after reference qualification.

## Non-goals

This decision does not:
- make Codex or OpenAI the canonical coding-agent ontology;
- make the external phase runner the product runtime;
- require WorkItem for every AgentTask;
- authorize per-call approval spam for already granted routine effects;
- grant network/secrets/destructive authority by default;
- allow provider-native thread identity to become task/run identity;
- implement Phase 9 DeveloperSession;
- implement Phase 10 continuous alignment;
- require local coding models before the reference execution harness is qualified.

## External reference surfaces

Provider-specific implementation details are non-canonical and may evolve:
- Codex App Server / ChatGPT-plan integration: https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server
- Sign in with ChatGPT for open-source apps: https://developers.openai.com/siwc/token-sharing-open-source
- Account/session/token refresh guidance: https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions
- ChatGPT app usage/limits: https://help.openai.com/en/articles/20001542-using-your-chatgpt-plan-in-other-apps-and-sites

