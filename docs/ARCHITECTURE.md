# Dope Architecture

Status: INITIAL ARCHITECTURE CONTRACT

## Objective

Build a native-feeling GUI development environment while keeping product intelligence and agent/runtime logic independent from the GUI framework.

GUI-first must not become GUI-coupled.

## Top-level layering

Dope Desktop App
  |
Theia Workbench / IDE substrate
  |
Dope presentation adapters and widgets
  |
Application / orchestration
  |
Project Intelligence + Agent Runtime
  |
Model / Tool / Authority / Persistence / Execution adapters

Dependencies point inward.

Product/domain packages must not import Theia.

## Theia boundary

Theia supplies commodity IDE capabilities: Monaco, filesystem/workspaces, explorer, terminal, SCM/Git, debugger, search, commands, preferences, keybindings, LSP, TextMate grammars, VS Code extension compatibility, Open VSX, workbench/layout, and Electron desktop shell.

Dope owns Project Brain, Agent Mind, DeveloperSession, ownership/delegation, steering, Ideas, Research, Decisions, live Plans, conceptual ChangeSets, Validation, living software model, project search semantics, and authority policy.

Theia may render or host these concepts. It does not define them.

## Theia AI boundary

Theia AI may be reused selectively through an adapter for qualified infrastructure such as model registry/provider plumbing, OpenAI-compatible provider support, local-provider integrations, model tools, context variables, MCP, prompt services, confirmation infrastructure, structured output, and session plumbing.

Do not make Theia AI's agent/chat/session ontology Dope's product ontology.

Dope Agent Runtime consumes Dope domain state and may call a TheiaAIAdapter.

The adapter is replaceable.

## Target repository structure after qualification

/
  apps/
    desktop/

  packages/
    project-intelligence/
    agent-state/
    agent-core/
    agent-runtime/
    model-runtime/
    tool-runtime/
    authority/
    persistence/

    theia-shell/
    theia-agent-mind/
    theia-planning/
    theia-research/
    theia-ideas/
    theia-decisions/
    theia-architecture/
    theia-runtime/

  docs/
  scripts/
  test/

The spike should not create every package merely to match this diagram. Create boundaries when code exists.

## Core services

### Project Intelligence

Owns ProjectArtifact identity/relationships, persistence contracts, query/search interfaces, provenance, schema versioning, and knowledge lifecycle.

No Theia dependency.

### Agent State

Owns AgentWorkingState, objective/plan/current-step state, assumptions/questions/risks, ownership, pending actions, validation projection, and steering transitions.

No provider or UI dependency.

### Agent Runtime

Consumes canonical task/session/project state, assembles bounded working context, requests model output, interprets structured proposals, coordinates tools through authority, updates working state, emits observable events, and preserves cancellation/recovery semantics.

No direct Theia dependency.

### Model Runtime

Provider-independent model interface. Provider specifics remain behind adapters.

### Authority

Owns effect classification and permission decisions. A model cannot grant itself authority.

Observation and mutation permissions are separate.

### Tool Runtime

Typed tools execute only after authority permits them. Tool results are structured and observable.

### Persistence

Backend adapters implement durable state. Do not let a first spike backend dictate the domain model.

## Frontend/backend communication

Theia frontend and backend communicate through typed service contracts.

Foundation Spike 0 must prove a Node backend service, typed frontend/backend request/response, live structured AgentWorkingState streaming, cancellation/cleanup, and restart restoration.

The transport is infrastructure. Canonical state remains product-owned.

## Editor-agent integration

Dope needs explicit observation seams for active editor, selection, document edits, and working set.

Observation must not imply mutation permission.

Mutation path:

Agent proposal
-> ProposedAction
-> authority decision
-> diff/change preview
-> apply or reject
-> ChangeSet/evidence update

## State authority matrix

Canonical product state includes ProjectArtifact, DeveloperSession, accepted AgentWorkingState fields, Task/Plan ownership, ProposedAction lifecycle, and Validation evidence.

Derived state includes UI layout, rendered panels, search indexes, recomputable architecture projections, provider-native response IDs, and framework chat/session state.

Do not confuse derived convenience with canonical truth.

## Workspace modes

Dope defines a product-level WorkspaceMode abstraction.

Likely modes:
- BUILD
- PLAN
- RESEARCH
- ARCHITECTURE
- DEBUG
- REVIEW

Theia Perspectives may be used as an adapter if qualified.

Critical product state must not depend directly on an unstable framework API.

## Customization hierarchy

1. Standard Theia contribution points.
2. Custom widgets/services.
3. Service rebinding/replacement.
4. ApplicationShell/custom shell changes where justified.
5. Source fork only as last resort.

Deep shell coupling should be isolated behind Dope adapters.

## Upgradeability

Foundation Spike 0 builds on pinned Theia 1.75.0, then upgrades to the next stable release available for the test and records every required fix.

If a routine upgrade requires architectural rewrites because Dope depends on internal shell behavior, the spike is Not Green until coupling is removed or explicitly accepted.

## Extension compatibility

Initial tooling matrix:
- TypeScript/JavaScript
- Node debugging
- JSON
- Markdown
- Git
- terminal
- ESLint
- Prettier
- at least one Open VSX extension installed and used

Compatibility claims require real evidence.

## Security / authority boundary

No model receives direct filesystem/process mutation authority.

AI
-> ProposedAction
-> Authority / Permission Layer
-> ToolExecutor
-> filesystem / process / Git / browser / network

Repository content, extensions, remote tools, MCP servers, and model output are untrusted relative to Dope's configured authority ceiling.

## Relationship to George

George code may be studied or selectively borrowed only where it fits this architecture.

No George API, state schema, TUI assumption, or compatibility requirement is authoritative for Dope.
