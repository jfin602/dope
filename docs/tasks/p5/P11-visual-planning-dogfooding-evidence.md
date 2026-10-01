# P11 — Visual planning Dope-on-Dope qualification evidence

Status: **Not Green** (2026-10-01). P12 closeout is **not eligible** from this candidate.

## Candidate and preflight

- Pre-task checkout: clean `main` at `97b92e2f6d0a38297d24fdeff33e389207adecc8` (`0.5.10`), ten reachable P1–P10 commits ahead of `origin/main`. P1–P10 commit messages report their bounded checks; they explicitly leave direct GUI qualification to P11.
- P11 working tree: all ten live root/app/package manifests and internal `@dope/*` references changed coherently to `0.5.11`; the exact-version assertions in `test/unit/theia-baseline.test.ts` changed to `0.5.11`. Before adding this record, the source/test diff SHA-256 was `4a3f23ed74617b43d3a8e6c57ebd86f44ab7143d3de5a2fbd284782cc30d7de4`. The P11 changes are uncommitted.
- Read BOOT/AGENTS, Phase 5 activation/plan, ADR 0017, P11/P12 prompts, P1–P10 commit results, current Phase 5 source/tests, and prior Phase 4/package evidence. BOOT and AGENTS already contain committed conflict markers from the predecessor baseline; Phase 5 activation and reachable commits are the applicable phase state.
- The preflight `.dope/` contained `architecture.json`, `smap.json` and `project-mind.json`, but no `planning-maps.json`. No controlled source or canonical architecture edit was attempted after the GUI gate failed. There is no P11 architecture or planning mutation to restore; the final Git changes are version/test/evidence work only.
- No model or provider was selected or invoked. The blocked direct workflow cannot establish provider-free usefulness.

## Direct real-GUI matrix

Environment: built `0.5.11` Theia browser application at `http://127.0.0.1:3000/#/home/jfin/dev/dope`, controlled through the actual rendered GUI. The installed older Dope process was left alone. The first browser origin had existing editor state; a second `localhost` origin was opened as a clean presentation-state check. Browser UI observations were made through accessibility trees, rendered DOM snapshots, and screenshots; screenshots were inspected but not retained as repository artifacts.

| Area | Direct observation | Decision |
| --- | --- | --- |
| A. Physical overview | Clicked **Refresh Software Map**, then **Open Physical Map**. The inspector briefly reported generation 1 **partial**, 5,207 nodes, zero violations and extensive TypeScript diagnostics, including TS2304 `Cannot find name 'Array'`. The center tab opened but stayed at **Loading Physical Map…** with an empty grid. Clicking **Fit Architecture** did not produce nodes. | **Not Green**: Systems/Subsystem overview, edges and state grammar were not observed. |
| B. Navigation/tabs | Focus, Open Selected Tab and Open Source were visible but disabled while the map was empty. Zoom controls and Up/Fit were present. No focused System/Subsystem/Component tab, cross-boundary context, source round-trip or stable selection could be proved. | **Evidence Gap**, blocked by A. |
| C. Theme/accessibility | Inspected Dope Dark and selected supported **Light Modern** through the keyboard command palette; labels and disabled controls remained visible in both. Restored Dope Dark. The command palette itself was keyboard operable. No architecture nodes were available to judge non-color semantics or essential node focus/actions; no formal accessibility claim. | **Partial observation; Evidence Gap** for map meaning and essential keyboard workflow. |
| D. Planning overlay/maps | Clicked **Planning Map**. Current only, Target only and Diff controls appeared, but **Create** and editing remained disabled. The empty canvas still said **Loading Physical Map…**. No durable map, alternative branch or overlap/conflict was created. | **Not Green**, blocked by unavailable ready Physical Map. |
| E. Typed editing | Add/move/remove/relationship/complex editor, preview/cancel/commit and undo/redo controls were disabled. | **Not exercised**. |
| F. WorkItems | No transformation or map existed, so suggestions, acceptance, split/merge, links and completion could not be exercised in the GUI. | **Not exercised**. |
| G. Bounded adoption | Adoption preview controls were disabled; no canonical diff or partial adoption was observed. | **Not exercised**. |
| H. Stale/rebase | No map existed; no controlled canonical/source edit or reanalysis/rebase was attempted. | **Not exercised**. |
| I. Implementation/reconciliation | No WorkItem existed. Ordinary implementation and fresh reconciliation/closeout could not be tied to a real Planning Map. | **Not exercised**. |

