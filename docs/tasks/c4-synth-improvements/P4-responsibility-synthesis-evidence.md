# P4 real Gemini responsibility-hierarchy qualification

Status: Not Green on architecture quality. Generated result was frozen below before consulting benchmark architecture references. This is P4 evidence, not owner closeout.

## Candidate and controlled benchmark

- Dope source: `5758572eb2cb55d3b5083cbc9804b4c2f8a568ef` plus three focused working-tree code/test diffs (binary-diff SHA-256 `1fc157882b8f738ff456613ff688400ab36520affab9e6a88a44073ed09792f4`); package `0.4.6`. This evidence document is a fourth, untracked file and is excluded from that code-diff hash.
- Benchmark: `/home/jfin/dev/adaptive-seo-dope-p8`, `jfin602/adaptive-seo`, HEAD `0b26a25107be7d8dfb2210bc7258ccac8603197e`; clean before and after synthesis; `origin` fetch `git@github.com:jfin602/adaptive-seo.git`, push `DISABLED`; no preexisting `.dope/` directory.
- Gemini generation model: discovered, explicitly selected, and passed synthetic probe as `gemini-3.8-flash`. The credential is in this machine's OS key store, outside the benchmark and ordinary preferences.
- Deterministic parent packet: `fa839b8a9ec6697f4e69392ada296588192696bd80629a8208b8931bd5f67fe2`; source fingerprint `42aec46121472d8c996044416504ff83fc35c6150c3f13b577a755c71d0c9c87`; 760 items (336 semantic, 378 dependency, 24 configuration, 21 entrypoint, one topology). Planner version 5, view version 2, stage version 3. The first System view was `view:v1:552178db1469e55d`, plan `plan:v1:f7aff945d041669a`, 53 whole items, ten responsibility signals, 29,679 estimated input tokens against 29,696 budget.

## Frozen generated hierarchy

The browser reached the center review editor with one System, five Subsystems, four Components, five open questions and zero unassigned evidence facts. This tree is the unedited, unaccepted Gemini result. No benchmark architecture document was opened or supplied to synthesis before this freeze.

- **adaptive-seo** — manages projects, feed sources, optimization opportunities, performance insights and installation delivery across client and server code.
  - **Authentication & Session Management** — client/server authentication, session context and authorization.
    - Session Context Management
    - Authentication Service and Middleware
  - **Feed Sources & Ingestion** — source configuration, project linking and feed ingestion setup. No Components proposed.
  - **Adaptive Optimization** — opportunity discovery, analysis and API endpoints. No Components proposed.
  - **Project Insights** — performance data, time windows and analytical views.
    - Project Insights Repository
    - Project Insights View
  - **Installation Delivery** — installation payloads, scripts and view workflow. No Components proposed.

The System cited six production semantic facts spanning `src/client` and `src/server`. Each Subsystem cited source facts across its named behavior, though Adaptive Optimization and Installation Delivery also cited test dependency facts. Authentication, Feed Sources, Insights and Installation Delivery include more than one runtime plane. There are no Backend/Frontend top-level tiers. Three of five Subsystems have no proposed Components, so lower-level usefulness is uneven.

The five open questions are cross-Subsystem dependencies: Adaptive Optimization ↔ Authentication (two findings), Authentication ↔ Installation Delivery (two), and Feed Sources ↔ Installation Delivery (one). The review remained pending and canonical acceptance was disabled because the draft lacked canonical IDs.

## Run observations

An already-running browser server initially served an obsolete pre-P3 bundle. Its 70.9-second result used a stacked sidebar review, so it was declined and excluded from P4 qualification. The exact P3 browser bundle was rebuilt before the controlled run.

The first controlled P3 attempt failed at System Discovery after 15 seconds with `Gemini SDK or transport type error`; no partial proposal was accepted. A direct bounded System-stage diagnostic call with the same selected model succeeded. The subsequent browser retry reached center review in at most 302.8 seconds from Analyze invocation, within eight minutes. The first observed review-ready state is the conservative clock endpoint; the UI may have rendered earlier.

The key survived browser backend restart in the OS key store. Setup initially displayed a false “enter key” prompt because the controller did not notify after loading credential availability. The one-line notification repair and a focused UI regression passed 17/17 tests. A second restart showed “Gemini API key available on this machine”; model discovery and probe succeeded without reentry.

## Responsibility cues and discovery

