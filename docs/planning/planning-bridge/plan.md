# Planning Bridge — PB1–PB8 Implementation and Qualification Plan

**Status:** OWNER-APPROVED DESIGN / PLANNED ONLY; NOT IMPLEMENTED, PROMPT-WRITTEN, RUN OR QUALIFIED.
**Date:** 2026-10-16 (America/Chicago). **Authority:** [ADR 0038](../../decisions/0038-planning-bridge-and-idea-to-implementation-workflow.md).
**Upstream:** separately approved `docs/tasks/c11-brainstorm/` (authored only at reviewed `0.11.8`). Phase 11 OPEN / NOT QUALIFIED; Phase 12 inactive.

## Outcome and scope

Provide a continuous **Captured -> Brainstorming -> Roadmapped -> Architecting -> Prepared -> Implementing -> Validating -> Qualified -> Closed** journey grouped into **Idea & Brainstorm / Approved Roadmap / Planning Bridge / Implementation / Qualification & Reconciliation**. Blocked, Stale, Needs Decision, Failed, Not Green remain orthogonal conditions. Make substantial work start from a saved-Chat interactive Roadmap, then **Prepare Work** into source-backed impact assessment, Planning Map transformation design, bounded WorkItem decomposition, prompt-stack composition, explicit approvals and existing agent execution. Small fixes can join at a narrower point without inventing planning artifacts.

Bridge orchestration must reuse Roadmap + linked Markdown, canonical/Physical Software Map, PlanningMap/PlannedTransformation/WorkItem, Work/runner, AgentTasks/AgentRuns, History and their existing owner stores. No new Chat, Work, Session, Plan/Task ontology, canonical authority or second Markdown writer.

## Eight logical slices

| Slice | Implementation boundary | Qualification emphasis |
| --- | --- | --- |
| **PB1 — State and artifact links** | Derived nine-state workflow, stable project-scoped checkpoint -> PlanningMap/transformations -> WorkItems -> stack/prompt -> run/evidence links; approval/provenance/freshness with one owner per field. | Missing/foreign links, restart, revisions, not-green vs completed, no duplicate source of truth. |
| **PB2 — Checkpoint handoff** | Existing Roadmap inspector **Prepare Work**, requirements handoff to existing center Planning Map; truthful next-action selection. | No second Chat/auto-launch/auto-Run; left/right/center/bottom Chat, keyboard/narrow and restore. |
| **PB3 — Impact and architectural target** | Physical Map/source/docs impact, evidence freshness, current/target/diff, typed PlannedTransformations, review/explicit architecture approval. | No canonical/physical mutation; stale-basis/conflict-aware rebase; source-grounding and targeted analysis. |
| **PB4 — WorkItem preparation** | Transformation-linked bounded WorkItems, working sets, dependencies, acceptance/validation, human/AI/shared ownership, review/split/merge. | Stable IDs, one-to-many/many-to-one, cycle/foreign/stale denial, no false completion. |
| **PB5 — Stack composition and handoff** | Draft editor/manifest under `docs/tasks/` using shared runner grammar, T1/T2/T3 and efficiency audit; human third approval, existing Work after explicit Run. | Validator/version/hash/dirty-source parity, no `/activate`, no draft/open-triggered execution, manual T3 separately. |
| **PB6 — Reconciliation and corrections** | Target-vs-implemented, targeted Physical Map refresh, approved deviations, linked vertical correction stacks, affected-only replan. | Exact source/evidence, original failures retained, approvals invalidated on material target change; no false Green. |
| **PB7 — End-to-end UX and local models** | Full Roadmap -> Map -> WorkItem -> stack -> agent -> review/qualification flow, saved Chat, manual/no-AI and local-model options. | Real browser/Electron, narrow/keyboard/theme, restart/isolation, short bounded Q4 context, authority/egress, manual T3. |
| **PB8 — Evidence and owner closeout** | Single scoped final exact-source audit, reconciled docs/links/status, unresolved/waived issues visible, separate owner acceptance. | Final tests where justified, truth of Green/Not Green/Evidence Gap, no historical rewrite or unauthorized phase advancement. |

