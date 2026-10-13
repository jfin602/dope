# P4 — Planning restart and Linux package evidence (`0.3.4`)

September 28, 2026. **Candidate:** uncommitted `0.3.4` working tree on pre-task HEAD `0332ac55c6ada9b4afa9c0d9accdcd5959c53d91` (`0.3.3`). The reachable activation source is `95815b04977a229abfdfdba628eb9dddc9e55203`; P1/P2/P3 predecessors are `ed476b1`, `ba32999`, `0332ac5`. The intended tree was clean before P4. Root, both apps, four workspace packages and all `@dope/*` references/baseline assertions now agree on `0.3.4`. No implementation commit was made. The P3 commit reported its own Electron rebuild blocked by missing X11 development metadata; P4 supplied that environment and passed the complete check. Phase 2's owner-sequenced Not Qualified audit and Phase 1's Not Qualified result remain unchanged.

## Integrated process evidence

`npm run test:restart` — **3/3 passed** after building the current Electron frontend/backend. The existing suite was extended, not replaced. It launches actual Electron workbenches with independent profiles, exercises typed frontend `PlanningService`/`ProjectMindService` RPCs and the production backend/store, closes processes, and reopens them. CDP is test instrumentation, **not** P5 direct GUI evidence. Temporary project/profile directories are removed after each test.

| Case | Observed disposition |
| --- | --- |
| No Project Mind identity; attach/read before and after creating a real Decision | **Green.** Empty Planning returns `project-mind` prerequisite and rejects mutation; the same connection reattaches after Project Mind creation, then `createFromDecision` produces a separate draft linked to the Decision. |
| Plan/Step/Task write, links, revisions | **Green.** Three Steps, two Tasks, Decision link, existing `README.md:1` and unresolved `missing.txt` file references; reorder to `[third, first, second]`, activate Plan, block/unblock Step, activate Task. Document and Plan revisions reach 11 with history revisions 1–11 and read-back equality. |
| Peer/stale writer and restart/reopen | **Green.** Stale revision zero rejected; a second-profile process observes revision 11, closes; the first-profile process advances to 12; the peer profile reopens and its revision-11 write is rejected without overwrite, reading revision 12. The first profile reopens, accepts a Step completion at revision 13, and reads it back. These are sequential process-separated peers, not simultaneous window editing. |
| Second local project | **Green.** Distinct Project Mind identity, separate Planning Plan at revision 1; first-project Plan ID absent from second store. |
| Abandoned lock, mismatch, malformed JSON, future schema | **Green (manual recovery sequence).** With writers stopped, a planted lock allows read but blocks mutation and leaves canonical bytes unchanged; it is removed only after close. An identity mismatch, corrupt JSON, and schema 2 each reject attachment without changing injected bytes. Restoring the original canonical bytes while stopped recovers revision 13 and all contents. No automatic lock stealing or schema downgrade. |
| Prior IDE/Project Mind restart cases | **Green.** Theme, keybinding, extension command, test provider, stale workspace/layout fallback; Project Mind migration/types/search/links/status/isolation/recovery retained. PLAN takes main-view focus, so the IDE assertion now checks the restored `README.md` editor **tab**, not `currentEditor` focus; it pins the editor with `{ preview: false }` before restart. |

Initial integration attempt followed `build:extension` alone, so the stale Electron frontend had no Planning binding; this was a build-order failure, not a product repair. The first Electron rebuild failed because the newly recreated development sysroot contained only static X11 libraries (non-PIC link error); copying the matching installed shared libraries into that **temporary** sysroot fixed the environment. A parallel second Electron instance timed out during CDP readiness; the test uses sequential peer processes. The inherited editor-focus assertion failed after PLAN opened its real main-area view: probing the restored workbench showed the `README.md` tab present; the test now checks tab restoration rather than active-editor focus. The failed editor probe is retained at `/tmp/dope-p3-p4-ide-probe.log`; earlier `/tmp/dope-p3-p4-restart.log` attempts were overwritten by the final passing run, with their failures described here. No product source repair or product regression claim is made.

## Checks and package

Host: Linux Mint 22.3, Linux `7.0.0-31-generic` x86-64, Node `24.21.0`, Corepack/Yarn `1.22.22`, `pkg-config 1.8.1`, X11 `DISPLAY=:0`. Recreated the documented `/tmp/dope-p3-sysroot/root` from Ubuntu Noble X11 development debs in `/tmp/dope-p3-sysroot/debs`, adding the already installed matching shared X11 libraries. This is host setup, not repository source. Existing `node_modules`, Electron/builder/ffmpeg caches and **91** prepared `plugins/` directories were reused. `package:linux` skipped `download:plugins`; electron-builder reported an Electron zip download/extract, not a fresh dependency/plugin install. No signing, publication, empty-cache or cross-distribution claim.

