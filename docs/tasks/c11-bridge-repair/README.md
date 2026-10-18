# c11-bridge-repair — Manual Planning Bridge qualification repair loops

**Status (2026-10-18 America/Chicago):** OWNER-REQUESTED `/docs-apply + /prompt-ass + /prompt-plan + /prompt-write`, **documentation/manual prompts authored only, NOT RUN, IMPLEMENTED OR QUALIFIED**. Historical P15 on locally reported product `11e1f76` / `0.11.8` is **NOT GREEN**. Its original `../c11-planning-bridge/closeout.md` and `qualification/p15-manual/evidence.json` are reported **uncommitted and not present on GitHub main**, so no independent assertion about their bytes, test names or final candidate is made. Remote assessment baseline `7be9140`; reconcile with live local checkout before running.

**Goal:** Narrow manual Observe → Diagnose → authorized minimal Repair → Focused Verify loops for each P15 blocker, then **one final full Planning Bridge qualification** on a stable committed source. Preserve the accepted ADR 0038 architecture, `c11-planning-bridge/P1–P15` authored prompt immutability and historical failure; no version bump, second Chat/Work/Plan, automatic canonical adoption/Run, silent hosted fallback or Phase 12 activation.

| Prompt | Manual blocker family | Gate |
| --- | --- | --- |
| [P1](P1-prepare-work-owner-identity.txt) | Broken real browser Prepare Work → Planning Map cross-owner identity | Manual T3 |
| [P2](P2-first-failed-test.txt) | First exact final-source failing test (name determined from preserved P15 log) | Manual T2/repair |
| [P3](P3-second-failed-test.txt) | Second distinct final-source failing test; skip duplicate repair, **not** verification | Manual T2/repair |
| [P4](P4-independent-electron-gui.txt) | Unobserved independent native Electron GUI flow and owner security | Manual T3 |
| [P5](P5-full-qualification-closeout.txt) | Full PB1–PB8 / Bridge D1–D8 + F4 + exact-source aggregate, single final disposition | Manual T3 |

**Execution:** All P1–P5 are **manual** with `Browser required: yes.`; no headless `codex:phase` run, no self-commit or automatic qualification. Each targeted blocker permits at most three bounded evidence-driven repair cycles with its own report, then independent family status. If a failure is already resolved by an earlier repair, its family still verifies the actual original assertion and records that no further product edit was required. Final P5 is attempted on stable source after all applicable families; failed/blocked gates remain visible, not silently waived.

**Non-negotiable preflight:** Preserve original uncommitted P15 closeout/evidence and failing test log **before** edits; inspect local HEAD, clean/dirty status, built assets, source hash, `0.11.8`, current duplicate/foreign owner references, and the local reported `11e1f76`. GitHub remote `main` does not include that local source; **do not reset, overwrite, stash, clean or fast-forward** without explicit reconciliation. For GitHub-authored docs, merge/cherry-pick on the correct checkout only after safeguarding local evidence. Local syntax validation: `npm run codex:phase:validate -- c11-bridge-repair` on the actual checkout, **not** authorization to run.

**Records:** [Assessment](prompt-assessment.md), [implementation/qualification plan](implementation-plan.md), [ADR 0038](../../decisions/0038-planning-bridge-and-idea-to-implementation-workflow.md), [Phase 11 plan](../../planning/p11/phase-11-plan.md). Per-cycle evidence under `qualification/pN-<family>/`; write **new** `closeout.md` only after P5 is actually run. Keep historical NOT GREEN, local-Q4 provider unload/service stop, Phase 11 OPEN/NOT QUALIFIED, Phase 12 inactive. No new design architecture or implementation version is claimed.
