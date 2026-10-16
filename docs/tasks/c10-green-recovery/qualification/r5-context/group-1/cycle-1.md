# R5 Group 1 cycle 1 — Q4 context, inclusion, timing and headroom

**Disposition (2026-10-16): C5 GREEN, C6 GREEN, C9 GREEN, C10 GREEN in the direct Dope backend + local LM Studio scope measured below.** This is a targeted comparison, not an R5 family verdict or a production default. Group 2 owns C7/C8 longer-Chat reliability, including the provider failure observed here. Group 3 and R6 were not run. Phase 10 remains NOT GREEN / NOT OWNER-CLOSED; Phases 11/12 stay inactive.

## Source and method

- Product source: `715066e436dc1767463ce45ac6edf95588f960b5`; documentation HEAD before this record: `40602f9cea4df3ac054e77b54edbbf6560ef295c`; package `0.10.16`. `git diff 715066e -- apps packages test package.json yarn.lock` was empty. No product source or global AI Center role/default changed.
- The [disposable harness](evidence/run-comparison.mjs) used real `RoadmapStore.acceptImport`/revisioned mutation, `ChatRepository`, `ChatContextComposer`, `ChatBackend` with planning authority, and `LocalConversationalProvider` to LM Studio loopback. It created separate durable, explicitly selected test Chats per profile. This was direct backend operation, not a browser or native GUI turn; UI first-visible timings are NOT MEASURED. R2's Q4 greenfield and R4's egress gates were not replayed.
- The only model loaded for each run was `qwen3-coder-30b-a3b-instruct@q4_k_m`, GGUF `lmstudio-community/Qwen3-Coder-30B-A3B-Instruct-GGUF/Qwen3-Coder-30B-A3B-Instruct-Q4_K_M.gguf`, 18,632,186,176 bytes, LM Studio API quantization `Q4_K_M`. CLI and `/api/v1/models` both confirmed actual 16,384 then 32,768 contexts, parallel 4. Each load used `--gpu off`; active `llama-server` flags had `--n-gpu-layers 0`, `--n-cpu-moe 0`, and `--parallel 4`. Same loopback `/v1` endpoint, provider implementation, default sampling controls, 1,024 output reserve, 25,000 saved-Chat input policy, no history, one loaded profile at a time. A prior idle 32K instance was used first and 32K was restored at exit. No unrelated loaded model or queued request was found at the switches.

## Fixture and expected truth

The synthetic linked [Roadmap](evidence/roadmap.md) hash is `fa5813d4c85cb2a173073a4e5b7c3ac73294dd2d01f00e5e6c9a058f1345a8f4`; [owner index](evidence/owner-index.json) hash is `2b3f9625452114fdeb2bc70ede39fdc5752d0bfaec4328531c0fb1e8764ac923`, project revision **3**. Release Candidate is **active** and directly depends on Integration Gate. Integration Gate depends on Key Rotation, whose imported status is **NOT GREEN**. The [18,548-byte brief](evidence/planning-brief.md), hash `995602c60c94ef3d3ac324cbc5ca542e47ff53b42fa1a67ef2faf1453f3a856b`, carries distinct source decision revisions 1–4. Its late revision-4 fact starts at byte 15,244: Key Rotation's failed credential rollover verification supersedes revision 2's provisional go note. Correct current decision: **do not start the canary; repair Key Rotation, obtain Green verification, then reassess Integration Gate and Release Candidate.** Brief source revision 4 and Dope owner revision 3 are separate counters. [Fixture metadata](evidence/fixture.json) records IDs, hashes and the exact late clause.

The selected checkpoint's bounded typed context contains its own status and its direct Integration Gate neighbor, but does not include the transitive Key Rotation status. The attached brief supplies that decision-changing fact. The brief contains substantive interface, rollback, verification and workstream records; it was not token padding.

## Effective inclusion and answer comparison

The source and provider-request wrapper independently checked inclusion. At 16K, the file reference contained 12,331 or 12,349 of 18,548 bytes; the late clause at byte 15,244 was absent from the actual serialized messages. At 32K, all 18,548 bytes and the exact late clause were present in both heavy prompts. The selected checkpoint contributed 1,257 bytes in every turn. Dope reported `truncated` for the bounded Roadmap query; at 16K it additionally reported file truncation. The short selected-checkpoint-only prompt had no file reference in either profile.

| Matched question | 16K observed | 32K observed | Source judgment |
| --- | --- | --- | --- |
| Narrow fact: selected status and direct dependency | Valid no-action: active, directly depends on Integration Gate. | Identical valid no-action. | Both correct for this compact task. Neither needed the late clause. |
| Narrow canary authorization | Valid intent: “Authorize canary deployment after integration gate validation.” | Valid intent: “Authorize canary deployment after dependencies are green.” | Both conditional; neither establishes current transitive readiness. Do **not** count as a current go decision. No intent was approved or written. |
| Heavy 1: current canary decision and dependency | Valid intent: “Start the release canary after all dependencies are green.” | Valid intent: “Do not start the release canary; repair Key Rotation dependency first.” The 32K repeat returned the same decision. | 16K lacked the governing status; its answer was insufficient for the requested current decision. 32K gave the correct no-go and blocker. |
| Heavy 2: repeat significant scenario | Valid intent: “Proceed with release canary after all dependencies are green.” | First 32K run failed with `Local generation failed` before any delta; a fresh matched 32K repeat returned “Do not start the release canary - Key Rotation dependency is not green.” | 16K again lacked current truth. The successful 32K repeat was correct on decision/status; the failed run is retained, not converted to success. |

