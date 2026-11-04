# c12-rm-orch-fix — runner-compatible continuous tool-loop correction

**Owner authorization:** 2026-11-04 /prompt-ass + /prompt-plan + /prompt-write c12-rm-orch/fix. **Status (2026-11-04):** P1/P2 implementation checkpoints exist; these commits did not independently qualify the worker/browser or native GUI. Manual Qwen3.5-9B P3 was **PARTIAL / NOT GREEN**. A later owner GPT-OSS 20B trial showed both Phases on the canvas, but `roadmap_finish` failed twice and no final Chat response appeared (**PARTIAL / HOLD**). This supersedes the original *prompts authored only* status; it does not rewrite historical P1/P2/P3 evidence. Full qualification remains open. **Canonical authoring home:** [c12-rm-orch/fix](../c12-rm-orch/fix/README.md) with [assessment](../c12-rm-orch/fix/prompt-assessment.md) and [plan](../c12-rm-orch/fix/implementation-plan.md). **Authority:** [ADR 0049](../../decisions/0049-roadmap-phase-orchestration.md), [Roadmap contract](../../planning/p12/roadmap-phase-orchestration-contract.md), [tool-loop design](../c12-rm-orch/continuous-tool-loop/README.md).

This sibling folder exists because scripts/codex-phase-core.mjs requires a single correction slug c<number>-<lower-kebab-slug>. The requested nested path c12-rm-orch/fix cannot run directly. **These are the only executable prompts**; do not duplicate them in the nested directory or change runner grammar.

## Strict sequence

| Step | Prompt | Execution | Required evidence |
| --- | --- | --- | --- |
| R1 / P1 | [Protected continuous tool loop](P1-protected-continuous-loop.txt) | Runner | One Pi execution; Phase 1 validated and staged before tool success; Phase 2 valid in same execution; roadmap_finish checked; source safety |
| R2 / P2 | [Canvas progress and loading](P2-canvas-phase-loading.txt) | Runner | Stage-proven provisional nodes and next-Phase placeholder, nonblocking UI, human Apply transition and no-write protections |
| R3 / P3 | [Connected browser closeout](P3-codex-browser-closeout.txt) | **MANUAL** | One authorized real Qwen3.5-9B two-Phase test, exact stage receipts, visible loading, selected approval/reload; expanded MVP only separately authorized |

Qualification records: [Qwen3.5-9B P3 connected-browser closeout](qualification/2026-11-04-p3-connected-browser-closeout.md) and [GPT-OSS 20B owner observation](qualification/2026-11-04-gpt-oss-20b-owner-observation.md). The GPT-OSS record is a comparison observation, not a rerun or replacement of the Qwen P3 qualification.

Each implementation step requires current local HEAD/status/dirty-diff preflight, verified predecessor interface and source-bound deterministic tests. P3 remains manual and cannot be marked runner PASSED merely from a commit. The old c12-rm-orch P1–P6 checkpoints and P7 NOT GREEN evidence remain historical, not rerun or rewritten.

## Recorded runner invocation — no automatic rerun

    npm run codex:phase:validate -- c12-rm-orch-fix
    npm run codex:phase -- c12-rm-orch-fix

The runner owns successful implementation commits. Do not self-commit, reset/stash/clean, overwrite user work, change model/provider, alter package version 0.12.7, manufacture a completion marker or bypass Pi broker/Ask-Allow/owner approval. Use disposable fixtures, keep each runner step <=8-minute target / 15-minute hard stop, report safe BLOCKED / NOT GREEN if dependencies cannot be proved. Do not launch live Qwen/browser for P1/P2.

**Goal:** An actual model tool may call roadmap_phase repeatedly in one protected Pi agent execution, with Dope serially validating/staging and returning truthful stage receipts. Real nested staged content appears immediately on Roadmap while a subtle Generating next Phase… placeholder shows. Only deliberate owner Apply makes Phases canonical; old per-Phase model-call scheduler and historical response-parsing formats cannot remain as fallbacks.