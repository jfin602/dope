# P13 P11 cross-owner source and security integration — 2026-11-07

**Disposition: PARTIAL / NOT GREEN.** This runner turn implemented a narrow receipt-intake boundary and verified focused source behavior. It did not execute an actual granted AgentRun/candidate promotion in a disposable Dope project or record a separate durable owner Phase closeout. No Gate or Phase GREEN, browser/native PASS, or P9 reclassification follows.

## Source and scope

- Pre-task clean `main` HEAD: `546f6c7bb233719e21ff23c8ff591e026195fa60`, committed product version `0.13.10`. Runner-owned commit remains pending. The working tree now carries coherent `0.13.11` across 13 assigned manifests and 20 internal pins; `pi-runtime` remains `0.12.7`.
- `RoadmapWorkEvidenceIntake.ingestValidation` now requires the persisted run's start-time Task Contract to match its WorkItem Planning owner/revision, the current Phase lock approval and source, exact Gate/Criterion assertion, and run grant identity. Missing, foreign, stale and mismatched snapshots fail before a proposed Criterion receipt can be appended. Existing proposed-only, separate evidence approval and source-byte checks remain.
- `roadmap-work-evidence.test.ts` exercises a real disposable `RoadmapStore` with a second independently editable Phase, a failed run, changed candidate bytes, proposed-only receipt persistence, retry idempotency, and Task Contract mismatch negatives. Its AgentRun/AgentTask reader is a controlled test fixture; it is **not** proof of a live Dope Work execution or promotion.
- Modified product source SHA-256: `fb1711cac8114623af44917c0aff9545d9e0f75507a6f12c2510a527e51833a1`. Focused test SHA-256: `bdf1028b74f081413e67ef179c0b83310b330f2162603f8fc075a16c960fd023`. The runner must record the authoritative committed source identity after its own commit.

## Validation on the uncommitted result

- `corepack yarn workspace @dope/theia-extension build`: PASS.
- `npm run typecheck`: PASS; ordered dependent package builds followed by extension no-emit check.
- `npm run build:browser`: PASS; ordered extension dependencies and browser bundle. `corepack yarn workspace @dope/electron build`: PASS after that dependency build. Neither build is a browser or native GUI observation.
- Direct `node test/unit/<name>.test.ts` across roadmap Phase/Work handoff, Work evidence, amendment, receipt qualification, canvas, Gate/Phase qualification, linked store, document sync, History metadata, agent manual gate/store/run UI: **64 individual cases passed, 0 failed across 13 files**. Direct execution is used for individual case counts; `node --test` reports file-level counts in this environment.
- `git diff --check`: PASS. No persistent owner project, grant or source was modified. No Git commit was created.

## Unresolved qualification

The required single real journey is incomplete: accepted Gate/Criteria through Finish Planning, reviewed Prepare Work, separately granted Work execution/validation, accepted candidate promotion, current approved Criterion evidence, derived Gate qualification, and explicit owner Phase closeout were not operated together on one disposable project. The second Phase and failed run were exercised only within the focused service harness. Required end-to-end negatives for actual grant, interruption/replay, historical restore, Markdown conflict, source change and evidence leakage require source-bound integration or the P12 manual replay; existing focused tests do not replace that observation. The current Roadmap implementation exposes `phaseCloseoutEligibility` but has no durable owner Phase closeout writer or `Complete` projection; P10's monitor explicitly remains at `Awaiting Qualification` pending that separate owner. This is a product gap beyond the narrow receipt repair.

P4 and P9 remain their preserved PARTIAL/NOT GREEN or BLOCKED results with their carried cases. P12's real connected Codex browser checkpoint C is mandatory before the separate final native/owner P13 closeout. T2 security/source qualification is partial here; T3 browser/native qualification remains separate. Do not infer a browser PASS or Phase 13 GREEN from the `0.13.11` implementation marker.
