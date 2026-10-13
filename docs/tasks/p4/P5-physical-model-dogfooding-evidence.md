# P5 — Direct Dope-maps-Dope dogfooding (`0.4.5`)

September 29, 2026. **P5 direct workflow: Green. P6 may proceed after this handoff; Phase 4 is not yet Qualified.** This record distinguishes direct workbench interaction from supporting executable checks and inherited package evidence.

## Candidate and surface

Exact pre-task HEAD / successful P4 predecessor: `99222692201b24ebaf6b3ec5014a93100aefd936` (`0.4.4`), on `main`. `git status --porcelain=v1` was empty; there were no unrelated user changes. P3 `434e272a0dc66c35a4166a235b5cd815237edd41`, P2 `e36a123e46ccddb0fb08ec48d44860affb99308b`, P1 `d36e2dda72da0544690443dc483a8015aa2a621d`, and activation `93a2b3152066029d28dabf73e5672e0663599e22` are reachable. All nine manifests, internal references and baseline assertions were coherent `0.4.4` at entry.

Direct interaction used the real Theia browser application built from that committed source, in the Codex in-app browser at `http://127.0.0.1:3035/#/home/jfin/dev/dope`. Backend command: `THEIA_CONFIG_DIR=/tmp/dope-p5-profile node apps/browser/src-gen/backend/main.js /home/jfin/dev/dope --hostname=127.0.0.1 --port=3035 --plugins=local-dir:/home/jfin/dev/dope/plugins`. The isolated profile had no model provider configured. Theia `1.75.0`, Electron `42.8.1`, TypeScript `5.9.3`, Node `24.21.0`; 91 prepared plugins. This was agent-operated, direct clicking, keyboard typing, folder dialogs, source-editor navigation and screenshot observation through computer use. It was not a human-operated session and did not substitute hidden service calls or CDP assertions for the direct matrix.

Read scope included BOOT, Phase 4 activation/assessment/implementation plan and P1–P6 prompts, relevant product/architecture/stability/workflow authority, ADR-0007, historical p0/p1/p2/p3/c3 closeouts, P4 restart/package evidence, the current declaration, P1–P4 implementation and focused tests. The model core owns graph/query contracts; the TypeScript adapter emits source evidence; the index owns rebuildable per-root state; the backend owns validated project handles; the inspector projects queries and delegates editor navigation to Theia. No product/domain source depends on the presentation substrate, and this task adds no future runtime/planning capability.

Canonical declaration: `.dope/architecture.json`, SHA-256 `d63c412ef2876caf99b071fb288cca172b9afbc32b0397d3bd68e2b56db34a80`. It was never edited, moved or removed. `.dope/project-mind.json` remained SHA-256 `276e6c651603f03f09f5faf0c5181ae70b31fe5ebb69645483fbfadfd2f1b2a2`.

## Direct matrix and traceability

Opened **Dope: Show Software Model** by typing in the command palette and pressing Enter. Initial inspector said **Ready to analyze. No derived graph is loaded.** Clicking Analyze showed **Analyzing or loading generation 1; previous results hidden**, followed by **Generation 1 · partial · 1696 nodes · 0 violations**. The same baseline returned after probe cleanup and backend restart. There were 29 unassigned file roots. These are observed UI counts, not a claim that every node or edge was reviewed.

