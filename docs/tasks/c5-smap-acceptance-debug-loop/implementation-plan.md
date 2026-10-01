# Correction 5 Implementation Plan — sMap Acceptance Debug Loop Machinery

Status: **APPROVED / READY**
Correction folder: `c5-smap-acceptance-debug-loop`
Required unchanged package version: `0.5.11`
Activation source: `502416e2d8589132e8b96454ad3b72407406a20b`
Assessment: `prompt-assessment.md`
Authority: ADR 0018 plus current Software Map / Phase 5 authority

## Shared preflight

Every prompt reads BOOT/AGENTS, ADR 0018, Software Map storage, current architecture/product/stability/roadmap authority, this correction README/assessment/plan, and the exact source/tests named by the prompt.

Every prompt requires coherent `0.5.11`, reachable activation source, P11 still paused, P12 unexecuted, and no attempt to repair or regenerate the current Adaptive SEO architecture.

## Shared correction laws

1. Canonical architecture authority does not change.
2. Persisted review work may be invalid but must remain safe, bounded and non-canonical.
3. Reopen/check operations are provider-free.
4. Diagnostics inform; they never choose architecture.
5. Existing schema-1 review state remains readable.
6. The actual Adaptive SEO iterative debug loop is not part of this stack.
7. Keep version exactly `0.5.11`.

## P1 — Durable mutable review work state

Add a typed service operation for saving the current review draft with optimistic revision protection. Persist into the existing saved `review_required` analysis run.

Require: compatible existing schema-1 load, bounded storage validation without `parseArchitecture()` acceptance, ordinary edit/add/remove persistence, accepted Search Deeper persistence, no preview persistence, stale-write rejection, debounce/flush behavior, fresh restart restore, provider-free reopen, and clear on cancel/accept.

Focused tests cover old-file compatibility, invalid duplicate-root persistence, restart restoration, stale revision, accepted refinement restart, A/B isolation, cancel and acceptance cleanup.

T2 focused validation only; no browser/provider/Adaptive SEO/release packaging.

## P2 — Complete acceptance diagnostics + offline checker

Add provider-independent structured diagnostics with stable codes/order and implicated keys/IDs/paths.

Cover invalid/duplicate IDs, invalid/missing parents, required empty/malformed/unsafe roots, duplicate exact root claimants, and current declaration/dependency failures. Keep strict `parseArchitecture()` as the final canonical gate and do not auto-repair.

Add `npm run smap:review:check -- <project>` and deterministic machine-readable output. It loads only persisted `review_required` work, reports revision/blockers/staleness, exits nonzero on blockers, makes no writes, and calls no provider.

Make Architecture Review and backend acceptance preflight consume the same diagnostics. Replace misleading “Validated review ready” wording when blockers exist.

Focused T2 tests only; do not run the actual Adaptive SEO debug loop.

## P3 — Acceptance debug machinery closeout

Use fixtures only.

Audit:
- old schema-1 review compatibility;
- invalid edited draft durability through fresh restart;
- identical complete diagnostics before/after restart;
- no provider for reopen/checker;
- stale-write rejection;
- project isolation;
- cancel cleanup;
- valid fixture acceptance cleanup/canonical initialization;
- no synthesis/root-materialization/ownership auto-repair/version advance.

If any gate fails, record Not Green and do not repair in P3. If Green, write closeout, update correction README status, keep P11 paused, and route to the separate Adaptive SEO acceptance-debug loop.

Run exact focused P1/P2 regressions, correction prompt validation, diff check and unchanged-version/no-root-lock checks only.

## Exit routing

`c5 machinery closeout -> separate Adaptive SEO acceptance-debug loop -> real Accept Architecture success -> resume P11 -> P12`.

The actual debug-loop prompt is deliberately not part of this task folder.
