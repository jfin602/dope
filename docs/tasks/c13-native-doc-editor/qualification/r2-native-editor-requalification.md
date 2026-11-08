# c13-native-doc-editor / R2 — independent native editor requalification

**Disposition: NOT GREEN.** The connected browser confirms that real `.md` and `.txt` Explorer tabs now have native controls and that a genuine, two-file Docs proposal uses read-only tabs and the guarded Docs application path. Native `/prompt-write` R3B is absent from this exact source, so the prompt-stack section is **BLOCKED**. A successful revised-proposal transition and several interaction and negative cases remain **EVIDENCE GAP**. This report does not award product Roadmap Gate GREEN, Phase 13 completion, Work execution, or Electron parity.

## Entry and exact source

I independently inspected `BOOT.md`, `AGENTS.md`, `docs/workflow.md`, ADR 0054, the native editor UI contract, the original [P5 NOT GREEN report](p5-native-editor-closeout.md), and the [R1 recovery record](r1-native-editor-recovery-2026-11-07.md) before testing. P5's failure and R1's scoped claims remain separate historical evidence. R1's changes are now in committed product HEAD `d6b383ba3416fda0f7eb5d3186a26e6b042a4fc5` (`main`, subject `c13`); the product worktree was clean at R2 entry. Root product version is **`0.13.11`**. No R2 product source edit, version change, commit, Work Run, or grant occurred.

| Receipt | Independent R2 observation |
| --- | --- |
| Build | `npm run build --workspace @dope/theia-extension` **PASS**; `npm run build --workspace @dope/browser` **PASS**, on the above HEAD. |
| Served bundle | Local and fresh HTTP `http://127.0.0.1:3000/bundle.js` SHA-256 both `c5e85c615aa20bf432a91c63c096dc88beedd887d132c7c81c2f51f10890dd1d`. Local and HTTP `bundle.css` both `bd3bee7b8347eef269e7b086136da4860422604c963a285c843a4359a5ada8bb`. |
| Browser | Real connected Codex in-app browser, 1920×1200 desktop split view, dark theme; served URL `http://127.0.0.1:3000/#/tmp/dope-c13-native-r2-SGnmWh`. The normal Theia File picker opened a second browser tab at `http://127.0.0.1:3000/#/tmp/dope-c13-native-r2-other-T1vfng`. This is browser evidence, not independent Chrome or native Electron evidence. |
| Main disposable project | `/tmp/dope-c13-native-r2-SGnmWh`, baseline Git commit `5840c17afe3ef129109fce399dbefa9a87357610`; project files `docs/guide.md`, `docs/other.md`, `notes/literal.txt`, `src/example.ts`. Only this disposable project received accepted Docs changes and `.dope/` test state. |
| Second disposable project | `/tmp/dope-c13-native-r2-other-T1vfng`, baseline Git commit `9ef51e84415905a50e9771fb69f77d1252db4dc6`, with distinct `docs/guide.md` content. |
| Proposal generation | Dope used a local LM Studio `openai/gpt-oss-20b` model for genuine `/docs-review` requests because the existing Interactive preference was unavailable. The model's assertion was not counted as verification; displayed bytes, source hashes, saved Chat state and the application journal were checked independently. The pre-test Interactive preference `LM Studio · qwen3.5-9b` was restored and confirmed in AI Center after testing. |
| Test scope | R1 already ran its 35/35 focused Node suite on this same committed product source. R2 did not repeat those identical tests or run a final aggregate without a new changed-source risk. The independent builds, browser checks, file hashes and source inspection below are this report's receipts. |

## A — real native editor integration

