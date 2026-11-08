# IG-R3 headless recovery — 2026-11-08

## Basis and disposition

Starting HEAD: `7e5e3745fc768e0cc3013fbf0c90b393e379b37e` on a clean `main`, the exact R2 source. Final tested product source HEAD: `eb0fcda3c796b38c88a45799f35efc4c4ccc7fc9` on `codex/ig-r3-headless-recovery`. This report is a subsequent documentation-only commit. Product version stays `0.13.11`.

**IG-R3 headless scope: PASS.** The deterministic source, provider, broker, controller and publisher tests below pass. This is not a live GPT-OSS or browser qualification. Original P6 and R2 remain **NOT GREEN**; R1 PASS and all prior evidence remain unchanged. IG-R4 remains a separate connected-browser qualification, and Phase 13 recovery remains on hold.

## R2 failure → repair

| R2 observation | IG-R3 change | Headless evidence |
| --- | --- | --- |
| Three Docs targets reached `finishPermitted:true`, then the model stopped without `proposal_finish`. | ChatBackend checks the authoritative receipt, current source and lease after a normal provider stop. A complete staging session receives one tool-focused prompt in the **same Pi session**. The worker permits it once, within the original output ceiling; the broker permits only `proposal_status` and `proposal_finish` during that continuation. | A real typed broker test stages two late replacements and a three-chunk create, stops without finish, then invokes protected finish during one continuation. The ready candidate has exact bytes and one finalMessage; no file is written until the test's explicit Accept. Worker fixture proves one same-session finish tool call and rejects replay and a larger output ceiling. |
| Incomplete P1 was followed by opaque rejected stages and blind retries. | Stage validation now identifies the rejected work, section or closeout field. The model receives a specific expected constraint and retry action. Three identical rejected prompt-stage arguments produce STOP/REVISE guidance; rejected calls do not advance the stage sequence. Prompt instructions describe the live fields, `complete:false` section transition, status, ordered work and separate closeout. | P1 incomplete work metadata, invalid empty section, corrected section, P2 through P10, independent closeout and sealing pass. Three identical invalid section calls return two field errors then a bounded repeat error. Existing guarded publication remains separate. |
| Assessment confused T1/T2/T3 with retrieval; plans could be saved with no read, invented source/CI, missing steps and nine wrong gates. | Assessment drafts must name actual broker reads, disclose requested uninspected paths and define the three verification tiers. For an explicit work count, plans require numbered executable responsibilities, grounded file and test paths, dependency order, one T2 integration check, separate T3 manual closeout and all ten actual efficiency gates. Invalid draft failures are saved with a specific explanation; the previous valid draft remains selectable. | Focused tests reject unread coverage claims, retrieval-tier confusion, missing work, embedded closeout, wrong gate 10, unverified file/test paths and generic acceptance; a coherent ten-step plan passes. Existing source identity verification still runs before saving. |

Before this change, a prompt section error surfaced as `PROMPT_SECTION_STAGE` or the generic stage failure. It now reports, for example, `PROPOSAL_PROMPT_SECTION_STAGE` with `field:text`, the expected bounded section text, and a safe retry of the same target. T2 missing integration checks identify `field:integrationChecks`. Source, work-count, order, T2 and closeout failures keep distinct codes. Error responses contain bounded schema guidance, never source bodies or credentials.

## Safety and limits

The terminal path never seals on behalf of the model or treats final prose as a tool call. `proposal_finish` still runs full domain validation, including requested coverage, source identity, dependencies, prompt grammar and exact candidate construction. An incomplete receipt, changed source, invalid lease, cancellation, unavailable same-session continuation, provider length stop or failed continuation stops without a ready card. Staged bytes remain noncanonical and nonactionable. The continuation attempt and result are in saved Chat activity; protected tool names and outcomes remain in `toolEvents`. No stage operation is accepted during terminal continuation.

The corrected prompt path retains controller replay conflict and idempotency checks. No Docs or prompt publisher is called by staging or finish. The publisher integration test confirms prompt files appear only after explicit Accept; no Work grant, Run, Roadmap award or applied-only History entry is created by these changes.

## Changed files and verification

Source: `packages/contracts/src/model-runtime.ts`, `packages/pi-runtime/worker.mjs`, and the existing Theia extension Pi host/runtime, ChatBackend, prompt authoring, Prompt Stack validation and tool diagnostic modules. Focused tests: `pi-runtime`, `pi-conversation-runtime`, `incremental-proposal-controller`, `incremental-document-review`, `incremental-prompt-stack`, `proposal-model-tools`, `prompt-authoring-stage`, `chat-backend` and `incremental-cross-skill-integration` under `test/unit/`.

On the exact product source HEAD above:

- `@dope/contracts` build: PASS.
- `@dope/theia-extension` build: PASS.
- `npm run check:pi-runtime`: PASS, Pi 1.4.0 and 121 integrity-locked packages.
- Nine focused test files: **81/81 PASS**, zero skipped or failed.
- `git diff --check`: PASS.

No live GPT-OSS inference, connected Chrome, native Electron GUI or model-speed measurement was performed. IG-R4 must verify that the selected model actually uses the new recovery path, produces a trustworthy saved assessment and plan, completes the requested Prompt Stack, and exercises Docs Revise plus the remaining R2 negative, keyboard, touch, theme, hostile-content and Gate no-award cases. Browser/native gaps retain their existing status until observed.
