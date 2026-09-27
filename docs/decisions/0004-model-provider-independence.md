# ADR 0004 — Model and provider independence

Status: Accepted
Date: 2026-09-27

## Decision

Dope must not make any model, model family, LLM provider, hosted service, local inference runtime, provider-native chat/session ontology, or provider SDK part of its canonical product architecture.

Dope owns the durable product and intelligence state.

Model/provider integrations live behind replaceable adapters and a Dope-owned Model Runtime capability contract.

## Required compatibility direction

First-class compatibility requirements include:
- OpenAI / ChatGPT / Codex capabilities and workflows
- local models and local inference runtimes
- future providers that can be added without redesigning canonical project state

The active provider may change during the lifetime of a project or development session.

Switching providers must not require reconstructing Project Mind, Plans, Tasks, Decisions, Agent Mind, Sessions, Authority, or Validation from chat history.

## Capability model

Provider abstraction must not become a lowest-common-denominator interface.

Adapters may advertise capabilities such as:
- streaming
- tool calling
- parallel tool calls
- structured output
- vision
- long-context support
- reasoning controls
- native code execution
- provider-managed state
- cancellation

Dope may use richer provider-specific capabilities when available while preserving provider-independent canonical state.

## Canonical versus adapter state

Canonical Dope state includes product/domain concepts such as:
- Project Mind / Project Intelligence
- Plans and Tasks
- Decisions
- Agent Mind
- ownership/delegation
- ProposedAction lifecycle
- DeveloperSession
- ChangeSet
- Validation
- authority policy

Provider-specific response IDs, session IDs, context handles, request schemas, tool-call wire formats, model names, and capability metadata remain adapter state unless explicitly translated into a Dope-owned durable contract.

## Rationale

The model ecosystem changes rapidly.

Models, APIs, prices, capabilities, context limits, tool protocols, and market leaders will continue to change.

Dope should be able to adopt a better provider or combine providers without rewriting the product model.

This also allows local models to serve continuous or privacy-sensitive roles while hosted models serve harder reasoning or implementation roles.

## Consequences

- Product/domain packages must not import provider-native domain types as canonical models.
- Provider-name conditionals should not spread through product logic.
- Model Runtime exposes capability discovery rather than assuming every provider behaves identically.
- Theia AI, OpenAI APIs, Codex interfaces, LM Studio, llama.cpp, Ollama, and future integrations are infrastructure choices, not product identity.
- The current repository's Codex/GPT-6 Sol implementation workflow is explicitly separate from Dope's runtime provider architecture.

## Revisit when

Revisit the exact adapter/capability contract when AI Presence is implemented or when a provider exposes a fundamentally new interaction primitive that cannot be represented without harming Dope's product boundaries.

Do not revisit the independence requirement merely because one provider is temporarily dominant.
