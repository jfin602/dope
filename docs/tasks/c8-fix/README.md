# c8-fix — Phase 8D qualification repair

Status: **GREEN / QUALIFIED in P6 cycle 2 at committed `0.8.33` source `8748cb4`**. See [closeout](closeout.md). The original P13 remains historically Not Green.
Mode: correction; Roadmap phase: 8; correction version: 0.8.33 (UNCHANGED).

## Basis and purpose

P12 reached committed `0.8.32` (`09fe3bcd`). Original P13 `0.8.33` was Not Green: two WorkItem AgentTasks persisted but could not Start from Work, launch provided no required validation target, and its single aggregate failed at baseline. The originally reported dirty P13 manifests, three test changes and failed closeout/evidence are now preserved in commit `cd9133b`. Correction P1–P5 repaired the Launch → saved-task Start → required validation seam; P6 then qualified it in two cycles with real GUI/Codex and a passing exact-source aggregate. Phase 8E remains inactive.

Repair only the disconnected Launch -> Start -> Validate -> Review seam. Do not rewrite already-approved WorkItem or AgentTask architecture, change permissions, silently transform preexisting invalid persisted tasks, or invalidate earlier direct Work/Prompt Stack Green evidence.

## Approved prompts

| Prompt | Scope | Tier | Model | Browser required |
| --- | --- | --- | --- | --- |
| P1 | Strict nonempty Dope-owned validation on WorkItem launch | T2 | GPT-6 Sol High | no |
| P2 | Explicit validation input in Planning WorkItem UI | T1 | GPT-6 Sol Medium | no |
| P3 | Start the exact saved WorkItem AgentTask through runtime controller | T2 | GPT-6 Sol High | no |
| P4 | Explicit Work detail grant/Start controls for saved task | T1 | GPT-6 Sol Medium | no |
| P5 | Focused Launch -> Start -> Review integration and P13 baseline diagnosis | T2 | GPT-6 Sol High | no |
| P6 | UP TO FIVE Cycle Phase 8D P13 qualification/repair loop and final closeout | T3 | GPT-6 Sol High | yes |

P1-P4 target eight minutes or less including focused tests, hard limit fifteen minutes. P5 concentrates bounded integration tests. P6 alone runs real GUI/Codex, restart, the exact candidate aggregate and five-cycle repair loop. Do not repeat full builds/tests in P1-P5; compile changed package output only when focused tests import compiled lib.

## Historical operator preflight and actual reconciliation

The original operator instruction was to preserve any dirty local P13 work before correction. In this checkout, the P13 `0.8.33` bytes and original Not Green evidence were already committed as `cd9133b`; the correction started clean after P1–P5. The P6 source repair was committed separately as `8748cb4`, and final closeout changes only evidence/current-state documentation. No dirty-tree runner continuation, Git reset, clean or stash was used.

Validation for the actual committed folder: `npm run codex:phase:validate -- c8-fix`
Runner folder token: `c8-fix` (the original `c8d-fix` authoring label is not a valid runner folder in this repository).
The last P6 is a manual/browser closeout. It loops up to five cycles or all Green, and stops NOT GREEN after five without full proof. No automatic Phase 8E activation.

Authority: ADR 0028, ADR 0029, ADR 0031, the Phase 8D plan, stability contract and original P13 closeout instructions.
