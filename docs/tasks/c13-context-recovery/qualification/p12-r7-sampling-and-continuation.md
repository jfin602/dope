# P12-R7 — explicit GPT-OSS sampling and broker-owned continuation

**Disposition:** Sampling **PASS** for outgoing API requests. Protected Assessment continuation **PASS** for the scoped broker contract and deterministic five-file Assessment. These are independent results. P12, R3 and R6 remain **NOT GREEN**; the intermittent live GPT-OSS peg-native parser failure remains unresolved. No product version, canonical prompt, Work, Roadmap Gate or Phase status changed.

## Basis and changed files

- Initial and final product HEAD: `47eb22767bdeded4d84065b60944a01fcc62e7ca` (`r6 not green`), product version `0.13.11`. The worktree was clean at entry. The R6 closeout is already committed in this HEAD, despite the R7 task text describing it as reported uncommitted. R5 is committed at `b8c4e8fb8e108c5dd2eb1ec0cfd53631f6ff7b92`.
- Changed product source: `packages/theia-extension/src/node/pi-model-bridge.ts`, `assessment-read-receipts.ts`, `chat-backend.ts`, `incremental-assessment.ts`, and `packages/pi-runtime/worker.mjs`.
- Changed tests: `test/unit/pi-model-bridge.test.ts`, `pi-runtime.test.mjs`, and `protected-assessment-worker.test.ts`. This report is new. No prior qualification report, package manifest, dependency, lockfile or model version was changed. No commit was made.

## A. Sampling — PASS for requested API parameters

The exact refreshed local LM Studio model key `openai/gpt-oss-20b` receives Pi model-level `samplingParams: { temperature: 1, top_p: 1 }` in `PiModelBridge`. The isolated worker accepts this field only for that exact model and those two values, registers it with the installed Pi model runtime, and otherwise leaves the model and thinking level unchanged. The installed OpenAI-compatible adapter merges model sampling parameters into its serialized chat-completions payload. This is a supported Pi field, not an unrecognized configuration object or a global fetch patch.

Request-level evidence has two parts. A bridge-to-real-worker HTTP capture selected `openai/gpt-oss-20b` and observed `model: "openai/gpt-oss-20b"`, `temperature: 1`, `top_p: 1`, and `reasoning_effort: "low"` on the serialized request. The protected five-file Assessment fixture captured and asserted the same fields on **every** simulated GPT-OSS request, including later tool-calling turns; Assessment tool definitions and paired assistant/tool messages remained valid. A separate real-worker Qwen request serialized neither temperature nor top_p. The bridge's other-model binding and the worker's invalid Qwen sampling rejection also passed. Existing remote/hosted selection denial tests passed; this change only enters the already local-only bridge and worker.

No live LM Studio request was attempted. Thus LM Studio acceptance of the fields and its **effective engine sampling** are unknown. This result proves the values requested on actual HTTP payloads, not that they fix or reproduce the peg-native parser failure.

## B. Protected Assessment continuation — PASS

The Assessment-only `read_file` schema now accepts `{ path, continue: true }` after a verified first page. The model no longer supplies a source hash or byte offset for routine next-page reads. `AssessmentReadReceipts.next` supplies the exact verified offset and original source hash only when the receipt agrees with the active project's root and handle, owner, Chat, execution, lease, requested path, unexpired time window and Assessment coverage. The broker checks active turn, cancellation and project state before resolution and again after the grounder read. The grounder rehashes current file bytes against the receipt hash; the Assessment owner grants coverage and the receipt advances only after a successful read. EOF and duplicate continuation fail. Ordinary Chat, Docs, Work and explicit Assessment offset/hash reads retain their prior contracts.

Malformed or mixed arguments are rejected before receipt lookup. `continue:true` with `offset` or `expectedSourceHash` is invalid; explicit wrong offsets and hashes are never replaced by trusted values. The R6 case now returns **`INVALID_OFFSET: Expected nextOffset 4096; received 4098.`** rather than `SOURCE_IDENTITY_REQUIRED`. Missing trusted identity still returns `SOURCE_IDENTITY_REQUIRED`. Rejected reads grant no coverage.

The real Pi worker, Chat broker and Assessment owner completed the original five-file clamp fixture. The guide's first path-only read returned bytes 0–4096; a later `continue:true` call returned bytes 4096–6584, and the two page texts reproduced the complete 6,584-byte guide. All five files were fully inspected. Source-backed observations, preservation, dependencies and late-guide risk, scope, and T1/T2/T3 were accepted. `assessment_finish` succeeded, exactly one sealed AssessmentRecord was checked, and `/prompt-plan` entry was available. No canonical publication or duplicate effect occurred.

Negative coverage included continuation before the first page, foreign path, explicit 4098 and 5000 offsets, incorrect explicit hash, `continue:true` mixed with offset or hash, repeat continuation after EOF, explicit duplicate page, mismatched or missing coverage, changed file bytes, expired receipt, foreign project/root, Chat, execution, lease or owner, inactive/cancelled execution and a new execution without a receipt. The broker fixture and direct receipt/grounder tests rejected these without granting source coverage. The pre/post broker guards cover project switch and cancellation; those races were not replayed in a live UI.

## Validation and limits

- Built only `@dope/theia-extension` after source changes; the Pi worker is consumed from source. Build passed.
- Direct changed tests passed. The final consolidated affected matrix passed **128/128** across protected Assessment worker, Chat backend, Pi model bridge, Pi conversation runtime, Pi runtime, Pi transport fault matrix and prompt authoring stage. An earlier matrix run found an offset-zero reread regression; it was corrected and the final matrix passed.
- `git diff --check` passed. No broad suite, Electron packaging or live browser Assessment was run.

The R6 live Assessment remains cancelled/incomplete and **NOT GREEN**. No R8 live run occurred. The intermittent live parser failure, LM Studio's effective sampling and native/hosted parity remain separate evidence gaps.
