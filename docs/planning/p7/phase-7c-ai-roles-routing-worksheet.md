# Product Phase 7C — AI Roles & Routing Planning Worksheet

Status: OPEN PLANNING WORKSHEET  
Date: October 3, 2026  
Target slice: Product Phase 7C — AI Roles & Routing  
Assumption: Product Phase 7A and Phase 7B are fully implemented and qualified before this worksheet is resolved.

## Purpose

Resolve the ten highest-leverage product, policy, authority and runtime questions for Phase 7C before decomposing role routing into the Phase 7 prompt continuation.

This worksheet assumes Phase 7A already provides durable Chats/ChatPanels, conversational Model Runtime, Local/Gemini/OpenAI adapters, explicit per-message model selection, per-Chat model/context settings and read-only AI Presence. It also assumes Phase 7B already provides the singleton AI Center, one machine-local/application-global connection registry, secure credential handling, stable connection/model identity, normalized capabilities/locality/readiness, connection/model eligibility queries and centralized connection configuration.

Phase 7C should add **policy and deterministic target resolution**, not rebuild provider setup, connection health, model discovery or feature-specific authority.

Resolved answers should be promoted into ADR 0026, the Phase 7 plan, architecture/product contracts, roadmap text, or a follow-on ADR through the normal documentation workflow.

## Already locked

The following are not open questions unless explicitly revisited through the normal decision process:

- Initial built-in role vocabulary is **Interactive**, **Deep Reasoning**, **Background**, **Software Map**, and **Coding Agent**.
- `AIRolePolicy` is user/application execution policy, not canonical project truth.
- Role policy references immutable connection/model IDs rather than display labels.
- AI Center/Model Runtime already exposes normalized model capabilities, local-vs-hosted classification, limits/readiness and a provider-neutral eligibility query seam.
- Roles express preferred targets, permitted fallback candidates, required capabilities and constraints rather than provider-name conditionals.
- Explicit per-message or explicit feature model choice has higher authority than role routing.
- Chat-specific persistent model policy remains above feature/global role policy where applicable.
- General precedence is: explicit per-message/feature choice -> persistent Chat policy where applicable -> feature-requested role + constraints -> global role policy -> permitted fallback.
- An explicit developer-selected model does **not** silently fall back.
- Role-based fallback is legal only when the initiating feature/policy permits it and all higher-priority constraints remain satisfied.
- Global routing preference never grants feature-level mutation, privacy or evidence-egress authority.
- Software Map still owns explicit provider/model readiness and evidence-egress consent for Analyze Project/Search Deeper.
- Product Phase 8 continuous Background alignment is local-only with hosted fallback forbidden.
- Coding Agent may exist as a role before Product Phase 9 adds a mutation/delegation consumer.
- Phase 7C remains read-only with respect to general project mutation.

## Decision worksheet

### Q1 — What exactly does each built-in role mean, and can users create custom roles in Phase 7C?

**Why it matters**

Role names must have stable product meaning or features will use them inconsistently. At the same time, prematurely allowing arbitrary user-defined roles can turn the first routing system into a generic policy language before the five known consumers are proven.

**Questions to resolve**

- What execution intent does each built-in role represent?
- Is Interactive strictly normal foreground Chat, or any low-latency foreground AI request?
- What differentiates Deep Reasoning from a Chat-specific reasoning-effort setting?
- Is Background a generic non-interactive role while Phase 8 adds stronger local-only constraints?
- Does Software Map name architecture/synthesis work only, including Search Deeper?
- Does Coding Agent exist as a configurable role before Phase 9 consumes it?
- Can users create, rename or delete roles in 7C?
- Are built-in roles stable IDs with editable display labels, or fixed product vocabulary?

**Current leaning**

