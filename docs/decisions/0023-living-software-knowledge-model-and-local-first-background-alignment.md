# ADR 0023 — Living Software Knowledge Model and local-first background alignment

Status: Accepted  
Date: 2026-10-02  
Complements: ADR 0004, ADR 0008, ADR 0009, ADR 0010, ADR 0017, ADR 0020, ADR 0021, ADR 0022

## Context

The Software Map already separates deterministic/recorded physical evidence, synthesized interpretation and developer-owned canonical architecture. Repository documentation can participate in architecture discovery as provenance-bearing **Documented** evidence, but it does not independently prove implementation and is not continuously synchronized with canonical architecture.

The next product requirement is broader: source/runtime evidence, the accepted Software Map, documentation and formal contracts should remain mutually intelligible over time. A change to one representation can leave another stale even when ordinary compilation/tests still pass. Dope should surface that disagreement as drift rather than requiring the developer to remember to manually compare every representation.

Because these findings are intended to appear as alerts, alignment cannot depend on a developer manually starting a full analysis. It requires bounded continuous/background evaluation.

Running every change through hosted frontier inference would be expensive, privacy-sensitive and operationally wasteful. Running a large local synthesis on every edit would also waste compute. Phase 7 therefore provides the provider-independent Model Runtime substrate, while Phase 8 introduces a purpose-built deterministic-first, local-first maintenance loop.

## Decision

### Phase 8 is the Living Software Knowledge Model

Product Phase 8 is inserted after Product Phase 7 — AI Presence and before mutation-capable delegation.

The forward sequence is:

```text
Phase 7 — AI Presence
Phase 8 — Living Software Knowledge Model
Phase 9 — Scoped Delegation
Phase 10 — Development Sessions
```

Phase 8 is observation/alignment scope. It does not authorize AI mutation of source, documentation, contracts or canonical architecture.

### The knowledge model links representations; it does not collapse them

The Living Software Knowledge Model links stable Software Map identities to representations that describe, constrain or evidence them, including:

- source and deterministic semantic/framework evidence;
- recorded runtime observations;
- canonical System / Subsystem / Component architecture;
- documentation;
- ADRs and accepted architectural decisions;
- API/interface contracts;
- schemas;
- Flow identities and evidence where applicable.

These representations retain separate authority classes. Dope must preserve disagreement rather than choose one silently.

At minimum, knowledge claims distinguish:

- **Observed** — implementation/runtime evidence;
- **Documented** — descriptive current-state claims;
- **Normative** — contracts, schemas and accepted decisions;
- **Planned/Future** — intended future state that must not trigger current-state drift merely because it is not implemented;
- **Historical** — retained context excluded from ordinary current-state alignment.

### Knowledge assertions and findings are first-class alignment state

A bounded **KnowledgeAssertion** represents one claim linked to Software Map identity and provenance/evidence dependencies.

An **AlignmentFinding** represents a disagreement or uncertainty detected during revalidation. Representative finding states include observation, potential drift, confirmed drift, regression, contract violation, needs review and resolved.

Findings are not canonical truth. A model may classify or explain a finding but may not silently rewrite any representation to make the finding disappear.

### Alignment is event-driven and impact-scoped

Background alignment must not poll the whole project through a model.

Repository/workspace events first update deterministic evidence/fingerprints and calculate affected Software Map/knowledge identities. Only assertions whose dependency basis changed are invalidated.

The scheduler may debounce, deduplicate and batch rapid edits before semantic work. Unaffected assertions remain reusable while their dependency fingerprints match.

Meaningful checkpoints may include save, a quiet edit boundary, commit, explicit refresh or another product-defined stable event. Every keystroke must not create a model request.

### Deterministic checks always come first

Dope uses deterministic mechanisms whenever the question can be established mechanically, including as applicable:

- file/symbol existence and identity;
- ownership/mapping relationships;
- source/map evidence fingerprints;
- API/route/interface shape;
- schema validation;
- contract compatibility checks;
- deleted/orphaned identities;
- unrepresented implementation;
- canonical/physical realization state.

Semantic inference is reserved for meaning that cannot be established reliably by deterministic analysis, such as whether changed behavior still matches prose documentation or whether a descriptive architectural assertion remains supported.

A model must not be asked to replace a cheaper deterministic check.

### Continuous semantic maintenance is local-first

Normal background semantic alignment requests the Phase 7C **Background** role through the provider-independent Model Runtime with hard **local-only** and **no-hosted-fallback** constraints. The Background role is routing policy; these Phase 8 constraints are stronger feature authority and cannot be weakened by global role configuration.

Background model work should use compact structured micro-inference over the smallest sufficient evidence package. Calls should prefer classification/verification contracts over free-form prose and should not carry unrelated repository context.

Typical semantic checks answer bounded questions such as:

- does this current-state documentation assertion still match the changed implementation evidence?;
- does this architectural description remain supported by the affected subsystem?;
- is this disagreement sufficiently supported to surface as drift or does it need more evidence?

