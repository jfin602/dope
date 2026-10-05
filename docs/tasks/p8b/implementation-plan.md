# Product Phase 8B Implementation Plan — Agent Execution Core

Status: **ACTIVE / READY FOR EXECUTION**
Execution folder: `p8b`
Baseline: `bdf01b1cf518e44b8187a40db5d199fac7ad693b`, package `0.8.6`
Version range: `0.8.7` through `0.8.13`
Assessment: `prompt-assessment.md`

## Entry condition

Phase 8A is Green / Qualified and current Phase 8B product/authority contracts are approved.

Validate the complete `p8b` stack against the current coherent `0.8.6` baseline before P1.

## Shared invariants

- AgentTask/AgentRun/ExecutionGrant are Dope-owned and provider-neutral.
- one accepted ExecutionGrant is the useful authority boundary for routine in-grant work.
- no model/provider/repository text can widen the grant.
- the initial 8B grant allows project read/write, project-local process/test/build and Git inspection only.
- Git writes/history mutation, network, secrets/private-home access, outside-root effects and destructive/system/package-admin actions remain denied.
- unsupported provider enforcement fails closed.
- Codex Test Connection remains read-only and distinct from mutation execution.
- provider-native thread/session IDs are recovery metadata only.
- role-following execution uses the existing Coding Agent policy; exact targeting remains exact.
- no fallback after meaningful execution/effects begin.
- AgentRun persistence contains no secrets, hidden reasoning, arbitrary env dump or unbounded provider payload.
- cancellation stops actual execution and preserves already-created changes; no auto-revert.
- restart inspection is required; automatic continuation is not.
- 8B never stages or commits.
- `.dope/agent/**` is Dope execution state and is not attributed as task-authored source change.
- no WorkItem requirement and no AgentTaskSequence in 8B.

## Proposed implementation shape

Create one real provider-neutral package, not a package forest:

```text
packages/agent-core/
  src/
    index.ts
    contracts.ts
    authority.ts
    state.ts
    node/
      agent-store.ts

packages/contracts/src/
  agent-runtime-service.ts

packages/theia-extension/src/node/
  codex-agent-execution.ts
  agent-runtime-backend.ts
  agent-git-evidence.ts

packages/theia-extension/src/browser/
  agent-run-controller.ts
  agent-run-widget.ts
  agent-run-contribution.ts
```

Exact filenames may refine during source inspection, but ownership must remain equivalent:
- `agent-core`: provider-neutral durable contracts/parsers/pure authority and state transitions;
- node store: project-local persistence;
- contracts: frontend/backend RPC DTO/service boundary;
- Theia node: AI routing, Codex adapter, Git/process integration;
- Theia browser: presentation only.

Update `MODULES.md` when the Agent Runtime boundary becomes real.

## P1 — Agent execution domain and authority — 0.8.7 — T1

Create `@dope/agent-core`.

Define strict versioned contracts/parsers for:
- AgentTask;
- AgentRun;
- AgentRunEvent;
- ExecutionGrant;
- validation result/change summary/provenance value objects needed by 8B.

Task contract:
- stable task ID/schema;
- createdAt;
- objective/instructions;
- project-local root reference / optional existing project identity;
- model policy: Follow Coding Agent or exact connection/model;
- supported execution controls such as reasoning effort;
- authority requirements;
- bounded validation/completion policy;
- origin;
- optional higher-level references without requiring WorkItem.

Run contract:
- stable run ID/task ID;
- approved grant ID/revision;
- exact lifecycle statuses;
- requested policy plus actual immutable execution provenance;
- start/end;
- starting Git/project basis;
- changed files;
- validation results;
- bounded diff summary;
- sanitized recovery/failure fields.

ExecutionGrant:
- explicit effect classes for observation, workspace mutation, process, Git, network, secrets/private-state, outside-root, destructive/system actions;
- 8B default builder/parser enforces allowed/denied posture;
- grant is immutable/revisioned after acceptance;
- effect checks are deterministic;
- attempted out-of-grant effects produce a typed deny decision, never an implicit prompt-side override.

State transitions:
- pending -> running;
- running -> blocked/cancelling/failed/completed/interrupted;
- cancelling -> cancelled/interrupted/failed;
- terminal states do not re-enter running in 8B.

Do not add provider code, fs persistence, Git or UI.

Tests:
- strict parsing/unknown-field rejection;
- status transitions;
- immutable grant;
- allowed/denied effect matrix;
- invalid root/path normalization inputs;
- no secret/CoT fields in durable vocabulary.

Update workspace/build order only as needed for the new real package.

## P2 — Project-local Agent state persistence and service boundary — 0.8.8 — T2

