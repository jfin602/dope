# c13-pfix P8-R11 — GPT-OSS context and output capacity qualification, 2026-11-09

**Verdict: PARTIAL / NOT GREEN.** The required 16,384/2,048 baseline ran in a connected Codex browser, but a saved `tool_protocol_unknown` Pi transport failure stopped the protected Assessment after four fully inspected files. The campaign stopped under the task's serious-transport-failure rule. Test A and Test B were not run, so this report makes no claim that more context or output capacity improves completion. Optional Test C was not run. No Assessment was sealed.

## Source, environment, and fixture

- Entry and final **product** HEAD: `868e428d7e7e85589dce0c9133db5e8d87bc767c`; clean `main` aligned with `origin/main` at entry. Product version `0.13.11`. No product source or version change was made. The only repository change for this qualification is this report.
- Read BOOT, AGENTS, workflow, ADR 0055/0056, the named prompt authoring chain contract, and P8-R9/R10 reports. Their verdicts and executed prompts remain unchanged.
- Served the existing compiled source from a dedicated Theia backend at `http://127.0.0.1:3002`, leaving the owner's port 3000 backend alone. Connected Codex in-app browser, fresh project `/tmp/dope-p8-r11-baseline`, fresh Chat `3a2220ab-41ac-4b06-be7d-5667c2f0c39c`, execution `cd223003-a981-4278-9ef3-02d23a2d0d69`. Frontend SHA-256 `dabbe8774c3e34596db1c560c578a3785753108c02b26020d0e11184bae19cb0`; backend `5e90ed57ad5e2ea42b258c5a7f79f5b4373ca9208bd88555f1af9299b425db69`; bundled Pi worker `d3bb448df9ed2b2657f50cd102900b7ce9af5e6a80bb4517bf8078d847e88d17`. These match the R10 final served artifacts.
- The tracked-clean fixture was freshly cloned from the R10 fixture, excluding its `.dope/` state. Fixture Git HEAD `fd46f7e1c740e386c265724c0d0b99e61b98a7b3`, package version `1.4.2`, ESM. `npm test` passed **1/1** before the run. Canonical `docs/tasks/clamp-api-correction/` output was absent. Only untracked `.dope/` Chat and draft evidence appeared during the run; tracked source remained clean.
- Preflight: 30 GiB system RAM, 5.6 GiB available, no swap, 8.6 GiB free disk (94% filesystem use). The loaded model was local LM Studio `openai/gpt-oss-20b`, MXFP4 GGUF, one instance, 16,384 context, parallelism 1 and idle before the baseline. LM Studio estimated 14.01 GiB total/GPU memory for 32,768 context and reported it might load within its guardrails. This estimate was not treated as authorization to proceed past the transport stop. After the baseline, available system RAM was 4.2 GiB and disk free remained 8.6 GiB; the model was idle. No operating-system, swap, BIOS, or LM Studio global setting was changed.
- Dope AI Center showed `ready · 1 usable model` and detected `openai/gpt-oss-20b · context 16384 (loaded)`. Chat pinned that exact connection/model, generation-limit policy **Ask**, input budget 8,192 and output reserve/segment ceiling 2,048. Chat reasoning was **Auto**; LM Studio advertised `low` as model default, but the resolved level for this failed execution was not saved. The standard request was submitted verbatim through native Chat. No model-specific tuning or additional permissions were applied.

| Tracked fixture file | Bytes | SHA-256 |
| --- | ---: | --- |
| `src/clamp.js` | 89 | `2866677a4450ab1204005da2ab0cf28e203a590b16a8755ec0f867c295ca0827` |
| `test/clamp.test.js` | 264 | `c5faeb988f856efacf18a711239ef9d29ba3b9382f032980b3090351dd7ea696` |
| `package.json` | 118 | `2a7e453fb2d7914158c7e72a2b66b27e162694200ed8caafa656c53ba6051c8a` |
| `docs/late-guide.md` | 6,584 | `fd4d4c8f3d132b2875ee9fff6fdc6aa0b08d65ff61d4cb4f422857e442763767` |
| `RELEASE_NOTES.md` | 147 | `a5b8f34b1383ec2bf8065b70e34f31a0bb6e8b373d6e2de00791a2e0dbf9d55d` |

