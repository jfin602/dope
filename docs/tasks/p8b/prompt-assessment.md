# Product Phase 8B Prompt Assessment — Agent Execution Core

Status: **APPROVED / PROMPTS WRITTEN / READY FOR EXECUTION**
Execution folder: `p8b`
Product slice: **Phase 8B — Agent execution core**
Baseline: `bdf01b1cf518e44b8187a40db5d199fac7ad693b`, package `0.8.6`
8A qualified source: `17806d3050cd6e3d4c793bc8856af8daeaaef63f`

## Conclusion

Use exactly seven prompts.

| Prompt | Boundary | Tier | Model | Browser |
| --- | --- | --- | --- | --- |
| P1 | provider-neutral execution domain + authority state machine | T1 | GPT-6 Sol High | no |
| P2 | durable project-local AgentTask/AgentRun/events store + RPC boundary | T2 | GPT-6 Sol High | no |
| P3 | Codex mutation adapter + enforceable sandbox/tool boundary | T2 | GPT-6 Sol High | no |
| P4 | Agent Runtime orchestration + role/exact resolution + real cancellation | T2 | GPT-6 Sol High | no |
| P5 | Git basis/change/validation evidence + restart reconciliation | T2 | GPT-6 Sol High | no |
| P6 | minimal Agent Run UI | T1/T2 | GPT-6 Sol Medium | no |
| P7 | real disposable-repo mutation/security/cancel/restart/browser qualification + closeout | T3 | GPT-6 Sol High | yes |

This is the smallest safe split. Domain authority, durable execution truth, provider sandbox enforcement, runtime orchestration and evidence/recovery are different correctness boundaries. Combining them would make failures hard to attribute and would push ordinary prompts beyond the repository's <=8-minute target / 15-minute hard budget. Live hosted mutation and adversarial authority evidence are concentrated in P7.

## Current-source findings

### There is no live agent domain package yet

The repository currently has AI connection/routing, Chat, Planning, Software Map and Theia integration packages, but no AgentTask/AgentRun/ExecutionGrant implementation package.

ARCHITECTURE already names future agent-core/agent-runtime/authority boundaries while also warning against empty package ceremony.

Create one concrete `@dope/agent-core` package first for provider-neutral domain contracts, strict parsing and pure authority/state rules. Do not create separate agent-state, agent-runtime and authority packages before real code requires them.

Node persistence and runtime adapters can expose clean seams without multiplying packages.

### Existing Codex App Server is intentionally read-only

`packages/theia-extension/src/node/codex-app-server.ts` is the Phase 8A connection/test path. Its strict config is read-only, disables shell tools, disables web search and runs the tiny Test Connection in a scratch root.

Do not mutate that contract into a dual-purpose object.

8B needs a distinct `AgentExecutionAdapter` path for project work. It may extract/reuse low-level JSON-RPC/process plumbing where that reduces duplication, but Test Connection must remain permanently read-only and zero-project-data.

### The mutation grant is stricter than "workspace-write"

The Dope grant requires project-only mutation/process behavior while denying Git writes/history changes, network, secrets/private-home access and outside-root effects.

The Codex adapter must map that to the strongest current sandbox controls and directly prove the boundary. Prompt text is not an authority mechanism.

Use workspace-write behavior only when:
- the canonical working directory is the approved project root;
- network is disabled;
- only the approved root is writable;
- temporary-directory/environment writable-root escape is disabled where supported;
- HOME/CODEX_HOME stay isolated and are not exposed as project authority;
- `.git` and equivalent Git history/control paths remain protected;
- unsupported or weaker enforcement rejects the run.

P3 must inspect the installed/current App Server configuration/protocol rather than freeze guessed provider event names into Dope's domain.

### Coding Agent resolution already exists

Phase 8A added `agentExecution` inventory and Coding Agent eligibility. `AIRoleRoutingService.resolve()` already returns deterministic role resolution over current inventory/policy.

Agent Runtime should reuse that resolution policy rather than create a second Coding Agent selector.

For 8B:
- role-following requests resolve once before execution;
- exact target requests stay exact;
- actual immutable connection/model/runtime provenance is recorded on the run;
- no fallback is allowed after mutation/effects begin;
- no ChatGPT-plan -> generic OpenAI API billing fallback is invented.

### Provider-native thread identity remains recovery metadata

Codex thread IDs can help adapter recovery, but AgentTask and AgentRun identities are Dope-owned. Provider thread IDs never become project identity, authority or completion truth.

### Persistence is project-local and itself changes the worktree

Approved 8B persistence is:

```text
.dope/agent/
  tasks/<task-id>.json
  runs/<run-id>/run.json
  runs/<run-id>/events.jsonl
```

The repository does not globally ignore `.dope/`. Therefore Agent Runtime must capture the starting Git basis before its own run metadata affects status, and must not misattribute `.dope/agent/**` persistence writes as coding-agent source changes.

