# /prompt-plan — c12-docs-workflow

**Status:** PLANNED / AUTHORED ONLY — NOT RUN OR QUALIFIED. **Source:** `c01711345ba3d83900b20242948abdabaeeeb6ac`. **Correction:** 12 at unchanged `0.12.7`.

[Assessment](prompt-assessment.md) · [Contract](../../planning/p12/documentation-workflow-contract.md) · [Prompt index](README.md)

**Owner-requested compatibility amendment (2026-10-30):** Strengthen the authored stack at `5daccac5744b8e2bbb6a3c9e1dc79931b79072be` with WC1–WC4 below. These are mandatory subcases of existing DW7/DW8/DW10. The runtime assessment source, 15-prompt sequence, product version and authored-only status remain unchanged.

## Fixed ownership and dependency decisions

The existing saved Chat requests review and presents the result. A small documentation owner in the existing product/domain/application boundaries holds proposal identity, approved bases, recovery journal and verified application evidence beneath `.dope/documentation-workflow/`. Actual project documents remain live canonical text. History projects that owner's applied records; it never becomes a writer or recovery trigger.

Use `packages/contracts` for public documentation DTO/RPC contracts, `packages/project-intelligence` for presentation-independent selection/proposal/application logic, and thin `packages/theia-extension` adapters for existing project-reader, Chat/Work, DI/RPC, editor and History services. Proposed module names below are planned implementation locations; an equivalent coherent existing owner is acceptable when the executor documents the source fit. Do not create a new package/platform merely for this feature.

Work owns its supplied requirements snapshot as part of the existing task/run provenance. Because `contracts -> agent-core` already exists, `agent-core` must not import `contracts`, `project-intelligence` or Theia. Map document-domain results into a small serializable Work contract at the extension boundary. Preserve original prompt text, logical sequence/source identity and prior task/run records. A materially changed pending preparation has its own immutable identity under WC2; it does not replace historical task bytes.

The generic document writer must reject or delegate an active linked Roadmap path. Its schema-2 `RoadmapStore` writer remains authoritative; changes must preserve Phase/Gate/Criterion identity, source mapping, pending sync and evidence/qualification boundaries. Do not build on retired checkpoint semantics merely because old helpers remain in the source file.

## Execution preflight

The implementation agent reads actual local HEAD/dirty state, package/internal-pin coherence, owner changes, prior prompt outputs and relevant current source. The recorded authoring SHA is a traceability baseline, not a requirement to reset a newer compatible checkout. Report material source drift and adapt only within the accepted scope.

Before dependent Chat integration and manual local proof, verify the actual `c12-pi-agentic-chat` project-aware read/list/search and typed-owner capability and its applicable evidence. At the authoring baseline it is not implemented by its authored prompts. Do not silently run that stack or treat its README as proof. Independent lower-layer work is not permission to expose missing/incomplete Apply paths.

The owner's deliberate Run supplies execution authorization for this stack. A missing substantive source/permission/dependency boundary is a real blocker; a missing ceremonial `/activate`, redundant activation record or unrelated broad phase Green is not.

## Prompt responsibilities, files and tests

New `documentation-*.test.ts` names below are planned tests to implement, not tests reported as already present or passing.

