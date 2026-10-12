# c9-codex-chat — Prompt assessment

Status: ADR 0035 applied; correction stack authored, not executed.
Owner-approved 2026-10-12. Fixed unchanged package version: 0.9.23.
Planning source: remote main 6e762856 (theme-doc continuation of e11b72f); p9d P1 requalified at d58872f, P2–P13 pending at planning time.
Authority: ADR 0025/0026/0027/0028/0029/0030/0035, docs/workflow.md and docs/stability-contract.md.

## Product result

The **existing signed-in Codex connection** must become an ordinary Dope Chat model option through a tool-free OAuth-authorized Responses adapter while remaining separately qualified for Coding Agent Work. Do not build a second connection, reuse mutation-capable AgentExecutionAdapter as Chat, switch to billable API key or present normal ChatGPT web-chat usage as the billing pool.

## Source-backed gap and dependent owners

- `provider-setup.ts`: Codex connectionClass agent-runtime, createRuntime rejects conversational use.
- `ai-registry-backend.ts`: Codex App Server catalog reconciliation advertises agentExecution=true; conversationalText/streaming unknown.
- `model-connections.ts`: ModelConnectionsRegistry.list() considers usable only conversationalText and requires live ConversationalModelRuntime, so Codex is not selectable even when ready as agent.
- `chat-backend.ts`: exact selection and Follow Interactive rely on registry connected-model readiness and requestHard conversationalText+streaming, plus composed context and hosted egress consent; do not hardcode Codex here.
- `codex-auth-manager.ts` and `codex-app-server.ts`: managed OAuth token and original agent activity; no second OAuth storage.
- `openai-conversational-provider.ts`: useful SSE normalization pattern, but API-key credentials may never be substituted for OAuth-managed subscription.
- `packages/ai/src/index.ts`: dual model capabilities and eligibility already exist; preserve both role dimensions and immutable IDs.
- `chat-context-composer.ts`: existing context budget uses verified model capabilities; unknown limit must not become unlimited.
- `chat-panel-*`, AI Center: existing chooser/UI should show newly eligible capabilities without a mode toggle.
- `test/unit/`: ai-inventory, codex-auth, codex-app-server, model-connections, chat-backend, chat-interactive-routing, ai-role-routing, codex-agent-execution and openai-conversational-provider cover nearest seams.

## Task decomposition, tier and ordering

| Prompt | Single primary responsibility | Tier | Recommendation | Browser |
| --- | --- | --- | --- | --- |
| P1 | OAuth account catalog and dual-capability inventory projection | T1 | GPT-6 Sol High | no |
| P2 | Tool-free subscription Responses streaming conversational adapter | T1 | GPT-6 Sol High | no |
| P3 | Bind managed Codex OAuth account to conversational Model Runtime | T1 | GPT-6 Sol High | no |
| P4 | Chat exact/Interactive eligibility + consent/usage UI behavior | T2 | GPT-6 Sol High | no |
| P5 | Cross-boundary regression and unchanged Work proof | T2 | GPT-6 Sol High | no |
| P6 | Real account/GUI qualification + sole final correction closeout | T3 | GPT-6 Sol High | yes |

P1 establishes a truthful catalog, P2 establishes transport independently, P3 connects them through one identity/credential boundary, P4 validates product routing/UI, P5 covers adverse interactions and integration, P6 is the only live broad qualification. Do not build agent-execution changes as a prerequisite for Chat.

## Preserved and deferred

Preserve: Dope-owned Chat, per-message model choices and actual provenance, historical messages, leases, project confinement, hosted-data consent, protected OAuth token storage, no silent fallback, dedicated Chat and Work panels, Work agent ExecutionGrant/isolated workspace/Dope validation/promotion, current Dope theme, p9d History and original historical evidence. Never create/rewrite AgentTasks, change package/version, delete Session user data or activate Phase 10.

Deferred: ChatGPT web-chat history/memory import, ChatGPT app tool parity, executable Chat tools, new OAuth connection UX, provider-generalized OAuth framework, automatic provider billing fallback, background hosted tasks, Chat/Work toggle, unrelated styling and p9d source changes.

## Safety and qualification gates

The new Chat requests must use public OAuth Responses endpoint with store:false, stream:true, no tools; accept only visible output and response.completed terminal status. Redact secrets; no provider-thread Chat identity; reject incomplete or malformed stream, mid-stream subscription limits, revoked/mismatched account, stale model inventory, cancelled request and unsupported reasoning/capacity. Account-specific model list must not silently turn unqualified models into Chat ready or erase agent eligibility. Hosted context egress remains explicit. Verify no command/tool/AgentTask/AgentRun creation, no charged API-key fallback, no cross-project Chat leakage and no Work runtime regression.

For P6 Green: signed-in eligible live ChatGPT-plan account, fresh Dope Chat streaming two turns, model/role selection, mixed-provider continuation, cancellation/retry, account/sign-out and failure behavior, restart, direct GUI verification, no tool effects, unchanged real Work proof and one complete exact-candidate aggregate check. If account/safety/GUI unavailable, NOT GREEN with evidence gaps.

## Workflow, budgets and conflict policy

Routine P1–P5 goal <=8 minutes including focused validation, 10-minute soft / 15-minute hard. Use source-aware focused direct node tests; tests may need compiled lib, so inspect import paths and compile only changed packages/dependencies once in order, never stale lib. P4/P5 own multi-owner integration and safety, P6 only full `npm run check` + real GUI/restart on final candidate. The existing root `test:product` list omits several recently added tests; P5 should register newly authored critical regression tests (and ensure qualification runs any directly relevant old tests not already in aggregate) **once**, with no duplicate npm test after check. Change no package versions; `git diff --check`.

Active `p9d` uses version progression 0.9.23 -> 0.9.35. Do not run this correction in parallel with it. All prompts require local HEAD/status/version preflight, and **stop** if p9d already advanced beyond 0.9.23; explicitly replan before changing correction version. Do not reset/rebase/overwrite developer-local changes or blindly pull. Runner owns implementation commits; P6 manual evidence-only final disposition. No duplicate closeout.
