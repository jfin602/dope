> **CURRENT ASSESSMENT / HANDOFF (2026-11-01):** P3-C now [revisits generic P2 reliability and closes out Planning Recovery](P3-C-planning-closeout.txt), after independently dispositioned P3-A/P3-B. Docs implementation/qualification is assigned to separate [c12-docs-skills](../c12-docs-skills/README.md), preserving the unexecuted original Docs prompt [verbatim](../c12-docs-skills/archive-original-P3-C-docs-skills.txt) and ADR 0041. Prior dated statements about P3-C Docs below are superseded for execution; none of the historical NOT GREEN evidence changes.

> **HISTORICAL OWNER SEQUENCE (2026-10-31; SUPERSEDED):** [P3-A Skills](P3-A-skills-framework.txt) → [P3-B /roadmap](P3-B-roadmap-skill.txt) → [archived P3-C Docs](../c12-docs-skills/archive-original-P3-C-docs-skills.txt). Earlier independent sibling ordering below is superseded for execution; retain historical NOT GREEN results.

> **2026-10-31 P3-B DESIGN ASSESSMENT (DOCUMENTATION ONLY):** The new [P3-B](P3-B-roadmap-skill.txt) depends on independently qualified P3-A Skills registry and preserves P2's existing 19 actions/1–3 atomic, source/revision-bound review. Current schema-2 selected Roadmap Chat can inject a broad snapshot and `GATE_ACTION_INSTRUCTION`; P3-B gates model-generated mutation proposals on verified current-turn `/roadmap`, separates read-only context from edit instructions and progressively retrieves required targets. It does not add a writer or make P2/H1/H2 (latest NOT GREEN), P3-A/B, or native Electron Green. After P3-A qualification, P3-B Roadmap is executed and dispositioned before current P3-C general closeout; Docs moved to a new correction.

> **P3 split now authored — 2026-10-31 (DOCS ONLY):** [P3-A](P3-A-skills-framework.txt) implements/qualifies only the generic Skills framework; after its independent Green disposition, [P3-C](../c12-docs-skills/archive-original-P3-C-docs-skills.txt) targets built-in Docs skills, progressive retrieval and source-bound protected apply. The direct [original P3](P3-docs-core-entry.txt) remains byte-identical, unrun, superseded. [Skills contract](../../planning/p12/skills-framework-contract.md) controls. Historical assessments/evidence below remain historical; neither new prompt has been executed or qualified by these edits.

# /prompt-ass — c12-planning-recovery

**2026-10-31, docs-only assessment.** Reviewed GitHub `main` source and the saved C12 Qwen30 qualification. Last local uncommitted changes may differ; manual prompts must inspect actual source. Product `0.12.7`; no code changes/tests from authoring.

## Source-backed observations

- `packages/pi-runtime/worker.mjs` has standard brokered Chat read/list/search/command tools and a separate Planning-only `submit_plan`/tool mode. The latest 30B live qualification exercised source reads, tool continuation and `submit_plan` but produced **no accepted pending plan**. It recorded two rejected submissions per turn and 54/54 focused tests; browser/native qualification remains incomplete. See `../c12-pi-agentic-chat/qualification/2026-10-31-typed-planning-recovery.md`.
- `chat-backend.ts` retains `planOnly` request/preview routing, `PLAN_INVESTIGATION_INSTRUCTION`, requirement extraction/review, typed submit preview and existing Roadmap gate-proposal routing. These are separable responsibilities but cleanup must trace every caller and UI state before deletion.
- `roadmap-gate-chat.ts` already authorizes 19 Phase/Gate/Criterion/Correction action kinds, binds proposal-scoped temporary IDs and creates before/after summaries. `chat-context-composer.ts` already contains schema-2 Gate action guidance. The Chat envelope is currently bounded at 1–3 actions; the product also has a separate linked Roadmap Markdown owner. **Do not redesign this domain.**
- `c12-docs-workflow` is an **authored-only 15-prompt plan** covering safe exact-source document publication, recovery, History and optional Work references. A real complete Docs implementation is **not established** by the inspected repo or the owner reports. Do not call it already built.
- Ponytail default persistent Pi injection adds roughly 715–820 estimated tokens; keep it in the Sol High coding workflow only. This recovery favors deletion, existing owners and focused qualification.

