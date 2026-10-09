# Product Phase 8 — Coding Agent / Scoped Delegation Plan

Status: **PHASE 8 ACTIVE / PHASE 8D OWNER-ACTIVATED 2026-10-09; NOT YET QUALIFIED**. 8A–8C and `c8-work-mode` Green.
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

**GREEN / QUALIFIED at `0.8.13`.** Qualified product/test source: `bd0b6ff`; docs-only closeout: `c11756e`.

The corrected direct AgentTask substrate proves the ADR 0028 boundary end-to-end:
- isolated ExecutionWorkspace;
- CandidateDelta classification;
- Dope-owned create/modify promotion;
- denied delete/rename/mixed-candidate promotion;
- live hosted execution;
- cancellation without authoritative promotion;
- restart interruption without authoritative promotion;
- durable secure AgentRun reopen.

The historical P7 Not Green result and original architecture-gap Cycle 1 remain retained evidence. Four of five post-correction cycles were used. Final reported qualification included 69/69 focused tests, `npm run check`, the p8b validator, fresh sandbox proof and seven direct promotion fixtures.

Phase 8B is closed for its direct AgentTask scope. Phase 8C is authorized.

## 8C — Sequential task / phase-stack execution

**HISTORICALLY GREEN / QUALIFIED / CLOSED** at the exact `0.8.20` 8C fixture; later real Adaptive SEO Prompt Stack Green in Cycle 2 of 5. First implementation version was `0.8.14`.

PhaseStackAdapter imports `docs/tasks/<stack>/P*.txt` into a normalized immutable snapshot with a source fingerprint. It preserves prompt order, phase/correction mode, model/reasoning, browser/manual requirement, version policy, closeout classification and prompt text. The product must not shell out to the external `codex-phase.mjs` runner as runtime.

AgentTaskSequence persists beneath `.dope/agent/sequences/<sequence-id>.json` and records source stack/fingerprint, ordered entries, AgentTask IDs, AgentRun attempts, checkpoint SHAs, current task/gate, Git/version/worktree basis, explicit dirty-tree basis when accepted and blocked/failure/interruption reason.

Safe progression is the intersection of durable sequence state, reachable Git history/checkpoint SHAs, current HEAD, package/version state, authoritative worktree basis and stack fingerprint. Ambiguity blocks automatic resume.

Default task start requires a clean authoritative worktree. The developer may explicitly accept the current dirty worktree; that exact basis is then part of checkpoint scope and ExecutionWorkspace derivation. Later unrelated dirty work is never silently absorbed.

Each executable prompt becomes a phase-stack-origin AgentTask and runs through the qualified 8B Agent Runtime / ExecutionWorkspace / CandidateDelta / Authority path. Capacity retry is bounded orchestration for the same task/workspace and never promotes or checkpoints between attempts.

After a successful run, Dope owns staging/commit. Preconditions include successful promotion, required validation, correct phase/correction version, coherent internal references, no forbidden root lock, unchanged pre-task HEAD and an exact accepted checkpoint scope. Do not blindly stage unrelated ambient work. Runtime `.dope/agent/**` state is excluded from ordinary implementation checkpoints.

Commit subjects remain runner-compatible: phase tasks use exact target version; correction tasks use `<folder>/P<n>: <task title>`. Commit bodies are bounded Dope-owned summaries from task/run/validation/applied evidence, not raw provider narration.

Validation failure, cancellation/interruption, authority block, checkpoint invariant failure or unexpected HEAD movement stops the sequence, creates no checkpoint and advances nothing.

`Browser required: yes.` entries are manual gates. The final closeout is also a terminal manual gate. Dope shows the exact snapshotted prompt and expected metadata, starts no later task and never fabricates manual evidence. Resume requires re-reading Git/version/stack truth; clicking Resume alone is not completion evidence.

After restart, reconcile stale AgentRuns first, then sequence/Git/version/worktree/stack truth. Determine exactly one safe next action or block.

Minimal UI extends Agent Run with Import/Open Stack, ordered entries, current task/gate, model/reasoning/version, Git/version basis, checkpoint SHA, Start/Resume/Stop and blocked/validation/checkpoint state.

First Green dogfood uses a real Dope phase/correction stack through at least two automated checkpoints, a real manual/browser gate, application restart, same-gate reopen, external/manual checkpoint reconciliation and safe resume. Also qualify validation failure, cancellation, authority block, capacity retry, unexpected HEAD movement, explicit dirty-tree continuation, source-stack drift and duplicate-checkpoint prevention.

## c8-candidate-validation — Dope-owned required validation correction

The historical Phase 8C closeout remains Green for its exact qualified fixture. Subsequent Adaptive SEO dogfooding exposed a project-generalization gap: the authoritative project passes `npm run check`, while required validation inside the provider sandbox fails because the real suite needs private temporary filesystem state and a loopback HTTP fixture.

ADR 0029 therefore inserts a bounded correction before 8D.

Deliver:
- Dope-owned CandidateValidationRunner after provider execution and before promotion;
- frozen candidate identity plus isolated ValidationWorkspace;
- private bounded temp / `TMPDIR` / private `/tmp`;
- private network namespace with loopback only where required;
- no host loopback, LAN/Internet, private user state, authoritative writes, Git writes or package-admin authority;
- durable passed/failed/cancelled/not-started validation evidence with bounded output;
- provider-run test commands remain activity evidence and cannot satisfy required CompletionPolicy validation;
- promotion/checkpoint denied unless required candidate validation passes and frozen candidate identity remains unchanged.

