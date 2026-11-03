> **2026-11-02 CONSOLIDATED EXECUTION ROUTE:** The owner explicitly included the *entire* formal Undo/Redo contract (durable future archive, read-only revision navigation, source/evidence-safe compared new-head restoration and browser qualification) in the new runner-ready [c12-roadmap-sync](../c12-roadmap-sync/README.md) P4/P7/P8/P10. Treat this independent P1–P4 stack as **historically authored but not a parallel execution path** while c12-roadmap-sync is active. Reuse already qualified implementation if any; do not execute duplicate prompts or alter this stack's immutable P*.txt or prior results. This notice does not claim product code was run or qualified.

> **2026-11-02 OWNER FORWARD INTEROPERABILITY / DOCS ONLY:** [ADR 0047](../../decisions/0047-native-roadmap-authoring-and-automatic-sync.md) extends native Roadmap review to individual, parent-group, selected and bulk atomic commits. Each actual subset commit creates one retained revision/receipt; this stack's toolbar remains a **read-only historical cursor** and its reviewed restoration remains the sole revision-safe reversal creating a new head. Do not add a competing proposal Undo writer or silently reverse later unrelated edits; source sync pending/conflict and evidence guards apply. Keep existing authored P1–P4 source and qualification unchanged, and inspect actual owner HEAD before a later Run.

# c12-undo — Roadmap revision navigation and restore

**Owner decision:** 2026-11-01 (America/Chicago). **Status:** ASSESSED / PLANNED / AUTHORED ONLY — NOT RUN / IMPLEMENTED / QUALIFIED by this stack. **Product baseline:** `0.12.7` as recorded in governing design; inspect actual local manifest before executing. This is a **new independent correction** and does not authorize automatic product work.

**Authoritative documents:** [ADR 0046](../../decisions/0046-roadmap-revision-navigation-and-restore.md), [revision/restore contract](../../planning/p12/roadmap-revision-navigation-and-restore.md), [assessment](prompt-assessment.md), [plan](implementation-plan.md).

## Goals

Make **Undo / Redo** permanent icon-only controls in the existing Roadmap center editor. They browse actual persisted prior revisions *without changing current Roadmap or Markdown*. In a historical state, show **Historical preview**, **Compare with Current**, **Confirm Restore R#** and **Return to Current** in a bottom strip. Explicit confirmed restore creates a **new monotonic current revision** matching historical *editable structure* while preserving subsequent revisions, historical evidence, owner authority and linked-source safety.

Do not mistake the existing one-edit, in-memory `ProjectPlanningActions.undoEligible()` for a historical archive. Do not reconstruct missing revisions from a counter, Chat or Git. No automatic old Green, evidence purge, Source overwrite, AI approval or History writer.

## Manually run prompts, in strict order

| Prompt | Scope | Proof / exit |
| --- | --- | --- |
| [P1 — Durable archive](P1-revision-archive.txt) | Capture an exact current baseline and every future committed schema-2 revision across owner writers; integrity/restart/recovery/read-only list/read | Exact hash-backed, bounded project-local history; earlier unavailable revisions truthful |
| [P2 — Toolbar and historical preview](P2-toolbar-history-preview.txt) | Undo/Redo, nonmutating historical canvas and bottom strip; no provisional Chat overlay/focus hijack | Read-only navigation and correct current revision/source bytes |
| [P3 — Reviewed restoration](P3-reviewed-restore.txt) | Human-reviewed append-only restore, qualification/evidence controls, linked Markdown source-owned diff/recovery, applied-only History receipt | Actual Rm→Rk⇒Rm+1 safely; conflicts/reject/unsupported leave no changes |
| [P4 — Codex Chrome qualification](P4-codex-browser-closeout.txt) | Independent real connected Google Chrome and final-source regression/negative tests; up to two narrow repairs | Truthful overall GREEN / NOT GREEN + screenshot/bytes/commit evidence |

**Execution mode:** Manual, separately invoked GPT-6 Sol High prompts; Ponytail FULL for implementation agent only if installed/available. Aim for a bounded ~8-minute cycle, hard 15-minute stop per cycle without sacrificing safety; stop with honest blockers if scope exceeds it. **No headless phase runner, automatic next prompt, /activate or self-commit**. P4 must use connected Codex Chrome, not only mock/unit tests or native Electron claims. An owner later explicitly choosing to run an individual prompt is separate from this authoring request.

## Preconditions and conflicts

Before each prompt inspect *local* HEAD/status/dirty files, actual RoadmapStore/Service, ChatPanel, current `c12-roadmap-publish-ux` implementation, package version, existing tests, browser tools and existing qualification. Preserve unrelated owner work and historical PASS/NOT GREEN. Do not reset/stash/clean, silently alter provider/model settings, write to a real user Roadmap/Markdown or bypass source review. Use disposable fixtures.

This stack does **not** extend or modify already-authored `c12-roadmap-publish-ux` Units A/B, `c12-planning-recovery` P3-B, Docs skills, Pi/Work grants or Phase 11 qualification. Linked multi-field historical restores require a separately safe reviewed canonical source operation; if it cannot be implemented/qualified, **report NOT GREEN** rather than overwriting Markdown through a shortcut. Existing pending Chat proposals may become stale after an actual restore, and historical browsing suppresses automatic proposal overlay while preserving manual View in Roadmap after return to current.

**Final state of this authoring step:** Documentation/prompt source only. There are no implementation code changes, live browser results, qualification passes or product version changes.
