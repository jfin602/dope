# P5 repair loop — cycle 1 (2026-10-18)

**Verdict: FAIL / NOT GREEN.** The owner authorized up to three new qualification/repair cycles after the P5 final attempt. This cycle repaired the exact stale Roadmap canvas assertion that stopped the first aggregate; it did not qualify the full Bridge journey.

## Source and preservation

- Checkout: `/home/jfin/dev/dope`, `main` HEAD `7fa2707a58b44602cd9725c6f0ab94cc0881a962`, plus the already dirty P1–P3 source/tests and P4/P5 evidence. Version remained `0.11.8`; no manifest, internal pin or lockfile changed. `git diff --check` passed. No reset, stash, clean, commit, activation, canonical adoption or model call occurred.
- Original P15 closeout, evidence and log SHA-256 remained `df884d326dad0577d29f1ead90e57e24e28274f531efc720a92579eb5eabe2b1`, `64672af40a5befcf1f78236e14b0999970ff5db6d272abb1befef45b04308b42` and `db23402f2850d6d6254aedfd0a62001beecf6bdeb83ceca1abb68b00c714c53f`. Its NOT GREEN finding is unchanged.

## Reproduction, change and focused replay

- Baseline evidence: [P5 final cycle 1](../p5-final/cycle-1.md) recorded `npm run check` stopping in its first product test group at 624 pass / 1 fail. The failure was `Prepare Work opens the registered center Planning Map with no Chat or agent launch`, which required the old literal `planning.navigationMap(selection.mapId)` even though the P1 repair uses `verifyPrepareWorkNavigation(...)` and preserves fresh owner/basis checks.
- Changed only `test/unit/roadmap-canvas.test.ts`. The assertion now checks the P1 verification call, linked/existing map selection, and `setPrepareWorkContext({ ...selection, planningProjectId })`; the no-Chat/no-agent assertion remains. Final test file SHA-256: `fe0463ae8f55f50e5a2354f8b92b10fc61552892f5d86c91ec870477fafe1858`.
- First exact isolated replay exposed a second outdated literal assertion expecting `setPrepareWorkContext(selection)`; this was corrected in the same cycle. Final focused command: `node --test test/unit/roadmap-canvas.test.ts test/unit/prepare-work-navigation.test.ts test/unit/roadmap-inspector.test.ts test/unit/roadmap-chat-panel.test.ts test/unit/roadmap-chat-drafts.test.ts` — **PASS 30/30**, 0 fail. `git diff --check` — **PASS**.
- No full `npm run check` rerun was made here. A stable final aggregate belongs to the end of the repair loop. No new browser or native GUI replay was made in this test-only cycle. The prior P5 browser observation of an unlinked map, disabled approved WorkItem request, and discovery-only Work remains the open product finding; native stays owner-excluded from P5 and P4 BLOCKED.

## Gate effect

The exact failed test and adjacent Prepare Work/security source checks now pass. D2–D8, PB2–PB8, F4, source-bound browser replay and the final aggregate are **NOT QUALIFIED** by this test-only repair. No navigation, approval, Run or Adopt Target was triggered. Continue with the missing linked-map and downstream workflow assessment in cycle 2; do not promote the P5 or Phase 11 verdict.
