# /prompt-ass — c11-roadmap-redesign (Gate-first re-assessment)

**Latest G3 handoff (2026-10-29, d19833b4):** The originally failed zero-health request recognition has a scoped R3 code/Chrome repair and focused tests, but the **full G3 P4 Chrome matrix remains NOT GREEN / EVIDENCE GAP**, and owner-native Electron is unqualified. Do not rerun or duplicate the already-fixed R3 slice by default; finish remaining P4 gates and native disposition, or obtain a new explicit owner-approved sequencing exception, before c11-roadmap-redesign P1. This docs/prompt authoring does not implement the redesign or qualify Phase 11.

**Date:** 2026-10-29. **Decision:** OWNER-APPROVED replacement of the previously authored P1–P4 presentation-only stack. **Status:** design/assessment only, no execution or validation claim. Baseline main `68cdec71af73` / `0.11.8`.
**Primary authority:** [ADR 0040](../../decisions/0040-phase-gate-roadmap-domain.md), [Roadmap visual contract](../../planning/p11/roadmap-visual-hierarchy-contract.md).
**Prerequisite:** G3 P4 is **CHROME NOT GREEN**, not ready to hand off; see [actual source-bound closeout](../c11-g3-recovery/closeout.md). P1 blocks on its repaired Chrome qualification and owner-native check, unless an explicit new owner sequencing exception.

## Source-backed problem

The reviewed `RoadmapStore` interface currently declares `RoadmapCheckpoint` with `kind: 'phase' | 'correction' | 'milestone'`, and `RoadmapIndex.checkpoints[]`. `roadmap-projection.ts` maps all entries to `CheckpointNode`, with child/ownership and graph edge inference. `roadmap-greenfield.ts` uses `GreenfieldCheckpoint` and `create-checkpoint` actions, and its accepted strategic draft expects a `checkpoints` array per phase; `chat-roadmap-extract.ts` turns phase response bullets into proposed checkpoints. Markdown `roadmap-import.ts`, document sync/patch, ProjectPlanningActions, RoadmapInspectorModel and Dope Help expose checkpoint identity and operations. These are **architectural** seams, not a presentation-only concern. The existing horizontal graph makes Phase/Gate ownership visually ambiguous.

A generic checklist item, implementation step or historical 'milestone' is not automatically a pass/fail Gate. The new primary hierarchy is Phase -> Gate -> Criterion, with explicit project identity, owner authority and verifiable current evidence. Corrections/Work/tasks attach to these entities, not substitutes for them.

## Alpha owner directive

The project is solo alpha. **No backwards compatibility** to old broken checkpoint Roadmap state is required. Delete obsolete types/handlers/aliases/graph cards, stale helper paths, tests and duplicate design charter; do not build a second data owner or alternate Chat. Safety is not backward compatibility: never silently destroy human source files, current project data or historical evidence; old incompatible index gets a clear explicit recovery/reimport path with approval.

## Scope and dependencies

1. P1 authoritative schema/domain + evidence/qualification, explicit parent, ownership/approval and stale semantics.
2. P2 Markdown and source revision lifecycle, greenfield AI/Chat draft and typed planning actions, task-vs-Gate guard.
3. P3 React Flow visual hierarchy and inspector; keep exact screenshot proportions and existing safe interaction.
4. P4 truthful presentation status/count and correction/dependency linkage, current qualifications.
5. P5 existing verified Dope Help and local-Q4/Chat no-write.
6. P6 dead-code deletion, Phase Focus/Work/History/Chat/import/sync/permissions regression, final candidate.
7. P7 independent actual Chrome closeout and owner-native checklist.

The division keeps schema, source contracts, visible UI, qualification math, help, removal/integration and final evidence separate. **Six bounded implementation loops + one final manual closeout**, with up to three repair/qualification cycles per implementation prompt. GPT-6 Sol High recommended; browser required for all. Do not run `npm run check` per prompt; focus tests and affected builds early, one full final check when source coherent.

## Qualification / release risks

- **R1 — False Gate conversion:** Conflating task bullets with qualification Gates invents obligations. Phase-only response stays incomplete; developer explicitly reviews proposed testable criteria.
- **R2 — False Green:** A phase with one Gate is Planned, not qualified; even all required Gates Green require explicit gate-set completeness approval and absence of blockers. Waiver never silently passes. Evidence changes stale a prior Green.
- **R3 — Source corruption:** Ownership rules, Markdown minimal patching, source SHA/revision conflict, proposal accept and separate publication must survive schema cutover.
- **R4 — Cross-feature leftovers:** Phase Focus and Work prompt checkpoints are operational artifacts, not strategic Gates. Internal workflow checkpoint words may still exist only if not Roadmap domain aliases; P6 audits carefully.
- **R5 — Ambiguous ownership:** No inferred parent through title `c11` or visual adjacency when explicit identity is required. Corrections without valid parent stay visible in diagnosed pool.
- **R6 — UX regression:** Nested Gate selection/foldout/inspector must retain saved pan/zoom, keyboard, touch, narrow/chat split and light/reduced-motion.
- **R7 — Execution evidence:** Browser build and unit tests do not prove true Chrome UI; native Electron requires owner-controlled test. Real local Q4 provenance only if actually loaded.
- **R8 — Sequencing:** G3 P4 failed at current main. Do not claim P4/native closed or weaken its separate evidence requirements merely to start this redesign.

## Non-goals

No global model/provider change, no new chat, no second Markdown writer, no runner auto-activation, no autonomous Work or source publication, no broad Phase 12 implementation, no claiming Phase 11 Green, no migration of unsupported alpha checkpoint index. Approved design supersedes presentation-only limits of original prompts; product code remains unchanged until separate manual execution.
