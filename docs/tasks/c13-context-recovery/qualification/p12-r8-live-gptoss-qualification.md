# P12-R8 — live GPT-OSS Assessment qualification

**Final disposition (2026-11-09 America/Chicago): R8 NOT GREEN.** The one live GPT-OSS Assessment fully read all five files, including a successful `continue:true` late-guide page, but did not seal. Repeated model-generated citation/stage mistakes and two premature or invalid `assessment_finish` calls consumed the broker's eight-rejection allowance; the next stage was denied with `ASSESSMENT_TOOL_AUTHORITY`. The saved execution is `failed`, with zero sealed AssessmentRecords and no checked Plan entry. No parser, stream or source-identity failure was observed. No retry was run.

The initial preflight below was **BLOCKED** while the model was unloaded. The owner then loaded the required instance and confirmed readiness; the same R8 task resumed once.

## Source and environment at entry

- Product `main` and `origin/main` HEAD: `7fb84e0d0ca60da91aef503e36caabb72e5c5dda` (`r7`), tree `f755da48d45a1e74519c577e6238881b01198857`; Git status was clean. The R7 implementation and report were committed in this HEAD after the R7 report described them as uncommitted. Parent is `47eb22767bdeded4d84065b60944a01fcc62e7ca`. Product version remains `0.13.11`.
- The committed source has exact GPT-OSS `samplingParams: { temperature: 1, top_p: 1 }`, worker validation of those values, Assessment-only `continue:true`, broker-owned offset/hash resolution, and the explicit wrong-offset `INVALID_OFFSET` branch. The R7 report records 128/128 affected tests, affected extension build, deterministic five-file Assessment, and `git diff --check` as PASS. This preflight has not rerun those tests or built a new served browser candidate.
- Source SHA-256: `pi-model-bridge.ts` `a6ed14a40a7d54d393ac9efaff213a5c294c0d30a90e76587effb6fedc9501f2`; `assessment-read-receipts.ts` `aeed944cc44294a3ee1ad833af77a60424acbe1ffcbbd5bafc4600bf022c4ae1`; `chat-backend.ts` `8d3208a02d4dd97ba25b1cf844aede154256a53971d2c32da2ac2126f802bb9a`; `incremental-assessment.ts` `eca8d49ad87ac452fae04c296b2ad5687ffb56eb13c7f04ee4b415be6d22e990`; Pi `worker.mjs` `d2a8c4075650983a0c4d22936d8507c7fb7adeea8049830f4374365a40252016`.
- Existing compiled extension SHA-256: `lib/node/pi-model-bridge.js` `4fbfde9bf2b7565d54bbd220c72713fe1b496c7096a140608de0889a3081821e`; `assessment-read-receipts.js` `cbaac18881827430202e0c203b9f50c097f77003a9bf9f7df6ea9e32a399b9b1`; `chat-backend.js` `4ba16587475c3e19c277af19fb904e5858caeb3f05a45e220b67857f810f8f84`; `incremental-assessment.js` `86756cdca5578b371a49ca491d072b94bd616dd41d1afddd457c601e4b96781d`. These extension outputs have timestamps after the R7 source files. A served-build equivalence claim still requires rebuilding and checking the browser process.
- Existing browser frontend `apps/browser/lib/frontend/bundle.js` SHA-256 `5bc58abeaed97e7be5872a1de45994c3a5250b2d4e87a5f2bfa30506761c32fd`; backend `apps/browser/lib/backend/main.js` `fa3adda8f99c6be1de2714c841d29ac695dd275ab67235f247435bf6c5d209d1`. Both predate R7 source and are **stale**. No Dope browser backend was listening on ports 3000/3002, and no browser was opened. They must be rebuilt before any connected R8 run; they are not R8 served bundle hashes.
- LM Studio was listening on `127.0.0.1:1234`. Both `lms ps` and `/api/v1/models` reported **zero loaded instances**. The installed model entry identifies `openai/gpt-oss-20b`, MXFP4 and Low default reasoning, but its unloaded metadata does not verify current context, parallelism or effective inference settings. Available RAM was about 21 GiB, root disk 6.9 GiB, and swap zero. No competing loaded model appeared.

