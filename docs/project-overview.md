# Dope Project Overview

Status: INITIAL PRODUCT CONTRACT

This document is the compact routing contract for Dope's product identity. Deeper authority lives in VISION.md, PRINCIPLES.md, PRODUCT-MODEL.md, ARCHITECTURE.md, THEIA-SPIKE.md, and the accepted ADRs.

## Single-sentence definition

Dope is a software-map-centered AI-native development environment that keeps the developer at the center of engineering, combining a full IDE with a deterministic living Software Map (sMap), subsystem-first architecture, visual planning tied directly to implementation, durable project knowledge, visible AI collaboration, and scoped automation so developers can accomplish dramatically more without giving up understanding, authorship, skill, or the satisfaction of building software themselves.

## Why Dope exists

Modern coding agents can own too much of the cognitive development loop: understanding the system, making implementation decisions, discovering constraints, writing code, testing, and returning a finished result.

That increases output but can reduce the developer's connection to and understanding of the software.

Dope explores a different relationship: AI as a programming exoskeleton.

## North star

> At the end of a four-hour session, the developer should understand the software better than they did when they started, while accomplishing dramatically more than they could alone.

The environment must also ensure that the understanding survives the session as durable project knowledge.

## Product laws

1. Developer as protagonist.
2. Visible useful agent working state, not raw hidden reasoning.
3. Continuous steering during work.
4. Ambient intelligence that watches the developer's back without constant interruption.
5. Scoped delegation and explicit ownership.
6. Conceptual observability before file-level diff inspection.
7. Passive Ideas capture without task derailment.
8. A living, evidence-backed software map organized around systems and subsystems.
9. Persistent development context for the developer.
10. Friction removal without skill removal.
11. Planning, research, decisions, tasks, implementation, validation, and history live in one integrated environment.

These eleven pillars remain the product pillars. Framework and model/provider independence are cross-cutting architecture constraints rather than additional pillars.

## Core inversion

> The AI should inhabit the IDE. The IDE should not inhabit the AI chat.

The software project is the center of gravity. Source code and direct manipulation remain authoritative implementation surfaces.

## Core Software Map

Dope models software primarily as:

Project
-> System
-> Subsystem
-> Component
-> Code

The **Software Map (sMap)** is Dope's architecture representation.

Its initialization and authority model is:

Uninitialized project
-> explicit Analyze Project consent
-> deterministic repository / semantic / framework evidence
-> synthesis provider/model readiness
-> deterministic global evidence planning / architecture skeleton
-> System Discovery
-> System Challenge (merge / split / reject)
-> per-System Subsystem / Component refinement
-> reconciliation / targeted verification
-> proposed System / Subsystem / Component map
-> developer review and correction
-> explicit acceptance
-> canonical architecture
-> continuous implementation realization / drift analysis

**Analysis is opt-in; synthesis proposes; the developer owns architecture.** Opening a new repository in Dope does not silently build an sMap. If the developer declines the initial analysis offer, the project remains uninitialized and the sMap tab provides an Analyze Project action for later use.

The developer may also define architecture before code exists. In an existing project, LLM-generated boundaries remain proposals until the developer accepts or corrects them. Deterministic evidence never becomes canonical architecture merely because it was observed, AI output never becomes canonical merely because it was generated, and canonical declarations never erase contrary implementation evidence.

ADR 0011 makes the first sMap synthesis path local-first: LM Studio with Qwen3-Coder-30B-A3B-Instruct is the reference implementation, while the Dope contracts remain provider-independent. Setup performs a synthetic structured-output probe and the selected model is warmed with non-project data immediately before the first real synthesis request. ADR 0012 then makes the forward synthesis workflow hierarchy-first and multi-call: global System discovery/challenge comes before per-System descent, bounded model-facing evidence views preserve deterministic provenance, and the user sees live stage/call-purpose progress. The current Qwen qualification setup uses 65,536 loaded context as headroom rather than a request-size target. If warm-up fails, Dope does not submit project evidence.

The **Physical Map** describes current implemented reality mapped against canonical architecture. It distinguishes declared-only, detected-only, realized, drifted and unassigned implementation state, with provenance sufficient to explain the result.

