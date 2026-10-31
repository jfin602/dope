# C12 Pi typed Planning recovery and Qwen30 qualification — 2026-10-31

**Disposition: PLANNING NOT GREEN / C12 NOT GREEN.** The new typed `submit_plan` path is exercised by real Qwen3-Coder-30B, and the previous negative-dependency false positive is fixed in focused tests. Neither of the two authorized live turns produced a validated pending proposal or a ChatPanel review card. The final turn was cancelled at the eight-minute cap. Owner-operated native AppImage qualification remains outstanding. Product version stays `0.12.7`; no commit, canonical Roadmap change, fixture source edit, or Docs workflow Run occurred.

## Source and architecture

- Baseline HEAD: `2eee101060c489b5c4cb0dbb9098714e238dd6ad`, branch `main`, clean before this task. The tested product changes are uncommitted; `git diff --binary` SHA-256 before this report and evidence copies: `425dc6656702ba30bfc30e04f4a54a243958663b7a73dfec6dbf65cdc1bc70a8`. The final served frontend bundle SHA-256 was `ce2a32f3541654eeb1663df8996feb409f05bdfba0b0cb67c419c2eae9615b22`; backend bundle `70b70ddd717e4dd2963a2a68d4e2ea791d09897c3252a4c11d0cda684c4b9f78`; Pi worker `7e90612cf116359ec245190fb0700dc6eaf0fa1472169453f4dff885439642cb`.
- Root cause of the recorded 30B false positive: the explicit dependency check matched `introduce ... new dependencies` inside “does not introduce any new dependencies,” but only recognized a few negative forms. The repair checks whether an affirmative add/use/install action actually proposes the prohibited item. It also lets the concrete `node:test` API plus `node --test` command satisfy the named built-in-runner requirement without requiring the plan to repeat the phrase “built-in test runner.” This does not waive the runner or exact assertion checks.
- Pi 1.4.0 already supports host-defined `customTools` with TypeBox arguments and `execute()`. The worker now opens a distinct Planning tool mode containing the existing brokered file/search/command tools plus `submit_plan`. Ordinary Chat and Work do not receive it. The TypeBox signature mirrors the existing `LocalImplementationPlan` fields (`type`, `objective`, `successCriteria`, `constraints`, `assumptions`, `steps` with `title/detail/deliverables/dependsOn/reuse`, `tests`, `guiQualification`, `risks`, `alternatives`, `question`). The authoritative `validImplementationPlan` and Dope owner/source/requirement preview remain the acceptance boundary; typed arguments are untrusted.
- `submit_plan` has no file-write, Roadmap-apply, command-grant, Work-start, or approval effect. Dope binds the candidate to the active Chat lease, project root, current Planning owner and revision, and files actually read through Pi; model-provided identities cannot select another owner. Successful validation would use the existing in-memory pending proposal, durable Planning activity and ChatPanel review card. Failed validation creates none. One invalid candidate may receive concise feedback and one corrected submission in the same Pi session. Later submissions are denied. Cancellation removes any same-turn pending proposal.
- The previous verbose final-JSON instruction was replaced with an inspect → `submit_plan` → one correction → pending-review summary instruction. There is no second model transformation call or parallel agent.

Changed product files: `packages/pi-runtime/worker.mjs`, `packages/contracts/src/model-runtime.ts`, `packages/chat/src/index.ts`, and `packages/theia-extension/src/node/{chat-backend,chat-plan-requirements,roadmap-local-model,pi-conversation-runtime,pi-model-bridge,pi-runtime-host}.ts`. Focused tests changed: `test/unit/{chat-backend,chat-plan-requirements,roadmap-local-model}.test.ts` and `test/unit/pi-runtime.test.mjs`.

## Focused verification

- Final browser and backend build: `npm run build:browser` PASS, zero build errors. Final `npm run typecheck` PASS after the final live source. The focused 54-test group passed: plan semantics/shape, Chat backend, Pi runtime, and local Planning model. `git diff --check` passed.
- Tests cover positive/negative/paraphrased constraints, forbidden frameworks and package installation, missing `node:test`, missing `increment(1) === 2`, workflow-versus-implementation wording, mandatory fields and step relationships, Pi tool exposure, one rejection/correction loop, brokered Chat/Work behavior, stale-source denial and pending review. These tests do not substitute for a live accepted proposal.

## Real browser replay

The Codex in-app browser served rebuilt Dope at `127.0.0.1:3017` and then `127.0.0.1:3018`. Both turns used the exact prior saved counter request from [the comparison](2026-10-31-qwen3-coder-30b-planning-comparison.md), new saved Chats and disposable projects. Each project contained only the specified `src/counter.js` and `package.json` before Dope created noncanonical `.dope` state. Source SHA-256 remained `619a46d55f9b64f4ddb40b9ae15445c8eebe3aac51d77e50353a096d13f62ba2` and `4e8f2e1ca642e8bf3be41357b71deafa20b6c5171a91ceab5fc27792f83bacf6`, respectively, before and after both turns. No test file appeared. No canonical Roadmap file or change appeared; `.dope/roadmap-drafts.json` is noncanonical Planning state.

