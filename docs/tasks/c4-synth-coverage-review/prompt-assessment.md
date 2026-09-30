# Correction 4 Prompt Assessment — sMap Coverage + Iterative Review

Status: **APPROVED / READY**
Correction folder: `c4-synth-coverage-review`
Required unchanged package version: `0.4.6`
Activation source: `4a887ecebc546f9944adf54890143827623e008c`
Planning authority includes docs commit: `10d01373096458e4614bd4e1b2216fe3789997f6`
Predecessor: owner-closed / Not Qualified `c4-synth-improvements`
Authority: ADR 0014 as amended 2026-09-30 plus ADR 0008-0013 where not amended

## Conclusion

Use seven ordered prompts at unchanged `0.4.6`:

1. retain every provider-call attempt and add bounded retry reliability;
2. add root-README orientation, provenance-bearing documentation evidence, coverage weighting and omitted-responsibility recovery;
3. add typed zero-Component descent and coverage diagnostics;
4. add branch-local **Search Deeper** for every System and Subsystem;
5. directly qualify center-review correction/acceptance/navigation/project switching in the browser;
6. run multi-repository live synthesis-quality qualification plus the consolidated expensive regression/package gate;
7. perform evidence-only closeout.

P1-P3 are focused implementation prompts. P4 is a bounded cross-layer integration prompt. P5-P6 are T3 qualification prompts; P7 is evidence-only closeout.

## Why this correction exists

The real `gemini-3.8-flash` Adaptive SEO run from `c4-synth-improvements` reached center review in 302.8 seconds and improved responsibility naming, but the frozen hierarchy still omitted or collapsed material implemented responsibilities. Three of five Subsystems had no Components with no typed explanation.

The same run exposed telemetry loss: twelve provider calls occurred while only eleven records remained visible. The first controlled attempt failed with a sanitized Gemini transport/type error and required manual retry.

Review editing itself improved, but valid acceptance, merge/split-equivalent correction and project-switch isolation were not directly qualified. The developer also needs a bounded way to refine one near-correct branch without discarding the rest of the review.

The owner therefore closed `c4-synth-improvements` Not Qualified after P4; its P5 is unexecuted.

## Current source findings

### Provider telemetry is event-oriented, not a durable attempt ledger

`AnalysisProgressEvent` already carries stage, subject, provider/model, usage, duration, reuse and attempt fields, but UI progress history is not a sufficient invariant for retaining every provider attempt.

P1 should introduce one provider-independent call-attempt record per actual attempt, including failures and retries, with a stable attempt/call identity and consumed-output disposition. Progress events may project from that ledger, but must not be the only record.

Gemini currently sanitizes transport/provider failures. Preserve that boundary. Add a narrow classifier for transient transport/upstream failures eligible for bounded same-request/same-model retry. Schema/content/architecture failures are not retryable merely to obtain a different answer.

### Evidence kinds do not yet represent documentation

`ArchitectureEvidenceItem` currently covers topology/configuration/entrypoint/dependency/semantic/framework only. `isProductionEvidencePath` explicitly excludes docs.

The newly approved authority requires two related but distinct inputs:
- root `README.md` directly in the initial repository-global synthesis context as bounded, labeled project orientation;
- broader eligible repository documentation represented as deterministic provenance-bearing **Documented** claims.

P2 should not make docs physical evidence. Document claims need their own explicit support class/type and must never satisfy direct production-behavior rules by themselves.

Historical task prompts, qualification evidence, closeouts, generated artifacts and independent benchmark architecture references must remain excluded by default.

### Responsibility signals remain too vocabulary-recurrence driven

`deriveResponsibilitySignals` currently derives recurring terms across source areas and caps the result. This is deterministic and safe, but a frequency/topology-shaped signal can still crowd out materially important responsibilities that are localized, expressed through state/worker/provider/public-contract behavior, or use different vocabulary across layers.

P2 should add an inspectable coverage ledger over stronger source-backed cues, not merely increase the signal count.

The planner must prefer meaningful source-backed behavior and explicit framework/state/external-boundary evidence over generic recurrence while remaining repository-generic.

### Subsystem Challenge cannot explicitly recover omitted responsibilities

The current challenge contract is centered on keep/merge/split/reject dispositions of discovered candidates. The next contract needs an explicit bounded recovery path for a substantial source-backed responsibility that was absent from the discovery set.

Recovery must not force a target count or allow arbitrary unsupported invention. Every recovered Subsystem must cite evidence from the exact parent packet/view and appear in coverage accounting.

### Component Discovery has no typed empty-descent result

`ComponentDiscoveryResult` currently returns `components[]`. An empty array does not say whether the parent is intentionally a leaf, evidence is insufficient, responsibility belongs elsewhere, or no stable Component boundary was found.

P3 should introduce a compact typed disposition and propagate it through reconciliation, final review diagnostics and qualification without forcing fake Components.

### Review has one canonical draft but no targeted refinement operation

`SoftwareMapController` already resets review/draft state on project attach and `SoftwareMapReviewWidget` renders one center-editor hierarchy with explicit acceptance.

P4 should build Search Deeper on that existing authority path rather than create a second review store.

