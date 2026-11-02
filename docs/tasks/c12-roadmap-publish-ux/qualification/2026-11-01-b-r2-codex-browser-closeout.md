# B-R2 protected Chat publication — Codex browser closeout

**Disposition: B-R2 CODEX BROWSER GREEN; Part B GREEN for the owner-approved Codex browser scope.** The owner directed use of the Codex in-app browser in place of connected Chrome. This is not a connected-Chrome or native Electron GUI qualification. Part A and B-R1 retain their earlier Chrome Greens; P3-B Core and C12 Planning Recovery retain their owner-approved reduced-scope Greens. Historical NOT GREEN reports remain unchanged. Product version remains `0.12.7`.

## Source and behavior

- Entry was clean local `main` at `0b82d4a1af77f74bfe0cb5575693f19339a5226f`, ahead of `origin/main` by one B-R2 commit. This closeout records an additional bounded repair and final-source verification. No push, pull, reset, stash, dependency upgrade, provider setting or version change occurred.
- A current-turn protected `/roadmap publish ...` or `/roadmap link ...` command resolves to a bounded typed intent. A selected ready local model is required by the Chat route, but explicit publication/link commands do not generate model text: that cannot add authority to the deterministic operation and caused a live Qwen output-limit stall. An ordinary protected Gate edit still uses the model. The saved Chat response does not claim a model execution for a deterministic command.
- Chat and the editor call the same `RoadmapStore` preview and apply operations. The owner obtains current project, revision, source/destination hashes and file conditions, then checks approval identity, lease and current source again. The store is the only Markdown writer and linked-document owner. The existing change event refreshes the canvas. A demonstrated completed-card style defect was fixed so Markdown filenames retain their exact case.

## Live Codex browser replay

The actual app ran at `127.0.0.1:3023` in Codex in-app browser tab 2 with LM Studio `qwen3.5-9b` ready and selected for each protected turn. Disposable projects were used; Chat Commands remained Ask.

| Check | Observation |
| --- | --- |
| Q1 Publish | On accepted unpublished revision 1, Chat showed a saved inline **Publish New Markdown** card for `ROADMAP.md`, revision, SHA-256 `df222b93…7803f`, 1 Phase/1 Gate/1 Criterion and the unreviewed coverage warning. Reject created no file and left an inert historical card. A fresh preview was approved; the exact file hash equaled the preview hash, linked `sourceHash` matched, Roadmap became canonical/synced at revision 3, and **Open linked Markdown** opened the file. Reload preserved the compact Applied and Rejected cards without decision controls. |
| Q2 Link Existing | A second accepted unlinked project had compatible `PLAN.md` with pre-link SHA-256 `df222b93…7803f`. Chat showed **Link Existing Markdown** and explained that approval would not rewrite bytes. Approval linked it at revision 2; file hash stayed identical and linked path/mapping persisted after reload. The Roadmap control showed `PLAN.md: synced` immediately, then `PLAN.md: unchanged` after reload with the same accepted hash. **Open linked Markdown** opened `PLAN.md` after reload. |
| Q3 Stale approval | A pending `STALE.md` preview was created at revision 2. The disposable Roadmap source was then changed to revision 3 before approval. Apply returned **Stale**, removed approval controls and wrote no `STALE.md`. |
| Q4 Regression smoke | The real local model produced an ordinary protected `gate.edit` preview for exact `gate-one`, changing only purpose. Chat and the Roadmap canvas showed the same provisional change; Reject left the Gate Unknown and the card inert. The editor's own **Publish & Link Markdown** still produced its deterministic preview with current revision, destination safety, hash, counts and warning; Cancel left no file. No extra Roadmap tab or status notification appeared. The narrow Chat layout remained usable in the normal Codex viewport. Keyboard and other Part A/B-R1 coverage retain their prior scoped evidence. |

The first live publish attempt before the deterministic-command repair was cancelled after Qwen spent 1m35s reasoning; no file was written. A trial output cap failed with Qwen's 2,048-token minimum and also wrote nothing. Both saved failure turns remain historical. The final-source fresh publish/link, stale negative and Gate smoke above passed after the repair.

## Final-source checks and limits

- Focused Chat publication, protected Gate/Skills, publisher, Chat presentation and panel regressions: **84/84 pass**. These cover duplicate approval, wrong lease, unsafe paths, changed source/revision, exact bytes, collision, compatible linking, interrupted recovery and accepted-Corrections fail-closed in their stated deterministic scopes.
- Typecheck, browser build, Electron build and Git diff checks pass on the final source. The Electron build does not establish native GUI parity.
- B-R2 is qualified for the substituted Codex-browser scope. A fresh connected-Chrome B-R2 replay remains unobserved; no broader Phase 12, Docs Management, Work or native Electron claim follows. Remote synchronization was not authorized.
