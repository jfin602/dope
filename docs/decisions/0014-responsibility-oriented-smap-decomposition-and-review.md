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