LM Studio was `http://127.0.0.1:1234/v1`, exact model ID `qwen3-coder-30b-a3b-instruct@q4_k_m`, Q4_K_M 18.63 GB, context 16,384, parallel 1, CPU inference with `--n-gpu-layers 0`, and Pi `reasoning: false`. Memory was approximately 30 GiB total, 12–13 GiB available during the checks, with no swap. The Chat turn explicitly selected this model; Commands stayed Ask. No model, provider or context parameters were changed between turns.

| Observation | First turn | Final turn |
| --- | --- | --- |
| Saved Chat | `794e694b-ae09-47a9-a709-1651bd24062c` | `5ab5048c-af5f-40ce-b12a-b9cf4cfe865d` |
| Start → finish (UTC) | 12:48:25.786 → 12:54:41.287, 375.50 s | 12:58:10.439 → 13:06:15.006, 484.57 s; manually cancelled at cap |
| First Pi investigation tool | approximately 47 s after submit | approximately 2m45s after submit; the initial LM completion took 105 s |
| Investigation | 7 completed list/read/search calls, including both source files; one denied command | 7 completed list/read/search calls, including both source files; no command execution |
| `submit_plan` | 2 rejected attempts | 2 rejected attempts |
| Validation feedback | Generic strict-shape failure on both attempts, then correction limit | First: invalid earlier-step dependency; second: another invalid required field/shape (LM log truncates its full text); correction limit |
| Model correction | Attempted, but still invalid | Attempted in same Pi turn, but still invalid |
| Inference/usage | LM Planning request intervals total approximately 358 s; saved final response reports 5,057 input / 208 output tokens for that response, not whole-turn totals | LM Planning request intervals total approximately 425 s; whole-turn token usage unavailable after cancellation |
| Pending proposal / browser card | None; UI said “Rejected · no change” | None; UI said “Unvalidated local planning output” and “cancelled” |

The first source-bound saved turn is [cycle 1 Chat evidence](evidence/2026-10-31-submit-plan-cycle1-chat.json), SHA-256 `762bf0976b8cb216cbcb96212ee833de7dd80f70786be27d9aafe2e2aa32ab54`. The final turn is [final Chat evidence](evidence/2026-10-31-submit-plan-final-chat.json), SHA-256 `9db086526d0831bc01dd3a8ad103531ff001a084dbf557b1c45f83d847c297c2`. Browser observation directly showed project tool activity, the rejected first review control, and the final cancelled state with no review card. The local LM Studio log for these intervals is `/home/jfin/.lmstudio/server-logs/2026-10/2026-10-31.1.log`; it truncates long tool arguments and feedback. No accepted plan content exists to verify.

## Gate matrix

| Gate | Result | Evidence |
| --- | --- | --- |
| R1 Requirement-validation false positive | PASS | Deterministic positive/negative/paraphrase tests; previous “does not introduce” statement no longer triggers. |
| R2 Typed Pi Planning submission safety | PASS | Planning-only tool registration, existing strict schema/owner/source preview, live calls; no pending on invalid input. |
| R3 One bounded corrective resubmission | PASS | Pi synthetic same-session loop and two real attempts per turn; neither real correction became valid. |
| R4 Existing Pi investigation tools | PASS | Both real turns read the two fixture files; brokered tool tests pass. |
| R5 Real Qwen30 inspection/continuation | PASS | Saved tool events and browser activity; final first-tool delay is a performance regression observation, not a source-inspection failure. |
| R6 Valid exact-requirement proposal | FAIL | Both turns rejected two candidates; final turn was cancelled. |
| R7 One pending proposal and review card | FAIL | No proposal ID, pending activity or card in either browser turn. |
| R8 Security, cancellation and authority | PASS for changed scope | Denied command, unchanged fixture hashes, no canonical Roadmap write, cancellation, focused broker/Chat/Work tests. Broader prior C12 evidence remains separately scoped. |
| R9 Tests, typecheck, builds | PASS | 54/54 focused tests, typecheck and browser/backend build passed. |
| R10 Source/build identity and native owner status | EVIDENCE GAP | Source and build hashes recorded above; owner-operated native AppImage replay was not performed. |

**Next boundary:** a separately authorized effort is needed to inspect why Qwen30 generates invalid step relationships and missing/invalid required fields despite typed arguments and one correction, then obtain a real validated pending review card. Do not infer Planning Green or begin `c12-docs-workflow` from the deterministic passes. Historical C12 failures and owner-native requirement remain in force.
