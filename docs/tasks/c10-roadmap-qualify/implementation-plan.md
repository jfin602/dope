# /prompt-plan — c10-roadmap-qualify

**Status:** REPOSITORY/SOURCE REVIEWED / CORRECTION PLANNED / PROMPTS PENDING EXECUTION AUTHORIZATION
**Date:** 2026-10-13 (America/Chicago)
**Entry source:** `71d91efb3668e57816bb031f82ab309acea17cfc` product and `c620bc0a3be714b7dc329dc5c872a064b1f8003a` evidence commit; current GitHub main must be reconciled with actual local Git HEAD and all project files before mutation.
**Version:** unchanged `0.10.16`. **Evidence:** P19 671/671/tests+builds PASS, manual NOT GREEN, P16 NOT GREEN.

## Actual code seams

| Seam | Owner / focus |
| --- | --- |
| Model intent + local validation | `packages/theia-extension/src/node/roadmap-local-model.ts`, `chat-context-composer.ts`, `chat-backend.ts`; tests `roadmap-local-model.test.ts`, `roadmap-chat-actions.test.ts`, `roadmap-chat-context.test.ts` |
| Linked-field capability and approved mutation | `packages/project-intelligence/src/node/roadmap-document-patch.ts`, `project-planning-actions.ts`, `roadmap-store.ts`; tests `roadmap-document-patch.test.ts`, `project-planning-actions.test.ts` |
| Local budget/next-turn | `roadmap-local-model.ts` 4,096-total-token reserve, `chat-context-composer.ts` context packing and `chat-backend.ts` follow-up; tests `roadmap-local-model.test.ts`, `roadmap-chat-context.test.ts`, `roadmap-chat-actions.test.ts` |
| Relink/reconciliation | `roadmap-store.ts`, `roadmap-document-sync.ts`, linked-source Theia RPC/browser inspector and selection; tests `roadmap-sync-recovery.test.ts`, `roadmap-document-sync.test.ts`, `roadmap-create-sync-integration.test.ts` |
| Greenfield | `roadmap-greenfield.ts`, RoadmapService/frontend `roadmap-canvas-widget.ts`, existing Chat binding; tests `roadmap-greenfield.test.ts`, `roadmap-create-ui.test.ts`, `roadmap-chat-drafts.test.ts` |
| Saved Chat lease | `packages/theia-extension/src/browser/chat-panel-controller.ts`, `packages/chat/src/node/chat-repository.ts`, existing backend lifecycle; tests `roadmap-chat-panel.test.ts`, `chat-panel.test.ts`, `chat-repository.test.ts` |
| Spatial UX/navigation | `roadmap-canvas-widget.ts`, `roadmap-canvas-model.ts`, `roadmap-inspector-model.ts`, existing `@xyflow/react` and Theia OpenerService; tests `roadmap-spatial-canvas.test.ts`, `roadmap-viewport.test.ts`, `roadmap-prompt-open.test.ts` |
| Broader owner authority | `ProjectPlanningActions`, Planning Map, Work/agent and historical status import; tests `roadmap-integration.test.ts`, `roadmap-create-sync-integration.test.ts`, `roadmap-planning-links.test.ts`, `roadmap-status-truth.test.ts` |

**Inspection caveat:** These are source-grounded starting paths and existing suites, not guaranteed exhaustive call graphs. Each prompt inspects the actual local producer/consumer and tests; it may do no product edit when the behavior already passes. Never refer to nonexistent `packages/chat/src/chat-backend.ts`.

## Implementation schedule / done gates

