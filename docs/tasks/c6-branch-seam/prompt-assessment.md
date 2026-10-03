# c6-branch-seam — Prompt assessment

Status: APPROVED FOR ONE-OFF IMPLEMENTATION
Date: 2026-10-02
Package version: unchanged `0.6.7`
Authority: ADR 0022 plus ADR 0004/0006/0010/0011/0012/0013 as amended.

## Objective

Create the smallest real seam that lets Product Phase 7 Model Runtime work and Local sMap synthesis optimization proceed on separate branches without sharing accidental LM Studio/Gemini implementation ownership.

This is an architecture correction, not a synthesis-quality correction and not Phase 7 activation.

## Source findings

The current implementation already has a strong provider-independent sMap core:
- `@dope/software-map` owns ArchitectureEvidencePacket, hierarchy stage/result contracts, validation, evidence planning, reconciliation, checkpoints, progress, telemetry and final ArchitectureProposal semantics.
- `SynthesisProvider` is the current execution seam consumed by `SynthesisStageCache` and `HierarchicalSynthesisOrchestrator`.

The remaining coupling is concentrated:
- `packages/theia-extension/src/node/lmstudio-synthesis-provider.ts` owns all shared architecture-analysis instructions and Local transport/runtime behavior.
- `gemini-synthesis-provider.ts` imports those instructions from the LM Studio adapter, making Local infrastructure the accidental semantic owner.
- `SoftwareMapBackend` stores concrete `localProvider` / `geminiProvider` instances and branches for model refresh, selection, probe/readiness, warm-up and Gemini-specific error formatting.
- `HierarchicalSynthesisOrchestrator` receives a backend-supplied `beforeFirstCall` callback only for Local warm-up.
- `SynthesisStageCache` hard-codes Gemini retry behavior through `provider.kind === 'gemini'`.
- `SynthesisSetup` and provider-specific credential/setup UI are legitimately provider-specific and should remain explicit.

There is no general Model Runtime package or contract yet.

## Smallest safe boundary

Do not create a new runtime package in this correction. The repository already has `@dope/contracts` as a provider/Theia-independent contract package and every relevant backend already depends on it.

Add a narrow Model Runtime contract there, then:
1. move architecture-analysis instructions/spec selection into a provider-neutral `@dope/software-map` synthesis-strategy module;
2. make LM Studio and Gemini classes runtime/transport adapters implementing the generic contract;
3. add one generic runtime-backed sMap provider adapter that combines a Model Runtime session with sMap strategy and presents the existing `SynthesisProvider` interface to the hierarchy orchestration;
4. make ordinary SoftwareMapBackend lifecycle operations use one active runtime/session rather than concrete-provider branches;
5. replace provider-name retry/warm-up/error branches with provider-neutral capabilities/policies.

Provider-specific setup branches for endpoint/credentials/disclosure remain allowed.

## Preserved contracts

Do not redesign:
- ArchitectureEvidencePacket;
- hierarchy stage request/result schemas;
- ArchitectureProposal;
- evidence/provenance requirements;
- stage checkpoint identity/reuse semantics;
- project-local synthesis work persistence;
- explicit Local/Gemini selection;
- secret handling;
- no silent provider fallback;
- developer review/acceptance;
- current sMap service DTO shape unless a minimal additive field is required.

Do not change Flow.

## Validation tier

**T2 — affected-system integration.**

This crosses contracts -> software-map -> Theia node adapters/backend and therefore needs focused multi-package validation, but not browser/native/package qualification.

Required evidence:
- contract/software-map/theia-extension builds;
- LM Studio provider/runtime tests;
- Gemini provider/runtime tests;
- Software Map synthesis/reconciliation tests that exercise retries/stage execution;
- Software Map initialization/backend lifecycle tests;
- a permanent architecture regression showing Gemini no longer imports LM Studio synthesis semantics and ordinary backend/orchestrator lifecycle logic no longer branches on concrete providers where the new seam applies;
- exact version/dependency coherence and `git diff --check`.

Explicitly defer:
- real LM Studio/Gemini calls;
- Local/Gemini benchmark;
- browser GUI;
- restart matrix;
- AppImage packaging/native launch;
- Phase 6 P7/P8 evidence;
- Phase 7 qualification.

## Execution shape

One GPT-6 Sol High manual one-off is justified: the change is architecture-sensitive but localized, and the existing focused tests are strong enough to prove the boundary without a broad qualification pass.
