# c11-work-experience-recovery — Work opening, restoration, and light-theme repair

**Status (2026-10-23):** Assessment, implementation plan, and P1–P4 **AUTHORED ONLY** on `docs/c11-work-experience-recovery`. **NOT IMPLEMENTED / NOT RUN / NOT QUALIFIED.** Starting source: GitHub `main` at `e02c32c10f378318efeca848b2ad88aebbdff6f9`, root version `0.11.8`; this is a remote documentation baseline, not an assertion about the owner's local checkout. Phase 11 remains **OPEN / NOT GREEN**, Phase 12 inactive.

## Evidence-first scope

The existing [P6 NOT GREEN closeout](../c11-work-experience/closeout.md), captured on product source `a9994e780f3090c0afa06d75a43761951ea48b19`, found: (1) selecting two discovered saved Prompt Stacks persisted sequences but displayed `Work unavailable` / "Prompt Stack could not be opened"; History opened the actual saved records, (2) after reload a previously open Work owner tab stayed at `Loading Work…` while History could open a second functioning view, and (3) Light (Theia) rendered unreadable low-contrast Work controls. Required-validation recovery **was not exercised inside Dope**, and independent native Electron GUI **was not observed**. One complete read-only local Work run and one provider-error failed run did not create a verified validation/checkpoint/candidate path. The exact source's `npm run check` passed **775/775 tests**, typecheck, browser and Electron builds; that does not qualify the GUI.

**Aim:** Restore reliable saved-stack opening and Work continuity, produce deterministic recoverable Work loading/errors, fix light theme contrast, and collect honest browser qualification without weakening authorization or fabricating validation Green. Reuse the existing Work, ChatPanel, PhaseStackController, WorkSelectionController, SharedPanelState, History, transcript, and Theia theme architecture.

| Prompt | Delivery | Model | Execution |
| --- | --- | --- | --- |
| [P1](P1-saved-stack-opening.txt) | Saved/discovered Prompt Stack selection uses authoritative sequence identity, opens the right Work, preserves denial and independent grant | GPT-6 Sol High | Headless |
| [P2](P2-work-restore-recovery.txt) | Reload/restoration has bounded state and retry/reopen behavior; no immortal Loading Work or duplicate owner | GPT-6 Sol High | Headless |
| [P3](P3-light-theme-contrast.txt) | Light (Theia) Work controls/status/disabled/focus contrast corrected with theme-aware selectors | GPT-6 Sol Medium | Headless |
| [P4](P4-manual-qualification-closeout.txt) | Real browser retest of P6 failures and safe required-validation recovery, then exact-source W1–W10 evidence; Electron independently if possible | GPT-6 Sol High | **Manual only** |

The [assessment](prompt-assessment.md) and [plan](implementation-plan.md) specify non-goals, evidence, decisions, stop conditions, and exact gate matrix. The original P6 `closeout.md` and all historic Bridge/Phase Focus NOT GREEN records are immutable history, never rewritten or relabeled.

**Execution:** On a reviewed local checkout first run `npm run codex:phase:validate -- c11-work-experience-recovery`. A separately authorized `npm run codex:phase -- c11-work-experience-recovery` may execute **only P1–P3**. P4 is a direct GUI/manual T3 gate **outside** the headless phase runner. No `/activate`. Do not reset/stash/clean owner changes, self-commit during a runner task, silently add dependencies, change version or loosen permissions. Any local differences or uncommitted evidence must be inspected and preserved before implementation. 