Keep the five built-in roles as fixed stable product IDs with clear semantics. Allow their policies to be edited, but do not introduce arbitrary custom roles in initial 7C. Interactive means ordinary foreground/latency-sensitive assistance; Deep Reasoning means deliberately capability/reasoning-heavy foreground work; Background means non-interactive maintenance/work but gains feature constraints such as Phase 8 local-only; Software Map covers model-assisted architecture/sMap work; Coding Agent is reserved/configurable before its Phase 9 consumer exists.

**Decision**

Locked: initial Phase 7C uses exactly five fixed built-in role IDs with stable canonical product meaning:

- **Interactive** — normal foreground AI assistance where responsiveness and ordinary Chat/IDE interaction are primary.
- **Deep Reasoning** — deliberately heavier foreground reasoning for difficult analysis where additional latency/cost is acceptable.
- **Background** — non-interactive work that may run without blocking the developer; individual features may impose stronger constraints, such as Phase 8 local-only/no-hosted-fallback.
- **Software Map** — model-assisted Software Map/architecture work, including Analyze Project, Search Deeper and related bounded semantic architecture analysis.
- **Coding Agent** — tool-using/delegated coding work. It is configurable in Phase 7C so later consumers have a stable policy target, but mutation-capable use remains deferred until Product Phase 9.

Users may configure the policy for each built-in role but may not create, delete or rename role types in initial Phase 7C. Custom roles are deferred until real consumers demonstrate a need that the five built-ins cannot express cleanly.

Role identity describes **what kind of work is being requested**, not the exact reasoning-control setting of a selected model. For example, Deep Reasoning may resolve to a stronger model, while that model's own supported reasoning-effort control remains a separate execution setting. Role policy and model-specific reasoning controls must not be conflated.

Built-in role IDs/names remain canonical product vocabulary. User-friendly aliases belong on connections/models, not on role identity, so feature bindings remain understandable and deterministic across projects/windows.


---

### Q2 — Should role routing be deterministic ordered policy or dynamic model ranking?

**Why it matters**

The initial policy model can stay understandable and reproducible or become a hidden scoring system based on cost, latency, benchmarks and availability. A dynamic ranker may be useful later, but it also makes routing harder to explain and can silently change behavior as metadata changes.

**Questions to resolve**

- Is a role policy one preferred exact model plus an ordered fallback list?
- Can a policy target a connection and allow any eligible model beneath it?
- Can a policy target an eligible pool rather than exact models?
- Does Dope ever automatically rank several eligible models by latency/cost/capability in 7C?
- If the preferred target is unavailable, does routing walk an explicit ordered list only?
- Can a fallback entry be a constraint query such as “any local structured-output model”?
- How deterministic must the same role request be when inventory is unchanged?
- Should measured runtime performance influence routing automatically?

**Current leaning**

Make initial 7C deterministic and inspectable: explicit preferred target plus ordered fallback entries, where an entry may be an exact model or a bounded constraint target. Do not introduce opaque score-based auto-ranking or benchmark-driven model switching in 7C. Same inventory + same policy + same constraints should resolve the same target.

**Decision**

TBD.

---

### Q3 — What is the constraint grammar, and which constraints are hard versus preferences?

**Why it matters**

Roles only remain safe if routing can distinguish “must be local” from “prefer local,” “requires structured output” from “structured output would be nice,” and hard privacy/capability rules from optimization hints.

**Questions to resolve**

- Which hard constraints ship in 7C?
- Which soft preferences ship in 7C?
- How are required capabilities represented?
- How are local-only, hosted-allowed and hosted-required represented?
- Is minimum context window a hard constraint?
- Can policies express preferred reasoning capability/effort?
- Are latency/cost preferences included now or deferred?
- What happens when capability metadata is Unknown?
- Can a feature strengthen a global role's constraints for one request?
- Can a global role policy ever weaken feature-supplied constraints?

**Current leaning**

