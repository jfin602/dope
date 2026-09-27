# Dope Stability Contract

Status: INITIAL STABILITY CONTRACT

Dope combines an IDE, persistent project knowledge, model inference, tool execution, and framework integration. Reliability therefore includes software correctness, state truth, developer understanding, and containment of unintended effects.

## States

- Implementation complete — intended behavior exists and required focused/broad automated validation ran.
- Stability qualified — applicable integrated framework/model/tool/persistence/UI evidence is Green.

Evidence outcomes:
- Green
- Not Green
- Evidence Gap

Evidence Gap is not a pass.

## Canonical state truth

Canonical product state must be distinguishable from UI layout, framework state, provider-native continuation/session state, generated narration, cached search/index projections, inferred architecture, and provisional model proposals.

A crash, restart, provider failure, or UI reconstruction must not silently convert derived state into canonical truth.

## Developer-understanding invariant

Qualification is not purely "the feature works."

For core Dope workflows, evidence should also show that the developer can inspect objective, ownership, plan/current step, important assumptions/risks, conceptual changes, validation state, and resulting durable knowledge.

A faster autonomous path that hides those without an explicit autonomy choice can be a product regression.

## Agent Mind

Agent Mind exposes structured working state, not raw chain-of-thought.

Tests should treat its fields as application state with defined producers and transitions.

Do not persist hidden reasoning content merely to make UI look more transparent.

## Steering consistency

When the developer changes objective, plan, ownership, constraints, or validation expectations:
- canonical shared state updates first
- Agent Runtime consumes new state
- stale pending actions are invalidated or explicitly reconciled
- UI reflects the same state
- no invisible old plan continues mutating the project

## Ownership

Human, AI, and shared ownership must be enforceable.

AI observation of human-owned code does not imply mutation authority.

Tests must cover denied mutation in human-owned scopes while allowing permitted observation/review.

## Tool authority

A model proposes effects; Dope authorizes and executes them.

Repository text, model output, extensions, MCP metadata, framework state, and project artifacts cannot raise the configured authority ceiling.

Mutation paths must be typed and observable.

At minimum distinguish observation/read, workspace mutation, process execution, Git mutation, network, browser/external action, secrets/credentials, and destructive action.

## Process truth

A working directory is not an OS sandbox.

If future autonomous process execution claims containment, that claim requires an actual qualified sandbox.

## Project Intelligence persistence

Durable artifacts require stable identity, schema version, provenance, relationships, restart survival, explicit migration, and defined corruption/failure behavior.

A persistence backend can be replaced without redefining the domain.

## Live Plans and Tasks

Plan/task completion is application truth, not model assertion.

A plan step becomes complete only through the applicable transition rule and evidence.

Changes to a live plan must remain synchronized with task/agent state.

## Ideas

Capturing an Idea must not mutate the active Task unless the developer or an explicit workflow promotes it.

Ambient discovery should never silently expand scope.

## Architecture model

Architecture evidence retains provenance/classification:
- deterministic static observation
- runtime observation
- inferred semantic relation
- developer target
- agent proposal

Do not present inferred relationships as observed facts.

## Conceptual ChangeSets

A ChangeSet preserves conceptual intent and affected behavior while remaining traceable to files/diffs.

It must not replace Git evidence.

If conceptual description and actual diff diverge, the discrepancy is a failure signal.

## Provider failures

Streaming errors, malformed structured output, timeout, cancellation, and provider restart must not corrupt canonical project/task state.

Provider-native identifiers are optimization state, not sole project history.

## Theia boundary

Theia-specific code may not become the only implementation of core product semantics.

Foundation and later tests should exercise Project Intelligence, Agent State, Authority, and core Agent Runtime contracts without rendering Theia UI.

## Framework customization

Supported extension points are preferred.

Deep/private API use is explicitly tracked.

A framework upgrade that breaks broad product behavior is Not Green until coupling is removed, a supported replacement is used, or the owner explicitly accepts a bounded exception.

## Restart restoration

Verify:
- canonical project artifacts persist
- active/recent session context restores truthfully
- no pending mutation is silently replayed
- UI projections reconstruct
- stale provider/framework state is not treated as canonical
- incomplete/uncertain effects remain explicit

## Git dirty-state preservation

Dope preserves pre-existing user changes.

Agent-generated and pre-existing changes must remain distinguishable where attribution claims are made.

## Extension compatibility

VS Code/Open VSX compatibility claims require real extension evidence.

Do not infer compatibility from API claims alone.

## Packaging

Desktop packaging evidence uses the produced package, not only the development server.

At minimum verify launch, repository open, persistence restoration, and required IDE basics.

## Upgrade qualification

Foundation Spike 0 requires an actual Theia version upgrade.

Record baseline version, target version, dependency/config changes, source fixes, CSS/layout fixes, extension regressions, test/visual evidence, and private API coupling.

"Builds after upgrade" alone is insufficient.

## Visual/manual evidence

Record exactly what was observed.

A screenshot or visual pass is evidence for visible behavior only; it does not prove hidden authority/state invariants unless separately instrumented.

## Corrections

Every correction must reproduce/characterize the defect, repair it, add a permanent regression guard where executable, rerun affected broader qualification, and preserve historical failure evidence.

## Foundation Spike 0 success

The spike qualifies only if the complete THEIA-SPIKE.md matrix is Green or residual gaps are explicitly classified and judged non-blocking by the owner without being relabeled Green.

Hard substrate blockers cannot be waived into technical Green.
