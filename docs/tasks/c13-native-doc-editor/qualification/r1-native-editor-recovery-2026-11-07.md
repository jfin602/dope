# c13-native-doc-editor / R1 recovery

**Disposition: scoped repair verified in the connected browser; NOT overall GREEN.** Independent R2 qualification is still required. The original [P5 NOT GREEN closeout](p5-native-editor-closeout.md) is unchanged.

## Source identity and root cause

- Baseline: `2bce322453f38cd97db28b4618e00a8791a9f0bd` on `main`, clean before R1, product version `0.13.11` unchanged. R1 product changes remain uncommitted. The final tracked diff before this report had SHA-256 `3c15e23ab3ee678fbcef8ece2480985ff2428792367d59196338612ee98b76d0`.
- The generated browser host loaded `@theia/editor-preview` **after** Dope. Its `EditorPreviewManager` opens Explorer files through `EditorPreviewWidgetFactory` (`editor-preview-widget`). P1 had rebound only `EditorWidgetFactory` (`code-editor-opener`), so real Explorer tabs did not use the document subclass. The P1 test checked source text but did not check the actual host module order or factory.
- The Docs card still invoked `DocumentsWidget.showDocumentationCompare`; `ProposalDocumentTabs` had no user-facing caller. The old Documents command and widget remained registered. P3/P4 runner commit subjects did not establish these integrations; their blocked receipts remain accurate.
- During R1 live review, proposal Formatted worked but Source/Diff were blank. The custom proposal widget used `MonacoEditorProvider` without forwarding widget visibility to the embedded Monaco editors. Monaco detaches their models while hidden. R1 now calls `handleVisibilityChanged` when the selected editor is shown or hidden and gives its node the editor body dimensions.

## Changes

- Added `@theia/editor-preview` as an extension dependency so Theia loads its factory before Dope. `NativeDocumentPreviewWidgetFactory` now replaces the factory used by `EditorPreviewManager`, while the standard factory path remains covered. The existing Monaco editor owns normal Source editing, save, undo and selection; the footer reserves 38 px. Diff remains visibly disabled for ordinary files without a comparison basis.
- The Documentation Proposal card now has clickable affected paths and **Open All Files** beside the count. Both call the existing checked Docs handoff and the P2 proposal tabs. Open All follows proposal order, opens separate virtual tabs, reuses matching tabs, and activates the first. Card Accept/Reject/Revise still use the guarded Docs owner. Proposal tab status updates from saved Chat activity.
- Proposal tabs use a compact diff icon with the plain filename as the label. The title caption carries the path, status and read-only state with breadcrumb separators, avoiding Theia's duplicate-filename path suffix. The visible tab and caption do not contain `Proposal:`.
- Safe HTTP(S) and mailto links in formatted Markdown remain clickable with a new-window target and `noopener noreferrer`; unsafe links remain inert.
- Removed the standalone `DocumentsWidget`, its command and widget registration, duplicate file tree, presentation/editing state, unused CSS and two tests specific to that retired UI. Retained the normal Theia Explorer, ordinary editor, safe Markdown renderer and Docs application owner.
- Source touched: `packages/theia-extension/package.json`; `src/browser/{frontend-module,chat-panel-widget,native-doc-editor-widget,native-doc-editor-proposal,native-doc-editor-proposal-model,documents-preview,dope.css}` under that package; `test/unit/{native-doc-editor-modes,documents-handoff}.test.ts`. Deleted `src/browser/{documents-widget,documents-editing,documents-workspace-state,project-documents-tree}.ts` and `test/unit/{documents-workspace,documents-editing}.test.ts`.

## Build and focused verification

- `@dope/theia-extension build`: PASS. `@dope/browser build`: PASS. Generated `apps/browser/src-gen/frontend/index.js` loads editor-preview before Dope.
- Focused Node tests: **35/35 PASS** across native modes/proposals, Docs handoff/diff/preview/review/application. The added host test checks generated module order and the actual preview factory binding; the card test checks the guarded route into `ProposalDocumentTabs` and absence of the old registration.
- `git diff --check`: PASS. Browser bundle SHA-256 `c5e85c615aa20bf432a91c63c096dc88beedd887d132c7c81c2f51f10890dd1d`; CSS SHA-256 `bd3bee7b8347eef269e7b086136da4860422604c963a285c843a4359a5ada8bb`. Both matched fresh HTTP responses from `127.0.0.1:3000`; the final bundle was loaded in the connected browser. This is a dirty-worktree build on the stated HEAD, not a new commit.

