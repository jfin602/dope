# ADR 0014 — Responsibility-oriented sMap decomposition and hierarchical review

Status: Accepted
Date: 2026-09-30
Amends: ADR 0012, ADR 0013
Complements: ADR 0008, ADR 0009, ADR 0010

## Context

The first real Gemini synthesis against the pinned Adaptive SEO benchmark completed quickly enough for useful iteration but produced architecture that was structurally valid and source-backed while still architecturally weak.

The final proposal contained one top-level `Adaptive SEO` System, then split primarily into `Backend Application Subsystem` and `Frontend Application Subsystem`. Independent source review showed that one top-level System is defensible for this repository; the failure was the lower-level decomposition. The implementation contains stronger responsibilities that cut across client/server/worker/persistence boundaries, including Project/Tenant control, Source Collection and Feed Production, Installation/Delivery, Provider Evidence/Insights, Adaptive Optimization and asynchronous execution.

This exposed a general defect: model-facing evidence and lower-hierarchy synthesis still over-represent repository layout, deployment tier and technical layer. Telling a model that folders are not architecture is insufficient when the evidence view itself is organized primarily by folders and runtime planes.

The same run also showed that the stacked review form is a poor representation for a System -> Subsystem -> Component hierarchy. A hierarchical proposal should be reviewed as a hierarchy.

## Decision

### Architecture decomposition follows responsibility, not implementation plane

The primary synthesis question at every level is: **what enduring software responsibility does this boundary own?**

Client/server, frontend/backend, HTTP, database, repositories, workers, frameworks, packages and directories are physical/runtime evidence. They are not automatically Systems, Subsystems or Components.

A technical plane may become an architectural boundary only when source-backed evidence shows that the plane itself owns an independently meaningful responsibility.

One top-level System is valid when the repository implements one coherent product/system. Qualification must not force a target System count.

### Deterministic responsibility signals may guide synthesis

The complete ArchitectureEvidencePacket remains the deterministic evidence authority.

Dope may derive additional deterministic, rebuildable **responsibility signals** from existing evidence to help the model see responsibilities that span physical source areas. Such a signal may contain:
- a deterministic temporary key;
- normalized recurring terms/concepts;
- source-backed evidence refs;
- participating source areas/roles;
- relationship/dependency hints.

Responsibility signals are planning metadata only. They do not establish architecture, ownership or canonical truth and must preserve provenance back to the parent evidence packet.

Signal extraction must remain generic. Do not encode Adaptive SEO-specific expected names such as Feed, Delivery, Integrations or Opportunities as architecture answers.

### Root README orientation and documentation evidence

The initial repository-global synthesis should receive the project's root `README.md` directly alongside the deterministic global architecture view and responsibility signals when the README exists. The README is labeled **project orientation**, not physical truth: it supplies the project's own purpose, domain vocabulary and stated responsibilities before System Discovery begins.

Use the complete root README when it fits the bounded initial-synthesis budget. If it is abnormally large, apply a deterministic documented size budget/excerpt policy and report that truncation; do not add a preparatory LLM summarization pass. Absence of a root README must not block synthesis.

Broader architecture-relevant repository documentation may be deterministically discovered and represented as provenance-bearing documentation evidence, including:
- accepted architecture/decision records and architecture contracts;
- package/service READMEs;
- deployment/runbooks and operational docs;
- API/protocol/configuration docs;
- textual/Mermaid architecture descriptions;
- developer guidance where it materially describes current software responsibility.

Every documentation evidence item preserves its source path, deterministic document classification/currentness when knowable, bounded claim/content and parent provenance. Documentation authority is contextual, not canonical: accepted/current architecture docs and package/service READMEs are generally stronger discovery signals than roadmaps/design proposals, while historical task prompts, qualification evidence, closeouts, generated agent artifacts and benchmark answer material are excluded from synthesis by default.

A documentation-only claim may create a naming hint, candidate, open question, coverage cue or follow-up evidence request, but it cannot independently establish current implemented architecture. Unsupported or conflicting documentation remains visibly **Documented** rather than being silently promoted to **Observed** implementation support.

