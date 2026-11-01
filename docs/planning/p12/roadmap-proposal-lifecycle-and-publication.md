# Roadmap proposal lifecycle and canonical Markdown publication — approved forward contract

**Owner decision:** 2026-11-01 (America/Chicago). **Status:** APPROVED DESIGN / DOCUMENTATION ONLY — not implemented or qualified by this document. **Product:** `0.12.7` unchanged.  
**Decision:** [ADR 0045](../../decisions/0045-roadmap-proposal-lifecycle-and-publication.md) · **Independent correction:** [c12-roadmap-publish-ux](../../tasks/c12-roadmap-publish-ux/README.md).  
**Existing authority:** [ADR 0040](../../decisions/0040-phase-gate-roadmap-domain.md), [hybrid Chat/Roadmap review](chat-roadmap-hybrid-proposal-review.md), [visual hierarchy](../p11/roadmap-visual-hierarchy-contract.md), [documentation/History](../../decisions/0041-planning-documentation-workflow-and-applied-history.md), protected [`/roadmap` routing](../../tasks/c12-planning-recovery/P3-B-roadmap-skill.txt).

## Observed issue and source boundary

The owner's screenshot shows an applied Gate edit at revision 5, a disconnected plain-text history outcome, a bottom-of-canvas revision/status sentence, an accepted-but-unpublished schema-2 Phase with a dashed outer outline, and a Linked Markdown Setup panel with no publication action. On GitHub `main` at `42330f014ce293ff9a30f28c17b1e91ed977bc7b`, `ChatPanelWidget` renders active `planningProposal` and the controller clears it after a decision; backend-authored activity labels exist in `chat-panel-presentation.ts`. `RoadmapCanvasWidget` owns the redundant status sentence and the setup panel's unlinked `revision > 0` dead end. `dope.css` styles accepted draft nodes dashed. `RoadmapGreenfield.accept()` saves schema-2 structure but not a file. Existing schema-2 patch/sync/relink/import do **not** constitute accepted-index publication. A legacy schema-1 `acceptGreenfield`/recovery path is historical, not a compatible publisher.

The approved UX changes below require new qualification; source observations are not a claim that the new behavior exists.

## A. One persistent, truthful Chat proposal card

Use the **same existing saved ChatPanel transcript and validated presentation data** for both review and historical outcomes. Keep one proposal identity tied to its saved originating Chat message and decision/event; never reconstruct from untrusted JSON or model-written summary.

| Lifecycle | Default visual state | Available controls |
| --- | --- | --- |
| Pending, currently valid | Expanded, exact before/after affected Phase/Gate/Criterion plus source and revision | Accept, Reject; View in Roadmap only for supported current previews |
| Applied, confirmed write | Compact styled success card | Expand details; no Apply |
| Developer rejected | Compact neutral record, `Rejected · no change` | Expand details only |
| Backend denied/invalid | Compact explanatory record, `Denied · no change` | Expand, review reason |
| Stale (revision/source/lease changed) | Compact warning record, original revision/source indicated | Expand, obtain a *new* review; never reuse token |
| Failed/cancelled | Compact error or neutral terminal record reflecting verified actual effects | Expand, diagnostics/recovery as genuinely applicable |
| Superseded/replaced | Compact historical record naming or linking its valid successor when known | Expand only |

An expired pending review on history reload/project switch must render as inert stale/unavailable history, never as a live Accept button. Guard delayed callbacks, multiple ChatPanels, saved Chat reopening, retries, source edits, cancellation and switched projects; do not lose original proposal details. Distinguish **human rejection** from validation denial, no-op/approval-only from applied and uncertain/partial write from success. Compact card shows action, affected entity, state and actual revision if verified. Expand reveals preserved exact-source change description, before/after and provenance where available; never expose privileged approval token. Keep full diagnostic diff separately discoverable and ordinary copy/transcript clean of debug metadata. Preserve Chat drag-scrolling/text-selection behavior and compact layouts, keyboard/accessible labels, reduced motion, and color contrast. Do not add agent/model calls or delay Pi streaming/writes for animation.

Remove **redundant bottom Roadmap canvas revision/publication narration** from the main viewport. This text currently comes from canvas `this.status`, not a toast service. Do **not** delete meaningful actionable source/permission/recovery alerts or screen-reader status. The Linked Markdown panel/toolbar exposes canonical sync state; the card records change outcome; diagnostics expose prompt discovery errors without repeating them as a permanent surface-level toast.

## B. Phase border and authority labels

| Structured Roadmap state | Outer Phase treatment | Explicit text |
| --- | --- | --- |
| Unaccepted proposal/draft ghost | Dotted/dashed provisional treatment | Proposed · Not applied |
| Accepted structure; Markdown unpublished | **Solid** Phase border using existing planning-state accent | Accepted draft · not yet canonical |
| Published linked canonical structure | **Solid** Phase border, source-linked indicator | Canonical Roadmap / linked Markdown status |
| Qualified phase | Existing evidence-backed qualification color and progress only | Qualified on actual accepted Gate evidence |

Change the accepted-draft selector rather than globally removing dashed styling; keep true qualification-stale and proposal-ghost distinctions. A Phase with one accepted Gate is *Planned*, not complete. Publication must not change criterion evidence, gate-set-coverage approval, implementation state, Gate Green or Phase Green. `accepted`, `published`, `planned`, `qualified` are different dimensions.

## C. Explicit canonical Markdown publication

**Eligibility:** project-local schema-2 index with accepted Phase/Gate structure, `revision > 0`, no linked Markdown, no unrelated pending conflicting owner mutation. Start from existing **Linked Markdown — Setup** panel. Add a visible `Publish & Link Markdown` button (and a clearly differentiated `Link existing`/import route where supported). It is never auto-invoked on opening a project, accepting a draft, refreshing, or merely asking about the Roadmap.

