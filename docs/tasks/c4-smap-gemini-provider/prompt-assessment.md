# Correction 4 Prompt Assessment — Gemini Provider + Compact Shared sMap Pipeline

Status: **APPROVED / READY**
Correction folder: `c4-smap-gemini-provider`
Required unchanged package version: `0.4.6`
Predecessor: `c4-smap-hierarchical-synthesis` after truthful closeout
Authority: ADR 0013; ADR 0004 and ADR 0009-0012 where not amended; current BOOT/AGENTS/ARCHITECTURE/PRODUCT-MODEL/project-overview/roadmap/software-map-storage
Reference providers: Local LM Studio/Qwen and Gemini 3.8 Flash through the Gemini Developer API / AI Studio API key path

## Conclusion

Use five ordered prompts at unchanged `0.4.6`:

1. compact provider-independent hierarchical intermediate contracts and deterministic review assembly;
2. Gemini provider plus provider-independent stage token/size/timing telemetry;
3. provider-neutral backend selection, secret handling and independently collapsible Local/Gemini setup/progress UI;
4. direct real Local-vs-Gemini same-pipeline qualification plus the consolidated expensive regression/package pass;
5. evidence-only correction closeout.

P1-P3 deliberately use focused permanent tests and minimum compile/typecheck feedback. Full repository checks, restart matrices, Electron packaging/native launch, broad browser dogfooding and live provider runs are concentrated in P4 unless focused evidence proves an earlier cross-cutting regression.

## Current source findings

### The staged contract is provider-independent but its payload is still prose-heavy

`packages/software-map/src/hierarchical-synthesis.ts` already owns:
- `SynthesisProvider`;
- provider capability/input budgets;
- deterministic evidence views;
- stage request/result schemas;
- System Discovery / Challenge / per-System / reconciliation / verification contracts;
- strict result parsing;
- final proposal assembly;
- provider-independent progress events.

This is the correct ownership boundary and should be preserved.

However the intermediate result contracts still require model-authored prose:
- `SystemCandidate.boundaryRationale`;
- `SystemCandidate.uncertainty: string[]`;
- `SubtreeCandidate.rationale`;
- `SubtreeCandidate.siblingDistinction`;
- subtree free-form uncertainty;
- `ChallengeDecision.rationale`;
- `SynthesisFinding.message`;
- `subdivisionAssessment.rationale`.

Those fields are then serialized into later request context and therefore become model-to-model baggage. The next pipeline should carry typed structural state/evidence, not essays.

### Final review currently depends on intermediate prose

`assembleArchitectureProposal()` maps intermediate `boundaryRationale` / `rationale` into final proposal rationale and maps reconciliation/verification messages into open questions.

P1 therefore cannot merely delete fields. It must replace them with typed ambiguity/finding codes and deterministic human-facing explanation assembly so the review remains understandable while the provider protocol becomes compact.

The canonical `ArchitectureProposal` itself does not need to become provider-specific. Developer correction/acceptance and evidence refs remain authoritative.

### The Local adapter already requests strict JSON but its instructions invite explanation

`packages/theia-extension/src/node/lmstudio-synthesis-provider.ts` calls the OpenAI-compatible structured-output surface with `json_schema` and `strict: true`, then parses JSON and hands it back to Dope validation.

The stage instructions explicitly ask for boundary rationale, sibling distinction, uncertainty explanations and reconciliation messages. P1 must change the shared schema/instruction expectations together so Local is tested against the same compact protocol Gemini will later use.

The adapter still contains a legacy one-shot `synthesize(packet)` method in addition to `runStage()`. Current backend hierarchical initialization uses `HierarchicalSynthesisOrchestrator` and `runStage()`; no production caller was identified in the inspected current path. P1 should verify repository callers before removing/quarantining the obsolete path rather than preserving two synthesis protocols indefinitely.

### Telemetry exists but is insufficient for provider comparison

