# Dope Foundation Context

Status: HISTORICAL FOUNDATION SOURCE
Planning session: 2026-09-27

This document preserves the initial product planning context that created Dope. It is intentionally broader and more exploratory than the current contracts.

Current normative authority lives in VISION.md, PRINCIPLES.md, PRODUCT-MODEL.md, ARCHITECTURE.md, THEIA-SPIKE.md, project-overview.md, workflow.md, stability-contract.md, and approved planning/decision records.

If a later approved contract conflicts with this source, the later contract wins. Do not silently erase the history; update the relevant decision record.

## Origin

The project starts from a tension created by modern coding agents.

AI can dramatically increase how much software one developer produces, but can also absorb too much of the cognitive development loop: understanding the system, discovering constraints, making architecture choices, implementing, testing, and returning a completed result.

That can leave the developer increasingly disconnected from software they ostensibly built.

Dope explores a different relationship.

The goal is not maximum autonomous code generation.

The goal is maximum leverage while preserving developer understanding, authorship, skill, control, and satisfaction.

Core metaphor:

> AI should behave more like an exoskeleton for programming than a replacement programmer.

## North star

> At the end of a four-hour session, the developer should understand the software better than they did when they started, while accomplishing dramatically more than they could alone.

Extension:

> The environment should ensure that the understanding survives the session.

Knowledge should not disappear into chat history, hidden agent context, or temporary human memory.

Plans, discoveries, reasoning, decisions, research, ideas, implementation history, and validation should become durable project knowledge.

## Product identity

Dope is not:
- an autonomous coding agent with a GUI attached;
- a chatbot with an editor attached;
- an autocomplete product;
- a VS Code clone with an AI sidebar;
- a graphical George.

Dope is an AI-native development environment where the programmer remains the protagonist.

Useful shorthand:

VS Code × Codex-style agent environment × debugger × architecture explorer × planning/research workspace × pair programmer

Critical inversion:

> The AI should inhabit the IDE. The IDE should not inhabit the AI chat.

## Foundational pillars

1. Developer as protagonist.
2. Visible structured Agent Mind rather than raw hidden reasoning.
3. Continuous steering.
4. Ambient intelligence.
5. Scoped delegation.
6. Conceptual observability.
7. Passive discovery / Ideas bin.
8. Living software model.
9. Persistent developer context.
10. Friction removal, not skill removal.
11. Integrated thinking environment.

## Build + Think

BUILD:
- editor;
- terminal;
- debugger;
- tests;
- source control;
- runtime;
- agent execution;
- code review.

THINK:
- notes;
- ideas;
- research;
- decisions;
- planning;
- architecture;
- questions;
- exploration.

They are views into one project state rather than separate products.

Conceptual lifecycle:

Observation
-> Idea
-> Explore / Research
-> Decision
-> Plan
-> Task
-> Implementation
-> Validation
-> Project Knowledge

The development process should feel like:

thought -> investigation -> decision -> design -> implementation -> learning

rather than:

prompt -> code

## Project Brain

The project owns structured knowledge independent from conversation history.

Initial artifact vocabulary:
- Note;
- Idea;
- Question;
- Research;
- Decision;
- Plan;
- Task;
- DeveloperSession;
- ArchitectureModel;
- ChangeSet;
- Validation.

Important relationship pattern:

Idea
-> Research
-> Decision
-> Plan
-> Task
-> ChangeSet
-> Validation

The project brain belongs to Dope's domain model.

The GUI renders it.

Agents consume/update it under controlled rules.

It persists independently.

## Notes, research, and decisions

Notes may begin as unstructured developer thought and gain AI-assisted structure while staying visible/editable.

Research has a dedicated home and should preserve alternatives, tradeoffs, project constraints, unknowns, and sources.

Decisions are first-class durable institutional memory. Later agents should be able to detect conflict with accepted decisions and surface the conflict rather than silently overriding history.

## Live Plans

Plans are live control structures.

They should stay synchronized with implementation and task state.

When implementation reveals a flawed assumption, the developer can edit the plan and the agent should consume the updated state instead of reconstructing the task from a new conversation.

## Search

A future project-wide search should span:
- code;
- plans;
- notes;
- research;
- decisions;
- ideas;
- architecture;
- tasks;
- session history;
- tests/validation.

Desired semantic questions include:
- Why did we make a particular decision?
- Where did we discuss a concept?
- Which ideas remain unfinished?
- Which plan steps remain unimplemented?
- Which architecture decisions lack regression tests?

## Visual planning

Not all engineering thought should be prose.

Potential representations:
- mind maps;
- architecture diagrams;
- flow diagrams;
- dependency graphs;
- timelines;
- task graphs;
- freeform canvases.

Visual objects should connect to actual project objects and be able to represent current versus proposed architecture.

Visual planning should become engineering state, not decoration.

## Interaction model

Code remains the center of gravity.

A plausible workbench has:
- Explorer / symbols / Git / tests;
- central editor;
- Agent Mind;
- terminal/tests/runtime/agent activity/problems.

Potential top-level spaces:
- Code;
- Plan;
- Research;
- Architecture;
- Tasks;
- Ideas;
- Decisions;
- Runtime;
- Review.

These are interconnected views, not silos.

## Agent Mind

Agent Mind is a core differentiator.

It is structured state, not generated prose.

Candidate fields:
- objective;
- currentStep;
- plan;
- assumptions;
- decisions;
- questions;
- risks;
- uncertainties;
- workingSet;
- ownership;
- pendingActions;
- validationState.

The UI visualizes state owned outside the UI.

A presentation change must not require rewriting Agent Runtime.

## Chat

Conversation remains useful but is not the product.

Chat is one interface for manipulating shared project state.

Examples include asking about highlighted code, implementing/refactoring/testing/debugging a selection, exploring alternatives, adding something to a task, or steering architecture.

