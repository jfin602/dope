# c14 Work redesign P2-R1 manual recovery — PASS for scoped panel bridge

Date: 2026-11-24 America/Chicago (2026-11-25 UTC). Starting source HEAD: `6052c54bc245744e65274e6242e3051da3014448`, the P1 checkpoint and direct parent of the intended P2 checkpoint. Product version: `0.13.11`, unchanged. The two runner P2 attempts under `.codex-runs/c14-work-redesign/2026-11-25T03-21-09-167Z/` and `2026-11-25T03-47-31-444Z/` remain `PARTIAL` historical receipts. Their uncommitted implementation was reviewed and repaired here; no runner, P3, P4, or product Work run was invoked.

## Reviewed source and result

The changed product files are `packages/contracts/src/agent-runtime-service.ts`, `packages/theia-extension/src/browser/agent-run-controller.ts`, `agent-transcript-widget.ts` (retired), `chat-panel-widget.ts`, `dope.css`, `frontend-module.ts`, `work-selection-controller.ts`, `work-transcript-presentation.ts`, the new `work-conversation-presentation.ts`, and `packages/theia-extension/src/node/agent-runtime-backend.ts`. Changed tests are `agent-run-ui.test.ts`, `dope-theme.test.ts`, `message-code-copy.test.ts`, `phase-stack-ui.test.ts`, `work-presentation.test.ts`, `work-restore-recovery.test.ts`, `work-selection.test.ts`, `work-transcript-presentation.test.ts`, and the new `work-conversation-presentation.test.ts`. The P2-R1 scope amendment, manual recovery prompt, README, implementation plan, Work UI contract, workflow routing and this report are the only documentation additions or updates. The authored P1–P4 prompt bytes, earlier qualification reports and `.codex-runs` were not changed.

Local Pi New Work starts through `startWorkSession` from the existing setup, selected target and reviewed grant. A saved local Pi WorkItem now uses that same API with its persisted task ID, origin/scope/validation checks and its own grant. Hosted New Work and WorkItem retain the one-shot `start` API, selected hosted model, project-data consent, candidate review and history. Setup and reopened hosted runs say that queued messages, Finish and a persistent conversation are unavailable. A one-shot WorkItem can still Stop its active run.

The same dockable Work panel reads the saved Work session by run ID, including linked run segments, paged transcript and typed events. It shows saved message IDs and Queued, Delivering, Delivered and recovery-required states; a lost response keeps the exact retry ID and text for that session. Selecting another run clears its draft and controls without losing the first session's retry identity. The panel shows locked model, tool, sandbox and grant facts from saved state. Tool and command updates are presented in timestamp order. Untrusted model text uses the existing sanitized Markdown renderer; saved events, tool metadata, command output and user text use text boundaries. Missing historical transcript evidence is labeled unavailable. Candidate decisions, MCP approval, source evidence and Roadmap grants continue through their existing owners.

The old center-only transcript widget was retired after the dockable panel gained its saved transcript, event, history and navigation behavior. Source and focused checks cover left/right/center/bottom commands, narrow CSS, keyboard focus/caret preservation, scroll restoration and light/dark theme tokens. A Chromium renderer check confirmed event order and that hostile content creates no image, script or event-handler nodes. This is P2 source and component evidence; independent connected Dope browser interaction remains P4.

## Verification on reviewed source

- `npm run typecheck` — PASS after the P2 changes.
- `corepack yarn workspace @dope/theia-extension build` — PASS; compiled modules used by focused tests.
- `corepack yarn workspace @dope/browser build` and `corepack yarn workspace @dope/electron build` — PASS, zero build errors.
- Nine focused UI/presentation suites including `work-selection`, `agent-run-ui`, `work-conversation-presentation`, theme, restore, phase-stack and browser code-copy — 64/64 PASS after refreshing compiled extension output. The first 62/64 attempt used stale compiled output after adding a retry getter; the rebuilt rerun passed 64/64. The Chromium code-copy and hostile-content renderer checks both launched and passed in this environment.
- `node --test --test-reporter=dot` across `work-session-runtime`, `pi-work-conversation`, `pi-work-execution`, `pi-work-history`, `work-integration`, `work-mcp-authorization`, `work-task-contract`, `work-start-worktree`, `work-recovery`, `work-tool-selection`, and `agent-store` — PASS. This includes the real supervised Pi/Work adapter and candidate/grant protection checks.
- `npm run check:pi-runtime` — PASS, Pi 1.4.0 integrity lock.
- `npm run codex:phase:validate -- c14-work-redesign` — PASS; P1–P3 implementation prompts and manual P4 route, unchanged `0.13.11`.
- `git diff --check` — PASS.

## Limits and verdict

P3 still owns broader restart, linked follow-up/fork, legacy compatibility and Roadmap integration qualification. P2 labels recovery as requiring a separate verified continuation; it offers no unsafe automatic replay. Interrupt/Pause/Resume stays deferred by the P1-R2 amendment. P4 remains the independent connected-browser closeout for a real Dope run and docking interaction, with native-only gaps recorded there. Neither this P2 checkpoint nor these component/browser-renderer tests award product Gate GREEN.

**P2-R1 verdict: PASS for the owner-approved local Pi conversational panel and hosted one-shot boundary on the reviewed P1 source.** The exact P2 checkpoint may be created with one `PHASE_VERDICT: PASS` body line. Once that commit is verified as a child of P1, the owner may deliberately run the unchanged phase runner to start P3; this report does not run it.
