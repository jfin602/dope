# Phase 8A Closeout — Codex Reference Connection

Status: **GREEN / QUALIFIED — supplemental final disposition below**

Date: 2026-10-05  
Scope: **Phase 8A — Codex reference connection only**. This is not a Product Phase 8 qualification and does not authorize repository mutation, AgentTask, ExecutionGrant, process, or Git effects.

The original P6 **Not Green — Evidence Gap** record is retained below as historical evidence. The supplemental disposition at the end supersedes that initial decision for the later exact `0.8.6` source candidate.

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

## Initial P6 residual gaps and decision (historical)

At initial P6, Phase 8A was **Not Green — Evidence Gap** because the required real Dope UI authorization lifecycle and its account-specific inventory/Test Connection were not completed. Consequently, no claim was made then for real Dope OAuth persistence, live Dope token refresh/process replacement, live refresh/sign-out/reconnect, direct plan-limit/revocation behavior, or live Coding Agent role health after authorization.

Phase 8B `/docs-review` was held pending the direct AI Center qualification. Repository mutation remained deferred.

## Supplemental final disposition — 2026-10-05

**Decision: GREEN / QUALIFIED for Phase 8A only.** The exact qualified source candidate is `17806d3050cd6e3d4c793bc8856af8daeaaef63f`, coherent `0.8.6`, after three of five permitted repair cycles. The candidate is not a Product Phase 8 or Phase 8B qualification. Cycle checkpoints and the first failed broad check remain in [cycle evidence](../c8-p8a-qualification-loop/cycle-evidence.md).

### Direct live evidence on the candidate lineage

- A real no-project Dope AI Center callback reached the pre-bound HTTP `127.0.0.1` `/auth/callback` listener. Authorization and token exchange used the same redirect URI and issued client ID. State, ID-token issuer/audience/expiry/nonce/signature, required direct-plan scope, and account identity passed. The resulting account appeared signed-in with plan usage and five account-specific `agentExecution` models, including `gpt-6-astra`.
- After restarting Dope with the isolated application configuration, the same non-secret registration, issued client, selected account and five models returned without a new registration. Protected credentials remained usable; registry/config/browser-profile scanning found no exact access, refresh or ID-token bytes.
- A safely forced near-expiry refresh on the saved protected session completed against the real provider. Two independent auth managers obtained the same replacement access credential; access and rotating refresh credentials changed together, and subsequent access reused the replacement rather than the old refresh token.
- The real Codex App Server completed a scratch read-only/no-network turn, was replaced after credential refresh, initialized with the replacement access credential, resumed the saved thread and completed a second bounded turn. The old process exited. The real AI Center Test Connection also completed and reported hosted usage, positive latency and Ready.
- Real AI Center sign-out removed the local protected token bundle and left the registration signed-out. Remote revocation's HTTP response was not captured, so only local deletion is directly confirmed. Reauthorization reused the saved registration and issued client, preserved the stable host identity, verified the returning identity, and restored five models and a successful Test Connection. Transient provider failures occurred during retries; the eventual successes did not use API-key fallback.
- The disposable Coding Agent role accepted an exact Codex `agentExecution` model. Controlled consumer tests confirmed that ordinary Chat and Software Map do not route to Codex-only agent models. The hosted egress classification remains visible. Coding Agent has no repository mutation consumer in Phase 8A.

### Exact-source validation and limits

- Full focused Phase 8A suite: 94/94 passed. `npm run check` on `17806d3050cd6e3d4c793bc8856af8daeaaef63f`: passed, including typecheck, runner 103/103, baseline 11/11, local-install 1/1, product groups 295/295 and 28/28, IDE 1/1, browser build and Electron build.
- Both `npm run codex:phase:validate -- p8` and `-- p8a` passed. All ten inspected root/workspace manifests and internal `@dope` references are `0.8.6`; no root `package-lock.json`; `git diff --check` passed. An exact-token scan of 358 isolated application/config/browser files and the worktree diff found zero token matches or registry credential fields. The final backend and browser were stopped, with no orphan App Server process or project mutation observed.
- The first broad check failed three pre-existing runner capacity-retry tests because its regex literals matched literal backslash text. After the owner's explicit authorization, Cycle 3 corrected only those four patterns; focused runner tests 103/103 and the full exact-source check passed. This fix did not change Phase 8A runtime or auth behavior.
- A live provider plan-limit or revoked-account event was not induced. The existing controlled failure tests remain the evidence for those branches. Remote sign-out revocation and external browser history were not directly verified. These limits do not expand Phase 8A authority or substitute for any of the completed live gates.

Next: fresh Phase 8B Agent execution core `/docs-review`. No Phase 8B implementation is authorized by this closeout.