`packages/software-map/src/reconciliation.ts` records `SynthesisTiming` with:
- operation;
- stage;
- subject;
- duration;
- cache reuse.

Progress events include provider model label and measured elapsed time.

Missing comparison evidence:
- provider kind;
- request/output bytes;
- input/output/total token usage;
- token measurement source/quality;
- provider usage vs conservative estimate;
- per-call normalized execution metadata.

P2 should make this data provider-independent. Orchestration owns wall-clock timing. Provider adapters report usage metadata where available.

### Local service/backend configuration leaks adapter shape

`SoftwareMapService` currently exposes:
- `configureSynthesis(... endpoint/token/contextWindowTokens)`;
- `selectSynthesisModel()`;
- `probeSynthesis()`;
- `synthesisReady()`.

`SoftwareMapBackend` holds both a generic `provider?: SynthesisProvider` and a specific `localProvider?: LmStudioSynthesisProvider`.

This is adequate for the first Local bootstrap but not for two explicit providers. P3 should introduce a small provider-neutral configuration/selection contract while keeping Local-specific details behind the Local branch/adapter and Gemini key state behind the Gemini branch/adapter.

Do not build a generalized Phase 6 Model Runtime in this correction.

### Frontend state and UX are Local-only today

`SoftwareMapController` currently owns:
- endpoint;
- local model ID/list;
- optional token;
- configured context;
- Local discover/probe readiness;
- one synthesis preference record for endpoint/model.

`SoftwareMapWidget.renderSetup()` renders one Local synthesis form. The onboarding copy says "Choose local synthesis" and the action is "Set up local synthesis."

P3 must replace that single form with independently collapsible Local and Gemini sections while preserving:
- existing/manual architecture routes;
- no-write decline/cancel;
- project/root stale-result guards;
- setup/request generation guards;
- explicit developer initiation.

Gemini key input must be password-style/session-only and must not enter StorageService or project state.

### Dependency/test aggregation needs explicit maintenance

`@dope/theia-extension` currently has no Google SDK dependency. P2 should add the current `@google/genai` dependency through Yarn and update `yarn.lock` without creating a root `package-lock.json`.

The root `test:product` script enumerates test files explicitly. Any new Gemini/provider-selection test file must be added to that aggregate or the final suite will silently omit it.

### Gemini structured output is compatible in principle but provider schema translation is required

Current official Gemini documentation exposes `@google/genai`, Gemini 3.8 Flash, JSON structured output and response token usage. Gemini accepts a subset of JSON Schema rather than every validator keyword used by Dope.

Therefore:
- Dope's full provider-independent stage schema/validator remains authoritative;
- the Gemini adapter may derive a provider-compatible schema projection when Google does not accept a keyword;
- unsupported provider-schema keywords must not be "fixed" by weakening Dope's canonical validation;
- raw Gemini output still passes through the same Dope stage parser as Local output.

Avoid an extra remote `countTokens` call in every planner estimation loop merely to collect telemetry. Use a safe local/conservative budgeting estimator unless a bounded exact-count call is justified; use provider-reported response usage for actual per-stage telemetry when available.

## Prompt decomposition

### P1 — Compact shared protocol

This is first because Gemini should never be implemented against the prose-heavy v1 intermediate payload.

Likely source/tests:
- `packages/software-map/src/hierarchical-synthesis.ts`;
- `packages/software-map/src/reconciliation.ts`;
- `packages/software-map/src/evidence-planner.ts`;
- `packages/software-map/src/system-discovery.ts`;
- `packages/software-map/src/system-challenge.ts`;
- `packages/software-map/src/per-system-discovery.ts`;
- `packages/theia-extension/src/node/lmstudio-synthesis-provider.ts`;
- synthesis/planner/discovery/challenge/per-system/reconciliation/Local-provider tests.

Use a new stage/contract version so stale cached/result identity cannot masquerade as the compact contract.

### P2 — Gemini adapter + telemetry

