# c13-pfix P8-R4 — independent live Assessment recovery, 2026-11-08

**Disposition: NOT GREEN.** Gate A failed on a real selected GPT-OSS 20B turn in the connected Codex in-app browser. The model read two of five explicitly requested files, mistook a denied `list_files` call on `package.json` for inability to read that file, skipped the remaining files, and returned an empty `dependencies` array. Dope rejected the structured result with `ASSESSMENT_DEPENDENCIES`. No valid Assessment was saved. The required Gate A stop rule therefore blocked Plan, Write, proposal review, publication and downstream Phase 13 recovery. This is a new result on current source, not a relabeling of P8, P8-R1, P8-R2, P8-R3 or P7.

## Exact basis and environment

- Starting and final tested product-source HEAD: `05cd7dbb06bb3e423cc1409822580e571e50e7d8`, clean `main` aligned with `origin/main` before this evidence report; product version `0.13.11`. No product source repair or version change was made. Read BOOT, AGENTS, workflow, ADR 0056, the named-chain contract, c13-pfix assessment/plan and the P7/P8/P8-R1/P8-R2/P8-R3 reports before the live run.
- `npm run build:browser` passed from this source. A separate browser host started at `http://127.0.0.1:3003/` (PID `427385`), leaving the existing port 3002 host alone. Connected Codex **in-app browser** tab ID `1` loaded `http://127.0.0.1:3003/#/tmp/dope-pfix-p8-r4-clamp-NnmDCHer`. This was not a headless browser substitute.
- SHA-256 of served/rebuilt outputs: `apps/browser/lib/frontend/bundle.js` `05e6fbae734ee3d5ffcfc054893093091d225ea1458e8b2c0ad11abfb220c1ef`; `apps/browser/lib/backend/main.js` `c0157e6d1fa9137b661ddfc3d2d65c5db22988dd0a60ac2712e16bd355e3172c`; compiled `chat-panel-widget.js` `57b455486ce426246c4a8002b221e3ca9d8d4c6a4f62f8cd47f6a18663972e67`; compiled `chat-backend.js` `dad548d1e3a6e6a6c85b3972e40c5d1d253c1480eee7da71bfb4cb13d168c66e`; compiled `prompt-authoring-stage.js` `4777e43b4a11750baa0f50249a1b49e33f556c6b5fbeb527f316d0a52a3ba76f`; `packages/pi-runtime/worker.mjs` `6c8da969358000c27b6405e4705f2bbb64ec3c3896222d2952144c31baf982b8`.
- AI Center refreshed the LM Studio connection at `http://127.0.0.1:1234/v1` to **ready, one usable model**. Its **Verify Coding Agent tools** action returned `Local tool capability: supported` and marked agent execution yes. A separate generic **Test Connection** action displayed `Connection check failed`; this did not negate the later coding-tool check or the actual successful model/tool loop. LM Studio reported `openai/gpt-oss-20b` loaded at context length `8192`, reasoning option default low with the Chat reasoning setting at Auto. The saved Chat pinned that exact model; the execution records selected and actual model `openai/gpt-oss-20b`, provider `local`, connection `21d03643-2aca-407e-b090-af59979b6c2f`, resolution `chat-exact-default`.
- Chat saved input budget `8192`, output reserve `2048`, output-limit policy `ask`. Dope reported `517/6144` context tokens for the turn. The earlier `1024` reserve might have constrained a longer result, but neither the earlier evidence nor this run proves an output-limit cause. Full provider input/output usage was not persisted; it is **unavailable**, not zero.

## Disposable fixture and baseline

Fresh ESM Git project: `/tmp/dope-pfix-p8-r4-clamp-NnmDCHer`, baseline commit `84a0a7e53c0641a3bad4aa7f0743a2bc7c821406`, package version `1.4.2`. The scalar clamp is a small implementation with inclusive bounds and existing numeric/reversed-bound checks. The late guide section defines the finite-number, negative-zero and batch acceptance contract, and the release notes accurately distinguish current behavior from that contract. Baseline `node --test test/clamp.test.js` passed **2/2**.

