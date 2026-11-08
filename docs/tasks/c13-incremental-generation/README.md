# c13-incremental-generation — Incremental Docs and Prompt Stack proposals

**Status: ASSESSED / PLANNED / PROMPTS AUTHORED FOR REVIEW ONLY.** Based on owner-approved [ADR 0055](../../decisions/0055-incremental-proposal-generation.md), the [technical contract](../../planning/p13/incremental-proposal-generation-contract.md), and `docs/workflow.md`. Current repo `0.13.11`. **No product implementation, runner invocation, browser qualification, Work Run, Gate Green, or version change is authorized by these files alone.**

**Sequencing (owner correction 2026-11-08):** R3B's technical PASS/report is **not** an entry gate for this stack. The shared controller (P1), Docs adapter (P2), and independent prompt/Chat staging work may proceed against the actual checkout even if R3B reported PARTIAL/NOT GREEN. A genuinely absent/unsafe R3B protected publishing API is a dependency for **publication integration**, not for unrelated generation work; block that seam precisely, without fabricating a writer or bypassing approval. Preserve R3B's authentic outcome and never edit, rerun, or retroactively qualify its original prompt/qualification. This correction precedes P13 recovery R3/R2/R4.

**Workflow:** [Assessment](prompt-assessment.md) → [Implementation plan](implementation-plan.md) → P1–P5 automated runner prompts → P6 independent MANUAL connected-browser closeout.

| Step | Tier | Browser | Purpose |
| --- | --- | --- | --- |
| P1 | T1 | No | Shared durable, protected incremental proposal controller and typed Pi tools |
| P2 | T1 | No | Incremental `/docs-review` source-bound staged document edits |
| P3 | T1 | No | Incremental `/prompt-write` stages and 10+ prompt composition |
| P4 | T1 | No | Progressive native review + natural `finalMessage` |
| P5 | T2 | No | Cross-skill lifecycle and authority regressions |
| P6 | T3 | **Yes, manual only** | Real GPT-OSS 20B and native editor/browser qualification |

**Execution commands for a later explicitly approved Run:**
```bash
npm run codex:phase:validate -- c13-incremental-generation
npm run codex:phase -- c13-incremental-generation
```
The runner handles **P1–P5 only** and stops. Never pass `--closeout` as part of normal implementation. P6 requires a separate deliberate owner/manual connected Codex browser session.

**Safety:** No canonical file writes from model stage tools, no duplicate publisher or Docs viewer, no unbounded agent loop, no implicit Work/grants/candidate promotion/History/Roadmap status and no automatic Phase 13 continuation. Apply the established runner source/version/dirty-work checks; stop on an actual unsafe source/publisher boundary, **not** an absent/non-GREEN R3B report. An implementation commit is **not** a qualified Gate.
