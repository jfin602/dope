# R4 cycle 2 — Saved transcript readability and safety (2026-10-21)

**Disposition: PARTIAL for the full transcript gate.** The existing saved AgentRun renderer already used the shared Chat safe-Markdown seam and a centered reading column. This cycle made machine command records easier to scan without changing durable transcript bytes or creating a second renderer/store. Browser automation operated the views; no agent run or provider request was started.

## Observed source and repair

- In the R3 fixture's saved accepted run `659646a0-3664-4352-aefb-d52d7b9c4ef2`, the real browser displayed prose, inline code, a Markdown list, safe links and ordered collapsed command traces. The command summaries were long shell invocations; opening a record was needed to read precise output. The saved `run.json` hash remained `6896b64ecf4efed2b2c1614ad419c1f631b5aae0b39ebe550d98b99589618f0e`.
- The existing `AgentTranscriptWidget` continues to call `renderUntrustedMessageMarkdown`, which escapes model HTML, omits image tokens before DOM insertion, sanitizes the output, and checks link targets. Command rows now use short first-command labels; the exact full command, cwd and saved stdout/stderr remain inside the expandable row. The first rebuilt browser replay showed compact labels, Markdown list content and preserved command order. A final label adjustment removes the shell-wrapper prefix for useful labels; it passed source-bound tests but the later in-app browser interaction timed out before that last visual replay could be completed.
- No transcript event, `transcript.jsonl`, Run, candidate or Chat owner was modified. Existing Jump-to-Latest and near-bottom follow logic remained in place. The final served browser bundle and local file matched at SHA-256 `c6c734f6de4715fd1b40519509ec0a9330e6317c5ec66b1551a96b3220bf9721`.

## Evidence limit

The available saved agent prose did **not** contain real Markdown tables, task lists or headings, so those formats were not directly qualified in a saved browser transcript. A complete narrow-pane keyboard/scroll/restart replay and a browser rendering check of the final wrapper-free command label also remain unobserved. The focused Markdown tests cover malicious HTML, unsafe links and remote image omission; they do not substitute for every live negative. The final-source browser was reachable for Work/History/Phase Focus before the last command-label edit, then the in-app browser control timed out during `Open Transcript` and became unavailable. No polished screenshot or full W5–W8 claim is manufactured.

The final affected browser extension/bundle build passed. The final-source Work, Chat and agent-run presentation subset passed **25/25**; `/tmp/c11-r4-tests-final3.log` SHA-256 `cf9ba6ef785c899e21a5a903ad44225b018616a763bf3d128c3c4e95ba6fe185`, build log `/tmp/c11-r4-build-final3.log` SHA-256 `37ac731b2ad5052b31273839baa2f8fd295d31f303070094587babd74fe7c985`. The broader final security suite is recorded in cycle 3.
