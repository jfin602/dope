# Correction 4 Implementation Plan — sMap Project-Local Persistence

Status: **APPROVED / READY**
Correction folder: `c4-smap-storage`
Required unchanged package version: `0.4.6`
Product-source activation baseline: `c059f67a5fd85c81183ba09044e550462c9000a1`
Docs authority baseline: `2e2f35567389dc697f3ed66148d05332ae81697d`
Assessment source: `b438c58d5b8b5cfe237230f61386a72c8211956a`
Authority: `docs/software-map-storage.md`, ADR 0014 owner sequencing amendment, ADR 0008-0015 where not amended

## Preflight for every prompt

Read:
- `BOOT.md` / `AGENTS.md`;
- `docs/software-map-storage.md`;
- ADR 0008-0015, especially the latest ADR 0014 sequencing amendment;
- current `ARCHITECTURE.md`, `PRODUCT-MODEL.md`, roadmap and workflow;
- `docs/tasks/c4-synth-coverage-review/closeout.md`;
- this correction README, assessment and plan;
- exact current source/tests named by the prompt.

Require:
- package exactly `0.4.6`;
- product-source baseline `c059f67a5fd85c81183ba09044e550462c9000a1` reachable;
- current docs/prompt commits reachable;
- predecessor remains owner-closed Not Qualified;
- provider comparison remains deferred;
- Phase 5 remains inactive.

Do not reopen synthesis quality work.

## Shared correction law

The durable Software Map is intentionally small.

Durable:
- project-local `.dope/architecture.json`;
- project-local `.dope/smap.json`;
- only future sMap artifacts explicitly approved as durable under the storage contract.

Transient/rebuildable:
- synthesis reviews/drafts;
- evidence packets/proposals;
- Physical Map snapshots/indexes/compiler programs;
- coverage ledgers;
- synthesis attempts/cache/progress;
- Search Deeper previews;
- provider/model setup and credentials;
- UI/workspace state.

A prompt may change production storage code only when a concrete failing portability invariant demonstrates the need.

## P1 — Persistence boundary audit + permanent portability guard

### Goal

Turn the already-documented persistence boundary into an executable regression contract and repair only concrete defects exposed by that proof.

### Audit targets

Inspect:
- `packages/code-analysis/src/node/architecture-file.ts`;
- `packages/code-analysis/src/node/smap-initialization-file.ts`;
- `packages/code-analysis/src/node/software-map-index.ts`;
- `packages/theia-extension/src/node/software-map-backend.ts`;
- `packages/theia-extension/src/browser/software-map-controller.ts` only for preference/transient separation;
- existing Software Map initialization/index/backend tests.

Confirm from current source:
- canonical architecture comes only from project-local `.dope/architecture.json`;
- initialization comes only from matching project-local `.dope/smap.json`;
- marker identity is independent of absolute root;
- fresh backend attach recomputes initialization from project files;
- physical state is rebuilt from source/config/canonical declaration;
- no global/project-external cache is required;
- provider/preferences are outside project truth;
- project switching clears transient review/provider state.

### Permanent guard

Add one focused regression that exercises the whole portability boundary:

1. create a controlled fixture with source/config;
2. accept a canonical architecture through the real backend/service acceptance path;
3. capture canonical IDs/containment and a ready Physical Map snapshot/query result;
4. dispose the backend/index;
5. copy the fixture, including `.dope/`, to a different root;
6. create a fresh analyzer/index/backend with no retained synthesis/provider state;
7. attach the copied root and prove it is initialized;
8. analyze/rebuild and prove canonical boundary IDs/containment are preserved;
9. mutate copied source and prove derived generation/input changes while `.dope/architecture.json` and `.dope/smap.json` bytes do not silently change;
10. create/open a sibling copy without `.dope/` and prove it is uninitialized;
11. prove the first root/copy/no-`.dope/` root do not leak state into one another.

Reuse existing malformed/mismatch/symlink tests instead of duplicating them.

### Repair rule

If the regression passes on current product code:
- do not create production code churn merely because this is an implementation prompt;
- the permanent regression itself is the intended P1 change.

If it fails:
- identify the exact persistence-boundary defect;
- make the smallest correction;
- add a regression that would fail on the pre-fix behavior;
- do not add a database, durable cache, migration framework or broader persistence abstraction.

### Validation

Focused only:
- the changed Software Map initialization/index test file(s);
- affected package build/typecheck only if production code changed;
- `git diff --check`;
- unchanged version check.

No live provider, browser, full `npm test`, `npm run check`, restart matrix, AppImage or native launch.

### P1 handoff

Record:
- whether production source changed;
- exact permanent regression;
- any concrete defect found/fixed;
- exact focused commands/results;
- readiness for P2.

## P2 — Streamlined copy/reopen qualification + Dope dogfood initialization

### Goal

