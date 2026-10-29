# /prompt-plan — c11-roadmap-redesign

**Date:** 2026-10-29. **Status:** DOCS/PROMPTS AUTHORED ONLY / NOT RUN OR QUALIFIED.
**Owner target:** `this-style.png` — three horizontally connected dark parent **phase cards** with nested collapsible checkpoint rows; reference wording/guards in [approved contract](../../planning/p11/roadmap-visual-hierarchy-contract.md).
**Baseline:** main coherent `0.11.8` at review; recheck execution-time local source, version, dirty tree and G3 handoff. **No branch**. All stages keep version **unchanged**.
**Prerequisite:** Complete `c11-g3-recovery` P4 Chrome gate and owner-operated native Electron verification before P1 unless developer explicitly changes sequencing in writing. The existing G3 proposal/accept/reject/Markdown flow is a required regression baseline, **not** an implementation target of this stack.

## Outcome and architecture decision

Render a single **horizontal progression map of phase containers**. Within each phase, children are accessible, keyboard-navigable row/foldouts; full details/editing still open the existing in-stage `RoadmapInspectorModel` overlay. Source-authoritative phase/checkpoint/correction identities and typed dependency edges remain unchanged. Default phase-to-phase arrow connectors denote **ordering**. Membership is conveyed by nesting, while cross-phase dependency relations are inspectable in a deliberate dependency/details view; unparented entities retain diagnostics and pool access.

Do **not** replace React Flow/the Roadmap canvas, drop semantic zoom/viewport persistence, mutate RoadmapStore/linked Markdown from a layout, or make a second Chat or source owner. Minimize presentation mapping; where current node geometry must change, do it in a **derived view-model** with stable owner identities. The screenshot is exact in visual grammar and proportions, not a demand to hard-code pixel positions or ignore narrow/accessibility themes.

## Prompt decomposition and acceptance

### P1 — Phase hierarchy, nested rows and arrows

**Likely owners:** `packages/theia-extension/src/browser/roadmap-canvas-model.ts`, `roadmap-canvas-widget.ts`, `roadmap-viewport.ts`, existing in-stage inspector, scoped theme/CSS. Determine current React Flow phase node type/React UI before editing. Replace independently-floating milestone/checkpoint cards in default view with one parent phase visual card whose children render as compact internal rows. Preserve stable selection and inspect/edit actions for each child by its real ID and keyboard semantics; foldouts expose summary/acceptance/dependency information without promoting detail edits into another authority. Expanded children must not corrupt canvas pan/zoom or steal Chat focus; mouse drag and text selection remain deliberate. Distinguish collapsed/expanded/pending source in a11y.

Use distinct straight/orthogonal arrows **with visible arrowheads**, anchored card-to-card from left to right, with no grey dashed child-to-neighbor lookalike path. Arrow means chronological order only. Keep corrections and unowned project content discoverable; if phase-layout migration is needed preserve intentional viewport and prior source positions where safe.

**Tests:** `test/unit/roadmap-canvas.test.ts`, `roadmap-spatial-canvas.test.ts`, `roadmap-semantic-zoom.test.ts`, `roadmap-viewport.test.ts`, `roadmap-inspector.test.ts`, plus `roadmap-greenfield.test.ts`/create UI only for affected proposals. One affected browser build and `git diff --check`. Avoid irrelevant whole-project aggregate.

**Browser gate:** real Codex Google Chrome current rebuilt Dope product: screenshot 3-phase fixture at usable first zoom; Phase 1 with nested children, Phase 2 partial, Phase 3 empty; arrow direction and card ownership obvious. Expand/collapse, click/keyboard child, show full details, pan/zoom/Focus/Fit, narrow Chat split. Check proposed G3 phase-only review and Accept/Reject still functional (no unapproved write). Record exact served source and meaningful evidence; repair up to 3 bounded cycles. No next prompt on failure.

### P2 — Planning-state color, progress truth and relationship de-cluttering

**Likely owners:** `roadmap-status-style.ts`, existing status/React node UI, scoped semantic theme/CSS; projection only if source evidence needs checked, `roadmap-canvas-model.ts` for corrections/prompt associations. Introduce a derived view-only `Unplanned`/ `Planned` marker: 0 **accepted direct child checkpoints** => subdued neutral; >=1 accepted => restrained warm copper/sand **unless more authoritative Active/Blocked/Qualified/etc. applies**. Proposed children do not affect accepted counters; noncanonical accepted draft and published Markdown retain distinct labels. Preserve all six canonical `CheckpointNode.status` states and original gate evidence; unknown and waived stay visibly distinct.

Progress bar numerator/denominator derives from explicit, documented owner-backed checkpoint set; make labels qualify meaning ('implemented', 'qualified' or supported equivalent). Do not count prompt/task-stack discovery, inferred relationships or phase presence as completion. A phase is Green ONLY when owner phase qualification says so; don't implicitly compute it from rounded percentage or green child rows. Arrow color is non-authoritative; no green route without evidence.

