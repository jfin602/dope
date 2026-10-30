# Phase 12 — Planning Documentation Workflow

**Owner decision:** 2026-10-30 (America/Chicago). **Status:** OWNER-APPROVED DESIGN / AUTHORING ONLY / NOT IMPLEMENTED OR QUALIFIED. **Product:** `0.12.7` unchanged. **Review basis:** `c01711345ba3d83900b20242948abdabaeeeb6ac`.

**Decision:** [ADR 0041](../../decisions/0041-planning-documentation-workflow-and-applied-history.md). **Implementation workstream:** [c12-docs-workflow](../../tasks/c12-docs-workflow/README.md). **Related capability:** [project-aware Pi Chat/Planning](agentic-chat-permissions.md).

The owner's `/docs-apply + /prompt-ass + /prompt-plan + /prompt-write c12-docs-workflow` authorizes documentation reconciliation and stack authoring. Implementation requires a later deliberate Run of that stack, with normal source, dependency and dirty-tree preflight; no additional `/activate`. Neither this contract nor authored prompts establish implementation, qualification or a version transition.

**Compatibility amendment:** The owner's later instruction to strengthen the gates adds mandatory **WC1-WC4** evidence within existing DW7/DW8/DW10, on documentation baseline `5daccac5744b8e2bbb6a3c9e1dc79931b79072be`. It preserves the 15-prompt stack and unchanged `0.12.7`. These cases qualify the new feature; they do not add an activation step or a runtime prerequisite for ordinary unrelated Work.

## Intended developer outcome

An agreed Planning decision becomes reviewed project documentation. Only its actual application appears as a documentation change in Project History. Subsequent coding work receives and follows the relevant updated requirement without the developer repeating or manually attaching it.

This is one end-to-end capability: documentation review, approved application, applied-change provenance, History projection and requirements supplied to Work. Delivering file edits alone does not satisfy it.

## Existing owners and surfaces

| Concern | Authority and presentation |
| --- | --- |
| Discussion and planning interaction | Existing saved Chat, ChatPanel, project identity, selected model and context pipeline. No second chat or forced docking layout. |
| Written project requirements | Actual repository documentation, usable by Dope, conventional editors and other agents. |
| Documentation proposal and application | One Dope-owned application service with typed validation and versioned project-local state beneath `.dope/`. |
| Linked Roadmap | Existing Roadmap writer and linked-source reconciliation, current Phase/Gate/Criterion model and existing qualification evidence. |
| Architecture and physical evidence | Existing canonical Architecture and Physical Map owners. A documentation edit is not automatic adoption or observed source truth. |
| Coding work | Existing WorkItem, task, prompt-stack, execution, grant, candidate review and validation owners. |
| History | Existing bounded read-only projection of actual owner records; ordinary editor/diff/Chat/Work views remain navigation owners. |

Application metadata may retain proposal bases, approved changes, application/recovery records, immutable applied-diff evidence and context provenance. This is operational state, not a second authoritative live copy of project documentation or a general event-sourcing subsystem. Do not revive removed Plan/PlanStep/Task or Session domains.

## Document discovery and roles

Discover the project's existing documentation and instruction conventions through approved, bounded project reads. Do not assume that all projects use Dope's own `BOOT.md`, `AGENTS.md` or `docs/` layout. Manual selection can identify additional eligible documentation. Where a decision has no suitable home, propose a new document at an approved unused project-relative path.

Initial operations cover eligible text documentation through exact, reviewable changes. Eligibility depends on the project, actual path/owner and reviewed purpose, not a filename suffix alone. Supported creation/editing does not lift existing delete/rename, protected-path, credential, outside-root or executable-source restrictions. Unsupported formats or operations must be reported truthfully rather than approximated destructively.

Distinguish these roles in review and downstream context:

- Current accepted project instructions and requirements.
- Accepted future behavior or architecture intent that applies to the work being planned.
- Observed implementation/qualification claims that require supporting source or recorded evidence.
- Drafts, rejected proposals, superseded decisions and historical reports.
- Background explanation and examples that do not themselves grant authority.

