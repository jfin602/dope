# P2 — sMap portability qualification

Candidate: pre-task HEAD `1cad776ba742ea7cfb8af07c0c833c01c170d460` (P1). Package: `0.4.6`. P1 changed only `test/unit/software-map-index-backend.test.ts`; no product source changed. The working tree was clean before P2. Provider comparison remains deferred and Phase 5 inactive.

## Controlled portability proof

`node --test --test-name-pattern='accepted Software Map survives copy and fresh backend while physical state rebuilds independently' test/unit/software-map-index-backend.test.ts` — **1/1 passed**.

The test creates distinct temporary roots: `original = mkdtemp(<tmpdir>/dope-model-*)`, `copied = mkdtemp(<tmpdir>/dope-map-copy-*)/with-dope`, and `bare = <same destination>/without-dope`. It accepts the original declaration through `SoftwareMapBackend.acceptExisting`, then copies the repository including `.dope/`. A fresh analyzer/index/backend attaches the copied root, reports initialized, rebuilds a ready Physical Map, and recovers the same canonical System, Subsystem, and Component IDs and containment. After a copied-source edit, generation and input fingerprint change while both `.dope/architecture.json` and `.dope/smap.json` retain their exact bytes. The sibling copy without `.dope/` remains uninitialized and cannot analyze. Reattachment invalidates the old project handle; a separate fresh backend still recovers the original root. The test removes its temporary roots on completion, so their random suffixes are not retained.

`node --test --test-name-pattern='declaration read is local|typed backend rebinds|manual greenfield acceptance|project handle and review token isolate roots|mismatched marker and unsafe directory' test/unit/software-map-index-backend.test.ts test/unit/software-map-initialization.test.ts` — **5/5 passed**. These existing focused guards cover strict local declaration reads, malformed marker rejection, marker/declaration fingerprint mismatch, symlinked `.dope/` and marker/declaration rejection, and project handle/root isolation.

## Dope dogfood initialization

Before P2, tracked `.dope/architecture.json` existed and `.dope/smap.json` did not. A temporary script outside the repository (`/tmp/dope-p2-accept-existing.mjs`) instantiated `TypeScriptAnalyzer`, `SoftwareMapIndex`, and `SoftwareMapBackend` without a synthesis provider or credential store. It attached `/home/jfin/dev/dope`, required `initializationStatus` = `uninitialized` with `declarationPresent = true`, captured its `declarationFingerprint`, and called `backend.acceptExisting(projectHandle, declarationFingerprint)`.

`node /tmp/dope-p2-accept-existing.mjs` — **passed**: acceptance returned `ready`; subsequent status and production `readInitialization` reported initialized. The generated marker has schema 1 and fingerprint `b2356b71e27131607e4e46f93d6a6eac5626d225a5486cde65883f31ba713928`, matching the production fingerprint of the exact current architecture bytes. The architecture bytes were unchanged. The script did not calculate a replacement hash or hand-write the marker.

`node /tmp/dope-p2-reopen-check.mjs` — **passed**: a separate fresh backend attached the actual Dope root and reported initialized; production `readInitialization` accepted the marker with the same fingerprint.

The controlled recovery and Dope acceptance paths used no provider configuration, selected model, provider session/cache, Gemini credential, or browser/controller workspace state. Current source reads initialization from project-local files before analysis; these fresh backend instances had none of that machine-local state.

## Decision

**Portability: Green for P2's storage scope.** No storage-only gap found. P3 may perform evidence-only closeout. No synthesis/provider/browser/release qualification was run.
