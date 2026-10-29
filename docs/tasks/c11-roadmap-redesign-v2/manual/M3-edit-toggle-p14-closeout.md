# M3 — Selected-item Edit toggle and independent P14 Chrome qualification

**Execution:** MANUAL product fixes + **independent real Codex Google Chrome qualification**, GPT-6 Sol High. **Browser required: yes.** This is the only manual step eligible to finish P14, and only if M1/M2 are truly qualified on source applicable to final candidate.

## Preflight

Read [manual README](README.md), M1/M2 dated actual evidence and exact Git commits, [owner visual contract](../../../planning/p11/roadmap-visual-hierarchy-contract.md), ADR 0040, existing `RoadmapInspectorModel` and `RoadmapInspectorWidget`, actual available actions, linked Markdown and Chat preview/approval. Inspect HEAD, committed/dirty work, 0.11.8, rebuilt served browser/backend identity. Do not reset, stash, clean, force-push, change branch/version, or overwrite an in-progress P14 run. No automatic runner P15 or canonical Markdown publication until qualification passes.

## Correct the secondary manual editing model

On selecting a **Phase or Gate**, show the current item's full relevant information read-only in the **existing Software Map-style in-stage inspector overlay**. No always-visible field inputs, giant status select, standalone details page, Gate wizard or menu tree.

A single obvious **Edit** toggle changes the selected item's inspector into an **optional local field-editing state**. In that state expose the fields relevant to the selected entity:
- Phase: title, objective and existing supported phase sequencing/metadata.
- Gate: title, objective, criterion descriptions/expected results, explicit dependencies and applicable correction/owner references through compact controls appropriate to the existing model.
- Source/qualification: status and current evidence can be *inspected* normally, but GREEN/waiver cannot be granted by a cosmetic dropdown; only authorized evidence/exception review can update them.
- Save/Preview/Approve as required by existing typed owner and linked Markdown authority, Cancel/Discard restores read-only without writes, Undo where existing owner supports it. Toggle is local UI mode, not a second editing backend; Chat and field edits use the **same project-bound typed action validation and approval path**.

Selection changes, external edits, source revision races, Chat-initiated update while Edit mode is open, read-only imported source, proposed drafts and cross-project switching must not silently overwrite. Prompt a clear conflict/review with preserved user content or safe discard; never paste stale edits onto a new Gate. Keyboard/screen-reader accessible toggle, focus management, narrow overlay and mobile touch all functional. Editing is OFF on first selection by default and after leaving the item.

## Independent Chrome qualification matrix (M1 + M2 + M3 + original P14)

Operate fresh disposable projects in actually connected Chrome. Replay these **independently** of earlier M1/M2 checks on the final source:
1. **Visual:** large 440–560 px-ish effective Phase cards at typical desktop 100% view (adjust for OS/device), readable 14–16 px Gate content and expansion, screenshot-like spacing, horizontal browse instead of default Fit-All microscopic overview, clear phase arrows, no overlap; 5+ phases and narrow split. Capture measured DOM/computed effective screen font/zoom and screenshots.
2. **Color and truthful progress:** 0 Gate unplanned dim; first accepted Gate planned warm copper but NOT GREEN; active orange; failed/blocked muted red; current evidence-qualified GREEN green; stale/waived/unknown visually distinct. Labels/icons/track, dark/light/custom and proposed-source treatment. Never manufacture positive status from fixture/card appearance.
3. **Real Chat authoring:** in saved and actually selected model conversation, create/revise/reorder/delete Phase/Gate/criterion, dependency/correction, evidence inquiry and source-bound approvals. Verify preview accept/reject/stale/foreign negative, fresh reload, no invented Green, no extra assistant/Chat backend, actual no-write hashes.
4. **Read-only first / Edit toggle:** select Phase and Gate: all fields display as normal text. Click Edit and modify Gate title/criteria, preview/approve/save through same backend, toggle Off; click Cancel on second edit => no source write; make concurrent Chat revision => reject stale save or request reconciliation, no clobber. Check keyboard, Chat dock, focus, inspector/viewport, long Phase.
5. **Original P14 preserved cases:** canonical schema2 Phase/Gate/criterion persists/reloads, 3 phases with nested Gate foldout, inspector navigation, first Gate Planned not Green, phase-only and explicit Gate proposal clearly noncanonical, Accept/Reject not linked-document publish, unchanged source on reject, browse Chrome screenshot/restart/zoom.
6. **Security/authority:** no direct AI GREEN/waiver, source/project/owner/revision mismatch, read-only source edit, link conflict and missing model recovery. No auto-Work/Pi permission grants or hosted fallback; no direct file patch from Chat outside approved adapter.

Run focused Roadmap canvas, status truth, inspector/edit, Chat actions/grounding, linked sync, accessibility, theme, source-authority and selected model tests plus relevant browser build, `git diff --check`. Record exact tested source/served bundle and backend hash, project/Chat/model IDs, changed files, screenshots, DOM/action evidence, before/after hashes, PASS/FAIL/BLOCKED/NOT RUN and source drift. If local Q4 unavailable, M2 end-to-end is an evidence gap—do not call this all GREEN based only on deterministic tests.

## Final Gate and Git resume

**P14 remains NOT GREEN** if any owner-visible scale, color, Chat-first, optional Edit or original P14 scenario fails/was unobserved. Record failure accurately; never manufacture source/evidence, and do not start P15. If all M1–M3 and original P14 acceptance pass on the **final same source**, write a source-bound closeout in `manual/qualification/` plus the actual original P14 scope evidence and commit with **exact subject**:

```text
c11-roadmap-redesign-v2/P14: Chrome UI integration qualification
```

That exact, genuine PASS commit is the runner's authorized resume marker. After it exists on the local Git history and the worktree is reviewed/clean, the operator may resume the existing `npm run codex:phase -- c11-roadmap-redesign-v2` at P15. This step qualifies only the interactive Roadmap P14 UI scope—not downstream Gate->Work completion, independent native Electron GUI, Phase 11, or Pi Phase 12. Deliver owner-native reproduction checklist; never infer parity from Chrome/build.
