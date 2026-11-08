# Native Documentation Editor — UI and Interaction Contract

**Authority:** [ADR 0054](../decisions/0054-native-document-editor.md). **State:** forward product design, not implementation/qualification. **Replaces:** standalone [Documents Workspace UI contract](documents-workspace-contract.md) and its duplicate file selector. **Correction:** `c13-native-doc-editor`.

## Human interaction goal

A developer keeps the *normal* Theia project Explorer and editor tabs. Documentation or prompt-stack proposal cards contain direct file links and one small **Open All Files** action. Clicking opens existing main-area editor tabs, not a new Documents viewport or duplicate project explorer. Nothing opens automatically on proposal creation.

## Eligible file types and editor-scoped bottom toolbar

Only `.md` and `.txt` editor tabs receive the special document control; preserve normal file handling for all other extensions, including normal native diff functionality.

| | Source | Diff | Formatted |
| --- | --- | --- | --- |
| `.md` | Theia/Monaco Markdown editing for real file, read-only for proposal | Native Monaco compare with verified Original/Proposed or other available basis | Centered rich Markdown preview, always read-only |
| `.txt` | Theia/Monaco plain-text editing for real file, read-only for proposal | Native Monaco compare with verified basis | Not present |

Use a **compact bottom toolbar** within the editor tab, with Source / Diff / Formatted controls only when applicable. Attach it in an editor-scoped slot/footer and reserve layout room so it never hides the last line, steals wheel/drag focus, or relocates the existing document unexpectedly. For ordinary files with no meaningful diff basis, hide/disable Diff honestly. Source is the ordinary fully editable editor for current project files: preserve save/undo, external-source-change/dirty warnings, standard keyboard shortcuts and project permissions.

For a proposal tab, add a **separate version selector** labelled Original / Proposed. This controls which immutable content version is inspected in Source or Formatted; Diff always compares both. New file original means *not present*, not an empty existing file. Never present a deleted file as an authorized delete unless the owner actually supports it.

## Formatted Markdown document

A `.md` file can be read as an elegant, centered document (~720–800px maximum text column) within the same tab: proper heading hierarchy, readable line width, spacious paragraphs, lists, checked lists when supported, tables, quotes and fenced code. No line numbers, Monaco gutters or code-editor chrome inside Formatted. Keep selection and copying, ordinary scrolling, keyboard focus, narrow-width fluid margins, reduced-motion, dark/light/alternate themes and proper contrasts.

Use an established safe Markdown renderer or Theia markdown preview with explicit untrusted-content limits. No raw executable HTML, scripts, unsanctioned images/file resources, new provider calls or privileged navigation. Formatted mode never exposes a writable document model.

## Proposal tabs and identities

Use Theia's existing main editor tab area, editor resource model and Monaco/diff adapters where supported. Native proposal tabs are clearly labelled **<filename> (Proposal)** and backed by *non-file*, read-only, proposal-scoped resources bound to project/worktree, owner, proposal ID, revision/digest, exact path and version. Do not replace/repoint an open real-file tab or make proposal bytes writable with Ctrl/Cmd+S.

File link activation:
- Open **exactly one** affected file at its original relative path identity, but in a separate read-only proposal tab.
- Reuse that same tab if already open under the same proposal ID, digest, file path and appropriate read basis.
- For `.md`: initial Proposed + Formatted. For `.txt`: initial Proposed + Source.
- Explicit error if bytes are unavailable, stale or unsafe; never silently fall back to current real-file bytes and call them proposed bytes.

When card status changes (accepted, rejected, revised, stale, expired, conflict or partial-recovery), tabs update honestly. Historical versions may remain readable when retained, but approval is disabled; acceptance never automatically converts a proposal tab to a canonical editable one. Project switch and asynchronous tab opening must not leak data or focus into another project.

## Both proposal cards — one-file and Open All

**Documentation Proposal** and **Prompt Stack Proposal** cards keep short summary, affected-file list, current status, **Accept / Reject / Revise Proposal**. Each affected filename is a clickable single-file navigation link, with path in full or accessible tooltip.

A compact neutral **Open All Files** control beside **Affected files (N)**:
- Open every affected `.md`/`.txt` file into its own existing Theia editor tab (include `README.md` and P1–Pn as present in a generated stack).
- Deduplicate already-open matching proposal tabs, not unrelated real-file tabs or another proposal's versions.
- Preserve document proposal listed order and prompt-stack execution order (P1–Pn, with non-executable supporting files deterministically placed).
- Activate the first opened tab; retain others for normal keyboard and mouse tab navigation, and preserve previously open user tabs.
- Work through large lists safely, report progress/cancel/partial errors, and never require new confirmation for navigation alone.
- Never create files, publish, accept a proposal, issue grant, launch Work or produce a Gate-progress receipt.

Do not bring back a file tree inside the editor, a Documents center widget, or a second floating doc explorer.

## Authority and error/recovery

Normal file Source mode uses the authorized Theia text-editor/file-save owner. Pending Docs proposals use **existing Dope Docs application owner** and do not create applied History until actual verified file changes. Generated prompt stacks use the **distinct existing native prompt proposal publisher**, and Work execution is a separate approval. Do not add a Doc delete publisher; current target shape supports only create/update. Revise uses the prior selected candidate until a checked replacement is ready.

User-visible errors must distinguish stale/unavailable proposal, wrong project, source conflict, rejected/superseded, partial publication, read-only resource and file-open failure. Preserve saved Chat copy/proposal card state, editor tabs and undo behavior of canonical files.

## Retirement requirement

Once this replacement's normal editor and proposal tabs work, remove the standalone Documents viewport, duplicate filtered explorer, obsolete state/registration/CSS, associated dead-only tests and any hidden fallback. Preserve reusable underlying services, historical `c13-docs-view` prompt/evidence and legitimate tests. This removal is *not* permission to delete the normal Theia Explorer or its ordinary editor/file open commands.

## Qualification

**T1:** eligible extension rules and proper mode availability; toolbar and editor tab identity; Markdown sanitizer/read-only; exact diff/absence; link/open-all order and deduplication; no real-file write from proposal resources; accessible controls.

**T2:** real Docs/card owner state, stale/foreign/revised/rejected/current approval flow, applied-only History and safe restart/project switch; generated prompt-stack distinct publisher, old source and executed prompt snapshots; work grants and Roadmap qualification untouched; old Documents widget fully retired.

**T3 manual connected Codex browser:** actual `.md` Source/Diff/Formatted and `.txt` Source/Diff; rendered centered document, save/undo, toolbar not blocking text, links & Open All for both card types, many prompt files, actual version switch/source diff, reject/revise/accept, duplicate open prevention, narrow tabs/keyboard/touch/theme, stale/restart/project switch and absence of secondary file selector. Record exact served SHA and real results. Do not assert native Electron parity without separate real observation.
