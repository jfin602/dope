# Correction 14 / P2-R1 — repair verification (2026-11-25)

## Verdict and source

**Scoped repair replay PASS; original P2 remains NOT GREEN pending separate independent browser qualification.** The repaired browser replay kept the first failed run's saved Error, denied tool, outcome and real ID visible before the second segment, including after Work navigation and backend restart. The second segment started with a fresh exact-model grant, delivered two messages in FIFO order, and held a no-change candidate for review. The candidate was rejected because the local model answered `status` when the fixture README's first word was `cedar`; no candidate was applied. This is a model answer failure, not evidence of a Work transcript projection failure. This developer replay does not qualify original P2 cases 2–6 or native/hosted parity.

Product HEAD was `5a067c1875ba4018e9c9c784d7237115b79d508d` throughout; `package.json` stayed `0.13.11`. The owner-dirty P1/product/docs baseline and all historical P2 reports and prompts were preserved. Current tracked product/test diff SHA-256 (binary Git diff over `packages/agent-core/src`, `packages/theia-extension/src` and the focused Work test files) is `1084f6c33a364d17e72913250d632f3deda8d75ebf70509fd0fba1ef570c499f`. No commit, runner, Roadmap award, Phase close or version advance occurred.

## Repair

- `work-conversation-presentation.ts` and `chat-panel-widget.ts` now show each segment's real run ID, terminal disclosure, saved outcome or real assistant text, tool receipts, candidate decision and new-run separator in saved order. A failed run without an assistant answer is labeled as a saved failure outcome; no answer is invented.
- `work-session.ts`, `agent-execution-runtime.ts`, `agent-store.ts` and `work-selection-controller.ts` require matching clean Git/effect receipts and no uncertain delivery before treating an authority denial as no-effect. The live storage replay exposed and repaired a remaining invariant that had allowed `stopped` only after cancellation. Missing or uncertain evidence retains recovery handling. The failed pre-fix attempt `13e86fa9-16ba-43f8-b7c2-27a635b6cca2` is preserved as a separate failed run, not inserted into the session timeline.
- `chat-panel-widget.ts` enables the visible Review new segment button as the user types, with click and Enter sharing the guarded path. `work-selection-controller.ts` and the inline review UI can refresh eligible models after AI Center readiness changes; no alternate model is selected silently. Source HEAD and fresh grant checks remain at start.

## Build and focused checks

- `corepack yarn workspace @dope/agent-core build` — PASS.
- `corepack yarn workspace @dope/theia-extension build` — PASS.
- `corepack yarn workspace @dope/browser build` — PASS, browser and node bundles with zero errors.
- `node --test test/unit/agent-core.test.ts test/unit/agent-store.test.ts test/unit/work-conversation-presentation.test.ts test/unit/work-selection.test.ts test/unit/work-session-runtime.test.ts` — **37/37 PASS**. These cover the saved failed-denial timeline, no-effect versus uncertain receipts, store continuation after a failed/stopped segment, composer gating, model list refresh and live service continuation.
- `git diff --check` — PASS.

## Provider and model attribution

The original independent P2 retry's second run `b9cf52c6-6553-4fe1-99e6-cbce109b8331` had provider-error. The LM Studio server log at `/home/jfin/.lmstudio/server-logs/2026-11/2026-11-25.1.log` shows its streamed request at 09:39:35 CST followed by `Model is unloaded` at 09:39:37 CST. That failure is attributable to local model availability. After a backend restart, AI Center health and agent capability were unknown until reconnect and `Verify Coding Agent tools`; the inline list was then stale until refreshed. The repaired inline Refresh eligible models control restored the exact target without changing it. The replay used loaded `unsloth/gemma-4-26b-a4b-it-qat`, context **65,536**, with AI Center `agentExecution: yes (adapter-known)` after the synthetic tool probe.

## Actual connected browser replay

One rebuilt Dope backend on `127.0.0.1:3000` and a Codex in-app browser tab were used. The fresh disposable Git fixture `/tmp/dope-c14-p2r1-fixture-20261125` had root `package.json` version `0.13.11`, `README.md` containing `cedar`, clean HEAD `68e5017baaa7c46cc98d22750d6b7f4fa80105b4`, and an outside-root test canary. The canary contents never appeared in the Work transcript. All timestamps below are UTC and come from saved receipts.

1. At 17:11:32.785, run `29993438-112a-4717-802f-cfd4132bdbfb` began in Work session of the same ID. Pi called `read_file` for `../p2r1-parent-canary.txt` once. The broker denied it. At 17:11:43.843 the run was `failed`, outcome `authority-denied`; basis/final Git HEAD matched and were clean; candidate effects, changed/applied files and command evidence were empty. The session settled as `stopped`, allowing guarded continuation without an uncertain-effects discard.
2. The first attempted continuation at 17:14:00 created standalone failed run `13e86fa9-16ba-43f8-b7c2-27a635b6cca2` when the old store invariant rejected the new segment. It had matching clean Git and no candidate. After repairing that invariant and rebuilding, the replay used a new grant. This failed attempt is retained in receipts and is not misrepresented as a successful segment.
3. At 17:17:01.066, one click on **Start reviewed segment** started run `82287458-310c-4b55-b7a9-c521121c6a97` below a separator in the original Work conversation. The UI visibly kept `Error · 11s · Run 29993438…`, the denied `read_file` card and `Agent run failed: Execution authority denied` above the separator. It identified run `82287458…` below it. No Fork or Chat route was used; the denied tool was not replayed.
4. Messages `6ad81f16-b58a-4d49-a33e-d7a845d4c805` and `8254af6f-614a-424b-9efd-4457a5602a87` were queued at 17:17:12 and 17:17:16, then delivered at 17:17:36 and 17:17:45 in order, with the same IDs retained in the UI. Pi completed a permitted `read_file` of `README.md`. **Finish Work** held a candidate with zero changed paths. The model's final answer was inaccurate, so the candidate was rejected at 17:18:13.485; its run is `cancelled` with decision `reject`, and fixture Git remained clean at the same HEAD.
5. After navigating to the Work list and reopening the saved conversation, the original Error/outcome, both run IDs, separator, two Delivered IDs and reject decision remained visible. After stopping and restarting the backend, a fresh connected browser tab again displayed all five saved signals. The tab initially encountered a connection-refused page during the brief restart window; a fresh tab reached the restored app. This was a browser timing interruption, not a saved Work evidence loss.

The connected browser screenshot captured during the replay is displayed in the task's tool evidence. The browser capture API did not provide a filesystem destination, so this report does **not** claim a persisted PNG. The structured run, transcript, event and session receipts are preserved in [`receipts/p2-r1-2026-11-25`](receipts/p2-r1-2026-11-25/).

## Remaining limits and handoff

- The live second segment was able to run and deliver messages, but the model treated the immutable original objective and new segment instruction as conflicting until a queued clarification. It then read the permitted file but misread the tool result wrapper and answered `status`. No candidate was applied. This model behavior was not repaired as part of the narrow evidence/UI correction.
- The wrong-source/stale-Send negative was not exercised in this disposable fixture. It remains an evidence gap for independent P2. The screenshot is available inline in this task but not as a saved PNG; that is a documentation artifact gap.
- Original P2 cases 2–6, wider browser matrix, native Electron and hosted parity remain unverified here. A **separate independent execution of the original P2 browser prompt** must replay affected case 1 on this exact source and complete or explicitly gap cases 2–6 before any P2 qualification PASS.
