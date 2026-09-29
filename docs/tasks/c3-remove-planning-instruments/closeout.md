# Correction 3 — Planning removal closeout

Status: **GREEN / QUALIFIED FOR SEQUENCING — COMPLETE**
Version: **0.3.6 unchanged**
Audit completed September 28, 2026 America/Chicago (September 29 UTC).

The mandatory `c3-remove-planning-instruments` cleanup gate is **cleared** for the exact P2 product candidate below. The live Phase 3 Planning vertical slice is gone, permanent negative coverage is active, and surviving Project Mind/IDE checks pass. This is an evidence-only closeout: no behavior repair, compatibility layer, version bump, or Product Phase 4 implementation was made.

Next route: post-correction **`/docs-review`**, then explicit owner approval and `/docs-apply` as needed before Product Phase 4 planning/activation. Gate clearance is not Phase 4 implementation authorization; no Phase 4 prompt is created here.

## Exact candidate and handoff

| Identity | Exact value |
| --- | --- |
| Assessment/plan baseline | `68a51e78233f0a81bf295fb06e591fb508149bf0` (reachable ancestor) |
| Correction stack / pre-P1 authority source | `5c5ac0c6edf5355c5234e48972494edef37d06f3` |
| Successful P1 removal commit | `63b2492d29299b2521c1ce3919ca646c3f0b6e18` |
| Successful manual P2 handoff / audited product source / P3 pre-task HEAD | **`d3dfeb209ab30c23951d894204a89698a6b44353`** |
| P2 committed tree | `79929b8eb715710f73c3499ffd00e3ca00d7cf67` |
| Final 43-file source/test fingerprint | SHA-256 **`1658e48b94ce937b81135fb7f00f3d8d11e1d6f38f20c5a8d26a8776d304b549`** |
| Root manifest / permanent guard blobs | `ddcaeb16acc66395d9510e1f2a54bca9f1de2110` / `0653fc837d6d293861080e289d285dca4001323d` |

P2 is the single direct successor of P1. Qualification is established by committed [P2 evidence](P2-clean-baseline-evidence.md), the actual browser actions in this task's preceding P2 execution, package composition/hash, and passing reruns below—not by its commit subject. The source/test fingerprint was recomputed after P3's completed aggregate build and matches the corrected final P2 fingerprint. Its definition is SHA-256 of sorted `<git hash-object>  <repository-relative path>\n` lines selected by `git ls-files -- apps packages scripts test package.json tsconfig.json yarn.lock`. P2 records why its earlier in-progress-build fingerprint was corrected before commit.

Read BOOT/AGENTS, ADR 0007, roadmap correction gate, correction assessment/plan/README/P3 prompt, exact P1/P2 commits/source/results, P2 evidence, historical Phase 3 closeout, and applicable architecture/workflow/stability authority. The P1 runner record remains `.codex-runs/c3-remove-planning-instruments/2026-09-29T01-25-21-706Z/run.json`, `status=passed` for P1 with the exact SHA above. P1's aggregate native-build environment limitation is retained; P2 resolved it through the documented temporary sysroot. P2 was browser-executed and owner-authorized for manual commit; the old automated runner record still stops at browser-required P2 and is not rewritten to invent an automated P2 pass. The committed P2 evidence/commit and this audit provide the manual handoff.

## A–G decision

