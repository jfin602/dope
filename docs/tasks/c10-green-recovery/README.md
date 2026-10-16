# c10-green-recovery - Phase 10 supplemental qualification

**Current routing (2026-10-16; R6 not started):** The owner reports **R5 GREEN for its Codex-browser/backend/local-Q4 planning scope** at product `af2b0f031c521d5992e3f3cd2125e80f3e6ad619` (version `0.10.16`), evidence commit `f0374f832f861e86053f2c1a2bf02e622d6bbdd1`. Those two commits and final R5 record are **not yet visible on connected GitHub main**; the most recent visible R5 Group 2 report is historically Not Green on an earlier bundle. R6's **first action is to verify local final R5 Group 3/evidence, exact source and bundles**. Missing evidence means blocked, not an inferred Green. Do not overwrite or silently reconcile the user's local commits.

**R6 is next, separately authorized** via [manual R6](manual/R6-final-recovery-closeout.md). This is a one-time exact-source acceptance/evidence audit, not another 16K/32K model matrix or a new product implementation group. The owner-approved [R4 browser-scope contract](qualification/r4-authority-egress/group-2/browser-scope-contract.md) controls safety/egress. R3 separately qualified browser and native Electron **interface** behavior. R4 does **not** qualify native Electron or independent Chrome network traffic, unrelated shared-browser traffic, OS/DNS services or whole-host no-egress. Prior broader Not Green and crash observations remain historical; old [P14](../c10-roadmap-qualify/closeout.md) remains terminal Not Green. Phase 10 remains **NOT GREEN / NOT OWNER-CLOSED**; Phases 11/12 inactive.

## Recovery gate ledger

| Gate | Current source-scoped status | Handoff |
| --- | --- | --- |
| R1 Equipment | READY for owner instrumentation (not actual egress Green) | [R1 pilot](qualification/r1-infrastructure/cycle-1.md) |
| R2 Continuity | GREEN for registered live foreign-owner denial and actual Q4 model-generated greenfield approval, source freshness, rejection and cancellation | [R2 final](qualification/r2-continuity/final-qualification.md) |
| R3 Interface | GREEN for tested browser and independently operated native Electron UI scope, with physical touchscreen excluded | [R3 final](qualification/r3-interface/final-qualification.md) |
| R4 Authority/egress | GREEN **only for owner-approved Codex-browser tab/backend/local-model scope**; older whole-host/native failure records retained | [R4 final](qualification/r4-authority-egress/final-browser-qualification.md), [post-R4 regression](qualification/post-r4-regression.md) |
| R5 Context/reliability | **Owner-reported final GREEN, remote verification pending**; earlier [Group 1](qualification/r5-context/group-1/cycle-1.md) C5/C6/C9/C10 Green, earlier [Group 2](qualification/r5-context/group-2/cycle-1.md) C7 Not Green are chronological, not final R5 proof | Verify actual local `qualification/r5-context/final-qualification.md` / Group 3 and evidence commit |
| R6 Final recovery audit | **NOT STARTED**; verify final-source evidence, final full aggregate, supplemental family matrix, bounded closeout | [R6 prompt](manual/R6-final-recovery-closeout.md) |

## R5 operating-profile boundary

The owner reports exact `qwen3-coder-30b-a3b-instruct@q4_k_m`, loaded context **32,768**, CPU-only, parallel 4 for the Phase 10 planning scope. Q4 16K omitted a late controlling blocker that 32K included. C12 Q4/64K was NOT REQUIRED and not qualified. No global model, AI Center role or context default has changed. Final R5 C7 Green must be verified against its **new final bundle**, not substituted with the original 26-attempt Group 2 failure record.

## Integrity and efficiency

Original manual P9-P14/P16/P19 and old R2/R3/R4 cycle verdicts are immutable historical observations. Inherited passes require source/fixture/seam equivalence. Since product changed after the original `c8c41f9` full aggregate, R6 must run **one `npm run check` on the final source**, unless an exact-tree completed aggregate can be verified, plus validation and diff check; it must not replay all live gates or infer native/whole-host network safety. A new defect needs separate authorization, narrow commit and focused requalification. Closeout and routing reconciliations occur **when R6 runs**, not in this preparation edit. R6 alone decides the new recovery supplement; Phase 10 owner closure is a further explicit decision.
