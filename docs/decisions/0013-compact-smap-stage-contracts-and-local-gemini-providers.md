# ADR 0013 — Compact sMap stage contracts and explicit Local/Gemini synthesis providers

Status: Accepted
Date: 2026-09-29
Amends: ADR 0011, ADR 0012
Complements: ADR 0004, ADR 0009, ADR 0010

## Context

ADR 0012 replaced one-shot sMap synthesis with bounded hierarchy-first stages and provider-independent progress. The implemented stage APIs already request schema-constrained JSON, but the intermediate JSON still transports substantial model-authored prose such as boundary rationale, sibling distinction, free-form uncertainty and reconciliation messages.

That prose is not required by the next synthesis phase. Carrying it forward increases output generation, future input size and provider-dependent wording variance while making Local-versus-cloud comparisons harder to interpret.

At the same time, the local LM Studio/Qwen path is useful but has unresolved quality/performance questions. Gemini 3.8 Flash offers a materially different cloud model/runtime and larger context headroom through the Gemini Developer API. Adding it can provide both a useful user option and a controlled comparison, but only if both providers execute the same Dope-owned synthesis design.

Provider comparison must happen before Dope introduces aggressive Local-specific chunking, compression or divergent stage semantics. Otherwise the experiment cannot distinguish shared synthesis-design cost from local model/runtime cost.

## Decision

### Intermediate synthesis is compact structured state, not prose

Every model-facing hierarchy stage uses a strict Dope-owned JSON request/result contract.

The intermediate contract contains only state needed by downstream stages. Depending on the stage, that may include:
- schema/stage/view/parent-packet identity;
- temporary candidate IDs;
- System / Subsystem / Component kind, short name and parent;
- short bounded responsibility text where semantic identity is required;
- source-backed `evidenceRefs` and direct `ownershipEvidenceRefs`;
- numeric confidence;
- typed ambiguity/unresolved codes;
- typed candidate relationships with evidence refs;
- challenge keep/merge/split/reject mappings;
- unresolved candidate/item sets and verification disposition.

The cross-stage provider protocol does not carry model essays. Remove or replace prose-heavy intermediate fields such as:
- `boundaryRationale`;
- free-form `rationale`;
- `siblingDistinction`;
- arbitrary uncertainty strings;
- subdivision rationale paragraphs;
- reconciliation/verification message prose.

Strict schemas reject surplus fields.

Short names/responsibilities remain bounded semantic labels, not hidden reasoning.

### Human-readable review is assembled outside the provider data bus

The developer still receives an understandable review.

Typed ambiguity/finding codes plus evidence refs can be translated deterministically into concise review text. Final ArchitectureProposal/presentation may include human-readable explanation, but provider-to-provider stages do not transport explanation prose merely so later stages can continue.

Do not add another model call just to narrate compact intermediate state.

The complete ArchitectureEvidencePacket remains the evidence authority. Human-readable text never substitutes for evidence refs.

### Local and Gemini share one provider-independent contract

Local LM Studio and Gemini implement the same `SynthesisProvider` semantics, stage requests, stage result schemas, validation, evidence planning, reconciliation limits and canonical acceptance rules.

No Gemini-native SDK/domain type enters `@dope/software-map`.

No LM Studio-specific type enters the canonical Software Map contract.

Provider adapters translate transport/authentication/structured-output/token-usage details only.

### Gemini reference cloud adapter

Add Gemini 3.8 Flash through the Gemini Developer API using AI Studio API keys.

Gemini setup supports:
- backend `GEMINI_API_KEY`; or
- an explicitly entered session key held in process/runtime memory.

Secrets are never canonical or project state. API keys must not be stored in:
- `.dope/`;
- canonical architecture;
- evidence packets/proposals;
- StorageService or ordinary synthesis preferences;
- logs;
- progress events;
- cache/work identities;
- raw user-facing error text.

Persistent secure-key storage is out of scope unless separately designed around OS-backed secret storage.

### Provider choice is explicit

The Analyze Project setup exposes independently collapsible **Local model** and **Gemini 3.8 Flash** sections.

Selecting Gemini explicitly communicates that bounded repository evidence used for synthesis is sent to Google's Gemini API.

Selecting Local communicates that requests use the configured local endpoint.

A provider failure stops that run. Dope never silently falls back Local -> Gemini or Gemini -> Local.

### Comparable provider telemetry

The provider-independent orchestration records comparable measurements for every model stage:
- stage and optional subject;
- selected provider and model label;
- wall-clock call duration;
- request bytes and output bytes;
- input, output and total tokens when available;
- token measurement source/quality: provider-reported, tokenizer, estimated or unavailable;
- cache reuse;
- retry/error state.

Timing is measured by Dope orchestration rather than accepted as provider authority.

Adapters may expose token usage metadata. Gemini usage may be provider/tokenizer-backed. Local OpenAI-compatible usage should be used when supplied; otherwise existing conservative estimation may be recorded as estimated.

Do not claim estimated Local usage is exact.

### Same-pipeline comparison precedes Local-specific optimization

Before adding aggressive Local-specific chunking/compression heuristics, run Local and Gemini against the same corrected pipeline:
- same repository commit;
- same deterministic evidence input and planner/version;
- same stage order;
- same compact intermediate contracts;
- same evidence-selection rules;
- same validation;
- same reconciliation/verification bounds;
- same developer acceptance semantics.

The comparison records architecture quality and resource/timing behavior.

Interpretation:
- similar architecture with much slower Local calls primarily indicates local model/runtime cost;
- materially better Gemini architecture from equivalent inputs primarily indicates model capability difference;
- both providers remaining slow or oversized points back toward shared synthesis/evidence design;
- both improving materially after compact contracts indicates the previous prose-heavy protocol itself was a bottleneck.

These categories guide later optimization; they do not weaken architecture-quality gates.

### Testing is concentrated deliberately

Implementation prompts use focused permanent tests and minimum build/typecheck feedback.

Full repository checks, restart matrices, Electron packaging/native-launch evidence, browser dogfooding and live end-to-end provider comparisons are intentionally concentrated in the final qualification prompt unless a focused failure demonstrates a broader regression.

This is a time-efficiency rule, not permission to skip final qualification.

## Correction and sequencing

After the current `c4-smap-hierarchical-synthesis` stack closes truthfully, run mandatory `c4-smap-gemini-provider` at unchanged package version `0.4.6`.

This correction is required even when the current local-Qwen hierarchy stack closes Not Green, because it is the approved remediation/diagnostic path for shared protocol and provider/runtime uncertainty.

ADR 0012's earlier rule that `c4-smap-storage` may run only after hierarchical synthesis closes Green is amended.

New order:

`c4-smap-hierarchical-synthesis`
-> `c4-smap-gemini-provider`
-> `c4-smap-storage`
-> Product Phase 5

`c4-smap-storage` remains blocked until `c4-smap-gemini-provider` closes Green.

## Consequences

- Intermediate model output becomes smaller, stricter and easier to validate/cache.
- Human review remains understandable without carrying model prose between phases.
- Gemini becomes a real provider option without changing Software Map authority.
- Local remains first-class and is not silently replaced.
- Provider comparison becomes meaningful because architecture semantics stay constant.
- Per-stage token/time evidence can distinguish design, model and runtime bottlenecks.
- Local-specific optimization is deferred until the comparison identifies what actually needs optimization.
