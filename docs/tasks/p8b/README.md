# Product Phase 8B — Agent Execution Core Task Stack

Status: **READY FOR EXECUTION**
Execution folder: `p8b`
Product slice: Phase 8B — Agent execution core
Baseline: package `0.8.6` at `bdf01b1cf518e44b8187a40db5d199fac7ad693b`
8A qualified source: `17806d3050cd6e3d4c793bc8856af8daeaaef63f`
Version range: `0.8.7` -> `0.8.13`

## Goal

Prove one provider-neutral, mutation-capable AgentTask path under an explicit bounded ExecutionGrant, with durable AgentRun state, observable effects, real cancellation, restart inspection, and trustworthy change/validation evidence.

This slice deliberately stops before sequential phase-stack execution.

## Stack

| Prompt | Version | Boundary | Tier | Model | Browser |
| --- | --- | --- | --- | --- | --- |
| P1 | 0.8.7 | AgentTask / AgentRun / ExecutionGrant domain and authority | T1 | GPT-6 Sol High | no |
| P2 | 0.8.8 | Project-local task/run/event persistence and service boundary | T2 | GPT-6 Sol High | no |
| P3 | 0.8.9 | Codex mutation-capable AgentExecutionAdapter and sandbox enforcement | T2 | GPT-6 Sol High | no |
| P4 | 0.8.10 | Agent Runtime lifecycle, role resolution, execution and cancellation | T2 | GPT-6 Sol High | no |
| P5 | 0.8.11 | Git basis, changed-file/diff/validation evidence and restart reconciliation | T2 | GPT-6 Sol High | no |
| P6 | 0.8.12 | Minimal Agent Run workbench surface | T1/T2 | GPT-6 Sol Medium | no |
| P7 | 0.8.13 | Real Codex mutation/security/restart/browser qualification and 8B closeout | T3 | GPT-6 Sol High | yes |

## Entry gate

Satisfied:
- Phase 8A is Green / Qualified at exact `0.8.6` source `17806d3050cd6e3d4c793bc8856af8daeaaef63f`;
- the later qualification/docs commits are non-product-code follow-up;
- Phase 8B authority/product contracts are approved in ADR 0027, PRODUCT-MODEL, ARCHITECTURE and the active roadmap;
- current prompt-planning baseline is `bdf01b1cf518e44b8187a40db5d199fac7ad693b`, package `0.8.6`.

Before execution:

`npm run codex:phase:validate -- p8b`

## Scope law

8B may:
- read the approved project root;
- mutate project workspace files after explicit grant acceptance;
- run project-local processes/tests/builds;
- inspect Git;
- use the already-authorized hosted Codex connection selected through Coding Agent or an exact target.

8B must deny:
- Git stage/commit/reset/rebase/checkout/switch/history mutation;
- network from the coding-agent sandbox;
- secrets/private-home access;
- effects outside the approved project root;
- destructive/system/package-administration effects.

If the reference harness cannot enforce a requested boundary, the mutation path fails closed.

## Deliberately deferred

Do not add in this stack:
- AgentTaskSequence;
- phase/correction prompt-stack parsing or version progression;
- browser/manual sequence gates;
- dirty-tree continuation semantics;
- capacity retry policy;
- Dope-owned checkpoint commits;
- automatic sequence resume;
- WorkItem delegation;
- Phase 9 DeveloperSession;
- Phase 10 continuous state alignment.

Those remain later Phase 8/9/10 work.

## Closeout routing

P7 closes **Phase 8B only**. If Green, route next to fresh Phase 8C planning for sequential task / phase-stack execution.
