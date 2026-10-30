# /prompt-ass — c12-docs-workflow

**Date:** 2026-10-30 (America/Chicago). **Status:** OWNER-APPROVED SCOPE / ASSESSED AND AUTHORED ONLY, NOT RUN. **Product:** `0.12.7` unchanged. **Repository basis:** `c01711345ba3d83900b20242948abdabaeeeb6ac`.

[Contract](../../planning/p12/documentation-workflow-contract.md) · [ADR 0041](../../decisions/0041-planning-documentation-workflow-and-applied-history.md) · [Plan](implementation-plan.md)

## Goal and completion boundary

Deliver one complete route: existing Planning Chat -> concrete document review -> explicitly approved canonical document application -> exactly one owner-backed History entry for actual retained effects -> fresh, inspectable requirements supplied to coding Work. The owner expressly excludes unapplied reviews, proposals, approval-only, no-op, failed-zero-change and rejected/cancelled attempts with zero retained effects from documentation History. Cancellation after a retained change still requires truthful applied-effect evidence.

The first implementation is explicit creation/update of eligible project documentation. Relevant manually/external-edited docs can refresh Work context, but do not fabricate a Dope application receipt. Current documents remain canonical; persisted proposal bases, application journal and original applied diff are operational evidence beneath .dope, not competing live requirements.

## Direct source assessment

The following were inspected at the recorded source. They are existing integration seams, not claims that this new feature is implemented.

| Source/consumer | Observed behavior | Required addition |
| --- | --- | --- |
| `packages/theia-extension/src/node/chat-project-grounder.ts` | Bounded read/list/path/text primitives, protected-name exclusions, canonical root checks, symlink rejection, source hashes and omission diagnostics. | Reuse an injected approved reader for project-specific document discovery; do not invent broad file access or force every project into Dope's folder structure. |
| `packages/chat/src/service.ts`, `chat-backend.ts`, `chat-context-composer.ts` | Existing saved Chat leases, exact model/context, proposal result and explicit decision routing; current planning context primarily targets Roadmap/Planning. | Bounded documentation proposal adapter and deterministic apply routing in this same Chat pipeline. |
| `packages/project-intelligence/src/node/roadmap-store.ts` | Schema-2 methods `previewGateDocumentPatch`, `publishGateDocumentPatch`, `recoverGateDocumentPatch` own linked Markdown and revision/recovery state. | Adapter for actual linked-source effects; generic docs writer must not bypass this owner. |
| `roadmap-gate-document.ts`, `roadmap-document-patch.ts` | Source/section validation, formatting-preserving patches, guarded publication and before/after hashes. | Reuse relevant safe primitives/patterns for bounded eligible add/update, preserving current schema-2 semantics. Legacy checkpoint methods are not the forward interface. |
| `packages/contracts/src/history.ts` | Source/owner unions omit documentation applications; deduplication uses source plus sourceId, with separate event and current snapshot semantics. | Stable application-level source identity and truthful outcome metadata. |
| `history-backend.ts`, `history-owner-metadata.ts`, `history-work-git.ts` | Bounded owner metadata composition. Chat activity and ordinary pending/running/failed Work already have their own chronology. | Read only verified application receipts. A review must not manufacture a generic Work record simply to reuse execution machinery. Preserve unrelated History. |
| `history-widget.ts`, `history-navigation.ts` | One existing right panel, exact-owner navigation with project/staleness checks. | Documentation label and original immutable applied-diff target in ordinary editor/diff surfaces. |
| `AgentRuntimeBackend.createTask/launchWorkItem/prepareSequenceTask` | Direct creation, WorkItem requirements copied into task instructions, and phase-stack prompt snapshots. Start checks preserve prepared source equality. | Task-bound documentation context/provenance with explicit refreshed preparation when relevant docs change. |
| `prepareSequenceTask`, `AgentStore.createTask`, `updateSequence` | Prepared stack tasks use stable step IDs and full-object equality; saved tasks cannot be overwritten and a current sequence task cannot be swapped through the ordinary update path before checkpoint advancement. | A narrow revision-checked pending-preparation transition, with distinct replacement identity only when required, correct task/grant linkage, recoverable publication and unchanged prior checkpoints. |
| `packages/agent-core/src/sequence.ts`, `phase-stack-composer.ts` | Imported/generated executable text remains explicit task input. Generic source-check prose does not record supplied doc sections/hashes. | Preserve original prompt source and add a separate supplied-context snapshot, with pending-only refresh semantics. |
| `packages/agent-core/src/contracts.ts` | `AgentTask` and `parseAgentTask` strictly validate allowed fields; original instructions have a 20,000-character bound. | Small separately bounded supplied-context schema/parser/store roundtrip that preserves original instructions and the supported execution paths of otherwise valid historical tasks. |
| `agent-execution-runtime.ts` | Adapter prompt uses task objective plus instructions. | Common Dope-owned context assembly so feature behavior is provider-neutral. |
| `pi-work-execution.ts` and `packages/pi-runtime/worker.mjs` | Pi adds task/HEAD/candidate provenance and currently caps the scoped prompt at 32,000 bytes; resource discovery and agent-file loading are deliberately disabled. | Respect actual selected-adapter limits, report omissions and supply documentation through Dope. Do not enable Pi's unrestricted resource discovery or hardcode its current byte limit as a product-wide rule. |
| `backend-module.ts`, `frontend-module.ts`, `chat-panel-controller.ts`, `chat-panel-widget.ts` | Current DI/RPC and independently dockable Chat ownership, review, copy/selection and scrolling. | Thin documentation service registration and existing-panel controls without parallel UI/domain owners. |
| `ChatPanelWidget` Work task/run sections; `work-selection-controller.ts` | Existing task instructions, model/provenance and run diagnostics live in the shared widget's Work mode. There is no separate documentation-context panel. | A narrow supplied-document disclosure beside existing task/run detail, fed by task provenance. |

