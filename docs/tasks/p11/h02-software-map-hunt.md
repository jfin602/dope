# H02 — Manual Usability Hunter: Software Map to evidence-to-code

**Status: OWNER-APPROVED DISCOVERY CONTRACT / NOT RUN.** This is one manually operated, source-bound **Hunt and Triage** of a different workflow after [H01](h01-history-usability-hunt.md). It is not a product repair, phase-runner task, prompt-stack activation or automatic permission to operate the browser. A separate explicit owner Run is required.
**Planning baseline:** Dope `a73ff476a60fa29dcd10876dddd4b4c061a8cdc7` / coherent version `0.11.8`. Before H02, inspect **actual** Git HEAD/version/dirty status and matching built/served GUI bundle; this planning SHA is not a substitute for the tested source.
**Governing documents:** [Reusable Hunter](usability-hunt-manual.md), [Phase 11 plan](../../planning/p11/phase-11-plan.md), [issue ledger](../../planning/p11/usability-issue-ledger.md), [coverage matrix](../../planning/p11/panel-usability-matrix.md), [ADR 0037](../../decisions/0037-human-centered-ui-and-usability.md).

## Human goal

Act as a developer unfamiliar with Dope. Try to understand a small real piece of software by moving **Software Map → Physical Map/Static Flow → source-code evidence**. Decide from the live UI whether the hierarchy, relationships, source links, unknowns and recovery paths are understandable and trustworthy. Do not count a control's presence or a source-level test as a completed real GUI task.

This is **discovery-only**. Do not change product code, dependencies, versions, architectural documents in the real repository, prompts, agent permissions or source-of-truth state. Do not run Work, change hosted consent, trigger unapproved synthesis, fabricate map results, send project context to a hosted model or auto-launch repairs. Use safe disposable fixtures for any permitted setup/negative state.

## Registered surfaces to verify, not assume qualified

- The existing Software Map left inspector exposes **Analyze Project** when uninitialized. Setup offers no-model/manual and dry-run paths as appropriate to current state, and initialized mode provides **OPEN** Physical Map, **REFRESH** and **EDIT ARCHITECTURE**. Confirm actual registration and discoverability in the running GUI.
- Physical Map shares a center-editor canvas with **Architecture** and **Static Flow** modes. Inspect node selection, breadcrumbs, detail/inspection overlays, relationship groups, viewport and source navigation.
- Software Map evidence navigation resolves its evidence ID through the current software-map source service and opens the editor URI at an available source span. Flow edge inspection can show an **Open edge source** action. Verify actual file/line and current project identity; do not infer source validity from a label alone.
- A publishable Static Flow may need an existing, consistent, evidenced Software Map generation. Unavailable provider, missing declaration, absent evidence or unsupported data must be reported **BLOCKED/NOT RUN**, not manufactured by seeding arbitrary graph JSON.

## Preflight and evidence fixtures

1. Record test actor and GUI (browser/Electron), local time, exact product Git SHA, version, dirty worktree, browser backend process identity, served and built bundle SHA, active workspace, and existing model/provider readiness only if relevant. Inspect BOOT.md, AGENTS.md, workflow.md, the linked documents and live registration; preserve all current developer state.
2. Create **two independent disposable local projects**: A is genuinely empty/uninitialized; B is a small, understandable repository with named source files, imports/relationships and known line references. Prefer an already valid, source-backed published map or explicitly user-authorized manual/local-only map initialization. Do not use an unpublished fantasy graph or hosted synthesis to make Flow appear functional.
3. Capture project/owner/map generation and source-file hash state before/after where meaningful. Do not change any real project for negative tests. Map initialization in a disposable fixture, if performed, must be clearly distinguished from a read-only tour and its writes disclosed.
4. If required evidence-backed mapping cannot be generated without an eligible model or unsupported setup, mark the affected gates **BLOCKED**; still exercise truthful onboarding, disabled controls and recovery guidance in project A and B. Do not implicitly change Dope model defaults.
5. Browser exits: H2 [reported](h2-history-evidence-preview-readability.md) three browser backend exits (code 139) during reload/build transitions, with no known cause. If H02 sees one, capture source/bundle and backend PID, time, signal/exit, logs, nearby build/reload activity, and any dump/backtrace. Do not assert LM Studio causality or a confirmed issue without reproduction.

## H02 human task-state matrix

| Gate | Concrete user task | Required direct observation |
| --- | --- | --- |
| H02-A — Discover and start | Locate Software Map naturally in the workbench in empty A; understand why it is empty, Analyze Project, safe Not now/manual/dry-run affordances and absent-model limits | Real first click/key, useful descriptions and cancel/empty/loading/error behavior, **no automatic model call or hosted egress** |
| H02-B — Understand structure | In evidence-backed B, select a System → Subsystem → implementation/Component, read relationships, use **OPEN** to open existing Physical Map | Correct architecture and selected node, understandable inspector/map placement and no duplicate canvas/Chat |
| H02-C — Trace Static Flow | Switch to Flow, choose a participant and a real backed edge; inspect source/target, direction and supporting interaction detail | Distinguish facts from coverage gaps/unknowns, readable relationship and trace controls; absent evidenced flow is **BLOCKED**, not Green |
| H02-D — Open evidence-to-code | Click a source-backed Software Map evidence item and, if available, **Open edge source** in Static Flow | Actual editor URI, project, file and line/column match evidence; missing evidence does not guess or navigate to unrelated files |
| H02-E — Recover safely | Exercise missing file/evidence, source change or stale published generation, disabled setup, interrupted refresh, reload/backend restart, and switching A ↔ B | Honest error and next action, no stale cross-project selection/evidence, no surprise writes or ownership transfer |
| H02-F — Usability and access | Inspect narrow left panel/center canvas, keyboard entry/Enter/Escape, focus return, selection highlight, zoom/fit and detail overlay reading | Direct visual and accessibility-tree observations where supported; gaps explicit, not inferred passes |

The preferred *single real user journey* is: open Software Map in B → identify a genuine subsystem → open Physical Map → inspect a dependent implementation node → open Static Flow → inspect a real evidenced interaction → **Open edge source** → compare editor file/line with evidence → return to map. Record the exact point of interruption, if any, without backfilling imaginary success.

## Discovery and source-bound closeout

During H02, preserve click/keyboard sequence, expected versus observed result, observed project/map state, before/after fixture hashes as applicable, screenshots/logs only if actually captured, and exact GUI/model/provider provenance. Assign **PASS / FAIL / BLOCKED / NOT RUN** separately for each gate and distinguish missing prerequisite from an actual usability failure.

Write a **new** source-bound H02 run report only *after* GUI execution, e.g. `docs/tasks/p11/h02-software-map-hunt-closeout.md`, including: **Known issues reproduced; New findings and stable proposed UX IDs (P0/P1/P2 provisional); Evidence gaps; Coverage delta; Proposed bounded repair groups; Next different Hunter target.** Check the living ledger for UX-001–UX-010 before proposing duplicates; source inspection is not a substitute for GUI evidence. End with a triage proposal, not product edits or new model inference.

The H1 [UX-008/009](h1-history-continuation-diagnostics.md) and H2 [UX-010](h2-history-evidence-preview-readability.md) scoped browser qualifications remain independent, as does UX-003's earlier browser/local-Q4 scoped Green. Successful local History explanation could not run because Dope reported no eligible local conversational connection, and the H2 backend exits are still unclassified. Completed Work status/review and AgentRun, native Electron GUI and hosted parity also remain outstanding. **H02 cannot qualify Phase 11 or replace the two materially distinct broad clean hunts and explicit owner approval required for final closeout.**
