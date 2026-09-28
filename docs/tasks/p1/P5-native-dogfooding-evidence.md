# P5 — Interactive Theia GUI Dope-on-Dope qualification

Status: **Not Green — direct browser-GUI qualification executed partially; restart/restoration stalled and several required rows remain incomplete. P6 remains blocked.**

Date: September 28, 2026. This record preserves the incomplete native-only attempt and now carries the owner-approved browser-GUI amendment. The pushed `p5 unfinished` checkpoint is not a successful P5 handoff; an exact-subject `0.1.5` success commit is still required.

## Candidate and preflight

- Exact committed P4 candidate: `cdf4327ad291641ffaf4cc4d2ebf20a4a5496190`, commit subject `0.1.4`, branch `main`.
- Exact committed P4 candidate remains `cdf4327ad291641ffaf4cc4d2ebf20a4a5496190`, package `0.1.4`. The pushed preparation checkpoint `85210381303327bcbb8452a6615c5ccb48cea9d6` (`p5 unfinished`) carries coherent `0.1.5` manifests/version assertions and this incomplete evidence. It is not the P5 success marker. The existing P4 AppImage remains `0.1.4`.
- Eclipse Theia: `1.75.0`; Electron: `42.8.1`; Node: `v24.21.0`. Host: Linux Mint 22.3 (Zena), Linux `7.0.0-31-generic`, x86-64, X11 (`DISPLAY=:0`), Cinnamon (`XDG_CURRENT_DESKTOP=X-Cinnamon`).
- Artifact: `/home/jfin/dev/dope/dist/linux/Dope-0.1.4.AppImage`, 188,125,714 bytes, mode `755`. SHA-256 independently rechecked: `bf8ba3d101378e021a6247a0bb43a22c0c0b9dfca071ce3f6c51be067ced4c62`.
- Intended workspace: `/home/jfin/dev/dope`, the real repository, not a fixture.
- Preflight `git status --porcelain=v1 --untracked-files=all` produced no entries. Both working-tree and index diffs were empty. No pre-existing user changes needed restoration.
- Read BOOT/AGENTS, Phase 1 authority and plans, P1-P4 prompts and reachable implementation commits/source/tests/evidence, and P0 closeout. P4 records successful fresh plugin preparation, packaging and normal startup, sufficient to begin dogfooding; its native-use gap is explicitly retained. P0's native visual gap does not waive Phase 1's mandatory gate.
- Independently reran `npm run check` on the unchanged P4 candidate successfully before P5 edits. Phase validation, no-root-lock and whitespace checks also passed with the candidate's Git state still clean.

## Prior native-only attempt and qualification amendment

The first P5 attempt could not control a native desktop window: the execution environment exposed no native computer APIs and only an in-app browser. That attempt therefore produced no interactive IDE observations and remains an Evidence Gap. This was an environment limitation, not an observed Dope defect.

The owner subsequently approved direct interaction with the real browser-hosted Theia workbench as an equivalent P5 GUI qualification surface. P4 remains authoritative for Electron/AppImage packaging, packaged resources and normal native-process launch. A new interactive browser-workbench pass may therefore satisfy the matrix below; CDP-only/headless evidence may not.

P4's recorded normal launch, **not repeated as P5 native evidence**, was from `/tmp` with fresh `HOME`, `XDG_CONFIG_HOME` and `THEIA_CONFIG_DIR`:

```text
/home/jfin/dev/dope/dist/linux/Dope-0.1.4.AppImage /home/jfin/dev/dope
```

P4 passed no `--no-sandbox`, `--disable-gpu` or remote-debugging flags for that normal launch. That remains the Electron/native-launch evidence. For P5, use the actual Dope repository in a directly interactive Theia GUI. If browser-hosted, use an isolated browser/app profile or origin storage for first-run theme evidence and then reuse it for preference/extension/restoration checks. A direct interactive browser GUI is valid; CDP-only or headless results are not.

## Historical native-only interactive matrix

The table below preserves the first attempt as historical Evidence Gap. The new browser-GUI results are recorded separately below; these historical entries are not current results.