The **Planning Map** arrives in Phase 5 and references canonical/physical identities to express proposed target-state transformations. The normalized graph remains an internal/query substrate; “map” is the product vocabulary. Planning views do not duplicate current architecture into disconnected drawings.

Semantic zoom is architectural rather than merely graphical: System -> Subsystem -> Component -> package/module/service -> file/symbol -> syntax/semantic source relationships.

The core loop is:

Discover / define architecture
-> Understand current realization
-> Design target system
-> Plan transformations
-> Implement
-> Re-analyze
-> Reconcile

AI may reason over this map and propose changes, but it does not silently manufacture physical software facts or canonical architecture.

## Project Mind

Project Mind is the developer-facing durable memory of the software project.

It is implemented by Dope-owned Project Intelligence and must remain useful even when no AI provider is configured.

Early Project Mind starts with:
- Note
- Idea
- Question
- Decision

Future Visual Software Planning builds on that durable knowledge later; its work ontology is intentionally deferred until the graph-centered design.

## Build + Think

BUILD includes:
- editor
- terminal
- debugger
- tests
- source control
- runtime
- AI execution when delegated
- review

THINK includes:
- notes
- ideas
- questions
- research
- decisions
- planning
- architecture
- exploration

These are views into the same project.

## Session over prompt

The development session is the fundamental interaction unit.

A session can include manual coding, AI-assisted coding, delegated work, research, decisions, plan changes, tests, runtime inspection, ideas, and review.

Durable development state must not be trapped inside chat history.

## Model and provider independence

Dope must not be married to any model, model family, provider, hosted service, local runtime, or provider-native chat/session format.

First-class compatibility targets include:
- OpenAI / ChatGPT / Codex workflows and capabilities
- local models and local inference runtimes
- future providers through replaceable capability-based adapters

Project Mind, Agent Mind, Sessions, Decisions, Authority, and Validation are Dope-owned state. Phase 3 Plans/PlanSteps/Tasks are Dope-owned state for the qualified `0.3.6` implementation, but are not guaranteed as the forward planning ontology.

Provider-specific IDs, context formats, sessions, and capabilities remain adapter concerns.

Provider abstraction must not force every model into a lowest-common-denominator feature set.

## Initial roadmap

The initial sequence is intentionally conservative:

Foundation Spike 0 — qualify Theia
-> Phase 1 — IDE Alive
-> Phase 2 — Project Mind
-> Phase 3 — Planning Foundation
-> correction c3 — remove Planning instruments
-> Phase 4 — Physical Map
-> correction c4 — architecture discovery + developer authority
-> correction c4-hierarchical — hierarchy-first synthesis + visible progress
-> correction c4-storage — enforce project-local sMap persistence
-> Phase 5 — Visual Software Planning
-> Phase 6 — AI Presence
-> Phase 7 — Scoped Delegation
-> Phase 8 — Development Sessions

Phase 3 is a completed provider-free planning experiment/product increment. Its live Planning instruments were removed by completed correction `c3-remove-planning-instruments`. Phase 4's approved Physical Map scope is Qualified/Green at committed `0.4.6` (`fac88712bb55176d3d6d54fbe6034de8b0f801ff`). ADR 0009 requires correction `c4-architecture-discovery` at unchanged `0.4.6`. Its already-running `c4-smap-synth` P6-P8 prompts remain unchanged. After that stack closes, ADR 0012 requires `c4-smap-hierarchical-synthesis` at unchanged `0.4.6`; only after that closes Green does bounded `c4-smap-storage` enforce the project-local `.dope/` sMap persistence boundary before Phase 5 planning or activation.

## Non-goals

Do not drift into:
- chatbot-first UX
- agent-as-protagonist UX
- maximizing the percentage of code written by AI
- hiding architecture decisions for convenience
- giant black-box autonomous runs as the default
- project knowledge being synonymous with chat history
- notes/plans as secondary disconnected markdown
- agent runtime coupled to Theia UI
- Project Intelligence coupled to framework internals
- model/provider state becoming canonical product state
- an early Theia fork
- rebuilding commodity IDE functionality
- constant AI interruption
- mandatory explanations
- assuming automation is always preferable to direct coding

Autonomous implementation remains a supported capability, not the premise of the product.

## Emotional direction

