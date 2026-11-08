# /prompt-ass — c13-native-doc-editor

**Owner action:** `/docs-apply + /prompt-ass + /prompt-plan + /prompt-write c13-native-doc-editor` with **five or fewer** prompts including final closeout. **Accepted authority:** [ADR 0054](../../decisions/0054-native-document-editor.md), [native editor contract](../../ui/native-document-editor-contract.md), [workflow](../../workflow.md), ADR 0016/0030/0037, [Docs owner](../../planning/p12/documentation-workflow-contract.md), [native prompt-stack owner](../../planning/p13/native-prompt-stack-authoring-contract.md). **Remote inspected baseline:** main product `0.13.11`; documentation was approved at `1ad10415ab58`. **Status:** assessment only, not source implementation.

## Outcome and why the old approach is retired

One standard Theia main editor tab strip and one existing project Explorer, with scoped file viewing affordances. Real `.md` files have Source/Diff/Formatted; real `.txt` files Source/Diff (only with actual comparison basis). Only `.md` Formatted is a nice centered read-only rich-text page. Proposal-specific read-only resource tabs show Original/Proposed and native Diff. The Documentation and Prompt Stack Proposal cards gain individual filename hotlinks plus **Open All Files**; existing Chat Accept/Reject/Revise remains authoritative. The duplicative `c13-docs-view` center widget, second tree, formatting/editor UI and dead CSS must be **deleted, not hidden**, after replacement works.

## Remote source-grounded seams and mandatory local preflight

| Producer -> consumer | Observed remote source and required decision |
| --- | --- |
| Editor shell | `packages/theia-extension/src/browser/frontend-module.ts` has `EditorManager`, `WidgetManager`, main-area `ApplicationShell`, FileService and commands. Verify the actual local Theia 1.75 editor widget/resource model, Monaco and diff services before choosing supported editor contribution/overlay APIs. Avoid unqualified private Theia hooks. |
| Existing file editing | Normal Theia editor/Monaco owns real file resources, save/undo, dirty model and source conflict. Do not replace it with another FileService write path. |
| Markdown rendering | `untrusted-message-markdown.ts` uses markdown-it, DOMPurify, safe-link policy and code-copy; reuse an existing safe renderer or Theia Markdown preview with hard no-script/untrusted-resource boundaries. |
| Docs proposal | `packages/chat/src/index.ts` has `ChatDocumentationProposal` project/root/worktree/ID/digest, before/after and diff, with **create/update only**; `documentation-review.ts` and `documentation-application.ts` own validation, exact approved bytes and applied-only History. Current `chat-panel-widget.ts` builds cards with inline diffs, Accept/Reject/Revise; replace large display with clickable affected paths without duplicating decision owner. |
| Prompt-stack proposal | `planning-stack-publication.ts` is an existing **Bridge** publisher; P13 native R3A/R3B separately specifies the new `/prompt-write` proposal/card. Remote product source does **not demonstrate** its native implementation. Require actual local owner evidence; do not fabricate it or substitute the Bridge publisher for a protected native candidate. |
| Old Documents UI | Remote main at review still contains authored `docs/tasks/c13-docs-view/P1–P9`, but not the locally executed product-source changes reported by the owner. **Source + history must be inspected in the local checkout before removal**. Preserve uncommitted work and historical evidence. |
| Tests/builds | `test/unit/chat-panel.test.ts`, `documentation-review.test.ts`, `documentation-application.test.ts`, `planning-stack-publication.test.ts`, `phase-stack-ui.test.ts`, `message-code-copy.test.ts`, `explorer-roadmap-navigation.test.ts`, `dope-theme.test.ts`. Some import built `packages/theia-extension/lib`; build changed package first. New narrow native-editor tests belong in `test/unit/native-doc-editor*.test.ts`. |

## Decomposition, dependencies and verification

| Step | Primary responsibility | Tier / time budget | Configuration |
| --- | --- | --- | --- |
| P1 | Editor-scoped bottom mode control and safe formatted Markdown on real native tabs, no proposal authority | T1, target <=8 min; narrow API seam | GPT-6 Sol High (Theia framework integration) |
| P2 | Non-file **read-only** proposal resource identity, version switching, native Monaco diff and proposal state | T1, target <=8 min; fail closed at write boundary | GPT-6 Sol High (authority/security) |
| P3 | Card links/Open All, strict proposal identity/open ordering/dedup for **Docs and Prompt Stacks** | T1, target <=8 min | GPT-6 Sol Medium (bounded UI/dispatch; stop if native owner absent) |
| P4 | Retire exact old widget/tree/CSS, cross-owner adversarial regression and no-Run proof | Dedicated T2 integration, may exceed routine budget | GPT-6 Sol High |
| P5 | Independently operate actual GUI, real file/proposal/stack cases, closeout | T3 manual, outside runner | GPT-6 Sol High |

**Dependencies:** P1 before P2 before P3; P4 after P1–P3 evidence; P5 independently after P4. If a required prior result is BLOCKED, stop rather than claiming the next prompt's Green. Never replay executed `c13-docs-view` P*.txt or erase reports.

## Scope and safety rules

- Extra editor controls **only** `.md` / `.txt`; other source extensions use unchanged editor.
- Real current-file Source = ordinary editing; proposal Source and Diff = **read-only**, no dirty canonical model or Ctrl/Cmd+S bypass; Formatted always read-only.
- Separate version vs rendering-mode selection; no false Original on added files or false delete publication. No side effects from opening or Open All.
- Prompt ordering P1–Pn exact, same review basis; existing tabs deduplicated by owner/proposal/digest/path, but canonical tabs remain independent. Large stacks need bounded opening/failure reporting.
- Status transitions (accepted/rejected/revised/expired/stale/partial recovery) must update tabs truthfully; no phantom green, no auto-close destroying history, no writable promotion.
- Existing Docs and distinct prompt publishers, permissions, exact paths, applied-only History, Work grants, Roadmap Gate evidence, Chat and prompt snapshots remain untouched.
- Deferred: arbitrary file types, new delete/rename application, new Markdown editor/framework, separate project document navigator, implicit Git/Work automation and UI overhaul beyond this correction.

## Prompt Efficiency / UI / human usability audit

**Five total** respects the owner's cap: three narrowly owned T1 steps, a dedicated shared T2 retirement/integration gate and one final T3 real-browser closeout. The single UI-mode foundation is reused by proposals instead of building another viewer. P1–P3 target <=8 minutes with changed-package builds and limited tests; stop/split as a separately approved follow-on if the actual local seam is larger (do not exceed five prompt slots retroactively). P4/P5 dedicated gates carry broad regression/live evidence, not individual T1 prompts. Use semantic `--theia-*`/`--dope-*` tokens, accessible keyboard/narrow/tab interaction and actual T3 human tasks. No forced full `npm run check`/packaging at every prompt, no unsupported new editor API assumptions, no fabricated local execution proof.
