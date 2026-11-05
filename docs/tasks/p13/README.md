# p13 — Roadmap-Controlled Development

**Owner authorization:** 2026-11-05 `/docs-apply + /prompt-plan + /prompt-write p13`, with **coherent `0.13.0` baseline** committed `f908c447`. **Status:** assessment/plan/prompts **AUTHORED ONLY**; **NOT RUN, IMPLEMENTED OR QUALIFIED**. **Decision:** [ADR 0051](../../decisions/0051-roadmap-work-evidence-lifecycle.md). **Detailed contract:** [Phase 13 lifecycle](../../planning/p13/roadmap-work-lifecycle-contract.md). **Baseline:** [p13 baseline](../../planning/p13/baseline.md). **Planning:** [assessment](prompt-assessment.md) and [implementation plan](implementation-plan.md).

The Roadmap is the main entry and monitoring surface; Work executes under its own approvals; source-bound verified Criterion receipts drive existing Gate qualification; distinct owner approval closes the Phase. Do not create another progress checklist, equate Work task success with Gate GREEN, alter `/gen-roadmap` generation, or revive historical failures as Green. Previously reserved LSKM scope is preserved but **deferred unassigned**, not `p13`.

| Order | File | Purpose | Tier |
| --- | --- | --- | --- |
| P1 | [Planning lock authority](P1-phase-planning-lock.txt) | Coverage/revision-checked Finish Planning state, no run | T1 |
| P2 | [Work basis links](P2-work-handoff-links.txt) | Reuse Prepare Work, bind approved Phase/Gate/Criteria to WorkItems | T1/T2 |
| P3 | [Roadmap lock UI](P3-roadmap-planning-controls.txt) | Planning/Ready states and read-only structural controls | T1 UI |
| P4 | [Verified receipt links](P4-work-evidence-receipts.txt) | Checkable Work evidence source and Criterion association | T2 |
| P5 | [Qualification projection](P5-evidence-qualification-projection.txt) | Derived criterion/gate/phase eligibility from valid evidence | T2 |
| P6 | [Amendments and stale evidence](P6-amendment-invalidation.txt) | Source/requirements drift and affected-only requalification | T2 |
| P7 | [Run and History recovery](P7-evidence-history-recovery.txt) | Durable evidence/Work status, restart, replay and cancel | T2 |
| P8 | [Monitoring canvas](P8-roadmap-work-monitoring.txt) | Gate-linked Work activity/evidence/next action on Roadmap | T1 UI |
| P9 | [Integrated security qualification](P9-integration-security.txt) | End-to-end cross-owner invariants and focused aggregate | T2 |
| P10 | [Manual Phase 13 closeout](P10-phase-closeout.txt) | Independent connected Chrome and owner-native real-use evidence | T3 manual |

**Runner compatibility:** exact folder `docs/tasks/p13`, contiguous `P1`–`P10`, target versions `0.13.1` through `0.13.10`, one final closeout. First validate on the owner's actual checkout: `npm run codex:phase:validate -- p13`. Deliberate later `npm run codex:phase -- p13` authorizes the runnable implementation sequence, subject to real local source/dirty-state and security checks. The final P10 is a **manual gate**, not automatic browser simulation; do not use `--closeout` to auto-claim it. Documentation creation does not itself authorize execution.

**Nonnegotiable:** read BOOT/AGENTS/workflow/ADRs 0038/0040/0046–0051, exact contract and current source; preserve owner's dirty files; never reset/stash/clean, self-commit, force-push, auto-promote candidate, bypass Work grant/Ask-Allow or model-switch, rewrite historical P12 evidence, or falsely present a task commit as GREEN. Real actual-source verification is mandatory before a later Run. Ordinary P1–P8 target <=8 minutes; hard stop 15 minutes each; P9 integration and P10 manual may take longer for their explicit evidence purpose. Report each gate independently, pause on insufficient evidence, do not auto-close Phase 13.