| Required interactive step | Observation still required |
| --- | --- |
| Workspace open, Explorer and multiple real files | Open the real repository; navigate Explorer and multiple source/documentation files. |
| Controlled reversible edit/save and language behavior | Make and save a controlled real-file edit; observe language tooling; restore the file exactly. |
| Controlled Problems diagnostic and repair | Introduce a controlled diagnostic, observe it in Problems and clear it by repairing the edit. |
| Workspace search | Search repository content and navigate an observed result. |
| Integrated terminal and real validation | Run a real repository test/validation command from the integrated terminal and observe its result. |
| Git dirty state, diff and restoration | Observe the controlled edit in SCM and its diff, restore it, and verify exact preflight state before prompt-owned finalization. |
| Node debugger breakpoint and locals | Stop at a real Node breakpoint, inspect locals and finish the debugging session. |
| Integrated test discovery/execution/result | Discover and execute a real test through Test Explorer; inspect the displayed result. A CLI test pass is insufficient. |
| Preferences UI and harmless preference | Change a harmless preference through the GUI and observe its effect. |
| Keybindings UI and harmless temporary keybinding | Add and use a temporary binding through the GUI, verify restart persistence, then remove it. |
| Non-AI Open VSX extension install/use | Install through the native marketplace, record exact ID/version and demonstrate an observable function. |
| Extension restart persistence | Restart without installing again and repeat the extension's observable function. |
| Clean-profile dark first-run/default | Visually observe dark presentation on a fresh profile with no explicit theme preference. |
| Alternate/light theme and restart | Select a compatible alternate/light theme, observe it after application restart/reopen overriding the dark default, then set and record the desired final preference. |
| Workspace/editor/workbench restoration | Close normally, restart and observe intended workspace, real editor files and workbench state. |
| Non-intrusive Project Mind/Planning spike surfaces | Observe normal startup prioritizing ordinary IDE work; do not judge the spike surfaces as production Phase 2/3 features. |

## Historical native-only evidence boundaries

