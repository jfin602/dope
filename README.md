# Dope

Dope is an AI-native software development environment designed to keep the developer at the center of the engineering process.

The goal is not maximum autonomous code generation. The goal is maximum leverage while preserving understanding, authorship, skill, control, and the satisfaction of building software yourself.

> At the end of a four-hour session, the developer should understand the software better than they did when they started, while accomplishing dramatically more than they could alone.

The understanding must survive the session as durable project knowledge.

Dope is a fresh project. It is not George v2 and has no compatibility requirement with George. George is process and implementation prior art only.

## Current gate

Foundation Spike 0 qualified Eclipse Theia 1.75.0 as Dope's initial IDE substrate at package `0.0.6`.

**Product Phase 8 — Coding Agent / Scoped Delegation is OWNER-CLOSED / GREEN / QUALIFIED for its approved scope** on `0.8.47` source `bcc5cb8` (2026-10-10). The [Phase 8 owner closeout](docs/planning/p8/phase-8-closeout.md) consolidates 8A–8E evidence, including [P14 local-agent qualification](docs/tasks/p8e/closeout.md) with 506/506 aggregate and 67/67 additional security tests. The original [8D P13 Not Green](docs/tasks/p8d/closeout.md) remains historical; the later [c8-fix](docs/tasks/c8-fix/closeout.md) separately qualified 8D. **Phase 9 — Development Sessions is ACTIVE for 9A implementation only (owner-authorized 2026-10-10); NOT QUALIFIED.** See the [Phase 9 plan](docs/planning/p9/phase-9-plan.md) and [ADR 0033](docs/decisions/0033-optional-development-sessions-and-linked-work.md). Sessions will organize existing Chat, Planning and Work without duplicating state or granting authority. The [clean `0.9.0` version baseline](docs/planning/p9/baseline.md) is now committed at `e250a07`; **Phase 9A P1–P6 is now authorized** ([activation](docs/planning/p9/activation.md)); the last qualified product source remains `0.8.47` / `bcc5cb8`.

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
