# P4 — Foundation IDE GUI and tooling evidence

Status: **Green for the shared browser workbench**. Native Electron-window interaction and Linux packaging are P5 evidence gaps, not claims of this gate.

## Candidate and environment

- Exact committed candidate qualified before P4 changes: `b4eb21e20d81818b9e27c49ed187fe54394792ed` (`0.0.3`; P3 implementation commit `2e6efe76284611aa5c459a2b816daff8e4b9f93f`). Theia packages: `1.75.0`; Node: `v24.21.0`.
- Date: 2026-09-27. Linux Mint 22.3, Linux `7.0.0-31-generic`, x86_64, X11 (`DISPLAY=:0`). Theia browser backend at `http://127.0.0.1:3000`, observed in the Codex in-app browser. This was the real shared workbench, not an Electron window.
- Controlled Git fixture: `/tmp/dope-p4-fixture`, opened in the workbench as a single local folder. It contained `hello.ts`, `debug.js`, `config.json`, `README.md`, `.vscode/launch.json`, and later a local ESLint configuration. `debug.js` was a small Node program whose `add(2, 3)` prints `5`. The fixture and runtime extension installs are outside the Dope repository.
- Preflight: P3 typecheck, 101 tests (93 runner, 2 baseline, 6 product), and browser build passed. The first plain Electron build failed at `native-keymap` because system `x11.pc` and `xkbfile.pc` were absent. Repeating with the pre-existing `/tmp/dope-p3-sysroot/root` via `PKG_CONFIG_SYSROOT_DIR` and `PKG_CONFIG_LIBDIR` passed; this is a Linux build prerequisite for P5, not a Dope source repair.

## Commodity IDE matrix

| Capability | Direct workbench observation | State |
| --- | --- | --- |
| Repository/workspace open | File > Open selected `/tmp/dope-p4-fixture`; the URL and window title identified that workspace. The controlled folder was trusted when prompted. | Green |
| Explorer navigation | Explorer listed `.dope`, `.vscode`, TypeScript, JavaScript, JSON, and Markdown files; opening files from it worked. | Green |
| Editor open/edit/save | Monaco opened `hello.ts`; a pasted line was saved to disk and later undone and saved. | Green |
| TypeScript/JavaScript | TypeScript mode reported `ts(2322)` for `const broken: string = 123`; JavaScript mode opened `debug.js`, ran under Node debugging, and accepted extension diagnostics. | Green |
| JSON | `config.json` opened in JSON mode; changing `enabled` to `false` saved valid JSON, then undo/save restored the original file. | Green |
| Markdown | `README.md` opened in Markdown mode; a new line saved to disk, then undo/save restored it. | Green |
| Search | Workspace search for `violet-penguin-42` returned one result in `README.md`. | Green |
| Git/SCM | The controlled TypeScript edit changed the branch indicator from `main` to `main*` and marked `hello.ts` modified; undo/save returned `main` and a clean fixture. | Green |
| Terminal | Terminal > New Terminal ran `pwd && printf 'P4_TERMINAL_OK\n'`; the terminal displayed `/tmp/dope-p4-fixture` and `P4_TERMINAL_OK`. | Green |
| Node debugger | A gutter breakpoint at `debug.js:2` paused `Debug P4 Node` in `add`; call stack showed `debug.js 2:18`, local `a = 2`, `b = 3`. Continue printed `5` in Debug Console. | Green |
| Problems/markers | The TypeScript error appeared in Problems and status bar, then Problems showed no detected problems after undo/save. | Green |

## Extension matrix

The Extensions view queried Open VSX and showed publisher, version, and Install actions. The three extensions below were installed during this run; each changed to Uninstall and loaded in the workbench. They are **runtime-installed**, not bundled in `plugins/`.

