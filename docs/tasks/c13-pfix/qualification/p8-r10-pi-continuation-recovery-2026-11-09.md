# c13-pfix P8-R10 — Pi Continue and same-session recovery, 2026-11-09

**Verdict: PARTIAL / NOT GREEN.** A reproducible second-Continue worker-disposal defect was repaired and passed both a failing-before/passing-after regression and a connected-browser GPT-OSS replay at 16K context with 2,048-token segments. The historical P8-R9 **first** Continue failure did not retain its underlying exception and was not reproduced. Its exact cause therefore remains **UNKNOWN**. The live replay used ordinary Chat; protected Assessment continuation passed headlessly but was not repeated live. No c13-pfix, Phase 13, Gate, Plan, Write, publication, or version progression follows.

## Source and entry

- Entry HEAD: `9b949825d95cd040af85e4d51490163a4449ae02`, clean `main` aligned with `origin/main`. Corrected product HEAD: `8fbfb4fea8e68dee803117ca2e4ed2488fe2e9ed`. Product version remains `0.13.11`.
- Read BOOT, AGENTS, workflow, ADR 0055/0056, the named prompt authoring chain contract, and P8-R8/R9 reports. Kept their evidence and executed prompts unchanged.
- Inspected the browser Continue control, controller decision guard, backend decision/persistence loop, Chat repository, Pi lease and host, bundled worker, installed Pi 1.4.0 session API, model prompt continuation, result accumulation, and relevant tests. A direct real-worker/host probe confirmed that `session.prompt(continuationControl(...))` can produce sequential length-limited segments on the retained session; the API is not universally unable to continue.
- All browser runs used the disposable tracked-clean project `/tmp/dope-p8-r10-continuation-fixture`, source HEAD `fd46f7e1c740e386c265724c0d0b99e61b98a7b3`. Only its untracked `.dope/` test state changed. Its canonical `docs/tasks/clamp-api-correction/` directory was absent.

## Exact reproduction and cause

The historical R9 Assessment had three accepted findings and partial fourth-file coverage when its **first** Continue returned the generic `Local Pi continuation failed or expired`. The saved R9 record lacks a specific worker exception; no conclusion here assigns its historical cause.

On the pre-fix P8-R10 candidate in the connected Codex in-app browser, a real ordinary GPT-OSS turn paused after segment 1 and successfully continued into segment 2. At the second pause, one visible Continue immediately failed with `continuation_unavailable`. Saved execution `22197f7e-0b94-4148-8804-8c120faa012a` became interrupted with the original two segments intact: cursors `0–3923` and `3923–7306`, each 2,048 output tokens, cumulative 5,629 input / 4,096 output / 9,725 total tokens. There were zero broker tool calls and no independent new Chat turn. The pre-fix backend bundle was `7a32f4feef404bd974db4425b997e795a5d4c3ac475f56517f2482aa8ae37eec`; worker was `d3bb448df9ed2b2657f50cd102900b7ce9af5e6a80bb4517bf8078d847e88d17`.

The concrete cause is the async iterator handoff between `ChatBackend` and `PiConversationLease`. When a paused event is saved, the backend calls `continuation.resume()` to claim the next segment, then breaks the previous `for await` loop. Closing that previous lease iterator executes its `finally`. The old `finally` saw the lease state as `running`—because the **new** resume had already claimed it—and released the retained Pi host. The next segment therefore had no paused worker to resume. A new host/lease regression that mimics this exact ordering failed before the repair with `continuation_unavailable` and passed after it.

The lease now assigns a generation to each resumed segment. Cleanup from an older iterator releases the host only if it still owns the current running generation. The original worker, selected model, execution ID, segment validation, decision guards, cancellation and broker path remain in use. There is no fresh-session retry or fallback.

## Repair and diagnostics

- `PiConversationLease` retains the worker across the sequential handoff, validates the next segment and novel-text prefix, and reports bounded expired, unavailable, invalid-result, and Pi-rejected continuation failures.
- `PiRuntimeHost` reports stale/wrong-segment and invalid resumed result as specific worker codes. The worker distinguishes model drift and Pi rejection while keeping provider failures ahead of those classifications.
- The existing Chat execution parser accepts only the new bounded codes. The 120-second owner-decision timeout records `continuation_expired`. The existing failure path keeps a partial answer or protected draft incomplete; it does not seal an Assessment.
- Tests cover the same-worker positive path, sequential pauses, duplicate Continue, wrong segment, expired/closed worker, provider failure, cancellation, invalid result, model drift, retained brokered tool results and a **new** brokered read after resume. ChatBackend tests retain and reload a classified continuation failure. Existing protected Assessment tests retain a staged finding through Continue, permit further reads and stages, and seal only through guarded `assessment_finish`; Plan binding remains dependent on validated finish.

