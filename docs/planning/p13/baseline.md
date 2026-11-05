# Phase 13 — coherent owner-approved 0.13.0 baseline

**Date:** 2026-11-05 (America/Chicago). **Status:** BASELINE ESTABLISHED; PHASE 13 IMPLEMENTATION NOT RUN/QUALIFIED.
**Owner request:** `/docs-apply + /prompt-plan + /prompt-write p13` on `main`, plus express approval to set `0.13.0` baseline.
**Version-only commit:** `f908c447819b0e7b07a8e49c91a5898a40bccbe9`, parent `89dc374f65dac38b9638c78b5fbbad01a10a1e48`, tree `33f3403b5543e6532a2fb714a3e845576a890ce5`.

Exactly 13 root/app/workspace package manifests changed from `0.12.7` to `0.13.0`: 13 package version fields and 20 internal `@dope/*` dependency pins, 33 values in total. No other source, test, documentation, lockfile, dependency selection, build output or deployment changes were included in the version-only commit. The previous product code remains that on `main` at the baseline parent. No tests were executed simply by changing versions; no fresh qualification or release is implied.

**Important sequencing change:** prior [historical Phase 13 LSKM reservation](phase-13-scope.md) is deferred as an unassigned future successor scope by the new owner decision. Phase 13 now means Roadmap-Controlled Development under [ADR 0051](../../decisions/0051-roadmap-work-evidence-lifecycle.md). Preserve ADR 0023 and all earlier qualification evidence without silent version/Phase relabelling.

A deliberate later execution of `docs/tasks/p13` is required for implementation. That Run must verify actual local main HEAD, dirty owner work, installed version, safe grants, source and environment. Do not treat GitHub remote state as a claim that the owner's Linux checkout is clean. The first implementation P1 may target `0.13.1` only after genuine authorized code/test work. Do not auto-run P1–P10, bump further versions or declare Phase 13 closed by creating this baseline.

