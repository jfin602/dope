# Work backend reconnect recovery — 2026-10-24

**Verdict: GREEN for the bounded browser Work reconnect correction.** This does not qualify the full Work Experience correction or Phase 11. The original P4 closeout remains unchanged and NOT GREEN.

## Starting point and cause

- Baseline was `main` at `503dae3773ab768719c0a2e1d3e4fef5e7c41cde`, product version `0.11.8`, three commits ahead of `origin/main`. The only pre-existing dirty item was the untracked P4 `closeout.md`; it was preserved.
- P4 observed a Work owner left at `Loading Work…` during a real backend attach/read disruption. It did not prove the backend's `LoggerMain` plugin-host failure was caused by Work.
- The Work widget subscribed to workspace changes, but not backend connection changes. Its `Retry` appeared only after the controller explicitly reached `unavailable`; a socket outage could leave the owner on an old handle or a pending widget attachment. Its workspace-root wait also had no deadline. The controller could treat a returned project handle as attached after sequence-evidence or Work-history reads failed. These are source-verified ways to miss or misreport recovery.
- In the first direct replay, the original browser tab displayed Theia `Offline` after the backend stopped and remained offline even once HTTP service returned. A same-origin availability check followed by a reload of that *same browser tab* re-negotiated the backend channel; Theia's saved widget state restored the exact Work owner. This was a real backend stop/restart, not a reload-only test.

## Correction and repair cycles

1. **Cycle 1:** subscribed the Work widget to Theia's connection status; reattached through the existing Work controller on an online event, preserved the saved owner selection, made offline state and `Retry connection` visible, bounded workspace-root and saved-detail waits, and required real sequence evidence and Work-history reads before reporting attachment. Focused tests exposed one fixture that lacked sequence evidence; the fixture was corrected. A live restart restored a saved four-step Prompt Stack in the original tab. Theia's socket could remain Offline after the restarted HTTP backend was available, so online events alone were insufficient.
2. **Cycle 2:** added a same-origin `HEAD /` probe while offline. When the backend answers but the old socket remains offline, the original browser tab reloads to negotiate the new channel and restores its saved Work owner; automatic reloads are spaced to avoid a loop, while manual Retry can probe immediately. Added a widget attachment deadline and a fresh, single-flight Retry so a pending controller path cannot leave an immortal loading label. A later apparent stalled replay was traced to the test backend process itself exiting; a stable detached test backend and an additional real restart restored the saved run detail and recorded transcript. No third repair cycle was used.

Recovery only calls attach, list and read paths. It does not start or resume Work, accept grants or dirty changes, decide candidates, verify checkpoints, or change provider settings. The displayed completed run retained `Required validation: unknown` and `Owner qualification: not recorded` remained distinct on the Prompt Stack.

## Tests and direct browser observations

- Focused Work/controller/History tests: **28/28 PASS** after the final source edits. Added regressions for failed evidence/history attachment, stalled transcript and late response, and overlapping attachments retaining one owner. Existing project-switch and History navigation coverage passed.
- Final `npm run check`: **PASS**, with typecheck, **799/799 tests** (105 + 13 + 1 + 651 + 28 + 1), browser build and Electron build. The standard test script now includes the four focused Work restoration, selection, navigation and integration files. Electron build is not native GUI observation. `git diff --check` passed.
- Disposable project: `/tmp/dope-work-reconnect-7sZPd8/project`, Git HEAD `ef15a3083c002cd8bef049b240ae6f267a389be9`; its untracked `.dope/` contains the saved Work fixtures. Prompt Stack sequence `b7c38283-408e-4eea-8b5d-f559d514a644` remained `P1 of 4`, with no runs or checkpoints from opening. A separate read-only test fixture record `reconnect-saved-run` was completed before GUI inspection, with transcript text `Saved transcript survives backend restart.` No agent execution was invoked by this qualification.
- In the same Codex in-app browser tab at `http://127.0.0.1:3137/`, stopping the real backend changed the Work owner from ready to `Work is temporarily disconnected` with `Retry connection` and `Back to Select Work`. Starting a new backend restored the same tab and saved Prompt Stack; a later restart restored the saved completed run and its separate transcript. The browser tab was not reopened through History. One short-lived test backend exited during the replay; that observation is excluded from the product recovery claim.
- After the final build, the same browser tab again recovered the saved run and exact transcript from a restarted backend. Back to Select Work → the saved Prompt Stack history row reopened the original owner at `P1 of 4`; because `.dope/` was untracked in this disposable fixture, Work truthfully displayed `Project changed—review` and disabled Resume. No dirty acceptance or run followed.
- To exercise a real failed attach without changing owner data, the disposable fixture's `tasks` directory was temporarily replaced by a file. The Work panel displayed `Phase Stack could not attach to this project.` and `Retry connection`; the transcript view separately reported an unsafe agent directory. After restoring the exact directory, clicking `Retry connection` changed the original Work panel to loading and then restored `Saved transcript recovery fixture` with `Required validation: unknown`. The transcript view's own Retry restored the same recorded text.

