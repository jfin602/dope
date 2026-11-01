# P3-B-R4 final Gate closeout — 2026-11-01

**P3-B-R4: NOT GREEN. P3-B overall: NOT GREEN.** This was a bounded manual run on the final committed product source. R1–R3 and H3 reports retain their original dispositions. Generic P2 reliability remains assigned to P3-C; P3-C was not started.

## Source and runtime

- HEAD `d968ff7803e5a38a93e07a011dfe8e46ce7d0dd1` on `main`; product/test tree clean at entry and after verification. Product version `0.12.7`. Product/test diff against HEAD was empty (SHA-256 of empty diff: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`). R3's `f73f19e...` dirty diff is historical and now committed in HEAD. Only this report was added; no code repair, commit, dependency, provider or model change.
- The Codex in-app browser had no surviving tab at entry, so a new tab in that same browser opened the existing disposable unlinked project `/tmp/dope-p3b-browser-20GAft`. The existing Dope process was older than final built source; final browser and Electron builds were run, then the Dope server was restarted on `127.0.0.1:3018` and the tab reloaded. Final browser bundle SHA-256: `042f2020030a9eaab137f9c35f82a6f2f1bfdb9b898ee93b72ad086b083eaf41`; backend bundle: `d030e8a4edea4fe80774b9b7f08b54404cd2f345a2ec0c4bfe5a2aaa6f457815`.
- LM Studio `qwen3.5-9b` was loaded at context 16,384, parallel 2, Local. The existing AI Center connection was refreshed and the model explicitly chosen for each live turn. Commands stayed Ask. Structured Output was not changed. No shell permission was granted.

## Final-source unselected exact-ID Apply

Before the turn, the fresh Chat and Roadmap canvas had no selected Phase/Gate; the selected-branch controls were disabled. The sent turn bound the current `/roadmap` skill, version 1. Its saved context reference was `Roadmap Phase: First Phase (phase-one)` after target expansion, so the context chip cannot be described as a bare project-only reference; there was no manually selected Gate workaround. The exact `gate-one` ID resolved and the model supplied the unchanged title `Readiness` and current purpose. The validated proposal contained one `gate.edit` action and one changed Gate.

| State | Canonical `.dope/roadmap.json` SHA-256 | Result |
| --- | --- | --- |
| Before request and through Chat/canvas preview | `3cc14d6859799502fddcc9f8302dbe6218c9c94b5a28934797701e0516da2a4d` | Revision 4; Chat and canvas both showed `Verify final Roadmap qualification behavior` → `Verify the final Roadmap skill qualification`. No canonical write. |
| After Chat Apply | `8d208c8f69fb35220a7eaf1e152466613b8f13aef08d4f860b01bf19ba3ece4e` | Revision 5. Only `gate-one.purpose` changed; its title, criterion, G2 and statuses remained unchanged. Preview cleared; both Gates stayed Unknown and the Phase showed 0/2 qualified. |

This was a real model-to-browser **PASS for exact-ID resolution, preview and Apply** on the final bundle. The auto-expanded Phase context label is recorded as a context-presentation caveat against the requested strict project-only context check.

## H3 action-family evidence

One additional real model turn proposed two actions in the same Chat: `criterion.add` for `Review trace` and `gate.edit` for `gate-one`. Chat and canvas both displayed two actions/two changed elements, the criterion's parent `Readiness`, order 1, expected result, and the Gate purpose before/after. The canvas marked both provisional. Canonical revision 5 and hash `8d208c8f...` remained unchanged. This proposal was intentionally not applied; the lifecycle switch below retired it.

| Family | Evidence on final source | Remaining limit |
| --- | --- | --- |
| Criterion add | **Live model/browser preview** plus deterministic owner mutation | Live preview passed; no live Apply in R4. |
| Criterion edit/remove | **Deterministic tests only**: `project-planning-actions`, `roadmap-gate-store`, and generic projection coverage for edit; store removal | No complete owner-to-Chat/canvas preview or Accept/Reject matrix for removal. |
| Gate deletion | **Deterministic tests only**: owner/store deletion and projection's explicit deleted entity | No live deletion visibility or full approval/reject replay. |
| Gate reparenting | **Source implementation only** in the 19-action owner; no direct final-source test or browser replay located | Parent/order projection and approval unqualified. |
| Phase/Gate reorder | **Deterministic store tests only** | Final order in Chat/canvas provisional preview unqualified. |
| Dependencies | **Deterministic store, owner batch, projection tests only** | Changed relation presentation and approval not exercised live. |
| Corrections | **Deterministic store/projection tests only** for attach/reparent/delete; no direct correction-edit replay located | Full provisional parent/identity/order and decision matrix unqualified. |
| 1–3 atomic actions | **Live two-action preview** and deterministic three-action owner batch/atomic rejection; envelope bound by source/tests to 1–3 | No three-action Chat/canvas live replay. Projection test confirms 12 displayed entities plus truthful `additionalChanges` count for overflow, but not a browser overflow rendering check. |

These evidence levels do not establish the requested complete before/after, order, decision and overflow assertions for **each** family. Mandatory H3 coverage remains open; it was not relabeled live based on source tests.

## Pending proposal, project and canvas

- With the two-action provisional overlay visible, Back to Chats removed it. Opening another saved Chat showed no foreign pending controls. Switching the same browser tab to the existing disposable linked project `/tmp/dope-p3b-r2-linked-lD8C2X` and reloading showed its distinct canonical Gate and no foreign ghost. Returning and reopening the original Chat showed `Stale · no change` and no Apply control for the old proposal. Unlinked JSON stayed at `8d208c8f...`; linked JSON stayed at `ae4ac15c090ce1a06072b634dff72e2b87216ef082264032db3c4f1b2f16a413`. This is a **live PASS** for this Chat/project/reload path, not every lease failure mode.
- Source-level negatives in the 141-test set cover lease ownership, lost writer, stale revision, foreign project/handle, approval token mismatch, rejected proposal reuse, current-turn skill gating and no-action follow-up. Replaced pending proposal and old skill snapshot are guarded in source, but were not each forced through a final-source browser case.
- The same center Roadmap tab remained open with docked Chat. `View in Roadmap` focused G1 under First Phase and showed the same provisional Gate/Criterion values. Zoom changed the React Flow scale to 1.2, Fit restored the view, and Shift+Right changed the viewport transform from `translate(49.5px, -352.5px) scale(1)` to `translate(9.5px, -352.5px) scale(1)`. Gate foldout and inspector opened. Tab focused its Criterion; Enter expanded it; Escape collapsed the Gate. No overlay ghost or false qualification color/status remained after the switch. No duplicate warning appeared in the observed view.
- The connected browser offered no viewport override, so narrow-editor usability was not directly replayed. Saved-camera persistence after preview and reduced-motion behavior have focused viewport/canvas tests, not an R4 live visual proof. This leaves the full H3-J accessibility/viewport gate open.

## Security and final-source verification

The final-source focused/adjacent suite passed **141/141**: Skills binding and collision, current-turn Roadmap mutation gate, unskilled no-write, exact/ambiguous ID handling, typed owner preview/approval, three-action atomicity, linked Markdown patch/source safety, Chat lease and project isolation, Pi/permission, projection, canvas and viewport tests. The R3 final-bundle ambiguous-target no-write and linked field Apply/stale-source browser results remain source-applicable because R4 changed no product/test bytes. R4 made no fresh linked Markdown model turn or forced forged-JSON browser turn. No automatic second agent, unauthorized tool call, canonical write before approval, or false Gate Green was observed in the R4 turns.

`npm run typecheck`, `npm run build:browser`, `npm run build:electron`, and `git diff --check` passed on the same product source. The Electron build is not native GUI qualification. No full repository test aggregate was run.

## Disposition

**P3-B-R4 and P3-B overall remain NOT GREEN.** The final-source unselected exact-ID Apply and one multi-action preview passed, as did the observed Chat/project/reload lifecycle. The remaining Roadmap blockers are complete owner-to-provisional coverage for criterion removal, Gate reparent/delete, reorder, dependencies and corrections with Accept/Reject and overflow; source/browser proof for replaced proposal, lost lease and old snapshot where not directly exercised; and the narrow editor, saved-camera and reduced-motion live matrix. The auto-expanded Phase context label also needs an explicit determination against the strict unselected-context requirement. No repair cycle was used because no narrowly reproduced product defect justified one. Generic P2 Chat/Pi reliability remains P3-C scope; it does not absorb these Roadmap gates. P3-C was not run.
