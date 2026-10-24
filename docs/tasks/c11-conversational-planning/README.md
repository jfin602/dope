# c11-conversational-planning — Idea-first, repository-grounded implementation plans

**Status (2026-10-24): P1–P8 AUTHORED / IMPLEMENTATION NOT RUN OR QUALIFIED.** This is the approved Phase 11 planning-experience correction. The `/docs-review` finding was accepted; `/docs-apply` and `/prompt-ass` document the contract/assessment, and `/prompt-plan` defines the P1–P8 split; `/prompt-write` now authors the eight immutable sequential prompt files exactly once. **Writing these files does not start implementation**. GitHub inspection base `503dae3` / version `0.11.8`; developer local state unverified. Phase 11 OPEN / NOT QUALIFIED; Phase 12 inactive.

## Goal

A developer provides an idea and a few pointers in the **existing ChatPanel**. Dope gathers relevant bounded repository evidence and returns a **complete, useful step-by-step implementation plan**, then lets the developer refine the same revisioned noncanonical plan through natural conversation. Reviewed strategic structure flows to the same Roadmap canvas and linked Markdown **only with explicit approval**; the current Planning Bridge subsequently prepares Planning Map/WorkItems and prompt stacks under separate approvals. No second Chat, plan/Roadmap authority, agent tool permission, automatic Run, model default switch or authored-stack reorder.

[Owner-approved UX contract](../../planning/p11/conversational-planning-contract.md) · [Assessment](prompt-assessment.md) · [Implementation plan](implementation-plan.md) · [Phase 11 plan](../../planning/p11/phase-11-plan.md).

## Prompt sequence

| Prompt | Objective | Recommended model | Operation |
| --- | --- | --- | --- |
| [P1](P1-plan-draft-owner.txt) | Durable plan draft / stable IDs / authority | GPT-6 Sol High | Headless |
| [P2](P2-repository-investigation.txt) | Bounded source-backed read-only investigation | GPT-6 Sol High | Headless |
| [P3](P3-first-pass-plan.txt) | Selected-local model complete-plan synthesis | GPT-6 Sol High | Headless |
| [P4](P4-conversational-revisions.txt) | Natural revisions and human plan review | GPT-6 Sol High | Headless |
| [P5](P5-roadmap-projection.txt) | Existing Roadmap and linked Markdown approval | GPT-6 Sol High | Headless |
| [P6](P6-planning-bridge-handoff.txt) | Current approved scope to existing Bridge | GPT-6 Sol High | Headless |
| [P7](P7-integration-regressions.txt) | Cross-owner tests, UX and security | GPT-6 Sol High | Headless |
| [P8](P8-manual-planning-closeout.txt) | Real browser/local-Q4 CP1–CP10 closeout | GPT-6 Sol High | **Manual only** |

Runner P1–P7; manually operate P8 after implementation, never automatically. Each implementation prompt target <=8 minutes, soft 10, hard 15. Before authorizing Run, check actual local HEAD, dirty source, overlapping branch work and unchanged `0.11.8`; validate grammar with `npm run codex:phase:validate -- c11-conversational-planning`. Never /activate, reset/stash/clean, agent self-commit, force-push, broad model/role changes, historical artifact rewrites or unapproved project Markdown writes.

**Boundaries:** `c11-brainstorm` retains existing bounded local Roadmap proposals, `c11-planning-bridge` existing approvals/WorkItems/stack publication, `c11-work-experience` its own Work UI/recovery, and Phase Focus its owner-backed prompt status. CP1–CP10 are correction scope only, not Phase 11 Green. No local test/Q4/GUI evidence is claimed by authoring.