Commands (the first two builds and failed restart attempts preceded the final results):

```sh
node --test test/unit/planning.test.ts test/unit/planning-storage.test.ts test/unit/planning-ui.test.ts test/unit/theia-baseline.test.ts
PKG_CONFIG_SYSROOT_DIR=/tmp/dope-p3-sysroot/root PKG_CONFIG_LIBDIR=/tmp/dope-p3-sysroot/root/usr/lib/x86_64-linux-gnu/pkgconfig:/tmp/dope-p3-sysroot/root/usr/share/pkgconfig npm run build:electron
npm run test:restart
PKG_CONFIG_SYSROOT_DIR=/tmp/dope-p3-sysroot/root PKG_CONFIG_LIBDIR=/tmp/dope-p3-sysroot/root/usr/lib/x86_64-linux-gnu/pkgconfig:/tmp/dope-p3-sysroot/root/usr/share/pkgconfig npm run check
npm run codex:phase:validate -- p3
test ! -e package-lock.json
git diff --check
PKG_CONFIG_SYSROOT_DIR=/tmp/dope-p3-sysroot/root PKG_CONFIG_LIBDIR=/tmp/dope-p3-sysroot/root/usr/lib/x86_64-linux-gnu/pkgconfig:/tmp/dope-p3-sysroot/root/usr/share/pkgconfig npm run package:linux
```

Focused checks **27/27**, full `npm run check` **passed** (runner 93, baseline 3, product 49, IDE 1, browser and Electron builds), phase grammar **VALID**, no root lock, diff whitespace **clean**. Logs: `/tmp/dope-p3-p4-{build-extension,build-electron,focused,restart,check,phase,package}.log`.

The exact produced `dist/linux/Dope-0.3.4.AppImage` is executable x86-64 ELF/AppImage, mode **755**, **188,121,666 bytes**, SHA-256 **`eb7a3f03c15fc13db247f64662d66d8385841bb52f8b10b69bfccc7914de7b3d`**. Extracted `Dope.desktop`: `Name=Dope`, `Exec=AppRun %U`, `Icon=dope`, `StartupWMClass=Dope`, `X-AppImage-Version=0.3.4`, `Categories=Development`. Its icon matches `apps/electron/build/icon.png` SHA-256 `d1e9254188cca1a69dda8c071e9d327bf2326216e3e4a0e56027316d3d3768fd`. Embedded `app.asar` declares `@dope/electron` **0.3.4**, `@dope/theia-extension` **0.3.4**, and `scripts/packaged-main.cjs`. The packaged backend bundle contains `PlanningService`, `planning.json`, `step.reorder`, `task.create` and the typed service path; the frontend bundle contains the Planning service, operation names, `Plan history` and `dope.planning.open`. Domain/transport are bundled, not loose internal package manifests in the asar. Frontend index/bundle/CSS, backend main, unpacked native resources and 91 plugin directories including `vscode.javascript` and `firsttris.vscode-jest-runner` are present.

Launched **that exact AppImage**, not a source build, with new temporary `HOME`, `XDG_CONFIG_HOME`, `THEIA_CONFIG_DIR` and workspace folder on X11, without caller-supplied `--no-sandbox`, `--disable-gpu` or CDP flags. Backend listened on `127.0.0.1:38787`, deployed 91 plugins, frontend reached `ready`, and `wmctrl -lp` showed PID `67359`, window `workspace - Dope · BUILD` (`0x03e00004`). `wmctrl -ic 0x03e00004` produced exit **0**. Nonfatal parcel-watcher `fs.Stats` deprecation and other startup warnings are in `/tmp/dope-p3-p4-native.log`; `/tmp/dope-p3-p4-native-result.log` records PID/window/close. No direct visual Planning editing was observed.

## Handoff

**P4 qualified for P5 handoff**, subject to direct GUI dogfooding. P5 still needs actual click/type/observe Planning on the Dope repository, linked Decision and real work, mode/draft/dirty-navigation and workspace-switch behavior, peer conflict/recovery, restart, backup, keyboard and dark/light usability, and preservation of Git state. Headless/CDP and native window-readiness alone do not discharge those gates. Historical Phase 1/2 failures and the Phase 2 owner sequencing waiver remain visible, not relabeled Green.
