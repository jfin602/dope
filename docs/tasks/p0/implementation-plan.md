# Foundation Spike 0 Implementation Plan

Status: CURRENT IMPLEMENTATION PLAN

Phase: 0 — Theia substrate qualification  
Execution folder: `p0`  
Baseline: main `e90164da659b21a3d24e87b7ce3ff2a7f995cace`, package `0.0.0`.

Read with `BOOT.md`, `AGENTS.md`, `docs/THEIA-SPIKE.md`, `docs/ARCHITECTURE.md`, `docs/stability-contract.md`, `docs/planning/foundation-spike-0/decision-record.md`, `docs/planning/foundation-spike-0/qualification-plan.md`, and `docs/tasks/p0/prompt-assessment.md`.

## Target Phase 0 architecture

```text
                    Dope qualification repo

              +-------------------------+
              | browser qualification   |
              | app                     |
              +------------+------------+
                           |
              +------------v------------+
              | shared Dope Theia       |
              | extensions / widgets    |
              +------------+------------+
                           |
              +------------v------------+
              | Dope-owned minimal      |
              | contracts               |
              | WorkspaceMode           |
              | ProjectArtifact / Note  |
              +------------+------------+
                           |
              +------------v------------+
              | typed backend service   |
              | + persistence adapter   |
              +-------------------------+

              +-------------------------+
              | Electron desktop app    |
              | actual product target   |
              +-------------------------+

                       built on
                 Eclipse Theia 1.75.0
                       then
                 Eclipse Theia 1.76.0
```

Browser and Electron compositions should share the same Dope extension/domain code wherever framework architecture permits.

## P1 — Theia 1.75 application foundation

Target: `0.0.1`.

### Preflight

- require Node >=24 <25;
- verify no root `package-lock.json`;
- inspect current Theia 1.75 composition guidance rather than relying on historical generator assumptions;
- preserve the exact runner behavior and its tests.

### Application composition

Create the smallest supported monorepo/application structure that gives the spike:
- an Electron application;
- a browser qualification application;
- shared custom Dope Theia extension package location;
- truthful root scripts for install/build/start/test/package-prep operations.

Pin all directly controlled `@theia/*` framework dependencies to a coherent 1.75.0 baseline.

Use the Theia 1.75 esbuild pipeline. Do not introduce webpack compatibility.

Follow supported application-generation/composition conventions. A Yarn-classic workspace/lockfile is acceptable if required by the supported Theia path; a root `package-lock.json` is not.

### Commodity IDE features

Compose enough supported Theia packages for:
- workspace/filesystem;
- explorer/navigator;
- Monaco editor;
- TypeScript/JavaScript language support path;
- search;
- SCM/Git;
- terminal;
- markers/problems;
- debugger;
- preferences/keybindings;
- plugin/VS Code extension support;
- Open VSX access.

Do not add Theia AI packages merely because they are available.

### Automated proof

P1 should leave commands/tests that prove:
- dependency pin coherence;
- browser build;
- Electron build;
- TypeScript typecheck;
- runner regression tests unchanged;
- root package-lock absence;
- `git diff --check`.

Do not claim runtime/GUI behavior Green yet.

## P2 — Dope workbench surfaces + customization stress

Target: `0.0.2`.

Create minimal real Dope-owned product surfaces:
- Project Mind spike view;
- Planning spike view;
- BUILD/PLAN switch/commands;
- Dope branding/application naming;
- material default layout change;
- materially distinct workbench styling;
- hide/replace at least one unwanted standard UI element where justified.

Define `WorkspaceMode` outside Theia presentation code.

If Theia Perspectives or layout services are used, they are adapters only.

Perform at least one genuine supported service rebind/replacement with a visible or testable effect. Choose a service whose replacement is justified and can be expressed through public/supported APIs; do not force a private shell hook merely to satisfy the test.

Create `docs/tasks/p0/customization-coupling-ledger.md`.

For every material customization classify:
- public contribution point;
- custom widget/service;
- supported rebinding;
- shell-level API;
- private/internal API.

Record exact source/API used and why.

Any broad private/internal dependence is a failure signal, not something to conceal.

Automated proof should cover Dope-owned WorkspaceMode transitions and non-rendering contracts where practical plus all P1 checks.

## P3 — typed backend + minimal Project Mind persistence

Target: `0.0.3`.

### Dope-owned domain

Implement only the Phase 0 subset:
- minimal `ProjectArtifact`;
- minimal `Note`;
- stable ID;
- schema version;
- title/body sufficient for a spike;
- provenance sufficient to distinguish developer-authored spike state;
- timestamps only if needed by the minimal contract.

Do not implement Idea/Question/Decision/Plan/Task.

### Persistence

Use a deliberately transparent, replaceable adapter.

Prefer a simple workspace-scoped `.dope/` representation in a controlled fixture/test workspace unless source reality suggests a safer equivalent. The persistence format must not depend on Theia UI/widget/session objects.

Cover:
- round trip;
- stable identity;
- malformed/corrupt state behavior;
- no silent promotion of derived state;
- restart reconstruction.

### Frontend/backend seam

Implement a supported typed Theia frontend/backend service contract.

Prove:
- frontend request/response;
- backend-originated event/update reaching frontend;
- lifecycle cleanup for any connection/listener;
- Project Mind view renders reconstructed Dope-owned state.

Keep frontend code browser-safe; backend owns Node filesystem persistence.

### Spike interaction

Provide the smallest non-production interaction needed to create/update or seed a spike Note so browser qualification can prove persistence. Clearly label it spike-only if necessary.

Do not turn this into Phase 2 Project Mind UX.

## P4 — baseline GUI + tooling qualification

Target: `0.0.4`.

Browser/GUI execution required.

