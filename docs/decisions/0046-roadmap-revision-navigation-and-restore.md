> **2026-11-02 FORWARD INTEGRATION — DESIGN ONLY:** [ADR 0047](0047-native-roadmap-authoring-and-automatic-sync.md) makes each successful individual/selected/bulk Roadmap Apply an exact atomic revision whose actual operations and source-sync status are recorded through this document's **single append-only archive**. Proposal Undo is *not* a second rollback service: toolbar Undo/Redo remains read-only history navigation; any reverse requires an explicit compared/approved restore to a new head with evidence/qualification and linked-source protection. Partial Apply revalidates remaining operations and cannot reuse old leases. Existing c12-undo prompts and historical status are unchanged; no new Green is implied.

# ADR 0046 — Roadmap revision navigation and reviewed restoration

**Decision:** 2026-11-01 (America/Chicago), owner-approved design. **Status:** APPROVED FOR DOCUMENTATION AND PROMPT AUTHORING ONLY — NOT IMPLEMENTED, RUN OR QUALIFIED. **Product baseline:** `0.12.7` unchanged; inspect the real local checkout before execution.

**Contract:** [Roadmap revision navigation and restore](../planning/p12/roadmap-revision-navigation-and-restore.md). **Correction:** [c12-undo](../tasks/c12-undo/README.md).

## Problem and source assessment

The Roadmap toolbar has no first-class multi-step Undo/Redo. Current schema-2 `RoadmapStore` keeps a monotonically increasing `revision` and current `.dope/roadmap.json`, not an authoritative durable sequence of earlier snapshots. `ProjectPlanningActions` holds only the last eligible `before/after` snapshot and undo token in an in-memory, handle-bound map; detach/restart removes it. The Inspector exposes a limited `Undo last edit` path, which must not be mistaken for durable multi-revision history. The Roadmap definition saver blocks edits to protected Gate/Phase qualification, evidence and linked-source metadata without their specialized reviewed owner.

## Decision

1. **First-class controls:** Place always-visible, accessible icon-only **Undo** and **Redo** buttons in the existing center Roadmap editor toolbar. They move a *read-only display cursor* backward/forward across verifiably retained authoritative revisions. They do not mutate the Roadmap or trigger a model call. Disable at the available bounds; preserve ordinary code-editor Ctrl+Z/Ctrl+Y.
2. **Historical preview:** When the cursor is not on the current head, the same Roadmap canvas displays the exact retained snapshot with a clearly labelled historical revision. The entire historical view is read-only. A compact confirmation strip at the bottom offers **Confirm Restore Rn** and **Return to Current / Cancel**. Never switch to historical mode silently or autosave a preview.
3. **Append-only restoration:** Selecting **Confirm Restore** opens/uses an exact-source compare/review and requires explicit developer confirmation. A successful restore writes *one new current revision* derived from the selected historical structure, preserving all intervening revision records. Example: current R9, preview R5, confirm => new R10 based on R5; R6–R9 still exist. Undo afterward can preview R9. Do not rewind the counter, truncate or overwrite history.
4. **One Roadmap owner:** Extend existing project-scoped schema-2 `RoadmapStore` / `RoadmapService` with durable verified revision capture, bounded historical reads and an explicit checked restore preview/apply/recovery operation. No second canonical index/writer, Chat agent or History source. Do not reinterpret `ProjectPlanningActions.undoEligible` as a general restore.
5. **Historical availability is honest:** Begin at the first exact, verified baseline recorded when the feature is enabled; preserve every subsequent committed Roadmap revision through all applicable writer paths. Older numbers without historical data are *unavailable*, not fabricated via Chat, Markdown, Git diffs or inference. Handle gaps/corruption explicitly and fail closed; protect the current index.
6. **Source- and evidence-safe restoration:** A restore may select older *editable structure*, but it cannot erase audit history, published source provenance, Work/Chat executions, historical evidence or granted approvals. Recalculate current Gate-set/qualification eligibility; never automatically resurrect past Green/waiver/evidence acceptance. Linked Markdown restoration needs a separate reviewed, exact source-hash-bound full diff and the existing canonical source owner with durable interruption recovery; if the current writer cannot perform the requested structural restore safely, block that restore instead of bypassing it or overwriting a file.
7. **Focus and proposal isolation:** Historical browsing is an intentional separate Roadmap presentation mode. An incoming Chat proposal, even with Roadmap active, must not replace a historical snapshot or steal focus. The user can return to current and use the retained **View in Roadmap** action. Current proposals remain backend revision-bound; an actual restore can stale them under existing rules.
8. **History is observational:** The existing right-hand Project History may show one verified successful restore record, including selected historical revision and new head; it cannot execute restores, infer effects or record rejected/failed-zero-change attempts as applied. Retain project/source identity, actual outcome and provenance.

## Scope and sequencing

The independently authored **c12-undo** stack is: P1 durable revision history; P2 toolbar/history-only preview; P3 reviewed safe restore and source coordination; P4 independent real connected Codex Chrome qualification and honest closeout. These are four **separate manually initiated prompts**; not run, approved for code execution, automatically activated or bundled into existing corrections merely by authoring.

Preserve [ADR 0040](0040-phase-gate-roadmap-domain.md), [ADR 0045](0045-roadmap-proposal-lifecycle-and-publication.md), [hybrid Chat preview](../planning/p12/chat-roadmap-hybrid-proposal-review.md), linked Markdown publication/recovery, and [ADR 0034](0034-developer-continuity-and-right-toolbar-history.md). `c12-roadmap-publish-ux` Unit A/B, `c12-planning-recovery`, protected `/roadmap`, Docs-skills, and historical source-bound PASS/NOT GREEN records remain independent. No implementation, tests, browser/native evidence, version bump or GREEN claim follows from this decision.

## Alternatives rejected

- Immediate mutation on Undo/Redo clicks, or overwriting old revisions.
- Reconstructing missing snapshots from bare numbers, Git history, Chat content or untrusted agent summaries.
- Reusing the one-edit in-memory undo map as a durable multi-revision store.
- Directly copying entire old qualification/evidence/source metadata into the live index.
- Blind overwrite of linked ROADMAP.md, silent approval, a second writer or a model-driven restore.
