# H2 — View in Roadmap + provisional canvas (2026-10-31)

## Scope and source

- Verdict: **NOT GREEN — linked-source approval, full stale-source/project-switch, and UI matrix remain evidence gaps.**
- HEAD: `06b6e051b74b1e1de5ae49c1cb5cefd763119096`; worktree was already dirty from H1 and P2-R3. H2 did not reset, stash, clean, commit, or change the product version (`0.12.7`).
- Browser: connected Codex in-app browser, existing disposable unlinked fixture `/tmp/dope-c12-p2-unlinked-vRy7wy`, Dope server on port 3018; local LM Studio `qwen3.5-9b` Q4_K_M, Structured Output off.
- Earlier H1 and P2-R3 **NOT GREEN** results remain unchanged.

## H2 implementation

The pending H1 Chat card now offers **View in Roadmap** for a current validated schema-2 proposal. The control checks the active Chat lease and proposal identity. The existing `dope.roadmap.open` command opens the existing center `RoadmapCanvasWidget`. The widget checks project, owner, accepted revision and linked source hash against a fresh Roadmap read before rendering. The canvas consumes the same typed `ChatPlanningProposal.preview` as Chat, rendering dashed proposed Phase, Gate and Criterion changes without a store or Markdown write. Existing Gate changes remain attached to canonical Gate rows; a new Gate appears under its parent Phase. Chat alone retains Accept/Reject authority. A decision, Chat/project switch or disposal clears the transient overlay; confirmed acceptance refreshes the canonical canvas. Preview camera movement is transient and does not call the saved-camera writer.

Touched H2 source: `packages/chat/src/service.ts`, `packages/theia-extension/src/node/chat-backend.ts`, `packages/theia-extension/src/browser/chat-panel-controller.ts`, `chat-panel-widget.ts`, `frontend-module.ts`, `roadmap-canvas-widget.ts`, and `dope.css`. H1 files in the same dirty worktree were preserved.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| A — unlinked create and inspect | PASS | Live local-model Gate G3 `Recovery check` with Criterion `State restored` appeared in the H1 Chat card; View in Roadmap reused the open center tab, selected First Phase, and showed the dashed `Proposed · Not applied` Gate under that Phase with the same expected result. Canonical file hash stayed unchanged during preview. |
| B — Chat reject and no write | PASS | Chat Reject removed the provisional Gate, retained G1/G2, recorded `Denied · no change` and `Planning proposal rejected`; Roadmap remained revision 4 and canonical hash stayed unchanged. |
| C — separate edit and Chat accept | PASS | Fresh local-model G1 edit proposed purpose `Verify launch, smoke, and recovery readiness`; View showed the before/after inside the existing G1 row while canonical revision/hash stayed 4/`27f7b24c…`. Chat Apply reported revision 5, removed provisional styling, and the canonical G1 row then showed the new purpose with qualification still `unknown`. Final file SHA-256 `b55c48c40439519f5cfdca4c2ca2ec2e85dc66c6d48072c727759bf0ad8cd083`; file data confirms revision 5 and only the intended purpose in G1. |
| D — linked source field | GAP | Not yet exercised. |
| E — stale and project/Chat switch | PARTIAL PASS / GAP | At revision 5, a fresh pending G1 edit was viewed on the canvas. Back to Chats removed the overlay immediately; reopening the saved Chat showed `Stale · no change` with no active controls. Reloading the separate linked project in the same browser tab showed its own revision-5 Roadmap with no foreign ghost; returning to the unlinked fixture left no ghost. An external revision/source change while a proposal is active was not exercised. |
| F — visual and interaction | PARTIAL / GAP | Existing center Roadmap and docked Chat stayed available. The Phase/Gate focus and unknown qualification remained visible. Reasoning was visually separate from the committed final answer during local turns. Narrow width, pan/zoom, saved-camera persistence and complete console-baseline comparison were not checked. Browser logs contained repeated Theia key-code errors during UI input; attribution to H2 was not established. |

Unlinked canonical `.dope/roadmap.json` SHA-256 before preview, during preview, after Reject, and during the separate edit preview: `27f7b24cb85e8d38715d0c090928269a1ee0d7868283a68bc3af5f3add827272`; after approved G1 edit: `b55c48c40439519f5cfdca4c2ca2ec2e85dc66c6d48072c727759bf0ad8cd083`. No `ROADMAP.md` in this fixture.

Source checks: 21 focused H1/Chat tests and 6 Roadmap Chat panel tests (including a new current-lease/proposal-control test) passed. `npm run build:browser` and `npm run build:electron` passed on final H2 product source. The first typecheck exposed a RoadmapIndex cast/field mismatch; corrected source compiled in both builds. H2 canvas create/delete/reparent/multi-action and linked source behaviors do not yet have dedicated automated coverage.

## Handoff

H2 blockers: the linked Markdown single-field preview and backend approval path were not exercised; stale source/revision mutation while the overlay is active and an in-app project switch were not exercised; Phase create, deletion, reparent/reorder, dependency and multi-action canvas presentation remain unqualified; narrow layout, pan/zoom, saved-camera behavior and console comparison remain incomplete. The typed H1 preview is bounded to 12 entities, so larger multi-action visual completeness is unproven.

H3 should revisit the full integrated matrix and remaining P2-R3/H1 evidence gaps. H2 does not automatically qualify either earlier result. No H3 or P3-A run was started. The Codex browser and Dope server remain open on the unlinked fixture with Roadmap and Chat available.
