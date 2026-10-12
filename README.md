# Dope

Dope is an AI-native software development environment designed to keep the developer at the center of the engineering process.

The goal is not maximum autonomous code generation. The goal is maximum leverage while preserving understanding, authorship, skill, control, and the satisfaction of building software yourself.

> At the end of a four-hour session, the developer should understand the software better than they did when they started, while accomplishing dramatically more than they could alone.

The understanding must survive the session as durable project knowledge.

Dope is a fresh project. It is not George v2 and has no compatibility requirement with George. George is process and implementation prior art only.

## Current gate

Foundation Spike 0 qualified Eclipse Theia 1.75.0 as Dope's initial IDE substrate at package `0.0.6`.

**Phase 8 is OWNER-CLOSED / GREEN** at `0.8.47` / `bcc5cb8` ([closeout](docs/planning/p8/phase-8-closeout.md)). **Phase 9 is ACTIVE, with 9A BOUNDED GREEN** at `0.9.6` / `6b51ee96` ([9A closeout](docs/tasks/p9a/closeout.md), 13/13 focused tests and restart). **9B is design-approved but NOT ACTIVATED** ([9B plan](docs/planning/p9/phase-9b-plan.md)); Phase 9 overall remains NOT QUALIFIED. 9B will link existing Chat/Planning/Work records without copying truth or granting execution. 9C–9E and Phase 10 remain inactive.

Dope prefers a dark default presentation while preserving persistent user theme choice.

The Phase 1 IDE composition includes Theia's Test Explorer and a bundled Node.js/Jest/Vitest test provider. Test discovery is enabled by default; user settings can disable `jestrunner.enableTestExplorer`. Run the deterministic Node test fixture with `npm run test:ide`. Native GUI testing evidence belongs to P5.

Run `npm run test:restart` on Linux with Xvfb and `zip` to exercise Electron workspace, editor, layout, theme, preference, keymap, and user-extension restoration. It uses an isolated temporary profile and a fixture VSIX; the source-tree `plugins/` directory supplies built-ins only.

Read BOOT.md before substantial repository-aware work.

## Local Linux installation

On Linux Mint, run `npm run install:local` from this repository. It packages the current Electron source, copies the AppImage into `~/.local/opt/dope/releases/<build-id>/`, and atomically points `~/.local/opt/dope/current` at it. The source checkout stays separate. Restart Dope to use the new build.

The menu launcher is `~/.local/share/applications/dope.desktop`; search for **Dope** in the Mint menu, then right-click it and choose **Add to panel** (or **Add to favorites**). Its command always uses `current/Dope.AppImage`, so it needs no update when builds change. Its icon path includes an image hash so Mint does not reuse an old cached icon. Run `node scripts/local-install.mjs refresh-launcher` to refresh an existing launcher without deploying another build.

- `npm run list-builds` shows the active build and deployment history.
- `npm run rollback:local -- <build-id>` activates a retained release. Restart Dope afterward.
- `node scripts/local-install.mjs install --artifact /path/to/Dope.AppImage --note "reason"` installs an already packaged artifact without rebuilding. Use the normal command for a fresh build.

Each build retains `build.json` beside its AppImage. `~/.local/opt/dope/history.jsonl` is append-only and records version, UTC time, Git commit, branch, clean/dirty state, source and installed artifact paths, activation result, and optional notes. `BUILD-HISTORY.md` in the same directory is the readable summary. A failed activation leaves `current` pointing at the previous build. Previous releases remain available for rollback.

## Forward roadmap design (documentation only)

[ADR 0036](docs/decisions/0036-unified-roadmap-and-local-first-ai-planning.md) and [Phase 10 plan](docs/planning/p10/phase-10-plan.md) approve a future collaborative Roadmap with checkpoints, detached Ideas/Issues, in-place inspector and shared validated human/local-AI planning. Manual zero-model use and real short-context local inference are release gates. Former Phase 10 Living Software Knowledge Model is now Phase 11, inactive. Phase 9 remains independent/Not Qualified; this is no source/version/qualification claim.

## Core docs

- docs/VISION.md
- docs/PRINCIPLES.md
- docs/PRODUCT-MODEL.md
- docs/ARCHITECTURE.md
- docs/THEIA-SPIKE.md
- docs/project-overview.md
- docs/workflow.md
- docs/stability-contract.md
- docs/roadmap/mvp-roadmap.md
