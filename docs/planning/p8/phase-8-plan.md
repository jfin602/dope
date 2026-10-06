# Product Phase 8 — Coding Agent / Scoped Delegation Plan

Status: **OWNER-ACTIVATED AT `0.8.0` / 8A GREEN / QUALIFIED AT EXACT `0.8.6` SOURCE / 8B DOCS REVIEW NEXT**
Date: 2026-10-05
Expected package family after activation: `0.8.x`
Activation baseline: coherent `0.8.0` from owner sequencing waiver after retained `c7-chat-project-grounding` Not Green
Primary authority: ADR 0027, ADR 0026, ADR 0006, PRODUCT-MODEL, ARCHITECTURE, stability contract

## Goal

Make Dope capable of performing the bulk of its own implementation workflow under explicit developer control.

The first product workflow is not generic autonomy. It is the proven sequential prompt-stack loop currently executed by the external phase runner, rebuilt over Dope-owned agent/task/authority contracts.

## Entry gate

Phase 7 is owner-approved closed at actual `0.7.31`.

The approved `c7-chat-project-grounding` correction executed and closed **Not Green**. On 2026-10-05 the owner explicitly accepted those retained gaps for sequencing and activated Phase 8. This waiver does not make the correction Green and does not erase its open qualification record.

The coherent activation baseline is `0.8.0`; Phase 8A begins from that baseline.

## Core product contracts

### AgentTask

One bounded delegated execution request, independent from provider/runtime.

Origins:
- phase/correction prompt;
- WorkItem;
- direct developer coding request;
- later DeveloperSession orchestration.

### AgentRun

One execution attempt for an AgentTask with observable status, actual runtime/model provenance, authority grant, tool/command/file activity, changes, validation and checkpoint outcome.

### AgentTaskSequence

Ordered tasks with durable progression/stop/resume state.

The first adapter maps existing `docs/tasks/<stack>/P*.txt` stacks into sequences.

### ExecutionGrant

Developer-approved effect envelope for the task/sequence.

ADR 0028 now splits execution authority from authoritative project promotion.

Minimum dimensions:
- accepted project identity / starting basis;
- project observation;
- isolated ExecutionWorkspace read/write/process/test/build;
- authoritative project create/modify/delete/rename promotion;
- Git inspect/stage/commit policy;
- network;
- secrets/private state;
- outside-execution-workspace effects;
- system/package-administration effects;
- escalation/stop conditions.

Corrected 8B posture:
- project reads / basis capture: allowed;
- ExecutionWorkspace read/write/process/test/build: allowed after grant;
- authoritative project create/modify promotion: allowed after grant;
- authoritative project delete/rename: denied;
- Git inspection: allowed;
- Git stage/commit/history mutation: denied in 8B;
- outside-workspace, network, secrets/private state and system/package-admin: denied.

The provider never writes the authoritative project root directly.

## Phase 8A execution stack

The active 8A stack lives at `docs/tasks/p8a/` and targets `0.8.1` through `0.8.6`.

The runner now treats slice `A` as the explicit first pre-1.0 slice: `p8a` may begin at patch 1 from `0.8.0`; later lettered slices remain continuations. The earlier `docs/tasks/p8/` draft is superseded by `p8a`.

## 8A — Codex reference connection

Extend AI Center first.

Deliver:
- Codex agent-runtime connection type;
- Continue with ChatGPT / ChatGPT-plan authorization;
- secure account/token lifecycle;
- hosted locality classification;
- account-specific model inventory;
- `agentExecution` capability;
- Coding Agent role eligibility;
- lazy App Server lifecycle;
- zero-project-data Test Connection;
- explicit usage/settings navigation;
- no API-key billing fallback.

Qualification is connection/runtime only. No project mutation yet.

## Phase 8A iterative qualification / repair loop

The initial `0.8.6` qualification reached **Not Green - Evidence Gap** after the real App Server path succeeded but the live Dope ChatGPT OAuth callback/account lifecycle did not complete.

