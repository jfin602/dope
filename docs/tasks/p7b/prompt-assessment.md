# Product Phase 7B Prompt Assessment

Status: **APPROVED / READY FOR EXECUTION**
Product source baseline: `a81558dd91ec9042b1066812811a98ba04734047`, coherent `0.7.13`
Task folder: `p7b`
Authority: ADR 0004, ADR 0022, ADR 0025, ADR 0026, current Phase 7 plan, PRODUCT-MODEL, ARCHITECTURE, stability contract, retained P13/c7 evidence

## Conclusion

Use ten ordered prompts. Phase 7B is a normal Phase 7 continuation, not a correction. P1 starts at `0.7.14`; P10 closes the 7B slice at `0.7.23`. The `p7b` runner continuation grammar infers `0.7.13` as the baseline and preserves normal phase commit/version semantics.

| Prompt | Boundary | Tier | Model |
| --- | --- | --- | --- |
| P1 | provider-neutral AIConnection/AIModel domain + service contracts | T1 | GPT-6 Sol High |
| P2 | machine-global revisioned registry persistence/concurrency/migration | T2 | GPT-6 Sol High |
| P3 | Environment / Session / OS-secure credential boundary | T2 | GPT-6 Sol High |
| P4 | provider setup adapters + centralized runtime activation | T2 | GPT-6 Sol High |
| P5 | model inventory, normalized health, Test Connection, eligibility | T2 | GPT-6 Sol High |
| P6 | singleton AI Center + bottom-left AI launcher | T2 | GPT-6 Sol High |
| P7 | Chat convergence onto AI Center | T2 | GPT-6 Sol Medium |
| P8 | Software Map convergence while retaining run authority | T2 | GPT-6 Sol High |
| P9 | exact-candidate AI Center qualification | T3 | GPT-6 Sol High |
| P10 | evidence-only Phase 7B closeout | T3 | GPT-6 Sol Medium |

## Current source findings

- Phase 7A/c7 is present at `0.7.13`; P13 remains Not Qualified only because 7B/7C are missing.
- `ModelConnectionMetadata` currently contains only `id`, `providerId`, `label`, and optional preferred model. This is too small for ADR 0026 lifecycle/config/locality/health/model-history contracts.
- `FileModelConnectionStore` persists version-1 JSON under user config but has no document revision, cross-process mutation lock, stale-write rejection, or external-change propagation.
- `ModelConnectionsRegistry` owns one process-local map plus session credentials. Runtime listeners are process-local and connection health is effectively a boolean `ready`.
- Local/Gemini/OpenAI conversational adapters already exist. The P12 correction makes Local execution fail closed on unknown loaded capacity; 7B must preserve this and keep health distinct from per-request eligibility.
- General Chat and Model Connections already share one backend registry, but `ChatPanelWidget.setupModels/reconnect` still owns inline global connection setup/credential prompts. 7B should replace this with AI Center routing, not another store.
- Software Map still owns separate Local/Gemini setup, browser preference state, feature-level discovery and a Gemini credential entry. It must consume centralized connection/model identity while retaining explicit run target, evidence-egress consent, structured-output probe, warm-up and synthesis strategy.
- `SoftwareMapBackend` already receives Theia `KeyStoreService`. Reuse a supported secure credential abstraction where it genuinely provides OS-secure persistence; if the runtime cannot establish secure storage, persistent secret entry is unavailable. Never add plaintext fallback.
- `c7-chat-conversation-ux` proved supported `AbstractViewContribution`/workbench launcher seams. AI Center should likewise use supported Theia commands/views/shell APIs; no DOM/private-shell patching.
- No AI Center UI, disabled connection lifecycle, known-vs-usable model history, model hide/disable preference, normalized health state machine, generic Test Connection, provider-neutral eligibility query, or OpenAI-compatible provider type exists yet.

## Architecture decisions for implementation

### Pure AI domain

Create a small framework/provider-independent `@dope/ai` package rather than making Theia backend objects the only definition of AIConnection/AIModel semantics.

It owns strict versioned types/parsers/helpers for:
- immutable AIConnection identity and Enabled/Disabled lifecycle;
- safe provider/runtime configuration with distinct Local/LM Studio, OpenAI, OpenAI-compatible and Gemini types;
- credential source/status references without secret values;
- connection-scoped AIModel identity, enabled/disabled preference, local/hosted classification, known/ready/unavailable state;
- capability/limit metadata plus source quality (`provider-reported`, `adapter-known`, `configured`, `unknown` or equivalent);
- normalized connection health states from ADR 0026;
- revisioned registry snapshots/mutations;
- provider-neutral eligibility queries that filter only and never rank/choose;
- Test Connection result metadata that is ephemeral/non-authoritative.

`@dope/contracts` may expose RPC/service paths using `@dope/ai` types, but provider IDs/wire schemas/Theia types do not become the domain.

### One application-global registry

Replace the version-1 process-local file behavior with one logical machine-local registry authority. Keep the storage outside `.dope/`, use revisioned atomic writes and cross-process exclusion, reject stale writers, and propagate accepted external changes to open backends/windows through event-driven observation rather than UI polling.

Deterministically migrate current `model-connections.json` metadata once, preserving existing connection IDs. Do not keep old and new stores bidirectionally synchronized.

### Credentials

Credential classes are Environment, Session-only and OS secure storage. Secure values are never returned to the frontend. Persistent secure storage is capability-detected and fail-closed. The existing Software Map Gemini key must converge without exposing/copying secret bytes through ordinary preferences or logs.

### Provider setup versus role routing

7B may normalize connection setup fields and runtime activation for Local/LM Studio, OpenAI, OpenAI-compatible and Gemini. It may expose explicit locality and eligibility metadata. It must not implement AIRolePolicy, target ranking, role fallback, role persistence, role UI, Follow Interactive Chat policy or Why-this-model provenance; those are 7C.

## Testing concentration

P1 is pure T1. P2-P8 use only focused tests and the narrowest affected package builds. Do not run broad browser/Electron/package/live-provider qualification during ordinary prompts. P9 owns multi-window/process, no-project, real Local, secure credential, browser/Electron/package and consumer-convergence evidence plus `npm run check`. P10 reuses valid P9 evidence and reruns only version/coherence checks.

## Non-goals

- no role assignments/routing/fallback;
- no mutation/tool/delegation;
- no Phase 8 Coding Agent consumer;
- no Phase 10 background alignment;
- no project-local AI connection state;
- no plaintext persistent secrets;
- no silent hosted fallback;
- no replacement of Software Map feature-specific egress/probe/warm-up authority.
