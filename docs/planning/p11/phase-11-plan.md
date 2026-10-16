# Phase 11 Plan — Human-Centered UI

**Status:** DESIGN APPROVED / PREDECESSOR PHASE 10 OWNER-CLOSED / NOT ACTIVATED / NOT QUALIFIED
**Date:** 2026-10-12; entry reconciled 2026-10-16
**Authority:** ADR 0037; ADRs 0016, 0030, 0036; docs/ARCHITECTURE.md; docs/workflow.md.
**Entry:** [Phase 10 owner closeout](../p10/phase-10-closeout.md) is **SATISFIED** at `0.10.16` / `af2b0f0` for the approved R6 recovery scope (737/737 final-source pass). Phase 9 was owner-closed at `0.9.35`. **A separate Phase 11 activation and implementation planning are still required**; this design plan is not activation, a `0.11.0` baseline, or qualification. Preserve R6 network exclusions and all historical Not Green records.

## Objective

Make every Dope-owned panel and practical cross-panel flow **obvious, predictable, recoverable and comfortable for a human developer**. Qualify real tasks, not merely visual consistency or presence of controls. The existing `c9-theme-fix` changes only the restrained-orange palette; the comprehensive UX work lives here.

## Workstreams

1. **Verify full UI inventory.** Inspect live Theia registrations, panels, dialogs/overlays, states, navigation, and any Phase 10 Roadmap/Project Mind changes. Use `panel-usability-matrix.md` as an initial checklist, not as proof.
2. **Audit real human tasks.** Select representative high-frequency tasks and verify purpose, entry, next action, feedback, mistakes/recovery, keyboard and narrow panes; distinguish heuristic observations from directly witnessed interaction. Capture P0/P1/P2 issues with reproducible evidence.
3. **Repair shared patterns.** Consolidate unclear actions, confusing hierarchy, inconsistent selection/feedback, excess control density, needlessly complicated navigation and misleading loading/errors via existing presentation components/token rules. No new theme or parallel state owners.
4. **Qualify work/AI and map/planning workflows.** Chat, Work, AI Center, AgentRun, History, Software Map, Physical Map/Flow, Edit Architecture, Planning Map/WorkItems, Roadmap/left inspector/Chat and cross-panel handoff; preserve authority and persistence.
5. **Direct human usability closeout.** Real Dope GUI and disposable project; representative normal and failure workflows, narrow/center/bottom placement where supported, keyboard, restart, no-AI operation, readable alternate theme, evidence-backed correction dispositions and one coherent source/test/build candidate.

## Acceptance and risk controls

Record the human goal, starting point, observed clicks/actions, task outcome, confusion/friction and recovery, environment, source/version and remaining unknown. A panel can pass with zero source modifications when observed usability is adequate. Product-wide qualification requires inventory coverage and no unresolved material usability blockers; use **Not Green** or **Evidence Gap** when appropriate rather than a made-up score.

Domain state, permissions, Chat/Work single owners, safe Markdown, candidate validation/review, Project Mind/Architecture truth, provider egress and Theia upgradeability must remain untouched by cosmetic decisions. Plan separate T1/T2 focused corrections and meaningful T3 human-GUI gates; do not run full suites on every CSS edit.

Phase 10 is **OWNER-CLOSED / GREEN for its approved R6 recovery scope** as of 2026-10-16; see [its owner-close record](../p10/phase-10-closeout.md). This establishes Phase 11's entry predecessor, **not** Phase 11 activation, a `0.11.0` version-only baseline or Phase 11 qualification. Phase 12 Living Software Knowledge Model remains independently inactive with all ADR 0023 safety boundaries. No phase/version/runner stack is activated by this document.

**Future workflow:** explicit owner phase activation, then `/prompt-ass -> /prompt-plan -> /prompt-write p11` after live inspection.
