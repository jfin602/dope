# c14 Work redesign P4 — independent connected-browser closeout

Date: 2026-11-24 America/Chicago (2026-11-25 UTC). Product source: `5a067c1875ba4018e9c9c784d7237115b79d508d`, clean before P4. Version: `0.13.11`, unchanged. This report is uncommitted qualification evidence; no product source, manifest, pin or lockfile changed.

## Scope and environment

The owner explicitly authorized manual P4. I read `BOOT.md`, `AGENTS.md`, `docs/workflow.md`, the Work conversation contract, c14 plan, scope amendments, and P1–P3 evidence. The 2026-11-24 scope amendment removes Interrupt/Pause/Resume from P4; this closeout instead exercises Queued → Delivered, Finish, Stop, reviewed recovery and linked follow-up. The original prompts and prior PARTIAL/BLOCKED evidence remain unchanged.

The updated Theia browser app ran at `http://127.0.0.1:3001` (port 3000 was already occupied by an older Dope process). Testing used the connected Codex in-app browser, actual bundled Pi worker and LM Studio `openai/gpt-oss-20b` with observed 16,384-token context. AI Center's local tool loop probe passed before Work. Two disposable Git projects under `/tmp/dope-c14-p4-*` held only test text and ignored `.dope/` state. No hosted model was used.

## Browser actions and observations

| Case | Observed result |
| --- | --- |
| Setup → Start and sealed authority | The setup showed the exact local model, selected tools and grant disclosure. Start created a live, saved Work transcript in the same panel. Locked configuration showed model, selected tools, isolated candidate sandbox, grant revision and permission ceiling; network, secrets, outside-root, git-write, destructive and system permissions were denied. |
| Actual tool transcript and failure | The first local Pi attempt emitted invalid `list_files` arguments. The visible broker card reported invalid/unauthorized arguments and no effect; the run failed with preserved diagnostics. A reviewed **Fork as New Work** created a separate task and fresh grant, with source-run provenance. |
| Queued message and candidate | In the fork, `read_file README.md` and `edit_file result.txt` completed as visible tool cards. A message queued during the active turn was later marked Delivered with the same ID, followed by a read of `result.txt` and an exact reply. Finish ran the supplied validation, held the one-line `result.txt` diff for review, and did not apply it until **Accept candidate**. Acceptance applied one file in the disposable project. |
| Linked follow-up and denied effect | The accepted run offered **Continue this Work session** with the original model/tool/sandbox ceiling and a fresh grant. It required explicit review of the now-dirty `result.txt` source. The local model attempted an unrequested second `edit_file` create; the card reported `AUTHORITY_DENIED`, broker invoked, **effect executed: no**. The accepted prior candidate remained recorded. A separate private-path-shaped setup prompt was blocked before Start. |
| Outside-root escalation | A separate read-only Work run asked Pi to `read_file` from `../p4-parent-canary.txt`, a harmless file outside the project. The real browser showed **Authority denied** at request-parse, `Broker invoked: no`, `Effect executed: no`, and `INVALID_OR_UNAUTHORIZED_ARGUMENTS`. No content from the outside file appeared in the transcript. |
| Two-message order and restart | A clean read-only session queued two messages while Pi was active. The saved transcript showed `FIRST`, then `SECOND`, and the same two message IDs Delivered in order. After backend restart, the old run was marked interrupted and its history reopened; no automatic replay occurred. |
| Deliberate recovery and completed follow-up | Recovery required an explicit discard-uncertain-effects checkbox, fresh grant and exact-model check. Immediately after restart, AI Center marked the local model unverified; recovery refused with “Saved Work or exact local model changed.” Refresh Models plus Verify Coding Agent tools restored eligibility. A reviewed recovery then ran `read_file`, returned `cedar`, and Finish held a no-change candidate. Reject left the disposable project clean. |
| Never-delivered queue across crash | In a second live run, message `d12fb28c-a856-4fc0-8e6b-9c7ef7007766` was visibly **Queued** before a forced backend restart and remained **Queued** after reload. With model capability reverified, reviewed recovery started a linked run. Only after its turn settled did that same message become **Delivered** and produce one `QUEUE_SURVIVED` reply. The saved session contains one message record and two distinct run segments; the disposable Git tree remained clean. Finish held a no-change candidate, which was rejected. |
| Stop and reopening | A separate active read-only run stopped in about five seconds. The transcript retained “Agent run cancelling” and “Agent run stopped,” with a cancelled outcome and no changed files. Completed, failed, interrupted and stopped entries reopened from Work selection after reload. The accepted one-file diff and decision remained visible after restart. |
| Docking and narrow keyboard | Work opened in left, right, bottom and center via Theia commands; saved entries reopened in each. At 800×800 with one Work pane, transcript, composer, Queue, Finish and Stop were visible, and Tab moved focus from the composer to Queue message. With left/right/bottom/center panes all open together at 800 px, the right transcript became too narrow to read; this is a layout limit when several Work views are kept open simultaneously. |

## Screenshots

- [Live follow-up transcript](screenshots/p4-live-follow-up.jpg), [denied tool](screenshots/p4-authority-denied.jpg), [outside-root denial](screenshots/p4-parent-path-denied.jpg), [locked grant](screenshots/p4-locked-grant.jpg), [stopped run](screenshots/p4-stop-evidence.jpg).
- [Right reopened](screenshots/p4-right-reopen.jpg), [bottom dock](screenshots/p4-bottom-dock.jpg), [center reopened](screenshots/p4-center-reopen.jpg), [accepted diff after restart](screenshots/p4-accepted-diff-after-restart.jpg).
- [Queued after restart](screenshots/p4-queued-after-restart.jpg), [recovery review](screenshots/p4-restart-recovery-review.jpg), [delivered after recovery](screenshots/p4-queue-delivered-after-recovery.jpg).
- [Narrow single pane](screenshots/p4-narrow-single-work.jpg), [keyboard focus](screenshots/p4-narrow-keyboard-focus.jpg), [narrow simultaneous docks](screenshots/p4-narrow-multi-dock.jpg).

## Verification and limits

- `npm run codex:phase:validate -- c14-work-redesign` — PASS on the exact product source; P4 remains manual.
- Product HEAD and version rechecked after testing: `5a067c1875ba4018e9c9c784d7237115b79d508d` and `0.13.11`. Only this report and its screenshots are untracked in the product repository. No product fix was made, so no fix-specific test rerun applies.
- The second disposable project's Git working tree was clean after crash/recovery. The accepted file in the first disposable project retained its expected SHA-256 `7b89c3517405aec0abeb3ab8fce0f9ff7d80ce8cd9e5f0fe74b304d998f219ce` after the denied duplicate create.
- The model occasionally generated malformed tool arguments and once ignored a read-only instruction; Dope displayed those events and blocked the effects. This model behavior is not counted as a product PASS for instruction following.
- Browser proof does not establish native Electron GUI parity. Hosted Work's one-shot labeling, every permission category, screen-reader behavior and touch input were not independently exercised here. The 800 px simultaneous four-dock layout is cramped; one-pane narrow controls were usable. The first recovery rejection could describe the required AI Center re-verification more directly.

**P4 verdict: SCOPED PASS for the amended local Pi Work browser flow on this exact source.** The observed queue, restart, review, follow-up, Stop, docking and denial paths passed. The limits above remain explicit evidence gaps or usability follow-ups. This does not award product Roadmap Gate GREEN, Phase 14 completion, native Electron parity or a version advance. No self-commit or subsequent correction prompt was run.
