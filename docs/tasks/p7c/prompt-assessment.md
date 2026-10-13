# Product Phase 7C Prompt Assessment

Status: **APPROVED / READY FOR EXECUTION**
Product source baseline: `42353d5d817b1c57c72ccb28e52a6bdf5eb1d66b`, coherent `0.7.23`
Task folder: `p7c`
Authority: ADR 0004, ADR 0022, ADR 0025, ADR 0026, current Phase 7 plan, PRODUCT-MODEL, ARCHITECTURE, stability contract, Phase 7B Green closeout

## 7B entry decision

Phase 7B is **Qualified / Closed** at `0.7.23`. Its A-H closeout is Green. The bounded absence of paid hosted execution and separate native launcher clicking is explicitly retained evidence, not a hidden blocker. The implementation establishes the exact 7C substrate required by ADR 0026: immutable connection/model identities, machine-global revisioned inventory, secure credential sources, normalized health/capability/locality metadata, filter-only eligibility, AI Center, and converged Chat/Software Map consumers.

Proceed to 7C. Do not reopen 7B unless 7C exposes a concrete regression.

## Conclusion

Use nine ordered prompts. P1 starts at `0.7.24`; P9 is the one final Product Phase 7 closeout at `0.7.32`.

| Prompt | Boundary | Tier | Model |
| --- | --- | --- | --- |
| P1 | AIRolePolicy / constraint / RoutingProvenance pure contracts | T1 | GPT-6 Sol High |
| P2 | application-global role-policy persistence/concurrency/tombstones | T2 | GPT-6 Sol High |
| P3 | deterministic resolver, constraint intersection and role health | T1/T2 | GPT-6 Sol High |
| P4 | role-routed execution, bounded fallback and immutable provenance | T2 | GPT-6 Sol High |
| P5 | AI Center Roles UI | T2 | GPT-6 Sol High |
| P6 | Chat Interactive-role migration, egress authority, Why this model | T2 | GPT-6 Sol High |
| P7 | Software Map role default + future role-consumer seams | T2 | GPT-6 Sol High |
| P8 | direct integrated 7C qualification | T3 | GPT-6 Sol High |
| P9 | final Product Phase 7 closeout | T3 | GPT-6 Sol Medium |

Versions are `0.7.24` through `0.7.32`. `p7c` uses the already-general pre-1.0 continuation runner grammar and infers `0.7.23` as its baseline.

## Current source findings

- `@dope/ai` already owns provider-neutral AIConnection/AIModel identity, locality, capability/limit source quality and `findEligibleModels`; no AIRolePolicy or routing provenance exists.
- `AIRegistryStore` already proves the machine-global revision/lock/watcher pattern. Role policy should use the same logical user-global concurrency model without changing 7B connection identity semantics.
- Prefer a distinct revisioned `AIRolePolicyStore` under the same Dope user-config boundary rather than stuffing role edits into the connection-registry revision. This keeps policy revision/provenance explicit while reusing the same locking/watch/fail-closed discipline.
- `ChatSettings` currently stores an optional exact `defaultModel`; `ChatTurnRequest` requires an exact `selectedModel`; `ChatExecution` records selected/actual model only. 7C must migrate this without rewriting existing exact defaults.
- `ChatBackend` currently sends directly through `ModelConnectionsRegistry.generate`, which is exact-target and correctly has no fallback. Keep that path for explicit exact selections; role routing belongs in a new orchestration service above the same runtime.
- `ModelRuntimeFailure` normalizes transport/upstream/cancel/auth/provider/config/model/capability classes. Generic role fallback may use connection/model unavailable and bounded transient transport/upstream failures only before useful output; cancellation/auth/nonretryable/invalid output/unsupported semantic failures do not fallback.
- AI Center is connections-first today and has no Roles surface.
- Software Map consumes centralized exact connection/model IDs and still owns consent/probe/warm-up. 7C may supply a role-derived default candidate but must turn it into a visible exact run target before feature execution; generic router fallback must not splice models inside one synthesis run.

## Architecture decisions

### Role policy is distinct application state

Add pure role contracts to `@dope/ai`: exactly five fixed role IDs (`interactive`, `deep-reasoning`, `background`, `software-map`, `coding-agent`), role policy, exact/constraint policy entries, typed hard constraints, soft preferences, role health, unresolved target descriptors and routing provenance.

Use a separate machine-global revisioned role-policy snapshot/store under the same user config authority. Policies are not project state and never enter `.dope/`.

Unconfigured roles remain explicit. Do not auto-assign a model merely because one is available.

### Deterministic resolution

Resolution consumes one immutable inventory snapshot + one role-policy revision + one request. It first intersects global role hard constraints with stronger feature/request constraints, then walks preferred + ordered fallback policy entries. Exact entries either qualify or fail. Constraint entries filter through 7B eligibility; soft preferences resolve ambiguity only within that entry and deterministic immutable-ID ordering breaks ties. No latency/cost/benchmark scoring.

Global policy can restrict hosted use but never creates feature egress consent. A hosted candidate is eligible for a project-data request only when the initiating feature has already supplied explicit hosted-egress authorization.

### Routing execution

Keep resolution separate from execution. The router resolves candidate order first, then attempts each candidate at most once.

Fallback is allowed only for a role-routed request that explicitly allows it, while all effective constraints remain true and before meaningful output. Allow preflight unavailability and normalized transient transport/upstream/connection/model failure. Never fallback after any meaningful delta, user cancellation, authentication/config error, nonretryable/content/policy rejection, invalid/malformed output, new egress boundary or feature-semantic failure.

Explicit per-turn/feature exact selection never enters automatic fallback.

### Chat egress authority

A new Chat defaults to Follow Interactive. Existing Chats with an exact `defaultModel` migrate to pinned Exact and are never silently rewritten. A legacy Chat without an exact default may migrate to Follow Interactive because it carries no exact preference.

A global Interactive role pointing at hosted does **not** by itself authorize sending a durable project Chat/history/context off-device. When role-following Chat resolution would select hosted, the Chat feature must obtain explicit user egress confirmation before submission (or use an already-defined feature-level consent state if one is introduced transparently). Do not encode that authorization into AIRolePolicy.

Per-message model selection remains exact and one-turn; selecting an exact hosted model is the explicit target authority for that turn and never silently falls back.

### Software Map

Software Map role is a default/eligibility policy only. Resolve it to a visible candidate in setup, but the user-facing run still owns exact target selection, hosted evidence disclosure/consent, structured-output probe, warm-up and strategy. Once a run starts, generic role fallback does not replace the exact synthesis target.

### Future consumers

Background and Coding Agent are configurable roles but have no Phase 7 execution consumer. Expose a typed role-request API sufficient for Phase 10 to require local-only/no-hosted-fallback and Phase 8 to request Coding Agent later. Coding Agent UI says `No active consumer yet`. Deep Reasoning is not selected by a hidden classifier.

## Testing concentration

P1-P7 use focused tests/builds. P8 alone owns real GUI/multi-process/live Local/fallback/Chat/SMap/restart/package/aggregate evidence. P9 reuses that evidence and performs only final coherence/audit work unless the closeout transition exposes a concrete inconsistency.

## Non-goals

- no custom roles;
- no dynamic model scoring/ranking;
- no project/window role overrides;
- no routing cost/latency optimizer;
- no mutation/delegation or Coding Agent execution;
- no Phase 10 background scheduler;
- no role policy that grants project-data egress;
- no generic fallback after explicit exact selection;
- no provider retry tree that can restart role fallback indefinitely.
