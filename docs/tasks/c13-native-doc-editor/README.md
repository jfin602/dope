> **2026-11-08 OWNER CLOSEOUT — CLOSED FORWARD / R2 NOT GREEN PRESERVED:** The owner accepts the native Theia editor replacement as sufficient to end this **standalone editor correction**, and directs the missing native Prompt Stack proposal/publisher plus remaining editor-review evidence to [Phase 13 recovery R3B](../p13/recovery/R3B-prompt-proposal-publication.txt). See [owner closeout](qualification/owner-closeout-2026-11-08.md) and original [R2 NOT GREEN](qualification/r2-native-editor-requalification.md). Observed ordinary .md/.txt controls, removal of the duplicate Documents workspace, Docs file links/Open All and guarded multi-file review are accepted within tested scope; successful Docs Revise, missing native R3B and other R2 evidence gaps are **not** relabeled PASS. Preserve original P5/R1/R2 reports and executed prompt/source history. No further `c13-native-doc-editor` run, no product/Phase GREEN or version change from this owner decision.

# c13-native-doc-editor — Replace Documents workspace with native Theia editor tabs

> **AUTHORING ONLY — 2026-11-07:** Following approved [ADR 0054](../../decisions/0054-native-document-editor.md) and [native editor UI contract](../../ui/native-document-editor-contract.md), this is the owner-selected **replacement correction** for the already-run `c13-docs-view` presentation. Five prompts **total**, including exactly one manual connected-Codex-browser closeout, at **unchanged remote product baseline `0.13.11`**. `/prompt-ass + /prompt-plan + /prompt-write c13-native-doc-editor` does not run them, change product source, reclassify historical evidence, start Work or qualify Roadmap.

**Entry is conditional on ACTUAL LOCAL SOURCE:** The owner's prior `c13-docs-view` was executed locally, but GitHub `main` at 1ad10415ab58 still shows the earlier **authored prompts without their local product-code results**. Inspect the owner checkout, current Git HEAD, dirty work, exact files created/modified by P1–P9, implementation/qualification reports and real installed Theia 1.75 editor APIs BEFORE any replacement code. Do not reset, stash, delete uncommitted work, replay old prompts or pretend the remote tree represents that completed local source. If local package version or missing publisher makes the stack contract inapplicable, stop for narrow reconciliation; do not fabricate a matching version or weaker authority.

## Ordered correction stack — five prompts maximum

| Prompt | Scope | Tier | Browser |
| --- | --- | --- | --- |
| [P1](P1-native-editor-modes.txt) | Enhance native `.md`/`.txt` editor tabs and formatted Markdown | T1 | No |
| [P2](P2-proposal-tab-versions.txt) | Read-only proposal-scoped editor resources, Original/Proposed and Monaco Diff | T1 | No |
| [P3](P3-card-file-navigation.txt) | Both proposal cards: clickable filenames and Open All Files into native tabs | T1 | No |
| [P4](P4-retire-and-integrate.txt) | Remove duplicate Documents UI and qualify cross-owner integration | T2 | No |
| [P5](P5-manual-browser-closeout.txt) | Independent connected-browser/manual GUI closeout | T3 | **Yes — MANUAL** |

**Dependencies:** P1 -> P2 -> P3 -> P4 -> manual P5. Source verification and protected proposal ownership are mandatory before implementing navigation; P4 must not delete the old UI until P1–P3 replacement is proven in focused/integration checks. Only the old **presentation** is retired: Docs application/History, prompt-stack publication, Roadmap, Work and real Theia project Explorer survive.

**Scope decisions:**
- Enhanced modes are **only** for `.md` (Source/Diff/Formatted) and `.txt` (Source/Diff). Regular file Source keeps Theia edit/save; Formatted is centered read-only Markdown; proposal tabs are read-only in every mode.
- Proposal-specific tabs live in the existing central editor tab strip, use non-file virtual resources and a separate Original/Proposed selector. They never overwrite the real file before Accept. No `/docs-apply` or `/prompt-apply` user command is restored.
- **Both** Documentation and Prompt Stack Proposal cards expose clickable affected filenames and compact **Open All Files**; bounded multi-tab opening dedupes identical review resources, preserves order and never publishes/starts Work.
- Current Docs review/application backend supports create/update and 1–4 targets, **not delete publication**; do not expand or simulate a delete writer. Native `/prompt-write` R3B may be absent on remote main: verify actual local implementation, report dependency BLOCKED instead of adding a competing publisher.
- Preserve old `docs/tasks/c13-docs-view/P*.txt`, executed/failed/manual reports, root/user work and all source-bound qualification. No shadow Documents widget hidden behind a flag.

## Later deliberate Run (not done here)

From the qualified owner checkout after syncing this **docs-only** commit and reviewing conflicts and changed local files:

```bash
npm run codex:phase:validate -- c13-native-doc-editor
npm run codex:phase -- c13-native-doc-editor
```

Normal runner executes **P1–P4 only**; never use `--closeout` and never auto-run manual P5. P1–P3 use the smallest source/compiled-lib tests necessary, target <=8 minutes including implementation/validation, and stop if their actual work exceeds the bounded scope. P4 is a dedicated T2 integration/retirement exception; P5 is independent real-browser T3 proof. Test successes/runner markers alone do not mean GREEN. A separate owner-reviewed final disposition is mandatory.
