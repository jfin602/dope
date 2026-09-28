# Product Phase 4 — AI Presence Planning Worksheet

Status: OPEN PLANNING WORKSHEET  
Date: September 28, 2026  
Target phase: Product Phase 4 — AI Presence

## Purpose

Resolve the remaining runtime and product questions that must be answered before Phase 4 is decomposed into an implementation plan and prompt stack.

This worksheet does not activate Phase 4 and does not change the Phase 3 boundary.

## Already locked

The following are not open questions unless explicitly revisited through the normal decision process:

- Dope owns canonical Project Mind, Planning, Agent Mind, authority, session and validation state.
- Model/provider integrations remain replaceable adapters behind a Dope-owned Model Runtime.
- Provider independence must not collapse to a lowest-common-denominator interface; capability discovery is explicit.
- OpenAI/Codex is the first reference AI implementation.
- Local models and local inference runtimes remain first-class compatibility targets.
- Provider-native response IDs, session IDs, context handles, request schemas and tool wire formats remain adapter state unless translated into a Dope-owned durable contract.
- Phase 4 introduces observation and assistance before mutation.
- Phase 4 does not grant filesystem/process mutation authority.
- AI consumes Dope-owned project state, including Project Mind and active Planning context.
- Agent Mind is structured, visible product state, not raw/private chain-of-thought.
- The IDE remains the center of gravity. Chat is one interface, not the product ontology.
- The repository's Codex phase runner is development tooling, not the product runtime.

## Decision worksheet

### Q1 — What is the first OpenAI/Codex integration shape?

**Why it matters**

The first integration determines authentication, streaming, cancellation, context handling, provider-managed state and how strongly the first adapter influences the Model Runtime contract.

**Options to evaluate**

- OpenAI API/SDK directly.
- A Codex-specific programmatic interface where available and appropriate.
- A local Codex process/CLI adapter.
- A bounded combination, with one explicitly designated as the reference path.

**Current leaning**

Build the Dope-owned Model Runtime first and use the cleanest supported programmatic OpenAI/Codex interface as the first adapter. Do not make CLI process invocation canonical architecture.

**Decision**

TBD.

---

### Q2 — How much read authority does Phase 4 AI receive over the attached project?

**Why it matters**

If the AI can only see a small context bundle, Dope risks reproducing the closed-context problem we are trying to avoid. If read access is too broad or opaque, observability and trust suffer.

**Options to evaluate**

- Context supplied only by Dope proactively.
- Deterministic read-only repository retrieval supplied by Dope.
- Model-invoked read-only tools such as file read, list and search.
- A combination of automatic context plus observable model-invoked read retrieval.

**Current leaning**

Allow broad read/search/inspection authority within the attached project through Dope-owned read interfaces. Reads should be observable. Mutation remains unavailable until Scoped Delegation.

**Decision**

TBD.

---

### Q3 — What context does Dope provide automatically, and how visible is that context to the developer?

**Why it matters**

The context envelope affects quality, cost, privacy, reproducibility and the developer's ability to understand why an AI response was produced.

**Candidate default envelope**

- active Task and PlanStep;
- relevant Plan state;
- linked Project Mind artifacts;
- active file and selection;
- current working set;
- explicitly retrieved repository evidence;
- bounded environment/runtime facts where relevant.

**Questions to resolve**

- Which fields are automatic versus opt-in?
- How are context budgets allocated?
- How are stale or conflicting artifacts represented?
- Can the developer inspect exactly what context was assembled?
- Can the developer exclude context before a request?

**Current leaning**

Use a bounded Dope-owned context assembler and make the effective context inspectable to the developer.

**Decision**

TBD.

---

### Q4 — What is the primary Phase 4 AI interaction UX?

**Why it matters**

The product vision says the AI inhabits the IDE; the IDE must not collapse into a chat wrapper.

**Options to evaluate**

- Contextual commands/actions attached to files, selections, Tasks, Plans and Project Mind.
- A compact conversational surface for multi-turn discussion.
- Agent Mind as a persistent inspectable surface during substantive AI work.
- A traditional chat panel as the dominant interface.

**Current leaning**

Prefer contextual IDE actions plus a compact conversation surface where useful, with Agent Mind visible/inspectable for substantive AI work. Responses should remain anchored to project objects and evidence rather than becoming isolated chat history.

**Decision**

TBD.

---

### Q5 — What is the scope, lifetime and persistence model of Agent Mind?

**Why it matters**

The answer determines whether AI state survives restart, whether provider switching is practical, and whether Agent Mind is truly Dope-owned rather than a projection of one provider's conversation.

**Questions to resolve**

- Is Agent Mind scoped per project, Plan, Task, work unit or interaction?
- Which fields persist across restart?
- What resets automatically and what requires explicit closeout?
- Can a different provider continue the same Agent Mind?
- What is canonical versus ephemeral?
- How are stale assumptions/questions/risks retired?
- How does Agent Mind relate to the later DeveloperSession concept without prematurely implementing Phase 6?

