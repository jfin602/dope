# ADR 0011 — Local-first sMap synthesis bootstrap

Status: Accepted
Date: 2026-09-29
Complements: ADR 0004, ADR 0006, ADR 0010
Amended by: ADR 0012

## Context

ADR 0010 introduces a narrow pre-Phase-6 model capability for initial Software Map architecture synthesis. The synthesis boundary is provider-independent: deterministic analyzers produce an ArchitectureEvidencePacket and a model-backed ArchitectureSynthesisProvider returns a validated ArchitectureProposal.

The first reference implementation still needs a concrete runtime/model path so correction `c4-architecture-discovery` can be implemented and qualified end to end.

The product goal is to keep initial sMap generation streamlined and usable without requiring a paid API. A local runtime also avoids sending project evidence to a hosted provider unless the developer deliberately chooses one later.

## Decision

### Local-first reference path

The first reference implementation for sMap architecture synthesis is:

`LM Studio local server -> Qwen3-Coder-30B-A3B-Instruct -> strict ArchitectureProposal JSON`

This is a bootstrap/qualification choice, not canonical product identity.

The Software Map domain continues to depend only on Dope-owned contracts such as:
- `ArchitectureEvidencePacket`;
- `ArchitectureProposal`;
- an `ArchitectureSynthesisProvider` capability boundary.

LM Studio transport details, endpoint configuration, model identifiers, authentication, load state and runtime metadata remain adapter/application state.

### Local AI is the preferred default for sMap

Initial sMap synthesis should be usable without a paid API.

Dope should prefer a local synthesis connection when one is available. Cloud providers remain optional future alternatives behind the same provider-independent contract.

Correction c4 does not need to implement multiple production providers merely to prove provider independence. The first complete path uses LM Studio plus Qwen3-Coder-30B-A3B-Instruct; fake/test providers and provider-neutral contracts must prevent the domain from depending on that implementation.

### Connection setup

When Analyze Project requires synthesis and no suitable synthesis connection is configured, Dope should keep the user inside the sMap flow rather than redirecting them into a separate setup journey.

For the reference path Dope should:
1. probe for a reachable local LM Studio-compatible endpoint using application defaults and/or configured endpoints;
2. discover available models through the runtime API where supported;
3. allow the developer to select Qwen3-Coder-30B-A3B-Instruct or another explicitly chosen compatible model;
4. support manual endpoint configuration when auto-detection does not succeed;
5. support optional authentication without requiring an API key for an ordinary unauthenticated local server;
6. save the connection/model choice as user/application state, not canonical project state;
7. continue directly into the pending Analyze Project flow once readiness is established.

The common local LM Studio endpoint may be probed as a convenience, but no host/port is a Software Map domain invariant.

### Structured-output capability probe

Before treating a selected connection/model as architecture-synthesis capable, Dope must perform a small synthetic structured-output probe.

The probe verifies the actual chain of:
- endpoint connectivity;
- selected model availability;
- schema-constrained structured output;
- response parsing/validation.

The probe must not use project evidence.

Successful probing establishes that the configured model can satisfy the minimum structured-output capability expected by the ArchitectureSynthesisProvider.

### Warm-up before real synthesis

Provider/runtime readiness is established immediately before the first real architecture-synthesis request that may submit project evidence.

Dope must warm the selected model before sending the actual ArchitectureEvidencePacket.

Warm-up:
- uses a tiny synthetic request and schema such as a boolean/readiness response;
- contains no repository or project evidence;
- exists to absorb model load/cold-inference work before the real sMap request;
- belongs to the provider/runtime orchestration layer rather than the Software Map domain;
- must succeed before the real ArchitectureEvidencePacket is submitted.

A prior capability probe may incidentally warm the model, but Dope must not assume that probe means the model remains warm indefinitely. If the runtime/model is known to have remained active, bounded follow-up synthesis/refinement calls do not require redundant warm-ups.

