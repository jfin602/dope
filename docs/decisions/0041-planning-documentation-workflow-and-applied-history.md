# ADR 0041 — Planning documentation workflow and applied-only History

**Decision date:** 2026-10-30 (America/Chicago). **Status:** OWNER-APPROVED DESIGN / AUTHORING ONLY / NOT IMPLEMENTED OR QUALIFIED. **Product:** `0.12.7` unchanged. **Reviewed source:** `c01711345ba3d83900b20242948abdabaeeeb6ac`.

The owner approved `/docs-apply + /prompt-ass + /prompt-plan + /prompt-write c12-docs-workflow` after the documentation review. This authorizes this design and the implementation stack's authoring. It does not run the stack, qualify the feature, close Phase 12 or change the product version. A deliberate later Run of the selected stack is the implementation authorization under the current [workflow](../workflow.md); no separate `/activate` is required.

The owner's subsequent instruction to strengthen the gates, on documentation baseline `5daccac5744b8e2bbb6a3c9e1dc79931b79072be`, adds mandatory WC1-WC4 within existing DW7/DW8/DW10. The 15-prompt stack and `0.12.7` remain unchanged; this amendment authors acceptance requirements, without implementation or qualification.

## Decision

Planning must turn agreed decisions into reviewed project documentation and carry the applicable updated requirements into subsequent coding work. Add **Review documentation changes** and **Apply documentation changes** to the existing saved ChatPanel, with `/docs-review` and `/docs-apply` as equivalent entry points. A documentation review produces an inspectable proposal; explicit developer application publishes its bounded, current-source changes through Dope-owned authority.

**Project History records only actual applied documentation changes.** Discussion, drafts, reviews, approval alone, rejection, cancellation without retained changes, failed-no-change and no-op application produce no documentation-change entry. One applied change set produces one stable entry, even when it changes several documents. Retry, refresh and restart do not duplicate it.

The detailed product contract and qualification gates are in [Planning Documentation Workflow](../planning/p12/documentation-workflow-contract.md). The separately authored implementation workstream is [c12-docs-workflow](../tasks/c12-docs-workflow/README.md).

## Ownership and authority

- Repository documents remain the written project requirements shared with conventional editors and external agents. Resolve the project's actual document structure and declared current authority; do not require Dope's own filenames in every project.
- One Dope-owned documentation application service owns proposal validation, source-bound approval, approved writes and durable application/recovery provenance. Its versioned project-local metadata belongs beneath `.dope/`; it must not become a competing live specification or general activity database.
- The model proposes changes. The application service applies only the reviewed eligible documentation changes. Ordinary model file/shell tools and **Commands: Ask / Allow** keep their current limits. This is a narrow reviewed publication action, not permission for unrestricted canonical writes, Git mutation, Work execution or candidate promotion.
- Approval binds the actual change set, project/root and applicable worktree identity, reviewed document versions and relevant owner revisions. One coherent set needs one approval. Material changes to the content, scope or relevant source basis require refreshed review; unchanged approval does not create a repeated per-file confirmation ritual.
- Linked Roadmap Markdown continues through its existing source adapter and authoritative owner, using the current **Phase -> Gate -> Criterion** domain. Preserve unrelated prose, source hashes, stable mappings, owner revisions and recovery states. Do not introduce a second Roadmap writer or claim cross-store atomicity.
- Documentation approval describes accepted intent. It does not silently adopt canonical Architecture, change Physical Map facts, start Work, complete WorkItems, publish an executable stack or award Gate Green. Material cross-owner conflicts remain explicit.

## Applied-change provenance and History

The documentation owner verifies actual persisted effects and retains a stable project-scoped application identity, real application time, known initiating actor/agent attribution, affected paths, before/after identities, applied diff evidence, concise summary and originating Chat/Planning references when available. Unknown attribution remains unknown. The historical diff describes the application even after later file edits or deletion.

History remains the bounded, read-only projection specified by [ADR 0034](0034-developer-continuity-and-right-toolbar-history.md). It reads the documentation owner's verified records and navigates existing diff/editor/Chat surfaces. History cannot infer an application from Chat prose, an approval, a candidate workspace, a file timestamp or the current Git dirty snapshot; reading History cannot perform recovery writes or model inference.