Define a small typed grammar. Hard constraints include required capabilities, local/hosted/egress rules, minimum known context where genuinely required, enabled/usable state and feature authority. Soft preferences may include prefer-local/prefer-hosted and preferred reasoning capability. Unknown does not satisfy a hard requirement. Feature-requested constraints combine by strengthening/narrowing the global policy; they never get weakened by it. Defer generalized cost/latency optimization until real usage proves it necessary.

**Decision**

TBD.

---

### Q4 — Exactly which failures may trigger role-policy fallback?

**Why it matters**

ADR 0026 permits bounded fallback for role-routed work but forbids it after explicit model selection. Phase 7C still needs a precise definition of which failures advance to another candidate versus surface immediately, especially when hosted fallback may incur cost or data egress.

**Questions to resolve**

- Does fallback occur when the preferred model is disabled/unavailable before execution?
- Does auth failure allow fallback?
- Does rate limiting allow fallback?
- Does timeout allow fallback?
- Does provider rejection/malformed output allow fallback?
- Does cancellation ever fall back?
- Can a partially streamed response fall back automatically?
- Can fallback cross Local -> hosted when policy allows hosted?
- Does crossing an egress/cost boundary require additional feature/user consent?
- How many fallback attempts are allowed?
- How are fallback attempts recorded?

**Current leaning**

Allow deterministic fallback for preflight unavailability and selected bounded runtime failures only when the role/feature already authorizes fallback and every candidate satisfies the same hard constraints. Never fallback on user cancellation, after meaningful partial output, or across an egress/consent boundary that was not already authorized. Bound attempts by the explicit ordered candidate list; no cycles or open-ended retries.

**Decision**

TBD.

---

### Q5 — What exact override scopes exist above the global role policy?

**Why it matters**

The precedence chain is conceptually locked, but the product still needs precise persistence and UI behavior. Without this, Chat defaults, explicit per-turn choices and feature choices can become confusing or accidentally mutate global routing.

**Questions to resolve**

- Does Chat default model remain an exact model override or can it select a role?
- Can a Chat choose “Use Interactive role” as its persistent default?
- Does per-message selection always choose an exact model?
- Can a feature such as Search Deeper explicitly choose a role rather than a model?
- Are there project-level role overrides in 7C?
- Are there workspace/window-level overrides?
- Does changing a global role immediately affect existing Chats that use role-default behavior?
- Do historical executions remember the resolved role and target?
- Can an override silently rewrite the global policy?

**Current leaning**

Keep global roles application-wide. Do not add generic project-level role overrides in initial 7C. Chat may persist either an exact default model or “follow Interactive role”; per-message explicit model selection remains exact and one-turn. Features may request their canonical role plus stronger constraints or expose an explicit exact target when feature authority requires it. Overrides never mutate global role policy.

**Decision**

TBD.

---

### Q6 — What happens when a role is unconfigured, invalid or has no eligible target?

**Why it matters**

Dope should not silently invent defaults or route sensitive work just because a role has no valid target. The first-run/bootstrap behavior will strongly affect whether roles feel useful or obstructive.

**Questions to resolve**

- Are role policies automatically assigned during 7C migration?
- Does Interactive auto-select the current Chat default/reference model?
- Does Background auto-select any Local model?
- Should unconfigured roles remain visibly unconfigured until the user chooses?
- Can Dope recommend candidates without assigning them?
- What does a feature do when its requested role has no target?
- Does AI Center offer a one-action repair flow?
- If a referenced model is removed/disabled, is the role policy automatically rewritten?
- How are partially invalid fallback lists shown?

**Current leaning**

Fail explicit and user-controlled. Dope may recommend eligible candidates but should not silently create enduring role assignments. Unconfigured/broken roles remain visible and route the user to AI Center. Removing/disabling a referenced target does not silently rewrite policy; the policy becomes partially/fully unresolved until the user repairs it, while valid later fallback entries may remain usable if policy permits.

**Decision**

TBD.

---

### Q7 — What is the Roles UI inside AI Center?

