# /prompt-ass — c12-roadmap-sync architecture and runner assessment

**Status:** Assessed and runner scope owner-approved, not implemented/qualified by this document. **Basis:** owner's tower-defense Roadmap screenshot 2026-11-02; ADR 0040/0045/0046/0047, source-bound C12 Planning recovery and current design contracts. Repository documents are architectural evidence, NOT proof of runtime implementation. Local checkout and existing browser state must be inspected during P1.

## Problem: user-observed, not assumed root cause
Chat produced a multi-phase tower-defense checklist, while the Roadmap center editor showed only Unplanned Phase cards, no accepted Gates, unresolved objectives, a huge linked-Markdown approval form and an incomplete-definition error. A natural-language assistant response is not a trusted Phase/Gate/Criterion object model. We must trace the exact original failure without asserting which parser/tool path caused it, then remove response-to-mutation parsing as an authorized writer.

Current docs describe schema-2 RoadmapStore/Service + ProjectPlanningActions, Pi broker, saved ChatPanel, typed Gate actions, existing linked Markdown source adapter, protected /roadmap, single active Chat proposal card and optional canvas overlay. These are the **only authorized seams**, not permission to create parallel Roadmap storage or a model filesystem writer.

## Supersession and duplicate-work analysis
- **c12-roadmap-native-authoring R1–R5** is the approved design-only index; \`c12-roadmap-sync\` implements its requirements with finer runner sequencing. Do not author/run a second competing correction.
- **c12-undo P1–P4** already has separately authored manual prompts. Integrate the complete formal feature here (archive, history toolbar, safe reviewed restore, Chrome qualification) using ADR 0046. Do not execute both stacks concurrently, edit older prompt bytes, delete historical NOT GREEN, or assume implementation exists.
- **c12-roadmap-publish-ux** Unit A's saved inline proposal card, terminal history, provisional active-tab-only preview and accepted solid border are retained. Unit B's repeated manual publication form is superseded by one-time file destination plus safe automatic sync. Never replace collision/conflict protections.
- **ADR 0036/Phase 11 response-first** is superseded only as mutation extraction, not as conversational explanation; **ADR 0040** Gate ownership, qualification and coverage rules remain; **c12-planning-recovery** /roadmap permission gate is retained; **ADR 0046** is the only historical restore owner.
- Phase 11/12 results, native GUI gaps, failed browser matrices, pi/Work and published source evidence remain separately attributed. Do not conflate old and new PASS.

## Architecture choices locked for implementation
1. One structured schema-2 RoadmapStore/Service authoritative owner. Typed bounded brokered read/stage/preview/cancel; model can propose, cannot decide or publish. Stable IDs and namespaced operation IDs; incomplete batches stay noncanonical.
2. Transactional granular decisions: one, parent + descendants, selected subset, all remaining; explicit **Reject** equally granular. Backend computes dependency closure, refuses unsupported orphan/reparent/cycle/duplicate; each successful applied subset is atomic and one revision. After partial Apply revalidate pending operations with a fresh lease against current index+source. Reject/no-op does not create an applied receipt.
3. Existing canvas becomes manual field editor; pencil controls preserve focus, local draft on conflict, keyboard/accessibility, multi-line explicit save. The same validated backend proposal projections power Chat and canvas; provisional data never counts as planned/qualified.
4. Initial Markdown path/confirm only, then deterministic asynchronous checked sync per successful canonical revision; retain unrelated prose, stable mapping, source-hash preconditions, secure paths, collision refusal, queued retry and truthful pending/conflict/failure. Don't hold model loop/UI animations on disk writes.
5. Formal durable versioned history from one common writer boundary; exact baseline and future snapshots, no fabricated old revisions. Undo/Redo = read-only historical cursor, and Confirm Restore = explicit compared/approved **new head**, not mutating navigation. Current qualifications/evidence/waivers/coverage and independent history cannot be reintroduced by snapshot copy.
6. Exact-source local + browser qualification; real model evidence distinct from deterministic fixture; owner-native Electron distinct from browser.

## Top risks and mitigations
- **Tool schema drift / Qwen short context:** bounded incremental staging, manifest, full-draft completeness validation, typed missing-field errors; no giant JSON/reparse fallback.
- **Partial approval/source races:** dependency closure, expected owner/source revision/hash, short-lived one-use lease, idempotency key, stale/repreview; no silent rebasing of authority.
- **Index and Markdown partial failure:** durable intent, exclusive project-local path, safe root/symlink and source-hash check, roundtrip verification, restart reconciliation; show pending/conflict truth.
- **Historical revision gaps:** verified baseline only, append-only future history from all owner writes, provenance/hashes/quota/gap/corruption; no reconstruction from revision number.
- **Restore damaging linked source or evidence:** explicit source-aware diff and approval; preserve unrelated Markdown prose and immutable records; block unsupported linked restores instead of raw overwrite.
- **UI duplication:** one canvas and ChatPanel; no new proposal store/notification; old form only removed once parity proven; active-tab/focus and historical mode isolation.
- **Model security:** /roadmap protected current-turn invocation for AI accepted-index proposals, manual direct edit independent, model cannot call apply/approve or issue shell write; Pi Ask/Allow not bypassed.
- **Regression to Work/History/Chat:** preserve independent Work grants, editor Ctrl+Z, clean copy, saved Chat continuity, historical source-bound status claims.

## Exclusions
No Gate→Work automation, Planning Map replacement, product model/provider default migration, new native app platform, global theme redesign, legacy checkpoint migration, Phase 12 overall closing, automatic evidence-to-GREEN, or rewriting earlier c12-undo/c12-roadmap-publish-ux authored prompt source.

## Required evidence / recommendation
Use P1–P9 small runner implementation gates, P10 manual real connected Chrome loop (maximum 3 targeted repairs). Required: source-bound deterministic tests for schema, staging, subset safety, store/archive, Markdown crash, restore and UI; focused browser and Electron *builds*; actual connected Chrome UI screenshots/DOM/actions; source/file hashes before/after reject, apply and restore; model-provenance if live; negative no-write cases. No mandatory case may be accepted merely because code compiles. Final disposition is GREEN only for fully observed approved correction scope; otherwise NOT GREEN with exact evidence gaps. No time budget can justify an unsafe shortcut.
