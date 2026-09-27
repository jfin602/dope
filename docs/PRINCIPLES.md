# Dope Principles

Status: FOUNDATIONAL PRODUCT PRINCIPLES

These principles are product decision tests. A feature that improves agent throughput while materially weakening these principles may be a regression.

## 1. Developer as protagonist

The developer remains the primary operator. Code, architecture, design decisions, and direct manipulation remain visible and accessible.

Dope should make the developer more capable, not turn them into a product manager for a codebase they no longer understand.

## 2. Visible agent cognition

Do not expose raw hidden chain-of-thought.

Expose structured useful working state: objective, plan, current step, assumptions, decisions, questions, uncertainties, risks, working set, ownership, pending actions, and validation state.

The developer must be able to inspect and, where appropriate, change this state.

## 3. Continuous steering

Do not make the default interaction prompt -> disappear -> result -> correction prompt.

The developer should be able to redirect work while preserving shared state.

A mid-session correction should update the task/plan rather than mentally restarting the work.

## 4. Ambient intelligence

Autocomplete is not the center of the product.

Dope should often watch the developer's back while they type.

Ambient observations should be low-friction and non-interruptive unless severity warrants interruption.

## 5. Scoped delegation

Automation is a dial, not a global mode.

Ownership may be HUMAN, AI, or SHARED and may vary within one task.

Observation permission and mutation permission are separate.

AI may inspect human-owned work and warn about problems without automatically mutating it.

## 6. Conceptual observability

Raw diffs are necessary but insufficient.

Dope should first expose changes at the level people reason about systems: architecture, behavior, invariants, unchanged boundaries, and validation.

Then allow drill-down:

concept -> subsystem -> file -> diff -> line

## 7. Passive discovery and Ideas

Useful unrelated observations should not derail the current task.

Capture them into an Ideas bin with enough provenance to revisit later.

Ideas can later become notes, research, decisions, plans, or tasks.

## 8. Living software model

Maintain an explorable model of architecture, subsystem relationships, dependencies, runtime relationships, tasks, decisions, and relevant history.

Derive from reality where possible.

Clearly distinguish observed structure, inferred semantics, developer-authored target architecture, and proposals.

## 9. Persistent developer context

Agents have memory; the developer needs memory too.

Reopening a project should restore enough context to resume thinking quickly: prior objective, current state, unresolved work, recent decisions, failing validation, and captured ideas.

## 10. Remove friction, not skill

Aggressively remove boilerplate, repetitive edits, documentation lookup, search/tracing, mechanical refactors, test scaffolding, validation plumbing, and repetitive debugging.

Preserve engineering thinking that produces understanding.

## 11. Integrated thinking environment

Planning and note-taking are first-class.

Dope should be the home of ideas, notes, questions, research, architecture exploration, decisions, plans, tasks, implementation, validation, and project history.

## Cross-cutting principles

The eleven pillars above remain the product pillars.

Cross-cutting architecture and execution laws:
- Session over prompt.
- Authority is explicit: models propose; Dope authorizes and executes.
- Framework independence: Theia is a substrate.
- Model/provider independence: no provider, model family, hosted service, or local runtime owns Dope's product/intelligence model.
- OpenAI/ChatGPT/Codex compatibility and local-model compatibility are first-class requirements.
- Capability-based adapters should preserve provider-specific strengths rather than collapsing everything to a lowest common denominator.
- Mastery over spectacle.

The target feeling is not "the AI did a lot."

The target feeling is:

> I built that. I understand it. I got somewhere today.