Clear the storage gate using one short, direct portability proof and leave Dope itself durably initialized.

### Qualification principle

Do not build a second large qualification harness.

The P1 permanent copy/reopen regression is the primary controlled portability evidence. P2 should run that exact focused guard on the P1 candidate and record the result.

Supplement only the two things the unit guard cannot establish by itself:
1. exact candidate/repository evidence suitable for closeout;
2. Dope's own project-local accepted marker.

### Controlled proof record

Record a compact evidence file containing:
- candidate SHA and package version;
- P1 focused portability-test command/result;
- source root and copied root are distinct;
- accepted original and copied marker/declaration relationship;
- copied fresh backend reports initialized;
- canonical IDs/containment recover;
- Physical Map rebuild succeeds;
- source mutation changes derived analysis without changing canonical/marker bytes;
- no-`.dope/` copy reports uninitialized;
- existing focused mismatch/symlink/project-isolation guards pass;
- no provider setup/session/cache is needed.

Do not score architecture quality and do not run synthesis.

### Dope dogfood initialization

The repository currently tracks `.dope/architecture.json` and lacks `.dope/smap.json`.

Use the real production backend/service **accept-existing** path against the Dope repository:
- create a fresh Software Map backend/index/analyzer instance;
- attach the actual Dope root;
- read the current uninitialized status and declaration fingerprint;
- invoke `acceptExisting` (or the exact production service path that calls it);
- require successful analysis/ready result;
- verify `readInitialization` reports initialized;
- retain the generated `.dope/smap.json` in the repository;
- verify the marker fingerprint matches the exact tracked `.dope/architecture.json` bytes.

Do not hand-author `.dope/smap.json` or merely calculate the hash in a shell.

A temporary qualification script may be created outside the repository or removed before finalizing. Do not add a permanent CLI solely for this gate.

### Streamlined validation

Target <=8 minutes.

Run:
- the P1 focused portability regression;
- the smallest existing focused mismatch/symlink/project-isolation tests needed for direct evidence;
- the Dope accept-existing invocation;
- a focused production read/attach check after marker creation;
- `git diff --check`;
- package/version/no-root-lock check.

Do not run unless P1 materially changed relevant code:
- live Local/Gemini;
- Adaptive SEO;
- browser qualification;
- full `npm test`;
- `npm run check`;
- broad `npm run test:restart`;
- AppImage/native packaging;
- Electron launch.

### Evidence artifact

Write:
`docs/tasks/c4-smap-storage/P2-portability-qualification-evidence.md`

Keep it concise and factual.

### P2 handoff

Report:
- exact candidate;
- portability decision;
- Dope marker creation method/result;
- focused commands/results;
- residual storage gaps only;
- readiness for P3.

## P3 — Evidence-only storage closeout

### Goal

Audit the exact P2 candidate against the storage contract without turning closeout into another qualification run.

### Audit gates

A. **Canonical project truth**
- architecture is project-local and canonical;
- accepted marker is project-local and exact-byte bound.

B. **Copy/reopen portability**
- copied repository + `.dope/` at a distinct root recovers initialized state with a fresh backend/index;
- canonical IDs/containment survive.

C. **Derived rebuild**
- Physical Map rebuilds from current source/config + canonical architecture;
- source changes alter derived state without silently mutating canonical bytes.

D. **Machine-local independence**
- provider preferences/credentials/cache/session state are unnecessary to recover project truth;
- no new derived-state project persistence was introduced.

E. **Isolation/fail-closed**
- no-`.dope/` copy remains uninitialized;
- project roots do not leak state;
- malformed/mismatched/symlink state remains rejected.

F. **Dope dogfood**
- tracked `.dope/smap.json` exists on exact candidate;
- production read logic reports it initialized against current tracked `.dope/architecture.json`.

G. **Boundary/version**
- package remains `0.4.6`;
- no provider comparison/Phase 5 implementation pulled forward;
- no broad persistence subsystem introduced.

### Cheap integrity only

Normally run:
- `npm run codex:phase:validate -- c4-smap-storage`;
- focused marker/read check if needed;
- `git diff --check`;
- version/no-root-lock check.

Do not rerun P2's copy/reopen exercise or broader suites unless recorded evidence is internally inconsistent.

### Closeout docs

Write:
- `docs/tasks/c4-smap-storage/closeout.md`;
- update this correction README status and routing.

Do not activate Phase 5 implementation in closeout. Green routes to a fresh `/docs-review`.

## Versioning

All prompts keep package version exactly `0.4.6`.

No correction prompt increments package versions.

## Exit

If P3 closes Green:
- storage correction is qualified;
- Phase 4's final pre-Phase-5 gate is clear;
- route directly to a fresh Product Phase 5 `/docs-review`.

If a storage invariant remains Not Green:
- identify one narrow correction;
- do not reopen synthesis benchmarking by default.
