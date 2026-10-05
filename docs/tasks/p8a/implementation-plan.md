# Product Phase 8A Implementation Plan — Codex Reference Connection

Status: **APPROVED / PROMPTS WRITTEN / EXECUTION GATED**
Execution folder: `p8a`
Activation baseline: `0.8.0` at `a2346556309174e9a24b3f8c11ac682d50460d0c`
Version range: `0.8.1` through `0.8.6`
Assessment: `prompt-assessment.md`

## Entry condition

Satisfied by owner sequencing waiver and activation commit `a2346556309174e9a24b3f8c11ac682d50460d0c`.

The retained `c7-chat-project-grounding` closeout is **Not Green**; its gaps remain historical truth and are not a Phase 8 qualification claim.

Validate `p8a` against the coherent `0.8.0` baseline before execution.

## Shared invariants

- Codex is a first-class AI Center **agent-runtime connection**, not generic OpenAI API mode.
- Codex/ChatGPT-plan inference is `hosted` for egress/locality.
- `agentExecution` is provider-neutral capability semantics.
- AI Center owns connection/auth/model/runtime health; no project is required.
- access/refresh/ID tokens never enter registry/project/browser/log/routing state.
- persistent OAuth token material uses OS secure storage; no plaintext fallback.
- refresh for one account/registration is serialized across processes.
- multiple Codex account connections are allowed and keep immutable Dope IDs.
- provider-native thread IDs are adapter recovery metadata only.
- Test Connection uses zero project data and mutation-disabled scratch root.
- no silent ChatGPT-plan -> OpenAI API-key billing fallback.
- Coding Agent role can target Codex; ordinary Chat/Software Map do not inherit agent targets by provider name.
- no AgentTask mutation/process/Git authority in 8A.
- provider-specific OAuth/App Server wire details stay behind adapters.

## P1 — Codex AI domain and registry contract — 0.8.1 — T1

Extend `@dope/ai` and registry parsing/mutation safely.

Add:
- Codex connection config/runtime identity;
- non-secret auth/account projection needed by AI Center, without tokens;
- `agentExecution` capability;
- provider setup description with hosted locality and agent-runtime class;
- parser/migration behavior so existing v1 registry files remain readable or receive the smallest deliberate schema migration.

Decide schema versioning explicitly. Do not silently accept fields outside strict parsers.

Eligibility:
- Coding Agent hard capability may query `agentExecution`;
- generic eligibility remains deterministic;
- Codex is always hosted;
- unknown agentExecution never satisfies the requirement.

No OAuth HTTP, child process or UI.

Focused tests: AI domain, registry store/migration, provider setup, role capability query. Build `@dope/ai` and affected contracts/extension types only.

## P2 — ChatGPT-plan OAuth/account/session security — 0.8.2 — T2

Create the backend auth/session boundary for Codex connections.

Responsibilities:
- stable per-install/host identifier;
- dynamic first registration and returning issued-client reuse;
- PKCE/state/nonce transaction lifecycle;
- callback validation;
- ID-token verification against issuer/JWKS/audience/nonce;
- retain verified opaque subject/account label and issued client ID as non-secret metadata;
- verify granted ChatGPT-plan usage scope;
- secure access/refresh/ID-token bundle persistence;
- session-only behavior only if explicitly supported;
- serialized refresh and atomic replacement of rotating credentials;
- reauthorize/sign-out/disconnect;
- sanitized status/errors.

Do not put token material in `AIRegistrySnapshot` or generic `AICredentialReference` if that would flatten OAuth into API-key semantics. Prefer a dedicated auth service/profile contract.

Tests:
- state/nonce/PKCE;
- wrong client/account/issuer/audience/nonce;
- scope missing;
- refresh replacement;
- two-process or equivalent serialized refresh race;
- secure-store unavailable;
- sign-out;
- no secret bytes in registry/loggable DTOs.

Use deterministic fake endpoints/JWKS; no live sign-in.

## P3 — Codex App Server adapter and zero-data test — 0.8.3 — T2

Implement provider-specific Codex runtime adapter.

Process lifecycle:
- locate/configure supported Codex executable;
- verify compatible version/capability without treating CLI version as product identity;
- spawn `codex app-server --listen stdio://` with ChatGPT-plan provider config and access token only in child environment;
- initialize / initialized;
- robust newline-delimited JSON-RPC correlation/event parsing;
- bounded startup/shutdown/idle cleanup;
- no orphan child on error/cancel/application disposal.