For qualification, a benchmark repository's own ordinary README/docs are legitimate repository context. Independent developer architecture references or expected-answer documents used to judge the frozen result remain forbidden synthesis input.

### System support distinguishes context from responsibility

Repository manifests, start scripts, framework/configuration facts and workspace topology may establish repository/runtime context but cannot by themselves establish a System responsibility boundary.

A proposed System must include direct production behavior evidence supporting its responsibility. System Challenge explicitly tests a one-System proposal for umbrella collapse while remaining free to keep one System when evidence supports a coherent product responsibility.

### Establish one hierarchy level before descending

The hierarchy-first workflow becomes:

1. deterministic evidence collection, including eligible repository-document claims;
2. deterministic global skeleton + responsibility signals + root README project orientation when present;
3. System Discovery;
4. System Challenge;
5. per-System Subsystem Discovery;
6. per-System **Subsystem Challenge**;
7. per-challenged-Subsystem Component Discovery;
8. cross-hierarchy reconciliation;
9. bounded targeted verification;
10. final ArchitectureProposal assembly;
11. developer review/correction/acceptance.

Subsystem Discovery proposes Subsystems only. It no longer invents Components in the same provider result.

Subsystem Challenge supports explicit keep/merge/split/reject semantics and must specifically challenge boundaries that appear to mirror technical planes/directories without independent responsibility evidence.

Component Discovery occurs only after Subsystem boundaries stabilize.

The workflow remains bounded and provider-independent.

### Review the proposal in a center editor hierarchy

The left sMap sidebar remains the home for Analyze Project setup, provider readiness, progress, status and navigation.

When a proposal reaches `review_required`, Dope opens or offers an editor-like center workspace review surface.

The review presents an indented System -> Subsystem -> Component tree. Selecting one node shows editable details/evidence for that node rather than rendering every node as one long stack of forms.

The developer must retain the existing correction authority:
- rename;
- add/remove;
- reparent;
- merge/split-equivalent correction;
- inspect source-backed evidence;
- explicitly accept or decline.

Canonical IDs and raw implementation-root lists are secondary/advanced metadata and must not dominate the hierarchy review.

This center editor is a Phase 4 review surface, not the Phase 5 visual Physical Map/Planning Map canvas.

### Adaptive SEO is a benchmark, not an answer key

The pinned Adaptive SEO benchmark remains useful because meaningful responsibilities cross frontend, backend, worker, data and external-delivery code.

Qualification may compare a frozen generated result to independent developer architecture after synthesis, but those documents must not be supplied as hidden synthesis input.

Green does not require an exact reference tree. It requires responsibility-oriented, source-backed boundaries and useful lower hierarchy.

## Correction and sequencing

The owner closes `c4-smap-gemini-provider` Not Qualified at source `8ea34ae1300a387ac63aad9462ae649ac78a9605`. Its Gemini-only P4 debugging evidence is retained; the planned same-pipeline Local/Gemini comparison and its formal P5 prompt are not executed.

The older `c4-smap-hierarchical-synthesis` P8/P9 prompts remain superseded and will not be run.

At ADR adoption, the mandatory next correction was `c4-synth-improvements` at unchanged `0.4.6`. That sequencing is now historical and is superseded by the 2026-09-30 amendment below: `c4-synth-improvements` is owner-closed Not Qualified after P4, and the current mandatory correction is `c4-synth-coverage-review`. A fresh provider-comparison correction and project-local sMap storage remain later gates.

## Consequences

- One-System repositories are not penalized merely for being cohesive.
- Subsystem quality becomes an explicit first-class gate rather than an incidental side effect of one combined lower-level pass.
- The model receives stronger cross-layer responsibility cues without making deterministic heuristics canonical architecture.
- Technical-layer decompositions such as Frontend/Backend become challenge targets rather than accepted defaults.
- Additional bounded model calls are accepted when they materially improve architecture quality; the <=8-minute objective remains the performance guard.
- Proposal review becomes readable as a hierarchy without pulling the Phase 5 visual planning canvas forward.

