# Correction 4 Implementation Plan — sMap Architecture Synthesis

Status: IN PROGRESS — P1/P2 COMPLETE; P3 FRAMEWORK GAP NEXT
Correction authority name: `c4-architecture-discovery`
Execution folder: `c4-smap-synth`
Prompt-authoring source: `067828fdd6db0149765e67c547158f63d7e55743`
Post-P2 amendment source: `99f16e871b403be96c35078ec94a3ebb5ccf3990`
Required unchanged package version: `0.4.6`
Authority: ADR 0009 as amended by ADR 0010; ADR 0011; current BOOT/ARCHITECTURE/PRODUCT-MODEL/software-map-storage/roadmap/workflow/stability contracts

## Preflight for every prompt

Read BOOT, AGENTS, PRINCIPLES, PRODUCT-MODEL, ARCHITECTURE, software-map-storage, workflow/stability authority, ADRs 0004/0008/0009/0010/0011, Phase 4 plan/activation/closeout, this assessment/plan and all prior c4-smap-synth prompt results/evidence.

Require:
- package version exactly `0.4.6`;
- qualified Phase 4 closeout commit `fac88712bb55176d3d6d54fbe6034de8b0f801ff` reachable;
- current ADR 0010/0011 authority reachable;
- clean intended Git state apart from explicitly recorded unrelated user changes;
- Node 24;
- no root `package-lock.json`;
- Theia exactly 1.75.0 and Electron 42.8.1.

Later ADR 0010/0011 authority supersedes only the stale AGENTS c4 statements that forbid the narrow synthesis provider or claim deterministic analysis alone produces initial architecture proposals. General AI Presence remains out of scope.

This correction remains version `0.4.6`; do not advance Phase 5 versioning.

## P1 — Synthesis contracts, lifecycle and strict proposal validation — COMPLETE

### Inspect

Trace:
- software-map contracts/exports/service;
- current architecture parser and graph validation style;
- test conventions;
- all consumers of SoftwareMapStatus and service methods.

### Implement domain contracts

In `@dope/software-map`, add provider-independent contracts for:
- ArchitectureEvidencePacket and typed deterministic evidence items;
- ArchitectureProposal and proposed nodes;
- numeric confidence constrained to 0..1;
- rationale, `evidenceRefs`, human-readable `evidence`;
- openQuestions, unassignedEvidenceRefs and bounded evidenceRequests;
- temporary proposal identity;
- sMap initialization lifecycle `uninitialized | analyzing | review_required | initialized`;
- a narrow ArchitectureSynthesisProvider interface/capability boundary.

Define a strict ArchitectureProposal JSON Schema suitable for structured-output providers plus a parser/validator that rejects:
- malformed/extra fields where strictness applies;
- duplicate proposal keys;
- invalid kinds/parents/cycles/hierarchy;
- non-finite/out-of-range confidence;
- missing/fabricated evidence refs;
- prose evidence with no hard refs for proposed nodes;
- invalid/unbounded evidence requests.

Keep proposal keys distinct from canonical architecture IDs.

Do not add LM Studio/OpenAI types to software-map.

Reconcile stale c4-specific AGENTS wording to ADR 0010/0011 without broadening Phase 6 scope.

### Tests

Add focused domain tests for valid/invalid schema, reference integrity, hierarchy, confidence, request bounds and proposal identity.

Preserve existing Physical Map tests.

## P2 — Deterministic ArchitectureEvidencePacket — COMPLETE

### Goal

Build the exact, independently verifiable packet supplied to synthesis without using AI and without publishing an initial sMap.

### Boundary

Implement packet production behind `@dope/code-analysis`, reusing the existing TypeScript analyzer and normalized graph facts.

The packet should include compact deterministic facts sufficient for architecture synthesis, including as available:
- workspace/repository/package topology;
- package manifest name/path and dependency metadata;
- configured TS/JS project boundaries;
- executable/application/entrypoint signals derived from explicit config/manifests;
- code entities and meaningful public/export/service-like facts already produced by the analyzer;
- direct dependency/reference relationships and bounded neighborhoods;
- framework facts only where an explicit deterministic extractor exists.

Every packet item has a stable packet-local ID and enough provenance/source IDs/paths to verify it. Do not turn folder/package presence directly into an architecture node.

The packet must be independent from `.dope/architecture.json` as physical evidence. Existing declarations may be handled separately by initialization/review orchestration.

### Packet stability/size

Define deterministic ordering and a packet fingerprint tied to deterministic source/config inputs. Avoid dumping every raw symbol verbatim if a normalized fact can retain the same traceability.

Add bounded evidence-expansion handling for the whitelisted evidenceRequests from P1. Dope gathers requested facts; the model never receives filesystem/tools.

### Index separation

Refactor only as needed so initialization evidence can be collected without `SoftwareMapIndex.analyze()` publishing a PhysicalMapSnapshot. Normal initialized refresh must continue using the existing index/publish behavior.

### Tests

Prove:
- same inputs => same packet/order/fingerprint;
- packet remains inspectable without AI;
- proposal refs can resolve to packet items and ultimately source evidence;
- adding/removing declaration bytes alone does not mutate the physical evidence packet;
- package/config/source changes invalidate appropriate packet facts;
- unsupported/unsafe paths remain rejected;
- bounded refinement cannot become arbitrary tool access.

## P3 — Deterministic framework evidence extraction