## Decomposition and dependencies

Fifteen prompts separate independent responsibilities. P1 establishes reusable source context; P2 proposal state; P3 guarded single-document effects; P4 multi-document recovery/receipt semantics; P5 linked Roadmap coordination. Only then P6 exposes approved service effects. P7/P8 connect existing Planning and its UI. P9/P10 add History projection/navigation. P11 captures source context in prepared tasks, P12 delivers/discloses it, and P13 reconciles relevant pending-work changes. P14 integrates the owners and registers tests. P15 is the single manual final closeout.

P3 internals remain unregistered from user-facing services until recoverability and P6 approval enforcement are complete. A half-implemented safe-looking Apply control must not ship early. P1/P2 review results may be useful before writes, but their UI must truthfully show unavailable application until its owner is ready.

The relevant project-aware Pi capability is an actual source/evidence prerequisite for dependent local Chat/Planning work. It was only authored at this snapshot; execution preflight must resolve it. No blanket historical Phase 11 requalification, all-Phase12-Green gate or new activation ritual is introduced.

## Risks and preserved behavior

1. **Unreviewed or stale publication:** bind proposal, approved digest, project/worktree and relevant source/owner versions, and recheck at the effect boundary. Preserve unrelated manual changes and absent-target collisions.
2. **Phantom/duplicate History:** application owner verifies durable actual effects; one application ID survives retry/restart. Zero retained effects never generate documentation events. Do not derive events from mtime, approval or today's dirty diff.
3. **Crash/partial effects:** retain bounded recovery evidence before publication; preserve newer external edits during rollback. Report exact retained subset, unresolved evidence and unknown times; never claim cross-owner atomicity.
4. **Competing linked writer:** current RoadmapStore remains the sole publisher of linked schema-2 source. Accepted structured draft without document bytes is not a docs application.
5. **Authority confusion:** project prose cannot grant execution rights, promote Architecture, start Work or award Gate Green. Commands Ask/Allow stays scoped to its existing investigation authority.
6. **Requirements not actually supplied:** test captured adapter input and the later real coding result separately. A reference list alone or a tool capable of reading docs is insufficient.
7. **Prepared task drift:** compare relevant supplied source versions before start. Resolve material contradictions explicitly; preserve active/completed records and avoid blocking for unrelated changes.
8. **Layering and model limits:** contracts already depends on agent-core. Do not create reverse imports into core; map serializable task provenance at the existing extension boundary. Use bounded selected-model context with honest omissions.
9. **UI regressions:** reuse current Chat/History/editor ownership, exact selected provider, copy/drag separation, narrow/keyboard behavior and current semantic restrained-orange theme. Preserve no-model review and ordinary editor use.

