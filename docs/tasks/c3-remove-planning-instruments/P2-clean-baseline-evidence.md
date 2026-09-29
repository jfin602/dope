# Correction 3 / P2 — Clean baseline qualification evidence

Qualified for this correction's P2 scope on September 28, 2026 (browser actions September 29 UTC). Version remains **0.3.6**. P3 must still make the manual correction gate decision; this record does not activate Product Phase 4.

## Exact source and preflight

- Assessment/plan baseline: `68a51e78233f0a81bf295fb06e591fb508149bf0`, reachable ancestor of current HEAD.
- Correction stack authority/pre-P1 source: `5c5ac0c6edf5355c5234e48972494edef37d06f3`.
- Exact successful P1 predecessor and P2 pre-task/current HEAD: `63b2492d29299b2521c1ce3919ca646c3f0b6e18`; tree `6517e21c8c2a5d127e1784cccd05f41f20989310`.
- P1 runner record: `.codex-runs/c3-remove-planning-instruments/2026-09-29T01-25-21-706Z/run.json`, P1 `status=passed`, same `commitSha`. Its `P1.final.txt` and commit result explicitly retain the incomplete aggregate Electron native rebuild due to missing X11/XKB development metadata. P1's final surviving restart evidence passed 2/2. P2 supplies fresh aggregate and package evidence below.
- P2 candidate is the uncommitted working tree on that HEAD: modified `package.json`, new `test/unit/pre-phase4-clean-baseline.test.ts`, and this evidence file. No product source repair or version change. No staging or commit was performed.
- Exact implementation blobs (`git hash-object`): `package.json` = `ddcaeb16acc66395d9510e1f2a54bca9f1de2110`; negative guard = `0653fc837d6d293861080e289d285dca4001323d`.
- Candidate source/test fingerprint: **`1658e48b94ce937b81135fb7f00f3d8d11e1d6f38f20c5a8d26a8776d304b549`**, SHA-256 of sorted `<git hash-object>  <repository-relative path>\n` lines for the 43 files selected by `git ls-files -- apps packages scripts test package.json tsconfig.json yarn.lock`, plus the new guard. Manifest retained locally at `/tmp/dope-c3-p2/source-manifest.txt`. Evidence prose and Project Mind data are outside this source/test fingerprint.
- Initial `git status --porcelain=v1`: empty. Index tree at completion remains the P1 tree above; no staged changes.
- Node `24.21.0`; all six root/app/workspace manifests and every internal reference in dependencies/devDependencies/peerDependencies/optionalDependencies audited at `0.3.6`. Theia remains `1.75.0`, Electron `42.8.1`; no root `package-lock.json`.

Read BOOT/AGENTS, ADR 0007, correction assessment/implementation plan/P1/P2 prompts, roadmap correction gate, Phase 3 closeout and its post-closeout routing, relevant product/architecture/workflow/stability authority, current Project Mind contracts/domain/store/backend/controller/widget and surviving tests, restart integration and Electron packaging harnesses. Intended preserved boundaries are framework-independent Project Intelligence/contracts, Node-owned canonical snapshot persistence, typed Theia RPC/presentation, and ordinary IDE behavior. No Physical Software Model evidence or Phase 4 implementation is implied.

## Permanent negative guard

`test/unit/pre-phase4-clean-baseline.test.ts` is included in `npm run test:baseline`, and therefore `npm test` and `npm run check`. It recursively scans current text source/configuration under `apps`, `packages`, and `scripts`, plus root manifest, TypeScript configuration and Yarn lock. Dependencies, generated `lib`/`src-gen`, and icon/build asset directories are excluded from the permanent source guard. Generated outputs and actual packaged composition are separately audited below. Historical docs/evidence and tests are excluded from terminology scanning.