| Case | Result | Evidence |
| --- | --- | --- |
| A1 `.md` controls in actual tab | **PASS** | Explorer double-click opened `docs/guide.md` in the normal editor strip with Source, disabled Diff and Formatted in that tab's bottom footer: [source capture](r2-real-markdown-source.png). |
| A2 `.txt` controls | **PASS** | Explorer opened `notes/literal.txt` with Source and disabled Diff, with no Formatted: [text capture](r2-real-text-source.png). Disabled Diff is truthful for an ordinary file with no comparison basis. |
| A3 other extension | **PASS** | `src/example.ts` opened its normal code editor without document controls: [TypeScript capture](r2-normal-typescript.png). |
| A4 Source edit/save/undo | **PASS** | In the real text editor, appended `r2edit`, saved, observed the Git change, then undid and saved. `notes/literal.txt` returned to its baseline SHA-256 `76e3fe598e88053a668975d6cc644deef144323b70eb4c7e0977d1ec46d9a9ed` before proposal testing. |
| A5 centered, read-only Formatted Markdown | **PASS for observed file** | The real guide's heading, paragraph and table rendered centered and readable in a non-editor formatted pane: [formatted capture](r2-real-markdown-formatted.png). The formatted surface is a rendered DOM view; editing/saving was exercised separately in Source and the proposal tab. A direct hostile-keyboard attempt against this ordinary formatted pane was not recorded. |
| A6 actual comparison content | **PASS for proposal basis** | Ordinary-file Diff was disabled without a basis. The actual two-version Docs proposal showed the retained Original, added Proposed line and matching green Diff; see B6 captures. No independent ordinary-file comparison basis was created. |
| A7 footer does not obscure content | **PASS for observed dimensions** | The last guide and text lines remained visible above the footer in the 1920×1200 split browser captures and after reload: [reopened guide](r2-reopened-editor.png). Long-file scrolling and narrower geometry remain untested. |
| A8 old Documents tab/explorer absent | **PASS** | One normal Explorer appeared. The live command palette returned no `Dope: Open Documents` result: [palette capture](r2-no-documents-command.png). Source no longer contains the retired Documents widget, command or duplicate tree registrations. |
| A9 navigation, project switch, reopen | **PASS for observed route** | Normal tabs switched correctly; browser reload restored the ordinary guide tab with controls and accepted bytes: [reopened guide](r2-reopened-editor.png). File → Open selected the second disposable folder; its new browser tab showed the distinct `Other project` guide, one Explorer and native controls, without the first project's editor tabs: [second project](r2-second-project-editor.png). Cross-project pending proposal handoff was not exercised. |

## B — genuine Docs proposal and guarded application

The first saved Chat proposal was `6f9b6a85-411c-44d1-8108-59d3ef69d6c8`, digest `50c05a38857ed244c04493d7be1d1cfb1ebb96f964672d2e9ff49eae9f0cbd7c`, Chat `b80ffe94-38d8-4895-b406-36a286c80a72`. It updated exactly `docs/guide.md` and `notes/literal.txt`. The proposal was created by `/docs-review` in the main disposable project and was pending before any canonical write. The saved application journal is `/tmp/dope-c13-native-r2-SGnmWh/.dope/documentation-applications/6f9b6a85-411c-44d1-8108-59d3ef69d6c8.json`.

| Case | Result | Evidence |
| --- | --- | --- |
| B1 every affected filename clickable | **PASS** | Both paths were live buttons on the originating proposal card: [card capture](r2-docs-card.png). |
| B2 one filename opens correct read-only tab | **PASS** | Clicking `docs/guide.md` opened the guide proposal as a separate main-area tab with pending/read-only status and the proposed added line: [single-file capture](r2-docs-single-file.png). |
| B3 Open All opens all files in existing strip | **PASS** | Open All opened guide and literal proposal tabs beside ordinary editor tabs: [two-tab capture](r2-docs-open-all-repeat.png). |
| B4 first activates, others available | **PASS** | Guide was active after Open All; literal remained in the same strip and could be selected: [literal tab](r2-docs-text-tab.png). |
| B5 repeat does not duplicate | **PASS** | Repeating Open All still left one matching proposal tab for each of the two paths: [repeat capture](r2-docs-open-all-repeat.png). |
| B6 exact Original / Proposed / Diff | **PASS for this proposal** | Original omitted `R2 reviewed guide.` [Original](r2-docs-original.png); Proposed Source contained it [Source](r2-docs-source.png); Diff showed the corresponding added line [Diff](r2-docs-diff.png). Journal before/after hashes and diff matched the two canonical writes after Accept. |
| B7 `.md` Formatted; `.txt` no Formatted | **PASS** | Guide proposal opened in Formatted and displayed the added paragraph [Markdown proposal](r2-docs-single-file.png); literal showed Source/Diff only and the exact proposed `R2 reviewed note.` [text proposal](r2-docs-text-tab.png). |
| B8 Ctrl+S cannot write pending bytes | **PASS** | Typing `r2bad` into the proposal Source produced `Cannot edit in read-only editor`; Ctrl+S left canonical guide/literal hashes at their baselines `7e162f24f38d5d3bb9905b1eecec60254d709b4b72898c9597f88f051a5fced8` and `76e3fe598e88053a668975d6cc644deef144323b70eb4c7e0977d1ec46d9a9ed`: [read-only capture](r2-docs-readonly.png). Source also exposes proposal resources as `readOnly: true`, `autosaveable: false`, without a canonical URI or Saveable. |
| B9 decisions and tab status | **EVIDENCE GAP overall** | **Accept PASS:** first card became Applied and its tab `accepted · read-only`. **Reject PASS:** second proposal `9c0189f6-446d-4693-81cb-10401807dc49` for `docs/other.md` became denied/rejected, tab `rejected · read-only`, no canonical change or journal: [reject](r2-docs-rejected.png). **Stale PASS:** third proposal `ac635bf4-7822-4fc1-8c1b-1c804b664aa3` became `stale · read-only` when external source changed; Accept refused to apply and kept the external bytes: [stale](r2-docs-stale.png). **Revise EVIDENCE GAP:** two genuine Revise requests returned no valid proposal changes from the local model. The app failed closed and retained the old pending tab/bytes, but a successful revised-tab transition was not observed. |
| B10 only applied Docs changes create application History | **PASS for observed decisions** | Accept created one complete journal with two effects and History displayed `2 document changes · complete`: [History](r2-docs-applied-history.png). The effect hashes were guide `7e162f…` → `b9e68460be9ad579bc85f591b509d21f891b87b8309d75c2ffa6209cace313e8`, literal `76e3fe…` → `aced1ff1751df9dd87dab20e8658af8cd2cc792fd881fd137196e88d96f4583f`. Journal approval time was `2026-11-08T11:48:56.890Z`. Reject, failed Revise and stale Accept created no application journal. The stale trial's external `docs/other.md` edit had SHA-256 `49a587dbc11b1b6e3a1c53a5bbd2ed114cf18cae9ba3cf164291fc3333926197` and was not model applied. |

