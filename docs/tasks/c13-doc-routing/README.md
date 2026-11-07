# c13-doc-routing — Phase 13 documentation production and task-anchored Work routing

> **2026-11-07 owner decision:** [P8 is OWNER GREEN / owner accepted for progression](qualification/p8-owner-acceptance-2026-11-07.md). The owner explicitly releases original p13 P9 despite P8's PARTIAL / NOT GREEN technical report and remaining live evidence gaps. P9 is UNBLOCKED and ready for its original manual browser checkpoint; no P8 rerun is required for entry. P9, P12, F1 and P13 retain their own gates, and no product Roadmap Gate or Phase is GREEN by this decision. Earlier dated entry rules below are historical where they require P8 technical PASS before P9.

> **2026-11-07 current UI refinement:** The user-facing documentation flow is `/docs-review` → proposal card **Accept / Reject / Revise Proposal**. Accept calls the existing guarded application path; Revise Proposal selects the same pending candidate for a later owner-submitted `/docs-review` turn. The former apply command in the 2026-11-05 prompt stack and P8 record is historical. Do not rewrite executed prompts or earlier NOT GREEN evidence. The new card workflow needs separate live qualification before any P8 PASS claim.

> **2026-11-05 OWNER-APPROVED STACK EXPANSION AT 0.13.8:** This is the **single active correction** for Documentation Management (/docs-review, /docs-apply) **and** task-anchored AGENTS-first Work consumption. The earlier c12-docs-skills P1–P4 are unexecuted design sources, **not** a second stack to run. Retain ADR 0041 and its document-application safety contract in full. Preserve the original p13 P1–P13 prompts, version sequence and independent P4/P9/P12/P13 qualification gates. Prompt authoring is not product implementation or qualification.

**Actual entry (2026-11-05):** Main `7fce64a1` / coherent product `0.13.8`; p13 P8 implementation is committed but broader qualification is incomplete. c13 P1 was attempted once and BLOCKED by an obsolete P4 PASS prerequisite, with zero implementation changes; the failed attempt and its original prompt are preserved under [archive](archive/P1-attempted-2026-11-05.txt). [Original P4](../p13/qualification/checkpoint-a.md) and [P9](../p13/qualification/checkpoint-b.md) remain **BLOCKED / NOT GREEN**. The [P5-only conditional entry](../p13/qualification/p5-conditional-entry-2026-11-05.md) and [correction-specific entry recovery](qualification/owner-entry-recovery-2026-11-05.md) permit bounded implementation on verified consumed interfaces, never fake PASS or unsafe source/grant bypass.

**Authorities:** [ADR 0041](../../decisions/0041-planning-documentation-workflow-and-applied-history.md), [Docs contract](../../planning/p12/documentation-workflow-contract.md), [Skills framework](../../planning/p12/skills-framework-contract.md), [ADR 0051](../../decisions/0051-roadmap-work-evidence-lifecycle.md), [task-anchored routing](../../planning/p13/task-anchored-documentation-routing-contract.md), [Phase 13 lifecycle](../../planning/p13/roadmap-work-lifecycle-contract.md), [assessment](prompt-assessment.md), [plan](implementation-plan.md).

## Runner-compatible corrected stack

| Step | Responsibility | Mode |
| --- | --- | --- |
| [P1](P1-task-contract-projection.txt) | Durable Task Contract projection from existing Work/Bridge/Roadmap records | Implementation |
| [P2](P2-agents-document-routing.txt) | Root/nested AGENTS instruction routing and verified delivery | Implementation |
| [P3](P3-bounded-document-retrieval.txt) | Bounded task-relevant page reads and no-progress loop signals | Implementation |
| [P4](P4-context-recovery.txt) | Task, findings and evidence preservation through retries/compaction | Implementation |
| [P5](P5-docs-review-proposal.txt) | Source-bound documentation proposal and review, **no publication** | Implementation |
| [P6](P6-docs-apply-history.txt) | Approved protected documentation apply, recovery and applied-only History | Implementation |
| [P7](P7-protected-docs-skills.txt) | Register real protected `/docs-review` and `/docs-apply` in existing Chat Skills | Implementation |
| [P8](P8-docs-pipeline-closeout.txt) | Complete documentation pipeline and bounded Work-consumption smoke | **Manual connected Codex browser / STOP** |
| [F1](manual/F1-full-journey.txt) | Full Roadmap → Docs → Prompt Stack → Work → evidence after p13 P12 | Later manual integration |

All P1–P7 require **unchanged product `0.13.8`**, and each creates real, source-tested changes before a runner-owned checkpoint. The runner cannot commit an empty Pn; a no-change blocked entry is **not** success. P8 is the sole unambiguous final closeout prompt in this correction folder and must not be auto-run with `--closeout`. The earlier [P5 routing-only manual closeout](archive/P5-original-routing-browser-closeout.txt) was **not executed**; archived verbatim, not a qualification receipt. The original c12-docs-skills stack and 15-prompt c12-docs-workflow are not to be run in parallel.

## Start, stop and return to Work

1. Verify actual main HEAD, clean/approved worktree, coherent `0.13.8` and p13 P8 applicable implementation (not a marker alone). Check the correction-specific entry decision and original P4 gaps. **Hard-stop** on missing required owners, source/lease/grant protection, or known unsafe behavior.
2. For the separately authorized implementation run, use `npm run codex:phase:validate -- c13-doc-routing` and then `npm run codex:phase -- c13-doc-routing` **without** `--closeout`. This executes P1–P7, leaving P8 manual.
3. Independently operate **P8** in a real connected Codex in-app browser (or other real connected browser) on a disposable project. Demonstrate Chat brainstorm → `/docs-review` relevant reads and inspectable no-write diff → card Accept with exact persisted bytes and one applied History entry, plus card Reject and Revise Proposal on fresh candidates → task-anchored AGENTS/Docs Work consumption with actual bounded coding/test. Test stale/foreign/linked-source/restart/no-progress/false-GREEN negatives. Save case-level evidence at `qualification/p8-docs-pipeline-closeout.md`. Browser inventory, model text or mocks are not live PASS.
4. The [owner-accepted P8 decision](qualification/p8-owner-acceptance-2026-11-07.md) releases original **p13 P9** for manual operation despite P8's technical gaps. Discharge P9's carried P4 live cases under its original contract. P9 remains an independent Work evidence/Gate qualification gate with its own owner-reviewed PASS before `0.13.9`. Never auto-grant Work or advance p13 from c13.
5. After original p13 P12 PASS, operate F1 on applicable current source before p13 P13 native/final closeout. No report substitutes for another gate. Preserve immutable historical BLOCKED/NOT GREEN, no Roadmap self-GREEN, no owner-project edits and no version change from these documentation edits.

**Why this ordering:** P1–P4 allow Work to consume docs without losing its mission; P5–P7 make those docs reviewable and publishable inside Dope. P8 proves the **documentation pipeline**, then p13 P9 resumes the separate **Work evidence pipeline**.