| Audit | Decision | Source and evidence |
| --- | --- | --- |
| A. Domain removal | **Green** | `packages/planning/`, Planning DTO/service contract modules and `workspace-mode.ts` are absent. Root workspaces/build/typecheck and internal dependencies contain no `@dope/planning`. Contracts main/types point to surviving `project-mind` output. Guard passes and rejects Plan/PlanStep/Task declarations in current contracts; P2 exercised reintroduction probes. |
| B. Persistence/transport removal | **Green** | Planning store/backend/service/client/path and RPC registration are gone. Inspected frontend/backend module registrations contain surviving Note/Project Mind services only. No production Planning file access; `.dope/planning.json` is absent both on disk and in `git ls-files`. Only the repository's obsolete state was removed; no arbitrary-project cleanup or Planning migration exists. |
| C. Presentation removal | **Green** | Planning controller/widget/file-navigation/view/menu/commands are deleted. Current Project Mind constructor, Decision actions and links have no related-Plan/create-Plan/show-Plan bridge. Workbench title customization supplies Dope branding without workspace mode; PLAN localStorage/status/title/body/CSS machinery is removed. P2 directly observed zero Planning command/view results, no workspace-mode command/switch/status and readable surviving Decision/IDE presentation. |
| D. Clean build/package graph | **Green for source/build/package composition** | Fresh aggregate check passes, including browser/Electron/native builds. All six manifests/internal references remain `0.3.6`; no root npm lock. Exact P2 AppImage hash remains unchanged, archive/resources contain no internal Planning dependency/package or compiled modules, and generated owned package outputs are clean. Native visual artifact use is separately an Evidence Gap below. |
| E. Preserved product | **Green for correction scope** | Project Mind contracts/domain/store/backend/controller are byte-for-byte unchanged from pre-P1. Focused 27/27, aggregate product 23/23 and both surviving restart cases pass. P2 directly opened/navigated real repository source, created/edited/saved a Note, inspected an accepted Decision, and checked dark/explicit-light readability. Disposable knowledge was restored exactly. This does not retroactively qualify historical Phase 1/2 gaps or unobserved IDE features. |
| F. Regression guard | **Green** | Permanent `test/unit/pre-phase4-clean-baseline.test.ts` runs in baseline → aggregate. It checks current root manifests/config/lock, app/package/scripts text surfaces, removed module paths/DTO declarations and tracked Planning state. Historical docs/tests and generated assets are excluded from terminology scanning; actual generated/package composition is audited separately. P2's 18 token/DTO probes and isolated Git/path probes were rejected; current guard reruns pass. |
| G. Historical/roadmap integrity | **Green** | `docs/planning/p3/**`, `docs/tasks/p3/**` and canonical Project Mind are unchanged from `5c5ac0c`. Git retains the removed qualified implementation. Inspected P1/P2 diff is removal plus surviving wiring/guard/evidence, with no Planning compatibility/migration/dual state, Physical Software Model, visual planning ontology, AI/provider runtime or framework upgrade. P3 modifies only correction README and this closeout. |

These are intended architecture boundaries established from current authority/source, not fabricated Physical Software Model facts: Project Intelligence/contracts remain independent product state; Node persistence owns the canonical snapshot; typed Theia RPC/presentation projects that state; Theia supplies ordinary IDE behavior. No later-phase capability is inferred from Theia's bundled libraries.

## Checks actually rerun in P3

Native build environment is the same documented temporary X11/XKB setup used by P2:

```sh
PKG_CONFIG_SYSROOT_DIR=/tmp/dope-p3-sysroot/root \
PKG_CONFIG_LIBDIR=/tmp/dope-p3-sysroot/root/usr/lib/x86_64-linux-gnu/pkgconfig:/tmp/dope-p3-sysroot/root/usr/share/pkgconfig \
npm run check
```

| Command / audit | P3 result | Local evidence |
| --- | --- | --- |
| `node --test test/unit/pre-phase4-clean-baseline.test.ts test/unit/theia-baseline.test.ts test/unit/note-persistence.test.ts test/unit/project-intelligence.test.ts test/unit/project-mind-storage.test.ts test/unit/project-mind-ui.test.ts` | **27/27 pass** | `/tmp/dope-c3-p3-focused.log` |
| `npm run check` with environment above | **Pass**: typecheck; runner 93/93, baseline 4/4, product 23/23, IDE fixture 1/1; browser/backend/Electron builds zero reported errors | `/tmp/dope-c3-p3-check.log` |
| `npm run test:restart` | **2/2 pass**, approximately 41.7 seconds | `/tmp/dope-c3-p3-restart.log` |
| `npm run codex:phase:validate -- c3-remove-planning-instruments` | **VALID**, unchanged `0.3.6` for P1–P3 | `/tmp/dope-c3-p3-phase.log` |
| Exact predecessor/fingerprint; six manifests and all internal dependencies/devDependencies/peerDependencies/optionalDependencies; Theia `1.75.0`, Electron `42.8.1`; no root `package-lock.json`; removed paths/tracked state; historical/core preservation | **Pass** | `/tmp/dope-c3-p3-authority-audit.log` |
| P2 AppImage SHA-256 and existing extracted archive/resource composition inspection | **Pass**, reused artifact; no package rebuild claimed | `/tmp/dope-c3-p3-package-inspection.log` |
| `git diff --check` | **Pass**, including final documentation changes | Actual P3 command |

The restart suite actually verifies Electron process replacement, restored source tab/theme/font/keybinding, runtime extension and bundled test provider, stale-state fallback, and Project Mind process/profile continuity, folder isolation, expected-revision conflicts and explicit recovery. Instrumentation is supplemental to P2 direct browser evidence. P3 had no failed test/build/restart attempt and required no product repair. Nonfatal npm environment/native-build warnings remain in the logs; prior P1/P2 failures, retries and environment preparation remain recorded in their evidence.

## Package and browser coverage reused from P2

