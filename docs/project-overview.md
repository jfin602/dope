# Dope Project Overview

Status: INITIAL PRODUCT CONTRACT

This document is the compact routing contract for Dope's product identity. Deeper authority lives in VISION.md, PRINCIPLES.md, PRODUCT-MODEL.md, ARCHITECTURE.md, THEIA-SPIKE.md, and the accepted ADRs.

## Single-sentence definition

Dope is a software-map-centered AI-native development environment that keeps the developer at the center of engineering, combining a full IDE with a living evidence-backed Software Knowledge Model projected through the Software Map (sMap), subsystem-first architecture, visual planning tied directly to implementation, durable project knowledge, visible AI collaboration, and scoped automation so developers can accomplish dramatically more without giving up understanding, authorship, skill, or the satisfaction of building software themselves.

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
-> Edit Architecture review and correction
-> explicit acceptance
-> canonical architecture
-> continuous implementation realization / drift analysis

**Analysis is opt-in; synthesis proposes; the developer owns architecture.** Opening a new repository in Dope does not silently build an sMap. If the developer declines the initial analysis offer, the project remains uninitialized and the sMap tab provides an Analyze Project action for later use.

**Architecture** is the canonical user-facing term for the System -> Subsystem -> Component structural organization and editing experience. Hierarchy remains a valid technical description of that structure and of hierarchy-first synthesis, but it is not a competing workspace/action name. The permanent **Edit Architecture** center tab is used both to accept initial proposals and to edit already accepted architecture.


The developer may also define architecture before code exists. In an existing project, LLM-generated boundaries remain proposals until the developer accepts or corrects them. Deterministic evidence never becomes canonical architecture merely because it was observed, AI output never becomes canonical merely because it was generated, and canonical declarations never erase contrary implementation evidence.

ADR 0011 makes the first sMap synthesis path local-first: LM Studio with Qwen3-Coder-30B-A3B-Instruct is the reference implementation, while the Dope contracts remain provider-independent. Setup performs a synthetic structured-output probe and the selected model is warmed with non-project data immediately before the first real synthesis request. ADR 0012 then makes the forward synthesis workflow hierarchy-first and multi-call: global System discovery/challenge comes before per-System descent, bounded model-facing evidence views preserve deterministic provenance, and the user sees live stage/call-purpose progress. The current Qwen qualification setup uses 65,536 loaded context as headroom rather than a request-size target. If warm-up fails, Dope does not submit project evidence.

The **Physical Map** describes current implemented reality mapped against canonical architecture. It distinguishes declared-only, detected-only, realized, drifted and unassigned implementation state, with provenance sufficient to explain the result.

The **Planning Map** is activated in Phase 5 and references canonical/physical identities to express proposed target-state transformations. It records the architecture/Physical Map basis it branched from, becomes visibly stale when that basis changes, and requires explicit conflict-aware rebase. Editing a Planning Map does not mutate canonical architecture; **Adopt Target** is explicit. The normalized graph remains an internal/query substrate, “map” is the product vocabulary, and canvas geometry is presentation state rather than architectural truth.

Semantic zoom is architectural rather than merely graphical: System -> Subsystem -> Component -> package/module/service -> file/symbol -> syntax/semantic source relationships.

The map must practice progressive disclosure rather than rendering all known structure and relationships at once. Default architecture reading is hierarchy-first; deeper detail appears through bounded zoom/focus context. At a deliberately lower LOD a label may be omitted entirely, but any identity label that is shown must be complete rather than ellipsized or clipped. Selecting/focusing architecture promotes only the relevant dependency neighborhood while the left sMap inspector provides provider-free responsibility, relationship, evidence and source detail. Breadcrumbs plus Focus / Up / Fit Architecture preserve orientation.

Developer-chosen node colors are project-scoped presentation metadata used only to reinforce visual organization. They must remain theme-aware and readable, must not replace hierarchy/shape/edge semantics, and must never affect canonical identity, deterministic evidence, Physical Map realization, Planning Map meaning, staleness or reconciliation.

