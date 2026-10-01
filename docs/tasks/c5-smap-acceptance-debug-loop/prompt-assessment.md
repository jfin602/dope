# Correction 5 Prompt Assessment — sMap Acceptance Debug Loop Machinery

Status: **APPROVED / READY**
Correction folder: `c5-smap-acceptance-debug-loop`
Required unchanged package version: `0.5.11`
Activation source: `502416e2d8589132e8b96454ad3b72407406a20b`
Authority: ADR 0018 and current Software Map / Phase 5 authority

## Conclusion

Use exactly three ordered prompts:

1. **P1 — Durable review work state.** Persist the mutable review draft/revision through the existing project-local analysis-run file and restore it after restart without provider execution.
2. **P2 — Acceptance diagnostics and checker.** Add one shared deterministic all-blockers validator, a zero-provider non-mutating project checker, and make the review UI/backend preflight consume the same rules.
3. **P3 — Machinery closeout.** Audit deterministic fixture evidence only. Do not debug Adaptive SEO in the stack.

P1/P2 use GPT-6 Sol High because both cross storage/service/frontend/domain boundaries. P3 uses GPT-6 Sol Medium.

## Current source findings

- `SavedSynthesisRun` already persists `.dope/smap-analysis.json` and may carry `review_required` plus an `ArchitectureReview`.
- `SoftwareMapBackend.attach()` reloads that run and restores pending review state.
- `SoftwareMapController.attach()` reopens the saved review.
- ordinary review edits, add/remove operations and accepted Search Deeper replacements currently rewrite frontend `draft` without a typed durable draft-save operation;
- `parseArchitecture()` is correctly strict/fail-fast, so `draftError()` exposes only the first blocker;
- initial review materialization can yield roots later rejected by the global canonical parser. That motivates diagnostics but is **not repaired in this correction**.

## P1 boundary

Primary surfaces:
- `packages/software-map/src/service.ts`;
- `packages/code-analysis/src/node/smap-analysis-file.ts`;
- `packages/theia-extension/src/node/software-map-backend.ts`;
- `packages/theia-extension/src/browser/software-map-controller.ts`;
- focused Software Map initialization/UI tests.

Expected shape: typed save-review-draft operation, monotonic revision, safe persistence that does not require acceptance validity, debounce/flush, accepted refinement persistence, exact restart restoration, clear on cancel/accept, and no provider needed to reopen.

## P2 boundary

Primary surfaces:
- `@dope/software-map` architecture/review domain;
- backend acceptance preflight;
- review controller/widget;
- small CLI/script boundary and package script;
- focused domain/backend/UI/CLI tests.

Expected shape: structured deterministic issues, duplicate-root claimants, `npm run smap:review:check -- <project>` plus machine-readable output, no writes/provider calls, shared UI/backend rules, and truthful review-ready/acceptance-blocked wording.

## Main risks

- treating review work as canonical architecture;
- requiring acceptance-valid data before persistence;
- stale debounce overwriting newer state;
- checker duplicating rather than sharing validation rules;
- mutating project state from diagnostics;
- “fixing” ownership/root materialization in this machinery correction;
- invalidating the existing Adaptive SEO specimen.

## Green definition

One intentionally invalid unaccepted review can survive restart/reopen with its latest draft intact, complete deterministic blockers are stable and inspectable, and no provider call is required. The real Adaptive SEO debug loop remains separate.
