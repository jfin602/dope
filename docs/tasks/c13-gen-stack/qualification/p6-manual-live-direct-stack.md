# P6 — manual real-model direct-stack qualification preflight

**2026-11-11 12:07–12:09 CST. Verdict: BLOCKED before live cases.** The P6 instruction says to stop when P5 has a material authority/source/publisher NOT GREEN. A fresh run of P5's real Pi-worker test in this environment reached the worker and failed at the Chat operation-policy authority boundary with `policy_invalid`. No real GPT-OSS `/gen-stack` turn, proposal, revision, Accept or Work discovery was attempted. This is not a real-model reliability finding or a P6 PASS. Legacy retirement is not eligible.

## Exact basis

- Product HEAD: `92ec5796d8fee5aa66df70399ba736afe6381c74` (`c13-gen-stack/P5: Deterministic Direct Stack Integration, Security and Scale`); initial `git status --porcelain=v1 -uall` was empty. Product, browser and Electron package versions remain `0.13.11`.
- SHA-256: `packages/pi-runtime/worker.mjs` `ac0f6cabd0c7563a4d16eabd7b4ad911a376376d8f12e393b651a74d7ae9120c`; `packages/theia-extension/src/node/chat-backend.ts` `22eb70ca76794059f9442a385e2b268e90c6bf231f806ab5092cd8b4d21f6958`; compiled `packages/theia-extension/lib/node/chat-backend.js` `df815e6d83c7cb0af660582399e7a2cf18b96c2d4cd6fccbaa755948961ae131`; compiled `chat-panel-widget.js` `90e227517358854411134c21ca70265341f268bcac7dcdbbc8e0cb766b2a90cf`; compiled `chat-panel-presentation.js` `05e7dfffa0be0d215954ad487561123250e4a15bcdeb64862ecf6a32199cb242`; compiled `native-doc-editor-proposal.js` `62e9d8cb077d174eb9702b83db487d25fd183edd2e644e7fc71b225538ab4e4b`.
- Served frontend/backend/worker hashes: **UNKNOWN / NOT EXERCISED**. No Dope server was started or browser page loaded after the authority stop. The connected Codex in-app browser inventory had zero tabs; native preview and exact served-source checks were not attempted.
- Local listener probe succeeded on `127.0.0.1`, so the P5 report's earlier `listen EPERM` restriction does not explain the new failure.
- `node --test test/unit/direct-stack-worker.test.ts` failed (0 passed, 1 failed, about 1.6 seconds). The first `backend.runTurn` raised: `The Chat operation policy changed or did not match this tool session. Start a new authorized turn.` The classified boundary was `policy_invalid`, `failureOrigin: operation_policy`, `brokerResultAcknowledged: false`. The test did not reach its recorded staged-file, proposal, exact publication or Work assertions. It cleans up its temporary fixture in `finally`.
- Read-only source inspection gives a likely fixture-specific cause: the test calls `openChatToolsSession` without its final `directProposalTools` flag, while the worker accepts `gen-stack` operation policy only in direct-proposal mode. This is a diagnosis from source, **not** an executed repair or proof that the product's live route works. No test or product source was edited and the test was not replayed with modified arguments.

## Model and resource preflight

LM Studio read-only `/api/v1/models` returned `openai/gpt-oss-20b`, selected variant `openai/gpt-oss-20b@mxfp4`, one loaded instance, context length 16,384 and parallelism 1. The running `llama-server` command also showed the MXFP4 model, context 16,384 and parallel 1. Dope's selected connection, saved execution model, Managed context, Auto/Low reasoning, generation Ask, Commands Ask and requested temperature/top-p are **UNKNOWN / NOT EXERCISED** in this P6 attempt because no Dope Chat execution began. Engine-effective sampling is also unknown. No model or policy setting was changed.

Available resources at preflight: 30 GiB RAM total, about 2.3 GiB available; zero swap; root filesystem 147 GiB total, about 6.2 GiB available (96% used). No live inference safety claim is made from these figures.

## Case disposition

