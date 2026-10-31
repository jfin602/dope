# C12 Pi Planning tool-use latency recovery — 2026-10-31

**Disposition: TOOL-USE LATENCY RECOVERED; PLANNING NOT GREEN.** This is a focused browser/local-Qwen result at unchanged product version `0.12.7`, not Phase 12 closeout. The 40-second optimization target was missed by 2.09 seconds. No commit, Docs-stack run, model replacement, provider change, canonical Roadmap application or project-source edit occurred. Prior qualification reports remain unchanged.

## Source and fixture

- Base HEAD: `4c0b547d177bfa174172d8f9721c80f53e27751a`. The starting checkout was clean. Four implementation/test files changed; their final binary Git diff SHA-256 is `d543bafef3b6097ccb19b2175bcfac5ab7ce92f3dfc98d1ff9c7c9666a13fdf3`. Changes are `packages/theia-extension/src/node/chat-backend.ts`, `packages/theia-extension/src/node/roadmap-local-model.ts`, `test/unit/chat-backend.test.ts`, and `test/unit/roadmap-local-model.test.ts`. This report is additional untracked documentation.
- The Codex in-app browser used the rebuilt Dope frontend/backend at `127.0.0.1:3013`, with fixture `/tmp/dope-c12-latency-sBcWPb`. `src/counter.js` is byte-identical to the earlier fixture, SHA-256 `619a46d55f9b64f4ddb40b9ae15445c8eebe3aac51d77e50353a096d13f62ba2`. The old fixture was unavailable; the new minimal ESM `package.json` has SHA-256 `7e4e07031fe4adadc32b609e00a8c9126c2d5bf9707f2e1428db9526100e3f68` (earlier manifest hash `4e8f2e1c...`). Its different bytes limit strict cross-run comparison, although the requested increment function is identical.
- LM Studio had loaded `qwen3.5-9b` at context 16,384 with parallel predictions **2** at preflight. It was reloaded under the same identifier at context 16,384 and parallel predictions **1** before this run, matching the requested configuration. Thinking remained enabled; no inference-mode or provider setting was changed. AI Center refreshed the exact local connection, then its synthetic Coding Agent tool check passed. The saved turn resolved `local/qwen3.5-9b` from an explicit turn selection with Commands Ask and no manual attachments.

## Diagnosis and source correction

The earlier 46.55-second run and the latest 161.98-second run offered the same five Pi tools (`read_file`, `list_files`, `search_paths`, `search_text`, `run_command`) and reserved 2,048 completion tokens. Their first Planning model requests began roughly 25 seconds after submission. The regression came after that boundary: the latest model spent 6.15 seconds processing 1,479 prompt tokens and 85.61 seconds generating 836 tokens **without a tool**, completed an invalid Planning envelope at `03:24:43.578Z`, then entered a corrective model session. Its first tool at `03:25:27.788Z` was the first tool **across multiple model requests**, not a slow first tool in one request. Both prior tests had Thinking enabled. The 46.55-second run instead generated a tool request in its first model response (1,436 prompt tokens / 6.02 seconds; 154 generated tokens / 15.14 seconds).

The shipped first-plan instruction placed a full final JSON example, including a step named “Inspect source,” close to the opening tool instruction. That made the investigation/final transition ambiguous. This is a source-backed plausible contributor, not proof that wording alone caused the no-tool model choice; the older request bodies are truncated in LM Studio logs. The directly observed first avoidable transition is the latest invalid no-tool final generation. The bundled Pi SDK already performs the selected tool loop, but its `AgentSession.prompt()` does not expose a per-turn tool-choice control. The existing bridge requires a fresh exact-model probe, and `refreshModels()` intentionally invalidates prior synthetic tool verification. Skipping that check would weaken the current eligibility boundary. No new agent, wrapper, dependency, forced tool choice or inference call was added.

The narrow correction leads the existing Planning instruction with an explicit **investigate source, then produce final JSON** sequence and removes the illustrative JSON plan steps while retaining every required schema field and strict validation. If an invalid plan arrives before Pi has actually read a source file, the one existing bounded retry asks for relevant file investigation rather than an immediate structured-output correction. Pi still chooses its files and tools. Optional timing traces were added around existing grounding/composition calls; no project body is logged.

## Measured comparison

| Stage | Earlier baseline | Latest regression | Rebuilt run |
| --- | ---: | ---: | ---: |
| Submit → first Planning model request | ~24.7 s | ~25.2 s | **24.12 s** |
| First model prompt processing | 6.02 s / 1,436 tokens | 6.15 s / 1,479 tokens | **5.81 s / 1,377 tokens** |
| First model generation | 15.14 s / 154 tokens, tools | 85.61 s / 836 tokens, no tools | **12.01 s / 124 tokens, tool** |
| First model request → first Pi project tool | ~21.6 s | No tool in first request | **17.98 s** |
| Submit → first Pi project tool | **46.55 s** | **161.98 s**, after invalid-answer retry | **42.09 s** (`list_files`) |
| Submit → first actual source-file read | 46.55 s | Later than first corrective tool; exact time unavailable | **52.27 s** (`read_file`) |
| Tool calls / turn duration | 2 / 231.17 s | 4 / cancelled at 247.52 s | **8 / 177.68 s** |

