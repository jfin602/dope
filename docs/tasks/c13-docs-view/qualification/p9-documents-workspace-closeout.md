# Correction 13 / P9 — manual Documents workspace closeout

**Disposition: NOT GREEN.** Manual connected-browser T3 was performed on 2026-11-07 America/Chicago (2026-11-08 UTC). A and B have useful live evidence but remain **EVIDENCE GAP**; C is **BLOCKED** on native R3B; D is **EVIDENCE GAP**. This report does not qualify native Electron, complete Phase 13, award a Roadmap Gate, start Work, change version, or supersede the original P13 P8/P9/P12 and historical NOT GREEN receipts.

## Authority, source, and mode

I read `BOOT.md`, `AGENTS.md`, `docs/workflow.md`, ADR 0053, `docs/ui/documents-workspace-contract.md`, this correction's assessment/plan and P1–P8 receipts before the GUI run. P7's [R3B dependency finding](2026-11-07-p7-r3b-dependency-blocked.md) and P8's [integration finding](2026-11-07-p8-integration-blocked.md) remain in force. Current source inspection still finds R3A `/prompt-ass`, `/prompt-plan`, `/prompt-write` text output, but no native R3B pending prompt-stack proposal, originating Chat card, or guarded publisher. The old Planning Bridge publisher is a different owner and was not substituted.

| Basis | Exact value |
| --- | --- |
| Product Git HEAD, before and after | `ff4b8888b28e82073e4e41f8317ed12d88810713` (`main`, c13-docs-view/P8) |
| Product version | `0.13.11`, unchanged in root/package manifests and internal pins |
| Product worktree at entry | Clean (`git status --porcelain` empty) |
| Final served source | HEAD plus the three uncommitted Documents UI repairs described below; `git diff --binary` SHA-256 `68ccc50eca10a19c9449c2cf64868f4ff8f37b03fb90b3c73e82ed7b1ade8129`. There is no single commit SHA for this dirty tree. |
| Initial browser bundle | Fresh pre-repair build, used for the accepted Docs application below. Its full artifact hash was not retained after rebuilding; it is not represented as the final served source. |
| Final browser bundle | `apps/browser/lib/frontend/bundle.js` SHA-256 `d377874124b12909a3bc5722ed180f8c7d0598b1d602c123ff6ec6939dcd05ea`; CSS `7e91dbc95238a322bf03ea1e5270421c03f7ef9f4f5024fc5910a388b4fcaa2d`; backend `cbac64892a8fd1c1d545a0fecf970d811954c8b01acd81a01bdba2f39341f656`. The bundle and CSS hashes were independently confirmed from HTTP responses on port 3004. |
| Served URL/mode | Freshly built Dope browser server at `http://127.0.0.1:3004/`, connected Codex in-app browser (IAB), tab 2. Earlier port 3003 build was stale and was not used for T3. No independent Chrome or native Electron GUI was observed. |
| Local model in Dope | AI Center `LM Studio`, `http://127.0.0.1:1234/v1`, `openai/gpt-oss-20b`, provider `local`, 1 usable model after connection test. No hosted model was selected for these review turns. |

The disposable Git project was `/tmp/dope-c13-docs-view-p9-w1kha98o`, initial fixture commit `a5db711193313473e0d0c1515f07f9efb0426e14`. The second isolated project for switch testing was `/tmp/dope-c13-docs-view-p9-other-tmt6kkql`. The owner product project was never opened for destructive GUI testing.

## T3 matrix

