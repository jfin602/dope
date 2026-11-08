# /prompt-ass — c13-docs-view

**Owner command:** `/prompt-ass + /prompt-plan + /prompt-write c13-docs-view`, 2026-11-07 America/Chicago. **Authority:** [ADR 0053](../../decisions/0053-documents-workspace-and-proposal-review.md), [UI contract](../../ui/documents-workspace-contract.md), current [workflow](../../workflow.md), [Docs owner](../../planning/p12/documentation-workflow-contract.md), [native prompt owner](../../planning/p13/native-prompt-stack-authoring-contract.md), ADR 0016/0030/0037. **Source examined:** GitHub main `3dc25ff8abab05fc820ca790e7187b584fa2221d`, product package `0.13.11`. **Status:** assessment and prompt authoring only; no implementation/run/qualification.

## Developer outcome and accepted scope

One optional **Documents** main viewport: compact hierarchy of actual project `.md`/`.txt` paths with safe Markdown/plain-text viewing and deliberate manual Source/Edit; complete, highlighted Original/Proposed per-file Docs proposal review; and individual generated prompt-stack files before publication. Chat remains docked/usable and owns proposal origin. Viewport and card share the same exact validated decisions. Source viewer/editor is a Theia presentation surface, **not a second canonical requirements file store**.

## Observed owners and gaps

| Existing owner/source inspected | Observed state / effect on scope |
| --- | --- |
| `packages/theia-extension/src/browser/frontend-module.ts` | Theia `WidgetFactory`, `WidgetManager`, `ApplicationShell` already open Roadmap and other widgets in `area: 'main'`. `EditorManager`, `FileService`, `WorkspaceService` already available. Reuse registration/navigation patterns. |
| `packages/theia-extension/src/browser/chat-panel-widget.ts`, `chat-panel-controller.ts` | Saved Chat Docs card already handles Accept/Reject/Revise Proposal and discovery-file opening. It renders inline diffs; keep card identity/handlers and add explicit Open Review, not another Chat or publisher. |
| `packages/chat/src/index.ts`, `service.ts` | `ChatDocumentationProposal` includes `root, projectId, worktreeId, ownerId, chatId, messageId, digest, revision, targets` with before/after bytes. Targets: **`create | update` only**. Old/stale card state not an approval token. |
| `packages/theia-extension/src/node/documentation-review.ts`, `documentation-application.ts` | Source-bound, no-symlink/no-traversal checks, proposal limits (four targets), one approved set, journal recovery and applied-only History. **No new Docs writer/delete permission**. |
| `packages/theia-extension/src/node/documentation-discovery.ts` | Explicit `/docs-review` ranks bounded corpus candidates; this is **not** the interactive file-explorer authority. Avoid reusing its expensive content scan on normal selection/Chat turns. |
| `packages/theia-extension/src/browser/untrusted-message-markdown.ts` | Existing `markdown-it` + DOMPurify renderer, no raw HTML/image fetch, safe links and code-copy. Reuse safe grammar or equivalent without privileges/side effects. |
| `packages/theia-extension/src/node/planning-stack-publication.ts`, `phase-stack-controller.ts` | Existing Bridge stack preview/publication and Work discovery. Native `/prompt-write` draft card/publisher is required by forward [P13 contract](../../planning/p13/native-prompt-stack-authoring-contract.md) but **not proven present in this inspected GitHub source**. P7 must verify current checkout and fail closed if missing. |
| `packages/theia-extension/src/browser/dope.css` | Shared semantic `--theia-*` and `--dope-*` tokens. Do not introduce local palette or global theme override. |

Relevant tests already exist: `test/unit/chat-panel.test.ts`, `documentation-review.test.ts`, `documentation-application.test.ts`, `documentation-skills.test.ts`, `phase-stack-ui.test.ts`, `planning-stack-publication.test.ts`, `message-code-copy.test.ts`, `explorer-roadmap-navigation.test.ts`, and `dope-theme.test.ts`. New pure view-model tests should be placed in `test/unit/documents-*.test.ts` or one narrow equivalent, using actual tested package output.

## Decomposition / dependency gates

| Step | One primary responsibility | Tier | Target / dependency |
| --- | --- | --- | --- |
| P1 | Center widget + view-mode, project/candidate state | T1 | <=8m; independent; no Docs writes |
| P2 | Bounded project tree filtering and selection | T1 | <=8m; P1; existing workspace/FileService |
| P3 | Sanitized preview/source presentation | T1 | <=8m; P1; shared Markdown renderer |
| P4 | Manual editing/save and stale/dirty UX | T1 | <=8m; P2/P3; editor/FileService only |
| P5 | Pure before/after diff presentation | T1 | <=8m; P1/P3; no publication |
| P6 | Chat Docs proposal open/decide handoff | T1 | <=8m; P5; existing Docs service |
| P7 | Prompt-stack document adapter | T1 | <=8m; P1/P3; verify native R3A/R3B |
| P8 | Integrated safety/restart/project-switch matrix | T2 | dedicated; P1–P7 |
| P9 | Connected-browser owner closeout | T3 | manual only; after P8 |

No fixed work item, map or Roadmap prerequisite is fabricated for this standalone correction. P7 is **dependency-conditional** on actual native stack proposal readiness; a missing publisher is a BLOCKED result requiring existing P13 R3B completion, not permission to reinvent it.

## Preserved invariants, risks and deferrals

- **Docs:** current `/docs-review` source model, project/worktree/lease/owner/digest preflight, guarded Accept/Reject/Revise, exact bytes, journal recovery, one actual-applied History record; 4-target size limits and protected paths untouched. Read-only delete visualization only; create/update are the presently authorized writes.
- **Prompt stacks:** native proposal approval is distinct from Docs approval; viewing, editing/revising draft via its own owner or publishing cannot execute Work or grant permissions. Started/completed P*.txt and captured runs are immutable.
- **Manual file edits:** ordinary editor saves and external-file changes respect user/OS filesystem permissions and conflict detection; no extra AI approval ritual or fabricated application History.
- **UI:** single optional main Documents widget; preserve Chat dock/transcript/composer, Roadmap, Work, theme, keyboard/touch, narrow widths, copy and accessible noncolor diff. Filter only visible file types; project exceptions/permissions stay.
- **Security:** no arbitrary RPC file writer, HTML/script execution, privileged links/images, symlink escapes, remote egress, auto scans per turn, or stale candidate replay after project switch.
- **Deferred:** delete publishing/rename, non-text viewers, new document formatting engine, new prompt-stack publisher, full filesystem Explorer replacement, automatic Work/Phase transition and general long-term knowledge model.

## Assessment Prompt Efficiency Gate

Split shell/tree/viewer/edit/diff/card/prompt adapter by genuine UI/owner seams. Every ordinary prompt targets <=8-minute implementation+focused validation (10-minute soft/15-minute hard cap); P8 and P9 are explicit dedicated integration/manual exceptions. Only `@dope/theia-extension` build is normally needed, and only when its compiled `lib` is consumed. No routine root `npm run check`, packaging or browser on P1–P7; P8 owns cross-boundary tests and P9 owns live visual/manual proof. Use GPT-6 Sol Medium for straightforward UI and pure diff, High for source/permission/approval or cross-boundary integration. Apply ADR 0016+0030+0037 controls and real human-task evidence at P9. Exact source/version readiness must be rechecked locally; no remote tests were run by this assessment.
