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

Before a task/sequence can produce authoritative project effects, the developer accepts an ExecutionGrant covering:
- canonical repository/project identity and starting basis;
- read/observation scope;
- isolated ExecutionWorkspace read/write/process scope;
- authoritative project create/modify/delete/rename promotion scope;
- Git permissions/checkpoint policy;
- network/secrets/private-state/outside-workspace/system permissions;
- stop/escalation conditions.

Routine effects within the grant proceed without repetitive confirmation. Effects beyond it remain blocked or enter a later explicit escalation path.

Model output, provider instructions, repository text and adapter metadata cannot expand authority.

ADR 0028 refines the Phase 8B mutation boundary: provider/model writes occur in an isolated ExecutionWorkspace and become a CandidateDelta. Only Dope-owned Authority + ToolExecutor may promote authorized effects into the authoritative project.

### Reference harness tooling

Codex may internally coordinate file/process tooling inside the isolated ExecutionWorkspace.

The Codex adapter maps ExecutionGrant into the strongest supported coarse sandbox restrictions and surfaces observable command/file/tool activity into AgentRun. Provider sandbox authority protects host boundaries such as network, private state, outside-workspace effects and system effects; it is not treated as fine-grained authoritative project permission.

If Codex cannot reliably enforce a required host restriction, that capability is unavailable through the adapter. The adapter never receives implicit unlimited host authority merely because Codex can technically perform an action.

CandidateDelta classification and authoritative project promotion are Dope-owned and provider-independent. Dope owns the authoritative checkpoint commit boundary for the later phase-stack workflow, matching the current external runner's safety contract.

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

## Amendment — Phase 8B Agent execution core (2026-10-05)

Phase 8A is Green / Qualified at exact source `17806d3050cd6e3d4c793bc8856af8daeaaef63f`, coherent `0.8.6`. The Codex AI Center connection, ChatGPT-plan auth, model inventory, App Server lifecycle and Coding Agent role eligibility are therefore available as the reference substrate.

Phase 8B now activates the first mutation-capable product path, but remains deliberately narrower than the later phase-stack workflow.

### 8B goal

Phase 8B proves one safe, observable, cancellable, restart-inspectable **AgentTask** against one clean disposable project.

It does not yet implement:
- AgentTaskSequence;
- phase/correction prompt-stack parsing;
- version progression;
- browser/manual gates;
- runner-owned Git checkpoints;
- dirty-tree continuation;
- capacity retry policy;
- automatic sequence resume;
- WorkItem delegation.

Those are later Phase 8 slices.

### Initial AgentTask contract

The first live AgentTask carries:
- stable Dope task ID and schema version;
- creation time;
- objective and executable instructions;
- canonical project identity/root;
- model policy: follow Coding Agent or exact connection/model;
- model execution settings such as reasoning effort where supported;
- authority requirements;
- bounded validation/completion policy;
- origin: direct, phase-stack, WorkItem or future session;
- optional links to higher-level planning/project context.

AgentTask never stores provider-native thread/session identity as canonical task identity.

### Initial AgentRun contract

One AgentRun records one execution attempt:
- stable run ID + AgentTask ID;
- status: pending / running / blocked / cancelling / cancelled / failed / completed / interrupted;
- started/ended times;
- requested role/exact policy and actual immutable connection/model/runtime provenance;
- ExecutionGrant identity/revision;
- starting project identity + Git HEAD + clean/dirty basis;
- provider-neutral activity events;
- affected project-relative files;
- validation results;
- bounded diff/change summary;
- provider recovery metadata such as Codex thread ID;
- failure/cancel/interruption/recovery state.

Provider recovery metadata remains non-canonical and never grants authority.

### Project-local persistence

8B persists inspectable execution state beneath the project:

```text
.dope/agent/
  tasks/
    <task-id>.json
  runs/
    <run-id>/
      run.json
      events.jsonl
```

This persistence is project work state, not Physical Map source/config input.

Never persist:
- OAuth/access/refresh/ID tokens;
- provider secrets;
- hidden chain-of-thought;
- arbitrary environment dumps;
- unbounded raw provider payloads.

