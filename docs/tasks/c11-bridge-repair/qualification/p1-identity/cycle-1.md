# P1 owner-identity repair — manual cycle 1 (2026-10-18)

**Result: PASS for the P1 Prepare Work identity family on the uncommitted candidate below.** This is a bounded browser qualification, not a Planning Bridge or Phase 11 Green decision. P2–P5 remain separate. No commit, version change, `/activate`, Run, Adopt Target, hosted model call, or full `npm run check` occurred in this cycle.

## Preflight and preservation

- Owner explicitly requested the manual P1 Run. The local checkout was clean `main` at `7fa2707a58b44602cd9725c6f0ab94cc0881a962`; `11e1f761dda1dafead6f3c3ada072bedc9eeb389` is present in local history. All 13 package manifests and 20 internal pins were coherent at `0.11.8`. The correction prompt's older claim that original P15 evidence was still uncommitted was stale for this checkout: the original closeout and evidence are committed at entry HEAD. They were preserved unchanged.
- Original P15 [`closeout.md`](../../../c11-planning-bridge/closeout.md) SHA-256 `df884d326dad0577d29f1ead90e57e24e28274f531efc720a92579eb5eabe2b1`; [`evidence.json`](../../../c11-planning-bridge/qualification/p15-manual/evidence.json) SHA-256 `64672af40a5befcf1f78236e14b0999970ff5db6d272abb1befef45b04308b42`; exact `/tmp/dope-p15-check.log` SHA-256 `db23402f2850d6d6254aedfd0a62001beecf6bdeb83ceca1abb68b00c714c53f`. The log was copied to `/tmp/dope-p1-preserved-2026-10-18/p15-check.log` before source edits. An original disposable-fixture archive `/tmp/dope-p1-preserved-2026-10-18/p15-fixture.tar.gz` has SHA-256 `4eab09e448810514aee17dad59bb8f93efdca8abfc436242d1c94c37797ce976`.
- The preserved P15 log's first 625-test group was 623 pass / 2 fail. Its failures were `roadmap-chat-drafts.test.ts` wording (`/requires a local model/` versus “require a selected local model”) and `roadmap-chat-panel.test.ts` expecting a selection from a link fixture missing the current Planning basis. This cycle did not reclassify either as Green.
- Read `BOOT.md`, `AGENTS.md`, `docs/workflow.md`, ADR 0038, Phase 11/PB1–PB8, original `c11-planning-bridge` P1–P15 and P15 evidence, and this correction assessment, plan and README. Inspected the actual local frontend, RoadmapCanvas, PlanningMapController, VisualPlanningBackend and RoadmapPlanningLinks. No competing process or different checkout was used for the repair. The browser used the local Theia backend and the disposable root only; no model service was needed or selected for the P1 interaction. This was not an egress trace.

## Observed failure and diagnosis

The disposable project root was `/tmp/dope-p15-bridge-EjzkSm`, baseline Git commit `c9e5a9a7403cb8ce16ffdf1dd9441c39d6608cf3`, with its existing untracked `.dope/` and `ROADMAP.md`. Selected checkpoint: **Milestone Implement filter and focused checks**, Roadmap revision 3. Roadmap owner ID was `9b7bef94-24a1-472a-846f-7fd40fc7ebb3`; Planning owner ID was `project-68b38874-31d3-4579-b30f-a7476cebfe08`, collection revision 3. The existing draft map was `map-3580d99b-1b7d-45df-89e8-99d901b6ebf1`, revision 2. Physical Map/architecture were present and generation 1 had 8 nodes and 0 violations.