The guide's late acceptance section begins beyond byte 4,096. The two accepted broker pages covered 0–4,096 and 4,096–6,584, so those bytes were actually read before the transport failure.

## Controlled comparison

| Configuration | Requested / loaded / Dope context | Output ceiling | Outcome | Coverage | Stage results | Continue | Duration / tokens |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| Baseline | 16,384 / 16,384 / 16,384 | 2,048 | **FAILED** `tool_protocol_unknown` | 4/5 | 4 accepted, 4 rejected | 0; no output-limit pause | 87.7 s; provider usage **UNKNOWN** |
| Test A | 32,768 / not loaded / not detected | 2,048 | **NOT RUN** after shared transport failure | N/A | N/A | N/A | N/A |
| Test B | 32,768 / not loaded / not detected | 4,096 | **NOT RUN** after shared transport failure | N/A | N/A | N/A | N/A |
| Optional Test C | 65,536 / not loaded / not detected | 4,096 | **NOT RUN**; optional and campaign stopped | N/A | N/A | N/A | N/A |

No configuration comparison is possible on this evidence. The 32K resource estimate is a preflight observation, not a completed configuration or an Assessment result.

## Baseline broker and Assessment evidence

- `assessment_status` ran first. The draft requested exactly the five named paths. Brokered `read_file` completed `src/clamp.js` 0–89, `test/clamp.test.js` 0–4 then 0–264, `package.json` 0–118, and `docs/late-guide.md` 0–4,096 then 4,096–6,584. One guide continuation attempt failed before the corrected continuation succeeded. The second guide page used the source-hash continuation. No list/search call counted as inspection. `RELEASE_NOTES.md` was not read. Coverage progressed to 4/5, with one requested source remaining.
- Four source-backed observations were accepted: direct `Math.min`/`Math.max` scalar implementation, finite-value test, ESM package declaration, and guide source. Four `assessment_stage` calls were rejected: one `ASSESSMENT_CITATION` and three `ASSESSMENT_UNSUPPORTED_SOURCE`. The model corrected enough calls to retain four accepted observations; the saved stage receipts show prior findings preserved after each rejection. Preservation, dependencies, risks, scope, and T1/T2/T3 were never staged. The accepted guide observation cites its heading; the late acceptance criteria were read but not staged as findings before failure.
- The last confirmed broker operation was a **completed** `read_file` for the final guide page, request ID 3, tool ID 16; the saved tool-failure receipt says `brokerResultAcknowledged: true`. The next failure is classified `tool_protocol_unknown`. The saved record does not identify the underlying worker exception, so this report does not attribute it to model repetition, an invalid citation, memory pressure, or the earlier R9/R10 Continue defects.
- Execution started `2026-11-09T14:44:44.582Z` and failed `14:46:12.248Z`. Saved assistant status is `failed`; no provider token usage was persisted, so input, output, reasoning, and total tokens are **UNKNOWN**, not zero. There was no output-limit pause and no Continue control/action in this run. Same-session Continue remains qualified only for the R10 ordinary-Chat replay, not for this protected Assessment.
- The blocked Prompt Stack Draft card remained visible after browser reload, showing 4/5 inspected and four verified findings. No `assessment_finish`, sealed AssessmentRecord, completed draft card, or `/prompt-plan` availability was observed. No canonical publication, Work action, Roadmap award, Gate GREEN, or Phase 13 progression occurred.

## Decision and follow-up boundary

P8-R11 is **PARTIAL / NOT GREEN**: the required context/output comparison was interrupted by a serious transport failure on the baseline, and no real protected Assessment finished. The task's failure policy required stopping the campaign, so no 32K load or second experiment was attempted. There is **no evidence-based recommended higher context/output configuration** yet. Keep 16K/2,048 only as the last observed ordinary-Chat same-session Continue configuration from R10; it is not an Assessment recommendation.

The next targeted correction should identify the exact `tool_protocol_unknown` worker/host failure following an acknowledged broker result, then requalify a complete five-file protected Assessment on one unchanged product source before resuming the controlled capacity comparison. R9's historical first-Continue cause remains unknown. Plan, Write, native review, guarded publication, outstanding P7 cases, native Electron parity, and full c13-pfix qualification remain separate. Stop after P8-R11; do not start P8-R12 automatically.
