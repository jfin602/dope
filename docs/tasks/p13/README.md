# p13 — Roadmap-Controlled Development: manually gated runner

> **2026-11-05 documentation-routing execution gate:** Before manually operating P9, complete the separate [c13-doc-routing](../c13-doc-routing/README.md) correction P1–P5 at the verified `0.13.8` pause. Before P13 final closeout, complete its F1 full-journey check on source applicable after P12. Hold on any mandatory NOT GREEN/EVIDENCE GAP; neither report replaces P4/P9/P12/P13. Existing `p13/P*.txt` source is unchanged.

**Owner-approved:** 2026-11-05 `/docs-apply + /prompt-plan + /prompt-write p13`, main branch, `0.13.0` baseline `f908c447`; subsequent explicit request adds three manual browser checkpoints. **Status:** prompt/docs only; implementation, live Chrome qualification and native owner signoff NOT RUN. **Authorities:** [ADR 0051](../../decisions/0051-roadmap-work-evidence-lifecycle.md), [lifecycle contract](../../planning/p13/roadmap-work-lifecycle-contract.md), [Task-Anchored Documentation Routing](../../planning/p13/task-anchored-documentation-routing-contract.md), [plan](implementation-plan.md), [assessment](prompt-assessment.md).

| Step | Target version | Responsibility | Mode |
| --- | --- | --- | --- |
| [P1](P1-phase-planning-lock.txt) | 0.13.1 | Phase planning lock and Gate-set coverage | Runner |
| [P2](P2-work-handoff-links.txt) | 0.13.2 | Reviewed Prepare Work and WorkItem links | Runner |
| [P3](P3-roadmap-planning-controls.txt) | 0.13.3 | Planning/Ready canvas and hidden editors | Runner |
| [P4 checkpoint A](P4-browser-checkpoint-a.txt) | 0.13.4 | **Real Chrome lock/handoff test, repair, owner PASS** | **Manual STOP** |
| [P5](P5-work-evidence-receipts.txt) | 0.13.5 | Source-bound Work/Criterion receipts | Runner |
| [P6](P6-evidence-qualification-projection.txt) | 0.13.6 | Derived qualification from evidence | Runner |
| [P7](P7-amendment-invalidation.txt) | 0.13.7 | Amendments and evidence freshness | Runner |
| [P8](P8-evidence-history-recovery.txt) | 0.13.8 | History/restart and replay safety | Runner |
| [P9 checkpoint B](P9-browser-checkpoint-b.txt) | 0.13.9 | **Real Chrome evidence/qualification test, repair, owner PASS** | **Manual STOP** |
| [P10](P10-roadmap-work-monitoring.txt) | 0.13.10 | Live Roadmap Work monitor | Runner |
| [P11](P11-integration-security.txt) | 0.13.11 | Source and security integration T2 | Runner |
| [P12 checkpoint C](P12-browser-checkpoint-c.txt) | 0.13.12 | **Real Chrome full Roadmap monitoring test, repair, owner PASS** | **Manual STOP** |
| [P13 closeout](P13-phase-closeout.txt) | 0.13.13 | Native Electron and final owner closeout | **Manual final** |

## How to stop, test, repair and restart

On actual synced main, inspect dirty owner work and use `npm run codex:phase:validate -- p13` first. On later deliberate owner Run use `npm run codex:phase -- p13`, **without `--closeout`**. The runner automatically works P1–P3 and deliberately stops at browser-required **P4**. The owner manually runs P4 with real Dope/Codex Browser, reviews/fixes/retests mandatory cases and writes a dated, source-backed `qualification/checkpoint-a.md`; **only after independent owner PASS** make a reviewed version-advance Git commit with exact subject `0.13.4`, real report and 13 coherent manifest versions/20 internal pins. Then invoke the **same** normal runner command again; it resumes P5. Repeat at **P9** (`checkpoint-b.md`, subject `0.13.9`) and **P12** (`checkpoint-c.md`, subject `0.13.12`). At any FAIL/BLOCKED: do not commit its target version; repeating the runner will stop at that same gate until resolved. P13 remains separate manual/native final disposition.

**Known runner limitation:** the current runner resumes based on reachable Git commit subject + package version, not on inspected browser evidence. The human-checkpoint report and explicit owner PASS are therefore mandatory. A version commit is only a **resume marker**, never Roadmap Gate or Phase qualification. Checkpoint prompts forbid empty/forged commits and must re-run affected real Chrome tests after code repairs. No automatic self-commit, tool-only PASS, mock browser, owner-native claim from Chrome, dirty-work overwrite, reset/stash/clean or historical report rewrite. Real selected model and disposable test projects required.

Preserve one schema-2 Roadmap authority; Work executes only under its reviewed grants/candidate promotion, Criterion evidence is source-bound and owner qualification remains separate from task completion. P13 docs/prompt authoring alone is not an implementation Run or a GREEN receipt.

The documentation-routing contract adds forward Phase 13 requirements. The separate [c13-doc-routing correction route](../c13-doc-routing/README.md) addresses the missing Task Contract, AGENTS-first Work behavior, bounded document reads and recovery **at the P9 pause after P8**, without changing this stack's `P*.txt` prompts. Its P5 manual Chrome PASS is required before operating this stack's P9. After this stack's P12 PASS, its F1 manual full-journey PASS is required before P13 final Phase closeout. Neither correction report replaces P9/P12/P13, nor may the runner's commit marker substitute for evidence. All prompts are authored only; no Run or product GREEN by this documentation.
