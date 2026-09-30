# Correction 4 Prompt Assessment — sMap Project-Local Persistence

Status: **APPROVED / READY**
Correction folder: `c4-smap-storage`
Required unchanged package version: `0.4.6`
Product-source activation baseline: `c059f67a5fd85c81183ba09044e550462c9000a1`
Docs authority baseline: `2e2f35567389dc697f3ed66148d05332ae81697d`
Predecessor: owner-closed / Not Qualified `c4-synth-coverage-review`
Authority: `docs/software-map-storage.md`, ADR 0014 owner sequencing amendment, ADR 0008-0015 where not amended

## Conclusion

Use exactly three ordered prompts at unchanged `0.4.6`:

1. **P1 — Persistence boundary audit + permanent guard.** Prove the intended durable/transient split in source, add the smallest permanent portability regression, and repair product code only if that proof exposes a concrete defect.
2. **P2 — Streamlined portability qualification + Dope dogfood marker.** Run one focused copy/reopen/restart qualification and initialize Dope's existing canonical architecture through the real acceptance path. No provider benchmark, broad browser pass, AppImage/native qualification, or architecture-quality scoring.
3. **P3 — Evidence-only closeout.** Audit P1/P2 evidence, perform only cheap integrity checks, and decide whether storage clears the gate for a fresh Phase 5 `/docs-review`.

All three prompts should use **GPT-6 Sol Medium**. This correction is bounded and the hard architectural decisions are already documented; High is unnecessary unless P1 discovers an unexpected cross-layer persistence defect.

## Why this correction exists

Phase 4 already has the desired storage design, but the roadmap requires direct proof that durable Software Map truth follows the repository rather than a machine/process.

The synthesis corrections are now owner-closed Not Qualified and accepted as the baseline. Their remaining model-quality gaps are not storage work. The provider-comparison idea is deferred.

The only remaining pre-Phase-5 question is:

> If the repository and its `.dope/` directory move to a fresh root/process with no retained model session, cache or UI state, does Dope recover the same accepted canonical sMap and rebuild current physical state?

## Current source findings

### Canonical architecture is already project-local

`packages/code-analysis/src/node/architecture-file.ts` reads only project-local `.dope/architecture.json`.

It already:
- resolves a canonical local project root;
- requires a real non-symlink `.dope/` directory;
- requires a regular non-symlink architecture file;
- opens with `O_NOFOLLOW`;
- strictly parses the architecture declaration;
- treats a missing declaration as valid empty/unconfigured architecture rather than synthesizing hidden machine state.

This is the intended canonical storage boundary.

### Initialization is already a small durable marker

`packages/code-analysis/src/node/smap-initialization-file.ts` implements schema-1 `.dope/smap.json` with an exact SHA-256 fingerprint of the accepted `architecture.json` bytes.

It already:
- treats a missing marker as uninitialized;
- rejects malformed/schema-invalid markers;
- rejects a marker whose fingerprint does not match the current declaration;
- stages writes inside `.dope/`;
- uses exclusive temporary files plus rename;
- serializes acceptance per root;
- restores exact prior architecture bytes if the marker commit fails;
- verifies initialization after acceptance.

The marker is path-independent, so it is structurally suitable for copy/clone portability.

### Backend state is deliberately transient

`SoftwareMapBackend` recomputes initialization from project files on attach. Review state, provider setup, synthesis cache, progress, pending refinement state and active run state are process/session memory.

Project switching/reattach clears those transient surfaces. Provider setup/credentials are not required to determine canonical architecture or initialized state.

That is correct for this correction. Do not persist these surfaces merely to make restart easier.

### Physical Map state is rebuildable

`SoftwareMapIndex` is an in-memory per-root index.

Its input fingerprint derives from:
- source;
- config/package inputs;
- canonical architecture bytes.

It rebuilds a `PhysicalMapSnapshot` from current source/config plus canonical architecture. No physical snapshot is required as durable project truth.

This is exactly what P2 should prove after a fresh-root reopen.

### Machine-local provider state is already separate

The browser controller stores synthesis choice through a preference store. The backend stores Gemini secrets in the machine credential store/environment path and clears synthesis/provider state on project change/dispose.

Existing tests already cover secret/provider state outside project files. P1 should preserve this; it does not need a new provider subsystem.

### The missing proof is portability, not architecture

Current tests strongly cover:
- manual/existing acceptance;
- malformed/mismatched marker rejection;
- symlink rejection;
- second-file rollback;
- project-handle/root isolation;
- cancellation/failure leaving no project state;
- machine credential persistence outside project state.

