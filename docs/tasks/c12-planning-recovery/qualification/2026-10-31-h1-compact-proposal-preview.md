# H1 compact Roadmap proposal preview — manual result

**Date:** 2026-10-31 America/Chicago. **H1 NOT GREEN for the requested browser matrix.** Product version remains `0.12.7`. No runner, commit, H2 work, or native GUI claim.

## Source and scope

- Entry HEAD: `06b6e051b74b1e1de5ae49c1cb5cefd763119096`. Entry dirty state was the owner's modified `test/unit/roadmap-chat-context.test.ts` and untracked `2026-10-31-p2-r3-fast-final-recovery.md`; both were preserved.
- H1 changed `packages/chat/src/service.ts`, `packages/theia-extension/src/node/chat-backend.ts`, `roadmap-proposal-presentation.ts`, `chat-panel-widget.ts`, `chat-panel-presentation.ts`, `dope.css`, and focused tests `roadmap-gate-chat.test.ts`, `roadmap-proposal-presentation.test.ts`, `chat-presentation.test.ts`.
- The backend now projects bounded typed before/after Phase, Gate, Criterion, and Correction fields from validated `ProjectPlanningActions.preview()` snapshots. Linked source-owned changes project the current mapped entity and exact checked Markdown patch lines. The browser receives no planning approval token. Every action has a step summary; up to 12 changed entities are included, with an additional-change count. The existing decision API and backend owner/source checks remain in force.
- The Chat review lives inside the assistant response. Create, edit, delete, relationship, and multi-action presentations use the same typed projection; the full diagnostic diff and original machine response remain explicit disclosures. H2 navigation and canvas overlays were not added.

## Checks

- `npm run typecheck` passed. Focused `roadmap-proposal-presentation`, `roadmap-gate-chat`, and `chat-presentation` tests passed **21/21** after rebuilding the extension. `npm run build:browser`, `npm run build:electron`, and `git diff --check` passed. The final browser bundle was rebuilt after the last UI change. Electron build is not native UI qualification.
- Connected Codex in-app browser used the existing disposable unlinked fixture at `http://127.0.0.1:3018/#/tmp/dope-c12-p2-unlinked-vRy7wy`, local `qwen3.5-9b` Q4_K_M, and the same development server on port 3018. The server was restarted on that port after the builds and remains running.
- **Unlinked edit: PASS in observed scope.** A real model proposal changed Gate G1 `Readiness` purpose from `Verify demo readiness` to `Verify launch and smoke readiness`. The card showed the exact before/after and parent `First Phase`, with the diagnostic diff collapsed. Before Accept, Roadmap bytes remained SHA-256 `83db47ec3ccdec72cd8790dd7f5a2c0c42ffa65ff6c08d2d2ea11a8e1b90b407`. Existing Accept applied revision 4; canonical Gate purpose matched, and controls disappeared.
- **Unlinked create/reject: PASS after one model retry.** The first model output used owner revision 5 against actual revision 4; backend rejected it with no card or write. A second output used revision 4 and proposed Gate G3 `Recovery check`, purpose `Verify recovery after restart`, under `First Phase`, with Criterion `State restored` and expected result `The prior state appears after restart`. The card showed both entities and `2 changed elements`. Existing Reject removed controls and recorded `Denied · no change`. Canonical Roadmap SHA-256 stayed `27f7b24cb85e8d38715d0c090928269a1ee0d7868283a68bc3af5f3add827272` before and after rejection.
- The docked Chat and Roadmap were readable in the current dark theme. Reasoning and final response appeared separately on the retry. Original JSON and Copy Response disclosures remained available. No duplicate no-action card or new composer sizing change was observed. The browser console logged the previously observed Theia `Cannot get key code from the keyboard event` error during automation; this run did not attribute it to H1.

## Open qualification gates

- A live **linked Markdown field proposal** and preapproval source-byte check were not replayed on final H1 source. The checked patch projection passed a focused test, but that does not replace browser evidence.
- A live **read-only Roadmap Chat** no-proposal turn, narrow dock resize, keyboard-only card traversal, alternate theme, reload/historical inactive review, and full multi-action visual were not completed in this bounded session. Backend and focused tests cover parts of these paths; H1 browser qualification remains incomplete.
- P2-R3 remains NOT GREEN with its recorded gaps. H1 does not qualify C12 or native Electron.

The connected browser remains open on the reviewed unlinked Roadmap and Chat; the development server remains running. The typed projection is available for H2 to consume without adding a second approval route.