| Prompt | Producer/consumer and likely source | Focused behavior and test |
| --- | --- | --- |
| P1 | New `contracts/src/documentation.ts`; `project-intelligence/src/node/documentation-sources.ts`; injected approved reader. | Declared roles, sections, fingerprints, relevance and bounded omissions; WC1 successful empty selection distinct from required missing/unreadable sources. `documentation-sources.test.ts`. |
| P2 | New `documentation-workflow-store.ts` and typed proposal records; existing project-local persistence patterns. | Stable proposal/revision, source/absence basis, reject/revise/restart and no canonical effects. `documentation-proposals.test.ts`. |
| P3 | New `documentation-file-apply.ts`; guarded publication patterns in `roadmap-document-patch.ts`. | Eligible single-file create/update, race checks, durable journal and exact byte evidence. `documentation-file-apply.test.ts`. No public service yet. |
| P4 | New `documentation-application.ts` using P2/P3. | Coherent approved set, stable application ID, crash/retry and actual zero/partial/full effects. `documentation-application.test.ts`. |
| P5 | New narrow `documentation-roadmap-adapter.ts`; schema-2 `RoadmapStore` preview/publish/recover APIs. | Linked owner publication, source/revision conflict and no-doc accepted draft. `documentation-roadmap.test.ts` plus `roadmap-gate-document.test.ts`. |
| P6 | New `contracts/src/documentation-service.ts`, `theia-extension/src/node/documentation-backend.ts`; existing `backend-module.ts` / `frontend-module.ts` service wiring. | Exact reviewed-set authorization, attach/project switch/replay, read-only receipts and separate recovery. `documentation-service.test.ts`. |
| P7 | `chat/src/service.ts`, `chat-backend.ts`, `chat-context-composer.ts`, small documentation proposal parser/adapter. | Slash/natural-language review parity, apply-existing-only, bounded selected model, strict validation and no claimed write before receipt. `documentation-chat.test.ts` plus `chat-grounded-turn.test.ts`. |
| P8 | `chat-panel-controller.ts`, `chat-panel-widget.ts`, current Chat presentation and editor/diff callbacks. | Concrete reviewed set, apply/revise/reject/recovery, copy/scroll, no-model proposal and existing docking. `documentation-chat-panel.test.ts` plus `chat-panel.test.ts`. |
| P9 | `contracts/src/history.ts`, `history-backend.ts`, new bounded `history-documentation.ts`. | Owner-backed eligible events only, one application ID, exact time/outcome, read-only/project isolation. `documentation-history.test.ts` plus `history-projection.test.ts`. |
| P10 | `history-widget.ts`, `history-presentation.ts`, `history-navigation.ts`, existing owner-navigation/frontend editor/diff callbacks. | Original applied evidence despite later edits/deletion, optional origin and safe async navigation. `documentation-history-navigation.test.ts` plus existing navigation/panel tests. |
| P11 | `agent-core/src/contracts.ts` task schema/parser; existing task store; `AgentRuntimeBackend.createTask/launchWorkItem/prepareSequenceTask`. | Current source packet captured for direct/WorkItem/stack preparations, WC1 empty context, WC2 otherwise-valid legacy identity/grant preservation and immutable original prompt. `documentation-work-context.test.ts` plus `workitem-delegation.test.ts`. |
| P12 | `agent-execution-runtime.ts` initial/retry adapter requests; `pi-work-execution.ts` capacity boundary; current `ChatPanelWidget` Work task/run detail. | WC1 unchanged empty-context input, WC4 bounded exact delivery and supported retry without duplication, capacity including adapter/retry overhead, source disclosure and provider parity. `documentation-work-delivery.test.ts` plus `pi-work-execution.test.ts`. |
| P13 | Existing task/sequence preparation, guarded pending linkage and start/reconciliation owners; Work status controls. | WC2 reviewed immutable replacement, grant/link/restart/race integrity; WC3 relevant-section checks with no new documentation approval for unrelated/known nonsemantic edits; retained current Git guards and active/completed history. `documentation-work-freshness.test.ts` plus `agent-sequence-persistence.test.ts`. |
| P14 | New `documentation-workflow-integration.test.ts`; actual new test registration in `package.json`; existing runtime/persistence regressions. | Connected review/apply/History/Work, recovery/project/linked-source negatives and automated WC1–WC4 ordinary coding-flow matrix. No package version/dependency change. |
| P15 | Existing browser and installed Electron, disposable projects, final package; later evidence and `closeout.md`. | All DW1–DW10 including required WC1–WC4 live observations, an empty-context baseline and populated-context real local coding behavior; one final aggregate and honest platform limits. |

P1–P5 are domain/application work, P6 is the authority boundary, P7/P8 are existing Chat integration, P9/P10 existing History, P11–P13 existing Work, and P14/P15 cross-system evidence. P11 owns task capture/serialization; P12 owns delivery/disclosure; P13 owns freshness. Keep subsequent dependencies one-way. Do not expose P3 writes before P4 recovery or an Apply control before P6 validates authority.

## Application and recovery protocol to implement

1. Resolve current eligible documents through the established approved read boundary. Record role, source/section identity and omissions; the model cannot certify its own source hashes.
2. Persist a bounded proposal with exact before/after effects or verified absence, project/worktree identity and required owner revisions. Preview the precise content; revision invalidates its prior reviewed digest.
3. At approved application, recheck project/digest/source/owners, reserve one stable application ID and durable recovery information, and serialize the applicable owner operations.
4. Publish ordinary document effects through the guarded file primitive; delegate active linked Roadmap effects through its existing writer. Never duplicate that writer or promise distributed atomicity.
5. Verify resulting bytes and retained effects before a receipt becomes eligible. Preserve immutable original diff evidence. No-op and failed-zero effects are terminal without documentation History.
6. Reconcile crash/retry against durable journal and actual file identities. Safe restoration cannot overwrite newer edits. Known retained subset has a partial/recovery outcome; unresolved evidence stays unresolved. History itself does not run this operation.
7. Publish one owner change notification for projection refresh. Repeated notification/restart resolves the same application identity. Later separately approved changes/reversal get distinct identities.

