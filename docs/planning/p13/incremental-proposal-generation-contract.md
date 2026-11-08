# Incremental Proposal Generation — Shared Controller Contract

**Decision authority:** [ADR 0055](../../decisions/0055-incremental-proposal-generation.md), proposed on 2026-11-08. **Status:** forward documentation design for a separate post-R3B implementation; not current product behavior or technical qualification. **Applies to:** native protected `/docs-review` and `/prompt-write <folder>`.

## Goal and non-goals

One user-invoked skill may require many bounded Pi model/tool iterations, but must result in **one durable, exact, complete, owner-reviewable proposal**, a natural assistant `finalMessage` displayed above one compact card, and zero canonical file mutations until explicit Accept.

This is the default path for small and large requests alike: no mode switch at an arbitrary prompt count or document size. Tool arguments are deliberately small and typed. Dope, not the model, owns the final proposal packet. Do not add a second agent, file writer, Docs workspace, prompt publisher, or special high-context model requirement. Do not promise fewer total calls or faster wall-clock execution without measurement.

## Trusted session and state

The existing ChatBackend/protected skill dispatcher, project handle, owner lease and Pi selected model remain entry owners. The controller is created only from a **fresh, trusted, explicit** skill invocation; quoted mentions or model text cannot create a proposal. Dope binds:

- `proposalId`, session revision, originating `chatId`/user/assistant turn, skill and owner/lease.
- Project root, worktree identity, source/version and (when linked) accepted locked Roadmap Phase/Gate/Criterion/revision.
- Exact selected assessment and plan IDs for `/prompt-write`; relevant actually-read source hashes and page coverage for Docs.
- Ordered intended targets or explicit bounded discovery scope, stage sequence, content/checksums, resource budgets, lifecycle state and timestamp.
- A distinct **domain authority**: docs application or prompt-stack publication. Session/controller is only a staging authority.

Suggested states: `initializing`, `staging`, `validating`, `ready-for-review`, `revising`, `blocked`, `cancelled`, `stale`, `rejected`, `accepted`, `partial-recovery`. Actual naming may reuse current Chat/proposal types, but transitions must remain explicit and versioned. Serialize durable stage data in the existing project-scoped saved Chat/proposal architecture with bounded manifests and content-addressed chunks, not in a fresh global shadow file store.

## Protected Pi tools and responses

Tools are conceptual API shapes: implement through existing broker capability registrations and stable typed contracts, not through tool-name string parsing in the assistant's freeform answer.

| Tool/operation | Contract |
| --- | --- |
| `proposal_status` | Return bounded source-bound completion checklist, staged file IDs, dependency/order summary, remaining budgets and authoritative errors; never return the entire candidate by default. |
| `proposal_stage_document` | Stage one new-document chunk or one uniquely anchored existing-document excerpt/section replacement, with path, source basis and bounded payload. |
| `proposal_stage_prompt` | Stage one prompt's typed metadata or one bounded prompt section/chunk, stable step ID, dependencies, order and relevant validated plan basis. |
| `proposal_finish({ finalMessage })` | Attempt atomic seal, completeness validation and creation of the one ready proposal; required bounded natural-language message is rendering only. |

The backend initializes the session; a model-generated `begin` or authorization token must not bypass the trusted skill/Chat entry. A controller may internally expose begin/abort/cancel actions. A model tool may **only** stage in the originating authorized session. Read/search stay on the existing Pi broker with the user's Ask/Allow restrictions; no unrestricted `write_file`, command-run, Git, or canonical-editor APIs in authoring mode.

For every stage, the controller supplies or verifies a monotonic `stageSequence`, `expectedRevision` and stable idempotency key, exact target identity and content hash. Identical replay may return the same verified result; conflicting replay, foreign/out-of-order stage, lease/source change or invalid UTF-8 fails closed. Each stage returns a compact accepted/rejected receipt and current progress; failures cannot be papered over by the model's narration. Stage completion is **not** proposal completion.

## Document stage mechanics

For an existing file, require an authorized actual read of the relevant section and its source hash. Prefer `replace` of a short **exact uniquely occurring excerpt** or equivalent verified anchored section edit. Dope tests uniqueness against the correct cumulative candidate plus source basis, applies in deterministic sequence, and preserves all unrelated bytes. Reject missing/ambiguous anchors, stale hashes, overlapped edits, unauthorized paths, or an unseen late section. Keep source line endings and encoding as applicable; do not accept a guessed full rewrite to bypass observed source.

For a new document, permit `create`/chunk append with explicit ordered offsets or chunk indices and per-chunk hashes. The model does not have to return all new text in one final response. Dope assembles full bytes under limits, disallows omitted/reordered/duplicate different chunks, validates Markdown/text eligibility, and retains an absent Original in preview. A large replacement may use multiple verified section edits; no implicit delete/rename or broad project-source edits.

A finish-time target audit must check every requested create/update, required cross-file consistency, source inspection coverage and any declared omissions, safe exact paths, total size and live source/version basis. The session can report an unsupported request as blocked rather than silently omitting required changes. The Docs application owner alone can later apply the exact sealed target set and create applied-only History.

## Prompt-stack stage mechanics

For `/prompt-write`, retain the saved selected `/prompt-ass` and `/prompt-plan` basis, including observed source/test identities. Emit small per-step structures: stable plan-step ID, bounded scope, implementation goal, dependencies, working files/tests, tier/model/browser/manual flags, acceptance, minimal validation and optional specific content sections. The model may construct detailed sections incrementally; Dope can render common boilerplate and required grammar through the **existing deterministic composer/importer** without requiring a single JSON outline for the entire stack.