**Why it matters**

The policy can be architecturally clean but still confusing if the user has to understand a routing DSL. The UI needs to make five roles easy to scan, configure and diagnose while keeping connection/model details separate.

**Questions to resolve**

- Is Roles a third top-level AI Center section beside Connections and Models?
- Are roles shown as cards, rows or a matrix?
- What does each role show at a glance?
- How are preferred target and fallback order edited?
- How are hard constraints shown?
- How are invalid/unavailable targets surfaced?
- Can the user inspect eligible models before choosing?
- How are feature-specific constraints such as Phase 8 local-only represented without making them editable global policy?
- How does the UI explain that Coding Agent has no active consumer yet?
- Should drag/reorder be used for fallback ordering?

**Current leaning**

Add a first-class **Roles** section in AI Center with five compact role rows/cards. Each shows role purpose, preferred target, fallback count, key policy constraints and current resolution health. Selecting a role opens an editor for exact preferred target, ordered fallbacks and editable global constraints/preferences. Eligible-target previews come from the 7B query seam. Feature-imposed constraints appear as non-editable explanatory requirements where relevant rather than being confused with global user policy.

**Decision**

TBD.

---

### Q8 — Which Phase 7/8/9 features bind to which roles, and when is an exact model still required?

**Why it matters**

Role routing only becomes real when consumers use it consistently. Overusing roles can weaken feature authority; underusing them leaves provider/model decisions duplicated across the product.

**Questions to resolve**

- Does ordinary new Chat default to Interactive?
- What invokes Deep Reasoning?
- Does a user explicitly choose Deep Reasoning, or may features request it?
- Does Software Map use the Software Map role only as a default candidate while still requiring run-level consent?
- Does Search Deeper use Software Map?
- Does Phase 8 always use Background + local-only/no-hosted-fallback?
- Is Coding Agent merely configurable until Phase 9?
- Do automatic Chat titles use Interactive, Background, or the same model as the triggering turn?
- Which tiny internal model tasks should remain explicit/feature-owned rather than role-routed?
- Can a feature bypass roles entirely when it has a justified exact-model contract?

**Current leaning**

New/role-following Chat uses Interactive. Explicit higher-effort foreground actions may request Deep Reasoning. Software Map and Search Deeper use the Software Map role only to propose/resolve an eligible default target; actual execution still passes through sMap consent/readiness. Phase 8 requests Background with hard local-only/no-hosted-fallback constraints. Coding Agent is configurable but unconsumed until Phase 9. Features may keep exact target selection where authority/capability makes it necessary.

**Decision**

TBD.

---

### Q9 — What routing provenance and observability must every execution record?

**Why it matters**

A developer should be able to answer “why did Dope use this model?” without reading logs or trusting a hidden router. Fallback makes this even more important.

**Questions to resolve**

- Does each execution record the requested role?
- Does it record role-policy revision?
- Does it record feature constraints?
- Does it record the preferred candidate and chosen candidate?
- Does it record rejected/ineligible candidates?
- How much of fallback history is durable?
- Is the routing explanation visible in Chat/AI Center or only diagnostics?
- How are secrets/private config excluded?
- Does historical provenance remain understandable after role policies change?
- Should the user be able to inspect a concise “Why this model?” explanation?

**Current leaning**

Persist compact provider-neutral routing provenance per execution: requested role (if any), policy revision/identity, relevant non-secret hard constraints, resolution source (explicit model / Chat default / role), actual connection/model, and bounded fallback attempt/result history. Historical records do not change when policy changes later. Provide a concise user-facing **Why this model?** explanation without exposing private chain-of-thought or secret configuration.

**Decision**

TBD.

---

### Q10 — How do role policies behave when connections/models/capabilities change over time?

**Why it matters**

The AI Center inventory is intentionally dynamic. Models are removed, disabled, renamed, become unavailable or change capabilities. Role policy must fail safely without constantly rewriting itself or losing the developer's explicit intent.

