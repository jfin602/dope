# ADR 0015 — MODULES.md bootstrap architecture seed

Status: Accepted
Date: 2026-09-30
Amends: ADR 0014
Complements: ADR 0009, ADR 0010, ADR 0012

## Context

Initial sMap synthesis benefits from a concise repository-authored description of architectural intent, but `README.md` is usually written for product orientation, setup and usage rather than durable software boundaries. Existing projects may also already use another AI coding environment before opening the repository in Dope.

Dope therefore needs a portable, provider-neutral way for a developer or another AI environment to describe the intended architecture split before first Dope analysis without creating a second long-term architecture authority that can drift from canonical Software Map state.

## Decision

### Root MODULES.md is an optional bootstrap document

Dope recognizes an optional project-root `MODULES.md` as the preferred architecture seed for an uninitialized project.

Its intended hierarchy is:

```text
System
  -> Subsystem
```

For each System or Subsystem, the document may describe:
- purpose;
- responsibilities;
- primary repository paths;
- major dependencies;
- explicit uncertainty or unresolved boundaries.

`MODULES.md` is intentionally concise. It should describe durable architecture rather than enumerate every Component, package, class, function or file.

### Initialization precedence

For an uninitialized project:

1. If root `MODULES.md` exists, Dope detects it and includes it as the primary documented architecture seed beside deterministic repository evidence. Root `README.md`, when present, remains secondary project-orientation context.
2. If `MODULES.md` is absent but root `README.md` exists, Dope recommends creating `MODULES.md` first and offers an immediate **Continue with README** path.
3. If neither file exists, Dope recommends creating `MODULES.md` and still offers **Analyze repository anyway**.

No documentation file is required to initialize sMap.

The user-facing recommendation may expose a provider-neutral **Prepare this repository for Dope** prompt suitable for Codex, Claude Code, Gemini CLI, Cursor, Copilot or another coding environment. That prompt is bounded to creating `MODULES.md` from repository evidence and existing documentation; it must not modify application code.

### Evidence authority

`MODULES.md` is architecture intent, not physical proof and not canonical architecture.

It is a strong **Documented** prior that may guide naming, candidate boundaries, responsibility grouping and targeted verification. Deterministic source/framework/runtime evidence remains the basis for **Observed** current implementation. Synthesis remains **Inferred** proposal state.

A `MODULES.md` claim may be contradicted by repository evidence. Such disagreement remains visible for review; Dope must not silently promote the document into observed truth or suppress source-backed boundaries that the document omitted.

### Canonical handoff and drift prevention

After explicit developer acceptance, `.dope/architecture.json` remains the durable canonical developer-owned architecture authority under the existing Software Map storage contract.

`MODULES.md` does not become a second canonical store and is not continuously synchronized with `.dope/architecture.json`.

Routine refresh/re-analysis of an initialized project must not silently re-import `MODULES.md` changes into canonical architecture. If future product work detects a changed `MODULES.md`, it may offer an explicit review/import comparison. Likewise, exporting or updating `MODULES.md` from canonical architecture must be an explicit developer action. Automatic bidirectional synchronization is out of scope for this correction.

This establishes the lifecycle:

```text
MODULES.md / README / repository evidence
              |
              v
      initial synthesis proposal
              |
              v
       developer review
              |
              v
 .dope/architecture.json canonical
```

### Portable bootstrap prompt contract

The recommended external bootstrap prompt should instruct the other AI environment to:
- analyze the actual repository;
- create only a root `MODULES.md`;
- describe System -> Subsystem architecture;
- include purpose, responsibilities, primary paths and major dependencies;
- use repository evidence, existing docs, package/workspace boundaries, runtime entry points, imports, build configuration, infrastructure and tests;
- represent uncertainty explicitly rather than inventing boundaries;
- avoid enumerating every implementation detail;
- avoid modifying application code.

The exact wording is presentation/product text and may evolve without changing this architectural decision.

## Consequences

Benefits:
- brownfield projects can arrive in Dope with useful architecture context from their existing AI workflow;
- initial synthesis gets a more architecture-specific prior than README alone;
- repositories remain portable across AI tools;
- accepted sMap state has one durable canonical authority, preventing silent two-way drift.

Costs:
- onboarding must handle three document states and user choices;
- synthesis and qualification must distinguish strong documented intent from observed implementation;
- later explicit reconciliation UX may be useful when an initialized repository's `MODULES.md` changes.

## Non-goals

This decision does not:
- require repositories to adopt `MODULES.md`;
- make `MODULES.md` canonical after initialization;
- implement ongoing drift reconciliation or bidirectional synchronization;
- replace deterministic evidence collection;
- permit documentation-only claims to establish physical architecture;
- change the project-local `.dope/` persistence boundary.

## Revisit conditions

Revisit if:
- a future portable architecture interchange format supersedes Markdown;
- explicit `MODULES.md` reconciliation becomes a repeated user need;
- canonical architecture export/import requires a versioned machine-readable public interchange contract.
