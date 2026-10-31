# C12 Qwen3.5 Planning output contract recovery — 2026-10-30

**Disposition: PLANNING NOT GREEN.** This is a focused result at product version `0.12.7`, not Phase 12 qualification. No commit, version change, Docs-stack run, real project edit, or Roadmap application occurred. The previous NOT GREEN records remain unchanged.

## Source and diagnosis

- Base HEAD: `352904e2e986b151eeaff66bcecb56c73287d4ed`. The uncommitted seven-file product/test diff at closeout has SHA-256 `4cebc604e14e78df547e36670cac7190b9308fc818e6047ccca8cd4fa828d22e`. Pre-existing owner changes were preserved.
- The previous live replay completed Pi file inspection and final generation, then failed strict Planning validation. Its first final response was buffered and discarded, so the exact first invalid field cannot be recovered. The saved corrective JSON omitted `steps[2].reuse` and proposed Vitest/Jest against the explicit Node built-in runner requirement. This is the precise recoverable failure, not evidence of a model transport or context failure.
- `validImplementationPlan` is the authoritative schema gate. Every step needs `title`, `detail`, `deliverables`, `dependsOn`, and `reuse`; `reuse` is `[]` or verified `{path,reason}` objects. A syntactically valid object with invalid step shape had previously lost its targeted retry instruction.
- The installed Pi OpenAI-completions streaming adapter does not expose a final `response_format` schema option that can coexist with its existing tool loop. This repair kept the Pi inference path and strict Dope validation.

## Focused source changes

- `chat-backend.ts` now gives a compact, complete Planning JSON example, explains every required `reuse` field, separates source investigation from final output, and passes exact developer directives into the prompt. A corrective Pi session receives a bounded copy of file results Pi already chose to read. It checks deterministic explicit constraints before proposal persistence.
- `roadmap-local-model.ts` gives an invalid shape or a checkable requirement violation a specific, bounded corrective instruction. Its shape diagnostics do not relax `validImplementationPlan`; there are still at most two output attempts.
- `chat-plan-requirements.ts` preserves bulleted user directives, extracts the requested capability from “prepare ... implementation plan,” and checks explicit forbidden items, required use, exact requested test result, and verified reuse when applicable. It does not encode Node, Vitest, or Jest as global policy.
- `pi-model-bridge.ts` may reuse a freshly refreshed exact model's verified Coding Agent capability. In the live run, two synthetic probe inferences still occurred before Planning inference, so this change did **not** demonstrate a latency saving.
- Focused tests cover missing or ill-typed `reuse`, bounded correction, developer constraints, and exact-model capability selection. No schema field was invented or silently filled in on the model's behalf.

## Live browser evidence

The first turn on repaired source used a fresh saved Chat and explicit `LM Studio · qwen3.5-9b` with Commands `Ask`. It produced no file call, its first response failed the Planning envelope, and the user interrupted it during corrective generation to reload the model with thinking enabled. Its saved execution is `failed: Interrupted before completion`; it is not counted as a completed Planning result. A same-fixture send was rejected **before inference** with `Stale or existing implementation plan owner`; that history and owner were left intact.

The user explicitly requested a retry after reloading. A byte-identical disposable fixture was opened in the Codex in-app browser on the rebuilt Dope backend at `127.0.0.1:3012`. Initial and immediately post-cancel SHA-256 values matched:

| Disposable file | SHA-256 |
| --- | --- |
| `src/counter.js` | `619a46d55f9b64f4ddb40b9ae15445c8eebe3aac51d77e50353a096d13f62ba2` |
| `package.json` | `4e8f2e1ca642e8bf3be41357b71deafa20b6c5171a91ceab5fc27792f83bacf6` |

AI Center showed local LM Studio at `127.0.0.1:1234/v1`, exact loaded `qwen3.5-9b`, context 16,384, concurrency 1, and a successful fresh Coding Agent tool check. The new saved Chat explicitly selected this model, kept Commands `Ask`, and used the supported implementation-Planning lead-in followed by the specified Node-only test prompt. No files were manually attached.