The ten deterministic, cross-area signals were `context`, `error`, `insights`, `installation`, `kind`, `message`, `project`, `routes`, `session`, and `source`. Useful representative source pairs include `session` (`src/client/app/session.ts`, `src/server/auth/auth-middleware.ts`), `source` (`src/client/feeds/source-workflow.tsx`, `src/server/feeds/feed-source-link-repository.ts`), and `installation` (`src/client/feeds/feeds-page.tsx`, `src/server/http/installation-delivery-routes.ts`). Generic terms such as `error`, `kind`, and `routes` were noisy. The planner derives these cues from selected source facts and retains fact IDs and source areas; they are neither new physical evidence nor canonical ownership. The signal selector considers cross-area recurrence and caps output at 12, so omitted or weakly named responsibilities remain possible.

System Discovery and System Challenge led to one challenged System. Subsystem Discovery and Challenge led to the five Subsystems frozen above. Challenge decision details and intermediate proposal counts were not exposed in the retained review/progress UI, so no keep/merge/split claims beyond the final challenged count are inferred. Component descent produced two authentication Components, two insights Components, and none for the other three Subsystems. Reconciliation retained five cross-Subsystem open questions; verification did not eliminate them.

## Model call telemetry

All rows are `Gemini · gemini-3.8-flash`. Durations are provider-call milliseconds from the progress UI. Token counts are provider-reported; bytes are Dope request/output measurements. `total` is the provider's total token metric and need not equal input plus output. The progress UI did not expose per-call planning durations, candidate counts, or an explicit cache-reuse flag; none is asserted. There was no observed automatic per-call retry in the successful run.

| Stage / subject | Provider ms | Input | Output | Total | Request B | Output B |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| System discovery | 26,174 | 14,875 | 657 | 17,199 | 29,679 | 1,145 |
| System challenge | 21,792 | 15,120 | 1,007 | 19,058 | 29,614 | 1,750 |
| Subsystem discovery / adaptive-seo | 26,932 | 9,970 | 2,539 | 18,549 | 19,099 | 4,725 |
| Subsystem challenge / adaptive-seo | 20,359 | 12,100 | 3,745 | 18,821 | 22,794 | 7,073 |
| Component discovery / Authentication & Session Management | 16,506 | 14,923 | 890 | 20,252 | 27,602 | 1,842 |
| Component discovery / Feed Sources & Ingestion | 14,915 | 14,923 | 157 | 18,361 | 27,602 | 321 |
| Component discovery / Adaptive Optimization | 34,137 | 15,261 | 160 | 19,970 | 28,327 | 331 |
| Component discovery / Project Insights | 15,874 | 14,923 | 749 | 18,860 | 27,606 | 1,647 |
| Component discovery / Installation Delivery | 23,303 | 14,923 | 157 | 19,247 | 27,611 | 330 |
| Reconciliation | 15,273 | 15,231 | 697 | 18,849 | 29,667 | 1,509 |
| Verification 1 | 26,850 | 6,025 | 508 | 13,187 | 11,701 | 840 |
| Verification 2 | not retained | not retained | not retained | not retained | not retained | not retained |

There were 12 model calls. The 11 measured calls total 242,115 ms, 148,274 input tokens, 11,266 output tokens, 202,353 provider total tokens, 281,302 request bytes, and 21,513 output bytes. These are lower bounds for the whole run because the final verification call disappeared from progress when review opened. Review-ready elapsed time was at most 302.8 seconds, leaving at most 60.7 seconds for the unretained call plus evidence collection, deterministic planning/assembly, and UI transition. Those durations cannot be separated from retained telemetry.

## Independent architecture comparison after freeze

The benchmark's `docs/architecture/system-architecture.md` was read only after the generated tree above was frozen. The one-System result is coherent. Authentication/session, source setup, optimization, insights and installation are meaningful responsibilities, and several cross presentation/API/state paths were recognized. There are no dominant Frontend/Backend technical tiers.

The hierarchy omits or collapses significant implemented boundaries described by the reference and visible in source: Account/Workspace/Project and tenant control; topics/keywords; source pool, collection and media; Feed filtering/dedup/output; PHP delivery/cache details; GA4/Ahrefs provider integration and observation sync; worker/job execution; Feed Digest; and recommendation/action execution. Some could defensibly be Components beneath the existing Subsystems, but three Subsystems have no Components and the proposal does not make their distinct responsibilities inspectable. Authentication as a separate Subsystem is defensible; the relative placement of tenant/project access needs developer judgment. Valid citations and zero unassigned facts do not establish coverage.

