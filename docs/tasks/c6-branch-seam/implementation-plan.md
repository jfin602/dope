# c6-branch-seam — Implementation plan

Status: APPROVED
Activation authority commit: `47fbcdeaa5e91906363f4ed95019d55ee95efa80`
Version: unchanged `0.6.7`
Validation: T2

## 1. Generic Model Runtime contract

Add a minimal provider-independent contract under `packages/contracts/src/model-runtime.ts`.

The contract should be sufficient for the existing sMap use case and extensible by Phase 7 without importing Software Map concepts. Expected concepts:
- provider/runtime identity;
- discovered/selected model;
- readiness/probe state;
- generic capabilities including context/input capacity and token-estimate quality;
- conservative token estimation;
- optional warm-up before sensitive/real work;
- structured JSON generation from system instruction + user/input + JSON schema/name;
- normalized structured execution usage;
- normalized safe failure class;
- provider-neutral retry policy/capability.

Do not put ArchitectureEvidencePacket, SynthesisStage, System/Subsystem/Component or other sMap semantics in this contract.

## 2. Provider-neutral sMap synthesis strategy

Create a Software Map module such as `packages/software-map/src/synthesis-strategy.ts`.

Move the current shared instruction constants and stage->instruction/schema/name selection out of LM Studio infrastructure.

The strategy owns:
- compact shared architecture-analysis rules;
- System Discovery / Challenge;
- Subsystem Discovery / Challenge;
- Component Discovery;
- reconciliation / verification;
- targeted refinement;
- stage schema/name selection.

The provider/runtime adapter must receive these as data. Gemini must not import any LM Studio module.

Do not optimize Local prompts yet and do not fork Local/hosted strategy in this correction; only create the seam that permits that later.

## 3. Runtime-backed sMap provider adapter

Add a generic adapter in the Theia node/infrastructure layer (or another existing provider-neutral application adapter location if source inspection identifies a better inward dependency direction).

It combines:
- one `ModelRuntimeSession`;
- one current sMap provenance kind (`local` / `gemini`) required by retained synthesis persistence;
- the provider-neutral sMap strategy.

It presents the existing `SynthesisProvider` behavior to `@dope/software-map` orchestration:
- `capabilities()`;
- `estimateTokens()`;
- `runStage()`;
- `runRefinement()`;
- generic pre-evidence readiness/warm-up hook;
- provider-neutral retry decision.

Translate Model Runtime failures into the existing safe synthesis failure boundary without leaking credentials/raw provider responses.

Keep current synthesis reserve/budget semantics stable unless a source-backed bug requires a minimal correction.

## 4. Concrete runtime adapters

Refactor LM Studio and Gemini infrastructure so they own only runtime/provider concerns.

LM Studio retains:
- endpoint normalization;
- model discovery/selection;
- context capacity configuration;
- probe/readiness/warm state;
- OpenAI-compatible structured generation transport;
- usage normalization;
- safe errors;
- Local retry policy (currently no automatic stage retry unless explicitly preserved by existing behavior).

Gemini retains:
- API key/SDK/model discovery;
- Gemini schema projection;
- model metadata/capacity;
- structured generation transport;
- usage normalization;
- safe errors;
- existing bounded retry semantics expressed generically rather than by `provider.kind === 'gemini'`.

Neither adapter owns System/Subsystem/Component instructions.

Prefer coherent renaming to `*-model-runtime.ts` when it reduces semantic confusion; do not add compatibility wrappers solely to preserve an internal pre-stability filename/class name. Update focused tests/imports with the implementation.

## 5. Orchestration/backend cleanup

In `SoftwareMapBackend`:
- keep explicit Local/Gemini setup branches where endpoint/credential construction genuinely differs;
- after construction, store/use one active generic runtime/session and one runtime-backed `SynthesisProvider`;
- make refresh/select/probe/ready generic;
- remove `localProvider` / `geminiProvider` lifecycle branching where the generic session covers it;
- do not infer provider choice or silently fall back.

In `HierarchicalSynthesisOrchestrator`:
- replace the backend-only Local warm-up callback with a provider-neutral pre-evidence hook on the current synthesis provider (or equivalent clean generic contract).

In `SynthesisStageCache`:
- remove the hard-coded Gemini retry name check;
- use the provider/runtime retry policy with the existing bounded attempt limits/behavior preserved.

In backend error handling:
- use normalized safe failures generically;
- retain validation/sMap-domain error specificity;
- never expose credentials/raw provider payloads.

## 6. Regression coverage

Update focused tests and add a cheap permanent seam guard.

Prove behaviorally:
- Local and Gemini both run a representative hierarchy stage through the same provider-neutral sMap strategy;
- targeted refinement uses the same ownership boundary;
- readiness/warm-up happens before first real Local project-evidence generation and does not become a Local special case in the orchestrator;
- Gemini retries transient/upstream and bounded invalid-JSON failures according to generic policy; Local behavior remains unchanged;
- model refresh/select/probe/readiness use the active runtime generically;
- failures remain sanitized;
- no silent provider fallback;
- current telemetry/provenance remains correct.

Architecture guard:
- Gemini runtime source must not import LM Studio runtime source;
- concrete runtime sources must not own the sMap instruction constants;
- ordinary orchestration/backend lifecycle code must not branch on `provider.kind === 'gemini'` or `provider.kind === 'local'` where the generic seam now applies.

Do not write brittle filename-wide guards that reject legitimate provider-specific setup/credential code.

## 7. T2 validation

Run only the affected surface:
- `corepack yarn workspace @dope/contracts build`;
- `corepack yarn workspace @dope/software-map build`;
- `corepack yarn workspace @dope/theia-extension build`;
- focused Node tests for software-map synthesis/reconciliation, LM Studio runtime/provider, Gemini runtime/provider and software-map initialization;
- any newly added seam-contract test;
- exact `0.6.7` workspace/internal dependency coherence;
- Theia `1.75.0`, Electron `42.8.1`, no root package-lock;
- `git diff --check`.

Do not run `npm run check`, restart tests, browser qualification or packaging unless focused evidence exposes a cross-cutting compile/runtime regression requiring escalation. If escalation is required, state why.
