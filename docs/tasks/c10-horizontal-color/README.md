# c10-horizontal-color — Canvas-first horizontal Roadmap and status colors

**Current status (2026-10-13): Historical P1–P5 implementation committed through `f5b705691`; old P6 implementation-only closeout recorded at `ddbac418` and preserved verbatim under `history/`. NEW P6–P10 visual repair IMPLEMENTED/COMMITTED through `726f10b4c9`; P11 live visual closeout NOT GREEN / PENDING source-bound evidence (new zoom-disclosure defect observed). Manual Phase 10 P9 completed three cycles and is NOT GREEN (`c4-color-theme` source-status conflict); P10–P14 and full Phase 10 qualification remain OPEN.** Same unchanged project version `0.10.16`.
**Correction:** `c10-horizontal-color`, unchanged coherent project version `0.10.16`. The original implementation followed `c10-roadmap-qualify` P1–P8; this continuation is authored after already executed manual P9 and must complete before the explicitly requested fresh P9 requalification and subsequent P12 live UI evidence.
**Historical authoring baseline:** `628053adb1881a7277d333305cd6ee8ef466673c` predates the now-committed P1–P5 implementation and original P6 handoff. Those historical checks are preserved; current execution must instead verify that the local runner recognizes P1–P5 and finds no conflicting P6 implementation marker before resuming at the new P6.

## Locked experience

The Roadmap is a **full-editor-tab navigable canvas**, not a tall dashboard. The tab fills the space available inside its existing Theia editor pane; Explorer, Work, sidebars and the independent saved ChatPanel may remain docked anywhere. One compact toolbar includes accessible icon-first navigation and an unobtrusive linked-document status/control. A status/error indicator cannot obscure the map during normal navigation, but an unresolved conflict/approval remains conspicuous and actionable.

The main phase progression runs **left to right**, with correction/qualification branches vertically **above** and supporting task/prompt branches **below**. Layout/Arrange, status color and animations (if later added) do not create semantic dependencies or mutate the Roadmap. Automatic status treatments preserve all six statuses: Green, Active, Not Green, Waived, Not implemented, Unknown; special owner-closed-for-sequencing remains Waived. Derived edge treatments never imply false Green.

**Contextual, in-canvas overlays, following Physical Map patterns:**
- **Details / Edit:** one inspector on the upper-right of the canvas with expanded, compact and minimized states, showing selected checkpoint/prompt information. Reuse existing `RoadmapInspectorModel`, source navigation, edits, preview, required approval and undo. Details button/command opens/focuses it rather than forcing the left sidebar; any retained legacy sidebar route must not create another authority or competing edit state.
- **Linked Markdown / Import / Create:** toolbar-linked overlay for source state, import preview/accept, create manually and via existing Chat draft, external-change review, conflict/relink and interrupted-sync recovery. Alerts, pending approvals and source integrity must remain visible even if minimized.
- **Ideas / Issues:** collapsible, optionally expandable work-pool overlay near lower-left. Search, linking/unlinking and Project Mind navigation stay available. No permanently occupying a full bottom strip.
- **State and responsiveness:** one expanded editing overlay at a time on a narrow pane, nonmodal map navigation when safe, accessible Escape/close/reopen, preserved focus, form drafts and pending previews, no accidental dismissal on refresh. Opening/closing overlays does **not** re-layout graph nodes or mutate `RoadmapIndex.revision`. Retain project isolation and saved viewport/Arrange behavior.

Use existing Physical Map `dope-map-stage` / `dope-map-inspection` behavior as design precedent rather than cloning its controller. Reuse existing Roadmap document, greenfield, owner-link, inspector and Chat services. Consume centralized dark/light semantic tokens with restrained orange.

## Correction stack — preserved P1–P5; implementation continuation P6–P11

The initial P1–P5 product implementation is historically committed. The former P6 manual implementation-only handoff was completed separately at `ddbac418` and is archived byte-for-byte as [original prompt](history/P6-original-presentation-implementation-closeout.txt) and [original evidence](history/P6-original-closeout.md). Its non-runner Git subject was `c10-horizontal-color closeout green`, **not** the canonical `c10-horizontal-color/P6: ...` implementation marker. The stack's old P6 root file was removed so the runner sees exactly one final closeout at P11. **Do not rewrite executed P1–P5** or historical evidence, and do not pretend the old P6 source review was a live Green result. Confirm actual local runner/Git history before resuming; if a conflicting local P6 implementation marker exists, STOP and reconcile rather than replay work.

