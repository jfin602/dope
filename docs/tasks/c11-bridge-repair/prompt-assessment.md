# /prompt-ass — c11-bridge-repair

**Status:** OWNER-REQUESTED ASSESSMENT / MANUAL-QUALIFICATION REPAIR LOOPS AUTHORED ONLY. **No implementation, test run, qualification or product-version change.**
**Review basis:** GitHub `main` at `7be9140ac22dd4ea5e9393ba0670d4e0119a8029`, coherent `0.11.8`, plus owner's **separately reported local** P15 failure on `11e1f76` (short SHA unverified from this connection). The owner's uncommitted `docs/tasks/c11-planning-bridge/closeout.md` and `qualification/p15-manual/evidence.json` are **not accessible via GitHub**; preserve/read those **on the real local checkout** before any mutation. Never promote a reported assertion into independently inspected file evidence.
**Authority:** [ADR 0038](../../decisions/0038-planning-bridge-and-idea-to-implementation-workflow.md), [Phase 11 plan](../../planning/p11/phase-11-plan.md), [PB1–PB8](../../planning/planning-bridge/plan.md), [original P1–P15](../c11-planning-bridge/README.md), [prior NOT GREEN P15](../c11-planning-bridge/closeout.md) (local until preserved).
**Phase:** 11 OPEN / NOT QUALIFIED; Phase 12 inactive.

## Confirmed versus unverified observations

- **Owner-reported, local P15:** actual Prepare Work browser journey cannot open the existing Planning Map because frontend compares distinct Roadmap and Planning Map owner IDs; final-source check **623 passed / 2 failed**; browser and Electron builds passed; independent Electron GUI journey not observed. Local model unloaded/services stopped. Original P15 evidence and closeout uncommitted and product source/version unchanged during that qualification.
- **Verified in older committed source:** `RoadmapStore.commit()` may generate `randomUUID()` for its owner project ID, whereas `PlanningStore.mutate()` creates `project-${randomUUID()}` for Planning owner identity. These are separate owner namespaces. `RoadmapPlanningLinks.resolve()` compares each record to the **Planning** project's owner ID and basis, not to Roadmap's unrelated ID, and validates the common root. A bridge frontend requiring equality of these owner IDs is therefore likely erroneous; the **actual failing line in unpushed source is uninspected**.
- **Current remote gap:** GitHub `main` is older than the user's local P15 `11e1f76`; neither failing test name, assertion nor stack implementation SHA has been verified. Repair plans below must first re-resolve local file bytes, logs and project state.
- **Immutable history:** Existing authored `c11-planning-bridge/P1–P15*.txt` and runner/Git snapshots cannot be reordered, edited or replayed merely to repair P15. Original P15 NOT GREEN and any later loop failure remain append-only evidence. Corrections use a new independent stack.
- **Scope of qualification:** PB1–PB8 and Bridge-scoped D1–D8 plus all required safety, project-switch, restart, local-model and direct GUI gates. This is **not** a substitute for separate Phase 11 clean usability Hunts and explicit phase owner closeout.

## Five manual qualification families

| Prompt | One blocker or decision family | Initial evidence | Repair style | Gate |
| --- | --- | --- | --- | --- |
| **P1 — Cross-owner Prepare Work** | Browser navigation blocked by Roadmap/Planning owner-ID equality | Original browser action, exact local frontend line, owner IDs/root/handles | Observe -> trace -> minimal checked identity fix -> focused tests -> actual browser replay | T3 manual |
| **P2 — First failed test** | Exact first failing test in saved 623/2 final aggregate | Test command, first failure name/assertion/log | Locate/triage; if distinct fix narrowly, if P1 already resolves it verify and record no extra edit | T2 + manual evidence |
| **P3 — Second failed test** | Exact second failing test in saved 623/2 final aggregate | Second failure name/assertion/log | Independent disposition; do not change or suppress tests solely to make green | T2 + manual evidence |
| **P4 — Native Electron GUI** | Missing independent Electron *GUI* evidence, not a failed Electron build | Installed/built asset and available window automation evidence | Real native journey and authority/UX negatives; if impossible label Evidence Gap/BLOCKED, no fake native pass | T3 manual |
| **P5 — Full bridge qualification closeout** | Reconcile all previously failing or unobserved PB/D gates on a stable repaired source | P1–P4 source-bound loop dispositions, P15 original, full check | Real browser/local model/no-model D1–D8, final single aggregate as applicable, independent native results; final source-bound Green/Not Green/Evidence Gap | T3 manual |

These five are **manual, separately operated** prompts, *not* headless code-writing tasks. Each repair family allows up to **three bounded evidence-driven cycles**; a setup/preflight attempt is not fabricated as a repair cycle. An observed single root cause may close multiple gates only with independently recorded affected assertions and replay; **P2 and P3 retain separate outcomes** even when P1 fixes both. If P4 is unobservable, full qualification cannot claim Electron GUI success or overall Green under unwaived requirements.

## Efficiency and authority

- Preserve a narrow, one-blocker-at-a-time manual loop and reuse source-applicable evidence. Make a **minimal** implementation fix only after verified local diagnosis and explicit owner manual Run/approval; use actual test paths, changed package output and `git diff --check`. Do not demand full `npm run check` after each cycle. Run one stable final-source aggregate at P5; any intervening code changes invalidate affected evidence.
- P1–P4 can exceed ordinary 8-minute agent prompt budget because they are **manual T3/T2 qualification/repair families**; each *implementation patch within a loop* should remain bounded, one responsibility, with focused validation and stop/reassess at 15 minutes rather than repeatedly escalating a blind fix.
- Preserve exact source SHA, version, dirty state, local test logs, provenance, hashes and user approvals. Do not commit/push/clean/stash/reset the user's uncommitted P15 evidence or edit original P1–P15; no agent self-commit. Record each manual loop in a distinct `qualification/` record, including observed, unknown, reproduced and failed statuses. Save a final independent `closeout.md` only after actually running P5.
- Do **not** introduce a common global owner ID by rewriting stored Planning or Roadmap identities. Trust the canonical workspace-root binding and enforce independent owner project IDs, map revisions and basis, with project isolation, stale proof and no silent source writes.
- Preserve local-only model selection and provider/egress authority; Phase 12 background knowledge model, Development Sessions and separate Chat/Work/task systems remain out of scope.

## Prompt-efficiency audit

Five manually executed families are justified by **three distinct reported blockers** (a broken handoff, two separate failing tests, and a native GUI evidence gap) plus a **single final full qualification decision**. P2/P3 each require exact failure identification before any fix; same-root errors can be resolved with no redundant code work. No routine P1–P4 full-suite repetition; manual final P5 owns source-bound aggregate and one closeout. Every prompt has a hard stop and clear acceptance/verdict; `Browser required: yes.` marks each as a manual gate through the existing parser. No `/activate` prerequisite; prompt authoring does **not** execute anything.

**Unresolved before Run:** Local project source `11e1f76`/working tree, original uncommitted P15 evidence/test logs, ownership of all files, and live test environment. Must be inspected on the real machine; failure to recover those records blocks claims based on them.
