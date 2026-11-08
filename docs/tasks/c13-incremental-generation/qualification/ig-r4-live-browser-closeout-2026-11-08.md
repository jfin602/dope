# IG-R4 independent live browser closeout — 2026-11-08

**Verdict: BLOCKED — connected Codex browser unavailable.** This session did not run the required live GPT-OSS 20B or connected-browser qualification. IG-R3's deterministic prerequisite passes on the current checkout, but it cannot establish any IG-R4 live gate. The c13-incremental-generation correction is **not ready for owner technical closeout** on this evidence.

## Source and prerequisite

- Starting and final product HEAD: `825806c67eaf4cf42306ec9200515cc6f33fa95f` on `codex/ig-r3-headless-recovery`, clean at entry. Its parent `eb0fcda3c796b38c88a45799f35efc4c4ccc7fc9` is the IG-R3 implementation; HEAD adds only its qualification report. Product version remains `0.13.11` across the root and 12 workspace package manifests.
- Read `BOOT.md`, `AGENTS.md`, `docs/workflow.md`, ADR 0055, the incremental proposal contract, and the P6, R1, R2 and IG-R3 qualification reports. P6 and R2 remain **NOT GREEN**, R1 and IG-R3 remain headless PASS, and historical R3B remains PARTIAL. No prior verdict or executed prompt was edited.
- Inspected the actual IG-R3 diff, provider-compatible object tool schemas in `packages/pi-runtime/worker.mjs`, its one-use same-session terminal continuation, ChatBackend's authoritative `finishPermitted` check, assessment/plan validation, staged prompt diagnostics, controller source/lease/replay checks, deterministic prompt composition, and existing Docs and prompt publication owners. This is source inspection, not a live behavior claim.
- Built `@dope/contracts` then `@dope/theia-extension`: PASS. The exact nine IG-R3 focused test files passed **81/81**, zero skipped or failed. `npm run check:pi-runtime` passed: Pi 1.4.0, 121 integrity-locked packages. No source repair was made.
- Local source/build SHA-256 values after those builds: `packages/pi-runtime/worker.mjs` `0c9bfaef00552411d1cf1a230399e18b7f637c6b62f047c0df9d348db97cc536`; compiled `chat-backend.js` `41fc6c9a39bbcc50d2a3fdd60adbf427dbe0b35c49273d69528b1d4fd2362c50`; compiled `pi-conversation-runtime.js` `5095582fd90a0c43ce47079912d81dca658f6b258006755ea0d4e42d519e87f1`. These are **local file hashes, not served host hashes**.

## Mandatory environment blocker

The tools available to this Codex session provide no connected browser control, page inspection, interaction or screenshot capture. `open_in_codex` can display a browser tab but cannot control or inspect the application. A local Chrome/Puppeteer run would be supplemental only and cannot meet the task's explicit connected Codex browser requirement. Therefore no browser host was started or asserted as the tested build, and no local Chrome observation was substituted for connected-browser evidence.

The selected AI Center connection, `openai/gpt-oss-20b` model, endpoint, context and output limits were **not independently verified in IG-R4**. No browser URL/session, served frontend/backend/worker hashes, provider usage, inference time, or connected-browser screenshot exists for this run. Earlier R2 values are historical and are not carried forward as current facts.

## Gate disposition

| Gate | IG-R4 result | Evidence limit |
| --- | --- | --- |
| A — source-grounded assessment and ten-step plan | **BLOCKED** | No native Chat turn, brokered source reads, saved assessment or plan. |
| B — large three-target Docs generation and finish | **BLOCKED** | No live staging, `proposal_finish`, continuation count or review-ready Docs card. |
| C — ten-prompt stack and finish | **BLOCKED** | No live P1–P11 stages, composed files, `proposal_finish` or Prompt Stack candidate. |
| D — Docs review, revision, Reject and Accept | **BLOCKED** | No ready candidate or native browser review; no canonical Docs application or History receipt. |
| E — Prompt review and publication | **BLOCKED** | No ready candidate or guarded R3B publication; no Work discovery receipt. |
| F — denial, restart and recovery | **BLOCKED** | IG-R3's focused source tests pass; the requested live denial and restart cases did not run. |
| G — UI and usability | **BLOCKED** | No connected-browser UI evidence, screenshots, input/theme checks or Electron parity. |

