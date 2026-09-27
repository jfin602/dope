# Foundation Spike 0 — Theia Qualification

Status: CURRENT ENGINEERING GATE

## Purpose

Before major product development, try to break the Theia thesis.

The spike is not a product phase and is not a demo whose goal is to prove the decision correct.

It is a bounded feasibility and upgradeability test.

Initial pin:
- Eclipse Theia 1.75.0
- Node 24 major
- Electron desktop target
- Linux packaging target

The upgrade experiment moves to the next stable release available when the test is executed.

## Success condition

The substrate qualifies only if Dope can implement required product seams without unacceptable coupling to Theia internals and can survive a framework upgrade with bounded repair.

## IDE basics

Prove:
- branded Electron application
- open a real repository
- Monaco editing
- TypeScript language features
- file explorer
- Git/SCM
- integrated terminal
- debugging
- install/use at least one Open VSX extension

## Custom Dope UI

Prove:
- custom Agent Mind panel
- custom Planning central view
- custom Ideas view
- switch between Code and planning-oriented layouts
- hide/replace unwanted standard UI where needed
- workbench styling can materially change product feel

The widgets may use minimal spike data, but data contracts must be Dope-owned.

## Backend

Prove:
- Node backend service
- typed frontend/backend communication
- streaming live structured AgentWorkingState
- stream cancellation/cleanup
- restart-safe service lifecycle

## Local AI

Prove:
- local model through replaceable adapter
- streamed model response
- one tool call
- authority/approval confirmation
- structured output where useful
- provider failure visible without corrupting project state

Theia AI may be tested as infrastructure, but the spike must preserve a Dope-owned adapter boundary.

## Editor <-> Agent

Prove:
- observe active editor
- observe selection
- observe developer edits
- update bounded working set
- propose code change
- display diff
- apply or reject proposed change

Observation must work without granting mutation.

Apply/reject must flow through Dope authority state rather than direct model mutation.

## Project Intelligence

Prove:
- persist a Note
- convert Note -> Task
- expose Task to Agent Runtime
- agent action updates Task state
- state survives restart
- state is readable without Theia AI chat history

Use a deliberately minimal persistence backend. The spike qualifies the boundary, not final storage technology.

## Customization stress test

Exercise non-trivial customization:
- materially change default layout
- hide unwanted standard UI
- replace/rebind at least one Theia service
- customize workbench styling
- persist custom application state
- restore after restart

Record whether each change uses a supported contribution point, custom service/widget, supported rebinding, shell-level API, or private/internal API.

Private/internal dependency is a risk and must be justified or removed.

## Workspace mode experiment

Define Dope WorkspaceMode independently.

Adapt at least BUILD and PLAN.

If Theia Perspectives are used, keep them behind the adapter.

Do not make canonical product state depend on Perspectives.

## Extension/tooling matrix

Qualify TypeScript/JavaScript, Node debugger, JSON, Markdown, Git, terminal, ESLint, Prettier, and one additional Open VSX extension.

## Packaging

Produce a Linux desktop build that launches outside the dev server, opens a repository, restores custom state, and provides qualified editor/terminal/SCM basics.

## Upgrade test

1. Complete the spike on Theia 1.75.0.
2. Record exact dependency pin and candidate commit.
3. Upgrade to the next stable Theia release available at execution.
4. Record every source/config/dependency/CSS fix.
5. Re-run qualification matrix.
6. Classify fixes by cause.

Desired result:
- bounded compilation/config/CSS repairs
- no product-domain rewrite
- no Project Intelligence or Agent Runtime rewrite
- no broad shell surgery

## Hard failure signals

Foundation Spike 0 is Not Green if unresolved:
- core IDE functions require rebuilding commodity infrastructure
- custom product views cannot integrate cleanly
- editor observation requires unsafe mutation coupling
- Project Intelligence must adopt Theia AI/chat state as canonical
- Agent Runtime must import Theia presentation types
- authority cannot mediate model-proposed mutation
- deep/private shell APIs are required broadly
- restart restoration is unreliable
- Linux packaging is not viable
- upgrade requires extensive architectural rewrites

## Evidence states

Each capability is Green, Not Green, or Evidence Gap.

Evidence Gap is not a pass.

Manual visual checks must record what was actually observed.

## Non-goals

Do not build production-quality Agent Mind UX, final persistence architecture, full living architecture model, full ambient intelligence, full search, multi-agent scheduling, marketplace productization, or broad cloud sync.

## Closeout questions

1. Does Theia remain the selected substrate?
2. Which customization techniques are approved?
3. Which framework APIs are forbidden/high-risk?
4. Did Theia AI earn reuse for any infrastructure?
5. Can Project Intelligence and Agent Runtime remain presentation-independent?
6. Did observation/mutation separation work?
7. Did restart restoration work?
8. Did packaging work?
9. Did the upgrade test remain bounded?
10. What architecture changes are required before Product Phase 1?
