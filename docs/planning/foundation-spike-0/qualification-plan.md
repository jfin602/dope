# Foundation Spike 0 Qualification Plan

Status: IN EXECUTION — P1-P3 COMPLETE / P4 NEXT

This plan defines evidence required to qualify Theia as Dope's initial IDE substrate.

It does not qualify Dope's future AI runtime.

## Gate A — Bootstrap and commodity IDE

Evidence:
- branded application launches
- real repository opens
- file explorer works
- Monaco edits/saves
- TypeScript language service works
- search works
- Git/SCM detects changes
- terminal executes commands
- debugger hits breakpoint
- Open VSX extension installs and functions

## Gate B — Dope UI surface

Evidence:
- Project Mind custom view renders Dope-owned spike state
- Planning custom view renders Dope-owned spike state
- BUILD/PLAN workspace modes alter layout through a Dope-owned adapter or equivalent boundary
- unwanted standard UI can be hidden/replaced where necessary
- styling creates a materially distinct branded workbench

No canonical product state may depend on widget instances or Theia-only schemas.

## Gate C — Typed backend and minimal persistence

Evidence:
- frontend calls a typed Node backend service
- backend-originated state/event update reaches the frontend
- long-lived transport, if used, has cleanup
- a minimal ProjectArtifact or Note persists with stable identity
- application restart reconstructs the persisted artifact
- persisted state is readable without Theia chat/session state

Transport and persistence implementation choices must remain replaceable.

## Gate D — Customization stress

Evidence:
- material default layout change
- hide unwanted UI
- rebind/replace one real Theia service
- custom styling
- persistent custom application state
- restart restoration

For every customization record whether it uses public contribution, public service, rebinding, shell API, or private/internal API.

Broad private/internal coupling is Not Green.

## Gate E — Extension/tooling matrix

Test:
- TypeScript/JavaScript
- JSON
- Markdown
- Node debugging
- Git
- terminal
- ESLint
- Prettier
- one additional Open VSX extension

Blocking incompatibilities are Not Green; bounded gaps remain explicit.

## Gate F — Linux packaging

Evidence:
- real Linux desktop artifact is produced
- package identifies Dope correctly
- application launches outside dev mode without immediate failure
- packaged resources resolve without source-tree/dev-server dependence
- strongest practical programmatic renderer smoke is recorded

P4 carries the direct GUI/workbench qualification. If native Electron visual interaction is unavailable to the execution environment, record that portion as Evidence Gap rather than fabricating a pass.

## Automated coverage

At minimum retain tests for:
- minimal ProjectArtifact/Note persistence round trip
- stable identity across restart reconstruction
- typed backend contract behavior
- custom WorkspaceMode/domain adapter
- phase-runner regressions
- coherent Theia 1.75 dependency baseline
- browser and Electron builds

Do not add AgentWorkingState, tool-authority, provider, or editor-agent mutation tests merely to satisfy future architecture.

## Manual/browser evidence

P4 is the single required browser/GUI gate and covers:
- layout
- custom panels/views
- editor interaction
- debugger
- extension UX
- restart restoration

Packaging is runner-owned in P5. Native Linux Electron visual interaction may remain a bounded Evidence Gap when unavailable.

## AI deferral

The following are explicitly outside this qualification plan:
- local or hosted model connection
- OpenAI/Codex runtime integration
- Agent Mind execution
- ProposedAction/tool execution
- AI diff/apply/reject
- scoped delegation
- ambient intelligence

## Closeout artifact

Closeout records:
- exact final Theia baseline
- Gate A-F qualification matrix
- customization-coupling ledger
- extension matrix
- persistence/restart result
- Linux package/build/launch result
- remaining gaps
- explicit substrate decision
- required architecture amendments before Product Phase 1

## Stop conditions

Return Planning needed if:
- Theia reality contradicts the approved domain boundary
- the spike would require a framework fork
- private API use becomes broad
- canonical Dope state must become Theia-owned
- Linux packaging exposes a substrate-level blocker

Normal implementation defects inside the approved spike should be repaired and regression-tested rather than treated as planning stops.