## R1–R10 qualification

| Gate | Result | Evidence and boundary |
| --- | --- | --- |
| R1 Backend disconnect while Work open | **PASS** | Real browser backend stop showed offline state and recovery controls in the existing Work owner. |
| R2 Reconnect restores same Work tab | **PASS** | Real backend restart, same browser tab and Work widget ID; saved Stack and run detail returned. A same-tab reload was used when Theia's socket remained Offline. |
| R3 Saved Prompt Stack identity/progress | **PASS** | Sequence `b7c38283-408e-4eea-8b5d-f559d514a644`, `P1 of 4`, zero checkpoints and validation unknown persisted. |
| R4 Saved AgentRun/transcript | **PASS** | `reconnect-saved-run` completed detail and exact recorded transcript were visible after restart. This was a seeded read-only fixture, not a newly executed Coding Agent run. |
| R5 Failed attach shows usable Retry | **PASS** | Real backend read of deliberately malformed disposable agent directory produced an actionable Work error and enabled Retry. |
| R6 Retry starts fresh attach | **PASS** | After restoring the directory, clicking Retry changed the original Work panel to loading then restored the saved run detail. |
| R7 Concurrent retry/owner safety | **PASS, regression scope** | A delayed first attachment and overlapping second attachment kept the latest handle and one reserved saved owner; the UI disables Retry while its single-flight attempt is active. Rapid double-click was not separately recorded in browser. |
| R8 Project switch/stale response | **PASS, regression scope** | Existing delayed transcript/project-switch and delayed Prompt Stack scan tests passed; the live browser did not switch projects mid-reconnect. |
| R9 No automatic authority action | **PASS** | Browser restoration showed unchanged run/validation/checkpoint status; test fixtures tracked zero start/grant/dirty/candidate effects. No live denial campaign was run. |
| R10 Ordinary Work/History navigation | **PASS** | Browser opened a discovered stack and saved run from Select Work/History; the same owner and transcript returned after restart. Existing navigation tests passed. |

## Exact source and remaining limits

- Product Git HEAD remains `503dae3773ab768719c0a2e1d3e4fef5e7c41cde`, version `0.11.8`; the correction is **uncommitted**. The SHA-256 of the seven tracked product/test/script-file binary diff is `b08be2c55963e1723c9ca512d90bb0a7c14a56f8d27939d59108065171a2c78d`. The untracked original P4 closeout is outside that digest. No source reset, stash, clean, self-commit, role/provider change, version bump or Phase 12 activation occurred.
- The fallback may reload the same browser tab when Theia's socket cannot reconnect although same-origin HTTP has returned. It restores saved Work state; unsaved form edits are not part of this qualification. Native Electron GUI was not observed. The passing Electron build is a build result only. This correction does not establish local Coding Agent execution, required validation, candidate promotion, broad Phase 11 usability, or full Work Experience Green.

## Final check

`npm run check` exited 0 on the final tracked product/test diff above. The final browser and Electron builds both finished with zero build errors. Native Electron GUI, local Coding Agent execution, required validation, and broad Phase 11 qualification remain outside this reconnect result.