| Defect class | Executable guard | Qualification result |
| --- | --- | --- |
| `packages/planning` workspace/build/typecheck | Removed directory assertion; path token in root/app/package/config/scripts | Pass; injected wiring rejected |
| `@dope/planning` dependencies/wiring | Identifier scan including manifests and lock | Pass; injected dependency token rejected |
| Current Planning DTO/service modules | Removed contract files and workspace-mode module asserted absent; Planning module filename guard; Plan/PlanStep/Task declarations in contracts rejected | Pass; removed paths and DTO declarations rejected |
| PlanningService / PlanningClient / planningServicePath | Identifier scan | All three injections rejected |
| PlanningStore / PlanningBackend | Identifier scan | Both injections rejected |
| PlanningView / PlanningWidget / PLANNING_ID | Identifier scan and module filename guard | All three injections rejected |
| WorkspaceMode.PLAN / dope.workspaceMode / dope.mode.* | Identifier scan; PLAN property permits whitespace | All three injections rejected |
| Production `.dope/planning.json` access | `planning.json` token rejected, including split `join(root, '.dope', 'planning.json')` spelling | Both access spellings rejected |
| Repository-tracked `.dope/planning.json` | `git ls-files -- .dope/planning.json` must be empty | Pass; tracked fixture rejected without changing the real index |
| Historical Phase 3 terminology | Outside source scan | Guard passes with historical docs intact |

18 temporary source-token/DTO probes each failed as expected, then were removed and the actual guard passed. An isolated temporary Git fixture additionally rejected tracked Planning state and all four removed directory/contract paths. Logs: `/tmp/dope-c3-p2-guard-mutations.log`, `/tmp/dope-c3-p2-guard-paths.log`; local replay probes `/tmp/dope-c3-p2-probe-guard.py` and `/tmp/dope-c3-p2-tracked-probe.py`. No probe source or compiled output remains. The source guard is deliberately scoped to the removed implementation signatures; it is not a general semantic analyzer of future code.

## Integrated checks

Native builds used the existing documented temporary environment, without changing repository dependencies:

```sh
PKG_CONFIG_SYSROOT_DIR=/tmp/dope-p3-sysroot/root \
PKG_CONFIG_LIBDIR=/tmp/dope-p3-sysroot/root/usr/lib/x86_64-linux-gnu/pkgconfig:/tmp/dope-p3-sysroot/root/usr/share/pkgconfig \
npm run check
```

| Command / audit | Result and evidence |
| --- | --- |
| `node --test test/unit/pre-phase4-clean-baseline.test.ts` | 1/1 pass; `/tmp/dope-c3-p2-guard.log` |
| `node --test test/unit/pre-phase4-clean-baseline.test.ts test/unit/theia-baseline.test.ts test/unit/note-persistence.test.ts test/unit/project-intelligence.test.ts test/unit/project-mind-storage.test.ts test/unit/project-mind-ui.test.ts` | 27/27 pass; final `/tmp/dope-c3-p2-focused-final.log` |
| `npm run check` with environment above | Pass: typecheck, runner 93/93, baseline 4/4 including guard, product 23/23, IDE fixture 1/1, browser/backend/Electron builds zero reported errors; `/tmp/dope-c3-p2-check-final.log` |
| `npm run test:restart` | 2/2 pass; `/tmp/dope-c3-p2-restart.log` |
| `npm run codex:phase:validate -- c3-remove-planning-instruments` | VALID; all three correction prompts unchanged `0.3.6`; `/tmp/dope-c3-p2-phase.log` |
| Manifest/internal-reference audit, no root lock, `git diff --check` | Pass |

The first P2 aggregate run also passed (`/tmp/dope-c3-p2-check.log`). After expanding the guard to include root TypeScript configuration and Yarn lock, focused and complete aggregate checks were replayed on the final guard. Surviving restart coverage actually exercised Electron process replacement, restored editor tab/theme/font/keybinding, runtime extension and bundled test provider, stale layout fallback, and Project Mind process/profile restart, folder isolation, conflicts and explicit recovery. These instrumented tests supplement the direct browser evidence; they do not claim direct native visual use of this AppImage.

## Direct browser qualification

Actual built browser workbench, URL **`http://127.0.0.1:3033/#/home/jfin/dev/dope`**, real repository `/home/jfin/dev/dope`, isolated `THEIA_CONFIG_DIR=/tmp/dope-c3-p2/config`, backend log `/tmp/dope-c3-p2/browser.log`. Started the generated browser backend with loopback binding and prepared repository plugins. Interactions used the Codex in-app browser directly through its UI; no controller/RPC calls substituted for the create/edit/save actions.

