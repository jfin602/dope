# c11-guidance — Dope-aware Roadmap link guidance repair

**Status (2026-10-16 P3 handoff):** P1 `4f88101` and P2 `3acbb6e` committed at unchanged `0.11.8`; [manual P3](closeout.md) completed **NOT GREEN** in the browser/local-Q4 scope. Phase 11 remains OPEN / NOT QUALIFIED. The execution instructions below record the original owner-approved stack route.
**Date:** 2026-10-16. **Baseline:** committed main `266720b`, coherent package `0.11.8`. **Mode:** Correction 11 at unchanged version `0.11.8`, not a product phase bump.
**Source failure:** [P11 manual P8](../p11/known-issue-closeout.md) is **NOT GREEN**, UX-003, despite passing 738 tests and successful browser Roadmap replacement/readable no-action. The exact "I linked the wrong Roadmap, how do I change it?" fails whereas "How do I change the linked Roadmap file in Dope?" succeeds. Historical P8 result and screenshot hashes remain immutable.

| Prompt | Owner / primary result | Tier | Model | Browser |
| --- | --- | --- | --- | --- |
| [P1 intent classifier](P1-intent-classifier.txt) | Natural-language matcher + positive/negative corpus | T1 | GPT-6 Sol Medium | no |
| [P2 help routing](P2-help-routing.txt) | Shared ChatBackend/composer, grounded help, strict Q4 no-action + authority regressions | T2 | GPT-6 Sol High | no |
| [P3 guidance closeout](P3-guidance-closeout.txt) | Direct saved Chat/browser/local Q4 qualification and scoped disposition | T3 | GPT-6 Sol High | **yes — manual** |

## Execution instructions

Read [assessment](prompt-assessment.md), [plan](implementation-plan.md), [issue ledger](../../planning/p11/usability-issue-ledger.md) and [P8 failure](../p11/known-issue-closeout.md). The correct order is **P1 → P2 → P3**; P3 is the **only final closeout**, manually performed with real browser tools, and must **not** be auto-run by headless phase runner. Authoring this stack is not authorization to execute it.

Once the owner separately chooses Run, first inspect current Git HEAD/version/dirty tree and concurrent tasks, then validate locally: `npm run codex:phase:validate -- c11-guidance`. Start implementation with `npm run codex:phase -- c11-guidance`. No separate /activate gate. Runner owns implementation checkpoint commits; agents must not self-commit. No version changes or package lockfile churn; **all P1–P3 keep `0.11.8`**. The manual P3 records exact tested source, real Q4 responses and any residual gaps.

## Boundary and subsequent work

Fix the deterministic capability selector instead of creating an AI classifier or hardcoding a UI response, and verify no selected-checkpoint Objective detour or unauthorized file writes. The existing ChatPanel, strict local no-action transport, provider selection and source permissions remain authoritative. Native Electron GUI and consent-dependent Codex/hosted parity stay Evidence Gaps unless separately exercised; their absence may be explicitly out of scope of a **browser/local-Q4-only correction**, never silently upgraded to product-wide Green.

After P3, regardless of correction outcome, Phase 11 remains **OPEN / NOT QUALIFIED** until separate [manual Usability Hunter](../p11/usability-hunt-manual.md) exploration, repeatable correction loops, broad coverage and explicit owner acceptance. Suggested first different hunt remains History → Continue → Work review in a disposable project.