The saved execution confirms actual `local/qwen3.5-9b`, `resolutionSource: explicit-turn`. It started `2026-10-31T03:22:45.807Z` and was cancelled through ChatPanel at `03:26:53.324Z` after **247.52 seconds** wall time (the cancel action was initiated at about 246.90 seconds; UI/tool round-trip took the remainder). The first model answer ended at `03:24:43.578Z` with **zero** tools and an `invalid-envelope` retry. During the corrective Pi continuation, the first tool call occurred at `03:25:27.788Z`, **161.98 seconds** after send. Pi completed four generic file steps (`list_files` twice, `read_file` twice); results included actual `package.json` and `src/counter.js` hashes and 73/57 source bytes. Pi accepted the tool results and requested another model response at `03:25:44.294Z`. That response was still generating at the observation limit, so no final Planning JSON reached strict validation. ChatPanel displayed `Unvalidated local planning output`, `cancelled`, and four project tool steps. There was no pending typed proposal or review card.

LM Studio's per-request log showed the first model response consumed 1,479 prompt tokens in 6.15 seconds and generated 836 tokens in 85.61 seconds, with no tool call. Completed corrective requests used 141, 101, 112, 81, and 62 generated tokens; the final request was cancelled after at least 629 generated tokens at roughly 9.6 tokens/second. The measured prompt-processing sum for completed requests was about 16.23 seconds; the cancelled final request had cached prompt processing, and its exact prompt time is unavailable. Reasoning/output token split for the streamed, cancelled turn is unavailable. No source suggests context exhaustion: the saved execution reports 793 used context tokens against a 3,843-token turn budget. Inference plus repeated capability checks, rather than file-tool execution, dominated elapsed time.

The disposable fixture directory was no longer present after the later task interruption. The source-integrity result rests on the immediately post-cancel hashes and saved source refs observed before that interruption. The saved draft snapshot contained only a noncanonical `planOnly` owner; no canonical Roadmap or source write was observed.

## Regression and gates

At the final uncommitted source: **91/91** focused tests passed across Planning schema/requirements, Pi continuation, Chat persistence/cancellation, project access, command approval, Work boundaries and navigation. `npm run typecheck`, `npm run build:browser`, and `git diff --check` passed. All these commands completed before the later task interruption; no test was interrupted. A full Phase 12 or AppImage campaign was not run.

| Gate | Result | Evidence |
| --- | --- | --- |
| S1 Initial schema failure identified | EVIDENCE GAP | Initial failed response bytes unavailable; saved correction's missing `reuse` and forbidden framework proposal are confirmed. |
| S2 Planning output contract repaired | FAIL | Code and synthetic tests improved the contract, but the live first response still failed its envelope and no valid final completed. |
| S3 Explicit developer constraints preserved | PASS | Prompt/directive and deterministic rejection tests; live final compliance remains unobserved. |
| S4 Real Qwen3.5 tool continuation | PASS | Four completed Pi file steps; model continued after tool results. |
| S5 Valid completed Planning proposal | FAIL | Final corrective generation was cancelled; no valid JSON reached proposal validation. |
| S6 Pending proposal and review card | FAIL | Saved execution `cancelled`; ChatPanel showed unvalidated output, not a pending review card. |
| S7 Focused security/regression tests | PASS | 91/91, typecheck, browser build, diff check. |
| S8 Performance measured and assessed | PASS | First tool 161.98 s, four tool calls, 247.52 s total, about 9.6 tokens/s final generation; remaining latency is deficient. |

**First failed transition:** the first model answer completed without a file call and failed Dope's strict Planning envelope at `03:24:43.578Z`. The corrective Pi run did inspect the fixture but did not complete before the 240-second observation ceiling. **PLANNING NOT GREEN.** Stop without another automatic model run or Docs workflow activation.
