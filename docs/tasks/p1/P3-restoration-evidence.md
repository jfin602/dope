# P3 — Restoration and persistence evidence

Date: September 28, 2026. Package: `0.1.3`. Theia: `1.75.0`.

`npm run test:restart` launches the built Electron application under Xvfb three times with one isolated Electron profile and Theia configuration directory. It requires the already-built Electron frontend/backend, `xvfb-run`, and `zip`. The test installs a VSIX with Theia's `--install-plugin` mechanism on the first launch only, explicitly trusts its controlled workspace, closes the window through Electron's normal close path, and restarts without install arguments. The fixture command uppercases supplied text; its `RESTART` and `AGAIN` results prove function before and after restart, not just extension metadata. For the final stale-state probe it writes malformed stored layout data and closes the target without the normal layout save, then confirms the next launch remains usable.

| Behavior | Evidence | Status |
| --- | --- | --- |
| Workspace/folder | Theia opens the CLI folder and reopens it from its recent-workspace store with no folder argument. | Green (integration) |
| Editor/workbench | Open `README.md` and the Dope Project Mind view; both are present after a normal close/relaunch through Theia's layout restorer and widget factory. | Green (integration) |
| Theme | First-run dark is guarded by the application manifests; explicit user `light` is active and survives restart, overriding the dark default. | Green (deterministic + integration) |
| Preferences/keybindings | User `editor.fontSize=17` and a user mode-toggle keybinding survive restart in Theia's `settings.json` and `keymaps.json`, and the restored registry exposes the binding. | Green (integration) |
| Runtime extension | The test VSIX is deployed in the isolated Theia `deployedPlugins/` and its command works after the second launch without `--install-plugin`. | Green (integration) |
| Stale/unavailable state | Invalid Dope mode and malformed Theia layout fall back to BUILD/default layout; a removed workspace opens an empty window; an unavailable stored theme falls back to the still-valid explicit light preference. | Green (integration) |
| Native visual appearance and user-driven interactions | Headless Electron renderer and services only; native window verification remains P5. | Evidence Gap |

The packaged built-ins come from `plugins/` via `scripts/packaged-main.cjs` and `extraResources`; runtime VS Code extensions are managed by Theia under its user configuration (`deployedPlugins/`, with VSIX drop-ins under `extensions/`). The source-tree download cache is not a user-extension database. Theme, keybindings, layout, extension installation and BUILD/PLAN mode remain presentation state, not canonical project artifacts. No Project Mind production or session restoration is claimed.

P4 remains the fresh-environment AppImage build/launch gate; this dev Electron restart test does not qualify packaging, distro portability, or native GUI behavior.
