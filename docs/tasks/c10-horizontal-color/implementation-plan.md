# /prompt-plan — c10-horizontal-color (six-prompt prequalification redesign)

**Status:** approved documentation/prompt authoring; product NOT implemented by this revision; final manual qualification NOT GREEN. **Version:** `0.10.16` unchanged.
**Local preflight:** The published GitHub branch has no `c10-horizontal-color` task implementation commits at `628053adb1881a7277d333305cd6ee8ef466673c`. This does NOT guarantee no unpushed local checkpoint. If old P3 ran, STOP before renumbering and reconcile runner/Git history without discarding work.

## Locked product behavior

The entire **available Roadmap editor tab** becomes an interactive React Flow canvas, with a single compact, icon-first toolbar and no permanently occupying top status document card or bottom Ideas/Issues region. Do not force full IDE-window maximization or forcibly rearrange user Chat/other panels.

1. **Spatial:** phases advance left-to-right; correction/qualification descendants branch above, support/prompt/evidence below. Nodes avoid collisions; real graph edges and arrow directions remain truthful. Semantic zoom, Arrange-only positioning, Fit/Focus and v1 viewport recovery continue to work.
2. **Colors:** six canonical statuses rendered distinctly through theme semantic tokens, not mutated status. Not Green, Waived, Unknown etc never look completed. Edges inherit only evidence-supported progress. Accessible labels/noncolor cues always remain.
3. **Stage:** reuse Physical Map `dope-map-stage` full-stage and inspector `data-state` visual conventions. The Roadmap is still its own editor widget and renderer. Place the compact toolbar at top and transient aria-live/status control within the canvas stage, where normal messages do not take vertical space.
4. **Work pool overlay:** Ideas/Issues/unlinked tasks open through a compact bottom-left toggle, collapsed by default. Preserve search, links, Project Mind navigation and return focus; the map stays navigable.
5. **Document overlay:** linked Markdown status in toolbar (synced/source-changed/conflict/relink-needed/pending-sync etc), openable overlay for import, editing eligibility, diff, explicit Apply changes, conflict recovery/relink and manual/saved-Chat greenfield. No loss of preview, draft or pending sync on minimize or focus change. When a blocking state exists, show a visible warning with accessible alert; never auto-approve.
6. **Inspector overlay:** selected checkpoint/prompt inspector appears inside the stage, ideally upper-right, with expanded/compact/minimized. Reuse *one* `RoadmapInspectorModel`, existing inspector rendering/edit behavior and `ProjectPlanningActions` preview/approval/undo. Details/command opens/focuses overlay; avoid forcibly displaying the left sidebar. Keep source Open Prompt read-only; do not run.
7. **Overlay coordination:** one large editor/recovery surface at a time in narrow panes, with explicit buttons/labels, Escape/back, safe focus restoration, keyboard/touch support and responsive limits. No canvas reflow/re-fit, graph revision, selection/project leakage or discarded dirty editor merely from overlay state. Retain persistent alerts and explicit source approval.
8. **Chat independence:** existing saved ChatPanel stays user-dockable left/right/bottom/center, no second chat/controller/runtime or unrequested docking. Maintain map and Chat side-by-side in normal narrow panes.

## Order and focused validation

| Prompt | Primary implementation seam | Focused required checks |
| --- | --- | --- |
| P1 | `roadmap-canvas-model.ts`, `roadmap-viewport.ts`, relevant React Flow handles | `roadmap-spatial-canvas.test.ts`, `roadmap-viewport.test.ts`, targeted keyboard/prompt-open tests |
| P2 | Roadmap node/edge class/status and semantic CSS/theme | `roadmap-canvas.test.ts`, `roadmap-status-truth.test.ts`; `dope-theme.test.ts` if shared theme tokens touched |
| P3 | Roadmap widget stage/toolbar/`renderPools`, CSS | `roadmap-spatial-canvas.test.ts`, `roadmap-canvas.test.ts`, `roadmap-viewport.test.ts` only if affected, narrow work-pool test |
| P4 | Widget `renderImportEntry`, source/sync/greenfield overlay shell, CSS | `roadmap-create-ui.test.ts`, `roadmap-document-sync.test.ts`, `roadmap-sync-recovery.test.ts` when appropriate, closest relevant source UI tests |
| P5 | `roadmap-inspector-widget.ts`, `roadmap-inspector-model.ts`, widget/frontend command integration | `roadmap-inspector.test.ts`, `roadmap-prompt-open.test.ts`, `roadmap-chat-panel.test.ts` if Chat seam touched, closest source status test |
| P6 | Cross-seam implementation proof only; validate stack after code | Reuse P1–P5 passed evidence, run only invalidated relevant tests, phase validator, `git diff --check` |

Do not bundle P3 shell with P4 source mutation or P5 inspector edits; reuse existing UI elements and services where possible. Avoid creating reusable abstraction infrastructure beyond what these three specific overlays require. No full `npm run check` until manual P14 exact product SHA.

## Qualification handoff

After P6 implementation-only closeout, manual browser `c10-roadmap-qualify/manual/P9`–`P14` run outside the runner. P9 retests Codex/Markdown import/relink overlay, P10 tests manual/saved-Chat greenfield overlay and valid approvals, P12 captures full editor, three overlay states, selection/drafts/focus, dense graph, mouse/touch/keyboard and one existing Chat in four docks across browser AND native Electron, P13 proves UI closure cannot grant authority or silently apply source, P14 reconciles evidence on ONE exact committed source and runs the single full check. Reuse preceding evidence only when not invalidated. Preserve the 3-cycle cap per P9–P13 family, old P16/P19 Not Green, no Phase 10 owner-close or Phase 11/12 activation.

The completed P1–P6 stack is **not** itself Green and should never write the manual `c10-roadmap-qualify/closeout.md`.
