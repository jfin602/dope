# /prompt-ass — c11-roadmap-redesign

**Owner authorization:** 2026-10-29, documentation/prompt authoring on GitHub **main**. **Status:** AUTHORED DESIGN ONLY — no product implementation, application tests or live GUI qualification performed by this authoring.
**Current reviewed repository version:** `0.11.8` on main at start of authoring; do not assume that is the eventual local run baseline. **Phase 11 OPEN / NOT QUALIFIED.**
**Owner visual reference:** `this-style.png`, attached in the 2026-10-29 Dope IDE conversation. The image is NOT yet checked into the repository. Its semantic/visual description is locked in [the contract](../../planning/p11/roadmap-visual-hierarchy-contract.md). This correction's canonical executable name is **`c11-roadmap-redesign`**; `c11-roadmap-visual-hierarchy` is the previously approved design charter, not a second executable stack.

## Problem and acceptance target

Owner-reported real GUI shows a flat-looking horizontal graph of near-identical miniature phase/checkpoint cards, confusing grey dashed crossing connectors, uncertain phase ownership and a uniformly dim initial state. The exact approved screenshot shows charcoal rounded **phase containers** with a small `PHASE N` label, prominent title, truthful progress count/thin bar, divider, and **nested compact checkpoint rows** with status icon and expand chevron. Phase-to-phase direction is expressed by unmistakable arrows. Sample Green Phase 1, orange Active Phase 2 and dim empty Phase 3 are **illustrative, not project evidence**.

Critical user mental model: zero **accepted** checkpoints => subdued unplanned phase; one or more => phase looks *Planned* (not Green). Green, Not Green, Waived, Unknown, Active and Not Implemented retain independent evidence/source semantics. Draft/proposal status must be unmissable; accepted noncanonical Roadmap and separately published linked Markdown remain distinct.

## Source trace — actual main inspected at review

| Source seam | Existing evidence and change needed |
| --- | --- |
| `packages/theia-extension/src/browser/roadmap-canvas-model.ts` | `projectRoadmapDraft` currently emits standalone phase and milestone nodes + synthetic branch edges; `roadmapCanvasConnectors` returns progression, membership, containment, dependency; `roadmapSpatialLayout` places separate cards in vertical bands. Refactor **presentation** to parent phase containers with nested checkpoint rows; do not change canonical ownership/dependency semantics. |
| `packages/theia-extension/src/browser/roadmap-canvas-widget.ts` | Existing React Flow canvas/editor, `presentStrategicReview`, toolbar, phase focus, inspector selection and connector rendering already exist. Reuse this widget/React Flow host. Render contained rows and only directional phase arrows in default mode; preserve review/Accept/Reject and editor overlays. |
| `packages/project-intelligence/src/roadmap-projection.ts` and phase association | Owns stable source-backed phases/checkpoints/corrections, task discovery and status evidence. Only derive a **read-only presentation hierarchy** from verified relationships; no inferred dependency persistence or status promotion. |
| `roadmap-status-style.ts`, `dope.css`, centralized theme tokens | Canonical six statuses and existing gate-derived edge truth. Add separate derived Planning Presence visuals (dim/planned) and accurate child-count bars; preserve adaptive theme contrast and restrained orange ADR 0016. |
| `roadmap-viewport.ts` / editor/inspector | Current viewport/selection/keyboard, pan/zoom/Focus/Fit, in-canvas inspector and Chat docking need regression, not replacement. |
| `packages/theia-extension/src/node/dope-capability-help.ts`, `chat-context-composer.ts`, `chat-backend.ts` | The existing verified Dope Help registry covers Roadmap link/status/objective, but not phase/checkpoint progress/foldouts. Extend the **existing** help route, grounded in verified project/selection/owner state; no second Chat, help agent or granted write authority. |

