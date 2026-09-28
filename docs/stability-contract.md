# Dope Stability Contract

Status: INITIAL STABILITY CONTRACT

Dope combines an IDE, persistent project knowledge, and eventually model inference, tool execution, and deeper framework integration.

Reliability includes software correctness, state truth, developer understanding, and containment of unintended effects.

## Phase-aware qualification

Stability requirements apply when the corresponding capability exists in the approved phase.

A future invariant remains an architectural requirement, but it does not authorize premature implementation merely so it can be tested.

For each task or phase:
1. identify which capabilities actually exist
2. apply the stability sections relevant to those capabilities
3. preserve future invariants at interface boundaries
4. do not build deferred subsystems solely for qualification

Foundation Spike 0 is a completed Theia substrate qualification. Its evidence remains authoritative for the bounded substrate claims recorded in `docs/tasks/p0/closeout.md`.

The active Phase 1 — IDE Alive stability concerns are:
- native Electron startup/package viability plus ordinary interactive Theia workbench behavior;
- repository/workspace opening and restoration;
- editor/language-service behavior;
- Explorer/search;
- terminal;
- Git/SCM and diffs;
- debugger and Problems;
- test integration;
- preferences/keybindings;
- extension installation, function, and restart persistence;
- dark-first default theme plus persistent explicit user theme override;
- workbench layout/editor restoration;
- fresh-environment Linux packaging and launch;
- real dogfooding on the Dope repository without requiring another IDE for ordinary development.

Agent State, Agent Runtime, model/provider execution, tool authority, AI mutation, scoped delegation, production Project Mind, and production Planning are not Phase 1 qualification requirements.

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

Only state types introduced by the current phase need executable coverage.

A crash, restart, provider failure, or UI reconstruction must not silently convert derived state into canonical truth when those mechanisms exist.

## Bootstrap independence and self-development recovery

Self-development must never create a hidden privileged path or make the repository dependent on a healthy Dope runtime for repair.

When the corresponding capabilities exist, qualification should verify:
- the Dope repository remains inspectable and editable with conventional external tools;
- Git history and ordinary build/test entry points remain usable outside Dope;
- durable canonical project knowledge has a documented backup/export/recovery path independent of a healthy GUI path;
- self-targeted agent work receives the same observation/mutation authority as equivalent work on another repository;
- upgrade or migration failure leaves a recoverable fallback path;
- self-development evidence is not generalized into compatibility claims for unrelated stacks without separate evidence.

Foundation Spike 0 does not need to self-host. It only needs to preserve these architectural boundaries so later phases can qualify them without redesigning the foundation.

## Developer-understanding invariant

Qualification is not purely "the feature works."

For product workflows that expose objectives, plans, ownership, assumptions, conceptual changes, validation, or durable knowledge, evidence should show that the developer can inspect the applicable state.

Do not require future Agent Mind fields during phases that do not yet implement Agent Mind.

A faster autonomous path that hides applicable developer-facing state without an explicit autonomy choice can be a product regression.

## Project Intelligence persistence

Durable artifacts require stable identity, schema version, provenance, relationships, restart survival, explicit migration, and defined corruption/failure behavior as those features are introduced.

A persistence backend can be replaced without redefining the domain.

For Foundation Spike 0, qualification is deliberately minimal:
- persist a minimal ProjectArtifact or Note
- preserve stable identity and basic provenance
- restore it after application restart
- render it through a Dope-owned view
- keep the persisted representation independent from Theia-owned workspace/chat state

The spike does not need the full Project Mind schema or final persistence backend.

## Agent Mind

Applicable when AI Presence introduces Agent Mind.

Agent Mind exposes structured working state, not raw chain-of-thought.

Tests should treat its fields as application state with defined producers and transitions.

Do not persist hidden reasoning content merely to make UI look more transparent.

## Steering consistency

Applicable when continuous steering exists.

When the developer changes objective, plan, ownership, constraints, or validation expectations:
- canonical shared state updates first
- Agent Runtime consumes new state
- stale pending actions are invalidated or explicitly reconciled
- UI reflects the same state
- no invisible old plan continues mutating the project

## Ownership

Applicable when scoped ownership/delegation exists.

Human, AI, and shared ownership must be enforceable.

AI observation of human-owned code does not imply mutation authority.

Tests must cover denied mutation in human-owned scopes while allowing permitted observation/review.

## Tool authority

Applicable when mutation-capable model/tool execution exists.

A model proposes effects; Dope authorizes and executes them.

Repository text, model output, extensions, MCP metadata, framework state, and project artifacts cannot raise the configured authority ceiling.

Mutation paths must be typed and observable.

At minimum distinguish observation/read, workspace mutation, process execution, Git mutation, network, browser/external action, secrets/credentials, and destructive action.

## Process truth

A working directory is not an OS sandbox.

If future autonomous process execution claims containment, that claim requires an actual qualified sandbox.

## Live Plans and Tasks

Applicable when Planning introduces Plan/Task state.

Plan/task completion is application truth, not model assertion.

A plan step becomes complete only through the applicable transition rule and evidence.

Changes to a live plan must remain synchronized with any task/agent state that exists in that phase.

## Ideas

