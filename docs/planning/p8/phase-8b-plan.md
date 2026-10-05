# Product Phase 8B — Agent Execution Core Plan

Status: **APPROVED / CURRENT SLICE / PROMPTS NOT YET WRITTEN**
Date: 2026-10-05
Expected execution folder: `p8b`
Starting product source: exact `0.8.6` source `17806d3050cd6e3d4c793bc8856af8daeaaef63f`
Expected first implementation version: `0.8.7`
Primary authority: ADR 0027 as amended for 8B, Phase 8 plan, PRODUCT-MODEL, ARCHITECTURE, stability contract

## Entry state

Phase 8A Codex reference connection is Green / Qualified.

Available reference substrate:
- AI Center Codex agent-runtime connection;
- ChatGPT-plan account lifecycle;
- account/model inventory;
- Coding Agent role with `agentExecution`;
- Codex App Server process/RPC lifecycle;
- authenticated refresh/restart/thread-resume path;
- permanent zero-project-data read-only Test Connection.

8B must not weaken or reuse the Test Connection as its mutation path.

## Goal

Prove that Dope can safely give the configured Coding Agent bounded hands inside one project, observe its effects, stop it and preserve an auditable run without granting more authority than the developer approved.

This is one AgentTask, not a task sequence.

## Domain contracts

### AgentTask

Required initial fields:
- schema version;
- stable UUID task ID;
- createdAt;
- objective;
- executable instructions;
- canonical project/root identity;
- model policy: Follow Coding Agent or exact immutable connection/model;
- optional supported execution controls;
- authority requirements;
- bounded validation/completion policy;
- origin kind;
- optional links to higher-level project/planning state.

### AgentRun

Required initial fields:
- schema version;
- stable run ID;
- task ID;
- status;
- requested role/exact policy;
- actual immutable connection/model/runtime provenance;
- ExecutionGrant ID/revision;
- start/end timestamps;
- starting project identity + Git HEAD + clean/dirty basis;
- normalized activity events;
- affected project-relative files;
- validation results;
- bounded diff/change summary;
- non-canonical provider recovery metadata;
- failure/cancel/interruption state.

Statuses:
- pending;
- running;
- blocked;
- cancelling;
- cancelled;
- failed;
- completed;
- interrupted.

### ExecutionGrant

Initial grant dimensions:
- canonical project root;
- read/observation;
- workspace mutation;
- process execution;
- Git actions;
- network;
- secrets/private-user data;
- destructive/system actions;
- stop/escalation policy.

Default 8B grant:
- project read: allow;
- project workspace write: allow;
- project-local process/test/build: allow;
- Git inspect: allow;
- Git stage/commit/reset/rebase/checkout/switch/history rewrite: deny;
- network: deny;
- secrets/private-home access: deny;
- outside-project effects: deny;
- destructive/system/package administration: deny.

Developer accepts the grant once before execution. 8B denies out-of-grant actions rather than implementing rich interactive grant expansion.

## Persistence

Project-local:

```text
.dope/agent/
  tasks/
    <task-id>.json
  runs/
    <run-id>/
      run.json
      events.jsonl
```

Requirements:
- atomic/locked writes appropriate for current project process model;
- safe project containment;
- readable/versioned schema;
- malformed/unsupported state fails closed;
- copying repository preserves Dope task/run history;
- provider recovery metadata may become unusable without corrupting the record;
- `.dope/agent/**` remains excluded from generic Physical Map inputs.

Never persist:
- OAuth/access/refresh/ID tokens;
- secret environment values;
- hidden chain-of-thought;
- unbounded raw provider payloads.

## Agent Runtime

Responsibilities:
1. validate task/project/grant;
2. require clean initial worktree for the first 8B mutation flow;
3. snapshot project identity + starting HEAD;
4. resolve Coding Agent or exact eligible target;
5. start AgentRun before provider mutation;
6. invoke AgentExecutionAdapter under the approved grant;
7. normalize provider activity;
8. track changed files and bounded diff;
9. record validation;
10. support stop/cancel;
11. persist truthful terminal/interrupted state.

No AgentTaskSequence yet.

## Codex AgentExecutionAdapter

Add a mutation-capable path separate from `CodexAppServer.test()`.

