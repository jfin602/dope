# Dope Boot Document

This is the session router for repository-aware work in jfin602/dope.

Before substantial repository-aware planning, implementation, review, architecture work, roadmap work, or documentation changes:

1. Read this file.
2. Read AGENTS.md.
3. Read the narrowest relevant current docs.
4. Inspect current source and tests before making implementation claims.

## Current state

Foundation Spike 0 is qualified and owner-closed at commit `425b89d222e1542815af9e38aaa21a4e5a472cb7`, package `0.0.6`, on Eclipse Theia 1.75.0. The exact qualification and retained Evidence Gaps remain in `docs/tasks/p0/closeout.md`.

**Product Phase 4 — Physical Map remains Qualified/Green at committed `0.4.6` (`fac88712bb55176d3d6d54fbe6034de8b0f801ff`). Phase 5 is not activated.** The architecture-discovery follow-ons are retained as truthful Phase 4 history. `c4-smap-synth`, `c4-smap-gemini-provider`, `c4-synth-improvements`, and `c4-synth-coverage-review` are owner-closed **Not Qualified**. The owner closed `c4-synth-coverage-review` after its stopped P6 at pushed source `c059f67a5fd85c81183ba09044e550462c9000a1`: the final Adaptive SEO replay was materially closer and met the <=8-minute objective, but Component depth/coverage and several qualification controls remained incomplete. P7 will not run. The implemented synthesis/review capability is accepted as the bounded baseline without being relabeled Green. The fresh provider-comparison correction is deferred off the pre-Phase-5 critical path. The sole remaining mandatory gate is `c4-smap-storage` at unchanged `0.4.6`; storage Green routes to a fresh Product Phase 5 `/docs-review`.

**ADR 0008 remains the naming/workbench-placement authority; ADR 0009 establishes architecture-discovery/developer authority; ADR 0010 governs sMap initialization and AI-assisted synthesis; ADR 0011 governs the local-first bootstrap; ADR 0012 governs hierarchy-first synthesis/progress/performance; ADR 0013 governs compact shared provider contracts; ADR 0014, including its September 30 coverage/review amendment, governs responsibility-oriented decomposition, coverage recovery, Component-descent diagnostics, and branch-local review refinement; ADR 0015 governs optional root `MODULES.md` as a bootstrap architecture seed while preserving `.dope/architecture.json` as the sole canonical architecture after acceptance.** Canonical product terms remain **Software Map (sMap)**, **Physical Map**, and **Planning Map**. AI interprets deterministic evidence; it does not create evidence. The developer owns canonical System / Subsystem / Component identity. General Phase 6 AI Presence and the Phase 5 visual planning canvas remain out of scope.

Phase 2's P6 `0.2.6` evidence-only audit remains **Not Qualified**. The owner subsequently explicitly closed Phase 2 for sequencing and authorized Phase 3 from a coherent `0.3.0` baseline. This owner disposition does not relabel the P6 audit Green or erase its evidence gaps. The retained Phase 2 gaps are the initially hidden legacy-migration entry, unproved dirty same-renderer workspace switch, lack of exact `0.2.6` native artifact launch/direct native visual Project Mind use, and inherited Phase 1 gaps where applicable. See `docs/tasks/p2/closeout.md` and `docs/planning/p3/activation.md`.

The September 28, 2026 Phase 1 P6 closeout also remains **Not Qualified** at `dac6e57275134fc610d8c0c6e2620a90d7d58c2f` (`0.1.6`). Its historical failures are preserved. Neither the Phase 2 sequencing waiver nor the Phase 3 owner-close changes that evidence.

Phase 3 added human-first live Planning on top of Project Mind and qualified it at `0.3.6`. Correction `c3-remove-planning-instruments` then removed that complete live subsystem before Phase 4 while preserving its historical plans/evidence. Phase 4 starts clean at `0.4.0` with no Phase 3 Planning compatibility obligation. ADR 0010/0011 authorize only the narrow pre-Phase-6 sMap synthesis provider needed by c4. Production visual planning, general AI Presence/provider integration, Agent Mind, tool calling, AI mutation, scoped delegation and durable Development Sessions remain deferred to their roadmap phases.

The qualified substrate remains:

**Foundation Spike 0 — Theia substrate qualification**

Qualified spike baseline:
- Eclipse Theia 1.75.0;
- desktop target: Electron;
- Node 24 major;
- Linux AppImage packaging;
- typed frontend/backend seams;
- bounded presentation customization without broad private/internal coupling.

Historical planning source:
- docs/foundation-context.md

If the historical source conflicts with a later current contract, the current contract wins and the conflict should be resolved explicitly.