Copying the repository preserves Dope task/run history. Provider-native resume metadata may become unusable on another machine without corrupting the Dope record.

### 8B ExecutionGrant default

ADR 0028 supersedes the initial direct-project-write grant shape.

The corrected first mutation-capable grant defaults to two authority layers.

ExecutionWorkspace:
- read/write/process/test/build inside the isolated execution workspace: allowed;
- network: denied;
- secrets/private user state: denied;
- outside-execution-workspace effects: denied;
- system/package-administration effects: denied;
- authoritative Git-control/history mutation: denied.

Authoritative project promotion:
- create: allowed;
- modify: allowed;
- delete: denied;
- rename/move: denied;
- Git stage/commit/reset/rebase/checkout/switch/history rewrite: denied.

The developer accepts this bounded grant once before execution. Routine authorized promotion does not require one approval per file. If any CandidateDelta effect is outside the grant, initial 8B promotes none of the candidate delta and records the blocked authority result; richer escalation/partial acceptance remains later work.

A task cannot produce authoritative mutation until its grant is explicitly accepted.

### Codex mutation path is separate from Test Connection

The 8A zero-project-data `CodexAppServer.test()` path remains permanently read-only/no-network/no-mutation.

8B uses a distinct AgentExecutionAdapter path for real work, but the provider's writable cwd is now an isolated ExecutionWorkspace derived from the accepted project basis, not the authoritative project root.

The reference Codex path must:
- execute only inside that isolated workspace;
- keep network disabled;
- deny private-state/outside-workspace/system effects;
- protect authoritative Git control/history;
- keep HOME / CODEX_HOME isolated in a Dope-owned runtime location;
- fail closed when those host restrictions cannot be enforced.

After execution, Dope computes CandidateDelta and performs the authoritative create/modify promotion itself through Authority + ToolExecutor. Provider `workspace-write` never directly means authoritative project-write permission.

### ProposedAction in 8B

An already-approved ExecutionGrant is the authority for routine in-grant effects. 8B does not create a ProposedAction approval object for every permitted file write or test command.

ProposedAction remains the product vocabulary for consequential effects that require explicit per-action review or exceed the standing grant. Rich consequential-action UX is deferred beyond the first execution core.

### AgentRun events

8B normalizes observable provider activity into a Dope vocabulary, at minimum:
- agent-message;
- command-started;
- command-completed;
- file-changed;
- validation;
- status;
- warning;
- authority-denied;
- bounded provider-event when needed for diagnosis.

Persist timestamps, project-relative paths/command summaries/status where available. Do not persist raw hidden reasoning.

### Cancellation and restart

Stop must be real:
- transition to cancelling;
- interrupt the active Codex turn/process path;
- prevent further provider effects;
- preserve bounded candidate/execution-workspace evidence;
- persist cancelled/interrupted truth.

Cancelled or interrupted provider work is not automatically promoted into the authoritative project. No authoritative-project auto-revert is required for unpromoted candidate work.

After application restart, the AgentRun remains inspectable. 8B may retain bounded provider recovery metadata, but seamless automatic task continuation is not required yet. If continuation cannot be proven safe, present the run as interrupted with preserved candidate/evidence state.

### Git and dirty-state boundary

The first 8B mutation qualification uses a clean disposable repository.

8B records starting HEAD and final diff but does not stage or commit.

Pre-existing dirty-tree attribution, intentional dirty continuation and runner-owned checkpoint commits are deferred to 8C.

### Minimal UI

8B adds only a small Agent Run workbench surface sufficient to:
- enter/review objective/instructions;
- show resolved Coding Agent;
- review/accept ExecutionGrant;
- start/stop;
- stream activity;
- list changed files;
- show bounded validation/diff summary;
- inspect completed/cancelled/failed run state after restart.

This is not the final Development Session or delegation UX.


## Amendment — Phase 8C sequential task / phase-stack execution (2026-10-06)

