# Phase 8E Plan — Local Coding Agent Compatibility

Status: **APPROVED DESIGN / P8E PROMPT STACK AUTHORED; NOT OWNER-ACTIVATED, NOT IMPLEMENTED**
Date: 2026-10-09
Prerequisite: Phase 8D **GREEN / QUALIFIED** at exact source `8748cb4870e8cac3d2a5aca4a05623b5f3d747ec`, package `0.8.33`, through `docs/tasks/c8-fix/closeout.md` (cycle 2 of 5).
Expected first *implementation* version after separate activation: `0.8.34` (provisional; no manifest bump or execution authorized by this planning document). The prospective P1–P14 `0.8.34`–`0.8.47` prompt stack is authored under `docs/tasks/p8e/` and awaits separate activation.
Authorities: ADR 0004, ADR 0026, ADR 0027, ADR 0028, ADR 0029, ADR 0031 and **ADR 0032**; `docs/ARCHITECTURE.md`, `docs/PRODUCT-MODEL.md`, `docs/stability-contract.md`.

## Goal and boundary

Support a real locally hosted coding model through the **same** provider-independent AgentTask, AgentRun, AgentTaskSequence, WorkItem, ExecutionGrant, ExecutionWorkspace, CandidateDelta, Dope-owned validation, review, Authority/ToolExecutor and Work UI. First reference transport: an existing AI Center **Local / LM Studio** connection; the first tested model may be Qwen3-Coder, but no exact model, quantization, endpoint, context size or inference engine belongs in canonical domain state.

8E is **not** general local conversation (already supported), local Software Map synthesis (already a separate capability), multi-agent orchestration, a new task ontology, Agent Mind, Phase 9 DevelopmentSession, Phase 10 background alignment or a replacement for the Codex adapter. Successful conversation/toolCalling inventory alone **does not** qualify `agentExecution`.

## Current source inspection (2026-10-09)

- `packages/ai/src/index.ts`: Local LM Studio connection/configuration, model locality, `agentExecution` capability slot and loaded context limit already exist.
- `packages/ai/src/role-policy.ts`: Coding Agent role requires explicit `agentExecution`; no automatic fallback or inferred capability. `AIInventoryController` in `packages/theia-extension/src/node/ai-registry-backend.ts` reports Local execution capability **unknown**, even for usable Local conversational models. This is correct until a genuinely qualified tool-capable agent harness is present.
- `packages/theia-extension/src/node/conversational-providers.ts` and `lmstudio-synthesis-provider.ts` provide Local model transport for different capabilities, **not** AgentExecutionAdapter/tool authority. Reuse connection/transport configuration where appropriate, never treat the synthesis parser or Chat model as an agent harness.
- `packages/agent-core/src/execution.ts`: shared provider-neutral `AgentExecutionAdapter.start(request)` / `cancel` / optional terminate and bounded normalized observations, already used by `AgentExecutionRuntime`.
- `packages/theia-extension/src/node/backend-module.ts`: execution adapter map currently registers **Codex only**. `agent-execution-runtime.ts` `select()` checks adapter-known `agentExecution` but explicitly allows only a signed-in hosted Codex App Server connection. This is the central integration seam to generalize **without** weakening grant/locality checks.
- `packages/theia-extension/src/node/codex-agent-execution.ts` is the existing hosted reference adapter. Do not import its native thread identity or auth into local canonical contracts.
- `docs/tasks/c8-fix/closeout.md` is the approved 8D reference evidence; the initial `docs/tasks/p8d/closeout.md` remains historical Not Green.

## Implementation workstreams (bounded decomposition, not yet a prompt stack)

