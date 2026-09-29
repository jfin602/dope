# Dope Boot Document

This is the session router for repository-aware work in jfin602/dope.

Before substantial repository-aware planning, implementation, review, architecture work, roadmap work, or documentation changes:

1. Read this file.
2. Read AGENTS.md.
3. Read the narrowest relevant current docs.
4. Inspect current source and tests before making implementation claims.

## Current state

Foundation Spike 0 is qualified and owner-closed at commit `425b89d222e1542815af9e38aaa21a4e5a472cb7`, package `0.0.6`, on Eclipse Theia 1.75.0. The exact qualification and retained Evidence Gaps remain in `docs/tasks/p0/closeout.md`.

**Product Phase 3 — Planning is Qualified for its applicable scope at `0.3.6`. Its implementation is historical evidence, not a forward compatibility contract. The mandatory current gate is correction `c3-remove-planning-instruments` at unchanged `0.3.6`. Product Phase 4 — Physical Software Model must not activate until that correction closes.** See `docs/tasks/p3/closeout.md` and ADR 0007.

Phase 2's P6 `0.2.6` evidence-only audit remains **Not Qualified**. The owner subsequently explicitly closed Phase 2 for sequencing and authorized Phase 3 from a coherent `0.3.0` baseline. This owner disposition does not relabel the P6 audit Green or erase its evidence gaps. The retained Phase 2 gaps are the initially hidden legacy-migration entry, unproved dirty same-renderer workspace switch, lack of exact `0.2.6` native artifact launch/direct native visual Project Mind use, and inherited Phase 1 gaps where applicable. See `docs/tasks/p2/closeout.md` and `docs/planning/p3/activation.md`.

The September 28, 2026 Phase 1 P6 closeout also remains **Not Qualified** at `dac6e57275134fc610d8c0c6e2620a90d7d58c2f` (`0.1.6`). Its historical failures are preserved. Neither the Phase 2 sequencing waiver nor the Phase 3 owner-close changes that evidence.

Phase 3 added human-first live Planning on top of Project Mind and qualified it at `0.3.6`. That live subsystem is now scheduled for complete removal by `c3-remove-planning-instruments` before Phase 4. The correction removes its domain, persistence, RPC, UI, PLAN mode, dedicated tests and repository `.dope/planning.json`; no compatibility adapter or migration is required. Production AI/provider integration, Agent Mind, tool calling, AI mutation, scoped delegation and durable Development Sessions remain deferred to their roadmap phases.

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
- docs/decisions/0004-model-provider-independence.md
- docs/decisions/0005-progressive-self-development.md
- docs/decisions/0006-codex-reference-ai-bootstrap.md
- docs/decisions/0007-software-model-centered-product-architecture.md

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
-> Phase 4 — Physical Software Model
-> Phase 5 — Visual Software Planning
-> Phase 6 — AI Presence
-> Phase 7 — Scoped Delegation
-> Phase 8 — Development Sessions

Do not pull later-phase concepts forward merely because they already exist in the long-term product model.

## Product shape

BUILD includes editor, terminal, debugger, tests, source control, runtime, agent execution when delegated, and code review.

THINK includes notes, ideas, questions, research, decisions, plans, architecture, and exploration.

These are different views into the same project state.

The software project is the center of gravity. Dope's core architecture hierarchy is Project -> System -> Subsystem -> Component -> Code. The Physical Software Model is evidence-backed current reality; Visual Software Planning references that reality and derives the future work model from graph transformations before reconciliation after implementation.

The intended knowledge lifecycle is:

Observation -> Idea -> Explore/Research -> Decision -> Plan -> Task -> Implementation -> Validation -> Project Knowledge

## Locked architecture direction

Theia is the initial IDE/workbench substrate.

The product architecture is not "Theia IDE + plugins."

Current/early layers:

Dope desktop / Theia workbench
-> Dope presentation adapters and widgets
-> Application / orchestration
-> Project Intelligence / Software Model
-> Code-analysis and persistence adapters

Later:
-> Visual Software Planning

Later AI layers:

Agent Runtime
-> Model Runtime / Tool Runtime / Authority
-> provider and execution adapters

Project Intelligence, Planning, and later Agent Runtime remain presentation-independent.

Theia AI may be used selectively behind an adapter when AI Presence is implemented. Theia AI agent/chat abstractions do not define Dope's product domain.

## Project Mind

Project Mind is the developer-facing durable project memory.

Project Intelligence is the internal domain/service boundary that implements it.

Initial Project Mind scope begins with:
- Note
- Idea
- Question
- Decision

Phase 3 added Plan/PlanStep/Task as an internal planning model, but correction `c3-remove-planning-instruments` removes that live implementation before Phase 4. Phase 4 adds the Physical Software Model to a clean baseline; Phase 5 designs the forward Visual Software Planning/work model from scratch. Later phases add Agent Mind, DeveloperSession, ChangeSet, Validation, and Research according to the roadmap.

Chat is one interface for manipulating project state. Chat history is not canonical product state.

## Model and provider independence

Dope is not married to any model, model family, provider, hosted service, local runtime, or provider-native chat/session format.

First-class compatibility targets include:
- OpenAI / ChatGPT / Codex
- local models and local inference runtimes
- future providers through replaceable capability-based adapters

No provider owns Project Mind, Planning, Agent Mind, Sessions, Authority, Decisions, or Validation.

The current GPT-6 Sol/Codex repository workflow is a development-tooling choice, not Dope's runtime architecture. ADR 0006 separately records Codex/OpenAI as the first reference AI implementation for Phase 6 qualification; that bootstrap choice does not add provider runtime code to Phase 3 or weaken provider independence.

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

Plan, write and execute correction stack `c3-remove-planning-instruments` at unchanged package version `0.3.6`.

The correction must remove the complete live Phase 3 Planning vertical slice: Plan/PlanStep/Task contracts, Planning service/store/backend, Planning UI/controller/navigation, Project Mind Planning bridges, PLAN workspace mode/presentation, `@dope/planning` package/build wiring, Planning-specific restart/unit tests, repository `.dope/planning.json`, and current Planning storage documentation where it only describes the removed runtime.

The correction must preserve Project Mind, ordinary IDE/Theia behavior, repository workflow/runner behavior and historical Phase 3 plans/evidence. Its closeout must prove the surviving product builds/tests cleanly and that no production Planning service/view/mode/storage wiring remains.

Only after that correction closes may Product Phase 4 — Physical Software Model be planned/activated from the clean `0.3.6` baseline.