| Required workflow | Direct observation |
| --- | --- |
| System / Subsystem / Component | Selected Physical Software Model (`physical-model`), Model core (`model-core`) and Physical graph (`physical-graph`); read identity, purpose and ownership. Tree showed all four Subsystems: Model core, Source analysis, Model inspector, Model transport. Five Components: Architecture declaration, Physical graph, Model index, Inspector view, Model backend. |
| Three boundaries | Selected file/module nodes for `packages/software-model/src/graph.ts`, `packages/code-analysis/src/node/model-index.ts`, and `packages/theia-extension/src/browser/software-model-widget.ts`. Ownership was respectively `physical-model / model-core / physical-graph`, `physical-model / source-analysis / model-index`, and `physical-model / model-inspector / inspector-view`. |
| Three physical relationships | Inspected the imports listed below and clicked their semantic source-evidence buttons. The ordinary source editor opened the actual imports at the advertised locations. |
| Aggregate provenance | Baseline Component Physical graph → Architecture declaration reported three originating physical edges. Controlled Subsystem Model inspector → Model core reported two originating physical edges; both were opened through **Show originating physical edges**, with source evidence below. |
| Source navigation | Evidence clicks opened `graph.ts`, `model-index.ts`, `software-model-widget.ts`, and the violation probe in ordinary Theia editors. Screenshot/status observations confirmed line/column and visible import text. |
| Unassigned source | Selected real `packages/contracts/src/project-mind.ts`: **Ownership: unassigned**, under the separate unknown/unassigned tree, without invented System/Subsystem membership. |
| Status/refresh | Explicit generation/completeness/diagnostics; prior graph hidden during analysis; source edits and cleanup reflected without restarting. |
| Keyboard/themes | Command palette typing/Enter, native file disclosure Enter, Analyze button Enter, keyboard folder dialog, and theme selection. Fresh profile used dark default; explicit **Light (Theia)** was readable. Screenshots assessed hierarchy, evidence controls, origin drilldown and ordinary editor. |

Precise inspected imports (all semantic evidence produced by `@dope/code-analysis-typescript`):

| Source module | Target | Source evidence |
| --- | --- | --- |
| `packages/software-model/src/graph.ts` | `packages/software-model/src/architecture.ts` | `graph.ts:1:47` |
| `packages/code-analysis/src/node/model-index.ts` | `packages/code-analysis/src/node/architecture-file.ts` | `model-index.ts:7:34` |
| `packages/theia-extension/src/browser/software-model-widget.ts` | `packages/theia-extension/src/browser/software-model-controller.ts` | `software-model-widget.ts:9:58` |

Module identities use `code:module:` plus the URI-encoded relative path (for example `code:module:packages%2Fsoftware-model%2Fsrc%2Fgraph.ts`). The baseline Component aggregate was backed by the graph→architecture import at `1:47`, reference to `ownershipForPath` at `24:23`, and reference to `projectPath` with spans `13:24`, `31:35`, `58:13`. The lower-level relationships and their source locations are useful explanations of the aggregate, not an invented inferred dependency.

Diagnostics were intentionally visible and completeness stayed **partial**. Observed examples: fixture `missing.ts` unknown `mystery` / unresolved `./absent`, fixture `@lib/base` and `@shared`, test type errors, CSS imports, Node built-ins and `.browser_modules/drivelist` build-support sources. P4's recorded 1666-node pass and this 1696-node pass differ with available build-support inputs; identical node count across different local generated inputs is not asserted. The UI did not disguise partial coverage as a complete architecture proof.

## Controlled violation and independent relationship change

Both following paths were absent before creation and completely deleted after the exercise. The committed declaration and existing source bytes were unchanged.

Violation probe, `packages/software-model/src/p5-temporary-violation.ts`:

```ts
import { SoftwareModelController } from '../../theia-extension/src/browser/software-model-controller';
export const p5TemporaryViolation = SoftwareModelController;
```

Independent allowed relationship probe, `packages/theia-extension/src/browser/p5-temporary-relationship.ts`:

```ts
import { projectPath } from '../../../software-model/src/architecture';
export const p5TemporaryRelationship = projectPath;
```

Refresh published **generation 2 · partial · 1702 nodes · 1 violation**. Clicked **forbidden-dependency: model-core → model-inspector (2 physical edges)**. Detail showed rule `forbidden-dependency`, source `model-core`, target `model-inspector`, and offending direct import to `software-model-controller.ts` at **p5-temporary-violation.ts:1:41**, plus reference to `SoftwareModelController` at **2:37**. Clicked the import evidence; the ordinary editor showed the exact import at line 1, column 41. Rule authority is `model-core.forbiddenDependencies: ["model-inspector"]` in the unchanged declaration. Extra TS6059 rootDir diagnostics from this deliberately invalid product source were observed and are part of the bounded probe.

Selected **Model inspector** and opened its **Model inspector → Model core (2 physical edges)** aggregate. Origin drilldown showed the allowed probe's direct import to `packages/software-model/src/architecture.ts` at **1:29**, and reference to `projectPath` at **2:40**. This directly fulfills the Subsystem aggregate check on the actual Dope project under the recorded temporary state. It is not presented as a baseline package-import edge.