The later three-cycle qualification cleared the live lifecycle and exact-source aggregate gates. Phase 8A is **Green / Qualified** at `17806d3050cd6e3d4c793bc8856af8daeaaef63f`, with the initial failed record retained in `docs/tasks/p8/closeout.md` and full cycle evidence in `docs/tasks/c8-p8a-qualification-loop/cycle-evidence.md`. Route next to fresh Phase 8B `/docs-review`; Phase 8B implementation has not begun.

Initial direct blocker chain (now cleared):
- complete the real loopback callback and token exchange;
- prove live Dope account/model inventory;
- prove restart persistence;
- prove refresh;
- prove authenticated App Server replacement + thread resume;
- prove sign-out and reconnect/reauthorization.

Use the manual loop in `docs/tasks/c8-p8a-qualification-loop/`.

Loop rules:
- maximum five cycles;
- begin with the first live OAuth callback blocker;
- each cycle qualifies until the first blocker, applies the smallest repair, runs only invalidated focused evidence, replays direct evidence, and checkpoints the coherent `0.8.6` candidate;
- stop immediately on all-Green;
- after Cycle 5 stop even if gaps remain;
- before Green, run the aggregate gate on the exact final source candidate;
- With all 8A blockers cleared, Phase 8B is eligible for a fresh `/docs-review`; no 8B implementation is part of this closeout.

## 8B — Agent execution core

**NOT GREEN / BLOCKED ON REQUIRED CORRECTION.** Phase 8A remains Green / Qualified. Phase 8B P7 and the bounded qualification loop remain historical Not Green evidence at `0.8.13`.

Cycle 1 proved that direct provider write access to the authoritative project cannot enforce the original `project-write allowed + destructive denied` contract. ADR 0028 therefore requires correction **`c8-agent-authority-boundary`** before 8B requalification or Phase 8C planning.

The corrected 8B vertical slice keeps AgentTask/AgentRun/ExecutionGrant + Agent Runtime, but changes mutation flow:
- one direct bounded AgentTask against a clean disposable project;
- resolve Coding Agent role to Codex;
- developer approves one ExecutionGrant;
- derive an isolated ExecutionWorkspace from the accepted project basis;
- allow provider read/write/process/test/build only inside that execution workspace under the coarse host-security ceiling;
- compute CandidateDelta after execution;
- classify authoritative create/modify/delete/rename effects deterministically;
- initial grant allows authoritative create/modify and denies delete/rename;
- if any candidate effect is unauthorized, promote none of the candidate delta;
- Dope-owned Authority + ToolExecutor applies authorized create/modify effects to the real project after basis/path revalidation;
- Git inspection remains allowed; Git writes/history changes remain denied;
- network, secrets/private-home, outside-workspace and system/package-admin effects remain denied;
- cancellation/interruption does not auto-promote partial candidate work;
- stream normalized activity and preserve candidate/applied/validation provenance;
- persist `.dope/agent/` task/run/events state and inspectable restart truth;
- record provider-native thread ID only as non-canonical recovery metadata.

The Phase 8A Test Connection remains permanently read-only and separate.

Do not require WorkItem yet.

Do not implement AgentTaskSequence, prompt-stack parsing, package-version progression, browser/manual gates, dirty-tree continuation, capacity-retry policy, Dope-owned Git checkpoint commits or automatic sequence resume. Those remain 8C and stay gated on a later Green 8B candidate.

## 8C — Sequential phase-stack execution

This is the primary near-term product milestone.

### PhaseStackAdapter

Read existing task stacks and preserve:
- ordered P1..Pn;
- Phase vs Correction mode;
- recommended model/reasoning;
- browser/manual requirement;
- phase target version or correction unchanged version;
- closeout classification;
- prompt text.

Prefer sharing/extracting pure parser/domain helpers from the external runner when clean. Do not shell out to the whole runner as product architecture.

### Sequence execution

Before task:
- canonical root and clean/dirty-state assessment;
- package/version compatibility;
- Git-proven completed prefix/checkpoint state;
- current HEAD/basis;
- ExecutionGrant confirmation.

During task:
- Coding Agent performs implementation;
- Dope shows agent activity, commands, file changes and elapsed state;
- developer can stop/steer within approved semantics;
- required validation runs.

