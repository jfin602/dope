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

### System support distinguishes context from responsibility

Repository manifests, start scripts, framework/configuration facts and workspace topology may establish repository/runtime context but cannot by themselves establish a System responsibility boundary.

A proposed System must include direct production behavior evidence supporting its responsibility. System Challenge explicitly tests a one-System proposal for umbrella collapse while remaining free to keep one System when evidence supports a coherent product responsibility.

### Establish one hierarchy level before descending

The hierarchy-first workflow becomes:

1. deterministic evidence collection;
2. deterministic global skeleton + responsibility signals;
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

Mandatory next correction:

`c4-synth-improvements` at unchanged `0.4.6`.

After `c4-synth-improvements` closes Green, run a fresh bounded provider-comparison correction rather than reopening the closed `c4-smap-gemini-provider` history. Project-local sMap storage remains blocked until the corrected shared pipeline has both architecture-quality evidence and provider-comparison evidence.

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

A bounded automatic retry may be used only for explicitly classified transient transport/upstream failures. It repeats the same stage/request/model, never silently changes providers/models, remains visible, and is capped. Invalid architecture/schema/content results are not hidden by retry.

Provider telemetry is operational/derived state, not canonical project state and never contains credentials or raw secret-bearing errors.

### Center review supports branch-local Search Deeper

Every System and Subsystem in pending center review exposes **Search Deeper**.

Search Deeper:
- starts from the **current edited review branch**, not the original model proposal;
- gathers the selected branch's evidence and deterministically expands into relevant uncovered/cross-boundary evidence;
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

Architecture references may be used only after each generated hierarchy is frozen. Green requires material implemented responsibilities to be represented or explicitly unresolved without forcing exact names/counts. The <=8-minute objective remains a per-controlled-analysis performance gate, not a timeout.

### Sequencing

Mandatory next correction:

`c4-synth-coverage-review` at unchanged `0.4.6`.

If it closes Green, run a fresh bounded provider-comparison correction. Then run `c4-smap-storage`. Product Phase 5 remains blocked until those gates close Green.
