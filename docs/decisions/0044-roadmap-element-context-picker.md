# ADR 0044 — Roadmap element selection as protected Chat context

**Date:** 2026-11-01 (America/Chicago)  
**Status:** APPROVED DESIGN / DOCUMENTATION ONLY — not implemented or qualified  
**Product:** Dope `0.12.7` unchanged

## Context

With the Roadmap and Chat open together, the developer knows which Phase/Gate/Criterion to reference visually, but the model may only see an ambiguous text description. The protected `/roadmap` skill guards the AI edit proposal route and avoids injecting the full Roadmap into ordinary Chat.

## Decision

Provide **Add Context → Roadmap Element** in the existing Chat composer when the Roadmap canvas is also visible in the same project. Let the user select **multiple stable, authoritative Roadmap records** using the existing canvas and attach them as removable chips. The deliberate user attachment visibly inserts **`/roadmap`** at the start of the draft and, at Send, Dope binds the **protected skill invocation and typed element references in trusted turn metadata**. Do not duplicate a typed prefix or remove a manually entered one. A chip without a valid prefix/invocation must not silently bypass the skill barrier.

Retrieve complete **selected** context progressively from the structured owner, including parent path, nested owned criteria/evidence, revision and canonical/accepted-unpublished draft/linked-source status. A selected phase expands its authorized subtree; a selected gate does **not** include unrelated sibling gates. Deduplicate overlap; refuse stale, cross-project or oversized mandatory context instead of silently truncating. Attachment is context, **not approval**: existing backend proposal preview and explicit Accept/Reject remain the only AI edit authority. No new Chat, writer, Roadmap store or model.

## Rationale, alternatives and sequencing

This eliminates unnecessary gate-name clarification without reintroducing whole-Roadmap prefill. Rejected alternatives: unconditional context injection, DOM scraping, free-text invocation as authorization, automatic approval, and a second simulated Roadmap store. Picker selection is **input context**; the existing **View in Roadmap** is **output proposal inspection**.

This is a **separately authorized follow-on after generic P3-A and protected P3-B /roadmap qualification**. Do not silently enlarge their authored prompts, rewrite historical P2/H3 results, claim native parity or imply a version change.

**Full interaction, lifecycle and Chrome acceptance contract:** [Roadmap Element context picker](../planning/p12/roadmap-element-context-picker.md).
