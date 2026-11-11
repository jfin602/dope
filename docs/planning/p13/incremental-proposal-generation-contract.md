> **2026-11-11 DIRECT PROMPT STACK DOMAIN / DOCS ONLY:** [ADR 0057](../../decisions/0057-direct-prompt-stack-generation.md) and [direct generation contract](direct-prompt-stack-generation-contract.md) supersede mandatory Assessment/Plan predecessors for new prompt stacks. Keep the shared controller and independent Docs /docs-review protocol. Legacy active prompt routes remain until independent real GPT-OSS stack and guarded publication qualification plus separate owner-approved cleanup. Historical R3B remains untouched; no implementation or version change by docs.

# Incremental Proposal Generation — Shared Controller Contract

**Decision authority:** [ADR 0055](../../decisions/0055-incremental-proposal-generation.md), approved and documented on `main` on 2026-11-08. **Status:** forward documentation design for a separate post-R3B implementation; not current product behavior or technical qualification. **Applies to:** native protected /docs-review and future direct /gen-stack; historical /prompt-write remains documented below as a dated predecessor.

## Goal and non-goals

One user-invoked skill may require many bounded Pi model/tool iterations, but must result in **one durable, exact, complete, owner-reviewable proposal**, a natural assistant `finalMessage` displayed above one compact card, and zero canonical file mutations until explicit Accept.

This is the default path for small and large requests alike: no mode switch at an arbitrary prompt count or document size. Tool arguments are deliberately small and typed. Dope, not the model, owns the final proposal packet. Do not add a second agent, file writer, Docs workspace, prompt publisher, or special high-context model requirement. Do not promise fewer total calls or faster wall-clock execution without measurement.

## Trusted session and state

The existing ChatBackend/protected skill dispatcher, project handle, owner lease and Pi selected model remain entry owners. The controller is created only from a **fresh, trusted, explicit** skill invocation; quoted mentions or model text cannot create a proposal. Dope binds:

- `proposalId`, session revision, originating `chatId`/user/assistant turn, skill and owner/lease.
- Project root, worktree identity, source/version and (when linked) accepted locked Roadmap Phase/Gate/Criterion/revision.
- For direct /gen-stack: original trusted owner request and optional reviewed outline, not mandatory Assessment/Plan IDs; relevant actually-read source hashes and page coverage for Docs.
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

## Direct prompt-stack stage mechanics (ADR 0057 forward amendment)

For new /gen-stack, the owner selects a safe immutable slug and starts one protected draft directly from saved Chat and relevant source; no mandatory sealed /prompt-ass or /prompt-plan. The model stages substantive file text or bounded chunks, not PlanRecord replicas, hashes, internal IDs or a giant final JSON. Dope owns stable file handles, contiguous P1–Pn filenames, safe target paths, stage sequence, source/version basis, exact bytes and digest. The shared proposal controller remains the only staging lifecycle owner.

Provide a compact status tool, a file/chunk staging tool, checked file-specific copy-on-write revision and a finish operation with short untrusted finalMessage. Each stage returns a bounded authoritative receipt and persists noncanonical bytes outside growing model context. No arbitrary four-work-item cap; qualify ten-plus work prompts with one terminal manual T3 closeout. Reject unsafe, stale, duplicate/conflicting, out-of-order or oversized stages with actionable errors.

At finish, assemble exact runnable files with the existing importer/composer, validating runner grammar, correct metadata, dependencies, meaningful acceptance, T1/T2/T3, applicable Prompt Efficiency Gate, source/version and one final manual closeout. Do not fabricate prompt-assessment.md or implementation-plan.md; generate truthful README/manifest and genuine owner-requested supporting documents only. Existing-source claims require grounded evidence, while future files/tests proposed by the prompt need not exist or have been read in that turn. A complete model final message alone cannot seal or approve.

Only the distinct existing guarded prompt publisher may write exact reviewed files after explicit owner Accept. Preserve native Theia tabs/Open All, copy-on-write revision, source/owner/lease/collision/symlink protections, no automatic Work Run/grant and no Roadmap award. The older Plan-linked /prompt-write behavior is historical/transitional and must be retired only after successful independent real-model qualification and separately authorized cleanup.

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
- Prompt stacks: Accept invokes the distinct guarded native prompt-stack publisher and verifies Work discovery, not Work execution; Reject discards only the pending candidate; Revise returns to /gen-stack with checked selected proposal/file handle and owner instructions, then stages changed content without re-sending unchanged files. The earlier /prompt-write revision route remains historical during transition.
- Both: recheck project, owner, worktree, Chat, lease/digest, paths/symlinks/traversal, source hashes, locked Roadmap revision where applicable, target collisions and exact bytes at approval. Never overwrite dirty owner source or accepted/executed prompt snapshots. Journal actual effects/recovery idempotently. Never convert proposal tabs to normal editable real-file tabs.

## Resource and acceptance requirements

Dope must enforce explicit configurable ceilings for **per-tool payload, staged chunks, file count, individual file bytes, total candidate bytes, stage count, model call count and elapsed session duration**. Select documented measured values during implementation; the old four-file Docs change ceiling and four-work-item Prompt Stack ceiling are not permanent architectural defaults. Fail with a scoped explanation when genuinely unsafe or excessive. No unlimited loop, hidden bulk fallback or automatic extra model invocation outside the selected Pi run.

Qualify with a source-bound deterministic unit/integration matrix plus selected local-model live replay: one small Docs edit, a late-section multi-file update, a multi-chunk long new file, at least ten ordered prompts with substantial detailed content (including final manual closeout), successful revision, failed revision retaining prior candidate, cancel/resume, stale-source and wrong-project denial, duplicate stage/restart, untrusted message, many native tabs, genuine Accept/Reject without premature writes, and no Work/History/Gate side effects. Measure model calls, context and wall time rather than assuming speed.

## Follow-on-only routing

**The active R3B is out of scope.** Do not edit, rerun, block, silently retrofit, or expand `docs/tasks/p13/recovery/R3B-prompt-proposal-publication.txt`, its actual execution or its qualification. Implement this architecture only in a separately authorized **post-R3B** correction, after inspecting R3B's real delivered source and its qualification. Existing R3A, R1, P9/P12 history, current version and owner-controlled R3/R2/R4 routing remain intact until a future explicit approval.
