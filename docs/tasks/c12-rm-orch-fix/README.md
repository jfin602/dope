> **2026-11-04 POST-P3 POLISH FOLLOW-ON — DOCS ONLY:** The real selected-model two-Phase Pi flow was observed in [P3 qualification](qualification/2026-11-04-p3-connected-browser-closeout.md), but P3 remained PARTIAL/NOT GREEN. [c12-rm-orch-polish](../c12-rm-orch-polish/README.md) now owns source-drift/cleanup regression, ordinary Roadmap Apply History, theme-consistent icon review tabs, one Chat tool/reasoning timeline and strict footer-last layout. First P1–P3 runner source steps, then deliberate M1–M3 manual browser UI steps; do not rerun or rewrite original P1–P3 source prompts/reports as polish implementation. No product changes authorized by this note.

# c12-rm-orch-fix — runner-compatible continuous tool-loop correction

**Owner authorization:** 2026-11-04 /prompt-ass + /prompt-plan + /prompt-write c12-rm-orch/fix. **Status:** Prompts AUTHORED ONLY; no source implementation, runner execution, real inference, browser test, version change or qualification. **Canonical authoring home:** [c12-rm-orch/fix](../c12-rm-orch/fix/README.md) with [assessment](../c12-rm-orch/fix/prompt-assessment.md) and [plan](../c12-rm-orch/fix/implementation-plan.md). **Authority:** [ADR 0049](../../decisions/0049-roadmap-phase-orchestration.md), [Roadmap contract](../../planning/p12/roadmap-phase-orchestration-contract.md), [tool-loop design](../c12-rm-orch/continuous-tool-loop/README.md).

This sibling folder exists because scripts/codex-phase-core.mjs requires a single correction slug c<number>-<lower-kebab-slug>. The requested nested path c12-rm-orch/fix cannot run directly. **These are the only executable prompts**; do not duplicate them in the nested directory or change runner grammar.

## Strict sequence

| Step | Prompt | Execution | Required evidence |
| --- | --- | --- | --- |
| R1 / P1 | [Protected continuous tool loop](P1-protected-continuous-loop.txt) | Runner | One Pi execution; Phase 1 validated and staged before tool success; Phase 2 valid in same execution; roadmap_finish checked; source safety |
| R2 / P2 | [Canvas progress and loading](P2-canvas-phase-loading.txt) | Runner | Stage-proven provisional nodes and next-Phase placeholder, nonblocking UI, human Apply transition and no-write protections |
| R3 / P3 | [Connected browser closeout](P3-codex-browser-closeout.txt) | **MANUAL** | One authorized real Qwen3.5-9B two-Phase test, exact stage receipts, visible loading, selected approval/reload; expanded MVP only separately authorized |

Each implementation step requires current local HEAD/status/dirty-diff preflight, verified predecessor interface and source-bound deterministic tests. P3 remains manual and cannot be marked runner PASSED merely from a commit. The old c12-rm-orch P1–P6 checkpoints and P7 NOT GREEN evidence remain historical, not rerun or rewritten.

## Execution — only after owner explicitly chooses Run

    npm run codex:phase:validate -- c12-rm-orch-fix
    npm run codex:phase -- c12-rm-orch-fix

The runner owns successful implementation commits. Do not self-commit, reset/stash/clean, overwrite user work, change model/provider, alter package version 0.12.7, manufacture a completion marker or bypass Pi broker/Ask-Allow/owner approval. Use disposable fixtures, keep each runner step <=8-minute target / 15-minute hard stop, report safe BLOCKED / NOT GREEN if dependencies cannot be proved. Do not launch live Qwen/browser for P1/P2.

**Goal:** An actual model tool may call roadmap_phase repeatedly in one protected Pi agent execution, with Dope serially validating/staging and returning truthful stage receipts. Real nested staged content appears immediately on Roadmap while a subtle Generating next Phase… placeholder shows. Only deliberate owner Apply makes Phases canonical; old per-Phase model-call scheduler and historical response-parsing formats cannot remain as fallbacks.