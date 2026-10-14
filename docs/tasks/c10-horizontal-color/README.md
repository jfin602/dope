# c10-horizontal-color — Canvas-first horizontal Roadmap and status colors

**Current status (2026-10-13): P1–P6 IMPLEMENTATION COMPLETED / committed on main through `ddbac418`; MANUAL PHASE 10 QUALIFICATION NOT GREEN / NOT YET EXECUTED.** P1–P5 product implementation is `f5b705691`; P6's implementation-only closeout and nearby focused test correction are committed at `ddbac418`. See [P6 closeout](closeout.md). This confirms source/checks, not real browser or native Electron qualification.
**Correction:** `c10-horizontal-color`, unchanged coherent project version `0.10.16`. After `c10-roadmap-qualify` P1–P8; before manual `c10-roadmap-qualify/manual/P9`–`P14` live qualification.
**Historical authoring baseline (now superseded by committed P1–P6):** `628053adb1881a7277d333305cd6ee8ef466673c`. No published `c10-horizontal-color/P1`–`P3` implementation commits were found. **A local unpushed P1/P2/P3 run cannot be ruled out.** Check local log, runner state, Git status and active tasks before using this revised stack. If any old P3 closeout/runner checkpoint exists locally, stop and reconcile the historical implementation state; never rename an already executed checkpoint just to satisfy numbering.

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

Historical implementation-run commands (P1–P6 are already completed; **do not rerun** as a prerequisite for manual qualification):

```sh
npm run codex:phase:validate -- c10-horizontal-color
npm run codex:phase -- c10-horizontal-color
```

No manual `/activate` gate. The runner owns commits; agents never self-commit. Tests/builds must be narrow to the seam. Manual P9/P10 linked/creation/approval overlay evidence, P12 direct browser+native layout/Chat/overlay checks, P13 authority/no-false-Green and P14 sole exact-source `npm run check` and final correction disposition remain mandatory. P1–P6 implementation is **not** Phase 10 qualification or owner-close. Do not reuse legacy vertical viewport coordinates in the new v2 horizontal layout; migration retains only compatible v1 selection/disclosure and preserves old storage bytes.

## Safety / out of scope

No version bump, dependency/lockfile changes, second Chat, model/provider changes, automatic prompt execution, agent/Work grants, duplicate roadmap editing controller, new document-sync service, implicit status Green, source write without review, invented graph edges, hidden conflict/approval or blanket Phase 11 UI work. Preserve historical P16/P19 NOT GREEN and current Phase 10 NOT OWNER-CLOSED, and existing manual matrix's five up-to-three-cycle families.

## Post-implementation live review — presentation corrections still required (2026-10-13)

The first Phase 10 manual import exposed four **Not Green presentation findings despite P1–P6 implementation completion**: (1) phases and corrections all appear on one horizontal line, (2) status color is confined to small labels instead of entire checkpoint cards, (3) initialization fits the entire 31-checkpoint map to an unreadably tiny scale, and (4) phase/correction/dependency connector lines are missing. The status strip also showed 9 unresolved references; inspect their actual classes (historical mismatches, missing dependency, external owner reference, etc.) before attributing any to missing parents.

**Import/attachment rule:** A valid explicit parent wins when consistent; otherwise recognize exact numeric `c<phase>[-slug]` corrections from both linked Markdown and task-folder conventions (`c10-*` → Phase 10, but not `c100-*`). A conflicting explicit parent or absent phase stays diagnostic/reviewable. Convention-based phase membership may drive the upper correction lane and connector, but MUST NOT produce a fabricated canonical dependency, failed prompt, status transition or automatic write. Other unlinked nodes stay in a discoverable unlinked area instead of a false mainline.

**Required connected map:** visible left→right **progression** connectors between displayed chronological phases, above-mainline membership connectors for corrections, lower supporting prompt/task connectors and distinct directed connectors for *actual* stored dependencies. Maintain a deliberate visual/style/accessibility distinction between presentation membership/progression and authoritative dependency; no nonexistent edges in RoadmapStore. Render useful connections at world/phase/checkpoint detail levels, without collisions or implying waived/Not Green means qualified.

**Status and camera:** each six-state card receives an entire subdued state-tinted background/border/accent plus accessible label/icon, while focus/selection remain obvious. First accepted import or fresh opening at no deliberate saved viewport centers the current actionable phase at readable zoom (neighbors visible), **not** automatic fit-all; user pan/zoom thereafter persists through refresh/restart/sync/overlays/project navigation. Explicit Fit and Focus remain separate.

**Motion:** restrained slow highlight on the evidenced active route and brief focus/expand transitions only; static clarity is mandatory, no distracting flashing or all-path activity, respect reduced-motion, keep dense canvases responsive.

**Execution routing:** These are amendments to manual P9 (relationships/import), P12 (visual/browser/native and motion), P13 (authority negatives) and P14 (final source decision). P1–P6 are historical completed prompts and their implementation closeout remains intact. Repair through the existing up-to-three-cycle manual families; do not rerun the completed correction runner, bump `0.10.16`, add a family or imply Phase 10 Green.
