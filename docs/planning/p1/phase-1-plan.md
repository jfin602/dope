# Product Phase 1 — IDE Alive Plan

Status: APPROVED / ACTIVE ENGINEERING GATE

Phase: 1 — IDE Alive  
Execution folder: `p1`  
Activation baseline: `0.1.0`  
Qualified substrate: Eclipse Theia 1.75.0 / Electron / Node 24 / Linux AppImage

## Objective

Turn the qualified Foundation Spike substrate into a dependable native desktop IDE that is comfortable enough to develop Dope inside Dope through ordinary software-development workflows.

Phase 1 proves **Dope as editor**.

It does not implement production Project Mind, production Planning, AI/model/provider integration, Agent Mind, tool execution, authority, mutation, scoped delegation, or Development Sessions.

## Inherited evidence

Foundation Spike 0 already established:
- coherent Theia 1.75 browser and Electron applications;
- editor, Explorer, search, terminal, Git/SCM, debugger and Problems capability;
- VS Code/Open VSX compatibility;
- custom Dope presentation surfaces and bounded service/shell customization;
- typed frontend/backend communication;
- minimal Dope-owned Note persistence and restart reconstruction;
- Linux AppImage build/launch with packaged resources;
- no broad private/internal Theia coupling or framework fork.

Phase 1 must consume this evidence rather than replaying the spike.

## Product shell decision

Electron is the primary user-facing product shell.

The browser app remains useful for development, automated workbench checks, debugging and qualification where native behavior is not at issue. Browser-only success cannot qualify the Phase 1 exit condition.

## Dark-first presentation

Dope prefers dark mode.

Requirements:
- first-run/default presentation is dark;
- Dope-owned surfaces are designed and visually qualified dark-first;
- explicit user theme selection remains supported;
- a user's explicit theme choice persists across restart and overrides the default;
- light and compatible custom themes must not be intentionally broken;
- structural colors should prefer semantic Theia/theme tokens over fixed dark-only assumptions.

Theme, keybindings, layout and editor preferences are user presentation/preferences state, not canonical project-domain state.

## Default IDE experience

The P0 Project Mind Note and Planning views are spike artifacts. Preserve their evidence/history, but do not let unfinished Phase 2/3 concepts dominate ordinary IDE startup. The default experience should prioritize code, Explorer, terminal/problems/testing, SCM and normal development surfaces.

## Scope

Phase 1 owns:
- production Electron shell and branding;
- folder/repository/workspace opening;
- editor/language tooling;
- Explorer/search;
- terminal;
- Git/SCM/diffs;
- debugger;
- Problems;
- integrated test discovery/execution;
- preferences/keybindings;
- extension installation/use and restart persistence;
- theme behavior;
- reliable startup/restart/workspace/editor/layout restoration;
- fresh-environment Linux packaging and launch;
- one direct native dogfooding qualification on the Dope repository.

## Qualification target

The exact packaged candidate must support this normal loop on `jfin602/dope`:

open repository -> navigate -> edit/save -> inspect diagnostics -> search -> run terminal command/tests -> inspect Git diff/status -> debug -> use integrated testing -> adjust preference/keybinding/theme -> install/use extension -> restart -> resume.

Controlled edits used for evidence must be restored. Pre-existing Git state must be preserved.

## Packaging target

Phase 1 should remove the P0 packaging caveats that matter to daily use:
- package from a clean/fresh-enough environment without silently relying on an old plugin cache;
- carry Dope product metadata and custom branding/icon;
- launch normally as a desktop application;
- restore the intended workspace and user preferences.

Cross-distribution Linux certification is not a Phase 1 blocker.

## Architecture constraints

- Theia remains infrastructure.
- No framework-owned layout/widget/session identifier becomes canonical Dope product state.
- Keep shell-area behavior, navigator IDs, status-bar CSS and title-service lifecycle coupling localized.
- Prefer contribution points and stable services over deeper shell access.
- Do not perform a synthetic Theia upgrade during Phase 1.
- The first intentional real Theia upgrade remains its own qualification event.

## Exit condition

Phase 1 qualifies when a developer can use the packaged Dope desktop application for ordinary work on the Dope repository without immediately reaching for another IDE, and the direct native dogfooding evidence is Green with no unresolved product-blocking defect.

After qualification, route through post-phase `/docs-review` before activating Product Phase 2.
