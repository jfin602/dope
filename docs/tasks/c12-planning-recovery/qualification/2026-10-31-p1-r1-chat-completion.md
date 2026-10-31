# C12 Planning Recovery P1-R1 — Pi Chat completion, 2026-10-31

**Disposition: P1 CLEANUP GREEN for the recovered scope.** The original [P1 NOT GREEN report](2026-10-31-p1-cleanup.md) remains unchanged and accurate for its earlier source and live run. P2, Docs management, native Electron, and C12 overall are not qualified by this result. Product version remains `0.12.7`; no commit, dependency, model, inference-setting, or permission change was made.

## Source and diagnosis

- Started from clean `main` HEAD `4dcf4b435b1d83ac1f56720c250ed7c417a65231`. Final product/test `git diff --binary` SHA-256 before this documentation was `d192c19ba61dda649ca93328c9c3bc65e5f375aaa6fcd48b959613fbc293a269`. The source change is confined to the bundled Pi worker and three affected tests. The obsolete implementation-plan/submit_plan cleanup from P1 remains in place.
- The original saved turn entered Dope at `2026-10-31T14:01:53.431Z`. The available LM Studio request log shows two capability-check requests followed by the actual Chat request at about `14:02:20Z`. In the actual turn, each subsequent provider request carried the prior assistant message **with both answer text and a `read_file(src/counter.js)` tool call**, followed by a completed result containing the same source. Request message counts rose 2, 4, 6, …, 26. The saved Chat records twelve completed reads of the exact file and repeated correct answer text; it ended `cancelled` at `14:04:21.905Z`. The old log does not retain individual streamed `finish_reason` values or Pi completion events, so it cannot independently prove their absence. The request sequence does prove that the repeated reads were new continuations inside one Pi turn, not duplicate user submissions or a Dope second loop.
- The first incorrect transition was Qwen emitting answer text **and** another tool call after sufficient source evidence. Pi's standard loop must continue when a model requests a tool. Dope additionally treated text from those intermediate tool-use messages as visible Chat answer text, even though Pi had not settled. This combination explained the repeated visible answer and running Chat. The returned tool results were present in the next provider requests; no lost result, retry, output truncation, or separate session dispatch was found in available evidence.
- The correction gives tool-enabled Chat one direct completion instruction: use another tool when evidence is needed, then answer without a tool call when ready. It leaves every offered tool and Pi's ordinary continuation semantics intact. The worker now emits tool-enabled Chat answer text only after `session.prompt()` returns with a settled, non-tool final assistant message. Intermediate tool-use text cannot become a duplicate saved final answer. The existing no-tool Chat streaming, cancellation, command broker, Work tools, and Roadmap authority remain unchanged.
- Ponytail Full was attempted through the host skill inventory but was not invocable here. Its installed `SKILL.md` was read and its minimal root-cause guidance applied; nothing was injected into Dope's Pi runtime.

## Legacy failures

1. `chat-capability-grounding` called the retired checkpoint `acceptImport`/`previewReplacement`/`applyReplacement` operations against a schema-2 Roadmap. The test now imports a phase through `acceptGateImport`, moves the unchanged Markdown file, and exercises the current reviewed `previewGateRelink`/`applyGateRelink` path. It still checks one saved Chat, current linked-file help before and after relink, unchanged source bytes, no action proposal, and one revision advance.
2. `chat-roadmap-flow` matched the old competing-draft wording. The current descriptive rejection is “This saved answer already has a Roadmap decision; ask Chat for a revised phase plan.” The test now matches that precise guard both before and after lease renewal; no second model call or Roadmap publication is still asserted.

## Live browser qualification

One primary Codex in-app-browser run used the rebuilt Dope browser at `127.0.0.1:3018`, the disposable `/tmp/dope-c12-p1-r1-smoke` project, and exact `qwen3-coder-30b-a3b-instruct@q4_k_m` selected in Chat from the existing ready LM Studio connection. The model remained loaded at 16,384 context and parallel predictions 1; the existing CPU/GPU settings were unchanged. Commands stayed **Ask**. No file was manually attached. The request was: “Inspect src/counter.js using your available project tools. Explain what increment(4) returns and why. Do not modify files or execute commands.”

