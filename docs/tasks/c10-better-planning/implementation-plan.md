# /prompt-plan — c10-better-planning

**State:** documentation only, version `0.10.16` unchanged. Reconcile local checkout HEAD/worktree before execution.

## Actual producer/consumer / authority boundary
- `packages/theia-extension/src/node/chat-context-composer.ts` composes project-grounded strict local planning instructions; `roadmap-local-model.ts` buffers and validates one JSON envelope with bounded bytes/retries.
- `chat-backend.ts` binds trusted project/checkpoint/revision/source identities, creates pending proposals and separately applies only after `decidePlanningProposal` approval. `packages/chat` stores saved assistant raw content/execution provenance.
- `browser/chat-panel-controller.ts` receives stream events and approval/proposal status; `browser/chat-panel-widget.ts` renders assistant Markdown and review controls. `untrusted-message-markdown.ts` already has safe Markdown boundaries. `dope.css` holds the current semantic theme. AgentRun collapsed diagnostics are visual precedent, not model authority.
- Persistence should favor backward-compatible projections from existing data; only extend saved metadata when essential for correctness after restart. No duplicate Chat or source writer.

## Implementation and checks
**P1 T2:** classify already strictly validated complete local envelopes and trusted outcome state; don't parse arbitrary `type` strings, broaden JSON grammar or accept model-declared “applied.” Preserve saved raw content/model provenance. Test `test/unit/roadmap-local-model.test.ts`, `roadmap-chat-actions.test.ts`, `chat-backend.test.ts` only if changed.

**P2 T1:** one-line ellipsized gray machine activity with meaningful short label/status, accessible native expandable details, safe literal payload and Copy. Unknown JSON/prose stays visible; no warning hiding. Test `test/unit/chat-presentation.test.ts`, directly affected `chat-panel.test.ts` and minimal CSS tests. Current ADR 0016/0030/0037, semantic tokens, narrow docks, light/dark, keyboard, scroll-follow.

**P3 T2:** append/project a state-aware final paragraph and up to two contextual questions for completed local planning turns, not duplicate a model response; pending = not applied, applied only after confirmed write, stale/cancel/denial/error/no-action remain honest. Low-noise actual transition progress and no additional provider call; don't surface unvalidated partial JSON. Test `chat-backend.test.ts`, `roadmap-chat-actions.test.ts`, `roadmap-chat-panel.test.ts` where affected.

**P4 T2:** focused cross-seam regression: tool-only, no-action, malformed/unknown/mixed ordinary chat, approval/denial/stale, linked bytes/revision, next-turn freshness, cancel/lease/restart and same saved Chat in other docks, model locality and zero extra inference. Source tests `chat-repository.test.ts`, `chat-panel.test.ts`, `roadmap-chat-actions.test.ts` and `roadmap-chat-context.test.ts` as needed. Tiny fixes only on reproduced regressions.

**P5 T3/manual:** on true local Qwen, test end-to-end JSON-only and no-action, pending/approve/reject, verified disk revision, concise accurate questions/progress, disclosure/copy, saved Chat/restart and narrow UI; actual browser and native Electron when controllable. Record source SHA, screenshots, model timing/request count, per-gate PASS/FAIL/BLOCKED/NOT RUN in `docs/tasks/c10-better-planning/closeout.md`. Native unavailability is an evidence gap, never a mocked Green.

For every P1–P4 inspect whether tests import `lib/`; rebuild only changed package outputs as necessary, avoid stale compiled tests and duplicate full builds. Use `git diff --check`. Target <=8 minutes, 10-minute soft and 15-minute hard. P5 manual may take longer. P5 is the **sole correction closeout**, not Phase 10 qualification.

## Exit
First finish outstanding `c10-horizontal-color` work/visual P11, then this P1–P5. Only after both are scope-closed run an entirely **fresh** manual `c10-roadmap-qualify/manual/P9`–`P13` matrix then P14 exact-source full aggregate. No P9-only shortcut, version bump, no `/activate`, no owner close/Phase 11.
