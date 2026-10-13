# c10-horizontal-color — Canvas-first horizontal Roadmap and status colors

**Status (2026-10-13): DOCUMENTATION/ASSESSMENT/PLAN/PROMPTS UPDATED; PRODUCT CODE NOT IMPLEMENTED OR QUALIFIED.**
**Correction:** `c10-horizontal-color`, unchanged coherent project version `0.10.16`. After `c10-roadmap-qualify` P1–P8; before manual `c10-roadmap-qualify/manual/P9`–`P14` live qualification.
**GitHub baseline when amended:** `628053adb1881a7277d333305cd6ee8ef466673c`. No published `c10-horizontal-color/P1`–`P3` implementation commits were found. **A local unpushed P1/P2/P3 run cannot be ruled out.** Check local log, runner state, Git status and active tasks before using this revised stack. If any old P3 closeout/runner checkpoint exists locally, stop and reconcile the historical implementation state; never rename an already executed checkpoint just to satisfy numbering.

## Locked experience

The Roadmap is a **full-editor-tab navigable canvas**, not a tall dashboard. The tab fills the space available inside its existing Theia editor pane; Explorer, Work, sidebars and the independent saved ChatPanel may remain docked anywhere. One compact toolbar includes accessible icon-first navigation and an unobtrusive linked-document status/control. A status/error indicator cannot obscure the map during normal navigation, but an unresolved conflict/approval remains conspicuous and actionable.

The main phase progression runs **left to right**, with correction/qualification branches vertically **above** and supporting task/prompt branches **below**. Layout/Arrange, status color and animations (if later added) do not create semantic dependencies or mutate the Roadmap. Automatic status treatments preserve all six statuses: Green, Active, Not Green, Waived, Not implemented, Unknown; special owner-closed-for-sequencing remains Waived. Derived edge treatments never imply false Green.

**Contextual, in-canvas overlays, following Physical Map patterns:**
- **Details / Edit:** one inspector on the upper-right of the canvas with expanded, compact and minimized states, showing selected checkpoint/prompt information. Reuse existing `RoadmapInspectorModel`, source navigation, edits, preview, required approval and undo. Details button/command opens/focuses it rather than forcing the left sidebar; any retained legacy sidebar route must not create another authority or competing edit state.
- **Linked Markdown / Import / Create:** toolbar-linked overlay for source state, import preview/accept, create manually and via existing Chat draft, external-change review, conflict/relink and interrupted-sync recovery. Alerts, pending approvals and source integrity must remain visible even if minimized.
- **Ideas / Issues:** collapsible, optionally expandable work-pool overlay near lower-left. Search, linking/unlinking and Project Mind navigation stay available. No permanently occupying a full bottom strip.
- **State and responsiveness:** one expanded editing overlay at a time on a narrow pane, nonmodal map navigation when safe, accessible Escape/close/reopen, preserved focus, form drafts and pending previews, no accidental dismissal on refresh. Opening/closing overlays does **not** re-layout graph nodes or mutate `RoadmapIndex.revision`. Retain project isolation and saved viewport/Arrange behavior.

Use existing Physical Map `dope-map-stage` / `dope-map-inspection` behavior as design precedent rather than cloning its controller. Reuse existing Roadmap document, greenfield, owner-link, inspector and Chat services. Consume centralized dark/light semantic tokens with restrained orange.

## Expanded correction stack

| Prompt | Narrow responsibility | Tier | Model | Browser |
| --- | --- | --- | --- | --- |
| [P1](P1-horizontal-roadmap-layout.txt) | Left-to-right path, vertical branches, keyboard order and safe v1 viewport migration | T2 | GPT-6 Sol High | no |
| [P2](P2-qualification-color-grammar.txt) | Six-status color/edge grammar and noncolor cues | T1 | GPT-6 Sol Medium | no |
| [P3](P3-full-canvas-roadmap-shell.txt) | Full-editor stage, compact toolbar, floating Ideas/Issues pool | T1 | GPT-6 Sol Medium | no |
| [P4](P4-linked-document-overlays.txt) | Source/import/greenfield/conflict/relink/recovery overlay workflows | T2 | GPT-6 Sol High | no |
| [P5](P5-checkpoint-inspection-overlay.txt) | In-map inspector editor, shared model, preview/approval/undo and keyboard focus | T2 | GPT-6 Sol High | no |
| [P6](P6-presentation-implementation-closeout.txt) | Focused integration, implementation-only closeout and manual handoff | T2 | GPT-6 Sol Medium | no |

Exactly ONE final root closeout (`P6`) is required for correction runner grammar. Former **unexecuted** `P3-presentation-implementation-closeout.txt` is superseded/deleted in this authoring revision. No browser prompt in this runner; the existing manual P9–P14 matrix remains outside `codex:phase`.

## Commands and execution routing

After confirming local P1–P3 have **not** been checkpointed against the old grammar and safe/authorized working tree:

```sh
npm run codex:phase:validate -- c10-horizontal-color
npm run codex:phase -- c10-horizontal-color
```

No manual `/activate` gate. The runner owns commits; agents never self-commit. Tests/builds must be narrow to the seam. Manual P12 (browser+native UI), P13 (authority) and P14 (sole exact-source `npm run check` and final correction disposition) remain mandatory, with P9/P10 overlays re-exercised when invalidated. P1–P6 implementation is **not** Phase 10 qualification or owner-close.

## Safety / out of scope

No version bump, dependency/lockfile changes, second Chat, model/provider changes, automatic prompt execution, agent/Work grants, duplicate roadmap editing controller, new document-sync service, implicit status Green, source write without review, invented graph edges, hidden conflict/approval or blanket Phase 11 UI work. Preserve historical P16/P19 NOT GREEN and current Phase 10 NOT OWNER-CLOSED, and existing manual matrix's five up-to-three-cycle families.
