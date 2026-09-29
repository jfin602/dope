# ADR 0006 — Codex as the first reference AI implementation

Status: Accepted
Date: 2026-09-28

## Decision

When Product Phase 6 — AI Presence begins, Dope will implement and qualify OpenAI/Codex as the first reference AI provider/workflow.

This is a bootstrap and qualification strategy, not a canonical product dependency.

Dope's Model Runtime, project state, Planning, Agent Mind and future authority/tool contracts remain provider-independent under ADR 0004. Local models and local inference runtimes remain first-class compatibility targets.

No product-runtime Codex/OpenAI integration is introduced in Product Phase 3.

## Rationale

The first AI implementation should separate Dope architecture failures from model-capability failures.

A capable reference coding system provides a stronger baseline for validating:
- provider adapter boundaries;
- read-only project/editor context;
- Project Mind and active Plan context;
- streaming/cancellation and structured response behavior;
- visible Agent Mind projections;
- later tool/delegation orchestration.

After the Dope-owned contracts are proven against that reference, local models can be integrated against the same contracts. Differences can then be attributed more confidently to provider/model capability rather than an unproven agent architecture.

## Constraints

- Provider-native session IDs, response IDs, tool schemas and context handles remain adapter state.
- Dope canonical state must remain valid if the active provider changes.
- Product/domain packages must not import OpenAI/Codex SDK types as canonical models.
- Do not spread provider-name conditionals through Planning, Project Intelligence or future Agent Runtime logic.
- Capability discovery remains explicit; provider independence must not force a lowest-common-denominator runtime.
- Local-model support may use different context/execution strategies while preserving the same Dope-owned product contracts.
- The repository's Codex phase runner remains development tooling and is not the product runtime.

## Phase boundary

Phase 3 creates live human-first Planning only.

Phase 6 may add the Model Runtime and first Codex/OpenAI adapter after Planning is qualified enough to supply canonical project/task context. Local-model integration follows the same boundary rather than requiring a redesign of Project Mind or Planning.

## Revisit when

Revisit provider ordering if the first reference integration becomes unavailable or cannot exercise the capabilities needed to qualify Dope's runtime boundary.

Do not revisit provider independence merely because Codex is the first implementation.