Current instructions cannot be selected merely because they are the newest file or contain imperative wording. Follow declared project authority and explicit supersession; surface material contradictions. Historical or unaccepted material must not silently override applicable accepted requirements. Documents never expand configured executable authority.

## Review operation

**Review documentation changes**, `/docs-review`, and an explicit natural-language request to formalize a decision enter the same operation in the existing Planning/Chat experience.

1. Read the relevant current documents and supporting source when describing existing behavior.
2. Identify the decision, affected documents/sections and any required cross-document changes.
3. Surface material conflicts with applicable Architecture, linked Roadmap state, WorkItems, pending prompts or existing instructions.
4. Produce a concrete typed proposal and readable summary with an inspectable diff for each affected document.
5. Permit revision, rejection or explicit application of that proposal.

The proposal records stable project/proposal identity, originating Chat/Planning references, target paths/operations, expected source versions or verified absence for a new file, applicable owner revisions, exact proposed effects and a digest identifying the reviewed change set. Application code validates these facts; model-provided paths, hashes and assertions are untrusted inputs.

Review does not modify canonical documentation, publish Roadmap changes, start Work or create a documentation-change History entry. Durable proposal state is recoverable noncanonical work. A chat draft, generated patch or candidate file is not an applied project change.

Review output explains what changes and why before presenting raw diffs. Missing evidence, omitted context and unresolved decisions remain visible. A proposal must not describe an accepted future requirement as already implemented or qualified.

## Approval and application

**Apply documentation changes** and `/docs-apply` use the same Dope-owned action. Approval covers one concrete reviewed change set, including its target project/root and applicable worktree identity, expected source versions and relevant owner revisions. Apply directly under that approval while it remains valid; do not add repetitive per-file confirmations or an activation-only gate.

Before effects, revalidate project ownership, safe canonical path resolution, source fingerprints, new-file absence, proposal identity and applicable owner state. Preserve unrelated dirty content and user prose, including supported source formatting/line endings. Reject or reconcile stale, foreign, moved, missing, ambiguous or unsupported targets; never silently overwrite a changed basis. A material change to the patch, scope or relevant source basis requires refreshed review. Cosmetic re-rendering of an unchanged reviewed proposal does not.

Only the application service writes the approved eligible documentation through appropriate existing owner APIs. Neither the model's normal tools nor **Commands: Ask / Allow** acquires broad write authority. Reuse existing safe path, candidate/promotion and validation primitives where appropriate without making generic Work execution a prerequisite for documentation review or creating another agent loop.

After writes, verify the actual persisted effects and their resulting source identities. Report the actual changed files, unchanged/no-op targets and any pending reconciliation/recovery. An approval, successful model response or candidate validation is not proof of publication.

Applying documentation means project documentation changed; it does not require a Git commit and does not automatically create one. Executable prompt publication, Work Run, grants, candidate promotion, Architecture adoption, WorkItem completion, Gate Green and phase closeout retain their existing distinct authority.

## Linked Roadmap coordination

For a linked Roadmap, preserve its current **Phase -> Gate -> Criterion** model, stable section mappings, supported grammar, expected source fingerprint and owner revision. Use its existing authoritative writer and source reconciliation; do not directly bypass it with a second Markdown writer.

The combined review should expose relevant related document and Roadmap changes together. Each owner still validates its own effects and reports its actual outcome. Documentation writes and structured Roadmap persistence must have coordinated, durable recovery without claiming cross-file/cross-store atomicity.

An accepted structured Roadmap draft that has not published Markdown is not an applied documentation change. Re-reading or importing externally changed Markdown into `.dope/` without writing the document creates no new Dope documentation-application event. A changed document must not confer qualification when its gate evidence does not support that result.

## Durable application record

The documentation owner retains enough provenance to reconstruct exactly what happened:

