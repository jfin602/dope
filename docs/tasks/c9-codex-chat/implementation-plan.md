# c9-codex-chat — Source-aware implementation plan

Status: Approved documents / unexecuted correction at unchanged `0.9.23`.
Inspected source: GitHub main `6e762856` (2026-10-12), package `0.9.23`; inspect the actual checkout anew for every prompt, especially when p9d is active.
Authority: ADR 0035; ADR 0025/0026/0027/0028/0029/0030 and docs/workflow.md.

## Architecture / truth owners

- Auth owner: `packages/theia-extension/src/node/codex-auth-manager.ts`; existing `accessToken(connectionId, registrationId)` and secure session lifecycle. Never duplicate tokens or expose to frontend.
- Agent transport: `codex-app-server.ts`, `codex-agent-execution.ts`; agent/test uses RPC with restricted sandbox; no Chat execution authority. Keep original Codex App Server Test Connection scratch-only.
- Account inventory: `ai-registry-backend.ts` `AIInventoryController.refreshModels` currently uses App Server `model/list` for Codex and publishes `agentExecution:true`, all conversational capabilities unknown. `packages/ai/src/index.ts` parses `conversationalText`, `streaming`, `agentExecution` independently; `findEligibleModels` requires explicit true values.
- Connection lifecycle: `provider-setup.ts` currently marks codex as agent-runtime and throws on createRuntime; `model-connections.ts` manages ready live `ConversationalModelRuntime` and normal `generate` / connection health. Adapt **one existing connection**, no new registry.
- Provider runtime: `openai-conversational-provider.ts` has separate API-key Responses flow and SSE parsing; use a narrow new OAuth subscription adapter reusing only safe, provider-neutral stream logic. No API-key change or raw provider output persistence.
- Chat consumer: `chat-backend.ts` uses `requestHard`, `models.list()`, `models.generate()`, role resolver, project grounder/composer and lease/retry context; should need no provider-specific branch. `chat-context-composer.ts` depends on bounded `ConversationModelCapabilities`.
- AI Role: `ai-role-routing.ts` and `packages/ai/src/role-policy.ts` enforce egress, eligibility and no silent exact-model fallback. Existing Chat/Work panels remain independent under ADR 0030.

## P1 — Catalog / inventory ownership (T1)

Inspect current OAuth GET /v1/models documented catalog and existing App Server discovery. Add a bounded authenticated catalog reader behind Codex backend ownership using current CodexAuthManager; map visible model IDs/display labels with duplicates/malformed/disabled cases handled; do not merge arbitrary provider fields into registry. Reconcile Codable model identities on one existing Codex connection, preserving existing `agentExecution` as supported and marking `conversationalText`/`streaming` only when directly supported by the target adapter/account. Keep unknown limits unknown and do not claim a ready Chat model without capacity. Add inventory/catalog tests including absent/rotating creds, account-switch races, stale refresh and identity retention. No Chat execution or UI in P1.

Likely: `ai-registry-backend.ts`, `codex-auth-manager.ts` (narrow reuse only), a small read-only model catalog helper, `test/unit/ai-inventory.test.ts`, `test/unit/codex-auth.test.ts`. The catalog reader must never leak credentials in error logs or disk.

## P2 — Subscription Responses stream (T1)

Create one connection-scoped OAuth Responses `ConversationalModelRuntime` adapter with injected token supplier/account model inventory. Endpoint exactly `https://api.openai.com/v1/responses` using secure bearer token, `store: false`, `stream: true`, no tools. Map `ConversationRequest.messages` to supported input; handle `response.output_text.delta`, `response.completed`, response.failed/incomplete, malformed SSE, aborted/unexpected terminal, output limits, model mismatch and usage/provenance. Provider-specific subscription errors must be distinguishable from transient faults and not treated as completed. Supported reasoning controls only if validated; unsupported options explicit. Deterministic fetch-injected tests for two-turn context, partial-delta failure, no tool fields and zero secret exposure.

Likely new `codex-subscription-conversational-provider.ts` and `test/unit/codex-subscription-conversation.test.ts`; do not edit Codex AgentExecutionAdapter or API-key provider.

## P3 — Connection lifecycle (T1)

Bind the existing `codex` connection to the new conversational runtime in `provider-setup.ts` / `model-connections.ts` / AI registry activation only after successful account authorization and model inventory. Manage correct per-account token on every turn; refresh/rotate atomically through existing manager, invalidate on sign-out/account change and fail closed on stale generation/connection. Avoid double-running network model discovery across App Server and Responses unnecessarily. Retain one immutable Dope connection/model ID and proper readiness, no silent API-key substitution. Add focused runtime and model-connections tests with mock managed auth, revocation, cancellation and app-server coexistence.

