# c13-pfix P8-R7 — Pi tool protocol recovery, 2026-11-08

**Targeted disposition: PARTIAL.** The headless transport correction and one bounded live GPT-OSS read/search probe passed their tested scopes. The original P8-R6 failure remains unattributed because its saved record contains neither the worker exception nor the next frame. The live probe ran before the final transport bookkeeping and classification edits, so it is not an exact-final-source model qualification. This report does not qualify c13-pfix, the five-file Assessment, or Phase 13 progression.

## Source and authority

- Entry: clean `main` at `175934ffecc58a0785ab4876d673eecd83faf435`, aligned with `origin/main`; product version `0.13.11`.
- Final tested source and tests: `31867c1e` on `main`, product version still `0.13.11`. This report is the subsequent evidence-only commit; its hash is recorded by Git and in the delivery summary.
- Read BOOT, AGENTS, workflow, ADR 0055, ADR 0056, the named prompt authoring chain contract, and P8-R3/R5/R6 qualification. Inspected current source, compiled Pi dependency/runtime, Pi model bridge, broker and persistence tests. No historical qualification or executed prompt was changed.
- No `codex:phase`, canonical prompt write, Work Run, Roadmap award, phase completion, version advance, reset, stash or clean occurred.

## Original R6 evidence and limit

R6's real GPT-OSS 20B turn recorded seven broker operations: root `list_files`, `search_paths`, `read_file` of `src/clamp.js`, `list_files` of `test`, `read_file` of `test/clamp.test.js`, `read_file` of `package.json`, and `search_text`. The turn ended with `tool_protocol`, three of five requested files covered, no `assessment_status`, `assessment_stage` or `assessment_finish`, and no sealed Assessment. These seven saved broker outcomes show broker completion, not necessarily worker acknowledgement. No saved exception or next protocol frame identifies the failing boundary. This correction does **not** assign a cause to the seventh result or to any provider-generated call.

## Transport path and demonstrated gaps

The current path is GPT-OSS/OpenAI-compatible tool call → Pi's typed tool execution → `worker.mjs` wrapper and worker tool-request frame → `PiRuntimeHost` callback → ChatBackend `projectTools.execute` and source broker → host tool-result frame → worker pending lookup → acknowledgement → Pi session continuation. ChatBackend retains the authoritative tool events and Assessment read coverage; the worker and host do not gain file or publication authority.

Source inspection found these defects independent of the unknown R6 cause:

1. Worker pending results were matched by tool ID alone. Host replies carried no originating turn/request ID. A stale reply could therefore pass the lookup if the ID matched a pending call.
2. Host accepted a repeated tool-request frame without remembering the tool ID, allowing a second broker invocation. It also did not check that a worker acknowledgement echoed the request and tool IDs.
3. Worker exceptions while processing tool-result frames were all reported as `tool_protocol`; host asynchronous reply failure became a generic error. The saved execution retained no last acknowledged receipt.
4. Host callback rejection was labeled a denial even when the broker failed for another reason.

The repair binds each pending worker tool to its Pi request ID and name; every host result carries request ID and tool ID, validates status/output shape, and requires an acknowledgement echo before marking the receipt confirmed. Worker tool IDs are monotonic in a session and accepted IDs are retained in a bounded replay set. Host records offered tool IDs before invoking the broker, so repeated frames fail closed before a second effect. An uncertain acknowledgement never triggers a broker retry. Cancellation/disposal rejects pending operations. A new host session clears its correlation sets.

The typed failure codes now distinguish `model_tool_call_invalid`, `broker_tool_denied`, `broker_tool_failed`, `tool_reply_invalid`, `tool_reply_unmatched`, `tool_reply_duplicate`, `tool_reply_delivery_failed`, `worker_dispatch_failed`, `session_closed_with_pending_tool`, and `tool_protocol_unknown`, while retaining existing provider, worker and resource codes. Ordinary broker denial still returns tool feedback to Pi under the existing recovery contract; a transport corruption fails the turn. A broker exception is no longer automatically relabeled as authorization denial. The model does not supply transport IDs or receive new tool authority. The Assessment tools retain top-level object schemas.

