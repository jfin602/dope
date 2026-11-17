# P5-R1 — direct-generation worker authorization repair

**2026-11-11 verdict: SCOPED PASS for the `policy_invalid` repair.** The deterministic provider now drives the actual bundled Pi worker through the protected Chat broker to a sealed, reviewable direct Prompt Stack. The small and ten-work-prompt fixtures publish only after the test's explicit guarded Accept. This is not live GPT-OSS qualification, native browser qualification, or a retroactive change to the original P5/P6 reports.

## Entry basis and observed failure

- Entry HEAD: `92ec5796d8fee5aa66df70399ba736afe6381c74` (`0.13.11`). Entry `git status --porcelain=v1 -uall`: only untracked `docs/tasks/c13-gen-stack/qualification/p6-manual-live-direct-stack.md`, preserved unchanged. No reset, stash, clean, self-commit, manifest, lockfile, dependency or version edit.
- The original P5 real-worker test is `test/unit/direct-stack-worker.test.ts`, line 36 at entry (line 37 after this change). Reproducing it before repair gave **0 passed, 1 failed** at `backend.runTurn` (entry line 126): `policy_invalid`, `failureOrigin: operation_policy`, `brokerResultAcknowledged: false`, with “The Chat operation policy changed or did not match this tool session.” No provider operation or staged file had been acknowledged.
- The test request was a leading `/gen-stack direct-worker-2 ...` in a saved Chat with a claimed owner lease and selected local model. Its deterministic adapter accepted `request.projectTools.operationPolicy` and `proposalTools`, then called `openChatToolsSession(..., proposalTools, false, operationPolicy, false)` without the final `directProposalTools` argument. Its default is `false`. The test harness thereby converted a trusted direct-generation request to an ordinary Chat worker session.

## Source trace and root cause

1. `ChatBackend.runTurn` resolves the bound direct skill from the leading command and refuses a leading `/gen-stack` whose protected skill identity changed (`packages/theia-extension/src/node/chat-backend.ts:1927–1960`). Its saved direct draft is checked against project, Chat, lease owner and selected model (`:1945–1956`).
2. The backend chooses the `gen-stack` operation from the trusted continuation, creates its bound policy (`:2282–2305`), and supplies both `directProposalTools: true` and that policy to the model request (`:2491–2496`). No model prose is used as an authorization flag.
3. Production propagation preserves the flag in `pi-conversation-runtime.ts:241–249`. The production `PiModelBridge.bind` opens direct mode with the **eleventh** `openChatToolsSession` argument (`pi-model-bridge.ts:149–151`); `PiRuntimeHost` serializes it into the worker open frame (`pi-runtime-host.ts:193–200`).
4. The worker derives direct mode only from `message.directProposalTools === true` (`packages/pi-runtime/worker.mjs:703–704`) and permits a `gen-stack` policy only in that mode (`:709–715`). `checkedOperationPolicy` rejects an operation mismatch with `policy_invalid` (`:64–71`). The worker then exposes only direct proposal and brokered read tools (`:717–720`).

**Proven cause: A, test fixture omission.** Production request construction and mode propagation were consistent. The single missing adapter argument explains and reproduces the failure; supplying the same trusted field that production passes makes the worker journey succeed. No production validator, fallback, model payload, tool budget or retry limit changed.

## Correction and authorization checks

Changed only `test/unit/direct-stack-worker.test.ts` and `test/unit/chat-backend.test.ts`. The former forwards `request.projectTools.directProposalTools` in the fixture adapter and adds real-worker rejection checks for (a) `gen-stack` policy with missing direct mode and (b) direct mode with an ordinary `chat` policy. The latter verifies that ordinary Chat text mentioning `/gen-stack` and `directProposalTools=true` creates no draft, cannot stage through the broker (`PROPOSAL_TOOL_AUTHORITY`), creates no proposal and writes no canonical file.

