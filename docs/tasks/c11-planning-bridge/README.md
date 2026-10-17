# c11-planning-bridge — Roadmap to architecture-aware executable work

**Status (2026-10-17 America/Chicago):** Owner-requested `/prompt-ass + /prompt-plan + /prompt-write`; **documentation authored only, not implemented, executed or qualified**. Inspection reference `6e475a7a33a2b9c7d3c6742acf63b12199bb5f94` / coherent `0.11.8`. No independent product phase or version bump. Phase 11 **OPEN / NOT QUALIFIED**; Phase 12 inactive.

**Product:** Reuse existing Roadmap + Physical/Planning Map + WorkItem + Work/runner + Chat + History; implement ADR 0038 `Prepare Work` to source-backed impact, target, WorkItems, generated prompt stack, explicit approvals, separate Work Run and truthful reconciliation. Three planning approvals do not grant architecture adoption/Run/candidate promotion/owner closeout. Zero-model and bounded selected-local-model paths; small issue fast lane without fake artifacts.

| Prompt | One bounded responsibility | Tier | Model | GUI |
| --- | --- | --- | --- | --- |
| [P1](P1-workflow-lineage.txt) | Derived state + typed lineage | T2 | Sol High | no |
| [P2](P2-approval-provenance.txt) | Revisioned approval/provenance | T2 | Sol High | no |
| [P3](P3-current-impact-evidence.txt) | Physical Map impact packet | T2 | Sol High | no |
| [P4](P4-prepare-work-ui.txt) | Roadmap -> Map handoff | T1 | Sol Medium | no |
| [P5](P5-target-approval.txt) | Explicit target design approval | T2 | Sol High | no |
| [P6](P6-work-item-decomposition.txt) | Source-backed WorkItem suggestions | T2 | Sol High | no |
| [P7](P7-work-item-review-ui.txt) | WorkItem human editing/review | T1 | Sol Medium | no |
| [P8](P8-local-bridge-proposals.txt) | Bounded existing-Chat local proposals | T2 | Sol High | no |
| [P9](P9-stack-composer.txt) | Pure runner-compatible draft composer | T2 | Sol High | no |
| [P10](P10-stack-approval-publication.txt) | Explicit safe stack approval/publication | T2 | Sol High | no |
| [P11](P11-stack-preview-handoff.txt) | Existing Work stack preview/open/start route | T1/T2 | Sol Medium | no |
| [P12](P12-actual-reconciliation.txt) | Target vs real implementation status | T2 | Sol High | no |
| [P13](P13-correction-fast-lane.txt) | Corrections/fast lane/affected-only replan | T2 | Sol High | no |
| [P14](P14-bridge-integration-regressions.txt) | Cross-owner integration and safety | T2 | Sol High | no |
| [P15](P15-manual-bridge-closeout.txt) | **Manual** source-bound PB gate closeout | T3 | Sol High | **yes; outside headless runner** |

**Run route (separate future authority):** Before implementation, inspect actual checkout HEAD, version, dirty worktree and overlapping `c11-brainstorm` source. P1–P7 of `c11-brainstorm` are committed at assessment, but P8 manual qualification is **not** shown; don't implicitly qualify that producer. Stop dependent live handoff work until it has a real owner-approved source/evidence disposition. Run `npm run codex:phase:validate -- c11-planning-bridge` on the actual local repo. A deliberate owner Run, **not** `/prompt-write`, starts P1–P14 through the existing runner (no `/activate` and no agent self-commit). P15 is separately operated manual T3 and sole final closeout; keep local checkout safety and version `0.11.8`, or re-assess if changed. Ordinary prompts <=8m target / 10m soft / 15m hard, focused tests/build outputs; manual P15 exception.

**Source/evidence:** [assessment](prompt-assessment.md), [implementation plan](implementation-plan.md), [PB1–PB8](../../planning/planning-bridge/plan.md), [Phase 11](../../planning/p11/phase-11-plan.md). No actual code, test or GUI result is claimed. PB8 scoped Green cannot mark Phase 11 Green; original usability Hunts and Phase 12 separation remain.
