# ADR 0055 — Incremental Pi Proposal Generation for Docs and Prompt Stacks

**Owner decision:** 2026-11-08 (America/Chicago). **Status:** OWNER-APPROVED FORWARD DOCUMENTATION, applied to `main` via PR #13 on 2026-11-08; product implementation and qualification not asserted. **Scope:** forward generation architecture for `/docs-review` and `/prompt-write`. **Detailed contract:** [Incremental Proposal Generation](../planning/p13/incremental-proposal-generation-contract.md).

## Context and problem

The current `/docs-review` path uses Pi's brokered read/search loop but expects a final model-generated JSON object containing every proposed document change. Bounded exact excerpt replacements avoid unnecessary full-file output, yet a large multi-file change can still exhaust response limits or lose a valid proposal to a malformed/truncated final packet. The currently qualified R3A `/prompt-write` path asks the local model for one compact JSON outline and lets Dope's deterministic phase-stack composer render the files; this avoids enormous model-authored prompt bodies but caps the present stage at four work prompts plus closeout. These are descriptions of the inspected 2026-11-08 source, not blanket claims about live execution speed.

The owner wants substantial documentation revisions and ten-or-more-prompt stacks (potentially 200+ lines per prompt) without requiring the local model to return one massive response. Local models should work on bounded relevant context; output size, prompt count, and proposal durability should be the application's responsibility.

## Decision

**Incremental proposal generation is the default for both protected skills, not an oversized-output fallback.** One explicit Chat skill invocation starts one Dope-owned proposal session. Within that session, the existing selected Pi/local-model agent may perform multiple bounded model/tool iterations: read relevant sources, stage an independently validated document or prompt change, inspect progress, and continue until the intended set is complete. The model does **not** construct a final monolithic JSON file-change packet.

Dope owns project/Chat identity, source/version basis, proposal lifecycle, ordered staged content, validated target bytes, hashes/digest, completion and approval. Pi supplies only typed, bounded tool arguments and a natural-language terminal message. Structured tool arguments still require validation; this decision removes dependence on a **giant model-authored JSON response**, not all structured data.

Use one shared **incremental proposal session/controller** for lifecycle, progress, persistence, concurrency, budget accounting, cancellation, resume and final sealing. Keep specialized validators and distinct publication authorities for documentation versus prompt stacks. This is not a new Chat, model runtime, filesystem writer, work runner or generic unrestricted write capability.

### Lifecycle

1. **Begin:** Dope derives and binds the skill, root/worktree, owner, Chat/turn, requested scope and available source/plan/Roadmap basis from trusted inputs. The model cannot mint its own publication authorization.
2. **Inspect:** Pi uses only existing bounded and authorized read/search tools. Reads are recorded as reads; searches and listed paths are not treated as inspected content. A file update must be grounded in actual current source.
3. **Stage:** Pi calls protected domain-specific proposal tools for one file, prompt, or bounded section/patch at a time. Dope atomically validates and persists each stage under an ordered sequence/revision and source basis. Staging creates **noncanonical, unreadable-for-Work** candidate bytes only, never real project file writes.
4. **Preview:** Dope can progressively show staging status and read-only provisional file content in the existing native Theia proposal tabs; distinguish incomplete staging from a complete actionable proposal. Viewing or opening files never approves.
5. **Finish:** Pi calls a protected terminal `proposal_finish` operation carrying a required `finalMessage`. Dope verifies completeness, source freshness, paths, grammar/dependencies, budgets and digest, then seals **one** coherent reviewable proposal. If validation fails, it remains nonactionable and the fault is visible; a terminal message alone is never proof of success.
6. **Review and decide:** The originating Chat renders the bounded `finalMessage` **above** the existing compact proposal card. Accept / Reject / Revise Proposal remain owned by their current distinct domain services. An explicit owner Accept is required for any canonical write.

### Terminal message contract

The model must provide `finalMessage: string` as an argument to `proposal_finish`, for example:

```ts
proposal_finish({
  finalMessage: "I've prepared the documentation changes and ordered prompt files for your review. The proposed files are ready to inspect before approval."
});
```

Dope renders this as ordinary assistant prose immediately preceding the proposal card (not inside it), after successfully sealing the proposal. Bound its size, escape/sanitize untrusted content, persist it with the sealed candidate and restore it once on reload. Do not confuse this narration with authoritative status, validation, file list, acceptance, History or Work evidence. When the candidate cannot be sealed, Dope reports the actual failure instead of displaying a fabricated success message. Avoid duplicate cards, generic machine JSON in the transcript or an arbitrary second freeform final packet.

