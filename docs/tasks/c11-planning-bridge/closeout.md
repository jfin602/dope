# c11-planning-bridge P15 — manual closeout (2026-10-18)

**Verdict: NOT GREEN for the Planning Bridge scope.** The owner explicitly requested the separate P15 Run. A real browser journey on a disposable project failed at **Prepare Work** on the final P1–P14 source. The final-source aggregate also failed 2 of its first 625 tests. This is a Bridge qualification result, not Phase 11 owner closeout. Phase 11 remains **OPEN / NOT QUALIFIED** and Phase 12 remains inactive. No agent commit or version change was made.

## Source, environment, and evidence

- Product source: clean `main` at entry, `11e1f761dda1dafead6f3c3ada072bedc9eeb389`; all Dope manifests and internal pins remained `0.11.8`. The repository gained only this uncommitted closeout and [sanitized evidence](qualification/p15-manual/evidence.json) during P15. The disposable Git project was `/tmp/dope-p15-bridge-EjzkSm`, baseline commit `c9e5a9a7403cb8ce16ffdf1dd9441c39d6608cf3`.
- `npm run codex:phase:validate -- c11-planning-bridge` passed the P1–P15 grammar and unchanged-version check. P15 was operated manually, outside the headless runner.
- `npm run build:browser` passed on this HEAD. The local and served `http://127.0.0.1:3000/bundle.js` SHA-256 both equaled `9ebf47de79a5c0e353e05f621f93dd8f9a9503051b0d6e61e227df29c840d23d`. The Codex in-app browser operated that local backend and the disposable project. GUI states were inspected in the live tool record; no standalone screenshot was exported.
- `npm run build:electron` passed on this HEAD; Electron bundle SHA-256 was `53d5b64351700a91419c5cc3b5aafe5bd5841f010c3fae448ede93db388d2508`. A separate development Electron process started with isolated user data and its backend/frontend startup logs, but reported `PluginDeployerContribution ... TypeError: i.split is not a function`. The available UI controller exposed no native app/window. **Independent Electron GUI behavior was not observed**; the process was stopped. A build or startup log is not native parity evidence.
- LM Studio loaded `qwen3-coder-30b-a3b-instruct@q4_k_m` locally at **32,768** context, parallel **1**, CPU-only. The existing saved Chat explicitly selected the ready LM Studio connection/model for its turns. This was not a global default change and does not qualify Q4/64K. No browser/native/whole-host egress trace was collected.
- The upstream [`c11-brainstorm` final correction closeout](../c11-brainstorm/qualification/final-closeout.md) is Green for its owner-approved browser/local-model correction scope at `270ade0`, with independent native GUI still unobserved there. That limited result is the producer handoff; it is not a Phase 11 Green claim.

## Live browser journey and blocking finding

