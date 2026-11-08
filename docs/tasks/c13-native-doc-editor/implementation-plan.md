# /prompt-plan — c13-native-doc-editor

**Basis:** approved [ADR 0054](../../decisions/0054-native-document-editor.md), [UI contract](../../ui/native-document-editor-contract.md), [assessment](prompt-assessment.md), `docs/workflow.md`; remote source `0.13.11`. **State:** planned/authoring only, not local implementation or tests. User reports `c13-docs-view` already executed locally; **current GitHub main does not contain those local product changes**, so its actual source/evidence controls implementation and removal.

## Architectural replacement

```text
Normal Theia Explorer -> real .md/.txt editor resource -> Monaco Source / native Diff if basis
                                                     -> same-tab safe Formatted (.md only)
                           [compact editor-scoped bottom view mode control]
Chat Docs proposal card -- file link / Open All --> Theia main editor tab strip
  |                     -> proposal-scoped READ-ONLY resources: Original/Proposed/Diff
  +-- existing Dope Docs owner -> guarded Accept / Reject / Revise -> exact applied History

Chat Prompt Stack proposal card -- file link / Open All --> same Theia tab strip
  +-- existing *different* prompt-stack proposal/publisher -> publication -> Work discovery
                                                             (NO implicit grant or Run)
```

The replacement adds **no** project tree, Documents widget, duplicate editor or new publishing service. Real editable source tabs and proposal virtual tabs have distinct resource identities. Formatted is always read-only; Source is normal editable only for real project files. Proposal tabs carry exact root/worktree, owner, proposal ID, digest/revision, file path and before/after source identity, with truthful status; these data are read through existing owner APIs, not reconstructed from Chat prose.

## Actual files/seams to inspect before code

| Responsibility | Primary likely source + consumer | Evidence and boundary |
| --- | --- | --- |
| Editor rendering | `packages/theia-extension/src/browser/frontend-module.ts`, `dope.css`, applicable Theia 1.75 editor/Monaco/Markdown services; real local `c13-docs-view` files | Verify supported editor-tab decoration/content/toolbar/diff API first; no monkey patch/private Theia fork. New narrow `native-doc-editor*.ts` presentation helpers only when needed. Tests `test/unit/native-doc-editor*.test.ts`, `dope-theme.test.ts` only if theme tokens changed. |
| Proposal readonly resources + diff | `packages/chat/src/index.ts`, `service.ts`, `chat-panel-controller.ts`, `chat-panel-widget.ts`, `documentation-review.ts`, tested Monaco Diff/openers | Typed exact immutable before/after, project/lease/digest bound, no canonical FileService writes; test new/create/update + whitespace CRLF, virtual URI isolation, save denial and stale decisions. |
| Docs/prompt card navigation | `chat-panel-widget.ts`, native P13 R3B proposal/card owner if actually present, existing `phase-stack-controller.ts`, `planning-stack-publication.ts`, editor opener in frontend DI | Exact individual paths; Open All N tabs, first active, dedup, deterministic P ordering, partial failures. No direct Docs apply, no new prompt publisher. Test `chat-panel.test.ts` and relevant prompt-stack UI tests. |
| Retirement + integrated regression | Actual locally generated old Documents widget/filtered explorer/CSS/registration/tests + relevant editor and Docs/prompt owners | Delete only obsolete presentation code after replacement; retain shared safe renderer and tests. Test old launcher absent and normal Explorer present, project switch/restart, applied-only History, no Work Run/Green. |
| Manual UI | Connected Codex browser and optionally separate Electron native owner observation | Actual screenshot/interaction evidence; no browser-claim in headless prompts. |

## Prompt plan

**P1 — Native editor modes (T1).** Inspect the *real* Theia editor API and c13-docs-view UI baseline. Add scoped bottom controls for `.md` Source/Diff/Formatted and `.txt` Source/Diff only, without rewriting normal editor or file save. Format `.md` centered ~720–800px safe rich Markdown with no code gutters, read-only, copy/focus and theme. Hide/disable Diff when no real basis. Do not create proposal tabs yet. Tests: targeted extension view-mode and renderer isolation; no broad aggregate.

