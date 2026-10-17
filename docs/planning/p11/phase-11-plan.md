# Phase 11 Plan — Human-Centered UI

**Status:** P1–P7 IMPLEMENTED THROUGH `0.11.7` / `8cad838`; [MANUAL P8](../../tasks/p11/known-issue-closeout.md) NOT GREEN ON UNCOMMITTED `0.11.8` CANDIDATE; PHASE 11 PRODUCT NOT QUALIFIED / OPEN. Earlier design and entry paragraphs below are dated history.
**Date:** 2026-10-12; predecessor and version entry reconciled 2026-10-16
**Authority:** ADR 0037; ADRs 0016, 0030, 0036; docs/ARCHITECTURE.md; docs/workflow.md.
**Entry:** [Phase 10 owner closeout](../p10/phase-10-closeout.md) is **SATISFIED** at `0.10.16` / `af2b0f0` for the approved R6 recovery scope (737/737 final-source pass). Phase 9 was owner-closed at `0.9.35`. **The separate version-only `0.11.0` baseline is now established** in [baseline.md](baseline.md) at `70c41e6`; this satisfies version readiness, not implementation. The [initial P1–P8 known-issue prompt stack](../../tasks/p11/README.md) is now authored but **not run**. Only a later explicit owner/developer Run authorizes P1–P7 implementation, and P8 requires manual real-GUI qualification. No separate `/activate` gate is needed. The initial tranche does not close iterative Phase 11. Preserve R6 network exclusions and all historical Not Green records.

## Objective

Make every Dope-owned panel and practical cross-panel flow **obvious, predictable, recoverable and comfortable for a human developer**. Qualify real tasks, not merely visual consistency or presence of controls. The existing `c9-theme-fix` changes only the restrained-orange palette; the comprehensive UX work lives here.


## Owner-approved usability corrections — 2026-10-16

**Authority:** The owner-provided Firelaunch Roadmap/Chat screenshot, followed by /docs-review and explicit /docs-apply. This is observed/reported usability friction, not a code-level reproduction, a passing Phase 11 test, or evidence that the visible Roadmap loading indicator never resolves. Detailed decision/acceptance contract: [usability-recovery-contract.md](usability-recovery-contract.md).

**Three P0 workflows, in proposed implementation order:**
- **P11-A: Roadmap Markdown source replacement.** Selecting the wrong Roadmap must be recoverable from Roadmap > Markdown > Change linked file. Show old/new source, replacement impact, unsynchronized edits and explicit confirmation. Replace the active project Roadmap, not the prior Markdown file on disk. Cancel, incompatible input, stale revisions and failed imports must leave the old link and Roadmap intact. A successful change persists, rebinds synchronization/watchers to the new source, preserves historical evidence and respects project boundaries.
- **P11-B: Human-readable planning Chat output.** Existing shared ChatPanel must surface the user-directed validated message from a planning result (including no-action) as readable assistant prose, without duplicate summaries or false claims of mutation. Keep structured JSON, tool metadata and provenance as compact, muted, initially collapsed, expandable/copyable activity. Do not build a second chat runtime or store.
- **P11-C: Capability-grounded Dope guidance.** When an operation is unavailable/blocked, the assistant explains the actual restriction and how to proceed through a verified supported Dope control or safe fallback. Use bounded capability/navigation data from actual app features; do not hallucinate controls, grant planning Chat Work/Agent rights, or silently change the selected model/provider.

**Next:** after the initial known repairs, run repeatable discovery/triage/repair/verify loops; visual problems are investigated only after direct GUI reproduction. This document authorizes no stack execution.

## Phase 11 operating model — repeatable discovery and repair

**First: a bounded known-issue tranche.** After minimal verification of live registrations/ownership, reproduce and repair the owner-reported P0 Roadmap Markdown relinking, readable no-action/structured Chat messages and Dope-aware guidance problems. The previous source-bound c10-better-planning scoped Green remains historical; investigate whether today's complaint is a regression, missing path or poor presentation.

