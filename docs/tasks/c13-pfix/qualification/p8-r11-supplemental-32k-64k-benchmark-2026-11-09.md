# c13-pfix P8-R11 supplemental 32K/64K benchmark — 2026-11-09

**Result: benchmark executed; Assessment NOT GREEN.** By a new owner instruction after the original P8-R11 stop, two fresh connected-browser protected Assessments were run with GPT-OSS 20B at 32,768 and 65,536 loaded context. Both used a 4,096-token Dope output reserve. Both stopped with saved `tool_protocol_unknown` before `assessment_finish`; neither reached its output ceiling. This is evidence about the two configurations, not proof that context capacity caused or solved the transport failure. The original [P8-R11 report](p8-r11-context-output-capacity-2026-11-09.md) and its PARTIAL / NOT GREEN verdict remain unchanged.

## Fixed source and setup

- Entry and final **product** source: `868e428d7e7e85589dce0c9133db5e8d87bc767c`, product version `0.13.11`. Entry repository HEAD `8b4509b12fc1c2569d9dfcfed8d56a81e32aa8ed` includes only the earlier evidence report on top of that product source. No product code, Assessment architecture, Pi continuation logic, model defaults, or fixture source changed during this benchmark.
- Dedicated browser backend `http://127.0.0.1:3002`, connected Codex in-app browser, local LM Studio `openai/gpt-oss-20b` MXFP4 GGUF. Served artifacts stayed unchanged: frontend SHA-256 `dabbe8774c3e34596db1c560c578a3785753108c02b26020d0e11184bae19cb0`, backend `5e90ed57ad5e2ea42b258c5a7f79f5b4373ca9208bd88555f1af9299b425db69`, Pi worker `d3bb448df9ed2b2657f50cd102900b7ce9af5e6a80bb4517bf8078d847e88d17`.
- Fresh project copies `/tmp/dope-p8-r11-32k-4096` and `/tmp/dope-p8-r11-64k-4096` were cloned from the clean fixture without prior `.dope/` state. Each has fixture Git HEAD `fd46f7e1c740e386c265724c0d0b99e61b98a7b3`, package version `1.4.2`, and a passing initial `npm test` (**1/1** each). The same native `/prompt-ass clamp-api-correction ...` request from the original P8-R11 report was submitted verbatim in each fresh Chat. Both requested exactly `src/clamp.js`, `test/clamp.test.js`, `package.json`, `docs/late-guide.md`, and `RELEASE_NOTES.md`.
- The five tracked SHA-256 hashes were identical in the 16K, 32K and 64K fixtures: `src/clamp.js` `2866677a4450ab1204005da2ab0cf28e203a590b16a8755ec0f867c295ca0827`; `test/clamp.test.js` `c5faeb988f856efacf18a711239ef9d29ba3b9382f032980b3090351dd7ea696`; `package.json` `2a7e453fb2d7914158c7e72a2b66b27e162694200ed8caafa656c53ba6051c8a`; `docs/late-guide.md` `fd4d4c8f3d132b2875ee9fff6fdc6aa0b08d65ff61d4cb4f422857e442763767`; `RELEASE_NOTES.md` `a5b8f34b1383ec2bf8065b70e34f31a0bb6e8b373d6e2de00791a2e0dbf9d55d`.
- Both Chats pinned the same exact model connection `21d03643-2aca-407e-b090-af59979b6c2f`, output-limit policy **Ask**, input budget 8,192, output reserve 4,096, reasoning **Auto**, previous-message policy unchanged, and no additional model prompt tuning or tool permissions. The resolved provider reasoning level was not persisted. Both model runs were sequential, never concurrent.

## Resource and configuration checks

| Configuration | LM Studio requested and loaded | Dope-detected loaded context | Preflight/observed system RAM available | Disk/swap |
| --- | ---: | ---: | --- | --- |
| Original 16K baseline | 16,384 | 16,384 | 5.6 GiB before, 4.2 GiB after its run | 8.6 GiB free; no swap |
| 32K benchmark | 32,768 | 32,768 | 7.0 GiB after load, 4.7 GiB after run | 8.6 GiB free; no swap |
| 64K benchmark | 65,536 | 65,536 after AI Center refresh | 4.7 GiB before send, 4.2 GiB after run | 8.6 GiB free; no swap |

