# /prompt-plan — Phase 8E implementation plan

Date: 2026-10-09
Status: **OWNER-ACTIVATED 2026-10-10 / P1 IMPLEMENTATION READY; NO 8E QUALIFICATION**
Version policy: qualified baseline 0.8.33; owner-activated P1–P14 sequential 0.8.34–0.8.47, each prompt responsible for coherent updates to 13 manifests and pinned internal `@dope/*` dependency versions. Docs leave actual manifests at 0.8.33.
Source reviewed: GitHub main at 0a46fb4b906b0306e1cb7074919d115831a03afe, source manifests 0.8.33. Reinspect actual local checkout and inherited repairs at execution.

## Concrete code ownership

- Agent transport/schema: `packages/agent-core/src/execution.ts` defines AgentExecutionAdapter and provider-neutral observations; add small adapter-internal typed tool normalization under `packages/theia-extension/src/node/`, not canonical AgentTask.
- OS sandbox/tool broker: new tightly scoped `packages/theia-extension/src/node/local-agent-*.ts` or minimal `packages/agent-core/src/node/` modules. Existing `packages/agent-core/src/node/execution-workspace.ts` owns candidate clone/fingerprints/promotion but not generic OS process isolation. Existing Codex sandbox in `codex-agent-execution.ts` is provider-specific and cannot be treated as a generic shell permission boundary. Probe real supported host; deny no-sandbox.
- LM Studio transport: `packages/theia-extension/src/node/conversational-providers.ts` and `provider-setup.ts` already validate local connection and normalize localhost endpoint; implementation may share narrowly reusable transport helpers but must not break Chat/synthesis.
- Agent loop and lifecycle: new Local AgentExecutionAdapter; build on existing event kinds `agent-message`, `command-started/completed`, `file-changed`, `status`, `warning`, `authority-denied`.
- AI Center: `packages/ai/src/index.ts` already has Local config, agentExecution KnownValue and context limits; `ai-registry-backend.ts` inventory currently sets local agentExecution unknown. `packages/ai/src/role-policy.ts` requires adapter-known agentExecution/observed loaded context for Coding Agent role.
- Execution: `packages/theia-extension/src/node/backend-module.ts` maps only 'codex' adapter. `agent-execution-runtime.ts` `select()` explicitly rejects non-Codex; remove only that hardcoded restriction when safe local adapter/capability exists. Keep `AgentRuntimeBackend` and all Dope validation/review/promotion unchanged.
- Work: `agent-run-controller.ts` currently filters only ready hosted Codex models and uses hosted consent for all starts; `chat-panel-widget.ts` and `work-selection-controller.ts` already contain developer grant/start/review. Add local eligibility/conscious provider selection minimally.
- Tests use compiled `packages/*/lib`; run changed package build in dependency order **once** when needed. Relevant adjacent tests: `test/unit/agent-execution-runtime.test.ts`, `agent-execution-workspace.test.ts`, `codex-agent-execution.test.ts`, `ai-center.test.ts`, `ai-role-resolver.test.ts`, `ai-role-routing.test.ts`, `work-integration.test.ts`, `agent-run-ui.test.ts`.

## Explicit implementation slices

| Prompt | Owner | Focused test / proof | Not in prompt |
| --- | --- | --- | --- |
| P1 | Local tool request/result grammar | T1: one changed narrow test or directly impacted prior suite | no full aggregate/GUI |
| P2 | OS containment probe and launcher | T2: one changed narrow test or directly impacted prior suite | no full aggregate/GUI |
| P3 | Authority-checked file read tools | T2: one changed narrow test or directly impacted prior suite | no full aggregate/GUI |
| P4 | Authority-checked candidate file writes | T2: one changed narrow test or directly impacted prior suite | no full aggregate/GUI |
| P5 | Isolated process and command broker | T2: one changed narrow test or directly impacted prior suite | no full aggregate/GUI |
| P6 | LM Studio tool-call transport | T1: one changed narrow test or directly impacted prior suite | no full aggregate/GUI |
| P7 | Loaded-context and output budgeting | T1: one changed narrow test or directly impacted prior suite | no full aggregate/GUI |
| P8 | Bounded local agent turn loop | T2: one changed narrow test or directly impacted prior suite | no full aggregate/GUI |
| P9 | Local AgentExecutionAdapter lifecycle | T2: one changed narrow test or directly impacted prior suite | no full aggregate/GUI |
| P10 | AI Center local agent-capability proof | T2: one changed narrow test or directly impacted prior suite | no full aggregate/GUI |
| P11 | Agent Runtime local target routing | T2: one changed narrow test or directly impacted prior suite | no full aggregate/GUI |
| P12 | Work controls for local Coding Agent | T1: one changed narrow test or directly impacted prior suite | no full aggregate/GUI |
| P13 | Cross-boundary integration and security regression | T2: one changed narrow test or directly impacted prior suite | no full aggregate/GUI |
| P14 | Real local agent qualification and closeout | T3: real GUI+LM Studio, denial/restart, code/candidate/Dope validation, Codex comparison, exact-candidate npm run check | no Phase 9 |

## Gate correctness

- P2 must prove real Linux/macOS/Windows platform containment wherever 8E claims support; initial reference can be Linux-only if explicitly labeled. Bubblewrap/Linux namespaces may be inspected if available, but neither assumed installed nor chosen without a measurable enforcement probe. Never use unsandboxed child_process as a fallback.
- A network-denied model-issued command cannot reach the localhost LM Studio API. Only the trusted host-side model transport can talk to the local endpoint, and it is never exposed as a tool.
- File tools and candidate snapshots must reject .git/.dope, secrets/private HOME, symlink and path traversal; process sandbox must have separate readable system/runtime minimum while inaccessible host HOME and outside roots stay denied. Read/write and process authority require grant checks per invocation; broker does not substitute for ADR 0028 final promotion checks.
- LM responses/tools are fully untrusted. Enforce strict schema, allowed tool IDs/names, max args/output, finite turns/context, provider malformed/no-tool paths and cancellation. Preserve Dope-owned transcripts only, never raw hidden reasoning.
- AI Center agentExecution must be adapter-known only after tool probe and active sandbox readiness, removed on unavailable/reconfigured/model-unloaded path; connection healthy != harness eligible.
- Runner cannot prove runtime model presence. P14 must report Not Green when local model/server/host containment missing. Passing Codex tests cannot fill local-model qualification evidence.
- No per-prompt full npm check. P13 registers newly created tests in `test:product`; P14 runs one final full aggregate with real GUI and any omitted security suites. A changed source candidate invalidates matching previous proof.

## Closure / activation

The owner separately activated p8e on 2026-10-10 in `docs/planning/p8/phase-8e-activation.md`. The first P1 attempt stopped at missing activation preflight, changed no source files and created no checkpoint. P1 now must advance all 13 manifests and internal dependency references from `0.8.33` to `0.8.34` during implementation; later prompts own their assigned transitions through manual P14 `0.8.47`. No version or 8E qualification is established by these documentation commits. P14 final evidence triggers one docs reconciliation and a later separate Phase 8 closeout/Phase 9 decision.
