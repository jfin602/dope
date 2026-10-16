# Phase 11 Plan — Human-Centered UI

**Status:** DESIGN APPROVED / COHERENT `0.11.0` BASELINE ESTABLISHED / NOT ACTIVATED / NOT QUALIFIED
**Date:** 2026-10-12; predecessor and version entry reconciled 2026-10-16
**Authority:** ADR 0037; ADRs 0016, 0030, 0036; docs/ARCHITECTURE.md; docs/workflow.md.
**Entry:** [Phase 10 owner closeout](../p10/phase-10-closeout.md) is **SATISFIED** at `0.10.16` / `af2b0f0` for the approved R6 recovery scope (737/737 final-source pass). Phase 9 was owner-closed at `0.9.35`. **The separate version-only `0.11.0` baseline is now established** in [baseline.md](baseline.md) at `70c41e6`; this satisfies version readiness, not implementation. No `p11` executable stack has yet been authored or run. Planning and an explicit owner/developer Run instruction for that future stack are still required; no separate `/activate` gate is needed under current workflow. Preserve R6 network exclusions and all historical Not Green records.

## Objective

Make every Dope-owned panel and practical cross-panel flow **obvious, predictable, recoverable and comfortable for a human developer**. Qualify real tasks, not merely visual consistency or presence of controls. The existing `c9-theme-fix` changes only the restrained-orange palette; the comprehensive UX work lives here.


## Owner-approved usability corrections — 2026-10-16

**Authority:** The owner-provided Firelaunch Roadmap/Chat screenshot, followed by /docs-review and explicit /docs-apply. This is observed/reported usability friction, not a code-level reproduction, a passing Phase 11 test, or evidence that the visible Roadmap loading indicator never resolves. Detailed decision/acceptance contract: [usability-recovery-contract.md](usability-recovery-contract.md).

**Three P0 workflows, in proposed implementation order:**
- **P11-A: Roadmap Markdown source replacement.** Selecting the wrong Roadmap must be recoverable from Roadmap > Markdown > Change linked file. Show old/new source, replacement impact, unsynchronized edits and explicit confirmation. Replace the active project Roadmap, not the prior Markdown file on disk. Cancel, incompatible input, stale revisions and failed imports must leave the old link and Roadmap intact. A successful change persists, rebinds synchronization/watchers to the new source, preserves historical evidence and respects project boundaries.
- **P11-B: Human-readable planning Chat output.** Existing shared ChatPanel must surface the user-directed validated message from a planning result (including no-action) as readable assistant prose, without duplicate summaries or false claims of mutation. Keep structured JSON, tool metadata and provenance as compact, muted, initially collapsed, expandable/copyable activity. Do not build a second chat runtime or store.
- **P11-C: Capability-grounded Dope guidance.** When an operation is unavailable/blocked, the assistant explains the actual restriction and how to proceed through a verified supported Dope control or safe fallback. Use bounded capability/navigation data from actual app features; do not hallucinate controls, grant planning Chat Work/Agent rights, or silently change the selected model/provider.

**Next:** P11-D directly reproduce and, if confirmed, repair secondary visual/loading/overlay/toolbar/focus/narrow-pane problems; P11-E run exact-source human GUI and model/authority regressions. The screenshot's apparent loading state is an Evidence Gap until directly reproduced. Keep existing Phase 11 all-panel inventory and T1/T2/T3 workflow. No implementation stack has been authored or run; an explicit future owner Run on an authored stack is execution authority without a separate /activate gate.

## Workstreams

1. **Verify full UI inventory.** Inspect live Theia registrations, panels, dialogs/overlays, states, navigation, and any Phase 10 Roadmap/Project Mind changes. Use `panel-usability-matrix.md` as an initial checklist, not as proof.
2. **Audit real human tasks.** Select representative high-frequency tasks and verify purpose, entry, next action, feedback, mistakes/recovery, keyboard and narrow panes; distinguish heuristic observations from directly witnessed interaction. Capture P0/P1/P2 issues with reproducible evidence.
3. **Repair shared patterns.** Consolidate unclear actions, confusing hierarchy, inconsistent selection/feedback, excess control density, needlessly complicated navigation and misleading loading/errors via existing presentation components/token rules. No new theme or parallel state owners.
4. **Qualify work/AI and map/planning workflows.** Chat, Work, AI Center, AgentRun, History, Software Map, Physical Map/Flow, Edit Architecture, Planning Map/WorkItems, Roadmap/left inspector/Chat and cross-panel handoff; preserve authority and persistence.
5. **Direct human usability closeout.** Real Dope GUI and disposable project; representative normal and failure workflows, narrow/center/bottom placement where supported, keyboard, restart, no-AI operation, readable alternate theme, evidence-backed correction dispositions and one coherent source/test/build candidate.

## Acceptance and risk controls

Record the human goal, starting point, observed clicks/actions, task outcome, confusion/friction and recovery, environment, source/version and remaining unknown. A panel can pass with zero source modifications when observed usability is adequate. Product-wide qualification requires inventory coverage and no unresolved material usability blockers; use **Not Green** or **Evidence Gap** when appropriate rather than a made-up score.

Domain state, permissions, Chat/Work single owners, safe Markdown, candidate validation/review, Project Mind/Architecture truth, provider egress and Theia upgradeability must remain untouched by cosmetic decisions. Plan separate T1/T2 focused corrections and meaningful T3 human-GUI gates; do not run full suites on every CSS edit.

Phase 10 is **OWNER-CLOSED / GREEN for its approved R6 recovery scope** as of 2026-10-16; see [its owner-close record](../p10/phase-10-closeout.md). This establishes Phase 11's predecessor. The separate [version-only `0.11.0` baseline](baseline.md) is established, **but Phase 11 remains unactivated, unimplemented and unqualified**. Phase 12 Living Software Knowledge Model remains independently inactive with all ADR 0023 safety boundaries. No phase/version/runner stack is activated by this document.

**Next steps (not yet performed):** inspect current panel/widget registration and live Dope tasks; reconcile [preliminary panel matrix](panel-usability-matrix.md); then `/prompt-ass -> /prompt-plan -> /prompt-write p11` for small, independent implementation tasks. **The owner's explicit later Run action on the authored stack** is execution authorization under [repository workflow](../../workflow.md); do not require preliminary `/activate` or auto-run from this baseline. Begin from `0.11.0`, advance patch versions only for actual implemented checkpoints, and reserve broad GUI/human-task evidence for dedicated T3 gates.