| Prompt | Responsibility | Tier | Model | Browser |
| --- | --- | --- | --- | --- |
| [P1](P1-horizontal-roadmap-layout.txt) | Historical initial layout, completed | T2 | GPT-6 Sol High | no |
| [P2](P2-qualification-color-grammar.txt) | Historical status marks, completed | T1 | GPT-6 Sol Medium | no |
| [P3](P3-full-canvas-roadmap-shell.txt) | Historical full canvas, completed | T1 | GPT-6 Sol Medium | no |
| [P4](P4-linked-document-overlays.txt) | Historical source overlay, completed | T2 | GPT-6 Sol High | no |
| [P5](P5-checkpoint-inspection-overlay.txt) | Historical inspector overlay, completed | T2 | GPT-6 Sol High | no |
| [P6](P6-correction-phase-membership.txt) | Deterministic correction-to-phase associations from imported and task names | T2 | GPT-6 Sol High | no |
| [P7](P7-connected-roadmap-lanes.txt) | Visual upper/lower lanes, truthful phase/membership/dependency lines | T2 | GPT-6 Sol High | no |
| [P8](P8-full-card-status-color.txt) | Six muted **whole-card** status treatments | T1 | GPT-6 Sol Medium | no |
| [P9](P9-actionable-phase-camera.txt) | Current-phase readable first camera, intentional viewport persistence | T2 | GPT-6 Sol High | no |
| [P10](P10-restrained-relationship-motion.txt) | Gentle relationship motion with reduced-motion alternative | T1 | GPT-6 Sol Medium | no |
| [P11](P11-visual-evidence-closeout.txt) | **Direct browser/native UI evidence** and truthful presentation-only closeout | T3 | GPT-6 Sol High | **yes** |

**Runnable grammar:** contiguous P1–P11, exact correction-10 and unchanged `0.10.16` metadata, P11 is the **sole** final root closeout. P1–P5 remain historical runner implementation checkpoints; P6–P10 are new implementation tasks, P11 is a browser-required manual evidence gate. No additional `/activate` ceremony.

## Execution and handoff

After synchronizing this documentation into the actual local checkout and reconciling HEAD/dirty state and Git ancestry:

```sh
npm run codex:phase:validate -- c10-horizontal-color
npm run codex:phase -- c10-horizontal-color
```

The runner should recognize committed **P1–P5** and resume at **P6**; **inspect the displayed planned prefix before confirming**, because a separate manually executed old P6 closeout is not a canonical P6 implementation marker. If the prefix is inconsistent, do not force/replay checkpoints. Execute P6–P10 with focused tests. P11 requires **actual browser and independently observed native Electron evidence** to verify the map's appearance; if the runner cannot execute browser-required prompts, run P11 manually. A missing browser/native controller is BLOCKED, not fictitious PASS. P11 must write/refresh [closeout.md](closeout.md) with source SHA and screenshots; never overwrite the archived P6 evidence.

The user's prior P9 family is **NOT GREEN after three cycles**, preserved in `../c10-roadmap-qualify/qualification/loop-1-markdown/`. The owner explicitly intends a fresh P9 requalification after presentation repair. Preserve its previous three attempts and append any new owner-authorized evidence separately; do not call them the original cycle 4 or silently erase the failure. Import/status gate accuracy still has a **separate** `c4-color-theme` source contradiction: a section-local Active label conflicts with a later Green summary. No visual styling or inferred correction association may resolve that by silently choosing Green. Reconcile source authority explicitly before claiming P9 qualified. Continue P10/P11/P12/P13/P14 per their own scope and independent limits; P14 alone runs the final full aggregate and decides Phase 10 correction qualification.

## Safety / out of scope

No version bump, dependency/lockfile changes, second Chat, model/provider changes, automatic prompt execution, agent/Work grants, duplicate roadmap editing controller, new document-sync service, implicit status Green, source write without review, invented graph edges, hidden conflict/approval or blanket Phase 11 UI work. Preserve historical P16/P19 NOT GREEN and current Phase 10 NOT OWNER-CLOSED, and existing manual matrix's five up-to-three-cycle families.

## Post-implementation live review — presentation corrections still required (2026-10-13)

The first Phase 10 manual import exposed four **Not Green presentation findings despite P1–P6 implementation completion**: (1) phases and corrections all appear on one horizontal line, (2) status color is confined to small labels instead of entire checkpoint cards, (3) initialization fits the entire 31-checkpoint map to an unreadably tiny scale, and (4) phase/correction/dependency connector lines are missing. The status strip also showed 9 unresolved references; inspect their actual classes (historical mismatches, missing dependency, external owner reference, etc.) before attributing any to missing parents.

