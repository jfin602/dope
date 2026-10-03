# Correction 6 Prompt Assessment — Edit Architecture

Status: **APPROVED / PROMPTS WRITTEN / READY FOR EXECUTION**
Correction folder: `c6-edit-architecture`
Required unchanged package version: `0.6.7`
Activation/source baseline: `b447d925ee4c12891ff072f235368e7b29a6854d`
Required predecessor correction: `c6-smap-outline` Green at `ac7fd5a29fb9d6dca4fc2f137f8fdef7f2a20439`
Authority: ADR 0024, ADR 0008, ADR 0009, ADR 0014, ADR 0018, PRODUCT-MODEL, ARCHITECTURE, workflow and the correction README

## Conclusion

Use exactly four ordered prompts.

| Prompt | Boundary | Validation tier | Routing |
| --- | --- | --- | --- |
| P1 | lossless canonical Architecture edit/read/save service seam | T2 | GPT-6 Sol High |
| P2 | permanent Edit Architecture workspace + initialized left action | T2 | GPT-6 Sol High |
| P3 | accepted-map Search Deeper + provider/evidence integration | T2 | GPT-6 Sol High |
| P4 | exact-candidate browser qualification + evidence-only correction closeout | T3 | GPT-6 Sol High |

The package version remains exactly `0.6.7` throughout.

This needs a correction stack rather than a one-off because Save Architecture creates a new canonical mutation path and accepted-map Search Deeper crosses UI, service, deterministic evidence and provider boundaries. Expensive GUI/provider evidence is concentrated in P4.

## Current-source findings

### The safe canonical replacement primitive already exists

`packages/code-analysis/src/node/smap-initialization-file.ts` already owns `replaceArchitecture(root, expectedFingerprint, declaration, beforeMarkerCommit)`.

It:
- requires an initialized Software Map;
- checks the expected declaration fingerprint;
- validates the replacement declaration;
- stages architecture and marker files safely beneath `.dope/`;
- keeps `smap.json` as the commit point;
- detects marker/declaration races;
- restores the original declaration on pre-commit failure;
- is already used by `VisualPlanningBackend.adoptTarget`.

P1 must reuse this authority instead of creating a second architecture writer or writing `.dope/architecture.json` directly.

Direct Edit Architecture saves do not have a companion Planning mutation to commit. Existing Planning Maps should become stale naturally because their stored architecture basis fingerprint no longer matches; the editor must not rewrite or silently rebase them.

### The current review draft is not lossless for accepted canonical Architecture

`ArchitectureReviewNode` carries kind/id/name/purpose/parent/roots, and `reviewDeclaration(...)` reconstructs Systems/Subystems/Components from those fields.

Canonical `SubsystemDeclaration` can also contain:
- `allowedDependencies`;
- `forbiddenDependencies`.

The current review projection does not carry those fields. Reusing it unchanged for accepted-map editing would silently delete canonical dependency constraints on Save Architecture.

P1 therefore needs one lossless shared editor-draft projection. The smallest direction is to evolve the existing review/editor node contract and `reviewDeclaration` so a canonical declaration can round-trip every current schema field while preserving initial-review behavior. A separate accepted-editor DTO is acceptable only if it avoids duplicating validation/editor logic.

### Service/backend currently expose initialization acceptance, not post-acceptance editing

`SoftwareMapService` currently exposes:
- initialization status;
- pending review read/save;
- initial review/manual acceptance;
- analysis/query operations.

It does not expose a read-current-canonical-architecture + stale-guarded replacement operation for an initialized project.

`SoftwareMapBackend` already has the right project-handle/root isolation and uses `readInitialization`, `readArchitecture`, `replaceArchitecture` dependencies. P1 should add the narrow service seam there, then run ordinary `SoftwareMapIndex.analyze(root)` after a successful canonical save.

A failed deterministic re-analysis after the canonical commit must be reported truthfully as failed map status; it must not pretend the canonical save did not occur.

### The current center review widget is deliberately review-only

`SoftwareMapReviewWidget` is currently hard-gated to:
- `controller.flow === 'review'`;
- `initialization.state === 'review_required'`;
- an active `controller.review`.

Its title and labels still say Architecture Review / Proposed hierarchy.

The widget already provides the useful editor machinery:
- System -> Subsystem -> Component tree;
- focused node editing;
- reparenting;
- canonical ID and roots;
- Add/Remove;
- evidence/source/document inspection;
- Search Deeper preview/accept/reject.

P2 should evolve this surface into permanent **Edit Architecture** rather than build another editor.

### The left action seam is ready

The Green `c6-smap-outline` correction already made initialized actions compact in `SoftwareMapWidget`.

Current initialized actions are:
- Open Physical Map;
- Refresh Software Map.

P2 should add **Edit Architecture** to this existing compact action group and focus the existing center editor if already open.

The outline's shared `SoftwareMapController.selectedId` behavior remains unchanged. Edit Architecture must not join that selection channel.

### Controller state is review-centric today

After initial acceptance, `SoftwareMapController.accept()` clears:
- `review`;
- `draft`;
- refinement preview/busy/error state.

`searchDeeper()` is hard-gated to `flow === 'review'` and a matching `reviewId`.

P2 needs an explicit accepted-Architecture edit mode/basis separate from the existing onboarding `flow` state. P3 then generalizes targeted refinement so the same editor can Search Deeper against an accepted canonical basis without pretending an initialized edit is a pending review.

### Accepted-map Search Deeper needs a fresh evidence basis

Pending-review Search Deeper intentionally uses the review's pinned `ArchitectureEvidencePacket`.

