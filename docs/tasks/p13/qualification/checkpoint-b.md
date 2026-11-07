# P13 P9 — browser checkpoint B, 2026-11-07 continuation

**Current disposition: PARTIAL / NOT GREEN; no P9 PASS or owner-reviewed checkpoint approval.** This is a real connected Codex in-app browser attempt on a fresh disposable project. The owner explicitly approved the fixture's Gate-set coverage, but the separate Finish Planning lock decision is still pending. No Work grant, WorkItem run, candidate promotion, Criterion receipt, Gate GREEN, `0.13.9` version advance or P9 resume marker was made. The original 2026-11-05 BLOCKED attempt remains below as dated history.

## Exact source and live environment

- `main` HEAD `812bd44ecee2a3b5d404c0e6839df2c3ba9bf84d`, coherent Dope version `0.13.8` (13 manifests, 20 internal pins). Entry worktree was clean. The sole product repair is an **uncommitted** one-line display change in `packages/theia-extension/src/browser/roadmap-inspector-widget.ts`; `git diff` SHA-256 `1059fbc13bd3e0e6dcae72a03b1888314f68a8b236315456a8d16a25ac84075e`. The final tested app is HEAD plus that diff, not a committed source receipt.
- `npm run build:browser` passed on that source. A separate Dope backend was started from `/home/jfin/dev/dope/apps/browser` on `127.0.0.1:3001` after the build; the connected browser opened `http://127.0.0.1:3001/#/tmp/dope-p13-p9-0cOSnr`. Served frontend `bundle.js` SHA-256 `f076f8bddd8567783386d483823303391b60a162953008d192af755981187a53`; backend `main.js` SHA-256 `21e8c983623bd98479697e8de87782c011b1568fd4f6362ec93f5e7f2d45ea65`. The pre-existing port-3000 app had an older bundle and was not used for this qualification.
- Fresh fixture `/tmp/dope-p13-p9-0cOSnr`, Git baseline `ebb33e16e1f7d76221be2a5f10dff0bcc9cbf228`, project `e08f6689-4c68-4763-baaf-4ede30034f71`. Baseline `docs/current/score.md` SHA-256 `8e0597fb41578103d09a26392f598d17ef8e0a60a22021559bd18d904843089a`; baseline `src/scoring.mjs` SHA-256 `681c974f67d28e4640d1cf04f08967a41d99bf09629ba28911ab6cc271d28d7a`. The focused fixture test intentionally fails at baseline (`-15 !== 0`), so no successful accepted-source assertion exists. The owner's persistent project was not opened or changed.
- AI Center showed Coding Agent preferred `6-Sol High · GPT-5.6-Sol`, **unavailable**, and Interactive preferred `LM Studio · qwen3.5-9b`, **unavailable**. LM Studio's local model inventory showed `openai/gpt-oss-20b` loaded at 16,384 context; it was not selected for this Work and no provider was switched. The API agent model/context was not exposed by Dope. No project Work grant was present or issued.

## Attributed browser observations

The connected browser accessibility tree showed an empty real Roadmap, then the reviewed Phase and Gate additions. Phase `c115c591-95af-4839-a749-b36782bf9d90`, Gate `31faeaca-547a-4b62-9fa2-c8771ecb6c1e`, and Criterion `a0eb8c98-a2e3-4c4e-b148-ee3310ffd1f7` were visible in the Gate-set review at Roadmap revision 3, source hash `953c9223a6d0bab51446649f0173a2a13651c1b630dab7b5c21bb1da0d1780f4`. The canvas showed **0 of 1 gates qualified** and Gate **Unknown**. `Finish Planning` before coverage approval returned `Complete Gate-set coverage approval required`, while `Prepare Work` stayed disabled. An older preview failed closed with `Stale or unissued Gate-set coverage approval`; a fresh review displayed the same IDs/hash and, after the owner's explicit fixture approval, Dope saved coverage approval `05deffb1-dfb6-462e-b54d-6695888d9f3c` at revision 4. The approved coverage and unknown Gate survived backend restart and browser reload.