## R8 run ledger

| Required evidence | Result at this stop |
| --- | --- |
| Exact R7 committed source, unchanged version, clean entry | Confirmed |
| Owner-loaded GPT-OSS 20B MXFP4, 16,384 context, parallelism 1 | **BLOCKED: no model loaded** |
| Fresh rebuilt frontend/backend and connected browser | Not run; existing browser outputs are stale |
| Fresh tracked-clean five-file fixture and hashes | Not created |
| Chat settings, Chat/execution/draft IDs, one native `/prompt-ass` | None |
| Actual outgoing sampling fields and provider logs | No request made |
| Five brokered reads, guide continuation, Assessment stages/finish | None |
| Sealed record count and checked `/prompt-plan` availability | No R8 Assessment exists |
| Provider completion, token usage, stream/parser outcome | Unknown; no provider run |

No product files, packages, dependencies, manifests, lockfiles, version, canonical prompts, Work, Roadmap Gate or Phase status were changed in this preflight. Historical P12/R3/R6 NOT GREEN and R7 scoped PASS remain unchanged. At this initial checkpoint, the one permitted live R8 Assessment attempt remained unused.

## Resumed model, build and fixture lock

- After owner load, `lms ps` and `/api/v1/models` showed one idle `openai/gpt-oss-20b` MXFP4 instance, context **16,384**, parallelism **1**, selected variant `openai/gpt-oss-20b@mxfp4`, with Low as the provider-reported default reasoning option. The current server log identifies the loaded GGUF as `gpt-oss-20b-MXFP4.gguf`; it mentions Vulkan0 during load. Dope AI Center's existing `LM Studio` connection (`21d03643-2aca-407e-b090-af59979b6c2f`) refreshed to `ready · 1 usable model` and showed GPT-OSS loaded context 16,384. No model, context, parallelism, reasoning, template or LM Studio temperature setting was changed by this task. Before inference, available RAM was about 11 GiB, root disk 6.9 GiB, with no swap or second loaded model. No material resource instability was observed.
- `corepack yarn workspace @dope/browser build` passed with zero browser/node errors on committed R7 source. Rebuilt backend `apps/browser/lib/backend/main.js` SHA-256 `42b37054544d613cc6a32ebfe7975534202e1aaafdb328366d719977fc538070`; frontend `apps/browser/lib/frontend/bundle.js` SHA-256 `5bc58abeaed97e7be5872a1de45994c3a5250b2d4e87a5f2bfa30506761c32fd`. The browser backend listener at `127.0.0.1:3000` was PID 93070 from this checkout. The HTTP-served `/bundle.js` hash matched the local frontend hash. The connected Codex in-app browser opened `http://127.0.0.1:3000/#/tmp/dope-p12-r8-clamp-d97eig7u`. The backend bundle was rebuilt after R7 and served by this process, not the stale preflight R6 output.
- The Pi worker's committed source SHA-256 was `d2a8c4075650983a0c4d22936d8507c7fb7adeea8049830f4374365a40252016`. A narrowly scoped temporary worker `fetch` observer captured only request sequence, model, sampling fields, output limit, message count and streaming flag into a local metadata file. The instrumented worker used during the run had SHA-256 `1ce50a7996ab267cb6b7019642f59b95972b4eeb7ccca5a804a178ddaa3f080c`. The observer and its temporary metadata file were removed after the run; the worker hash returned exactly to the committed value and Git shows no worker diff. The observer did not persist bodies, file contents, credentials, private reasoning or full provider payloads. The rebuilt browser outputs were unaffected by this temporary worker-source observer; the worker is consumed from source.
- Fresh tracked-clean fixture `/tmp/dope-p12-r8-clamp-d97eig7u`, fixture HEAD `8d099d3a06765cbf00e401203c5dfcf583f05291`. At creation, no canonical `docs/tasks/clamp-api-correction/` existed and there was no prior `.dope/` state. One fixture test was not separately rerun; all five tracked bytes were verified against the R6/R7 established hashes. The 6,584-byte late guide has acceptance requirements after byte 4,096.

