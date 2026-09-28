# P5 — Native Electron Dope-on-Dope qualification

Status: **Evidence Gap — native matrix not executed; P6 remains blocked.**

Date: September 28, 2026. This is an incomplete qualification record, not a successful manual handoff. No P5 commit has been created.

## Candidate and preflight

- Exact committed P4 candidate: `cdf4327ad291641ffaf4cc4d2ebf20a4a5496190`, commit subject `0.1.4`, branch `main`.
- Candidate package version: `0.1.4`. P5 preparation updates the five project manifests, three internal dependency references and existing version-coherence assertions to `0.1.5`; these changes are uncommitted. The existing P4 AppImage remains `0.1.4`.
- Eclipse Theia: `1.75.0`; Electron: `42.8.1`; Node: `v24.21.0`. Host: Linux Mint 22.3 (Zena), Linux `7.0.0-31-generic`, x86-64, X11 (`DISPLAY=:0`), Cinnamon (`XDG_CURRENT_DESKTOP=X-Cinnamon`).
- Artifact: `/home/jfin/dev/dope/dist/linux/Dope-0.1.4.AppImage`, 188,125,714 bytes, mode `755`. SHA-256 independently rechecked: `bf8ba3d101378e021a6247a0bb43a22c0c0b9dfca071ce3f6c51be067ced4c62`.
- Intended workspace: `/home/jfin/dev/dope`, the real repository, not a fixture.
- Preflight `git status --porcelain=v1 --untracked-files=all` produced no entries. Both working-tree and index diffs were empty. No pre-existing user changes needed restoration.
- Read BOOT/AGENTS, Phase 1 authority and plans, P1-P4 prompts and reachable implementation commits/source/tests/evidence, and P0 closeout. P4 records successful fresh plugin preparation, packaging and normal startup, sufficient to begin dogfooding; its native-use gap is explicitly retained. P0's native visual gap does not waive Phase 1's mandatory gate.
- Independently reran `npm run check` on the unchanged P4 candidate successfully before P5 edits. Phase validation, no-root-lock and whitespace checks also passed with the candidate's Git state still clean.

## Native interaction blocker and launch path

The session's computer-use tool instructions explicitly disable native computer APIs. Its inventory returned `apps: []` and only the Codex in-app browser. Consequently this run did not launch, select, observe or interact with a native Dope window. This is a qualification-environment limitation, not an observed Dope product defect. Native control or operator-supplied direct native observations are required to finish the gate.

P4's recorded normal launch, **not repeated as P5 native evidence**, was from `/tmp` with fresh `HOME`, `XDG_CONFIG_HOME` and `THEIA_CONFIG_DIR`:

```text
/home/jfin/dev/dope/dist/linux/Dope-0.1.4.AppImage /home/jfin/dev/dope
```

P4 passed no `--no-sandbox`, `--disable-gpu` or remote-debugging flags for that normal launch. A future P5 pass must use this exact artifact and real workspace with an isolated profile for first-run evidence, then reuse that profile for preference/extension/restoration checks. No browser or CDP result below substitutes for native interaction.

## Native dogfooding matrix

Every row below is **Evidence Gap**. No row was exercised in the native Electron window during this run.