Reloading the first browser tab did not recover the map: the inspector then remained at “Analyzing or loading generation …; previous results hidden,” the canvas remained at “Loading Physical Map…,” and Create stayed disabled. Browser console also reported `Another channel with the id '/services/dope/software-map' is already open.` That console message is a symptom, not a proved root cause. The clean-origin tab did not yield an independently qualified visual loop. The initial partial analysis and persistent loader are material direct-GUI failures; no product repair or test weakening was made in P11.

## Persistence and recovery

| Required probe | Evidence |
| --- | --- |
| Process restart/reopen, different profile | Browser reload still blocked the map. A clean browser origin opened the same project but did not demonstrate Planning Map recovery. The automated restart suite passed Project Mind and Software Map cases, but failed its Electron theme case (below). No live Planning Map existed to reopen. |
| Copy project with `.dope/`, delete disposable presentation state | Not exercised directly; no Planning Map could be created. `visual-planning-storage.test.ts` contains passing reopen/copy coverage, but that is focused unit evidence, not the required direct candidate recovery. |
| Second-project isolation | Not exercised directly. Focused storage and controller tests passed project-handle and late-result guards. |
| Corrupt/future `planning-maps.json` byte preservation | Not exercised on the real project; no file was created. Focused storage tests passed corrupt/future byte-preservation cases. |
| Stale/late tab/project results | Not triggered directly. Focused navigation/UI tests passed late project response and disposal cases. |

The Git status after GUI attempts showed only the intended manifest/test changes. The repository's `.dope/` file set was unchanged in kind; `planning-maps.json` was absent. No test planning state was left behind.

## T3 commands and package

| Command/evidence | Result |
| --- | --- |
| Focused Phase 5 `node --test` across domain, storage, canvas/navigation, UI, editing, work, adoption, rebase and reconciliation | **55/55 passed**. This is lower-tier evidence and does not replace the direct GUI matrix. |
| `npm run check` after the version pin update | **Failed** in `test:baseline`: 93/93 runner tests passed, then 8/9 baseline tests passed. `pre-phase4-clean-baseline.test.ts` calls the new `packages/theia-extension/src/browser/planning-map-controller.ts` a removed Phase 3 Planning module because its filename regex also matches `planning-map-*`. The failure is retained; P11 did not narrow the guard. The aggregate command stopped before product and application builds. |
| Separate `npm run test:product` | **Passed**, 167/167 plus 16/16 tests after its extension build. |
| `npm run test:restart` | **Failed**, 2/3 passed. The first Electron test expected fallback theme `dark` but observed `dope-dark`; Project Mind and Software Map restart cases passed. This stale assertion is retained for correction. |
| `npm run build:browser` | **Passed**, frontend and backend bundles with zero build errors. |
| `npm run package:linux` (includes Electron build) | **Passed**. Electron frontend/backend/electron builds reported zero build errors. `dist/linux/Dope-0.5.11.AppImage`: mode 755, 189,863,493 bytes, SHA-256 `6c1b33450908b517f769a57b04a68ed934eb0268ca628e81fdcbe76eb30219af`. Extracted `app.asar/package.json` reports `0.5.11`; archive contains frontend/backend bundles and 91 bundled plugins. Frontend bundle contains Planning Map and Adopt Target text. |
| Native AppImage launch | With a temporary profile, backend listened on `127.0.0.1:41523`; frontend logged `ready` about 2.7 seconds after page start. An 18-second controlled timeout ended the wrapper; its surviving backend and watcher were explicitly terminated and verified absent. A file-search `spawn ENOTDIR` error was logged. Native visual planning interaction was **not** qualified. |
| Manifest/lock check | Ten live manifests and internal refs coherent at `0.5.11`; Theia `1.75.0`, Electron `42.8.1`, React `19.2.8`, React Flow `12.11.6`; no root `package-lock.json`. |
| `npm run codex:phase:validate -- p5` | **VALID**, including P11 browser-required metadata and P12 closeout routing. |
| `git diff --check` | **Passed** after writing this record; the new untracked Markdown file also produced no whitespace diagnostics under `git diff --no-index --check`. |

Local diagnostic logs: `/tmp/dope-p5-p11-{check-final,focused,product,restart,browser-build,package,native,phase-validate}.log`. These are not portable repository evidence; the results above are retained here.

## Decision and next action

**Not Green.** The direct Dope-on-Dope Physical Map never rendered a usable overview, so the required Planning Map → WorkItems → adoption → rebase → implementation → reconciliation loop and direct persistence matrix were not qualified. Aggregate and restart gates also failed, despite focused tests and package/native readiness passing. Preserve this evidence and route a bounded Phase 5 correction for the real GUI load/analysis failure and stale Phase 3/theme regression assertions, then repeat affected direct, aggregate and restart evidence on the corrected exact candidate. P12 evidence-only closeout must wait for that qualification.
