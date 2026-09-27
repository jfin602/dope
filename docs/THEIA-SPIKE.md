# Foundation Spike 0 — Theia Qualification

Status: CURRENT ENGINEERING GATE

## Purpose

Before major product development, prove or reject the Theia substrate with the smallest useful feasibility test.

The spike is not a product phase and is not a demo whose goal is to prove the decision correct.

Initial pin:
- Eclipse Theia 1.75.0
- Node 24 major
- Electron desktop target
- Linux packaging target

## Success condition

The substrate qualifies if Dope can build a serious, materially customized IDE on Theia while keeping Dope-owned product state independent from Theia internals, using bounded/supported customization seams, and producing a viable Linux desktop package.

The spike does not need to prove Dope's future AI runtime or perform a synthetic framework upgrade.

## IDE basics

Prove:
- branded application
- open a real repository
- Monaco editing
- TypeScript language features
- file explorer
- search
- Git/SCM
- integrated terminal
- debugging
- install/use Open VSX extensions

## Custom Dope UI

Prove:
- custom Project Mind view using minimal spike data
- custom Planning view using minimal spike data
- BUILD/PLAN workspace modes or equivalent Dope-owned layout switching
- hide/replace unwanted standard UI where needed
- workbench styling can materially change product feel

Data contracts used by custom views must be Dope-owned.

The spike is proving that differentiated product surfaces fit cleanly inside Theia, not implementing final Project Mind or Planning UX.

## Backend and application seams

Prove:
- Node backend service
- typed frontend/backend request/response
- at least one backend-originated state/event update reaching the frontend
- cleanup for any long-lived transport used by the spike
- restart-safe service lifecycle

Transport/framework choices must remain replaceable.

## Minimal Project Mind persistence

Prove:
- persist a minimal ProjectArtifact or Note
- retain stable identity and basic provenance
- restore it after application restart
- render it through a Dope-owned custom view
- keep the persisted representation independent from Theia workspace/chat state

Use a deliberately minimal persistence backend.

The spike qualifies ownership and restart boundaries, not the final persistence architecture.

## Customization stress test

Exercise non-trivial customization:
- materially change default layout
- hide unwanted UI
- replace/rebind at least one Theia service
- customize workbench styling
- persist custom application state
- restore after restart

Record whether each change uses a supported contribution point, custom service/widget, supported rebinding, shell-level API, or private/internal API.

Broad private/internal dependence is a blocker unless explicitly accepted.

## Workspace mode experiment

Define Dope WorkspaceMode independently.

Adapt at least BUILD and PLAN.

If Theia Perspectives or layout services are used, keep them behind an adapter.

Canonical product state must not depend on framework layout identifiers.

## Extension/tooling matrix

Qualify:
- TypeScript/JavaScript
- Node debugging
- JSON
- Markdown
- Git
- terminal
- ESLint
- Prettier
- one additional Open VSX extension

## Packaging

Produce a real Linux desktop artifact and prove it launches outside the development server with correct Dope packaging/resources.

P4 provides the direct GUI/workbench qualification. P5 provides native package/build/launch evidence. Native Electron visual interaction that cannot be observed programmatically may remain an explicit Evidence Gap rather than blocking the spike by itself.

## Upgradeability

Upgradeability remains important but is not a Foundation Spike 0 execution gate.

Keep framework coupling isolated and documented. The first natural Theia upgrade should be treated as its own qualification event with repair/coupling evidence.

## AI scope

Actual model integration is intentionally deferred.

Foundation Spike 0 does not qualify:
- a local model
- OpenAI/Codex runtime integration
- AgentWorkingState streaming
- Agent Mind runtime behavior
- tool calling
- ProposedAction execution
- model-generated code changes
- editor-agent mutation flows
- scoped delegation

Theia AI remains eligible for later selective reuse behind a Dope adapter.

## Hard failure signals

Foundation Spike 0 is Not Green if unresolved:
- core IDE functions require rebuilding commodity infrastructure
- custom Dope views cannot integrate cleanly
- Dope-owned persisted state must adopt Theia-specific schemas as canonical
- broad private shell APIs are required
- an early framework fork is required
- restart restoration is unreliable
- Linux packaging cannot produce/launch a real desktop artifact
- extension/tooling incompatibility undermines a serious IDE

## Evidence states

Each capability is Green, Not Green, or Evidence Gap.

Evidence Gap is not a pass, but a bounded non-substrate gap may be owner-accepted without being relabeled Green.

Manual visual checks must record what was actually observed.

## Non-goals

Do not build production Project Mind, production Planning, Agent Mind, final persistence architecture, model integration, full living architecture model, ambient intelligence, semantic search, multi-agent scheduling, marketplace productization, or cloud sync.

## Closeout questions

1. Does Theia remain the selected substrate?
2. Which customization techniques are approved?
3. Which framework APIs are forbidden/high-risk?
4. Can Dope-owned domain and persistence state remain presentation-independent?
5. Can BUILD and PLAN surfaces be expressed without framework-owned canonical state?
6. Did restart restoration work?
7. Did commodity IDE functionality remain strong?
8. Can the application be packaged and launched as a real Linux desktop product?
9. What architecture changes are required before Product Phase 1?
