# Phase 8D — P13 live GUI qualification closeout

**Decision: NOT GREEN / NOT QUALIFIED.** Phase 8D remains active. This record does not activate Phase 8E or close Phase 8.

Date: 2026-10-09. Assigned and actual manifest version: `0.8.33`. The source began at Dope HEAD `09fe3bcdaaeaed5ffe267e783c63f84bbaea999b` (`0.8.32`). P13 is an uncommitted `0.8.33` working tree; there is no `0.8.33` qualification commit. The tracked patch before this closeout had SHA-256 `81228811a89b8f5cce379f91b1dfccd2c40868c153da2a74ee76af2f58297c65` (`git diff --binary HEAD`). The failed aggregate ran before the baseline-test repairs below, so it is not an aggregate result for the final P13 working tree.

## Automated T3 and source checks

| Gate | Observed result |
| --- | --- |
| `npm run check` — exactly one invocation | **FAIL** at baseline tests: 8/11 passed. Full typecheck and runner tests (103/103) had passed; product tests and browser/Electron builds were not reached. Two assertions expected historical `0.8.20`; one negative Phase 3 guard rejected the approved 8D `PlanningStore` use in Agent Runtime. [Complete log](evidence/p13-check.txt). |
| Narrow baseline repair | Updated the version assertions to `0.8.33` and excluded the current Agent Runtime PlanningStore consumer from the obsolete Phase 3 negative check. The four affected assertions passed 4/4 on one focused rerun. [Log](evidence/p13-baseline-focused.txt). |
| Focused 8D product tests | First run passed 33/34. `work-selection.test.ts` failed because its legacy runtime fixture lacked the current task origin and detail-read methods. After repairing that fixture, only that file was rerun and passed 2/2. No full product rerun is claimed. [First log](evidence/p13-product-focused-first.txt), [repair rerun](evidence/p13-work-selection-rerun.txt). |
| Browser build needed for GUI | `corepack yarn workspace @dope/browser build` passed with zero browser and Node bundle errors. This was run because the required aggregate stopped before its build stages. The Electron build remains unobserved. [Log](evidence/p13-browser-build.txt). |
| `npm run codex:phase:validate -- p8d` — exactly one invocation | PASS for P1–P13 prompt grammar and assigned versions. |
| Cheap checks | All 13 package manifests and internal `@dope/*` versions are `0.8.33`; `git diff --check` passed; no `package-lock.json` was introduced. |

No separate `npm test`, second aggregate, or Electron build was run.

## Disposable GUI project and task identities

The real Dope browser GUI ran on the `0.8.33` local browser build against disposable `/tmp/dope-p8d-p13-gui`, cloned from Adaptive SEO HEAD `d4dfbf38628ba70726cf3b3610c2279643f500dc`. Its `.dope/architecture.json` and `.dope/smap.json` were copied into the fixture. The fresh Physical Map generation was `1`, partial, with 4,425 nodes and zero violations; missing installed dependencies in the clone produced TypeScript diagnostics. This is limited map input, not a complete map qualification. The GUI had Planning project `project-48bc8ba6-e9ba-475d-a2bc-15d659331eab`, Planning Map `map-e83dccae-745d-4463-ba56-5cbe2f428dc7`, transformation `change-09d8d698-fb0a-403d-9911-f71cde5bfadb`, and WorkItem `work-b5c9c4fb-3d4e-4413-b242-9c683e12e79c`.

