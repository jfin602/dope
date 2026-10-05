# Phase 8A Closeout — Codex Reference Connection

Status: **NOT GREEN — EVIDENCE GAP**

Date: 2026-10-05  
Scope: **Phase 8A — Codex reference connection only**. This is not a Product Phase 8 qualification and does not authorize repository mutation, AgentTask, ExecutionGrant, process, or Git effects.

## Exact candidate

- Source basis: `4e73b6b41eec76658353e6500ee63d5c223f3fa5` (`0.8.5`).
- Candidate: the uncommitted coherent `0.8.6` package/internal-reference bump plus the bounded P6 App Server compatibility correction below.
- Installed direct reference executable: `codex-cli 0.155.1`.
- The candidate worktree was intentionally left uncommitted; the phase/manual closeout process owns the checkpoint boundary.

The canonical active execution stack remains `docs/tasks/p8a/`. This closeout is written here because P6 explicitly requires `docs/tasks/p8/closeout.md`; the historical `p8` and active `p8a` prompt grammars both validate the same P1–P6 metadata.

## Automated evidence

Passed:

- Focused initial P6 evidence: `npm run build:extension && node --test test/unit/ai.test.ts test/unit/ai-registry-store.test.ts test/unit/provider-setup.test.ts test/unit/codex-auth.test.ts test/unit/codex-app-server.test.ts test/unit/ai-center.test.ts test/unit/ai-role-routing.test.ts test/unit/chat.test.ts test/unit/software-map-ui.test.ts` — 92 tests passed.
- `npm run check` — passed once before the narrowly-scoped P6 compatibility repair (typecheck, all test suites, browser build, Electron build).
- `npm run codex:phase:validate -- p8` — passed.
- `npm run codex:phase:validate -- p8a` — passed.
- Exact package/internal reference check, no root `package-lock.json`, and `git diff --check` — passed.
- After the repair: `corepack yarn workspace @dope/theia-extension build && node --test test/unit/codex-app-server.test.ts test/unit/ai-center.test.ts test/unit/ai-role-routing.test.ts test/unit/software-map-ui.test.ts` — 58 tests passed.

The automated guards establish token-free registry projections; protected-store fail-closed behavior; serialized rotating-refresh handling across two managers; consent/auth/usage failure mapping; independent same-email registrations; App Server cleanup and refresh/restart/resume; no API-key fallback; Coding Agent `agentExecution` eligibility; and ordinary Chat/Software Map isolation from Codex-only models.

## Bounded P6 repair

The first real App Server run rejected the adapter's thread-level sandbox spelling: current App Server expects `read-only`, not `readOnly`. The correction changes only the Codex adapter's `thread/start` and `thread/resume` sandbox value and adds the required `networkAccess: false` field to the read-only turn policy.

The focused permanent regression guard now asserts the exact thread and turn payloads. No authority was widened: the test still uses `approvalPolicy: "never"`, read-only sandboxing, disabled shell/agents/web search, and a new temporary root.

## Direct evidence

### AI Center and OAuth

Observed in a real browser-hosted Dope UI with no active project and a disposable application configuration:

- AI Center opened without a project and displayed the distinct `Codex / Agent Runtime` connection.
- The selected connection reported `needs-authentication`, no usable models, no selected account, the explicit no-API-key-fallback wording, the plan-usage/settings link, and the zero-project-data/mutation-disabled Test Connection disclosure.
- `Continue with ChatGPT` initiated a pending browser sign-in state without exposing an authorization URL, token, or credential in the rendered UI.

Not established live: a completed eligible-account authorization callback, account/model inventory, model refresh, persistence through Dope restart, sign-out/reauthorize/reconnect, or inspection of a populated secure-store profile. Those claims remain gaps rather than being inferred from the pending state or tests.

### Direct Codex App Server

Passed against the installed real executable in a newly created empty directory:

- App Server initialized successfully.
- `model/list` returned a usable real model (`gpt-6-astra` in this run).
- A tiny `Reply exactly OK. Do not use tools.` turn reached terminal `completed` with read-only/no-approval/no-network policy.
- The process stopped cleanly and the scratch directory was empty afterwards.

This proves the real executable/protocol/model entitlement path under the current signed-in Codex CLI account. It does **not** substitute for Dope's own ChatGPT-plan OAuth lifecycle, because the live Dope registration was not completed.

### Security, failures, and role consumers

- Controlled exact-candidate integration evidence covers refresh-token exclusion/atomic replacement, revoked/removed/declined plan repairability, unavailable model and plan-limit normalization, separate generic OpenAI behavior, independent Codex registrations, and no silent API-key billing fallback.
- Controlled App Server evidence covers refreshed-token replacement and opaque-thread resume; direct live replacement/resume with a refreshed Dope OAuth token was not possible without the missing authorization.
- Controlled routing evidence confirms Codex model inventory is hosted and `agentExecution`-capable for Coding Agent, while ordinary Chat and Software Map reject a Codex-only agent target. Coding Agent still has no mutation consumer in 8A.

## Residual gaps and decision

Phase 8A is **Not Green — Evidence Gap** because the required real Dope UI authorization lifecycle and its account-specific inventory/Test Connection were not completed. Consequently, no claim is made for real Dope OAuth persistence, live Dope token refresh/process replacement, live refresh/sign-out/reconnect, direct plan-limit/revocation behavior, or live Coding Agent role health after authorization.

Do not route to Phase 8B `/docs-review` yet. Re-run the direct AI Center qualification on this exact candidate after an eligible account completes ChatGPT authorization in the disposable profile; then repeat only evidence invalidated by any resulting repair. Repository mutation remains deferred.
