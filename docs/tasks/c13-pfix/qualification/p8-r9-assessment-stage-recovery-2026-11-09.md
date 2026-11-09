# c13-pfix P8-R9 — Assessment stage recovery, 2026-11-09

**Verdict: PARTIAL / NOT GREEN.** The source-bound diagnostic and continuation corrections pass focused tests, including durable stage receipts and a repaired verified-Assessment completion after an output-limit Continue. The required real connected-browser five-file Assessment did not finish. On the final served source, GPT-OSS completed three full file reads and the first 4096 bytes of the late guide, accepted three findings, received two distinct stage rejections, then paused at the generation limit. Owner Continue was attempted on the same live turn; Pi reported `Local Pi continuation failed or expired`. No `assessment_finish`, sealed AssessmentRecord, completed card, or `/prompt-plan` action followed. The original R8 backend exit remains **UNKNOWN**.

## Source and scope

- Entry repository HEAD: `411eb409e6d1d6902d6acbd1537d160bfbbad002`, clean `main` aligned with `origin/main`. Product version remained `0.13.11`. The final product candidate consists of this HEAD plus the isolated P8-R9 working diff; the final commit hash is recorded by Git history when this report is committed. No owner changes were reset, stashed, cleaned, or overwritten.
- Read BOOT, AGENTS, workflow, ADR 0055 and 0056, the named prompt chain contract, and P8-R5 through P8-R8 qualification reports. Historical reports and executed prompt source were preserved.
- The correction stays in `ChatExecution.toolEvents`, `ChatRepository`, `IncrementalAssessment.status()`, and the existing Pi Assessment instruction. It adds no diagnostics database, model correction pass, publisher, privileged reader, Work authority, or version change.

## 1. Per-stage diagnostics — PASS for tested source

Each `assessment_stage` result is now saved immediately under the existing Chat execution lease with a bounded call ordinal, recognized category, argument-shape class, stable code, safe error-field class, preservation flag, and accepted-finding count. Accepted, idempotent, and rejected stages have distinct codes. The Chat parser rejects unbounded or foreign diagnostic fields. Raw arguments, quotations, file bodies, credentials, lease tokens, model prose, and stack traces are not stored in these event diagnostics. Terminal Chat persistence retains their order; restart reloaded them unchanged.

The R8 **pattern**, not its unknowable historical rejection causes, was reproduced headlessly: two accepted findings followed by three rejected stages. The new fixture saved `ASSESSMENT_ACCEPTED`, `ASSESSMENT_ACCEPTED`, `ASSESSMENT_STAGE_SHAPE`, `ASSESSMENT_UNSUPPORTED_SOURCE`, `ASSESSMENT_DEPENDENCIES_EMPTY` at ordinals 2–6, with accepted counts `1,2,2,2,2`. The three rejection categories and shapes were safe, and the first two findings remained intact. The model-facing rejected receipt now gives a code-specific next step and directs the model to `assessment_status`; strict citation and category validation were retained.

The final live attempt saved two **actual** rejection codes: ordinal 5 `ASSESSMENT_CITATION` and ordinal 8 `ASSESSMENT_UNSUPPORTED_SOURCE`. Accepted findings stayed at counts 1 and 2 across those failures, then reached 3 on a corrected stage. These codes describe P8-R9 only; R8 did not retain enough data to assign its three historical causes.

## 2. Partial-source continuation — PASS headlessly; incomplete live

`assessment_status` now reports each requested path's contiguous `coveredBytes`, `fileBytes`, `nextOffset`, and broker-pinned `expectedSourceHash` when known. Its `nextAction` names the first incomplete file and the exact next offset/hash. Coverage uses only successful brokered pages. Duplicate or overlapping pages do not fill a gap, a late page cannot skip a missing range, wrong-hash continuation fails closed, and a completed file has `nextOffset: null`. The model instruction asks for `assessment_status` after a partial read and tells the model to follow the supplied continuation metadata instead of calculating it.