These are **workstreams**, not eight fixed prompt files. Run future `/prompt-ass -> /prompt-plan -> /prompt-write <folder>` only on explicit request with actual source inspection and smallest prompt count. Ordinary prompts use <=8-minute target, 10-minute soft/15-minute hard budget; T2 integration and T3 browser/native/manual gates are separate. Prompt authoring alone does not authorize implementation; a later deliberate owner Run does. No activation-only gates.

## Human workflow acceptance scenario

1. Capture/import/brainstorm a Roadmap through the existing saved Chat or manually. Show proposed draft checkpoints live, review and explicitly accept canonical linked Markdown/structured scope.
2. Select approved checkpoint and **Prepare Work**. Display current Physical Map/source impact, unknowns and freshness; do not manufacture missing evidence.
3. Open existing center Planning Map, preserve dockable Chat, inspect current/target/diff, propose/edit typed transformations and explicitly approve target. Canonical **Adopt Target** is independent.
4. Generate editable WorkItems, link checkpoint and transformations, validate dependencies and acceptance/validation criteria.
5. Compose a draft prompt stack/manifest through existing `docs/tasks/` runner conventions and existing efficiency tiers. Show source and boundaries; approve stack without starting agents.
6. Developer chooses Run. Existing Work/ExecutionGrant/isolated candidate/validation/review/Dope promotion and Git checkpoints govern real mutations.
7. Inspect real results, focused or final validations as required, and refresh affected Physical Map branches. Record planned, different, missing and unexpected outcomes; branch correction work when necessary.
8. Record exact-source scope-qualified evidence and separate owner-close; reconcile real Roadmap, Planning Map, WorkItems, Work/History and linked Markdown truth.

**Fast lane:** Issue or tiny correction -> scoped current-code evidence -> applicable Planning Map/WorkItems *or explicit architecture N/A* -> direct Work/validated prompt stack -> implementation/evidence/closeout. Never create fake WorkItems to satisfy a flow or waive grants/validation.

## Cross-cutting qualification matrix

- **Ownership/security:** zero-model use, project isolation, one owner/writer per field, checked revisions, stale/cancel/invalid output, denied cross-owner/foreign/non-granted actions, hosted-consent boundaries.
- **Source recovery:** Markdown mapped-field read/write parity, lossless round-trip, project-local Planning Map basis, prompt grammar/hash/version/paths, missing files, external edits, partial sync, restart.
- **Graph/work integrity:** precise transformation operations, WorkItem dependency cycles, cross-map/checkpoint links, target separate from accepted architecture, one map/many checkpoints and one checkpoint/many stacks.
- **Execution boundary:** approval != run; separate deliberate Run; no `/activate` or magic prompt clicks; candidate review, Dope validation/promotion and real checkpoint truth.
- **Qualification truth:** implemented != qualified != owner-closed; explicit adoption; Green/Not Green/waived/unknown; preserved historical evidence and correction lineage; T3 not faked by builds.
- **UX/local constraints:** truthful next action and recoverability, one saved ChatPanel in every dock, existing Roadmap/Planning Map/Work surfaces, keyboard and narrow states, theme isolation, locally selected model with verified context budget; no silent hosted fallback.

## Readiness and non-goals

Start later implementation assessment from live `BOOT.md`, `AGENTS.md`, applicable ADRs, source and tests; do not assume a historical path is still current. Reuse shared `scripts/codex-phase-core.mjs` prompt grammar, present Work/runner and Chat/Planning owners, `ProjectPlanningActions`, existing map store/basis and read-only History. Separate `c11-brainstorm` implementation/qualification and avoid overlapping worktrees. Phase 12 background source/docs alignment remains separately inactive.

**Next step:** A later explicit request for `/prompt-ass`, `/prompt-plan` and `/prompt-write`; another explicit Run once a stack is ready. This document itself does not write prompts, implement code, run tests, change versions, or qualify a product phase.
