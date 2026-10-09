# c8d-fix /prompt-plan — implementation plan

Status: ready for PROMPT EXECUTION ONLY AFTER safely reconciling local uncommitted P13 0.8.33 source.
Date: 2026-10-09. Mode: Correction 8. Required unchanged version: 0.8.33.

## Inspected sources and actual seams (GitHub P12 at committed 0.8.32, not local P13 patch)

- packages/theia-extension/src/node/agent-runtime-backend.ts launchWorkItem: accepts completion from RPC; validates PlanningMap revision, WorkItem ownership/scope, persists task. Must refuse missing required validation targets.
- packages/contracts/src/agent-runtime-service.ts: WorkItemLaunchRequest has CompletionPolicy, and AgentRuntimeService already exposes start and codingAgentReady.
- packages/theia-extension/src/browser/planning-map-controller.ts launchWork: completion validation EMPTY and requireValidationPass false. packages/theia-extension/src/browser/physical-map-widget.ts renders Launch Work, already has SingleTextInputDialog and error projection.
- packages/theia-extension/src/browser/work-selection-controller.ts holds selectedTask but lacks selected-pending-task Start controller. packages/theia-extension/src/browser/chat-panel-widget.ts renders pending task instructions without Start; New Work uses AgentRunController.start to CREATE a direct task, not the intended saved ID.
- packages/theia-extension/src/node/agent-execution-runtime.ts startInternal already accepts work-item origin, and review hold preserves candidate. Work review requires actual passed Dope validation. No new execution primitive needed.
- Relevant compiled-output tests include test/unit/workitem-delegation.test.ts, planning-map-ui.test.ts, agent-run-ui.test.ts, work-integration.test.ts, agent-delegation-review.test.ts and agent-execution-runtime.test.ts. Build only touched package outputs in dependency order when the chosen test imports lib. Root npm run check composes typecheck + tests + browser/Electron builds, so do not duplicate those at every prompt.

## Ordered implementation

P1: Require nonempty developer-approved test/build/typecheck CompletionPolicy for review-required WorkItem launch in backend. Strict guard; reject empty/false/invalid. Focused WorkItem launch tests. No UI.
P2: Surface bounded explicit validation command at Planning launch. Empty/cancel disables task creation; do not execute free-form WorkItem.validationTargets as shell implicitly. Focused Planning UI tests.
P3: Implement WorkSelectionController.startSelectedWorkItemTask using existing AgentRuntimeService.start with exact saved taskId, developer-accepted grant, eligible Coding Agent and explicit hosted consent; refuse legacy invalid pending tasks and competing runs. Focused controller tests.
P4: Work task detail has explicit Grant review and Start button for saved task only. Preserve New Work direct path and disabled legacy remediation, with focused Work UI tests.
P5: Test Launch -> selected task Start -> required Dope validation -> candidate review hold and existing accept/reject, plus one necessary denial/restart/duplicate regression. Repair only evidence-backed affected baseline test blocker; no full aggregate.
P6: Manual P13 five-cycle repair and qualification loop: each cycle capture basis/evidence, run earliest failing gate, repair narrowly, rerun invalidated focused/real tests and exact-candidate aggregate; stop immediately on all Green or after cycle five Not Green. Preserve original P13 evidence, add separate correction closeout and terminal docs reconciliation.

## Risks and acceptance

Current 0.8.33 is not committed to GitHub. Never overwrite, discard or inadvertently stage the 13 local manifests, three test fixes, untracked local P13 closeout/evidence. WorkItem launch must not grant implicit shell authority from planning prose. Explicit grant and hosted-data consent are user interactions, not silently true flags. Dope-owned validation must remain required for accept; frozen candidate and Git basis rechecked. Source changes during P6 invalidate affected earlier passing evidence. Green requires actual GUI Codex runs, accept/reject/denial, map/steering/restart, direct Work/Adaptive SEO preserved, and passing final npm run check. If real environment unavailable, terminate NOT GREEN after bounded cycle or an insurmountable authorized-scope blocker.

No package bump, no Phase 8E, no background work and no product dependency on external runner. Completion prompt P6 is the ONLY final closeout, Browser required yes.
