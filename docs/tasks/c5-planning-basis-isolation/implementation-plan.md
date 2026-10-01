# Correction 5 Implementation Plan — Planning Basis Isolation

Status: **APPROVED / READY**
Correction folder: `c5-planning-basis-isolation`
Required unchanged package version: `0.5.11`
Activation source: `2c21fcf244e42fb806ba01d27c68addc5ffb198e`
Assessment: `prompt-assessment.md`
Authority: ADR 0019 plus ADR 0017 where not amended

## Shared preflight

Read BOOT/AGENTS, ADR 0019, current ARCHITECTURE/stability/Phase 5 authority, P11 evidence, this correction README/assessment/plan, and exact affected source/tests.

Require:
- package exactly `0.5.11`;
- activation source reachable;
- P11 Not Green and P12 unexecuted;
- accepted `/home/jfin/dev/adaptive-seo-dope` reference untouched;
- no provider/synthesis work.

## P1 — Implement basis isolation and semantic comparison

### A. Analyzer input boundary

Make `.dope/` unconditionally absent from generic TypeScript analyzer source/config inputs.

Cover:
- recursive JSON/config discovery;
- tsconfig/jsconfig discovery;
- parsed source file lists;
- project references or equivalent configured paths that could point into `.dope/`.

Keep legitimate repository source, `package.json`, tsconfig/jsconfig and other real analyzer configuration fingerprinting unchanged.

Prove `.dope/architecture.json` affects the Software Map only through the dedicated declaration fingerprint.

### B. Planning basis semantics

Create explicit comparison semantics in the presentation-independent Visual Planning domain or another appropriate shared boundary:
- semantic basis equality: architecture revision/fingerprint + physical input fingerprint;
- exact observation equality: semantic basis + physical generation.

Use semantic equality for stale/current product decisions such as Planning Map editability and `physicalChanged`.

Keep exact observation equality for request/preview/snapshot concurrency where a result belongs to one concrete generation.

Audit creation, rebase, adoption, reconciliation and closeout so generation-only reanalysis does not invalidate durable intent while an in-flight exact-observation race remains protected.

### C. Permanent regression

Add one focused cross-boundary regression that:
1. analyzes a controlled project and captures fingerprint A / generation 1;
2. creates Planning Map state under `.dope/planning-maps.json`;
3. proves `SoftwareMapIndex.inputsCurrent()` remains true and fingerprint A is unchanged;
4. reanalyzes unchanged source so generation advances;
5. proves the plan is not stale, has no affected branches/transformations, and remains editable;
6. changes a real source/config input and proves fingerprint/staleness changes;
7. changes canonical architecture and proves architecture staleness;
8. retains a focused late-generation/race guard assertion.

Also add focused analyzer-level tests for representative `.dope` metadata files and explicit configured paths.

### Validation

T2 focused only:
- affected TypeScript analyzer tests;
- Software Map index/backend tests;
- planning rebase/staleness tests;
- visual-planning storage/backend tests;
- planning-map controller/UI tests affected by semantic comparison;
- affected package builds/typecheck;
- `git diff --check`;
- exact `0.5.11` / no-root-lock checks.

Do not run P11, full `npm run check`, AppImage/native packaging or providers.

## P2 — Evidence-only correction closeout

Audit exact P1 candidate; do not repair failures.

Gates:
A. `.dope` input isolation;
B. dedicated architecture fingerprint preservation;
C. unchanged generation advance is not stale;
D. real source/config and canonical changes still stale;
E. exact generation concurrency guards remain;
F. Planning Map remains editable after unchanged reanalysis;
G. version/scope/regression.

Run only the exact focused regression set from P1, correction prompt validation, diff/version/no-root-lock checks. Write `closeout.md` and update the correction README status/routing.

Green routes to a fresh `/tmp/adaptive-seo-dope-p11` copy and P11 rerun. P2 must not run the GUI qualification itself.