The narrow missing permanent regression is a full **accepted repo -> fresh copied root -> fresh backend/index -> same initialized canonical state -> rebuilt physical state** flow, plus a sibling copy without `.dope/` remaining uninitialized.

P1 should add that guard, preferably to the existing Software Map initialization/index tests. If it passes without production changes, that is a successful P1 outcome.

### Dope itself is not yet durably initialized

The repository tracks `.dope/architecture.json` but not `.dope/smap.json`.

Under the current lifecycle contract, Dope therefore has a canonical declaration but is not durably marked initialized.

P2 should invoke the real backend **accept-existing** path against the Dope repository and retain the resulting `.dope/smap.json`. Do not hand-author the fingerprint as a substitute for exercising production acceptance.

## Prompt decomposition

### P1 — Persistence boundary audit + guard

Likely surfaces:
- `packages/code-analysis/src/node/architecture-file.ts`;
- `packages/code-analysis/src/node/smap-initialization-file.ts`;
- `packages/code-analysis/src/node/software-map-index.ts`;
- `packages/theia-extension/src/node/software-map-backend.ts`;
- `packages/theia-extension/src/browser/software-map-controller.ts` only to verify preference/transient separation;
- `test/unit/software-map-initialization.test.ts`;
- `test/unit/software-map-index-backend.test.ts`.

Expected default result:
- one strong permanent copy/reopen portability regression;
- no product-source change unless the regression exposes a real defect.

Validation: focused T1/T2 only.

### P2 — Streamlined portability qualification

Use the P1 permanent guard as the primary controlled proof rather than building a second elaborate harness.

Qualification should additionally record:
- exact marker/declaration bytes/fingerprints before and after copy;
- fresh backend/index state;
- canonical boundary identity recovery;
- successful physical rebuild;
- source mutation causing derived reanalysis without canonical rewrite;
- no-`.dope/` sibling copy remaining uninitialized;
- project isolation/fail-closed checks from focused tests;
- Dope dogfood initialization through `SoftwareMapBackend.acceptExisting` or the exact production service path that invokes it.

Write a compact evidence file. Avoid browser/live provider/package work.

Validation: focused T2, target <=8 minutes.

### P3 — Evidence-only closeout

Audit exact P2 candidate/evidence. Do not rerun broad tests merely to fill gaps.

Cheap integrity:
- correction prompt validation;
- package remains `0.4.6`;
- no root package-lock;
- `git diff --check`;
- verify tracked `.dope/smap.json` parses and matches exact current `.dope/architecture.json` bytes using production read logic or an equivalent focused check.

Write closeout and update only the correction README status/routing. Top-level Phase 5 activation still requires the fresh `/docs-review`.

## Streamlining rules

P2 must not repeat the expensive work that made prior corrections slow.

Do **not** run unless a P1 change directly requires it:
- Local/Gemini live synthesis;
- Adaptive SEO/Dope architecture-quality benchmarking;
- browser qualification;
- `npm run check`;
- full `npm test`;
- `npm run test:restart` if the focused fresh-backend portability regression already proves the required process-lifecycle property;
- AppImage/native packaging;
- Electron launch;
- provider/model discovery/probe.

Prefer one focused test command plus the Dope acceptance invocation.

## Main risks

- accidentally persisting derived state because it is convenient;
- conflating Project Mind persistence with Software Map persistence;
- hand-writing `.dope/smap.json` instead of exercising acceptance;
- a copied marker depending on absolute paths or process memory;
- a fresh backend reporting initialized but failing to rebuild physical state;
- copying without `.dope/` inheriting stale root/global state;
- P2 expanding into another general release qualification.

## Green definition

Green requires:
- repository + `.dope/` alone recovers accepted sMap state at a new root with a fresh backend/index;
- exact canonical System/Subsystem/Component identity/containment survives;
- derived Physical Map state rebuilds from current source/config + canonical architecture;
- source changes rebuild derived state without silently rewriting canonical architecture;
- machine-local provider/preference/cache state is unnecessary for project truth;
- a copy without `.dope/` is uninitialized;
- malformed/mismatched/symlink state remains fail-closed;
- project A/B isolation remains intact;
- Dope itself carries a valid production-created `.dope/smap.json`;
- package remains `0.4.6`;
- no new persistence of rebuildable synthesis/Physical Map artifacts.

If Green, route to the bounded Dope logo-palette/application-color alignment step; after that is complete, route to a fresh Product Phase 5 `/docs-review`.
