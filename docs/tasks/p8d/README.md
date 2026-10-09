# Phase 8D — General Scoped Delegation

Status: ACTIVE / REVISED UNEXECUTED PROMPT STACK / NOT YET QUALIFIED
Starting version `0.8.20`; P1-P13 `0.8.21`–`0.8.33`; final P13 manual browser/T3.

| Prompt | Target version | Scope | Tier | Model | Browser |
| --- | --- | --- | --- | --- | --- |
| P1 | 0.8.21 | WorkItem ownership schema and legacy defaults | T1 | Sol Medium | no |
| P2 | 0.8.22 | AgentTask WorkItem origin and review metadata | T1 | Sol High | no |
| P3 | 0.8.23 | Revision-safe WorkItem to AgentTask launch service | T2 | Sol High | no |
| P4 | 0.8.24 | WorkItem frozen candidate review hold | T2 | Sol High | no |
| P5 | 0.8.25 | Explicit safe candidate accept or reject | T2 | Sol High | no |
| P6 | 0.8.26 | Blocked ProposedAction records without new permission | T1 | Sol High | no |
| P7 | 0.8.27 | Durable steering with truthful acknowledgement | T2 | Sol High | no |
| P8 | 0.8.28 | Bounded applied-change Software Map impact | T2 | Sol High | no |
| P9 | 0.8.29 | Planning WorkItem ownership and launch UI | T1 | Sol Medium | no |
| P10 | 0.8.30 | Work candidate review diff and accept/reject UI | T1 | Sol Medium | no |
| P11 | 0.8.31 | Work steering, blocked action and map impact UI | T1 | Sol Medium | no |
| P12 | 0.8.32 | Focused delegation integration and legacy regression | T2 | Sol High | no |
| P13 | 0.8.33 | Phase 8D live GUI qualification and closeout | T3 | Sol High | yes |

## Eight-minute execution law
P1–P11: <=8-minute implementation + necessary focused validation target, 15-minute maximum. Run only tests added/changed and directly affected existing tests. Unit tests commonly import compiled `lib/`, so one build of **changed** packages is necessary when tests otherwise run stale output. No unconditional `build:extension`, root tests/typecheck, browser/Electron builds, packaging or restart suite. P12: bounded cross-package integration, register new test files in the existing `test:product` list. P13: manual T3 and **one** exact-candidate `npm run check` (already builds and tests); no additional `npm test` or repeated build. `git diff --check` remains cheap. All failures remain truthful.

WorkItem-origin snapshot on AgentTask is the canonical linkage; inverse WorkItem->task query is derived from AgentStore rather than duplicated mutable cross-store state.

Validate: `npm run codex:phase:validate -- p8d`
Run: `npm run codex:phase -- p8d`
Authority: ADR 0031, Phase 8D plan, ADR 0028/0029. Direct Work/Prompt Stack and c8-work-mode Green remain preserved.
