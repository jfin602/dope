# Product Phase 3 — Planning Activation

Status: OWNER APPROVED — ACTIVE
Date: September 28, 2026
Package baseline: `0.3.0`

## Decision

The owner explicitly closed Product Phase 2 for sequencing after reviewing its `0.2.6` Not Qualified audit and authorized Product Phase 3 — Planning.

This decision accepts the recorded Phase 2 evidence gaps for roadmap sequencing only. It does not rewrite any P6 gate as Green and does not change the historical Phase 1 result.

## Preserved evidence

Retain as unresolved historical evidence:
- the initially hidden legacy Project Mind migration entry;
- missing direct dirty same-renderer workspace-switch evidence;
- exact `0.2.6` AppImage native launch/direct native visual Project Mind evidence gap;
- inherited Phase 1 failures/gaps where applicable.

Phase 3 does not need to repair these before entry. If Phase 3 directly changes an affected path, it must preserve the history and record any new evidence separately.

## Activation baseline

The exact coherent source/package activation baseline is `95815b04977a229abfdfdba628eb9dddc9e55203`, the commit that establishes `0.3.0`, Phase 3 authority and ADR 0006. The task-stack commit may be later; P1 must require this activation source to be reachable and the working baseline to remain coherent `0.3.0`.

Root, both applications and existing internal packages must agree on `0.3.0`; internal `@dope/*` references and baseline assertions must match. Theia remains `1.75.0`, Electron `42.8.1`, Node 24 major.

The first runner prompt advances `0.3.0 -> 0.3.1`.

## Scope authorization

Authorized:
- framework-independent Planning contracts;
- one real `@dope/planning` package;
- readable local Planning persistence bound to existing Project Mind identity;
- production Planning workspace and Task detail;
- Project Mind/Planning links and bounded create-Plan-from-Decision bridge;
- file navigation into ordinary coding surfaces;
- restart, isolation, package and direct GUI qualification.

Not authorized:
- model/provider runtime;
- OpenAI/Codex or local-model product integration;
- Agent Mind;
- AI ownership/delegation;
- tool execution/authority;
- autonomous mutation;
- Development Sessions.

ADR 0006 applies to the next AI phase, not to this implementation stack.

## Execution

After the p3 task stack is committed, validate:

`npm run codex:phase:validate -- p3`

Then execute with the phase runner. P1-P4 are runner-owned; P5 is the direct interactive GUI handoff; P6 is evidence-only closeout.