| Extension ID / version | Source | Observable function | State |
| --- | --- | --- | --- |
| `dbaeumer.vscode-eslint@3.0.34` | Runtime-installed from Open VSX | Fixture-local ESLint 9.39.5 with `no-console` reported `Unexpected console statement. eslint (no-console)` for `debug.js:5` in Problems. | Green |
| `esbenp.prettier-vscode@12.4.0` | Runtime-installed from Open VSX | Format Document offered `prettier-vscode, esbenp.prettier-vscode` alongside the built-in TypeScript formatter. Selecting Prettier reformatted deliberately compact JavaScript; its status changed to checked `Prettier`, and the saved file matched the formatted baseline. | Green |
| `streetsidesoftware.code-spell-checker@4.9.5` | Runtime-installed from Open VSX | A controlled `spelingg` in Markdown appeared as `"spelingg": Unknown word. cSpell` in Problems; undo/save cleared it. | Green |

The downloaded built-in bundle supplied `vscode.typescript-language-features@1.108.2`, `vscode.javascript@1.108.2`, `vscode.json-language-features@1.108.2`, `vscode.markdown-language-features@1.108.2`, and `vscode.git@1.108.2`. The bundled Node debugger was `ms-vscode.js-debug@1.105.0`. These versions were read from the installed plugin manifests; the Extensions view showed 90 built-in plugins before the three runtime installs.

## Dope surfaces and customization

| Capability | Direct observation | State |
| --- | --- | --- |
| Project Mind | Dope-owned right-side spike view rendered its Note fields, save action, stable ID, and saved state. | Green |
| Planning | Dope-owned Planning spike view opened as a main-area tab and displayed its spike content. | Green |
| BUILD/PLAN layout | Status-bar mode switch moved focus from editor/Project Mind in BUILD to the Planning main surface in PLAN and collapsed the right panel; switching back restored the BUILD presentation. | Green |
| Branding/styling | Window title and status bar displayed Dope; spike views had `DOPE / FOUNDATION SPIKE` styling and mode-specific accent styling was visible. | Green |
| Hidden/replaced standard UI | The Explorer retained files but showed no duplicate Open Editors section; Dope Project Mind/Planning and the mode status control supplied custom surfaces. | Green |
| P2 service rebind | Browser title changed from `Dope · BUILD` to `Dope · PLAN` and back when the mode changed, demonstrating the rebound `WindowTitleService` effect. | Green |

The P2 coupling classification remains in `customization-coupling-ledger.md`. A shutdown log included a nonfatal Theia warning that the Planning widget did not accept focus within 2 seconds; the Planning surface was visibly active and the mode/title transition completed.

## Persistence and restart

Through Project Mind, saved title `P4 restart note` and body `Canonical content survives the browser workbench restart.` The view displayed Note ID `74e8826e-d45c-48b9-882b-103adf11f231`; the canonical `/tmp/dope-p4-fixture/.dope/note.json` contained that ID, content, schema version 1, type `note`, and provenance `developer`.

The Theia browser backend was stopped and a new backend process started. Reloading the same `#/tmp/dope-p4-fixture` workspace reconstructed Project Mind with the **same ID, title, and body**. BUILD mode, editor tabs, and workspace also restored. State: **Green**.

## Repairs, rerun, and gaps

- Dope source repairs: **none**. P4 changes are this evidence, the `0.0.4` package/workspace version update, and the matching version invariant in the baseline test. Fixture edits were restored or committed in the disposable fixture so its Git tree was clean.
- Post-change deterministic validation: `npm run check` exited 0 with the local X11 development sysroot noted above. Typecheck passed; runner tests 93/93, Theia baseline/version tests 2/2, product tests 6/6; browser and Electron builds each finished with 0 errors. `npm run codex:phase:validate -- p0` passed. No root `package-lock.json`; `git diff --check` passed.
- Evidence Gap: native Electron-window visual interaction and Linux distributable launch were not observed here. P5 owns packaging and native launch evidence. Browser GUI evidence must not be read as native-window evidence.
- Overall P4 shared-workbench gate: **Green**. No observed substrate blocker. P5 can proceed after the single `0.0.4` commit.
