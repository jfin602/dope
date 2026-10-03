# ADR 0022 — sMap synthesis strategy / Model Runtime seam

Status: Accepted
Date: 2026-10-02
Amends: ADR 0013
Complements: ADR 0004, ADR 0006, ADR 0010, ADR 0011, ADR 0012

## Context

The pre-Phase-7 Software Map synthesis implementation already has a useful provider-independent core: deterministic ArchitectureEvidencePacket authority, Dope-owned hierarchy-stage contracts, strict result validation, reconciliation, checkpointing, progress, telemetry and final ArchitectureProposal acceptance semantics.

The remaining boundary is not clean enough for Phase 7 and Local synthesis to evolve independently.

Today the concrete LM Studio adapter owns shared architecture-synthesis instructions, Gemini imports those instructions from the LM Studio adapter, and SoftwareMapBackend carries concrete Local/Gemini lifecycle branches for discovery, selection, probing, readiness, warm-up and error handling. This makes transport/runtime adapters accidental owners of sMap strategy and places provider-session concerns inside the Software Map backend.

Product Phase 7 separately introduces the general provider-independent Model Runtime. Local sMap synthesis also needs room to use a strategy appropriate to smaller local models without forcing the hosted/large-model path through identical prompt packing, call topology or decomposition.

A small seam correction is therefore required before those two lines of work intentionally diverge.

## Decision

### Three layers are distinct

Dope separates:

1. **Software Map domain and authority**
   - deterministic ArchitectureEvidencePacket and provenance;
   - System / Subsystem / Component semantics;
   - ArchitectureProposal and strict validation;
   - reconciliation, review and explicit developer acceptance;
   - canonical architecture authority.

2. **sMap synthesis strategy**
   - architecture-analysis instructions;
   - hierarchy-stage choreography;
   - evidence/view selection;
   - synthesis context budgeting and packing;
   - local-versus-hosted strategy choices;
   - transformation of validated model results into the shared Dope-owned synthesis protocol.

3. **Model Runtime / provider execution**
   - model discovery and selection;
   - capability discovery;
   - structured generation;
   - probe/readiness and optional warm-up;
   - cancellation;
   - normalized provider/runtime failure and usage metadata;
   - provider authentication and transport.

Provider adapters do not own Software Map architecture-analysis instructions or canonical architecture semantics.

### Shared semantics do not require identical synthesis strategy

Local and hosted synthesis continue to share:
- the same deterministic evidence authority;
- the same System / Subsystem / Component ontology;
- the same provenance/evidence requirements;
- the same final ArchitectureProposal contract;
- the same strict validation;
- the same developer review and explicit acceptance authority.

They are **not** required to share:
- identical prompts;
- identical context packing;
- identical stage count;
- identical call topology;
- identical chunking/compression;
- identical model-specific reasoning strategy.

A provider- or model-class-specific synthesis strategy is allowed when it remains behind the sMap synthesis boundary and produces the same validated Dope-owned semantic contracts. Different strategy must not weaken evidence requirements, silently change architectural meaning or create provider-specific canonical state.

This supersedes ADR 0013's forward rule that Local-specific optimization must wait for an identical-pipeline Local/Gemini comparison. The historical comparison evidence and Not Qualified dispositions remain unchanged.

### Minimal Model Runtime seam may be established before Phase 7

Correction `c6-branch-seam` may extract only the minimal provider/runtime capability needed by the already-existing sMap synthesis path before general AI Presence begins.

This correction may define provider-neutral runtime/session contracts for:
- discover/select model;
- capabilities;
- probe/readiness;
- optional warm-up;
- structured generation;
- normalized usage and errors.

It must not implement Phase 7 Ask / Explain / Trace / Find Related, Agent Mind, chat/session product state, tool calling, mutation authority, ProposedAction or delegation.

Phase 7 may extend the same Model Runtime later instead of rebuilding it.

### SoftwareMapBackend does not own concrete provider lifecycles

Ordinary sMap orchestration should depend on provider-neutral synthesis/runtime capabilities.

Concrete LM Studio, Gemini, OpenAI or future provider classes stay in infrastructure/adapters. Provider-name conditionals must not spread through Software Map domain/orchestration code. Provider-specific UI/setup adapters may remain where disclosure, credential entry or endpoint configuration genuinely differs.

Warm-up is a runtime capability, not a Local-only synthesis special case. A runtime that does not need an explicit warm-up may report that capability as absent/no-op; the sMap contract still requires project evidence not to be sent before the selected runtime is ready.

### Setup remains lazy and provider-scoped

Supporting Local synthesis must not complicate hosted synthesis setup.

The Analyze Project flow configures only the provider the developer explicitly selects. Hosted setup must not require understanding LM Studio endpoint/context/quantization details. Local setup must not require cloud credentials.

General Phase 7 provider configuration must not implicitly authorize sMap evidence transfer through that provider. Software Map provider selection remains explicit, and provider failure never silently falls back to another provider.

### Parallel development after the seam

After `c6-branch-seam` establishes the shared boundary, Phase 7 AI Presence and Local sMap synthesis may proceed on separate branches/worktrees from the same seam baseline.

The Local synthesis branch may optimize Qwen/LM Studio strategy, context reduction, evidence prioritization, staged decomposition, tokenizer budgeting and local performance/quality without changing hosted strategy or canonical Software Map contracts.

When merged later, Local work rebases onto the current Phase 7 line and qualifies against the current shared Model Runtime and Software Map contracts. A side branch does not create an independent product qualification or version claim.

## Correction gate — `c6-branch-seam`

This is a bounded pre-Phase-7 architecture correction at unchanged package version `0.6.7`.

It does **not**:
- relabel Product Phase 6 P7 Green;
- unblock or execute P8;
- close Product Phase 6;
- activate Product Phase 7;
- change Flow behavior;
- optimize Local synthesis quality/performance yet.

Required implementation scope:
- move shared sMap synthesis instructions out of the LM Studio adapter into a provider-neutral synthesis-strategy owner;
- establish the minimal reusable Model Runtime/provider-session capability needed by existing synthesis;
- route Local and Gemini execution through that boundary;
- remove ordinary synthesis-orchestration dependence on concrete Local/Gemini lifecycle branches where the new capability covers them;
- express warm-up/readiness and normalized provider failure/usage through the shared boundary;
- preserve explicit provider selection, secrets boundaries, no-silent-fallback behavior, stage contracts, telemetry, checkpoints and final validation/acceptance semantics;
- add focused permanent regression coverage for the separation.

The correction is suitable for one architecture-sensitive GPT-6 Sol High implementation prompt with focused/T2 validation. It should not perform full provider benchmarking, browser dogfooding, packaging or Phase 6 qualification.

## Consequences

- Phase 7 can build a general Model Runtime without inheriting sMap-specific prompt semantics.
- Local sMap synthesis can evolve a smaller-model strategy without contaminating hosted synthesis.
- Existing Software Map evidence and acceptance authority remain unchanged.
- Provider transport/runtime code stops being the accidental owner of architecture-analysis instructions.
- LM Studio remains a first-class Local adapter rather than a special semantic path.
- The correction creates a deliberate branch point for parallel Phase 7 and Local synthesis work without manufacturing Phase 6 qualification.