Applicable when Project Mind introduces Ideas.

Capturing an Idea must not mutate active work unless the developer or an explicit workflow promotes it.

Ambient discovery should never silently expand scope.

## Architecture model

Applicable when ArchitectureModel is introduced.

Architecture evidence retains provenance/classification:
- deterministic static observation
- runtime observation
- inferred semantic relation
- developer target
- agent proposal

Do not present inferred relationships as observed facts.

## Conceptual ChangeSets

Applicable when conceptual ChangeSets are introduced.

A ChangeSet preserves conceptual intent and affected behavior while remaining traceable to files/diffs.

It must not replace Git evidence.

If conceptual description and actual diff diverge, the discrepancy is a failure signal.

## Provider failures

Applicable when model/provider execution is introduced.

Streaming errors, malformed structured output, timeout, cancellation, and provider restart must not corrupt canonical project/task state.

Provider-native identifiers are optimization/adapter state, not sole project history.

## Theia boundary

Theia-specific code may not become the only implementation of core product semantics.

For Foundation Spike 0, tests should exercise the minimal Dope-owned contracts actually introduced by the spike without requiring Agent State, Authority, or Agent Runtime.

At minimum this includes the minimal persisted ProjectArtifact/Note contract and any Dope-owned WorkspaceMode/backend contract created by the spike.

Later phases add framework-independent tests for Planning, Agent State, Authority, Agent Runtime, and other domain services when those services exist.

## Framework customization

Supported extension points are preferred.

Deep/private API use is explicitly tracked.

A framework upgrade that breaks broad product behavior is Not Green until coupling is removed, a supported replacement is used, or the owner explicitly accepts a bounded exception.

## Restart restoration

Verify the restart state applicable to the current phase.

For Foundation Spike 0:
- minimal canonical Project Mind spike state persists
- custom UI projections reconstruct
- no Theia-only state is silently promoted into canonical product state
- the packaged application can restore the qualified state

Later phases add session restoration, pending-action handling, provider/framework staleness, and incomplete-effect recovery when those concepts exist.

## Git dirty-state preservation

Dope preserves pre-existing user changes whenever a task can mutate repository content.

Agent-generated and pre-existing changes must remain distinguishable where attribution claims are made.

Phase 0 does not need AI mutation to prove this future invariant.

## Extension compatibility

VS Code/Open VSX compatibility claims require real extension evidence.

Do not infer compatibility from API claims alone.

## Packaging

Desktop packaging evidence uses the produced package, not only the development server.

Foundation Spike 0 required a real Linux artifact plus native launch/process evidence outside the dev server, correct packaged resources/branding, and the strongest practical programmatic renderer smoke.

Product Phase 1 separates package proof from IDE-interaction proof: P4 requires a reproducible/fresh-environment package path, branded product metadata/icon, packaged resources, and normal native Electron launch. P5 requires direct interaction with the real Theia GUI and may use either the browser-hosted workbench or Electron. Programmatic renderer/CDP evidence may supplement but cannot replace the P5 interactive GUI gate.

## Framework upgrade qualification

A framework upgrade is qualified when a real upgrade is undertaken; Foundation Spike 0 does not perform a synthetic upgrade solely for evidence.

For each real Theia upgrade, record baseline and target versions, dependency/config changes, source fixes, CSS/layout fixes, extension regressions, package/runtime evidence, and private API coupling.

A successful build alone is not sufficient if the upgrade changes material IDE behavior.

## Visual/manual evidence

Record exactly what was observed.

A screenshot or visual pass is evidence for visible behavior only; it does not prove hidden state invariants unless separately instrumented.

Do not require authority/provider evidence before those systems exist.

## Product Phase 1 — IDE Alive success

Phase 1 qualifies only when the candidate has both P4 Electron package/native-launch evidence and P5 direct interactive Theia GUI evidence on the Dope repository.

At minimum the direct dogfooding evidence must demonstrate:
- open the Dope repository/workspace;
- navigate and edit/save source;
- language diagnostics/Problems;
- workspace search;
- integrated terminal command execution;
- Git/SCM dirty and clean transitions plus diff inspection;
- debugger breakpoint/locals;
- test discovery/execution through the integrated test surface;
- preferences and keybindings;
- extension installation/use and restart persistence;
- dark default presentation on first-run state;
- explicit alternate theme selection persists and overrides the default;
- restart restores the intended workspace/editor/workbench state;
- P4 package/native startup is free of unresolved fatal product blockers.

The dogfooding pass must preserve the repository's pre-existing Git state and restore any controlled edits.

A browser-hosted P5 pass is sufficient when it directly exercises the real Theia workbench interactively. Headless, DOM-query-only, screenshot-only, or CDP-only evidence is insufficient. P4 remains required for Electron/AppImage packaging and native launch.

## Corrections

Every correction must reproduce/characterize the defect, repair it, add a permanent regression guard where executable, rerun affected broader qualification, and preserve historical failure evidence.

## Foundation Spike 0 success

The spike qualifies only if the complete THEIA-SPIKE.md matrix is Green or residual gaps are explicitly classified and judged non-blocking by the owner without being relabeled Green.

Hard substrate blockers cannot be waived into technical Green.