The primary A–C checkpoint is **BLOCKED**. No disposable clamp fixture was created; therefore there is no baseline commit, target hash or candidate hash to report. No proposal revision, rejection, acceptance, canonical file write, publication journal, applied-only History entry, Work grant/Run, Roadmap Gate award, Phase advancement or version change was performed in IG-R4. These are actions absent from this run, not independent proof of the application's behavior under live inference.

## Exit

There were zero IG-R4 repair cycles and zero live model calls. The exact remaining mandatory blocker is access to a connected Codex browser capable of opening and interacting with the freshly built Dope host. On a future independently authorized live run, record served build identities and the selected model first, then run Gates A–C before the remaining review, publication, denial and UI gates. Do not resume Phase 13 recovery R3/R2/R4, start Work, award Roadmap/Phase GREEN or advance the product version from this result.

---

# Connected-browser continuation — 2026-11-08

**Current verdict: NOT GREEN.** This subsequent live run is appended so the earlier BLOCKED verdict remains intact as historical evidence. A connected Codex in-app browser was available. Gate A failed three real GPT-OSS assessment attempts, including an exact-request retest after one bounded repair. Per the primary-gate stop rule, Gates B/C and the lengthy secondary qualification were not run. P6/R2 remain NOT GREEN, R1/IG-R3 remain headless PASS, and R3B remains historical PARTIAL.

## Exact basis

- Starting repository HEAD: 5dc27734113b3d8f4be79121c1312f5295cdc227, clean on codex/ig-r4-live-qualification. Product source after the sole repair: d717a288e5c7a2d90b2759be429e769dfefeac37. Product version remains 0.13.11.
- Re-read BOOT.md, AGENTS.md, docs/workflow.md, ADR 0055, the p13 incremental contract and P6/R1/R2/IG-R3 reports. Inspected IG-R3's source diff, typed tool schemas, same-session finish continuation, plan checks, controller, composer and guarded publication boundaries. The prerequisite nine-file suite passed 81/81 and Pi runtime integrity passed (Pi 1.4.0, 121 packages). The affected dependency chain and browser app built successfully; the host was restarted.
- Connected browser: Codex in-app session 01a1bc3d-7f17-7bd2-bdd4-51a0e9f2f800, tab 1, URL http://127.0.0.1:3000/#/tmp/dope-ig-r4-clamp-et3NSW. Frontend bundle SHA-256: 030ecc468dadf383483ca1f1c581a59e5b60d18fab2ca8aeb4b622fc266de73e. Browser backend main: 61d6fa29ca2fc0ee3fe08de082631cc8c2998a1cb081ce770fc637308f0d0447. Pi worker: 0c9bfaef00552411d1cf1a230399e18b7f637c6b62f047c0df9d348db97cc536. Compiled ChatBackend: 41fc6c9a39bbcc50d2a3fdd60adbf427dbe0b35c49273d69528b1d4fd2362c50. Compiled Pi conversation runtime: 5095582fd90a0c43ce47079912d81dca658f6b258006755ea0d4e42d519e87f1. Compiled proposal tool bridge: e4f7013b766c69029952a76ce933f7e561171b8003e901a7b42bcebf6fc1a292. These are local compiled-file identities from the restarted host checkout, not response-header attestations.
- AI Center displayed ready on connection 21d03643-2aca-407e-b090-af59979b6c2f, explicitly selected LM Studio / openai/gpt-oss-20b, endpoint http://127.0.0.1:1234/v1. LM Studio showed one loaded GPT-OSS 20B instance at context length 16,384. Saved Chat settings had an 8,192-token input budget, 1,024 reserved output tokens and output-limit policy ask. Commands was Allow for brokered fixture reads. No synthetic model response or substitution was used.
- Fresh disposable ESM fixture: /tmp/dope-ig-r4-clamp-et3NSW, baseline commit bf681ef504be30ef34fae8b7d9166286a66d0404, package version 0.1.0, three passing Node tests, no CI/browser infrastructure. The guide is 123 lines/14,872 bytes with meaningful late sections. Baseline SHA-256: package.json 72cb1766edf650e3961d533eaf6895ece351fcd6f0e82573e82d4fcb4a766e13; src/clamp.js 475df6accc20ad39f227c6f0eaae6f20fccb84030c077afe394ba82320687690; test/clamp.test.js 8c6b06d412c05367f24ad90f7f60a180c8dbcac10651c52d4b6cc8af605cf901; docs/clamp-guide.md 53360c45b56c6af12523f510ed98f1c0edc9fb649f51e3220ea6d3f2565235e4; docs/release-notes.txt b784096f66fa26ef3cba72cc531f2ff558b9843585593242d15916c48658787a.