The first provider request began `14:24:56.848Z`, after the saved user submission at approximately `14:24:39Z`. Pi called `read_file` twice, both through Dope's project broker, received completed 306-byte results, then generated a `stop` response. Pi emitted `agent_end` at `14:25:34.796Z`, `agent_settled` at `14:25:34.797Z`, and returned from `session.prompt()` at that time. No cancellation or error occurred. ChatPanel showed one answer explaining `increment(4)` returns **5**, one assistant execution marked **complete**, two project tool steps, and an idle Send control. A subsequent ordinary message in the same saved Chat completed with the same exact model and correctly recalled input `4`.

Primary-run performance: about **37 s** to first tool, **2** tool calls, about **55 s** to first visible answer and settled completion, **3** provider requests, stop reasons **toolUse → toolUse → stop**, and zero continuation after the `stop`. The automatic Chat title used a separate later provider request; the follow-up Chat used one further request and no tools. The saved [live Chat record](evidence/2026-10-31-p1-r1-chat.json) has SHA-256 `f739d428a680ddfa2bc91026df99333b7ff56233f3e28c95c0cb6ad7b4b8a892`: exactly two user and two completed assistant messages, with no duplicate final answer. It records the exact selected/actual model and both source hashes.

Fixture `src/counter.js` retained SHA-256 `619a46d55f9b64f4ddb40b9ae15445c8eebe3aac51d77e50353a096d13f62ba2`; `package.json` retained `b9d1e2b11dc619c0f5a3712dc495aa9f4a243cbf7e2cbfaa4349251739e18d8`. There was no canonical Roadmap, Work run, command execution, or source edit. Dope wrote only its noncanonical saved Chat/History state under `.dope`.

## Final verification

| Gate | Result | Evidence |
| --- | --- | --- |
| R1 Repeated continuation root cause | **PASS** | Original provider request chain and saved Chat establish answer-plus-tool-call repetition; unavailable old stop reasons are noted above. |
| R2 Pi lifecycle correction | **PASS** | Final answer is published only after Pi settles; live `stop`, `agent_end`, `agent_settled`, and idle ChatPanel observed. |
| R3 Multi-tool autonomy | **PASS** | The live turn used two legitimate reads; the focused Pi test still exercises list/search/read/command continuation. |
| R4 Real Qwen30 natural completion | **PASS** | Exact model completed in about 55 s without timeout or cancellation. |
| R5 One final saved answer | **PASS** | UI and four-message saved Chat agree; no repeated answer or duplicate assistant record. |
| R6 Follow-up Chat | **PASS** | Same saved Chat and exact model completed a second ordinary message. |
| R7 Legacy tests | **PASS** | Both corrected tests pass on current schema-2 and Chat contracts. |
| R8 Focused checks and builds | **PASS** | 163/163 focused Chat/Pi/Roadmap/Work tests; `npm run typecheck`; `npm run build:browser` (browser and backend bundles, zero errors); `git diff --check`. |
| R9 Source and authority boundaries | **PASS in tested scope** | Fixture hashes unchanged, no Roadmap/Work/command effects, exact project and model retained, Commands Ask visible; focused denial/cancellation/history tests passed. Independent native Electron remains unobserved. |

Final build SHA-256: browser bundle `5160f09522e4ebcc583517348032ab2ca217105ea593cb16ce7a8fd3aac35bb8`, backend bundle `21eea611765e13d16a245be2b7dd9a6a37b97704218e2e578a4c46ef5d67b87b`, Pi worker `70efd48c43d99485530ec5442ed5b31855f82baee58a80c7a6a0cba61d45ad48`. The browser/backend hashes match the prior P1 build because this recovery changed the separately loaded worker and tests. No P2 or Docs workflow run followed this closeout.