The rebuilt turn began at `11:39:57.616Z`; grounding took **6 ms** and context composition **1 ms** (730 estimated context tokens). Dope recorded submission at `11:39:57.626Z`. The first Pi model request was sent at `11:40:21.743Z`, first tool arguments and execution began at `11:40:39.719Z`, and the first source-file read began at `11:40:49.901Z`. LM Studio completed prompt processing at about `11:40:27Z`; exact first-token and tool-call-start timestamps within generation are not exposed. The first tool result was accepted by `11:40:39.723Z`, roughly 4 ms after tool start. The final Pi request returned at `11:42:55.289Z`; Dope recorded a completed but rejected plan at `11:42:55.319Z`.

About **24.1 seconds before Planning inference** were spent in Dope/Pi model binding and a fresh two-request synthetic capability check; the separate probe began at `11:39:58Z` and finished at `11:40:21Z`. Grounding and tool execution were negligible. LM Studio measured about **11.41 seconds prompt processing** and **141.80 seconds generation** across the six Planning model requests. It generated approximately **1,428 tokens** across them. The saved final assistant reports **3,135 input / 748 output / 3,883 total provider-reported tokens** for its final response; this per-message usage is not the aggregate six-request total. Reasoning versus visible output token split is unavailable. The first request body was 5,921 bytes with five tools; the pre-repair first requests used the same tool names and 2,048-token allocation. No context exhaustion or transport error appeared.

Pi selected a root listing, a `src` listing, exact reads of `package.json` and `src/counter.js`, a test-path search, and repeated some listings/reads: eight completed project tool events total. Source refs include the exact fixture file hashes. Tool-result continuation succeeded, and there was **no invalid no-tool answer or Planning retry**. Some repeated inspection remains a model efficiency cost.

## Qualification and limits

The final output passed the strict JSON envelope and the saved assistant execution status is `complete`, with `finishReason: stop`. Dope rejected the proposal as `implementation-plan` status `rejected`: the preview marked both extracted requirements `needs-review`, and the answer included forbidden Jest/Mocha alternatives despite the Node built-in runner request. ChatPanel displayed “Plan needs work before it can be accepted,” with no pending review card. This is **PLANNING NOT GREEN**. Fixture source and manifest hashes matched after the run; no `ROADMAP.md` or test file appeared. Dope did retain the noncanonical `planOnly` draft owner and saved Chat record in `.dope/`.

The focused suite passed **125/125** tests covering Pi registration and continuation, Planning prompt/schema/requirements, context, cancellation, Ask/Allow, project-path protection, Chat and Work boundaries. `npm run typecheck`, `npm run build:browser` (frontend and backend, zero errors), and `git diff --check` passed. No full Phase 12, native Electron GUI, AppImage or Docs workflow campaign was run.

| Gate | Result | Evidence |
| --- | --- | --- |
| L1 First-tool latency regression diagnosed | **PASS** | Latest no-tool generation and invalid-envelope retry added the avoidable ~118-second initial branch; the exact prompt-wording contribution remains an inference. |
| L2 Unnecessary pre-inspection generation removed or explained | **PASS** | Rebuilt first model request selected a real project tool; no invalid no-tool correction occurred. The fallback now prioritizes investigation when a no-tool invalid plan occurs. |
| L3 Pi autonomous inspection preserved | **PASS** | Pi selected and completed eight bounded project tools, including both source-file reads. |
| L4 First-tool latency measured against 46.55 s | **PASS** | 42.09 s to first project inspection, 4.46 s faster than baseline and 119.89 s faster than latest regression; 40 s target missed. First file read was 52.27 s. |
| L5 Tool continuation functional | **PASS** | Pi accepted tool results and completed a final response after six model requests. |
| L6 Security and focused regressions | **PASS** | 125/125 focused tests, typecheck, browser/backend build, unchanged fixture source, no canonical Roadmap application. Native/whole-host claims are outside this gate. |
| L7 Final Planning proposal separately recorded | **FAIL** | Strict JSON completed, but requirement preview rejected it; no pending proposal or review card. |

**TOOL-USE LATENCY RECOVERED** in this source-bound browser run: Pi began meaningful project inspection near the 46.55-second baseline and before any invalid final generation. The 40-second target remains unmet because fresh model eligibility checking consumes about 24 seconds and the first tool request takes another 18 seconds. **PLANNING NOT GREEN**. Stop without a second model run, Docs-stack activation, commit or version change.
