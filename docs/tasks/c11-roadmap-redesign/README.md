# c11-roadmap-redesign — Owner-approved screenshot-matched Roadmap UI

**Date:** 2026-10-29 (America/Chicago)
**Status:** `/prompt-ass + /prompt-plan + /prompt-write` **COMPLETED AS DOCUMENTATION** ON GITHUB MAIN. **No product implementation, Codex browser test, local stack validation or qualification executed by this authoring.**
**Required unchanged version:** `0.11.8` at the reviewed main baseline; recheck local HEAD/dirty tree/current version at Run.
**Canonical correction/runner name:** `c11-roadmap-redesign`. The earlier [`c11-roadmap-visual-hierarchy` charter](../c11-roadmap-visual-hierarchy/README.md) records the same approved design and is **not** a competing prompt stack.
**Owner's exact image style:** conversation attachment `this-style.png` (2026-10-29), represented textually in [locked visual/functional contract](../../planning/p11/roadmap-visual-hierarchy-contract.md). The attachment has not been checked into the repository.

[Prompt assessment](prompt-assessment.md) · [Implementation plan](implementation-plan.md) · [ADR 0036 forward amendment](../../decisions/0036-unified-roadmap-and-local-first-ai-planning.md) · [Phase 11 UX-021](../../planning/p11/usability-issue-ledger.md).

## Ordering: G3 first, then this UI stack

The owner elected **`c11-g3-recovery` P4 Chrome qualification -> owner-native G3 verification -> this Roadmap redesign**. Do not execute P1 merely because these prompts exist. At review, the G3 README reported P2 scoped Green but P3/P4/native pending. Record the **actual** P4 source-bound verdict and owner-native observations first, or a later explicit owner-approved sequencing exception. The redesign changes the canvas and must not invalidate unfinished G3 proof silently. No need to mark all Phase 11 Green before undertaking this correction.

## Execute individually — three bounded repair/qualification loops + independent P4

| Prompt | Scope | Browser gate |
| --- | --- | --- |
| [P1 — phase hierarchy](P1-phase-card-hierarchy.txt) | Large horizontal phase containers; nested expandable checkpoint rows; clear phase arrows; preserve editor/inspector/viewport and G3 draft | **Required real Codex Google Chrome** on current served app; max 3 bounded cycles; screenshot style/interaction PASS before P2 |
| [P2 — progression and relationships](P2-status-relationship-truth.txt) | Zero accepted children dim; first accepted child warm Planned (not Green); evidence-backed canonical statuses/bars; parent correction and dependency clarity | **Required real Chrome** status/correction/proposed fixtures; max 3 cycles; truthful progress PASS before P3 |
| [P3 — Dope Help and integration](P3-dope-help-regression.txt) | Existing capability-help + saved local Q4 state-grounded answers; viewport/theme/Markdown/Chat/G3 cross-seam checks | **Required real Chrome/local model where available**; max 3 cycles; no false guidance/no write PASS before P4 |
| [P4 — independent Chrome closeout](P4-chrome-closeout.txt) | Exact-source visual/authority/manual GUI acceptance + separate owner-native handoff | **Required real Chrome**, no further implementation loop by default; preserve native gap |

All four have `- Browser required: yes.` and `GPT-6 Sol High` recommendation; P4 is the one final closeout by filename/title. Each loop should target small <=8-minute implementation slices but never omit direct GUI verification or fake elapsed time; stop immediately on unrepaired NOT GREEN/BLOCKED, do not burn more than three cycles per implementation loop. Use focused unit tests/affected build per slice; avoid repeated full `npm run check`. An exact-source full check is optional in independent P4 if feasible and not duplicative.

## Runner / manual Codex Chrome route

1. Check G3 P4 + owner-native prerequisite and current exact local source/version/dirty tree; no overrides of existing active changes.
2. Validate grammar **locally**: `npm run codex:phase:validate -- c11-roadmap-redesign`. This was not executable through documentation authoring.
3. Run individual P1 prompt in **Codex with the real Chrome browser enabled**, qualify source-bound UI and record evidence; only on PASS manually proceed P2, P3, then P4. **Do not** call `npm run codex:phase -- c11-roadmap-redesign` as a headless substitute: Browser-required stages must hand off to real GUI, not be silently treated as passed. No manual `/activate` step.
4. Use disposable project fixtures for draft/rejection/permissions; never mutate the persistent PixiJS tower-defense game merely for testing. Safeguard workspace and owner revision, no reset/stash/clean/force push, no additional branch, no surprise changes to main.
5. P4 returns Chrome scope verdict and **owner-operated native Electron checklist**; native parity must be re-observed for changed Roadmap presentation, not inferred from G3 or build success.

## Locked behavior

Match supplied image visual grammar: charcoal rounded and readable phase cards with small PHASE label, title, meaningful thin bar, divider; child checkpoints are compact nested foldouts with icons/chevrons; directional arrowheads between phases; dim empty, warm Planned, orange Active, green truly qualified, muted red Not Green, distinct Waived/Unknown. Do not add an unsupported canonical `planned` status or pretend structural presence qualifies implementation. Proposed drafts visually not accepted; linked Markdown publication still separately approved. Correction/task ownership and true dependency information remain preserved but the default view is uncluttered.

Reuse existing React Flow Roadmap editor and `RoadmapStore`/`RoadmapGreenfield`/`ProjectPlanningActions` and editor inspector; keep saved dockable ChatPanel, existing Dope Help registry, theme tokens, pan/zoom/Focus/Fit, accepted/proposed/Markdown revisions and history. Do not create second Chat/help agent/data owner, auto-Work or prompt execution. Preserve c10-horizontal-color/c11-guidance historical scope and Phase 11 **OPEN / NOT QUALIFIED**.

**Authored only, not Run.** Next action after G3 handoff: locally validate stack and manually execute P1 with Codex browser.
