# c8d-fix /prompt-ass — prompt assessment

Date: 2026-10-09
Disposition: correction approved for planning; P13 remains NOT GREEN.
Version: 0.8.33 UNCHANGED (locally reported, not on the latest GitHub committed manifests).
Execution: five ordinary bounded prompts and one manual T3 five-cycle qualification/repair closeout.

## Observed and code-grounded gap

Current backend launchWorkItem saves AgentTask with a WorkItem origin and a caller-provided completion policy. PlanningMapController.launchWork() has been supplying an EMPTY validation list and requireValidationPass false. Work detail displays pending task instructions but does not offer a Start action; the existing New Work composer instead creates an unrelated direct task. AgentRuntimeService.start and AgentExecutionRuntime.startInternal already allow an existing work-item task, and workReviewCanAccept and backend decideCandidate require a nonempty passing Dope-owned validation target. Repair those seams, not the whole Agent Runtime.

Original P13 evidence: two WorkItem tasks created/reopened; no actual Codex run, required candidate validation or acceptance/rejection. Full aggregate check failed early at baseline; focused repairs and browser build do not equal final Green. Original P13 local closeout/evidence was uncommitted and must be preserved. Do not invent exact task IDs or source SHAs unavailable from GitHub.

## Decomposition and dependencies

P1 T2 Sol High — enforce server-side approved required validation target on WorkItem launch. Guard direct/sequence unchanged.
P2 T1 Sol Medium — developer-facing Planning validation command/approval; no silent interpretation of WorkItem.validationTargets prose as a shell command.
P3 T2 Sol High — WorkSelectionController launches the SELECTED persisted AgentTask under explicit grant/hosted consent, no new direct task.
P4 T1 Sol Medium — exact pending WorkItem detail Start/grant UI and truthful legacy empty-policy disabled state.
P5 T2 Sol High — one concise cross-boundary fixture and focused regression suite; narrow investigation of original P13 baseline failure without suppressing tests.
P6 T3 Sol High — five cycles maximum, stop immediately on complete Green, otherwise retain failure and stop NOT GREEN after fifth cycle. It is the sole final closeout/manual GUI gate, exempt from ordinary eight-minute budget.

## Preservation laws

Dope's ExecutionWorkspace -> frozen CandidateDelta -> required Dope CandidateValidation -> Authority/ToolExecutor is unchanged. Fixed grant never permits Git/network/secret/outside-root/delete/rename effects by default. WorkItems remain Planning intent; AgentTasks are execution; creating a task does not auto-run or auto-complete a WorkItem. Existing direct Work/Prompt Stack and historical Adaptive SEO remain untouched. Legacy P13 pending tasks with empty validation stay intact/unstartable and are remediated by explicit creation of new validated tasks, not silent modification.

## Test economy

P1-P4 compile only changed package outputs when focused tests import compiled lib, and run their directly changed suite. P5 integrates affected WorkItem, Planning, Work and review test fixtures without full check. P6 runs real GUI/hosted Codex and one passing npm run check per final stable candidate (rerun only after an actual source repair invalidates it); it records per-cycle evidence, performs terminal docs reconciliation once and does not activate 8E.