The core loop is:

Discover / define architecture
-> Understand current realization
-> Design target system
-> Plan transformations
-> Implement
-> Re-analyze
-> Reconcile

AI may reason over this map and propose changes, but it does not silently manufacture physical software facts or canonical architecture.

**Flow is the Phase 6 behavioral projection of the Physical Map.** It shows evidence-backed application-level execution such as resolved invocation, request/response boundaries, state reads/writes, event handoffs and external calls. It is not a compiler CFG. Proven data/type/schema information annotates Flow where available but is not required for a resolved invocation to appear.

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

A session can include manual coding, AI-assisted coding, delegated work, research, decisions, plan changes, tests, runtime inspection, ideas, review, and multiple durable Chats.

Phase 7 makes Chat history durable project context under `.dope/chats/` so useful conversation survives panel/app restart and can be found again. That does **not** make conversation synonymous with Project Mind or other canonical project truth. Decisions, Architecture, Planning intent, validation and implementation facts continue to use their own explicit product authorities.

## Model and provider independence

Dope must not be married to any model, model family, provider, hosted service, local runtime, or provider-native chat/session format.

First-class compatibility targets include:
- OpenAI / ChatGPT / Codex workflows and capabilities
- local models and local inference runtimes
- future providers through replaceable capability-based adapters

Project Mind, Agent Mind, Sessions, Decisions, Authority, and Validation are Dope-owned state. Phase 3 Plans/PlanSteps/Tasks are Dope-owned state for the qualified `0.3.6` implementation, but are not guaranteed as the forward planning ontology. Phase 7 Chats are also Dope-owned durable project context, but their transcript is not automatically canonical Project Mind/Architecture/Planning truth.

Provider-specific IDs, context formats, sessions, and capabilities remain adapter concerns. One Dope Chat may route different messages to different connected models without adopting any provider-native session as conversation identity.

Phase 7B adds **AI Center** as the one application-global management surface for provider/runtime connections and models, opened from the bottom-left AI launcher while account/profile management moves under Settings. The logical registry is machine-local, revisioned and shared across Dope projects/windows without becoming project state. Credentials use Environment, Session-only or OS secure storage; there is no plaintext persistent fallback.

Phase 7C adds five fixed roles—Interactive, Deep Reasoning, Background, Software Map and Coding Agent—over stable connection/model identities. Routing is deterministic preferred + ordered fallback with typed hard constraints and soft preferences rather than provider-name conditionals or hidden model scoring. Existing Phase 7A Chats keep exact defaults; new role-following Chats default to Interactive.

Global routing preference never grants feature authority: it may restrict egress but never authorize project-data egress. Software Map evidence transfer remains explicit, and Phase 8 background alignment remains local-only with no hosted fallback. Routed executions retain compact provenance sufficient for a **Why this model?** explanation. Provider abstraction must not force every model into a lowest-common-denominator feature set.

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
-> correction c4-gemini — compact shared Local/Gemini synthesis contracts
-> correction c4-synth-improvements — responsibility-oriented synthesis/review
-> correction c4-synth-coverage-review — coverage diagnostics + Search Deeper
-> correction c4-storage — enforce project-local sMap persistence
-> correction c4-color-theme — Dope Dark visual identity
-> Phase 5 — Visual Software Planning
-> correction c5-smap-readability — progressive disclosure and map readability
-> Phase 6 — Flow
-> correction c6-smap-outline — compact synchronized left Architecture outline
-> correction c6-edit-architecture — permanent Edit Architecture workspace
-> correction c6-branch-seam — synthesis strategy / Model Runtime seam
-> Phase 7A — AI Presence
-> Phase 7B — AI Center
-> Phase 7C — AI Roles & Routing
-> Phase 8 — Living Software Knowledge Model
-> Phase 9 — Scoped Delegation
-> Phase 10 — Development Sessions

