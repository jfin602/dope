# ADR 0054 — Native Documentation Editor and Proposal Tabs

**Owner decision:** 2026-11-07 (America/Chicago). **Status:** APPROVED FORWARD DESIGN; product implementation and qualification not asserted. **Replacement correction:** `c13-native-doc-editor`. **Supersedes:** ADR 0053's standalone Documents center viewport, secondary file explorer and custom document editor presentation. **Preserves:** Docs and Prompt Stack proposal/application authorities, executed `c13-docs-view` prompt and qualification history, actual source evidence.

## Problem and decision

The executed `c13-docs-view` design leads to a second file explorer and a cluttered center Documents panel. Dope should return documentation review to the **real Theia editor**, sharing the regular project explorer and editor tab strip. Build a small **native proposal-aware document editor integration**, not a separate workspace, hidden legacy fallback, shadow document store, or universal custom file editor.

Only files ending in `.md` or `.txt` acquire Dope document-specific view controls; other extensions keep their existing Theia behavior. For a regular file, the original Theia/Monaco resource remains the authoritative editable source with normal save, undo, selection and conflicts. For a pending AI proposal, create distinct read-only editor tabs backed by immutable versioned review content rather than writing candidate bytes to the real file.

## Editor views and version identity

| Format | Source | Diff | Formatted |
| --- | --- | --- | --- |
| `.md` | Monaco Markdown source; normal files editable | Monaco comparison when a real baseline exists | Centered, read-only rich Markdown document |
| `.txt` | Monaco plain text; normal files editable | Monaco comparison when a real baseline exists | Not available |
| Other | Unchanged standard editor | Unchanged standard editor tools | No new Dope controls |

Each eligible editor tab receives a **compact bottom control bar** inside the editor area; use an editor-scoped footer/overlay with correct layout padding, not floating controls that obscure lines or intercept standard edit/scroll gestures. The toolbar selects Source/Diff/Formatted (where available). A separate **Original/Proposed** version switch appears **only on proposal review tabs**; the Diff view explicitly compares those two versions rather than adding a third mutable version. New-file proposals clearly mark Original as absent; deleted-file *visualization*, if available through a verified read model, never grants delete publication authority. Normal files show Diff only with an actual comparison basis.

Formatted Markdown renders safe rich text with a centered comfortable reading column (~720–800px max), spacious typography, headings, lists, tables, quotes, links, and fenced code. It is always read-only; preserve content identity, copy, scrolling, theme support and noncolor cues. Never execute untrusted HTML/scripts or fetch privileged local/remote resources.

## Proposal card file navigation

Both **Documentation Proposal** and **Prompt Stack Proposal** cards show affected/project-relative filenames as clickable links. A compact **Open All Files** button sits beside the affected-file count. Single-file click opens only that exact file; Open All opens each affected file as a **separate tab in the existing main editor tab strip**, in deterministic proposal order (P1–Pn for prompt stacks), activates the first, and reuses matching open tabs without duplicating. For larger stacks, queue bounded tab creation and make cancellation/errors observable; preserve existing user's tabs and focus except for the requested activation.

A proposal tab must be distinguishable from an ordinary editable tab (filename + Proposal indicator) and tied to project/root, proposal owner, proposal ID, revision/digest, and exact path. Normal file resources and proposal virtual resources must never collide. All proposal views are **read-only**, including Source and Diff; Ctrl/Cmd+S cannot turn them into canonical project writes.

Default proposal views: `.md` opens Proposed+Formatted, `.txt` opens Proposed+Source. Original/Proposed switch retains the selected view if supported; changing versions or tabs does not alter the reviewed digest or approve a proposal.

Keep existing **Accept / Reject / Revise Proposal** on the originating Chat card and current guarded owner. Opening tabs is *navigation only*, not approval. When accepted, rejected, revised, stale, expired or superseded, existing tabs display the truthful state and cannot act as an alternate publisher or silently become editable real-file tabs. Retained historical bytes can be inspectable with a nonactionable label; unavailable bytes must be reported, never guessed.

## Authority boundaries

- **Docs proposal:** the existing source-/worktree-/lease-/digest-bound Dope documentation application owner alone writes exact approved create/update targets and emits applied-only Project History. Current backend has no delete publication operation; this correction does not add one. Manual normal-file saves are Theia editor/filesystem operations and must not fabricate Docs application History.
- **Prompt-stack proposal:** native `/prompt-write` proposal state and **distinct guarded publisher** alone publish exact approved prompt files. If current local source lacks that owner (e.g. P13 R3B incomplete), record it as dependency BLOCKED instead of inventing another publisher. Viewing/Open All/Accept cannot issue Work grants, start Work or qualify Roadmap Gates.
- **Roadmap/Work/Chat:** saved Chat remains origin and decision UI; Roadmap and Work own their existing authoritative states. No second explorer, editor authority, project-state owner or agent.

## Replacement and historical integrity

**After** the actual post-run `c13-docs-view` local source, dirty state, and execution/qualification receipts have been inspected, implement the native tab path. Verify replacement functionality before deleting presentation code. Then **remove outright** the old standalone Documents widget/registration/navigation, duplicate filtered file tree, bespoke rendering/editor state, obsolete CSS and dead related tests. Do not hide old UI behind a feature flag, rename its state as a fallback, or remove shared Docs/prompt services.

Never rewrite the already run `docs/tasks/c13-docs-view/P*.txt` histories, revoke prior verified evidence, invent Green or infer the local source from GitHub main; current remote `main` at this decision still reflects prompt authoring, not necessarily the owner's completed local run.

## Follow-on routing and qualification

Following approved docs application: `/prompt-ass -> /prompt-plan -> /prompt-write c13-native-doc-editor`, **five or fewer prompts including exactly one manual connected Codex browser closeout**. Focused T1/T2 evidence covers real Theia editor tab identity/resources, read-only virtual source, toolbar modes, proposal states, Open All and old UI retirement. A separate T3 source-bound manual browser journey verifies genuine interaction and no duplicate explorer; do not claim Electron parity without observation. No execution, version change, Work grant, candidate promotion or product GREEN follows from this ADR alone.

**Related:** [New UI contract](../ui/native-document-editor-contract.md), [historical ADR 0053](0053-documents-workspace-and-proposal-review.md), [current Docs contract](../planning/p12/documentation-workflow-contract.md), [native prompt authoring](../planning/p13/native-prompt-stack-authoring-contract.md).