Ensure corrections and qualifier branches are visually owned, possibly under expandable labeled groups within relevant phase; preserve explicit correction parent (including child checkpoint), unsupported/ambiguous parents in pool/diagnostic, no c10/c100 string collision, and normal prompt disclosure/Open Prompt. Default view must not draw member/cross-phase dashed links through text. Show actual directed semantic dependencies on deliberate inspect/relationship mode with accessible labels and no edit of stored edge data.

**Tests:** `roadmap-status-truth.test.ts`, `roadmap-projection.test.ts`, `roadmap-spatial-canvas.test.ts`, `roadmap-canvas.test.ts`, `roadmap-task-discovery.test.ts` when applicable and `dope-theme.test.ts` if theme semantics touched. Dark/light/custom, focus, hover, reduced motion in browser. Test empty/one accepted/many proposed, Green/Active/Not Green/Waived/Unknown/Not Implemented, missing/conflicting correction parent, explicitly stored dependency, proposal reject/reopen and source revision unchanged. Up to 3 bounded repair/qualification cycles.

### P3 — Existing Dope Help + local Q4/browser regression

**Likely owners:** `packages/theia-extension/src/node/dope-capability-help.ts`, `chat-context-composer.ts`, `chat-backend.ts` only as needed and associated tests. Extend verified capability help for `phase/checkpoint creation`, `why grey`, `planned versus Green`, `expand checkpoint`, `progress bar`, `correction/dependency meaning`, and `how qualifies Green`. UI paths must come from actual registered controls in the **post-P1/P2** implementation; unavailable features should produce truthful no-action or recovery, never invent controls. Separate ordinary planning/action intent from help classification; do not classify every 'Roadmap' as a help query or prompt a second model unnecessarily.

Ground the answer in project/phase/checkpoint/owner/current-source status (or state clearly unavailable) with bounded context and recorded selected local model provenance. Do not require entire repo ingest or force Q4 if user selected another model; local Q4 is a manual test fixture. Preserve strict validated no-action and no writes, no hosted fallback or linked-file replacement detour.

**Tests:** `dope-capability-help.test.ts`, `chat-context-composer.test.ts`, `roadmap-chat-context.test.ts`, `roadmap-chat-panel.test.ts`, `roadmap-local-model.test.ts` where seam changes, targeted G3/linked-doc/sync/permissions regressions. **Real Chrome/local Q4** at actually verified loaded context if available: multiple specific user help questions, current selected parent, unplanned phase, proposed draft, Green/no-evidence, wrong-document and Planning Map negative controls. Check saved Chat dock/no mutation, linked Markdown source hashes and UI.
Browser must also revisit P1/P2 on dense actual Dope Markdown, narrow split, accessible labels, light mode, keyboard, reduced motion, viewport persistence, proposal/Accept/Reject/relink/sync/cancel. Up to 3 bounded repair/qualification cycles. Stop if Q4/browser unavailable; no simulated pass.

### P4 — Independent exact-source Chrome closeout / owner-native handoff

P4 is a **manual qualification**, no default product implementation. Re-read P1–P3 real GUI evidence, current HEAD/dirty tree and build-to-served bundle identity. Independently operate current Dope in **real Codex Google Chrome** with disposable Roadmaps: empty, planned, active, blocked, qualified/waived/unknown, proposed/accepted, correction and cross-phase dependency cases. Capture before/after screenshot comparisons against the owner's exact style; verify meaningful labels rather than just colors. Confirm editor/inspector, no crossed lines, draft accept/reject, source permissions, Chat context and help, corrections/prompts, viewport/keyboard/theme. Run a single final `npm run check` only if feasible/justified and on an unchanged candidate after earlier focused checks; do not re-run entire check per prompt or fabricate counts. `P4` is one **closeout** according to runner grammar; document exact source/build hash, results by gate, screenshots, current G3 status and unobserved native parity in `docs/tasks/c11-roadmap-redesign/closeout.md` after tests.

Owner-operated native Electron is a separate Gate: provide source-matched reproducible checklist, no pretend native control, no inherited G3 native pass after changed rendering. Product-wide Phase 11 still open unless separately owner-closed.

## Execution route and stop law

1. Record G3 P4 Chrome-qualified and owner-native result or explicit owner exception; reject stale/unconfirmed preconditions.
2. `npm run codex:phase:validate -- c11-roadmap-redesign` locally (authoring through GitHub cannot execute this).
3. Run **P1 individually with Codex browser**; up to 3 implement/repair/qualify cycles; STOP on NOT GREEN/BLOCKED.
4. After P1 real Chrome PASS and committed safe state, run **P2** identically, then **P3**, then manual **P4**.
5. Do **not** invoke unattended `npm run codex:phase -- c11-roadmap-redesign` as a substitute for GUI; all prompts must have `Browser required: yes.` and runner would hand off/stop. Do not self-commit product code if execution framework/owner owns commits; authoring docs on main is a separate explicit authorization.
6. No `/activate`; no implicit implementation approval, acceptance, prompt Run, new branch, package-version advancement, roadmap publication or status promotion.

The prior `c11-roadmap-visual-hierarchy` charter remains an approved **non-executable** source reference; this is the only newly authored runnable `c11-roadmap-redesign` stack.
