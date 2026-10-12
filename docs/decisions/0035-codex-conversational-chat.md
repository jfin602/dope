# ADR 0035 — Codex conversational Chat using ChatGPT-plan authorization

Status: ACCEPTED PRODUCT DESIGN / NOT IMPLEMENTED OR QUALIFIED
Date: 2026-10-12
Correction: c9-codex-chat, unchanged 0.9.23
Amends: ADR 0025 (Chat), ADR 0026 (AI Center), ADR 0027 (Codex connection)
Preserves: ADR 0028/0029 (agent authority), ADR 0030 (separate Chat and Work), ADR 0034 and active p9d

## Context

Dope already supports a signed-in ChatGPT-plan Codex connection, App Server model discovery and qualified Coding Agent execution. Ordinary Chat uses provider-independent ConversationalModelRuntime instead. Currently Codex is registered only as an agent-runtime and its models expose agentExecution, with conversationalText and streaming unknown, so the normal Chat model selector cannot use them.

The developer wants to talk to Codex in ordinary Dope Chat using the existing sign-in, without creating an AgentTask or switching billing to an OpenAI API key. ChatGPT subscription-authorized third-party inference consumes the shared Work/Codex plan allowance, **not** regular ChatGPT web-chat allowance. Open-source status does not itself establish a particular signed-in account's eligibility.

## Decision

### One account and connection, independently supported roles

AI Center owns a single immutable Codex connection identity for each user-selected ChatGPT account, secure OAuth token lifecycle, refresh and sign-out, current model inventory and truthful usage attribution. No duplicate provider record or second login is added. Codex and generic OpenAI API-key connections remain distinct.

A Codex model may expose **conversationalText and streaming** for the Interactive role, **agentExecution** for the Coding Agent role, or both. Capability/readiness must be grounded in implemented transport, documented provider behavior and account/model eligibility; discovery is not proof that inference succeeds. Model context capacity and reasoning controls must be bounded/confirmed rather than guessed. Existing Follow Interactive, per-turn exact-model choice, hosted-data consent, actual provider/model provenance and no-silent-fallback rules continue unchanged.

### Chat transport and execution separation

Introduce a **new, narrow Codex subscription conversational adapter** behind ConversationalModelRuntime, not a second Chat domain and not the mutation-capable Codex AgentExecutionAdapter. Use the existing secured CodexAuthManager access-token boundary without writing tokens to AI registry, .dope, telemetry or UI. The ordinary Chat path calls the authorized public Responses API (https://api.openai.com/v1/responses), passing the selected account's OAuth bearer access token and Dope-composed bounded conversation context. Every request uses store:false and stream:true; do not call ChatGPT private backend-api endpoints. No executable tools, tool_choice, shell, apply_patch, MCP, code interpreter, provider-native agent task, or agent thread is supplied. Dope Chat tools are contextual read-only composition and never grant provider execution authority.

Require response.completed for successful inference; handle output text deltas, cancellation, mid-stream subscription limit failures, response.failed, response.incomplete, malformed frames, account refresh/revocation and missing terminal events honestly. No hidden reasoning or provider-native response/thread ID becomes Dope Chat data. ChatService and ChatRepository still own durable project-local chats (.dope/chats), leases, cross-project isolation, retry and restart.

For account-specific catalog, prefer the OAuth-authorized GET /v1/models result when available; preserve the provider-specific projection separately from agentExecution inventory so refresh cannot silently erase a role's capabilities or mark an untested model ready. Model controls such as reasoning effort are exposed only for verified supported values. Error codes subscription_sharing_usage_limit_exceeded and subscription_sharing_usage_unavailable must not be mistaken for successes after streamed output.

### UI, authority, and usage

Keep **separate Chat and Work panels** with existing launchers and placement. Do not introduce a Chat|Agent mode toggle. A Codex Chat turn must never create AgentTask, AgentRun, ExecutionGrant, CandidateDelta or execute commands/filesystem writes. Work keeps its current Codex App Server thread, sandbox, isolated candidate execution, Dope-owned validation and developer-controlled promotion.

Both paths consume shared Work/Codex plan usage. Do not promise normal ChatGPT web-chat allowance, falsely display local remaining usage, or silently switch to paid API-key billing. Hosted project evidence requires explicit existing Chat feature consent. No automatic background hosted work, Phase 10 activity or new project authority.

### Version, active p9d and implementation boundary

c9-codex-chat is a bounded correction **at unchanged 0.9.23**, approved for documentation and prompt-stack authoring, not yet implemented/qualified. Meanwhile p9d is OWNER-ACTIVATED with P1 requalified Green and P2–P13 pending, Phase 9 overall Not Qualified. Never execute p9d and c9 concurrently against one worktree or combine their version commits. At implementation time inspect actual local HEAD, package version, dirty work and active p9d state. If p9d has advanced past 0.9.23, halt this exact version-pinned stack and explicitly reconcile/replan its baseline rather than blindly resetting, force-pushing, bumping a version, or relabeling p9d evidence. Do not execute superseded p9c P10. No root/package manifest version bump belongs to this correction.

## Ownership

- AI Center and CodexAuthManager: already-existing account identity and secure token owner.
- CodexAppServer and CodexAgentExecution: remain Work's agent execution runtime.
- ai-registry-backend / provider-setup / ModelConnectionsRegistry: independently register eligible conversational capability and connect a new subscription adapter.
- ChatBackend / ChatContextComposer / AIRoleRoutingService: provider-neutral consumers, changed only if a traced contract requires it.
- ChatPanel: show Codex in normal model selection based on capability, using existing UI; no mode switch or redesign.
- Tests: deterministic OAuth-catalog, streaming/error/auth/tool-denial tests; focused inventory, role routing, Chat, Work regression; real eligible-account GUI qualification.

## Qualification

A real eligible ChatGPT account must select Codex in ordinary Chat, stream a complete multi-turn conversation and persist correct project-scoped history and provenance across restart. Verify exact selection and Follow Interactive, mixed-provider turns, hosted consent, Stop/retry, token/account rotation/sign-out, unavailable models, limit failure after a partial stream, reasoning and capacity eligibility, and no command/AgentTask/AgentRun/tool effects. Verify existing Work still functions with the original Codex account and permissions, no API-key fallback or separate sign-in, exact-candidate aggregate plus direct native/browser GUI evidence. A missing account, tool-safety proof or GUI gate yields NOT GREEN.

## Alternatives / consequences

Rejected: using a tool-capable Codex agent thread as ordinary Chat; creating a second authenticated connection; pretending OpenAI API-key transport is subscription billing; combining Chat and Work into a toggle. This design retains provider-neutral Dope Chat and agent authority while sharing account authentication.

Official provider references:
- https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference
- https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server
- https://help.openai.com/en/articles/20001542-using-your-chatgpt-plan-in-other-apps-and-sites