After task:
- failure/Not Green/authority violation stops progression;
- preserve pre-existing dirty changes distinctly;
- successful implementation passes coherence/version/lock checks;
- Dope owns staging/checkpoint commit for this workflow;
- record commit SHA and advance exactly one task.

Manual/browser gate:
- stop visibly;
- show exact pending prompt and required manual action;
- never skip/fake the evidence;
- after externally completed coherent checkpoint, re-read Git/version truth and resume.

Restart:
- durable AgentTaskSequence/AgentRun state plus Git truth identifies the safe next action;
- ambiguous or externally changed history blocks automatic resume.

### First Green dogfood

Run a real Dope correction/phase stack inside Dope end to end through at least two implementation prompts and a manual/browser stop, restart, and resume.

## 8D — General Scoped Delegation

After phase-stack execution is reliable, generalize the same substrate.

WorkItem:
- may launch one/more AgentTasks;
- HUMAN / AI / SHARED ownership;
- working-set/acceptance/validation constraints feed the task/grant;
- completing AgentTask does not automatically complete WorkItem or prove implementation truth.

Add:
- ProposedAction where explicit consequential review is needed;
- richer live steering;
- diff/review/accept/reject;
- validation evidence;
- affected Software Map identity/staleness marker;
- targeted re-analysis request where useful.

Do not implement continuous state alignment; that remains Phase 10.

## 8E — Local coding-agent compatibility

Only after the reference Codex harness and task/authority/tool semantics are qualified.

Use representative identical AgentTasks/Sequences to compare:
- completion correctness;
- tool-call reliability;
- context capacity;
- latency;
- validation success;
- recovery behavior.

A local adapter may use different prompting/context/tool choreography but must preserve Dope AgentTask/AgentRun/ExecutionGrant semantics.

Local-model limitations must not cause provider-specific project state or weakened authority.

## Codex process/auth notes

Codex App Server is provider-specific adapter infrastructure.

- AI Center owns account/auth/model/runtime health.
- Agent Runtime starts/resumes work.
- tokens never become project state;
- refresh is serialized;
- refreshed access causes safe App Server restart/reinitialize;
- provider-native thread ID is recovery metadata only;
- Codex remains hosted for egress constraints;
- ChatGPT-plan failure never silently uses a generic OpenAI API key.

## Validation strategy

### 8A
T2/T3 connection/security integration:
- real sign-in;
- model inventory;
- refresh/restart lifecycle;
- multi-window credential-race test;
- zero-data Test Connection;
- no secret persistence/log leakage.

### 8B
After `c8-agent-authority-boundary`, focused + integration tests must prove ExecutionWorkspace isolation, CandidateDelta classification, all-or-blocked authority gating, Dope-owned create/modify promotion, denied delete/rename, cancellation/interruption without automatic promotion and one real Codex task on a disposable repo.

### 8C
T3 Dope-on-Dope dogfood:
- real task stack;
- validation/checkpoints;
- failure/cancel;
- dirty-tree safety;
- manual gate;
- restart/resume;
- direct GUI observability.

### 8D
Focused WorkItem delegation + direct review/steering qualification.

### 8E
Side-by-side reference/local task corpus after reference qualification.

## Non-goals

- no multi-agent orchestration;
- no cloud/remote execution;
- no autonomous long-duration agent swarm;
- no generic network/secrets authority by default;
- no requirement that all agent adapters expose identical capabilities;
- no DeveloperSession implementation yet;
- no Phase 10 background alignment;
- no product dependency on external phase-runner process;
- no requirement to finish local coding-model support before the reference sequential workflow becomes useful.

## Exit condition

Phase 8 is Green when Dope can safely execute real coding work through its own AgentTask/AgentRun/Authority substrate, run the sequential development workflow that currently carries most Dope implementation work, stop/resume correctly across manual gates/restart, and generalize the same mechanism to bounded WorkItem delegation with developer-controlled review and validation.

Local coding-agent compatibility should be demonstrated against the same contracts after the reference harness is qualified, but provider independence is architectural from the start.
