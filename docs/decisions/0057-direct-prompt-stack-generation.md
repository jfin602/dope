# ADR 0057 — Direct, File-Oriented Prompt Stack Generation

**Date:** 2026-11-11. **Status:** OWNER-APPROVED DESIGN / DOCUMENTATION ONLY. **Product version:** 0.13.11 unchanged. **Implementation stack:** [c13-gen-stack](../tasks/c13-gen-stack/README.md).

## Context and decision

The mandatory native /prompt-ass → /prompt-plan → /prompt-write chain was implemented and repeatedly headless-qualified, but actual GPT-OSS 20B browser runs failed in intermediate tool contracts. P5-D3 sealed a generic Assessment, then Planning rejected three source submissions with PLAN_UNSUPPORTED_SOURCE; no Prompt Write proposal was reached. Preserve all dated reports and original verdicts.

The owner wants a **complete, executable, reviewable task stack**, not a succession of model-authored intermediate records. Replace mandatory three-command authoring with one trusted explicit **/gen-stack <owner-slug> <instructions>** workflow. Conversation and optional outline remain useful for reasoning, but Assessment and Planning records are **not prerequisites** to writing prompt files. This is a replacement architecture, not a parallel long-term fallback.

## New developer journey

1. Discuss requirements in saved Chat; optionally review and revise an outline conversationally.
2. Invoke /gen-stack with an immutable safe owner-chosen slug. Dope binds the original request, relevant conversation, project/worktree/source/version and any locked Roadmap revision to one durable noncanonical draft.
3. Pi reads relevant files through existing brokered read/search tools and stages substantive prompt-file text in bounded file/chunk submissions. Dope owns ordering, P numbers, filenames, hashes, revisions, limits and source/lease checks. Draft files appear progressively as clearly incomplete read-only previews.
4. Dope validates the **complete stack** against existing runner grammar, dependency/acceptance/test/build/efficiency requirements, exact source basis and exactly one terminal manual closeout. Return actionable file-specific findings; revise the affected draft file instead of restarting Assessment/Plan.
5. A sealed Prompt Stack Proposal uses existing native Theia tabs, Open All and Accept/Reject/Revise. Only explicit owner Accept invokes the distinct guarded prompt publisher, writes exact reviewed bytes to docs/tasks/<slug>/ and enables Work discovery. Approval does not grant/Run Work or award Roadmap evidence.

The model authors content; Dope enforces mechanical structure, source authenticity and publication authority. An optional reviewed outline can constrain generation when the owner chooses it; never invent a sealed Assessment/Plan just to satisfy a legacy schema.

## Engineering constraints

- Reuse protected Chat/Pi dispatch, brokered reads, saved Chat/proposal controller, native editor, composer/importer and guarded publisher. Adapt prompt-specific contracts currently coupled to selected Assessment/Plan; do not add a second model runtime, writer, database or approval authority.
- Model-facing file staging is small: substantive title/body or bounded chunk, optional assigned draft-file handle for targeted revision. Dope assigns path, sequence and digest; no giant final JSON or repeated manual hashes/IDs.
- Persist completed file bytes outside growing model context; provide concise source-grounded progress and resumption only with matching owner/project/lease/source/revision.
- Distinguish existing-source factual claims (brokered evidence) from future files/tests a prompt proposes creating. Do not demand a read of every proposed working file/test during each model turn. Reject fabricated evidence, unsafe paths and false claims of completed execution.
- Preserve Prompt Efficiency Gate, T1/T2/T3, scoped builds/tests, exact runner metadata, one terminal independent manual closeout, ADR 0016/0037 for UI work and truthful status.
- No canonical write until approved; reject symlink/traversal/collision, source drift, foreign state, incomplete proposal and stale digest. Never overwrite accepted/executed snapshots.
- Do not generate fictitious prompt-assessment.md or implementation-plan.md when not actually authored. A truthful README/manifest suffices unless the owner requested genuine supporting documents.

## Conditional legacy retirement

P1–P5 implement and deterministically test the direct path. P6 is independently initiated real GPT-OSS 20B connected-browser qualification. **Legacy removal is a separate, bounded, owner-approved cleanup after P6; it is not part of P1–P6 and is not triggered by this documentation decision.**

Retirement requires complete coherent runnable stacks from the selected real local model, source-relevant content and dependencies, targeted revision and restart, native review, guarded Accept of a disposable candidate with exact bytes and Work discovery, deterministic source/owner/lease/stale/unsafe-path checks, and explicit owner acceptance of evidence. An incomplete approval subgate is an evidence gap, not permission to retire.

After owner approval, remove old active command routes, intermediate Assessment/Plan-only controllers and obsolete chips/tests only where no surviving consumer needs them. Retain shared broker, draft/proposal, source guards, composer/importer, editor and publisher. No hidden fallback or competing authoring owner. Preserve historical Chats, accepted/executed snapshots, prior NOT GREEN/PASS evidence and read-only old drafts. Requalify the cleaned final source.

If P6 is NOT GREEN, do not remove legacy code; report the exact blocker and await owner direction. Do not start an automatic repair campaign.

## Scope

ADR 0057 supersedes ADR 0056's **mandatory authoring chain for future new stacks** and amends the prompt-stack domain of ADR 0055. It does not change Docs /docs-review, Work grants/Runs, Roadmap evidence, or historical R3B. See [direct generation contract](../planning/p13/direct-prompt-stack-generation-contract.md). No product source, tests, model settings or version change is authorized by documentation.