1. In the existing Roadmap, **Create Manually** produced a draft phase for a small log-severity-filter feature and a checkpoint. The canvas showed accepted **draft revision 2** without `ROADMAP.md`. The reviewed Markdown preview showed both entries at `not-implemented`; only **Approve and create ROADMAP.md** published the linked file and canonical Roadmap revision 2. No unauthorized source or Work write was observed.
2. Selecting the approved checkpoint and pressing **Prepare Work** first displayed the expected no-map recovery message. Through the real Software Map UI, a manual canonical System/Subsystem was accepted; Physical Map generation 1 completed with 8 nodes and no violations. The existing Physical Map and Planning Map views opened. **Prepare Work still returned “Planning Map is unavailable for this project. Open its Software Map and retry.”**
3. A Planning Map was then created directly in the existing map UI, with source evidence `src/logSummary.ts` at SHA-256 `30f56312d0d1151b084cff09b075f078c0cbf25703946fd165778f22895c0cf5`. A typed `add` transformation for component `severity-filter` was previewed and committed to the *unlinked* map. Its deterministic WorkItem suggestion retained **HUMAN** ownership and reserved `src/logSummary.ts`; accepting it created one proposed WorkItem and **no AgentTask or Run**. This standalone map activity does not satisfy the Roadmap-linked scope/target approval path.
4. Retrying **Prepare Work** after the map and WorkItem persisted produced the same unavailable error. The actual Roadmap owner project ID was `9b7bef94-24a1-472a-846f-7fd40fc7ebb3`; the actual Planning collection project ID was `project-68b38874-31d3-4579-b30f-a7476cebfe08`. They are separate owner identities. The [frontend handoff check](../../../packages/theia-extension/src/browser/frontend-module.ts) compares those IDs directly at line 343 before opening Planning Map. This is a source-supported explanation for the observed denial, not a repaired result. P14 had fixed a similar comparison in the inspector model but did not cover this live frontend check.
5. As a separate negative, an external edit changed the linked checkpoint objective in `ROADMAP.md`. The live source panel showed **Source changed · review**, accepted/current hashes `916c725d…`/`326d3033…`, and the exact objective delta. **Prepare Work** then blocked on changed linked source. Explicit **Apply source changes** advanced the Roadmap owner to revision 3 and preserved the edited Markdown hash `326d3033a6f44cca55b89ca2e32cdda6c183dc82c9837ce0e412f16ed8442da7`; the checkpoint remained `not-implemented`.
6. The saved Chat first rejected a Planning Map turn with “Context source disabled: planning-map” before inference. After explicitly enabling that context and selecting the local Q4 model, one no-action question and one bounded WorkItem request completed with `actualProvider: local`. The latter returned source-referencing prose only, not a validated structured Bridge action; no approval or write followed. The first answer said the map could prove the filter's existence when, at that time, it had zero transformations and WorkItems; that wording overstated planned versus actual state. After both turns, `src/logSummary.ts` kept its baseline hash; the later direct map contained exactly one transformation and one proposed WorkItem. Saved-turn text, routing and exact owner revisions are in [the evidence record](qualification/p15-manual/evidence.json).

## P1–P14 implementation and validation disposition

The commit messages and [P14 handoff](qualification/p14-integration-handoff.md) report focused passing checks in their original source scopes. Their implementation is now committed through `11e1f76`; those historical focused runs are not a fresh all-green qualification at final HEAD.

| Prompt | Commit | Recorded focused result and P15 limit |
| --- | --- | --- |
| P1 lineage | `16431f4` | Extension build, lineage plus adjacent tests passed; no live projection proof. |
| P2 approvals | `3154cad` | Approval/Planning-link tests passed; one broader storage test had been stopped. |
| P3 impact | `b9f2ccb` | Changed-package builds and impact/rebase/Map backend tests passed. |
| P4 Prepare Work | `d50f156` | Extension build and five focused files passed; **live browser handoff failed** at final HEAD. |
| P5 target review | `c486c42` | Changed-package builds and six focused files passed; linked target approval unobserved live. |
| P6 decomposition | `fe7b5b0` | Changed-package builds and 51 focused tests passed. |
| P7 WorkItem UI | `78707de` | Extension build and 23 focused tests passed; one standalone human-owned WorkItem observed here. |
| P8 local proposals | `0fc3660` | Chat/extension builds and nine focused files passed; real selected Q4 here returned prose, with no validated Bridge action. |
| P9 composer | `f1737f4` | Composer and adjacent checks passed; its full runner test previously hit a Git `EPERM` in that environment. No live authored stack here. |
| P10 publication | `59ae368` | Extension build and four focused files passed; publication service has no observed frontend route. |
| P11 Work handoff | `0993c5e` | Builds and focused runs passed, but **the commit record explicitly says P11 is incomplete**: unpublished draft preview, approval state and Planning Map handoff are unwired; P10 has no frontend RPC. |
| P12 reconciliation | `9a6ebfa` | Extension build and seven focused files passed; no actual implementation to reconcile here. |
| P13 correction/fast lane | `c41f5f2` | Extension build and seven focused files passed; live fast lane not run. |
| P14 integration | `11e1f76` | Handoff records the repaired inspector check and passing 11/11 changed-seam suites plus 2/2 final rerun; synthetic Work opening is not a real Run. |