- Existing source and deterministic guards retain `defaultTheme: dark` in both application manifests, semantic Dope theme colors and no automatic Project Mind/Planning foregrounding. These are source/guard facts, not native visual observations.
- P3's existing headless Electron integration evidence covers explicit light preference, workspace/editor/view restoration, preferences/keybindings, a functional fixture VSIX and stale-state fallback. It remains supplemental integration evidence and cannot qualify any P5 native row.
- A background browser visited the official [Code Spell Checker Open VSX listing](https://open-vsx.org/extension/streetsidesoftware/code-spell-checker). The listing identifies `streetsidesoftware.code-spell-checker`, describes spelling checking and links version `4.9.5` license metadata. **No extension was installed or used in Dope during this run**, and no native extension persistence is claimed. The existing P3 local fixture VSIX is not an Open VSX marketplace-install demonstration.
- `npm run test:ide` uses Node's test runner on `test/fixtures/ide-testing/sample.test.js`. Its CLI result is separate from discovery/execution in the native integrated test surface.
- No theme choice, preference, keybinding or workbench profile was changed during the failed native-only attempt. No qualifying restart was performed in that attempt; the interactive requalification must now record these observations.

## Historical native-only repairs and automated validation

No product repair was made: there was no reproduced product failure in the native-only attempt to repair or repeat. No later-phase scope, new runtime subsystem, framework upgrade or dependency was introduced. Changes are limited to requested P5 version preparation, existing version assertions and this evidence record.

The unchanged P4 preflight and prepared `0.1.5` working-tree `npm run check` both passed using the established X11 build sysroot:

```text
PKG_CONFIG_SYSROOT_DIR=/tmp/dope-p3-sysroot/root
PKG_CONFIG_LIBDIR=/tmp/dope-p3-sysroot/root/usr/lib/x86_64-linux-gnu/pkgconfig:/tmp/dope-p3-sysroot/root/usr/share/pkgconfig
npm run check
```

| Check on the prepared `0.1.5` working tree | Result | Evidence |
| --- | --- | --- |
| Focused baseline/package-entrypoint and WorkspaceMode guards | Green, 5/5 tests | `/tmp/dope-p5-focused.log` |
| `npm run test:restart` | Green, 1/1 integration test | `/tmp/dope-p5-restart.log`; existing isolated Xvfb/CDP harness, not native/manual evidence |
| `npm run check` | Green | `/tmp/dope-p5-check.log`; typecheck, 93/93 runner, 3/3 baseline, 6/6 product, 1/1 CLI IDE-fixture tests, browser and Electron builds with zero build errors |
| `npm run codex:phase:validate -- p1` | Green, exit 0 | `/tmp/dope-p5-phase-validation.log` |
| `test ! -e package-lock.json` | Green | No root lockfile present |
| `git diff --check` | Green | Exit 0 after all P5 preparation edits |

Preflight log: `/tmp/dope-p5-preflight-check.log`. Build/test logs include existing nonfatal npm environment-configuration warnings, the contracts module-type warning and `Module not found: find-git-repositories`; the aggregate check still exited 0. No package rebuild was performed: the exact P4 AppImage's hash was rechecked after validation and remained unchanged. These commands do not qualify the interactive P5 GUI matrix. P4 separately qualifies package/native-launch viability.

## Historical checkpoint and handoff requirements

The failed native-only attempt began from clean P4 candidate `cdf4327ad291641ffaf4cc4d2ebf20a4a5496190`. It made no controlled GUI edit or diagnostic and changed no native user profile. Its seven prompt-owned preparation paths were subsequently pushed as checkpoint `85210381303327bcbb8452a6615c5ccb48cea9d6` with subject `p5 unfinished`.

That checkpoint preserves the incomplete attempt; it is not P5 success and does not unblock P6.

For the new interactive GUI pass:
- record current preflight Git state before controlled edits;
- restore every controlled repository edit;
- preserve any pre-existing unrelated changes;
- update this evidence with actual observations;
- rerun required validation;
- create the exact-subject `0.1.5` success commit;
- leave the repository clean.

If the interactive pass is browser-hosted, state that explicitly. Do not claim native-window interaction. P4's package/native-launch evidence plus P5's direct browser-workbench evidence are the combined Phase 1 qualification model.

P5 remains incomplete until the interactive matrix is Green. **Do not resume P6** before the exact `0.1.5` success commit exists.


## September 28 browser-GUI qualification — current result

The owner requested wrap-up while restart diagnosis was still in progress. This run is **Not Green**, with additional **Evidence Gaps** listed below. No exact-subject `0.1.5` success commit was created. The earlier native-only limitation remains historical and is not the blocker for the amended surface.

### Candidate, environment and launch

- Exact P4 candidate: `cdf4327ad291641ffaf4cc4d2ebf20a4a5496190` (`0.1.4`).
- Prepared P5 checkpoint: `85210381303327bcbb8452a6615c5ccb48cea9d6` (`p5 unfinished`).
- Current-run preflight/checkpoint: `15bc698b6cc8ce815d74c43a1b6ebfe8ed94283c` (`docs: allow browser GUI for p5 qualification`), branch `main`, clean index and working tree. Product source was unchanged from P4 apart from coherent `0.1.5` versions/version guard.
- Qualification surface: **real browser-hosted Theia GUI**, visible in the Codex in-app browser. Actual workspace: `/home/jfin/dev/dope`. Direct clicks, keyboard input, editor input, menus and visual observations exercised the matrix. No native-window interaction is claimed.
- Versions remain coherent `0.1.5`; Theia `1.75.0`, Electron `42.8.1`, Node `v24.21.0`; Linux Mint 22.3, kernel `7.0.0-31-generic`, x86-64, Cinnamon/X11.
- Fresh isolated backend configuration `/tmp/dope-p5-gui/config`, fresh localhost origin `http://127.0.0.1:3055`, repository trust accepted in the GUI. The first launch used:

```text
THEIA_CONFIG_DIR=/tmp/dope-p5-gui/config node apps/browser/lib/backend/main.js /home/jfin/dev/dope --hostname=127.0.0.1 --port=3055 --plugins=local-dir:/home/jfin/dev/dope/plugins
```

The browser opened `http://127.0.0.1:3055/#/home/jfin/dev/dope`. Logs: `/tmp/dope-p5-gui/backend-1.log`, `/tmp/dope-p5-gui/backend-2.log`. Backend 1 later exited with SIGTERM; its cause was not established. A new backend process reused the same configuration and browser origin. Reopening the GUI stalled at `ShellLayoutRestorer >>> Restoring layout`. This was a real backend replacement, but **not a successful restart/restoration qualification**.

### Direct interactive matrix

| Required step | Current result | Direct observation / limit |
| --- | --- | --- |
| Workspace, Explorer, multiple real files | Green | Opened actual repository, navigated Explorer, opened README.md and package.json, and opened TypeScript/source and Node-test files. |
| Reversible edit/save and language behavior | Green | Appended `const p5QualificationProbe: number = "controlled";` to workspace-mode.ts in the editor and saved; TypeScript language/status and diagnostics observed. Restored exactly. |
| Problems diagnostic and repair | Green | Problems showed ts2322, string not assignable to number, plus unused-variable diagnostic. Discarded controlled edit in GUI; Problems returned to zero. |
| Workspace search and real result | Green | Searched `parseWorkspaceMode`, observed results, clicked a match and navigated to dope-workbench.ts around line 169. |
| Integrated terminal and validation | Green | Ran `npm run test:ide` from the repository terminal; displayed one test, one pass, zero failures. |
| SCM dirty state, diff, restoration | Green | Observed modified file/main dirty badge, opened Working Tree diff showing added line, used Discard File, verified empty Git status before bounded repair work. |
| Node breakpoint and locals | Green | Used JavaScript Debug Terminal, ran actual Node fixture, stopped at assertion breakpoint; Variables showed local `p5Local: number = 4` and call stack at sample.test.js:6:5. Continued to test pass. Removed breakpoints and restored fixture exactly. |
| Integrated test discovery/execution/result | Not Green pending interactive repair replay | Test Explorer discovered actual fixture and ran it, but displayed failure. Test Output showed filename passed with literal shell quotes. Existing provider was upgraded and regression passed; successful GUI rerun was prevented by restoration stall. |
| Preferences UI and harmless change | Green for edit; restart Evidence Gap | Opened Settings UI, changed editor.fontSize from 14 to 17; GUI value and saved user settings confirmed. Persistence after usable restart not observed. |
| Temporary keybinding UI | Partial / Evidence Gap | Added physical Ctrl+Alt+Shift+M through Keyboard Shortcuts UI for dope.mode.toggle, used it and observed PLAN mode. Saved keymaps confirmed. Restart persistence and removal through GUI remain unexecuted. |
| Non-AI Open VSX install/use | Partial / Evidence Gap | Installed Code Spell Checker through Extensions marketplace. Exact ID `streetsidesoftware.code-spell-checker`, version `4.9.5`; download/deployment and Spell Checker output observed. No concrete spelling diagnostic/function demonstrated. |
| Extension restart persistence | Evidence Gap | Second backend synchronized 92 plugins including installed extension. Functional use after a usable restart not observed; plugin metadata is insufficient. |
| Clean-profile dark first run | Green | Fresh origin/config presented dark workbench with no explicit workbench.colorTheme saved. |
| Explicit light theme/restart/final theme | Evidence Gap | No explicit light selection, restart override or desired final theme cycle completed. Current isolated GUI profile remains default dark. |
| Workspace/editor/workbench restart restoration | Not Green | New backend and reopened GUI stalled in layout restoration. No successful reconstructed editor/workbench state observed. |
| Non-intrusive unfinished spike surfaces | Green on initial startup | Normal dark IDE opened without Project Mind/Planning taking the foreground; ordinary IDE work remained primary. PLAN mode shortcut did not foreground Planning. |

### Bounded test-provider repair and permanent guard

The GUI exposed a real defect in the bundled `firsttris.vscode-jest-runner@0.4.134`: its Node test invocation used `spawn` with `shell: false` but supplied shell-quoted filename arguments. Test Output reported it could not find the filename containing literal quotes. The CLI test independently passed.

The smallest repair updates the existing Open VSX provider pin to `0.4.149`, whose launcher removes shell quoting before direct process invocation. No new provider, dependency framework or Dope subsystem was added. The existing baseline pin assertion was updated. The existing restart integration now discovers and runs the provider test in a directory containing spaces and asserts its passed state. This is a permanent guard for the argument-handling defect class.

- Old provider: regression failed with quoted-path error and failed test state (`/tmp/dope-p5-regression-before.log`).
- New provider: regression passed, 1/1, including existing restart/theme/preferences/extension/stale-state cases (`/tmp/dope-p5-regression-after.log`).
- One intermediate harness run failed because the manually prepared plugin omitted its VSIX manifest; the complete official archive was then used and the test passed. This preparation error was not classified as a Dope defect.
- Successful direct GUI replay remains required. Automated coverage does not turn that row Green.

Temporary widget-creation logging was used to narrow the restoration stall. All persisted editor-preview-widget creations began without completing; other inspected widgets completed. Persisted editors included ordinary files and the controlled SCM diff. This is diagnostic evidence, **not an established root cause**. The temporary instrumentation was removed; no restoration repair is claimed.

### Package boundary after the provider repair

Rebuilt the Electron application/package after changing the bundled provider. `npm run package:linux` passed using the established X11 build sysroot; log `/tmp/dope-p5-package.log`.

- Artifact: `/home/jfin/dev/dope/dist/linux/Dope-0.1.5.AppImage`, 188,096,997 bytes, mode 755.
- SHA-256: `8d604a9732f7b771bee1b29a2b1343ae58dfc7a82316921de5bc7d5e6f997058`.
- Normal process launch from `/tmp`, fresh HOME/XDG_CONFIG_HOME/THEIA_CONFIG_DIR, repository argument, no caller-supplied no-sandbox, disable-gpu or remote-debugging flags:

```text
/home/jfin/dev/dope/dist/linux/Dope-0.1.5.AppImage /home/jfin/dev/dope
```

`/tmp/dope-p5-package-smoke/launch.log` recorded 91 accepted packaged plugins and frontend state `ready`. The parcel-watcher fs.Stats deprecation remained nonfatal. This is rebuilt package/normal-process smoke evidence; native visual operation and native normal-close behavior were not requalified. P4 retains its separate authority. The package was built before temporary diagnostic logging, so it contains the intended provider repair without that instrumentation.

### Automated validation and Git preservation

The provider repair passed focused baseline tests, the extended restart integration and `npm run check` (`/tmp/dope-p5-final-check.log`). The final aggregate check after removal of temporary instrumentation passed, exit 0 (`/tmp/dope-p5-wrap-check.log`): typecheck, 93 runner tests, 3 baseline tests, 6 product tests, 1 CLI IDE fixture and browser/Electron builds. Final focused baseline passed 3/3 (`/tmp/dope-p5-wrap-focused.log`). Phase validation passed (`/tmp/dope-p5-wrap-phase.log`); explicit no-root-package-lock.json and `git diff --check` passed. All five workspace/package manifests were checked as `0.1.5`. These are supplementary validation, not interactive matrix substitutes.

Both controlled repository edits (workspace-mode.ts diagnostic and sample.test.js debugger local) were restored byte-for-byte; Git was empty before repair. No pre-existing user edits existed. Retained changes are only the existing provider pin, its baseline assertion, the permanent integration guard, and this evidence. Isolated GUI settings/keymap and installed extension remain under `/tmp/dope-p5-gui/config` for resumption; they do not change the user's ordinary profile. Temporary browser tab was closed on wrap-up. The qualification backend had already exited by wrap-up; the isolated package-smoke process was terminated. Profiles and logs were retained for diagnosis. This termination is not native normal-close qualification.

The incomplete checkpoint created for this run is identified by the commit containing this updated evidence; its exact SHA is reported in the handoff and can be resolved with `git log -1 --format=%H -- docs/tasks/p1/P5-native-dogfooding-evidence.md`. It is **not** the exact-subject `0.1.5` success marker. Final success SHA: **none**.

Remaining work: resolve/retest actual restoration stall, repeat Test Explorer success through GUI, demonstrate extension function before/after real restart, verify and remove temporary keybinding, complete light-theme persistence/final dark preference and usable workspace/editor/workbench restoration, then rerun validation and create `0.1.5`. **P6 remains blocked.**
