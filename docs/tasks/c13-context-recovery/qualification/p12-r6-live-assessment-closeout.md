# P12-R6 — live GPT-OSS Assessment closeout

**2026-11-09 local / 2026-11-10 UTC verdict: NOT GREEN.** The first preflight was BLOCKED because no model was loaded. After the owner loaded GPT-OSS 20B, the same R6 task resumed and made its one permitted native `/prompt-ass` attempt. The model requested the guide's next page at byte **4,098** instead of the verified **4,096**; Dope denied that wrong-offset request without inspection credit. The operator canceled the still-running turn after initially mistaking the generic read failure for rejection of a valid continuation. The saved record corrected that inference. There was no valid 4,096 continuation, completed Assessment or retry. Historical P12/R3 NOT GREEN, R1/R2 scoped PASS, R4 PARTIAL, and R5 source-continuation PASS / compatibility PARTIAL remain unchanged.

## Initial unloaded-model preflight

- Product HEAD throughout: `b8c4e8fb8e108c5dd2eb1ec0cfd53631f6ff7b92` on `main` (`r5`), also `origin/main`; `package.json` version `0.13.11`. Entry worktree contained only this untracked R6 report from the initial preflight. R5's five source/test changes and its report are committed in this HEAD, with parent `b9a28434050d5151ba9a5672cb99dcb55eb22943`. No owner changes were present or overwritten.
- Committed source SHA-256: `assessment-read-receipts.ts` `03a1bc02b8b5b6294f2b16e72c9bdcce76e69ac5b247d92d46f6c679b8499f6e`; `chat-backend.ts` `8515fe2f4304298c45d328180af98be9bd8145936d5b048ada8b81686928f2e9`; `incremental-assessment.ts` `52505d7bad550a81c46c76c9b38b8d177fcacd06410a82d0565c4b786a68c140`; bundled `worker.mjs` `d192fe121a6b60df0fa8e6376ef45a21748de2f84dbb5ce2687b1f12e5564965`.
- Existing compiled extension output contains the R5 receipt and broker continuation symbols and has file modification times after the relevant source files. SHA-256: `lib/node/assessment-read-receipts.js` `67f2dc720d5dc7321632f37c12d9b65e9e82f9b3a975b31d3e58faaf9b20a3a8`; `lib/node/chat-backend.js` `5843eafa488d4e9f8a0501fcf2cbf2bb1d049fd83244f9cfcbb99eac19bb961f`; `lib/node/incremental-assessment.js` `8279170c1c99f852dcb66fca1813e98ffec3f6f6b9f32ed8afc3adf02d2e43be`. Presence and timestamps are not a served-build equivalence proof.
- Existing browser frontend `apps/browser/lib/frontend/bundle.js` SHA-256 `5bc58abeaed97e7be5872a1de45994c3a5250b2d4e87a5f2bfa30506761c32fd`; backend `apps/browser/lib/backend/main.js` `3ab19217ee8236af08b5009fa4581a0853d1130e8c570ce9662f4100a299f8f9`. Both were built before R5 and are the earlier R3 bundle hashes. They are **stale for R5**, so no browser was served and no exact-served-backend claim is made. An affected browser build remains necessary if preflight resumes.
- The R5 report records affected extension build PASS, focused matrix **125/125 PASS**, direct drift/receipt fixture **3/3 PASS**, and `git diff --check` PASS. R5 is now committed with no subsequent source edit. Those results were not rerun because the required provider entry condition failed before serving a candidate. Critical safety coverage remains the prior source-bound R5 evidence, not new R6 validation.
- LM Studio listened on `127.0.0.1:1234`. Both `lms ps` and `/api/v1/models` reported **zero loaded instances**. The installed `openai/gpt-oss-20b` entry advertised GPT-OSS, MXFP4, tool use, and reasoning options Low/Medium/High with default Low, but `loaded_instances: []`; thus the expected **16,384 context and parallelism 1 are not current settings**. Dope AI Center was not opened because no current served Dope backend existed. Available RAM was about **15 GiB**, root disk about **7.5 GiB** free (95% used), and swap **0**. No competing loaded model appeared; other provider clients were not independently assessed.
- Ports 3000 and 3002 had no listener. No browser tab was opened and no fixture was created for R6. The earlier R3 five-file fixture and hashes remain historical evidence, not fresh R6 verification.

## Initial preflight ledger (before owner load)