| Fixture file | Baseline and final SHA-256 |
| --- | --- |
| `package.json` | `6f78adf989007f60b5086155e76009c0410e03f94f986f150cfbe6743a89c9a0` |
| `src/clamp.js` | `1c2046c6b15fa9dc5c4b24c56d616a7732538e07d254db2bdcb2b374e1661414` |
| `test/clamp.test.js` | `1bfc6a0bd80ecce6d19b6ff2d757d91279c2a684f66fc0fbff19702f0bdc212b` |
| `docs/late-guide.md` | `87a73bb15b1b691e73a3fecad989cbecaa0ccb7e5442568d16060cb7a0961060` |
| `RELEASE_NOTES.md` | `025999767832fe0dd0ad03be07cc4856c1f4c06df6a874239d662df7ab71c45f` |

Only untracked `.dope/` Chat and focus state was added to the fixture. No tracked fixture bytes changed. No canonical `docs/tasks/clamp-api-correction/` directory or prompt publication journal exists in the fixture.

## Gate A — real Assessment

The exact requested `/prompt-ass clamp-api-correction Assess the existing clamp API ...` command was submitted once through native Chat. One `clamp-api-correction` draft card appeared. Saved execution `789eba11-94df-44be-8afd-34cf258c4cd9` ran from `2026-11-09T00:53:49.677Z` to `00:54:22.833Z` (**33.156 seconds**) and ended `failed`, not cancelled, interrupted or paused at an output limit.

The saved safe broker order is:

1. `list_files` root — completed, truncated.
2. `list_files` `src` — completed.
3. `read_file` `src/clamp.js` — completed, bytes `0–298`, source hash `41b6d950368b191e01a839937941f4b79374625563e9f657a319b7d6556acaf6`.
4. `list_files` `test` — completed.
5. `read_file` `test/clamp.test.js` — completed, bytes `0–382`, source hash `69ce4d37546630ea1a3a65d5b092c4b5efdc8a7d45842f5997261f7791355095`.
6. `list_files` `package.json` — **denied** at the authority boundary with `AUTHORITY_DENIED`. It was a directory-list request for a file, not a denied `read_file` request. No further broker calls were made.

Thus `package.json`, `docs/late-guide.md` including its late section, and `RELEASE_NOTES.md` were **not read**. Lists do not count as reads. The model's saved activity explicitly reasoned that it could not read `package.json` because of the denial, then skipped that file and the guide/release notes. Its final provisional JSON was syntactically parseable, 902 UTF-8 bytes, SHA-256 `701cc6c975aac3697456f386aa410ee850741776afceb033e879d0ebb1bccf26`. It contained two observations, one preservation finding, **zero dependencies**, one risk and T1/T2/T3 strings. The four quoted snippets each occur once in the actual `src/clamp.js` bytes by independent inspection; Dope did **not** derive trusted citation offsets or accept the result because it rejected the empty dependencies array first. No literal escaped-newline mistake occurred in this output. The model also used T2 for batch API/property tests and T3 for documentation, rather than reserving T2 for integration and T3 for the separate manual browser closeout. Those are additional content defects, not the emitted first failure code.

The exact saved diagnostic is `Assessment blocked (ASSESSMENT_DEPENDENCIES): The structured assessment is invalid. Review the assessment format and retry Assessment.` The validator requires 1–12 source-backed findings in each of observations, preservation, dependencies and risks. Its current instruction already says to read every specifically requested file using `read_file`, continue a late page using `nextOffset`/`sourceHash`, distinguish lists from reads and supply one or two findings per array. The observed `list_files` misuse and empty array are model behavior; there is no demonstrated source-level defect to justify a repair cycle. Per the Gate A stop rule, no unchanged-request model retry was attempted.