| P | Narrow deliverable | Focused required evidence |
| --- | --- | --- |
| 1 | Derive per-selected-checkpoint allowed mapped actions from actual document patch capabilities; return strict compact intent/value, then Dope binds trusted IDs and `document-edit`, validates, previews and requires approval. Validate nested structure before retry. Unsupported longform prose explicitly ineligible. | Target `roadmap-local-model.test.ts`, `roadmap-chat-actions.test.ts`, `roadmap-document-patch.test.ts` and a focused new intent contract test. Include malformed, unsupported, cross-root/revision, cancel, no action/Green/agent escape negatives. |
| 2 | Bound requested context: selected node+field capability only, limits on neighbors/history, measured total budget incl instruction/output, no provider switch. Prove an approved edit refreshes NEXT Chat request with current revision/hash. | `roadmap-chat-context.test.ts`, `roadmap-local-model.test.ts`, `roadmap-chat-actions.test.ts`; targeted compact-context test. |
| 3 | Explicit relink `relink-needed` flow: choose in-root moved file, verify section IDs and fingerprint/provenance, preview diff and approve CAS, never silent new imported Roadmap. | `roadmap-sync-recovery.test.ts`, `roadmap-document-sync.test.ts`, `roadmap-create-sync-integration.test.ts` plus focused relink test/UI affordance. |
| 4 | Reproduce overlapping source edit and partial-write/crash scenarios in disposable project, prove deterministic conflict/needs-review and recovery; change code only if a real defect is observed. | `roadmap-sync-recovery.test.ts`, `roadmap-document-sync.test.ts`, `roadmap-store.test.ts` and fault injection/real-file regression. |
| 5 | Complete actual visible manual and existing-Chat greenfield: draft edits, preview, accept new source file, linked state after restart, draft cancel, project isolation. Repair UI only on reproduced failure. | `roadmap-greenfield.test.ts`, `roadmap-create-ui.test.ts`, `roadmap-chat-drafts.test.ts` focused. |
| 6 | Reproduce and classify Chat lease/restoration failure on backend restart; repair only if confirmed and keep one owner/lease. Streaming restore and four placements reserved for final live gate. | `roadmap-chat-panel.test.ts`, `chat-panel.test.ts`, `chat-repository.test.ts`, targeted restart race regression. |
| 7 | Reproduce and validate pointer/touch/pinch/Arrange/semantic zoom, keyboard prompt Open, light/dark and narrow/center split; only source-fix observed defects, not Phase 11 redesign. | `roadmap-spatial-canvas.test.ts`, `roadmap-viewport.test.ts`, `roadmap-prompt-open.test.ts`, source-focused accessibility test. |
| 8 | Integrate all owner boundaries incl linked-document preview and rollback, Chat intent, relink, greenfield, Watch/Work prompt and Planning Map basis; enforce no agent/Git/hosted fallback, historical gate truth. | `roadmap-create-sync-integration.test.ts`, `roadmap-integration.test.ts`, `project-planning-actions.test.ts`, `roadmap-planning-links.test.ts`, targeted adversarial test; no full aggregate. |
| 9 | Manual T3 final: native+browser, real local proposal-approved document/graph write/fresh NEXT turn, supported and unsupported Markdown behavior, generic import, greenfield, source conflict/relink/crash, chat across four docks, gestures, authority/egress, 1 exact-source aggregate. | New `docs/tasks/c10-roadmap-qualify/closeout.md` with exact committed SHA, per-gate truth/evidence; original P16/P19 closeouts immutable. |

## Mandatory pre-implementation instrumentation

**Operator must establish first**, before P1 source edits: native Electron window discoverable and input/screenshot-capturable (not just processes/build), browser interactive harness, keyboard and supported pointer/touch-equivalent gesture observations, independent child/renderer/backend/Electron network/process instrumentation covering a successful local Qwen turn. If this cannot be proven, record the block and do not promise Green; do not expand product code for a test-controller issue without a demonstrated Dope defect.

## Safety, scope and efficient validation

Explicitly keep Phase 10 Not Green and Phase 11/12 inactive. Source-backed fields are editable only with deterministic unique mapped lines (e.g. `Objective:`); historic Dope narrative sections are not automatically supported. A separate preview/approval is required for any structural conversion; it is not a loophole for silent insertion. Model output may supply an allowed intent/value, not authority IDs, hash, arbitrary paths or direct write privileges. Dope retains checked `ProjectPlanningActions` apply, same normal Chat, source-hash CAS, no hosted fallback, no automatic agent/work launch.

Ordinary P1–P7 use only affected tests and changed package outputs (project-intelligence before theia-extension if imported); P8 one T2 integrated pass; P9 manual/direct native, one complete `npm run check` on independently committed exact product candidate. The root check already includes typecheck, product tests, browser and Electron builds: no duplicate commands on unchanged final candidate. One test registration in `test:product` per new test. No local implementation, process commands, repository reset, manifest update, or test-run claim from authoring these files.
