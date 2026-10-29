# ADR 0040 — Roadmap phases, qualification gates and criteria

**EXECUTION PLAN SUPERSESSION (2026-10-29):** [c11-roadmap-redesign-v2](../tasks/c11-roadmap-redesign-v2/README.md) replaces execution of the earlier P1–P7 stack after source-bound original P1 NOT GREEN. V2 splits store/schema/authority/qualification/sync/Chat/visual/help/cleanup into narrowly testable runner prompts, manual real-Chrome P14 UI check and P19 independent closeout. Original prompt source/evidence remain immutable; the owner P1-only sequencing exception is not a blanket v2 execution approval. No product Gate implementation or new qualification claimed by prompt authoring.

**Latest G3 handoff (2026-10-29, d19833b4):** The originally failed zero-health request recognition has a scoped R3 code/Chrome repair and focused tests, but the **full G3 P4 Chrome matrix remains NOT GREEN / EVIDENCE GAP**, and owner-native Electron is unqualified. Do not rerun or duplicate the already-fixed R3 slice by default; finish remaining P4 gates and native disposition, or obtain a new explicit owner-approved sequencing exception, before c11-roadmap-redesign P1. This docs/prompt authoring does not implement the redesign or qualify Phase 11.

**Date:** 2026-10-29 (America/Chicago)
**Status:** OWNER APPROVED / DESIGN ONLY; implementation and qualification NOT RUN.
**Supersedes:** The active checkpoint/milestone-as-general-Roadmap-node design in ADR 0036 and older Phase 11 visual documentation. Historical evidence reports remain factual records of their original versions.
**Authority:** Solo alpha project owner; this decision explicitly rejects legacy checkpoint compatibility and unused code preservation.
**Execution:** [c11-roadmap-redesign](../tasks/c11-roadmap-redesign/README.md).

## Context

The existing Roadmap index stores phases, corrections and milestones together under a `checkpoints` collection; the UI renders visually similar graph nodes and inferred ownership. This obscures phase qualification. The developer's actual workflow qualifies phases through explicitly testable gates; an arbitrary checkpoint or milestone is not proof of readiness. The owner-approved 2026-10-29 reference image `this-style.png` requires large horizontal phase containers with subordinate expandable child rows, clean directional arrows and honest colors.

## Canonical dictionary

- **Roadmap:** One project-scoped, developer-approved strategic sequence of phases, grounded in a linked Markdown document where explicitly configured.
- **Phase:** A bounded strategic delivery outcome. A phase has ordered gates, explicit coverage approval, a derived planning-presence treatment, and a qualified/not-qualified outcome. A phase is NOT a gate.
- **Gate:** A required, independently assessable qualification requirement owned by exactly one phase. Gates have stable ID, phase ID, phase-local readable designation (G1, G2, ...), title, purpose, ordered testable criteria, dependencies, work/evidence links, and qualification disposition. There are no optional gates; optional work belongs in Tasks.
- **Criterion:** One observable pass/fail requirement with stable identity, required expected result, and attributable evidence or an explicit evidence gap. Criteria cannot be fulfilled by a task title or an AI assertion.
- **Evidence:** Verified source-bound test output, human observation, artifact, manual check or documented approval, with provenance, tested source/revision/hash when relevant, criterion association, result and freshness. Missing/changed evidence cannot silently remain proof.
- **Task/Prompt/Work:** Implementation activity and execution history associated with a gate as necessary. Completion is not gate qualification; a prompt stack is not a gate.
- **Correction:** Remedial work linked to a specific gate/criterion or, where necessarily broader, a phase. Corrections retain their own identity and explicit ownership; they are not a gate by definition.
- **Dependency:** An explicit semantic prerequisite between gates or phases; sequential left-to-right phase arrows are presentation-only chronology, never inferred dependencies.
- **GREEN:** Qualification supported by current, sufficient, approved evidence for every required criterion; source/project authority remains explicit.
- **Waiver:** Explicit, recorded owner exception with rationale and affected requirements; NOT GREEN, never included silently in a GREEN count or promoted by appearance.

## Canonical model and authority