Deleted the violation probe and changed the separate relationship probe to `export const p5TemporaryRelationship = 1;`. Refresh, without process restart, published **generation 3 · partial · 1699 nodes · 0 violations**. Model inspector still owned the remaining probe file, but its cross-Subsystem aggregate dependencies were absent; the forbidden violation and stale reverse dependency were gone. Deleted the remaining probe, then used keyboard Analyze: **generation 4 · partial · 1696 nodes · 0 violations**. Git was clean again before handoff edits. The deleted probe's open editor briefly displayed `(Deleted)` and was closed without saving or recreating the source.

## Declaration errors, project isolation and restart

Disposable root `/tmp/dope-p5-second-project` contained `tsconfig.json` including `src/**/*.ts`, and `src/second.ts` with `export const secondProjectOnly = 45;`. With no declaration, direct Analyze returned **generation 1 · complete · 3 nodes · 0 violations**, **No .dope/architecture.json declaration. Analyzed implementation remains unassigned**, **No declared Systems**, and one unassigned file root. No Dope System, probes or violations appeared.

Created only that disposable root's `.dope/architecture.json` with malformed bytes `{` (SHA-256 `021fb596db81e6d02bf3d2586ee3981fe519f275c0ac9ca76bbcf2ebb4097d96`). Direct Refresh returned **Analysis failed at generation 2**, diagnostic **Invalid architecture declaration: malformed JSON**, and no old graph. Analysis left the invalid file bytes untouched. Removed that malformed probe back to the initial missing declaration; Refresh returned **generation 3 · complete · 3 nodes · 0 violations**. Selected `src/second.ts`, read unassigned ownership and syntax evidence **1:1**, and clicked it to the ordinary editor showing `secondProjectOnly`.

The default folder dialog first opened a second tab. Set `workspace.preserveWindow` through the isolated profile's ordinary Settings UI, then used File Open / keyboard folder dialog to switch **within that same tab**: second root → Dope → second root → Dope. Theia's standard folder switch reloads the workbench document; this was not an injected hot-root switch. Dope showed its own **generation 4 / 5 · partial · 1696 nodes · 0 violations**; the second root showed only its own error or three-node recovered model. No cross-project graph or late cross-project rendering was observed. For an additional pending-analysis switch, added an absent-before, temporary `packages/software-model/src/p5-temporary-isolation.ts` containing `export const p5IsolationOnly = 45;`. After the final build, clicked Analyze and directly read **Analyzing or loading generation 2; previous results hidden**, then requested the folder switch to the second root. Folder operations were delayed while the analyzer worked; a repeated shortcut queued overlapping Open dialogs, resolved using the current visible dialog. On the second root, the inspector was initially idle (fresh backend state for this root after restart), then Analyze published **generation 1 · complete · 3 nodes · 0 violations**, with only `src/second.ts`, no declared Systems and no Dope sentinel. Returning to Dope showed completed **generation 2 · partial · 1699 nodes · 0 violations**, including the isolation file solely in Model core. Deleted that exact sentinel and directly observed the next refresh return **generation 3 · partial · 1696 nodes · 0 violations**, with no temporary file remaining. The switch was requested from a visibly pending analysis, but backend completion timing relative to the workbench reload was not instrumented. Artificial delayed replies were not injected: permanent controller tests separately verify late attach/query, late aggregate origins, stale generation and disposal rejection. Direct root switching and these tests are distinct evidence.

Stopped the original browser backend (PID 6346, original session exit 143 from requested SIGTERM), relaunched the same command, port, repository and `THEIA_CONFIG_DIR`, and reloaded the same browser tab/origin. Explicit light theme remained. Reopened the inspector through the command palette; it showed **Ready to analyze. No derived graph is loaded**. Keyboard Analyze rebuilt **generation 1 · partial · 1696 nodes · 0 violations** with the same four Subsystems and Components. Expanded graph.ts with Enter, selected its module, confirmed assigned ownership and the graph→architecture import, and clicked **graph.ts:1:47** to the ordinary editor (line 1, column 47). This proves useful equivalent state after rebuilding; it does not claim the derived graph persisted or that inspector layout automatically restored.