Implement project-local durable storage under `.dope/agent/`.

Store rules:
- canonicalize the attached runtime root and reject non-file/outside-root requests;
- task JSON write is atomic;
- run JSON write/update is atomic;
- events append as bounded JSONL;
- deterministic event sequence/order;
- cross-process/multi-window locking or equivalent serialization for one run;
- corruption/future schema fails clearly without rewriting evidence;
- no arbitrary absolute private path persistence;
- no secrets/provider auth/env values;
- enforce event and summary size bounds.

Service contract supports the minimum UI/runtime operations:
- attach project;
- create/read/list task/run;
- append/read events with bounded paging;
- update run through legal state transitions;
- notifications for active run/event changes.

Do not execute a model yet.

Restart readback must preserve completed/cancelled/failed/interrupted truth. P5 will own reconciliation of stale running/cancelling state after process loss.

Tests:
- create/read/update;
- append order and size caps;
- concurrent writer/lock behavior;
- project isolation;
- malformed/future bytes;
- copy/move portability;
- token/secret-shaped fixture absence;
- attach path canonicalization.

## P3 — Codex AgentExecutionAdapter and enforceable mutation sandbox — 0.8.9 — T2

Add a separate mutation-capable Codex adapter.

Preserve the 8A `CodexAppServer.test()` path exactly as read-only.

Reuse/extract low-level JSON-RPC/process mechanics only where safe. Prefer a dedicated mutation process/session per active run if that makes cancellation and authority isolation stronger.

Before implementing provider event mapping, inspect the installed/current Codex App Server protocol/config surface. Normalize only verified observable events; unknown bounded diagnostic events map to provider-event without dumping raw payloads.

For the 8B default grant:
- cwd = canonical approved project root;
- workspace mutation only inside that root;
- network disabled;
- extra writable temp roots disabled where supported;
- HOME/CODEX_HOME isolated in a Dope-owned runtime location and not exposed as project tool authority;
- `.git` and Git control/history writes protected;
- approval policy must not create provider-side approval spam that bypasses Dope authority;
- web search/remote tools disabled;
- no implicit MCP/child-agent/network capability outside the grant.

If installed Codex cannot enforce any required deny boundary, return unsupported-capability/authority failure before mutation.

Adapter contract:
- start task with exact selected connection/model and accepted grant;
- stream provider-neutral activity;
- expose sanitized recovery metadata;
- support real cancellation/interrupt;
- no provider fallback.

Use deterministic fake App Server/process fixtures plus sandbox/config assertions. Include adversarial fixture attempts for outside-root, Git-control and network behavior where testable without live provider.

Do not add sequence/Git commit logic.

## P4 — Agent Runtime lifecycle, routing and cancellation — 0.8.10 — T2

Implement the single-task Agent Runtime backend.

Start flow:
1. attach/canonicalize project;
2. load task;
3. require explicitly accepted grant compatible with task/root;
4. resolve target:
   - Follow Coding Agent -> existing role resolution with `agentExecution`, hosted project-data authorization explicit;
   - exact -> validate exact current eligible target;
5. persist pending/running state and immutable target/runtime provenance before meaningful effects;
6. start the matching AgentExecutionAdapter;
7. normalize/persist activity events;
8. transition terminal truth exactly once.

Fallback law:
- no generic API fallback;
- no target change after effects/output begin;
- if pre-effect role resolution has multiple candidates, 8B should prefer explicit failure over inventing broad retry semantics; capacity retry remains 8C.

Cancellation:
- Stop transitions to cancelling;
- abort/interrupt the provider adapter;
- if scoped protocol interruption is unavailable/unreliable, terminate the dedicated run process;
- no further effects after cancellation completion;
- preserve workspace changes;
- persist cancelled or honest interrupted state;
- no auto-revert.

Only one active 8B run per attached project is necessary. Reject competing mutation runs rather than implementing orchestration.

Tests cover:
- grant required;
- role vs exact selection;
- hosted consent;
- unavailable/ineligible target;
- immutable provenance;
- event persistence;
- cancellation before/after first change;
- adapter failure;
- competing start rejection;
- no fallback after effects.

## P5 — Git/change/validation evidence and restart reconciliation — 0.8.11 — T2

Make run results independently inspectable.

Git preflight:
- use Dope-owned read-only Git commands;
- qualification path requires a clean disposable repository;
- record starting HEAD and clean/dirty basis **before** creating run metadata that may affect Git status;
- do not stage, commit, reset, checkout, switch, rebase or rewrite history.