Support dependency-compatible ordering and bounded **ten-or-more-prompt** stacks, including substantial prompt bodies, without a four-work-item architectural cap. Bound each prompt, total session bytes, stage count, context and call budget explicitly; exceeding a bound produces a recoverable, truthful limitation, not truncation or partial authorization. Keep requirements from `docs/workflow.md`: prompt efficiency audit of the complete stack, small T1 responsibilities, explicit T2/T3, appropriate build/test precision and correct model/manual flags.

On finish, Dope compiles exact contiguous `P1`–`Pn` files, exactly one **final manual closeout**, assessment/plan and manifest/README as applicable. Validate all grammar and dependency edges, T1/T2/T3/evidence allocation, no placeholder acceptance text, required test working sets and source/version basis. Finish must not create canonical `docs/tasks/` files or publish them to Work. The existing distinct publisher, after explicit Accept, publishes exact verified bytes and enables Work discovery without grant/Run.

## Incremental context and progress

Pi receives at each step only relevant inspected source, current requested action, verified short plan/dependency pointers, and bounded `proposal_status` summaries. The growing file bytes and long previous model outputs stay in the durable proposal store rather than being copied back into every model call. Use actual broker range reads for large source files and record read coverage separately from search/list discovery.

After each successful stage, stream or emit a truthful stage event to the same originating Chat and proposal view. Native Theia proposal tabs may show provisional current bytes as clearly **incomplete, read-only, nonactionable**. Open All is navigation only; the card's Accept is disabled until a successfully sealed `ready-for-review` candidate. Do not add a second central Documents panel or new file explorer. Stage events preserve tool provenance, order and failures in saved Chat; no reasoning text is presented as a tool execution receipt.

Cancellation, interruption, model failure, stalled budget and restart retain only safe noncanonical state. Resume only from a verified matching project/root/owner/source/lease and persisted stage position; otherwise mark stale/blocked, make prior coherent candidate available if any, and offer a clean revision. No half-finished staged files can be promoted by restarting or reissuing finish without passing all checks.

## Finish, finalMessage and Chat rendering

The `proposal_finish` tool requires a `finalMessage` string (bounded, nonempty, natural language; recommended max 2,000 characters) and derives all other final fields from authoritative stored stage data. It does **not** consume the model's invented file list, claimed validation results, approve flag, hashes or full JSON document. Dope checks current source, staged completeness and grammar, content digests, owner/lease and configured resource limits before sealing.

On success, render **exactly once** in the originating final Chat message:

1. Escaped/sanitized `finalMessage` as plain conversational prose, immediately **above** the proposal card.
2. One compact, actionable existing native Docs or Prompt Stack proposal card with real paths, ordered file links, Open All, source/basis, pending status and Accept / Reject / Revise Proposal.

The final message may describe intent and what was staged but may not be authoritative proof of implementation, tests, qualification or publication. A model cannot add approval instructions through `finalMessage`; Dope does not display it as a success sentence if the seal fails. Use backend-generated accurate diagnostics on error and keep incomplete proposals nonactionable. The absence of a successful `proposal_finish` means there is **no** ready proposal, even if streaming prose says otherwise.

## Review, revision and publish boundary

- Docs: `Accept` invokes existing source-bound docs create/update application; `Reject` has zero canonical effects; `Revise` stages copy-on-write edits against the selected saved candidate, retaining the last valid one until the new complete digest seals. Preserve applied-only History and no user-facing `/docs-apply`.
- Prompt stacks: `Accept` invokes the distinct guarded native prompt-stack publisher and verifies Work discovery, not Work execution; `Reject` discards only the pending candidate; `Revise` returns to `/prompt-write` with selected candidate, earlier assessment/plan and owner instructions, then stages changed content without copying all unchanged text through the model.
- Both: recheck project, owner, worktree, Chat, lease/digest, paths/symlinks/traversal, source hashes, locked Roadmap revision where applicable, target collisions and exact bytes at approval. Never overwrite dirty owner source or accepted/executed prompt snapshots. Journal actual effects/recovery idempotently. Never convert proposal tabs to normal editable real-file tabs.

## Resource and acceptance requirements

Dope must enforce explicit configurable ceilings for **per-tool payload, staged chunks, file count, individual file bytes, total candidate bytes, stage count, model call count and elapsed session duration**. Select documented measured values during implementation; the old four-file Docs change ceiling and four-work-item Prompt Stack ceiling are not permanent architectural defaults. Fail with a scoped explanation when genuinely unsafe or excessive. No unlimited loop, hidden bulk fallback or automatic extra model invocation outside the selected Pi run.

Qualify with a source-bound deterministic unit/integration matrix plus selected local-model live replay: one small Docs edit, a late-section multi-file update, a multi-chunk long new file, at least ten ordered prompts with substantial detailed content (including final manual closeout), successful revision, failed revision retaining prior candidate, cancel/resume, stale-source and wrong-project denial, duplicate stage/restart, untrusted message, many native tabs, genuine Accept/Reject without premature writes, and no Work/History/Gate side effects. Measure model calls, context and wall time rather than assuming speed.

## Follow-on-only routing

**The active R3B is out of scope.** Do not edit, rerun, block, silently retrofit, or expand `docs/tasks/p13/recovery/R3B-prompt-proposal-publication.txt`, its actual execution or its qualification. Implement this architecture only in a separately authorized **post-R3B** correction, after inspecting R3B's real delivered source and its qualification. Existing R3A, R1, P9/P12 history, current version and owner-controlled R3/R2/R4 routing remain intact until a future explicit approval.