| Required native step | Observation still required |
| --- | --- |
| Workspace open, Explorer and multiple real files | Open the real repository; navigate Explorer and multiple source/documentation files. |
| Controlled reversible edit/save and language behavior | Make and save a controlled real-file edit; observe language tooling; restore the file exactly. |
| Controlled Problems diagnostic and repair | Introduce a controlled diagnostic, observe it in Problems and clear it by repairing the edit. |
| Workspace search | Search repository content and navigate an observed result. |
| Integrated terminal and real validation | Run a real repository test/validation command from the integrated terminal and observe its result. |
| Git dirty state, diff and restoration | Observe the controlled edit in native SCM and its diff, restore it, and verify exact preflight state before prompt-owned finalization. |
| Node debugger breakpoint and locals | Stop at a real Node breakpoint, inspect locals and finish the debugging session. |
| Integrated test discovery/execution/result | Discover and execute a real test through Test Explorer; inspect the displayed result. A CLI test pass is insufficient. |
| Preferences UI and harmless preference | Change a harmless preference through the native UI and observe its effect. |
| Keybindings UI and harmless temporary keybinding | Add and use a temporary binding through the native UI, verify restart persistence, then remove it. |
| Non-AI Open VSX extension install/use | Install through the native marketplace, record exact ID/version and demonstrate an observable function. |
| Extension restart persistence | Restart without installing again and repeat the extension's observable function. |
| Clean-profile dark first-run/default | Visually observe dark presentation on a fresh profile with no explicit theme preference. |
| Alternate/light theme and restart | Select a compatible alternate/light theme, observe it after native restart overriding the dark default, then set and record the desired final preference. |
| Native workspace/editor/workbench restoration | Close normally, restart and observe intended workspace, real editor files and workbench state. |
| Non-intrusive Project Mind/Planning spike surfaces | Observe normal startup prioritizing ordinary IDE work; do not judge the spike surfaces as production Phase 2/3 features. |

## Theme, extension, testing and restoration evidence boundaries

- Existing source and deterministic guards retain `defaultTheme: dark` in both application manifests, semantic Dope theme colors and no automatic Project Mind/Planning foregrounding. These are source/guard facts, not native visual observations.
- P3's existing headless Electron integration evidence covers explicit light preference, workspace/editor/view restoration, preferences/keybindings, a functional fixture VSIX and stale-state fallback. It remains supplemental integration evidence and cannot qualify any P5 native row.
- A background browser visited the official [Code Spell Checker Open VSX listing](https://open-vsx.org/extension/streetsidesoftware/code-spell-checker). The listing identifies `streetsidesoftware.code-spell-checker`, describes spelling checking and links version `4.9.5` license metadata. **No extension was installed or used in Dope during this run**, and no native extension persistence is claimed. The existing P3 local fixture VSIX is not an Open VSX marketplace-install demonstration.
- `npm run test:ide` uses Node's test runner on `test/fixtures/ide-testing/sample.test.js`. Its CLI result is separate from discovery/execution in the native integrated test surface.
- No native theme choice, preference, keybinding or workbench profile was changed. No native restart was performed; the desired final native theme remains unrecorded.

## Repairs and automated validation

No product repair was made: there is no reproduced native failure to repair or repeat. No later-phase scope, new runtime subsystem, framework upgrade or dependency was introduced. Changes are limited to requested P5 version preparation, existing version assertions and this evidence record.

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

Preflight log: `/tmp/dope-p5-preflight-check.log`. Build/test logs include existing nonfatal npm environment-configuration warnings, the contracts module-type warning and `Module not found: find-git-repositories`; the aggregate check still exited 0. No package rebuild was performed: the exact P4 AppImage's hash was rechecked after validation and remained unchanged. Native UI, package usability and native integrated tests are not qualified by these commands.

## Git preservation and handoff

No controlled native edit or diagnostic was introduced, and no unrelated user file or native user profile was changed. The supplemental restart test uses an isolated disposable workspace/configuration/profile. Git remained at the exact clean preflight state through P4 preflight validation. Subsequent pending changes belong only to P5 preparation. Final `git status --porcelain=v1 --untracked-files=all` contains exactly:

```text
 M apps/browser/package.json
 M apps/electron/package.json
 M package.json
 M packages/contracts/package.json
 M packages/theia-extension/package.json
 M test/unit/theia-baseline.test.ts
?? docs/tasks/p1/P5-native-dogfooding-evidence.md
```

The index is empty, branch remains `main`, and HEAD remains `cdf4327ad291641ffaf4cc4d2ebf20a4a5496190`. No native Git dirty/diff/restoration loop is claimed. The repository is deliberately left with these seven pending prompt-owned paths until qualification succeeds.

P5 is incomplete. The success-conditioned exact-subject `0.1.5` commit and clean final handoff have **not** occurred. **Do not resume P6** from this record. Finish the native matrix on the exact P4 artifact, record actual observations and any bounded repairs with regression coverage, rerun applicable validation, then make the single requested `0.1.5` commit and verify a clean repository. This record must retain the unexecuted attempt rather than imply it passed.