- Stable project-scoped application ID and originating proposal identity.
- Actual application time, or an explicitly unknown time when recovery cannot establish it.
- Initiating developer identity and agent/model attribution where available; never fabricate identity.
- Actual affected paths and operation types, with verified before/after source identities.
- Durable applied-diff evidence and a concise summary of the actual effects.
- Originating Chat/Planning and associated work references where available.
- Actual outcome and any partial/recovery or linked-source reconciliation state.

Retain the applied diff independently of the current dirty working tree. Later edits, moves or deletion may affect navigation availability, but must not rewrite the historical change. The record is application provenance, not permission to replay the effect.

## Applied-only Project History

**Only verified, durably recorded applied documentation effects qualify for a documentation-change entry.**

| Outcome | Documentation-change History behavior |
| --- | --- |
| Discussion, draft, review or generated proposal | No entry. |
| Approval without actual application | No entry. |
| Rejection or cancellation without retained changes | No entry. |
| Failed application with zero retained changes | No entry. |
| No-op application | No entry. |
| Successfully applied change set | Exactly one entry for its actual files and diff. |
| Verified retained subset after interrupted application | One clearly partial/recovery entry describing only actual retained changes; never full success. |
| Retry, refresh, restart or repeated owner notification | Retain the original application identity and time; no duplicate. |

History reads bounded application metadata and opens existing diff/editor/Chat surfaces. It does not write or recover owner stores, replay changes, invoke a model, or invent events from file mtimes, Chat messages, approvals, Git dirty snapshots or candidate workspaces.

The applied-only rule is specific to documentation-change entries. Existing unrelated Chat, Work and Git activity remains governed by its existing owner semantics. A review may update its normal Chat, but must not manufacture a new documentation or generic Work entry representing a mere documentation attempt. If implementation reuses candidate machinery, its classification must preserve this distinction.

The entry status means documentation changed. Implementation, validation, qualification, canonical Architecture adoption, Git commits and WorkItem completion remain independent facts. A later separately approved reversal is a new application; earlier history remains intact.

## Failure, concurrency and recovery

Prepare bounded durable recovery information before publication where needed, but do not expose a prepared journal as an applied History event. Revalidate relevant source/owner identities at the effect boundary; cancellation and late project-switch responses must not apply to a newly selected project.

| Case | Required result |
| --- | --- |
| Failure before a durable file change | Preserve project bytes; no documentation-change entry. |
| Crash after changes but before normal acknowledgement | The application owner reconciles durable evidence and verifies actual effects before exposing an outcome. History itself performs no recovery writes. |
| Multi-document or document/store partial failure | Surface exact affected and pending targets. Restore earlier bytes where safe, or retain and record only verified applied effects with an explicit recovery state. Do not overwrite newer unrelated edits during rollback. |
| Retry of an existing application | Resolve its stable ID and current recovery state; do not repeat already applied effects or duplicate History. |
| Source changes after review | Deny stale application or produce a refreshed reviewed proposal; preserve manual changes. |
| Missing or unsafe recovery evidence | Report an unresolved recovery state; do not claim success, assign a fabricated application time or invent a historical diff. |

Recovery must not silently rerun model reasoning, approve new content, start Work or widen permissions. A recovered verified subset can update the same application record's recovery disposition; a separate changed proposal or later reversal has its own application identity.

## Documentation supplied to Work

Before preparing or starting affected coding work, resolve the applicable current project instructions, accepted requirements/decisions, architecture constraints and Gate/acceptance criteria. Supply bounded source-backed material through existing WorkItem/task/prompt/execution contracts, rather than depending on a model to happen to read the correct files.

Successful bounded discovery with no applicable documentation yields empty documentation context and the current ordinary execution path, without a new documentation approval. An explicitly required source that is missing or unreadable, or a failed discovery operation, is a distinct condition; never label it as a successful empty result. Resolve only the affected correctness limitation through the existing preparation flow.

Each supplied source identifies its project, document, relevant section, role and source version/fingerprint. The developer can inspect which sources guided the task and any relevant omissions. Summaries may aid context sizing but cannot discard material constraints or present omitted requirements as supplied. Preserve enough provenance with the prepared task/run to explain its original instructions later.

