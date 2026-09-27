# Dope Roadmap

Status: INITIAL ROADMAP
Current gate: Foundation Spike 0

This roadmap intentionally keeps post-spike phases provisional. The substrate must qualify before detailed product sequencing is frozen.

## Foundation Spike 0 — Theia substrate qualification

Purpose:
- prove or reject Theia as Dope's IDE/workbench substrate
- prove domain/presentation boundaries
- prove local AI and editor-agent seams
- prove Project Intelligence persistence
- stress customization
- prove Linux packaging
- perform a framework-version upgrade

Authority:
- docs/THEIA-SPIKE.md
- docs/planning/foundation-spike-0/decision-record.md
- docs/planning/foundation-spike-0/qualification-plan.md

Package family: 0.0.x

No product phase may assume Theia qualified until this gate closes.

## Provisional Product Phase 1 — Project Intelligence + shell foundation

Likely scope:
- production package boundaries
- ProjectArtifact core
- persistence/schema/migrations
- minimal DeveloperSession
- Dope shell branding/layout
- initial project reopen context

Goal: durable product state exists independently from chat/provider/framework state.

## Provisional Product Phase 2 — Agent Mind + authority runtime

Likely scope:
- AgentWorkingState
- objective/plan/current-step projection
- ownership
- ProposedAction
- authority layer
- local/remote model adapter contract
- streamed structured state

Goal: agent execution is visible and controllable without raw chain-of-thought.

## Provisional Product Phase 3 — Shared coding loop

Likely scope:
- editor observation
- working-set updates
- developer edits
- proposal/diff/apply/reject
- continuous steering
- scoped delegation
- validation integration

Goal: human and AI operate inside one steerable session instead of prompt/result cycles.

## Provisional Product Phase 4 — THINK workflows

Likely scope:
- Notes
- Ideas
- Questions
- Research
- Decisions
- live Plans
- Task promotion/linking
- session summary/context restoration

Goal: thinking artifacts become first-class project state.

## Provisional Product Phase 5 — Conceptual review + software model

Likely scope:
- conceptual ChangeSets
- architecture graph/model
- observed/proposed/target distinctions
- dependency impact
- project-wide semantic search

Goal: developers understand system-level changes before raw diff review.

## Provisional Product Phase 6 — Ambient intelligence

Likely scope:
- low-friction continuous observations
- severity/interruption policy
- passive Ideas capture
- local helper-model roles
- performance/context budgeting

Goal: AI watches the developer's back without taking over the work.

## Sequencing rule

Do not turn provisional phases into implementation stacks merely because they are listed.

After Foundation Spike 0:
1. incorporate actual substrate findings
2. run /docs-review
3. revise architecture/product model if needed
4. owner approves
5. only then decompose Product Phase 1