## Owner-requested compatibility strengthening — 2026-10-30

After authoring commit `5daccac5744b8e2bbb6a3c9e1dc79931b79072be`, the owner asked whether the feature could break the current agent, then instructed that the gates be strengthened. The sensitive integration is P11–P13: strict task persistence, actual adapter input and the transition from prepared to running work. These are acceptance gaps identified in the plan; the documentation-only commit supplies no evidence of a runtime regression or of implementation compatibility.

| Required case | Gap closed by this amendment | Scope and evidence |
| --- | --- | --- |
| **WC1** | An absent-source unit check alone did not guarantee that a project with no applicable docs still runs normally. | Successful empty selection preserves original input and ordinary permissions. Explicitly required missing sources and reader failures remain distinguishable. P1/P11/P12 focused fixtures feed P14 and a P15 live empty-context control. |
| **WC2** | Readable legacy records did not prove supported execution or safe refresh of immutable prepared tasks. | Otherwise valid direct, WorkItem and stack fixtures exercise their current supported start/retry/resume paths. Missing context metadata alone never forces new review. Material replacement binds a distinct preparation through the current task/sequence owner and correct grant basis, preserving prior evidence. |
| **WC3** | A changed document fingerprint could be misused as proof of a requirement conflict. | Compare selected requirement/section evidence. Unrelated or demonstrably nonsemantic changes create no new documentation-specific approval loop; preserve ordinary Git/dirty-basis checks. Ambiguous relevant changes get targeted resolution, without indiscriminate whitespace stripping or fabricated semantic certainty. |
| **WC4** | Captured context and feature-specific tests did not alone protect the complete existing coding flow. | P14 covers normal preparation, tools, validation, Accept/Reject, cancellation and supported retry/resume with empty/populated context. P15 observes actual selected-local-model tasks and records browser/native evidence separately. |

Preserving current behavior includes current limits: one run per WorkItem task with the existing new-launch path for another attempt, sequence-only capacity retry on the same task/run/workspace/grant, and interrupted disposition of orphan running/cancelling work after restart. It does not make malformed/unapproved records runnable, weaken existing validation/grants, add automatic restart execution or revive a removed product model.

The WC cases are mandatory subcases of DW7/DW8/DW10, with acceptance judged from recorded evidence. They are not a new owner-activation ceremony or a requirement that every ordinary user task rerun a qualification suite. Existing records and input remain unchanged where missing metadata or an irrelevant edit is the only difference. The exact source check and preparation replacement protocol belong to P13; the larger cross-owner behavior matrix stays in P14/P15.

## Model/tier and time decision

Sol Medium is selected for P1 deterministic source selection using existing read authority, P8 existing-panel review controls, P9 History source projection and P10 History navigation. Sol High is selected for P2–P7 durable/authority/linked-owner/provider integration, P11–P13 task/context freshness, P14 cross-owner evidence and P15 manual final diagnosis. No XHigh or Terra prompt is needed.

P1–P13 each have one coherent owner-focused deliverable with <=8-minute target, 10-minute soft ceiling and 15-minute hard budget including focused validation. Those are estimated feasibility budgets, not observed performance. Authority checks and crash recovery cannot be dropped to meet time. If actual source changes invalidate the split, stop and report a concrete remaining responsibility before expanding a prompt.

P14 is explicit T2 integration. P15 is manual T3 for a justified final full aggregate, browser/native/local-model flow, restart and package/source attribution.

## Validation and build inspection

Inspected tests import runtime values from compiled `lib/`: History projection/navigation/integration, Roadmap gate document/store, Chat context/panel, WorkItem delegation, sequence and Pi Work. Source-only type imports do not remove that runtime dependency. Every implementation prompt therefore names the smallest changed-owner builds before its focused Node test invocation.

Each package's `build` is TypeScript compilation (the extension also copies its CSS). `contracts` depends on `ai` and `agent-core`; `project-intelligence` depends on `contracts`. Chat and extension consume the shared outputs. On a cold execution checkout, inspect and build missing/stale AI and agent-core outputs before P1's contracts compilation; the plan records exact prerequisite commands. Build other required upstream outputs once in their actual dependency order, record that preparation, and reuse them until their sources change. Do not repeatedly run the global extension/app build as a convenience.

