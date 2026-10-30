# Phase 12 — coherent 0.12.0 baseline

**Date:** 2026-10-29 (America/Chicago)
**Status:** VERSION BASELINE ESTABLISHED; PHASE 12 PI WORK NOT STARTED
**Version-only commit:** `e02a46447a460ee43f20ac65078238427468a81c`
**Parent closeout commit:** `b9e82387dafb620688355bccfe5c4f356035a3c8`
**Qualified Phase 11 product/test source:** `203d76b3305cac33037001594cb866977bf13579` at `0.11.8`

The baseline commit changes exactly 13 package manifests: 13 `version` fields and 20 internal `@dope/*` pins from `0.11.8` to `0.12.0`. Its diff contains no application source, tests, lockfile or documentation. The `0.12.0` tree is `e1b32380e003d9201005213060f3d45df5067a74`.

The [Phase 11 narrowed-scope owner closeout](../p11/phase-11-final-closeout-2026-10-29.md) records the exact source qualification: 807 passed, 0 failed, 0 skipped, with typecheck and browser/Electron builds passed, plus bounded real-Chrome evidence and explicit owner-accepted limitations. Those checks ran on the identical product/test source before the version-only manifest change; they are **not a fresh `0.12.0` test run**. The unobserved Chrome/native cases and known stale accepted-draft label remain as stated in that closeout. Historical broader Phase 11 failures are not relabelled Green by this baseline.

Phase 12 Pi P1–P8 prompts remain immutable and unstarted. A reviewed standalone Pi/Qwen result, independent Pi preflight and deliberate owner Run are separate entry requirements. M2 Chat authoring, M3 Inspector Edit and Gate-to-Work/prompt integration remain separately scoped follow-up work.