Current authority:
- docs/VISION.md
- docs/PRINCIPLES.md
- docs/PRODUCT-MODEL.md
- docs/ARCHITECTURE.md
- docs/THEIA-SPIKE.md
- docs/project-overview.md
- docs/workflow.md
- docs/stability-contract.md
- docs/roadmap/mvp-roadmap.md
- docs/planning/foundation-spike-0/decision-record.md
- docs/planning/foundation-spike-0/qualification-plan.md
- docs/planning/p1/phase-1-plan.md
- docs/planning/p2/phase-2-plan.md
- docs/planning/p2/activation.md
- docs/planning/p3/phase-3-plan.md
- docs/planning/p3/activation.md
- docs/planning/p4/phase-4-plan.md
- docs/planning/p4/activation.md
- docs/decisions/0004-model-provider-independence.md
- docs/decisions/0005-progressive-self-development.md
- docs/decisions/0006-codex-reference-ai-bootstrap.md
- docs/decisions/0007-software-model-centered-product-architecture.md
- docs/decisions/0008-software-map-terminology-and-workbench-placement.md
- docs/decisions/0009-architecture-discovery-and-developer-authority.md
- docs/decisions/0010-smap-initialization-and-ai-assisted-architecture-synthesis.md
- docs/decisions/0011-local-first-smap-synthesis-bootstrap.md
- docs/decisions/0012-hierarchical-smap-synthesis-and-analysis-progress.md
- docs/decisions/0013-compact-smap-stage-contracts-and-local-gemini-providers.md
- docs/decisions/0014-responsibility-oriented-smap-decomposition-and-review.md
- docs/decisions/0015-modules-bootstrap-architecture-seed.md

## Product premise

Dope is an AI-native software development environment in which the programmer remains the protagonist and AI amplifies the programmer's existing abilities.

> At the end of a four-hour session, the developer should understand the software better than they did when they started, while accomplishing dramatically more than they could alone.

> The environment should ensure that the understanding survives the session.

Dope should feel like an exoskeleton for programming, not a replacement programmer.

The fundamental interaction unit is the development session, not the prompt.

## Initial roadmap

The initial sequence is intentionally small:

Foundation Spike 0 — qualify Theia
-> Phase 1 — IDE Alive
-> Phase 2 — Project Mind
-> Phase 3 — Planning Foundation
-> correction c3 — remove Planning instruments
-> Phase 4 — Physical Map
-> correction c4 — architecture discovery + developer authority
-> correction c4-hierarchical — hierarchy-first sMap synthesis + visible progress
-> correction c4-coverage — coverage diagnostics + iterative branch review
-> correction c4-storage — project-local sMap persistence
-> visual identity alignment — match app palette to Dope logo
-> Phase 5 — Visual Software Planning
-> Phase 6 — AI Presence
-> Phase 7 — Scoped Delegation
-> Phase 8 — Development Sessions

Do not pull later-phase concepts forward merely because they already exist in the long-term product model.

## Product shape

BUILD includes editor, terminal, debugger, tests, source control, runtime, agent execution when delegated, and code review.

THINK includes notes, ideas, questions, research, decisions, plans, architecture, and exploration.

These are different views into the same project state.

The software project is the center of gravity. Dope's core architecture hierarchy is Project -> System -> Subsystem -> Component -> Code. Deterministic analysis produces independently verifiable architecture evidence and signals. Hierarchy-first bounded synthesis builds a global skeleton, discovers and challenges Systems, then descends per System into Subsystems/Components before reconciliation and targeted verification; the developer owns canonical architecture. The Physical Map shows how implementation realizes or diverges from that authority; Visual Software Planning references the resulting identities and derives the future work model from graph transformations before reconciliation after implementation.

The intended knowledge lifecycle is:

Observation -> Idea -> Explore/Research -> Decision -> Plan -> Task -> Implementation -> Validation -> Project Knowledge

## Locked architecture direction

Theia is the initial IDE/workbench substrate.

The product architecture is not "Theia IDE + plugins."

Current/early layers:

Dope desktop / Theia workbench
-> Dope presentation adapters and widgets
-> Application / orchestration
-> Project Intelligence / Software Map
-> Code-analysis and persistence adapters

Later:
-> Visual Software Planning

Later AI layers:

Agent Runtime
-> Model Runtime / Tool Runtime / Authority
-> provider and execution adapters

Project Intelligence, Planning, and later Agent Runtime remain presentation-independent.

General Theia AI reuse may be introduced selectively behind an adapter when AI Presence is implemented. ADR 0011 separately permits the narrow local synthesis adapter/runtime plumbing required by c4. Theia AI agent/chat abstractions do not define Dope's product domain.

## Project Mind

Project Mind is the developer-facing durable project memory.

Project Intelligence is the internal domain/service boundary that implements it.

Initial Project Mind scope begins with:
- Note
- Idea
- Question
- Decision

Phase 3 added Plan/PlanStep/Task as an internal planning model; correction `c3-remove-planning-instruments` has removed that live implementation. Phase 4 now adds the Physical Map from the clean `0.4.0` baseline; Phase 5 designs the forward Visual Software Planning/work model from scratch. Later phases add Agent Mind, DeveloperSession, ChangeSet, Validation, and Research according to the roadmap.

Chat is one interface for manipulating project state. Chat history is not canonical product state.