| GUI action | Durable observation |
| --- | --- |
| AI owned launch for `p13-qualification/accepted.txt` | AgentTask `work-1e867fa44d30dbcecb545f57cf9dfd4c`, origin `work-item`, map revision `7`, required review, frozen AI scope. The Work view showed `pending · Awaiting execution`. [Task snapshot](evidence/p13-ai-task.json). |
| HUMAN assignment of the same WorkItem | GUI showed `delegable: none`, reserved `p13-qualification`, and disabled **Launch Work**. No HUMAN task was created. |
| SHARED launch for `p13-qualification/rejected.txt`, with `p13-qualification/human.txt` human reserved | AgentTask `work-e6833a22201e32d93f1901ec47d1f754`, origin `work-item`, map revision `10`, required review, frozen SHARED scope. It also stayed pending. This was a second revision of the **same** WorkItem, not a distinct WorkItem. [Task snapshot](evidence/p13-shared-task.json). |
| Browser reload/reopen | Both pending tasks reappeared in Work History. The WorkItem remained `ready`; task creation did not mark Planning intent complete. [Final Planning state](evidence/p13-final-planning-state.json). No AgentRun, candidate, review hold, project file, or Git commit was created. Fixture HEAD stayed `d4dfbf38628ba70726cf3b3610c2279643f500dc`, and Git status stayed clean. [Fixture state](evidence/p13-fixture-state.json). |

The GUI's WorkItem task detail displayed instructions but offered no **Start Work** control. The durable tasks each contain `completion: { validation: [], requireValidationPass: false }`, emitted by `PlanningMapController.launchWork()`; `workReviewCanAccept()` requires at least one completion validation target. Thus the launched tasks could not reach the required validated acceptance path through this GUI. The first fact is a direct GUI observation; the validation-policy consequence is supported by the current source at `packages/theia-extension/src/browser/planning-map-controller.ts` and `packages/theia-extension/src/browser/work-selection-controller.ts`. No hosted Codex task execution occurred in this P13 live pass; the GUI/backend stop is before Codex invocation.

## Required live gates not qualified

The blocked execution path prevented the planned accept/reject pair. There is no frozen validated candidate to accept, no rejected candidate, no promoted project write, and no candidate review decision. Consequently there is no live denied ProposedAction, steering acknowledgement, applied-path map impact receipt, or held-review restart to report. The focused tests cover those mechanisms in controlled fixtures; they are **not** substitutes for the requested live GUI/Codex evidence. The preserved fixed grant and isolated candidate validation/promotion code were not changed by P13. WorkItem completion was independently observed to remain `ready`, but completion after accepted work was not exercised.

## Read-only legacy reopen

In the same browser GUI, direct Work was reopened from `/home/jfin/dev/c8-work-mode-p9-WAQ12E`: saved task `239bbd35-88b7-4ebe-95ee-5d369571ae6c` and run `6645d869-5b30-4000-a0fc-2cbde19abffe` displayed the completed result, `Run · completed`, and `Authority · allowed`. Its project HEAD stayed `0a6f87fea6603e956db6e7b8eee800409cbf8bca`; Git status stayed at the preexisting `?? .dope/` only. No new run was started.

The completed Adaptive SEO Prompt Stack `c4-dope-phase-stack-smoke` was reopened at `/home/jfin/dev/adaptive-seo-dope`: GUI showed `P4 of 4`, completed, with four checkpoints: P1 `96fe8c9b5500e3dce6c9dc24cbc1bc19b978907a`, P2 `d5c583b52abae24eb98fd2f28e4134ef61de93b4`, P3 `57980fe9cb86c48dc7e5b587a50a21f137a8045b`, P4 `d4dfbf38628ba70726cf3b3610c2279643f500dc`. HEAD stayed at P4, Git status stayed clean, and the persisted sequence SHA-256 stayed `894e93b7276bfbda45c8e133df3f8a3de47991bbc7666d4f54dace35b0662469`. This verifies read-only reopening, not a new direct Work or stack execution.

## Decision and next boundary

**8D is NOT GREEN.** The live WorkItem-to-Codex execution and required validation selection must be made usable, then the full P13 accept/reject, authority, steering, map impact, restart, and exact-source aggregate gates must be repeated on a new candidate. The two pending task snapshots and failed test logs are preserved above. Do not relabel the partial GUI observations as Phase 8D qualification, activate 8E, or close Phase 8.
