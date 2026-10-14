# c10-better-planning P5 repair cycle 2 — 2026-10-14

## Candidate

- HEAD remains `9b1533ca47e87b219bf3443b7f580206b822c41b`; package version remains `0.10.16`.
- Uncommitted product files: `chat-panel-widget.ts`, `dope.css`, `chat-backend.ts` under `packages/theia-extension/src/`. Product diff SHA-256: `7373acb3d2d580767667bd19bb2d214bc34fab6c24976d68f59fc04fab1cf32a` (`git diff` over those three files).
- The cycle 1 visuals and clipboard behavior stayed valid; the only further product change was an opt-in, metadata-only `DOPE_CHAT_PLANNING_TRACE=1` backend trace at existing planning lifecycle boundaries. It does not add inference or change the response contract.

## Focused live replay

The browser reopened the same saved Chat; AI Center reported the local LM Studio connection ready with one usable model (292 ms connection test). An explicit Qwen turn proposed changing the selected milestone Objective in disposable `ROADMAP.md`. Before approval its SHA-256 remained `a6bc5957c7de2263806939580e2d47ad19d5817f640e0d779ff53deaf52a68ab`, matching the review's `beforeHash`. The UI said **Pending · no write** and showed the exact proposed line change. [Pending capture](evidence/browser-pending.png).

After Apply, the UI said **Applied**, revision 7; the linked file became SHA-256 `35c59b8bf4eb007395018364e067ba1f73ad9766c6af27d3f9552548a94e9962`, matching `afterHash`. [Applied capture](evidence/browser-applied.png). No additional model request accompanied approval or explanation.

| Event | UTC time | Elapsed from browser Send |
| --- | --- | ---: |
| Browser Send | 14:33:24.621 | 0 ms |
| Browser observed `Working` / `Waiting for local model…` | by 14:33:24.894 | ≤273 ms |
| Backend submitted / waiting | 14:33:24.729 | 108 ms |
| Strict JSON output validated / UI validation began | 14:33:29.694 | 5,073 ms |
| Backend pending proposal recorded | 14:33:29.716 | 5,095 ms |
| Browser pending review observed | by 14:33:30.225 | ≤5,604 ms |
| Browser Apply click | 14:33:49.364 | separate decision |
| Backend approval requested / applied recorded | 14:33:49.430 / 14:33:49.444 | 66 / 80 ms after click |
| Browser applied state observed | by 14:33:49.642 | ≤278 ms after click |

The LM Studio log independently contains **one** `POST /v1/chat/completions` in this turn's 09:33:24–09:33:49 local window, for `qwen3-coder-30b-a3b-instruct@q3_k_l`. It reports 3,203.47 ms prompt evaluation / 519 tokens, 1,716.64 ms generation / 28 tokens, 4,920.12 ms total / 547 tokens; no retry. The safe metadata excerpt is [progress trace](evidence/progress-trace.txt). The measured post-validation to pending-record interval was 22 ms. The logger's independent overhead was not isolated with an equivalent before/after model run; none is claimed. Repeated status spam and a commentary-only model request were not observed. The pending UI never claimed a write. Historical denied, stale, cancelled and failed-turn behavior remains preserved, with focused tests below.

## Final native replay

`npm run build:electron` rebuilt the complete final worktree. The functional no-plugin Electron launch then opened real `dope` window `0x05e00004`, PID 122255, and restored the same saved Chat with the newly Applied revision 7 turn. X11 `wmctrl`, XTest, and `xwd` independently discovered, controlled and captured the native window. The right Chat dock was narrowed to approximately 160–180 px of content; prose and the wrapped header remained readable. [Final narrow native prose](evidence/native-final-narrow-prose.png). On the final build, the activity was expanded by pointer, collapsed with Enter, then expanded again with Enter; [expanded native activity](evidence/native-final-expanded.png). Tab then Enter activated Copy JSON; OS CLIPBOARD readback was 127 UTF-8 bytes, SHA-256 `1d4b28c4f7745ab9c2b7544a89a514c29c9ec719a2934b87e0202f1b6e626266`, exactly matching saved assistant message 17 `roadmap-intent`. No native model turn was needed for this visual and keyboard replay.

## Checks actually run

- `node --test test/unit/chat-backend.test.ts test/unit/roadmap-chat-actions.test.ts` — 14/14 PASS.
- `npm run build:browser` after trace change — PASS.
- `npm run build:electron` after trace change — PASS.
- `git diff --check` — PASS.
- `npm run check` — NOT RUN, per P5 tier.

| P5 gate | Cycle 2 evidence status | Limit |
| --- | --- | --- |
| A narrow Chat | PASS for browser dark/light and final native right dock | Left, bottom and center placement checks remain NOT RUN. |
| B provider accounting | PASS | Exactly one direct local Qwen inference request, zero retries/extra commentary requests. |
| C intermediate progress | PASS for observed turn and approval | Diagnostic logger overhead was not separately benchmarked. |
| D clipboard integrity | PASS | Browser three forms and final native keyboard copy match saved raw bytes. |
| E native Electron | PASS | Final build, saved Chat restore, narrow layout, activity and keyboard observed. |

The original P5 result and all unrelated Phase 10 qualifications are unchanged. This cycle created no commit.
