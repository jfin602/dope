> **2026-11-05 OWNER INTEGRATION INTO PHASE 13:** Original c12-docs-skills P1–P4 remain **authored only / never run**, and are preserved as detailed design/negative-case references. Their implementation responsibilities are now scheduled once, in [c13-doc-routing P5–P7 plus manual P8](../c13-doc-routing/README.md) at p13's 0.13.8 pause. Do **not** operate c12-docs-skills as a second publisher/parallel run. ADR 0041, the Docs contract, protected approvals, linked Roadmap exclusivity, recovery and applied-only History requirements remain in force. This sequencing change creates no product code, source qualification, version change or GREEN.

# c12-docs-skills — independent Documentation Management correction

**Owner decision:** 2026-11-01 (America/Chicago). **Status:** ASSESSED / PLANNED / AUTHORED ONLY; NOT IMPLEMENTED OR QUALIFIED. Product version 0.12.7 unchanged. This correction follows the [c12-planning-recovery P3-C closeout](../c12-planning-recovery/P3-C-planning-closeout.txt); Docs management no longer belongs to that stack. The old, unexecuted P3-C Docs prompt is preserved verbatim at [archive-original-P3-C-docs-skills.txt](archive-original-P3-C-docs-skills.txt).

**Dependencies:** P3-A generic Skills qualified; P3-B protected /roadmap independently dispositioned; P3-C Planning Recovery closeout recorded, with generic Chat/Pi blockers still openly tracked. Do not automatically require all C12/Phase 12/native GREEN, but any shared Chat/tool/authority blocker material to Docs must be resolved before the affected Docs operation. Do not use Docs as a workaround for Pi/Chat failure.

**Governing contracts:** [ADR 0041](../../decisions/0041-planning-documentation-workflow-and-applied-history.md), [Docs product contract](../../planning/p12/documentation-workflow-contract.md), and [Skills framework](../../planning/p12/skills-framework-contract.md). The separate [c12-docs-workflow 15-prompt stack](../c12-docs-workflow/README.md) remains UNRUN historical/advanced authoring, not a second writer or parallel implementation. Its publication/recovery/History safety and WC1–WC4 compatibility conditions remain applicable where relevant. Advanced Work documentation-reference delivery/freshness is deferred.

## Execution order (four independently initiated manual prompts)

| Prompt | Scope | Exit |
| --- | --- | --- |
| [P1](P1-proposal-owner.txt) | Source-bound durable review proposal/diff and protected eligible targets; zero publication | Exact preview, project/source/lease identity, safety negatives |
| [P2](P2-protected-apply-history.txt) | Approved text-doc publication, journal/recovery and applied-only History | Exact persisted effects, dedup, stale/recovery/negative proof |
| [P3](P3-docs-skill-integration.txt) | Protected /docs-review and /docs-apply on existing Chat/Skills/Pi plus progressive relevant source reads | Actual skill dispatch and reviewed diff/application; no new authority |
| [P4](P4-manual-browser-qualification.txt) | Independent connected Codex Chrome closeout and targeted repair | Genuine end-to-end approval, bytes and History evidence; truthful gaps |

Manual GPT-6 Sol High, ~8-minute target/15-minute hard cap per bounded cycle, no phase runner or /activate, no self-commit, version bump or automatic next prompt. The current local checkout controls over GitHub if newer. Inspect HEAD/status and preserve all dirty owner files. Use disposable projects; keep existing connected browser/server when practical. Leave LM Studio Structured Output off for Pi tool turns.

**User journey:** Discuss feature in saved Chat → /docs-review selectively discovers/reads relevant eligible .md/.txt documentation, produces concrete inspected source-grounded diff and **writes nothing** → developer reviews and explicitly approves exact unchanged proposal → /docs-apply calls Dope-owned protected publisher → verified retained effects yield exactly one applied-only History record with original diff. Reject/no-op/fail-zero/cancelled review have no applied record. A skill/Commands Ask/Allow/Pi shell tool is NEVER publication authority. Linked schema-2 Roadmap Markdown remains exclusively owned by its existing writer.

**Deferred:** automatic corpus scanning/prefill on ordinary turns, embeddings, extra selector models, downloaded script skills, background edits, automatic Work adoption, full 15-prompt Work-reference/freshness work, native Electron proof absent direct owner evidence. Do not claim full Docs GREEN from a mock, a compiled service, or an LLM saying it wrote files.

[Assessment](prompt-assessment.md) · [Implementation plan](implementation-plan.md) · [Archived prior Docs prompt](archive-original-P3-C-docs-skills.txt).