Inventory:
- account-specific model catalog when needed;
- optional App Server model/list as adapter catalog;
- normalize models into AI Center inventory with hosted locality and `agentExecution=true`;
- catalog is not entitlement;
- runtime/test failure updates health without rewriting identity.

Test Connection:
- scratch/empty working directory;
- mutation disabled;
- thread/start + tiny turn/start;
- success only on completed terminal status;
- zero active-project data;
- no generic OpenAI API fallback.

Token refresh:
- adapter stops old App Server, receives refreshed access through auth manager, starts/initializes replacement process, and can resume saved provider thread when applicable.

Use fake App Server child + fake account model endpoint for focused tests. No live OAuth/provider yet.

## P4 — AI Center Codex UX — 0.8.4 — T1/T2

Add Codex to the existing singleton AI Center.

Add Connection:
- distinct Agent Runtime / Codex choice;
- concise explanation that it uses eligible ChatGPT plan usage rather than generic API-key setup;
- Continue with ChatGPT action.

Connection detail:
- alias/lifecycle;
- runtime/App Server status;
- account label/status;
- sign in / reauthorize / sign out;
- model inventory with normal enable/disable/known-state semantics;
- Refresh Models;
- Test Connection with zero-project-data disclosure;
- usage text + link to ChatGPT usage/settings;
- no raw tokens, auth URLs containing token hints, or absolute sensitive paths.

Preserve multiple connections/accounts and AI Center no-project behavior.

Do not show fake weekly remaining percentage.

Focused controller/presentation/accessibility tests + extension build. No live browser OAuth yet.

## P5 — Coding Agent role convergence and consumer isolation — 0.8.5 — T2

Make Phase 7C role policy correctly understand the new capability.

- Coding Agent request requires `agentExecution`;
- exact/constraint targets retain deterministic routing;
- Codex hosted locality participates in existing locality/egress constraints;
- unconfigured Coding Agent remains repairable without global warning noise;
- multiple Codex connections can be ordered preferred/fallback by immutable IDs;
- unavailable/removed target tombstones remain understandable;
- no silent fallback to generic OpenAI API unless it is explicitly configured as a future eligible agentExecution target;
- ordinary Chat/Interactive and Software Map consumers do not select a Codex-only agent target merely because it is an OpenAI model.

No mutation consumer yet; UI still states Coding Agent has no active mutation consumer until 8B.

Run focused AI role/inventory/Chat/SMap isolation tests + affected builds only.

## P6 — Phase 8A Codex connection qualification closeout — 0.8.6 — T3

Use a disposable AI config environment and no active project where possible.

Directly prove:
- Add Codex connection in real AI Center;
- Continue with ChatGPT successful authorization;
- account label/registration survives restart;
- secrets absent from registry/project/browser/log outputs;
- real account-specific model inventory;
- Codex models appear as hosted agentExecution candidates;
- real App Server start/initialize;
- zero-project-data Test Connection completes one tiny turn;
- Test Connection does not mutate any project;
- disconnect/reauthorize path;
- token refresh/restart/resume path if safely stageable; otherwise use direct controlled expiry/refresh test plus live restart evidence and record any bounded gap honestly;
- multiple-window/process refresh exclusion;
- plan/consent/usage-limit/auth failure maps to repairable status;
- no automatic API-key billing fallback;
- Coding Agent role can target the Codex connection;
- Interactive/Software Map do not consume Codex-only agent models;
- App Server shuts down cleanly with no orphan process.

Automated T3:
- focused Phase 8A tests;
- `npm run check`;
- `npm run codex:phase:validate -- p8`;
- version/internal-reference/no-root-lock/diff checks;
- Linux/Electron packaging only if 8A changes packaged executable/runtime discovery in a way requiring native proof; otherwise direct Electron/browser runtime evidence is sufficient.

Write `docs/tasks/p8/closeout.md` with exact candidate and Green / Not Green / Evidence Gap truth.

This closes **Phase 8A only**, not Product Phase 8. If Green, route next to Phase 8B Agent execution core planning; do not begin repository mutation inside 8A.

