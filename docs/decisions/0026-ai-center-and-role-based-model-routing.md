# ADR 0026 — AI Center and role-based model routing

Status: Accepted
Date: 2026-10-03

## Context

Product Phase 7 already introduces the provider-independent Model Runtime, an application-level Model Connections registry, durable Dope-owned Chats, per-message connected-model selection, and per-Chat model/context policy. That is the correct substrate for general AI use, but it does not yet give the developer one coherent place to manage every AI connection or express which connected models should normally serve different kinds of work.

Dope also has later features with materially different execution needs. Foreground Chat should remain directly steerable. Software Map synthesis has explicit provider/evidence-egress authority. Product Phase 8 needs high-volume local-first background semantic maintenance with no silent hosted fallback. Future Scoped Delegation will need a coding-agent role without making one provider the product architecture.

If each feature owns provider configuration or hard-codes one model, Dope will accumulate duplicated setup, inconsistent connection state, and routing logic that is difficult to evolve. If global defaults are allowed to imply feature authority, a harmless connection preference could accidentally authorize repository evidence to leave the machine or cause background work to incur hosted cost.

## Decision

### Phase 7 is split into three ordered slices

Phase 7 remains one product phase and one `0.7.x` package family, but execution is conceptually split into:

1. **Phase 7A — AI Presence**: durable Chats/ChatPanels, provider-independent conversational Model Runtime, application Model Connections registry, Local/Gemini/OpenAI adapters, per-message model selection, per-Chat settings, bounded context, and read-only Ask/Explain/Trace/Find Related.
2. **Phase 7B — AI Center**: one global connection/model management surface over the Phase 7A registry, plus model discovery/readiness/test/status and secure configuration.
3. **Phase 7C — AI Roles & Routing**: global role policies, capability/constraint-aware resolution, explicit fallback policy, and role-aware consumers.

The existing P1-P12 Phase 7 stack is the Phase 7A implementation/qualification path. The currently written P13 evidence-only closeout is superseded by this decision and must not execute as final Phase 7 closeout. After P12, `/prompt-ass -> /prompt-plan -> /prompt-write p7` must regenerate the contiguous P13+ continuation and one new final Phase 7 closeout using the actual 7A implementation.

This is forward product capability, not a bounded defect repair, so it must not be disguised as a correction stack.

### AI Center is the canonical global control plane

**AI Center** is the canonical user-facing name for global AI connection management.

The current bottom-left account/profile action becomes an **AI** launcher with an AI-specific icon. Activating it opens or reveals a dedicated AI Center center-workspace tab/editor-like surface. Account/profile management belongs under ordinary Settings rather than remaining the persistent bottom-left AI entry point.

AI Center owns the user/application-level view of:
- configured provider/runtime connections;
- discovered/known models beneath each connection;
- readiness/health and reconnect/refresh state;
- connection testing;
- safe non-secret configuration;
- role policies once Phase 7C is implemented.

The launcher may surface restrained status decoration for meaningful connection problems, but ordinary healthy state should remain quiet.

### Connections and models are distinct

A provider/runtime connection is not a model.

The Dope-owned conceptual contracts are:

```text
AIConnection
  id
  providerType
  displayName
  endpoint/configuration reference
  authReference
  enabled
  status

AIModel
  connectionId
  modelId
  displayName
  capabilities
  context limits
  availability/readiness

AIRolePolicy
  roleId
  preferred target
  fallback candidates
  required capabilities
  constraints
```

Exact storage/schema fields may evolve, but the separation is architectural. Features consume Model Runtime/connection/model capabilities and do not own independent provider inventories.

### Connection configuration is user/application state

Global connection inventory, non-secret provider configuration, model discovery state, and role preferences are user/application state by default, not project truth.

They do not belong in `.dope/`. A repository may refer to project-local feature policy only where separately designed, but copying a repository must not copy credentials or silently authorize another machine/account to use the same hosted provider.

Credentials/tokens remain secret runtime/application state. Persistent secret storage, when implemented, must use an appropriate secure-store boundary such as OS-backed credential storage. Environment/session-only secret inputs remain valid. Secrets must never be written to `.dope/`, Chat persistence, ordinary plaintext preferences, logs, provenance payloads, or provider-visible error text.