Reviewed historical source-backed evidence: [c10-horizontal-color closeout](../c10-horizontal-color/closeout.md) earned **narrow browser-qualified correction** after earlier errors; its original graph/connector visual baseline is not the new target. Preserve its historical source-bound outcome. [G3 recovery](../c11-g3-recovery/README.md) establishes the functional creation/Accept/Reject source baseline and is a prerequisite for this redesign.

## Ordering and risk gate

**Do not begin implementation** until `c11-g3-recovery` P4 has actually completed its exact-source Chrome qualification AND the owner-native Electron verification has been recorded or the owner deliberately authorizes a documented exception. At reviewed main, G3 P2 had scoped Green; P3/P4 and native remained open. Do **not** claim G3 done because a later authoring commit exists. Once G3 closes its selected scope, inspect current HEAD/clean worktree, existing G3 rendering and evidence and rebase design against the *actual* product source before editing. Authoring this stack now does not run it or change runtime.

Changing React Flow node composition can invalidate G3 visual screenshots: carry forward independent G3 behavior regressions, verify the same single Roadmap editor, draft approval and linked Markdown preservation. Do not rewrite P1–P4 G3 prompts or their closeout.

## Efficient division and model tiers

| Prompt | Bounded implementation responsibility | Tier | Gate |
| --- | --- | --- | --- |
| P1 | Parent-owned phase cards/nested checkpoint foldouts, React Flow positioning and simple phase arrows | T2, GPT-6 Sol High | Focused source tests and mandatory actual Codex Chrome screenshot/interaction; up to 3 bounded repair/qualification cycles |
| P2 | Derived Unplanned/Planned presence, truthful six status colors/count/progress, corrections/dependencies without default dashed tangle | T2, GPT-6 Sol High | Focused source tests and actual Chrome status/relationship fixture matrix; up to 3 cycles |
| P3 | Verified Dope Help registry/local Q4 guidance and cross-owner, viewport, proposal and theme regression | T2/T3, GPT-6 Sol High | Focused help tests and actual saved Chat/Chrome local Q4 plus UI regressions; up to 3 cycles |
| P4 | Independent exact-source browser qualification/closeout and owner-native handoff | T3 manual, GPT-6 Sol High | No implementation by default; genuine Chrome evidence and explicit native parity gap |

Each P1–P3 is one coherent slice, usual <=8-minute **implementation target**; direct browser qualification can legitimately exceed that without inventing elapsed time. P4 is evidence/closeout, not a fourth implementation loop. Avoid repeated full `npm run check`; run focused tests & affected build per slice and at most one justified final aggregate at P4. Real browser required **yes for all P1–P4**: manual individual Codex-browser prompts; unattended `npm run codex:phase -- c11-roadmap-redesign` must not fabricate GUI qualification. Validate grammar locally before running with `npm run codex:phase:validate -- c11-roadmap-redesign`. No `/activate` gate; execution must still be explicit.

## Release/authority invariants

- No version bump, lockfile churn, branch switch, worktree reset, force push, silent commit, autonomous Work Run or arbitrary AI shell grants.
- Existing `RoadmapStore`, `RoadmapGreenfield`, `ProjectPlanningActions`, synced Markdown, source revisions/consent/approval and saved ChatPanel remain authoritative; no second editor, data store or chat runtime.
- A proposed phase/checkpoint must **not** count as an accepted planning presence, a completed implementation or Green.
- Actual cross-phase dependencies remain discoverable with named, directed meaning in an explicit view/inspector; never fabricate an association by visual proximity. Keep correction/prompt identities, `42<->58`-style Show/Hide Prompts invariants where source applicable, and historical gate outcomes.
- Keep owner game files intact; use disposable project roots for creation, rejection, conflict, status and destructive negatives. Respect explicit authoring/approval/publication stages and local-model provenance.
- G3 Chrome/native evidence and Phase 11 broad Hunt/Bridge/D1–D8 closeouts remain independent; this new correction may qualify narrowly without implying Phase 11 Green.