Qualification gate:
- focused security/process tests for temp, loopback, host/network denial, cancellation/timeout, bounded evidence and candidate immutability;
- real Adaptive SEO P1 `npm run check` passes through CandidateValidationRunner;
- resume `c4-dope-phase-stack-smoke` through P2, P3 browser/manual gate, restart, P4 closeout and completed reopen.

Those gates are now Green; c8-work-mode is the remaining pre-8D correction.

## c8-work-mode — Work control plane, Prompt Stack naming and transcript correction

The existing `c8-agent-run-transcript` scope is expanded and renamed prospectively to **`c8-work-mode`**. This is a bounded pre-8D presentation, persistence and terminology correction, not a new mutation/validation contract. Phase 8C historical fixture remains Green. The real Adaptive SEO `c4-dope-phase-stack-smoke` Prompt Stack also qualified **Green in Cycle 2 of 5**: P1/P2 Dope-owned validation and checkpoints, P3 browser/manual 48/48, P4 final closeout, pending-gate restart and completed reopen with no duplicates. Cycle 1 failure is historical; production integrations were outside the fixture-backed smoke test.

Canonical user-facing vocabulary: **Work / New Work / Work history / Work detail**, **Prompt Stack** (both phase and correction), **Prompt Stack runner**. Internal AgentTask, AgentRun, AgentTaskSequence, ExecutionGrant, WorkItem and PhaseStackAdapter may retain their names. Existing prompt grammar, snapshots and Git subjects are not renamed.

Deliver:
- separate Chat and Work panel modules in left/right/center/bottom, reusing appropriate ownership/focus, restoration and presentation conventions without a mode toggle;
- left/right toolbar Work entry and command aliases for older Agent Run / Phase Stack actions;
- Select Work with Running, History and automatically discovered Prompt Stacks from a project-relative tasks root defaulting to `docs/tasks/`; Work panel detail to control and observe a selected task/run/sequence;
- dynamic tab/header title from snapshotted Prompt Stack task `entry.title` or direct AgentTask objective, stable for historical runs after sequence advancement;
- durable ordered sanitized visible agent messages, and one structured command per start/completion pair with collapsed-by-default command/status/exit/duration and expandable bounded output;
- Work panel controls/progress/validation/files/authority/checkpoints and an optional read-only center transcript tab with formatted messages, near-bottom live-follow and jump-to-latest;
- retained complete transcript and structured commands on restart from Dope-owned `transcript.jsonl`, independent from provider session survival;
- a New Work composer only for explicit bounded AgentTask start under Coding Agent/ExecutionGrant. No automatic in-flight steering.

Safety: Chat conversation persistence, Interactive model role and single-Chat leases remain separate from Agent Runtime storage, Coding Agent model role, developer grants, ADR 0028 promotion, ADR 0029 required validation, Git/checkpoint and manual gates. No hidden reasoning, raw RPC payload, secrets or unbounded logs are stored. Keep existing completed Adaptive SEO sequence and historical 8B/8C evidence unchanged.

Qualification: schema/persistence/sanitization/command correlation/full transcript replay; shared Agent Runtime channel, project reattachment, separate Chat/Work restoration and Work ownership; Running/History truth; independent center editor; task-derived titles; toolbar and legacy command integration; safe multi-area direct GUI testing; completed Prompt Stack same SHAs after reopen; no Chat or execution authority regression. The first P9 GUI attempt remains Not Green in `docs/tasks/c8-work-mode/closeout.md` until repair qualification is recorded.

**Gate cleared:** `c8-work-mode` P9 has qualified Green at unchanged `0.8.20` after the Green `c8-chat-work-ui` correction. Owner activates 8D on 2026-10-09; retained Not Green attempts remain historical.

### Historical pre-qualification visual correction — c8-chat-work-ui (now Green)

October 8, 2026: before another `c8-work-mode` P9 qualification replay, apply a bounded **UI-only** correction to Chat, Work, Select Chat, Select Work and the read-only center AgentRun transcript using AI Center's visual grammar and the current amended Dope Dark primary accent `#336699`. See ADR 0016 (October 8 amendment) and ADR 0030. Align compact selection/navigation, subdued Work diagnostics, and centered safe-Markdown agent prose with Chat assistant messages (without user bubbles), while preserving pagination, command disclosures, scroll follow, restoration, alternative user themes and accessibility.

Route: `/prompt-ass -> /prompt-plan -> /prompt-write c8-chat-work-ui`; prefer bounded selector/controls and transcript presentation implementation slices, followed by one direct UI/T3 qualification gate. Do not run the existing Work P9 as if it were Green. Its October 8 repaired replay remains **Not Green**: a live command expansion was not observed because a disposable reference run ended `authority-denied`, also leaving required validation/promotion unqualified. That **separate execution-adapter/authority investigation** must be repaired and tested without widening ADR 0028/0029 boundaries before P9 can close Green. The UI correction does not change AgentTask, AgentRun, AgentTaskSequence, grants, checkpoint identities, historical evidence or package version.

## 8D — General Scoped Delegation

**ACTIVE / PLANNING (2026-10-09), baseline `0.8.20`.** Current authority is ADR 0031 plus `docs/planning/p8/phase-8d-plan.md`; `docs/tasks/p8d/` is the next stack. The 2026-10-08 c8-chat-work-ui and prior P9 blocker notes below are preserved as historical planning, not current blockers. Existing direct Work and Prompt Stack promotion remain qualified, while WorkItem-origin execution adds separate review-before-promotion.

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

### c8-work-mode
Focused Chat/Work panel, Prompt Stack navigation, AgentRun transcript/command persistence, ownership/restoration, titles, toolbar and direct GUI qualification.

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
