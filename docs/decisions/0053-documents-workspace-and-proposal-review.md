# ADR 0053 — Unified Documents Workspace and Proposal Review

**Decision:** Accepted for documentation/planning, 2026-11-07 (America/Chicago). **State:** Forward design only; not source implementation, qualification, prompt authoring, Work authorization or version advancement. **Correction identifier:** `c13-docs-view`.

## Context

Dope's protected `/docs-review` creates an exact, source-bound proposed documentation change, and the originating Chat card currently provides Accept / Reject / Revise Proposal. The growing multi-file review UI is too dense for a narrow Chat panel. Native `/prompt-write <folder>` also proposes a set of individually reviewable documents. Independently, developers need a straightforward way to browse and edit project documentation in its actual directory structure.

Prior documentation contracts deliberately kept one saved ChatPanel and avoided *forcing* a Docs workspace as a precondition for review. This decision adds an **optional, explicit** first-class Documents center viewport; it does not require the user to navigate away from Chat, create a second chat, or relinquish existing Chat proposal actions.

## Decision

Introduce one reusable Documents viewer/editor hosted in Dope's central editor/workbench region alongside Roadmap and Work, backed by existing Theia/editor/filesystem capabilities where suitable. A compact left explorer and main `.md`/`.txt` document area present three modes:

1. **Project Docs Explorer:** filtered view of real project `.md`/`.txt` files in their real relative directory hierarchy, with Preview and Source/Edit, guarded manual save, dirty indicator and external-source conflict handling.
2. **Documentation Proposal Review:** file hierarchy restricted to a selected pending proposal's added/modified/deleted targets; Original and Proposed views show complete content with inline change highlights, plus accurate source diff for formatting-ambiguous or deleted content.
3. **Prompt Stack Review:** the same document tree and preview/source presentation over draft or published prompt-stack files, with order and provenance, without granting executable authority.

The views are projections or adapters over **existing authorities** rather than a new document source of truth. Do not build three viewers, another proposal store or an unrestricted general-purpose writer. Persist only bounded selection/view preferences outside canonical project/domain state; never cache an accepted-looking mutable substitute for current project files.

## Ownership and approval

- **Actual project documentation:** repository/workspace files. Ordinary manual Source/Edit saving uses existing editor/filesystem permissions and writes only the user-selected file. It is not an AI documentation application and must not fabricate Dope application-History events.
- **Pending documentation proposals:** the existing Dope-owned documentation proposal/application owner, including project/root identity, source fingerprints, exact paths/effects, digest, approval/recovery and applied-only Project History. The viewport renders uncommitted candidate bytes; it cannot directly save them to the repository. Only a validated **Accept** enters the existing guarded application service.
- **Prompt-stack drafts:** the existing native `/prompt-write` proposal owner and distinct guarded prompt-stack publisher. Published stacks become discoverable by existing Work. Viewing, editing a *draft through its explicit revision flow*, or accepting a stack never starts Work, issues grants, promotes candidates or changes Roadmap qualification.
- **Roadmap and Work:** existing schema-2 Roadmap author, Work/AgentRun evidence and independent closeout owners remain unchanged. No doc view claims implementation or Gate GREEN.
- **Chat:** the originating saved Chat and its proposal-card identity remain the interaction provenance. The card becomes a concise summary with **Open Review / Accept / Reject / Revise Proposal**; viewport equivalents invoke exactly the same authority, not independent decisions.

The current **user-facing** Docs path is `/docs-review` → proposal card Accept / Reject / Revise Proposal. No user-facing `/docs-apply` is reintroduced to native Dope. Repository-authoring instructions mentioning external `/docs-apply` refer to a separate human-approved documentation application step, not a new protected Chat command.

## Presentation behavior

- Enter Documents from the normal editor/viewport affordance or explicitly from **Open Review**. Preserve the original saved Chat and avoid automatic focus hijacking, editor replacement, or forced mode switches.
- The file tree retains real project-relative hierarchy, but filters to supported documents; a file suffix determines *display*, never write/application eligibility.
- Render safe, accurate Markdown for `.md`; render `.txt` as faithful text, with an optional formatted preview only where explicitly supported. Exclude unsafe embedded HTML, script execution, privileged links and unsanctioned filesystem/resource access.
- Allow explicit Preview / Source/Edit for ordinary files and Original / Proposed with a precise source diff for proposal files. Annotate added/modified/deleted status with words and non-color cues; content spans and anchors must reflect exact proposed changes, not invented model highlights.
- Preserve existing semantic theme tokens and restrained accents; support keyboard focus, selection/copy, touch scrolling, narrow panes, accessible labels and reduced motion.
- Keep error, stale, conflict, cancel, partial-recovery and project-switch states truthful. Navigation or reload cannot quietly mutate source, drop the prior valid revision proposal or shift a pending proposal to another project.

## Consequences and dependencies

The Documents viewport addresses an increasingly complex Chat proposal surface once; Docs Explorer and Prompt Stack Review reuse that visual/editor substrate. It does not replace the current prompt authoring pipeline or the Documentation/Work source rules. The earlier documentation-workflow UI sentence forbidding a *forced* documentation workspace still applies: this is an **optional editor**, not a gate for applying a reviewed card.

The associated [UI contract](../ui/documents-workspace-contract.md) defines concrete behavior and qualification. Align [Documentation Workflow](../planning/p12/documentation-workflow-contract.md), [Native Prompt Stack Authoring](../planning/p13/native-prompt-stack-authoring-contract.md), [Architecture](../ARCHITECTURE.md), [Product Model](../PRODUCT-MODEL.md), and [workflow](../workflow.md). Any future correction stack follows `/prompt-ass -> /prompt-plan -> /prompt-write c13-docs-view` only after this documentation is approved, with separate owner Run and source-bound qualification. No P*.txt is authored or executed by this ADR.

## Qualification boundary

A disposable-project human/browser journey must show nested Docs Explorer and manual save with stale conflict; multi-file added/modified/deleted review, accurate Original/Proposed/source diffs, card/viewport decision convergence, reject/revise retention, stale/foreign/path negatives, reload/project switch; and prompt-stack inspection/publish without Work Run. Focused source tests and applicable browser/native gates are separate evidence. Preserve Phase 13 P8/P9/P12, R1 and historical NOT GREEN decisions; a documentation-only commit is not GREEN.