1. Entered the real repository workbench. Used Ctrl+P to find/open `packages/theia-extension/src/browser/dope-workbench.ts`; editor tab and breadcrumbs appeared. Used Ctrl+G to navigate to line 305; status showed `Ln 305, Col 1`, and ProjectMindView source was visible.
2. Used command palette to select **Dope: Show Project Mind**. Project Mind opened with **Saved · revision 35**, existing artifacts and normal create controls.
3. Clicked **New note**, typed title **C3 P2 disposable browser qualification** and a body, clicked **Save**. UI showed **Saved · revision 36**, the note in the list and Save disabled. Typed an additional body paragraph and clicked Save again; **Saved · revision 37**. Durable snapshot inspection independently confirmed ID `91a6d2df-506f-40a7-8790-3dc219e9c21a`, both paragraphs, developer provenance, timestamps, same project identity and 11 artifacts.
4. Clicked accepted Decision **Require all direct GUI gates before P6 handoff** (ID `8ea6a63a-1f0a-47ce-a60f-a73ca74af003`). Decision/context/rationale/consequences/alternatives/revisit fields, lifecycle and ordinary knowledge-link controls rendered. No create-Plan/related-Plans/show-Plan bridge or Planning error appeared. Existing knowledge titles mentioning historical Planning remain valid project content.
5. Opened View menu: ordinary IDE views and Project Mind were present; Planning absent. Command palette search **Planning** returned **0 Results**; View → Open View search **Planning** returned **0 Results**. Command palette search **Workspace Mode** returned **0 Results**; the Dope search exposed Show Project Mind and no mode commands.
6. Visually inspected workbench and status bar: no BUILD/PLAN switch, DOPE workspace-mode status, or mode suffix in title. Supplemental read-only DOM inspection found no Dope mode/Planning element IDs. Title was `dope-workbench.ts - dope - Dope`; status retained Git, Problems and normal editor indicators.
7. Inspected dark Theia presentation, then used Preferences: Color Theme → **Light (Theia)** explicitly. Screenshots visibly showed readable editor, Decision fields/labels/buttons and status in both themes. The fresh narrow right pane initially wrapped content heavily; a first drag selected text, then dragging the actual pane divider widened it successfully. This was a UI operation retry, not a source repair. Light override persisted only in the isolated temporary profile.

Browser console inspection did capture Theia **Cannot get key code from the keyboard event** errors during automated keyboard input. The listed navigation/palette actions nevertheless completed and were visibly verified. No warning/error containing `Planning` was recorded by the browser log filter; no Planning bridge error or failed Project Mind write was observed. This evidence does not assert an entirely error-free browser console or diagnose those keyboard-event messages as a product defect.

## Package identity and composition

`npm run package:linux`, with the same temporary native-build environment, passed; log `/tmp/dope-c3-p2-package.log`. Existing dependency/Electron/builder caches and 91 prepared plugins were reused. Plugin download was skipped by the existing harness. This is not an empty-cache install, portability/signing/publication test or framework upgrade.

- Exact artifact: **`dist/linux/Dope-0.3.6.AppImage`**, executable x86-64 ELF/AppImage, mode **755**, **188,113,080 bytes**.
- AppImage SHA-256: **`ecea5850e2140b115228dff25538f4402b1bc8dac7d65e8fa69e9cd2f9328e31`**.
- Extracted to `/tmp/dope-c3-p2/extract/squashfs-root`; extraction log `/tmp/dope-c3-p2-extract.log`. Desktop metadata: `Name=Dope`, `Exec=AppRun %U`, `Icon=dope`, `StartupWMClass=Dope`, `X-AppImage-Version=0.3.6`.
- Embedded `app.asar`: **63 paths**, **28 JS/JSON/CSS/map files scanned**, SHA-256 **`f419233680508fbbac15883b21cd0b9d82e763d2bde3608af3e323ba05444857`**. Its sole package manifest is `@dope/electron` `0.3.6`, entrypoint `scripts/packaged-main.cjs`, dependency `@dope/theia-extension=0.3.6`, Theia `1.75.0`. Internal product modules are bundled; no standalone internal installed-package directory is claimed.
- Actual archive contains backend `lib/backend/main.js`, frontend index/bundle, Project Mind backend service path and frontend view identity. No internal `@dope/planning` dependency/package, Planning module paths, removed service/store/backend/view/widget identifiers, mode identifiers or Planning storage access occurs in the inspected archive.
- All **1,456 extracted resource paths** and **96 external package manifests** were audited for internal Planning package/dependencies and removed module paths. **91 plugin directories** remain. Own compiled contracts/Project Intelligence/Theia-extension outputs were separately scanned and clean.
- Runnable local inspection: `node /tmp/dope-c3-p2-package-audit.cjs`; results `/tmp/dope-c3-p2-package-audit.log`; archive listing `/tmp/dope-c3-p2/asar-files.txt`.

