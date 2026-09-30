# Correction 4 Prompt Assessment — Responsibility-oriented sMap Synthesis

Status: **OWNER-CLOSED / NOT QUALIFIED — HISTORICAL ASSESSMENT; P5 UNEXECUTED**
Correction folder: `c4-synth-improvements`
Required unchanged package version: `0.4.6`
Activation source: `8ea34ae1300a387ac63aad9462ae649ac78a9605`
Predecessor: owner-closed / Not Qualified `c4-smap-gemini-provider`
Authority: ADR 0014 plus ADR 0008-0013 where not amended

## Conclusion

Use five ordered prompts at unchanged `0.4.6`:

1. responsibility-oriented deterministic planning and stronger System support;
2. separate Subsystem Discovery, Subsystem Challenge and Component Discovery contracts/primitives;
3. orchestration/reconciliation update plus a center-editor hierarchy review;
4. real Gemini Adaptive SEO requalification plus consolidated expensive validation;
5. evidence-only closeout.

P1-P3 use focused permanent tests and minimum build/typecheck feedback. P4 owns browser/live-provider work and the full regression/restart/package cost. P5 does not rerun live synthesis simply to improve evidence.

## Evidence that motivates the correction

The owner-closed Gemini correction produced a real final Adaptive SEO run in 83.9 seconds. It returned:
- one `Adaptive SEO` System;
- `Backend Application Subsystem`;
- `Frontend Application Subsystem`;
- five lower Components;
- no reported open questions.

Independent source review showed that one top-level System is plausible. The quality failure was the lower decomposition: the proposal mostly reproduced technical tiers while stronger responsibilities cross client/server/worker/persistence boundaries.

The System itself was thinly supported: its final evidence consisted of two root `package.json` start-script facts. Those establish executable/repository context but are insufficient by themselves to establish the System responsibility.

The first lower-hierarchy run also exposed planner scoping problems around root-manifest evidence. Repairs broadened the Subsystem view and produced useful source facts, but the result still converged on Backend/Frontend. This proves the problem is deeper than simply supplying more source files.

## Current source findings

### Evidence planning is still topology-shaped

`packages/software-map/src/evidence-planner.ts` is deterministic and provenance-safe, but selection/diversity is primarily organized by `group(path)`:
- `src/server/...`;
- `src/client/...`;
- package/workspace areas.

That is useful for coverage but it biases the model toward physical source topology. The next planner needs additional deterministic, cross-area responsibility signals while retaining the current packet as evidence authority.

A responsibility signal must remain derived planning metadata. It can group refs that share generic semantic concepts, public contracts, job/worker behavior, state ownership, delivery boundaries or dependency relationships, but it cannot assert that the group is a Subsystem.

### System support is too permissive

Current `SystemCandidate` carries one undifferentiated `evidenceRefs` list.

The Adaptive SEO System survived with only root-manifest entrypoint support. Validation currently proves that refs exist, not that at least one cited fact demonstrates production responsibility.

P1 should introduce a provider-independent distinction between direct responsibility support and contextual/boundary support, or an equivalent validator rule, without creating a new canonical evidence authority.

Root manifests/configuration/topology may remain useful context but cannot be the sole direct responsibility basis for a System.

### Stage v2 establishes two lower hierarchy levels at once

`packages/software-map/src/hierarchical-synthesis.ts` currently defines:
- `system-discovery`;
- `system-challenge`;
- `subsystem-discovery`;
- `reconciliation`;
- `verification`.

`SubsystemDiscoveryResult.nodes` contains both `subsystem` and `component` candidates. One provider call therefore invents Subsystems and Components simultaneously.

There is no Subsystem equivalent of System Challenge. Once the provider chooses Backend/Frontend, reconciliation can report structural issues but cannot perform an explicit keep/merge/split/reject correction of those Subsystem boundaries.

P2 should bump the stage/prompt/cache contract and introduce:
- Subsystem Discovery — Subsystems only;
- Subsystem Challenge — keep/merge/split/reject;
- Component Discovery — Components only under challenged Subsystems.

Do not preserve the old combined lower-stage protocol through compatibility adapters; Dope is pre-stability and ADR 0014 intentionally replaces it.

### Provider instructions still need responsibility-level semantics

The shared Local instruction currently says a Subsystem may span packages and a folder alone is not a boundary, but that negative rule did not prevent Backend/Frontend decomposition.

New instructions should positively ask for enduring responsibilities that may cross presentation/API/persistence/worker planes, while explicitly challenging technical-tier candidates unless evidence shows that the technical plane itself owns an independent responsibility.

Do not mechanically blacklist names like Backend, Frontend, Worker or Database. A real execution platform can be architectural when the evidence supports it.

Gemini and Local continue to use the exact same Dope-owned stage semantics.

### Reconciliation is downstream of a bad hierarchy

Current reconciliation can detect ownership overlap, same-source-region, outside-system, duplicate responsibility and cross-System dependencies. It does not establish or challenge Subsystem boundaries.