## Decision and scope

**P1 (small):** decommission only orphaned rigid implementation-plan feature state, instructions and tool; repair direct dependents and tests. Do not delete useful generic Planning, Roadmap generation/editing, roadmap-drafts data used by unrelated features, or Work preparation. Old state should fail safely or be preserved as historical noncanonical records; never lose unrelated user data.

**P2 (targeted):** verify existing schema-2 Chat edit path end to end before coding. Repair only observed problems in action selection, malformed output recovery, grouped atomic preview, revision and linked Markdown. Avoid a second proposal framework or speculative unlimited batching. One real Qwen30 edit + reject/approve disposable tests; representative deterministic action-family coverage and safe negative tests.

**P3 (original, superseded historical assessment):** use original Docs contracts as the safety source, but scope a small functional review/preview/apply path rather than the optional Work reference features. First inspect what's actually implemented; if durable journal/approval/recovery/History foundations are absent and cannot be safely completed in the manual prompt, produce an exact next-step split/blocker rather than deploy a partial unsafe writer.

**P3-A (targeted Skills):** Inspect pinned Pi support, implement the smallest deterministic user/built-in skill registry and slash composer extension; keep skill instructions text-only, user-scoped, bounded and per-turn, with no new model call or authority. Verify an actual selected-model Chrome skill turn versus plain control; keep Docs out.

**P3-B (targeted Roadmap skill + context):** Build on the qualified protected skill registry only. Replace selection-driven AI edit eligibility with Dope-verified per-turn invocation metadata and preserve the existing backend proposal validation and approval path. A selected source without an invoked skill remains readable, not writable by AI. For edits, fetch the minimum current index/target/parent/source/revision fields, supporting no selected item through exact ID/designation resolution or useful ambiguity handling. Do not prefill all Gate criteria/evidence or re-send the long edit grammar on unrelated turns; disclose omissions and fail closed when mandatory data won't fit. Browser-qualify with same-model 16K large fixtures, unskilled controls, linked/lease/retry/permission negatives and exact before/after bytes. P2-R3/H2 gaps remain to be resolved independently.

**P3-C (P2 reliability/Planning Recovery closeout):** Following P3-A Skills and P3-B /roadmap, independently replay outstanding generic P2-R3/H3 Chat/Pi blockers on exact final source: normal Chat output-limit, cancelled context isolation, live copy payload/clipboard, verification reconnect, keyboard attribution and preserving existing Roadmap/Skills. Close out honestly, never infer Green from prior scope or tests. The Docs requirements now live in c12-docs-skills.

## Principal risks / controls

- Stale local-vs-remote source: preflight local HEAD/dirty tree; preserve unknown modifications.
- Accidental removal of Roadmap/Prepare Work: symbol/call-site inventory, source-targeted regressions, browser checks.
- Qwen JSON weakness: model freeform conversation remains usable; typed Roadmap actions validated only when explicitly requested. No arbitrary freeform output to canonical writes.
- Roadmap action batching: existing 1–3 limit is safety cap; expand only if a demonstrated owner workflow requires it and atomic validation is supported.
- Docs scope: no general shell writer or unjournaled canonical file mutation; no fake full stack closeout.
- Native AppImage: owner-native exact-build qualification still EVIDENCE GAP.

## Assessment disposition

**ASSESSED / APPROVED FOR P1, P2 AND SEPARATE P3-A/P3-B/P3-C MANUAL PROMPTS; P3-B NOT IMPLEMENTED OR QUALIFIED.** No runner dependence, no new model comparison, no broad Pi integration rewrite, no version bump. Keep original NOT GREEN evidence immutable.