## Model and provider independence

Dope is not married to any model, model family, provider, hosted service, local runtime, or provider-native chat/session format.

First-class compatibility targets include:
- OpenAI / ChatGPT / Codex
- local models and local inference runtimes
- future providers through replaceable capability-based adapters

No provider owns Project Mind, Planning, Agent Mind, Sessions, Authority, Decisions, or Validation.

The current GPT-6 Sol/Codex repository workflow is a development-tooling choice, not Dope's runtime architecture. ADR 0011 selects LM Studio + Qwen3-Coder-30B-A3B-Instruct as the first reference implementation only for c4 sMap synthesis. ADR 0006 separately keeps Codex/OpenAI as the first reference AI implementation for general Phase 6 qualification. Neither bootstrap choice weakens provider independence.

## Progressive self-development

Dope should progressively become capable of developing its own repository:

external bootstrap
-> Dope as editor
-> Dope as project brain
-> Dope as planner
-> Dope maps Dope
-> Dope visually designs Dope
-> Dope as agent supervisor
-> Dope develops Dope

This is a qualification overlay across the existing roadmap, not a new early phase.

There is no privileged self-development mode. The Dope repository uses the same product, provider, authority, execution, validation, and session contracts as any other project.

Dope must remain repairable without Dope through conventional source, Git, build, test, and recovery tooling.

## Authority

When mutation-capable AI is introduced, models do not receive direct filesystem/process mutation authority.

AI -> ProposedAction -> Authority/Permission Layer -> ToolExecutor -> effect

Observation and mutation permissions are distinct.

Human, AI, and shared ownership may differ across portions of one task.

This is a future product invariant, not a Foundation Spike 0 implementation requirement.

## Relationship to George

Dope is not George v2.

There is no compatibility requirement with George.

George is useful prior art for repository workflow, the prompt/task runner, local model integration, tools, approvals, permissions, observability, context/recovery, validation, and benchmarking.

Do not inherit George's TUI-first or agent-first product architecture.

## Workflow

Documentation:

/docs-review -> explicit approval -> /docs-apply

Implementation:

/prompt-ass -> /prompt-plan -> /prompt-write <folder>

> Plan richly; prompt sparsely; validate rigorously.

New implementation prompts use GPT-6 Sol Medium by default, GPT-6 Sol High for materially harder/riskier work, and GPT-6 Sol XHigh only exceptionally.

Foundation Spike 0 uses task folder p0 and package versions 0.0.x. The ported runner has explicit Phase 0 support.

## Immediate next action

Do not activate or author Product Phase 5 implementation work yet.

Execute correction `c4-smap-storage` at unchanged package version `0.4.6` from the pushed owner-close baseline `c059f67a5fd85c81183ba09044e550462c9000a1`.

This is a deliberately bounded portability correction, not a new persistence subsystem. The existing implementation already has the core contract: project-local `.dope/architecture.json` for canonical architecture, `.dope/smap.json` for accepted initialization, safe/fail-closed file handling, and transient in-memory physical/synthesis state.

The correction must:
- prove repository + project-local `.dope/` is sufficient to recover durable Software Map truth after backend restart and when copied/opened at a different filesystem root;
- preserve exact canonical architecture IDs/containment and rebuild derived Physical Map state from current source/config plus canonical architecture;
- prove deletion/absence of machine-local synthesis/provider/cache state cannot change initialized state or canonical truth;
- keep provider/model preferences, credentials, presentation state, review drafts, evidence packets, physical snapshots, coverage ledgers, synthesis attempts/cache and Search Deeper previews non-project/transient unless a concrete defect proves persistence is required;
- prove a repository opened without its `.dope/` state does not inherit initialization from another root;
- preserve project isolation plus existing malformed/mismatched/symlink fail-closed behavior;
- initialize Dope's existing tracked `.dope/architecture.json` through the real acceptance path so the repository carries a valid `.dope/smap.json` dogfood marker;
- add/retain a permanent regression guard for the project-local persistence boundary;
- keep package version `0.4.6`;
- avoid live provider benchmarking, broad synthesis retuning, Phase 5 canvas/work ontology, general AI Presence, or persistence of rebuildable derived artifacts.

Use a streamlined three-prompt stack:
1. P1 — persistence-boundary audit plus only necessary repair and focused guards;
2. P2 — short copy/reopen/restart portability qualification plus Dope dogfood initialization;
3. P3 — evidence-only closeout.

P2 is intentionally narrow. Do not spend time on Local/Gemini comparison, multi-repository architecture scoring, AppImage/native packaging, or full browser qualification unless P1 materially changes code that makes such evidence necessary.

If `c4-smap-storage` closes Green, the next planned step is a bounded visual-identity alignment that matches Dope's application palette to the existing logo while preserving dark-first behavior and supported theme overrides. After that alignment is complete, route to a fresh Product Phase 5 `/docs-review`. The deferred provider-comparison idea may be revived later only if provider optimization/AI Presence work actually needs it.
