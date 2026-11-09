# c13-pfix P8-R8 — final-source transport and incremental Assessment, 2026-11-09

**Overall: PARTIAL / NOT GREEN.** Gate A's deterministic transport matrix and Gate B's exact-source GPT-OSS probe passed. Gate C's one connected-browser Assessment did not seal: four requested files were fully covered, the late guide was only partially read, two findings were accepted, three later stage calls were rejected, and the turn paused at an output limit before the browser backend exited. Reload preserved one blocked incomplete draft with no Plan action. This result does not change P7, original P8, or P8-R1 through P8-R7, and does not qualify c13-pfix or Phase 13.

## Source, environment, and revision boundary

- Starting `main` and final **product source** HEAD: `e4f301e095be69389c21e08d4e9228e4bc7786bb`, initially clean and aligned with `origin/main`. Product version stayed `0.13.11`. The only repository changes for R8 are the focused transport matrix test and this report. No product repair was justified. The later test/evidence commit is a reporting boundary, not a different product candidate.
- Read BOOT, AGENTS, workflow, ADR 0055, ADR 0056, the named-chain contract, c13-pfix assessment/plan, and R5/R6/R7 reports. Inspected worker, host, conversation, model bridge, ChatBackend dispatch, ChatRepository persistence, and relevant tests. Earlier evidence and executed prompts remain intact.
- Source SHA-256: Pi worker `0988924e8ff74242cc0847a1b4663014f49b2b7b206fd9449a8ec6fc0f7b722b`; host TypeScript `de626952c212ce12d284d4917631438732c3332a3057168143d615ea0fcdb6c3`; compiled host `e432cae76ae1630e5568073013ddca75620b833ecc07e94fc78dea48b9b794c8`; conversation runtime `3c09b2a410feae6503840e3db455be5d231721c9e579d579198ae87a4b74c1d8`; model bridge `9488558d18ab9c528b328dadc82beaabe904c581e388afec4872052e3cbcff35`; ChatBackend `3ff520936e08f97aea612e0fc3d674824e871158febb7131617fd2aa0ff65e14`; ChatRepository `73493b3107a0ec40e34411781aa1947f575fb5da36e1cb0e852e79ea490086c0`.
- Browser build SHA-256: served frontend `apps/browser/lib/frontend/bundle.js` `6a2ba429869593474428d088d048fc42bf22e8b6b61dc070d8d6377257bfb351`; backend bundle `apps/browser/lib/backend/main.js` `debac3722456e67bb1e9ca908d961c63cc75212d79c878de46afa594de3cfb38`; extension Chat widget `57b455486ce426246c4a8002b221e3ca9d8d4c6a4f62f8cd47f6a18663972e67`; Assessment instruction `6caee38d25df21c3e34219b4bb256f619175fa66f8b09019ed78ebe12ce09f43`.
- LM Studio at `http://127.0.0.1:1234/v1` reported `openai/gpt-oss-20b` loaded with context length `8192`; the connected browser AI Center showed `ready · 1 usable model`. Browser Chat explicitly selected that model. The browser URL was `http://127.0.0.1:3000/#/tmp/dope-p8-r8-clamp-lkv6vwnf`. This was the connected Codex in-app browser, not native Electron.

## Gate A — transport fault matrix: PASS for deterministic scope

The new `test/unit/pi-transport-fault-matrix.test.mjs` uses the compiled `PiRuntimeHost` request/frame path with controlled broker callbacks. Its two-worker case drives two **real bundled Pi worker processes** through the host using a deterministic local OpenAI-compatible provider fixture; both independently offer local tool ID 1 and complete. Existing `pi-runtime`, `pi-conversation-runtime`, ChatBackend, ChatRepository, and draft tests cover worker tool boundaries and owner/lease guards. These are fault injections, not a reproduction of the unknown R6 exception. The real GPT-OSS worker/host path is separately exercised in Gate B.

