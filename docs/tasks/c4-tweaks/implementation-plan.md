# Correction 4 Implementation Plan — sMap Terminology and Workbench Placement

Status: APPROVED / READY AFTER P5
Correction folder: `c4-tweaks`
Prompt-authoring source: `1032a20e51a1258fcd1dc4a03ba8ba6c80a0435d`
Execution baseline: exact successful Product Phase 4 P5 handoff, package `0.4.5`
Version policy: unchanged `0.4.5`
Authority: ADR 0008; ADR 0007 as amended; current Phase 4 plan/activation; ARCHITECTURE; PRODUCT-MODEL; roadmap/workflow

## Preflight for every prompt

Read BOOT, AGENTS, PRINCIPLES, PRODUCT-MODEL, ARCHITECTURE, workflow/stability authority, ADR 0007, ADR 0008, Phase 4 activation/plan, P4 restart/package evidence, exact P5 prompt/evidence/commit, this correction assessment/plan and all prior correction evidence.

Require:
- exact successful P5 handoff at coherent package version `0.4.5`;
- direct P5 evidence Green enough to enter the correction;
- ADR 0008/current authority reconciled into the execution branch;
- clean intended Git state apart from explicitly recorded unrelated user changes;
- Node 24;
- no root `package-lock.json`;
- Theia exactly 1.75.0 and Electron 42.8.1.

Do not execute this correction against `0.4.4`, an incomplete P5 checkpoint or a branch missing the authoritative terminology/layout decision.

This correction does not close Phase 4 and does not implement Phase 5.

## P1 — Canonical sMap clean rename

### Inspect first

Before editing, trace the exact P5 implementation:
- root workspaces/scripts/test/build/typecheck/package wiring;
- architecture package and exports;
- software-map service/client/path contracts;
- backend registration/coordinator dependencies;
- Theia controller/widget/contribution/view IDs/commands;
- CSS and icon classes;
- unit/integration/restart tests;
- package/native inspection expectations;
- current storage/recovery docs.

Record concrete producers/consumers before renaming. Do not assume every path from the Phase 4 plan landed exactly as predicted.

### Clean-break rename

Rename the live architecture product surface to canonical Software Map terminology.

Expected direction, adjusted to actual P5 source:
- `packages/software-model/` -> `packages/software-map/`;
- package name `@dope/software-model` -> `@dope/software-map`;
- architecture-feature SoftwareModel/PhysicalSoftwareModel types, service/client/path names and public exports -> SoftwareMap/PhysicalMap equivalents;
- `software-model-controller.ts`, `software-model-widget.ts` and related live Theia architecture-feature modules -> software-map/sMap equivalents;
- view/command/widget/service IDs whose product identity is still `software-model` -> canonical software-map/sMap IDs;
- root scripts/workspaces/project references/package dependencies/test names/baseline assertions/package-inspection expectations -> canonical names;
- current storage/recovery guide and nonhistorical references -> Software Map naming.

Keep generic graph/node/edge/query terminology where it describes the implementation substrate. Keep Model Runtime/provider/local-model terminology. Keep `.dope/architecture.json`, architecture declaration IDs and analyzer package names unless exact source proves a narrower rename is required.

Do not leave compatibility aliases, re-export shims, duplicate command IDs, dual package names or tombstone services solely for the superseded prototype naming.

Do not rewrite historical ADR 0007 content, Phase 4 P1-P5 prompts/evidence or earlier historical records merely to remove old words.

### Identity and behavior preservation

The rename must not alter:
- developer-authored System/Subsystem/Component IDs;
- CodeEntity identity algorithms;
- graph relationship identity/dedupe;
- evidence/provenance;
- architecture rules;
- root/project isolation;
- async generation guards;
- analyzer semantics.

If a technical serialized identifier literally contains a legacy package/view identifier, determine whether it is canonical project state or presentation/derived state before changing it. Do not migrate canonical user data without explicit authority. Prefer a clean presentation/derived identity break where safe.

### Terminology regression guard

Add a focused permanent guard, expected as `test/unit/smap-terminology.test.ts` or equivalent.

It must positively assert the canonical current package/path/export surface and fail if live production/build/package wiring reintroduces:
- `packages/software-model`;
- `@dope/software-model`;
- architecture-feature `SoftwareModel*` or `PhysicalSoftwareModel*` public/live symbols;
- current architecture-feature `software-model` command/view/widget/service IDs;
- stale root build/typecheck/test/dependency references.

Scope the guard to current production/package/test wiring. Explicitly exclude historical prompts/evidence and ADR 0007 preserved history. Do not flag legitimate AI/model-provider/Model Runtime language or generic graph implementation terms.

### P1 validation

Run:
- new terminology guard;
- focused Software Map/domain/declaration/analyzer/index/backend/UI tests under their new names;
- `npm run check`;
- current `npm run test:restart`;
- `npm run codex:phase:validate -- c4-tweaks`;
- explicit unchanged `0.4.5` manifest/internal-reference audit;
- no-root-lock/Theia/Electron coherence;
- `git diff --check`.

The runner owns staging/commit. Do not commit manually.

## P2 — Workbench placement and direct requalification

### Inspect placement path

Inspect exact P1 frontend wiring and the supported Theia contribution APIs currently used. Identify:
- widget/view ID;
- contribution/view-container registration;
- default area/rank;
- Activity Bar icon/label;
- any explicit shell addWidget/move logic;
- layout restore behavior;
- old persisted legacy view IDs;
- Project Mind/Explorer coexistence.

Use supported Theia extension points. Do not reach into broad private shell internals merely to force the position.

### Default product placement