| Required observation | R6 result |
| --- | --- |
| Exact committed R5 source, unchanged version, clean entry | PASS |
| Existing owner-loaded 16,384/1 GPT-OSS instance | **BLOCKED: none loaded** |
| Current R5 browser bundle and exact served backend | BLOCKED: old bundle; no server started |
| Fresh tracked-clean five-file fixture and source hashes | NOT RUN |
| Connected browser Chat, selected/resolved settings, one `/prompt-ass` | NOT RUN |
| Five-file coverage, late-guide 0–4,096 and 4,096–6,584 continuation | NOT RUN |
| Stage accept/reject counts, `assessment_finish`, one sealed record, checked Plan availability | NOT RUN |
| Provider finish, peg-native classification, token usage, duration | UNKNOWN / no call made |
| Fixture unchanged, no canonical publication, Work or Gate award | No R6 fixture or execution existed; no such action was initiated |

No Chat, user-message, assistant-message, execution, draft, broker receipt, model-call, or engine-task ID exists for R6. There is no R6 saved Chat or draft to inspect. The missing loaded model is an environment entry block, not an observed provider stream failure or Assessment failure. The source-continuation and GPT-OSS compatibility questions remain untested live on this committed R5 candidate.

**Initial stop:** No model was loaded or reconfigured and no browser/inference run occurred at this point. The owner then confirmed a load, permitting the one resumed attempt below.

## Resumed source, build and model lock

- The affected extension output contained R5 receipt/broker code. `corepack yarn workspace @dope/browser build` passed with zero browser/node errors before serving. Current frontend `apps/browser/lib/frontend/bundle.js` SHA-256 `5bc58abeaed97e7be5872a1de45994c3a5250b2d4e87a5f2bfa30506761c32fd` (unchanged because R5 is backend-only); rebuilt backend `apps/browser/lib/backend/main.js` `fa3adda8f99c6be1de2714c841d29ac695dd275ab67235f247435bf6c5d209d1`. The running listener at `127.0.0.1:3000` was PID 23642 executing this checkout's `apps/browser/lib/backend/main.js`. The HTTP-served `/bundle.js` hash matched the local frontend bundle. The connected Codex in-app browser opened `http://127.0.0.1:3000/#/tmp/dope-p12-r6-clamp-hQBYNQ`.
- R5 source was unchanged, so its recorded affected build, **125/125** focused matrix, **3/3** direct receipt/drift fixture and whitespace check remain the applicable critical-regression evidence. R6 rebuilt the served browser but did not repeat the full focused matrix or run a broad check.
- `lms ps` and `/api/v1/models` then showed one idle `openai/gpt-oss-20b` MXFP4 instance, context **16,384**, parallelism **1**, with no second loaded model. Provider metadata reported Low/Medium/High reasoning and default Low. Dope AI Center refreshed the existing LM Studio connection to `ready · 1 usable model`, with GPT-OSS context 16,384. No model, context, reasoning, template, parallelism, swap, runtime or global setting was changed here. Available RAM was about **13 GiB** before and **11 GiB** after; root disk about **7.1 GiB** before and **7.0 GiB** after, with no swap. No resource instability was observed.

## Fresh fixture and saved Chat

The earlier disposable `/tmp` fixture was no longer present at resumed preflight. A fresh tracked-clean five-file fixture was reconstructed from the exact R5 test fixture bytes and committed **only inside** `/tmp/dope-p12-r6-clamp-hQBYNQ` at fixture HEAD `39e771dce33866d03515dac04e3ed31c13a35113`. Its hashes match the R3/R5 baseline, package version is `1.4.2`, its one test passed, the guide is **6,584 bytes** with late acceptance after byte 4,096, and `docs/tasks/clamp-api-correction/` was absent. This fixture commit is not a product commit.

| Tracked fixture file | SHA-256 before and after |
| --- | --- |
| `src/clamp.js` | `2866677a4450ab1204005da2ab0cf28e203a590b16a8755ec0f867c295ca0827` |
| `test/clamp.test.js` | `c5faeb988f856efacf18a711239ef9d29ba3b9382f032980b3090351dd7ea696` |
| `package.json` | `2a7e453fb2d7914158c7e72a2b66b27e162694200ed8caafa656c53ba6051c8a` |
| `docs/late-guide.md` | `fd4d4c8f3d132b2875ee9fff6fdc6aa0b08d65ff61d4cb4f422857e442763767` |
| `RELEASE_NOTES.md` | `a5b8f34b1383ec2bf8065b70e34f31a0bb6e8b373d6e2de00791a2e0dbf9d55d` |

