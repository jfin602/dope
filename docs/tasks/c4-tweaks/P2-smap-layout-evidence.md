# Correction 4 / P2 — sMap placement and qualification (`0.4.5`)

September 29, 2026. **P2 implementation and required qualification: Green; ready for P3 correction closeout after the implementation handoff is committed.** This is not correction or Phase 4 closeout.

## Exact predecessor and candidate

- Successful P5 handoff: `ccfd7e2c198600523c46223213e34ddf935d490d`, subject `0.4.5`; direct evidence remains `docs/tasks/p4/P5-physical-model-dogfooding-evidence.md`.
- Successful P1 / entry HEAD: `c9818479d5e8ca587762698e25c50ddbdd1ba892`, parent P5, subject `c4-tweaks/P1: Canonical sMap clean rename`. Its committed result and `.codex-runs/c4-tweaks/2026-09-29T14-55-10-318Z/run.json` record P1 `passed`, this exact commit, and P2 `browser_required`. P1's final response and retained check/restart logs were inspected.
- Branch: `main`. Entry `git status --porcelain=v1` was empty; no unrelated edits were present. Version remains `0.4.5` in all nine manifests and internal references. Node `24.21.0`, Theia `1.75.0`, Electron `42.8.1`; no root `package-lock.json`.
- Current executable candidate is the five files below on P1, unstaged and uncommitted. Its identity is **`12c0b75fe7af565f6647a68d6192c35ea5b6ea5d710222512a7dac3839fabb8b`**: SHA-256 of compact JSON `{baseHead,files}`, with the exact P1 hash and a path-sorted array of `{path,sha256}` entries below. This evidence document is excluded from that executable identity.

| Candidate file | SHA-256 |
| --- | --- |
| `package.json` | `25b4276a9466dab3ae2676edd534dad13e05b87ddc1b6bff7831e71c0ef3fd7d` |
| `packages/theia-extension/src/browser/frontend-module.ts` | `c89510173b5befebc1a0019c7a01e3cd4440815085df584fa16930ffde0c1234` |
| `packages/theia-extension/src/browser/software-map-widget.ts` | `6fae15bad1bd892245d4929065945f48645aa30337d26b55919ef2f7e36224e7` |
| `test/integration/restart.test.mjs` | `f5ad0c935f9677578356159b4464d5b19904dd15b4c0b3cee48cf5130a40b218` |
| `test/unit/smap-placement.test.ts` | `0f517df898cf2f8dbfb30641e8d9c21e6d0a50928a90d7fc5c3caa87784d0b83` |

Architecture declaration stayed SHA-256 `b2356b71e27131607e4e46f93d6a6eac5626d225a5486cde65883f31ba713928`; Project Mind stayed `276e6c651603f03f09f5faf0c5181ae70b31fe5ebb69645483fbfadfd2f1b2a2`. No graph, analyzer, controller, backend, query, rule, ownership identity, canonical storage or architecture declaration behavior changed.

## Placement inspection and implementation boundary

P1's widget/factory ID was already `dope-software-map`; command `dope.softwareMap.open`, label `Dope: Show Software Map`. `SoftwareMapView` was registered once through `bindViewContribution`, with `defaultWidgetOptions.area = right`, no rank, no icon and no frontend layout contribution. There was no separate view-container factory and no explicit sMap shell add/move call. The obsolete factory/command were already retired by P1. Project Mind retained its own contribution/factory; Explorer and editors remained Theia application dependencies.

Inspected installed Theia 1.75.0 `AbstractViewContribution`, frontend layout lifecycle, WidgetManager, shell and layout restorer, plus Explorer's supported contribution pattern. `openView()` adds only an unattached widget with its default options; an attached/restored widget is not moved. `onDidInitializeLayout` runs after default or restored layout. The restorer catches missing factories and drops obsolete widget descriptions.