LM Studio's estimates were 14.01 GiB total/GPU memory for 32K and 16.39 GiB for 64K on the integrated AMD Radeon 880M; both loads succeeded under its resource guardrails. The 64K AI Center initially displayed cached 32K metadata, then displayed `context 65536 (loaded)` after Refresh Models; LM Studio's loaded-instance API also reported 65,536 before the turn. No memory exhaustion or resource-limit code was observed. These coarse system readings do not establish peak model memory. After the runs, the original 16K model load was restored and the dedicated port 3002 backend stopped. The pre-existing port 3000 backend and unrelated owner sessions were not changed.

## Saved execution comparison

| Run | Saved Chat / execution | Verified source coverage | Stage results | Last acknowledged broker operation | Finish, Continue, usage | Elapsed |
| --- | --- | --- | --- | --- | --- | ---: |
| Original 16K / 2,048 | `3a2220ab-41ac-4b06-be7d-5667c2f0c39c` / `cd223003-a981-4278-9ef3-02d23a2d0d69` | 4/5; full late guide | 4 accepted, 4 rejected (`ASSESSMENT_CITATION` once, `ASSESSMENT_UNSUPPORTED_SOURCE` three times) | Completed final guide `read_file`, request 3 / tool 16 | No finish; no Continue; provider tokens UNKNOWN | 87.7 s |
| 32K / 4,096 | `48ed222a-c62b-4efd-87bc-d44c1dc3bf51` / `6bd66cc6-1f71-429f-9f14-6223346b3348` | 4/5; full late guide | 3 accepted, 1 rejected (`ASSESSMENT_UNSUPPORTED_SOURCE`), 1 idempotent | Completed final guide `read_file`, request 3 / tool 16 | No finish; no Continue; provider tokens UNKNOWN | 85.8 s |
| 64K / 4,096 | `c8578891-c8e3-4c89-b656-856dff3d1b7e` / `5b10f2c2-7746-4791-8b78-374882d8d6ec` | 1/5; only `src/clamp.js` | 1 accepted, 0 rejected | Completed `search_paths`, request 3 / tool 6 | No finish; no Continue; provider tokens UNKNOWN | 36.3 s |

The 32K run read the full guide in pages 0–4,096 and 4,096–6,584, after one failed continuation attempt and a successful hash-bound retry. It never read `RELEASE_NOTES.md`. The 64K run completed the clamp source read and one observation, then had a denied `read_file` followed by completed `list_files` and `search_paths`; list/search were **not** counted as source inspection. Its other four requested files were unread. In both new executions, the saved tool-failure receipt has `brokerResultAcknowledged: true`, `failureCode: tool_protocol_unknown`, and the last confirmed operation shown above. The underlying worker exception was not saved, so the report does not assign the failure to any particular read, search, citation, context limit, or provider error.

Both new assistant executions are saved as `failed`, with blocked Prompt Stack Draft cards and no sealed AssessmentRecord. The 64K blocked card survived a browser reload. No `assessment_finish`, completed draft card, `/prompt-plan`, output-limit pause, Stop/Continue decision, canonical `docs/tasks/clamp-api-correction/` publication, Work Run, Roadmap award, Gate GREEN, or Phase progression occurred. Provider input/output/reasoning usage was not persisted for these failed executions: **UNKNOWN, not zero**. The fixture tracked files stayed clean; saved `.dope/` Chat and draft evidence remains in each disposable project.

## Interpretation

The 32K run matched the 16K run's 4/5 coverage and final acknowledged guide read, while the 64K run stopped earlier. All three failed with the same broad `tool_protocol_unknown` code, and none reached an output segment limit. The 16K comparison also differs in output reserve (2,048 versus 4,096), so it cannot isolate context from output capacity. The 32K and 64K runs hold output reserve fixed, but a single run per configuration plus the unresolved transport failure cannot establish a reliable context effect, speed ranking, or successful capacity recommendation. Increased capacity did **not** complete this Assessment in the observed runs.

The actionable follow-up is a separately scoped diagnosis of the Pi worker/host `tool_protocol_unknown` boundary, retaining the safe last-acknowledged broker details and exact worker failure where possible. Do not patch or relabel these benchmark runs retroactively. P8-R11 and the broader c13-pfix stack remain **NOT GREEN**; Plan, Write, native review, guarded publication, P7 gaps, and full qualification remain separate.