Use actual selected-model capability/context limits. Do not hardcode the current Pi byte limit or a global context size into this product contract, load every document into every turn, silently switch providers, or enable Pi's unrestricted project resource discovery. Requirements selection and application authority remain Dope-owned and provider-independent.

Applicable documentation can be edited by Dope or conventional external tools. Freshness checks use current source evidence; external edits do not fabricate a Dope application receipt or automatic author attribution. If required material is missing, stale, inaccessible or omitted, state the actual limitation and resolve material correctness conflicts before starting the affected work. A whole-file hash change signals that applicability must be checked; it does not prove a semantic conflict. Unrelated files, changes outside the selected requirements/sections, and demonstrably nonsemantic formatting changes add no documentation-specific block or repeated approval. Preserve exact source provenance and meaningful whitespace/structure; do not obtain compatibility by blindly stripping content or normalizing away requirements. Unresolved relevant meaning receives targeted review. Existing Git clean/accepted-dirty, source-basis and permission checks still apply independently.

## Prepared, running and completed work

Otherwise valid legacy direct, WorkItem and prompt-stack tasks remain usable through each origin's currently supported run, retry, resume or new-launch path, not merely readable. Absence of the new documentation metadata alone must not invalidate existing grants, replace the original task identity/instructions, or force review. Label unrecorded context honestly rather than inventing historical provenance. Preserve current eligibility and approved-validation rules: this does not admit malformed/unapproved WorkItems, permit another run on a one-run WorkItem task, expand sequence-only capacity retry to other origins, or automatically resume orphaned running/cancelling runs after restart.

When relevant documentation changes after preparation:

1. Compare the current applicable requirements with the recorded preparation and distinguish material changes from compatible source changes. Missing legacy metadata alone is not evidence of a changed requirement.
2. Identify material contradictions or changed acceptance criteria in pending WorkItems/prompts and resolve the affected preparation explicitly; show the source of the change.
3. Keep the saved task immutable. A changed applicable requirement uses a distinct, versioned preparation/task identity linked through the existing task, WorkItem or sequence owner as applicable, preserving the original prompt, logical step, order, prior runs and completed checkpoints.
4. Bind the reviewed execution grant to the replacement task ID and actual requirement basis. An old grant cannot authorize materially changed requirements; unchanged compatible requirements do not acquire a new documentation approval ritual.
5. Recheck source, project, pending-owner linkage and grant basis at execution. No documentation action automatically starts Work.

Current stable sequence/Pn IDs, whole-task equality, `AgentStore.createTask` overwrite rejection and `updateSequence` task-ID guards require a narrow pending-preparation transition in the existing owner. Preserve expected-prior linkage, durable crash recovery and idempotent replacement retry/restart; original WorkItem request keys still refer to their original launch. A crash after task creation cannot execute an unlinked replacement; stale concurrent prepare/start loses safely. Keep each actual checkpoint bound to its actual task/run. Do not repoint ad hoc, weaken invariants globally or advance/duplicate checkpoints to permit replacement. Compatible freshness observations can retain new provenance separately without changing original task/run snapshots.

Preserve in-flight instructions, completed prompt snapshots, results, checkpoints and historical evidence. Changes requiring different behavior during an active run use the existing explicit steering/cancellation mechanisms; do not mutate its instructions invisibly.

The [current workflow](../../workflow.md) permits valid pending `P*.txt` content edits before execution and uses the current parsed prompt snapshot. Do not reinstate the superseded first-authored-byte lock. Content updates do not grant blanket permission to reorder authored stacks. Documentation apply may identify a needed prompt repair; executable prompt editing/publication continues through its existing reviewed preparation path, rather than being smuggled into a documentation-only operation.

## UI, local models and manual operation

