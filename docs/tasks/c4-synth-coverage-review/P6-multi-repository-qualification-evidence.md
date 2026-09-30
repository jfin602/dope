# Correction 4 / P6 — multi-repository qualification evidence

Status: **Stopped at developer request on 2026-09-30; Not Qualified. P7 is not ready.** This is a partial evidence record, not a Green closeout.

## Candidate and controls

- Dope source: `d454e67214e9069bf9b5c216465d6c5fc6a8b14e` plus the uncommitted P6 source/test diff (SHA-256 `4c591e32a4e13f59d45752edeace7f7dd4cd4136e7f7041096c79b1bd391645a` before this evidence file). Package version remained `0.4.6`. The clean, answer-key-excluded Dope source snapshot was `/tmp/dope-c4-p6-dope-clean`, commit `adae94cd8545065620ea363eff59ce4cc3c2806b`.
- Gemini: explicitly selected and successfully probed `gemini-3.8-flash` on each attempted target. The existing machine credential store supplied the key; no production/customer key was entered.
- Adaptive SEO: `/home/jfin/dev/adaptive-seo-dope-p8`, `0b26a25107be7d8dfb2210bc7258ccac8603197e`. Its repository-owned root `MODULES.md` was already untracked before P6; root README was present. Push URL remained `DISABLED`. The benchmark has no accepted `.dope/architecture.json`.
- Dope: the snapshot excluded `.dope/`, `docs/tasks/`, planning/qualification artifacts and generated prompt material. Root MODULES, README and ordinary architecture docs remained available. No accepted architecture was present in the snapshot.
- Small fixture: `/tmp/dope-c4-p6-small`, initially `674da1527804c517388fbf825dcea1af5cf42c9a`; final controlled-fixture commit `0dc239664d44cd2563d11b90e85f2d5c3078f14d` adds `tsconfig.json` so the analyzer can inspect its three TypeScript services. README-only onboarding was directly observed. Its final run was cancelled at 51 seconds at the developer's request. It has no accepted architecture.

P5 predecessor: [P5 review browser qualification evidence](P5-review-qualification-evidence.md). P5 qualified the onboarding/review surface and explicit acceptance on a disposable fixture; P6 did not accept any benchmark proposal.

## Documentation inputs and controls

Adaptive SEO and Dope directly showed the MODULES-first onboarding recommendation. Their review surfaces showed `MODULES.md` as `modules-seed` and `README.md` as `readme-orientation`/secondary context. The small fixture directly showed the recommendation to create MODULES and the **Continue with README** path. The initial small-fixture request was only 1,258 bytes and produced no System because the fixture had no TypeScript project configuration; after adding `tsconfig.json`, System Discovery produced a candidate. This is fixture setup, not a synthesis-product repair.

Existing focused guards show document classification/exclusion, 20,000-character MODULES and 12,000-character README caps, Documented authority rather than Observed evidence, rejection of document-only proposal refs, and changed document bytes invalidating packet input identity. `test/unit/architecture-evidence.test.ts`, `test/unit/evidence-planner.test.ts`, and `test/unit/software-map-initialization.test.ts` contain these checks. P5 directly exercised README/no-doc continuation and explicit acceptance. P6 did not complete a fresh direct stale/conflicting-doc or post-acceptance no-silent-reimport observation; those remain evidence gaps. Neither the complete packet/planner identities nor exact per-run document counts were exported by the review UI.

## Adaptive SEO replay and frozen result

The original candidate reached review quickly but froze at one System, four Subsystems, zero Components and 24 unresolved cues, with major implementation omitted. A first planner replay reached one System, five Subsystems, zero Components and 25 unresolved cues. A later replay exposed invalid Subsystem ownership. After ownership instruction repair, another replay failed on an invalid empty Component descent. These failures were not scored as Green.

The last replay started **21:43:51 UTC** and the validated center review was visible by **21:51:16 UTC** (at most 445 seconds, below eight minutes). It froze before post-run comparison at:

1. **Adaptive SEO Service**
   - Adaptive Recommendations
   - Authentication and Access Control
   - Job Scheduling and Execution
   - Feed Installation and Delivery
   - Topic and Keyword Management
   - Project Management
   - External Integrations
2. **Customer Site Feed Runtime** — no Subsystem or Component proposed.

The review reported **2 Systems, 7 Subsystems, 0 Components, 9 open questions, 0 unassigned evidence facts and 38 unresolved source-backed cues**. All seven Component descents were typed `leaf-responsibility`; two initially malformed empty results succeeded on their one allowed retry. No Subsystem recovery was observed in the final hierarchy. The runtime boundary is useful, but the System has no proposed Subsystem even though canonical acceptance requires one. No technical layer dominated the named boundaries; however, zero useful Components and extensive unresolved ownership prevent Green.

The post-freeze source/reference comparison found major implemented work still missing or only weakly captured: source collection (`CollectionService`, `BoundedHttpFetcher`), feed configuration and digest lifecycle (`FeedConfigurationRepository`, `FeedDigestInputService`, `FeedDigestLifecycle`), provider synchronization (`AhrefsSyncService`), project insights and access/entitlement work. `generatePhpInstallation` remained an unresolved cue even though the separate Customer Site Feed Runtime System was proposed. Feed installation, adaptive recommendations, authentication, jobs, topics, projects, and external integrations were represented at least coarsely. The review kept omitted source-backed behavior visible rather than silently treating MODULES intent as observed truth. **Architecture quality: Not Green.**