| Case | T3 verdict | Live result and limit |
| --- | --- | --- |
| **A — Documents explorer/editor** | **EVIDENCE GAP** | Central Documents command opened a real nested `.md`/`.txt` tree; selected Markdown preview, source, plain text, file editor, auto save, dirty dot, external edit preservation, project switching, keyboard folder navigation, light theme and 800×700 narrow layout were exercised. Initial light-theme selected row was unreadable and the ordinary Open Documents command left proposal mode blank; both were narrowly repaired and rechecked in the final served build. Touch scrolling, complete conflict resolution, and clipboard readback were not proven. |
| **B — Docs proposal/application** | **EVIDENCE GAP** | Existing docked Chat staged a two-target update/create proposal, displayed full Original/Proposed/Source Diff with CRLF and trailing spaces, revised it, and rejected the revision with no write. A fresh two-create proposal was explicitly accepted; exact bytes, one journal and one applied-only History entry were verified. Delete was refused. Browser rehydration showed saved denied/applied cards. Double-click/late decision, stale/foreign/symlink/unsafe publication, and crash/partial recovery were not exercised as live T3 negatives. The one accepted transaction used the initial pre-repair bundle; the repair did not touch the Docs writer. |
| **C — prompt-stack adapter** | **BLOCKED** | Native R3B does not exist at this source. No protected `/prompt-write` draft review/publication or Work discovery was claimed from an older Bridge publisher. No Work Run occurred. |
| **D — adjacent surfaces** | **EVIDENCE GAP** | Chat stayed saved and docked while Documents, Roadmap, Work, AI Center and History were opened. Roadmap displayed the disposable project's empty state. Work opened to Select Work after a transient attach error; no run or grant was made. Chat/viewport decisions converged for observed reject and accept paths. Normal Copy Response and code Copy controls reported “Copied,” but browser clipboard readback was empty, and no complete egress/grant trace or native parity was captured. |

### A — actual files and interactions

The tree showed `docs/guide/intro.md`, `docs/rules.md`, and `notes/literal.txt` in their true directory hierarchy. The non-document `code.js` and symlink `docs/escape.md → /etc/passwd` were excluded; the UI counted excluded entries. `intro.md` rendered headings, a table, a fenced code block and a local link. Read-only DOM inspection found **zero `<script>` and zero `<img>` elements**; literal `<script>` and remote-image Markdown appeared as text/omitted-image copy. The local link did not expose a live `href`. The `.txt` preview displayed literal `<b>literal</b>` and `# plain text`.

The ordinary editor appended `P9 manual edit\n` to `notes/literal.txt` with Auto Save on; file bytes changed. With Auto Save off, an unsaved `unsaved conflict draft\n` produced a dirty indicator. An external append of `external change\n` followed by Ctrl+S did **not** overwrite the external bytes; Documents warned: “Project changed. Reopen this document from Documents before saving.” The editor also showed the normal save/discard prompt on close. The disposable unsaved draft was discarded after confirming the external file was retained. Switching to the second project showed only its own `docs/other.md`; returning to the first tab preserved the still-open draft before discard. No owner edits were involved. This establishes fail-closed preservation, not a complete conflict merge flow.

Keyboard `ArrowUp` moved focus from `docs/rules.md` to `docs/guide`; `ArrowRight` expanded that folder. A light-theme selected row originally had near-white text on light gray; [before](p9-light-theme.png) and [after repair](p9-light-theme-repaired.png) captures show the contrast change. [Narrow pane](p9-narrow.png) and [external conflict](p9-conflict.png) captures are retained. Touch emulation was unavailable in the connected browser, so touch scroll is an evidence gap.

### B — proposal, exact application, and refusal

The first real `/docs-review` proposed an update of `docs/rules.md` and creation of `docs/guide/p9-proposal.md`. The source `docs/rules.md` bytes were `# Rules\r\n\r\nKeep  two spaces.  \r\n`; comparison showed the full original and proposed text and the source diff. Revision 2 added a final `Revision checked.` paragraph to the proposed new file. Rejection left `docs/rules.md` byte-for-byte unchanged (SHA-256 `49e3000d17dcfcf6da5c0a70de45964a6712dd99defe27c00b007719b2b391b9`) and did not create the proposed file. Failed follow-on review attempts were visibly fail closed: nonunique exact replacement, missing brokered read, and protected/ineligible `p9-*.txt` target each produced no file change.

The fresh eligible proposal created exactly these two files after one explicit Documents Accept:

| File | Exact resulting bytes | SHA-256 |
| --- | --- | --- |
| `docs/guide/acceptance.md` | `# Accepted P9\n\nApproved through Docs review.\n` | `0346bac471700750cddbe96558fe9298e2808f5fc09a6507eaaaeae98512cfdb` |
| `notes/acceptance-note.txt` | `P9 plain text acceptance.\n` | `8d83ca7c6f0ec485230b0f53f8e10b1ce560a7b63c1c8392f73927b245280008` |

