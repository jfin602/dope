# Qwen3.5-9B Planning completion recovery — 2026-10-30

**Disposition: PLANNING NOT GREEN.** This is a bounded C12 recovery result, not Phase 12 qualification or authorization for `c12-docs-workflow`.

## Source and scope

- Product base: `352904e2e986b151eeaff66bcecb56c73287d4ed`, version `0.12.7`. No commit or version change. The five uncommitted production/test files listed below have source diff SHA-256 `f69f6d5b80d3651441c712180ddd6deb3f4ded5f4af3d493dec302f644c2488b` at closeout.
- Saved prior Chat: `/tmp/dope-qwen35-planning-smoke-sw33FW/.dope/chats/folders/e0b8d850-3a9d-46c9-831c-0f8566414e67.5.4f77da5c-fffd-4506-ab4c-f3a2e6847057.json`. LM Studio log: `/home/jfin/.lmstudio/server-logs/2026-10/2026-10-30.1.log`.
- The original fixture retained a `planOnly` owner after the cancelled turn. A new Chat there failed **before inference** with `Stale or existing implementation plan owner`. To preserve that Chat and draft history, the one live model replay used a byte-identical fresh disposable fixture at `/tmp/dope-qwen35-planning-recovery-A9e2EN`. The two source hashes are `619a46d55f9b64f4ddb40b9ae15445c8eebe3aac51d77e50353a096d13f62ba2` (`src/counter.js`) and `4e8f2e1ca642e8bf3be41357b71deafa20b6c5171a91ceab5fc27792f83bacf6` (`package.json`). No tower-defense project was touched.

## Cycle 1: prior saved turn

The saved execution selected actual local `qwen3.5-9b`, loaded context 16,384, parallel requests 1. Its 11 generic tool events all completed. The first six calls produced the only distinct source evidence: root and `src` listings, exact reads of `src/counter.js` and `package.json`, and a no-match test-path search. The second root listing added nothing. After the first final inference ended at 21:40:01 local time, Dope recorded an `invalid-envelope` retry, started a fresh Pi session without corrective instructions, and repeated five tool calls before cancellation at 21:41:17. The first output was buffered and discarded, so its exact invalid field is unavailable. No transport failure or 16K context exhaustion appears in the event/log evidence.

Each row below is one model inference and its following tool result; times are local Chicago time on 2026-10-30. Prompt and completion columns are token count / processing seconds from LM Studio. Tool execution itself was short relative to inference. `—` denotes no completed final or unavailable token count.

| Inference start–end | Requested tool and result | Prompt | Completion | Continuation |
| --- | --- | ---: | ---: | --- |
| 21:37:36–51 | `list_files .` completed | 1557 / 6.50 | 87 / 8.30 | More tools |
| 21:37:51–57 | `list_files src` completed | 112 / 0.66 | 54 / 5.34 | More tools |
| 21:37:57–21:38:03 | `read_file src/counter.js` completed, exact increment source | 108 / 0.70 | 48 / 4.79 | More tools |
| 21:38:03–11 | `read_file package.json` completed, ESM manifest | 178 / 1.02 | 70 / 7.06 | More tools |
| 21:38:11–27 | `list_files ""` completed, repeated root | 184 / 1.06 | 146 / 14.74 | More tools |
| 21:38:27–32 | `search_paths test` completed, no matches | 112 / 0.64 | 48 / 5.18 | Final attempt |
| 21:38:32–21:40:01 | No tool; final text failed strict envelope | 114 / 0.64 | 873 / 87.68 | Dope retried |
| 21:40:27–37 | `list_files .` completed, repeated | 4 / 0.15 | 106 / 10.49 | More tools |
| 21:40:37–44 | `list_files src` completed, repeated | 112 / 0.69 | 55 / 5.50 | More tools |
| 21:40:44–53 | Two `read_file` calls completed, repeated both source files | 108 / 0.66 | 84 / 8.39 | More tools |
| 21:40:53–21:41:06 | `search_paths test` completed, repeated no-match search | 351 / 1.63 | 119 / 11.79 | Final attempt |
| 21:41:06–17 | No tool; final generation still active at safe cancellation | — | — | Cancelled |

The **first failed transition** was `localPlanningJson` strict Planning envelope validation after Pi had produced a final answer, followed by an unhelpful fresh-session retry. The 11 calls were not 11 distinct useful inspections. The model was generating final text when cancelled. Its measured output was well within the 16K loaded context; the larger cost was roughly 10 tokens/second final generation and repeated synthetic capability checks.

## Cycle 2: focused source repair