Search Deeper must:
- start from the current edited branch;
- gather selected-branch evidence plus relevant uncovered/cross-boundary/document evidence;
- run a bounded targeted synthesis operation;
- produce preview state;
- require explicit Accept/Reject;
- preserve unrelated edits;
- reject stale results when the selected branch changed during analysis.

### Review evidence presentation is currently source-backed only

The center detail panel currently labels evidence as source-backed and resolves packet refs to source. With documentation evidence added, the review should distinguish **Observed**, **Documented** and **Inferred** without turning the UI into another stacked form.

P4/P5 should preserve source navigation for implementation evidence and provide appropriate document-source navigation for documented claims.

## Documentation synthesis contract

Initial repository-global synthesis input is conceptually:

```text
shared synthesis instructions
+ root README.md project orientation (when present and within deterministic budget)
+ deterministic global architecture evidence view
+ responsibility / coverage cues
```

The README is orientation, not proof. If absent, synthesis proceeds. If oversized, deterministic truncation/excerpt policy applies and is visible; do not add an LLM summarization pre-pass.

Broader docs are deterministic evidence claims with provenance and classification/currentness when knowable.

Qualification must include:
- useful README;
- no README;
- stale/conflicting README/docs;
- real implementation absent from docs;
- excluded historical/qualification answer material.

## Prompt decomposition

### P1 — Provider attempt ledger and retry reliability
Likely surfaces:
- `packages/software-map/src/hierarchical-synthesis.ts`;
- synthesis orchestration/cache/progress contracts;
- `packages/theia-extension/src/node/gemini-synthesis-provider.ts`;
- `packages/theia-extension/src/node/software-map-backend.ts`;
- provider/orchestration tests.

Validation: T1.

### P2 — README/docs + coverage planner + recovery
Likely surfaces:
- `packages/software-map/src/synthesis.ts`;
- deterministic evidence collection/orchestration in code-analysis / backend;
- `evidence-planner.ts`;
- `hierarchical-synthesis.ts`;
- Subsystem Challenge contracts/provider instructions;
- planner/subsystem/evidence tests.

Validation: T1 focused; use a narrow integration test only if document collection crosses package boundaries.

### P3 — Component descent diagnostics
Likely surfaces:
- `hierarchical-synthesis.ts`;
- Component Discovery provider instructions/validation;
- `reconciliation.ts`;
- assembly/review diagnostics;
- subsystem/reconciliation/synthesis tests.

Validation: T1.

### P4 — Branch-local Search Deeper
Likely surfaces:
- shared targeted-synthesis contracts;
- `software-map-backend.ts`;
- `software-map-controller.ts`;
- `software-map-review-widget.ts`;
- `dope.css`;
- initialization/UI tests.

Validation: T2 because it crosses domain/backend/frontend review state.

### P5 — Browser review qualification
Directly prove current-draft correction, merge/split-equivalent editing, Search Deeper preview/Accept/Reject, source/document navigation, valid explicit acceptance and root switching.

Validation: T3 browser. Repair only concrete review defects and add focused regressions.

### P6 — Multi-repository architecture qualification
Run controlled real synthesis on:
- pinned Adaptive SEO;
- uncontaminated Dope benchmark root;
- one smaller structurally clear repo/fixture.

Freeze each generated hierarchy before reading independent expected architecture references.

Also execute the consolidated expensive final-candidate regression/restart/package/native gate once.

Validation: T3.

### P7 — Evidence-only closeout
Audit exact P6 candidate/evidence. Do not repair product behavior or rerun live synthesis simply to fill evidence gaps.

Validation: T3 evidence-only.

## Model routing

All seven prompts use **GPT-6 Sol High** because the stack is architecture-sensitive and several prompts modify provider-independent synthesis contracts or review authority behavior.

No XHigh escalation is justified at planning time.

## Main risks

- documentation becomes accidental architecture authority;
- benchmark answer leakage through historical docs;
- README context crowds out deterministic evidence;
- recovery becomes an unconstrained second discovery pass;
- coverage ledger becomes a target-count score;
- automatic retry hides invalid architecture/schema output;
- Search Deeper creates a second/stale review authority;
- branch-local synthesis overwrites unrelated manual edits;
- qualification tunes to Adaptive SEO instead of proving generic behavior;
- P5/P6 repeat expensive validation unnecessarily.

## Green definition

Green requires all of the following on the exact final candidate:
- complete provider-attempt retention and bounded retry semantics;
- root README context + documentation provenance/authority separation;
- materially useful source-backed coverage and omitted-responsibility recovery;
- typed zero-Component outcomes;
- branch-local Search Deeper with explicit preview acceptance;
- browser-proved review correction/acceptance/navigation/root isolation;
- materially credible architecture across the three qualification targets;
- <=8-minute review-ready time per controlled initial analysis;
- consolidated regression/restart/package/native evidence;
- unchanged `0.4.6`;
- no provider-specific architecture semantics, benchmark dictionary, Phase 5 canvas, general Agent Runtime or storage-phase creep.

If Green, route to a fresh `c4-smap-provider-comparison` correction, then `c4-smap-storage`. Phase 5 remains blocked.