The direct live replay did not invoke tools, so its zero-tool history proves no live broker replay for that turn only. Tool continuation and Assessment authority are supported by controlled headless tests, not by a new live protected Assessment qualification. The earlier R9 accepted findings and page records remain in their original saved fixture; no R10 operation modified them.

## Final connected-browser replay

- Dedicated browser backend: `http://127.0.0.1:3002/#/tmp/dope-p8-r10-continuation-fixture`, restarted after the fix; the existing port 3000 backend was left alone. Connected **Codex in-app browser**, tab 3.
- LM Studio reported `openai/gpt-oss-20b` **loaded** with `loaded_context_length: 16384`; Dope AI Center displayed `openai/gpt-oss-20b · context 16384 (loaded)` and `ready · 1 usable model`. Chat selected that same local model, output-limit policy **Ask**, output token reserve/segment ceiling **2,048**. No global context, routing or output policy was changed.
- Prompt: output integers 1 through 2500, one per line. The output-limit UI displayed **Stop generating** and **Continue generating** after segment 1. One Continue started segment 2 in the same saved execution; another legitimate pause displayed the same controls. One second Continue started segment 3 without the pre-fix stale-worker failure. Segment 3 also legitimately paused at 2,048 tokens. The visible Stop control then saved one `stopped-incomplete` response without an error bubble.
- Saved execution ID `9f69ae92-5265-45c6-9483-ab718fda6184` remained constant. Segment 1: cursor `0–3927`, 739 input / 2,048 output / 2,787 total. Segment 2: `3927–7290`, 4,894 input / 2,048 output / 6,942 total. Segment 3: `7290–11227`, 9,409 input / 2,048 output / 11,457 total. Aggregate provider-reported usage: **15,042 input / 6,144 output / 21,186 total**, with 50 reasoning tokens. All three segment finish reasons were `length`; the owner Stop left the answer incomplete. Selected and actual model were both local `openai/gpt-oss-20b` on connection `21d03643-2aca-407e-b090-af59979b6c2f`.
- The app appended only each returned novel segment at monotonically increasing cursors. The model's **third** text segment itself restarted part of the numeric sequence after the second pause, so the combined answer is not a correct 1–2500 enumeration. This is a model-content limitation in this replay, not evidence that a prior broker effect was replayed. No claim of semantically seamless model prose is made.
- The final browser replay had zero broker tool events, no canonical source write, no Work grant/Run, no Roadmap award, and no publication. The fixture's tracked files remained clean.

Final served SHA-256: frontend `dabbe8774c3e34596db1c560c578a3785753108c02b26020d0e11184bae19cb0`; backend `5e90ed57ad5e2ea42b258c5a7f79f5b4373ca9208bd88555f1af9299b425db69`; bundled worker `d3bb448df9ed2b2657f50cd102900b7ce9af5e6a80bb4517bf8078d847e88d17`; compiled Pi host `76b4f5e24adda3956474d265206d45a64419ba705603d2d86c26d1602c5f5b5b`; compiled lease `bf6a70a9d1bfeda3740729889b7f12e3df4023f173ac02cc4baa83a9d5a062ad`; compiled ChatBackend `0cc4d2980163914ce373ab2159f1faf4c2d551d655161b3066f37274b8312317`. The browser build completed with zero frontend and node bundle errors.

## Verification and limits

- `corepack yarn workspace @dope/chat build`, `corepack yarn workspace @dope/theia-extension build`, and `corepack yarn workspace @dope/browser build`: **PASS**, in dependency order.
- Full focused command: `node --test test/unit/pi-transport-fault-matrix.test.mjs test/unit/pi-runtime.test.mjs test/unit/pi-conversation-runtime.test.ts test/unit/chat-backend.test.ts test/unit/chat-repository.test.ts test/unit/chat-presentation.test.ts test/unit/prompt-authoring-stage.test.ts test/unit/prompt-draft-store.test.ts test/unit/incremental-proposal-controller.test.ts test/unit/incremental-prompt-stack.test.ts test/unit/planning-stack-publication.test.ts`: **176/176 PASS**.
- `git diff --check`: **PASS**. No blanket check or Electron packaging was run.
- **Scoped PASS:** reproduced and repaired sequential same-session worker handoff; two live Continue decisions reached a third bounded pause at the requested model/context/output configuration; typed failure persistence and protected Assessment continuation pass headlessly.
- **Overall P8-R10 PARTIAL / NOT GREEN:** R9's exact first-Continue exception remains unknown; a final-source live protected Assessment and its five-file finish were not performed; the model's repeated numeric content shows that session continuity alone does not guarantee semantic continuation. Native Electron and the broader R2/R4 qualification remain unobserved.

Stop after P8-R10. Preserve prior P8 results. Do not start P8-R11, increase the output ceiling, run Plan/Write/publication, or resume Phase 13 automatically.