Do not silently add `.dope/agent` to `.gitignore`: project-local execution history is intentionally portable state. Keep Dope-owned metadata distinguishable from task-authored workspace changes.

### Project identity must remain portable

Do not create a second canonical project identity solely for Agent Runtime and do not require Project Mind initialization before a direct coding task.

The execution service attaches to a canonicalized project root at runtime. Durable task/run state should use a project-local root reference plus any already-available stable project identity when appropriate; avoid persisting sensitive absolute host paths as project truth.

### Git evidence should be Dope-observed

Use Git inspection directly from Dope for:
- starting HEAD;
- initial clean/dirty basis;
- final HEAD;
- status/changed paths;
- bounded diff summary.

Do not ask the model to narrate its own diff and treat that as evidence.

8B never stages or commits.

### Cancellation must stop effects, not merely update UI

A Stop action must:
- persist `cancelling`;
- interrupt the active provider turn/process;
- prevent additional effects;
- end as `cancelled` or honest `interrupted`;
- preserve already-written workspace changes;
- never auto-revert.

If the current App Server protocol does not expose a reliable scoped interrupt, the first single-run adapter may use a dedicated per-run process/session so process termination is a real cancellation boundary.

### Restart inspection is required; automatic continuation is not

After restart, durable runs remain inspectable.

A run that was persisted as running/cancelling but has no live owned execution after backend restart must be reconciled to `interrupted` with preserved evidence. 8B does not silently resume work. Provider-native recovery handles may be shown/retained for later use without implying safe continuation.

### Event normalization must remain provider-neutral

The minimum durable event vocabulary is:
- agent-message;
- command-started;
- command-completed;
- file-changed;
- validation;
- status;
- warning;
- authority-denied;
- bounded provider-event for diagnosis.

Persist bounded summaries, timestamps and project-relative paths where available. Never persist hidden reasoning, arbitrary environment dumps, secrets or unbounded raw provider payloads.

### UI can stay intentionally small

8B only needs a single Agent Run workbench surface. It is not Development Sessions and does not need WorkItem delegation, full steering, multi-agent orchestration or sequence management.

## Dependencies and order

P1 defines trusted domain state before persistence.

P2 makes that state durable and restart-readable before execution exists.

P3 proves the provider adapter can honor the grant before Agent Runtime depends on it.

P4 connects task/grant/routing/adapter and owns cancellation.

P5 adds independently observed Git/change/validation/restart truth after the lifecycle exists.

P6 presents stable backend contracts.

P7 is the only live hosted mutation/security/browser qualification gate.

## Preserved behavior

- Phase 8A Codex Test Connection stays read-only and zero-project-data.
- AI Center remains the owner of global Codex auth/account/model/runtime configuration.
- Coding Agent role policy remains the model-selection authority.
- Chat and Software Map remain isolated from Codex-only agent targets.
- secrets remain outside project/browser/log state.
- no silent billing/provider fallback.
- developer remains final authority for mutation.
- no Git write/checkpoint behavior in 8B.

## Deferred work

Phase 8C:
- AgentTaskSequence;
- existing prompt-stack import/parser;
- version progression;
- clean/dirty continuation policy;
- manual/browser gates;
- capacity retry;
- Dope-owned stage/commit/checkpoint;
- automatic sequence resume.

Phase 8D:
- WorkItem -> AgentTask;
- richer ProposedAction/escalation;
- steering;
- diff accept/reject UX;
- Software Map impact/staleness bridge.

Later:
- local coding-agent compatibility (8E);
- DeveloperSession (9);
- continuous alignment (10).

## Main risks

1. Treating provider sandbox mode as proof of the Dope grant without adversarial verification.
2. Reusing the read-only Test Connection object and weakening its guarantees.
3. Letting provider threads become canonical AgentRun identity.
4. Recording secrets/raw environment/provider payloads in JSONL.
5. Counting Dope's own `.dope/agent` writes as agent code changes.
6. UI-only cancellation that leaves a child/turn continuing.
7. Fallback after partial mutation.
8. Restart code silently continuing a run whose authority/external state can no longer be proven.
9. Pulling 8C Git/version/sequence semantics into 8B.

## Evidence strategy

P1 is deterministic domain/authority testing.

P2-P5 are bounded T2 integration gates because persistence, process/sandbox, routing/runtime and Git/restart truth each cross package/backend boundaries.

P6 uses focused presentation/service tests; no need for live provider/browser evidence.

P7 owns:
- real Codex hosted mutation;
- adversarial grant-denial evidence;
- cancellation;
- forced restart/interruption;
- direct UI evidence;
- one aggregate repository gate;
- exact closeout truth.

Do not rerun T3 evidence after each implementation prompt.