The first live Finish Planning preview displayed `source undefined` for this unlinked Roadmap despite a present hash. I repaired only the presentation fallback to `Roadmap index`, rebuilt, restarted the separate backend and repeated the real browser preview. Its final accessibility tree now reads `Review Phase c115c591-... · Roadmap revision 4 · source Roadmap index · 953c9223...1780f4`, followed by the exact Gate and Criterion IDs/expected result. The separate `Confirm Finish Planning` control is visible but **not invoked** while its owner decision is pending. This is a browser-verified wording repair, not a planning lock or Work proof. The card also displays `Accepted draft · not yet canonical` and a `Not canonical` footer for the unlinked accepted structure; that wording needs assessment against the Roadmap's canonical-owner contract.

## Current operated matrix

| Required case | Result | Direct basis / gap |
| --- | --- | --- |
| Work run, validator and immutable source-bound receipt visible in Gate, Work and History | **BLOCKED** | Planning lock and separate Work grant not obtained; no WorkItem, Run or receipt ID exists. |
| Completed Work, exit zero, runner commit, model assertion and held candidate cannot award GREEN | **EVIDENCE GAP** | Live Gate stayed Unknown/0 of 1 after Roadmap authoring and coverage approval; no actual Work completion, candidate, runner commit or model assertion was exercised in this fixture. |
| Missing/failed/waived proof stays NOT GREEN; verified current evidence qualifies only supported Criterion | **PARTIAL** | One missing-proof case is visible: Gate Unknown/0 of 1 after coverage approval. No current passing accepted-source evidence, waiver or qualification was operated. |
| Amendment, source drift, restore/rollback, cancel/replay and restart preserve evidence with affected-only staleness | **EVIDENCE GAP** | Coverage survived one backend restart/reload. There is no evidence history to preserve or stale, and no amendment/run cancellation was operated. |
| Wrong owner/root/project, no grant, forged/duplicate receipt, stale lease, rejected candidate, History redaction | **EVIDENCE GAP** | No receipt, grant, candidate or relevant History event exists; the stale coverage-preview denial is narrower than the required receipt/lease negatives. |

**Carried P4 obligations:** the live incomplete/no-approval coverage denial, exact Phase/Gate/Criterion review, no implicit grant and browser reload are observed on this fixture. The required locked-Phase persistence, other-Phase editability, hidden controls/keyboard, reviewed Planning Map/ready WorkItem link, owner review of that handoff, stale-source/backend lock, incomplete Criterion, pending proposal, foreign project, stale revision, duplicate submit and linked Markdown conflict/reconciliation remain **EVIDENCE GAP** until directly operated on applicable source. The earlier P4 report is not relabeled PASS.

## Validation and stop boundary

`node --test test/unit/roadmap-inspector.test.ts test/unit/roadmap-finish-planning.test.ts` passed **20/20**; `npm run build:browser` passed; `git diff --check` passed. The fixture's `node --test test/scoring.test.mjs` failed **0/1** as designed at baseline. The display repair was repeated on the final rebuilt app; no source-changing repair to Work/evidence behavior was made. No owner-native Electron observation was made; P13 owns that later gate.

Continue this same manual P9 only after the owner reviews the distinct planning lock and later Work/candidate/qualification decisions, then operate and record all remaining live cases on final tested source. Keep `0.13.8`, do not create a P9 marker, and do not resume the runner from this partial report.

---

# Historical P13 P9 — browser checkpoint B, 2026-11-05

> **2026-11-07 current entry status: UNBLOCKED / READY for the original manual P9 checkpoint.** The owner [accepted c13 documentation-routing P8 as OWNER GREEN for progression](../../c13-doc-routing/qualification/p8-owner-acceptance-2026-11-07.md) despite its preserved technical gaps. The BLOCKED / NOT GREEN P9 attempt below is dated history; P9 itself has not passed or received a `0.13.9` marker.

**Disposition: BLOCKED / NOT GREEN. No owner-reviewed PASS.** The required `c13-doc-routing` P1–P5 correction and its manual browser closeout have not been completed on this source. The separate correction is an explicit entry gate before P9 in `docs/tasks/p13/README.md` and `docs/tasks/c13-doc-routing/README.md`. P9's live matrix was therefore not operated. The connected browser inventory also failed before exposing a tab. This report is a truthful stop record, not a browser qualification receipt.

## Exact source and preflight