**P2 — Proposal-specific read-only editor tabs (T1).** Project/owner/proposal/digest/path identifies each virtual tab, never the canonical file URI. Fetch exact retained Original/Proposed bytes through existing typed owner; create a read-only Monaco resource and native diff comparison; label missing new-file original correctly. Separate Original/Proposed selector from mode toolbar. All proposal views are non-writable and reject Save/resource writes. Revalidate on reopen/revision/status; no phantom file data. Focused tests for virtual resource ownership, no-save and compare accuracy. Do not add publisher.

**P3 — Cards: hotlinks and Open All (T1).** Replace large inline file diffs/cards with compact list of clickable affected `.md`/`.txt` filenames; **both** Docs and native Prompt Stack proposal cards get compact Open All beside affected-file count. Route single clicks and batch opening to P2, in source proposal order and P1–Pn ordering, with tab dedup and partial error/cancel feedback. Card Accept/Reject/Revise still call their existing authoritative handlers. If actual native P13 R3B is absent, record BLOCKED rather than invent an equivalent publisher. Focused card, navigation, resource/digest and no-Run tests.

**P4 — Retire old Documents presentation / integrated safety (T2).** Verify completed local P1–P3 outputs, then delete the standalone c13-docs-view Documents workspace widget registration, side document explorer, extra canvas/editor, styling, unneeded props/state and dead-only tests. Keep real Explorer, other document services, changed shared view logic, historical files. Single deliberate integration test pass across ordinary file save, formatting, proposal version/diff, Docs owner create/update/revise/accept/reject and one real History effect, native prompt publish/execution non-grant, project switch/reload, large Open All, symlinks/unsafe stale files and no bypass. Stop on failed protected gate. No inherited previous GUI Green claim.

**P5 — Manual connected-browser closeout (T3, final).** On a disposable project, run actual Theia editor tabs with `.md` Source/Diff/Formatted, `.txt` Source/Diff, rich centered view, normal editing, dirty save/undo, bottom toolbar non-overlap, proposal file links and Open All for Docs/Prompt proposals, multi-tab navigation, stale/revise/reject/accept, reload/project switch/keyboard/narrow/touch/theme and no extra Documents explorer. Verify persisted files and History and Work not starting. Capture exact served SHA, version and per-case evidence; full-app aggregate only if justified on final changed source, no unobserved Electron parity.

## Build/test command selection

Before each runner prompt inspect actual `package.json` scripts and test imports. Existing `test/unit/chat-panel.test.ts`, `documentation-review.test.ts`, `documentation-application.test.ts`, `phase-stack-ui.test.ts`, `planning-stack-publication.test.ts` frequently import compiled `packages/theia-extension/lib`. If extension changed, run `corepack yarn workspace @dope/theia-extension build` **before** relevant `node --test` tests. Build `@dope/chat` first only if its contract source actually changes; avoid stale lib, unrelated workspaces and repeated `npm run check`. P1–P3 each use just their direct new `test/unit/native-doc-editor*.test.ts` plus necessary existing tests. P4 one consolidated targeted T2 invocation, not full product matrix by default. P5 manual direct GUI and final justified aggregate. No validation/test execution occurred while writing this plan.

## Source readiness and evidence rules

`c13-docs-view` history is immutable regardless of technical outcome. The owner says it ran; verify local actual source, status, tests and receipts, don't assume GitHub's prior authoring-only main includes it. The replacement must not silently erase uncommitted code, user files or parallel work. Check native R3B actual presence before P3; don't widen publication or deletion authority. A qualified P1–P3 alone cannot authorize old UI retirement if the old widget is still needed as a safe user interface. STOP on failed authority, real editor incompatibility, or missing required owner; report scoped BLOCKED/NOT GREEN. A new final manual P5 outcome is separate from earlier source and owner phase qualification.
