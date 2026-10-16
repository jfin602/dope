# R5 — Fast read-only Q4 context and reliability assessment

**CURRENT R5 FIRST PASS (2026-10-16): READ-ONLY, 10–15 minutes. NOT a qualification closeout.** Manual GPT-6 Sol High; no `/activate`, no phase runner. Scope is the owner-approved [Codex browser/backend/local model](../qualification/r4-authority-egress/group-2/browser-scope-contract.md), not independent native/Chrome or whole-host egress.

**Do not repeat qualified work.** [R2 final](../qualification/r2-continuity/final-qualification.md) already qualified actual Q4_K_M/32768 model-generated greenfield preview, approval, persistence, fresh Chat, reject/cancel. [R3 final](../qualification/r3-interface/final-qualification.md) qualified the interface within its recorded scope. [R4 browser final](../qualification/r4-authority-egress/final-browser-qualification.md) qualified local selection/routing and approved linked edit within the browser scope. Historical [P11 Q3 context](../../c10-roadmap-qualify/qualification/post-correction-rerun-1/loop-3-context/comparison.md) measures Q3_K_L at 16K, 32K, 64K; it is **NOT a Q4 comparison**. Q4_K_M/32768 is a provisional tested configuration, NOT a global context default. A post-R4 product SHA `715066e436dc1767463ce45ac6edf95588f960b5` was reported locally but was not present on the docs-authoring remote baseline: verify actual local source/ancestry/evidence; do not claim a source as checked merely from this line.

## 1. Hard read-only boundary

**Allowed:** inspect `git status/log/diff`, current source/tests, existing saved sanitized evidence and timing/resource records, optional `lms ps --json` for read-only inventory. Determine source SHA from product paths (`apps/`, `packages/`, `test/`, manifests and `yarn.lock`) and verify `0.10.16`. Read relevant current context composer, admission/reservation, provider selection, token/first-token measurement, truncation and retry code.

**Forbidden during THIS assessment:** editing/writing project, source, docs, `.dope` or evidence files; stage/commit/push; reset/stash/clean; starting/restarting/stopping servers or model; model loads/unloads; new AI generations, Chat turns, proposals, source approvals, benchmarks, tests, builds, `npm run check`, monitoring, sudo or package installation. Do **not** create `qualification/r5-context/cycle-1.md` or any other artifact. Report findings **only in the final Chat reply**. Do not expose private prompts, host traces, credentials or unrelated user data.

**Timebox:** 10–15 minutes. Stop when the existing evidence has been classified. Missing data is **BLOCKED/EVIDENCE GAP**, not PASS. An actually observed incorrect behavior is **FAIL**, not merely BLOCKED. `NOT RUN` stays explicit. An older fixed/one-off malformed model output is not a current confirmed defect without proof.

## 2. Read sequence and evidence rubric

Read [R2 final](../qualification/r2-continuity/final-qualification.md) and [repair cycle 2](../qualification/r2-continuity/repair-cycle-2.md), [R4 final](../qualification/r4-authority-egress/final-browser-qualification.md) and [monitored cycle](../qualification/r4-authority-egress/group-2/cycle-1.md), any available [post-R4 regression](../qualification/post-r4-regression.md), [R3 final](../qualification/r3-interface/final-qualification.md), and historical [P11 summary](../../c10-roadmap-qualify/qualification/post-correction-rerun-1/loop-3-context/family-summary.md). For every inherited PASS, record exact tested SHA, fixture, producer→consumer seam and why the evidence still applies to the current local product. Do not treat a source code inspection as proof of live timing, Q4 context inclusion or reliable action quality.

## 3. C1–C12 qualification-readiness matrix

Record each gate as **GREEN / BLOCKED / FAIL / NOT RUN**, with a specific existing evidence path and SHA, source applicability, missing proof, and the **smallest next test/repair**.

| Gate | Required proof |
| --- | --- |
| C1 Local Q4/32768 | Exact loaded Q4_K_M, selected/actual provider, context length, no default change; reuse R2/R4 scope. |
| C2 Approval and freshness | Model proposal → trusted pending/no-write → approved source/revision → fresh grounded saved Chat; reuse R2/R4 when equivalent. |
| C3 Honest negatives | Rejected, cancelled, no-action, malformed/error, stale source, no unintended writes; do not infer reliability rate from isolated examples. |
| C4 Locality | No unauthorized hosted fallback within accepted browser/backend/model scope; no desktop/whole-host claim. |
| C5 Q4 16K vs 32K | Same actually loaded Q4 GGUF compared at both sizes, matched meaningful task and operating constraints; Q3 data cannot substitute. |
| C6 Effective context/truncation | Q4 composed input/output reservation, actual included/omitted source slices, discriminating late dependency/status and source revision. |
| C7 Longer saved Chat | Meaningful multi-turn Q4 planning/edit/revision/restart context, beyond one short answer. |
| C8 Repeated success/retry | Bounded repeated comparable Q4 meaningful proposals/edits/fresh turns and strict-JSON/retry outcomes. |
| C9 TTFT/latency | Comparable time-to-first-token if observable, first-visible UI status, end-to-end duration, repeated variability; mark absent values NOT MEASURED. |
| C10 Resources | Actual comparable Q4 RAM/RSS, parallelism, loaded context, output budget and usage; do not reuse Q3 RSS as Q4. |
| C11 Default decision | Smallest Q4 profile demonstrably sufficient for the stated workload, OR contractually valid explicitly owner-approved deferral. No silent global policy. |
| C12 Q4 64K | **Conditional only** if workload or accepted policy actually requires >32K; otherwise NOT REQUIRED with concrete rationale. |

A partially proven gate stays BLOCKED unless scoped sub-gates are explicitly separated. Historical Q3 P11 Not Green and original P14 Not Green remain immutable.

## 4. Required final response — exact order

1. **R5 READ-ONLY ASSESSMENT / NOT A GREEN CLOSEOUT:** actual local HEAD, product SHA/version, evidence availability, browser/backend/model scope, unverified local/remote commit differences.
2. **C1–C12 TABLE:** gate, status, artifact+SHA, producer/consumer applicability, missing proof / observed failure, minimum next step.
3. **GREEN GATES:** independently supported scoped PASS entries with references.
4. **BLOCKED GATES:** every mandatory missing measurement/test, including NOT RUN, and its smallest next action. Distinguish evidence gap from equipment failure.
5. **OBSERVED FAILURES:** only grounded reproductions; distinguish older resolved incidents.
6. **TARGETED FOLLOW-UPS:** at most 2–3 coherent groups, mapping specifically to blocked gates, with necessary user approval/model actions. Do **not** author or run the next prompts yet.
7. **DISPOSITION:** R5 NOT YET QUALIFIED (even if individual gates are Green); context default UNDECIDED unless actually qualified/owner-decided; R6 inactive.

Stop after returning the report. The owner will separately authorize targeted R5 tests/repairs and a final R5 qualification. Do not jump to R6.
