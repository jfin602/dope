# /prompt-ass — Phase 13 Roadmap → Work evidence

**Date:** 2026-11-05. **Assessment basis:** connected GitHub `jfin602/dope` main, version-only baseline `f908c447`, new ADR/contract `a839f9fa`; no inspection of owner's local dirty checkout, no implementation run or connected GUI qualification. **Status:** READ-ONLY SOURCE/DOC ASSESSMENT AND AUTHORING, NOT GREEN.

## Existing producers and owners to reuse

- Roadmap schema-2 Phase/Gate/Criterion and qualification: `docs/decisions/0040-phase-gate-roadmap-domain.md`, `packages/theia-extension/src/node/roadmap-planning-links.ts`, `roadmap-action-runtime.ts`, `roadmap-gate-chat.ts`, `phase-focus-evidence.ts` and existing authoritative RoadmapStore/Service/ProjectPlanningActions. Find actual current implementations rather than inferring ownership from filenames.
- Planning Bridge and Work basis: ADR 0038, `packages/theia-extension/src/node/planning-bridge-approvals.ts`, `planning-stack-publication.ts`, `workflow-lineage.ts`, `packages/theia-extension/src/browser/prepare-work-navigation.ts` and `planning-work-projection.ts`. Preserve PlanningMap → PlannedTransformation → WorkItem, AgentTask/Run and separate approvals.
- Agent run, evidence, History: `packages/agent-core/src/execution.ts`, `packages/theia-extension/src/node/pi-work-execution.ts`, `agent-execution-runtime.ts`, `history-owner-metadata.ts`, `history-backend.ts` and `packages/theia-extension/src/browser/agent-run-controller.ts`, `history-widget.ts`. Do not assume a successful tool call is a verified Criterion test.
- Canvas: `packages/theia-extension/src/browser/roadmap-canvas-model.ts`, `roadmap-canvas-widget.ts`, `roadmap-status-style.ts` and `roadmap-proposal-cards.ts`. Preserve approved inline yellow-dashed staging/owner tabs, semantic theme and saved Chat rather than inventing a parallel workflow UI.

## Existing test entry points

Source-discovered focused fixtures include `test/unit/roadmap-gate-qualification.test.ts`, `roadmap-phase-qualification.test.ts`, `roadmap-gate-store.test.ts`, `roadmap-planning-links.test.ts`, `planning-bridge-approvals.test.ts`, `planning-work.test.ts`, `prepare-work-navigation.test.ts`, `work-integration.test.ts`, `agent-run-ui.test.ts`, `pi-work-history.test.ts`, `history-integration.test.ts`, `roadmap-canvas.test.ts` and `roadmap-status-truth.test.ts`. These are candidates, not proof of their exact current coverage; inspect actual imports/build prerequisites before selecting tests.

## Core gaps / hazard seams

1. Planning presence currently says `Planned` with one accepted Gate, which is **not** approved full Gate-set coverage. Need a checked per-Phase lock separate from qualification and Work state.
2. Planning Bridge defines `Prepare Work` and artifact links, but Work completion is not evidence qualification. Need checkable receipt lineage tied to canonical Criterion identity and current source.
3. Work candidates/validation may target isolated workspaces; do not accept their tests as proof about the accepted code before checked promotion/applicability.
4. Existing History, restoration and linked Markdown/sync have independent protection. New link/read models must not introduce a second progress store, rewind evidence, bypass grants, or mark synced on failure.
5. Existing LSKM Phase 13 reservation conflicts with owner-approved new scope; retained as deferred unassigned, not deleted or silently called Phase 14.
6. Real Chrome, owner-native Electron, exact LM Studio model and local worktree are unobserved in this docs-only assessment. Do not claim they are qualified.

## Decomposition rationale / prompt efficiency gate

P1–P3 establish lock/backend, handoff and UI separately. P4–P7 handle immutable evidence receipts, evaluator, staleness and run/restart/History without mixing UI. P8 displays existing source-backed state. P9 independently checks integrated authority/source negatives; P10 is the sole T3 manual browser/native closeout. Each ordinary task has a narrow owner, specific test family, <=8 minute target (15 minute hard stop) and no redundant broad `npm test`. No new semantic summarizer, default provider/model change or Greenfield architecture redesign. Prompt sequence uses current runner grammar and versions 0.13.1–0.13.10; validate locally before execution.