**Review preview:** generated deterministic Phase/Gate/Criterion Markdown (one canonical grammar, no fabricated gates, objectives or evidence), target project-relative `.md` path, expected project/index revision and root identity, canonical file absent/collision state, prospective stable section IDs/mappings, exact bytes/hash, and disclosures for unreviewed Gate-set coverage or incomplete planning. A safe unused `ROADMAP.md` may be suggested, but the user can select a supported safe destination. A target already containing a source is **not overwritten**: explain import/link/review or select a different path. Missing required/invalid schema content blocks publication; unreviewed qualification coverage is disclosed, **not** silently auto-approved or automatically treated as schema invalid. No auto-import of arbitrary task bullets as Gates.

**One writer/transport:** extend the authoritative schema-2 Roadmap backend with an explicit preview and approved publish operation (names selected against the actual source before implementation); expose through the existing `RoadmapService` bridge. Reuse the Phase/Gate/Criterion importer grammar and checked Markdown adapters so the generated file can be reparsed and mapped exactly. Never call the legacy schema-1 checkpoint-based `acceptGreenfield` as a shortcut; do not introduce a separate file writer/owner, manual shell or provider-generated payload. Bind proposal to project, canonical root, structured revision, source/hash or absence preconditions, path, content hash and exact approval identity.

**Publish and recovery:** recheck source, requested path, symlink/parent traversal, file collision, current revision and approval under the owner lock. Use exclusive, durable file creation and an intent/recovery journal appropriate to the current schema-2 store; treat a crash after file creation but before index linkage as pending recoverable state. An exact matching file may be recovered idempotently; a changed/colliding file must halt without overwrite. Verify round-trip parser mappings and content hashes before marking `linkedDocument` synced and switching accepted entities to `published`. Preserve stable IDs and source-aware edit/sync/relink behavior. Record only the verified actual effect in relevant History; no duplicate applied record on retry. A reject, stale attempt, no-op or failed-zero-effect attempt leaves existing document bytes and qualified state untouched. Partial/uncertain effects require truthful recoverable status, never a false published badge.

**Button and Chat parity:** the setup-panel button follows direct **human reviewed** preview/approve in the same backend. A Chat instruction such as `/roadmap publish the accepted Roadmap to ROADMAP.md` resolves an explicit protected current-turn skill (once qualified), asks the deterministic service to prepare the same review, and routes the actual human decision through the same approved publication operation. The language model does not supply arbitrary filesystem bytes or approve a request. Chat/history approval is bound to the exact project/chat/lease/source/revision. Do not make button/import/relink/sync depend on `/roadmap`; do not weaken or duplicate its AI-origin gate. If the protected skill/runtime is not yet qualified, disable/hold the Chat route and qualify the zero-model UI independently.

**After publication:** update the existing Roadmap canvas/panel and linked source status from confirmed authoritative state; no second editor, new Roadmap index or phantom Gate qualification. External source reconciliation, relink, restart and conflict handling must continue to use existing owners. Keep `ROADMAP.md` as canonical only when actually linked and published, not merely because the filename exists.

## Implementation and sequencing

**Unit A (independent):** Chat pending-to-terminal card lifecycle and persisted historical rehydration; cleanup duplicate bottom status; accepted Phase solid outline. Reuse present backend response/activity projection and existing CSS, not another notification subsystem.

**Unit B (dependent for Chat entry only):** reviewed schema-2 publisher and crash-safe file/index linkage; Linked Markdown Setup and `/roadmap` entry parity. Complete deterministic button tests independently; gate Chat route on qualified P3-A Skills and P3-B protected `/roadmap` authority. These are **new, separately authorized corrections** and must not change already-authored C12 P2/H1–H3/P3-B prompts or claim their NOT GREEN evidence resolved.

## Connected-browser and deterministic qualification

1. Pending → applied, rejected, backend denied, stale, failed, cancelled, superseded: cards persist across reload; old cards expand but never regain Accept; project/Chat switch and delayed response cannot revive a token or leak a preview. Test multiple chats, long/multi-action/source-owned previews and clean copy.
2. Verify the former bottom status duplication is gone while real linked-source conflicts and actionable diagnostics remain accessible; test screen reader/status, keyboard, narrow Chat docks and reduced motion.
3. Accepted noncanonical Phase shows solid outline plus explicit warning, published Phase solid plus source link, proposed ghosts provisional, stale *qualification* remains distinguished, unknown/unqualified stays unknown; no false Green/coverage completion.
4. One accepted revision with two Gates and criteria: preview -> reject (zero source bytes) -> approve in UI -> exact file bytes and parser round-trip -> linked hash/sections/state; refresh, external edit and reconciliation; no duplicate file or History on retry.
5. Concurrent revision, changed/unsafe/symlink/outside-root path, existing `ROADMAP.md`, incompatible grammar, partial interrupted write, stale approval, cross-project and crash/restart all fail closed or recover truthfully; never clobber unrelated files.
6. After Skills/`/roadmap` qualification, compare Chat and button preview/publish behavior and same backend service/decision; plain Chat, forged slash text or stale skill metadata cannot publish. No additional source tool grant, Work start, arbitrary shell or model-induced Green.
7. Run focused tests, types and browser/Electron builds on exact final code; inspect actual connected Codex Chrome with disposable projects. Owner-native Electron is separately unverified unless independently observed. Record NOT GREEN for mandatory unproven cases.

**Disposition:** design approved only. No code changes, data migrations, prompt authoring, browser qualification, version change or status upgrade by `/docs-apply`.