Development state must not become trapped in conversation.

## Ideal session

A project reopen should restore the developer's own context: prior objective, completed work, unresolved semantics, accepted decisions, failing tests, and captured ideas.

The developer may code manually while AI quietly notices relevant existing infrastructure or a possible invariant violation.

The developer can delegate a bounded piece such as regression tests while retaining implementation ownership elsewhere.

AI work should be visible conceptually and drill down into files/diffs.

If the developer says a behavior is intentional, shared state updates.

Completion should summarize what the developer changed, what AI implemented, decisions made, architecture updates, ideas captured, and validation.

Desired feeling:

> I built that.

Not:

> I asked an agent to build that.

## Local AI

Local models matter because Dope should support many tiny continuous interactions economically:
- observe edits;
- maintain project model;
- micro-analyze;
- inspect symbols/selections;
- perform passive architecture review;
- update context frequently.

The development session, not the prompt, is the fundamental unit.

## Relationship to George

Dope is a fresh repository.

It is not George v2 and has no compatibility requirement.

George is prior art for local model integration, agent loops, tool execution, approvals, permissions, observability, transcripts, context management, validation, benchmarking, and repository workflow.

Dope must not inherit George's TUI-first product assumptions.

## GUI-first

Dope starts as a native-feeling GUI desktop application.

GUI-first does not mean GUI-coupled.

Core Project Intelligence and Agent Runtime remain presentation-independent.

## Theia

Eclipse Theia is the selected initial substrate unless Foundation Spike 0 reveals a blocker.

Why it was selected:
- designed for custom IDE products;
- TypeScript/Node;
- Electron;
- Monaco;
- terminal;
- filesystem/workspace;
- debugger;
- SCM/Git;
- search/commands/preferences/keybindings;
- LSP/TextMate;
- VS Code extension compatibility;
- Open VSX;
- frontend/backend separation;
- DI/replaceable services;
- custom React widgets;
- extensible workbench/layout;
- active AI infrastructure.

The conceptual architecture remains:

Dope desktop
-> Theia workbench
-> Dope UI
-> Project Intelligence + Agent Runtime
-> model/tool/execution adapters

Theia stops at the platform boundary.

## Theia AI

Theia AI offers potentially useful infrastructure such as model registries/providers, OpenAI-compatible/local providers, tools, context variables, MCP, prompt services, confirmations, structured output, session persistence, and delegation.

It must not define Dope's product model.

Recommended relationship:

Dope domain
-> Project Intelligence / Agent Runtime
-> AI adapter
-> Theia AI where useful
-> model providers

## Theia customization

Preferred order:
1. standard contribution points;
2. custom widgets/services;
3. service rebinding/replacement;
4. shell changes where justified;
5. fork only as last resort.

Upgradeability matters.

Deep coupling should be isolated.

## Workspace modes / Perspectives

Potential Dope modes:
- BUILD;
- PLAN;
- RESEARCH;
- ARCHITECTURE;
- DEBUG;
- REVIEW.

Dope owns the WorkspaceMode concept.

Theia Perspectives may be adapted if qualified, but critical product state must not depend on an unstable framework API.

## VS Code/Open VSX compatibility

Theia compatibility is valuable for language servers, grammars, debuggers, formatters, linters, themes, and general tooling, but is not assumed perfect.

The early qualification matrix should cover TypeScript/JavaScript, Node, JSON, Markdown, Git, terminal, debugging, ESLint, Prettier, and at least one real Open VSX extension.

## Authority

No model receives direct filesystem or process mutation authority.

AI
-> ProposedAction
-> Authority / Permission Layer
-> ToolExecutor
-> effect

Observation and mutation remain distinct.

## Initial package boundary idea

Product/domain candidates:
- project-intelligence;
- agent-core;
- agent-state;
- agent-runtime;
- model-runtime;
- tool-runtime;
- authority.

Presentation candidates:
- theia-shell;
- theia-agent-mind;
- theia-planning;
- theia-research;
- theia-ideas;
- theia-decisions;
- theia-architecture;
- theia-runtime.

The spike should not create empty package ceremony merely to satisfy this sketch.

## Foundation Spike 0

The first engineering milestone is a bounded feasibility spike designed to break the Theia thesis.

It must prove:
- serious IDE basics;
- custom Agent Mind/Planning/Ideas UI;
- typed backend streaming;
- local AI;
- tool proposal + approval;
- editor observation;
- proposal/diff/apply/reject;
- Note -> Task -> Agent Runtime -> task-state update;
- restart persistence;
- material layout customization;
- service rebinding;
- styling;
- Linux package;
- one framework-version upgrade.

Upgrade repair should be bounded. Broad internal-shell breakage means the architecture must be corrected before proceeding.

## Name and emotional direction

Selected name: Dope.

Personal branding option: JFin's Dope.

The AI is not named Dope. Dope is the environment.

Desired emotional progression:

Curiosity
-> Understanding
-> Capability
-> Momentum
-> Accomplishment
-> Pride

Secondary principle:

> Leave every session more capable than you entered it.

The desired outcome is not "the AI did a lot."

It is:

> I built that. I understand it. I got somewhere today.

## Non-goals

Resist:
- chatbot-first UX;
- agent-as-protagonist UX;
- maximizing AI-written-code percentage;
- hiding architecture decisions;
- giant black-box autonomous runs as default;
- planning as secondary disconnected markdown;
- project knowledge as chat history;
- coupling runtime to Theia UI;
- coupling Project Intelligence to framework internals;
- early Theia fork;
- rebuilding commodity IDE functionality;
- excessive interruptions;
- mandatory explanations;
- assuming automation is always better than direct coding.

Autonomous implementation remains one capability. It is not the premise of the product.
