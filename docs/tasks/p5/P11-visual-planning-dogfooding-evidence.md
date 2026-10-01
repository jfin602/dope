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

## Rerun on the accepted Adaptive SEO copy — 2026-10-01

**Decision: Not Green. P12 remains ineligible.** This section appends a new attempt; the preceding failed Dope-on-Dope attempt remains historical evidence.

### Identity and fixture preflight

- Exact Dope source candidate: clean `main` at `59cfd12b6ab609e8c99aa32d716a905479bb6543`, package `0.5.11`. Reachable P1–P10 predecessor is `97b92e2f6d0a38297d24fdeff33e389207adecc8` (`0.5.10`); its ten ordered implementation commits are `18697c9`, `7bcb17c`, `8e8b9c4`, `feb7742`, `5330266`, `9aa3d41`, `76ecac2`, `d190c6f`, `3b7d570`, `97b92e2`. The existing P11 version/test/evidence commit `502416e` and later correction commits are retained. BOOT/AGENTS still describe the older pause; the reachable correction closeout, accepted fixture, and current P11 prompt govern this rerun.
- Read Phase 5 activation/plan/worksheet, ADR 0017, prompt assessment/implementation plan, P1–P10 results, current source/tests, stability/workflow authority, and prior Phase 4/package records. All ten live root/app/package manifests and internal `@dope/*` references are `0.5.11`; Node `24.21.0`, Theia `1.75.0`, Electron `42.8.1`, React `19.2.8`, canvas `@xyflow/react` `12.11.6`; no root `package-lock.json`.
- Primary mapped fixture: `/tmp/adaptive-seo-dope-p11`, Git HEAD `0b26a25107be7d8dfb2210bc7258ccac8603197e`, status `?? .dope/` and `?? MODULES.md`. Its `.dope/` contains `architecture.json` (4,688 bytes) and `smap.json` (122 bytes), with no `planning-maps.json`. Their SHA-256 values, `b5a09a50397149f589a80c2f9987ec66c0023a85c75ad98b4a973ebd1d370208` and `b35801cb0d6ea2100c7fa47c28f2e75b186dab8ff9fae28cdf7fff446b4bc583`, match the accepted `/home/jfin/dev/adaptive-seo-dope` reference before and after this attempt. The declaration contains Adaptive SEO Service and Customer Site Feed Runtime with their Subsystems; the marker fingerprint matches the declaration. An accepted file alone was not treated as a usable canvas.
- No source, canonical, Planning Map, adoption, rebase, corruption, or recovery mutation was made to either Adaptive SEO tree. The disposable copy is left intact for a corrected rerun; there are no destructive probes to restore. The accepted reference remains unchanged. Dope source was unchanged until this evidence append.

### Direct GUI matrix on `/tmp/adaptive-seo-dope-p11`

In the real Theia browser workbench at `127.0.0.1:3000`, the sMap Activity Bar opened the left inspector. **Refresh Software Map** produced generation 1, **partial**, 3,459 nodes, zero violations, and a hierarchy showing the accepted Systems and Subsystems. The partial TypeScript analysis included extensive diagnostics such as TS2304 `Cannot find name 'Array'`; partial analysis is reported honestly and is separate from the canvas failure. **Open Physical Map** opened a center tab, but it remained at **Loading Physical Map…** with an empty grid. A second clean browser origin (`localhost:3000`) showed the same loader. Both origins logged `Another channel with the id '/services/dope/software-map' is already open.` The current frontend binds a singleton Software Map proxy at `frontend-module.ts:53` but creates another proxy for each Physical Map widget at line 71; this wiring is consistent with the observed channel error, though this attempt did not repair and retest it.