Interrupted applications must be reconciled by their owner. Zero retained changes produce no documentation entry. If actual changes remain, restore the earlier state where safe or record only the verified retained subset with an explicit partial/recovery outcome. Never publish the whole proposal as applied when only a subset changed. Repeated recovery of one application retains its identity. A later separately approved reversal is a new application and preserves earlier history.

The applied-only rule governs this documentation-change source. Existing unrelated Chat, Work and Git activity keeps its meaning. Reusing candidate/promotion mechanisms must not accidentally expose documentation attempts as applied changes or require a new generic Work task merely to perform review.

## Requirements supplied to coding work

Before preparing or starting affected Work, Dope resolves applicable project instructions, accepted requirements/decisions, architecture constraints and Gate/acceptance criteria. Supply bounded, inspectable material through the existing task/execution contracts, with project, document/section and source-version references. Preserve provider selection and local-only policy; do not enable Pi's unrestricted resource discovery to obtain project instructions.

Successful discovery with no applicable documents supplies empty context and preserves ordinary execution without a new documentation approval; an explicitly required missing source or discovery failure is not empty success. Otherwise valid legacy direct/WorkItem/stack tasks lacking the new metadata remain runnable through their currently supported retry, resume or new-launch paths. Metadata absence alone changes neither grants nor identity and does not force review; existing eligibility, approval, validation and interrupted-run rules remain.

Relevant documentation changes after preparation require a freshness/conflict check. A materially changed requirement uses a distinct versioned preparation linked through a narrowly guarded transition in its existing task/WorkItem/sequence owner, with a reviewed grant bound to the replacement task ID and crash/concurrency recovery. Preserve immutable saved tasks, original prompts/logical steps, prior runs and completed checkpoints; do not refresh a task in place or weaken sequence invariants to repoint it. Old-basis authorization cannot authorize materially changed requirements. Unrelated files, unchanged selected requirements/sections and demonstrably nonsemantic formatting add no documentation-specific block or repeat approval; a whole-file hash is a change signal, not proof of conflict. Preserve exact provenance and meaningful whitespace/structure, and keep existing Git clean/accepted-dirty/source checks independent.

Preserve in-flight and completed instruction snapshots, outcomes and evidence. The current runner permits valid pending prompt-content edits before execution; this decision grants no general authored-stack reordering permission. Project documents guide implementation but never expand executable grants.

## Placement and evidence

Implement this as a scoped Phase 12 follow-on after the relevant project-aware Planning capability and source/authority preflight, using the existing ChatPanel, context composition, Work and History. Do not append the new publication mechanism silently to `c12-pi-agentic-chat`, reopen historical Phase 11 gates, or require the entire Phase 13 system first. [Phase 13](../planning/p13/phase-13-scope.md) can later supply background alignment findings to this review/apply path while retaining its independent scope and safeguards.

Qualification must prove the complete developer journey: discuss a requirement, review and apply the documentation changes, observe exactly one truthful History entry, then start fresh Work that receives and follows the updated requirement without manual repetition or attachment. The [DW1-DW10 gates](../planning/p12/documentation-workflow-contract.md#qualification-gates) additionally cover negative outcomes, dirty-state/concurrency, recovery, historical diff accuracy, linked Roadmap authority, pending work, local context and existing UI behavior. Browser/native evidence and source-bound test results must retain their observed scopes; authoring this decision creates no Green result.

Mandatory WC1-WC4 prove empty context, legacy/pending preparation, relevant-only conflict detection and the existing coding lifecycle with empty/populated documentation: prepare/run/tools/validation, candidate accept or reject, supported cancellation/retry/stack resume and bounded selected-local-model delivery. Permissions, provider choice, candidate/History semantics and running/completed snapshots remain intact. These are acceptance subcases for current supported behavior, not a new activation or ordinary-Work hurdle, removed-domain revival or general compatibility platform. Keep narrow T1 evidence in existing prompts, cross-owner integration in P14 T2 and the sole manual/final aggregate closeout in P15 T3; no extra prompt, duplicated aggregate or unearned Green.