| Required case or boundary | Result | Evidence |
| --- | --- | --- |
| A — small separator correction | **BLOCKED / NOT EXERCISED** | P5 authority preflight failed before a fresh P6 fixture, saved Chat or original request was created. |
| B — multi-boundary feature | **BLOCKED / NOT EXERCISED** | Same preflight stop. |
| Brokered real-model source reads, staged prompt contents and digest, final seal | **NOT EXERCISED** | No P6 model turn; no files or receipt to quote. |
| Native proposal, file links, Open All, read-only preview, targeted revision, reload and keyboard/narrow behavior | **NOT EXERCISED** | No P6 proposal or browser page. |
| Explicit owner Accept, exact canonical publication and Work discovery | **NOT EXERCISED** | No reviewable disposable candidate or owner approval. |

The historical [P5 headless report](p5-headless-direct-stack.md) remains NOT GREEN and unchanged; the historical c13-ass-fix P5-D3 NOT GREEN remains unchanged. This preflight adds a distinct observed worker authority failure on the committed P5 source. It does not assign its cause to the live product without a corrected, independently executed P5 journey. No canonical prompt files, Work grant/Run, Roadmap progress, legacy cleanup, version change, self-commit, or automatic repair/P7 run occurred. The next action belongs to the owner after the P5 authority gate is resolved and independently verified.

## 2026-11-11 12:22 CST — repeat P6 entry check

**Verdict: BLOCKED before live cases; prior preflight preserved above.** HEAD is still `92ec5796d8fee5aa66df70399ba736afe6381c74`, with the same source and compiled hashes listed above. The working tree now contains two modified tests (`test/unit/chat-backend.test.ts`, `test/unit/direct-stack-worker.test.ts`) and two untracked reports (this file and [P5-R1](p5-r1-policy-authorization-repair.md)). There are no product-source edits. `git diff --check` passed. No served frontend/backend/worker hash was observed.

The independently repeated `node --test test/unit/direct-stack-worker.test.ts` passed **2/2** on that dirty tree in 3.82 seconds. The actual worker/broker fixtures each made one source read, sealed a ready-for-review proposal, rejected the wrong digest and published exact reviewed bytes only after the test's guarded Accept. The small fixture emitted README plus two work prompts and one terminal manual prompt, digest `681fda9888e9386e5ead18b068f9be5b38fabae0a9ad285362e56fb2e52925c8`; the ten-work-prompt fixture emitted README plus ten work prompts and one terminal manual prompt, digest `6587eb27bab06aa2eeee0694690dea504ac01c7c47ba3059756c0730bdc2e1fc`. Work discovery succeeded with `executable: false`. These are deterministic provider fixtures, not real GPT-OSS or native-browser evidence.

[P5-R1](p5-r1-policy-authorization-repair.md) identifies the original `policy_invalid` as a test adapter omission and records a **scoped PASS** after forwarding the trusted `directProposalTools` flag. It also states that the broader combined real-worker authority/revision matrix was not newly replayed and that P6 should resume only against owner-reviewed, committed and verified corrected source. The corrected test harness remains uncommitted, and the original [P5 report](p5-headless-direct-stack.md) remains **NOT GREEN**. This does not establish a completed P5 entry gate on the committed source. Under P6's explicit material authority/source/publisher stop rule, neither live case was started.

| P6 boundary | Repeat entry result |
| --- | --- |
| Case A — small separator correction | **BLOCKED / NOT EXERCISED** |
| Case B — multi-boundary feature | **BLOCKED / NOT EXERCISED** |
| Selected Dope model and saved execution model; effective sampling | **UNKNOWN / NOT EXERCISED**; no Chat turn |
| Served-source identity, browser proposal, targeted revision and reload | **NOT EXERCISED** |
| Owner-approved disposable Accept, exact live publication and Work discovery | **NOT EXERCISED** |

No fixture, draft, Chat, canonical task files, owner approval, Work Run/grant, Roadmap award, legacy cleanup, version change or self-commit was created by this repeat entry check. The earlier blocked observation and all P5/P5-D3 reports retain their original verdicts. The next step is owner disposition of the P5-R1 correction and a verified committed P5 basis before a separately resumed P6 live attempt.