## 2026-09-30 amendment — coverage recovery, descent diagnostics and branch-local review refinement

### Evidence from `c4-synth-improvements` P4

A controlled real `gemini-3.8-flash` run against the pinned Adaptive SEO benchmark reached center review within **302.8 seconds**, satisfying the eight-minute objective for that run. The result improved on the earlier Frontend/Backend decomposition, but architecture quality remained Not Green.

The frozen proposal contained one System, five responsibility-named Subsystems and four Components. Three Subsystems had no Components. Independent post-freeze comparison showed substantial implemented responsibilities were absent or collapsed, including tenant/project control, collection/feed output, provider synchronization, worker execution, Feed Digest and delivery detail. The run also exposed incomplete call retention: twelve model calls occurred but only eleven call records remained visible. The first controlled attempt failed with a sanitized Gemini transport/type error and required manual retry.

The owner therefore closes `c4-synth-improvements` early after P4 as **Not Qualified**. Its P5 closeout prompt will not run and no missing Green evidence may be inferred.

### Source-backed coverage is explicit

Responsibility planning must prioritize source-backed domain behavior over generic cross-area vocabulary. Generic recurrence such as error/message/route-like terms must not crowd out stronger service, state, worker, provider, delivery, public-contract or domain-module evidence merely because the generic term appears in more source areas.

The deterministic evidence packet remains authority. Derived responsibility/coverage cues remain rebuildable planning metadata with parent evidence refs; they never become architecture truth.

Before final review, Dope maintains an inspectable coverage ledger from deterministic responsibility cues to the challenged hierarchy. A substantial cue may be:
- represented by a surviving boundary;
- carried through a merge/split/recovery mapping;
- unresolved.

The ledger is diagnostic state, not canonical architecture and not a benchmark answer key.

### Subsystem Challenge may recover omitted responsibilities

Keep/merge/split/reject over existing candidates is insufficient when Subsystem Discovery failed to propose an important responsibility at all.

Subsystem Challenge therefore gains a bounded provider-independent recovery mechanism. It must still disposition every discovery candidate exactly once, but it may additionally propose a new Subsystem when source-backed coverage evidence demonstrates a substantial responsibility absent from the discovery set.

Recovered boundaries require the same evidence/provenance validation as ordinary candidates. No target count or repository-specific domain dictionary is allowed.

### Empty Component descent is a typed result

Component Discovery may legitimately return no Components, but empty descent is never silent.

A zero-Component result must carry a compact typed disposition equivalent to:
- leaf responsibility;
- insufficient evidence;
- responsibility belongs elsewhere;
- no stable Component boundary.

The disposition cites parent evidence. Unresolved/insufficient/misplaced cases remain visible to reconciliation/review and architecture-quality qualification. A leaf disposition does not force fake Components.

### Provider-call attempts are retained completely

Qualification telemetry records every attempted provider call, not only successful stage outputs. Records identify stage/subject, provider/model, attempt/retry relationship, duration, safe failure class, usage when available, cache reuse where applicable and whether an output was consumed.

A bounded automatic retry may be used for explicitly classified transient transport/upstream failures. One malformed structured-output result may also be retried once when the same request can safely be repeated. The retry classifier must distinguish malformed output from invalid architecture/content; when it cannot, the failure is terminal and manual retry remains available. Each failed attempt and its safe reason remains visible while the run continues; only exhausted or non-retryable failure marks the run failed. Retries repeat the same stage/request/model, never silently change providers/models, and remain capped. Architecture/content validation failures are not retried automatically.

After a terminal failure, manual **Retry failed stage** is offered beside the selected model control. Changing a model requires a successful capability test before retry. The selected provider/model is explicit, and validated checkpoints retain their original provenance while only failed and dependent work is repeated. A fresh analysis remains a separate explicit action.

Provider telemetry is operational/derived state, not canonical project state and never contains credentials or raw secret-bearing errors.

### Center review supports branch-local Search Deeper