**Then repeat the four-step usability loop rather than a fixed implementation sequence:**

1. **Hunt (manual GUI):** Run the reusable [Usability Hunter](../../tasks/p11/usability-hunt-manual.md) against genuine user goals in the actual browser/Electron interface. Select under-covered surfaces and task/states from the [coverage matrix](panel-usability-matrix.md). Exercise safe mistakes, error/empty/loading states, recovery, navigation, keyboard, narrow panes, restart and relevant no-model/provider cases. The hunter must not edit product source or automatically run repair prompts.
2. **Triage:** Deduplicate and record observations in the [persistent issue ledger](usability-issue-ledger.md): stable identity, severity P0/P1/P2, reproducibility, screenshots, exact source/version, user impact, suspected owner, evidence class (direct GUI, owner report, source hypothesis, heuristic), and smallest related repair group. Do not treat screenshots or hunches as source-level proof.
3. **Repair:** Author bounded coherent fixes using /prompt-ass → /prompt-plan → /prompt-write, targeting <=8-minute implementation+focused checks (15-minute maximum). A separate explicit owner Run authorizes each implementation stack; no /activate gate, automatic execution from hunt, model/provider switch, or permission escalation.
4. **Verify:** On the actual final candidate, directly replay the original task plus recovery, adjacent ownership/regression, restart/placement and applicable manual T3 GUI checks. Record observed result or Not Green/Evidence Gap. Update the matrix/ledger and return to hunting new or changed flows.

**Repeat with diverse coverage:** There is no predetermined number of loops, and P11 visual investigations and GUI qualification may recur after any repair. A clean hunt without breadth cannot end Phase 11. The initial [U1–U9 gates](usability-recovery-contract.md) qualify the known repair tranche only, not the entire IDE.

**Final exit:** Confirm all actually registered Dope-owned surfaces and representative cross-panel human tasks; no unresolved P0 or material P1 without explicit owner disposition; original fixes verified on a coherent exact-source build; real keyboard, alternate-theme, narrow-pane, error/recovery, restart, no-AI and authority evidence; **two consecutive materially distinct broad hunts finding no new P0/material P1**, subject to sufficient coverage; and explicit human owner acceptance. An issue or phase remains Not Green/Evidence Gap if evidence is missing; no invented human testing or usability scores.

## Acceptance and risk controls

Record the human goal, starting point, observed clicks/actions, task outcome, confusion/friction and recovery, environment, source/version and remaining unknown. A panel can pass with zero source modifications when observed usability is adequate. Product-wide qualification requires inventory coverage and no unresolved material usability blockers; use **Not Green** or **Evidence Gap** when appropriate rather than a made-up score.

Domain state, permissions, Chat/Work single owners, safe Markdown, candidate validation/review, Project Mind/Architecture truth, provider egress and Theia upgradeability must remain untouched by cosmetic decisions. Plan separate T1/T2 focused corrections and meaningful T3 human-GUI gates; do not run full suites on every CSS edit.

Phase 10 is **OWNER-CLOSED / GREEN for its approved R6 recovery scope** as of 2026-10-16; see [its owner-close record](../p10/phase-10-closeout.md). This establishes Phase 11's predecessor. The [version-only `0.11.0` baseline](baseline.md) is established and initial prompts have been authored without execution, **but Phase 11 remains unimplemented and unqualified**. Phase 12 Living Software Knowledge Model remains independently inactive with all ADR 0023 safety boundaries. No phase/version/runner stack is activated by this document.

**Next steps (not yet performed):** Validate the authored [initial p11 stack](../../tasks/p11/README.md) locally with `npm run codex:phase:validate -- p11` (grammar only) and confirm live ownership/known issue reproduction. A later explicit owner Run may start P1–P7; P8 requires manual real-GUI evidence. After scoped fixes, repeat the [Usability Hunter](../../tasks/p11/usability-hunt-manual.md) with the [issue ledger](usability-issue-ledger.md); do not treat authored prompts or a scoped P8 as product Phase 11 Green.