Change capture:
- compare repository state against starting basis;
- task-attributed changed files are project-relative;
- exclude Dope-owned `.dope/agent/**` persistence from task-authored source attribution while keeping its existence honest;
- record bounded diff stats/summary, not an unbounded patch;
- record final HEAD and flag unexpected HEAD change as failure/authority violation.

Validation:
- persist command, bounded result/status, timing/exit outcome and whether it satisfied a task validation target;
- validation evidence must come from observed execution, not model narration;
- never persist full sensitive environment.

Restart reconciliation:
- on attach/startup, terminal runs remain unchanged;
- a run persisted as running/cancelling without a live owned executor becomes interrupted;
- preserve existing modifications/events/recovery metadata;
- do not auto-resume;
- optional manual future resume is not required.

Tests cover:
- initial clean basis;
- Dope metadata exclusion;
- modified/added/deleted/renamed task files;
- bounded diff;
- HEAD unchanged;
- validation pass/fail;
- cancellation preserves partial modifications;
- stale running -> interrupted across fresh backend/store instance.

## P6 — Minimal Agent Run workbench surface — 0.8.12 — T1/T2

Add one small workbench surface over stable backend contracts.

Required UI:
- objective/instructions editor for a direct task;
- model policy display/control: Follow Coding Agent by default, exact target only where current inventory supports it;
- resolved Coding Agent summary;
- clear 8B ExecutionGrant summary;
- explicit Accept Grant before Start;
- Start and real Stop;
- status and elapsed state;
- streamed bounded activity;
- changed files;
- validation results;
- bounded diff/change summary;
- completed/cancelled/failed/interrupted inspection after reopening/restart.

Use existing Dope Dark workbench conventions and neutral utility styling. This is functional product UI, not a new design system.

Add an ordinary command/view entry such as `Dope: Open Agent Run`. Do not add Development Session, WorkItem, phase-stack, multi-agent or rich steering UI.

Frontend never receives provider tokens, hidden reasoning, raw env dumps or unbounded provider payloads.

Focused tests:
- command/widget/service wiring;
- grant acceptance gating;
- start/stop;
- status/activity rendering;
- terminal/restart inspection;
- no secret/raw payload presentation;
- accessibility for controls/status.

No live hosted mutation in P6.

## P7 — Phase 8B Agent execution core qualification closeout — 0.8.13 — T3

Qualify one exact candidate with a real eligible Codex connection and a newly created disposable clean Git repository.

### Happy path

From the real Dope UI:
- open Agent Run;
- create a direct bounded task that changes a simple project file and runs a local validation command;
- use Follow Coding Agent or an explicit qualified Codex target;
- review/accept the one 8B grant;
- start;
- observe agent-message/status plus real command/file activity where emitted by the adapter;
- require successful terminal completion;
- verify changed-file list, bounded diff summary and validation evidence against the actual filesystem/Git result;
- verify repository HEAD is unchanged and nothing is staged/committed by Dope or the agent;
- restart Dope and inspect the same durable task/run/evidence.

### Authority adversarial path

Using controlled disposable tasks/fixtures, attempt effects that the default grant denies:
- network;
- write outside project root;
- read/write private HOME/credential-like path;
- mutate `.git` / Git history/control state;
- destructive/system/package-administration effect.

Require actual enforcement, an authority-denied/unsupported record, and no prohibited effect. If the installed reference harness cannot prove the boundary, 8B is Not Green; do not weaken the grant.

### Cancellation / interruption

Run a second task that makes at least one observable workspace change then continues long enough to stop:
- Stop -> cancelling -> cancelled/interrupted;
- active provider process/turn stops;
- no later effects appear;
- pre-stop modification remains;
- no auto-revert;
- no Git commit.

Then force-close/restart during a third active run:
- persisted running/cancelling state reconciles to interrupted;
- existing changes/evidence remain inspectable;
- no automatic task continuation occurs.

### Security / persistence

Inspect `.dope/agent/`, browser-visible state and logs:
- no access/refresh/ID token;
- no hidden reasoning;
- no arbitrary env dump;
- no unbounded provider payload;
- paths/events are bounded and project-relative where required.

### Automated T3

Run once on the exact candidate:
- all focused 8B tests;
- `npm run check`;
- `npm run codex:phase:validate -- p8b`;
- version/internal-reference/no-root-lock and `git diff --check`;
- Electron/native direct evidence when needed to prove real child-process/sandbox/cancellation behavior.

Write `docs/tasks/p8b/closeout.md` with exact candidate, commands, direct evidence, residual gaps and Green / Not Green / Evidence Gap truth.

A tiny P7 repair is allowed only inside the approved 8B boundary; rerun only invalidated evidence.

If Green, route to fresh Phase 8C sequential task/phase-stack planning. Do not implement sequences/checkpoint commits inside this closeout.
