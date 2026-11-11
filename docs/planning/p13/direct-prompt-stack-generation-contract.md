# Direct Prompt Stack Generation — Forward Contract

**Authority:** [ADR 0057](../../decisions/0057-direct-prompt-stack-generation.md), owner-approved 2026-11-11. **Status:** implementation proposed; no product change or live PASS from documentation. **Version:** 0.13.11 unchanged.

## Outcome and trusted entry

Deliver one complete **runnable Prompt Stack** from saved natural Chat discussion and relevant project source. The new default command is **/gen-stack <slug> <task details>**, explicitly sent by the owner; quoted text, assistant output, code blocks and chip labels are inert. Owner chooses immutable safe lowercase ASCII slug (3–32 chars); Dope derives docs/tasks/<slug>/, rejects collisions/reserved/path-like names and binds opaque draft ID, project/root/worktree, Chat/turn, owner/lease, source/version, optional locked Roadmap IDs/revision and original user request. Completion is a proposal, never publication or Work.

Conversation and optional outline review may precede generation. An outline may be selected as an owner-reviewed constraint, but **no sealed /prompt-ass or /prompt-plan record is required**. Original owner requirements stay authoritative; do not replace them with a generic model summary.

## Single proposal owner; file-oriented model API

Reuse ChatBackend/Pi broker, IncrementalProposalController, saved Chat/proposal storage, existing prompt composer/importer and distinct PlanningStackPublication publisher. Decouple the new direct prompt domain from mandatory selected Assessment/Plan IDs and fictitious supporting files. Docs proposal/writer remains independent.

Conceptual protected model-facing operations (names may be adapted to existing registration):
- **stack_status**: bounded trusted receipt with current sequence, completed file handles/titles, next step, remaining budgets and blockers; not full corpus.
- **stack_stage_file**: stage a work-prompt title and substantive body or bounded chunk; optional assigned handle for an unfinished target. Dope assigns stable ID, contiguous P number, safe filename, order and digest. No model-provided canonical path, count, source hash, owner token or PlanRecord.
- **stack_replace_file**: authorized copy-on-write targeted revision of one unpublished file with checked handle and expected revision/digest; preserve other completed files.
- **stack_finish**: short factual finalMessage; Dope validates complete candidate, generates truthful README/manifest, seals one exact digest and creates existing native Prompt Stack Proposal. Final prose is display only.

Exactly one **terminal manual T3 closeout** is authored as a distinct kind; Dope allocates its last P number. No work prompt follows closeout. The model supplies substantive implementation/acceptance, not an empty outline. Support bounded chunk append, monotonic order, idempotent identical replay; reject conflicting replay, stale stage, unsafe handle, missing/duplicated content and resource overflow with precise recovery. No arbitrary four-work-item cap. Measure and bound per-call/file/stack/stage/time resources.

## Draft lifecycle and context

States: initializing, staging, incomplete, validating, ready-for-review, revising, blocked, stale, cancelled, rejected, accepted. Noncanonical chunks are durable and excluded from canonical tasks, Docs discovery, Git/source dirty fingerprints and Work discovery. Atomic persistence and crash recovery; preserve last complete candidate during failed revision. Resume only with exact project, owner, lease, worktree/source/version and draft revision; otherwise mark blocked/stale. A failed model turn does not erase valid completed files or grant approval. Provisional native tabs are read-only and marked incomplete, Accept disabled.

Use bounded source reads, distinguish list/search from actual read evidence, supply concise prior-file summaries and relevant source to subsequent model calls. Do not resend all completed file bodies. No extra agent, unrestricted write_file, shell grant or automatic inference retry.

## Validation and completion

Stage-time: safe types, bounded bytes, source/project/lease/sequence, UTF-8, nonempty substantive content and safe replay. Do not demand a complete PlanRecord or brokered reads of every proposed future working file.

Finish-time: validate assembled prompt text with existing runner importer/grammar and composer as appropriate; contiguous P1–Pn, MODEL/REASONING/USAGE and Browser required metadata, version, T1/T2 roles, dependencies/order, one final manual T3 closeout, actionable goals, working sets, acceptance and smallest relevant builds/tests, applicable ten Prompt Efficiency Gates, ADR 0016/0037 for UI work, and source/version coherence. Existing-source factual assertions need evidence or clearly marked uncertainty; proposed future files/tests need not exist. No claims of executed tests or implemented code from generation. Return actionable file/section diagnostics and permit targeted revision. Structural validation is not technical correctness; human review remains necessary.

Generate accurate README/manifest from actual files, task order, source basis and closeout. Do not fabricate prompt-assessment.md or implementation-plan.md. Genuine requested supporting docs may be included. If existing importer/publisher mandates those files, adapt the direct-domain path rather than inserting dummy files or a hidden legacy dependency.

## Review, publication and authority

One finalMessage above one Prompt Stack Proposal card. Native Theia read-only file links/Open All show exact staged bytes. File-specific Revise prefills checked Chat composer without auto-send; previous complete candidate remains until replacement seals. Reject discards candidate only. Accept invokes existing publisher with fresh project/root/owner/lease, source/worktree/version, optional locked Roadmap, digest, safe path/symlink, collision and exact-byte checks. Journal partial publication idempotently; never overwrite accepted/executed snapshots. Approval enables Work discovery but never Work Run/grant, Docs applied History, or Roadmap GREEN.

## Qualification and legacy transition

[c13-gen-stack](../../tasks/c13-gen-stack/README.md): P1 trusted entry, P2 file staging, P3 validation/publisher, P4 progressive UI/revision, P5 deterministic real-worker T2, P6 separately manual real-model browser T3. T2 covers small and ten-work-step stacks, cancellation/restart, revision, source drift, foreign project/lease, malicious path, no-write and exact publication in disposable fixtures. T3 must show real GPT-OSS authoring, coherent task-specific files, native preview/revision and explicit owner-approved disposable Accept and Work discovery; scripted model calls cannot establish live reliability.

**Legacy retirement is mandatory once qualified but separately authorized.** After P6 proves complete valid stacks and owner accepts evidence, run a separate bounded cleanup removing active /prompt-ass, /prompt-plan, /prompt-write routing and unused stage controllers/chips/tests, retaining shared services and read-only historical records. No retirement on NOT GREEN or incomplete approval; no automatic cleanup in P6. Historical c13-ass-fix/P5-D3 NOT GREEN and earlier scoped PASS remain dated evidence. No product version advance, Work execution or Roadmap award from docs or stack generation.
