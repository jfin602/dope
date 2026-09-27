# Foundation Spike 0 Qualification Plan

Status: READY FOR PROMPT DECOMPOSITION

This plan defines evidence required to qualify Theia. It is not yet the execution prompt stack.

## Gate A — Bootstrap and commodity IDE

Evidence:
- branded Electron app launches
- real repository opens
- file explorer works
- Monaco edits/saves
- TypeScript language service works
- Git/SCM detects changes
- terminal executes commands
- debugger hits breakpoint
- Open VSX extension installs and functions

All required capabilities must be Green.

## Gate B — Dope UI surface

Evidence:
- Agent Mind custom panel renders structured Dope state
- Planning central view renders Dope Plan state
- Ideas view renders Dope Idea state
- BUILD/PLAN workspace modes alter layout through Dope WorkspaceMode adapter
- unwanted standard UI can be hidden/replaced where necessary
- styling creates a materially distinct branded workbench

No canonical product state may depend on widget instances or Theia-only schemas.

## Gate C — Typed backend + streaming

Evidence:
- frontend calls typed Node backend service
- backend streams AgentWorkingState updates
- cancellation stops stream
- reconnect/restart reconstructs state from Dope-owned persistence

Transport/framework must be replaceable without changing AgentWorkingState.

## Gate D — Local AI + authority

Evidence:
- local model connection
- streaming
- structured response
- proposed tool call
- ProposedAction created
- approval required where configured
- ToolExecutor executes only after authority
- failure/cancel path leaves canonical state consistent

Model/provider never directly owns mutation.

## Gate E — Editor-agent integration

Evidence:
- active editor observed
- selection observed
- edits observed
- working set updated
- AI proposes change
- diff displayed
- reject leaves file unchanged
- apply produces expected file change
- authority/ownership enforced

Observation and mutation must be proven separate.

## Gate F — Project Intelligence persistence

Sequence:
1. create Note
2. persist
3. convert Note -> Task
4. Agent Runtime consumes Task
5. agent action updates Task
6. restart application
7. Note/Task/state survive
8. state readable without framework chat history

Project Intelligence remains Dope-owned and restart-safe.

## Gate G — Customization stress

Evidence:
- material default layout change
- hide unwanted UI
- rebind/replace one real Theia service
- custom styling
- persistent custom application state
- restart restoration

For every customization record whether it uses public contribution, public service, rebinding, shell API, or private/internal API.

Broad private/internal coupling is Not Green.

## Gate H — Extension/tooling matrix

Test TypeScript/JavaScript, JSON, Markdown, Node debugging, Git, terminal, ESLint, Prettier, and one additional Open VSX extension.

Blocking incompatibilities are Not Green; bounded gaps remain explicit.

## Gate I — Linux packaging

Evidence:
- production desktop artifact built
- launched outside dev mode
- repository opened
- state restored
- key IDE and custom panels functional

Dev-server-only success is insufficient.

## Gate J — Upgrade

Baseline: Theia 1.75.0.

Target: next stable release available at execution time.

Process:
- upgrade dependencies/tooling
- build
- repair only what evidence requires
- rerun A-I
- classify every repair
- compare coupling

No product-domain rewrite and no broad private-shell repair.

## Automated coverage

At minimum add tests for ProjectArtifact persistence round trip, Note -> Task transition, AgentWorkingState transitions, ownership/authority denial, ProposedAction approval/rejection, editor observation without mutation, restart reconstruction, and runner regressions.

## Manual/browser evidence

Expected for layout, custom panels, editor interactions, debugger, extension UX, diff/apply/reject UX, packaging, and upgrade visual regression.

Prompts requiring direct evidence use Browser required: yes.

## Closeout artifact

Closeout records exact baseline/upgraded Theia versions, qualification matrix, customization-coupling ledger, extension matrix, packaging result, upgrade repair ledger, remaining gaps, explicit substrate decision, and required architecture amendments.

## Stop conditions

Return Planning needed if Theia reality contradicts the approved domain boundary, an authority bypass appears unavoidable, the spike would require a framework fork, private API use becomes broad, or a target upgrade materially changes the substrate before baseline qualification.

Normal implementation defects inside the approved spike should be repaired and regression-tested rather than treated as planning stops.