Add the cloud adapter only after P1 defines the shared format.

Likely source/tests:
- `packages/theia-extension/package.json` + `yarn.lock`;
- new `packages/theia-extension/src/node/gemini-synthesis-provider.ts`;
- `packages/software-map/src/hierarchical-synthesis.ts`;
- `packages/software-map/src/reconciliation.ts`;
- `packages/theia-extension/src/node/lmstudio-synthesis-provider.ts`;
- new Gemini provider tests and expanded Local telemetry tests;
- root `package.json` test aggregation.

Use mocked HTTP/SDK behavior in P2. Do not spend real Gemini quota during implementation.

### P3 — Provider selection + secrets + UI

Likely source/tests:
- `packages/software-map/src/service.ts`;
- `packages/theia-extension/src/node/software-map-backend.ts`;
- `packages/theia-extension/src/browser/software-map-controller.ts`;
- `packages/theia-extension/src/browser/software-map-widget.ts`;
- `packages/theia-extension/src/browser/dope.css`;
- software-map UI/initialization/backend tests;
- provider-selection/security tests.

Use explicit provider kind and separate setup state. Never send repository evidence to Gemini without the user selecting Gemini for that run.

### P4 — Same-pipeline qualification

Use the exact clean Adaptive SEO benchmark path/SHA recorded by predecessor hierarchical P8 evidence. If predecessor P8/closeout did not establish a usable pinned benchmark, treat that as an explicit prerequisite/evidence issue rather than silently choosing a different source.

Run Local and Gemini on the same exact compact pipeline and record:
- hierarchy quality;
- stage/call counts;
- planning/call/total duration;
- request/output bytes;
- input/output/total tokens with measurement quality;
- unresolved items;
- provenance validity.

Do not add aggressive Local-specific optimization inside the comparison.

P4 is also where the full repository/restart/browser/Electron/package checks are paid once.

### P5 — Evidence-only closeout

Do not rerun live Local/Gemini synthesis just to fill evidence holes.

Audit the exact P4 candidate/evidence and route Green to `c4-smap-storage`.

## Main risks

- **Schema weakening:** Gemini's provider schema subset could accidentally become the canonical Dope contract.
- **Prose sneaking back:** free-form strings may return under renamed fields and recreate the same context/output cost.
- **Human-review regression:** deleting rationale without deterministic replacement could make review opaque.
- **False token comparability:** Local estimates and Gemini reported usage are not automatically equivalent measurements.
- **Telemetry overhead:** remote token-count calls can create enough requests/latency to distort the experiment.
- **Secret leakage:** keys can escape through StorageService, errors, logs, cache identities or test snapshots.
- **Implicit cloud fallback:** a Local failure must never cause repository evidence to leave the machine automatically.
- **Provider-shaped RPC:** exposing Google/LM Studio options directly in canonical domain contracts would undermine ADR 0004/0013.
- **Comparison contamination:** provider-specific prompt/chunking fixes between runs would make Local-vs-Gemini evidence uninterpretable.
- **Test-cost creep:** re-running full builds/restart/package/live-provider evidence in P1-P3 defeats the explicit efficiency goal.
- **Phase creep:** no general AI Presence, mixed-provider routing, provider voting, Agent Mind, tools or Phase 5 canvas.

## Qualification decision

The prompt stack is ready to author now but may execute only after `c4-smap-hierarchical-synthesis` closes truthfully.

Success requires:
1. the shared pipeline exchanges strict compact provider-independent intermediate JSON;
2. Local and Gemini execute the same semantics and validation;
3. Gemini works through the explicit AI Studio key path without secret persistence/leakage or fallback;
4. per-stage token/size/timing evidence is comparable with measurement quality disclosed;
5. the same benchmark produces materially reviewable source-backed architecture through both providers;
6. the final exact candidate passes the consolidated regression/restart/browser/package gates at unchanged `0.4.6`.