## Gate A trace and repair

1. Initial /prompt-ass took 117.6 seconds. Saved tool events show completed brokered reads of all five requested paths, but the guide read ended at byte 4,096 of 14,872. The model put Read: in a Markdown bullet with nested path bullets. Validation rejected the draft: “Assessment Source basis must name a broker-read file on its Read: line.” Its provisional text also inferred an unsupported Node minimum version. No assessment was saved.
2. A targeted retry took 81.3 seconds. It again read the five paths but not the late guide section. Its Read: line was present, yet its section labels were bold text rather than Markdown headings; the same diagnostic appeared. The provisional draft also invented a Node version and new lint/TypeScript work.
3. One bounded repair clarified literal Markdown heading/Read: syntax, late-page guidance and a missing-heading diagnostic; focused regression assertions were added. The extension built, affected Chat/prompt tests passed 20/20, and the final nine-file focused suite passed 81/81. The host was restarted and the browser reloaded. No source, stage or publication guard was relaxed. Compiled repaired assessment module SHA-256: ed648e402d8e7d642a52314b89c281d3882b2e1dfa6ec55344c09d04dec5b55b.
4. The original request was retested on real GPT-OSS for 123.5 seconds. It again read all five paths, but only the guide's first 4,096 bytes, and searched for workflow.md without reading it. Its provisional text used a Markdown Source Basis heading but still put Read: in a bullet followed by nested paths. It falsely said the guide's limitations header had no content. The same Read: diagnostic rejected it. The repaired guidance did not recover the live Gate A path.

The safety check correctly withheld a saved assessment. The demonstrated remaining defects are the model/validator formatting boundary, absent late-section paging, and unsupported source claims. There is no valid saved assessment or ten-step plan. /prompt-plan was not invoked without its assessment basis. Total observed inference wall time was 322.4 seconds. Provider token totals were unavailable in the failed execution records; unavailable does not mean zero.

| Gate | Current result | Evidence limit |
| --- | --- | --- |
| A — assessment and plan | **FAIL** | Three failed live assessments; late guide section unread; no saved assessment or plan. |
| B — three-target Docs generation/finish | **BLOCKED** | Not invoked after Gate A. No stages, finish call, continuation, candidate or digest. |
| C — ten-prompt generation/finish | **BLOCKED** | No valid assessment/plan; no prompt stages, files, finish call or digest. |
| D — Docs review/revision/Reject/Accept | **BLOCKED** | No ready candidate or application/History receipt. |
| E — Prompt review/publication | **BLOCKED** | No ready stack, R3B publication journal or Work discovery receipt. |
| F — denial/restart/recovery | **PARTIAL / EVIDENCE GAP** | Host restart/reload preserved failed Chat turns; IG-R3 source tests passed. Live wrong-project, stale-source Accept and replay were unrun. |
| G — UI/usability | **PARTIAL / EVIDENCE GAP** | Connected browser showed ready AI Center, selected model, brokered activity and honest failed cards. Completed proposal UI, keyboard, touch, narrow/theme and Electron were unrun. |

A connected-browser screenshot of the final Chat error and ready AI Center was captured in this task's browser transcript. The browser API did not export a repository PNG, so no persisted screenshot artifact is claimed. The fixture's five tracked files retained baseline hashes; only noncanonical .dope Chat/session state appeared as untracked. No validation playbook, canonical prompt stack, proposal revision/rejection/acceptance, Docs or prompt publication, applied History entry, Work grant/Run, Roadmap award, phase advancement or version change was performed. These absent actions do not qualify the unrun safety gates.

**Recommendation: hold technical closeout.** Start a bounded correction stack for the demonstrated assessment formatting, late-source coverage and factual-grounding failures; then independently rerun Gate A before B/C and the remaining live gates. Preserve all historical verdicts and keep Phase 13 recovery R3/R2/R4 ON HOLD pending separate owner authorization.
