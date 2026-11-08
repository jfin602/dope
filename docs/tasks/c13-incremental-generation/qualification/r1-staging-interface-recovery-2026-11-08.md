# R1 staging interface recovery — 2026-11-08

## Source and disposition

Standalone headless recovery on initial HEAD `12e6751ac3a5446747808c3bd212066110fb5421`, product version `0.13.11`. The worktree was clean at entry. The three P6 repair edits described in the original P6 closeout were already in HEAD: sorted Pi tool boundary comparison, `sourceHash`/`fullHash` read guidance and wrong-hash rejection, and idempotency-key validation/staging instructions. They were preserved and evaluated. The model-facing hash and idempotency instructions are now superseded by broker-owned values; the underlying source checks and durable replay validation remain.

R1 headless verdict: **PASS** for the repaired interface and deterministic cases below. This is not a P6 GREEN result. R2 must independently run the selected GPT-OSS 20B browser workflow on this exact repaired source. No live inference, browser, Electron, Work Run, Roadmap award, product version change or original P6 evidence rewrite occurred here.

## P6 failure to repair

| P6 finding | R1 repair |
| --- | --- |
| Large Docs review staged files but did not finish; hash confusion | Direct `path/operation/before/after` fields; broker binds the full hash from an actual read page or the selected revision's saved after hash. Late pages and multi-chunk creates pass the protected integration test. |
| Six instead of ten work prompts and missing closeout | Typed work/section/closeout fields; requested count bound from recent Chat request and saved plan/assessment; early closeout and wrong count rejected; one terminal browser-required closeout, ten distinct efficiency findings and explicit T2 gate checked. |
| Revision repeated `PROPOSAL_STAGE_ARGUMENTS` | Pi supplies no sequence, revision, chunk number, digest, hash or idempotency key. The serialized durable controller derives them from its active lease/session. Selected pending Docs proposal remains the revision basis. Errors identify a safe field/operation and recovery step. |
| Model guessed transaction fields and produced incomplete final output | `proposal_status` reports purpose, completed and incomplete targets, remaining budgets, finish readiness and next action. Only successful `proposal_finish(finalMessage)` seals a candidate; failures keep provisional evidence nonactionable. |
| Earlier assessment/plan omitted requested source evidence | Existing actual broker-read source references and explicit omission disclosure remain. Prompt authoring now binds an explicit requested work count from the recent source conversation as well as saved drafts. |

## Model-facing tool boundary

| Tool | Before R1 | After R1 |
| --- | --- | --- |
| `proposal_status` | `{version:1}` | `{}`; concise authoritative receipt |
| `proposal_stage_document` | version, sequence, expectedRevision, idempotencyKey, target, chunkIndex, JSON-encoded content, optional digest, complete | path, operation, before/after for replace **or** chunk for create, complete; selected-proposal remove is limited to an unpublished target |
| `proposal_stage_prompt` | same bookkeeping and JSON-encoded content | target, kind and direct typed work, section or closeout fields, complete |
| `proposal_finish` | finalMessage | finalMessage |

The Pi transport's stable tool-call ID is forwarded to the protected broker. The controller derives a durable replay key and computes sequence, revision, chunk index and digest in the serialized transaction. Identical content under another call ID is treated as a replay, so ambiguous transport retries cannot append duplicate chunks; a reused ID with changed content is rejected. This deliberately means an identical intended chunk must be combined with adjacent content instead of sent twice. No canonical writer or publisher was added.

## Changed source

`packages/pi-runtime/worker.mjs`, `packages/contracts/src/model-runtime.ts`, `packages/theia-extension/src/node/{pi-conversation-runtime,chat-backend,incremental-proposal-controller,incremental-document-review,incremental-prompt-stack,prompt-authoring-stage,proposal-model-tools}.ts`; focused tests in `test/unit/{pi-runtime,chat-backend,documentation-skill-backend,incremental-cross-skill-integration,incremental-proposal-controller,proposal-model-tools}`. The existing Docs application owner and R3B prompt publisher are unchanged.

## Verification

- Built changed dependency output in order: `@dope/contracts`, then `@dope/theia-extension` TypeScript builds: PASS.
- Focused final Node suite: 76/76 PASS across Chat backend, Docs revision, three-file Docs review with late-page reads and multi-chunk create, ten-work-prompt composition/publication boundary, controller replay/lease/source/cancellation, Pi runtime/schema, Pi model bridge and typed-field negatives.
- `npm run check:pi-runtime`: PASS, Pi 1.4.0 / 121 integrity-locked packages.
- `git diff --check`: PASS.
- One combined test run briefly hit a temporary-directory lease race in an unrelated socket-close test. The test passed alone and in the final combined suite. No product change was made for that race.

## Remaining limits

This verifies deterministic, headless behavior. The repaired tool schema has not been exercised with real GPT-OSS 20B or the native browser UI, so model completion rate, wall time, visual proposal controls and real user acceptance remain R2 evidence gaps. The ten efficiency findings are checked for count, distinctness and bounded content; human review still judges whether their reasoning is substantively correct. Count binding requires an explicit count in recent Chat or saved assessment/plan text; an unstated count cannot be inferred safely. R1 does not qualify P6, R3B, Docs Revise in a real browser, Work, Gate or Phase 13.
