# Dope Architecture

Status: INITIAL ARCHITECTURE CONTRACT

## Objective

Build a native-feeling GUI development environment while keeping Dope's differentiated product state independent from both the GUI framework and the model/provider ecosystem.

Two foundational constraints:

> GUI-first must not become GUI-coupled.

> AI-native must not become provider-coupled.

## Top-level layering

Dope Desktop App
  |
Theia Workbench / IDE substrate
  |
Dope presentation adapters and widgets
  |
Application / orchestration
  |
Project Intelligence / Planning / later Agent Runtime
  |
Persistence / Model / Tool / Authority / Execution adapters

Dependencies point inward.

Product/domain packages must not import Theia or provider-native SDK/domain types.

## Theia boundary

Theia supplies commodity IDE capabilities:
- Monaco
- filesystem/workspaces
- explorer
- terminal
- SCM/Git
- debugger
- search
- commands
- preferences/keybindings
- LSP
- TextMate grammars
- VS Code extension compatibility
- Open VSX
- workbench/layout
- Electron desktop shell

Dope owns:
- Project Mind / Project Intelligence
- Plans and Tasks
- Agent Mind
- DeveloperSession
- ownership/delegation
- steering
- Ideas/Questions/Decisions/Research
- conceptual ChangeSets
- Validation
- living software model
- project search semantics
- authority policy

Theia may render or host these concepts. It does not define them.

## Model and provider boundary

Dope must not depend architecturally on one model, model family, provider, API, hosted service, local runtime, or provider-native chat/session ontology.

First-class compatibility requirements include:
- OpenAI / ChatGPT / Codex capabilities and workflows
- local models and local inference runtimes
- future providers through replaceable adapters

The durable boundary is Dope's Model Runtime and capability contract.

Provider adapters translate provider-specific requests, streaming, tool formats, response identifiers, reasoning controls, context handles, and errors into Dope-owned contracts.

Do not spread provider-name conditionals through product/domain code.

## Capability-based model runtime

Provider independence must not become lowest-common-denominator abstraction.

The Model Runtime should expose durable common operations plus explicit capability discovery.

Capabilities may include:
- streaming
- tool calling
- parallel tool calls
- structured output
- vision
- long-context support
- reasoning controls
- native code execution
- provider-managed state
- cancellation

Dope chooses behavior based on capabilities.

A provider may expose richer features without forcing every provider to emulate them.

Canonical product state must remain valid when the active provider changes.

## Theia AI boundary

Theia AI may be reused selectively through an adapter for qualified infrastructure such as model registry/provider plumbing, OpenAI-compatible provider support, local-provider integrations, model tools, context variables, MCP, prompt services, confirmation infrastructure, structured output, or session plumbing.

Do not make Theia AI's agent/chat/session ontology Dope's product ontology.

Theia AI is optional infrastructure.

Actual reuse is qualified when AI Presence is implemented, not during Foundation Spike 0.

## Target repository structure

Create boundaries when real code exists; do not create empty package ceremony.

Likely shape:

/
  apps/
    desktop/

  packages/
    project-intelligence/
    planning/
    persistence/

    agent-state/
    agent-core/
    agent-runtime/
    model-runtime/
    tool-runtime/
    authority/

    theia-shell/
    theia-project-mind/
    theia-planning/
    theia-agent-mind/
    theia-runtime/

  docs/
  scripts/
  test/

Early phases should create only the packages they need.

## Core services

### Project Intelligence

Owns ProjectArtifact identity/relationships, persistence contracts, provenance, schema versioning, and Project Mind query/navigation semantics.

No Theia or provider dependency.

### Planning

Owns Plan, PlanStep, Task, status transitions, relationships to Project Mind, and planning history.

No model is required.

### Persistence

Backend adapters implement durable state.

Do not let the Foundation Spike backend dictate the domain model.

### Agent State

Introduced with AI Presence.

Owns AgentWorkingState, objective/current-step state, assumptions/questions/risks, ownership projection, pending actions, validation projection, and steering transitions.

No provider or UI dependency.

### Agent Runtime

Introduced with AI Presence/Scoped Delegation.

Consumes canonical task/session/project state, assembles bounded context, requests model output, interprets structured proposals, coordinates tools through authority, updates working state, emits observable events, and preserves cancellation/recovery semantics.

No direct Theia dependency.

### Model Runtime

Provider-independent model interface and capability discovery.

Provider-specific behavior remains behind adapters.

### Authority

Introduced before mutation delegation.

Owns effect classification and permission decisions.

A model cannot grant itself authority.

Observation and mutation permissions are separate.

### Tool Runtime

Typed tools execute only after authority permits them.

Tool results are structured and observable.

## Foundation Spike 0 boundary

Foundation Spike 0 proves:
- Theia IDE fundamentals
- custom Dope views/layouts
- typed frontend/backend communication
- minimal Dope-owned persistence
- restart restoration
- customization/rebinding
- Linux packaging
- upgradeability

It does not need to prove:
- model integration
- AgentWorkingState streaming
- tool calling
- authority execution
- editor-agent mutation
- scoped delegation

This keeps substrate qualification separate from product/AI implementation.

## Frontend/backend communication

Theia frontend and backend communicate through typed service contracts.

Foundation Spike 0 must prove a Node backend service, typed request/response, at least one backend-originated state/event update, lifecycle cleanup where required, and restart restoration of minimal Dope-owned state.

The transport is infrastructure.

Canonical state remains product-owned.

## Editor-agent integration

This is a later AI phase concern.

Dope eventually needs explicit observation seams for active editor, selection, document edits, and working set.

Observation must not imply mutation permission.

Future mutation path:

Agent proposal
-> ProposedAction
-> authority decision
-> diff/change preview
-> apply or reject
-> ChangeSet/evidence update

## State authority matrix

Canonical product state includes, as phases introduce it:
- ProjectArtifact
- Plan / PlanStep / Task
- accepted AgentWorkingState fields
- ownership
- ProposedAction lifecycle
- DeveloperSession
- Validation evidence

Derived/non-canonical state includes:
- UI layout
- rendered panels
- search indexes
- recomputable architecture projections
- provider-native response IDs
- provider-native chat/session state
- Theia AI session state

Do not confuse derived convenience with canonical truth.

## Workspace modes

Dope defines a product-level WorkspaceMode abstraction.

Initial useful modes:
- BUILD
- PLAN

Later modes may include:
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
- at least one additional Open VSX extension installed and used

Compatibility claims require real evidence.

## Security / authority boundary

When mutation-capable AI is introduced, no model receives direct filesystem/process mutation authority.

AI
-> ProposedAction
-> Authority / Permission Layer
-> ToolExecutor
-> filesystem / process / Git / browser / network

Repository content, extensions, remote tools, MCP servers, and model output are untrusted relative to Dope's configured authority ceiling.

## Relationship to George

George code may be studied or selectively borrowed only where it fits this architecture.

No George API, state schema, TUI assumption, provider choice, or compatibility requirement is authoritative for Dope.
