# ADR 0018 — Resumable unaccepted sMap review work state and acceptance diagnostics

Status: Accepted
Date: 2026-10-01
Builds on: ADR 0009, ADR 0010, ADR 0012, ADR 0014
Amends: Software Map storage treatment for pre-acceptance review work

## Context

Phase 5 P11 is blocked before visual-planning qualification because the Adaptive SEO test workspace has a generated Architecture Review that cannot currently be accepted. Fixing one reported error at a time is expensive if every restart or repair requires another synthesis run.

Current source already writes `.dope/smap-analysis.json` and can restore a saved `review_required` analysis run after attach. However, once the developer edits the Architecture Review, the working draft lives primarily in frontend memory. Restart can restore the originally generated draft rather than the latest developer edits.

Current acceptance also exposes throw-first strict parser failures. That is correct for canonical acceptance, but poor debugging machinery because only the first blocker is visible.

## Decision

### Review work may persist before acceptance

Dope may persist an unaccepted Architecture Review under versioned project-local `.dope/smap-analysis.json`. This file is **work state**, not canonical architecture and not accepted initialization.

The persisted review may contain deterministic evidence/proposal/checkpoint context already required to resume the run plus the developer's current mutable review draft and revision metadata.

### The working draft survives restart

Ordinary developer edits and accepted branch refinements update the persisted working draft. A fresh backend/app attach restores the latest safely persisted draft without invoking or requiring a synthesis provider.

Mutable saves use optimistic revision/stale-write protection so late frontend writes cannot overwrite newer review work.

### Invalid drafts are persistable

Storage validity and architecture acceptance validity are separate. A review draft may temporarily contain invalid IDs, missing/duplicate ownership roots, invalid parentage or other acceptance blockers while the developer is correcting it. Safe persistence validates the work-state envelope and bounded data shape without requiring canonical acceptance.

### Acceptance diagnostics are deterministic and complete

Dope owns one provider-independent acceptance-diagnostics pass for Architecture Review drafts. It returns the complete known blocker set rather than stopping at the first parser exception.

At minimum diagnostics cover invalid/duplicate IDs, invalid/missing parents, required empty/malformed/unsafe roots, duplicate exact ownership roots with all conflicting owners, and current declaration-shape/dependency failures.

The strict canonical parser/writer remains authoritative at acceptance. Diagnostics never choose an owner, deduplicate a root, rewrite hierarchy or otherwise decide architecture for the developer.

### One rule set serves UI, checker and backend preflight

The Architecture Review UI, an offline project checker and backend acceptance preflight consume the same domain diagnostics.

The offline checker loads a persisted `review_required` run, reports blockers/staleness without provider calls, never mutates the project, and exits success only when the working draft is acceptance-valid.

### Lifecycle and compatibility

Successful acceptance revalidates freshness, strictly validates/writes canonical architecture, writes accepted initialization and clears in-progress analysis work. Explicit cancellation clears the in-progress work without creating canonical architecture. Restart/reopen preserves valid work state.

The correction must preserve read compatibility with existing schema-1 `.dope/smap-analysis.json` review-required files, including the current Adaptive SEO specimen.

### Scope boundary

This decision authorizes debugging machinery only. It does not authorize synthesis/evidence/root-materialization changes, automatic ownership repair, Adaptive SEO regeneration, the actual iterative debug loop, or advancement beyond `0.5.11`.

## Consequences

Expensive generated reviews become durable developer work that can be corrected across restarts. Deterministic blocker enumeration makes acceptance debugging iterative and inspectable while canonical architecture authority remains unchanged.
