# ADR 0005 — Progressive self-development and bootstrap independence

Status: Accepted
Date: 2026-09-27

## Context

Dope's long-term product goal is to unify coding, durable project understanding, planning, AI collaboration, validation, and development-session continuity.

The Dope repository itself is a uniquely useful dogfood target because failures in Project Mind, Planning, agent observability, authority, validation, or session continuity will be experienced directly while building the product.

Self-development can therefore become a powerful qualification strategy.

It also creates two architectural risks:
- prematurely pulling future AI/delegation work into early phases in the name of self-hosting;
- making Dope dependent on itself for repair, migration, or access to canonical project knowledge.

## Decision

Dope will pursue progressive self-development as a cross-phase qualification strategy.

The progression is:

external bootstrap
-> Dope as editor
-> Dope as project brain
-> Dope as planner
-> Dope as agent supervisor
-> Dope develops Dope

This progression does not add a new roadmap phase and does not change Foundation Spike 0 scope.

## No privileged self mode

The Dope repository is treated as an ordinary software project.

Self-targeted work uses the same:
- Project Mind / Project Intelligence contracts;
- Planning and Task contracts;
- provider capability adapters;
- Agent Runtime and ProposedAction lifecycle;
- observation and mutation authority;
- ChangeSet review;
- Validation evidence;
- DeveloperSession model.

No repository identity, "self" flag, built-in exception, provider integration, or execution shortcut may raise authority or bypass normal review merely because Dope is modifying Dope.

## Bootstrap independence

Dope must remain repairable without Dope.

A broken, partially upgraded, or unavailable Dope installation must not strand the repository or make canonical project knowledge irrecoverable.

The architecture must preserve a conventional external path to:
- inspect and edit source;
- use Git;
- build and test the project;
- run required migrations or recovery procedures;
- inspect, export, restore, or otherwise recover durable Project Mind state through a documented mechanism.

The exact persistence/export mechanism may evolve. The invariant is that irreplaceable project truth must not require the same healthy Dope runtime that may need repair.

## Roadmap qualification

- Foundation Spike 0: external bootstrap only; no self-hosting requirement.
- Phase 1 — IDE Alive: develop Dope comfortably inside Dope as an IDE.
- Phase 2 — Project Mind: use Dope's own durable knowledge system to understand Dope.
- Phase 3 — Planning: plan real Dope work inside Dope.
- Phase 4 — AI Presence: let provider-independent AI consume Dope-owned project context while assisting on Dope.
- Phase 5 — Scoped Delegation: delegate bounded Dope changes through the normal authority/review path.
- Phase 6 — Development Sessions: qualify a real end-to-end "Dope Builds Dope" feature flow.

## Generality

Dogfooding is necessary but not sufficient.

Dope is itself a TypeScript/Theia-heavy repository with its own conventions. Product/domain contracts must not become specialized around that stack.

Self-development evidence proves the workflow on Dope. Claims about other languages, frameworks, repository shapes, or workflows require their own evidence.

## Consequences

- Self-development becomes a recurring roadmap qualification lens rather than an isolated future feature.
- Phase 0 remains bounded to substrate qualification.
- Project Mind persistence requires a documented recovery strategy as the durable model matures.
- Agent authority remains repository-neutral.
- External tooling remains a supported repair escape hatch.
- Product reviews should ask both "can Dope help build Dope?" and "did dogfooding accidentally create Dope-specific coupling?"

## Revisit when

Revisit the specific qualification evidence as each product phase is planned.

Do not revisit the bootstrap-independence or no-privileged-self-mode requirements merely because self-development becomes convenient or because a future provider/framework offers a shortcut.