1. **Local harness contract and tool broker:** Add a narrow provider-independent local tool-request/response and terminal-state adapter interface beneath AgentExecutionAdapter as needed. Keep this adapter-internal; do not add LocalAgentTask/LocalAgentRun. Broker approved, bounded read/list/edit/process calls through a Dope-owned scope guard. Tool names, arguments, tool-call IDs and transcript observations are sanitized, bounded and checked.
2. **LM Studio model transport and turn loop:** Use configured localhost Local connection with model selection, bounded inference/transport timeouts, cancellation, safe tool-call parse/normalization and explicit tool-result continuation. Limit turn/tool cycles, tokens, output/context accumulation and command output; fail closed on malformed, incomplete, repeated, hallucinated or unsupported tools. No model-native process/fs authority. Local inference access from the trusted adapter process is distinct from the execution workspace's denied LAN/host-loopback network rights.
3. **Enforceable isolated tool execution:** Before enabling the Local Coding Agent, prove equivalent filesystem/process isolation to ADR 0028 for the actual OS. Execute provider-requested file/process tools **only inside the candidate ExecutionWorkspace** under accepted fixed grant; prevent escaping via symlink, cwd, absolute/parent path, environment, private home, credentials, Git writes and network. No arbitrary unsandboxed host-shell fallback and no grants manufactured by AI Center preference. Abort/fail closed if isolation cannot be enforced.
4. **AI Center capability and runtime selection:** Register a Local AgentExecutionAdapter for eligible Local connections. Establish `agentExecution` with a safe zero-project-data, non-mutating synthetic tool-loop probe plus enforcement readiness, not simply `conversationalText` or a claimed `toolCalling` flag. Respect actual loaded model/context capacity, reserve output/tool-result space, and invalidate readiness on load/endpoint/capability changes. Generalize Agent Runtime's Codex-only selection and preserve explicit exact-model and Follow Coding Agent policy, role provenance, locality/egress authority and **no silent hosted fallback**.
5. **Reuse existing Work and review paths:** Exercise direct Work, WorkItem-derived task with required Dope-owned validation and review, and representative Prompt Stack. The local adapter must emit existing bounded transcript/command/file/status events, support truthful cancel/interrupted/restart behavior, and let Dope own CandidateDelta, required ValidationWorkspace, promotion and checkpointing. Do not recreate these in the local adapter.
6. **Focused security/integration and comparative evidence:** Check the same task/validation fixtures against reference Codex and Local where feasible. Attribute failure to harness/tool/context/model capability; do not weaken AgentTask scope, grants or test expectations to make local Qwen appear capable. Keep any native/package and real GUI evidence in explicit qualification gates.
7. **Final T3 qualification and documentation reconciliation:** Qualify a *real* LM Studio-hosted local model executing a bounded multi-step code change using at least one real brokered tool, real candidate/Dope validation, authorized promotion and developer review/restart. Qualify refusal for denied effects, cancellation, context/tool limits, no unwanted remote egress, and legacy Codex non-regression. Final `npm run check` on the exact candidate and a manual GUI closeout. Reconcile current-state docs once at terminal Green/Not Green, preserving original 8D failure and correction records.

## Acceptance and measurement

For the first reliable local reference, use a small disposable Git repository and a deliberately achievable edit + focused test. Measure correctness, command/tool reliability, total tool turns, observed loaded context/input-output reserve, elapsed time, cancellations, restart truth, exact persisted provenance and signed-off Dope validation. Do not require local results to match Codex quality, speed or proprietary harness functionality as a condition of architectural parity; the test must distinguish model limitations from safety/adapter defects.

**Security qualification:** deny forbidden filesystem paths, symlink/traversal, private files/credentials, Git write/history, unapproved commands/effects and egress under the fixed Phase 8 profile. Existing provider-independent frozen-candidate and Dope-owned validation/Authority are unchanged; local inference cannot bypass them. Tool requests are untrusted model output, not authorization. A local model being on localhost does not prove isolated tool or network safety.

**Operational qualification:** report local server unavailable/model unloaded/insufficient context/unsupported tool/runtime failure precisely. No automatic switch to hosted Codex, no unapproved project-data upload, no silent new task/turn on restart. Explicit stop versus close preserved. Same durable AgentRun IDs and project isolation.

## Execution gates / non-goals

- **Entry:** Owner separately activates Phase 8E from coherent committed `0.8.33` source (or a later explicitly accepted source), and approves the version/prompt stack. Planning approval alone does not mutate source, advance to `0.8.34`, qualify local model execution, or close Product Phase 8.
- **Prompt economy:** `/prompt-ass -> /prompt-plan -> /prompt-write p8e` only after owner activation. Divide architecture-sensitive implementation into <=8-minute T1/T2 slices, changed-package builds/focused tests only. Reserve broad comparison/restart/security matrix and one final aggregate/manual GUI for dedicated T2/T3 gates. Do not run native package/full builds repeatedly for reassurance.
- **Exit:** A separate verified Green/Not Green closeout and product-phase decision determine whether Phase 8 can be closed and whether Phase 9 may activate; no automatic advancement.

Related documents: `docs/planning/p8/phase-8-plan.md`, `docs/decisions/0032-phase-8e-local-agent-harness-and-tool-authority.md`, `docs/stability-contract.md` and `docs/roadmap/mvp-roadmap.md`.