Actual selected and executed model, completed broker calls, model provisional output, saved failed status and diagnostic establish a **model content/tool-selection failure**. They do not show a provider connection, worker/session, protocol, Chat lease, cancellation or resource-limit failure. The saved record has no Pi failure code, provider usage or separate worker start/exit telemetry for this completed content-validation turn. A valid Chat lease was sufficient to persist its terminal failure; an exact renewal history is not retained. The earlier R2 Pi and lease failures remain unattributed and are not retroactively explained by this result.

On browser reload, the saved failed turn projected **one** blocked `Prompt Stack Draft` card inside the assistant response, showing the specific diagnostic above Copy/response-info/date, with no duplicate generic error bubble. This is a scoped failed-turn restart and presentation PASS; it is not a completed Assessment card. No validated Assessment record was available to inspect.

## Gates B–E and prior evidence reconciliation

| Gate | P8-R4 result | Boundary and carried evidence |
| --- | --- | --- |
| A — source-valid Assessment | **FAIL** | Two of five requested files read; late guide unread; structured dependencies empty; no completed Assessment. P3 citation checks remain source-tested but real-model success is unproved. |
| B — bound Plan | **BLOCKED** | No valid Assessment, so no `/prompt-plan` click/chip, owner-note submission, ten work responsibilities, T2 integration, terminal T3, efficiency audit or Plan persistence. P4/P5 remain unqualified live. |
| C — bound Write | **BLOCKED** | No Plan. Prompt count **0**, no candidate bytes/hashes, incremental finish, natural finalMessage or complete proposal. P6/R2 historical NOT GREEN remains. |
| D — native review/publication | **BLOCKED** | No proposal. Native links/Open All/Source/Diff/Formatted, read-only Save, revisions, Reject/Accept, exact publisher/journal and Work discovery were not live exercised. |
| E — negatives/recovery | **EVIDENCE GAP**, except one scoped failed-turn UI PASS | Duplicate/canonical collision, wrong-project/stale chips, dependency invalidation, cancellation, pending restart, failed revision, replay Accept, wrong-owner/lease and read-only Save were not newly observed in the browser. Current focused source tests below cover several underlying guards; they are not browser observations. |

P1/P2's named identity, durable draft, project/source and collision behavior retain current source-test support and the live creation of one requested slug; no complete draft lifecycle was reached. P3 failed its material real-model source-coverage gate, while preserving strict source validation. P4–P6 were blocked by that failure. P7's report remains **PARTIAL / NOT GREEN**: its same-project second draft/chip switching, pending Plan replacement, full Chat revision retention, applied-only History and integrated adversarial matrix gaps are not closed by this run. Original P8 and P8-R2 remain **NOT GREEN**; P8-R1 remains a narrow headless correction; P8-R3 remains **PARTIAL** headless with historical Pi/lease attribution gaps. No earlier report was edited.

Current-source focused verification after the live stop: the six R3-affected suites (`pi-conversation-runtime`, `pi-runtime`, `prompt-authoring-stage`, `chat-backend`, `chat-repository`, `chat-presentation`) passed **131/131**; `prompt-draft-store`, `incremental-prompt-stack`, `incremental-proposal-controller`, `planning-stack-publication` passed **23/23**. Those tests cover source quotation guards, lease/restart behavior, named-stage invalidation, staged prompt order and partial denial, failed revision retention, exact journal publication, collision and replay denial. They do not supply the missing real-model Plan/Write or connected-browser Accept/negative evidence. `git diff --check` passed. No native Electron GUI was run, so parity is unobserved.

No Work grant/Run, candidate promotion, Roadmap Criterion/Gate award, Phase completion or product version advance occurred in this fixture workflow. The mandatory next qualification entry remains a **complete, valid, five-file Assessment under a stable real Pi turn**. Only after that Gate A PASS can the same chain proceed to bound Plan, incremental Write, native review, guarded exact publication and the remaining material P7/P8 safety cases. This report does not authorize Phase 13 R3/R2/R4 continuation.