Use the existing ChatPanel in its user-selected dock and its normal compact activity treatment. Present a short decision/change summary, affected documents, **Review**, **Apply**, **Revise/Reject** as appropriate, and links to existing document/diff views. Keep the next supported action and pending/error/recovery state visible. Do not force a new documentation workspace, second chat, mode switch or agent transcript as the primary review experience.

Use current semantic theme tokens and restrained-orange primary/selected emphasis; ordinary utility controls remain neutral. Preserve accessible keyboard/focus, narrow panes, selection/copy, debug-free response/transcript copying, deliberate drag scrolling, cancellation, saved Chat continuity and alternate themes. Show source/permission details only where they inform the decision; do not expose raw tool JSON as the normal review.

Models receive bounded relevant sections and propose typed changes; deterministic code owns validation, concurrency, writes, receipts and History projection. Preserve the exact selected provider/model and local-only settings without silent fallback. Manual proposal review, editing, application and History navigation remain useful without model inference.

## Sequencing and scope

This is the separately assessed `c12-docs-workflow` Phase 12 follow-on. Confirm the required project-aware Planning and shared owner seams against the actual execution checkout, including the relevant `c12-pi-agentic-chat` capability, rather than inferring readiness from authored prompts or a version number. Its existing commands/permissions and historical evidence keep their own scope.

Do not graft new publication behavior silently into previously authored Pi prompts, require broad historical Phase 11 requalification, or wait for all Phase 13 background knowledge alignment. Later Phase 13 findings may offer this same explicit review/apply path as a developer-controlled resolution.

The initial scope is explicit documentation changes through this workflow and their coding handoff. It does not add ambient document rewriting, every-keystroke/editor-save auditing, a generic History ledger, automatic Git operations, automatic code implementation, a new prompt runner, broad architecture adoption or new model/provider defaults.

## Qualification gates

All gates are source-bound. Focused implementation tests and explicit integration checks provide narrow evidence; actual browser/native task observation belongs to the designated manual qualification prompt. Browser results do not silently prove native parity. Preserve unobserved, failed and owner-dispositioned cases honestly; no gate passes by documentation authoring. WC1-WC4 preserve current supported Work behavior; they do not revive removed domains, promise unsupported reruns, or create a general compatibility platform.

| Gate | Required evidence |
| --- | --- |
| **DW1 — Review without application** | A real Planning request yields accurate coordinated document diffs and readable reasoning; canonical documentation remains unchanged and no documentation-change History entry appears. Supporting claims cite actual supplied source; manual review is available. |
| **DW2 — Coordinated application** | One approved multi-document update changes only intended eligible content, preserves unrelated dirty text/formatting, verifies resulting versions, and creates exactly one entry for the actual applied set. |
| **DW3 — Applied-only exclusions** | Review, approval-only, reject, cancel, no-op, candidate-only and failed-no-change cases produce zero documentation-change entries or disguised new generic Work entries. Existing unrelated History semantics survive. |
| **DW4 — Freshness and project isolation** | Concurrent edits, stale proposals, new-file collisions, unsafe/symlink/outside-root paths, project switches and late responses preserve newer/foreign content and cannot misattribute an application. |
| **DW5 — Recovery and deduplication** | Controlled failure before writes, after a file write and before acknowledgement demonstrates verified recovery, truthful zero/partial/full effects, no unsafe rollback, stable identity/time and no duplicate on retry/restart. History reads remain non-mutating. |
| **DW6 — Historical diff accuracy** | Later edits or deletion do not change an earlier applied diff/summary. Entry navigation opens its original evidence and existing owner views, with truthful unavailable targets and no replay or Work start. |
| **DW7 — Fresh Work handoff** | Apply a requirement, start fresh Work without manually repeating/attaching it, inspect source/version-bound supplied context, and demonstrate resulting behavior follows the requirement. WC1/WC4 additionally prove ordinary coding with empty/populated context. Application success and coding-test success remain separate evidence. |
| **DW8 — Pending work reconciliation** | A relevant conflicting update is detected and resolved before pending work runs through a guarded replacement preparation; compatible freshness is inspectable without a new documentation block. WC2/WC3 prove legacy operation, correct identity/grant/checkpoint handling and relevant-only review; active/completed snapshots and current prompt-content/order rules survive. |
| **DW9 — Roadmap and status integrity** | Linked Markdown changes use its existing writer, revision/mapping/recovery behavior and Phase/Gate/Criterion semantics. Acceptance without document publication creates no documentation event; no automatic Architecture adoption, Work/grant, completion or Gate Green occurs. |
| **DW10 — Existing experience and local operation** | Real saved Chat/diff/History task flow, normal/narrow keyboard/focus, copy/scroll and restart are observed with the selected eligible local model and a bounded-context/omission case; manual/no-model operation and provider choices survive. WC1/WC2/WC4 include existing coding execution and recovery, not only documentation UI. Record native/browser evidence independently. |

