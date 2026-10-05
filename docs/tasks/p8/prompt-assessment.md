# Product Phase 8A Prompt Assessment — Codex Reference Connection

Status: **APPROVED / PROMPTS WRITTEN / EXECUTION GATED**
Execution folder: `p8`
Product slice: **Phase 8A — Codex reference agent connection**
Planned activation baseline: coherent `0.8.0` after `c7-chat-project-grounding` closes Green or the owner records an explicit sequencing waiver
Current planning/source baseline: `683e9cec5bb272427d5bf470f7359e2e8c98ebdd`, package `0.7.31`

## Naming decision

Use execution folder **`p8`**, not `p8a`.

The phase runner treats the first slice of a phase as the base phase folder; this matches the Phase 7 pattern where 7A used `p7` and later slices used `p7b` / `p7c`. Using `p8` allows P1 to target `0.8.1` from a real `0.8.0` activation baseline without inventing an earlier continuation checkpoint or changing runner grammar.

Later slices may use `p8b`, `p8c`, and so on.

## Conclusion

Use exactly six prompts.

| Prompt | Boundary | Tier | Model | Browser |
| --- | --- | --- | --- | --- |
| P1 | AI domain/registry contract for Codex + agentExecution | T1 | GPT-6 Sol High | no |
| P2 | ChatGPT-plan OAuth/account/session security | T2 | GPT-6 Sol High | no |
| P3 | Codex App Server process/RPC/model/test adapter | T2 | GPT-6 Sol High | no |
| P4 | AI Center Codex setup/account/model/usage UX | T1/T2 | GPT-6 Sol High | no |
| P5 | Coding Agent role eligibility/convergence + isolation from generic model consumers | T2 | GPT-6 Sol High | no |
| P6 | live Sign in with ChatGPT + App Server/browser qualification and 8A closeout | T3 | GPT-6 Sol High | yes |

This is the smallest safe decomposition. Authentication/token rotation and child-process/RPC lifecycle are separate trust boundaries and should not land in one prompt. UI waits until both backend contracts are stable. Role integration comes after inventory semantics are known. Expensive real OAuth/provider/browser evidence is concentrated in P6.

## Current-source findings

### AI Center already has the right global ownership model

`@dope/ai` owns immutable connection/model identity, lifecycle, locality, capability metadata and eligibility. `AIRegistryStore` is machine-local/application-global, revisioned and cross-process safe. AI Center is a singleton global presentation.

Codex should extend that substrate rather than create a Phase 8-specific provider store.

### Codex requires a new connection/runtime type

Current connection types are Local/LM Studio, OpenAI, OpenAI-compatible and Gemini. Generic OpenAI is API-key/Model Runtime oriented. Codex App Server has materially different authentication, process lifecycle and agent semantics.

Add an explicit Codex agent-runtime config; do not hide it behind `openai` or `openai-compatible`.

### Capability must be provider-neutral

Current model capability keys are `conversationalText`, `streaming`, `structuredOutput`, and `toolCalling`.

Add **`agentExecution`** as the Phase 8A semantic capability. Coding Agent role resolution requires it. `toolCalling=true` alone is not enough to claim a complete coding-agent harness.

Codex inventory is `hosted` for egress/locality even though App Server and shell tools run locally.

### Existing API-key credential manager is not sufficient for OAuth

`AICredentialManager` stores one opaque secret per connection through session/environment/OS keyring. ChatGPT-plan integration requires a protected account registration/session bundle: issued client identity, stable host identity, verified account identity, access/refresh/ID tokens, granted scopes and expiry/refresh timing.

Do not overload one API-key string into pretending to be that lifecycle.

Create a narrow Codex/ChatGPT-plan auth manager or generalized OAuth-session boundary. Keep access/refresh/ID tokens out of the registry, browser state, project state and logs.

Use OS secure storage for persistent token material with no plaintext fallback. A session-only option may be allowed if it is intentionally ephemeral, but persistent plan auth must fail closed when secure storage is unavailable.

### Refresh is a cross-process correctness problem

The documented open-source flow returns rotating refresh credentials. A successful refresh replaces the refresh token. Dope already supports multiple backend processes/windows.

One account registration must therefore have a serialized refresh critical section so two processes cannot both consume/overwrite a rotating token. The post-refresh credential bundle must be replaced atomically.

### Official App Server contract is suitable for the reference adapter

Current OpenAI documentation specifies:
- pass OAuth access token to the App Server child via an environment variable;
- start `codex app-server --listen stdio://` with a ChatGPT-plan Responses provider;
- newline-delimited JSON over stdin/stdout;
- `initialize` then `initialized`;
- `thread/start`, save the returned thread ID;
- `turn/start`;
- agent-message delta events and terminal `turn/completed`;
- after token refresh, restart App Server and `thread/resume`.

Provider-native thread identity remains adapter recovery metadata, not Dope connection/task identity.

### Model discovery is not entitlement

App Server `model/list` may use a bundled/cached catalog. Account-specific `GET /v1/models` with the same OAuth token can provide current display choices. Even that catalog is not a guarantee that a selected model will execute; completed inference is the final access check.

Preserve Known / Ready / Unavailable / Unknown semantics rather than pretending catalog membership equals entitlement.

### Test Connection remains zero-project-data

Codex Test Connection should initialize App Server and execute one tiny synthetic task in a disposable empty/scratch working directory with mutation disabled. It proves auth/runtime/model completion only.

It must not touch the active project or qualify Phase 8 coding authority.

### AI Center UI should expose account/runtime truth without pretending to own usage counters

Add Connection should present Codex as an Agent Runtime, with Continue with ChatGPT, account status, model inventory, App Server availability, reauthorize/sign out and a link to ChatGPT usage/settings.

Do not invent a remaining weekly-usage meter unless an authoritative provider surface exists.

### Role integration must not contaminate Chat/Software Map

Codex models with `agentExecution=true` should satisfy Coding Agent policy. They should not automatically appear as ordinary Chat or Software Map execution targets unless that same connection/model separately satisfies those features' hard capabilities.

### No mutation authority in 8A

8A proves the connection and reference harness only. It does not grant repository write/process/Git authority. AgentTask/ExecutionGrant project mutation begins in 8B.

## External implementation references

Use current official OpenAI documentation during implementation rather than freezing wire/token details into Dope domain code:

- https://developers.openai.com/siwc/token-sharing-open-source
- https://developers.openai.com/siwc/token-sharing-open-source/sign-in
- https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions
- https://developers.openai.com/siwc/token-sharing-open-source/token-reference
- https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference
- https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server
- https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations

## Validation strategy

P1 is pure-domain/store compatibility and stays focused.

P2 uses deterministic mock OAuth/JWKS/token endpoints plus cross-process/lock tests. No real browser sign-in yet.

P3 uses a fake App Server child process/RPC fixture and deterministic HTTP model catalog. No project mutation or real provider call.

P4 uses focused AI Center controller/presentation tests and extension build.

P5 exercises role eligibility/routing and feature isolation.

P6 owns the only broad/live evidence: real Continue with ChatGPT, real Codex App Server, real zero-project-data test turn, restart/refresh/account/model behavior, browser AI Center UX, aggregate validation and 8A closeout.

Do not run broad T3 evidence repeatedly in P1-P5.

