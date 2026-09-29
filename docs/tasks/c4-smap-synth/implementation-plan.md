# Correction 4 Implementation Plan — sMap Architecture Synthesis

Status: APPROVED / READY
Correction authority name: `c4-architecture-discovery`
Execution folder: `c4-smap-synth`
Prompt-authoring source: `067828fdd6db0149765e67c547158f63d7e55743`
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

## P1 — Synthesis contracts, lifecycle and strict proposal validation

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

## P2 — Deterministic ArchitectureEvidencePacket

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

## P3 — Local LM Studio/Qwen synthesis provider

### Boundary

Implement the first concrete adapter in the backend/application layer, not a new general Model Runtime subsystem.

Expected direction: a focused node-side LM Studio/OpenAI-compatible architecture synthesizer used through the provider-independent P1 interface.

Use Node 24 facilities and existing dependencies where practical; do not add a large AI SDK merely to issue the narrow HTTP calls.

### Connection/model setup primitives

Support:
- loopback/default LM Studio-compatible endpoint probing;
- explicit validated endpoint;
- model enumeration;
- reference-family selection/recognition for Qwen3-Coder-30B-A3B-Instruct while retaining the actual runtime model ID;
- optional bearer/token auth without requiring a key for ordinary local use.

Endpoint/model/auth are runtime/application config, not project state.

### Capability probe

Implement a tiny synthetic JSON-schema request proving endpoint + model + structured output + parsing. It contains no project evidence.

### Warm-up

Implement explicit `ensureWarm` behavior immediately before the first real synthesis request:
- tiny synthetic non-project request;
- per endpoint/model warm readiness;
- invalidate readiness on reconnect/failure/model change/known unload;
- no redundant warm-up for bounded follow-up calls while known warm.

Warm-up failure is a hard gate: synthesis must not send the ArchitectureEvidencePacket.

### Synthesis

Submit the ArchitectureEvidencePacket using the strict ArchitectureProposal schema. Validate the response with P1 domain validation before returning it.

Do not expose hidden reasoning or request chain-of-thought; only the structured rationale/evidence fields are product output.

### Tests

Use a controlled local mock HTTP server, not the real Qwen runtime, for permanent tests:
- model discovery;
- probe payload contains no project evidence;
- warm payload contains no project evidence;
- real packet follows successful warm-up;
- warm failure causes zero packet requests;
- bad status/timeout/invalid JSON/schema refusal/fabricated refs fail visibly;
- auth handling does not leak tokens into diagnostics;
- warm-state invalidation works.

## P4 — Initialization orchestration, persistence and canonical acceptance

### Initialization state

Introduce the durable project initialization representation authorized by ADR 0010, expected as readable `.dope/smap.json` schema 1.

The marker stores only durable initialization metadata needed to identify an accepted initialized sMap. It must not store provider/model config, decline state, evidence packets or proposals.

Missing marker means uninitialized even if a legacy/manual `.dope/architecture.json` exists. That existing declaration must be offered as an explicit developer/manual path rather than silently accepted.

### Backend orchestration

Extend the typed Software Map service/backend with bounded operations for:
- initialization status;
- start synthesis initialization with a supplied user/application provider selection;
- cancel/reset transient review;
- fetch current transient review proposal/packet facts as needed;
- accept a developer-corrected review draft;
- explicitly initialize from an existing/manual valid architecture declaration;
- refresh Physical Map only after initialization.

Start initialization:
1. requires explicit frontend invocation;
2. collects deterministic evidence without publishing a map;
3. ensures provider warm;
4. synthesizes/validates proposal;
5. supports only the bounded refinement policy;
6. enters transient `review_required`;
7. writes no canonical files.

Failure/cancel clears transient packet/proposal and leaves the project uninitialized.

### Review draft and roots

Create a transient review draft that converts proposal hierarchy into developer-editable canonical candidates.

The model does not invent canonical IDs or roots. Seed root/path suggestions only from deterministic packet facts that explicitly support them. The developer may edit IDs, names, purposes, parentage and roots.

Acceptance must run the existing strict ArchitectureDeclaration parser before writing.

### Safe acceptance

Implement a failure-aware canonical write for `.dope/architecture.json` plus `.dope/smap.json`:
- validate expected prior architecture bytes/fingerprint to prevent stale overwrite;
- use contained no-follow/realpath discipline;
- stage writes and handle partial failure with bounded rollback/recovery;
- never claim initialized unless both canonical declaration and marker are coherent;
- preserve original bytes on rejected/conflicting acceptance.

After successful acceptance, run/publish the Physical Map and realization/drift against canonical architecture.

### Existing/manual declaration path

If a valid architecture declaration already exists while the marker is absent, expose a deliberate “use existing architecture” path. Validate it and write only the initialization marker when accepted; do not rewrite the declaration gratuitously.

Greenfield/manual initialization must work with no model.

### Tests

Cover no-write decline/cancel, warm/synthesis failure, stale proposal, external declaration edit conflict, marker corruption/recovery, partial acceptance rollback, existing-declaration acceptance, missing declaration, second-root isolation, transient review isolation and successful post-accept Physical Map publication.

## P5 — Analyze Project onboarding, local setup and proposal review UI

### Initialization UX