Readiness should be considered cold again when the runtime is restarted/reconnected, the selected model changes, or Dope otherwise has reason to believe the model has been unloaded.

Correction c4 does not need sophisticated residency telemetry. A bounded per-connection/model warm-state is sufficient.

### Warm-up failure is a hard pre-synthesis gate

If warm-up fails:
- Dope does not submit the ArchitectureEvidencePacket;
- no ArchitectureProposal is accepted;
- no canonical architecture is established;
- the UI exposes a visible recovery path such as retry, choose model, connection settings or cancel.

This preserves the invariant that project evidence is only submitted after the selected provider/runtime is demonstrably ready.

### User versus project state

AI/runtime configuration is user/application state by default.

The repository must not require or canonically persist LM Studio, Qwen, endpoint URLs, local model filenames, quantization, GPU-offload settings or similar provider/runtime choices in order to define the project's Software Map.

Different developers may use different synthesis providers/models against the same project and still produce the same Dope-owned ArchitectureProposal contract.

### Runtime details deliberately not canonicalized

The reference decision does not lock:
- GGUF quantization;
- model file name;
- context-window/load parameters;
- GPU/CPU offload settings;
- sampling implementation details;
- local acceleration backend.

Those are runtime/configuration choices and may vary by machine.

### Reference context configuration and request budgeting

The current local Qwen development/qualification setup uses a **65,536-token loaded context**.

That value is runtime headroom, not a Software Map contract and not a preferred prompt size. Provider/model adapters expose the usable context/input capability to synthesis orchestration. Individual architecture-analysis calls reserve room for instructions, structured output and safety/provider overhead and should normally use substantially less than the full available window.

ADR 0012 replaces the forward one-shot synthesis expectation with hierarchy-first bounded calls over deterministic evidence views. Repository growth may increase total evidence and call count, but it must not force individual requests to grow without bound.

> Available context is headroom, not a target.

## Relationship to ADR 0006

ADR 0011 does not supersede ADR 0006.

The two decisions govern different milestones:
- correction `c4-architecture-discovery`: LM Studio + Qwen3-Coder-30B-A3B-Instruct is the first reference implementation for the narrow sMap architecture-synthesis capability;
- Product Phase 6 — AI Presence: OpenAI/Codex remains the approved first reference implementation for general AI Presence unless that decision is separately revisited.

Provider independence from ADR 0004 remains mandatory in both cases.

## Correction c4 qualification

The correction must qualify the real reference path on the Dope repository:

`Dope evidence -> LM Studio -> Qwen3-Coder-30B-A3B-Instruct -> strict ArchitectureProposal JSON -> Dope validation -> developer review`

Qualification must separately prove:
- local connection/model discovery or explicit configuration;
- structured-output capability probe without project evidence;
- model warm-up immediately before the first real synthesis request;
- no ArchitectureEvidencePacket submission when warm-up fails;
- valid proposal schema and evidence-reference validation;
- the real Dope ArchitectureEvidencePacket can complete synthesis through the reference path;
- provider/runtime configuration is not canonical project state.

## Consequences

- The core sMap initialization path can be exercised locally without a paid API.
- c4 gets one concrete, inexpensive reference implementation without making LM Studio or Qwen part of canonical architecture.
- The first real sMap synthesis request does not double as a cold model-load request.
- Project evidence is not sent merely to probe or warm the model.
- Hosted providers remain optional and can be added later through the same Dope-owned contracts.


## ADR 0012 forward amendment

The current `c4-smap-synth` stack may finish against its authored prompt sequence. After it closes, `c4-smap-hierarchical-synthesis` becomes mandatory before the storage correction and Phase 5.

The reference LM Studio/Qwen path remains valid, but qualification shifts from proving one large real request can complete to proving a bounded hierarchy-first sequence can produce materially credible System boundaries, visible user progress, source-backed final output and an end-to-end initial-analysis result within the eight-minute performance objective.