The five-file regression returned `nextOffset: 4096` and a pinned hash for the partially inspected guide, kept 3/5 coverage despite overlap and a later disjoint page, and reached 5/5 only after the missing bytes were read. Drift, missing categories, unsupported quotes, and premature empty dependencies still deny finish. A complete source-backed Assessment seals in the headless test without canonical publication.

The final live fixture remained **3/5 fully inspected**: `src/clamp.js` 0–89, `test/clamp.test.js` 0–264, and `package.json` 0–118 were complete. `docs/late-guide.md` had only 0–4096 of 6584 bytes; `RELEASE_NOTES.md` was unread. The guide's late acceptance section begins beyond byte 4096 and was not inspected. The model did not reach its next `assessment_status` and read after the output-limit pause.

## 3. Output-limit and restart safety — PASS headlessly; live continuation failed

A targeted protected Assessment test staged a verified finding, paused, rejected a foreign Continue decision, continued under the same lease, staged the remaining categories, called `assessment_finish`, and produced one complete draft without replaying the initial read or finding. That test exposed a real source defect: Chat required the final verified Assessment text to begin with the model's saved partial text. The narrow repair permits replacement only for a completed named `/prompt-ass` execution whose backend has already sealed the Assessment. The protected partial is not promoted into the final source-backed Assessment text. Existing ordinary Chat pause, Continue, Stop, cancellation, stale-decision and restart tests still pass; protected draft tests retain incomplete work and deny stale/foreign leases and source drift. The generic Stop test and protected draft recovery test are separate fixtures, so this is not a claim that every live interruption mode was observed in one run.

The final live turn used output-limit policy `ask` and a 2048-token segment ceiling. The browser offered **Stop generating** and **Continue generating**. At pause, the protected draft retained four page records (the guide partial) and three observations. Continue was used once while the same browser, backend, model, lease and source remained active. Pi then reported `Local Pi continuation failed or expired`; the saved assistant became `interrupted`, with the three findings and page records still intact. The exact Pi continuation failure cause is not established. Browser reload showed one blocked incomplete Prompt Stack Draft card, no duplicate card, no completed Assessment, and no Plan action. The backend stayed available for that reload. No output ceiling, compaction, reasoning control or lease policy was changed.

## 4. Real GPT-OSS connected-browser Assessment — NOT GREEN

The first live attempt used fresh fixture `/tmp/dope-p8-r9-clamp-r4PdSY` at baseline `d4f76c3957d67dab5971e01045672411b6816ea9`. Selected and actual model were local `openai/gpt-oss-20b` in the Codex in-app browser. The model emitted a tool-shaped JSON string in reasoning/provisional text, but **no broker tool call occurred**. Dope saved 0/5 coverage and no findings, and blocked the draft. This was not evidence that `assessment_finish` ran or that Pi transport was universally broken. The source-bound output-limit completion defect was subsequently reproduced headlessly and repaired; this first live failure remains separate evidence.

After that one narrow repair, the permitted final-source retest used fresh fixture `/tmp/dope-p8-r9-retest-Pp7bcV`, baseline Git HEAD `fd46f7e1c740e386c265724c0d0b99e61b98a7b3`, in the connected Codex in-app browser at `http://127.0.0.1:3000/#/tmp/dope-p8-r9-retest-Pp7bcV`. AI Center reported LM Studio **ready · 1 usable model**; Chat selected `openai/gpt-oss-20b`. Saved execution `bb76d50d-268e-484b-80fd-056e7d4c8d01` records selected and actual model on connection `21d03643-2aca-407e-b090-af59979b6c2f`, start `13:31:10Z`, interruption `13:32:50Z`, and provider-reported 32,574 input, 527 output, 33,101 total tokens. The model made actual `assessment_status`, read, and stage calls. Its stage sequence was **3 accepted, 2 rejected** with codes and counts above. It never called `assessment_finish`. No category beyond observations was accepted, and scope and T1/T2/T3 were absent. The real Assessment completion gate therefore fails despite the passing headless finish gate.