New tests are planned feature regression files, not existing evidence. P14 registers the actual resulting test paths in `test:product`. The current `npm run check` nests typecheck, tests and browser/Electron builds. P15 uses it once on final product source and does not surround it with duplicate commands. After that build, `corepack yarn workspace @dope/electron package:linux` packages existing Electron output and runs its established Pi-asset preparation/verification; unlike root `npm run package:linux`, it does not invoke another Electron app build.

## Mandatory Prompt Efficiency / UI / Human Usability audit

**Authoring outcome: PASS for the planned decomposition and execution contract; implementation timings and product gates remain unmeasured/unrun.**

- **Responsibility:** proposal persistence, file effect, multi-file recovery, linked ownership, service authority, Chat routing/UI, History data/UI and Work capture/delivery/freshness are separated. Independent authoring review identified the original combined Work handoff as too broad; splitting capture from runtime delivery produces the current 15-prompt stack. P14/P15 concentrate cross-system and live evidence.
- **Runtime:** each ordinary brief retains one implementation responsibility. WC1–WC4 extend the existing owner-focused fixtures; the complete origin/state and live-flow matrix stays in P14/P15. P13's guarded preparation transition is part of its existing freshness responsibility, not a generic task-migration platform. Security-sensitive splits keep prerequisites explicit and unexposed until safe.
- **Precision:** one bounded focused invocation per ordinary prompt, with the closest existing regressions where behavior changes. No all-product test/app-build/packaging boilerplate in T1.
- **Compilation:** known lib-consuming tests get changed-owner output compilation, with cached upstream baseline rather than stale JS or repeated all-builds.
- **Evidence:** safety negatives occur with the introduced effect, not postponed wholly to manual testing. Real UX/local provider/coding behavior stays P15.
- **Deduplication:** one T2 cross-owner invocation; one final `npm run check`; packaging reuses final Electron output. Subsequent repair reruns only invalidated evidence.
- **Economy:** routine projection/UI tasks use Medium; High is justified by concrete authority, persistence or runtime boundaries.
- **Grammar/routing:** contiguous Correction12 P1–P15, unchanged0.12.7, exactly one final closeout, Browser required only P15; no /activate, self-commit or execution by authoring.
- **Visual compliance:** P8/P10 and the small P12/P13 existing Work disclosure use centralized semantic tokens, neutral utilities and restrained primary emphasis; no component palette or theme rewrite.
- **Human usability:** each UI prompt has a task, next action and stale/error recovery; focused controls tests are paired with P15 normal/narrow, keyboard, manual and model-assisted task observation.
- **Compatibility amendment:** P1/P11/P12/P13 add focused empty-context, valid-legacy, exact-input/retry and relevant-change assertions to their planned test files. P14 owns connected compatibility results and P15 actual coding evidence. Prompt count, model/effort, tiers, changed-owner compilation and the single final aggregate remain unchanged. WC1–WC4 are specified but have not run or passed.

Authoring verification: `npm run codex:phase:validate -- c12-docs-workflow` passed for contiguous P1–P15 at unchanged `0.12.7`, with P15 as the only Browser-required closeout. A local documentation consistency check found no unresolved relative links, prompt/filename mismatches, trailing whitespace or missing final newlines across the 18 authored files. No product tests, implementation prompts or manual qualification were executed.

Compatibility amendment verification: the grammar validator passed again; the 12 amended documentation/prompt files preserve DW1–DW10 and add exactly WC1–WC4, with the P14 command matching this plan. Link/whitespace checks and independent source-specific compatibility review found no remaining authoring issue. The new regression assertions and live gates remain unexecuted; this authoring result is not a compatibility PASS.

## Explicit deferrals

Ambient documentation drift monitoring/rewriting, every-editor-save history, file delete/rename, general executable prompt publication, broad architecture adoption, unrelated History filtering, a new chat/task/event platform, global provider/default/context changes and all-Phase12 qualification are deferred. Pending prompt repair uses its existing reviewed owner rather than being included secretly in a documentation-only Apply.

