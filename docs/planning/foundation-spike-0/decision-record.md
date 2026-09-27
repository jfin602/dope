# Foundation Spike 0 Decision Record

Status: APPROVED DIRECTION / REQUIRES EXECUTION EVIDENCE

## Decision

Use Eclipse Theia as Dope's initial IDE substrate, but treat that decision as provisional until a bounded Foundation Spike 0 deliberately stress-tests capabilities and coupling risks that matter to Dope.

Initial spike baseline:
- Theia 1.75.0
- Node 24 major
- Electron desktop
- Linux package
- TypeScript/Node stack

## Why Theia

Theia is designed as a framework for building custom IDE products and already supplies large amounts of commodity IDE infrastructure: Monaco, workspaces/filesystem, terminal, SCM/Git, debugging, search, commands/preferences/keybindings, LSP/TextMate, VS Code extension compatibility, Open VSX, frontend/backend split, dependency injection/service replacement, custom React widgets/workbench extension, Electron, and AI infrastructure.

Rebuilding these features would distract from Dope's actual product thesis.

## Product boundary

Theia is infrastructure, not the conceptual architecture of Dope.

Dope owns Project Intelligence, Agent Mind, DeveloperSession, steering, ownership/delegation, Ideas/Research/Decisions/Plans/Tasks, ChangeSets/Validation, ArchitectureModel, and authority.

These concepts remain valid if presentation framework changes.

## Theia AI decision

Theia AI is eligible for selective reuse behind a Dope adapter.

Potential reusable infrastructure includes model registry/providers, OpenAI-compatible/local provider plumbing, model tools, context variables, MCP, prompt services, confirmations, structured output, and session plumbing.

Theia AI agent/chat abstractions do not become Dope's domain model.

The spike must earn each reused capability.

## Customization policy

Use in order:
1. contribution points
2. custom widgets/services
3. service rebinding/replacement
4. shell customization where justified
5. fork only as last resort

Private/internal API dependency is architectural debt and may block qualification.

## Workspace modes

Dope owns WorkspaceMode.

Theia Perspectives may implement a mode adapter if sufficiently stable.

Product state must not depend on Perspectives.

## Authority decision

No model receives direct mutation authority.

Observation and mutation are separate.

Mutation passes through ProposedAction -> Authority -> ToolExecutor.

This remains true even if Theia AI offers its own tool-confirmation mechanism; Dope policy stays authoritative.

## Upgradeability decision

Upgradeability is tested immediately.

The spike is incomplete until one Theia upgrade has been performed and fixes classified.

## Rejection conditions

Reconsider Theia if the spike shows broad private shell APIs, product/domain objects tied to Theia internals, Theia AI chat/session state becoming canonical Project Brain, an early framework fork, unbounded upgrade repair, unreliable editor-agent observation/diff/apply, unworkable packaging, or extension/tooling incompatibility severe enough to undermine a serious IDE.

## Non-decision

The spike does not yet lock final persistence backend, final local model, visual design, agent loop, final package decomposition, cloud/network architecture, or multi-agent execution.
