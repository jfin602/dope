# Correction 4 Implementation Plan — Hierarchical sMap Synthesis

Status: **APPROVED / READY**
Correction folder: `c4-smap-hierarchical-synthesis`
Required unchanged package version: `0.4.6`
Predecessor: `c4-smap-synth` owner-closed / Not Qualified at terminal source `0f94b0e3ba46e395394acdb5badc00dd092b37d0`
Authority: ADR 0012 plus ADR 0009/0010 developer/evidence authority and ADR 0011 local reference path

## Preflight for every prompt

Read:
- BOOT.md and AGENTS.md;
- ADR 0009, 0010, 0011 and 0012;
- current ARCHITECTURE, PRODUCT-MODEL, project-overview, roadmap and software-map-storage;
- predecessor assessment/plan/P7 evidence/owner closeout;
- this assessment/plan;
- all earlier prompts/results in this correction.

Require:
- package exactly `0.4.6`;
- terminal predecessor `0f94b0e3ba46e395394acdb5badc00dd092b37d0` reachable in history;
- clean intended Git state apart from runner-owned changes;
- Node 24;
- Theia 1.75.0 / Electron 42.8.1;
- no root package-lock;
- Phase 5 remains inactive.

Do not treat the predecessor's one-shot provider API/prompt as a compatibility contract. Preserve useful deterministic evidence, onboarding, provider readiness, canonical acceptance and provenance behavior unless a concrete defect requires repair.

## P1 — Hierarchical synthesis contracts, budgets and progress events

Refactor the provider-independent synthesis boundary so architecture analysis can express distinct bounded stages instead of one `synthesize(packet)` call.

Define strict contracts for:
- provider synthesis capability/context budget;
- deterministic parent-packet evidence views/slices;
- stage identity/version;
- System Discovery candidate output;
- System Challenge output;
- per-System subtree output;
- reconciliation/verification output as needed;
- progress events and safe progress metadata;
- final ArchitectureProposal assembly/validation.

Keep all model output untrusted and proposal-class.

Do not couple Software Map contracts to LM Studio/Qwen or a fixed 65,536 context.

Permanent tests validate schemas, stage/result identity, parent evidence reference integrity, invalid stage transitions and progress-event safety.

## P2 — Deterministic evidence planner and global skeleton

Implement deterministic stage-specific evidence planning above ArchitectureEvidencePacket.

Preserve the complete packet untouched.

Build a compact repository-global System-discovery skeleton and functions for later candidate/System scopes.

Budget using provider-supplied input/context capability plus reserved instruction/output/overhead. Never truncate a JSON/fact mid-item.

The planner must be stable: same packet + planner version + budget => same slice identity/order.

Test oversized packets, tiny budgets, whole-item guarantees, parent refs, production-vs-test signal prioritization and no hidden declaration leakage.

## P3 — Repository-global System Discovery

Implement one focused stage that proposes only top-level Systems from the global skeleton.

Prompt/contract defines System semantically and explicitly rejects directory/package/framework/browser/electron/persistence promotion without independent architectural responsibility.

Do not impose a fixed System count.

Every candidate carries directly relevant deterministic evidence refs plus uncertainty/counter-signals required by the stage contract.

Use controlled provider tests and architecture fixtures.

Do not descend to Subsystems yet.

## P4 — System Challenge

Implement a second independent stage that tests the P3 candidates.

For each candidate or candidate group, allow explicit:
- keep;
- merge;
- split;
- reject.

Challenge input includes the candidate set plus bounded supporting, counter and cross-boundary deterministic evidence.

Add fixtures where P3-style candidates are deliberately wrong and prove P4 changes them.

Do not silently accept malformed/unsupported challenge decisions.

## P5 — Per-System Subsystem/Component discovery

For each challenged System, build a deterministic focused evidence scope and synthesize its Subsystems and Components.

The stage may use multiple calls but must remain bounded.

Prevent:
- parent references outside the challenged System;
- duplicate ownership across System scopes;
- package/folder promotion without responsibility evidence;
- fabricated parent evidence refs.

Introduce provider-aware scheduling. Independent calls may parallelize only when explicitly safe; local LM Studio/Qwen defaults to bounded serial generation unless qualified otherwise.

## P6 — Reconciliation, targeted verification and bounded reuse

Combine challenged Systems and per-System subtrees.

Detect duplicate/cross-System ownership, contradictory parents and unresolved cross-boundary relationships.

Run reconciliation and only bounded targeted verification for material uncertainty. Verification count and refinement count must have explicit hard bounds independent from the eight-minute performance objective.

Assemble the final ArchitectureProposal and validate all final refs against the complete parent packet.

Add deterministic stage/cache identities and safe reuse within the running application/process so unchanged work is not repeated unnecessarily. Do not create a new opaque durable project cache outside `.dope/`; c4-smap-storage remains the later persistence audit.

## P7 — Initialization orchestration and visible progress UI

Replace the backend one-shot initialization loop with the hierarchical pipeline.

Emit real provider-independent progress events from orchestration.

Wire frontend/controller/widget to show:
- current stage;
- current call purpose;
- applicable System subject;
- completed/known-total units;
- elapsed analysis time;
- retry/failure state;
- completed/queued stages.

Do not show raw prompts/chain-of-thought and do not invent percent complete when total future work is unknown.

Preserve explicit consent, warm-up gate, no-write decline/cancel, review/correction, manual/existing architecture and canonical acceptance.

Add cancellation/stale-project guards so late progress/results from project A cannot render in B.

## P8 — Real Qwen hierarchical dogfooding and performance qualification

Browser required.

Use the real Dope repository and real local LM Studio/Qwen reference model loaded with 65,536 context for the qualification setup.

The performance clock starts at Analyze Project invocation with setup/probe already complete and ends when the review-ready proposal is rendered. It includes warm-up if required, evidence collection/planning, all model calls, reconciliation/verification and final review delivery.

Record every stage/call elapsed time plus end-to-end elapsed time.

Do not cancel solely at eight minutes. A >8-minute run may complete and provide evidence but is Not Green on performance.

Directly assess System quality, challenge effect, Subsystems/Components, provenance, visible progress and developer correction/acceptance. Build/restart/package the exact final candidate.

Product repairs are allowed only for concrete observed defects/bottlenecks and require permanent regression coverage plus replay.

## P9 — Evidence-only correction closeout

Audit exact P8 evidence/candidate without repairing product behavior.

Disposition:
A. contracts/context budgeting;
B. deterministic evidence planning;
C. System Discovery quality;
D. System Challenge effectiveness;
E. per-System descent;
F. reconciliation/verification/ref integrity;
G. progress/cancellation/project isolation;
H. real local Qwen architecture quality;
I. <=8-minute performance objective without hard timeout;
J. developer authority/restart/package/phase boundary.

Only Green if architecture quality and performance both qualify.

If Green, route to `c4-smap-storage`; do not activate Phase 5 directly.

## Scope guard

No Phase 5 central visual Physical/Planning Map canvas, no graph-layout work, no general AI Presence/Agent Mind/chat/tool execution, no model voting/debate, no autonomous source mutation, no delegation, no DevelopmentSession, no cloud-provider requirement and no Theia upgrade.