At terminal failure, the saved `ChatExecution` can retain a bounded `toolFailure`: stage, request/tool IDs and safe tool name when known, last confirmed acknowledged operation, acknowledgement flag, and elapsed milliseconds for an active tool. The parser rejects paths and free-form content in the tool-name field. Raw arguments, source bytes, provider payloads and credentials are absent. The UI continues to show one short blocked Prompt Stack Draft card in the originating response; the diagnostic metadata is saved with execution, not rendered as a second error bubble. A failure after a broker result but before acknowledgement does not mark that result confirmed.

## Verification

Built only changed compiled dependencies in order:

- `corepack yarn workspace @dope/chat build` — PASS.
- `corepack yarn workspace @dope/theia-extension build` — PASS. The Pi worker has no build script and runs directly in tests.
- `node --test test/unit/pi-runtime.test.mjs test/unit/pi-conversation-runtime.test.ts test/unit/chat-backend.test.ts test/unit/chat-repository.test.ts test/unit/chat-presentation.test.ts test/unit/prompt-authoring-stage.test.ts test/unit/prompt-draft-store.test.ts test/unit/incremental-prompt-stack.test.ts test/unit/incremental-proposal-controller.test.ts test/unit/planning-stack-publication.test.ts` — **166/166 PASS** on `31867c1e` source.
- `git diff --check` — PASS before the source/test commit and for this evidence file.

The focused tests cover healthy Pi tool loops, the seven R6 operation names followed by a controlled invalid next call, duplicate tool request before a second broker effect, malformed broker output, wrong acknowledgement tool ID, unmatched result, pending-worker close, continuation/cancellation and lease behavior, saved diagnostic reload, one card presentation, Assessment coverage/citation/stage/finish rules and publisher guards. The seven-call replay uses a controlled host fixture; it does not reproduce the R6 exception. A single combined real-worker/host fault-injection matrix for every requested fault and a dedicated two-worker out-of-order test were not completed. Those cases remain bounded verification gaps, rather than implied passes.

### Isolated real-model probe

LM Studio reported `openai/gpt-oss-20b` loaded with context 8192. One disposable `/tmp` fixture and one real model turn used the actual bundled Pi worker, `PiRuntimeHost`, and the existing `ChatProjectGrounder` read/search methods. The model called, in order, `list_files`, `search_paths`, `read_file`, and `search_text`; each returned a completed broker result. The worker acknowledged tool ID 4 under Pi request ID 3, and the turn completed with actual model ID `openai/gpt-oss-20b`. No command, canonical write or Assessment tool was invoked. This is **PASS for that narrow live transport probe**. The probe preceded final changes to bounded replay bookkeeping, failure metadata and host startup reset; the final-source headless suite passed afterward. It is not a final-source Assessment or browser qualification.

## Dispositions and remaining work

| Scope | Result | Limit |
| --- | --- | --- |
| Headless protocol correction | **PASS for tested invariants; PARTIAL against the full requested fault matrix** | Fault fixtures and 166 focused tests passed; two-worker and complete post-seven fault matrix are not exhaustive. |
| Isolated real GPT-OSS transport probe | **PASS for four read/search calls** | One actual worker/host turn, on the earlier tested build; no Assessment or exact-final-source live replay. |
| Original P8-R6 failure attribution | **UNKNOWN / EVIDENCE GAP** | No worker exception or next frame survived R6; this report does not infer its cause. |
| Overall P8-R7 target | **PARTIAL** | The requested full failure matrix and exact-final-source live qualification are incomplete. |

A failed Pi turn still cannot seal Assessment; incomplete durable findings remain incomplete, Plan remains unavailable, and a new authorized retry checks current source, owner and lease. P7/P8 historical verdicts are unchanged. No Work grant/Run, publication, History application, Roadmap Criterion/Gate GREEN or Phase completion follows from this correction. Phase 13 recovery remains ON HOLD. Stop here; P8-R8 and full browser qualification are separate work.
