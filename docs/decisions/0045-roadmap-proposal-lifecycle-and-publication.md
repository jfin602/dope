# ADR 0045 — Persistent Roadmap proposal cards and explicit canonical publication

**Date:** 2026-11-01 (America/Chicago)  
**Status:** OWNER-APPROVED DESIGN / DOCUMENTATION ONLY — not implemented, run or qualified by this decision  
**Product:** Dope `0.12.7` unchanged  
**Design contract:** [Roadmap proposal lifecycle and canonical publication](../planning/p12/roadmap-proposal-lifecycle-and-publication.md)  
**Future correction:** [c12-roadmap-publish-ux](../tasks/c12-roadmap-publish-ux/README.md)

## Context

The owner observed a saved Chat Gate edit that was accepted at Roadmap revision 5. After the decision, the rich Chat proposal review was replaced by plain outcome text. A redundant bottom-of-canvas status line repeated the revision and "Markdown not published" state. The accepted Phase remained outlined with dashes, which visually resembled an unapproved proposal. The Linked Markdown setup panel said no canonical document existed but provided no Publish action.

Source review of GitHub `main` at `42330f014ce293ff9a30f28c17b1e91ed977bc7b` found: `ChatPanelWidget` renders a rich card only for the active `planningProposal`; the controller clears that proposal after decision; saved planning activity has applied/rejected/stale/denied/etc. outcomes but a different presentation; `RoadmapCanvasWidget` generates the canvas status line; `dope.css` explicitly dashes `.dope-roadmap-draft-accepted .dope-roadmap-node`. Schema-2 `RoadmapGreenfield.accept()` accepts structure without publishing Markdown; `RoadmapService` has import, patch, sync and relink APIs, but no reviewed publish-and-link API for an already accepted, unlinked schema-2 index. Legacy schema-1 creation/recovery is not an acceptable new writer.

## Decision

1. **One durable lifecycle card in the existing saved Chat transcript.** Extend the actual validated Roadmap proposal card rather than introduce another notification, pseudo-history or store. A pending card is expanded and reviewable; once an action is decided or invalidated it becomes a compact styled, accessible, optionally expandable, non-actionable record. Cover applied, developer-rejected, backend-denied, stale, failed, cancelled and superseded states truthfully. Rehydrate from existing authoritative saved activity/decision records. Historical cards never restore expired proposal, lease or approval authority. Do not falsely call an approval-only/no-op result applied.
2. **Remove duplicate canvas revision narration.** The bottom-of-canvas Roadmap revision/status text is not a separate notification service. Eliminate redundant persistent revision/accepted-unpublished/prompt-discovery narration there. Retain meaningful actionable failures, source conflict/recovery indicators and accessible status in their appropriate existing UI, with diagnostics discoverable rather than suppressing evidence.
3. **Accepted cards use a solid Phase border.** Dashed/dotted borders remain for unaccepted proposals or other explicitly provisional preview ghosts; an accepted structured Phase is solid whether its Markdown is published or not. Keep an explicit `Accepted draft · not yet canonical` indicator until linked publication succeeds. Published/canonical and planned/qualified are independent. Do not remove distinct stale-*qualification* treatment or invent Green.
4. **Explicit reviewed schema-2 Markdown publication.** Add **Publish & Link Markdown** to the existing Linked Markdown Setup panel for `revision > 0`, accepted unlinked schema-2 indexes. Publish creates an exact, project-local, safe canonical `.md` source and binds section identities, hash, synced state and `draftAcceptance: published` through the current Roadmap owner. Before any write, show an inspectable generated preview, selected path, revision, expected source state, mappings, incomplete coverage disclosures and approval. No silent startup publication, unsafe overwrite, incompatible schema shim or automatic qualification. Reject/no-op/stale outcomes leave source bytes and authority unchanged; interruption recovery is durable, exclusive, idempotent and evidence-based.
5. **One deterministic operation for button and Chat.** The button and an explicitly protected `/roadmap` Chat publication request reach the *same backend preview/apply/recovery service* and require developer approval on the current exact proposal. The model may request/explain publication; it cannot provide privileged file contents or bypass current-turn skill verification, path checks, project/lease/revision checks or human approval. Preserve ordinary manual/import/relink/source-sync routes without making them depend on the AI skill.
6. **No second authority.** Keep the existing saved ChatPanel, backend proposal/decision authority, schema-2 `RoadmapStore`, `ProjectPlanningActions`, Phase/Gate/Criterion grammar, linked Markdown source adapter, applied-only History restrictions and Pi/Work permissions. Preserve related source bytes and historical records; do not reinterpret older qualification reports.

## Implementation boundary and sequencing

Split work into **Unit A — card lifecycle, redundant canvas status cleanup and solid accepted visual**, and **Unit B — reviewed canonical publication, UI/Chat entry points, crash-safe reconciliation and qualification**. Unit A may qualify independently. Unit B's deterministic zero-model button does not require a `/roadmap` model turn; its Chat route depends on actual qualified protected Skills/`/roadmap` routing, or must remain blocked rather than ship a bypass. This is a **separate future correction**, not an amendment to already-authored `c12-planning-recovery` P3-B/P3-C, H1–H3 or Docs-skills prompts. Real connected Chrome and exact-source tests are mandatory; native Electron remains a separate owner-observed gap. No prompt authoring, code implementation, version bump, automatic run or Green claim is authorized by this docs change.

## Alternatives rejected

- Keeping a separate Roadmap revision toast/status and a second historical proposal UI.
- Persisting live approval tokens with the visual card, or reconstructing proposals from model text.
- Treating acceptance of structure as a file publication or Phase qualification.
- Reusing the retired schema-1 publisher, writing Markdown directly from the model, or silently overwriting `ROADMAP.md`.

## Revisit when

Revisit if a real schema-2 publication owner is implemented with conflicting contracts, source grammar cannot round-trip exact supported identities, or the connected browser reveals an accessibility, crash-recovery or project-isolation failure. Preserve reviewed data while resolving conflicts explicitly.
