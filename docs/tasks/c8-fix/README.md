# c8d-fix — Phase 8D qualification repair

Status: PLANNED — execution requires reconciliation of the LOCAL, UNCOMMITTED P13 0.8.33 working tree.
Mode: correction; Roadmap phase: 8; correction version: 0.8.33 (UNCHANGED).

## Basis and purpose

The committed GitHub implementation reached P12 at 0.8.32 (09fe3bcd). The developer reports P13 at local 0.8.33 as NOT GREEN, with 13 changed package manifests, three modified tests and docs/tasks/p8d/closeout.md plus evidence not committed to GitHub. Two WorkItem AgentTasks persisted, but no UI control could Start the saved tasks; no real Codex run, frozen candidate or validation followed. Planning launch supplied no required validation target, although accept/reject requires Dope-owned passing validation. The single P13 npm run check failed at baseline before product/Electron; targeted fixes/browser build/stack validation alone do not qualify P13. Phase 8E is not activated.

Repair only the disconnected Launch -> Start -> Validate -> Review seam. Do not rewrite already-approved WorkItem or AgentTask architecture, change permissions, silently transform preexisting invalid persisted tasks, or invalidate earlier direct Work/Prompt Stack Green evidence.

## Approved prompts

| Prompt | Scope | Tier | Model | Browser required |
| --- | --- | --- | --- | --- |
| P1 | Strict nonempty Dope-owned validation on WorkItem launch | T2 | GPT-6 Sol High | no |
| P2 | Explicit validation input in Planning WorkItem UI | T1 | GPT-6 Sol Medium | no |
| P3 | Start the exact saved WorkItem AgentTask through runtime controller | T2 | GPT-6 Sol High | no |
| P4 | Explicit Work detail grant/Start controls for saved task | T1 | GPT-6 Sol Medium | no |
| P5 | Focused Launch -> Start -> Review integration and P13 baseline diagnosis | T2 | GPT-6 Sol High | no |
| P6 | UP TO FIVE Cycle Phase 8D P13 qualification/repair loop and final closeout | T3 | GPT-6 Sol High | yes |

P1-P4 target eight minutes or less including focused tests, hard limit fifteen minutes. P5 concentrates bounded integration tests. P6 alone runs real GUI/Codex, restart, the exact candidate aggregate and five-cycle repair loop. Do not repeat full builds/tests in P1-P5; compile changed package output only when focused tests import compiled lib.

## Critical operator preflight

Do not blindly git pull, reset, clean or stash-and-forget the local P13 dirty tree. First inventory local HEAD, package version, git status, modified test files, untracked P13 closeout and evidence directories; preserve original bytes and hashes. Import just these correction documents safely from GitHub after deliberately reconciling remote documentation and local source. Ensure local package version really is 0.8.33 and accept the dirty-tree continuation intentionally before running the correction. The GitHub docs commit does not contain the local P13 source/evidence and cannot by itself qualify or repair it. If basis cannot be reconciled safely, stop.

Validation once locally available: npm run codex:phase:validate -- c8d-fix
Run correction: npm run codex:phase -- c8d-fix
The last P6 is a manual/browser closeout. It loops up to five cycles or all Green, and stops NOT GREEN after five without full proof. No automatic Phase 8E activation.

Authority: ADR 0028, ADR 0029, ADR 0031, the Phase 8D plan, stability contract and original P13 closeout instructions.
