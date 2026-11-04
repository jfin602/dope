# c12-rm-orch/fix — continuous Pi tool-loop correction

**Owner request:** 2026-11-04 /prompt-ass + /prompt-plan + /prompt-write c12-rm-orch/fix. **Status:** Documentation and implementation prompts authored only; no product code, runner execution, model trial or qualification. **Authority:** [ADR 0049](../../../decisions/0049-roadmap-phase-orchestration.md) and [forward contract](../../../planning/p12/roadmap-phase-orchestration-contract.md).

This is the requested **assessment and planning home**. The existing runner's folder-name parser only accepts a single correction slug, not a nested path such as c12-rm-orch/fix. To preserve runner compatibility without altering the runner, the **sole executable prompt files** live in the linked sibling [c12-rm-orch-fix](../../c12-rm-orch-fix/README.md). No duplicate runnable stacks or compatibility wrapper.

Read [assessment](prompt-assessment.md) and [implementation plan](implementation-plan.md).

## Correction responsibilities

- **R1 / Runner P1:** Replace the independent per-Phase inference scheduler with one protected continuous Pi execution and native sequential roadmap_phase tool operations. Stage each Phase **before** returning successful tool results. Finish with validated roadmap_finish. No new writer, fallback, or permissive bypass.
- **R2 / Runner P2:** Show every server-validated, noncanonical Phase/Gate/Criterion on the live canvas as Staged · Provisional, with a subtle visual-only Generating next Phase… placeholder. Preserve a truthful owner-Apply-only canonical transition and all source/cancel/revision safeguards.
- **R3 / Manual P3 closeout:** One authorized Qwen3.5-9B two-Phase connected Codex Browser test after source qualification. Expand to a full tower-defense test only on separate authorization and successful two-Phase evidence.

Prior c12-rm-orch P1–P6 commits, P7 NOT GREEN, original prompts and historical evidence are preserved. A model tool completing is **not** proof of StageOwner success. The owner’s exact top-level /gen-roadmap command and Ask/Allow/lease/revision/source checks remain mandatory. The actual local worktree, including any uncommitted P7 or skill-picker edits, must be inspected before implementation. No reset/stash/clean or overwriting project work.