The 32K answers did **not** explicitly name brief revision 4 despite that request; they are correct on the action and blocker, but do not prove reliable revision citation. The 16K answers cannot be graded as correct on the late fact they never received. All successful outputs passed Dope's strict local planning JSON envelope; proposals remained pending, with no approval or source write. [16K turn record](evidence/profile-16384.json), [32K first record](evidence/profile-32768.json), [32K repeat](evidence/profile-32768-repeat.json), and the [narrow 16K](evidence/profile-16384-narrowfact.json)/[narrow 32K](evidence/profile-32768-narrowfact.json) records retain saved status, exact output, refs, diagnostics, provider usage and measurements.

## Timing, usage and resources

The adapter wrapper timestamped provider invocation, first streamed content delta and completion. These are **measured adapter-level first-delta latencies**, not internal LM Studio engine TTFT. Backend total is measured from `ChatBackend.runTurn` to resolve/reject. A local planning result is buffered until strict validation, so no UI first-visible result is inferred. LM Studio's successful stream supplied **provider-reported** input/output tokens; the failed provider attempt supplied none. No separate tokenizer-level system/history breakdown exists. CPU pressure is Linux `/proc/pressure/cpu` `some avg10`, not CPU utilization.

| Profile/run | Narrow fact total / first delta | Heavy 1 total / first delta | Heavy 2 total / first delta | Heavy 1 provider tokens in/out | Heavy 2 provider tokens in/out |
| --- | ---: | ---: | ---: | ---: | ---: |
| 16K | 8.151 / 5.234 s | 20.516 / 17.749 s | 20.693 / 18.004 s | 2,943 / 29 | 2,945 / 29 |
| 32K first | separately measured later | 3.770 / 0.205 s | 0.066 s / no delta, provider failure | 4,136 / 32 | NOT REPORTED |
| 32K repeat | 6.863 / 3.709 s | 29.812 / 26.365 s | 29.617 / 26.167 s | 4,136 / 32 | 4,132 / 32 |

The first 32K heavy turn was unusually fast with a warm existing model; the reloaded repeat is much slower. This small, cache-sensitive sample supports no general speed ranking. There was one provider-runtime failure in the six primary 32K turns, with **no application retry** because it was a provider failure, not invalid JSON. Successful final runs required one generation each, zero strict-JSON retries. The initial trial used an incomplete qualification harness (planning authority service omitted), so otherwise valid linked intents were incorrectly checked as unlinked and retried; [that diagnostic](evidence/profile-32768-initial-harness-error.json) is excluded from product validity and timing judgments. The harness was corrected before the matched comparison. No reproducible Dope product defect was found.

| Loaded profile | Peak sampled `llama-server` RSS | Minimum sampled host `MemAvailable` | Max sampled CPU `some avg10` | Output reserve/input-byte cap/composer budget |
| --- | ---: | ---: | ---: | --- |
| 16K | 20,277,704 KiB | 17,245,136 KiB | 0% | 1,024 / 14,592 bytes / 4,864 estimated tokens |
| 32K | 22,332,936 KiB | 14,917,368 KiB | 0.18% | 1,024 / 30,976 bytes / 10,325 estimated tokens |

RSS and available memory are sampled during turns, not peak allocation guarantees. Host swap was 0. CPU utilization, energy and GUI status/result visibility were NOT MEASURED. No out-of-memory or input-budget rejection occurred in these observed turns. The resource difference is comparable for this CPU-only parallel-4 setup, while cache state, Linux memory accounting and low sample count limit extrapolation.

## Gate decision and remaining work

| Assertion | Verdict | Basis / limit |
| --- | --- | --- |
| C5 same-artifact Q4 16K/32K comparison | **GREEN** | Actual independent loaded profiles, matched fixture/prompts, narrow fact and two heavy turns, plus bounded 32K repeat. This is not a reliability benchmark. |
| C6 effective context and decision-changing answer | **GREEN** | Direct serialized-message inclusion/omission, ref byte counts and source hashes; 32K no-go versus 16K conditional answers. Exact revision citation remains unproven. |
| C9 latency/TTFT/retry | **GREEN for measured backend/provider scope** | Adapter first-delta, backend total and strict JSON/provider retry outcomes recorded. Internal engine TTFT and UI first-visible timing are NOT MEASURED. |
| C10 usage/resources/headroom | **GREEN for sampled host** | Provider-reported successful usage, failure marked unavailable, sampled RSS/available memory/CPU pressure, loaded output reserve and budgets. No capacity guarantee beyond this host/workload. |

**Operating conclusion:** 16K is sufficient for the tested compact selected-checkpoint fact question, but not this source-heavy current canary decision. 32K materially improves that decision because it contains the late blocker and produced the correct no-go answer in three successful heavy turns. It also had one provider failure; C7/C8 in Group 2 must determine longer-Chat reliability and strict-output behavior. Neither profile proved dependable revision citations. The brief fully fits at 32K, so **no genuine >32K/64K requirement was found**; C12 is not triggered. No 64K profile was loaded. No global context default is selected.

Focused tests: `node --test` for composer, Roadmap Chat context, local planning JSON, conversational provider and Roadmap integration **25/25 passed**. Affected extension build `corepack yarn workspace @dope/theia-extension build` passed. No full `npm run check` ran. Product repair SHA: **none**. R2, R3, R4 browser and prior R5 C1–C4 producers are unchanged, so no source seam was invalidated; their recorded scopes stay as before.