After acceptance that review packet is cleared. Accepted-map Search Deeper should collect a fresh deterministic evidence packet for the explicit refinement call and pin that packet for that call. It must not resurrect `.dope/smap-analysis.json` or create a durable accepted-edit analysis session.

The existing `planTargetedRefinement` / `parseTargetedRefinement` algorithm should be reused. P3 may generalize its basis contract or add a thin canonical-edit adapter, but must not fork a second refinement algorithm.

### Provider configuration exists but is not surfaced after initialization

The existing controller/backend already support Local/Gemini discovery, probe/readiness and targeted refinement. The initialized sidebar currently hides synthesis setup entirely.

P3 should expose a bounded provider-readiness path from Edit Architecture when Search Deeper is requested, reusing existing provider configuration/readiness state. This is not general Phase 7 AI Presence and must not create chat/Agent Runtime behavior.

## Decomposition rationale

### P1 — authority first

The canonical read/save seam and lossless draft round-trip are independently testable and are the highest-risk part. The UI must not be built on a lossy or unsafe save path.

### P2 — permanent editor second

Once the service can load/save canonical Architecture, the existing review widget/controller can become permanent Edit Architecture while preserving initial review acceptance. This prompt owns UI terminology, one-tab behavior, editor-local state and draft/save UX.

### P3 — Search Deeper third

Accepted-map Search Deeper requires the permanent editor plus a provider/evidence basis. Keeping it separate prevents provider/refinement complexity from obscuring the canonical editor/save implementation.

### P4 — expensive evidence once

Direct GUI, real accepted-project save behavior and one real provider-backed accepted-map Search Deeper call belong in one exact-candidate T3 gate. P4 also writes the correction closeout; it does not repair product behavior beyond a tightly bounded presentation-only tiny-fix allowance.

## Validation allocation

### P1 — T2

Why T2: the public Software Map service contract crosses `@dope/software-map`, the Node backend and the existing code-analysis persistence authority.

Run:
- focused Software Map initialization/persistence/service tests;
- any new canonical edit round-trip test;
- affected Software Map / code-analysis / Theia extension builds;
- focused Planning adoption/storage regression only if `replaceArchitecture` itself is changed;
- `git diff --check`;
- unchanged-version/no-root-lock checks.

Do not run browser GUI, live provider, aggregate `npm run check`, packaging or native evidence.

### P2 — T2

Run:
- focused Software Map UI/controller tests;
- c6-smap-outline regression;
- browser build (which already includes the extension build);
- `git diff --check`;
- unchanged-version/no-root-lock checks.

No live provider and no broad T3 qualification.

### P3 — T2

Run:
- targeted refinement unit tests with fake provider;
- accepted-edit controller/widget tests;
- focused initialization/UI/refinement integration tests;
- browser build (which already includes the extension build);
- `git diff --check`;
- unchanged-version/no-root-lock checks.

Do not make a real Local/Gemini request here.

### P4 — T3

On the exact candidate:
- `npm run check` once; run an extra correction-focused test only if it is not already included by the aggregate command;
- `git diff --check`;
- unchanged-version/no-root-lock coherence;
- correction phase validation if supported;
- direct browser GUI on a disposable copy of the accepted Adaptive SEO reference;
- one real configured provider-backed accepted-map Search Deeper call.

Do not package/requalify the known Phase 6 AppImage shutdown issue solely for this correction; that remains a separate P7 blocker.

## Applicable risks

- **Canonical data loss:** accepted draft projection drops dependency constraints or other schema fields.
- **Stale overwrite:** editor saves over a changed `.dope/architecture.json`.
- **Marker split-brain:** architecture bytes change without matching `.dope/smap.json`.
- **False rollback claim:** analysis fails after canonical commit but UI reports nothing was saved.
- **Planning corruption:** direct edit silently rewrites/rebases Planning Maps rather than letting basis staleness surface.
- **Review regression:** initial synthesis review/acceptance stops working while the widget is generalized.
- **State coupling:** selecting/editing in Edit Architecture changes the Physical Map or left outline selection.
- **Project leakage:** unsaved draft/refinement state survives into another workspace.
- **Duplicate editor tabs:** repeated left action creates competing editor instances.
- **Provider leakage:** accepted Search Deeper creates general AI Presence or silently falls back to another provider.
- **Stale refinement:** provider result applies after the edited branch or canonical basis changed.
- **Hidden canonical mutation:** Accept Refinement writes architecture before Save Architecture.
- **Persistent work creep:** accepted editing starts writing `.dope/smap-analysis.json` or a new draft/history database.
- **Terminology drift:** live surfaces retain Edit Hierarchy / Proposed hierarchy as product names.

## Green definition

Green requires all of the following:

- Architecture is the user-facing structural term; no live Edit Hierarchy product surface is introduced.
- Initial synthesis uses the same Edit Architecture surface and still requires explicit Accept Architecture.
- Initialized Software Map shows Edit Architecture beside Open/Refresh.
- Repeated activation focuses one editor.
- Current canonical architecture loads losslessly into an editable draft, including dependency constraints.
- Typing/reparent/add/remove/refinement never writes canonical architecture.
- Save Architecture uses stale-guarded canonical replacement and matching marker update.
- Successful save triggers ordinary deterministic Software Map re-analysis.
- Existing Planning Maps are not silently rewritten/rebased by direct Architecture editing.
- Edit Architecture selection/expansion/focus remains independent from map/outline selection.
- Accepted-map Search Deeper is branch-local, preview-first, provider-explicit and draft-only until Save.
- Workspace switches cannot publish stale edit/refinement results into the new project.
- No durable accepted-map edit session/history store is added.
- Package remains exactly `0.6.7`.