**Requested negatives:** wrong-project proposal opening **EVIDENCE GAP** (the second project loaded independently, but a pending first-project proposal was not opened there); expired proposal **EVIDENCE GAP** (no real expired proposal); delayed-open race **EVIDENCE GAP** (no controlled delayed response). The observed stale-source refusal is a separate **PASS** and does not stand in for these three checks.

## C — native Prompt Stack proposal

**BLOCKED: native `/prompt-write` R3B does not exist in this HEAD.** `packages/chat/src/index.ts` defines the persisted `ChatPlanningActivity.kind` union and validator with `documentation-proposal` but no native prompt-stack proposal kind. `packages/theia-extension/src/node/chat-backend.ts` still routes `/prompt-write` through `finishedPromptStack(...).text` to final text around line 2548; there is no retained native prompt-stack proposal/card or guarded R3B publisher. The older Planning Bridge publisher has a different owner and was not substituted. No prompt-stack proposal ID, publication, Work Run, grant or permission was created.

| C case | Result |
| --- | --- |
| Genuine native proposal/card and clickable filenames/Open All | **BLOCKED** |
| P1–Pn order and proposal tab deduplication | **BLOCKED** |
| Read-only pending prompt proposal content | **BLOCKED** |
| Separate guarded publication | **BLOCKED** |
| Navigation/publication does not start Work or grant execution | **BLOCKED**; no native publication exists to exercise. No Work or grant was invoked during R2. |

## D — replacement, UX and safety

| Case | Result | Evidence and limit |
| --- | --- | --- |
| One project file explorer; no reachable old Documents workspace | **PASS** | Only Theia Explorer was present in both fixtures; command search had zero old Documents result, and retired widget/tree registrations are absent from source. |
| Existing normal editor tabs | **PASS for observed types** | `.md`, `.txt`, `.ts` opened normally; Source save/undo and browser reload worked. Other language and binary editors were not sampled. |
| Narrow width and many tabs | **EVIDENCE GAP** | Several ordinary/proposal tabs coexisted and deduplicated; no narrow viewport or overflow stress run. |
| Keyboard navigation, focus | **EVIDENCE GAP** | Keyboard editing, Ctrl+S and Ctrl+Z worked in Source; systematic tab/footer focus order was not checked. |
| Mouse/touch scrolling and copy | **EVIDENCE GAP** | Mouse clicks selected tabs/modes/cards. No touch emulation, long scroll or clipboard readback. |
| Alternate themes | **EVIDENCE GAP** | Dark theme only. |
| Untrusted Markdown/model-content privilege safety | **EVIDENCE GAP for live hostile input** | Source routes formatted Markdown through `renderUntrustedMessageMarkdown` and removes unsafe links; `safeDocumentLink` permits only credential-free HTTP(S)/mailto, and proposal resources are read-only. R2 did not inject an executable Markdown payload or test privilege effects in the browser. |
| Roadmap Gate stays unawarded | **EVIDENCE GAP for direct Gate UI** | No Roadmap action, Work execution or grant was invoked. The Docs application journal and History showed document changes; no direct before/after Roadmap Gate check was made. |

## Final receipt and limits

The R1 correction resolves the original P5 observed failures for real `.md`/`.txt` footer activation, the duplicate Documents workspace, and Docs file-link/Open All routing on this R2 fixture. That observation does not rewrite P5's exact-source **NOT GREEN** result. The mandatory native Prompt Stack card/publisher is still **BLOCKED** by missing R3B; successful Revise and requested edge cases have evidence gaps. Accordingly **R2 is NOT GREEN**. No final aggregate was justified for unchanged product source already covered by R1's identical focused suite. The only new product-worktree artifacts are this report and its browser screenshots; no auto-commit, product version bump, Work Run, Roadmap Gate award or Phase 13 closeout occurred.
