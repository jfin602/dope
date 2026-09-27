# Foundation Spike 0 — Theia Qualification

Status: CURRENT ENGINEERING GATE

## Purpose

Before major product development, try to break the Theia thesis.

The spike is not a product phase and is not a demo whose goal is to prove the decision correct.

It is a bounded feasibility and upgradeability test for the IDE substrate.

Initial pin:
- Eclipse Theia 1.75.0
- Node 24 major
- Electron desktop target
- Linux packaging target

The upgrade experiment moves to the next stable release available when the test is executed.

## Success condition

The substrate qualifies only if Dope can build a serious, materially customized desktop IDE on top of Theia while keeping Dope-owned product state independent from Theia internals and surviving a framework upgrade with bounded repair.

The spike does not need to prove Dope's future AI runtime.

## IDE basics

Prove:
- branded Electron application
- open a real repository
- Monaco editing
- TypeScript language features
- file explorer
- search
- Git/SCM
- integrated terminal
- debugging
- install/use at least one Open VSX extension

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
- cancellation/cleanup for any long-lived transport used by the spike
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

Private/internal dependency is a risk and must be justified or removed.

## Workspace mode experiment

Define Dope WorkspaceMode independently.

Adapt at least BUILD and PLAN.

If Theia Perspectives are used, keep them behind an adapter.

Canonical product state must not depend on Perspectives.

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

Produce a Linux desktop build that launches outside the dev server, opens a repository, restores custom state, and provides qualified editor/terminal/SCM basics plus the custom Dope surfaces.

## Upgrade test

1. Complete the spike on Theia 1.75.0.
2. Record exact dependency pin and candidate commit.
3. Upgrade to the next stable Theia release available at execution.
4. Record every source/config/dependency/CSS fix.
5. Re-run the qualification matrix.
6. Classify fixes by cause.

Desired result:
- bounded compilation/config/CSS repairs
- no Dope product-domain rewrite
- no persistence-domain rewrite
- no broad shell surgery

## AI scope

Actual model integration is intentionally deferred.

Foundation Spike 0 does not need to qualify:
- a local model
- OpenAI/Codex integration
- AgentWorkingState streaming
- Agent Mind runtime behavior
- tool calling
- ProposedAction execution
- model-generated code changes
- editor-agent mutation flows
- scoped delegation

Theia AI remains eligible for later selective reuse behind a Dope adapter. Phase 0 should only prove that the substrate does not force Dope's future AI/product model into Theia-owned state.

Provider/model independence is governed by ADR 0004.

## Hard failure signals

Foundation Spike 0 is Not Green if unresolved:
- core IDE functions require rebuilding commodity infrastructure
- custom Dope views cannot integrate cleanly
- Dope-owned persisted state must adopt Theia-specific schemas as canonical
- broad private shell APIs are required
- an early framework fork is required
- restart restoration is unreliable
- Linux packaging is not viable
- extension/tooling incompatibility undermines a serious IDE
- upgrade requires extensive architectural rewrites

## Evidence states

Each capability is Green, Not Green, or Evidence Gap.

Evidence Gap is not a pass.

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
8. Did packaging work?
9. Did the upgrade test remain bounded?
10. What architecture changes are required before Product Phase 1?