| Tracked fixture file | SHA-256, before and after |
| --- | --- |
| `src/clamp.js` | `2866677a4450ab1204005da2ab0cf28e203a590b16a8755ec0f867c295ca0827` |
| `test/clamp.test.js` | `c5faeb988f856efacf18a711239ef9d29ba3b9382f032980b3090351dd7ea696` |
| `package.json` | `2a7e453fb2d7914158c7e72a2b66b27e162694200ed8caafa656c53ba6051c8a` |
| `docs/late-guide.md` | `fd4d4c8f3d132b2875ee9fff6fdc6aa0b08d65ff61d4cb4f422857e442763767` |
| `RELEASE_NOTES.md` | `a5b8f34b1383ec2bf8065b70e34f31a0bb6e8b373d6e2de00791a2e0dbf9d55d` |

## Single connected-browser Assessment

The new Chat saved **Managed** context, **Ask each time** at generation limit, **Auto** reasoning, previous messages enabled, default and turn model `LM Studio · openai/gpt-oss-20b`, and Commands **Ask**. The saved execution confirms `contextMode: managed`, `outputLimitPolicy: ask`, exact selected/actual model, and resolution `chat-exact-default`.

- Chat `13acf9c5-0d73-4b24-8dbd-5edd15a6d674`; user message `b90fd67e-bbae-4df7-8c6e-57a964afc451`; assistant message `c7c2e48f-666a-4206-89e5-46462d2de9b5`; execution `9872bc4f-ab53-4c06-895e-d0643c3c1fe7`; draft `48dee97e-1960-4f34-8233-eee001471e36`.
- One `/prompt-ass clamp-api-correction` requested all five reads, complete late-guide coverage using `continue:true`, source-backed categories, preservation/dependencies/risks/scope/T1/T2/T3 and `assessment_finish`. No file bodies or prepared findings were injected. No second command, Retry or manual stage completion was used.
- Execution `2026-11-10T03:19:29.741Z` to `03:22:44.492Z` (**194.751 seconds**). Saved status `failed`; browser reload retained the one Chat, ordered transcript and active blocked draft. The UI displayed `Blocked · Assessment blocked (ASSESSMENT_TOOL_AUTHORITY): Start a new authorized assessment turn 5/5 inspected; 7 verified findings; 0 requested sources remaining.` It offered Retry, which was not used.

The temporary request observer saw **30** live Assessment API calls. Every call had `model: openai/gpt-oss-20b`, `temperature: 1`, `top_p: 1`, `reasoning_effort: low`, `max_tokens: 4096`, and `stream: true`; message counts rose from **2 to 60**. This verifies the **requested** sampling configuration at the outgoing HTTP boundary, not LM Studio's effective engine temperature. The owner-selected Auto reasoning resolved to Low on these calls.

## Brokered source coverage and accepted stages

The saved broker events and draft pages agree on complete coverage. The inspected LM Studio request history shows the model's actual next-page tool arguments were `{path:"docs/late-guide.md",continue:true}` with no offset or source hash. The broker event for that call reports `offset: 4096`, `endOffset: 6584`, `sourceHashSupplied: false`, `status: completed`. The two guide pages retain one source identity. The observer extracted only tool name, path, offset/continue and hash-presence metadata from the developer log; no request payload was retained for the report.

| Required file | Accepted byte ranges | Result |
| --- | --- | --- |
| `src/clamp.js` | 0–89 | Complete |
| `test/clamp.test.js` | 0–264 | Complete |
| `package.json` | 0–118 | Complete |
| `docs/late-guide.md` | 0–4096; 4096–6584 | Complete via `continue:true` |
| `RELEASE_NOTES.md` | 0–147, read twice | Complete; second read did not create a duplicate finding |