The adapter maps the grant to the strongest supported App Server restrictions.

Initial reference behavior:
- Codex runtime HOME/CODEX_HOME isolated from repository;
- thread cwd = canonical approved project root;
- workspace-write only for approved project mutation;
- network disabled;
- no ambient Git-write permission;
- no outside-root/private-home permission;
- provider/tool activity streamed into AgentRun.

If current Codex App Server cannot enforce a requested grant boundary, reject that grant/capability rather than run permissively.

Provider thread ID is recovery metadata only.

## Events

Normalize at minimum:
- agent-message;
- command-started;
- command-completed;
- file-changed;
- validation;
- status;
- warning;
- authority-denied;
- bounded provider-event if necessary.

Events use timestamps and project-relative/sanitized display values.

Do not persist hidden reasoning.

## Cancellation

Stop behavior:
- mark cancelling;
- interrupt active provider turn/process path;
- prevent new effects;
- retain workspace modifications already made;
- persist cancelled/interrupted truth;
- never auto-revert.

## Restart

Required:
- tasks/runs remain inspectable;
- changed-file and event history remains available;
- interrupted state is truthful;
- safe manual/provider resume may be offered if provable.

Not required in 8B:
- automatic continuation after restart;
- automatic reconciliation of changed Git state.

Those belong to 8C.

## Minimal Agent Run UI

One center-workspace surface is sufficient.

Initial functions:
- create/review direct task;
- show resolved Coding Agent;
- show grant;
- approve and Start;
- Stop;
- activity stream;
- changed files;
- validation/diff summary;
- completed/cancelled/failed/interrupted state after reopen.

Not required:
- task-sequence browser;
- WorkItem delegation UI;
- final DeveloperSession UX;
- automatic commit controls.

## Direct qualification specimen

Use a small disposable clean repository with a real local test command.

Representative task:
- add one small function/behavior;
- add/update tests;
- run the project test command.

Require:
- exact starting HEAD;
- clean worktree;
- real Codex Coding Agent target;
- accepted default 8B grant;
- source/test mutation inside root;
- visible commands/file changes;
- passing validation;
- completed AgentRun;
- final diff inspectable;
- no Git commit/staging;
- no network;
- no outside-root effect.

Adversarial task/effect probes:
- write to `/tmp` or another outside-root location;
- network request;
- Git commit/history-changing command;
- private-home/secret read;
- repository instruction attempting to expand authority.

Each must be denied or fail under the actual sandbox, with filesystem/process/Git reality matching AgentRun events.

Also qualify cancellation mid-run:
- stop during active work;
- no further effects;
- existing changes preserved;
- truthful cancelled/interrupted run after restart.

## Validation

Focused:
- AgentTask/AgentRun schema/parser;
- persistence/restart;
- grant validation;
- Coding Agent/exact target resolution;
- Codex grant-to-sandbox mapping;
- normalized event projection;
- cancellation;
- changed-file/diff capture;
- UI controller/presentation.

T3 8B closeout:
- real Codex task on disposable repo;
- adversarial authority probes;
- cancellation;
- restart inspection;
- exact candidate aggregate check;
- no secrets;
- no Git commit/stage;
- no outside-root/network effect.

## Deferred to 8C

Do not implement:
- AgentTaskSequence;
- `docs/tasks/<stack>` import/parser;
- phase/correction version progression;
- dirty-tree continuation;
- model-capacity retry policy;
- sequential prompt advancement;
- browser/manual prompt gate;
- automatic sequence restart/resume;
- Dope-owned Git staging/commit checkpoint;
- full runner-style validation orchestration.

## Deferred later

8D:
- WorkItem -> AgentTask;
- HUMAN / AI / SHARED ownership;
- rich steering/review/accept/reject;
- consequential ProposedAction UX.

8E:
- local coding-agent adapter compatibility.

## Exit condition

Phase 8B is Green when one direct AgentTask can safely modify a clean disposable project through the Coding Agent role under an explicit bounded ExecutionGrant, run local validation, expose/persist auditable AgentRun state, deny out-of-grant effects, cancel without hidden effects or auto-revert, and remain inspectable after restart.

A Green 8B routes to a fresh 8C docs review for sequential phase-stack execution.

