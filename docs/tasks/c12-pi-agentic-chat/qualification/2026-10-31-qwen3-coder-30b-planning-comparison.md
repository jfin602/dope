# C12 Qwen3-Coder-30B Planning capability comparison — 2026-10-31

**30B PLANNING — NOT GREEN.** One real Qwen3-Coder-30B-A3B-Instruct Q4_K_M Planning turn completed in the Codex in-app browser. Pi inspected the disposable project and returned a schema-valid JSON plan, including `question` and both steps' `reuse`. Dope rejected the plan; no typed pending proposal or ChatPanel review card was created. The model omitted the required `node:test` case, and the existing dependency validator also produced a false positive. Product version remains `0.12.7`. This result does not close C12 or authorize `c12-docs-workflow`.

## Source, fixture and preflight

- Repository HEAD was `f8abb327bf0b24199f19a73b14578c8c12eb332b` on `main`, one commit ahead of `origin/main`, with a clean working tree before the run. No production code, test, prompt, schema, validator, retry or Pi setting was changed for this comparison. `BOOT.md`, `AGENTS.md`, `docs/workflow.md`, the [final 9B closeout](2026-10-31-final-planning-repair-closeout.md), and the [latency recovery](2026-10-31-pi-planning-tool-latency-recovery.md) were consulted.
- The browser at `http://127.0.0.1:3016` served the existing final build: frontend `bundle.js` SHA-256 `2bd2b2381aa0ae0f2a1a4fc958595cb768f14a1b1d402c615bd99f660a7bb6c0`; backend `main.js` SHA-256 `8692c530c5763322cfc096c5ea04468e65356ce16307aa71a197cf0ddadbf3ef`. The served frontend hash matched the local bundle. Both hashes match the final-source build recorded in the 9B closeout; that source is now committed at this clean HEAD. No rebuild or source change occurred between verification and the live turn.
- The fresh disposable fixture was `/tmp/dope-c12-qwen30-z4N2L5`. Its `src/counter.js` SHA-256 was `619a46d55f9b64f4ddb40b9ae15445c8eebe3aac51d77e50353a096d13f62ba2`; `package.json` SHA-256 was `7e4e07031fe4adadc32b609e00a8c9126c2d5bf9707f2e1428db9526100e3f68`. These match the final 9B fixture. The request was copied exactly from that run's saved user message, with no manual source attachment. The actual existing Chat Planning entrypoint recognized its lead-in.
- LM Studio initially had no loaded model. It loaded exact identifier `qwen3-coder-30b-a3b-instruct@q4_k_m` from the 18.63 GB Q4_K_M variant at context 16,384, parallel predictions 1, GPU offload 0% (CPU inference), endpoint `http://127.0.0.1:1234/v1`. The load estimate was 18.71 GiB and the load completed in 29.28 seconds. No other model was loaded. AI Center showed this model as the sole usable model on the selected LM Studio connection and its synthetic Coding Agent tool check passed. The Chat turn explicitly selected it, with Commands `Ask`; the saved execution confirms `local/qwen3-coder-30b-a3b-instruct@q4_k_m` and `resolutionSource: explicit-turn`. Pi offered `read_file`, `list_files`, `search_paths`, `search_text`, and `run_command`. Inference settings stayed fixed during the turn.
- The machine had 30 GiB RAM and no swap. During generation, `MemAvailable` was about 14 GiB; no resource exhaustion, swapping, transport failure or timeout was observed. This CPU-only, 30B Q4 setup differs materially from the prior 9B model hardware load. The 9B report records 16,384 context and parallel 1, but does not establish its quantization or GPU offload for this direct comparison.

The durable saved turn is [the Chat evidence](evidence/2026-10-31-qwen30-chat.json), SHA-256 `95fa0f477b0589c1925de4581a1bc2bbde775c466eeaec79dbabb9782ff1b5cf`. LM Studio's interval is in `/home/jfin/.lmstudio/server-logs/2026-10/2026-10-31.1.log`, local time 07:26:25–07:29:45. The saved Chat ID is `e67b60f0-8d33-4c6c-8bd1-77042333fd31`; execution ID is `4fb411ba-5ad2-4bee-9389-974ae819182b`.

## One live Planning turn

The turn began `2026-10-31T12:26:24.074Z` and failed `12:29:45.218Z`: **201.14 seconds**. The first Planning model request started at about `12:26:35Z`, after the existing two-request model/tool capability check. Its first response ended at `12:26:47Z` with a project tool call, so submit-to-first-tool latency was approximately **23 seconds** (LM Studio timestamps have one-second resolution). Pi completed 13 file/list/search calls, including real reads of `package.json` and `src/counter.js` with the hashes above, and continued after tool results. Three `run_command` requests were denied by Dope because the developer forbade command execution; none ran. Sixteen tool steps appeared in ChatPanel. The first raw final attempt was not separately persisted; Dope's existing bounded correction led to the saved final answer. This is one user-initiated run, not a repeated benchmark.

The saved final answer parses as JSON and passes `validImplementationPlan` on the exact built source. It includes `question: ""`, `reuse` in both steps, the requested `increment(1) returns 2`, `node --test src/counter.test.mjs`, and no Jest or Vitest proposal. It describes a “built-in assertion syntax” test but never specifies `node:test`; therefore it does not demonstrate a Node test-runner test case. It also says the test file is `counter.test.mjs` in the project root while its deliverable and validation command use `src/counter.test.mjs`. The plan's success criterion says it “does not introduce any new dependencies.” The model requested three prohibited commands during investigation, although it did not claim any ran.