Application success means documents changed. It does not confer implementation, validation, WorkItem completion, Architecture adoption, Gate Green or a Git commit. Generic candidate tooling may be reused internally only without creating misleading generic Work attempt entries for document reviews.

## Requirements handoff and pending work

Use P1's applicable source resolution for both Planning and Work. Project-wide instructions, task-relevant current/accepted future requirements, decisions and acceptance criteria become bounded supplied context. Treat historical/draft/background material according to its role; arbitrary doc text never grants tool authority.

Store source/version/section references and the included requirements text in a separately bounded task snapshot. `parseAgentTask` currently strictly validates allowed fields and bounds original instructions at 20,000 characters; extend that owner coherently without raising the original prompt limit to hide context injection. Otherwise valid records without the new snapshot retain their supported execution paths and show context not recorded, without fabricated provenance or metadata-only grant invalidation. P11 adds preparation/serialization only. P12 supplies that snapshot through the common Dope execution path and adds a small disclosure to the existing `ChatPanelWidget` Work task/run detail; no dedicated context panel currently exists. The current Pi adapter byte bound and appended execution/retry text are runtime constraints to honor, not a constant to impose on all providers. Account for that overhead before claiming readiness; required omissions must be visible and resolved for affected work.

At start, compare the sources actually supplied to their current relevant basis. Rechecking an unchanged relevant requirement does not rewrite its accepted task or create a new documentation approval. Retain original supplied provenance and truthful evidence of the current check. Material contradictions, changed acceptance criteria or other changed applicable requirements use the reviewed preparation transition below. Unrelated docs do not invalidate all tasks; ordinary Git/dirty-basis checks still apply. External edits can stale work without inventing a Dope application event.

Pending `P*.txt` content follows the current workflow's valid before-run edit rule; no blanket reordering or restored first-authored-byte lock. Preserve in-flight/completed prompt snapshots, results, checkpoints and run records. Relevant edits cannot mutate an active agent's instructions invisibly; use existing steering/cancellation when needed.

### WC2 pending-preparation transition

The current `prepareSequenceTask` derives a stable step task ID and compares the entire saved task; `AgentStore.createTask` rejects overwrites, and `updateSequence` rejects changing a current task link before checkpoint advancement. Grants bind task identity/project/acceptance time rather than an independent documentation fingerprint. Preserve those general protections. P13 adds only the necessary guarded transition for a reviewed, still-pending preparation:

1. Verify the current project, sequence/owner revision, selected step, old preparation and changed relevant source basis; reject active/completed or stale transitions. Missing documentation metadata alone does not trigger this path.
2. Persist a distinct immutable preparation for the reviewed changed requirements, retaining original objective/prompt/step identity and all prior records. Use one stable replacement identity for retries of that reviewed transition.
3. Publish the pending owner/sequence link with expected-revision/old-identity checks. Do not advance or duplicate a checkpoint merely to make the link writable. A crash between task creation and linkage must leave a recoverable consistent selection; an unlinked replacement cannot silently start.
4. Require authorization genuinely bound to the replacement. An old task's grant cannot authorize materially changed instructions. Keep unchanged-task grants valid where only the new metadata is absent or relevant requirements are equivalent.
5. Recheck the linked preparation/source/grant at start. A stale competing prepare/start loses safely. Retry/restart resolves the same transition; successful later checkpoints refer to the actual selected task/run while previous checkpoints remain byte-preserved.

Keep existing origin-specific behavior: WorkItem launch request keys remain idempotent, one run per WorkItem task still applies and another attempt uses the existing new-launch path. Sequence capacity continuation keeps the same task/run/workspace/grant and one continuation prefix; it does not refresh instructions mid-run or become a new retry mechanism for every task origin. Restart reconciliation still marks orphan running/cancelling records interrupted and does not auto-resume them. Invalid or unapproved records retain their current rejection.

### Required compatibility matrix