One fresh Chat selected the exact local model. Saved settings: **Managed** context, **Ask each time** at generation limit, **Auto** reasoning, normal Commands **Ask**, previous messages enabled. The model was pinned as Chat default and explicitly selected for the turn. The saved execution selected and used `local/openai/gpt-oss-20b` through connection `98c9cf59-9550-4e91-a63f-141f990d5913`, resolution `explicit-turn`. Auto maps to the provider's reported Low default under the current bridge; exact per-call reasoning and output allowance were not retained in the canceled execution and are **UNKNOWN**.

- Chat `39f992a0-42fe-4ac3-99f8-4ddddb1e6fd9`; user message `581cf6f9-4e04-4a5b-ab2b-37182d311b94`; assistant message `92350682-bf05-49f3-a38f-2104c2aa4f5e`; execution `df22adc9-8637-494c-a592-a458f57097a6`; draft `9e3ef02e-6686-41f5-944c-895f8891df35`.
- The sole protected command requested all five file reads, late-guide coverage, source-backed observations, scope, preservation, dependencies, risks, T1/T2/T3, and `assessment_finish` only after complete verification. No source body or synthetic finding was injected into Chat.
- Execution start `2026-11-10T02:21:27.925Z`; operator cancellation/finish `02:24:14.094Z`: **166.169 seconds**. Saved status and reloaded browser both say `cancelled`, with a blocked draft and no final response. Reload retained Chat, ordered tool transcript and draft. No Retry button was used.

## Broker, Assessment and provider evidence

The saved execution has **19** tool outcomes: `assessment_status` completed twice; six `read_file` calls completed (source 0–89, test 0–264, package 0–118, guide 0–4,096 twice, release notes 0–147); two reads failed argument validation; five `assessment_stage` calls were accepted and four rejected. The retained draft has four accepted observations and scope, with no preservation, dependencies, risks or T1/T2/T3. There was **no `assessment_finish` call**, sealed AssessmentRecord or checked `/prompt-plan` availability.

The guide's first verified page returned `nextOffset: 4096`. The model instead requested offset **4098** without a hash. Dope returned `SOURCE_IDENTITY_REQUIRED` at argument validation with `brokerExecuted: false` and no coverage credit. The other denied read was an offset-zero request with oversized `maxBytes`, correctly marked `INVALID_PAGE_SIZE`. The wrong-offset request is an invalid model argument: R5's receipt permits a hashless continuation only at the exact next offset. Because identity resolution precedes the offset-specific branch, the wrong-offset response used a misleading identity/start-at-zero message instead of an offset-specific explanation. The model became confused, reread the first guide page, and provisionally claimed all files had been read after reading release notes. A valid hashless 4096 request never occurred. The guide's final **2,488 bytes** remained unread; actual full coverage was **4/5**.

The operator initially inferred from the live generic rejection that a valid continuation had failed and canceled under the prompt's stop rule. The saved `offset: 4098` record corrected that inference. This operator stop is part of R6's outcome, not a provider failure, authority violation or invalid seal. Whether more time would have changed the result is unknown; the task forbids a fresh Assessment attempt.

LM Studio's local developer log for **20:21:29–20:24:14 America/Chicago** records 22 GPT-OSS chat-completion starts in that window, with up to **40 messages**, and no `common_chat_peg_parse`, peg-native or engine stream-error entry. Those starts cannot be mapped to exact Dope model-call ordinals from the retained safe evidence. Twelve engine task-release entries, including task **1798** at 20:24:14, report `truncated = 0`; the maximum logged `n_tokens` at release was 7,420, which is not a Dope provider-usage count. The canceled saved execution has no reliable per-call request bytes, output allowance, HTTP status, finish reason or provider token usage; those are **UNKNOWN**. A successful tool acknowledgement does not prove the next generation completed. No peg-native rejection or engine code 500 was observed before operator cancellation, and broader intermittent GPT-OSS compatibility remains an evidence gap.

The five tracked fixture hashes were unchanged afterward; only `.dope/` saved Chat/draft/runtime state is untracked. No canonical prompt directory or publication journal was created, no `/prompt-plan` or `/prompt-write` was submitted, and no Work grant/Run or Roadmap Gate/Phase award occurred. Product HEAD and version stayed fixed. R6 cannot be GREEN: full guide coverage, required stages, `assessment_finish`, one sealed record, checked Plan availability and a completed assistant execution were not demonstrated. Stop after this single run; do not treat the misleading error text or operator cancellation as permission to replay it.

After saved-state reload verification, the temporary Codex browser tab and Dope browser backend were closed; port 3000 had no listener. The owner-loaded LM Studio instance was left unchanged. The product report remains uncommitted.
