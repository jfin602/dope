# Phase 10 — Clean 0.10.0 Baseline

**Date:** 2026-10-12 (America/Chicago)
**Status:** **COHERENT VERSION BASELINE ESTABLISHED / PHASE 10 NOT ACTIVATED OR QUALIFIED**
**Baseline commit:** `2fc3b93c01ed56b5c848e80181d630c390f3e551`
**Qualified predecessor:** Phase 9 owner-closed Green at `0.9.35`, exact qualified source `af3447ccc419cc9c06051dbd4046a9145d7bf0ae`.
**Owner request:** `/closeout phase 9 owner approved. set project to 0.10.0 baseline`

## Change

Version-only commit `2fc3b93` changes exactly 13 root/app/package manifests from `0.9.35` to `0.10.0` and pins all 20 internal `@dope/*` dependencies to `0.10.0` (33 version fields/references total). No implementation, tests, unrelated dependency selections, `yarn.lock`, build artifacts or deployments were changed. Documentation was aligned in a separate closeout commit.

A new version marker is **not a new product qualification**. The final Phase 9 source and 556/556 aggregate, live Work/History, local Qwen inference and OS loopback evidence are in `docs/tasks/p9d/final-qualification.md`. None was rerun solely for `0.10.0`.

## Execution gate

Phase 10 Unified Roadmap & Local-First AI Planning is **ADR 0036 DESIGN APPROVED ONLY**. No implementation prompt, Phase 10 qualification or activation is authorized yet. A separate owner decision must activate implementation, grounded in `docs/planning/p10/phase-10-plan.md` and focused source/prompt planning; the runner does not pre-bump versions. Phase 11 Human-Centered UI (ADR 0037) and Phase 12 Living Software Knowledge Model (ADR 0023) remain inactive.

Historical `c9-codex-chat` and `c9-theme-fix` fixed version contexts are not silently promoted to `0.10.0`. Preserve completed and failed historical records. Before syncing the remote commit into a local checkout, inspect and preserve local changes instead of overwriting dirty work.