The correction uses those supported APIs directly: one existing widget/view, default `left`, rank `200` (Explorer is `100`), title `sMap`, caption `sMap — Software Map`, built-in `type-hierarchy` icon, and one frontend lifecycle binding that calls `openView()` without activation. There is no forced move, private shell mutation, extra container, layout migration or fake chat surface. Activation now focuses the widget's existing keyboard-focusable node; Tab reaches Analyze. A leftover no-project status sentence now says Software Map and is guarded against the obsolete wording. Project Mind wiring/default and Explorer/editor dependencies are preserved.

The Physical Map core owns contracts/graph/rules, the analyzer emits evidence, the index owns rebuildable per-root state, and the backend owns validated project handles. This change is confined to their Theia presentation adapter and qualification tests.

## Direct browser qualification

Agent-operated direct clicking, keyboard typing, scrolling/resizing, source navigation and screenshot observation used the Codex in-app browser and actual browser-hosted Dope on `/home/jfin/dev/dope`. Automated Electron/CDP tests below are separate evidence.

Clean/default origin: `http://127.0.0.1:3036/#/home/jfin/dev/dope`, fresh `THEIA_CONFIG_DIR=/tmp/dope-c4-p2-clean-profile`, no existing layout/settings at entry. Backend: `node apps/browser/src-gen/backend/main.js /home/jfin/dev/dope --hostname=127.0.0.1 --port=3036 --plugins=local-dir:/home/jfin/dev/dope/plugins`. Accepted repository trust for the requested qualification. No provider was configured. The initial theme was Dark (Theia). The ordinary sidebar divider was widened for long diagnostics/evidence; this is presentation state.

| Required observation | Direct result |
| --- | --- |
| Dedicated Activity Bar button | Built-in hierarchy icon visible on the left before issuing an sMap command. Clicking it opened `SMAP` / Software Map; rendered tab caption was `sMap — Software Map`. |
| Left primary sidebar | AX tree placed `dope-software-map` inside `theia-left-content-panel`; screenshots showed its inspector left of the center workspace. |
| Usable center editor | Import evidence opened real `packages/software-map/src/graph.ts` in the center, at line 1, column 47. Ctrl+F and typing `ownershipForPath` found two matches, including `24:23`, without editing source. |
| Right sidebar | No sMap content/entry on the right. The stock secondary sidebar was collapsed; no chat panel was added or needed. |
| Analyze / Refresh | Click produced visible pending generation 1 with old results hidden, then `Generation 1 · partial · 1635 nodes · 0 violations`. Keyboard refresh after builds settled produced generation 2, partial, 1720 nodes, zero violations. |
| Hierarchy | Selected Physical Map System (`physical-model`) → Software Map core Subsystem (`model-core`) → Physical graph Component (`physical-graph`) → graph.ts file/module. Module detail showed assigned ownership `physical-model / model-core / physical-graph`. |
| Dependency/evidence navigation | Component Physical graph → Architecture declaration aggregate had three physical origins. Opened originating edges, inspected direct graph.ts → architecture.ts import, then clicked semantic `graph.ts:1:47` to source. Also selected the module and inspected its direct import. |
| Honest diagnostics/violations | Visible partial-analysis notice, fixture unknown `mystery`/missing import, test typing diagnostics, CSS and Node built-in resolution limits. Separate unassigned tree; zero declared violations rendered explicitly. No complete-map claim. |
| Keyboard | Command-palette typing/Enter activated sMap; Tab focused Analyze; Enter refreshed. Enter expanded the graph.ts native disclosure. Source search also worked. |
| Dark and explicit light | Screenshots assessed dark/default controls, source and evidence, then selected Preferences: Color Theme → Light (Theia). Light hierarchy, diagnostics, evidence/origin controls and center source remained readable, with visible focus outlines. |
| Restart/reopen | Left inspector, widened sidebar, light theme and graph.ts center editor restored. sMap was initially idle; keyboard Analyze rebuilt generation 1, partial, 1720 nodes, zero violations. Reopened the three physical origins and clicked `graph.ts:1:47` back to the editor. No obsolete view or right relocation appeared. |