Phase 8 turns the accepted Software Map into a continuously checked Living Software Knowledge Model before mutation-capable delegation begins. Source/runtime evidence, canonical map state, documentation and formal contracts become linked knowledge evidence; deterministic impact analysis runs first, while compact local-model semantic checks maintain alignment in the background and surface durable drift findings. Continuous monitoring is local-first and resource-aware; hosted inference is explicit escalation only and never a silent paid/background fallback.

Phase 3 is a completed provider-free planning experiment/product increment. Its live Planning instruments were removed by completed correction `c3-remove-planning-instruments`. Phase 4's approved Physical Map core remains Qualified/Green at committed `0.4.6` (`fac88712bb55176d3d6d54fbe6034de8b0f801ff`). The later architecture-synthesis corrections remain truthful owner-closed Not Qualified history with useful implementation retained; `c4-smap-storage` and `c4-color-theme` closed Green. Owner closeout advanced only the package baseline to `0.5.0` at `016bd8780e89081dfdb5746eae981183dc945baa`. Product Phase 5 — Visual Software Planning was subsequently owner-closed for sequencing with P11 still Not Green and P12 unexecuted; the retained implementation remains available without a retroactive Green claim. The owner-close transition established coherent `0.6.0` for Product Phase 6 — Flow under ADR 0020. The fresh provider comparison remains deferred; general AI Presence is Product Phase 7.

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

**Product Phase 6 — Flow is owner-closed for sequencing at package `0.6.8`; P8 remains Not Qualified.** The accepted exact-candidate G/H evidence gaps remain historical truth in `docs/tasks/p6/closeout.md`.

**Product Phase 7 is ACTIVE at coherent `0.7.0` activation commit `59c7f72`.** ADR 0025 defines Phase 7A; ADR 0026 now contains the fully promoted Phase 7B AI Center and Phase 7C deterministic role-routing contracts. Execute the currently written P1-P12 as 7A only; the existing P13 closeout remains superseded and must be regenerated as part of the P13+ continuation after P12. Mutation/delegation authority remains deferred.

Phase 7 keeps the project—not chat—as the center of gravity. Chats persist and are reusable, but canonical Project Mind, Architecture, Planning and Physical/Flow evidence retain their own authority.

## Phase 3 result — live human-first Planning

Phase 3 added Plan, PlanStep and Task as canonical planning state for the qualified `0.3.6` implementation. Correction `c3-remove-planning-instruments` now removes those live contracts and their runtime/presentation/persistence before Phase 4. Their qualification remains historical evidence only. Plans carry objective/context/status, ordered live steps and human-visible revision/history. Tasks are bounded units of work attached to plan steps, with requirements/constraints, project-relative working-set files, Project Mind links, status, completion notes and developer-entered validation notes.

Planning remains useful with no model configured. Project Mind and Planning stay separate domain boundaries: Project Mind stores durable knowledge; Planning stores execution intent. Planning references Project Mind artifacts by stable ID instead of converting or duplicating them. Creating a Plan from a Decision creates a new Plan linked back to the Decision; it does not mutate the Decision into work.

Planning persists in readable `.dope/planning.json` with its own optimistic document revision and mutation lock. It uses the existing Project Mind `projectId` and must reject mismatched identity. If Project Mind has no canonical identity yet, Planning surfaces the prerequisite rather than inventing a second identity. UI drafts, selection, filters, mode and layout remain presentation state.

BUILD/PLAN mode may foreground the appropriate work surface but is not canonical Plan/Task status. Task file links open the ordinary editor; coding, terminal, tests, SCM and debugger stay normal IDE workflows.

ADR 0006 records Codex/OpenAI as the first reference AI implementation for Phase 7 so the future agent/runtime design is proven against a capable system before local-model limits are diagnosed. That is a bootstrap/qualification strategy only. Phase 3 contains no provider runtime code and preserves first-class future local-model compatibility.
