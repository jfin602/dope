# B-R2 protected Chat publication recovery — 2026-11-01

**P3-B: NOT GREEN. B-R2: NOT GREEN. Overall Part B: NOT GREEN.** B-R1's earlier deterministic/editor Chrome GREEN remains a separate result. This report supersedes no historical P3-B failure. Native Electron GUI was not observed. Product version remains `0.12.7`.

## Source and bounded execution

- Entry was clean `main` at `e5e26053f54de8069915ec13a5bfbf44ce8013f8`, equal to `origin/main`. The attributable product/test repair is local commit `0672b61573f21bd497a065fe1dd906e198ee009b`. No push, pull, reset, stash, dependency or version change occurred.
- A fresh Codex in-app browser tab used the rebuilt Dope app at `http://127.0.0.1:3021/#/tmp/dope-br2-evv5yS`, a disposable schema-2 project. The final served browser bundle and local built bundle had identical SHA-256 `393a0a0c668f2c7e8d45fbe7c34c07e5dabeca31a90ef9c0921d882dd0bf32a2`. The dedicated backend was restarted after the repair build.
- The real selected local model was LM Studio `qwen3.5-9b`, Q4_K_M, loaded with context 16,384 and parallel 2. Chat Commands remained Ask. No model or global provider setting was changed.

## P3-B recovery observations

The R4 closeout already proved an exact-ID Gate edit/approval, a two-action preview, project/Chat switching and several source-bound negatives. This run did not relabel those observations. It addressed two narrower defects:

1. A failed protected `/roadmap` turn could reuse its saved skill snapshot on retry. The backend now requires a fresh `/roadmap` turn for a new protected proposal. A failed-turn test confirms that retry is rejected before another model call and the Roadmap stays byte-identical. Ordinary saved-skill retry behavior remains covered by the existing Chat test.
2. A real protected model turn proposed `gate.reparent` of `gate-one` from `phase-one` to `phase-two`, order 0, at Roadmap revision 4. Chat showed the validated parent change, but **View in Roadmap** initially showed no provisional destination change. The canvas routed edited Gates only to their proposed new parent, where no accepted Gate row existed to render them. The repair adds a provisional destination card and focuses that Phase. On the final served bundle, a second real `/roadmap` turn produced the same validated action. The destination Phase displayed `Proposed · Not applied`, `Parent: phase-one → phase-two`, and the unchanged criterion. The accepted Gate remained under First Phase; Review Phase still had no accepted Gate; both qualification states were unchanged. The canonical index SHA-256 remained `77a2da5ce683705a3f302d87e734635a6d151fa4794c50bc5181038ff63b44b6` through preview and rejection. Both rejected Chat cards became compact and non-actionable; the canvas preview disappeared.

This is a live **Gate reparent preview/reject PASS** and a deterministic protected-retry denial PASS. It is not a Gate reparent Apply result or an entire action-family matrix.

| Mandatory P3-B area | Current disposition |
| --- | --- |
| Phase/Gate/Criterion/Correction/dependency/reorder action families, one to three atomic actions | R4 and this run cover representative edits, creation previews and reparent preview. Complete family-specific Chat/canvas before/after, Apply/Reject, deletion, order and overflow evidence remains open. |
| Proposal lifecycle and authority | Pending, rejection, compact saved cards, supersession and some switching/lease/stale cases have source or earlier Chrome evidence. Final-source live lost lease, replaced proposal, old snapshot and multi-panel continuity matrix remains incomplete. The new retry denial is deterministic, not a browser-forged-metadata replay. |
| Protected skill and context | The genuine `/roadmap` reparent passed with current project/revision. Existing focused tests cover unskilled no-write and typed authority. A complete final-source browser matrix for forged slash/model text, foreign/expired lease and selected/unselected large-Roadmap 16K cases was not run here. The R4 auto-expanded Phase-context caveat remains unresolved. |
| Chrome UI/accessibility | The repaired destination preview, reject clearance and historical card were observed. Narrow Chat/editor, full keyboard/focus, saved-camera, reduced-motion and every provisional entity family were not completely replayed. |

These are mandatory gaps, so **P3-B remains NOT GREEN**. The historical R4 closeout is unchanged.

## B-R2 disposition and B-R1 regression

The protected Chat `publish`/`link` intents and review card were **not enabled or qualified** because the required P3-B protected route remains unqualified. No model-authored Markdown was written and no new writer or approval route was added. New-file Chat Q1, existing-file Chat Q2, parity Q3, full security Q4 and saved Chat Q5 remain unrun for B-R2. This is **B-R2 NOT GREEN** and **overall Part B NOT GREEN**, not a B-R1 reversal.

The existing B-R1 deterministic editor path was independently replayed on the final browser bundle. The first preview failed closed because the second Phase had no accepted Gate. After adding a test Gate to that disposable fixture, the preview disclosed path `ROADMAP.md`, revision 5, two Phases, two Gates, two criteria, destination absence, exact generated content and both unreviewed Gate-set warnings. The file did not exist before explicit approval. Approval through the editor's existing `previewRoadmapPublication`/`applyRoadmapPublication` owner produced the file and linked state at revision 7. File SHA-256 and linked source SHA-256 both equal `c796db7e27beb11b9d3159a5c5c4756a83b8c33e77062645784965a6b2b451e3`. **Open linked Markdown** opened that file. Both Phases retained unreviewed coverage and Unknown qualification; both Gates remained Unknown. The focused publication tests also cover occupied/unsafe/symlink paths, changed hashes, response loss, recovery, Corrections fail-closed and existing-file compatibility. Those fault tests are deterministic, not Chrome-observed crashes. No fresh Chat publication or existing-file Chat link occurred.

## Final verification and limits

- Focused Roadmap/Chat/Skills/publication/canvas/viewport tests: **108/108 pass** on the repaired source. A separate earlier focused Chat/Skills/Pi compatibility run: **17/17 pass**; the two selections overlap and are not summed as unique tests.
- `npm run typecheck`, `npm run build:browser`, `npm run build:electron`, `git diff --check` and staged diff check passed. The Electron build is not native GUI parity.
- The remaining P3-B security/context and action-family browser gates block AI-origin publication. No Phase 12 GREEN, Gate GREEN, Work run or publication approval is inferred from the successful preview and editor regression.
