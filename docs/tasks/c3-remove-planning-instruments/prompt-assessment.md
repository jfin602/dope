# Correction 3 Prompt Assessment — Remove Phase 3 Planning Instruments

Status: APPROVED / READY FOR EXECUTION
Correction folder: `c3-remove-planning-instruments`
Baseline source/package: `68a51e78233f0a81bf295fb06e591fb508149bf0`, `0.3.6`
Authority: ADR 0007, `BOOT.md`, `AGENTS.md`, `docs/roadmap/mvp-roadmap.md`

## Conclusion

Use three ordered correction prompts at unchanged package version `0.3.6`.

The removal should happen before Product Phase 4. The current Planning implementation is not a compatibility target; keeping any adapter, shadow schema, bridge, migration, or dormant PLAN-mode shell would add complexity to the Physical Software Model work.

The dependency chain is:

atomic Planning vertical-slice removal -> clean-baseline qualification/negative guards -> evidence-only correction closeout.

| Prompt | Boundary | Primary evidence | Routing |
| --- | --- | --- | --- |
| P1 | Delete the live Phase 3 Planning vertical slice and repair surviving product/build wiring | compiling Project Mind + IDE product with no Planning package/service/view/mode/state | GPT-6 Sol High |
| P2 | Qualify the clean pre-Phase-4 baseline | negative absence guards, aggregate/restart/package checks, direct browser confirmation of Project Mind/IDE and absence of Planning UI | GPT-6 Sol High, browser required |
| P3 | Evidence-only correction closeout | exact unchanged-version candidate, no ghost Planning runtime, preserved historical Phase 3 evidence | GPT-6 Sol High |

P1 is runner-owned. P2 requires browser-capable interactive qualification. P3 is the final manual correction closeout.

## Current source findings

The Phase 3 Planning subsystem is a full vertical slice, not one package:

- root `package.json` includes `packages/planning`, builds/typechecks it, and runs Planning unit/storage/UI suites;
- `packages/contracts/src/planning.ts` and `planning-service.ts` define Plan/PlanStep/Task, operations/history/document and RPC contracts;
- `packages/contracts/src/workspace-mode.ts` exists only for BUILD/PLAN mode and is the package's current main/types entry;
- `packages/planning/` owns domain logic and `.dope/planning.json` persistence;
- `@dope/theia-extension` depends on `@dope/planning`;
- frontend wiring registers Planning RPC, PlanningView/Widget and Project Mind Planning bridges;
- backend wiring registers PlanningStore/PlanningBackend;
- `dope-workbench.ts` contains Decision -> Planning bridge behavior, PlanningView, BUILD/PLAN commands, localStorage mode state, status-bar mode and mode-aware title behavior;
- Planning-specific CSS remains in `dope.css`;
- restart integration contains both WorkspaceMode restoration assertions and a dedicated Planning persistence/recovery test;
- `test/unit/planning*.test.ts` and `workspace-mode.test.ts` protect the subsystem being intentionally removed;
- `test/unit/theia-baseline.test.ts` explicitly requires the Planning package/dependency/tests/typecheck wiring;
- repository state contains tracked `.dope/planning.json`;
- `docs/planning-storage.md` documents the live persistence subsystem being removed.

Historical Phase 3 plans, prompts, evidence and closeout documents are intentionally retained.

## Removal decision

P1 should remove the live vertical slice atomically rather than stage a compatibility period.

Delete the Planning domain/service/persistence/presentation and PLAN mode together, then repair surviving Project Mind/IDE build and test wiring in the same prompt.

Do not:
- migrate `.dope/planning.json`;
- create tombstone adapters or no-op Planning services;
- preserve Plan/PlanStep/Task DTOs for hypothetical future use;
- keep PLAN mode as a placeholder;
- retain obsolete tests just because they were previously Green;
- add code that searches for or deletes arbitrary users' old Planning files.

Only the repository-tracked current Planning state/documentation is removed. Historical truth remains available through Git and the Phase 3 evidence tree.

## Preserved behavior

The correction must preserve:
- Project Mind Note/Idea/Question/Decision domain, persistence, backend and UI;
- `.dope/project-mind.json`;
- editor, Explorer/search, terminal, SCM/diffs, debugger, Problems, tests, extensions and preferences/themes;
- Dope branding/window title without a fake workspace mode;
- Theia 1.75.0, Electron 42.8.1, Node 24;
- phase/correction runner behavior;
- package version `0.3.6`;
- historical Phase 1/2/3 evidence.

## Main risks

- **Cross-domain coupling:** removing Planning bridge callbacks can accidentally break Project Mind widget construction or Decision rendering.
- **Presentation residue:** Planning command/view IDs, PLAN status-bar/UI state, CSS, localStorage or title behavior can survive after package deletion.
- **Build residue:** root workspace/scripts, Theia extension dependencies or baseline tests can keep dead package references.
- **Restart regression:** existing restart test mixes useful IDE/Project Mind continuity with obsolete mode assertions; remove only the Planning/mode portions.
- **Packaging residue:** stale compiled outputs or packaged workspace metadata could make a source-only grep look clean while the artifact still contains Planning.
- **Over-cleaning:** historical docs/evidence must not be deleted merely because they contain Planning names.
- **Version drift:** correction mode requires all manifests/internal references to remain exactly `0.3.6`.

## Qualification decision

P2 must add permanent negative guards scoped to current production/package wiring, not historical docs. The guard should fail if future work reintroduces the removed package/service/view/mode/storage accidentally.

Direct browser evidence should verify:
- Project Mind still opens and supports a representative create/edit/save/Decision interaction;
- ordinary editor/workbench behavior remains usable;
- no Planning view/menu/command is exposed;
- no BUILD/PLAN switch or DOPE PLAN status element remains.

Package evidence should prove the resulting artifact does not contain `@dope/planning` as an installed internal package or compiled Planning frontend/backend modules.

## Deferred

Do not implement any Product Phase 4 software-model code in this correction. No System/Subsystem/Component graph, TypeScript analyzer, architecture declarations, graph store, visual map, Visual Software Planning, AI runtime or provider integration belongs here.
