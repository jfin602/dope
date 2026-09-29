# Correction 3 Implementation Plan — Remove Phase 3 Planning Instruments

Status: APPROVED / READY FOR EXECUTION
Correction folder: `c3-remove-planning-instruments`
Baseline source/package: `68a51e78233f0a81bf295fb06e591fb508149bf0`, `0.3.6`
Version policy: unchanged `0.3.6`
Authority: ADR 0007 and the mandatory pre-Phase-4 gate in the roadmap

## Preflight for every prompt

Read BOOT, AGENTS, PRINCIPLES, PRODUCT-MODEL, ARCHITECTURE, workflow/stability authority, ADR 0007, the roadmap correction gate, Phase 3 closeout/post-closeout routing, this plan and all prior correction evidence.

Require:
- reachable baseline `68a51e78233f0a81bf295fb06e591fb508149bf0`;
- package version exactly `0.3.6`;
- clean intended Git state;
- Node 24;
- no root `package-lock.json`;
- Theia exactly 1.75.0 and Electron 42.8.1.

This correction does not re-open Phase 3 qualification and does not activate Phase 4.

## P1 — Remove the Phase 3 Planning vertical slice

### Delete product/domain/runtime files

Remove:
- `packages/planning/`;
- `packages/contracts/src/planning.ts`;
- `packages/contracts/src/planning-service.ts`;
- `packages/contracts/src/workspace-mode.ts`;
- `packages/theia-extension/src/browser/planning-controller.ts`;
- `packages/theia-extension/src/browser/planning-file-navigation.ts`;
- `packages/theia-extension/src/browser/planning-widget.ts`;
- `packages/theia-extension/src/node/planning-backend.ts`;
- Planning-only unit/storage/UI tests;
- obsolete `workspace-mode.test.ts`;
- repository-tracked `.dope/planning.json`;
- `docs/planning-storage.md`.

Do not delete `docs/planning/p3/**`, `docs/tasks/p3/**`, Phase 3 closeout/evidence, or Git history.

### Repair shared product wiring

Root/package wiring:
- remove `packages/planning` workspace;
- remove Planning build/typecheck/test commands;
- keep all package and internal dependency versions at `0.3.6`;
- point `@dope/contracts` main/types at a surviving real contract entry;
- remove `@dope/planning` from `@dope/theia-extension`.

Frontend:
- remove Planning service proxy/binding, Planning widget factory, Planning view contribution/menu/command;
- remove Project Mind related-Plans/create-Plan/show-Plan constructor callbacks and Decision bridge UI;
- remove Planning imports/IDs;
- remove BUILD/PLAN commands, PLAN auto-open, `dope.workspaceMode` persistence, mode status-bar element and mode-dependent body/title behavior;
- preserve clean Dope branding/title and ordinary Project Mind view behavior.

Backend:
- remove Planning store/backend/RPC registration and imports.

CSS:
- remove PLAN-mode and Planning-view-only selectors while preserving Project Mind and general Dope theme styling.

Restart integration:
- keep useful workspace/editor/theme/keybinding/extension/test/Project Mind restart coverage;
- remove Planning restart test;
- remove `dope.mode.*`, PLAN dataset/localStorage and workspace-mode-specific assertions;
- replace any mode-only keybinding probe with a surviving ordinary command if keybinding persistence still needs evidence.

Baseline/product tests:
- update current baseline assertions to the surviving workspace/dependency/test graph;
- remove tests whose sole subject is the deleted subsystem;
- do not weaken unrelated Project Mind/IDE assertions.

### Data policy

Delete only the repository's tracked `.dope/planning.json`.

Do not add runtime migration, cleanup, import, compatibility or automatic deletion logic for Planning files in arbitrary projects. With the subsystem gone, old external Planning files are simply not interpreted by current Dope.

### P1 checks