Curiosity -> Understanding -> Capability -> Momentum -> Accomplishment -> Pride

> Leave every session more capable than you entered it.

Desired completion feeling:

> I built that. I understand it. I got somewhere today.

## Current gate

**Product Phase 4 — Physical Map is Qualified/Green at committed `0.4.6` (`fac88712bb55176d3d6d54fbe6034de8b0f801ff`) for its approved scope. Phase 5 is not activated.**

The mandatory current gate is correction `c4-architecture-discovery` at unchanged `0.4.6`. It must preserve the Phase 4 semantic analyzer/evidence substrate while adding explicit sMap initialization, opt-in analysis, bounded provider-independent LLM architecture synthesis over deterministic evidence, local LM Studio/Qwen reference qualification with capability probing and pre-synthesis warm-up, proposal provenance, developer review/correction and acceptance, greenfield/manual architecture-before-code support, and implementation realization/drift reconciliation. ADR 0009 as amended by ADR 0010 governs the base architecture contract; ADR 0011 governs the local-first reference bootstrap; ADR 0012 governs the required follow-on hierarchical orchestration, visible progress and quality/performance gates.

The already-running `c4-smap-synth` P6-P8 prompts are not changed by this documentation update. After that stack closes, `c4-smap-hierarchical-synthesis` becomes the next mandatory pre-Phase-5 gate. It must replace one-shot synthesis as the intended design with global System Discovery, System Challenge, per-System descent, reconciliation/targeted verification, bounded provider-aware evidence views, visible progress/timing and an eight-minute initial-analysis qualification objective that does not hard-cancel slower runs. After that closes Green, `c4-smap-storage` becomes the final mandatory pre-Phase-5 gate. It must prove that durable sMap state is recoverable from repository + project-local `.dope/`, with `.dope/architecture.json` and `.dope/smap.json` as the current required files; any additional persisted sMap artifacts must remain under versioned `.dope/` storage. Machine-local caches may be disposable accelerators only.

Historical Phase 1/2 qualification gaps remain unchanged. Phase 3 remains historical evidence and its live Planning implementation remains removed. Theia stays pinned to 1.75.0 and Electron to 42.8.1 unless a deliberate framework upgrade is separately approved.

Phase 5 Visual Software Planning, general AI Presence/model integration, Agent Mind, tool execution, AI mutation, scoped delegation and durable development sessions remain blocked behind their roadmap gates. ADR 0010 authorizes only the narrow pre-Phase-6 architecture-synthesis capability required by sMap initialization, and ADR 0011 selects its first local reference implementation without superseding ADR 0006 for Phase 6.

## Phase 3 result — live human-first Planning

Phase 3 added Plan, PlanStep and Task as canonical planning state for the qualified `0.3.6` implementation. Correction `c3-remove-planning-instruments` now removes those live contracts and their runtime/presentation/persistence before Phase 4. Their qualification remains historical evidence only. Plans carry objective/context/status, ordered live steps and human-visible revision/history. Tasks are bounded units of work attached to plan steps, with requirements/constraints, project-relative working-set files, Project Mind links, status, completion notes and developer-entered validation notes.

Planning remains useful with no model configured. Project Mind and Planning stay separate domain boundaries: Project Mind stores durable knowledge; Planning stores execution intent. Planning references Project Mind artifacts by stable ID instead of converting or duplicating them. Creating a Plan from a Decision creates a new Plan linked back to the Decision; it does not mutate the Decision into work.

Planning persists in readable `.dope/planning.json` with its own optimistic document revision and mutation lock. It uses the existing Project Mind `projectId` and must reject mismatched identity. If Project Mind has no canonical identity yet, Planning surfaces the prerequisite rather than inventing a second identity. UI drafts, selection, filters, mode and layout remain presentation state.

BUILD/PLAN mode may foreground the appropriate work surface but is not canonical Plan/Task status. Task file links open the ordinary editor; coding, terminal, tests, SCM and debugger stay normal IDE workflows.

ADR 0006 records Codex/OpenAI as the first reference AI implementation for Phase 6 so the future agent/runtime design is proven against a capable system before local-model limits are diagnosed. That is a bootstrap/qualification strategy only. Phase 3 contains no provider runtime code and preserves first-class future local-model compatibility.
