# Correction 4 Prompt Assessment — Hierarchical sMap Synthesis

Status: **APPROVED / READY**
Correction folder: `c4-smap-hierarchical-synthesis`
Required unchanged package version: `0.4.6`
Predecessor: owner-closed / Not Qualified `c4-smap-synth`, terminal source `0f94b0e3ba46e395394acdb5badc00dd092b37d0`
Authority: ADR 0009-0012; current BOOT/AGENTS/ARCHITECTURE/PRODUCT-MODEL/project-overview/roadmap/software-map-storage
Reference runtime: local LM Studio + Qwen3-Coder-30B-A3B-Instruct family
Current qualification load target: 65,536 context tokens, runtime configuration only

## Conclusion

Use nine ordered prompts at unchanged `0.4.6`:

1. hierarchical synthesis contracts, context budgets, stage schemas and progress events;
2. deterministic evidence planner and repository-global architecture skeleton;
3. repository-global System Discovery;
4. System Challenge with explicit merge/split/reject semantics;
5. per-System Subsystem/Component discovery;
6. cross-System reconciliation, targeted verification and bounded cache/reuse;
7. initialization orchestration plus visible analysis progress UI;
8. direct real-Qwen Dope-on-Dope architecture-quality/performance qualification;
9. evidence-only correction closeout.

The first implementation remains **multi-call, not multi-model**. All architecture reasoning may use the selected provider/model. Do not add model voting, agent debate, recursive unlimited decomposition or autonomous retrieval.

## Why the predecessor cannot be tuned in place

The predecessor's core synthesis interface is still one-shot:

`ArchitectureSynthesisProvider.synthesize(packet)`

The backend `startInitialization()` calls that operation against the whole packet and only loops for bounded evidence refinement.

The LM Studio adapter currently:
- sorts the complete packet by broad evidence kind;
- aliases paths/evidence IDs;
- removes some verbose fields;
- submits one `architecture_proposal` request;
- asks one response to infer Systems, Subsystems and Components together.

P7 proved this can be schema-valid and still architecturally poor. The successful real response reduced Dope to Browser/Electron root Systems and produced no lower hierarchy.

That is the exact defect ADR 0012 addresses.

## Current source findings

### Evidence substrate is useful and should be preserved

`@dope/software-map` already owns:
- ArchitectureEvidencePacket;
- ArchitectureProposal;
- strict proposal validation;
- packet-local evidence references;
- proposal-only identity;
- bounded evidenceRequests.

`@dope/code-analysis` already produces source-backed topology, configuration, entrypoint, dependency, semantic and framework facts with deterministic identity/provenance.

P7 recorded a real Dope packet of roughly 426 facts / 215 KB before provider compaction. The new correction must not reduce or corrupt the complete deterministic evidence store merely to fit a model request.

### Provider API is too coarse

The current provider boundary exposes one `synthesize(packet)` operation. It has no stage-aware request type, provider context capability contract, deterministic input-budget contract or stage result identity.

The current local adapter also has a fixed architecture prompt and one final ArchitectureProposal schema. This prevents Dope from treating System discovery as a separately testable architectural problem.

### Orchestration is opaque while running

The backend currently exposes initialization lifecycle state but no typed analysis-progress stream. `startInitialization()` returns only when review is ready or the call fails.

The controller has a generic `setupBusy` flag. The widget currently reports only a generic message such as "Software Map initialization in progress."

The user cannot see:
- whether deterministic evidence is still collecting;
- whether System Discovery or System Challenge is active;
- which System is being refined;
- how many known per-System passes are complete;
- which stage failed/retried;
- where elapsed time is being spent.

### Runtime context is configuration, not product state

The real P7 overflow was against a model loaded at 32,768. The current development configuration is being raised to 65,536.

Do not hardcode 65,536 into Software Map contracts. The provider adapter must expose/accept a usable context/input capability and the planner must operate under that capability while reserving room for instructions/output/overhead.

Exact tokenizer support may vary by provider. The product contract should allow a provider-supplied estimator/counter or conservative bounded estimator without coupling Software Map to Qwen tokenizer packages.

### Eight-minute objective needs measurable semantics

For qualification, the initial-analysis stopwatch begins when the already-configured user invokes **Analyze Project with selected model** / backend initialization and ends when the review-ready proposal is delivered/rendered.

