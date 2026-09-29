# ADR 0009 — Architecture discovery and developer authority

Status: Accepted
Date: 2026-09-29
Amends: ADR 0007
Complements: ADR 0008

## Context

ADR 0007 correctly made the Software Map architecture-centered and established Project -> System -> Subsystem -> Component -> CodeEntity as the primary hierarchy. Product Phase 4 then qualified a strong lower-level substrate: language-independent graph contracts, deterministic TypeScript/JavaScript semantic analysis, evidence/provenance, indexing, architecture validation, queries and the sMap inspector.

Phase 4's implementation, however, creates System / Subsystem / Component physical nodes directly from `.dope/architecture.json`. The analyzer discovers modules, files, symbols and semantic relationships underneath those authored boundaries, but it does not independently discover architecture-scale structure.

That is incomplete for the intended product.

The Software Map should be useful on an existing repository before the developer has manually described its architecture. It should also support a fresh project where the developer defines intended architecture before implementation exists.

Automatic detection must not become a second architectural authority. The developer remains the final source of truth for architecture.

## Decision

### Detection proposes; the developer owns architecture

Dope distinguishes **Detected Architecture** from **Canonical Architecture**.

Detected Architecture is rebuildable, evidence-backed interpretation produced by deterministic analyzers. It proposes candidate Systems, Subsystems and Components and explains the evidence supporting each candidate.

Canonical Architecture is developer-owned project state. It owns stable architectural identity, purpose, intended containment/boundaries, contracts and constraints.

Detection never silently mutates canonical architecture. The developer must be able to confirm, rename, reparent, merge, split, replace or ignore detected candidates.

A canonical developer decision does not erase contradictory implementation evidence. If implementation disagrees, the Software Map preserves the canonical architecture and reports the disagreement as physical drift, detected-only structure or unassigned implementation.

### Architecture may precede implementation

Canonical architecture may exist before code.

A greenfield project can define System / Subsystem / Component structure, purposes, contracts and constraints before implementation exists. Those nodes are canonical but **declared-only** until physical evidence realizes them.

A declaration is therefore architecture authority, not proof of physical existence.

### Architecture discovery is required

The Physical Map must discover candidate architecture above the file/symbol level.

Deterministic discovery may use multiple evidence classes, including:
- workspace/application/package topology;
- build and configuration boundaries;
- executable/deployable/runtime entrypoints;
- process or frontend/backend boundaries;
- semantic dependency cohesion and direction;
- public exports/contracts;
- DI/service/framework registration;
- routes, jobs, schemas and other framework concepts where explicit extractors exist;
- recorded runtime observations when that capability is later introduced.

No single signal automatically establishes architecture. In particular, a directory, package or inferred dependency cluster is evidence, not canonical truth.

Every architecture candidate that affects the map must retain sufficient derivation/provenance to explain why Dope proposed it.

### Physical realization states

The Software Map must be able to distinguish at least:
- **declared-only** — canonical architecture exists but has no supporting implementation yet;
- **detected-only** — implementation suggests an architecture boundary not yet accepted into canonical architecture;
- **realized** — implementation evidence supports the canonical boundary;
- **drifted** — implementation materially disagrees with canonical ownership, boundary or contract expectations;
- **unassigned** — implementation is known but not meaningfully mapped.

These are architecture/implementation reconciliation states, not AI confidence scores.

### Analyzer layering

The existing TypeScript/JavaScript semantic analyzer remains a lower-level evidence engine.

The forward pipeline is:

Repository / configuration / runtime evidence
-> language and framework analysis
-> normalized source facts and relationships
-> architecture discovery
-> developer confirmation/correction
-> canonical architecture
-> Physical Map realization and drift
-> Phase 5 visual projections / Planning Map

Architecture discovery is language-independent at the Software Map boundary. Language-specific compiler/parser/framework logic stays behind analyzer adapters.

AI is not required for discovery. AI may later explain or propose architectural interpretations, but those proposals remain distinct from deterministic detection and canonical developer authority.

### `.dope/architecture.json`

The project-local architecture declaration remains the durable canonical architecture mechanism until deliberately replaced.

Its role is clarified:
- it stores developer-owned architectural decisions and constraints;
- it may exist before implementation;
- it may be created from accepted detection or authored from scratch;
- it is not the source from which physical System / Subsystem / Component existence is manufactured;
- missing canonical architecture is valid and must not prevent architecture discovery.

The schema should not be version-bumped merely for terminology. Change it only if the correction requires new persisted fields.

### Semantic zoom

The visual Software Map must treat architecture as the primary zoom hierarchy.

The intended progression is:

Project / Systems
-> Subsystems
-> Components
-> packages / modules / services
-> files / classes / interfaces / functions
-> syntax / semantic relationships / source

Syntax and semantics fill in progressively at deeper zoom levels; they are not the primary low-zoom map.

## Correction gate

Before Product Phase 5 planning or activation, run correction stack `c4-architecture-discovery` at unchanged package version `0.4.6`.

The correction must preserve the qualified Phase 4 semantic/evidence/index/query substrate while adding:
- deterministic System / Subsystem / Component discovery;
- evidence-backed candidate derivation;
- explicit detected-versus-canonical state;
- developer confirmation/correction authority;
- greenfield architecture-before-code;
- realization/drift reconciliation;
- focused permanent regression coverage.

The correction must not pull the Phase 5 visual canvas, Planning Map work ontology or AI runtime forward.

## Historical qualification

Product Phase 4 remains Qualified/Green for the scope actually implemented and tested at `0.4.6`. Its prompts, direct evidence and closeout are historical truth and are not rewritten to imply architecture discovery already existed.

ADR 0009 changes forward authority and creates a mandatory correction gate before later work depends on the Physical Map.

## Consequences

- Existing repositories can produce useful architecture candidates without first authoring `.dope/architecture.json`.
- Greenfield projects can establish architecture before implementation.
- Developers retain authorship and can correct detector mistakes without fighting an opaque inferred graph.
- Implementation drift becomes visible rather than being hidden by declarations or automatic reclustering.
- Phase 5 receives a trustworthy architecture-scale substrate for semantic zoom and Planning Map work.
- The existing TypeScript semantic analyzer remains valuable rather than being replaced by a new parser solely for architecture discovery.
