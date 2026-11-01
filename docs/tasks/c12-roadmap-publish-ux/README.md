# c12-roadmap-publish-ux — Roadmap history cards and canonical Markdown publication

**Owner approval:** 2026-11-01 (America/Chicago). **Status:** APPROVED DESIGN / DOCS ONLY — no implementation prompts authored or run, no qualification claim. **Product baseline:** `0.12.7` unchanged.  
**Decision:** [ADR 0045](../../decisions/0045-roadmap-proposal-lifecycle-and-publication.md) · [Detailed contract](../../planning/p12/roadmap-proposal-lifecycle-and-publication.md).

## Scope

A focused correction for the owner's November 1 screenshot, **separate from** `c12-planning-recovery` P2/H1–H3/P3-A/P3-B/P3-C and from `c12-docs-skills`. Do not rewrite those active prompts, reinterpret their source-bound NOT GREEN reports or claim a schema-2 publication service already exists.

| Unit | Deliverable | Dependencies / qualification |
| --- | --- | --- |
| A — proposal lifecycle and visual clarity | Reuse one existing Chat proposal card for pending and compact persistent historical terminal states; remove duplicate canvas revision narration; solid border for accepted-but-unpublished Phase | May be implemented and Chrome-qualified independently; stale and denied cards are inert and truthful |
| B — publish and link | One deterministic reviewed schema-2 publish/preview/recover operation; Linked Markdown Setup button; protected `/roadmap` Chat request uses the same operation and separate human approval | Zero-model button independently testable; Chat integration only after independently qualified protected P3-A/P3-B routing; never duplicate writer or bypass skill |

Before implementing, inspect actual **local** HEAD/dirty files, current repo policies, `ChatPanelWidget`, `ChatBackend`, saved activity/History, schema-2 `RoadmapStore`, `RoadmapGreenfield`, linked Markdown importer/patch/sync, service RPCs, viewport/CSS and protected skill dispatch. GitHub `main` at `42330f014ce293ff9a30f28c17b1e91ed977bc7b` was the documentation review basis, **not** a substitute for local inspection. Preserve uncommitted owner changes and source files.

## Guardrails

- Exact source/revision/project/lease-bound validation and explicit approval before changes. No model-authored filesystem write or automatic post-accept publication.
- Durable schema-2 publication intent, exclusive new-file creation, stable Phase/Gate/Criterion IDs and round-trip mapping, fingerprinting, interruption/conflict recovery and linked synchronization.
- Clear separation of proposal status, accepted structure, published canonical document, planned work and evidence-backed qualification. No automatic Gate/Phase Green.
- Existing Chat/Work/permission/History ownership retained; status copy is not a new notification owner. Preserve meaningful diagnostics and accessible source warnings.
- All required real Chrome, focused regression and restart/collision tests are independent evidence. Native Electron remains owner-only until observed.

## Future prompt routing

If the owner later asks `/prompt-ass + /prompt-plan + /prompt-write c12-roadmap-publish-ux`, prepare **two** bounded implementation/qualification units (A, B) using this contract and current source. Do **not** activate or run anything from this documentation approval. Unit B may need a narrower deterministic publisher substep before Chat parity if code/recovery scope proves too large. Any unqualified prerequisite blocks only its dependent substep; report a precise NOT GREEN/evidence-gap disposition instead of weakening the owner checks.

**Next gate:** explicit owner prompt-authoring/implementation request, followed by independent manual connected Codex Chrome evidence and any separately needed owner-native Electron review.