## Failures, limits and repairs

No bounded product defect requiring implementation repair was exposed; no product source or new tests were added. Existing permanent tests cover the exercised defect classes. There was no audit-only waiver.

The map remains partial. Bare `@dope/*` imports resolve to built declaration files outside the included source set, so a baseline cross-package source dependency was not fabricated. Subsystem aggregate provenance was directly exercised using the allowed source probe above; baseline Component aggregation was separately inspected. This is a useful current coverage limit for P6, not evidence of a complete package-level map. Long diagnostic/relationship lists require scrolling and widening the side panel; dark/light controls remained readable. Idle status includes an `index-failure — Analysis has not run` diagnostic; during invalid-declaration recovery, old diagnostics remain while prior graph results are explicitly hidden until new publication. Nonfatal Theia unsupported-plugin activation warnings and a widget-focus timeout were logged; direct operations succeeded.

The GUI surface was browser Theia, not a new native AppImage GUI dogfooding pass. P4 retains the native/package evidence. No fresh dependency installation, other distribution, framework upgrade, model/provider, target graph, planning, delegation or mutation-runtime qualification is claimed. Historical Phase 1/2 Not Qualified gaps remain unchanged.

## Validation, package coverage and Git handoff

After Green direct qualification, advanced root plus all eight app/package workspaces, all internal `@dope/*` references and baseline assertions to **0.4.5**. The only intended edits are those nine manifests, `test/unit/theia-baseline.test.ts`, and this evidence file. All product source, architecture/project knowledge, Theia pins and `yarn.lock` remain unchanged.

Final checks on the 0.4.5 candidate all passed:

- Focused software-model/analyzer/index/UI tests: **15/15**, both before handoff edits and on the final candidate (`focused-pre.log`, `focused-final.log`).
- `npm run check`: typecheck, runner **93/93**, baseline **4/4** (including the permanent negative Planning wiring guard), product **38/38**, IDE **1/1**, browser and Electron builds (`check.log`).
- `npm run test:restart`: **3/3**, real Electron restart/extension, Project Mind restart/recovery/isolation, and Software Model rebuild/reanalysis (`restart.log`). These automated cases supplement the direct GUI pass.
- `npm run codex:phase:validate -- p4`: **VALID** (`phase-validate.log`).
- Nine manifests/internal references **0.4.5**, Theia **1.75.0**, Electron **42.8.1**, no root `package-lock.json`, activation/predecessor reachability, no product-source or `yarn.lock` diff, and `git diff --check`: passed.

The host lacked X11/xkbfile development pkg-config metadata and the former P4 temporary sysroot was absent. Downloaded official Ubuntu development/runtime .deb prerequisites and extracted them, without system installation, to `/tmp/dope-p5-build-deps/root`; used `PKG_CONFIG_SYSROOT_DIR` and `PKG_CONFIG_LIBDIR` for the full check. x11 1.8.7 / xkbfile 1.1.0 metadata was verified. This build reused the existing dependency/plugin caches; it is not a fresh-install qualification. No failed final build or product repair occurred. Logs are retained locally under `/tmp/dope-p5-evidence/` (not portable repository artifacts).

The exact P4 artifact remains `dist/linux/Dope-0.4.4.AppImage`, mode 755, 189204228 bytes, SHA-256 `f4827a456e56a481323a68939ea9ef7864990ebd43de871e0175e9494d0d4d27`. P4's restart/native-launch/package inspection covers identical product implementation and declaration. P5 changes version metadata, a test assertion and this record; no replacement package is needed for a product repair. This does **not** establish an exact 0.4.5 AppImage or repeat the native launch under the new version.

Pre-handoff cleanup produced an empty Git status and unchanged declaration/project-mind/package hashes. The manual, non-runner handoff creates exactly one commit with subject `0.4.5`, parent `99222692201b24ebaf6b3ec5014a93100aefd936`, containing exactly the eleven intended files above, and checks an empty post-commit porcelain status. Its self-referential hash cannot be embedded in this commit; the exact resulting commit hash and observed post-commit status are supplied in the final operator report. No push is requested or performed. P6 eligibility depends on this Green evidence and successful final checks; Phase 4 qualification remains a P6 decision.