| Area | Rerun observation |
| --- | --- |
| A. Physical overview | **Not Green**: accepted hierarchy was visible in the inspector, but no System/Subsystem canvas nodes, edges, state grammar, or working Fit Architecture appeared. |
| B. Navigation/tabs | Focus, selected-tab and source actions were disabled without rendered nodes. Zoom/Up/Fit controls appeared; semantic navigation, shared focused tabs, cross-boundary context, and source round-trip were not exercised. |
| C. Theme/accessibility | Dope Dark and Light Modern were directly inspected on the Dope host workbench, with editor, left sMap inspector, and right Project Mind legible; Dope Dark was restored. The blocked Adaptive SEO canvas prevented checking map meaning or essential keyboard node actions. No accessibility certification claim. |
| D. Planning overlay/maps | Clicking **Planning Map** exposed Current only, Target only, Diff and map controls, but the canvas still showed **Loading Physical Map…**. No map or branch was created because the required usable Physical Map prerequisite failed. |
| E. Typed editing | Not exercised; no usable target canvas. |
| F. WorkItems | Not exercised; no real Planning Map/transformation. |
| G. Bounded adoption | Not exercised; no canonical diff or mutation fabricated. |
| H. Stale/rebase | Not exercised; no controlled canonical/source change made. |
| I. Implementation/reconciliation | Not exercised; no WorkItem or fresh intent-versus-outcome loop existed. |

The Dope host workspace opened `BOOT.md` in an ordinary center editor while Project Mind loaded in the right secondary sidebar (`Saved · revision 35`) and sMap loaded in the left primary sidebar. This verifies those visible host surfaces, not the blocked Adaptive SEO visual loop.

### Persistence, regression, and package evidence

- Direct Planning Map restart/profile/copy recovery, disposable-presentation-state removal, second-project planning isolation, corrupt/future `planning-maps.json` byte preservation, and stale/late tab-result probes were **not exercised**: no Planning Map was created. The clean `localhost` origin reproduced the loader; it was not a separate application profile or restart qualification. Existing focused storage/UI tests are lower-tier evidence, not a substitute for the requested direct matrix.
- Focused P5 `node --test` across ten domain/storage/canvas/navigation/editing/work/adoption/rebase/reconciliation files: **55/55 passed**. `npm run test:product`: **172/172 plus 22/22 passed**.
- `npm run check`: typecheck and runner **93/93 passed**, then baseline **9/10 passed** and stopped. `pre-phase4-clean-baseline.test.ts` still treats current Phase 5 `planning-map-controller.ts` as a forbidden removed Phase 3 module because its filename regex matches `planning-map-*`. No test was weakened in P11.
- `npm run test:restart`: **2/3 passed**. Project Mind and Software Map restart cases passed; the Electron theme case still expected `dark` and observed `dope-dark`. This remains a failed assertion, not a Green restart matrix.
- `npm run build:browser` passed with zero browser/backend build errors. `npm run package:linux` passed, including Electron frontend/backend/electron builds with zero build errors. Fresh `dist/linux/Dope-0.5.11.AppImage`: x86-64 ELF, mode 755, 189,876,045 bytes, SHA-256 `b6fb0e6cc5ea1e2d4693c2a9302d6986fc6efb6f770548ac6578ca71516a9f4e`. Extracted `app.asar/package.json` reports `@dope/electron 0.5.11`; frontend/backend bundles and 91 plugins are present.
- Fresh native AppImage launch with temporary profile `/tmp/dope-p11-native-J5Yrxt` listened on `127.0.0.1:35101` and logged frontend `ready` about 2.8 seconds after page start. A file-search `spawn ENOTDIR` error was logged. The first wrapper termination left child processes; they were explicitly terminated, and no matching process or listener remained. Native visual interaction was not qualified.
- `npm run codex:phase:validate -- p5` was **VALID**; `git diff --check` and the no-root-lock check passed before this append. Local command logs are `/tmp/dope-p5-p11-rerun-{check,product,focused,restart,browser-build,package,native,phase-validate}.log` and do not replace this portable result record. Screenshots were inspected live but not retained as repository artifacts.

The usable Physical Map prerequisite remains **Not Green** on the accepted Adaptive SEO copy. The duplicate-channel/loader failure and the aggregate/restart assertions require bounded correction and invalidated-evidence rerun before the A–I visual loop, direct persistence/recovery matrix, and P12 closeout can be qualified.