Phase 8B is Green / Qualified at `0.8.13` for the corrected ADR 0028 direct AgentTask path. Phase 8C activates AgentTaskSequence and the first Dope-owned Git checkpoint workflow.

### Imported sequence truth

PhaseStackAdapter imports `docs/tasks/<stack>/P*.txt` into a normalized immutable snapshot with a source fingerprint. An in-progress sequence does not silently reinterpret later prompt-file edits.

Durable sequence state lives beneath `.dope/agent/sequences/` and links generated AgentTasks, AgentRuns, manual gates and checkpoint SHAs.

Safe resume requires agreement among durable sequence state, reachable Git history, current HEAD, package/version state, authoritative worktree basis and stack fingerprint. Ambiguity blocks.

### Execution

Executable entries run through the already-qualified Agent Runtime / ExecutionWorkspace / CandidateDelta / Authority boundary. 8C does not give the provider direct Git or authoritative project-write authority.

Capacity retry may preserve the same task's partial ExecutionWorkspace state for narrowly recognized capacity failures. No candidate promotion/checkpoint occurs between retries.

### Checkpoints

Dope owns stage/commit only after successful authoritative promotion, validation and Git/version/worktree invariants.

Checkpoint scope is bounded to authorized task effects plus explicitly accepted pre-existing dirty-basis work. Runtime `.dope/agent/**` state is not ordinary implementation checkpoint content.

Phase commit subjects use the exact target version. Correction commit subjects use `<folder>/P<n>: <task title>`.

Sequence advancement occurs only after the resulting checkpoint commit is verified and recorded.

### Manual/browser gates

`Browser required: yes.` entries are manual gates. The final closeout is also manual in 8C.

Dope stops at the gate and surfaces the exact imported prompt. Resume requires reconciliation of external Git/version truth; a UI action alone cannot declare the gate complete.

### Restart

After restart, Dope reconciles stale AgentRun truth first, then sequence/Git/version/worktree/stack truth. It selects exactly one safe next action or blocks. It never recreates an already verified checkpoint.


## Amendment — Work and Prompt Stack vocabulary (2026-10-08)

Canonical **user-facing** product names:
- **Work**, **New Work**, **Work history**, **Work detail** rather than Agent Run surface labels;
- **Prompt Stack** for either a phase or correction stack;
- **Prompt Stack runner** for sequential execution of Prompt Stacks.

Phase/correction is retained as version/checkpoint metadata; existing prompt TASK grammar, file/folder names, stored snapshots, historic docs, checkpoint subjects and Git history remain unchanged.

Canonical **internal** types remain `AgentTask`, `AgentRun`, `AgentTaskSequence`, `ExecutionGrant`, `WorkItem` and, until a separately approved refactor, `PhaseStackAdapter`. Work is a presentation mode, not a WorkItem or new execution-state domain.

A Work tab/detail title follows the stable task identity: a Prompt Stack AgentTask uses its snapshotted `entry.title`; direct Work uses `AgentTask.objective`; unavailable historical metadata uses a bounded fallback with a short run ID. Advancing the sequence must not retitle a previously opened historical run. Existing Agent Run/Phase Stack commands and links should alias to Work/Prompt Stack views rather than breaking shortcuts.

Work reuses the ChatPanel shell, placement, ownership and restoration rules, with a Chat | Work toggle and toolbar entry. It does not inherit Chat's Interactive model routing, permissions, Chat record state, or arbitrary mid-run steering. ADR 0028 mutation and ADR 0029 Dope-owned candidate validation remain intact. This correction is `c8-work-mode`, incorporating the earlier `c8-agent-run-transcript` scope.

## Amendment — Work control plane (2026-10-08)

Work is a separate module from Chat. Select Work groups truly active execution under Running, retains completed/failed/cancelled/interrupted and pending/manual/blocked work in History, and discovers Prompt Stacks. Selecting Work opens the Work panel detail for control and observation without replacing the center editor. An explicit Open Transcript action opens a read-only AgentRun center tab from the same durable evidence. AgentTask, AgentRun, AgentTaskSequence and ExecutionGrant remain the internal execution contracts; this amendment changes presentation only.