Dope displayed `Unvalidated local planning output` and the failure `Requested Node test runner is not implemented by a node:test case and node --test validation` plus `Proposed new dependencies despite: Do not introduce Jest, Vitest or any new dependency`. A read-only replay of `validImplementationPlan` returned `true`; `planExplicitConstraintViolations` returned those two violations. The second is a **validator false positive**: `chat-plan-requirements.ts` searches for `introduce ... new dependencies` but its negation filter recognizes `no`, `without`, `avoid`, and `zero`, not “does not.” The statement is a prohibition, not a proposed dependency. This false positive does not change the overall verdict because the `node:test` omission independently blocks acceptance. No output was edited or filled in on the model's behalf.

The saved execution has `status: failed` and no proposal ID. ChatPanel displayed the error and project activity, with no review card. `.dope/roadmap-drafts.json` retained a noncanonical `planOnly` owner; no canonical Roadmap or project source file was changed. The two fixture source hashes stayed identical and no test file appeared.

## Timing and comparison

The LM Studio interval contains 14 Planning inference requests across the original and built-in correction attempts, plus four synthetic capability-check requests. Across the 14 Planning requests, LM Studio recorded **5,160 incremental prompt-evaluation tokens**, **1,359 generated tokens**, **53.66 seconds prompt evaluation**, and **126.01 seconds generation** (179.67 seconds total). The four capability-check requests added approximately **18.10 seconds**. These are per-request processing counts, not a deduplicated whole-conversation input-token count. The first Planning request processed 1,455 prompt tokens and generated 20 tokens. Reasoning-token and visible-token splits were unavailable; Pi registered this local model with `reasoning: false`. Exact individual tool execution times were not persisted. The roughly 3.4-second difference between total turn time and measured LM processing includes tool, transport, validation and application overhead, so it cannot be assigned solely to tools.

| Metric | Qwen3.5-9B final run | Qwen3-Coder-30B run |
| --- | --- | --- |
| Model/context configuration | `qwen3.5-9b`, 16,384 context, parallel 1; quantization/offload not established in final report | `qwen3-coder-30b-a3b-instruct@q4_k_m`, 16,384 context, parallel 1, CPU, GPU offload 0% |
| First-tool latency | Approximately 34–40 s | Approximately 23 s |
| Successful tool calls | 10 file/list/search; 2 commands denied | 13 file/list/search; 3 commands denied |
| Total inference time | Approximately 268.83 s in the reported LM interval, including eligibility/corrective requests | Approximately 197.77 s, including four capability-check requests; 179.67 s Planning only |
| Total turn time | 284.63 s (4m44s) | 201.14 s (3m21s) |
| Schema validity | FAIL: missing mandatory `question` | PASS: strict JSON, `question`, and each `reuse` present |
| Requirement compliance | FAIL: `console.assert` / plain `node`, without the requested runner | FAIL: no `node:test` case; conflicting test-file location; three forbidden command attempts denied |
| Pending proposal created | No | No |
| Review card visible | No | No |
| Overall Planning outcome | NOT GREEN | **NOT GREEN** |

The 30B run shows better structured-envelope compliance and a shorter first-tool and total turn time in this single fixture. Both models autonomously used file tools and continued. The 30B result does **not** establish better developer-requirement adherence or practical end-to-end success: it missed the runner's test API, requested forbidden commands, and never reached review. The shorter time is an observed result under different model and hardware load, not proof that model size alone caused it. The 9B model's structured-output limit is plausible but **not isolated as the sole cause**; Dope's false-positive validator also contributed to this rejection.

## Gate disposition and architectural follow-up

| Gate | Result |
| --- | --- |
| Real 30B inference; autonomous inspection; successful file tools; continuation; completed final output | **PASS** |
| Authoritative JSON envelope; mandatory `question` and step `reuse` | **PASS** |
| Node built-in test case and exact developer requirements | **FAIL** |
| No prohibited framework in final proposal | **PASS** |
| Final Dope validation; typed pending proposal; ChatPanel review card | **FAIL** |
| No canonical source or Roadmap mutation | **PASS** |

The first functional failure is **model generation** of a plan without a `node:test` case. The dependency rejection is a separate **validator semantics** defect. Resource exhaustion is unsupported by the observed memory and completion evidence. No source repair or rerun is part of this comparison.

The pinned Pi SDK already supports host-defined `customTools` with TypeBox parameter schemas and `execute()` handlers; Dope uses that mechanism for its file and command tools in `packages/pi-runtime/worker.mjs`. It does **not** currently register a proposal-submission tool. A future, separately approved design could let Pi submit typed plan fields through such a tool rather than a large raw final JSON answer. This would make field presence and shape checkable at the tool boundary, but the model would still have to satisfy `node:test` and the other semantic requirements. Dope must revalidate the submitted data, bind it to verified source and owner revision, persist only a pending preview, and require the existing ChatPanel human approval. The tool must have no project-write or Roadmap-apply effect. A narrow validator correction for negated dependency statements should be assessed separately; neither change was made here.

**Final disposition: QWEN3-CODER-30B PLANNING — NOT GREEN.** C12 remains NOT GREEN, the owner-native and other mandatory gates remain open, and `c12-docs-workflow` remains unstarted. Stop after this one primary live run; no commit or version change.
