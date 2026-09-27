# Foundation Spike 0 Decision Record

Status: APPROVED DIRECTION / REQUIRES EXECUTION EVIDENCE

## Decision

Use Eclipse Theia as Dope's initial IDE substrate, but treat that decision as provisional until a bounded Foundation Spike 0 stress-tests the IDE capabilities, customization seams, persistence boundary, and Linux packaging that matter to Dope.

Initial spike baseline:
- Theia 1.75.0
- Node 24 major
- Electron desktop
- Linux package
- TypeScript/Node stack

## Why Theia

Theia is designed as a framework for building custom IDE products and already supplies the commodity IDE infrastructure Dope needs: Monaco, workspaces/filesystem, terminal, SCM/Git, debugging, search, commands/preferences/keybindings, LSP/TextMate, VS Code extension compatibility, Open VSX, frontend/backend separation, dependency injection/service replacement, custom widgets/workbench extension, and Electron.

Rebuilding these capabilities would distract from Dope's product thesis.

## Product boundary

Theia is infrastructure, not the conceptual architecture of Dope.

Dope owns Project Mind / Project Intelligence, Plans, Tasks, Agent Mind, DeveloperSession, ownership/delegation, steering, ChangeSets, Validation, ArchitectureModel, and authority.

These concepts remain valid if the presentation framework changes.

## Spike scope decision

Foundation Spike 0 qualifies Theia, not the full Dope product.

It must prove:
- serious IDE basics
- material Dope UI customization
- Dope-owned custom views
- typed frontend/backend seams
- minimal Dope-owned persistence and restart restoration
- extension/tooling compatibility
- viable Linux packaging/launch

It does not need to prove the future model/agent runtime or a synthetic framework upgrade.

## Theia AI decision

Theia AI remains eligible for selective reuse behind a Dope adapter in later phases.

Theia AI agent/chat abstractions do not become Dope's domain model.

Actual Theia AI/model qualification is deferred until AI Presence work.

## Model/provider boundary

Dope is not architecturally tied to Theia AI or any model provider.

ADR 0004 governs provider/model independence.

OpenAI/ChatGPT/Codex compatibility and local-model compatibility are first-class future requirements, but they are not prerequisites for qualifying the Theia substrate.

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

Theia Perspectives/layout services may implement a mode adapter if sufficiently stable.

Product state must not depend on framework layout identifiers.

## Authority decision

Observation and mutation authority remain separate architectural concerns.

No future model receives direct mutation authority.

That rule remains authoritative, but its execution path is not part of Foundation Spike 0 qualification.

## Upgradeability decision

Upgradeability is preserved as a design requirement, not tested through a synthetic Phase 0 version bump.

The first natural Theia upgrade must be treated as a qualification event with explicit repair/coupling evidence. Broad private-shell repair, domain rewrites, or a framework fork remain failure signals at that time.

## Rejection conditions

Reconsider Theia if the spike shows:
- broad private shell API dependence
- product/domain objects tied to Theia internals
- canonical Dope state requiring Theia-owned schemas
- an early framework fork
- unreliable persistence/restart restoration
- unworkable Linux packaging
- extension/tooling incompatibility severe enough to undermine a serious IDE

## Non-decision

The spike does not lock:
- final persistence backend
- final model/provider set
- local-model runtime
- Theia AI reuse
- visual design
- agent loop
- final package decomposition
- cloud/network architecture
- multi-agent execution