Replace the old unconditional Analyze/Refresh first-use behavior with:
- automatic first-open offer for an uninitialized single local project: Analyze Project? / Not now;
- declining performs no backend analysis/write;
- suppress repeated automatic nagging within the appropriate user/session presentation state without storing decline in the project;
- uninitialized sMap empty state always provides **Analyze Project** to reopen the same flow;
- initialized state keeps ordinary Refresh behavior.

Do not silently analyze from widget construction, workspace attachment or layout restoration.

### Local setup inside the flow

When synthesis is chosen but no usable connection/model is selected:
- probe the local LM Studio default;
- discover models;
- prefer/show Qwen3-Coder-30B-A3B-Instruct when available;
- allow explicit compatible model choice and manual endpoint;
- persist endpoint/model as user/application preference using supported Theia preference/application state APIs;
- keep optional auth secret out of canonical project files and do not persist it insecurely merely for convenience;
- run/display the capability probe before readiness.

Keep the user in the Analyze Project flow.

### Review UI

When `review_required`:
- render proposed System -> Subsystem -> Component hierarchy;
- show numeric confidence as a confidence signal, not probability;
- show rationale;
- show human-readable `evidence`;
- separately expose hard `evidenceRefs` with drill-down/source navigation;
- show open questions/unassigned evidence honestly;
- provide practical correction controls sufficient for confirm/rename/reparent/add/remove/replace and for merge/split semantics through explicit node/child movement operations;
- expose/edit canonical ID and implementation-root draft fields before acceptance;
- visibly block acceptance on invalid canonical declaration state;
- accept only through the typed backend operation;
- provide cancel without persistence.

Do not build the Phase 5 central visual graph canvas.

### Existing/manual architecture

For an uninitialized project with a valid existing declaration, offer a clear developer-controlled path to initialize from it.

Provide a bounded manual/greenfield architecture editor path that can create a valid canonical hierarchy without invoking a model.

### Permanent tests

Extend controller/widget tests for:
- no auto-analysis on attach;
- decline/no-write UI;
- stale workspace/provider/proposal responses cannot render into another root;
- preference/provider selection is not project state;
- review hierarchy/edit validation;
- evidence prose versus hard refs;
- accept/cancel states;
- existing/manual path;
- keyboard/accessibility basics.

P6 owns direct browser qualification.

## P6 — Real LM Studio/Qwen dogfooding and corrected package qualification

Browser required.

Use the real browser-hosted Dope workbench against the real Dope repository and the user's local LM Studio server.

Require the reference model family Qwen3-Coder-30B-A3B-Instruct. Record the exact model ID returned by the runtime; do not silently substitute a cloud model or different family.

### Controlled repository setup

Record exact Git state and bytes/hashes of `.dope/architecture.json` and any preexisting `.dope/smap.json`.

Exercise the new uninitialized synthesis workflow independently from the existing Phase 4 declaration. Any temporary move/backup/edit of project-local architecture state must be controlled and restored byte-for-byte before prompt completion unless the owner explicitly changes that requirement outside this prompt.

### Direct matrix

Prove in the actual GUI:
- uninitialized prompt appears;
- Not now leaves no map/marker and sMap empty state offers Analyze Project;
- LM Studio endpoint/model discovery or explicit configuration works;
- structured-output probe runs without project evidence;
- pre-synthesis warm-up occurs before the real packet request;
- real Dope packet is synthesized by Qwen into valid proposal JSON;
- proposal contains meaningful System/Subsystem/Component candidates with valid hard evidence refs;
- confidence/rationale/human-readable evidence render;
- hard refs drill to deterministic/source evidence;
- correction controls work, including reparent/add/remove and a merge/split-equivalent child movement path;
- invalid draft cannot be accepted;
- explicit acceptance creates coherent canonical state and then publishes/reconciles a Physical Map;
- restart/reopen recognizes initialized state and ordinary Refresh works;
- manual/existing declaration path is usable;
- Project Mind/ordinary IDE remains intact.

Also exercise a controlled warm-up failure using a reversible bad/unavailable connection and prove no project packet is submitted.

Do not score Qwen against an invented “correct” architecture. Record concrete proposal contents, valid provenance and any obvious ambiguity/open questions. The developer remains architecture authority.

### Package/restart

Run aggregate checks/restart and build/inspect the corrected `0.4.6` AppImage. Record composition and native readiness where the environment allows.

Create `docs/tasks/c4-smap-synth/P6-smap-synth-evidence.md` with exact source/model/runtime identity, request ordering evidence, proposal summary, UI observations, controlled failures, restart/package evidence and final restored Git/project state.

Any product repair during P6 requires permanent regression coverage and replay of affected evidence.

## P7 — Evidence-only closeout

Audit the exact P6 candidate; do not repair.

Assess Green / Not Green / Evidence Gap:

A. initialization consent/state;
B. deterministic evidence packet/verifiability;
C. provider independence + LM Studio/Qwen reference;
D. probe/warm/project-evidence ordering and failure gate;
E. strict proposal validation/provenance;
F. developer review/canonical acceptance/manual path;
G. Physical Map reconciliation/isolation/restart/package;
H. phase boundary/version/history preservation.

Rerun deterministic checks only. Use P6 direct evidence rather than inventing GUI/model reruns.

Write `closeout.md`, update README status only if justified, and state Phase 5 eligibility.

## Scope guard

No Phase 5 central visual canvas, Planning Map work ontology, Agent Mind, general chat, tool execution, autonomous source mutation, scoped delegation, DevelopmentSession, bundled inference engine, cloud-provider requirement or Theia upgrade.
