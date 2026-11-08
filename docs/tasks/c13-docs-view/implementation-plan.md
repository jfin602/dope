# /prompt-plan — c13-docs-view

**Review basis:** approved [ADR 0053](../../decisions/0053-documents-workspace-and-proposal-review.md), [Documents UI](../../ui/documents-workspace-contract.md), [assessment](prompt-assessment.md); remote main `3dc25ff8abab05fc820ca790e7187b584fa2221d` and product `0.13.11`. **State:** source-informed plan/prompt authoring only; not implementation, runner or GUI qualification. Existing local modifications may differ and must be examined at P1 preflight.

## Component/data flow

```text
Theia central ApplicationShell + WidgetManager
   -> DocumentsWidget (ONE main-area editor, mode + selection + view state)
      -> ProjectDocs adapter: WorkspaceService/FileService -> normal existing EditorManager / save
      -> DocsReview adapter: saved ChatDocumentationProposal -> pure before/after/diff -> display
           originating Chat card -> existing Chat controller/applyDocumentationProposal owner
      -> PromptStack adapter: existing native draft/published stack owner -> display
           originating card -> distinct guarded prompt-stack publisher -> Work discovery
```

No document-source or proposal bytes are authoritative in DocumentsWidget; stale messages/candidates cannot drive write actions without checking the matching existing owner. Rendered Markdown is untrusted view content. View state may remember mode/path but must not authorize a proposal after restart.

## Confirmed producers/consumers and likely change paths

| Step | Likely affected files and data direction | Focused tests/build |
| --- | --- | --- |
| P1 | New `packages/theia-extension/src/browser/documents-widget.ts`, optional small presentation model; `frontend-module.ts` WidgetFactory/open command, `dope.css`; existing `WorkspaceService` controls project selection | New `test/unit/documents-workspace.test.ts`, existing `explorer-roadmap-navigation.test.ts`; rebuild extension only if importing `lib` |
| P2 | DocumentsWidget/adapter using existing `FileService`/workspace identity; **not** `documentation-discovery.ts` corpus search; filtered bounded tree including nested directories, without external-root/symlink access | New explorer fixtures in `documents-workspace.test.ts`; no node Docs writer changes |
| P3 | Shared `untrusted-message-markdown.ts` safe rendering or faithful renderer wrapper; `.md` formatting, `.txt` literal source; no executable HTML/media | New `documents-preview.test.ts` or same file; `message-code-copy.test.ts` only if modifying shared renderer |
| P4 | Documents source/edit pane + existing `EditorManager`/FileService/Monaco save/dirty/conflict seam; actual file identity check and unsaved draft recovery | New narrow `documents-editing.test.ts`; existing `chat-panel.test.ts` only if touching shared editor open |
| P5 | Pure `documents-diff.ts` projection of `ChatDocumentationProposal.targets` complete before/after and diff; cross-file selected state + Original/Proposed/Source Diff; synthetic deletion comparison allowed but Docs publisher remains create/update | New `documents-diff.test.ts`, `documentation-review.test.ts` only if altering proposal schema (prefer none) |
| P6 | `chat-panel-widget.ts` existing Docs card / `chat-panel-controller.ts` verified owner actions, opener callback injected in `frontend-module.ts`, Documents candidate projection; share card/viewport approval state | `chat-panel.test.ts`, `documentation-review.test.ts`, `documentation-application.test.ts`, new Docs viewport action tests |
| P7 | Existing `phase-stack-controller.ts`, `planning-stack-publication.ts`, `chat-panel-widget.ts` or native R3A/R3B modules **as actually present**; show generated and published files in same DocumentsWidget with no extra publisher | `phase-stack-ui.test.ts`, `planning-stack-publication.test.ts`, new prompt review test. If R3B absent: STOP BLOCKED without inventing new owner |
| P8 | Tight integration changes only in above paths after evidence; no separate service without need | `documents-*.test.ts` + directly affected existing Docs/Chat/Prompt tests in one bounded invocation |
| P9 | No mandatory source implementation; manual Codex browser, disposable worktree, screenshot/trace and exact installed/served SHA | Browser/native owner evidence; one final closeout file |

## Sequenced implementation

**P1 (T1) — Widget shell and navigation.** Reuse Theia main-area widget pattern and safe command from `frontend-module.ts`. Define `explorer | docs-proposal | prompt-stack` typed view model and project/candidate-bound selection, no write actions. Add compact left tree + center state loading/error placeholders, resize/keyboard affordance, semantic tokens. Do not hijack current Chat or Roadmap tab.

**P2 (T1) — Project Docs tree.** Use authorized `WorkspaceService` and `FileService` or existing navigator path to enumerate document-only entries with bounded/lazy folder handling. Reject external roots, non-files, unsafe symlinks and stale results; treat hidden/inaccessible content explicitly. Do not reuse `discoverDocumentation` model-facing corpus scan; no model/provider call or app storage of document bodies.

