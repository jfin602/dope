# Phase 8E — Local Coding Agent Compatibility

Status: **PROMPT STACK AUTHORED / AWAITING SEPARATE OWNER ACTIVATION / NOT IMPLEMENTED OR QUALIFIED**
Mode: Product Phase 8 continuation slice E. Previous qualified source: clean `0.8.33`, `8748cb4870e8cac3d2a5aca4a05623b5f3d747ec` (8D Green via `c8-fix` P6 cycle 2). Exact Phase 8D history remains in `docs/tasks/c8-fix/closeout.md`; original `docs/tasks/p8d/closeout.md` Not Green remains historical.
Expected phase continuation after owner activation: P1–P14 `0.8.34`–`0.8.47`. **No manifest has been bumped by writing these docs.**
Authority: ADR 0032, ADR 0004/0026/0027/0028/0029/0031, `docs/planning/p8/phase-8e-plan.md` and `docs/stability-contract.md`.

## Why this stack

AI Center already configures LM Studio and knows local loaded model capacity; Chat/synthesis calls do not constitute coding-agent execution. Current `AgentExecutionRuntime.select()` and `backend-module.ts` authorize/register only Codex. Phase 8E must implement a real Local model tool loop through the **existing** AgentExecutionAdapter, enforce OS isolation for file/process requests, advertise `agentExecution` only after capability and containment proof, and reuse the existing Dope-owned candidate/validation/review/Authority/sequence paths.

## Ordered stack (14 prompts)

| Prompt | Version | Responsibility | Validation | Model | Browser |
| --- | --- | --- | --- | --- | --- |
| P1 | 0.8.34 | Local tool request/result grammar | T1 | GPT-6 Sol High | no |
| P2 | 0.8.35 | OS containment probe and launcher | T2 | GPT-6 Sol High | no |
| P3 | 0.8.36 | Authority-checked file read tools | T2 | GPT-6 Sol High | no |
| P4 | 0.8.37 | Authority-checked candidate file writes | T2 | GPT-6 Sol High | no |
| P5 | 0.8.38 | Isolated process and command broker | T2 | GPT-6 Sol High | no |
| P6 | 0.8.39 | LM Studio tool-call transport | T1 | GPT-6 Sol Medium | no |
| P7 | 0.8.40 | Loaded-context and output budgeting | T1 | GPT-6 Sol Medium | no |
| P8 | 0.8.41 | Bounded local agent turn loop | T2 | GPT-6 Sol High | no |
| P9 | 0.8.42 | Local AgentExecutionAdapter lifecycle | T2 | GPT-6 Sol High | no |
| P10 | 0.8.43 | AI Center local agent-capability proof | T2 | GPT-6 Sol High | no |
| P11 | 0.8.44 | Agent Runtime local target routing | T2 | GPT-6 Sol High | no |
| P12 | 0.8.45 | Work controls for local Coding Agent | T1 | GPT-6 Sol Medium | no |
| P13 | 0.8.46 | Cross-boundary integration and security regression | T2 | GPT-6 Sol High | no |
| P14 | 0.8.47 | Real local agent qualification and closeout | T3 | GPT-6 Sol High | yes |

The critical safety ordering is P2 OS confinement first, then P3–P5 tools, P6–P8 transport/turns, P9–P12 integration, P13 focused cross-boundary tests, P14 live T3. A cleanly compiling unsafe adapter is **not** acceptable: fail closed before local `agentExecution` eligibility if the real OS sandbox cannot enforce deny classes. Provider-owned writes are restricted to the disposable ExecutionWorkspace; final project mutation remains ADR 0028/0029 Dope-owned.

## Eight-minute efficiency gate

P1 and P3–P12 are each a narrow <=8-minute implementation-plus-focused-validation target (10-minute soft ceiling, 15-minute hard budget); avoid crosscutting refactors. P2 has a justified security feasibility gate that may exceed normal timing if the host sandbox requires diagnosis; never reduce isolation to meet a budget. P13 is dedicated T2 integration and P14 is the sole browser/manual T3 closeout. No blanket `npm test`, `npm run check`, browser/Electron build or package/install after individual implementation prompts. Tests import compiled `lib/` from changed packages: compile only affected outputs once when necessary; do not test stale output. P13 registers newly added focused tests once in `test:product`; P14 runs one final exact-candidate `npm run check` (already includes typecheck, test suite, browser and Electron builds), plus only truly omitted suites/security/native gates when required. Cheap `git diff --check` per source change.

## Execution gate / limits

This stack is **documentation authoring**, not a phase activation. Do not execute `p8e` until owner expressly activates it, the real Git HEAD/manifest is coherent with the qualified `0.8.33` baseline, project worktree changes are preserved, and the patch continuation `0.8.34` is authorized. Neither docs nor runner metadata prove that a local model, sandbox dependency or Linux host is prepared.

After explicit activation and coherent source checkout:
- Validate: `npm run codex:phase:validate -- p8e`
- Run: `npm run codex:phase -- p8e`
- P14 requires real GUI/manual qualification and ends Green or Not Green truthfully; do not auto-close Product Phase 8 or activate Phase 9.

There is no LocalAgentTask, local-only persistent agent state, silent hosted fallback, hidden reasoning, permission escalation, unsandboxed process, automatic PlanningMap completion, Phase 9 sessions or Phase 10 alignment in this stack.