Clicking **Prepare Work** before repair showed **“Planning Map is unavailable for this project. Open its Software Map and retry.”** Expected behavior was to open or focus that existing Planning Map with the selected checkpoint objective and requirements in the same root. The local frontend compared `selection.projectId` (Roadmap's owner) directly with `planning.collection.projectId` before its Planning Map read, so the backend did not deny the legitimate request; the frontend stopped it. The browser log contained unrelated Theia warnings/history-channel noise, with no handoff-specific console exception. RoadmapStore and PlanningStore intentionally generate separate owner identities; joining them by ID, rewriting storage, or removing owner checks would violate the architecture.

## Authorized bounded repair

One source patch was made. The attached workspace root now binds the handoff, while Roadmap keeps its own project ID and revision checks and Planning keeps its own owner ID, collection/map revision, selected map and fresh basis checks. A linked map must match the owner ID and basis carried by the Roadmap link. If there is exactly one current existing draft/active unlinked map, Prepare Work displays it for review without creating a link or approving Work. Missing Physical Map/architecture still blocks.

Changed product paths: `packages/theia-extension/src/browser/prepare-work-navigation.ts` (new), `frontend-module.ts`, `planning-map-controller.ts`, `roadmap-inspector-model.ts`, `physical-map-widget.ts`, `chat-planning-selection.ts` in the same browser directory. Directly adjacent tests: `test/unit/prepare-work-navigation.test.ts` (new), `roadmap-inspector.test.ts`, `planning-map-ui.test.ts`, `planning-work.test.ts`, and a context-type update in `roadmap-chat-panel.test.ts`. No Roadmap/Planning owner store, project identity migration, Work runner, Chat layout, architecture, Markdown, manifest, pin, lockfile, or original P15 file was changed. The new helper's final SHA-256 is `00ad85f574c991d98a5096dd564b5fcc3f7092d3d4439db4795a6c615482c37f`; all other changed bytes remain visible in the uncommitted diff at the entry HEAD.

The final uncommitted code/test candidate is bound to entry HEAD by a SHA-256 manifest digest `4db56a7ffe5a5a0383353ac3a3bd1e8fe5ed053c3f041e1808506db042692533`. It is the SHA-256 of ordered `sha256sum` lines for the six changed browser source files listed above (new helper first, then frontend module, Planning controller, Physical widget, Chat selection, Roadmap inspector) followed by the five changed unit-test files (new navigation test, Roadmap inspector, Planning UI, Planning Work, Roadmap Chat panel). This identifies the tested uncommitted candidate without claiming a commit.

## Focused commands and result

| Command | Observed result |
| --- | --- |
| `corepack yarn workspace @dope/theia-extension build` | PASS, final source |
| `node --test test/unit/prepare-work-navigation.test.ts test/unit/roadmap-inspector.test.ts test/unit/planning-map-ui.test.ts test/unit/planning-work.test.ts test/unit/roadmap-planning-links.test.ts` | PASS, 39/39 on final source |
| `corepack yarn workspace @dope/browser build` | PASS, final browser bundle, 0 errors |
| Earlier focused selection including `test/unit/roadmap-chat-panel.test.ts` | 42 pass / 1 fail: the unchanged original P15 fixture/basis assertion assigned to P3; no false passing claim |
| `git diff --check` | PASS after the source patch and again at report time |
| `npm run check` | NOT RUN; P5 owns the stable final aggregate |

## Actual browser replay and security negatives

The final built bundle ran in the Codex in-app browser against the local backend at `http://127.0.0.1:3000` and the disposable project. After backend restart, the Software Map showed “Ready to refresh”; explicit **Refresh Software Map** produced `SYNTHESIS G1 | complete | 8 nodes | 0 violations`. Selecting the milestone and clicking **Prepare Work** then opened/focused the **existing** Planning Map, “Log severity filtering · draft,” and displayed the selected checkpoint title, objective and requirements. Its unlinked status was explicit, and the approved-WorkItem request remained disabled. Through the owner API, an authorized link to that same map was then made in the disposable root with its true Planning owner ID; Roadmap revision advanced 3→4. On the final code, Prepare Work again opened the same existing map and requirements under the distinct IDs; the approved-WorkItem request became available but was **not clicked**. The owner files were subsequently restored.

Negative observations on the final source:

| Input | Browser/authority result |
| --- | --- |
| Changed `src/logSummary.ts` basis in the disposable root | Visible “Existing Planning Map basis changed. Refresh or rebase it before preparing work”; source restored |
| Changed linked `ROADMAP.md` | Visible “Linked Roadmap source changed. Review and sync it before preparing work”; Markdown restored |
| Temporarily unavailable architecture declaration | Visible basis rejection; architecture restored |
| Planning map revision 2→3 while linked Roadmap pinned revision 2 | Visible “Linked Planning Map is missing or stale”; owner files restored |
| Roadmap revision 4→5 after browser checkpoint selection | Visible “Roadmap changed. Refresh and review”; owner files restored |
| Foreign Planning owner ID submitted through RoadmapPlanningLinks owner API | Denied: “Foreign or unresolved Roadmap link” |
| Actual foreign Planning owner ID from project B deliberately placed in project A's disposable link, then browser restarted and clicked Prepare Work | Visible alert: “Linked Planning Map has a foreign owner or missing basis. Review the Roadmap link”; no Planning Map handoff |
| Project A→B→A browser switch | B displayed “No Roadmap yet”; return to A and Prepare Work reopened A's existing map and requirements |

The corrupt foreign link was a deliberate disposable negative fixture, not a product write path. It was injected only while the local server was stopped, then removed after the observed denial. Final A fixture hashes equal their preserved originals: `ROADMAP.md` `326d3033a6f44cca55b89ca2e32cdda6c183dc82c9837ce0e412f16ed8442da7`; `src/logSummary.ts` `30f56312d0d1151b084cff09b075f078c0cbf25703946fd165778f22895c0cf5`; `.dope/roadmap.json` `3c904ba41121825cc222dde7c3e6f84554c59a1141303e8b8bf2b4a8c3bf1600`; `.dope/planning-maps.json` `8e177d3b8b9803996080a84721b2af2da0c364d0b2d9c913da5a3883931d8dad`; `.dope/architecture.json` `64f76d4f66bb553b07256623dbb7ae0c2d504e60e3457fa7de82951d775627c7`. The local browser server was stopped. No second Chat, Run, Adopt Target or hosted inference was invoked. Chat placement and native Electron GUI were not freshly qualified by this P1 cycle.

**Next action:** P1 is ready for independent review as an uncommitted repair. P2 and P3 each need their own original-failure disposition; P4 needs independent native GUI evidence; P5 alone owns full final-source qualification. Original P15 remains NOT GREEN; Phase 11 remains OPEN / NOT QUALIFIED and Phase 12 inactive.
