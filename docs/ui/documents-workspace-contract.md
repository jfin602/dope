# Documents Workspace — UI and Interaction Contract

**Decision basis:** [ADR 0053](../decisions/0053-documents-workspace-and-proposal-review.md), 2026-11-07. **Status:** Approved forward documentation design only; not shipped/qualified. **Scope:** the single shared central Documents editor, not a second state owner.

## Human goal and entry points

The developer can browse and edit current project documentation; inspect a concrete AI documentation proposal as complete files; or inspect a newly generated prompt stack before a deliberate approval. Add **Documents** to existing center-viewport/navigation affordances alongside Roadmap and Work. The existing originating Chat remains saved/docked wherever the user placed it.

- Opening a file from the ordinary Docs explorer selects **Explorer** mode and the actual file.
- **Open Review** on a pending Docs Chat card selects **Proposal Review** mode and that exact candidate without modifying source. It may open/focus Documents only on user action, not merely when a new proposal arrives.
- **Open Review** on a prompt-stack card selects **Prompt Stack** mode and that exact draft; normal navigation may also open a published stack.
- Leave Chat cards functional at narrow widths and when the Documents viewport is closed. Navigating away does not decide or discard a proposal.

## Shared layout

1. A compact collapsible **left file explorer** follows actual project-relative folder hierarchy; support long names, focus, keyboard movement, scroll, empty/loading/error states and narrow layouts. Do not replace full project Explorer or imply hidden non-document files are absent from the project.
2. A **center viewer/editor** shows the selected document's relative path, status, and appropriate content-mode controls. Markdown preview uses safe formatting (headings, emphasis, lists, links, tables, code fences) with legible line wrapping, copy and scroll. Preserve raw textual meaning, code whitespace and line endings in Source.
3. Mode and file selection persist as *presentation state* where safe, keyed to project and candidate identity; reopen never trusts a retained rendered snapshot over a current source version.
4. Use existing Theia/Dope theme semantic tokens and restrained orange for primary acceptance/action emphasis; labels/icons and diffs remain legible without color. Support high contrast, screen readers, reduced motion, touch wheel/drag scrolling, resizing and cramped editor widths.

## Mode A — Project Docs Explorer

- Recursively list only real `.md` and `.txt` files for display, within the authorized project/workspace boundary; use bounded/lazy listing for large trees and explicit permission/IO errors. Preserve actual path segments and ordering.
- Selecting a document presents **Preview** and **Source/Edit**; `.md` renders Markdown, while `.txt` defaults to literal text (an opt-in preview may render Markdown-like content without modifying bytes).
- Manual edits are deliberate user editor actions. A normal save uses the existing authorized editor/filesystem path, detects external modifications and presents a conflict resolution path without silent overwrite. Provide dirty indication, Ctrl/Cmd+S where supported, cancellation and safe navigation with unsaved content.
- Normal manual edits are not treated as pending `/docs-review` candidates or as an automatically manufactured Dope documentation-application History entry.
- Filtered display does not confer approval to write protected, generated, external, executable or otherwise ineligible documents.

## Mode B — Documentation Proposal Review

- Select exactly one proposal identity, project/root and reviewed digest; its explorer shows **only affected files**, preserving relative directories and statuses **Added / Modified / Deleted**.
- Display the **complete** Original and Proposed version of each file, not only a patch fragment. Added files have a clearly labeled absent original; deleted files have a clearly labeled absent proposed target, not a fake empty existing document.
- Toggle **Original** / **Proposed**, preserving per-proposal file/scroll context where reasonable. Default to Proposed with directly located added/modified highlights and deletion markers/anchors. Provide an accessible **Source Diff** view that accurately shows deleted lines, whitespace, line breaks and ambiguous Markdown formatting. Highlights derive from exact compared source bytes, not AI interpretation.
- Proposal contents remain read-only as publication sources. Any requested AI changes return through **Revise Proposal** to protected `/docs-review`, preselecting the same pending candidate; retain the previous valid candidate until a fully checked replacement is ready. Do not let direct Source/Edit quietly alter its approved digest.
- The originating Chat card shows concise summary, affected count/status, **Open Review / Accept / Reject / Revise Proposal**. Equivalent viewport actions use the same authoritative handlers and in-flight disable/feedback, never an independent acceptance state.
- **Accept** rechecks project/worktree identity, current owner/source basis, safe paths, collisions and reviewed digest then invokes the existing guarded Docs application/History pipeline. **Reject** discards pending candidate only. On stale/foreign/conflict/failure, disable unsafe acceptance, explain the outcome and preserve recoverable evidence. Multi-file interruption reports verified partial results rather than claiming atomic application.
- Reopen, rehydrate, cancel, switch projects or receive delayed async results without applying an old candidate to the new project. Preserve the historical card state and noncanonical proposal provenance.

## Mode C — Prompt Stack Review

- Reuse the same tree and viewer to show individual files in a generated `/prompt-write <folder>` candidate; preserve exact path, P1–Pn order, model/manual flags and source basis as available.
- Display plain prompt text faithfully with easy copying and optional formatted preview; do not reinterpret a draft as an already published/executable prompt.
- Show **Draft / Published** and any actual Work eligibility/state accurately. **Accept / Reject / Revise Proposal** invoke the existing *distinct* guarded prompt-stack publisher, not the Docs application service; revision returns to `/prompt-write` with current proposal context.
- No viewing/copying/approval may issue a Work grant, start a Run, alter completed prompt snapshots, promote a candidate or self-award Roadmap evidence.

## Shared authority, security and recovery

- Domain services supply typed, versioned read models; UI holds only view preference/selection state. Avoid independent mutable proposal stores, duplicate files under `.dope/`, a general write endpoint or model-driven unrestricted saves.
- Preserve project scope, symlink/traversal/unsafe path protections, source fingerprints, dirty user changes, proposal digest checks, idempotent approved publication and exact applied-only History.
- Treat content as untrusted for Markdown/HTML, filesystem links, web links, images and embedded code. Do not allow the preview to execute scripts or read outside the approved project boundary.
- Maintain one saved Chat, exact provider/model/permissions, Roadmap and Work owners, protected slash-command invocation, and honest source/qualification status.

## Qualification matrix

**T1 focused:** file-tree filtering/order and path safety; Markdown/text rendering and escaping; original/proposed and line-level diff accuracy for add/edit/delete; project/candidate mode selection; ordinary dirty/edit/save conflict; button state/action mapping.

**T2 boundary:** Doc publisher one-approved-set/same-digest preflight and applied-only History; revision keeps current candidate until replacement; multi-file interruption/retry/restart; stale/foreign/project-switch no-write; prompt-stack draft vs distinct publication and Work no-Run; previous Chat/Roadmap/Work regressions.

**T3 manual connected browser and applicable native:** open nested project docs, edit/save/reopen, exercise keyboard/narrow/touch scroll and theme; generate actual multi-file Docs proposal, inspect Original/Proposed/source diff, revise/reject/accept, verify exact persisted bytes and one History record; inspect proposed prompt stack, publish deliberately, verify Work discovery without implicit Run. Capture exact source, identities and actual observations; do not claim Electron parity, Green or responsiveness improvements without evidence.

## Documentation routing

This contract extends the existing [Chat visual contract](chat-panel-visual-contract.md), [Docs workflow](../planning/p12/documentation-workflow-contract.md), and [Native Prompt Stack Authoring](../planning/p13/native-prompt-stack-authoring-contract.md). The earlier refusal to **force** a Docs workspace remains valid: optional Open Review opens the new viewport by explicit developer choice. No `/docs-apply` or `/prompt-apply` user-facing command is revived.