Run:
- focused surviving Project Mind/baseline tests;
- updated restart integration as practical;
- `npm run check`;
- `npm run codex:phase:validate -- c3-remove-planning-instruments`;
- explicit manifest/internal-version audit for unchanged `0.3.6`;
- explicit no-root-lock check;
- `git diff --check`.

The runner owns staging/commit. Do not commit manually.

## P2 — Qualify the clean pre-Phase-4 baseline

### Permanent negative guard

Add a focused current-baseline guard, expected as something like `test/unit/pre-phase4-clean-baseline.test.ts`.

It must inspect current production/package surfaces only and fail if they reintroduce:
- `packages/planning` in root workspaces/scripts;
- `@dope/planning` dependency/wiring;
- current Planning DTO/service files;
- PlanningService/PlanningClient/planningServicePath;
- PlanningStore/PlanningBackend;
- PlanningView/PlanningWidget/PLANNING_ID;
- `WorkspaceMode.PLAN`, `dope.workspaceMode` or `dope.mode.*`;
- production access to `.dope/planning.json`;
- repository-tracked `.dope/planning.json`.

Historical Phase 3 docs/evidence are explicitly outside this guard.

### Integrated qualification

Rerun the surviving restart suite and aggregate build/tests.

Build/package the exact correction candidate at unchanged `0.3.6`. Inspect the artifact enough to prove:
- no internal `@dope/planning` package/dependency;
- no compiled Planning backend/frontend/domain modules;
- surviving Project Mind/Theia extension composition is coherent.

Use the actual browser-hosted Dope workbench for direct interaction:
- open the real Dope repository;
- open Project Mind;
- perform a representative safe Project Mind create/edit/save action and inspect a Decision;
- open/navigate real code in the editor;
- confirm no Planning view/menu/command is exposed;
- confirm no BUILD/PLAN switch/status element remains;
- exercise dark default or current theme and explicit light override enough to catch presentation regressions;
- preserve Git state and restore any disposable Project Mind probe if it is not intended durable knowledge.

Record exact source/commit, commands, browser surface, checks, package identity/hash/composition, negative-guard results and any failures/retries in `docs/tasks/c3-remove-planning-instruments/P2-clean-baseline-evidence.md`.

A repair during P2 requires a permanent regression guard and replay of the affected qualification.

### P2 checks

Run:
- new negative guard;
- focused Project Mind/current baseline tests;
- `npm run check`;
- surviving `npm run test:restart`;
- correction grammar validation;
- no-root-lock/version coherence;
- `git diff --check`;
- package build/inspection and direct browser evidence described above.

Version remains exactly `0.3.6`.

## P3 — Evidence-only correction closeout

Read the exact baseline, P1/P2 commits/source/tests and P2 evidence plus the historical Phase 3 closeout.

Audit:
A. complete removal of Planning domain/contracts/package;
B. complete removal of Planning store/backend/RPC and repository Planning state;
C. complete removal of Planning presentation, Project Mind bridges and PLAN mode;
D. current build/test/package graph contains no ghost Planning dependency;
E. Project Mind and ordinary IDE behavior remain usable;
F. negative absence guard is permanent and correctly excludes historical docs;
G. historical Phase 3 evidence remains intact and Phase 4 code has not started.

Rerun focused/aggregate/restart/correction-validation/no-root-lock/version/whitespace checks as appropriate.

Do not repair product behavior in closeout.

Write `docs/tasks/c3-remove-planning-instruments/closeout.md` with exact candidate identities, A-G disposition, package/browser evidence, retained historical Phase 3 truth, residual gaps and a clear gate decision.

If Green/qualified enough for sequencing, route to post-correction `/docs-review` and Product Phase 4 planning/activation. Do not create Phase 4 prompts inside this correction.

## Scope guard

No Product Phase 4 implementation. No software-model packages, code analyzers, architecture graph, visual planning, AI/model/provider runtime, Agent Mind, tool execution, authority, sessions or framework upgrade.
