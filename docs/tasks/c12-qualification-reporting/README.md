# c12-qualification-reporting — Engineering status, evidence and runner progression

**Owner decision:** 2026-11-03. **Status:** ARCHITECTURE / DOCUMENTATION APPROVED ONLY; NOT IMPLEMENTED, NOT RUN, NOT QUALIFIED. Product version `0.12.7` unchanged. [ADR 0048](../../decisions/0048-engineering-qualification-ratings-and-progression.md) · [Detailed contract](../../planning/p12/engineering-qualification-contract.md).

## Problem and goal

Current correction runner marks commits “PASSED” based on matching Git history even when an agent's source-bound conclusion says NOT GREEN. No-change safe stops appear as commit boundary errors. Correction reporting conflates missing features, unobserved GUI, true regressions, unrelated suite failures and unsafe blockers.

Keep strict source-bound final qualification and every security/data-integrity stop, but expose implementation status, evidence status and progression separately. Do not manufacture GREEN or retroactively rewrite existing reports.

## Independent delivery gates (planning only)

| Gate | Work | Acceptance |
| --- | --- | --- |
| Q1 — Policy and docs | ADR 0048, detailed contract, stability/workflow/agent entry references; define taxonomy and safety invariants | Coherent documented meaning, no product-code or history rewrite |
| Q2 — Runner integration | Update `scripts/codex-phase-core.mjs`, `scripts/codex-phase.mjs` and tests for trusted evidence receipts, state dashboard, dependency-aware progression, no-change BLOCKED, safe optional stop-after | Exact-source runner unit/integration/security tests; no fake qualified commit, no dirty-tree/version bypass |
| Q3 — Adoption and qualification | Real correction replay or disposable fixture matrix; make updated templates/status compatible; ensure manual Chrome/native distinctions and legacy prefixes | Independent exact-source cases for PASS/PARTIAL/GAP/BLOCKED/STOP/conditional and historical provenance; actual runner dashboard evidence |

Q2/Q3 implementation prompts are **not authored here**. A later `/prompt-ass + /prompt-plan + /prompt-write c12-qualification-reporting` or equivalent owner authorization is required before executable source, runner tests, or implementation. Do not let this new reporting system stall legitimate ongoing c12-roadmap-sync implementation unless an actual dependency or safety stop requires it.

## Interoperability

- Preserve the immutable P1–P10 authored source and qualification logs for c12-roadmap-sync; its P9 result remains NOT GREEN historically, while the forward summary can say Partial with precise missing canvas creation and native revision-zero generation.
- Do not modify/do not reclassify ADR 0040 product Roadmap qualification statuses. Gate GREEN still needs approved coverage/current evidence, not a prompt receipt.
- The runner's current commit-prefix checkpoint detection is historical implementation provenance only; never promise it already knows future states.
- Source-known false-green, unsafe source writes, unverified approvals, owner project data loss, or mismatched versions are non-waivable stops.
- Whole-product suite debt remains visible with attribution; no blanket waiver of unrelated failing tests.
- No parallel existing corrections or P10 browser closeout automatically run because this README exists.