Likely: `provider-setup.ts`, `model-connections.ts`, `ai-registry-backend.ts`, `backend-module.ts`, `test/unit/model-connections.test.ts`.

## P4 — Chat/role and UI acceptance (T2)

Use the existing capability/health model so eligible Codex models appear in ordinary per-message Chat select and Follow Interactive role policy, not Work-only. Preserve exact model selection, ChatContextComposer budget, all context/hosted consent, saved reasoning-controls validity, retry, title/provenance, cross-project handles and one-live-panel lease. Show plan allowance truth in AI Center without inventing a remaining meter. No Chat|Agent toggle, no new layout/theme changes. First prove behavior through ChatBackend and role-routing tests, then bounded UI presentation/AI Center tests if code changes.

Likely: `chat-backend.ts`, `ai-role-routing.ts`, `chat-panel-controller.ts`, `ai-center-controller.ts` only if needed; focused `test/unit/chat-backend.test.ts`, `chat-interactive-routing.test.ts`, `ai-role-routing.test.ts`, `ai-center.test.ts`. Prefer existing UI naturally binding inventory; do not touch code merely to match an expected file list.

## P5 — Cross-boundary safety/integration (T2)

Register new and directly missing critical tests into `test:product` **once** if aggregate does not already execute them (inspect nested scripts first), with source/import-aware build prerequisites. Exercise real registry->routing->Chat wiring via deterministic fixtures: tool-free payload and explicit unauthorized tool response denial; no AgentTask/Run/Command creation; OAuth token/account refresh/race, partial subscription quota failure; cancellation and no replay fallback; false/unknown capabilities excluded; hosted consent, cross-project Chat state; Codex Work adapter still runs its existing tests. Fix only defects introduced by P1–P4; never weaken Work grants or duplicate tests throughout P1–P4.

Likely tests: `codex-subscription-conversation.test.ts`, `ai-inventory.test.ts`, `model-connections.test.ts`, `chat-interactive-routing.test.ts`, `codex-app-server.test.ts`, `codex-agent-execution.test.ts`; package.json test:product minimal append, no version bump.

## P6 — T3 MANUAL GUI / closeout

Preflight exact candidate HEAD/manifest and clean/known dirty state. In real Dope GUI with eligible signed-in account: normal Chat picker, interactive role, two streamed turns, project evidence consent, model switching, Stop/retry, sign-out/reauthorize, restart/persist, authority negative proof, and independent Work Codex smoke using a disposable project. Collect provider redacted usage/model/terminal evidence and truthful subscription failures without incurring API-key billing. Run `npm run codex:phase:validate -- c9-codex-chat`, one final-candidate `npm run check`, only any focused suites not included in it, real GUI/restart, `git diff --check`. An eligible account or native/browser GUI unavailable = NOT GREEN. Do not fabricate provider-success screenshots; do not alter historical Phase 8/p9d closeouts.

Record `docs/tasks/c9-codex-chat/closeout.md` with exact SHA/version, passed/failed/blocked matrix, test counts, real-model/account proof, negative tool-authority evidence, and GREEN/NOT GREEN. This is the **only** final prompt; commit evidence via approved manual checkpoint, no source repair disguised as closeout. No phase/version advancement.

## Efficiency gate and test-source discipline

P1–P3 single-responsibility T1 with the smallest relevant Node test. P4/P5 T2 cross-boundary safety/interaction. P6 alone T3 broad build/GUI. Target P1–P5 <=8 minutes, 10-minute soft and 15-minute hard; if a real source seam exceeds, narrow task instead of omitting safety checks. Inspect the actual test imports: TS tests requiring `@dope/*/lib` need affected-package compiled output, but build changed dependencies in correct order **once**, not the entire monorepo on every prompt. Use `node --test` specific files; avoid unconditional `npm run test:product`, `npm run check`, full browser/Electron or restart before P6. Permanent negative regression tests for no tools/no API-key fallback belong in P2/P5. No tracked root package-lock. Existing `test:product` embeds `npm run build:extension`, so do NOT rerun `npm run typecheck` + `npm test` + builds separately when `npm run check` already nests them.

## Concurrency and scope

At planning time p9d is separately activated. Before executing any P1, verify true local source version 0.9.23 and clean or deliberately accepted dirty state. If p9d P2 already moved manifests to 0.9.24, HALT this fixed-version stack; developer must reconcile/replan its version and overlapping source, not force the old patch or hide p9d changes. No Phase 10, Session deletion, theme overhaul, file permission changes, new Chat/Work mode toggle or repository reset.