Every System and Subsystem in pending center review exposes **Search Deeper**.

Search Deeper:
- starts from the **current edited review branch**, not the original model proposal;
- gathers the selected branch's evidence and deterministically expands into relevant uncovered/cross-boundary evidence plus relevant repository-document claims/README context;
- runs only bounded targeted synthesis for that branch;
- may refine a System and its descendants, or refine/split a selected Subsystem and its Components within the same parent System;
- produces a preview proposal instead of mutating the draft immediately;
- requires explicit Accept or Reject;
- preserves all unrelated Systems, Subsystems, Components and manual edits;
- rejects stale branch proposals when the target branch changed after analysis began;
- remains available after manual edits and before final architecture acceptance;
- labels targeted calls separately in telemetry.

Search Deeper is an iterative architecture-discovery/review capability. It is not a Phase 5 Planning Map, general chat/Agent Runtime, or autonomous unbounded recursion.

### Qualification broadens beyond one benchmark

Adaptive SEO remains a useful benchmark but cannot be the sole quality oracle.

`c4-synth-coverage-review` must qualify the shared pipeline on:
- pinned Adaptive SEO;
- Dope itself through an uncontaminated benchmark root;
- one smaller structurally clear repository or controlled repository fixture capable of exposing over-segmentation.

Architecture references may be used only after each generated hierarchy is frozen. A benchmark repository's own ordinary root README/current docs may be synthesis input under the documentation rules above; independent expected architecture/reference material remains post-freeze only. Green requires material implemented responsibilities to be represented or explicitly unresolved without forcing exact names/counts. Qualification must include useful-README, absent-README, stale/conflicting-documentation and implementation-not-mentioned-in-docs cases. The <=8-minute objective remains a per-controlled-analysis performance gate, not a timeout.

### Sequencing

Historical route at amendment adoption:

`c4-synth-coverage-review` at unchanged `0.4.6`.

The correction implemented its bounded coverage/review work through P5. P6 was stopped by the developer and pushed at `c059f67a5fd85c81183ba09044e550462c9000a1`; P7 is unexecuted.

## 2026-09-30 owner sequencing amendment — accept synthesis baseline, finish storage

The owner closes `c4-synth-coverage-review` as **Not Qualified** after stopped P6. This is a sequencing disposition, not a Green audit. Its final Adaptive SEO replay reached center review within 445 seconds and produced a materially more useful responsibility hierarchy, but zero useful Components, unresolved source-backed cues, incomplete Dope/small-target qualification and skipped final aggregate/package/native validation remain explicit gaps.

The owner accepts the implemented synthesis/review capability as the bounded baseline so visual-map work is not delayed by diminishing-return benchmark tuning. P7 will not run and missing evidence must not be inferred.

The fresh Local/Gemini provider-comparison correction is deferred off the pre-Phase-5 critical path. It is neither executed nor relabeled Green. It may be revived later when provider optimization or AI Presence creates a concrete need for comparative evidence.

Mandatory next correction:

`c4-smap-storage` at unchanged `0.4.6`.

Storage is intentionally narrow. Existing `.dope/architecture.json` and `.dope/smap.json` contracts should be proven/repaired rather than replaced. Rebuildable evidence packets, Physical Map snapshots/indexes, review drafts, coverage ledgers, provider attempts/caches and targeted-refinement previews remain transient unless a concrete defect requires project persistence.

The one-off failed-stage-resume correction is that concrete defect. An active/failed initialization run now keeps its pinned evidence packet, validated stage checkpoints, safe failure details and per-stage provider/model provenance in project-local versioned `.dope/` storage. Pending review may retain those same checkpoints until acceptance or decline. Retry replaces only failed branch work and its dependents; Search Deeper continues to preview and accept only the selected edited review branch, preserving unrelated edits. Neither mechanism changes canonical architecture without developer acceptance. Historical owner-close evidence above remains Not Qualified; this correction stays open for new browser qualification.

Storage Green routes directly to a fresh Product Phase 5 `/docs-review`.