## Targeted connected-browser smoke

Disposable project: `/tmp/dope-c13-r1-smoke` (normal Explorer, connected Codex in-app browser). Screenshots of the ordinary Markdown and text editors, formatted Markdown, proposal card, proposal Source/Diff and two tabs were captured in the connected browser session; those captures are in the task transcript, not durable files in this qualification directory. No Electron GUI parity is claimed.

| Case | Result | Observation |
| --- | --- | --- |
| 1. Real `docs/guide.md` | **PASS** | Explorer double-click opened the standard editor tab with Source, disabled Diff and Formatted footer in that same tab. |
| 2. Formatted Markdown | **PASS** | Centered read-only heading, paragraph and table rendered in the same tab. Source remained editable; a source edit was undone and saved. |
| 3. Real `notes/literal.txt` | **PASS** | Standard editor tab showed Source and disabled Diff, with no Formatted control. |
| 4. Retired Documents UI | **PASS** | `Dope: Open Documents` returned zero command-palette results. No duplicate file tree or Documents tab appeared. |
| 5. Docs filename link | **PASS** | A real two-target `/docs-review` in the disposable project produced a pending card. Clicking `docs/guide.md` opened a separate main-area proposal tab with pending/read-only status and exact proposed formatted text. The compact tab title was subsequently refined to use a diff icon plus `guide.md`. |
| 6. Open All | **PASS** | Two separate proposal tabs opened; the first target was active after completion. Repeating Open All left exactly one tab for each proposal path. The new-file tab labelled its Original as absent. |
| 7. Proposal Source/Diff/version | **PASS** | Source showed the proposed added paragraph; Diff showed its added lines; Original showed the retained prior text. The initial blank Monaco render was repaired and rechecked on the final bundle. |
| 8. No canonical proposal write | **PASS for this fixture** | Typing into proposal Source displayed “Cannot edit in read-only editor”; Ctrl+S did not save proposal bytes. After rejection, tab status became rejected. `docs/guide.md` and `notes/literal.txt` retained their baseline SHA-256 (`af39a653e0abe62940758b8ec299ec03772b63cb33e0c6d72f6762694b1c56a4`, `5773efa8464ca6239320d15465803d6e5e46ae9066e5b2753545ea4d9621d0dc`); proposed `docs/proposal-note.md` stayed absent. Only untracked `.dope/` test state was created. |
| 9. Formatted links | **PASS** | A temporary Markdown fixture showed an HTTP(S) link with `_blank` and `noopener noreferrer`; a JavaScript link was inert. The fixture was removed after this check, then restored to allow workspace layout recovery during the final icon smoke. |
| 10. Compact proposal tab | **PASS** | With both canonical `guide.md` and proposal `guide.md` open, the final browser tab displayed only the diff icon and `guide.md`; Theia's extra `Proposal: docs` suffix was absent. DOM inspection found no detail label and the `codicon-diff` icon. The proposal remained pending and read-only. Two intermediate local-model review attempts failed closed without document writes before the exact read-backed proposal succeeded. |

## Dependency and remaining gaps

Native `/prompt-write` R3B remains **BLOCKED**: inspected source still has no native retained prompt-stack proposal activity/card/guarded publisher. The existing Planning Bridge publisher is a separate owner. R1 did not create a second publisher or claim Prompt Stack card navigation.

This was a targeted browser smoke, not independent R2 qualification. It did not exercise large Open All lists, stale source/revision during an asynchronous open, project switch with proposal tabs, light/narrow/touch views, full copy readback, normal external edit conflicts, complete Docs accept/recovery/History, or Electron parity. The browser screenshot captures were not persisted as files. No Work Run, grant, Roadmap Gate award, version change, or Git commit was made.