**P3 (T1) — Safe viewer.** Render `.md` Markdown through proven sanitizer/link policy and `.txt` literally, with Preview/Source, code copy and exact path/status. Show safe errors for large/unreadable files, no unsafe media/embedded HTML. Preserve source whitespace.

**P4 (T1) — Manual editor.** Bind Source/Edit to the existing Theia editor/Monaco/document resource operations rather than a new canonical writer. Dirty indicators, unsaved navigation prompt, safe save and external-source-changed conflict. Verify no automatic Docs application History event. Do not enable proposal candidate Source/Edit to write to project files.

**P5 (T1) — Proposal compare.** Read the typed complete proposed targets from current saved proposal identity, not a copied summary or model prose. Original/Proposed tabs per file, added/modified/deleted labels, inline exact diff anchors and Source Diff for changes that a rendered preview hides. A deletion status can be displayed for a validated future/synthetic comparison, but the inspected publisher does not authorize deletion. Keep unknown old record read-only.

**P6 (T1) — Docs card ↔ viewport.** Add Open Review on current pending Docs card, retaining Accept/Reject/Revise; both surfaces delegate exact digest/project IDs to existing `ChatPanelController`/backend operations. Disable stale/cancelled/foreign actions and show recoverable status. Revise returns to `/docs-review` and retains prior candidate until replacement. No independent UI decision store, per-file apply or `/docs-apply` slash entry.

**P7 (T1) — Prompt stack adapter.** Inspect actual native `/prompt-write` R3A/R3B ownership and source at execution. Reuse its proposal identity and guarded publisher, plus published Work discovery, to display individual P*.txt/README with order/source/copy; card and viewport remain consistent. If R3B is unimplemented, record BLOCKED and specific dependency rather than bypass. No Work Run, grant, or invented roadmap evidence.

**P8 (T2) — Cross-boundary integration.** One targeted regression matrix across project switch/reload, safe browser read, source stale edit, canceled/revised/rejected Docs candidate, multi-file apply/recovery/applied-only History, prompt-stack publication distinct from Docs, imported/published compatibility and no Work run. Fix only demonstrated seam defects. Cross-package changes trigger only necessary dependent builds/tests; no broad refactor.

**P9 (T3) — Manual owner browser closeout.** Use an approved disposable project (not owner's Dope checkout) and actual connected Codex browser. Verify nested docs editing, exact proposal before/after, renderer diff fidelity, stale/permission/restart and prompt stack draft/published review; test keyboard/touch/narrow/theme; inspect real records and explicit Work no-Run. Log exact served commit/version and PASS/FAIL/BLOCKED/EVIDENCE GAP. No automatic native/Electron parity claim.

## Build and test precision

Source is primarily `@dope/theia-extension` browser plus existing Chat source types. The relevant current tests **import compiled `packages/theia-extension/lib`**, so after TypeScript edits run `corepack yarn workspace @dope/theia-extension build` before `node --test ...` unless the chosen test imports `src` directly and is deliberately independent. If `@dope/chat` contracts actually change, first build `corepack yarn workspace @dope/chat build`, then extension. Avoid stale `lib` or unnecessary `npm run build:extension` (which builds many independent workspaces).

P1–P7: run only the corresponding new test plus directly affected existing test(s), ordinarily one `node --test` invocation. P8: run one consolidated focused set including `test/unit/chat-panel.test.ts`, `documentation-review.test.ts`, `documentation-application.test.ts`, `phase-stack-ui.test.ts`, `planning-stack-publication.test.ts`, and newly written Documents tests (plus other existing tests only if their owner changed). `npm run test:product` already builds the whole extension and runs a broad matrix; no duplicated root `npm run check` or packaging in ordinary prompts. P9 decides if final whole-app aggregate is justified on the exact final product; do not run it repeatedly if an identical command was already measured.

## Prompt Efficiency + human UI audit

- Single responsibilities chosen by shell/tree/renderer/manual-editor/diff/Docs ownership/prompt ownership seams, not arbitrary fixed count.
- P1–P7 <=8-minute target each including review/build/narrow tests; if actual work exceeds that target, stop and request a narrower correction instead of sprawling. P8 integration and P9 manual closeout are deliberate longer T2/T3 exceptions.
- GPT-6 Sol Medium P1/P2/P3/P5 and High P4/P6/P7/P8/P9 for permissions/authority and source-sensitive integration. No XHigh by default.
- Only final P9 Browser required=yes; all earlier prompts no. One contiguous P1–P9 correction version `0.13.11`, exactly one final closeout; no version changes or preauthorized Run.
- ADR 0016 / ADR 0030 + theme tokens, ADR 0037 human task flows: enter Documents, see where to click, inspect diff, recover from save conflict, accessible keyboard/touch/narrow presentation. Focused tests at T1/T2 and actual human browser at T3. No fabricated visual qualification.
