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

## Qualified substrate findings and Phase 1 product shell

Foundation Spike 0 qualified Theia 1.75.0 as the initial substrate without a framework fork or broad private/internal coupling.

Accepted presentation techniques, in preference order:
1. standard Theia contribution points;
2. custom Dope widgets/services;
3. service rebinding/replacement;
4. bounded shell-level customization where justified;
5. source fork only as a last resort.

The highest-risk qualified seams are shell-area behavior, navigator widget IDs, status-bar CSS, and the window-title service lifecycle. Keep these localized to Theia presentation adapters and do not spread them into product/domain packages.

For Product Phase 1:
- the Electron application is the primary user-facing Dope product shell;
- the browser application remains a development, debugging, and qualification surface;
- the default workbench prioritizes ordinary IDE work rather than unfinished Project Mind or Planning spike surfaces;
- direct interactive Theia dogfooding on the Dope repository is required, using browser-hosted workbench or Electron; P4 separately establishes packaged Electron/native-launch evidence. Headless/CDP-only work does not satisfy the interactive gate.

Presentation preferences such as theme, keybindings, panel layout, and editor preferences may persist for the user, but they are not canonical project-domain state.

Dope is dark-first: first-run/default presentation should use a dark theme and Dope-owned surfaces should be designed and qualified dark-first. Explicit user theme selection must remain supported, persist across restart, and override the default. Structural UI styling should prefer semantic theme tokens rather than assuming fixed dark colors.

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

### Phase 2 implementation boundary

Phase 2 is approved/prepared but not activated. Reuse `@dope/contracts` for framework-independent artifact and transport DTOs. Introduce one real `@dope/project-intelligence` package for artifact operations, transitions and queries, with a separate Node storage module inside that package. Do not create standalone persistence or per-view packages. The domain modules import neither Theia/provider code nor the Node adapter; the adapter depends inward on domain/contracts. Existing `@dope/theia-extension` hosts typed RPC, root attachment and Project Mind presentation.

Start with one local folder per Project Mind and a readable `.dope/project-mind.json` collection. Stable project identity lives in the document, not in an absolute path or Theia workspace/widget identifier. Explicitly reject unsupported multi-root/remote contexts. Only canonical project knowledge goes into this store; drafts, selection, layout, theme and search results are presentation state.

Validate project attachment and subsequent handles on the backend; reject requests for a different attached project. Normalize local roots and enforce storage containment, including symlinks. This is local project isolation, not an OS sandbox or future tool-authority system.

Use one exclusive filesystem mutation lock per project across backend processes and expected document revisions for stale edits. Hold the lock while reading, validating, changing and replacing the snapshot; reject contention/conflicts visibly. Preserve unsaved drafts. Do not automatically steal a lock after a timeout. Document recovery of an abandoned lock after all writers are stopped. External file edits require stopped writers.

Migrate the spike Note explicitly, preserve its ID/content/provenance and original file, and do not invent historical timestamps. Failed migration/corrupt/unsupported data must remain untouched. Exact storage/migration/UI rules live in the Phase 2 plan; no database, service, collaboration or synchronization layer is needed for this scope.

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

Foundation Spike 0 is qualified. Its executed evidence proved:
- Theia IDE fundamentals
- custom Dope views/layouts
- typed frontend/backend communication
- minimal Dope-owned persistence
- restart restoration
- customization/rebinding
- Linux packaging

It does not need to prove:
- model integration
- AgentWorkingState streaming
- tool calling
- authority execution
- editor-agent mutation
- scoped delegation

That result keeps substrate qualification separate from product/AI implementation. Product Phase 1 consumes the qualified IDE substrate without promoting the spike Note, Planning view, or WorkspaceMode projection into later product-domain authority.

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
- user presentation preferences such as theme/keybindings
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

Upgradeability remains an architectural design requirement, not a Foundation Spike 0 execution gate.

Dope should continue to isolate framework coupling, prefer supported extension/rebinding seams, and avoid private shell internals. When a real Theia upgrade is undertaken, treat that upgrade as a qualification event: record required dependency/config/source/CSS repairs, rerun the affected IDE/package evidence, and reject broad product-domain rewrites or framework forks unless explicitly accepted.

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

## Self-development and bootstrap independence

Dope should eventually be able to develop Dope, but self-development is an ordinary-project use case of the architecture rather than a separate execution mode.

When the target repository is Dope:
- Project Intelligence uses the same canonical product contracts;
- Planning uses the same Plan/Task contracts;
- model providers use the same capability adapters;
- Agent Runtime uses the same execution path;
- observation and mutation authority remain unchanged;
- validation and ChangeSet evidence follow the same rules;
- no hidden "self" capability may raise authority or bypass review.

Bootstrap independence is a hard architectural constraint.

A broken or partially upgraded Dope installation must not make the Dope repository unrepairable. Source and Git remain ordinary external artifacts. Build, test, migration, and recovery procedures must retain a path through conventional tooling. Durable Project Mind state must have a documented recovery/export strategy that does not require the healthy application path it is intended to describe.

The self-development progression is deliberately phase-aware:

external bootstrap
-> Dope as editor
-> Dope as project brain
-> Dope as planner
-> Dope as agent supervisor
-> Dope develops Dope

This progression is a qualification overlay. It does not authorize implementing later-phase AI, authority, or delegation systems during Foundation Spike 0.

Dogfooding must not create stack-specific domain coupling. A design that works only because Dope is a TypeScript/Theia repository has not proven the general product contract.

## Relationship to George

George code may be studied or selectively borrowed only where it fits this architecture.

No George API, state schema, TUI assumption, provider choice, or compatibility requirement is authoritative for Dope.