### Mandatory Work compatibility cases

| Case | Existing gates | Required evidence |
| --- | --- | --- |
| **WC1 — Empty context** | DW7, DW10 | Successful discovery with no applicable docs preserves ordinary prepare/run and existing approvals with empty context. Contrast an explicitly required missing/unreadable source and discovery failure: each is reported truthfully and handled only for the affected work, never disguised as empty success. |
| **WC2 — Legacy and pending preparation** | DW8, DW10 | Otherwise valid persisted direct, WorkItem and stack tasks lacking new metadata exercise their currently supported run/retry/resume or new-launch paths after reload; missing metadata alone changes neither identity nor grants. A material requirement change instead proves the guarded versioned replacement, correct pending-owner/sequence/grant binding, and crash/concurrent-start recovery without overwriting old tasks, duplicating runs or advancing prior checkpoints. Existing one-run, approval, validation and interrupted-run rules remain. |
| **WC3 — Relevant semantic changes** | DW8 | Unrelated file edits, unchanged selected requirements/sections and demonstrably nonsemantic formatting edits produce no new documentation-specific block or repeat approval, including on repeated checks. Exact provenance remains inspectable and existing Git/source rules still apply. Meaningful whitespace/structure, changed acceptance criteria and unresolved relevant semantics cannot disappear through normalization; only affected requirements receive review. |
| **WC4 — Ordinary coding lifecycle** | DW7, DW10 | With empty and populated context, exercise current prepare -> run -> permitted tool use -> validation -> candidate review -> accept or reject, plus supported cancellation, retry and stack resume. Use the selected eligible local model; prove bounded context and retry delivery without duplicate injection, unchanged permissions/model/candidate/History semantics, and immutable running/completed snapshots. Sequence capacity retry retains its existing task/run/workspace/grant and one continuation prefix. |

Allocate this evidence within the existing stack:

- **T1, P1/P11-P13:** the smallest focused cases for discovery, empty/required-missing distinction, legacy serialization/preparation, bounded delivery and guarded relevant-change transitions. Keep ordinary implementation validation bounded; do not add an aggregate per prompt.
- **T2, P14:** source-bound integration covers the direct/WorkItem/stack origins, applicable requirement changes, supported retries/restart/resume, replacement linkage/grants, crash/concurrent-start cases and unchanged candidate/History behavior. Reuse focused evidence where its source and seam remain applicable.
- **T3, P15 only:** observe representative empty/populated documentation coding journeys with the selected local model and actual candidate review, cancellation/recovery and existing UI. Cite source-applicable T1/T2 evidence for remaining origin/failure cases instead of replaying every permutation in the GUI. P15 remains the sole manual closeout and final aggregate; record missing required cases as gaps.

Actual WC evidence is required to accept this feature. It is not a runtime checklist that blocks ordinary unrelated Work, a second Run approval, a new prompt, or a claim of Green from authored instructions.

Qualification uses disposable projects for destructive/interruption negatives and preserves the owner's working projects. Evidence identifies exact source, relevant document hashes, application identity, context sources, observed runtime/provider and actual outcomes. The stack's final disposition must identify any remaining gate gaps; it cannot declare broader Phase 12 Green or waive existing Pi obligations.