**Architecture-quality disposition: Not Green.** The result avoids the original technical-tier failure and meets the time goal, but it is not yet a materially useful initial responsibility hierarchy for this benchmark. Do not present this as P5-ready qualification.

## Review editor and repairs

The browser rendered the review in a center editor with an indented System → Subsystem → Component tree and one selected-node detail panel. Canonical ID/roots were under Advanced. Source navigation opened `src/server/http/installation-delivery-routes.ts`; the sidebar reopened the same pending review. In the transient draft, Installation Delivery was renamed, a Delivery Credential Component was added, reparented to Feed Sources & Ingestion, then removed. The original unaccepted hierarchy had already been frozen above. The draft reported `Invalid architecture declaration: systems[0].id` and disabled Accept, confirming invalid acceptance is blocked. A live valid corrected acceptance, merge/split correction, and root-switch isolation were **not** proved in this session; focused backend/UI tests cover parts of these paths but are not a substitute for direct browser evidence. The benchmark never received canonical test state.

The only product repair was a `SoftwareMapController.setup()` notification after asynchronous machine key availability loads. A focused UI regression passed 17/17 and a browser backend restart then displayed the stored key and allowed model discovery/probe without reentry. One brittle System Discovery test was narrowed to preserve its `kind.const === 'system'` contract without forbidding unrelated schema words; its five focused tests passed. Neither change alters synthesis planning or generated hierarchy, so no model replay was required. The first controlled attempt's sanitized transport/type failure and manual retry remain a reliability gap.

## Improvements to try next

1. Improve cross-area responsibility cues so generic words do not consume bounded slots while source-backed domain behaviors across client, API, state and workers remain visible. Evaluate against more than this benchmark without using its reference vocabulary in prompts.
2. Make the Subsystem Challenge account for meaningful responsibilities absent from the initial list, then require Component descent to explain empty results where substantial evidence exists. Preserve source-backed uncertainty instead of forcing counts.
3. Expose complete per-call planning, candidate, cache, retry and final-call telemetry in durable qualification evidence; keep the review UI compact.
4. Investigate the first Gemini transport/type failure with safe diagnostics and a bounded retry policy if reproducible.
5. Exercise valid explicit acceptance, merge/split correction and root-switch isolation in the browser before claiming review Green.

## Final-candidate gates and residual gaps

- `npm run check`: pass (typecheck, product/unit/baseline/runner/local-install/IDE tests, browser and Electron builds).
- `npm run test:restart`: 3/3 pass, including Software Map rebuild after process restart.
- `npm run codex:phase:validate -- c4-synth-improvements`: valid, unchanged `0.4.6` stack.
- Root and Electron package versions `0.4.6`; Theia `1.75.0`; Electron runtime `42.8.1`; no root `package-lock.json`. `git diff --check` passed. The changed source introduces no new Theia internal reference.
- `npm run package:linux`: pass. `/home/jfin/dev/dope/dist/linux/Dope-0.4.6.AppImage`, mode `755`, size `189,728,370` bytes, SHA-256 `97f4570f920e0206e2838a0abfac23476ec202587d05cce8c252a8b8cb79f5ad`. Its embedded `app.asar/package.json` reports `0.4.6`.
- Native AppImage launched with a temporary profile. Theia backend listened on `127.0.0.1:35905`, and frontend logged `ready` after about 3.2 seconds. A 20-second controlled TERM ended the wrapper; one child backend was then explicitly terminated and verified absent. An `ENOTDIR` file-search error appeared near teardown after the AppImage mount was closed; native source navigation was not qualified here.
- Benchmark final state: exact pinned HEAD `0b26a25107be7d8dfb2210bc7258ccac8603197e`, empty Git porcelain status, no `.dope/`, origin push URL `DISABLED`.
- The browser backend was restarted after packaging; reloading the existing workbench showed “No architecture review is pending for this project.” The transient test draft is gone, and no canonical state was written.

Residual gaps: architecture quality is Not Green; intermediate challenge decisions, final call and planning telemetry are not retained; valid live acceptance, merge/split editing and root-switch isolation were not directly proved; one Gemini transport/type failure required manual retry. Successful build, restart, and package gates do not qualify the architecture result. P5 owner closeout should retain this Not Green disposition unless a later corrected candidate is separately qualified.
