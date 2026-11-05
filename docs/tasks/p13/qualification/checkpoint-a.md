# P13 P4 — browser checkpoint A, 2026-11-05

**Disposition: BLOCKED / NOT GREEN. No owner-reviewed PASS.** Connected Codex Chrome could not navigate to the local Dope app. The Codex in-app Chromium browser supplied useful live UI observations, but it is not the required connected Chrome qualification. No `0.13.4` marker, version advance, P5 resume, Work grant, product Gate GREEN or owner Phase completion is authorized by this report.

## Source and operating basis

- Main HEAD at entry and report: `a8e907da9a3a879450c137d7282a8f68e50d96a9` (`0.13.3`). P1/P2/P3 receipt subjects immediately precede it: `bd4759a8 0.13.1`, `0d1debab 0.13.2`, `a8e907da 0.13.3`. The project worktree was clean at entry; it now has the ten uncommitted repair files below and this report. No reset, stash, clean or commit was performed.
- Final tested source is **HEAD plus the uncommitted repair diff**, SHA-256 of `git diff`: `7e4688734e14c35717ea45d31160f612d27076848639e416e5e8573121a43800`. This is not an exact committed product receipt. Dope app/package version remains `0.13.3`; assigned P4 target `0.13.4` was not applied. Browser bundle was rebuilt locally from that source and served on `127.0.0.1:3000`.
- The recommended GPT-6 Sol High selection and context capacity were not exposed by the available UI, so the actual selected model/context is **unverified**. No provider switch was made.
- Disposable real project: `/tmp/dope-p13-checkpoint-a-20261105`, Git baseline `b699c8117b7fd4bb053d2f4187f0d069dd97f5f5`, Roadmap project ID `10787965-4c10-4245-bf87-c8a69c681a2d`. The owner's persistent tower-defense project was not mutated. This fixture has no WorkItem, Work run, Work grant or phase Work link. A small local TypeScript source and Software Map architecture were added solely to enable the bridge view.
- Required references read: `BOOT.md`, `AGENTS.md`, `docs/workflow.md`, ADR 0051, the P13 lifecycle contract and P1–P3 source/commit receipts. No candidate promotion or owner/security gate was bypassed.

## Browser attribution and observed flow

Connected Chrome's extension tab list and session naming worked, but creating or navigating its tabs repeatedly failed before Dope loaded (`Cannot read properties of undefined (reading 'timeoutMs')`). Three attempted tabs stayed blank. No Chrome DOM, screenshot, or genuine Chrome test result exists for P4.

In the Codex in-app Chromium browser, the accessibility tree for `Roadmap - dope-p13-checkpoint-a-20261105` showed two accepted Phases and their Gate cards. Phase 1 `2a8e7415-cdea-42bc-9a6a-1e9b0325cb08` had required Gate `878567a3-ca94-48c2-9b22-c3d17c5cb46a` and Criterion `3de086b2-0918-4474-b0b9-a658e7367013`; Phase 2 `1b67e4a8-62d3-427a-9d46-dc6cdc2635d0` had Gate `8d1e38da-d3c6-440f-b1cd-46eea7cb48c9` and Criterion `c1d59e0e-7857-4d3e-8a96-e4944581d8ad`. The linked `ROADMAP.md` bytes had SHA-256 `6e05a0f900a63a266bacd220cba6f6d2e05f05a68f1031a9bcb1a4eda306287e` when Phase 1 was locked. The current source bytes returned to that hash after a Phase 2 title edit/revert; the auto-sync journal reported `synced` for Roadmap revision 11.

The in-app browser first rejected Finish Planning with an empty Gate set, then with missing complete coverage approval. After reviewing exact Phase/Gate/Criterion/source details and approving coverage, Finish Planning displayed the exact locked basis; confirmation created planning approval `4aac4767-89a8-40d4-be13-a944a4f127b1` at basis revision 8. On reload, Phase 1 said **Ready for Work**, exposed no title/objective/Delete/+ Gate/+ Correction controls, and kept an inspectable details panel. Keyboard Tab from the Phase 1 card moved to its Gate summary without entering a hidden pencil. Phase 2 said **Planning** and retained title/objective/Delete/+ Gate/+ Correction controls; a live Phase 2 title edit succeeded. A direct RoadmapStore Phase 1 edit failed on the planning lock with no revision change.