A local model is not treated as a weaker imitation of a hosted coding agent. For Phase 8 its primary role is high-volume continuous semantic maintenance.

### Hosted inference is explicit escalation only

Continuous/background alignment never silently falls back from local inference to a hosted provider.

If a local check is uncertain or exceeds local capability, Dope records a needs-review/deeper-analysis state. The developer may explicitly choose a hosted/frontier provider for Search Deeper or another bounded escalation.

Background operation must never silently:

- incur hosted-provider cost;
- send project evidence off-device;
- switch providers because the local model failed;
- broaden context to a hosted provider merely to clear a queue.

Provider selection, evidence egress and cost-bearing escalation remain explicit developer decisions.

### Background scheduling is resource-aware

Local inference has no per-call provider fee but still consumes CPU/GPU, RAM/VRAM, battery, heat and interactive capacity.

The background alignment scheduler therefore owns execution policy such as:

- debounce and deduplication;
- impact batching;
- priority;
- cancellation;
- local-model queueing;
- idle/quiet-period work;
- reduction or pause under resource pressure;
- yielding during foreground model use, builds/tests or other developer-directed work.

Foreground developer interaction always has priority over background inference.

The product may later expose simple user-facing background-intelligence intensity controls, but scheduling preferences are not canonical project truth.

### Persistence separates durable knowledge from execution state

Durable project-local alignment state may include:

- stable assertion identity;
- Software Map links;
- provenance/evidence dependencies;
- dependency fingerprints;
- last validated basis;
- open findings;
- acknowledgement/dismissal/resolution state.

It belongs beneath the project-local versioned `.dope/` Software Map/knowledge boundary.

Transient scheduler queues, debounce timers, prompt payloads, provider-native session/response IDs, model warm/residency state and rebuildable indexes are disposable execution/cache state.

Restart must not require re-running semantic checks whose durable dependencies are unchanged.

### Alerts are actionable and deduplicated

Not every invalidation becomes an alert.

The alert layer considers finding type, evidence strength/confidence where applicable, affected scope, persistence/novelty and severity. Duplicate findings should collapse onto the same durable finding identity until the underlying basis changes or the finding is resolved.

An alert should identify what representations disagree, the affected Software Map scope, supporting evidence and available developer actions such as inspect, Search Deeper, update map, update docs/contract, fix implementation, dismiss/acknowledge or resolve.

### General ambient intelligence remains deferred

Phase 8 intentionally introduces bounded ambient/background behavior only for maintenance of the Living Software Knowledge Model.

This ADR does not authorize general autonomous monitoring, automatic Ideas capture, mutation-capable background agents, multi-agent orchestration or unrelated ambient intelligence.

## Rationale

The knowledge model becomes more valuable if it can tell the developer when its own representations have diverged from reality.

A deterministic-first design minimizes false model work and preserves evidence authority.

A local-first design makes high-volume continuous checking economically practical, keeps routine project evidence on-device and gives local models a role well matched to many small structured judgments.

Explicit hosted escalation preserves provider independence, privacy and developer control while still allowing frontier reasoning when a finding genuinely needs it.

Placing this phase before Scoped Delegation means Dope learns to maintain and challenge its own understanding before it is allowed to act on the project.

## Consequences

- Product Phase 8 becomes Living Software Knowledge Model.
- Existing Scoped Delegation shifts to Product Phase 9.
- Existing Development Sessions shifts to Product Phase 10.
- Phase 7 Model Runtime/AI role routing must support the bounded structured/cancellable Background execution needed by Phase 8 without making provider/role state canonical; Phase 8 supplies hard local-only/no-hosted-fallback constraints.
- Software Map/product storage must support durable assertion/finding state without persisting unnecessary provider/session detail.
- Background alignment work requires a scheduler/application boundary distinct from Software Map truth and Model Runtime transport.
- Local-model efficiency becomes a first-class design target for Phase 8 rather than a later optimization.
- General-purpose ambient intelligence remains outside the initial Phase 8 scope.

## Alternatives considered

### Manual alignment only

Rejected because alerts require detection without a developer remembering to start a review.

### Hosted-first continuous checking

Rejected because it introduces recurring cost, routine evidence egress and unnecessary dependency on hosted availability.

### Run full local synthesis on every change

Rejected because most changes affect a small subset of assertions and can be narrowed mechanically first.

### Automatically rewrite stale representations

Rejected because disagreement is evidence that requires developer judgment; choosing a representation silently would violate developer authority and blur canonical versus derived state.

## Revisit when

Revisit scheduler policy and local-model strategy when real Phase 8 qualification data exists for latency, false positives, battery/resource contention, model residency and semantic-check quality.

Revisit whether any specific hosted background policy is useful only if it can remain explicit, cost/egress-aware and developer-controlled. The no-silent-hosted-escalation rule does not expire merely because hosted inference becomes cheaper.