### Domain-specific behavior

**Documentation:** Retain source-bound exact unique excerpt/section replacement for existing files, and support bounded incremental creation of large new documents. Dope materializes and verifies the full final after-bytes while preserving unrelated source content, line endings and other requested targets. Cross-document consistency is checked on finish. The current guarded Docs writer remains the **only** owner of approved create/update application and applied-only History; this ADR grants no delete/rename authority.

**Prompt stacks:** Pi stages dependent work items and any necessary detailed prompt sections in execution order. Reuse deterministic composer/importer/grammar where suitable rather than asking the model to repeat boilerplate. The final sealed candidate includes supporting assessment/plan/manifest, contiguous P1–Pn, correct versions, dependencies, exact target bytes, and **exactly one terminal manual closeout**. Do not retain the R3A four-work-item cap as the new architectural maximum; use explicit resource/safety budgets instead. Ten-plus prompt files must be supported as a qualification case, not a mandatory fixed count or target line length. The distinct guarded prompt publisher alone makes approved stacks discoverable in Work; approval never Runs Work.

### Performance and reliability

Keep tool/model responses bounded per stage; persist previous stage bytes outside the model's growing conversation context. Supply each iteration only relevant source and compact verified progress/dependency summaries. Reuse bounded Pi reads, context compaction, selected model and cancellation. Do not resend the whole proposed corpus on each iteration. Multiple model/tool steps can take longer in aggregate; the design is for scalability, inspectability, completion reliability and bounded context, **not a claimed measured speedup**. Require visible progress, finite per-call/session budgets, clean failure/cancel recovery, idempotent retries and no partial acceptance.

### Review, authority and compatibility

Staging does not create project files, grant command access, publish a prompt, create a Work task, modify an accepted Roadmap, award a Criterion/Gate GREEN, start Work, or record applied-only History. On Accept, revalidate root/worktree/owner, locked Roadmap revision when applicable, source hashes, path safety, symlink/traversal/collision/foreign state, file bytes and proposal digest. Preserve no-overwrite for owner-dirty, accepted or executed prompt snapshots. Reject discards only the candidate. Revise creates a new copy-on-write staged revision while the previous checked candidate remains intact until replacement passes; cancel/failure leaves the previous candidate available. Never reinterpret provisional stage text as accepted source.

Do not create another Docs editor, duplicate project explorer, publisher, filesystem grant, model runtime or History authority. Preserve the native Theia `.md`/`.txt` review tab pattern and its actual Original/Proposed basis per ADR 0054.

## Execution routing — R3B explicitly protected

**R3B is already running as of this decision. Do not change, interrupt, invalidate, expand, rerun, or retarget `docs/tasks/p13/recovery/R3B-prompt-proposal-publication.txt` or its active tests/qualification.** Finish and assess R3B against its original source and prompt. This ADR defines a **separate follow-on implementation** after R3B, subject to its own owner-approved assessment, bounded prompt stack, run and qualification. No automatic dependency or new entry gate is imposed on active R3B or historical R3A/R1/P9/P12 results. Later Phase 13 R3/R2/R4 scheduling remains explicitly owner-controlled.

This applied documentation decision does not authorize product source code changes, R3B task changes, Work grants/Runs, product acceptance, version bumps or Roadmap qualification.

## Qualification required before calling the design implemented

- T1: ordered atomic stages, chunked document creation and unique replacements, per-prompt composer/importer grammar, exactly one final closeout, budget limits, finite context summaries and required `finalMessage`.
- T2: ten or more substantial prompt files; multi-file and long-section Docs edits; restart, retry, cancellation, revision, duplicate/out-of-order calls, malformed tool data, source drift, project/owner switch, failure at finish; prior candidate retention and no partial writes.
- T3: real selected local model in connected browser, progressive read-only proposal tabs, one natural message above one card, keyboard/touch/narrow review, Open All, Reject/Revise/Accept, restart and truthful status. Observe model time/usage rather than asserting performance.
- Negative authority tests: no canonical writes before Accept; stale, malicious paths/symlinks, existing owner edits, partial publication and untrusted `finalMessage` cannot authorize Work, History or Roadmap GREEN.

**Related contracts:** [Documentation workflow](../planning/p12/documentation-workflow-contract.md), [Native Prompt Stack Authoring](../planning/p13/native-prompt-stack-authoring-contract.md), [Native Editor UI](../ui/native-document-editor-contract.md), [ADR 0054](0054-native-document-editor.md), [Repository workflow](../workflow.md).