After the Phase 2 edit changed the linked source, the in-app browser showed **Ready for Work · Source Stale** and disabled Prepare Work with the reason `Locked Phase source changed. Review and reopen planning before preparing Work.` After reverting that title through the UI and refreshing Software Map (`SYNTHESIS G1 | complete | 5 nodes | 0 violations`), Prepare Work opened the actual Planning Map. Its accessibility tree showed `Prepare Work checkpoint context`, the exact locked Phase ID and approval ID, Criterion ID and expected result, and required Gate ID. It also said **No linked Planning Map is available** and offered Create; no WorkItem, grant, promotion or run followed. The inspector's secondary summary called the Phase `published · stale` at revision 11 even when the source bytes again matched the lock, while the canvas said Ready for Work. This presentation inconsistency remains for review.

## Operated matrix

| Required case | Observation | P4 result |
| --- | --- | --- |
| One-Phase lock persists on reload; other Phase editable | In-app browser reload preserved Phase 1 lock and Phase 2 controls; Phase 2 title edit succeeded. | **EVIDENCE GAP** — no connected Chrome replay. |
| Planning label, Ready for Work, hidden editors, backend enforcement and keyboard | In-app browser showed Planning/Ready labels, absent Phase 1 controls, inspector, keyboard order; direct backend edit rejected. | **EVIDENCE GAP** — no connected Chrome replay. |
| Prepare Work reviewed bridge, exact identities, no auto Run/promotion | In-app browser displayed exact Phase/Gate/Criterion/approval IDs in Planning Map; no linked map or WorkItem existed, and no grant/run/promotion occurred. | **PARTIAL** — no linked WorkItem/Planning Map review and no connected Chrome replay. |
| Zero/incomplete Gate set | Empty Gate set rejected live in-app; incomplete Criterion tested in focused unit coverage, not live Chrome. | **EVIDENCE GAP**. |
| Unapproved coverage | Rejected live in-app before coverage approval. | **EVIDENCE GAP** — no connected Chrome replay. |
| Pending proposal | Focused source test rejects; not operated in live UI. | **EVIDENCE GAP**. |
| Source mismatch | In-app Phase 2 edit produced stale locked source and disabled Prepare Work on final source. | **EVIDENCE GAP** — no connected Chrome replay. |
| Foreign project | Focused source test rejects; not operated in live UI. | **EVIDENCE GAP**. |
| Stale revision | Focused source test rejects; not operated in live UI. | **EVIDENCE GAP**. |
| Duplicate submit | One-use coverage review tested in source; no live duplicate Finish Planning submission. | **EVIDENCE GAP**. |
| Linked Markdown conflict | Focused source tests reject hash drift and unresolved conflict; physical source mismatch was observed, but full conflict/reconciliation path was not operated in live UI. | **EVIDENCE GAP**. |

## Repairs and validation

The live exercise exposed missing accepted-draft + Gate access, missing reviewed coverage approval controls, an inaccurate pre-Work `Not Green` label, absent IDs in the handoff context, and a Prepare Work path that stayed available after the locked source changed. Uncommitted repairs are in `packages/project-intelligence/src/node/roadmap-store.ts`, `packages/theia-extension/src/browser/{physical-map-widget,roadmap-canvas-model,roadmap-canvas-widget,roadmap-inspector-model,roadmap-inspector-widget}.ts`, `packages/theia-extension/src/{node/backend-module,roadmap-service}.ts`, and `test/unit/{roadmap-finish-planning,roadmap-inspector}.test.ts`. The coverage approval is source/revision bound and one-use; the browser path requires explicit review. No product GREEN is assigned.

Final-source validation: `npm run build:browser` **PASS**; `node --test test/unit/roadmap-finish-planning.test.ts test/unit/roadmap-canvas.test.ts test/unit/roadmap-inspector.test.ts test/unit/roadmap-phase-work-handoff.test.ts test/unit/roadmap-planning-links.test.ts` **PASS 39/39**; `git diff --check` **PASS**. The in-app browser stale-source denial and corrected handoff were replayed after the final build. These tests do not replace connected Chrome. Native Electron remains unobserved and belongs to P13.

## Resume condition

Repeat P4 in connected Codex Chrome on this final source and operate every mandatory negative, including a reviewed Planning Map/WorkItem link with no grant. Resolve or explicitly assess the inspector stale wording. Re-run affected browser and focused checks after any further source edit. Only then can the owner independently review a genuine PASS report and direct the exact `0.13.4` version/marker commit. This report does not claim that approval.