### Roles are policies, not one-to-one model aliases

A role expresses the intent and constraints of work rather than hard-coding a provider.

Initial role vocabulary is:

- **Interactive**
- **Deep Reasoning**
- **Background**
- **Software Map**
- **Coding Agent**

A role policy may express a preferred model/connection, ordered fallback candidates, required capabilities, minimum context/reasoning requirements, local/hosted constraints, privacy/egress constraints, and other execution requirements.

A role may exist before every consumer ships. In particular, Coding Agent can be defined before Product Phase 9 gives it mutation/delegation consumers.

Features should request a role plus constraints when they do not require an explicit model. Product/domain code must not spread provider-name conditionals merely to implement routing.

### Resolution precedence preserves developer authority

The general resolution order is:

```text
explicit per-message / explicit feature model choice
    -> persistent Chat-specific model policy where applicable
    -> feature-requested role + constraints
    -> global AI Center role policy
    -> permitted fallback candidates
```

An explicit developer-selected model is authoritative for that execution. If it fails, Dope surfaces the failure rather than silently switching providers/models. The developer must explicitly retry with another model unless the initiating feature used a role policy that already authorizes bounded fallback.

Role fallback must still satisfy the feature's constraints. A lower-precedence global preference can never weaken a higher-precedence privacy, egress, locality, capability, or authority requirement.

### AI Center preference does not grant feature authority

Connection/routing policy and feature execution authority are separate.

For Software Map work, AI Center may establish a preferred/default candidate for the **Software Map** role, but ADR 0022 remains authoritative: Analyze Project, Search Deeper, or another explicit sMap workflow owns provider selection/readiness and evidence-egress disclosure for that execution. Having Gemini/OpenAI connected, or naming one as the Software Map preference, does not by itself authorize repository evidence transfer.

For Product Phase 8, ADR 0023 remains authoritative. Continuous/background alignment must request constraints equivalent to:

```text
role: Background
localOnly: true
allowHostedFallback: false
```

Therefore a generic Background role may have broader developer-configured candidates for other future uses, but Phase 8 cannot silently fall through to a hosted provider, incur hosted cost, or send project evidence off-device.

### One registry; many consumers

Phase 7A's application Model Connections registry is the backend substrate for AI Center. Phase 7B must extend/project that registry rather than create a second provider store.

The target relationship is:

```text
AI Center
    |
    +-- Connection Registry
    |      +-- Local / LM Studio
    |      +-- OpenAI
    |      +-- Gemini
    |      +-- future providers
    |
    +-- Model Registry / capabilities
    |
    +-- Role Policies
           |
           +-- Chat / Interactive
           +-- Deep Reasoning
           +-- Software Map
           +-- Background
           +-- Coding Agent
```

Existing provider-specific setup surfaces may remain temporarily where a feature needs specialized consent/configuration, but global inventory/configuration must converge on this shared registry rather than creating new independent connection ownership.

## Consequences

- Phase 7A can proceed without ballooning Chat implementation into a full routing/control-plane project.
- Phase 7B becomes a focused UI/application projection over connection infrastructure that already exists.
- Phase 7C can add role resolution without rewriting provider adapters or Chat identity.
- Local models gain a first-class place for economical/private background work without making Local the only runtime.
- Hosted frontier models can serve difficult foreground work without becoming silent defaults for privacy-sensitive/background features.
- Feature-level authority remains explicit even when global connection/routing preferences exist.
- Account/profile UI moves to Settings; the persistent bottom-left control becomes the AI entry point.
- Phase 8 can depend on role-aware Model Runtime while preserving its deterministic-first, local-first, no-hosted-fallback contract.
- Product Phase 9 can later consume Coding Agent routing without receiving special provider privileges.

## Non-goals

This decision does not:
- add mutation/delegation authority to Phase 7;
- make role routing canonical project truth;
- allow silent provider fallback after explicit model selection;
- allow global AI preferences to bypass evidence-egress consent;
- require every provider to expose identical capabilities;
- require Phase 7B to implement every future role consumer;
- move Phase 8 background alignment into Phase 7.

## Revisit when

Revisit the role vocabulary or policy schema when real consumers require new constraints or when a provider exposes a materially new execution primitive. Preserve the separation between connection inventory, role preference, feature authority, and canonical project state.
