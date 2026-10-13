# Product Phase 7B Implementation Plan

Status: **ACTIVE / PROMPTS WRITTEN / READY FOR EXECUTION**
Product source baseline: `a81558dd91ec9042b1066812811a98ba04734047`, coherent `0.7.13`
Task folder: `p7b`
Version sequence: `0.7.14` through `0.7.23`
Authority: ADR 0026 + current Phase 7/product/architecture/stability contracts + prompt assessment

## Shared execution rules

Each prompt reads BOOT, AGENTS, this assessment/plan, its immediately preceding p7b result and only directly affected source/tests. Preserve all retained Phase 5/6/P12/P13/c7 evidence.

Ordinary prompts run focused tests plus the narrowest affected package build/typecheck. Do not run live hosted providers, broad GUI qualification, AppImage packaging, full restart suites or `npm run check` before P9 unless a prompt explicitly requires them.

All implementations stay provider-independent above adapters, keep secrets out of `.dope/` and ordinary preferences, and do not implement 7C routing.

## P1 — AI domain and service contracts (`0.7.14`) — T1

Create `@dope/ai` pure domain types/parsers/helpers plus typed service DTO foundations. Lock immutable connection/model identity, lifecycle/status, safe config, credential references, locality, capabilities/limits/source quality, revisioned registry mutations and filter-only eligibility queries.

## P2 — global registry persistence/concurrency/migration (`0.7.15`) — T2

Add the user-global registry store outside project state: atomic versioned snapshots, expected revision, mutation lock, stale-lock recovery, stale-write rejection, event-driven cross-process refresh, deterministic v1 Model Connections migration preserving IDs and no permanent dual-store synchronization.

## P3 — secure credentials (`0.7.16`) — T2

Add Environment, Session-only and OS-secure credential sources behind one secret manager. Reuse supported Theia secure storage only after verifying its security semantics in the current runtime; fail closed when secure persistence is unavailable. No secret value crosses ordinary AI registry DTOs/events/logs.

## P4 — provider setup and centralized runtime activation (`0.7.17`) — T2

Move Local/LM Studio, OpenAI, OpenAI-compatible and Gemini safe setup/validation/runtime creation behind bounded provider setup adapters over AIConnection. Support manual Local/OpenAI-compatible endpoints and best-effort known Local detection without provider-name coupling in core.

## P5 — inventory, health, Test Connection and eligibility (`0.7.18`) — T2

Persist known model inventory/status/preferences, normalize connection/model health, retain unavailable known models, support model enable/disable, bounded refresh/reconnect, synthetic zero-project-data Test Connection, execution-outcome health updates and role-ready filter-only `findEligibleModels`.

## P6 — AI Center presentation (`0.7.19`) — T2

Add one singleton/revealable center-workspace AI Center opened from the bottom-left AI launcher. Implement two-pane connection list/detail, onboarding/Add Connection, configuration/credential status, models, health, Refresh/Reconnect/Test, Disable/Remove, quiet launcher warning semantics and account/profile relocation under Settings through supported Theia APIs.

## P7 — Chat convergence (`0.7.20`) — T2

Remove inline global provider setup/reconnect ownership from Chat. Chat consumes usable models from AI Center, routes missing/broken setup to AI Center and returns to the originating Chat, while preserving exact per-turn/default model behavior and no silent fallback.

## P8 — Software Map convergence (`0.7.21`) — T2

Make Software Map consume centralized connection/model identity/configuration while retaining explicit run-level exact target, hosted evidence-egress disclosure/consent, structured-output capability probe, warm-up and synthesis strategy. Deterministically retire/migrate legacy feature-specific setup/credential preference ownership rather than synchronizing stores forever.

## P9 — direct Phase 7B qualification (`0.7.22`) — T3

Qualify AI Center on an exact candidate: no-project use, singleton launcher, multi-window/process shared registry and conflicts/live propagation, lifecycle/model inventory, credential sources/redaction, real Local Test Connection, provider-type setup, Chat repair round-trip, Software Map consent/probe boundary, restart/project isolation, aggregate/build/package/native evidence.

## P10 — Phase 7B closeout (`0.7.23`) — T3

Evidence-only A-H audit of the AI Center slice. Do not repair product behavior or implement 7C. If Green, mark Phase 7B qualified and route to `p7c`; full Product Phase 7 remains active until 7C and the later final Phase 7 closeout.

## Expected production shape

```text
@dope/ai
  AIConnection / AIModel / AIRegistry / eligibility
  global store + strict parsers

AI Center
  -> AI registry service
  -> credential manager
  -> provider setup adapters
  -> Model Runtime adapters

Chat --------------------> shared AI inventory/runtime
Software Map ------------> shared AI inventory/runtime
                             + feature-specific egress/probe/warm-up
```
