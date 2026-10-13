# Dope

Dope is an AI-native software development environment designed to keep the developer at the center of the engineering process.

The goal is not maximum autonomous code generation. The goal is maximum leverage while preserving understanding, authorship, skill, control, and the satisfaction of building software yourself.

> At the end of a four-hour session, the developer should understand the software better than they did when they started, while accomplishing dramatically more than they could alone.

The understanding must survive the session as durable project knowledge.

Dope is a fresh project. It is not George v2 and has no compatibility requirement with George. George is process and implementation prior art only.

## Current gate

**Phase 10 P16 is NOT GREEN at committed `0.10.16` source `27ab84e`.** The exact-source aggregate passes, but direct Roadmap import and local Chat planning are blocked in the real UI; see [P16 closeout](docs/tasks/p10/closeout.md). P1–P15 implementation is retained. Phase 10 awaits a separate repair and owner decision; Phase 11 and Phase 12 remain inactive. The baseline and activation account below describes the earlier entry state.

Foundation Spike 0 qualified Eclipse Theia 1.75.0 as Dope's initial IDE substrate at package `0.0.6`.

**Phase 9 Developer Continuity / History is OWNER-CLOSED / GREEN / QUALIFIED** at committed `0.9.35` source `af3447c` ([final qualification](docs/tasks/p9d/final-qualification.md), [owner closeout](docs/planning/p9/phase-9-closeout.md)). The repo now has coherent **`0.10.0` as a version baseline only** ([baseline](docs/planning/p10/baseline.md)). Phase 10 Unified Roadmap & Local-First AI Planning is design-approved under ADR 0036 but **OWNER-ACTIVATED for P1–P16 (2026-10-12), not yet implemented or qualified**; Phase 11 Human-Centered UI and Phase 12 Living Software Knowledge Model are inactive. Original P13/repair Not Green evidence remains historical.

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

[ADR 0036](docs/decisions/0036-unified-roadmap-and-local-first-ai-planning.md) and [Phase 10 plan](docs/planning/p10/phase-10-plan.md) approve a future collaborative Roadmap with checkpoints, detached Ideas/Issues, in-place inspector and shared validated human/local-AI planning. Manual zero-model use and real short-context local inference are release gates. Former Living Software Knowledge Model is now Phase 12; Phase 11 is the Human-Centered UI audit. Phase 9 is owner-closed with an established `0.10.0` baseline; this Roadmap design is now separately owner-activated for implementation under [Phase 10 activation](docs/planning/p10/activation.md), but remains unimplemented and unqualified.

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