| Case / existing DW gates | Focused acceptance | Integration and live evidence |
| --- | --- | --- |
| **WC1 / DW7, DW10** | No declared/selected/task-linked documentation, and unrelated docs only, both yield valid empty context after successful discovery. Exact original adapter prompt, existing permissions and ordinary preparation/start remain unchanged; no empty preamble, documentation proposal/event or extra approval. Required missing/inaccessible sources and reader failure are distinct. | P14 runs the ordinary empty-context control; P15 completes an actual local-model coding task on a project without applicable docs. |
| **WC2 / DW8, DW10** | Load old-format valid direct/WorkItem/stack fixtures through real parser/store/backend/runtime. Preserve their supported launch/retry/resume and unchanged identity/grants. Test reviewed replacement, old/new grant binding, repeated prepare, launch idempotency, crash between creation/linkage, stale concurrent start and retained checkpoints. | P14 exercises the supported origin/state matrix; P15 observes saved-task use and pending stack refresh/resume with task/run/checkpoint identity evidence. |
| **WC3 / DW8** | Separate controls for another file, another section of the same file and known nonsemantic formatting. They add no documentation-specific block/reapproval. A changed criterion or unresolved relevant change gets targeted resolution; missing/moved/ownership-changed sources and another change before start remain guarded. Preserve true source hashes and current Git checks; never infer semantic equality through blanket whitespace stripping. | P14 contrasts the three harmless controls with a material change; P15 shows the resulting ordinary or needs-review state and recovery without an approval loop. |
| **WC4 / DW7, DW10** | Capture initial and supported retry requests with empty/populated context. Assert original instructions, one inclusion of supplied requirements, selected provider/model, permissions and current capacity accounting including appended provenance/continuation overhead. | P14 exercises prepare → Run → allowed tool/candidate write → validation → candidate Accept/Reject, cancellation, supported continuation, checkpoint/next-step and restart disposition. P15 proves actual local coding behavior with empty and populated context; browser/native observations are independently attributed. |

Use parameterized fixtures within the already planned tests and existing owner APIs; do not introduce a general migration/compatibility service or production test bypass. P14 must separately report automated WC1–WC4 results and outstanding P15 observations. The final evidence ledger records case/source/project/task/preparation/run/model, expected behavior, actual outcome and evidence location. A required failure or gap prevents the associated DW gate and correction from being declared Green. These gates qualify the feature; they do not make unrelated user tasks perform qualification or add another activation approval.

## Compilation and focused command plan

All listed test files use the repository's Node test runner. Existing inspected tests load compiled runtime code from `lib/`, so rebuilding the changed owner is mandatory before that focused invocation. Baseline dependencies must already be installed using the repository's approved setup; this stack does not perform a dependency upgrade or lockfile repair.

On a cold checkout before P1, inspect the `@dope/ai` and `@dope/agent-core` `lib/` outputs: contracts imports both packages and cannot compile against missing declarations. Build each missing/stale prerequisite once with `corepack yarn workspace @dope/ai build` and `corepack yarn workspace @dope/agent-core build`, then P1's contracts/project-intelligence outputs. Before the first extension build, inspect its declared local dependencies and build missing/stale outputs in order: contracts, chat/project-intelligence/software-map, code-analysis, code-analysis-typescript/visual-planning as their actual imports require, then theia-extension. Inspect package/import state to avoid unrelated compilation. Record the one-time preparation and reuse it until the relevant source changes; do not repeat a baseline all-build in every prompt.

| Prompts | Changed-output compilation before focused test |
| --- | --- |
| P1 | `corepack yarn workspace @dope/contracts build`, then `corepack yarn workspace @dope/project-intelligence build`. |
| P2 | Project-intelligence; contracts first only when its source changed. |
| P3–P5 | Project-intelligence once per changed candidate. |
| P6 | Changed contracts, changed project-intelligence if any, then theia-extension. |
| P7 | Changed contracts if any, chat, then theia-extension. |
| P8 | Theia-extension. |
| P9 | Contracts, then theia-extension. |
| P10 | Theia-extension. |
| P11 | Changed agent-core, then theia-extension; other owners only if their source actually changed. |
| P12 | Theia-extension for runtime delivery and its existing Work detail presenter. |
| P13 | Changed agent-core if needed, other actually changed owners, then theia-extension. |
| P14 | Reuse current prior outputs; compile only actual P14 source changes, then one focused cross-owner invocation. |
| P15 | One `npm run check` on final source includes typecheck/tests/browser/Electron; no redundant surrounding build/test aggregates. |

Each P1–P13 prompt names its exact smallest Node invocation and `git diff --check`. The P14 integration invocation is:

```sh
node --test test/unit/documentation-workflow-integration.test.ts test/unit/history-integration.test.ts test/unit/roadmap-gate-document.test.ts test/unit/workitem-delegation.test.ts test/unit/pi-work-execution.test.ts test/unit/agent-sequence-persistence.test.ts test/unit/agent-execution-runtime.test.ts
```