The clock includes:
- pre-real-call warm-up if the selected runtime is not already known warm;
- deterministic evidence collection;
- global skeleton/evidence planning;
- all System Discovery/Challenge calls;
- all per-System descent calls;
- reconciliation/targeted verification;
- final proposal validation and review delivery.

It excludes the interactive provider/model discovery and structured-output capability probe that must already be complete before the Analyze action is enabled.

Eight minutes is a Green/Not Green performance gate, **not a cancellation timer**.

## Architectural decisions for the stack

### 1. Full evidence remains complete

ArchitectureEvidencePacket remains the complete deterministic evidence authority.

Each model call receives a deterministic stage-specific view/slice that:
- references the parent packet fingerprint;
- carries original evidence IDs/provenance;
- contains whole facts;
- has deterministic ordering and identity;
- stays within a provider-derived request budget;
- never invents evidence.

### 2. System detection gets repository-global context

System Discovery gets a compact global skeleton emphasizing:
- workspace/application topology;
- deployable/runtime/entrypoint boundaries;
- framework bootstraps;
- dependency communities/direction;
- public contracts;
- data/state ownership where deterministically available;
- selected representative semantic facts.

Do not force a target System count. The predecessor's "1-2 Systems" style prompt is explicitly rejected.

A System is not automatically a package, folder, framework, persistence layer, browser variant or Electron variant.

### 3. Challenge is an independent stage

System Challenge receives initial candidates plus supporting/counter/cross-boundary evidence and must explicitly keep, merge, split or reject candidates.

Permanent tests need fixtures where the first pass is intentionally wrong so the challenge stage's effect is observable.

### 4. Descend after Systems stabilize

Per-System passes discover Subsystems and Components only inside an established candidate System context.

Independent per-System calls may run concurrently only when provider capability/configuration says doing so is safe. The local LM Studio/Qwen reference path should default to bounded serial generation unless direct evidence qualifies concurrency.

### 5. Verification is bounded

Targeted verification only runs for material unresolved boundaries and is explicitly capped. It must not become an agent loop.

### 6. Intermediate outputs remain derived

No intermediate System candidate/challenge/subtree result is canonical architecture.

Only the final validated ArchitectureProposal enters review; only explicit developer acceptance creates canonical architecture.

### 7. Progress is structured, not model reasoning

Progress events expose workflow state, not hidden chain-of-thought.

Expected stages:
- collecting-evidence;
- planning-evidence / building-skeleton;
- system-discovery;
- system-challenge;
- subsystem-discovery;
- reconciliation;
- verification;
- preparing-review;
- complete/failed/cancelled.

Safe metadata includes subject, known unit counts, attempt, provider/model label and elapsed time.

## Main risks

- **Over-decomposition:** too many serial local-model calls can improve focus but violate the eight-minute goal.
- **Fake progress:** frontend-only timers/stages can drift from real backend work.
- **Context-budget fiction:** byte limits alone do not prove token safety.
- **Evidence loss:** lossy compaction can sever provenance or remove decisive architecture signals.
- **Count bias:** forcing a target number of Systems can reproduce the predecessor defect.
- **Infrastructure promotion:** framework/runtime/persistence facts can be incorrectly promoted to Systems.
- **Challenge rubber-stamp:** a second call that merely restates discovery is not a meaningful challenge.
- **Cross-System inconsistency:** independent subtree calls can duplicate ownership or contradict each other.
- **Unbounded verification:** uncertainty follow-ups can explode runtime.
- **Cache staleness:** reuse must include packet/stage/prompt/provider identity and fail closed on mismatch.
- **Provider coupling:** context/runtime metadata must stay behind provider capability boundaries.
- **Phase creep:** no Phase 5 central visual canvas, general Agent Runtime, chat, tools or multi-model orchestration.

## Qualification decision

The correction is ready to execute from the exact owner-closed predecessor source.

Success requires both:
1. **architecture quality** — the real Dope proposal has materially credible System boundaries and meaningful Subsystem descent; and
2. **performance** — the defined end-to-end initial-analysis interval is <=8 minutes on the qualification setup.

A >8-minute run must finish rather than being killed solely by the performance objective. It is useful evidence but Not Green on performance.