The fixture's five tracked files matched baseline and final SHA-256 values:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `src/clamp.js` | 89 | `2866677a4450ab1204005da2ab0cf28e203a590b16a8755ec0f867c295ca0827` |
| `test/clamp.test.js` | 264 | `c5faeb988f856efacf18a711239ef9d29ba3b9382f032980b3090351dd7ea696` |
| `package.json` | 118 | `2a7e453fb2d7914158c7e72a2b66b27e162694200ed8caafa656c53ba6051c8a` |
| `docs/late-guide.md` | 6584 | `fd4d4c8f3d132b2875ee9fff6fdc6aa0b08d65ff61d4cb4f422857e442763767` |
| `RELEASE_NOTES.md` | 147 | `a5b8f34b1383ec2bf8065b70e34f31a0bb6e8b373d6e2de00791a2e0dbf9d55d` |

Final served artifact SHA-256: frontend bundle `cae7c8ce71285a70e467f7c191bed6203de64c6b5d979695a30f19afd95d7e6b`; backend bundle `3f86a27d85c51ce0c880687b937bf0271d6dbe99ec096233c7c2ddf569b2e602`; Pi worker `0988924e8ff74242cc0847a1b4663014f49b2b7b206fd9449a8ec6fc0f7b722b`; compiled ChatBackend `e6e9b9c4aeac7d33c70f780523fa0459d0794a14b52b14e8920221320ccf74e3`; compiled IncrementalAssessment `6353e750765d38f85c996e343b916faec825a6378e8064a90638fc11da3d8210`. The browser build had zero frontend and backend bundle errors. The first live source's backend bundle was `f5e008f883e5bd49a9421dd03df0e2a7275d8b1a3d97941bf8a3ebc8441adf33`; its observations are not combined with final-source results to claim PASS.

## Verification and disposition

- Built affected compiled packages in order: `corepack yarn workspace @dope/chat build`, then `corepack yarn workspace @dope/theia-extension build`; both passed. `npm run build:browser` passed after the narrow repair.
- Final eleven-file focused suite: **175/175 PASS**. It includes the transport matrix, Pi runtime/conversation, ChatBackend, ChatRepository, presentation, prompt authoring, draft store, incremental proposal/stack and guarded publication tests. `git diff --check` passed.
- Focused test command: `node --test test/unit/pi-transport-fault-matrix.test.mjs test/unit/pi-runtime.test.mjs test/unit/pi-conversation-runtime.test.ts test/unit/chat-backend.test.ts test/unit/chat-repository.test.ts test/unit/chat-presentation.test.ts test/unit/prompt-authoring-stage.test.ts test/unit/prompt-draft-store.test.ts test/unit/incremental-proposal-controller.test.ts test/unit/incremental-prompt-stack.test.ts test/unit/planning-stack-publication.test.ts`.
- No tracked fixture file changed; only `.dope/` noncanonical runtime state appeared. No canonical `docs/tasks/clamp-api-correction/` publication, Work grant/Run, applied History change, Roadmap award, Gate GREEN, product version advance, or Phase 13 progression occurred.
- Stage diagnostics: **PASS for tested source**. Partial continuation: **PASS headlessly, incomplete live**. Output-limit and restart safety: **PASS headlessly, live Continue failed in Pi**. Real GPT-OSS five-file Assessment: **NOT GREEN**. Original R8 backend exit attribution: **UNKNOWN**. Overall P8-R9: **PARTIAL / NOT GREEN**.

Stop after P8-R9. Plan, Write, native proposal review, guarded publication and outstanding P7 cases remain separate and unqualified. This result does not make c13-pfix GREEN or authorize Phase 13 recovery.