The first analysis overlapped build-support changes; settled analysis and restart included `.browser_modules/drivelist` inputs and 31 unassigned roots. Counts describe the observed inputs, not analyzer completeness or a deterministic count across differing generated inputs. The representative settled dependency/origin path was replayed after process replacement.

Before backend replacement, navigating the same tab to `about:blank` saved its layout. Stopped owned backend PID `33390` with SIGTERM, relaunched the identical command/profile/origin, and navigated the same tab back. Idle after restart and successful rebuilding prove useful restoration without persisting the derived graph.

### Separate existing-profile / legacy-layout transition

Opened the former P5 origin `3035` with its existing `/tmp/dope-p5-profile`, separately from the clean/default proof. Its saved light theme remained. The actual old saved layout attempted `dope-software-model`; Theia logged `No widget factory 'dope-software-model' has been registered`, discarded it and successfully restored the remaining layout. Its old `packages/software-model/src/graph.ts` preview was also discarded as an invalid path after P1's rename. The dedicated canonical icon was present, and clicking it opened one usable left sMap surface in idle state, with no legacy right-side ghost. No canonical data was migrated; the operator's personal desktop profile was not reset.

## Permanent guards and integration

`smap-placement.test.ts` is in `test:baseline`. It positively requires the stable canonical identity, one view/lifecycle/factory registration, sMap label/icon, left/rank default, supported post-layout opening, activation focus, and preserved Project Mind/Explorer/editor wiring. It rejects current right attachment, obsolete registrations and the leftover UI wording. The existing terminology and negative Planning guards remain active.

Expanded the existing real Electron Software Map restart case. It checks one canonical tab, actual shell area `left`, icon/label, no legacy factory/view on fresh launch and restart; rebuilds/reanalyzes source and declaration with evidence/violation checks; and proves a second root has only its own unassigned implementation. A supported user move to `right` survives process restart, proving startup is not a placement lock. A synthesized saved old right-side factory is rejected by the real restorer; the next launch has one left canonical entry and no ghost. The real P5 profile supplies independent direct legacy evidence.

All three integrated restart cases passed: Theia state/extension, Project Mind restart/recovery/isolation, and Software Map restart/reanalysis/placement. Four permanent controller tests passed for late attach/query, analysis completed during attach, late aggregate origins after root switch, and stale generation/disposal. There is no claim of a new direct pending-analysis root-switch race injection.

## Corrected package

Built with `npm run package:linux` on the corrected product source at unchanged `0.4.5`, existing dependency/plugin caches, and P5's extracted native build sysroot. No Theia/Electron upgrade or new dependency was introduced.

- Artifact: **`/home/jfin/dev/dope/dist/linux/Dope-0.4.5.AppImage`**, x86-64, mode **755**, **189,203,893 bytes**.
- SHA-256: **`1ff4846b9d19c6f34928dc0f79e928b617e7e26c5bad6e5f009a1e960af35fea`**.
- Extracted `Dope.desktop`: `Name=Dope`, `Exec=AppRun %U`, `X-AppImage-Version=0.4.5`. Embedded `resources/app.asar/package.json`: `@dope/electron`, `0.4.5`.
- Canonical `@dope/software-map@0.4.5` is the extension dependency and build input; workspace link and renamed frontend/backend modules resolve to it. Product packages are bundled, not loose package manifests inside the archive. Embedded frontend contains canonical widget/command, sMap label, hierarchy icon, Analyze and origin controls; backend contains renamed `/services/dope/software-map`, map handle/query/analysis errors and architecture-rule code. No live legacy package, factory, command, RPC path or SoftwareModel/PhysicalSoftwareModel symbol occurs in those bundles.
- Extracted frontend/backend/Electron entrypoint/packaged entrypoint bytes match the exact built candidate, including after final full validation. Frontend bundle SHA-256 `c8bb3ac10bb9d46414b803f370d464dd4e3cfd488dcc82aa3d8bc16d4802e67b`; backend `a1dad7fc44be3142ca5da2d2d808aa0c74f659980aa3dfd42539fcdcc1587673`. Native and shell-integration resources plus **91** plugin directories are present.
- Launched this exact AppImage with only the Dope repository argument, isolated `XDG_CONFIG_HOME` and `THEIA_CONFIG_DIR` under `/tmp/dope-c4-p2-native-z1z8235i`. No caller-supplied sandbox/GPU/debugging flags. Process `41574`, native window `0x03000004`; logs reached frontend `ready`. Controlled window close exited **0**. Native source/inspector interaction and full plugin activation were not directly qualified; direct GUI workflow above uses browser Theia.