Qualify exact committed P3 source at Theia 1.75.0.

### Commodity IDE matrix

Exercise a real fixture/repository and record:
- open repository/workspace;
- explorer navigation;
- edit/save;
- TypeScript/JavaScript language behavior;
- JSON editing;
- Markdown editing;
- search;
- Git/SCM detects a controlled change;
- terminal executes a harmless command;
- debugger hits a real Node breakpoint;
- Problems/markers surface when deliberately induced and clear after repair.

### Extension matrix

Prove:
- VS Code extension support is enabled;
- Open VSX is reachable in the qualification environment;
- ESLint extension installs/loads and performs one observable function;
- Prettier extension installs/loads and performs one observable function;
- one additional non-AI Open VSX extension installs/loads and performs one observable function.

Record exact extension IDs/versions and whether installed at runtime or bundled.

### Dope surfaces

Verify:
- Project Mind view;
- Planning view;
- BUILD/PLAN switching;
- material layout difference;
- branding/styling;
- selected hidden/replaced standard UI behavior;
- chosen service rebind/replacement has the intended effect.

### Persistence/restart

Create or update a spike Note, close/restart the application path available in the qualification environment, reopen the same workspace, and prove the same canonical note identity/content reconstructs.

Browser target evidence may prove shared frontend behavior. Electron-specific claims require Electron evidence.

Write `docs/tasks/p0/P4-baseline-gui-evidence.md`.

Bounded repairs are allowed only for Phase 0 defects. Rerun affected automated checks after repair.

## P5 — Linux package + packaged application qualification

Target: `0.0.5`.

Browser/GUI execution required.

Use the supported Theia/Electron packaging path and electron-builder-compatible configuration to produce a Linux package from the exact P4 candidate.

On Linux, the expected primary artifact is AppImage unless current supported Theia tooling produces another explicitly justified Linux artifact.

Qualify:
- package exists and identifies Dope, not generic Theia;
- application launches outside the dev server;
- a real repository can be opened;
- editor/explorer/terminal/SCM basics work;
- custom Project Mind and Planning surfaces render;
- persisted spike Note restores for the same workspace;
- packaged resources do not depend on source-tree dev paths;
- obvious startup/runtime errors are absent.

Write `docs/tasks/p0/P5-linux-package-evidence.md` with artifact name/path/hash/size, launch method/environment, observed behavior, and gaps.

Do not publish or auto-update anything.

## P6 — Theia 1.76 upgrade + bounded repair

Target: `0.0.6`.

Starting from the exact Green-enough P5 candidate:
- upgrade the coherent Theia framework baseline from exactly 1.75.0 to exactly 1.76.0;
- do not use `next` builds;
- update directly controlled Theia packages coherently;
- rebuild browser and Electron applications;
- rerun deterministic tests;
- rebuild the Linux package or package preview as appropriate for automated proof.

Create `docs/tasks/p0/P6-upgrade-repair-ledger.md`.

For every required repair record:
- dependency;
- configuration;
- source API;
- CSS/layout;
- extension compatibility;
- packaging;
- cause;
- whether public/supported or private/internal API was involved.

Green upgrade condition:
- no ProjectArtifact/Note/domain rewrite;
- no persistence-domain rewrite;
- no broad shell surgery;
- no early Theia fork;
- only bounded framework adaptation.

If upgrade requires architectural rewrite or broad private API dependence, stop `Not Green / Planning needed`.

## P7 — upgraded GUI/package qualification

Target: `0.0.7`.

Browser/GUI execution required.

Qualify exact P6 source on Theia 1.76.0.

Repeat the material P4/P5 matrix:
- commodity IDE behavior;
- TypeScript/JSON/Markdown;
- Git/SCM;
- terminal;
- debugger;
- Open VSX extensions;
- Project Mind/Planning views;
- BUILD/PLAN layouts;
- styling/rebind behavior;
- persistence/restart;
- packaged application launch and repository open.

Compare against P4 baseline and P5 package evidence.

A bounded upgrade regression may receive the smallest repair plus durable regression coverage. Do not redesign product-domain state to accommodate Theia.

Create `docs/tasks/p0/P7-upgraded-qualification-evidence.md` containing:
- exact 1.75 and 1.76 identities;
- full gate A-G matrix;
- before/after visual/runtime comparison;
- customization-coupling assessment;
- package result;
- upgrade-repair classification;
- Green / Not Green / Evidence Gap truth.

## P8 — evidence-only Foundation Spike closeout

Target: `0.0.8`.

Read exact P1-P7 source and evidence.

Do not implement product behavior or repair defects.

Audit:
- Gates A-G;
- baseline versus upgraded behavior;
- custom-surface integration;
- Project Mind/domain independence;
- backend/persistence boundary;
- customization coupling;
- extension matrix;
- Linux package;
- 1.75 -> 1.76 repair burden;
- every Evidence Gap / Not Green item.

If Green:
- create `docs/tasks/p0/closeout.md`;
- mark the task README complete/Green;
- update `docs/planning/foundation-spike-0/decision-record.md` with executed evidence;
- update ADR 0001 from provisional to accepted if evidence supports it;
- update `BOOT.md` so Phase 0 is qualified and the next required action is post-spike `/docs-review`;
- do not create Phase 1 prompts.

If Not Green:
- preserve failure evidence;
- keep Theia provisional/rejected as appropriate;
- leave Product Phase 1 blocked.

## Phase 0 boundaries

Never implement:
- model/provider runtime;
- Agent Mind;
- tool runtime;
- authority runtime;
- AI editor integration;
- autonomous mutation;
- scoped delegation;
- ambient intelligence;
- production Project Mind;
- production Planning.

A spike exists to learn whether the substrate works. It must not become an accidental first product phase.