Adopt a versioned **new canonical schema** (proposed `schemaVersion: 2`), with separate `phases[]`, `gates[]`, `corrections[]`, linked-document ownership, revision and source identity. The shape and names are locked semantically, while TypeScript details are determined during implementation. Use immutable project-scoped IDs; a gate's parentPhaseId is explicit and validated. No string matching, numerical proximity or graph geometry decides parentage. Direct dependencies are directed, cycle-checked and scoped to the same project. Attach task stacks/Work/History through typed source-backed links, not by inserting synthetic gates into the canonical list.

A gate may be Not Implemented, Active, Pending Review, Not Green, Blocked, Green or Requalification Required/Stale. Unknown remains visible wherever evidence is unavailable. Waiver is separately recorded as an exception. Treat **implementation progress**, **qualification result** and **draft approval** as independent dimensions; do not overload an enum to represent all three. Qualification is a controlled operation, not an editable color or ordinary AI-proposed status. All accepted status changes require auditable source and authority; the model can suggest criteria/evidence but cannot award Green.

**Phase rule:** Zero accepted gates means Unplanned/dim. At least one accepted gate means Planned visual presence, NOT full planning coverage and NOT Green. A phase may be qualified Green only after the developer has explicitly approved that phase's gate-set coverage/completeness, every required gate is qualified Green on current evidence, and no unresolved blocking condition exists. Do not award Green from a numerical percentage alone. Changes to required criteria, linked source, implementation under test or other relevant authority invalidate affected qualifications until reverified. If a gate is waived, phase Green requires an additional explicit recorded owner disposition for the exception; do not count a waiver as a passing gate.

Qualification progress displays `qualified gates / required accepted gates` with clear label and unknown/blocked semantics. Empty sets never display 100% or qualify Green. Accepted noncanonical drafts must remain visibly distinct from published canonical Markdown, and proposed gates never count in canonical planning or qualified totals.

## Authoring and linked documents

Human-edited Markdown has an explicit Phase/Gate/criterion grammar and stable section mappings. Preserve unrelated prose and actual source bytes, enforce source hash, project root, revision and preview/approve/reject boundaries. Greenfield AI creates a **reviewable** phase/gate draft, not canonical state. A generic task list or Phase-only saved response remains Phase-only or an explicit draft needing Gate-definition review; never convert arbitrary bullets into qualification gates automatically. Gate criteria must be concrete enough to validate; ambiguous proposals remain incomplete and nonqualified.

Keep the existing Roadmap editor, inspector overlay, dockable saved ChatPanel, RoadmapStore authoritative writer, RoadmapGreenfield draft flow, ProjectPlanningActions validation, linked Markdown conflict/relink protections, Planning Map and Work boundaries. Replace their checkpoint-facing interfaces rather than creating second owners or editors.

## Alpha clean-cut policy

There is **NO backward compatibility requirement** for broken or obsolete checkpoint/milestone Roadmap structures. Remove deprecated types, UI paths, aliases, import adapters, duplicate stores, feature flags, obsolete branches, tests and unused documentation when the new design supersedes them. A pre-cutover `.dope` Roadmap index is rejected with an explicit, developer-visible incompatible-schema recovery action; do not silently destroy existing user files, rewrite source Markdown, or pretend old data was migrated. Any rebuild/reimport/delete operation requires explicit developer approval and a safe preview. New schema-only tests replace obsolete tests; maintain supported connected behavior.

Do not delete original qualification evidence, historical commits or independent game-source content. Historical terms in past evidence may remain literal facts; **active contracts and executable prompts must use Gate semantics**.

## UX contract and qualification

Implement the approved exact **visual grammar**: charcoal rounded horizontal phase cards, small PHASE index, strong title, concise qualified-gate count/thin bar/divider, nested foldout Gate rows with status icons, explicit directional phase arrows, and optionally subordinate correction groups. No floating lookalike gate cards or dashed pseudo-ownership links. Dark/orange restrained tokens, responsive/light/theme accessibility, semantic zoom, stable viewport, keyboard/pointer/touch and in-stage inspector remain.

Execution is gated by the separate G3 recovery outcome and evidence: at 2026-10-29 HEAD `68cdec71af73`, G3 P3 was browser-scoped Green but **P4 CHROME NOT GREEN** due to incorrect 'zero health means loss' requirement coverage; owner-native Electron qualification is unobserved. Repair/requalify G3 P4, then native handoff (unless the owner explicitly approves a documented sequencing exception) before starting c11-roadmap-redesign P1. This ADR does not repair G3, run a prompt, qualify the Roadmap or close Phase 11.