One `npm run check` was attempted on final HEAD. It exited **1** in the first 625-test group: **623 passed, 2 failed**. `roadmap-chat-drafts.test.ts` expected `/requires a local model/` but received the current “require a selected local model” wording; `roadmap-chat-panel.test.ts` expected a Bridge selection from a fixture whose Planning link lacks the current required basis and received “Prepare Work and select its current linked Planning Map first.” These are exact observed failures, with fixture/assertion drift suggested by source inspection; they were not repaired or reclassified as passing. The aggregate did not reach its later tests or browser/Electron build steps. The separately run browser and Electron builds passed. Full log: `/tmp/dope-p15-check.log`, SHA-256 `db23402f2850d6d6254aedfd0a62001beecf6bdeb83ceca1abb68b00c714c53f`.

## Manual gate matrix

`PASS` below is limited to the cited observation. The dependent D1–D8 **Phase 11 final journey** remains separately unqualified.

| Gate | Result | Actual scope and residual gap |
| --- | --- | --- |
| PB1 / Bridge D1 | **PASS, provider-free path** | Actual feature, draft/canonical distinction, preview and deliberate linked Markdown approval observed. Saved Chat was exercised separately; no Q4-generated Roadmap producer was claimed here. |
| PB2 / Bridge D2 | **FAIL** | Prepare Work failed on a complete current Physical Map and persisted Planning Map, including after retry. No linked impact packet or checkpoint-focused Planning Map was reached. |
| PB3 / Bridge D3 | **BLOCKED** | Direct unlinked target transformation was observed, but no approved checkpoint scope, linked current/target/diff review, or target approval. No Adopt Target occurred. |
| PB4 / Bridge D4 | **BLOCKED** | One directly created human-owned proposed WorkItem was observed; linked approved-target decomposition, split/merge/dependency negatives and ready handoff were not reached. |
| PB5 / Bridge D5 | **BLOCKED** | No live approved generated `docs/tasks/` stack. P11's known UI gap and failed handoff prevent publication/preview/validator and source-drift gates. Phase Focus F4's live pre-authoring outline reorder remains **Evidence Gap**, not PASS. |
| PB5 / Bridge D6 | **NOT RUN** | No approved safe stack existed. No ExecutionGrant, candidate validation/review/promotion or Git checkpoint was simulated. |
| PB6 / Bridge D7 | **NOT RUN** | No actual Work implementation or promoted candidate to reconcile. The direct map stayed planned. |
| PB6 / Bridge D8 | **NOT RUN** | No observed failed Work or accepted deviation/correction branch in a linked journey; no qualification status was promoted. |
| PB7 | **NOT RUN as a full gate** | Browser local-Q4 and no-action/source-change paths had the limited observations above. Provider-free fast lane, structured local Bridge proposal, left/right/bottom/center Chat matrix, narrow/keyboard/theme, independent Electron GUI, restart/project switch, and monitored egress were not completed. |
| PB8 | **FAIL** | Final-source aggregate failed 2 tests; P15 cannot carry forward an all-green P1–P14 result. This closeout preserves the historical Phase 10 R6 scope and Phase 11/Hunt/UX-003 limitations. |

**Next qualification boundary:** repair and source-review the cross-owner Prepare Work check, complete P11's preview/approval/handoff wiring, resolve the two aggregate failures, and run a new source-bound manual Bridge journey including real Work and independent Electron observation. Preserve this original P15 Not Green result. The broader Phase 11 exit still requires its separate full D1–D8 final-source journey, two materially distinct clean broad usability Hunts, complete GUI/authority coverage and explicit owner closeout.