**Import/attachment rule:** A valid explicit parent wins when consistent; otherwise recognize exact numeric `c<phase>[-slug]` corrections from both linked Markdown and task-folder conventions (`c10-*` → Phase 10, but not `c100-*`). A conflicting explicit parent or absent phase stays diagnostic/reviewable. Convention-based phase membership may drive the upper correction lane and connector, but MUST NOT produce a fabricated canonical dependency, failed prompt, status transition or automatic write. Other unlinked nodes stay in a discoverable unlinked area instead of a false mainline.

**Required connected map:** visible left→right **progression** connectors between displayed chronological phases, above-mainline membership connectors for corrections, lower supporting prompt/task connectors and distinct directed connectors for *actual* stored dependencies. Maintain a deliberate visual/style/accessibility distinction between presentation membership/progression and authoritative dependency; no nonexistent edges in RoadmapStore. Render useful connections at world/phase/checkpoint detail levels, without collisions or implying waived/Not Green means qualified.

**Status and camera:** each six-state card receives an entire subdued state-tinted background/border/accent plus accessible label/icon, while focus/selection remain obvious. First accepted import or fresh opening at no deliberate saved viewport centers the current actionable phase at readable zoom (neighbors visible), **not** automatic fit-all; user pan/zoom thereafter persists through refresh/restart/sync/overlays/project navigation. Explicit Fit and Focus remain separate.

**Motion:** restrained slow highlight on the evidenced active route and brief focus/expand transitions only; static clarity is mandatory, no distracting flashing or all-path activity, respect reduced-motion, keep dense canvases responsive.

**Superseded routing note:** The original proposal was to repair these findings only within manual P9/P12 cycles. The owner later explicitly requested implementation prompts: new P6–P10 now implement them, P11 checks appearance with real UI, and P9 requalification follows separately. The original P6 is archived; do not rerun completed P1–P5 or change `0.10.16`, add a qualification family or imply Phase 10 Green.

## Prompt efficiency gate — 2026-10-13 continuation

The new sequence has five single-responsibility implementation prompts (P6 semantic phase membership, P7 geometry/lines, P8 card CSS, P9 camera lifecycle, P10 restrained animation) and one evidence-only manual T3 closeout (P11). P6/P7/P9 are High T2 because each touches representation correctness or user state; P8/P10 use Medium T1. Each implementation targets <=8 minutes of focused work plus essential tests; any real geometry/lifecycle exception must be justified. Reuse source-consuming tests and rebuild changed package outputs only when necessary, no repeated `npm run check`, no dependency/lockfile changes. The T3 P11 browser/native task is explicitly longer than an ordinary implementation prompt. P14 remains sole full aggregate. Exactly one new final closeout; archived P6 history is excluded from runner's root prompt list.

## Post-P10 visual refinement: intentional prompt disclosure

After committed P6-P10 fixes, the first real P11 browser fixture shows a remaining clutter defect: closer zoom exposes generic task-stack boxes ("Phase 6 prompts", "Correction edit-architecture"), `Unknown` labels and "prompts hidden" counters. Existing `roadmapVisibleGraph` displays every stack in phase/near detail and automatically emits prompts at checkpoint detail. This behavior fails the intended navigable Roadmap experience. **P11 has no direct qualified Green yet.**

Lock the new rule: ordinary zoom levels reveal more information *about existing strategic checkpoints*, not implementation nodes. By default render phases, canonical corrections and distinct source-only correction routes where necessary; do not emit ordinary task-stack container cards or prompt nodes just because zoom crosses a threshold. Show compact validated stack count/provenance in the associated phase/correction or its current inspector, with explicit **View Prompts / Expand** to reveal only the chosen branch. Collapse returns to an uncluttered view. Avoid duplicate canonical/source-only corrections and do not promote unknown stack status to authoritative phase qualification. Preserve task discovery, exact prompt source navigation, keyboard/accessible expansion, paged prompt limit, user camera, project-local expansion persistence, stable mainline layout, truthful displayed connectors and the independent ChatPanel.

An absent descendant must not occupy space or leave line stubs: layout/collision and drawn connectors must follow displayed topology, not the all-node projection. Actual structured Roadmap, source Markdown, source hashes, evidence and revision remain unchanged by display choices. New targeted one-off repair is preferred over altering committed P6-P10 prompts or re-running the correction runner. P11 and Phase 10 manual P12 must observe this explicitly in browser and independent native Electron before presentation Green.
