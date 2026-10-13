# /prompt-ass — c10-horizontal-color (revised full-canvas scope)

**Date:** 2026-10-13. **Status:** owner-approved documents/prompts only; unchanged `0.10.16`; Phase 10 NOT GREEN.
**Baseline:** `c10-roadmap-qualify` P1–P8 published; manual P9–P14 not qualified; last docs commit `628053adb1881a7277d333305cd6ee8ef466673c`. No published `c10-horizontal-color` implementation checkpoint; local private runner history must be checked before renumbering its former P3 closeout.

## Grounded code seams and UX problem

The user-supplied GUI screenshot shows the Roadmap React Flow canvas squeezed between a tall, button-heavy heading, permanently visible linked-Markdown status box and a large always-visible Ideas/Issues panel. This yields a dashboard-like center strip rather than a primary editor visualization.

- `roadmap-canvas-widget.ts` appends `toolbar, status, importEntry, path, pools` as five vertical siblings. Its `renderImportEntry` owns linked source, import, greenfield, conflict/relink and recovery affordances; `renderPools` owns detached Idea/Issue associations. These services must survive **reparenting**, not being rewritten.
- `roadmap-canvas-model.ts` defines the vertical `roadmapSpatialLayout`, disclosure and branch keyboard order. `roadmap-viewport.ts` stores v1 positions/selection/Arrange requiring safe orientation migration.
- `roadmap-projection.ts` owns presentation-safe status/edge projection, with six statuses and evidence labels. Styles are currently neutral in `dope.css`.
- `physical-map-widget.ts` / `dope.css` already provide a full-stage canvas, absolute-positioned map inspection, expanded/compact/minimized states and status overlay. Reuse **interaction conventions and styles**, not the Physical Map controller or separate React Flow instance.
- `roadmap-inspector-widget.ts` currently owns the editable left-sidebar presentation bound to `RoadmapInspectorModel`. Editing uses `ProjectPlanningActions` preview, approval, undo; share that model/view behavior with the overlay, do not clone the mutation logic. `frontend-module.ts` binds both Roadmap widget and inspector view; preserve a coherent command route and avoid duplicate widget controllers.
- Existing tests `roadmap-spatial-canvas.test.ts`, `roadmap-viewport.test.ts`, `roadmap-canvas.test.ts`, `roadmap-create-ui.test.ts`, `roadmap-inspector.test.ts`, `roadmap-chat-panel.test.ts` and document-sync/relink/recovery tests protect the dependent workflows.

## Six-prompt split and effort

1. **P1 — layout (High/T2).** Monotonic horizontal phase path, dense above/below branches and v1 saved placement safety. Existing tests primarily spatial/viewport/keyboard.
2. **P2 — status grammar (Medium/T1).** Color from six canonical statuses + accessible labels. Existing canvas/status/theme tests.
3. **P3 — shell and Ideas/Issues (Medium/T1).** One full canvas editor stage, slim toolbar, floating owner-pool UI and status affordance. No linked-document editor refactor here. Tests focused on stage sizing/pool search/link/keyboard.
4. **P4 — linked-document overlay (High/T2).** Existing `renderImportEntry` and greenfield/sync/recovery UI go into one context overlay; preserve every explicit approval/relink/conflict gate and no-write cancellation. Existing create/sync/recovery tests.
5. **P5 — inspector overlay (High/T2).** Adapt one existing `RoadmapInspectorWidget` view to show within canvas while reusing a single `RoadmapInspectorModel` instance. Maintain input focus/draft/approval/undo and old details command as compatible route, no auto sidebar on selection. Existing inspector/prompt-open/Chat isolation tests.
6. **P6 — implementation closeout (Medium/T2).** Focused cross-seam proof and handoff; not a fake browser/native closeout or second final Phase 10 decision. Manual P12/P13/P14 remain the live qualification owners.

## Mandatory Prompt Efficiency Gate

- Each regular task targets <=8 minutes including relevant tests/builds (10-minute soft, 15-minute hard); T2 source-security repairs may be explicitly justified if evidence requires. P3/P4/P5 are split to avoid one overloaded UI + sync + model task; no Phase 11 sweeping redesign.
- Run only changed package output compilation when source-consumer tests require it; `node --test` focused files for each seam, not `npm run check` in P1–P6. Manual P14 owns one final exact-source aggregate.
- Physical Map overlay is a **pattern**, not shared runtime ownership. Keep existing Chat/inspector/document APIs, deterministic graph and original status owner. No duplicate backend or ambient AI.
- UI design: ADR 0016 semantic dark-orange theme, neutral secondary controls, visible focus and status; ADR 0037 human goals, understandable next action, no loss of unsaved edits/preview on minimize, readable narrow-pane and keyboard interaction. Actual browser/native proof in manual P12.
- UI authority: A red sync conflict/approval badge must be visible regardless of overlay state; closing/minimizing cannot confirm, dismiss or silently apply source. Editor input and role=status/alert announcements must remain accessible and cannot trap focus improperly.
- New `P1..P6` contiguous correction grammar, identical unchanged version, exactly one closeout P6, one Sol recommendation and Browser-required flag per `.txt`, no `/activate`. Prior unpublished P3 closeout may be replaced **only if** local runner confirms no executed checkpoint.
- Preserve historical P16/P19 NOT GREEN, current P9–P14 matrix, independent full application egress and real native Electron requirements.

## Explicit non-goals

No automatic percent completion without trustworthy source, new canonical layouts/graph edges, new Roadmap data owner, animated unlock gates, new Chat panel, new saved modal/session store, reimplementation of ProjectPlanningActions or document source reconciliation, changing Work/AgentTask authority, standalone Roadmap details page, theme-system rewrite or false Green by UI styling.