The sole application journal is `.dope/documentation-applications/55c96b26-20b7-45af-b1ab-08bb69297d11.json`, status `complete`, two `create` effects, approved at `2026-11-08T01:51:55.957Z`. Its proposal digest is `5a7144029549ccf12366184ae56dc66037b27de441e07c474ffa5cea424bd093`; project ID `root:f5f956802de43c5f1418ebd0e2cb2c2ef0378b3c5cd1de627a071c5f4654e39a`, worktree ID `a97c4a49ae490434a0ab69dba0ad1188b8d5e6761f91fa7818fb3ead783a4313`, owner `dope-chat-panel:00000000-0000-4000-8000-000000000002`, chat `3c3c02f2-1f77-4daf-a6be-7c37d507e42b`, and message `ff1560fe-9898-4ffe-a749-ece784fb8df0`. Project History displayed exactly one **Documentation — 2 document changes · complete** entry with that application ID and both diffs. There was no Documentation application entry for review, reject, or manual editor save. See [applied History](p9-applied-history.png) and [Documents with saved Chat/History](p9-docs-history.png).

A live `/docs-review` request to delete `notes/acceptance-note.txt` was refused with `Incomplete review: required target omitted: notes/acceptance-note.txt. No document was changed.` The file remained present. The current guarded Docs writer authorizes create/update only; this was not recorded as a successful removal. The post-repair one-file `reopen-check.md` proposal was opened in Documents, the ordinary **Dope: Open Documents** command returned to the project explorer, and the pending proposal was rejected from its Chat card; no such file was created.

### D — adjacent navigation and remaining limits

The same Chat conversation and denied/applied cards rehydrated after browser reload. Roadmap and Work remained separate center tabs; Work briefly showed “Phase Stack could not attach to this project” before Select Work, without starting work. The initial AI Center connection check displayed a stale “Connection check failed” banner while LM Studio later showed `ready · 1 usable model`; the local model was explicitly chosen in Chat. These messages were visible and offered retry/configuration actions, but the mixed health wording is a UX limitation. The observed Chat card and Documents view reflected the same decision state after reject/accept; duplicate/late response convergence remains unverified live.

## Narrow repair and verification

The initial manual run found two UI defects. `DocumentsWidget.openExplorer()` now selects the project explorer before refresh, and the ordinary Documents command calls it; opening a proposal still uses the existing review path. The selected tree row now uses editor foreground/background plus a focus border and weight so it remains readable in Light (Theia). No Docs writer, prompt publisher, Work owner, package manifest, internal pin, lockfile, or version was changed. The repaired browser was rebuilt and restarted, then the light theme and proposal-to-explorer interactions were rechecked in the final served build. The temporary verification proposal was rejected.

`corepack yarn workspace @dope/theia-extension build` and `corepack yarn workspace @dope/browser build` passed after the patch. A narrow `node --test test/unit/documents-workspace.test.ts test/unit/explorer-roadmap-navigation.test.ts` passed **11/11** on final source. A preceding combined focused run passed **17/18**; its sole failure was `test/unit/dope-theme.test.ts` expecting `#FF7A1A` exactly once. All three occurrences were already in HEAD CSS before this patch, so this is an existing test/source mismatch, not a repaired P9 pass. `git diff --check` passed. No aggregate check or nested duplicate check command was run.

## Git state, risks, and stop

Product Git status changed from **clean** at entry to exactly three modified source files (`packages/theia-extension/src/browser/documents-widget.ts`, `dope.css`, `frontend-module.ts`) and this untracked report plus six untracked PNG captures. The product HEAD stayed `ff4b8888b28e82073e4e41f8317ed12d88810713`; nothing was committed. The disposable fixture changed from clean to `M notes/literal.txt` plus untracked `.dope/`, `docs/guide/acceptance.md`, and `notes/acceptance-note.txt`. Its `docs/rules.md` remained unchanged. The separate switch fixture was left intact.

Remaining mandatory gaps: native R3B/P7/P8 adapter and protected publication; live duplicate/late, stale/foreign/symlink/unsafe, and crash/partial-recovery Docs decisions; full external-conflict resolution and touch scroll; clipboard readback and complete egress/grant trace; native Electron parity. These block a product GREEN or Phase closeout. The P13 original P8/P9/P12 and earlier NOT GREEN evidence remain separate. **Manual stop: no Work Run, Phase decision, version change, or Git commit.**