Exact existing `dist/linux/Dope-0.3.6.AppImage`: executable x86-64 ELF/AppImage, mode **755**, **188,113,080 bytes**, SHA-256 **`ecea5850e2140b115228dff25538f4402b1bc8dac7d65e8fa69e9cd2f9328e31`**. P3 rechecked this hash and reran inspection of P2's existing extraction, without rebuilding/re-extracting or launching the artifact. Embedded `app.asar` SHA-256 is **`f419233680508fbbac15883b21cd0b9d82e763d2bde3608af3e323ba05444857`**; 63 paths/28 JS/JSON/CSS/map files are clean. Embedded Electron manifest and Theia extension reference are `0.3.6`, with `scripts/packaged-main.cjs` and actual backend/frontend bundles. Project Mind service/view identity is present. All 1,456 extracted resource paths/96 external manifests show no internal Planning dependency/package/module; 91 prepared plugin directories remain. Desktop metadata retains Dope branding and `X-AppImage-Version=0.3.6`.

P2 directly used `http://127.0.0.1:3033/#/home/jfin/dev/dope` on the real repository, with an isolated profile. Its action record covers source editor navigation to line 305, opening Project Mind at revision 35, a developer Note creation/save at revision 36 and edit/save at revision 37 with independently inspected durable bytes, accepted Decision inspection without Planning bridge controls/errors, View menu and command/view picker searches, mode UI/status/title absence, and dark/explicit Light (Theia) presentation. Existing knowledge titles containing historical Planning terminology remain valid content. P3 did not reopen or rerun the browser; those are P2 observations.

Canonical `.dope/project-mind.json` remains revision **35**, **10 artifacts**, **9,484 bytes**, project ID `6f429fd5-027d-4827-b9a9-17a81a67be75`, SHA-256 **`276e6c651603f03f09f5faf0c5181ae70b31fe5ebb69645483fbfadfd2f1b2a2`**. P2 restored its disposable Note only after stopping writers; P3 independently confirmed the original hash and Git identity. No repository knowledge was edited during P3.

## Residual gaps and historical truth

| Residual | Disposition |
| --- | --- |
| Exact cleanup AppImage native launch/direct native visual Project Mind interaction | **Evidence Gap**, not claimed by P2/P3. Browser interaction and instrumented Electron restart are the performed qualification. This does not block the correction's explicitly requested build/package-composition/browser gate, but remains a native artifact qualification limit. Historical Phase 3's different AppImage launch does not fill it. |
| Browser keyboard-event console errors during automation | Retained observation: Theia reported `Cannot get key code from the keyboard event`; the required actions nevertheless visibly completed. No Planning error or failed Project Mind write was observed. No diagnosis/repair or entirely error-free-console claim. |
| Empty-cache dependency/plugin install, signing/publication, cross-distribution portability and framework upgrade | **Evidence Gaps / unperformed scope**. Existing prepared plugins/caches and temporary host build metadata were reused. No new compatibility claim. |
| Historical Phase 1/2 Not Qualified evidence | Preserved: Phase 1 Test Explorer/GUI restoration/extension/customization evidence and Phase 2 hidden migration, dirty same-renderer switch, exact `0.2.6` native use and inherited gaps retain their original status. Current passing scoped tests/browser observations do not relabel those candidates. |
| Broad current authority still describing the correction as pending | Post-correction `/docs-review` must reconcile BOOT/AGENTS/roadmap routing/status with this completed closeout through the authorized documentation workflow. They were not broadly rewritten in this evidence-only prompt. Phase 4 requires its own planning/activation. |

Phase 3 remains historically **Qualified for applicable scope at `0.3.6`**, exactly as its closeout states. Its live implementation was deliberately removed before stability under ADR 0007; there is no obligation to fossilize its Plan/PlanStep/Task model. No historical Phase 3 document was modified, and its removed source/data remain recoverable through Git. The pre-existing explicit legacy Note → Project Mind migration remains its own surviving feature; no obsolete Planning migration was introduced.

## Final repository and gate disposition

Pre-task Git state was clean at exact P2 HEAD. Final intended changes are only `docs/tasks/c3-remove-planning-instruments/README.md` and this new `closeout.md`; HEAD/index remain P2, with no staging/commit performed by this manual P3 execution. Source/test fingerprint, version, historical Phase 3 files and canonical Project Mind are unchanged. The correction README is marked complete and links this audit.

**Decision: A–G Green; correction complete and qualified enough for sequencing at unchanged `0.3.6`. The mandatory cleanup gate is cleared. Next action is post-correction `/docs-review` for Product Phase 4 planning/activation; no Product Phase 4 implementation is authorized or performed by this closeout.**