P2 exposed a concrete gap: the real Dope packet contains 379 ordered facts but zero framework facts.

Add a provider-independent `FrameworkEvidenceExtractor`-style seam behind code analysis. Framework extractors emit deterministic packet facts with hard provenance only; they never create architectural nodes.

Qualify Theia/Inversify as the first extractor. Cover, when statically recoverable:
- package `theiaExtensions` frontend/backend declarations;
- `ContainerModule`;
- DI bind/rebind service/target registrations;
- `RpcConnectionHandler` service wiring;
- `ServiceConnectionProvider.createProxy`;
- `bindViewContribution`;
- `FrontendApplicationContribution`;
- `WidgetFactory`;
- `AbstractViewContribution` widget/default-area metadata.

Prefer TypeScript import/module resolution so same-named unrelated local APIs do not become framework evidence.

Source-level framework facts must point to physical `Evidence` with class `framework`, producer/version, path and span where available. Framework evidence requests remain bounded to known packet refs/paths.

Reuse the existing semantic pass where practical; avoid an unnecessary second full repository parse.

Real Dope exit evidence:
- framework fact count > 0;
- representative frontend/view fact;
- representative backend/RPC fact;
- representative DI fact;
- hard provenance resolves;
- repeated collection deterministic;
- no architecture nodes created;
- total facts/framework count/size/elapsed time recorded against P2 baseline.

## P4 — Local LM Studio/Qwen synthesis provider

Implement the first concrete adapter in the backend/application layer, not a general Model Runtime.

Support local LM Studio-compatible endpoint/model discovery, Qwen3-Coder-30B-A3B-Instruct reference-family selection, structured-output capability probe and explicit pre-synthesis warm-up.

Probe and warm-up contain no project evidence. Warm-up failure must issue zero real packet synthesis requests.

Only after readiness, submit the P2+P3 ArchitectureEvidencePacket and validate the returned ArchitectureProposal against the exact packet.

Permanent tests use a controlled mock HTTP server and cover request ordering, warm-state invalidation, failures, invalid structured output, fabricated refs and redacted auth diagnostics.

## P5 — Initialization orchestration, persistence and canonical acceptance

Introduce the durable project initialization marker authorized by ADR 0010, expected as readable `.dope/smap.json` schema 1.

Keep provider config, decline state, packets, proposals and review drafts out of canonical project state.

Backend orchestration must:
- start only after explicit frontend invocation;
- collect deterministic evidence without publishing a map;
- invoke P4 readiness/synthesis;
- support bounded evidence refinement;
- retain packet/proposal/review transiently;
- enter `review_required` only after validation;
- clear transient state on cancel/failure;
- publish/reconcile Physical Map only after explicit acceptance.

Create a transient developer-editable review draft. Model proposal keys/roots do not become canonical IDs/ownership automatically.

Acceptance must validate ordinary ArchitectureDeclaration state, guard against stale external edits and perform recoverable writes of architecture + initialization marker.

Support explicit existing-declaration initialization and manual/greenfield initialization with no model.

## P6 — Analyze Project onboarding, local setup and proposal review UI

Replace unconditional first-use Analyze/Refresh with explicit Analyze Project consent.

Decline performs no analysis/write and only suppresses repeated nagging as user/presentation state. The sMap empty state always allows re-entry.

Keep local setup inside the flow: detect/configure LM Studio, discover/select model, persist endpoint/model as user/application state, run capability probe, and keep secrets out of canonical project files.

Review UI exposes:
- proposed hierarchy;
- confidence;
- rationale;
- human-readable evidence;
- separately navigable hard evidence refs, including framework evidence;
- open questions/unassigned evidence;
- bounded correction controls and canonical ID/root editing.

Explicit Accept uses P5 durable acceptance. Manual/existing architecture path remains available.

## P7 — Real LM Studio/Qwen dogfooding and corrected package qualification

Browser required.

Use the real Dope repository and local LM Studio/Qwen3-Coder-30B-A3B-Instruct.

Qualify:
- consent/no-write decline;
- local provider/model setup;
- capability probe;
- warm-up before project packet;
- valid real Qwen proposal;
- representative proposal reasoning backed by deterministic framework facts where relevant;
- hard evidence/source navigation;
- correction controls and invalid-draft blocking;
- explicit acceptance then Physical Map publication/reconciliation;
- restart/reopen;
- manual/existing declaration path;
- controlled warm-up failure with no packet submission;
- corrected `0.4.6` package.

Record evidence in `docs/tasks/c4-smap-synth/P7-smap-synth-evidence.md` and restore controlled project/Git state as required.

## P8 — Evidence-only closeout

Audit exact P7 evidence/candidate; do not repair.

Assess:
A. initialization consent/state;
B. deterministic packet + framework extraction/provenance;
C. provider independence + local reference path;
D. probe/warm/project-evidence ordering;
E. strict proposal validation;
F. developer correction/canonical acceptance/manual path;
G. Physical Map/restart/isolation/package;
H. phase boundary/version/history.

Use P7 direct evidence rather than inventing live reruns. Write `closeout.md` and mark Phase 5 eligibility only if all gates justify it.

## Scope guard

No Phase 5 central visual canvas, Planning Map work ontology, Agent Mind, general chat, tool execution, autonomous source mutation, scoped delegation, DevelopmentSession, bundled inference engine, cloud-provider requirement or Theia upgrade.
