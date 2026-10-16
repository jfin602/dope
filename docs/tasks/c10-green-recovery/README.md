# c10-green-recovery - Phase 10 supplemental qualification

**Current R6 outcome (2026-10-16): [GREEN / QUALIFIED FOR THE OWNER-APPROVED RECOVERY SCOPE](closeout.md)** on the independently committed `0.10.16` product tree `af2b0f0` (byte-equivalent replay `4c15298`). The R5 evidence tree at reported `f0374f8` and local replay is identical. The exact-source full check and R6 assertion audit passed. R3 qualifies native **UI**, while R4 network qualification covers only the Codex-browser Dope tab, backend and local model; native/independent-browser/whole-host network negatives remain unqualified. Explicit Q4_K_M/32768 CPU-only/parallel-4 is the scoped Phase 10 planning operating profile, not a global default; Q4/64K was not required or qualified. Original P14 and earlier failed cycles remain historical Not Green. **Phase 10 owner-close is a separate decision; Phases 11/12 remain inactive.** Older routing below is dated history.


**R6 was executed separately** under [manual R6](manual/R6-final-recovery-closeout.md). The owner-approved [R4 browser-scope contract](qualification/r4-authority-egress/group-2/browser-scope-contract.md) controls safety/egress. R3 separately qualified browser and native Electron **interface** behavior. R4 does **not** qualify native Electron or independent Chrome network traffic, unrelated shared-browser traffic, OS/DNS services or whole-host no-egress. Prior broader Not Green and crash observations remain historical; old [P14](../c10-roadmap-qualify/closeout.md) remains terminal Not Green. Phase 10 is **NOT OWNER-CLOSED**; Phases 11/12 inactive.

## Recovery gate ledger

| Gate | Current source-scoped status | Handoff |
| --- | --- | --- |
| R1 Equipment | READY for owner instrumentation (not actual egress Green) | [R1 pilot](qualification/r1-infrastructure/cycle-1.md) |
| R2 Continuity | GREEN for registered live foreign-owner denial and actual Q4 model-generated greenfield approval, source freshness, rejection and cancellation | [R2 final](qualification/r2-continuity/final-qualification.md) |
| R3 Interface | GREEN for tested browser and independently operated native Electron UI scope, with physical touchscreen excluded | [R3 final](qualification/r3-interface/final-qualification.md) |
| R4 Authority/egress | GREEN **only for owner-approved Codex-browser tab/backend/local-model scope**; older whole-host/native failure records retained | [R4 final](qualification/r4-authority-egress/final-browser-qualification.md), [post-R4 regression](qualification/post-r4-regression.md) |
| R5 Context/reliability | GREEN for the recorded browser/backend/local-Q4 planning scope; C1–C11 Green, C12 Not Required; old failures retained | [R5 final](qualification/r5-context/final-qualification.md) |
| R6 Final recovery audit | GREEN for the owner-approved recovery scope after exact-source aggregate and carryover audit | [R6 closeout](closeout.md) and [matrix](qualification/r6-closeout/acceptance-matrix.md) |

## R5 operating-profile boundary

R5 directly observed exact `qwen3-coder-30b-a3b-instruct@q4_k_m`, loaded context **32,768**, CPU-only, parallel 4 for the Phase 10 planning scope. Q4 16K omitted a late controlling blocker that 32K included. C12 Q4/64K was NOT REQUIRED and not qualified. No global model, AI Center role or context default has changed. R6 verified final R5 C7 evidence against its final bundle; the original 26-attempt Group 2 failure record remains historical.

## Integrity and efficiency

Original manual P9-P14/P16/P19 and old R2/R3/R4 cycle verdicts are immutable historical observations. Inherited passes require source/fixture/seam equivalence. Since product changed after the original `c8c41f9` full aggregate, R6 must run **one `npm run check` on the final source**, unless an exact-tree completed aggregate can be verified, plus validation and diff check; it must not replay all live gates or infer native/whole-host network safety. A new defect needs separate authorization, narrow commit and focused requalification. Closeout and routing reconciliations occur **when R6 runs**, not in this preparation edit. R6 alone decides the new recovery supplement; Phase 10 owner closure is a further explicit decision.
