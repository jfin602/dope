# Phase 9B — Separate Owner Activation

**Date:** 2026-10-11 (America/Chicago)  
**Decision:** **OWNER-APPROVED — PHASE 9B P1–P7 ACTIVATED FOR EXECUTION; NOT IMPLEMENTED OR QUALIFIED**  
**Owner instruction:** "approve 9b" (2026-10-11, following review of the missing separate 9B activation gate).

## Decision and accepted entry

The owner explicitly authorizes the existing **Phase 9B Typed Artifact Membership and Read-Only Resolution** stack, **P1–P7**, as defined in `docs/planning/p9/phase-9b-plan.md`, `docs/tasks/p9b/README.md`, and the authored P1–P7 prompts. This is the **separate owner activation record** required by the 9B preflights; neither prior Phase 9 design approval nor the Phase 9A closeout alone authorized 9B execution.

The owner accepts **Phase 9A GREEN only for its bounded headless session identity/persistence scope**, as recorded in `docs/tasks/p9a/closeout.md`. The 9A source/version checkpoint is coherent **`0.9.6` / `6b51ee96bcdc4ca185292f594c1886de81b149e8`**; its evidence-only closeout is **`bb266b34796bdb5a390e0e8e263cd8caf45701d8`**. Focused tests passed **13/13** and the documented restart replay passed. These observations do **not** qualify all of Phase 9 or prove 9B artifact linking.

The historical **Phase 5 P11 Not Green / P12 unexecuted** qualification gap remains open and unchanged. The qualified Phase 8 disposition also remains unchanged; no past evidence is rewritten. **Phases 9C, 9D, 9E, and Phase 10 are not activated by this decision.**

## Authorized scope and boundaries

- Execute 9B **P1–P6 implementation** in order: strict v2 typed session artifact references and v1 normalization; atomic session-store migration; genuinely read-only Chat, Planning Map and WorkItem resolution; read-only AgentTask/AgentRun/AgentTaskSequence and Project Mind resolution; revision-safe attach/detach and RPC; bounded cross-store integration.
- Execute **P7 as the sole manual 9B qualification/closeout**. P7 must independently demonstrate a **real, authorized Planning-to-Work replay** and the required exact-candidate migration, reference, read-only, isolation, restart, review and validation evidence. A deterministic fixture, a blocked/rejected run, or prior Phase 8 proof does not substitute for accepted-path qualification. If the real replay or any required gate is unavailable, close 9B **NOT GREEN** with the evidence gap recorded.
- Sessions remain optional organizational references to artifacts in their authoritative project-local stores, not permission grants or execution origins. Do not mutate linked artifacts during resolution or detachment, auto-start AgentRuns, automatically complete WorkItems, adopt architecture, add model context, or silently route data to hosted providers. Any hosted Codex use for real replay requires **separate explicit hosted-data consent**; do not infer that consent from this activation.
- Preserve the existing Phase 9B task boundaries. Do not build the 9C UI, 9D richer projections, 9E full GUI/aggregate or Phase 10 background alignment as part of this authorization.

## Version, preflight and execution law

This activation is **documentation-only**. The starting project manifests and pinned internal `@dope/*` references remain at **`0.9.6`**. P1 is responsible for advancing the coherent root/app/package versions to **`0.9.7` during P1 implementation**, not before it. Subsequent prompts own their assigned versions through **P6 `0.9.12`**; manual P7 requires a separate genuine **`0.9.13`** source/version checkpoint before evidence-only closeout. The runner verifies versions but does not bump them. Preserve unrelated work and lockfiles; do not fabricate checkpoints.

The initial local 9B P1 attempt stopped at the missing activation preflight with zero changed files and left version `0.9.6`. The reported "expected `0.9.7`; found `0.9.6`" was a consequence of stopping before implementation, not a reason to pre-bump or bypass preflight.

After safely synchronizing this new documentation commit with the local repository, inspect `git status --short` and verify the Git-proven `0.9.6` predecessor and required activation record. From the unchanged predecessor, validate and run:

```bash
npm run codex:phase:validate -- p9b
npm run codex:phase -- p9b
```

The owner has authorized **execution**, not asserted that any 9B prompt has passed, that any real replay has occurred, or that Phase 9 is GREEN or owner-closed. No automatic activation of 9C–9E or advancement to `0.9.14` follows from this record.
