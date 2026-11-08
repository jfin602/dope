> **2026-11-08 FORWARD INCREMENTAL /prompt-write DECISION (POST-R3B ONLY):** [ADR 0055](../../decisions/0055-incremental-proposal-generation.md) and [detailed contract](incremental-proposal-generation-contract.md) designate Pi-brokered **incremental per-prompt/per-section staging** as the later default, with Dope assembling validated ordered files and `proposal_finish({ finalMessage })` rendering natural text immediately above one review card. Substantial ten-or-more-prompt stacks must not require a single massive model JSON packet. This is a **separately authorized follow-on**, not part of the already running R3B. Do not modify, invalidate, extend, rerun, or block `docs/tasks/p13/recovery/R3B-prompt-proposal-publication.txt` or its qualification. Current R3A behavior and R3B scope remain unchanged until later implementation.

> **2026-11-07 NATIVE PROMPT FILE TABS / OWNER-APPROVED FORWARD DESIGN:** [ADR 0054](../../decisions/0054-native-document-editor.md) / [UI contract](../../ui/native-document-editor-contract.md) replace the special Documents viewer with **read-only existing Theia editor tabs** for generated prompt-stack `.txt`/`.md` files. Individual filename hotlinks and compact **Open All Files** on the native Prompt Stack Proposal card open the exact uncommitted files in P1–Pn order without extra project file explorer, publish, Work grant or Run. Tabs show Source/Diff for `.txt` and Source/Diff/Formatted for `.md`, plus Original/Proposed only if proposal versions are actually available. Existing distinct guarded prompt-stack proposal/publisher owns Accept/Reject/Revise; missing local R3B remains BLOCKED, not a reason to create another publisher. Historical executed c13-docs-view prompts and unqualified P13 gates remain unchanged.

> **2026-11-07 DOCUMENTS WORKSPACE REVIEW AMENDMENT / DESIGN ONLY:** [ADR 0053](../../decisions/0053-documents-workspace-and-proposal-review.md) / [UI contract](../../ui/documents-workspace-contract.md) let a pending `/prompt-write` proposal open in the same optional central Documents viewer used by Docs Explorer and Docs proposal review. Its tree displays generated P*.txt files in correct relative structure/order; rendered/source previews and copying are read-only with respect to publication. Card and viewport Accept / Reject / Revise Proposal call the **existing prompt-stack proposal owner and guarded publisher**, never the Docs application writer. Do not publish by preview or start Work, issue grants, promote candidates or qualify Gates on approval. Existing R3A/R3B/R3/R2/R4 routing, owner approval, stale-basis defenses and `0.13.11` recorded status are unchanged. No source implementation or qualification is asserted.

# Phase 13 — Native Prompt Stack Authoring

**Owner decision:** 2026-11-07. **State:** documentation and recovery prompt authoring only; not product implementation or qualification. **Current product version:** 0.13.11. Applies to the unrun Phase 13 recovery after committed R1.

## Intended developer workflow

Accepted Roadmap Planning → native Chat `/prompt-ass` → `/prompt-plan` → `/prompt-write <folder>` → reviewed Prompt Stack proposal → deliberate Work grant/Run → tested accepted-source evidence → Roadmap Criterion/Gate qualification → separate owner Phase closeout.

Software Map, legacy Planning Map, System/Subsystem synthesis and physical transformations are not prerequisites for this route. They remain independent/optional and can be revisited in Phase 14. Standalone correction stacks may start directly from saved Chat without fabricated Roadmap or WorkItem IDs.

## Native commands

Reuse Dope's existing protected built-in Skills registry, saved Chat, selected local model, brokered reads and prompt-stack grammar/composer. Do not create another agent, runner, Chat window or filesystem authority.

- `/prompt-ass` assesses the saved conversation, applicable current project documents/source, requirements, dependencies, risks, authorization and T1/T2/T3 evidence. Creates a durable inspectable assessment draft; writes no canonical project files.
- `/prompt-plan` consumes the selected assessment and bounded source inspections; creates a dependency-ordered plan identifying actual affected code/test boundaries, smallest necessary build/test commands, manual checkpoints and deferrals.
- `/prompt-write <folder>` consumes the reviewed plan and produces a *draft* validated executable stack: assessment/plan, contiguous P1–Pn prompts, exactly one final closeout, correct source/authority assumptions and model/manual flags. Apply `docs/workflow.md` Prompt Efficiency, UI Design Compliance and Human Usability gates. Drafting does not publish or execute.

