# GPT-OSS 20B owner observation — two-Phase Roadmap trial (PARTIAL / NOT GREEN)

**Observed:** 2026-11-04 (owner report and pasted Dope execution transcript). **Disposition:** **PARTIAL / HOLD — finish failed, no final response.** This is an independent model-comparison observation, **not** a replacement, amendment, or PASS of the [Qwen3.5-9B P3 closeout](2026-11-04-p3-connected-browser-closeout.md). No code, runner, browser automation, or independently inspected host logs were used to author this record.

## Request and environment — evidence boundaries

- The owner reported loading **GPT-OSS 20B** in the local inference environment, then starting Dope. The exact served model ID, quantization, reasoning effort, context window, GPU offload, LM Studio logs, installed binary/source hashes, HEAD and dirty state were **not captured**. Do not assign the Qwen fixture's source hashes or configuration to this run.
- The prompt supplied in Chat asked for a TypeScript/PixiJS tower-defense prototype with exactly two ordered Phases: (1) fixed waypoint-path rendering and (2) one enemy following the path and stopping at the endpoint; each Phase with one Gate and two testable Criteria; no code or project-file modifications. The prompt preserved the P3 *intent* but was **not verbatim identical** to the archived P3 command. The actual top-level command form in Dope was not independently recorded.
- The user pasted a Dope trace: execution ID `8cdf4d34-f9de-431c-b995-713d4214b38a`, message ID `6a8c8003-da9f-4829-a0e7-81642a47820e`. The execution is labeled `failed`.

## Observed progression and failure

| Event | Evidence | Disposition |
| --- | --- | --- |
| First `roadmap_phase` | Transcript says `completed` | Tool success reported; authoritative server receipt not independently captured |
| Second `roadmap_phase` | Transcript says `completed` | Tool success reported in the same execution |
| Canvas progress | Owner saw both Phases on Roadmap | Visually observed by owner; exact Gate/Criteria counts and stage lease not independently verified |
| First `roadmap_finish` | Transcript says `failed` | Owner estimates first finish attempt at about 30 seconds after start |
| Second `roadmap_finish` | Transcript says `failed` | No success or review-ready outcome |
| Final assistant answer | None | Execution ended failed without useful final Chat response |

The model's visible reasoning speculated that an `unresolved` list might be needed, then retried. **This is not the backend error message or verified root cause.** Exact tool arguments, schema, validation error, scope ledger, StageOwner snapshot, provider finish reason, retries/usage and whether the provisional state remained non-applicable were not captured. Do not claim a schema bug, model bug, or controller bug until inspected.

## Carefully bounded Qwen comparison

The separately documented Qwen3.5-9B P3 run records:
- Both Phases staged: **109.0 s** from Chat acceptance.
- First successful `roadmap_finish` call: **124.2 s** from acceptance.
- Review-ready: **142.9 s** from acceptance.
- Its two-Phase live workflow reached review-ready and owner selective Apply, but **P3 remained PARTIAL / NOT GREEN** because a focused source-drift test failed and several independent cases were unobserved.

For GPT-OSS, the owner observed both Phases on the canvas and a **first, failed** finish attempt by roughly **30 seconds**. Comparing the closest named milestone, **124.2 / ~30 ≈ 4.1x**, an approximate first-finish-attempt timing advantage only. These were not identical prompt strings, the GPT-OSS timestamp is estimated, host/model settings are unverified, and the model did not reach review-ready. **Do not describe this as a 4.1x completed-task speedup or proof of better overall reliability.**

## Targeted next investigation (separate owner-approved manual task)

1. Inspect the exact failed `roadmap_finish` arguments and registered native schema, worker tool result/error, backend validation branch, required staged counts and scope ledger, and project/source/revision/lease state. Distinguish valid rejection from a controller or adapter defect; preserve structural/safety validation.
2. Ensure a failed finish produces a truthful structured tool error (including actionable missing/invalid fields when safe), bounded correction opportunity, correct terminal status, invalidated approval authority on failed/incomplete state, and a **visible actionable Chat terminal response**, never silent success or fabricated review-ready state.
3. Add deterministic good-finish and invalid-finish/failed-retry regressions, including Qwen compatibility and stale/source/lease protections. Do not add a GPT-OSS-only parser, alternative generator, disabled validation, or extra freeform/RM1 fallback.
4. After a source-bound fix is separately authorized, perform **one** controlled GPT-OSS two-Phase retest using the exact archived P3 command and record served model settings, HEAD/diff/bundle, full tool arguments/errors, authoritative stage receipts, timings, counts, no-write-before-Apply, review outcome, and final assistant response. Do not begin full tower-defense MVP without separate approval.

**No GREEN claim, default-model change, product-version bump, source repair, automatic rerun, or implementation-prompt authoring follows from this observation.**