P14 registers the actual P1–P13 new tests and its new integration test in the existing `test:product` list. It does not run that aggregate merely to check registration. P15's final `npm run check` consumes it once.

The persistence and execution-runtime companions are required for WC2/WC4 because parsing-only sequence tests cannot establish safe task linkage, capacity continuation, candidate review/promotion or restart behavior. P13 uses the narrower sequence-persistence companion; P14 owns the combined runtime flow. Keep this one targeted T2 invocation rather than adding repeated whole-product runs to T1.

For final native evidence, `corepack yarn workspace @dope/electron package:linux` packages the already built Electron output and executes established Pi preparation/check and AppImage verification. Do not use root `npm run package:linux` immediately after the final aggregate because it rebuilds Electron unnecessarily. Required plugin/assets must match the final source/package; do not omit those prerequisites or claim a package exists when packaging failed.

If a later repair changes product source, repeat the smallest affected checks and only the aggregate/manual/package evidence invalidated by that change. Evidence-only documentation updates do not alone require rerunning a product build.

## UI Design Compliance and Human Usability decisions

P8's task is review an agreed documentation decision and confidently apply its exact scope. Entry is existing Planning/Chat, next actions are Review/Apply/Revise/Reject, feedback is actual proposal/application state, and recovery is refresh/review or explicit owner recovery. P10's task is understand an earlier applied change; entry is the existing History row and next action is inspect original diff or available origin. P12/P13 expose relevant supplied-source provenance and actionable pending-work conflict through the current `ChatPanelWidget` Work detail/control surfaces.

Use central `--theia-*`/`--dope-*` tokens. Apply gets intentional primary emphasis when actionable; utility/view/reject/refresh controls remain neutral. Preserve keyboard/non-color focus, narrow readability, existing docking, text selection/debug-free copying, deliberate drag scrolling and alternate-theme isolation. No component palette, forced new workspace or broad theme rewrite.

Controller/presentation tests are T1 evidence. Actual visual/keyboard/copy/scroll and normal/narrow task completion, selected local model and no-model review belong to P15. Builds are not GUI proof, browser is not installed-native proof, and unit adapter capture is not proof of the user's real coding outcome.

## DW1–DW10 evidence allocation

| Contract gate | Focused/integration owners | Required P15 observation |
| --- | --- | --- |
| DW1 review without effects | P1/P2/P6/P7/P8/P14 | Actual Planning review, meaningful diff/summary, unchanged docs/no event. |
| DW2 coordinated apply | P3/P4/P5/P6/P14 | One exact multi-doc application and one History event. |
| DW3 exclusions | P2/P4/P6/P7/P9/P14 | Reject/cancel/no-op/failed-zero and no disguised Work attempt. |
| DW4 freshness/isolation | P2/P3/P5/P6/P13/P14 | Stale/foreign/late-source no overwrite or misattribution. |
| DW5 recovery/dedup | P3/P4/P5/P9/P14 | Disposable interruption and restart/retry, exact effects and one identity. |
| DW6 original historical diff | P4/P9/P10/P14 | Later file edit/deletion retains original evidence and safe navigation. |
| DW7 fresh coding handoff | P1/P11/P12/P14 | Fresh actual Work follows applied requirement without repetition/attachment; WC1 empty-context control and WC4 preserved coding flow. |
| DW8 pending work | P11/P12/P13/P14 | WC2 valid legacy use and reviewed preparation/link/grant integrity; WC3 irrelevant-edit controls versus material conflict; active/completed preservation. |
| DW9 Roadmap/status integrity | P5/P6/P14 | Current linked writer, no-doc acceptance excluded, no false qualification. |
| DW10 existing/local experience | P7/P8/P10/P11/P12/P13/P14 | Actual local, no-model, bounded-context, copy/scroll, keyboard/narrow and platform evidence, including WC1/WC2/WC4 current Work behavior. |

## Authoring verification and final routing

Validate this folder with `npm run codex:phase:validate -- c12-docs-workflow`. The required plan is contiguous Correction12 P1–P15 at unchanged0.12.7, exactly one final closeout, and Browser required only on P15. Authoring verification is grammar/documentation consistency only; it does not execute any product test or imply feature Green.

The mandatory efficiency audit is recorded in the assessment. P1–P13 remain bounded T1, P14 owns integration/registration, and P15 owns final aggregate/manual qualification. No additional audit prompt or duplicated qualification stack is needed. After P14, the runner stops for manual P15. Final disposition is evidence-based for this correction only; broader Phase12 and historical Pi obligations remain independently scoped.