This replaces the pre-correction P4 `0.4.4` artifact as the P2 package evidence; P4 history is preserved.

## Checks, failures and limits

Passing checks:

- Terminology/placement guards **2/2**; focused Software Map/analyzer/index/backend/controller plus guards **17/17**.
- Final `npm run check`: typecheck, runner **93/93**, baseline **6/6**, product **38/38**, IDE **1/1**, browser/Electron builds, zero build errors.
- `npm run test:restart`: **3/3** with the expanded placement, customization and legacy cases.
- `npm run codex:phase:validate -- c4-tweaks`: **VALID**.
- Nine manifests/internal references unchanged `0.4.5`, Node 24, Theia 1.75.0, Electron 42.8.1, no root lockfile; `git diff --check`; archive/content/version checks.

The first full check failed rebuilding native-keymap because the task's pkg-config search included the extracted library directory but omitted `usr/share/pkgconfig` (`xproto`/`kbproto` missing). Retried with both extracted directories and `PKG_CONFIG_SYSROOT_DIR`; retry and final full check passed. No product change was required. An initial archive-inspection probe used the wrong desktop-file capitalization and expected the dynamically constructed icon class as a literal in minified JS; corrected inspection checks the real `Dope.desktop` and icon input, then passes. One extraction invocation specified its not-yet-created working directory; creating that task-owned directory resolved it.

Observed nonfatal messages: ordinary unsupported-plugin/build peer warnings; native parcel-watcher `fs.Stats` deprecation through an ERROR channel; on controlled native shutdown, `spawnSync ps ENOTCONN` from ProcessManager cleanup and an unregistered-process warning. Native ready/controlled exit 0 were observed despite these messages; they are retained rather than described as a warning-free launch. No product repair beyond placement, focus and the stale status wording occurred. Those presentation changes have permanent guards and were included in the tested/browser-qualified/packaged source.

Graph/query/rule semantics were not changed, so P5's controlled real-repository violation/removal and pending-switch evidence were not claimed as directly rerun. Current automated source/violation/reanalysis and isolation checks did rerun. Existing partial coverage, cached-host build, fresh-install/cross-distribution gaps and historical Phase 1/2 dispositions remain. No Phase 5 canvas, Planning Map editing, graph renderer/layout library, AI/provider/Agent Mind/runtime/delegation or session feature was added.

Local supporting logs/inspection/identity records: `/tmp/dope-c4-p2-evidence/` (`check.log`, `check-retry.log`, `check-final.log`, `focused.log`, `guards-final.log`, `restart.log`, `phase-validate.log`, `coherence.log`, `browser*.log`, `package.log`, `package-inspection-final.json`, `native.log`, `candidate-identity.json`). These are local, not portable repository artifacts; the observations and exact identities are retained here.

## Git handoff

Post-task HEAD remains exact P1 `c9818479d5e8ca587762698e25c50ddbdd1ba892`. Intended post-task porcelain state is exactly:

```text
 M package.json
 M packages/theia-extension/src/browser/frontend-module.ts
 M packages/theia-extension/src/browser/software-map-widget.ts
 M test/integration/restart.test.mjs
?? docs/tasks/c4-tweaks/P2-smap-layout-evidence.md
?? test/unit/smap-placement.test.ts
```

No staging, commit, push or version bump was performed. The runner/operator owns the implementation handoff commit. P3 must audit that resulting exact committed candidate, this corrected package and direct matrix before deciding correction closeout; Phase 4 P6 still follows successful correction closeout.
