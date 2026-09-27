# Foundation Spike 0 Qualification Plan

Status: READY FOR PROMPT DECOMPOSITION

This plan defines evidence required to qualify Theia as Dope's initial IDE substrate.

It does not qualify Dope's future AI runtime.

## Gate A — Bootstrap and commodity IDE

Evidence:
- branded Electron app launches
- real repository opens
- file explorer works
- Monaco edits/saves
- TypeScript language service works
- search works
- Git/SCM detects changes
- terminal executes commands
- debugger hits breakpoint
- Open VSX extension installs and functions

All required capabilities must be Green.

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
- long-lived transport, if used, has cleanup/cancellation
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
- production desktop artifact built
- launched outside dev mode
- repository opened
- persisted Dope state restored
- key IDE functions work
- custom Project Mind and Planning surfaces work

Dev-server-only success is insufficient.

## Gate G — Upgrade

Baseline: Theia 1.75.0.

Target: next stable release available at execution time.

Process:
- upgrade dependencies/tooling
- build
- repair only what evidence requires
- rerun Gates A-F
- classify every repair
- compare coupling

No Dope product-domain rewrite and no broad private-shell repair.

## Automated coverage

At minimum add tests for:
- minimal ProjectArtifact/Note persistence round trip
- stable identity across restart reconstruction
- typed backend contract behavior
- any custom WorkspaceMode/domain adapter introduced by the spike
- phase-runner regressions

Do not add AgentWorkingState, tool-authority, provider, or editor-agent mutation tests merely to satisfy future architecture.

## Manual/browser evidence

Expected for:
- layout
- custom panels/views
- editor interaction
- debugger
- extension UX
- packaging
- restart restoration
- upgrade visual regression

Prompts requiring direct evidence use Browser required: yes.

## AI deferral

The following are explicitly outside this qualification plan:
- local or hosted model connection
- OpenAI/Codex runtime integration
- Agent Mind execution
- ProposedAction/tool execution
- AI diff/apply/reject
- scoped delegation
- ambient intelligence

The spike must preserve room for those features without implementing them.

## Closeout artifact

Closeout records:
- exact baseline/upgraded Theia versions
- qualification matrix
- customization-coupling ledger
- extension matrix
- persistence/restart result
- packaging result
- upgrade repair ledger
- remaining gaps
- explicit substrate decision
- required architecture amendments

## Stop conditions

Return Planning needed if:
- Theia reality contradicts the approved domain boundary
- the spike would require a framework fork
- private API use becomes broad
- canonical Dope state must become Theia-owned
- a target upgrade materially changes the substrate before baseline qualification

Normal implementation defects inside the approved spike should be repaired and regression-tested rather than treated as planning stops.
