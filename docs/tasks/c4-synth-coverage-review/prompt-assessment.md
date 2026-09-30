# Correction 4 Prompt Assessment — sMap Synthesis Coverage + Iterative Review

Status: **APPROVED / READY**
Correction folder: `c4-synth-coverage-review`
Required unchanged version: `0.4.6`
Activation source: `4a887ecebc546f9944adf54890143827623e008c`
Authority: ADR 0014 as amended 2026-09-30

## Conclusion

Use seven ordered prompts.

1. **P1 — reliability/telemetry.** Fix evidence retention first. The current orchestrator already measures planning and stage calls, but the backend discards `HierarchicalAnalysis.timings` when review opens and provider failures before a valid execution object can lose usage/detail. `MAX_STAGE_RETRIES` is zero. Gemini currently collapses TypeError into a safe but non-diagnostic transport/type error.
2. **P2 — coverage/recovery.** Improve deterministic responsibility-cue ranking and add a real Subsystem Challenge recovery path. The existing keep/merge/split/reject mapping cannot create a missing responsibility unless it can be expressed as a transformation of an existing candidate.
3. **P3 — descent diagnostics.** A Component result is currently only an array, so an empty result is semantically indistinguishable from a successful leaf, insufficient evidence or misplaced responsibility.
4. **P4 — Search Deeper.** Add a review-scoped targeted mini-pipeline and preview/apply/reject branch contract. The current browser controller owns manual draft edits locally, so targeted review must explicitly consume the current draft rather than the original backend draft.
5. **P5 — browser review qualification.** Directly prove valid acceptance, merge/split-equivalent editing, Search Deeper accept/reject, unrelated-branch preservation, source navigation and project switching.
6. **P6 — multi-repository architecture qualification.** Evaluate Adaptive SEO, Dope and a smaller structurally clear repository/fixture on one shared selected/probed Gemini model. Concentrate full aggregate/restart/package/native validation here.
7. **P7 — evidence-only closeout.** Audit P5/P6 evidence without live reruns.

## Current implementation findings

### Telemetry

`packages/software-map/src/reconciliation.ts` already records `SynthesisTiming[]` for planning, calls and assembly, but `SoftwareMapBackend.startInitialization()` currently destructures only `{ proposal }`. Progress events are transient UI state. The last P4 verification call therefore disappeared from retained review evidence.

### Retry

`GeminiSynthesisProvider.runStage()` performs one SDK call and sanitizes failure. The shared orchestrator currently sets `MAX_STAGE_RETRIES = 0`. The correction needs a safe typed retryability contract rather than blind retry or provider fallback.

### Responsibility signals

`deriveResponsibilitySignals()` ranks recurring normalized words mainly by cross-area count and caps at 12. P4 showed generic words such as error/kind/message/routes can consume slots while stronger domain responsibilities remain weak or absent.

### Subsystem Challenge

Stage version 3 has strict keep/merge/split/reject mapping for every discovery candidate. That is good for transformation integrity but has no first-class recovery output for an important responsibility omitted by discovery.

### Component descent

`ComponentDiscoveryResult` contains only `components`. A zero-length array carries no reason.

### Review

`SoftwareMapReviewWidget` already provides the center hierarchy and selected-node detail. `SoftwareMapController` owns the current editable draft and has project/request supersession guards. Search Deeper should extend this one review authority rather than create another controller or canonical path.

## Prompt boundaries

P1 is T2 because it crosses shared orchestration, provider failure typing and backend/service retention.

P2 is T1: compact contracts/planner/challenge fixtures only.

P3 is T2 because stage schema, orchestration, reconciliation and review diagnostics move together.

P4 is T2: backend/service/controller/review widget targeted-flow integration.

P5/P6 are explicit T3 qualification gates; only P6 owns consolidated full aggregate/restart/package/native validation.

## Risks

- overfitting coverage cues to Adaptive SEO words;
- turning deterministic coverage metadata into architecture authority;
- recovery call explosion or fixed boundary counts;
- retry hiding invalid schema/architecture output;
- Search Deeper mutating unrelated branches;
- manually edited nodes losing source context;
- stale branch proposal application;
- multi-repository qualification reading architecture references before freeze;
- duplicating expensive P5/P6 evidence unnecessarily.

## Qualification decision

The seven-prompt stack is the smallest safe boundary that separates reliability, synthesis semantics, review mutation authority and expensive qualification.