| Unauthorized case | Executed evidence |
| --- | --- |
| Missing direct mode; trusted command/broker mode mismatch | New real-worker test: both open attempts return `policy_invalid`. |
| Forged mode in ordinary text; ordinary Chat protected tool attempt | New Chat backend test: policy remains `chat`, direct flag false, stage returns `PROPOSAL_TOOL_AUTHORITY`, no draft/proposal/file. |
| Wrong protected skill or inert quotation | `chat-skills` bound-skill digest and quoted-command checks; `prompt-authoring-stage` trusted-leading-command checks; `chat-backend` leading wrong-identity guard. All passed. |
| Foreign project/Chat/owner and invalid or released lease | `incremental-proposal-controller` foreign root, Chat, owner, wrong lease and released lease checks passed. `chat-backend` saved draft and turn ownership cases passed. |
| Invalid/foreign policy or changed turn policy | `pi-runtime` policy checks passed, including foreign model identity and policy change between open and turn. |

These negatives preserve the worker, broker, draft and publisher gates. The foreign identity/lease cases are focused controller/backend tests, rather than a second end-to-end real-worker adversarial journey.

## Actual worker and broker receipts

After a fresh extension build, the real-worker test passed both fixtures. Each begins with one saved trusted `/gen-stack` command, opens the Pi worker in direct mode, executes brokered `read_file src/labels.js`, stages substantive work bodies and one terminal manual closeout, calls `proposal_finish`, validates the proposal/importer and receives `ready-for-review`. It asserts no canonical directory or Work discovery before Accept, rejects a wrong digest, then explicitly calls `publishPromptStack` in the disposable fixture and compares every published byte with the reviewed proposal. Work discovery returns `executable: false`; no Work grant/Run or Roadmap award is invoked.

| Fixture | Staged files | Broker reads | Finish | Example validated digest | Accept/discovery |
| --- | ---: | ---: | --- | --- | --- |
| Two work prompts | README + P1–P2 + P3 manual = 4 | 1 | `ready-for-review` | `bd2e189a4230b4e23483597d291ba205779aa7fda260fe9d6be1050e359183bb` | `published`; exact bytes; discovered but not executable |
| Ten work prompts | README + P1–P10 + P11 manual = 12 | 1 | `ready-for-review` | `aa7d8e43333c90a3f8756cd349b67acc8edde54816169336c833a04d56ae7e31` | `published`; exact bytes; discovered but not executable |

The digests are from the final 2/2 worker replay; fresh fixture IDs can change them on replay. The long P1 was delivered in two chunks. The importer accepted each exact ordered stack, and both fixtures contained exactly one terminal manual closeout.

## Builds, focused tests and remaining limits

- `npm run build:extension` — PASS after the test edit, refreshing compiled backend and dependencies. No product source changed. `git diff --check` — PASS.
- Before repair: `node --test test/unit/direct-stack-worker.test.ts` — 0/1, exact `policy_invalid` above.
- After repair: real-worker test 2/2 PASS. Final `chat-backend` plus real-worker run: **24/24 PASS**. The remaining focused worker, bridge, direct controller, importer, publisher, command and skill suites: **108/108 PASS**.
- One intermediate nine-suite parallel run was **131/132**, with `ENOTEMPTY` while cleaning a temporary `.dope/chats` directory in the unrelated Chat command-approval test. That case passed in the subsequent 24/24 run; the original intermediate run is not represented as a PASS. An earlier new assertion was corrected from `denied.code` to the broker's actual `denied.error`, then rerun.
- The deterministic provider proves real bundled-worker and broker integration, not GPT-OSS output quality. The original P5 report's broader combined cancellation/restart/revision and adversarial matrix was not newly replayed through the worker here. Native proposal UI, served browser hashes and real-model behavior remain for independent P6. No new source defect was observed after the authorization repair.

**P6 readiness:** The specific real-worker authorization prerequisite is satisfied on this uncommitted source. P6 remains unstarted; resume its manual live qualification only against the owner-reviewed, committed and verified corrected source. Preserve the original P5 NOT GREEN and P6 BLOCKED preflight records as historical evidence. No legacy command retirement, version advance, Work execution or Phase 13/Roadmap award follows from this scoped result.
