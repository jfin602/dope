# c12-roadmap-publish-ux — Roadmap history cards and canonical Markdown publication

**Owner approval:** 2026-11-01 (America/Chicago). **Status:** APPROVED DESIGN / DOCS ONLY — no implementation prompts authored or run, no qualification claim. **Product baseline:** `0.12.7` unchanged.  
**Decision:** [ADR 0045](../../decisions/0045-roadmap-proposal-lifecycle-and-publication.md) · [Detailed contract](../../planning/p12/roadmap-proposal-lifecycle-and-publication.md).

## Scope

A focused correction for the owner's November 1 screenshot, **separate from** `c12-planning-recovery` P2/H1–H3/P3-A/P3-B/P3-C and from `c12-docs-skills`. Do not rewrite those active prompts, reinterpret their source-bound NOT GREEN reports or claim a schema-2 publication service already exists.

| Unit | Deliverable | Dependencies / qualification |
| --- | --- | --- |
| A — proposal lifecycle and visual clarity | One full-width card inline in the originating assistant final response for pending/compact historical outcomes; no duplicate Roadmap change transcript row; active-tab-only automatic View in Roadmap preview; remove duplicate canvas revision narration; solid border for accepted-but-unpublished Phase | May be implemented and Chrome-qualified independently; history remains inert, automatic preview never steals editor focus |
| B — publish and link | One deterministic reviewed schema-2 publish/preview/recover operation; Linked Markdown Setup button; protected `/roadmap` Chat request uses the same operation and separate human approval | Zero-model button independently testable; Chat integration only after independently qualified protected P3-A/P3-B routing; never duplicate writer or bypass skill |

Before implementing, inspect actual **local** HEAD/dirty files, current repo policies, `ChatPanelWidget`, `ChatBackend`, saved activity/History, schema-2 `RoadmapStore`, `RoadmapGreenfield`, linked Markdown importer/patch/sync, service RPCs, viewport/CSS and protected skill dispatch. GitHub `main` at `42330f014ce293ff9a30f28c17b1e91ed977bc7b` was the documentation review basis, **not** a substitute for local inspection. Preserve uncommitted owner changes and source files.

## Guardrails

- Exact source/revision/project/lease-bound validation and explicit approval before changes. No model-authored filesystem write or automatic post-accept publication.
- Durable schema-2 publication intent, exclusive new-file creation, stable Phase/Gate/Criterion IDs and round-trip mapping, fingerprinting, interruption/conflict recovery and linked synchronization.
- Clear separation of proposal status, accepted structure, published canonical document, planned work and evidence-backed qualification. No automatic Gate/Phase Green.
- Existing Chat/Work/permission/History ownership retained; status copy is not a new notification owner. Preserve meaningful diagnostics and accessible source warnings.
- All required real Chrome, focused regression and restart/collision tests are independent evidence. Native Electron remains owner-only until observed.

## Unit A owner refinement — inline cards and active-tab-only auto-preview (2026-11-01)

The same pending-to-historical card must live **in the originating assistant's final response**, after explanatory text and immediately above the footer, spanning the available Chat content width. Suppress the separate **Roadmap change** transcript activity row and any duplicate proposal presentation, **not** the underlying authoritative activity/audit events. Update the same card in place for applied, rejected, stale, denied or failed outcomes and restore it as inert history. Narrow panels must wrap actions/keep details inspectable without clipping.

When a genuinely new, validated and reviewable proposal arrives and the Roadmap is already the **active center-editor tab**, automatically render/locate/highlight its exact validated provisional change using the existing **View in Roadmap** bridge, without opening/switching tabs or stealing Chat keyboard focus. If Roadmap is an inactive background tab or closed, do nothing automatically. Keep the manual **View in Roadmap** action for all eligible pending proposals; do not trigger auto-preview on restored history, rerenders, status changes or merely switching to Roadmap later. One event/identity, source and project revalidation, no automatic approval or canonical write.

**Connected Codex Chrome Unit A acceptance additions:**

1. Live pending proposal: inline, **full-width** in the assistant final response above footer; no separate **Roadmap change** row; accurate summary, diff and review controls.
2. Reject then separately approve a proposal: each card updates **in the same message** to truthful compact history, no duplicates; zero change on reject, confirmed changes only on apply, no stale approval after reload.
3. Active Roadmap tab: newly arrived proposal auto-previews the exact affected Gate/Phase; manual button remains available; no tab replacement, keyboard focus theft, forced Fit All or source write.
4. Background Roadmap tab and closed Roadmap: new proposal never changes the user's selected editor or opens Roadmap; manual button correctly navigates when pressed.
5. Restore/reload/Chat switch/multiple proposals: no historical replay, duplicate overlay or cross-turn/project mix-up; status changes only update the original card. Include delayed arrival with tab switching, invalidated revision/lease and transient-overlay cleanup.
6. Resize narrow/wide Chat docks and check readable content, wrapping actions, expanded details, keyboard/screen-reader accessibility, normal copy/text selection/drag/touch scroll, and unaffected ordinary Chat streaming.

Use existing source-authoritative tests/typecheck/build and **real connected Codex Chrome** for the above. An unobserved required case remains NOT GREEN/evidence gap, not a claimed browser pass. This refinement does not authorize Unit B publication, run any stack, qualify P3-B/H1–H3, alter native evidence or bump version 0.12.7.

## Future prompt routing

If the owner later asks `/prompt-ass + /prompt-plan + /prompt-write c12-roadmap-publish-ux`, prepare **two** bounded implementation/qualification units (A, B) using this contract and current source. Do **not** activate or run anything from this documentation approval. Unit B may need a narrower deterministic publisher substep before Chat parity if code/recovery scope proves too large. Any unqualified prerequisite blocks only its dependent substep; report a precise NOT GREEN/evidence-gap disposition instead of weakening the owner checks.

**Next gate:** explicit owner prompt-authoring/implementation request, followed by independent manual connected Codex Chrome evidence and any separately needed owner-native Electron review.