The progress UI exposed these final-replay attempt measurements. Durations are milliseconds; token triples are provider-reported input/output/total. Every listed successful attempt consumed its result; attempts marked `invalid` did not. Requests and outputs are bytes. The progress UI did not expose call/attempt IDs, started-at timestamps, retry links, or the complete retained ledger after review. The last verification call, if any, was not captured before the UI switched to review, so this is **not complete telemetry**.

| Stage / subject | Attempt | Duration | Tokens in/out/total | Bytes request/output | Result |
|---|---:|---:|---:|---:|---|
| System discovery | 1 | 17,757 | 27,863/858/33,528 | 62,312/1,661 | consumed |
| System challenge | 1 | 31,593 | 31,126/1,471/40,674 | 62,343/2,735 | consumed |
| Subsystem discovery / Adaptive SEO Service | 1 | 45,497 | 22,178/4,369/38,834 | 44,803/7,091 | consumed |
| Subsystem challenge / Adaptive SEO Service | 1 | 33,248 | 31,849/6,429/44,275 | 62,078/11,415 | consumed |
| Component / Adaptive Recommendations | 1 | 10,163 | 19,134/162/22,642 | 33,674/341 | invalid, unconsumed |
| Component / Adaptive Recommendations | 2 | 16,059 | 19,134/688/24,659 | 33,674/1,121 | consumed |
| Component / Authentication and Access Control | 1 | 16,328 | 20,184/566/25,757 | 35,878/967 | consumed |
| Component / Job Scheduling and Execution | 1 | 10,154 | 24,102/571/27,416 | 43,783/973 | consumed |
| Component / Feed Installation and Delivery | 1 | 17,225 | 22,924/169/28,730 | 41,365/346 | invalid, unconsumed |
| Component / Feed Installation and Delivery | 2 | 18,744 | 22,924/442/28,572 | 41,365/829 | consumed |
| Component / Topic and Keyword Management | 1 | 12,507 | 20,203/565/24,507 | 35,861/973 | consumed |
| Component / Project Management | 1 | 17,421 | 22,313/502/28,183 | 39,883/887 | consumed |
| Component / External Integrations | 1 | 16,281 | 24,681/491/30,029 | 45,155/858 | consumed |
| Subsystem discovery / Customer Site Feed Runtime | 1 | 7,416 | 7,547/154/9,735 | 16,165/291 | consumed |
| Subsystem challenge / Customer Site Feed Runtime | 1 | 12,517 | 25,720/149/29,047 | 51,739/290 | consumed |
| Reconciliation | 1 | 14,552 | 32,267/693/37,005 | 62,367/1,563 | consumed |
| Verification | 1 | 22,185 | 8,327/691/15,897 | 15,030/1,079 | consumed |

## Dope and small fixture disposition

The earlier Dope baseline on the clean snapshot failed during its second Component descent after six model calls with `Invalid hierarchical synthesis: Component Discovery empty result disposition`; it produced no frozen hierarchy. The final snapshot at `adae94c` was opened, MODULES-first onboarding was observed, `gemini-3.8-flash` was explicitly selected/probed, but **Analyze Project was not clicked** before the developer asked to wrap up. No final Dope timing, coverage, hierarchy or post-freeze comparison exists.

The small fixture's first run failed at System Discovery in 3 seconds with a 1,258-byte request and zero Systems. After adding `tsconfig.json`, its replay produced System Discovery (14,035 ms), System Challenge (11,135 ms), and Subsystem Discovery for `Store` (10,847 ms). The developer asked to wrap up while Subsystem Challenge was active; cancellation was confirmed by the UI at 51 seconds. No final hierarchy was frozen, so its README/reference was not consulted for scoring. Architecture quality: **unqualified**.

## Repairs and validation status

P6 bounded source changes broadened the deterministic cross-area evidence selection and responsibility cues, increased the Gemini planner ceiling to one sixteenth of reported model input capacity, clarified direct production ownership refs in lower-stage instructions, and allowed one retry of a malformed Gemini stage result. Focused regression guards were added for evidence breadth, Gemini capability/instructions and malformed-result retry accounting. The software-map build and 13 reconciliation focused tests passed after the last repair; the extension build and 21 planner/provider focused tests passed before the last retry repair. A consolidated post-repair focused run was not performed.

At the developer's wrap-up request, **`npm run check`, `npm run test:restart`, phase validation, unchanged-version/dependency checks, Linux AppImage build/inspection, and native launch/readiness/close were not run**. `git diff --check` passed. The package version was directly read as `0.4.6`; no package/native result is claimed. Adaptive SEO remained at its pinned SHA with only the pre-existing untracked MODULES file, push disabled and no accepted architecture. Both disposable benchmark snapshots were clean and had no accepted architecture.

## Residual evidence gaps / gate decision

Complete attempt ledger and packet/planner identities, direct P6 document-conflict/no-doc/no-silent-reimport controls, final Dope and small-fixture frozen comparisons, final broad/restart/package/native checks, and all-source-ref resolution remain unqualified. Adaptive SEO met the time target but missed material responsibilities and left 38 cues unresolved. **P6 is Not Qualified and P7 is not ready.**