**Questions to resolve**

- Does a removed model reference remain in the role policy as unresolved?
- Does a disabled model remain the preferred target but get skipped at execution?
- Does an unavailable model trigger fallback while preserving preference?
- What happens if capability metadata changes and the preferred model no longer satisfies hard constraints?
- Does model reappearance automatically restore preferred routing?
- Are policy edits revisioned/concurrency-safe like connection state?
- Do all open windows receive role-policy updates live?
- Is there role-policy history/undo in 7C?
- Can policy migration automatically change stable IDs?
- What conditions decorate AI Center/AI launcher as needing role repair?

**Current leaning**

Preserve explicit policy intent. Removed/disabled/ineligible targets are retained as unresolved references rather than silently replaced. Temporary unavailability may use permitted fallbacks while keeping the preferred target intact; when it becomes usable again, deterministic routing returns to it. Capability changes re-evaluate eligibility without rewriting policy. Role policies use the same application-global revision/concurrency/event model as AI Center connections. Defer full policy history/undo unless implementation need justifies it.

**Decision**

TBD.

## Secondary implementation questions

These matter during 7C prompt decomposition but should not displace the ten primary decisions above.

| Area | Questions |
| --- | --- |
| Role policy storage | Same application registry document as connections, or separate revisioned policy store behind one service? |
| Migration | Does 7C migrate existing Chat defaults into Interactive recommendations without changing Chat state? |
| Reasoning controls | Is reasoning effort part of role policy, Chat policy, per-request feature policy, or a combination? |
| Cost display | Should Roles show approximate hosted/local cost characteristics without performing automatic cost ranking? |
| Latency display | Can recent observed latency be shown as information while remaining non-authoritative for routing? |
| Local resources | Should a role show VRAM/load information from the runtime without making resource arbitration a 7C responsibility? |
| Validation | Which fake/mocked providers prove deterministic routing, and which real Local/hosted paths are required for final qualification? |
| Accessibility | Keyboard editing/reordering and non-color invalid-policy/status semantics. |
| Export/import | If non-secret connection profiles are later exportable, should role policies be exportable separately? |
| Extensibility | What later event would justify custom roles, scoring/ranking, cost budgets or project-specific role overrides? |

## Decisions to settle before Phase 7C prompt decomposition

All ten primary questions should be answered before the final Phase 7C `/prompt-ass -> /prompt-plan -> /prompt-write p7` continuation is generated.

The most architecture-sensitive decisions are:

1. fixed role semantics and custom-role boundary;
2. deterministic routing versus dynamic ranking;
3. hard/soft constraint grammar;
4. fallback trigger/authority semantics;
5. override scopes and precedence;
6. unconfigured/broken-role behavior;
7. feature-to-role bindings;
8. routing provenance;
9. role-policy behavior under changing inventory.

The Roles UI should project these policy semantics rather than define them.

## Relationship to existing authority

This worksheet is subordinate to:

- `docs/decisions/0004-model-provider-independence.md`
- `docs/decisions/0022-smap-synthesis-model-runtime-seam.md`
- `docs/decisions/0023-living-software-knowledge-model-and-local-first-background-alignment.md`
- `docs/decisions/0025-durable-project-chat-and-chatpanel-ai-presence.md`
- `docs/decisions/0026-ai-center-and-role-based-model-routing.md`
- `docs/planning/p7/activation.md`
- `docs/planning/p7/phase-7-plan.md`
- `docs/planning/p7/phase-7b-ai-center-worksheet.md`
- `docs/ARCHITECTURE.md`
- `docs/PRODUCT-MODEL.md`
- `docs/stability-contract.md`
- `docs/roadmap/mvp-roadmap.md`

Resolved answers should be promoted into those authorities through `/docs-review -> /docs-apply`. The worksheet remains planning context rather than competing canonical product authority.