Commands must resolve only on explicit, trusted, send-time slash invocation. Quoted text, code blocks, paths and model prose must not trigger commands. Slash selection inserts editable text and never auto-submits. Preserve prior Chat context, retry/cancel, project switching, Ask/Allow and 16k-context bounded reads. Distinguish files listed/searched from files actually inspected.

## Prompt Stack Proposal card

After `/prompt-write`, present exact reviewed target folder, prompt list, affected files, dependencies, validation/manual gates, source/version basis, and stable project/root/owner/proposal digest. Actions:

- **Accept:** a Dope-owned guarded prompt-stack publisher checks current project/owner/worktree/locked Roadmap revision (when linked), source hashes, exact proposal digest, safe path, symlink/traversal, target collision and file validity. Publishes exactly the reviewed files under the configured tasks folder (usually `docs/tasks/<stack-id>/`), verifies bytes, and makes the stack discoverable in existing Work. No automatic Run, grant, candidate promotion or GREEN.
- **Reject:** discards only pending proposal state, with no canonical files, Work or applied History.
- **Revise proposal:** preselects the same pending candidate and returns to `/prompt-write` in Chat with owner change instructions; preserves prior candidate until a checked replacement is ready. Never rewrites an accepted/executed prompt snapshot in place.

Use the Docs proposal *visual pattern* but not its Docs file writer. Do not introduce a user-facing `/prompt-apply` or revive `/docs-apply`. Keep publication retry/restart idempotent, safely report partial effects, and reject stale/foreign/replayed/oversized candidates.

## Future incremental generation (ADR 0055; not current R3B scope)

Once independently authorized after R3B, `/prompt-write <folder>` defaults to one Dope-owned staging session with **multiple bounded Pi tool iterations**, not one model-authored JSON document describing the entire stack. The model stages stable plan-linked prompt metadata and, where needed, bounded detailed prompt sections; Dope maintains ordered validated candidate bytes outside the growing model context, reuses its deterministic composer/importer for required grammar, and validates dependencies, target paths, source/version, efficiency audit, contiguous P1–Pn and exactly one final manual closeout before sealing. The future design must handle ten or more substantial prompts within finite resource budgets; neither four work items nor 200 lines per file are mandatory design targets.

A required terminal `proposal_finish({ finalMessage: string })` supplies brief, untrusted human-facing prose that Dope shows **above** the existing Prompt Stack Proposal card when and only when the full candidate seals successfully. The model does not generate the final proposal packet, approve files, publish or start Work. Staged previews remain noncanonical/read-only, with Accept disabled until complete; final exact file bytes and digest remain Dope-owned. Keep the current distinct guarded prompt publisher, Revise copy-on-write protection, selected saved assessment/plan, source/owner checks, native Theia proposal tabs, explicit Work grant/Run and Roadmap evidence boundary.

**Execution boundary:** R3B is in progress and shall be finished/qualified unchanged. This subsection is forward documentation for a separate post-R3B implementation; it adds no new R3B requirement or retroactive qualification.

## Roadmap and Work linkage

A Roadmap-originating stack binds to a locked accepted Phase revision and exact Gate/Criterion IDs; uncovered coverage is explicit. Preserve those IDs through proposal, publication, immutable Work prompt snapshot, AgentRun, candidate review and verified evidence. Do not match by generated title/text. Work requires separate explicit Run/grant. A prompt's completion or exit zero does not qualify a Gate; only applicable current source-bound receipts can, and Phase Complete needs owner closeout.

## Recovery sequencing and qualification

Committed **R1 remains untouched**. Run manually in order: **R3A** native command drafts → **R3B** proposal and publication → **R3** Roadmap handoff without legacy map dependencies → **R2** Work-to-Criterion evidence/owner closeout → **R4** real P9/P12 replay. Keep targeted T1 checks in R3A/R3B, boundary/integration checks in R3/R2 and owner-observed browser T3 plus negatives in R4. Preserve historical P9/P12 NOT GREEN, original prompts and R1 qualification evidence. No 0.13.12 marker or native Phase 13 GREEN from these documents.

**References:** ADR 0040/0041/0048/0051, `docs/workflow.md`, `docs/planning/p12/skills-framework-contract.md`, `docs/planning/p13/roadmap-work-lifecycle-contract.md`, `docs/PRODUCT-MODEL.md`, `docs/tasks/p13/recovery/README.md`.
