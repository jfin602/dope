# /prompt-plan — c11-roadmap-redesign (Phase -> Gate -> Criterion)

**Latest G3 handoff (2026-10-29, d19833b4):** The originally failed zero-health request recognition has a scoped R3 code/Chrome repair and focused tests, but the **full G3 P4 Chrome matrix remains NOT GREEN / EVIDENCE GAP**, and owner-native Electron is unqualified. Do not rerun or duplicate the already-fixed R3 slice by default; finish remaining P4 gates and native disposition, or obtain a new explicit owner-approved sequencing exception, before c11-roadmap-redesign P1. This docs/prompt authoring does not implement the redesign or qualify Phase 11.

**Date:** 2026-10-29. **Status:** Planned and prompt-authored only; NOT RUN / NOT QUALIFIED.
**Reviewed source:** main `68cdec71af73`, `0.11.8`. Verify execution-time product HEAD/dirty tree/version. Stay on main; do not create branch or bump version.
**Required prerequisite:** G3 P4 actual Chrome PASS after its recorded zero-health requirement bug is fixed, plus owner-native outcome or explicit new owner sequencing exception (not presumed). See [G3 closeout](../c11-g3-recovery/closeout.md).
**Canonical references:** ADR 0040, visual contract, this stack README and prompt assessment.

## Target end-state

The Roadmap index is explicitly Phase/Gate/Correction; Gate contains verifiable Criteria and source-bound evidence/qualification. A phase has a separately approved complete required Gate set. A Phase with no accepted Gates is legible but dim Unplanned; one accepted Gate shows Planned presence only. Only all current, required evidence-qualified Gates + approved gate-set coverage + no blocker can support Phase Green. Progress bar counts qualified required Gates and displays denominator and state literally. A waived Gate cannot silently qualify Green; a stale Gate loses credited qualification. Tasks/prompts/Work are links, not Gates.

The interactive editor matches the owner's exact `this-style.png` grammar: horizontal rounded phase cards, Gate rows/foldouts inside them, thin progress track, left-to-right directional arrows, explicit subordinate corrections and no confusing dashed membership lines. Keep single saved ChatPanel dockable anywhere, single RoadmapStore, source-linked Markdown and inspector overlay. No legacy checkpoint/milestone alias or migration is required; incompatible alpha index is rejected safely with explicit developer-approved reset/reimport path.

## Seven prompts and source seams

### P1 — Gate domain and qualification authority
Review `packages/project-intelligence/src/node/roadmap-store.ts`, `roadmap-projection.ts`, `roadmap-phase-association.ts`, `roadmap-owner-links.ts`, qualification evidence/source validators and `packages/theia-extension/src/roadmap-service.ts`. Establish schemaVersion 2 separately typed Phase/Gate/Correction, stable phase-local Gate ordering/designation, criterion evidence state, direct dependencies, incomplete coverage approval and derived phase Green eligibility. Route approved disposition through explicit authority; ordinary AI cannot set Green. Reject schema 1 with helpful non-destructive recovery. Update focused store/projection/status/permission tests. Mandatory current Chrome smoke and tested source; <=3 cycles.

### P2 — Linked Markdown and AI planning
Update `roadmap-import.ts`, `roadmap-document-sync.ts`, `roadmap-document-patch.ts`, `roadmap-greenfield.ts`, `project-planning-actions.ts`, `chat-roadmap-extract.ts`, `roadmap-local-model.ts` and call sites. Establish human-readable Phase/Gate/criterion structure, stable section mapping, revision/hashes, minimal patching, existing approval/refuse/relink and separate canonical publication. Phase-only and task-oriented bullets must **not** be auto-converted into Gates. Explicit acceptance of Gate definitions and their criteria; incomplete drafts visible without pretending qualified. Browser source-backed draft acceptance/rejection and sync/conflict negatives, <=3 cycles.

### P3 — Phase/Gate canvas and navigation
Update `roadmap-canvas-model.ts`, `roadmap-canvas-widget.ts`, viewport, inspector UI and CSS/theme. Render Phase parent cards with nested compact Gate foldouts; correct keyboard/pointer/touch/selected Gate navigation and full in-stage details/edit; chronological arrowheads from phase to phase, no ownership bus. Correct camera/focus/zoom/Chat docking and proposal views. Real Chrome screenshot and interaction evidence against owner visual reference, <=3 cycles.

### P4 — Qualification truth and relationships
Implement actual statuses, qualified N/M and coverage state, blocked/stale/unknown/waiver, no 100% on zero, data-authoritative evidence and correction ownership (Gate/Phase); dependency view explicit not cluttered. Persist changes only via validated Roadmap actions; display-only change never edits Markdown. Test fresh/partial/all/waived/stale and ambiguity/cross-project cases with real Chrome, <=3 cycles.

### P5 — Dope Help
Update existing `dope-capability-help.ts`, existing `chat-context-composer.ts`/ChatBackend only if necessary, registry and focused negative selector tests. Explain verified UI Gate creation/foldouts, criteria/evidence, phase statuses, source approval, waiver and dependencies. Real saved Chat under actual selected local Q4 where available; never force provider or fall back to hosted inference. Browser matrix and no writes, <=3 cycles.

### P6 — Alpha cleanup and cross-seam integration
Search active source/tests/docs for Roadmap `checkpoint`, `milestone`, aliases and duplicate nodes; remove dead architecture, obsolete tests and older prompt sources; update all supported Phase Focus, Planning Map, Work/History/task discovery, prompt navigation, import/sync/create/relink consumers. Retain unrelated runner's real execution **checkpoint** terminology only when it describes Work history, not a Roadmap Gate. Implement safe explicit invalid-index recovery. Final coherent source checks and one aggregate if feasible, browser integrated replay, <=3 cycles.

### P7 — Independent exact-source Chrome closeout
Manual evidence-only by default: fresh three-phase and project-like Roadmap, draft/accept/reject/sync, Gate criteria/progress/Green/stale/waived, correction/dependency, nav/themes/Chat, explicit failed permission and other negatives. Check git HEAD, served bundle/hash, model provenance, actual screenshots and actions, final build/tests; STOP on gaps. Report Chrome-scoped verdict and separate owner-operated native Electron checklist. Do NOT declare Phase 11 Green from this correction.

## Stop law

Each P1–P6 has up to 3 **bounded repair/qualification cycles** and real connected Codex Google Chrome is required. P1 cannot start before stated G3 prerequisite. Each later P requires prior exact-source PASS and known source; a failing or blocked prompt stops the stack. Do not substitute a simulated screenshot/JSDOM or `npm run build:browser` alone. Re-run affected tests after repairs. P7 is one independent final closeout, not a new implementation prompt. A missing Q4 or native session is an explicit gap, not a simulated PASS.

Perform `npm run codex:phase:validate -- c11-roadmap-redesign` locally before running; no /activate. Run prompts **individually in Codex with real Chrome**, not unattended runner as proof. No reset/stash/clean/force push or concurrent edit overwrite; do not silently commit against runner authority or mutate persistent PixiJS game for destructive tests. No source/version bump, Chat replacement, unapproved publication or autonomous Work by docs authoring.
