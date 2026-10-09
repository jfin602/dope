# ADR 0032 — Phase 8E Local Agent Harness and Tool Authority

Status: **Accepted for 8E design/planning; implementation and activation pending**
Date: 2026-10-09
Complements: ADR 0004, 0011, 0026, 0027, 0028, 0029 and 0031.
Qualified reference entry: Phase 8D `0.8.33` / `8748cb4870e8cac3d2a5aca4a05623b5f3d747ec` from `docs/tasks/c8-fix/closeout.md`. Original P13 Not Green closeout remains historical.

## Context

AI Center already provides Local LM Studio conversational/synthesis connections and loaded-model capacity metadata. Dope's Coding Agent route currently requires an `agentExecution` capability and its backend selects only Codex App Server. A text/streaming/tool-calling model API is **not** an agent execution harness. Local tools introduce a separate trust boundary: untrusted model tool requests must never become arbitrary filesystem/process/network authority.

The reference Codex harness already qualified AgentTask/AgentRun, fixed developer ExecutionGrant, isolated ExecutionWorkspace candidate work, Dope-owned CandidateValidation, Authority/ToolExecutor promotion, WorkItem review and Prompt Stack checkpointing. Reimplementing any of those as Local-only canonical state would violate provider independence.

## Decision

1. **Reuse Dope-owned identity and lifecycle.** Every local execution uses the existing AgentExecutionAdapter / AgentTask / AgentRun / AgentTaskSequence / WorkItem provenance, same developer-facing Work panels and Dope-owned records. Provider request/session/tool IDs remain adapter-local. No LocalAgentTask, duplicated grant, Local-specific project DB or parallel validation pipeline.
2. **Separate model transport from agent/tool orchestration.** The first reference uses the configured Local / LM Studio runtime and bounded model turns. A Dope-owned local agent harness interprets safe, strict tool-call requests and schedules only supported operations. Future local runtimes can reuse the harness/broker with a different transport. Do not promote LM Studio, Qwen or a particular chat wire schema into domain contracts.
3. **Tools are untrusted requests, never authority.** The model may request a bounded read/list/file-edit/process tool. A narrow Dope-owned broker independently verifies the active ExecutionGrant, project/candidate workspace, path/cwd normalization, symlinks, environment and command policy before every operation. Execute mutation/process calls only in the isolated ExecutionWorkspace; authorize final project changes only through existing frozen CandidateDelta, required Dope-owned validation and Authority/ToolExecutor. Refuse any unrequested Git write/history, secret/private-home read, outside-root, network or system effect. A synthetic tool-capability success is not permission to do actual work.
4. **Prove isolation, fail closed.** Local execution cannot fall back to a raw unsandboxed host shell if the project/process/file/network restriction cannot be enforced. Local inference client traffic to a configured trusted localhost model endpoint is adapter infrastructure; it does **not** authorize network access by model-issued project processes or tools. Tool arguments and returned text are treated as untrusted and bounded; denied effects are logged without privilege expansion.
5. **Explicit capability evidence.** Local models stay `agentExecution: unknown/false` until a bounded zero-project-data tool-loop capability probe **and** enforceable tool broker are ready. ConversationalText, claimed toolCalling and model name are insufficient. Invalidate eligibility on relevant runtime/model/loaded-context/configuration change. Use measured loaded context limit with output/tool-result reserve, bounded retries and turn/tool count. Clearly distinguish unavailable, unsupported, capacity, cancelled and failed states.
6. **Same routing and user consent.** Preserve AI Center global connection identity, Coding Agent role policy and exact connection/model choice. A requested local model that fails does not silently switch to hosted inference. Hosted fallback needs separate eligible target, current feature-grant/egress consent and explicit user decision; 8E baseline does not require fallback. Locality and effective adapter identity are recorded in AgentRun provenance.
7. **Same restart/review/checkpoint law.** Emit sanitized provider-neutral message/command/file/status observations; preserve Work transcript and cancellation truth. Restart never fabricates resumed local-model turns or duplicates authoritative effects. Direct Work, WorkItem frozen-review hold and Prompt Stack manual gates/checkpoints remain Dope-owned and provider-independent.
8. **Bounded qualification.** Directly demonstrate one real local model performing a genuine tool-using source change, validated candidate and developer promotion/review in the GUI, with denial/cancel/restart and exact-candidate aggregate. Compare identical representative tasks against existing Codex evidence, reporting model limitations rather than weakening acceptance.

## Consequences and alternatives

The local harness and tool broker are meaningful new infrastructure but are confined to the agent adapter/execution layer. This enables future providers without a new product ontology. It must be independently tested for OS containment, malformed tool calls, context exhaustion, model changes and explicit cancellation. Local model performance is not guaranteed to match Codex.

Rejected: (a) simply marking all LM Studio models agent-capable, (b) passing unrestricted model-issued shell commands to the host, (c) reusing the Codex App Server adapter by pretending LM Studio exposes its proprietary protocol, (d) direct authoritative repository mutation, (e) silent hosted fallback, (f) writing provider-native tool/session objects into canonical AgentTask/AgentRun.

## Revisit conditions

Revisit when another local inference transport requires a genuinely different execution primitive, when the sandbox/authority model changes, or when independent qualification establishes a safe richer tool capability. Revisit the adapter implementation, not provider independence or the fixed initial denial classes.

## Scope and qualification

This accepted ADR is **design authority**, not implementation evidence, owner activation of 8E, a model compatibility claim, or a Phase 8 closeout. See `docs/planning/p8/phase-8e-plan.md` and `docs/stability-contract.md`. The qualified `0.8.33` source and historical failed P13 closeout are unchanged.
