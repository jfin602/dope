# Product Phase 8B — Agent Execution Core Task Stack

Status: **P7 CLOSED NOT GREEN / PHASE 8B NOT QUALIFIED — QUALIFICATION LOOP STOPPED AFTER CYCLE 1 AT AN AUTHORITY ARCHITECTURE GAP**; see [closeout](closeout.md) and [repair loop](../c8-p8b-qualification-loop/README.md).
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

The executed P1-P7 stack used the original direct-project-write authority model and remains historical evidence.

ADR 0028 supersedes that mutation boundary for any requalification:
- provider/model mutation occurs only inside an isolated ExecutionWorkspace;
- provider processes never write the authoritative project root;
- CandidateDelta classifies create/modify/delete/rename effects;
- initial authoritative promotion allows create/modify and denies delete/rename;
- any unauthorized candidate effect blocks the whole candidate delta from promotion in corrected 8B;
- only Dope-owned Authority + ToolExecutor may apply authorized project changes;
- Git write/history, network, secrets/private-home, outside-workspace and system/package-admin effects remain denied.

If the reference harness cannot enforce the coarse host boundary, or Dope cannot enforce candidate promotion authority, the mutation path fails closed.

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

P7 closed **Phase 8B Not Green / Not Qualified**. The bounded `c8-p8b-qualification-loop` stopped after Cycle 1 at the direct-write authority gap. ADR 0028 now resolves the architecture direction; route next to implementation planning for **`c8-agent-authority-boundary`** at unchanged `0.8.13`, then requalify 8B. Phase 8C planning remains gated on a later Green / Qualified 8B candidate.