Make the canonical default:
- dedicated **sMap** Activity Bar entry;
- Software Map inspector opens in the **left primary sidebar**;
- center remains editor/workspace surface;
- right secondary sidebar is not a dependency/default home for sMap and remains available for future Agent Mind/chat.

Do not create an empty fake chat panel. “Reserved” means Dope does not consume the right side with the sMap feature by default.

Preserve normal user ability to rearrange views. This correction owns default contribution behavior, not a permanent coercive layout lock.

### Legacy persisted layout

Because P5 used the pre-ADR right-side inspector, test a clean/default profile separately from any existing user profile.

If the new sMap view identity naturally prevents stale old layout state from relocating it, keep the solution simple.

If old persisted state can instantiate a ghost legacy view, duplicate sMap entry or force the canonical view right, repair only that concrete transition. Prefer deleting/retiring obsolete presentation IDs or bounded Theia-supported reset behavior over a generalized layout migration subsystem.

### Placement regression guard

Add or extend permanent tests to prove:
- a canonical sMap Activity Bar/view contribution exists;
- its default area is the left primary sidebar;
- current source does not default/programmatically attach sMap to the right secondary sidebar;
- obsolete legacy software-model view IDs cannot register a second live view;
- Project Mind/Explorer and ordinary editor contribution wiring remain intact.

### Restart/integration

Update restart/process integration as needed to cover the renamed view and placement:
- Software Map backend/query attach still works;
- fresh/default profile opens sMap on the left;
- restart/reopen restores a usable current sMap surface;
- no ghost legacy right-side view appears;
- Project Mind restart behavior remains Green;
- second-root/project isolation remains intact.

Do not make persisted derived graph state canonical.

### Direct browser qualification

Use the real browser-hosted Dope workbench against the real Dope repository, with a clean/default profile for the placement proof.

Directly establish:
1. a dedicated sMap Activity Bar button is visible;
2. clicking it opens the Software Map inspector in the left primary sidebar;
3. center editor remains usable with real source open;
4. the right secondary sidebar is not required/defaulted for sMap;
5. Analyze/Refresh succeeds;
6. representative System -> Subsystem -> Component -> code navigation succeeds;
7. at least one dependency/evidence item can navigate to source;
8. current diagnostics/violations state renders honestly;
9. keyboard operation works for the changed surface;
10. dark/default and explicit light are readable;
11. restart/reopen does not create a ghost old Software Model view or move the canonical default back right.

A user manually moving sMap after qualification is not a failure; test the default on a clean profile.

### Package

The P4 package predates this correction and no longer qualifies as the final Phase 4 package.

Build/package the exact corrected `0.4.5` candidate and record:
- AppImage path/mode/size/SHA-256;
- embedded package/app version;
- canonical `@dope/software-map` composition;
- absence of the live `@dope/software-model` package;
- renamed frontend/backend resources as appropriate;
- native launch/readiness and controlled close where environment allows.

Create `docs/tasks/c4-tweaks/P2-smap-layout-evidence.md` containing exact P1/current source identities, browser profile/surface, placement observations, representative Physical Map smoke evidence, restart results, package identity/composition, failures/repairs and Git pre/post state.

Any product repair during P2 requires permanent regression coverage and replay of affected browser/restart/package evidence.

### P2 validation

Run:
- terminology guard;
- placement guard;
- focused Software Map/UI/backend tests;
- `npm run check`;
- `npm run test:restart`;
- `npm run codex:phase:validate -- c4-tweaks`;
- unchanged-version/internal-reference/no-root-lock/Theia checks;
- `git diff --check`;
- exact package build/inspection and direct browser evidence above.

Version remains exactly `0.4.5`.

## P3 — Evidence-only correction closeout

Read exact P5 handoff/evidence, P1/P2 commits/results, P2 layout/package evidence and current authority.

Audit Green / Not Green / Evidence Gap for:

A. **Canonical terminology** — live architecture feature/package/symbol/UI surfaces use Software Map/sMap/Physical Map terminology; no compatibility aliases or ghost old package remain.

B. **Behavior preservation** — architecture declarations, deterministic graph/evidence/query semantics, analyzer behavior, dependency aggregation, violations, unassigned truth and source navigation remain intact.

C. **Workbench contract** — dedicated sMap Activity Bar entry defaults to the left primary sidebar; center remains editor/workspace; sMap does not own the right secondary sidebar by default; user rearrangement remains possible.

D. **Regression guards** — permanent terminology and placement guards cover current production/package surfaces without scanning legitimate AI model terminology or historical evidence as defects.

E. **Isolation/restart** — async generation/project guards, second-root isolation, restart/reopen and absence of legacy ghost view remain supported by current evidence.

F. **Final package/browser** — exact corrected `0.4.5` package contains canonical names and changed GUI was directly qualified on the real Dope repository.

G. **History/phase boundary** — P5 historical evidence is preserved, ADR 0008 is authoritative, no Phase 5 visual canvas/Planning Map editing or AI Presence work was pulled into the correction.

Rerun focused guards/tests, `npm run check`, current `npm run test:restart`, correction validation, unchanged-version/internal-reference/no-root-lock/Theia checks and `git diff --check` as applicable.

Do not repair product behavior in closeout.

Write `docs/tasks/c4-tweaks/closeout.md` with exact candidate identities, A-G disposition, source/package/browser evidence, preserved P5 history, residual gaps and a clear gate decision.

If Green/qualified, mark the correction README complete and route back to Product Phase 4 P6 closeout. P6 must treat the exact successful correction closeout as its predecessor gate while retaining P5 direct evidence for the underlying Physical Map behavior.

## Scope guard

No Phase 5 visual canvas, Planning Map editing, graph-layout library, semantic-zoom UI, graph-derived work ontology, AI Presence, Agent Mind, provider runtime, authority/delegation, Development Sessions or Theia upgrade.