- `packages/theia-extension/src/node/chat-backend.ts`: Planning instruction now names the investigation-to-final transition and compact exact JSON output. A schema retry may carry at most 1,800 bytes of the exact `read_file` results Pi already chose to inspect; further file tools remain available.
- `packages/theia-extension/src/node/roadmap-local-model.ts`: an invalid Planning envelope receives an explicit correction on its one bounded retry rather than repeating the same instruction.
- `packages/theia-extension/src/node/chat-plan-requirements.ts`: workflow wording is not scored as product capability. A specific requested capability following “prepare ... implementation plan for” is retained. This last narrow requirement-extraction correction was made **after** the live replay exposed an off-target Vitest/Jest plan; it has focused tests/build evidence but no subsequent live qualification.
- `test/unit/roadmap-local-model.test.ts` and `test/unit/chat-plan-requirements.test.ts`: focused retry and requirement-extraction regressions.

No tool was hidden, no global tool count imposed, no provider switched, and no approval or Roadmap authority was relaxed.

## One live browser qualification

The rebuilt Dope browser backend ran at `127.0.0.1:3011`; the original `3010` session remained intact. In the Codex in-app browser, AI Center reported `qwen3.5-9b` ready at context 16,384 and a successful synthetic Coding Agent tool loop. A fresh saved Chat explicitly selected `LM Studio · qwen3.5-9b`, Commands `Ask`, and no manual file attachments. The supported Planning lead-in was followed by the user's exact specified request. This was a Planning turn, not ordinary Chat prose.

The live turn began `02:55:10.281Z` and persisted its failure at `02:59:01.454Z`: **231.17 seconds**, within the owner's raised 240-second ceiling. First tool latency was **46.55 seconds**. Pi requested two real generic `read_file` calls, `src/counter.js` and `package.json`, in one model response; both completed without truncation in about 8 ms, with 306 and 332 result bytes. Pi consumed both results and continued to final generation without additional exploration. It made **2 tool calls**, with no duplicate read.

| Model phase | UTC interval | Prompt tokens / time | Completion tokens / time | Result |
| --- | --- | ---: | ---: | --- |
| Investigation/tool request | 02:55:35–56 | 1436 / 6.02 s | 154 / 15.14 s | Both `read_file` calls |
| First final | 02:55:56–02:56:56 | 351 / 1.52 s | 583 / 58.36 s | Completed `stop`; rejected as `invalid-envelope` |
| Corrective final | 02:57:23–02:59:01 | 1846 / 7.86 s | 904 / 89.58 s | Completed `stop`; rejected |

The three measured model phases took **178.47 seconds** (15.40 s prompt processing, 163.07 s generation). The remaining roughly 52.7 seconds were chiefly two ~26-second synthetic capability checks before the first inference and retry; tool execution was under 0.01 second. The first final answer was at about 106.46 seconds; the final model answer and persisted failure were at 231.17 seconds. No timeout, cancellation, stream truncation, or transport failure occurred in this replay.

The saved final raw text is JSON, but `validImplementationPlan` returns `false`: step 3 omits the required `reuse` array. The visible Chat says `Local implementation plan incomplete or invalid strict JSON after two attempts; no draft change accepted`. The final text also proposes Vitest/Jest dependencies and coverage output, contrary to the requested smallest Node built-in runner test. The Chat has `planningActivity.kind: error`, `status: failed`; there is **no pending typed proposal and no review card**. The first failed transition in this replay was the first final envelope validation at `02:56:56.745Z`; the corrective retry also failed validation.

The two fixture source hashes stayed identical. There is no canonical Roadmap or project source write. Dope did persist a noncanonical `planOnly` owner in `.dope/roadmap-drafts.json` for this failed Chat; it was left intact as evidence, and it prevents a new Planning owner in that same fixture. No command execution tool was called.

## Focused validation and gates

At final source: `npm run typecheck` passed; `npm run build:browser` passed with browser and node bundles at zero errors; 65/65 focused tests passed across Pi continuation, project grounding, command approval, Planning parser/requirements, backend and Work navigation; `git diff --check` passed. A 65-test rerun, typecheck and build followed the final requirement-extraction correction. No full check or AppImage build ran.

| Gate | Result | Evidence |
| --- | --- | --- |
| P1 Original stall root cause identified | PASS | Completed final rejected by strict Planning envelope; retry repeated investigation without corrective instruction. |
| P2 Agentic file inspection succeeds | PASS | Two real `read_file` results, exact fixture hashes. |
| P3 Tool continuation completes | PASS | Pi consumed both results and completed final text, without more tools. |
| P4 Structured Planning response completes | FAIL | Both final answers rejected; second omitted required `reuse` field and missed built-in runner intent. |
| P5 Pending proposal and review card visible | FAIL | Saved `planningActivity` failed; no pending typed plan or review card. |
| P6 Focused regressions pass | PASS | 65/65, typecheck, browser/backend builds, diff check. Final extractor tweak has no live replay. |
| P7 Source and Roadmap remain unchanged | PASS | Fixture source hashes unchanged; no canonical Roadmap write. Noncanonical plan-owner metadata persisted as noted above. |

**PLANNING NOT GREEN.** The remaining blocker is exact schema adherence and request fidelity in Qwen's completed final proposal. This record preserves the failed replay and stops without another live attempt or Docs workflow activation.