There were **29** saved tool outcomes, matching 29 unique tool-call IDs visible in later provider requests: one successful `assessment_status`; seven successful `read_file`; one denied `read_file` for model-generated `RELEASE_NOTE...` (wrong path, `AUTHORITY_DENIED`); eleven accepted `assessment_stage`; seven rejected `assessment_stage`; and two rejected `assessment_finish`. The denied read supplied no coverage. The draft holds six accepted source-backed observations and one preservation finding, plus accepted scope, tiers, and justified-empty dependencies and risks. Its partial pages cover all five requested files; it has no sealed `assessment` record.

Recoverable stage rejections were two `ASSESSMENT_CITATION` attempts before the release-note read, then two more `ASSESSMENT_CITATION` and one `ASSESSMENT_UNSUPPORTED_SOURCE` around the release-note finding; the model corrected these and the owner accepted the sixth observation. A later changed scope was rejected as `ASSESSMENT_CONFLICTING_REPLAY`, preserving the original accepted scope. The first `assessment_finish` returned `ASSESSMENT_CATEGORY_INCOMPLETE` before tiers/dependencies/risks were staged. The model then staged those categories, but its T1/T2/T3 text lacked the required **focused source/unit** and **manual browser** qualification wording; the second finish returned `ASSESSMENT_TIERS`. The accepted tier text was `T1: src/clamp.js unit test updates`, `T2: docs/late-guide.md integration with new API`, `T3: Release notes documentation`. The model's subsequent attempted tier correction was rejected with `ASSESSMENT_TOOL_AUTHORITY` because the previous eight Assessment tool rejections had reached the broker's per-turn protective limit. This is a real broker authority stop caused by the accumulated invalid model calls; it is not evidence that a valid `continue:true` read failed.

`assessment_finish` never succeeded. Sealed AssessmentRecord count is **zero**. The reloaded card remained blocked and offered no checked `/prompt-plan` action. No provider/model final answer completed successfully.

## Provider boundary and final integrity

The relevant LM Studio developer-log interval was **21:19:29–21:22:44 America/Chicago**, corresponding to the saved Dope execution. It contains 32 chat-completion starts in the interval; **30** have the R7 sampling fields and match the observer's live Assessment requests, while two are separate preflight/probe traffic. It records 30 `Finished streaming response` entries, up to 60 messages, and 23 engine slot-release entries with `truncated = 0` (largest logged release `n_tokens = 7,444`). These release values are engine slot diagnostics, not provider usage totals or proof of active context occupancy. No `common_chat_peg_parse`, peg-native, stream-error or engine error entry appears in this interval. No HTTP error status, engine code 500, output-length stop or actual per-call context occupancy was observed. Provider token usage and finish reasons are **UNKNOWN** from retained safe evidence. The saved terminal failure is the Assessment authority limit, not a demonstrated provider parser/transport failure or 16K exhaustion.

After the run, all five tracked fixture hashes remained unchanged and `git diff` inside the fixture was empty; only `.dope/` Chat/draft state is untracked. No canonical prompt directory or publication journal was created. The saved Chat has one user Assessment command and one failed assistant execution; there is no `/prompt-plan`, `/prompt-write`, Work Run, Roadmap Gate or Phase award. The product remains at HEAD `7fb84e0d0ca60da91aef503e36caabb72e5c5dda`, version `0.13.11`; final Git status has only this untracked report. `git diff --check` passed. The temporary observer was removed and the Pi worker's committed SHA-256 was restored. The owner-loaded LM Studio model was left unchanged.

**R8 scoped verdict: NOT GREEN.** Sampling, five-file reads, source-bound late-guide continuation and several staged findings were verified live. Required tier validation, successful `assessment_finish`, exactly one sealed record, checked Plan availability and successful assistant completion failed. Preserve this one failed-state record and all historical P12/R1–R7 dispositions; do not replay R8 or infer that intermittent peg-native failures are resolved.
