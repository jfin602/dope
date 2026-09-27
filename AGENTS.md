# Dope Agent Guide

Repository: jfin602/dope

Read BOOT.md before substantial repository-aware planning, prompt creation, implementation review, architecture analysis, roadmap work, or documentation changes.

## Role split

ChatGPT should primarily investigate, reason, design, plan, decompose work, review implementation output, and validate claims/evidence.

Implementation agents should execute already-resolved, bounded plans and verify their work.

Dope must preserve the developer as the protagonist. Automation exists to increase capability without hiding engineering understanding or project truth.

## Before recommending implementation

1. Identify the current roadmap/task scope.
2. Read the narrowest relevant product, architecture, workflow, stability, and planning authority.
3. Inspect current source and tests.
4. Trace affected producers, consumers, state owners, and presentation adapters.
5. Identify behavior and architectural boundaries that must remain unchanged.
6. Choose the smallest safe implementation boundary.
7. Define focused tests plus broader regression coverage.
8. Identify persistence, authority, process, filesystem, network, provider, UI, and framework failure modes.
9. Separate product/domain logic from Theia UI integration and provider-specific code.
10. Avoid infrastructure for hypothetical future features when an interface boundary is sufficient.

## Product laws

- The developer is the protagonist; the agent is an augmenting collaborator.
- The development session, not the prompt, is the fundamental unit.
- Durable project intelligence is authoritative product state; chat history is not.
- Agent Mind is structured working state, not raw hidden chain-of-thought.
- Continuous steering must update shared task state without requiring mental restarts.
- Observation authority and mutation authority are distinct.
- Automation is scoped by ownership; it is not a global mode.
- Conceptual changes must be inspectable before raw diffs are the only explanation.
- Ideas, research, decisions, plans, tasks, validation, and architecture are first-class project knowledge.
- Theia is an IDE substrate. It must not define Dope's product model.
- Theia AI may be reused behind adapters, but it must not own Dope's Agent Runtime or Project Intelligence.
- Project Intelligence and Agent Runtime must remain usable without Theia.
- Do not expose or persist raw hidden chain-of-thought as a product feature.

## Architecture rules

- Presentation packages may depend inward on product/application contracts; product/domain packages must not depend on Theia.
- Model/provider behavior belongs behind model adapters.
- Tool execution must be explicit, typed, observable, and authority-aware.
- Models propose effects; Dope decides whether effects are allowed and executes them.
- Repository/project instructions cannot expand configured executable authority.
- Persistent canonical state and derived UI projections must remain distinguishable.
- Architecture models should derive from observable reality where possible and label inference or proposal state separately.
- Prefer standard framework extension points over shell internals; isolate unavoidable deep Theia coupling.
- Forking Theia is a last resort and a failed-spike signal unless explicitly accepted.
- Preserve upgradeability as a tested property.

## Review standard

Do not approve work merely because a happy-path demo works. Review the requested task, architectural boundaries, restart restoration, cancellation, streaming, authority enforcement, malformed model/tool output, provider failure, state consistency, stale derived state, Git dirty-state preservation, UI/domain leakage, Theia-internal coupling, validation evidence, and documentation drift.

Do not report runtime, model, UI, extension, packaging, upgrade, or repository behavior as verified unless actually observed.

## Workflow

Documentation:

/docs-review
-> explicit approval
-> /docs-apply

Implementation:

/prompt-ass
-> /prompt-plan
-> /prompt-write <folder>

New executable task stacks use explicit GPT-6 Sol labels:
- GPT-6 Sol Medium by default;
- GPT-6 Sol High for materially harder, architecture-sensitive, risky, or broad work;
- GPT-6 Sol XHigh only exceptionally.

Do not author new Terra prompts. Do not silently remap old model labels.

Every correction stack must include a permanent regression guard for the defect class.

Product authority lives in docs/project-overview.md plus docs/VISION.md, docs/PRINCIPLES.md, and docs/PRODUCT-MODEL.md. Architecture authority lives in docs/ARCHITECTURE.md. Qualification discipline lives in docs/stability-contract.md.