- Local branch: `main`; HEAD `e32222bcc3475fbdd75b310775cfae641731758c`, exact subject `0.13.8`, ahead of `origin/main` by five commits. The worktree was clean before this report was created. This report is the only change made by this checkpoint; no product source, grant, fixture, package manifest, or internal pin was changed.
- The 13 assigned package manifests and 20 internal `@dope/*` pins are coherent at `0.13.8`. The assigned P9 target `0.13.9` was **not** applied. P5–P8 exact-subject commits are reachable on main (`34df9f99`, `d69db326`, `a79dacc7`, `e32222bc`), but those marker subjects do not prove P9 or correction qualification. P8's commit records focused build/tests and an unfinished broader test attempt; no P9 test was run here.
- `docs/tasks/c13-doc-routing/README.md` says P1–P4 and manual P5 are authored only, not run or qualified. Git history has no correction implementation receipt; `docs/tasks/c13-doc-routing/qualification/p5-browser-closeout.md` does not exist. Its required source-bound owner-reviewed PASS is absent.
- `docs/tasks/p13/qualification/checkpoint-a.md` retains P4 **BLOCKED / NOT GREEN**. The 2026-11-05 P5-only conditional entry decision carries specific P4 live cases to P9; it does not waive them. No P4 case was discharged by this P9 attempt.
- Required preflight references were read: `BOOT.md`, `AGENTS.md`, `docs/workflow.md`, ADR 0051, the P13 lifecycle contract, P9 prompt, P4 report/P5 conditional entry, and preceding commit and correction-route receipts. Actual selected model/context in Dope, project/owner/source locks, and Work grants were not observable because no Dope session was opened. No provider was switched.
- No Dope listener was found on the local browser ports checked (`3000`, `3001`); backend and served bundle identity are **unverified**. Two connected browser inventory attempts returned no tabs and the error `Unable to load browser request-header policy`. There is no DOM, screenshot, or live Dope observation attributable to this checkpoint. No disposable project was created or mutated. The owner's persistent project was not used.

## P9 operated matrix

| Required case | Result | Observation |
| --- | --- | --- |
| Run, validator, immutable receipt and source provenance visible in Gate evidence, Work and History | **BLOCKED** | Entry correction and browser session absent; no WorkItem, Run or receipt ID obtained. |
| Completed Work, exit zero, runner commit, model claim and unpromoted candidate do not award Gate GREEN | **EVIDENCE GAP** | No live Work or candidate review operated. Commit subjects were checked only as implementation provenance. |
| Incomplete/failed/missing/waived proof stays NOT GREEN; current verified evidence qualifies only supported Criterion | **EVIDENCE GAP** | No live Criterion evidence assertion or qualification operated. |
| Amendment, source drift, rollback/restore, cancel/replay and restart preserve history with affected-only staleness | **EVIDENCE GAP** | No live amendment, restore, run interruption or restart operated. |
| Wrong owner/root/project, no grant, forged/duplicate receipt, stale lease, rejected candidate and History redaction | **EVIDENCE GAP** | No live negative path operated. |

The carried P4 lock/reload, other-Phase editing, hidden controls/keyboard, reviewed Planning Map/ready WorkItem link without implicit grant, owner review, stale-source/backend denial, inspector wording, incomplete Criterion, pending proposal, foreign project, stale revision, duplicate submit and linked Markdown conflict/reconciliation cases also remain **EVIDENCE GAP** on the current source. Earlier P4 observations are historical and are not relabeled PASS here.

## Validation, repairs and resume boundary

Preflight checks: `git status --porcelain=v1` showed a clean entry tree; `git rev-parse HEAD` and `git log` identified the committed basis; a package JSON inspection counted 13 coherent manifests and 20 coherent pins; `git ls-files`/path existence checks found no correction P5 report; `git diff --check` passed before this report. No browser test, focused product test, build, app restart or repair was performed. No product Gate or Phase GREEN is claimed. Owner-native Electron qualification remains separate and pending until P13.

Complete the separately authorized `c13-doc-routing` P1–P4 implementation and its independently operated P5 browser PASS on exact source, with a working connected browser and served Dope bundle. Then repeat P9 and discharge the named P4 live obligations on applicable final source. If any source changes, rerun affected live checks and focused tests. Only a complete, explicitly owner-reviewed P9 PASS can support the later `0.13.9` resume marker. **Do not create that marker or restart the p13 runner from this report.**