**Current leaning**

Use structured task/work-unit-scoped provider-independent state that can survive useful restart scenarios and provider switching. Raw provider conversation history must not be required to resume canonical state.

**Decision**

TBD.

---

### Q6 — Does Phase 4 qualification require a real local-model adapter?

**Why it matters**

If Phase 4 closes after only the Codex/OpenAI adapter, provider independence is architecturally designed but not yet demonstrated against a materially different runtime.

**Options to evaluate**

- Phase 4 qualifies only the Codex/OpenAI reference adapter; local integration follows later.
- Phase 4 requires one minimal local-runtime adapter before closeout.
- Phase 4 requires only a fake/test adapter in addition to Codex/OpenAI.

**Current leaning**

Require one minimal real local-provider proof before Phase 4 closeout. The goal is boundary qualification, not parity with the frontier provider.

**Decision**

TBD.

---

### Q7 — How much of Theia AI should Dope reuse?

**Why it matters**

Theia AI may save substantial plumbing work, but its agent/chat/session ontology must not become Dope's product model.

**Candidate reusable infrastructure**

- model registry/provider plumbing;
- OpenAI-compatible provider support;
- local-provider integrations;
- streaming;
- context variables;
- prompt services;
- MCP/tool plumbing;
- structured output;
- cancellation/session transport;
- confirmation infrastructure.

**Questions to resolve**

- Which pieces can be wrapped cleanly behind Dope contracts?
- Which pieces leak Theia AI ontology into canonical state?
- Does reuse simplify or complicate local-provider support?
- Can Theia AI be replaced later without migrating Project Mind, Planning or Agent Mind?

**Current leaning**

Treat this as an early Phase 4 technical qualification. Reuse plumbing that stays behind Dope-owned adapters; reject ontology leakage.

**Decision**

TBD.

---

### Q8 — What is the Phase 4 boundary for read-only tools and provider-native capabilities?

**Why it matters**

Some providers expose native code execution, tool calling, search or managed context. The runtime must benefit from richer capability without accidentally crossing the Phase 4 no-mutation boundary.

**Questions to resolve**

- Which capabilities are allowed in Phase 4 when they are observational only?
- Are provider-native tools allowed if Dope cannot observe their exact reads?
- Must all repository reads route through Dope-owned interfaces?
- How are external/network reads treated?
- How are capability differences surfaced to the user?
- What happens when a provider lacks structured output, streaming or cancellation?

**Current leaning**

Repository observation should remain Dope-owned and observable. Provider-specific capabilities may be used where they do not bypass Dope's state, visibility or authority boundaries.

**Decision**

TBD.

## Secondary operational questions

These should be resolved during Phase 4 planning even if they do not require separate ADRs.

| Area | Questions |
| --- | --- |
| Model selection | How are provider/model choices exposed? Per project, per task, per request, or default profile? |
| Credentials | Where are API credentials stored? How are local runtimes configured? What must never enter project state or Git? |
| Cost/usage | Do we show request tokens, cached tokens, estimated cost, latency and context size? Which values are provider-reported versus estimated? |
| Context budgets | How are automatic context, retrieved context and conversation history budgeted and truncated? |
| Timeouts/retries | Which failures retry automatically? Which require explicit developer action? |
| Cancellation | What cancellation guarantees does Model Runtime require? What happens to partial Agent Mind updates after cancellation? |
| Errors | How are provider, auth, rate-limit, malformed-output and capability errors normalized without hiding useful provider detail? |
| Retention | What conversation/output data is ephemeral, locally persisted, or promoted into canonical project state? |
| Privacy | How does the developer see what project data is about to leave the machine for a hosted provider? |
| Offline/local mode | What Phase 4 surfaces remain useful when no hosted provider is available? |
| Structured output | Which Phase 4 operations require typed structured responses versus free-form prose? |
| Observability | What request/context/retrieval/runtime events are visible for debugging without exposing private chain-of-thought? |

## Decisions to settle before Phase 4 prompt decomposition

At minimum, resolve these before generating the Phase 4 implementation plan and prompt stack:

1. Phase 4 repository read-authority model.
2. Agent Mind scope/lifetime/persistence model.
3. Whether a real local-provider adapter is required for Phase 4 qualification.
4. First OpenAI/Codex integration path.
5. Theia AI reuse boundary.
6. Default context envelope and developer-visible context inspection.

## Relationship to existing authority

This worksheet is subordinate to:

- `docs/decisions/0003-observation-mutation-authority.md`
- `docs/decisions/0004-model-provider-independence.md`
- `docs/decisions/0006-codex-reference-ai-bootstrap.md`
- `docs/ARCHITECTURE.md`
- `docs/PRODUCT-MODEL.md`
- `docs/VISION.md`
- `docs/roadmap/mvp-roadmap.md`

Resolved answers should be promoted into the appropriate ADR, architecture/product contract, Phase 4 plan or roadmap text rather than leaving this worksheet as competing authority.
