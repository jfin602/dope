# Dope Boot Document

This is the session router for repository-aware work in jfin602/dope.

Before substantial repository-aware planning, implementation, review, architecture work, roadmap work, or documentation changes:

1. Read this file.
2. Read AGENTS.md.
3. Read the narrowest relevant current docs.
4. Inspect current source and tests before making implementation claims.

## Current state

Dope is a fresh repository at package version 0.0.0.

No product implementation has been qualified yet.

The current engineering gate is:

**Foundation Spike 0 — Theia substrate qualification**

Initial spike pin:
- Eclipse Theia 1.75.0;
- desktop target: Electron;
- Node baseline for the spike: Node 24 major;
- Linux desktop packaging is required;
- Theia AI is optional infrastructure behind a Dope adapter, not a product model.

The spike exists to try to break the Theia thesis before Dope becomes deeply coupled to it.

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

## Product premise

Dope is an AI-native software development environment in which the programmer remains the protagonist and AI amplifies the programmer's existing abilities.

> At the end of a four-hour session, the developer should understand the software better than they did when they started, while accomplishing dramatically more than they could alone.

> The environment should ensure that the understanding survives the session.

Dope should feel like an exoskeleton for programming, not a replacement programmer.

The fundamental interaction unit is the development session, not the prompt.

## Product shape

BUILD includes editor, terminal, debugger, tests, source control, runtime, agent execution, and code review.

THINK includes notes, ideas, questions, research, decisions, plans, architecture, and exploration.

These are different views into the same project state.

The intended knowledge lifecycle is:

Observation -> Idea -> Explore/Research -> Decision -> Plan -> Task -> Implementation -> Validation -> Project Knowledge

## Locked architecture direction

Theia is the initial IDE/workbench substrate.

The product architecture is not "Theia IDE + plugins."

Conceptual layers:

Dope desktop / Theia workbench
-> Dope presentation adapters and widgets
-> Application / orchestration
-> Project Intelligence + Agent Runtime
-> Model / tool / execution / persistence adapters

Project Intelligence and Agent Runtime are presentation-independent.

Theia AI may be used selectively behind an adapter. Theia AI agent/chat abstractions do not define Dope's product domain.

## Core product state

The project brain owns durable project artifacts such as:
- Note
- Idea
- Question
- Research
- Decision
- Plan
- Task
- DeveloperSession
- ArchitectureModel
- ChangeSet
- Validation

Agent Mind is a structured projection containing at least:
- objective
- current step
- plan
- assumptions
- decisions
- questions
- risks
- uncertainties
- working set
- ownership
- pending actions
- validation state

Chat is one interface for manipulating this state. Chat history is not the canonical state.

## Authority

Models do not receive direct filesystem/process mutation authority.

AI -> ProposedAction -> Authority/Permission Layer -> ToolExecutor -> effect

Observation and mutation permissions are distinct.

Human, AI, and shared ownership may differ across portions of one task.

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

Do not start broad product implementation.

The next planning sequence should decompose Foundation Spike 0 into bounded prompts after the current documentation foundation is reviewed.

The spike must qualify or reject Theia before the first real product phase begins.