This is artifact creation/composition evidence plus browser interaction and instrumented Electron restart evidence. P2 did not directly launch or visually edit Project Mind in this exact AppImage; inherited native visual gaps remain explicitly bounded below.

## Failures, cleanup and Git post-state

No product repair was required. P1's missing native build environment was resolved by reusing the prior qualification's temporary X11/XKB sysroot. Both P2 aggregate runs, restart and packaging passed. Packaging emitted duplicate-dependency notices and npm environment warnings without failing. One extraction invocation failed before execution because its requested working directory did not yet exist; creating it and retrying completed extraction. No failed package or product result is hidden by that retry.

Before the browser probe, the complete `.dope` directory was copied with metadata to `/tmp/dope-c3-p2/backup/.dope`. Original Project Mind: project ID `6f429fd5-027d-4827-b9a9-17a81a67be75`, revision **35**, **10 artifacts**, **9,484 bytes**, SHA-256 **`276e6c651603f03f09f5faf0c5181ae70b31fe5ebb69645483fbfadfd2f1b2a2`**.

After browser actions, the tab was closed, the qualification backend was stopped, and process/log inspection confirmed its writers were stopped. The snapshot was checked for exactly the expected revision 37/probe timestamp/artifact count before restoring, avoiding overwrite of unexpected concurrent knowledge. The probe snapshot is retained locally at `/tmp/dope-c3-p2/probe-project-mind.json`. Restored original bytes and permissions from the backup; original hash matched exactly, no Project Mind lock/temp file remained, and `git diff -- .dope/project-mind.json` was empty. No probe was intentionally retained as canonical knowledge.

Final intended Git changes are only `package.json`, the new negative guard, and this evidence file. HEAD/index remain P1. Historical `docs/tasks/p3/**` and `docs/planning/p3/**` are unchanged. No root lock, unrelated cleanup, staging, commit or version bump. `git diff --check` passes.

## Remaining manual closeout evidence

P3 must audit this exact source/test fingerprint and package hash, verify the final P2 commit/source identity if committed, review A–G in the correction plan and make the correction gate decision. The P1 runner succeeded; its run stopped at browser-required P2 and is not automatically rewritten to claim a P2 runner pass by this manual execution.

Phase 3's historical applicable-scope qualification remains intact. Phase 1/2 Not Qualified records and sequencing waivers retain their meaning. This correction does not retrospectively qualify missing exact native artifact visual interaction, inherited Test Explorer/restoration/customization gaps, or unperformed extension/framework upgrade/portability claims. Browser theme/readability and instrumented restart passes above apply to this candidate and the actual scope observed. No Product Phase 4 software model, visual planning ontology, AI/provider runtime or new executable authority was introduced.

**P2 disposition:** clean pre-Phase-4 baseline qualified for the requested checks; ready for manual P3 correction closeout at unchanged `0.3.6`. Phase 4 remains gated until that closeout explicitly clears it.

## Manual P2 commit handoff

The owner subsequently requested the P2 commit using the runner format. Before committing, the staged source was compared with this evidence. The original source fingerprint had been captured while the final aggregate build was still running: its Electron manifest hash was `0acbfed7562ec099dcec99f3e47b79215f8659d1`. The final restored manifest is unchanged from P1 (`f9743b62075949e6e27b8d88c4db73f3e6f67125`). The fingerprint above is corrected to the final source after the successful build; implementation blobs, package hash and all other manifest entries are unchanged. No behavior repair or new qualification claim was made. The focused negative guard and staged whitespace check passed again. The commit subject is `c3-remove-planning-instruments/P2: Qualify clean pre-Phase-4 baseline`; P3 should obtain its exact commit identity from Git. Earlier uncommitted/index descriptions record the original P2 qualification boundary. The local automated P1 run record remains untouched; P2 was completed and committed manually.
