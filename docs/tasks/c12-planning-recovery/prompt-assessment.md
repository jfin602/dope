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

**P3 (bounded core):** use original Docs contracts as the safety source, but scope a small functional review/preview/apply path rather than the optional Work reference features. First inspect what's actually implemented; if durable journal/approval/recovery/History foundations are absent and cannot be safely completed in the manual prompt, produce an exact next-step split/blocker rather than deploy a partial unsafe writer.

## Principal risks / controls

- Stale local-vs-remote source: preflight local HEAD/dirty tree; preserve unknown modifications.
- Accidental removal of Roadmap/Prepare Work: symbol/call-site inventory, source-targeted regressions, browser checks.
- Qwen JSON weakness: model freeform conversation remains usable; typed Roadmap actions validated only when explicitly requested. No arbitrary freeform output to canonical writes.
- Roadmap action batching: existing 1–3 limit is safety cap; expand only if a demonstrated owner workflow requires it and atomic validation is supported.
- Docs scope: no general shell writer or unjournaled canonical file mutation; no fake full stack closeout.
- Native AppImage: owner-native exact-build qualification still EVIDENCE GAP.

## Assessment disposition

**ASSESSED / APPROVED FOR THREE MANUAL PROMPTS, NOT IMPLEMENTED.** No runner dependence, no new model comparison, no broad Pi integration rewrite, no version bump. Keep original NOT GREEN evidence immutable.
