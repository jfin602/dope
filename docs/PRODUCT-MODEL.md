# Dope Product Model

Status: INITIAL DOMAIN CONTRACT

This document defines product concepts independently from Theia, Theia AI, any model provider, and any specific persistence backend.

## Project Brain

Project Brain is the durable structured knowledge of one software project.

It is not chat history, Theia workspace state, or provider-native memory.

The GUI renders it. Agents consume and update it under explicit rules. It persists independently.

## Base artifact

ProjectArtifact is the common durable identity for project knowledge.

Minimum conceptual fields:
- id
- type
- title
- status
- createdAt
- updatedAt
- provenance
- links/relationships
- optional project/session/task scope

Provenance must distinguish developer-authored, AI-proposed, AI-generated and developer-accepted, derived from repository/runtime evidence, and imported state.

Derived state must never silently become developer-authored truth.

## First-class artifact types

### Note

Durable developer or AI-assisted thought. A Note may preserve raw thought, structured hypothesis, reason, open question, and next investigation.

### Idea

A passive discovery that is useful but not active work.

An Idea does not automatically become work. It can be deleted, promoted to a Note, researched, converted into a Decision, attached to a Plan, or turned into a Task.

### Question

A durable unresolved question linked to research, decisions, plans, code, architecture nodes, or sessions.

### Research

A structured investigation retaining question, alternatives, evidence, project constraints, unknowns, sources, conclusions, and limitations.

### Decision

Institutional memory for an architectural/product/engineering choice.

Minimum useful shape:
- decision
- status
- context
- rationale
- consequences
- alternatives considered
- revisit conditions
- evidence/affected-artifact links

Later agents should be able to detect conflict with an accepted Decision.

### Plan

A live control structure, not a static memo.

Plan steps may be pending, active, blocked, complete, skipped, or superseded.

Changing an assumption or step should update shared execution state rather than requiring the agent to reconstruct the task from conversation.

### Task

A bounded unit of executable work linking objective, plan, ownership, requirements, constraints, working set, proposed actions, validation, changesets, and completion state.

### DeveloperSession

The durable unit representing one development session.

A session can span manual and AI work and should answer:
- what were we trying to do;
- what changed;
- what did the developer do;
- what did AI do;
- what decisions were made;
- what remains unresolved;
- what validation exists;
- what ideas were captured.

A session is not a raw transcript.

### ArchitectureModel

A versioned/refreshable software model containing subsystems, modules, files, symbols, dependencies, runtime/data-flow edges, ownership, tests, active-task impact, and target-architecture overlays.

Evidence classes remain distinguishable:
- observed deterministic structure;
- runtime observation;
- inferred semantic relationship;
- developer-authored target;
- agent proposal.

### ChangeSet

A conceptual representation of a software change: purpose, architecture changes, behavior changes, preserved invariants, unchanged surfaces, affected files/symbols, validation, and relationships to Task/Plan/Decision.

ChangeSet is the bridge from concept to raw diff.

### Validation

Durable correctness/qualification evidence retaining command/procedure, environment, result, observed failures, scope, timestamp, evidence links, and status: Green, Not Green, or Evidence Gap.

A later pass must not erase historical failures.

## Knowledge lifecycle

Observation
-> Idea
-> Explore / Research
-> Decision
-> Plan
-> Task
-> Implementation
-> Validation
-> Project Knowledge

This is not mandatory linear flow. Artifacts can branch, merge, and link.

## Agent Mind

Agent Mind is the structured visible working state of an active agent/session.

AgentWorkingState contains at least:
- objective
- currentStep
- plan[]
- assumptions[]
- decisions[]
- questions[]
- risks[]
- uncertainties[]
- workingSet[]
- ownership[]
- pendingActions[]
- validationState
- status
- lastUpdatedAt

This state is not raw chain-of-thought.

It is product-facing execution state intended for inspection, steering, persistence, and UI rendering.

## Ownership and delegation

Ownership is explicit and scoped.

Initial values:
- HUMAN
- AI
- SHARED

Ownership can apply to task, plan step, subsystem, file/symbol, validation step, or review responsibility.

Observation rights and mutation rights are separate dimensions.

## ProposedAction

A model does not mutate the environment directly.

It creates or contributes to a ProposedAction with actor, intent, action type, target, expected effect, required authority, originating task/step, evidence/justification, and state.

Possible states:
- proposed
- approved
- rejected
- executing
- succeeded
- failed
- uncertain

The Authority layer decides whether execution is permitted.

## Live steering

Steering is a state transition, not merely another prompt.

A steering action may change objective, edit plan steps, change ownership, add/remove constraints, accept/reject an assumption, stop delegation, preserve a tangent as an Idea, reclassify behavior as intentional, or alter validation expectations.

Agent Runtime should consume updated canonical state.

## Search model

Project-wide search should eventually span code, notes, ideas, questions, research, decisions, plans, tasks, architecture, sessions, changesets, and validation/tests.

Semantic questions resolve against durable project state with provenance.

## Persistence rules

Canonical product artifacts survive application restart.

Persistence backend is an adapter decision.

Foundation Spike 0 should prove a minimal durable implementation without prematurely locking the long-term backend.

The persistence representation must preserve stable IDs, schema version, provenance, relationships, timestamps, and a migration path.

## Derived versus canonical state

Never silently promote derived UI/framework/provider state into canonical project truth.

Theia layout is presentation state. Theia AI chat session is framework state. Model narration is provisional. Architecture extraction is evidence with provenance, not infallible truth.

## Build + Think relationship

BUILD and THINK objects link through the same model.

A Task may link to a Decision. A ChangeSet may implement a Plan step. A Validation may qualify a ChangeSet. An Idea may be captured while debugging. A Research artifact may resolve a Question that updates a Decision. A Session ties these together without making transcript text the source of truth.
