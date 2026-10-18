# P4 independent Electron GUI — manual cycle 1 (2026-10-18)

**Result: BLOCKED / EVIDENCE GAP for independent native GUI.** This was the owner's direct P4 manual Run. The current source builds for Electron, but this task's computer controller cannot enumerate, select, inspect, capture, or send input to a native window. No native GUI behavior, product defect, or parity PASS is inferred. No product or test code was changed in P4; no repair cycle beyond this capability assessment was used. Original P15 remains NOT GREEN; Phase 11 remains OPEN / NOT QUALIFIED and Phase 12 inactive.

## Source and preservation

- Checkout: `/home/jfin/dev/dope`, `main` at `7fa2707a58b44602cd9725c6f0ab94cc0881a962`, 15 commits ahead of `origin/main`, with the uncommitted P1–P3 product/test candidate and qualification records. The inspected status included the six P1 browser source paths, six adjacent tests, P1–P3 records and the two modified repair-stack indexes. No pre-existing dirty file was reset, stashed, cleaned, overwritten, or committed. The original P15 source `11e1f761dda1dafead6f3c3ada072bedc9eeb389` is in local history.
- All 13 Dope package manifests and 20 internal pins were checked at `0.11.8`, with zero mismatches. The 12 P1–P3 source/test file `sha256sum`-line manifest (new Prepare Work helper; five edited browser files; new navigation test; five edited unit tests, in that order) has SHA-256 `106f4b74ca04f7eba6d5ffa28df45be79b3bed5eeadcaf11413704717c06f857`. This binds the tested uncommitted candidate to the above HEAD; it is not a commit SHA.
- Original P15 closeout SHA-256: `df884d326dad0577d29f1ead90e57e24e28274f531efc720a92579eb5eabe2b1`; original `qualification/p15-manual/evidence.json`: `64672af40a5befcf1f78236e14b0999970ff5db6d272abb1befef45b04308b42`; original `/tmp/dope-p15-check.log`: `db23402f2850d6d6254aedfd0a62001beecf6bdeb83ceca1abb68b00c714c53f`. These matched the P1–P3 preservation record after the P4 attempt. The correction prompt's older uncommitted-evidence warning is stale on this checkout: the two P15 documents were committed in `7fa2707` and were left untouched.
- Read BOOT, AGENTS, workflow, ADR 0038, Phase 11/PB1–PB8, original P15 closeout/evidence, and the correction assessment, plan, README and P1–P3 results. No competing Dope backend was listening on port 3000. LM Studio was listening on loopback `127.0.0.1:1234`; P4 did not select, unload, or call a model. No hosted provider, canonical project, Git history, or network setting was changed.

## Native control attempt and missing observation

The Linux session reported `DISPLAY=:0`, `XDG_SESSION_TYPE=x11` and `XAUTHORITY=/home/jfin/.Xauthority`. The available computer controller's inventory returned `apps: []` and one Codex in-app browser with no tabs. Its own documentation described native window methods, but direct capability checks returned `undefined` for `getApp`, `listApps`, `listWindows`, and `computer`/`computer.launch_app`; calling `listWindows()` returned `cua.listWindows is not a function`. Thus this task had no supported independent native window selection, input, or screenshot channel. A desktop X11 session by itself does not supply a usable native controller here.

The Electron app was **not launched** into an uninspectable window. Consequently there is no native launch PID, attached workspace confirmation, native capture, before/after screenshot, or native action log. This is a **native control unavailable** finding, not a reproduced native-specific crash or layout defect. The old P15 `PluginDeployerContribution ... TypeError: i.split is not a function` startup log remains historical; this cycle did not reproduce or diagnose it.

## Build and gate results

| Check | Observed result |
| --- | --- |
| `npm run build:electron` on current P1–P3 candidate | **PASS**; extension compilation and Electron browser/node/electron bundles completed with 0 build errors. Current native frontend bundle `apps/electron/lib/frontend/bundle.js` SHA-256 `f5ad00a5eecf285f2c00d994ce23ef8262488c199a8f4dc1c1865dac5d28a52b`. Build is not native GUI evidence. |
| `git diff --check` before writing this record | **PASS**. |
| Native Prepare Work → actual Planning Map and selected requirements | **BLOCKED / NOT OBSERVED**: no native window or input/capture path. |
| Project A/B, restart, same saved Chat docking | **BLOCKED / NOT OBSERVED**. |
| Keyboard, narrow window, Dope Dark, alternate theme | **BLOCKED / NOT OBSERVED**. |
| Stale/foreign denial; mere navigation never Run/Adopt Target | **BLOCKED / NOT OBSERVED**. No native action was issued; this is not a negative security PASS. |
| Browser GUI, focused tests, `npm run check`, model inference and egress trace | **NOT RUN in P4**. P1–P3 retain their own source-bound evidence. P5 owns the stable final aggregate. |

No native blocker patch is justified without reproduction, so changed product/test paths in P4: **none**. No screenshots or runtime logs were generated in this cycle. A later manual retry needs a controller that can identify a Dope Electron window, send actual native input and export window screenshots/logs on a matching rebuilt source, followed by the specified Prepare Work, owner isolation, restart, Chat, keyboard, viewport and theme gates. Until then P4 cannot PASS, and P5 cannot claim complete native coverage or full Bridge Green by inheriting the browser or build result.
