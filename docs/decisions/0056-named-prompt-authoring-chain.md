> **2026-11-11 FORWARD SUPERSESSION / HISTORICAL ADR:** [ADR 0057](0057-direct-prompt-stack-generation.md) replaces this ADR's **mandatory three-stage authoring requirement** for new prompt stacks with direct /gen-stack file authoring. This document remains the dated historical decision and description of existing legacy drafts; it is NOT a future entry requirement. Retain active old routes until the new path passes independent real GPT-OSS and guarded publication qualification, then remove them through a separate owner-approved cleanup. See [c13-gen-stack](../tasks/c13-gen-stack/README.md). No product implementation or retroactive qualification by this amendment.

# ADR 0056 — Named, Persistent Prompt Authoring Chain

**Status: OWNER-APPROVED DOCUMENTATION, NOT IMPLEMENTED.** Date: 2026-11-08. **Product version:** unchanged `0.13.11`. This ADR does not authorize source implementation, runner execution, publication, Work, or Roadmap qualification.

## Context
The existing native `/prompt-ass → /prompt-plan → /prompt-write <folder>` workflow saves verbose, separate assessment and plan Chat responses, then reinjects up to 12,000 characters of each into downstream model context. The incremental `/prompt-write` controller solves bounded prompt staging but does not itself supply a unified named authoring lifecycle. Real GPT-OSS 20B P6/R2 attempts exposed costly repetitive context, invalid plan content, missing finish, and incomplete prompt staging. Previous R1 and IG-R3 scoped claims remain separate from live qualification; P6 and R2 remain NOT GREEN, R3B remains PARTIAL historically.

## Decision proposed
Replace the three unrelated saved drafts with **one owner-named, source-bound Prompt Stack Draft**, advanced in stages by the existing protected Chat/Pi path:
1. `/prompt-ass <name> <task details>` creates a draft; the mandatory `name` is a short safe task-folder slug chosen by the owner.
2. A completed Assessment card offers `/prompt-plan`, inserting the command and an authoritative bound Assessment chip into the composer. The owner may submit immediately or add instructions. Clicking is never execution.
3. A completed Plan card offers `/prompt-write` with a bound Plan chip. The final directory is derived from the original slug; the owner need not retype it.
4. One evolving card uses the same name, identity, current stage, and native read-only review links; final Prompt Stack Accept still publishes reviewed exact bytes only through the **existing R3B publisher**.

Use versioned, Dope-owned *noncanonical* intermediate records under a project-scoped protected draft namespace, preferably `docs/tasks/.drafts/<slug>/` if safe exclusion from Git, Docs, Work discovery, and source-change fingerprints is proven. Reuse the existing ChatRepository/proposal controller ownership, leases, and durable stage transactions; no second store of truth. Render assessment/plan Markdown from validated structured records when viewing/exporting, not from full model-produced Chat answers. Pass only task-relevant bounded records and source refs to subsequent stages.

A subsequent edit to Assessment invalidates dependent Plan and Prompts; a Plan edit invalidates Prompts. Preserve last valid candidates until a replacement seals. The original source/version/lease and explicit approval checks still apply. No draft is itself canonical publication or Work authority.

## Forward responsibility clarification (2026-11-09/10)

The owner reaffirmed the distinct functions: **Assessment** decides prompt count and logical task division in a small reviewed wireframe; **Planning** performs detailed source-grounded implementation design, dependencies, acceptance, T1/T2/T3 and ten applicable Prompt Efficiency Gates; **Prompt Write** formats and validates final runnable prompt files through the existing guarded proposal/publisher. Do not require exhaustive source-citation/technical-implementation staging just to complete Assessment. Factual source claims remain verified, and material count/task changes require explicit reviewed revision. The named draft/chip, owner/lease/source, no-Run/Green and publication boundaries are unchanged. Historical evidence remains intact; no product/version change.

## Non-goals and guarantees
No automatic model-selected task name, duplicate Docs workspace, new publisher, shadow Work stack discovery, mutable accepted Work prompt snapshots, implicit Run/grant, Gate GREEN, unbounded inference, or replacement of Docs `/docs-review`. No silent upgrade of old three-message drafts without a verified migration/reconciliation policy.

A draft name is immutable and collision-safe. Validate project identity, reserved paths, symlinks/traversal, case/Unicode, source drift, and owner lease. Existing canonical `docs/tasks/<slug>` must not be overwritten. Human-readable one-line titles may use ellipsis with full title on hover, without silently changing identity.

## Consequences and qualification
Amend the native authoring contract and relevant **prompt authoring subsection** of ADR 0055's incremental generation contract during implementation, keeping the shared Docs proposal protocol intact. Implement via correction `c13-pfix`: P1–P7 focused and T2 runner, P8 separately initiated real GPT-OSS 20B connected Codex browser T3. Preserve past failure/PASS evidence and hold IG-R4 and Phase 13 R3/R2/R4 until owner reauthorizes a qualified path.

**References:** `docs/workflow.md` (implementation planning, Prompt Efficiency Gate, Phase runner), ADRs 0054/0055, `docs/planning/p13/native-prompt-stack-authoring-contract.md`, and `docs/planning/p13/named-prompt-authoring-chain-contract.md`.