P3 must update reconciliation to the stabilized three-level hierarchy. Reconciliation remains an audit/verification layer; it must not become an unlimited autonomous rewrite loop.

### Review UX is implemented in the wrong workbench surface

`SoftwareMapWidget` is an `AbstractViewContribution` placed in the left sidebar.

During review it:
- recursively renders proposal nodes;
- then renders `renderDraft()`;
- creates one large `fieldset` for every System/Subsystem/Component;
- repeats Canonical ID, Name, Purpose, Parent and Implementation roots controls for every node.

The screenshot from the real run demonstrates that this becomes difficult to read as soon as a nontrivial hierarchy exists.

P3 should create a dedicated center-area review widget/editor using supported Theia contribution/widget APIs. The left sMap view should remain setup/progress/status/navigation.

The sidebar and center review must share one coherent project/review state. Do not create two independent backend attachments/controllers that can race, duplicate review state or accept different drafts.

### Existing provider/model work should be preserved, not reopened

The current code already has:
- compact stage JSON;
- Local provider;
- Gemini provider;
- discovered Gemini model selection/probe;
- explicit provider selection/no silent fallback;
- provider-independent timing/token/byte telemetry;
- credential handling from the prior correction.

This correction is not another Gemini integration stack.

### Test aggregation is explicit

Root `test:product` names individual test files. Any new responsibility-signal, Subsystem Challenge, Component Discovery or review-editor tests must be wired into that aggregate.

## Prompt decomposition

### P1 — Responsibility planning / System support

Likely surfaces:
- `packages/software-map/src/evidence-planner.ts`;
- `packages/software-map/src/hierarchical-synthesis.ts`;
- System discovery/challenge helpers;
- provider instructions;
- evidence planner/System fixtures/tests.

Keep stage v2 unless P1 genuinely changes provider stage schema; P2 owns the deliberate full lower-stage version bump.

### P2 — Lower hierarchy contracts

Likely surfaces:
- `hierarchical-synthesis.ts`;
- replace/refactor `per-system-discovery.ts`;
- new Subsystem Challenge/Component Discovery helpers as appropriate;
- `evidence-planner.ts`;
- Local/Gemini provider instruction routing;
- reconciliation input types;
- tests and root aggregation.

This prompt should implement stage primitives and validation without doing the large browser/UI rewrite.

### P3 — Orchestration and review editor

Likely surfaces:
- `reconciliation.ts`;
- `software-map-backend.ts`;
- `service.ts` if review APIs need small additions;
- `software-map-controller.ts`;
- `software-map-widget.ts`;
- `frontend-module.ts`;
- new center review widget/controller/coordinator;
- `dope.css`;
- UI/initialization/restart-facing focused tests.

Use one shared review/controller state or a deliberate coordinator. Avoid two independently attached Software Map clients.

### P4 — Real qualification

Use the exact pinned benchmark:
- `~/dev/adaptive-seo-dope-p8`;
- source `jfin602/adaptive-seo`;
- SHA `0b26a25107be7d8dfb2210bc7258ccac8603197e`;
- push disabled.

Do not inspect developer architecture references until the generated hierarchy is frozen.

Use one explicitly selected/probed Gemini generation model and record its exact ID. No Local comparison in this correction.

### P5 — Evidence closeout

Audit exact P4 evidence and route Green to a fresh provider-comparison correction.

## Main risks

- **Overfitting:** hard-coding Adaptive SEO vocabulary would produce a benchmark answer key instead of a general algorithm.
- **Heuristic authority leakage:** responsibility signals must remain evidence-derived hints, not deterministic architecture.
- **Count bias:** the correction must not convert “one System was okay” into a fixed one-System rule or fixed Subsystem count.
- **Technical-word blacklist:** Backend/Worker/Database can be legitimate responsibilities in some systems; challenge evidence, not words.
- **Prompt-only fix:** changing prose without changing evidence planning/stage structure is unlikely to solve the demonstrated defect.
- **Call explosion:** new hierarchy stages must remain bounded; quality may cost extra calls but not unbounded recursion.
- **Dual review state:** a center editor must not create a second authority path or stale draft.
- **Phase creep:** the center hierarchy review is not the Phase 5 visual map/planning canvas.
- **Qualification contamination:** architecture docs read before synthesis freeze would invalidate the quality comparison.

## Qualification decision

The five-prompt stack is appropriate.

Green means the shared pipeline can generate a materially credible responsibility-oriented Adaptive SEO hierarchy through Gemini within the <=8-minute objective, with provenance intact and a readable center-editor developer review. It does not require a specific System/Subsystem count or exact reference names.

## Owner close amendment — 2026-09-30

The five-prompt plan is historical. P1-P3 completed; P4 produced direct Not Green architecture evidence; P5 is cancelled and unexecuted by owner decision.

Do not use this assessment to route to provider comparison. Current routing is through mandatory `c4-synth-coverage-review`.
