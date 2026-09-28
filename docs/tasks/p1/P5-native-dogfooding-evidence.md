# P5 — Interactive Theia GUI Dope-on-Dope qualification

Status: **Evidence Gap — prior native-only attempt did not execute the matrix; interactive GUI requalification is now pending. P6 remains blocked until that pass is Green.**

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

## Interactive dogfooding matrix

Every row below remains **Evidence Gap** from the first attempt. Re-exercise each row through a directly interactive Theia GUI (browser-hosted workbench or Electron) and replace the pending observation with the actual result.

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

## Theme, extension, testing and restoration evidence boundaries

- Existing source and deterministic guards retain `defaultTheme: dark` in both application manifests, semantic Dope theme colors and no automatic Project Mind/Planning foregrounding. These are source/guard facts, not native visual observations.
- P3's existing headless Electron integration evidence covers explicit light preference, workspace/editor/view restoration, preferences/keybindings, a functional fixture VSIX and stale-state fallback. It remains supplemental integration evidence and cannot qualify any P5 native row.
- A background browser visited the official [Code Spell Checker Open VSX listing](https://open-vsx.org/extension/streetsidesoftware/code-spell-checker). The listing identifies `streetsidesoftware.code-spell-checker`, describes spelling checking and links version `4.9.5` license metadata. **No extension was installed or used in Dope during this run**, and no native extension persistence is claimed. The existing P3 local fixture VSIX is not an Open VSX marketplace-install demonstration.
- `npm run test:ide` uses Node's test runner on `test/fixtures/ide-testing/sample.test.js`. Its CLI result is separate from discovery/execution in the native integrated test surface.
- No theme choice, preference, keybinding or workbench profile was changed during the failed native-only attempt. No qualifying restart was performed in that attempt; the interactive requalification must now record these observations.

## Repairs and automated validation

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

## Git preservation and handoff

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
