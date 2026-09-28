# Dope Boot Document

This is the session router for repository-aware work in jfin602/dope.

Before substantial repository-aware planning, implementation, review, architecture work, roadmap work, or documentation changes:

1. Read this file.
2. Read AGENTS.md.
3. Read the narrowest relevant current docs.
4. Inspect current source and tests before making implementation claims.

## Current state

Foundation Spike 0 is qualified and owner-closed at commit `425b89d222e1542815af9e38aaa21a4e5a472cb7`, package `0.0.6`, on Eclipse Theia 1.75.0. The exact qualification and retained Evidence Gaps remain in `docs/tasks/p0/closeout.md`.

**Product Phase 2 — Project Mind is the active engineering scope, by explicit owner sequencing waiver.**

The September 28, 2026 Phase 1 P6 closeout remains **Not Qualified** at `dac6e57275134fc610d8c0c6e2620a90d7d58c2f` (`0.1.6`). Its failed and incomplete P5 observations remain unchanged in `docs/tasks/p1/closeout.md`. The owner subsequently instructed "Proceed with Phase 2 despite Phase 1 being Not Qualified." This separate waiver authorizes sequencing, not Green evidence or a repair claim.

The approved Phase 2 docs and p2 stack are now eligible for execution. Exact activation source/package baseline: `a7bf2cf4e5b6a7ce70dec8e5989ddee17dae4781`, coherent `0.2.0`. See `docs/planning/p2/activation.md` for the explicit owner waiver and authorization-commit identity, plus `docs/planning/p2/phase-2-plan.md` and `docs/tasks/p2/README.md`. No P1 success marker exists yet.

The historical Phase 1 activation established package baseline `0.1.0` before the `p1` execution stack. Phase 1 turns the qualified substrate into a desktop IDE comfortable enough to develop Dope inside Dope through ordinary development workflows.

Inherited Phase 1 product posture:
- Electron is the primary user-facing product shell;
- the browser application remains a development and qualification surface;
- Eclipse Theia remains pinned to 1.75.0 until a real upgrade is intentionally undertaken;
- Dope is dark-first by default, while explicit user theme choice remains supported and persistent;
- unfinished Project Mind and Planning spike surfaces must not be mistaken for Phase 2/3 product implementation;
- no AI/model/provider, Agent Mind, tool-authority, mutation, or scoped-delegation implementation belongs in Phase 1.

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
- docs/decisions/0004-model-provider-independence.md
- docs/decisions/0005-progressive-self-development.md

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
-> Phase 3 — Planning
-> Phase 4 — AI Presence
-> Phase 5 — Scoped Delegation
-> Phase 6 — Development Sessions

Do not pull later-phase concepts forward merely because they already exist in the long-term product model.

## Product shape

BUILD includes editor, terminal, debugger, tests, source control, runtime, agent execution when delegated, and code review.

THINK includes notes, ideas, questions, research, decisions, plans, architecture, and exploration.

These are different views into the same project state.

The intended knowledge lifecycle is:

Observation -> Idea -> Explore/Research -> Decision -> Plan -> Task -> Implementation -> Validation -> Project Knowledge

## Locked architecture direction

Theia is the initial IDE/workbench substrate.

The product architecture is not "Theia IDE + plugins."

Current/early layers:

Dope desktop / Theia workbench
-> Dope presentation adapters and widgets
-> Application / orchestration
-> Project Intelligence / Planning
-> Persistence adapters

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

Later phases add Plans, Tasks, Agent Mind, DeveloperSession, ChangeSet, Validation, Research, and ArchitectureModel according to the roadmap.

Chat is one interface for manipulating project state. Chat history is not canonical product state.

## Model and provider independence

Dope is not married to any model, model family, provider, hosted service, local runtime, or provider-native chat/session format.

First-class compatibility targets include:
- OpenAI / ChatGPT / Codex
- local models and local inference runtimes
- future providers through replaceable capability-based adapters

No provider owns Project Mind, Planning, Agent Mind, Sessions, Authority, Decisions, or Validation.

The current GPT-6 Sol/Codex repository workflow is a development-tooling choice, not Dope's runtime architecture.

## Progressive self-development

Dope should progressively become capable of developing its own repository:

external bootstrap
-> Dope as editor
-> Dope as project brain
-> Dope as planner
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

P6 closed as **Not Qualified** on September 28, 2026 from owner-waived handoff `fca1ca672548cc65fc12ec4ea66f0a04ed9f2019` (`0.1.5`). Its closeout version and commit subject are `0.1.6`; the owner approved committing the reviewed closeout. See `docs/tasks/p1/closeout.md` for the A–G audit and deterministic rerun.

Next action: retry `npm run codex:phase -- p2 --closeout` from the clean authorization commit at `0.2.0`. The owner sequencing prerequisite is satisfied by `docs/planning/p2/activation.md`; do not stop merely because the preserved Phase 1 record is Not Qualified. P1-P4 are runner-owned, P5 remains the direct-interactive GUI handoff, and P6 is evidence-only closeout. Phase 1 failure history and Phase 2 qualification requirements remain in force.

Activation source SHA: `a7bf2cf4e5b6a7ce70dec8e5989ddee17dae4781`; package baseline `0.2.0`; prompt targets `0.2.1` through `0.2.6`. Verify the explicit waiver, reachable baseline and ordinary clean-tree/version prerequisites on execution. The runner does not itself prove product qualification. Do not advance versions without implementation or treat the waiver as Phase 2 qualification; Phase 3 remains unapproved.