| Required case | Result and checked boundary |
| --- | --- |
| 1. Consecutive healthy calls | PASS: exact request/tool IDs; each reply acknowledged. Existing seven-name R6 replay stays correlated through tool 7. |
| 2. Two workers, overlapping IDs | PASS: two real bundled workers on independent hosts each used tool ID 1 without cross-session acknowledgement or replay. |
| 3. Out-of-order responses | PASS: reversed broker completion retained each tool ID and cleaned both pending entries. |
| 4. Duplicate request before broker | PASS: rejected `tool_reply_duplicate`; only one broker effect. |
| 5. Duplicate result after acknowledgement | PASS: rejected `tool_reply_duplicate`; no second completion. |
| 6. Wrong request ID | PASS: rejected `tool_reply_unmatched`. |
| 7. Wrong tool ID | PASS: wrong acknowledgement rejected `tool_reply_invalid`; wrong/unmatched worker tool result rejected `tool_reply_unmatched`. |
| 8. Unmatched result | PASS: worker rejected `tool_reply_unmatched`; output content absent from error. |
| 9. Conflicting replay | PASS: duplicate tool ID with changed arguments rejected before second broker effect. |
| 10. Malformed broker result/frame | PASS: nonstring output rejected `tool_reply_invalid`; unknown offered tool rejected `model_tool_call_invalid`. |
| 11. Denial versus failure | PASS: distinct `denied` and `failed` broker statuses reached their own acknowledged replies. |
| 12. Delivery failure | PASS: injected `tool_reply_delivery_failed` retained unacknowledged active tool and cleared it on failure. |
| 13. Exit with pending tool | PASS: `session_closed_with_pending_tool`, no acknowledged result and safe cleanup. |
| 14. Cancel awaiting broker | PASS: host disposal rejected the pending turn; existing AbortController continuation test covers signal cancellation. |
| 15. Late reply after cancel | PASS: late broker settlement sent no tool result or new effect. |
| 16. Stale lease/project switch | PASS in existing `prompt-draft-store` and ChatBackend tests: foreign lease, changed project/source and abort deny progress. |

The matrix checks correlation, acknowledgement, no duplicate execution, cleanup and bounded safe errors. Broker completion is recorded separately from worker acknowledgement. It is a controlled fault matrix; arbitrary concurrent provider traffic and a two-worker **real-model** stress run were outside this gate. The original seven R6 operations are replayed by the existing Pi test, then controlled protocol faults by the new matrix. There is still no basis to name the R6 failure mechanism.

Commands: `corepack yarn workspace @dope/chat build` and `corepack yarn workspace @dope/theia-extension build` passed; `node --test test/unit/pi-transport-fault-matrix.test.mjs` passed **7/7**; the existing ten-file Pi/Chat/Assessment suite passed **166/166**. The combined eleven-file run passed **173/173**. `npm run build:browser` passed with zero browser/node bundle errors.

## Gate B — real GPT-OSS transport: PASS on the same product source

One disposable project `/tmp/dope-p8-r8-transport-lwGOpt` held real `src/alpha.js` and `src/beta.js` files. A single real GPT-OSS 20B turn used the bundled worker, compiled `PiRuntimeHost`, and `ChatProjectGrounder` for brokered read/search operations. Worker diagnostics were `1.4.0` and `supervised-worker`. It finished normally with actual model `openai/gpt-oss-20b`, `finishReason: stop`, after **20,965 ms**. LM Studio reported 3,448 input, 179 output, 74 reasoning, and 3,627 total tokens for the turn. No synthetic model output or tool call substituted for inference.

| Operation | Pi request ID | Tool ID | Broker | Worker acknowledgement |
| --- | ---: | ---: | --- | --- |
| `list_files` | 3 | 1 | completed | confirmed, matching IDs |
| `read_file` | 3 | 2 | completed | confirmed, matching IDs |
| `read_file` | 3 | 3 | completed | confirmed, matching IDs |
| `search_text` | 3 | 4 | completed | confirmed, matching IDs |

No failure stage occurred. The probe recorded safe names, IDs, statuses and usage only. The worker/host files remained identical before Gate C. Gate B does not itself validate Assessment.

## Gate C — connected-browser incremental Assessment: FAIL / NOT GREEN

The fresh disposable ESM Git fixture `/tmp/dope-p8-r8-clamp-lkv6vwnf` started at clean HEAD `2801f75d0c7a67fff85cc70cbad229f0e8075d89`, package version `1.4.2`. The guide's late acceptance heading begins at byte **6285**, beyond its first read page. Baseline and final fixture source hashes matched:

| Requested file | Bytes | SHA-256 | Broker coverage |
| --- | ---: | --- | --- |
| `src/clamp.js` | 89 | `2866677a4450ab1204005da2ab0cf28e203a590b16a8755ec0f867c295ca0827` | `0–89`, full |
| `test/clamp.test.js` | 264 | `c5faeb988f856efacf18a711239ef9d29ba3b9382f032980b3090351dd7ea696` | `0–264`, full |
| `package.json` | 118 | `2a7e453fb2d7914158c7e72a2b66b27e162694200ed8caafa656c53ba6051c8a` | `0–118`, full |
| `docs/late-guide.md` | 6584 | `fd4d4c8f3d132b2875ee9fff6fdc6aa0b08d65ff61d4cb4f422857e442763767` | `0–4096`, partial; late section unread |
| `RELEASE_NOTES.md` | 147 | `a5b8f34b1383ec2bf8065b70e34f31a0bb6e8b373d6e2de00791a2e0dbf9d55d` | `0–147`, full |

The exact requested native `/prompt-ass clamp-api-correction …` command was submitted once in Chat with `LM Studio · openai/gpt-oss-20b` selected. Saved execution `af167cd0-cefc-470f-81d2-10dd62b207bb` confirms selected and actual local model `openai/gpt-oss-20b`, connection `21d03643-2aca-407e-b090-af59979b6c2f`, output policy `ask`, 2,048-token segment ceiling. The saved turn's status after restart is `interrupted`, finish reason `length`, with provider-reported aggregate usage 30,763 input, 522 output, 102 reasoning, 31,285 total tokens. The browser displayed a generation-limit pause at about 1m36s; the backend subsequently went offline. The backend exit cause is **unattributed** by the retained log; no OOM event was found in the checked kernel log. No unchanged model attempt was repeated.

Saved broker order: `assessment_status` completed; `read_file` clamp completed; `assessment_stage` completed; `read_file` test completed; `assessment_stage` completed; `read_file` package completed; two `assessment_stage` calls failed; `read_file` guide first page completed; one `assessment_stage` failed; `read_file` release notes completed. The trusted requested list remained exactly the five paths. Full coverage progressed **0/5 → 1/5 → 2/5 → 3/5 → 3/5** (guide partial) **→ 4/5**. Listings/searches were not counted as reads; no unrequested source read appears. The late guide continuation did not occur.

The two accepted findings cite unique exact excerpts in `src/clamp.js` and `test/clamp.test.js`; Dope saved derived byte offsets `43–86` and `151–186` with pinned broker source hashes. Thus `assessment_stage` did **not** become universally broken after its first call. Three subsequent calls were rejected, and earlier accepted findings remained intact. The saved broker record contains the failed statuses but neither their validation codes nor their argument payloads, so this evidence cannot distinguish malformed model arguments, unsupported/ambiguous quotations, premature empty-category claims, or a product validator defect. No speculative repair was made. There were no accepted preservation/dependency/risk/scope/tier stages, no `assessment_finish`, no sealed `AssessmentRecord`, and no completed card or enabled `/prompt-plan` action.

After restarting the same backend source and reloading the connected browser, the saved Chat showed **one** blocked `Prompt Stack Draft` card and the incomplete output-limit diagnostic, without a duplicate card. The protected draft retained five page records (one partial), two accepted observations, no completed Assessment, and the named slug/source HEAD. Reload changed the interrupted pause to an error display; it did not silently seal the draft. `/prompt-plan` remained unavailable. No canonical `docs/tasks/clamp-api-correction/` directory exists; tracked fixture bytes are unchanged and only `.dope/` runtime state is untracked. No Work grant/Run, applied History, Roadmap award, Gate GREEN, version change, or Phase 13 advance occurred.

## Decision and remaining limits

| Gate | Disposition |
| --- | --- |
| A — final-source transport fault matrix | **PASS for the deterministic matrix**, with real-model path confirmed separately by B. |
| B — exact-source real GPT-OSS transport | **PASS** for four consecutive read/search operations, each worker-acknowledged. |
| C — connected-browser incremental Assessment | **FAIL / NOT GREEN**: 4/5 full source coverage, three rejected stages, no finish or sealed record. |
| Overall P8-R8 | **PARTIAL / NOT GREEN**. |

The original R6 `tool_protocol` failure remains unattributed. R8 does not prove late guide continuation, all required categories, guarded finish, completed-card reload, Plan binding, or Electron parity. Plan, Write, proposal review, guarded publication, remaining P7 negatives, and Phase 13 recovery remain separate and unqualified. Stop after R8; do not start R9 or R3/R2/R4 automatically.
